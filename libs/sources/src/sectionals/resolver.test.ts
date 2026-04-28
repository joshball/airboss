import { describe, expect, it } from 'vitest';
import type { SourceId } from '../types.ts';
import { SECTIONALS_CORPUS, SECTIONALS_RESOLVER } from './resolver.ts';

describe('SECTIONALS_RESOLVER', () => {
	it('declares the corpus name', () => {
		expect(SECTIONALS_RESOLVER.corpus).toBe(SECTIONALS_CORPUS);
		expect(SECTIONALS_RESOLVER.corpus).toBe('sectionals');
	});

	it('parses a known-good locator', () => {
		const result = SECTIONALS_RESOLVER.parseLocator('denver');
		expect(result.kind).toBe('ok');
	});

	it('rejects a malformed locator', () => {
		const result = SECTIONALS_RESOLVER.parseLocator('Denver');
		expect(result.kind).toBe('error');
	});

	it('builds a live URL for a known-good SourceId', () => {
		const url = SECTIONALS_RESOLVER.getLiveUrl('airboss-ref:sectionals/los-angeles' as SourceId, '2026-04-23');
		expect(url).toContain('faa.gov');
	});

	it('returns null for getDerivativeContent (deferred)', () => {
		expect(SECTIONALS_RESOLVER.getDerivativeContent('airboss-ref:sectionals/denver' as SourceId, 'n/a')).toBe(null);
	});

	it('returns null for getIndexedContent (deferred)', async () => {
		const content = await SECTIONALS_RESOLVER.getIndexedContent('airboss-ref:sectionals/denver' as SourceId, 'n/a');
		expect(content).toBe(null);
	});

	it('returns empty editions for an unknown SourceId', async () => {
		const editions = await SECTIONALS_RESOLVER.getEditions('airboss-ref:sectionals/denver' as SourceId);
		expect(editions).toEqual([]);
	});

	it('returns null current edition when no entries are registered', () => {
		expect(SECTIONALS_RESOLVER.getCurrentEdition()).toBe(null);
	});
});
