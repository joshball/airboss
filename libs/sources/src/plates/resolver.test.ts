import { describe, expect, it } from 'vitest';
import type { SourceId } from '../types.ts';
import { PLATES_CORPUS, PLATES_RESOLVER } from './resolver.ts';

describe('PLATES_RESOLVER', () => {
	it('declares the corpus name', () => {
		expect(PLATES_RESOLVER.corpus).toBe(PLATES_CORPUS);
		expect(PLATES_RESOLVER.corpus).toBe('plates');
	});

	it('parses a known-good locator', () => {
		const result = PLATES_RESOLVER.parseLocator('KAPA/ils-rwy-35R');
		expect(result.kind).toBe('ok');
	});

	it('rejects a malformed locator', () => {
		const result = PLATES_RESOLVER.parseLocator('KAPA');
		expect(result.kind).toBe('error');
	});

	it('builds a live URL for a known-good SourceId', () => {
		const url = PLATES_RESOLVER.getLiveUrl('airboss-ref:plates/KSFO/airport-diagram' as SourceId, '2026-04-23');
		expect(url).toContain('faa.gov');
	});

	it('returns null for getDerivativeContent (deferred)', () => {
		expect(PLATES_RESOLVER.getDerivativeContent('airboss-ref:plates/KAPA/ils-rwy-35R' as SourceId, 'n/a')).toBe(null);
	});

	it('returns null for getIndexedContent (deferred)', async () => {
		const content = await PLATES_RESOLVER.getIndexedContent('airboss-ref:plates/KAPA/ils-rwy-35R' as SourceId, 'n/a');
		expect(content).toBe(null);
	});

	it('returns empty editions for an unknown SourceId', async () => {
		const editions = await PLATES_RESOLVER.getEditions('airboss-ref:plates/KAPA/ils-rwy-35R' as SourceId);
		expect(editions).toEqual([]);
	});

	it('returns null current edition when no entries are registered', () => {
		expect(PLATES_RESOLVER.getCurrentEdition()).toBe(null);
	});
});
