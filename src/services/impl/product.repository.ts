import {eq} from 'drizzle-orm';
import {products, type Product} from '@/db/schema.js';
import {type Database} from '@/db/type.js';

export class ProductRepository {
	private readonly db: Database;

	public constructor(db: Database) {
		this.db = db;
	}

	public async update(product: Product): Promise<void> {
		await this.db.update(products).set(product).where(eq(products.id, product.id));
	}

	public async decrementAvailability(product: Product): Promise<void> {
		product.available -= 1;
		await this.update(product);
	}

	public async setUnavailable(product: Product): Promise<void> {
		product.available = 0;
		await this.update(product);
	}

	public async saveLeadTime(product: Product, leadTime: number): Promise<void> {
		product.leadTime = leadTime;
		await this.update(product);
	}
}


