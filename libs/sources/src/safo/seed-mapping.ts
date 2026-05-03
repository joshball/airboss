/**
 * SAFO seed mapping registry (WP-SAFO-INFO).
 *
 * The SAFO ingest pipeline writes manifests under `safo/<id>/manifest.json`.
 * The DB-side `study.reference` rows are authored in
 * `course/references/safos.yaml` with `document_slug` like `safo-23001` and
 * `edition` like `SAFO 23001` (SAFOs are immutable post-publication, so
 * edition is identical to the publication tag).
 *
 * This registry is the explicit bridge. The seed adapter
 * (`libs/bc/study/src/seeders/safo.ts`) looks up the bulletin id on each
 * manifest it processes and uses the returned (document_slug, edition) to
 * upsert the right `reference` row. A manifest with no entry in this registry
 * is a clear seed-time error -- the YAML row must exist for the SAFO to
 * land as a readable card.
 *
 * Adding a new SAFO:
 *   1. Register it in `scripts/sources/config/safo.yaml` (downloader URL).
 *   2. Run the SAFO ingest pipeline so the manifest lands at
 *      `safo/<id>/manifest.json`.
 *   3. Add the corresponding row to `course/references/safos.yaml`.
 *   4. Add the bulletin id -> (document_slug, edition) entry here.
 *   5. Add the row to `libs/sources/src/safo/manifest.yaml` (registry seed).
 *
 * Mirror the pattern in `libs/sources/src/info/seed-mapping.ts`.
 */

export interface BulletinSeedMappingEntry {
	/** 5-digit `<YY><sequence>` bulletin id (e.g. `23001`). */
	readonly bulletinId: string;
	/** DB `study.reference.document_slug` (matches the YAML row). */
	readonly documentSlug: string;
	/** DB `study.reference.edition` (matches the YAML row). */
	readonly edition: string;
}

const BUILT_IN_SAFO_SEED_MAPPINGS: readonly BulletinSeedMappingEntry[] = [
	{ bulletinId: '23001', documentSlug: 'safo-23001', edition: 'SAFO 23001' },
	{ bulletinId: '23002', documentSlug: 'safo-23002', edition: 'SAFO 23002' },
	{ bulletinId: '23003', documentSlug: 'safo-23003', edition: 'SAFO 23003' },
	{ bulletinId: '23004', documentSlug: 'safo-23004', edition: 'SAFO 23004' },
	{ bulletinId: '24002', documentSlug: 'safo-24002', edition: 'SAFO 24002' },
	{ bulletinId: '25001', documentSlug: 'safo-25001', edition: 'SAFO 25001' },
];

const TEST_SAFO_SEED_MAPPINGS: BulletinSeedMappingEntry[] = [];

/**
 * Look up the DB (document_slug, edition) for an on-disk SAFO manifest.
 * Returns null when no mapping exists -- the seed adapter raises a clear
 * error in that case so missing entries are visible at seed time, not
 * mysteriously skipped.
 */
export function getSafoSeedMapping(bulletinId: string): BulletinSeedMappingEntry | null {
	const testHit = TEST_SAFO_SEED_MAPPINGS.find((entry) => entry.bulletinId === bulletinId);
	if (testHit) return testHit;
	const found = BUILT_IN_SAFO_SEED_MAPPINGS.find((entry) => entry.bulletinId === bulletinId);
	return found ?? null;
}

/** Read-only view of every registered mapping (built-in + test). */
export function listSafoSeedMappings(): readonly BulletinSeedMappingEntry[] {
	return [...BUILT_IN_SAFO_SEED_MAPPINGS, ...TEST_SAFO_SEED_MAPPINGS];
}

/**
 * Test-only mutators. The underscore prefix marks the surface as off-limits
 * to production callers; integration tests inject synthetic mappings so they
 * can exercise the full SAFO seeding path without polluting the built-in list.
 */
export const __safo_seed_mapping_internal__ = {
	register(entry: BulletinSeedMappingEntry): void {
		TEST_SAFO_SEED_MAPPINGS.push(entry);
	},
	reset(): void {
		TEST_SAFO_SEED_MAPPINGS.length = 0;
	},
};
