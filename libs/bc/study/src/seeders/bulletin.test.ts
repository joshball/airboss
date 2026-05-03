/**
 * Pure-function unit tests for the SAFO + InFO seed adapters (WP-SAFO-INFO).
 *
 * Full DB-touching seed integration is covered by
 * `scripts/db/seed-references-from-manifest.test.ts`; this file covers the
 * non-DB helpers so they can fail fast on logic regressions without needing
 * a live PostgreSQL.
 */

import { __info_seed_mapping_internal__, getInfoSeedMapping } from '@ab/sources/info';
import { __safo_seed_mapping_internal__, getSafoSeedMapping } from '@ab/sources/safo';
import { describe, expect, it } from 'vitest';

describe('getSafoSeedMapping (slug-mapping verification)', () => {
	it('maps every shipped SAFO bulletin id to its YAML documentSlug + edition', () => {
		const expected: ReadonlyArray<readonly [string, string, string]> = [
			['23001', 'safo-23001', 'SAFO 23001'],
			['23002', 'safo-23002', 'SAFO 23002'],
			['23003', 'safo-23003', 'SAFO 23003'],
			['23004', 'safo-23004', 'SAFO 23004'],
			['24002', 'safo-24002', 'SAFO 24002'],
			['25001', 'safo-25001', 'SAFO 25001'],
		];
		for (const [bulletinId, documentSlug, edition] of expected) {
			const mapping = getSafoSeedMapping(bulletinId);
			expect(mapping, `SAFO id ${bulletinId} should resolve`).not.toBeNull();
			expect(mapping?.documentSlug).toBe(documentSlug);
			expect(mapping?.edition).toBe(edition);
		}
	});

	it('returns null for bulletin ids that are not registered', () => {
		expect(getSafoSeedMapping('99999')).toBeNull();
		expect(getSafoSeedMapping('00000')).toBeNull();
	});

	it('test-only mutators inject mappings without polluting the built-in list', () => {
		try {
			__safo_seed_mapping_internal__.register({
				bulletinId: '99001',
				documentSlug: 'safo-99001',
				edition: 'SAFO 99001',
			});
			expect(getSafoSeedMapping('99001')).toEqual({
				bulletinId: '99001',
				documentSlug: 'safo-99001',
				edition: 'SAFO 99001',
			});
		} finally {
			__safo_seed_mapping_internal__.reset();
		}
		expect(getSafoSeedMapping('99001')).toBeNull();
	});
});

describe('getInfoSeedMapping (slug-mapping verification)', () => {
	it('maps every shipped InFO bulletin id to its YAML documentSlug + edition', () => {
		const expected: ReadonlyArray<readonly [string, string, string]> = [
			['23001', 'info-23001', 'InFO 23001'],
			['23006', 'info-23006', 'InFO 23006'],
			['24001', 'info-24001', 'InFO 24001'],
			['25001', 'info-25001', 'InFO 25001'],
		];
		for (const [bulletinId, documentSlug, edition] of expected) {
			const mapping = getInfoSeedMapping(bulletinId);
			expect(mapping, `InFO id ${bulletinId} should resolve`).not.toBeNull();
			expect(mapping?.documentSlug).toBe(documentSlug);
			expect(mapping?.edition).toBe(edition);
		}
	});

	it('returns null for bulletin ids that are not registered', () => {
		expect(getInfoSeedMapping('99999')).toBeNull();
	});

	it('test-only mutators inject mappings without polluting the built-in list', () => {
		try {
			__info_seed_mapping_internal__.register({
				bulletinId: '99001',
				documentSlug: 'info-99001',
				edition: 'InFO 99001',
			});
			expect(getInfoSeedMapping('99001')).toEqual({
				bulletinId: '99001',
				documentSlug: 'info-99001',
				edition: 'InFO 99001',
			});
		} finally {
			__info_seed_mapping_internal__.reset();
		}
		expect(getInfoSeedMapping('99001')).toBeNull();
	});
});
