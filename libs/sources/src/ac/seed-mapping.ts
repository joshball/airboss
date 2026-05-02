/**
 * AC seed mapping registry (WP-AC).
 *
 * The AC ingest pipeline writes manifests under
 * `ac/<doc_slug>/<revision>/manifest.json` (filesystem layout uses
 * lowercase, dot-free slugs). The DB-side `study.reference` rows are
 * authored in `course/references/advisory-circulars.yaml` with a more
 * presentation-friendly shape: `document_slug` like `ac-61-98` and
 * `edition` like `AC 61-98D`.
 *
 * This registry is the explicit bridge. The seed adapter
 * (`libs/bc/study/src/seeders/ac.ts`) looks up the (doc_slug, revision)
 * pair on each manifest it processes and uses the returned (document_slug,
 * edition) to upsert the right `reference` row. A manifest with no entry
 * in this registry is a clear seed-time error -- the YAML row must exist
 * for the AC to land as a readable card.
 *
 * Adding a new AC:
 *   1. Run the AC ingest pipeline so the manifest lands at
 *      `ac/<doc_slug>/<revision>/`.
 *   2. Add the corresponding row to `course/references/advisory-circulars.yaml`.
 *   3. Add the (doc_slug, revision) -> (document_slug, edition) entry here.
 *
 * The registry is kept hand-authored (vs derived from the YAML) so we have
 * a single review surface for "this AC is now readable" deltas.
 */

export interface AcSeedMappingEntry {
	/** Filesystem slug used under `ac/<doc_slug>/`. Dot-free, lowercase. */
	readonly docSlug: string;
	/** Lowercase revision letter used under `ac/<doc_slug>/<revision>/`. */
	readonly revision: string;
	/** DB `study.reference.document_slug` (matches advisory-circulars.yaml). */
	readonly documentSlug: string;
	/** DB `study.reference.edition` (matches advisory-circulars.yaml). */
	readonly edition: string;
}

const AC_SEED_MAPPINGS: readonly AcSeedMappingEntry[] = [
	{ docSlug: '00-6', revision: 'b', documentSlug: 'ac-00-6', edition: 'AC 00-6B' },
	{ docSlug: '25-7', revision: 'd', documentSlug: 'ac-25-7', edition: 'AC 25-7D' },
	{ docSlug: '61-65', revision: 'j', documentSlug: 'ac-61-65', edition: 'AC 61-65J' },
	{ docSlug: '61-83', revision: 'j', documentSlug: 'ac-61-83', edition: 'AC 61-83J' },
	{ docSlug: '61-98', revision: 'd', documentSlug: 'ac-61-98', edition: 'AC 61-98D' },
	{ docSlug: '90-66', revision: 'c', documentSlug: 'ac-90-66', edition: 'AC 90-66C' },
	{ docSlug: '91-21-1', revision: 'd', documentSlug: 'ac-91-21-1', edition: 'AC 91.21-1D' },
	{ docSlug: '91-79', revision: 'a', documentSlug: 'ac-91-79', edition: 'AC 91-79A' },
	{ docSlug: '120-71', revision: 'b', documentSlug: 'ac-120-71', edition: 'AC 120-71B' },
];

/**
 * Look up the DB (document_slug, edition) for an on-disk AC manifest.
 * Returns null when no mapping exists -- the seed adapter raises a clear
 * error in that case so missing entries are visible at seed time, not
 * mysteriously skipped.
 */
export function getAcSeedMapping(docSlug: string, revision: string): AcSeedMappingEntry | null {
	const found = AC_SEED_MAPPINGS.find((entry) => entry.docSlug === docSlug && entry.revision === revision);
	return found ?? null;
}

/** Read-only view of every registered mapping. Useful for tests + audits. */
export function listAcSeedMappings(): readonly AcSeedMappingEntry[] {
	return AC_SEED_MAPPINGS;
}
