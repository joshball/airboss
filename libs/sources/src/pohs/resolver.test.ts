import { describe, expect, it } from 'vitest';
import type { SourceId } from '../types.ts';
import { POHS_CORPUS, POHS_RESOLVER } from './resolver.ts';

describe('POHS_RESOLVER', () => {
	it('declares the corpus name', () => {
		expect(POHS_RESOLVER.corpus).toBe(POHS_CORPUS);
		expect(POHS_RESOLVER.corpus).toBe('pohs');
	});

	it('parses a known-good locator', () => {
		const result = POHS_RESOLVER.parseLocator('c172s/section-2/vne');
		expect(result.kind).toBe('ok');
	});

	it('rejects a malformed locator', () => {
		const result = POHS_RESOLVER.parseLocator('C172S');
		expect(result.kind).toBe('error');
	});

	it('returns null live URL (no formula for POHs)', () => {
		const url = POHS_RESOLVER.getLiveUrl('airboss-ref:pohs/c172s' as SourceId, 'n/a');
		expect(url).toBe(null);
	});

	it('returns null for getDerivativeContent (deferred)', () => {
		expect(POHS_RESOLVER.getDerivativeContent('airboss-ref:pohs/c172s' as SourceId, 'n/a')).toBe(null);
	});

	it('returns null for getIndexedContent (deferred)', async () => {
		const content = await POHS_RESOLVER.getIndexedContent('airboss-ref:pohs/c172s' as SourceId, 'n/a');
		expect(content).toBe(null);
	});

	it('returns empty editions for an unknown SourceId', async () => {
		const editions = await POHS_RESOLVER.getEditions('airboss-ref:pohs/c172s' as SourceId);
		expect(editions).toEqual([]);
	});

	it('returns null current edition when no entries are registered', () => {
		expect(POHS_RESOLVER.getCurrentEdition()).toBe(null);
	});
});
