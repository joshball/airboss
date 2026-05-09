/**
 * ACS seed mapping registry (WP-ACS-V).
 *
 * The ACS ingest pipeline writes manifests under
 * `acs/<slug>/manifest.json` where `<slug>` is the canonical publication
 * slug (`<rating>-airplane-acs-<edition>`, e.g. `ppl-airplane-acs-6c`,
 * `cfi-airplane-acs-25`). The DB-side `study.reference` rows are authored
 * in `course/references/acs-pts.yaml` and use the SAME slug shape, so the
 * `manifestSlug` and `documentSlug` are equal for every production ACS.
 *
 * The remaining bridge value of this registry is the canonical FAA
 * `edition` designator (`FAA-S-ACS-6C`, `FAA-S-ACS-25`, ...) which is
 * authored, not computed: some FAA publications have lettered editions
 * (`6C`) and some don't (`25`), and the YAML row is the source of truth
 * for the exact edition string.
 *
 * The seed adapter (`libs/bc/study/src/seeders/acs.ts`) looks up the
 * manifest slug on each manifest it processes and uses the returned
 * `edition` (and `documentSlug`, which is the same value) to upsert the
 * right `reference` row. A manifest with no entry in this registry is a
 * clear seed-time error -- the YAML row must exist for the ACS to land as
 * a readable card.
 *
 * Tests register synthetic mappings via `__acs_seed_mapping_internal__`
 * with `manifestSlug !== documentSlug` to exercise the dispatcher's
 * slug-translation path; the registry preserves the two-field shape so
 * those tests stay green.
 *
 * Adding a new ACS publication:
 *   1. Run the ACS ingest pipeline so the manifest lands at
 *      `acs/<slug>/manifest.json`.
 *   2. Add the corresponding row to `course/references/acs-pts.yaml`.
 *   3. Add the (manifestSlug) -> (documentSlug, edition) entry here.
 */

export interface AcsSeedMappingEntry {
	/** On-disk manifest slug under `acs/<slug>/`. Canonical format: `<rating>-airplane-acs-<edition>`. */
	readonly manifestSlug: string;
	/** DB `study.reference.document_slug` (matches `course/references/acs-pts.yaml`). Equal to `manifestSlug` for production rows. */
	readonly documentSlug: string;
	/** DB `study.reference.edition` (matches `course/references/acs-pts.yaml`). */
	readonly edition: string;
}

/**
 * Production registry. Keep aligned with `course/references/acs-pts.yaml`
 * and `ACS_DETECTED_EDITION_TO_SLUG` in `libs/sources/src/acs/ingest.ts`.
 * `manifestSlug === documentSlug` for every production ACS.
 */
const BUILT_IN_ACS_SEED_MAPPINGS: readonly AcsSeedMappingEntry[] = [
	{ manifestSlug: 'ppl-airplane-acs-6c', documentSlug: 'ppl-airplane-acs-6c', edition: 'FAA-S-ACS-6C' },
	{ manifestSlug: 'ir-airplane-acs-8c', documentSlug: 'ir-airplane-acs-8c', edition: 'FAA-S-ACS-8C' },
	{ manifestSlug: 'cpl-airplane-acs-7b', documentSlug: 'cpl-airplane-acs-7b', edition: 'FAA-S-ACS-7B' },
	{ manifestSlug: 'cfi-airplane-acs-25', documentSlug: 'cfi-airplane-acs-25', edition: 'FAA-S-ACS-25' },
	{ manifestSlug: 'atp-airplane-acs-11a', documentSlug: 'atp-airplane-acs-11a', edition: 'FAA-S-ACS-11A' },
];

/**
 * Per-test-run additions. Production callers never touch this; the test
 * internal helper below pushes / clears entries here so synthetic ACS
 * manifests resolve without polluting the built-in list.
 */
const TEST_ACS_SEED_MAPPINGS: AcsSeedMappingEntry[] = [];

/**
 * Look up the DB (document_slug, edition) for an on-disk ACS manifest by
 * its manifest slug. Returns null when no mapping exists -- the seed
 * adapter raises a clear error in that case so missing entries are visible
 * at seed time, not mysteriously skipped.
 *
 * Test additions registered via `__acs_seed_mapping_internal__` win over
 * the built-in list (last-write-wins); the test helper resets between runs
 * so production lookups stay deterministic.
 */
export function getAcsSeedMapping(manifestSlug: string): AcsSeedMappingEntry | null {
	const testHit = TEST_ACS_SEED_MAPPINGS.find((entry) => entry.manifestSlug === manifestSlug);
	if (testHit) return testHit;
	const found = BUILT_IN_ACS_SEED_MAPPINGS.find((entry) => entry.manifestSlug === manifestSlug);
	return found ?? null;
}

/** Read-only view of every registered mapping (built-in + test). Useful for tests + audits. */
export function listAcsSeedMappings(): readonly AcsSeedMappingEntry[] {
	return [...BUILT_IN_ACS_SEED_MAPPINGS, ...TEST_ACS_SEED_MAPPINGS];
}

/**
 * Test-only mutators. Mirrors the `__ac_seed_mapping_internal__` pattern --
 * the underscore prefix marks the surface as off-limits to production
 * callers. Lets seed-adapter integration tests inject synthetic mappings
 * so they exercise the full ACS seeding path without colliding with
 * built-in production rows.
 */
export const __acs_seed_mapping_internal__ = {
	register(entry: AcsSeedMappingEntry): void {
		TEST_ACS_SEED_MAPPINGS.push(entry);
	},
	reset(): void {
		TEST_ACS_SEED_MAPPINGS.length = 0;
	},
};
