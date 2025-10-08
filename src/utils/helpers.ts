import {type Product} from '@/db/schema.js';

export function daysToMs(days: number): number {
	return days * 24 * 60 * 60 * 1000;
}

export function isInSeason(p: Product, now: Date): boolean {
	if (!p.seasonStartDate || !p.seasonEndDate) {
		return false;
	}
	return now > p.seasonStartDate && now < p.seasonEndDate;
}

export function willDelayExceedSeason(p: Product, now: Date): boolean {
	if (!p.seasonEndDate) {
		return false;
	}
	const arrival = new Date(now.getTime() + daysToMs(p.leadTime));
	return arrival > p.seasonEndDate;
}

export function isExpired(p: Product, now: Date): boolean {
	if (!p.expiryDate) {
		return false;
	}
	return p.expiryDate <= now;
}


