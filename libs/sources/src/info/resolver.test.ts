import { describe, expect, it } from 'vitest';
import type { SourceId } from '../types.ts';
import { INFO_CORPUS, INFO_RESOLVER } from './resolver.ts';

describe('INFO_RESOLVER', () => {
	it('declares the corpus name', () => {
		expect(INFO_RESOLVER.corpus).toBe(INFO_CORPUS);
		expect(INFO_RESOLVER.corpus).toBe('info');
	});

	it('parses a known-good locator', () => {
		const result = INFO_RESOLVER.parseLocator('21010');
		expect(result.kind).toBe('ok');
	});

	it('rejects a malformed locator', () => {
		const result = INFO_RESOLVER.parseLocator('21A10');
		expect(result.kind).toBe('error');
	});

	it('builds a live URL for a known-good SourceId', () => {
		const url = INFO_RESOLVER.getLiveUrl('airboss-ref:info/21010' as SourceId, 'unspecified');
		expect(url).toContain('faa.gov');
	});

	it('returns null for getDerivativeContent (deferred)', () => {
		expect(INFO_RESOLVER.getDerivativeContent('airboss-ref:info/21010' as SourceId, 'n/a')).toBe(null);
	});

	it('returns null for getIndexedContent (deferred)', async () => {
		const content = await INFO_RESOLVER.getIndexedContent('airboss-ref:info/21010' as SourceId, 'n/a');
		expect(content).toBe(null);
	});

	it('returns empty editions for an unknown SourceId', async () => {
		const editions = await INFO_RESOLVER.getEditions('airboss-ref:info/21010' as SourceId);
		expect(editions).toEqual([]);
	});

	it('returns null current edition when no entries are registered', () => {
		expect(INFO_RESOLVER.getCurrentEdition()).toBe(null);
	});
});
