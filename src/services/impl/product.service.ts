import {type Cradle} from '@fastify/awilix';
import {type INotificationService} from '../notifications.port.js';
import {isExpired, isInSeason, willDelayExceedSeason} from '../../utils/helpers.js';
import {type Product} from '@/db/schema.js';
import {ProductRepository} from './product.repository.js';

export class ProductService {
	private readonly ns: INotificationService;
	private readonly repo: ProductRepository;

	public constructor({ns, db}: Pick<Cradle, 'ns' | 'db'>) {
		this.ns = ns;
		this.repo = new ProductRepository(db);
	}

	public async notifyDelay(leadTime: number, p: Product): Promise<void> {
		await this.repo.saveLeadTime(p, leadTime);
		this.ns.sendDelayNotification(leadTime, p.name);
	}

	private async decrementAvailability(p: Product): Promise<void> {
		await this.repo.decrementAvailability(p);
	}

	public async processNormalProduct(p: Product): Promise<void> {
		if (p.available > 0) {
			await this.decrementAvailability(p);
			return;
		}

		if (p.leadTime > 0) {
			await this.notifyDelay(p.leadTime, p);
		}
	}

	public async handleSeasonalProduct(p: Product): Promise<void> {
		const currentDate = new Date();
		if (willDelayExceedSeason(p, currentDate)) {
			this.ns.sendOutOfStockNotification(p.name);
			await this.repo.setUnavailable(p);
		} else if (!isInSeason(p, currentDate)) {
			this.ns.sendOutOfStockNotification(p.name);
			await this.repo.update(p);
		} else {
			await this.notifyDelay(p.leadTime, p);
		}
	}

	public async processSeasonalProduct(p: Product): Promise<void> {
		const currentDate = new Date();
		if (isInSeason(p, currentDate) && p.available > 0) {
			await this.decrementAvailability(p);
			return;
		}

		await this.handleSeasonalProduct(p);
	}

	public async handleExpiredProduct(p: Product): Promise<void> {
		const currentDate = new Date();
		if (p.available > 0 && !isExpired(p, currentDate)) {
			await this.decrementAvailability(p);
		} else {
			this.ns.sendExpirationNotification(p.name, p.expiryDate!);
			await this.repo.setUnavailable(p);
		}
	}

	public async processExpirableProduct(p: Product): Promise<void> {
		const currentDate = new Date();
		if (p.available > 0 && !isExpired(p, currentDate)) {
			await this.decrementAvailability(p);
			return;
		}

		await this.handleExpiredProduct(p);
	}

	public async processProduct(p: Product): Promise<void> {
		switch (p.type) {
			case 'NORMAL':
				await this.processNormalProduct(p);
				break;
			case 'SEASONAL':
				await this.processSeasonalProduct(p);
				break;
			case 'EXPIRABLE':
				await this.processExpirableProduct(p);
				break;
			default:
				break;
		}
	}
}
