import { describe, expect, it } from 'vitest';
import type { SourceId } from '../types.ts';
import { NTSB_ALJ_CORPUS, NTSB_ALJ_RESOLVER } from './resolver.ts';

describe('NTSB_ALJ_RESOLVER', () => {
	it('declares the corpus name', () => {
		expect(NTSB_ALJ_RESOLVER.corpus).toBe(NTSB_ALJ_CORPUS);
		expect(NTSB_ALJ_RESOLVER.corpus).toBe('ntsb-alj');
	});

	it('parses a known-good locator', () => {
		const result = NTSB_ALJ_RESOLVER.parseLocator('ea-5567');
		expect(result.kind).toBe('ok');
	});

	it('rejects a malformed locator', () => {
		const result = NTSB_ALJ_RESOLVER.parseLocator('xy-1234');
		expect(result.kind).toBe('error');
	});

	it('builds a live URL for a known-good SourceId', () => {
		const url = NTSB_ALJ_RESOLVER.getLiveUrl('airboss-ref:ntsb-alj/ea-5567' as SourceId, 'unspecified');
		expect(url).toContain('ntsb.gov');
	});

	it('returns null for getDerivativeContent (deferred)', () => {
		expect(NTSB_ALJ_RESOLVER.getDerivativeContent('airboss-ref:ntsb-alj/ea-5567' as SourceId, 'n/a')).toBe(null);
	});

	it('returns null for getIndexedContent (deferred)', async () => {
		const content = await NTSB_ALJ_RESOLVER.getIndexedContent('airboss-ref:ntsb-alj/ea-5567' as SourceId, 'n/a');
		expect(content).toBe(null);
	});

	it('returns empty editions for an unknown SourceId', async () => {
		const editions = await NTSB_ALJ_RESOLVER.getEditions('airboss-ref:ntsb-alj/ea-5567' as SourceId);
		expect(editions).toEqual([]);
	});

	it('returns null current edition when no entries are registered', () => {
		expect(NTSB_ALJ_RESOLVER.getCurrentEdition()).toBe(null);
	});
});
