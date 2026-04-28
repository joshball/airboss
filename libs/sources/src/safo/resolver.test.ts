import { describe, expect, it } from 'vitest';
import type { SourceId } from '../types.ts';
import { SAFO_CORPUS, SAFO_RESOLVER } from './resolver.ts';

describe('SAFO_RESOLVER', () => {
	it('declares the corpus name', () => {
		expect(SAFO_RESOLVER.corpus).toBe(SAFO_CORPUS);
		expect(SAFO_RESOLVER.corpus).toBe('safo');
	});

	it('parses a known-good locator', () => {
		const result = SAFO_RESOLVER.parseLocator('23004');
		expect(result.kind).toBe('ok');
	});

	it('rejects a malformed locator', () => {
		const result = SAFO_RESOLVER.parseLocator('23A04');
		expect(result.kind).toBe('error');
	});

	it('builds a live URL for a known-good SourceId', () => {
		const url = SAFO_RESOLVER.getLiveUrl('airboss-ref:safo/23004' as SourceId, 'unspecified');
		expect(url).toContain('faa.gov');
	});

	it('returns null for getDerivativeContent (deferred)', () => {
		expect(SAFO_RESOLVER.getDerivativeContent('airboss-ref:safo/23004' as SourceId, 'n/a')).toBe(null);
	});

	it('returns null for getIndexedContent (deferred)', async () => {
		const content = await SAFO_RESOLVER.getIndexedContent('airboss-ref:safo/23004' as SourceId, 'n/a');
		expect(content).toBe(null);
	});

	it('returns empty editions for an unknown SourceId', async () => {
		const editions = await SAFO_RESOLVER.getEditions('airboss-ref:safo/23004' as SourceId);
		expect(editions).toEqual([]);
	});

	it('returns null current edition when no entries are registered', () => {
		expect(SAFO_RESOLVER.getCurrentEdition()).toBe(null);
	});
});
