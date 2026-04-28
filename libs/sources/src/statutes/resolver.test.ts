import { describe, expect, it } from 'vitest';
import type { SourceId } from '../types.ts';
import { STATUTES_CORPUS, STATUTES_RESOLVER } from './resolver.ts';

describe('STATUTES_RESOLVER', () => {
	it('declares the corpus name', () => {
		expect(STATUTES_RESOLVER.corpus).toBe(STATUTES_CORPUS);
		expect(STATUTES_RESOLVER.corpus).toBe('statutes');
	});

	it('parses a known-good locator', () => {
		const result = STATUTES_RESOLVER.parseLocator('usc-49/40103');
		expect(result.kind).toBe('ok');
	});

	it('rejects a malformed locator', () => {
		const result = STATUTES_RESOLVER.parseLocator('usc-49');
		expect(result.kind).toBe('error');
	});

	it('builds a live URL for a known-good SourceId', () => {
		const url = STATUTES_RESOLVER.getLiveUrl('airboss-ref:statutes/usc-49/40103' as SourceId, '2024');
		expect(url).toContain('uscode.house.gov');
	});

	it('returns null for getDerivativeContent (deferred)', () => {
		expect(STATUTES_RESOLVER.getDerivativeContent('airboss-ref:statutes/usc-49/40103' as SourceId, 'n/a')).toBe(null);
	});

	it('returns null for getIndexedContent (deferred)', async () => {
		const content = await STATUTES_RESOLVER.getIndexedContent('airboss-ref:statutes/usc-49/40103' as SourceId, 'n/a');
		expect(content).toBe(null);
	});

	it('returns empty editions for an unknown SourceId', async () => {
		const editions = await STATUTES_RESOLVER.getEditions('airboss-ref:statutes/usc-49/40103' as SourceId);
		expect(editions).toEqual([]);
	});

	it('returns null current edition when no entries are registered', () => {
		expect(STATUTES_RESOLVER.getCurrentEdition()).toBe(null);
	});
});
