import { describe, expect, it } from 'vitest';
import type { SourceId } from '../types.ts';
import { ORDERS_CORPUS, ORDERS_RESOLVER } from './resolver.ts';

describe('ORDERS_RESOLVER', () => {
	it('declares the corpus name', () => {
		expect(ORDERS_RESOLVER.corpus).toBe(ORDERS_CORPUS);
		expect(ORDERS_RESOLVER.corpus).toBe('orders');
	});

	it('parses a known-good locator', () => {
		const result = ORDERS_RESOLVER.parseLocator('faa/2150-3');
		expect(result.kind).toBe('ok');
	});

	it('rejects a malformed locator', () => {
		const result = ORDERS_RESOLVER.parseLocator('faa');
		expect(result.kind).toBe('error');
	});

	it('builds a live URL for a known-good SourceId', () => {
		const url = ORDERS_RESOLVER.getLiveUrl('airboss-ref:orders/faa/8260-3C/par-5.2.1' as SourceId, '2018-04');
		expect(url).toContain('faa.gov');
		expect(url).toContain('8260.3C');
	});

	it('returns null for getDerivativeContent (deferred to a later WP)', () => {
		const content = ORDERS_RESOLVER.getDerivativeContent('airboss-ref:orders/faa/2150-3' as SourceId, '2018-04');
		expect(content).toBe(null);
	});

	it('returns null for getIndexedContent (deferred to a later WP)', async () => {
		const content = await ORDERS_RESOLVER.getIndexedContent('airboss-ref:orders/faa/2150-3' as SourceId, '2018-04');
		expect(content).toBe(null);
	});

	it('returns empty editions for an unknown SourceId', async () => {
		const editions = await ORDERS_RESOLVER.getEditions('airboss-ref:orders/faa/2150-3' as SourceId);
		expect(editions).toEqual([]);
	});

	it('returns null current edition when no entries are registered', () => {
		// Phase 10 first slice has no entries; getCurrentEdition returns null.
		// Once ingestion lands, this test will need to swap in a fixture
		// registry to assert lexical-max behavior.
		expect(ORDERS_RESOLVER.getCurrentEdition()).toBe(null);
	});
});
