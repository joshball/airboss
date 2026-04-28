import { describe, expect, it } from 'vitest';
import type { SourceId } from '../types.ts';
import { INTERP_CORPUS, INTERP_RESOLVER } from './resolver.ts';

describe('INTERP_RESOLVER', () => {
	it('declares the corpus name', () => {
		expect(INTERP_RESOLVER.corpus).toBe(INTERP_CORPUS);
		expect(INTERP_RESOLVER.corpus).toBe('interp');
	});

	it('parses a known-good chief-counsel locator', () => {
		const result = INTERP_RESOLVER.parseLocator('chief-counsel/mangiamele-2009');
		expect(result.kind).toBe('ok');
	});

	it('parses a known-good ntsb locator', () => {
		const result = INTERP_RESOLVER.parseLocator('ntsb/administrator-v-lobeiko');
		expect(result.kind).toBe('ok');
	});

	it('rejects a malformed locator', () => {
		const result = INTERP_RESOLVER.parseLocator('chief-counsel/mangiamele');
		expect(result.kind).toBe('error');
	});

	it('builds a live URL for chief-counsel', () => {
		const url = INTERP_RESOLVER.getLiveUrl('airboss-ref:interp/chief-counsel/mangiamele-2009' as SourceId, 'n/a');
		expect(url).toContain('faa.gov');
	});

	it('builds a live URL for ntsb', () => {
		const url = INTERP_RESOLVER.getLiveUrl('airboss-ref:interp/ntsb/administrator-v-lobeiko' as SourceId, 'n/a');
		expect(url).toContain('ntsb.gov');
	});

	it('returns null for getDerivativeContent (deferred)', () => {
		const content = INTERP_RESOLVER.getDerivativeContent(
			'airboss-ref:interp/chief-counsel/mangiamele-2009' as SourceId,
			'n/a',
		);
		expect(content).toBe(null);
	});

	it('returns null for getIndexedContent (deferred)', async () => {
		const content = await INTERP_RESOLVER.getIndexedContent(
			'airboss-ref:interp/chief-counsel/mangiamele-2009' as SourceId,
			'n/a',
		);
		expect(content).toBe(null);
	});

	it('returns empty editions for an unknown SourceId', async () => {
		const editions = await INTERP_RESOLVER.getEditions('airboss-ref:interp/chief-counsel/mangiamele-2009' as SourceId);
		expect(editions).toEqual([]);
	});

	it('returns null current edition when no entries are registered', () => {
		expect(INTERP_RESOLVER.getCurrentEdition()).toBe(null);
	});
});
