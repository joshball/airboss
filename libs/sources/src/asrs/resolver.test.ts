import { describe, expect, it } from 'vitest';
import type { SourceId } from '../types.ts';
import { ASRS_CORPUS, ASRS_RESOLVER } from './resolver.ts';

describe('ASRS_RESOLVER', () => {
	it('declares the corpus name', () => {
		expect(ASRS_RESOLVER.corpus).toBe(ASRS_CORPUS);
		expect(ASRS_RESOLVER.corpus).toBe('asrs');
	});

	it('parses a known-good locator', () => {
		const result = ASRS_RESOLVER.parseLocator('1234567');
		expect(result.kind).toBe('ok');
	});

	it('rejects a malformed locator', () => {
		const result = ASRS_RESOLVER.parseLocator('12345');
		expect(result.kind).toBe('error');
	});

	it('builds a live URL for a known-good SourceId', () => {
		const url = ASRS_RESOLVER.getLiveUrl('airboss-ref:asrs/1234567' as SourceId, 'unspecified');
		expect(url).toContain('asrs.arc.nasa.gov');
		expect(url).toContain('acn=1234567');
	});

	it('returns null for getDerivativeContent (deferred)', () => {
		expect(ASRS_RESOLVER.getDerivativeContent('airboss-ref:asrs/1234567' as SourceId, 'n/a')).toBe(null);
	});

	it('returns null for getIndexedContent (deferred)', async () => {
		const content = await ASRS_RESOLVER.getIndexedContent('airboss-ref:asrs/1234567' as SourceId, 'n/a');
		expect(content).toBe(null);
	});

	it('returns empty editions for an unknown SourceId', async () => {
		const editions = await ASRS_RESOLVER.getEditions('airboss-ref:asrs/1234567' as SourceId);
		expect(editions).toEqual([]);
	});

	it('returns null current edition when no entries are registered', () => {
		expect(ASRS_RESOLVER.getCurrentEdition()).toBe(null);
	});
});
