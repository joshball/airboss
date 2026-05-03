/**
 * `handbooks-extras` corpus public surface.
 *
 * Several FAA whole-doc-only Class C handbooks (risk-management,
 * aviation-instructor, ifh, tips-mountain-flying) registered under
 * the same `handbooks` corpus as PHAK/AFH/AvWX. The chapter-aware
 * handbooks ingest cannot service these (no per-chapter PDFs from the
 * publisher, or no embedded outline + no printed TOC parser); this
 * module fills the gap. IPH (faa-h-8083-16) was migrated to the
 * chapter-aware Class A2 pipeline per WP-IPH-section-tree.
 *
 * No corpus-resolver registration here -- the `handbooks` resolver
 * (`libs/sources/src/handbooks/index.ts`) handles the new doc slugs once
 * `HANDBOOK_DOC_SLUGS` + `HANDBOOK_DOC_EDITIONS` are extended (already
 * landed alongside this module).
 *
 * Source of truth: `docs/work-packages/handbooks-extras-ingestion/spec.md`.
 */

export {
	_setHandbooksExtrasYamlPath,
	type CacheManifest,
	type ExtrasCorpusIndex,
	type ExtrasCorpusIndexEntry,
	type ExtrasManifestFile,
	type ExtrasYaml,
	type ExtrasYamlEntry,
	loadHandbooksExtrasYaml,
	readCacheManifest,
	readExtrasCorpusIndex,
} from './derivative-reader.ts';
export {
	type CliArgs,
	DOC_ID_TO_FRIENDLY,
	HANDBOOKS_EXTRAS_REVIEWER_ID,
	type IngestArgs,
	type IngestReport,
	parseCliArgs,
	runHandbooksExtrasIngest,
	runIngestCli,
} from './ingest.ts';
