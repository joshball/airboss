import { describe, expect, it } from 'vitest';
import type { SourceId } from '../types.ts';
import { TCDS_CORPUS, TCDS_RESOLVER } from './resolver.ts';

describe('TCDS_RESOLVER', () => {
	it('declares the corpus name', () => {
		expect(TCDS_RESOLVER.corpus).toBe(TCDS_CORPUS);
		expect(TCDS_RESOLVER.corpus).toBe('tcds');
	});

	it('parses a known-good locator', () => {
		const result = TCDS_RESOLVER.parseLocator('3a12');
		expect(result.kind).toBe('ok');
	});

	it('rejects a malformed locator', () => {
		const result = TCDS_RESOLVER.parseLocator('3A12');
		expect(result.kind).toBe('error');
	});

	it('builds a live URL for a known-good SourceId', () => {
		const url = TCDS_RESOLVER.getLiveUrl('airboss-ref:tcds/3a12' as SourceId, 'unspecified');
		expect(url).toContain('faa.gov');
	});

	it('returns null for getDerivativeContent (deferred)', () => {
		expect(TCDS_RESOLVER.getDerivativeContent('airboss-ref:tcds/3a12' as SourceId, 'n/a')).toBe(null);
	});

	it('returns null for getIndexedContent (deferred)', async () => {
		const content = await TCDS_RESOLVER.getIndexedContent('airboss-ref:tcds/3a12' as SourceId, 'n/a');
		expect(content).toBe(null);
	});

	it('returns empty editions for an unknown SourceId', async () => {
		const editions = await TCDS_RESOLVER.getEditions('airboss-ref:tcds/3a12' as SourceId);
		expect(editions).toEqual([]);
	});

	it('returns null current edition when no entries are registered', () => {
		expect(TCDS_RESOLVER.getCurrentEdition()).toBe(null);
	});
});
