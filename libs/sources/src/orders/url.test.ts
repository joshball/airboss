import { describe, expect, it } from 'vitest';
import type { SourceId } from '../types.ts';
import { getOrdersLiveUrl } from './url.ts';

describe('getOrdersLiveUrl', () => {
	it('builds a search URL for a whole-order locator', () => {
		const id = 'airboss-ref:orders/faa/2150-3' as SourceId;
		const url = getOrdersLiveUrl(id, 'unspecified');
		expect(url).toBe('https://www.faa.gov/regulations_policies/orders_notices?searchedQuery=2150.3');
	});

	it('builds a search URL for a volume + chapter locator', () => {
		const id = 'airboss-ref:orders/faa/8900-1/vol-5/ch-1' as SourceId;
		const url = getOrdersLiveUrl(id, 'unspecified');
		expect(url).toBe('https://www.faa.gov/regulations_policies/orders_notices?searchedQuery=8900.1');
	});

	it('builds a search URL with revision-letter suffix preserved', () => {
		const id = 'airboss-ref:orders/faa/8260-3C/par-5.2.1' as SourceId;
		const url = getOrdersLiveUrl(id, 'unspecified');
		expect(url).toBe('https://www.faa.gov/regulations_policies/orders_notices?searchedQuery=8260.3C');
	});

	it('strips the ?at= pin before parsing', () => {
		const id = 'airboss-ref:orders/faa/2150-3?at=2018-04' as SourceId;
		const url = getOrdersLiveUrl(id, '2018-04');
		expect(url).toBe('https://www.faa.gov/regulations_policies/orders_notices?searchedQuery=2150.3');
	});

	it('returns null for a non-orders SourceId', () => {
		const id = 'airboss-ref:ac/61-65/j' as SourceId;
		expect(getOrdersLiveUrl(id, 'unspecified')).toBe(null);
	});

	it('returns null for a malformed orders locator', () => {
		const id = 'airboss-ref:orders/faa' as SourceId;
		expect(getOrdersLiveUrl(id, 'unspecified')).toBe(null);
	});
});
