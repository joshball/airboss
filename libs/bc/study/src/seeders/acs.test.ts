/**
 * Pure-function unit tests for the ACS seed adapter (WP-ACS-V).
 *
 * Full DB-touching seed integration is exercised by
 * `scripts/db/seed-references-from-manifest.test.ts`; this file covers the
 * non-DB helpers (Roman conversion + slug-mapping consultation + dispatcher
 * surface) so they can fail fast on logic regressions without needing a
 * live PostgreSQL.
 */

import { describe, expect, it } from 'vitest';
import { __acs_seed_mapping_internal__, getAcsSeedMapping } from '@ab/sources/acs';
import { paddedOrdinalToRoman } from './acs';

describe('paddedOrdinalToRoman', () => {
	it.each([
		['01', 'I'],
		['02', 'II'],
		['03', 'III'],
		['04', 'IV'],
		['05', 'V'],
		['08', 'VIII'],
		['09', 'IX'],
		['10', 'X'],
		['12', 'XII'],
		['14', 'XIV'],
		['19', 'XIX'],
		['20', 'XX'],
		['39', 'XXXIX'],
	])('converts %s -> %s', (padded, expected) => {
		expect(paddedOrdinalToRoman(padded)).toBe(expected);
	});

	it('throws for ordinal 0 (out of bounds)', () => {
		expect(() => paddedOrdinalToRoman('00')).toThrowError(/out of bounds/);
	});

	it('throws for non-numeric input', () => {
		expect(() => paddedOrdinalToRoman('XX')).toThrowError(/out of bounds/);
	});
});

describe('getAcsSeedMapping (slug-mapping verification)', () => {
	it('maps every cached manifest slug to its YAML documentSlug + canonical FAA edition', () => {
		const expected: ReadonlyArray<readonly [string, string, string]> = [
			['ppl-airplane-6c', 'ppl-airplane-acs-6c', 'FAA-S-ACS-6C'],
			['ir-airplane-8c', 'ir-airplane-acs-8c', 'FAA-S-ACS-8C'],
			['cpl-airplane-7b', 'cpl-airplane-acs-7b', 'FAA-S-ACS-7B'],
			['cfi-airplane-25', 'cfi-airplane-acs-25', 'FAA-S-ACS-25'],
			['atp-airplane-11a', 'atp-airplane-acs-11a', 'FAA-S-ACS-11A'],
		];
		for (const [manifestSlug, documentSlug, edition] of expected) {
			const mapping = getAcsSeedMapping(manifestSlug);
			expect(mapping, `manifest slug ${manifestSlug} should resolve`).not.toBeNull();
			expect(mapping?.documentSlug).toBe(documentSlug);
			expect(mapping?.edition).toBe(edition);
		}
	});

	it('returns null for slugs that are not registered (PTS / companion guide)', () => {
		expect(getAcsSeedMapping('cfii-airplane-pts-9e')).toBeNull();
		expect(getAcsSeedMapping('faa-g-acs-2-companion-guide')).toBeNull();
		expect(getAcsSeedMapping('totally-fake-slug')).toBeNull();
	});

	it('test-only mutators inject mappings without polluting the built-in list', () => {
		try {
			__acs_seed_mapping_internal__.register({
				manifestSlug: 'synthetic-test-slug',
				documentSlug: 'synthetic-test-doc',
				edition: 'TEST-1',
			});
			expect(getAcsSeedMapping('synthetic-test-slug')).toEqual({
				manifestSlug: 'synthetic-test-slug',
				documentSlug: 'synthetic-test-doc',
				edition: 'TEST-1',
			});
		} finally {
			__acs_seed_mapping_internal__.reset();
		}
		expect(getAcsSeedMapping('synthetic-test-slug')).toBeNull();
	});
});
