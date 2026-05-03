/**
 * InFO seed mapping registry (WP-SAFO-INFO).
 *
 * The InFO ingest pipeline writes manifests under `info/<id>/manifest.json`.
 * The DB-side `study.reference` rows are authored in
 * `course/references/infos.yaml` with `document_slug` like `info-23001` and
 * `edition` like `InFO 23001` (InFOs are immutable post-publication, so
 * edition is identical to the publication tag).
 *
 * Mirrors the SAFO pattern in `libs/sources/src/safo/seed-mapping.ts`.
 *
 * Adding a new InFO:
 *   1. Register it in `scripts/sources/config/info.yaml` (downloader URL).
 *   2. Run the InFO ingest pipeline so the manifest lands at
 *      `info/<id>/manifest.json`.
 *   3. Add the corresponding row to `course/references/infos.yaml`.
 *   4. Add the bulletin id -> (document_slug, edition) entry here.
 *   5. Add the row to `libs/sources/src/info/manifest.yaml` (registry seed).
 */

import type { BulletinSeedMappingEntry } from '../safo/seed-mapping.ts';

const BUILT_IN_INFO_SEED_MAPPINGS: readonly BulletinSeedMappingEntry[] = [
	{ bulletinId: '23001', documentSlug: 'info-23001', edition: 'InFO 23001' },
	{ bulletinId: '23006', documentSlug: 'info-23006', edition: 'InFO 23006' },
	{ bulletinId: '24001', documentSlug: 'info-24001', edition: 'InFO 24001' },
	{ bulletinId: '25001', documentSlug: 'info-25001', edition: 'InFO 25001' },
];

const TEST_INFO_SEED_MAPPINGS: BulletinSeedMappingEntry[] = [];

/**
 * Look up the DB (document_slug, edition) for an on-disk InFO manifest.
 * Returns null when no mapping exists -- the seed adapter raises a clear
 * error in that case so missing entries are visible at seed time, not
 * mysteriously skipped.
 */
export function getInfoSeedMapping(bulletinId: string): BulletinSeedMappingEntry | null {
	const testHit = TEST_INFO_SEED_MAPPINGS.find((entry) => entry.bulletinId === bulletinId);
	if (testHit) return testHit;
	const found = BUILT_IN_INFO_SEED_MAPPINGS.find((entry) => entry.bulletinId === bulletinId);
	return found ?? null;
}

/** Read-only view of every registered mapping (built-in + test). */
export function listInfoSeedMappings(): readonly BulletinSeedMappingEntry[] {
	return [...BUILT_IN_INFO_SEED_MAPPINGS, ...TEST_INFO_SEED_MAPPINGS];
}

/**
 * Test-only mutators. Mirrors the SAFO `__safo_seed_mapping_internal__` shape.
 */
export const __info_seed_mapping_internal__ = {
	register(entry: BulletinSeedMappingEntry): void {
		TEST_INFO_SEED_MAPPINGS.push(entry);
	},
	reset(): void {
		TEST_INFO_SEED_MAPPINGS.length = 0;
	},
};
