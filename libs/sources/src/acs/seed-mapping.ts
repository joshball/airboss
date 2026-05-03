/**
 * ACS seed mapping registry (WP-ACS-V).
 *
 * The ACS ingest pipeline writes manifests under
 * `acs/<slug>/manifest.json` where `<slug>` is the locked-Q7 publication
 * slug (`<rating>-airplane-<edition>`, e.g. `ppl-airplane-6c`,
 * `cfi-airplane-25`). The DB-side `study.reference` rows are authored in
 * `course/references/acs-pts.yaml` with a presentation-friendly shape:
 * `document_slug` like `ppl-airplane-acs-6c` (carries an explicit `acs`
 * infix) and `edition` like `FAA-S-ACS-6C` (the canonical FAA designator).
 *
 * The mismatch is "broad-survey gap 2" from the library-completeness
 * status snapshot: the `-acs-` infix in the YAML slug is missing from the
 * manifest slug. This registry is the explicit bridge.
 *
 * The seed adapter (`libs/bc/study/src/seeders/acs.ts`) looks up the
 * manifest slug on each manifest it processes and uses the returned
 * (documentSlug, edition) to upsert the right `reference` row. A manifest
 * with no entry in this registry is a clear seed-time error -- the YAML
 * row must exist for the ACS to land as a readable card.
 *
 * Adding a new ACS publication:
 *   1. Run the ACS ingest pipeline so the manifest lands at
 *      `acs/<slug>/manifest.json`.
 *   2. Add the corresponding row to `course/references/acs-pts.yaml`.
 *   3. Add the (manifestSlug) -> (documentSlug, edition) entry here.
 *
 * The registry is hand-authored (vs derived from the YAML or from the
 * detected-edition map in `ingest.ts`) so we have a single review surface
 * for "this ACS is now readable" deltas. The slug-mapping rule is
 * deterministic (insert `-acs-` before the trailing edition suffix), but
 * the canonical FAA edition string (`FAA-S-ACS-6C`, `FAA-S-ACS-25`) is
 * authored, not computed -- some FAA publications have lettered editions
 * (`6C`) and some don't (`25`), and the YAML rows are the source of truth.
 */

export interface AcsSeedMappingEntry {
	/** On-disk manifest slug under `acs/<slug>/`. Locked-Q7 format: `<rating>-airplane-<edition>`. */
	readonly manifestSlug: string;
	/** DB `study.reference.document_slug` (matches `course/references/acs-pts.yaml`). */
	readonly documentSlug: string;
	/** DB `study.reference.edition` (matches `course/references/acs-pts.yaml`). */
	readonly edition: string;
}

/**
 * Production registry. Keep aligned with `course/references/acs-pts.yaml`
 * and `ACS_DETECTED_EDITION_TO_SLUG` in `libs/sources/src/acs/ingest.ts`.
 */
const BUILT_IN_ACS_SEED_MAPPINGS: readonly AcsSeedMappingEntry[] = [
	{ manifestSlug: 'ppl-airplane-6c', documentSlug: 'ppl-airplane-acs-6c', edition: 'FAA-S-ACS-6C' },
	{ manifestSlug: 'ir-airplane-8c', documentSlug: 'ir-airplane-acs-8c', edition: 'FAA-S-ACS-8C' },
	{ manifestSlug: 'cpl-airplane-7b', documentSlug: 'cpl-airplane-acs-7b', edition: 'FAA-S-ACS-7B' },
	{ manifestSlug: 'cfi-airplane-25', documentSlug: 'cfi-airplane-acs-25', edition: 'FAA-S-ACS-25' },
	{ manifestSlug: 'atp-airplane-11a', documentSlug: 'atp-airplane-acs-11a', edition: 'FAA-S-ACS-11A' },
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
