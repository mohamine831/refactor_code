import {
	describe, it, expect, beforeEach,
	afterEach,
} from 'vitest';
import {mockDeep, type DeepMockProxy} from 'vitest-mock-extended';
import {type INotificationService} from '../notifications.port.js';
import {createDatabaseMock, cleanUp} from '../../utils/test-utils/database-tools.ts.js';
import {ProductService} from './product.service.js';
import {products, type Product} from '@/db/schema.js';
import {type Database} from '@/db/type.js';

describe('ProductService Tests', () => {
	let notificationServiceMock: DeepMockProxy<INotificationService>;
	let productService: ProductService;
	let databaseMock: Database;
	let databaseName: string;
	let closeDb: () => void;

	beforeEach(async () => {
		({databaseMock, databaseName, close: closeDb} = await createDatabaseMock());
		notificationServiceMock = mockDeep<INotificationService>();
		productService = new ProductService({
			ns: notificationServiceMock,
			db: databaseMock,
		});
	});

	afterEach(async () => {
		closeDb?.();
		await cleanUp(databaseName);
	});

	it('should handle delay notification correctly', async () => {
		// GIVEN
		const product: Product = {
			id: 1,
			leadTime: 15,
			available: 0,
			type: 'NORMAL',
			name: 'RJ45 Cable',
			expiryDate: null,
			seasonStartDate: null,
			seasonEndDate: null,
		};
		await databaseMock.insert(products).values(product);

		// WHEN
		await productService.notifyDelay(product.leadTime, product);

		// THEN
		expect(product.available).toBe(0);
		expect(product.leadTime).toBe(15);
		expect(notificationServiceMock.sendDelayNotification).toHaveBeenCalledWith(product.leadTime, product.name);
		const result = await databaseMock.query.products.findFirst({
			where: (product, {eq}) => eq(product.id, product.id),
		});
		expect(result).toEqual(product);
	});

	it('should decrement availability for SEASONAL when in season', async () => {
		// GIVEN
		const d = 24 * 60 * 60 * 1000;
		const product: Product = {
			id: 2,
			leadTime: 5,
			available: 10,
			type: 'SEASONAL',
			name: 'Watermelon',
			expiryDate: null,
			seasonStartDate: new Date(Date.now() - (2 * d)),
			seasonEndDate: new Date(Date.now() + (10 * d)),
		};
		await databaseMock.insert(products).values(product);

		// WHEN
		await productService.processSeasonalProduct(product);

		// THEN
		expect(product.available).toBe(9);
		expect(notificationServiceMock.sendOutOfStockNotification).not.toHaveBeenCalled();
		const result = await databaseMock.query.products.findFirst({
			where: (p, {eq}) => eq(p.id, product.id),
		});
		expect(result!.available).toBe(9);
	});

	it('should notify out of stock for SEASONAL when delay exceeds season end', async () => {
		// GIVEN
		const d = 24 * 60 * 60 * 1000;
		const product: Product = {
			id: 3,
			leadTime: 30, // delay pushes beyond season end
			available: 0,
			type: 'SEASONAL',
			name: 'Grapes',
			expiryDate: null,
			seasonStartDate: new Date(Date.now() - (2 * d)),
			seasonEndDate: new Date(Date.now() + (10 * d)),
		};
		await databaseMock.insert(products).values(product);

		// WHEN
		await productService.handleSeasonalProduct(product);

		// THEN
		expect(notificationServiceMock.sendOutOfStockNotification).toHaveBeenCalledWith(product.name);
		expect(product.available).toBe(0);
		const result = await databaseMock.query.products.findFirst({
			where: (p, {eq}) => eq(p.id, product.id),
		});
		expect(result!.available).toBe(0);
	});

	it('should decrement availability for EXPIRABLE when not expired', async () => {
		// GIVEN
		const d = 24 * 60 * 60 * 1000;
		const product: Product = {
			id: 4,
			leadTime: 15,
			available: 5,
			type: 'EXPIRABLE',
			name: 'Butter',
			expiryDate: new Date(Date.now() + (10 * d)),
			seasonStartDate: null,
			seasonEndDate: null,
		};
		await databaseMock.insert(products).values(product);

		// WHEN
		await productService.processExpirableProduct(product);

		// THEN
		expect(product.available).toBe(4);
		expect(notificationServiceMock.sendExpirationNotification).not.toHaveBeenCalled();
		const result = await databaseMock.query.products.findFirst({
			where: (p, {eq}) => eq(p.id, product.id),
		});
		expect(result!.available).toBe(4);
	});

	it('should notify expiration and set unavailable for EXPIRABLE when expired', async () => {
		// GIVEN
		const d = 24 * 60 * 60 * 1000;
		const expiryDate = new Date(Date.now() - (2 * d));
		const product: Product = {
			id: 5,
			leadTime: 15,
			available: 1,
			type: 'EXPIRABLE',
			name: 'Milk',
			expiryDate,
			seasonStartDate: null,
			seasonEndDate: null,
		};
		await databaseMock.insert(products).values(product);

		// WHEN
		await productService.processExpirableProduct(product);

		// THEN
		expect(notificationServiceMock.sendExpirationNotification).toHaveBeenCalledWith(product.name, expiryDate);
		expect(product.available).toBe(0);
		const result = await databaseMock.query.products.findFirst({
			where: (p, {eq}) => eq(p.id, product.id),
		});
		expect(result!.available).toBe(0);
	});
});

