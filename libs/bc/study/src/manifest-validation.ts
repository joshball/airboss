/**
 * Zod schemas for the reference ingestion pipeline + reader BC.
 *
 * Two audiences:
 *
 * 1. The seed (`scripts/db/seed-references-from-manifest.ts`) parses every
 *    section markdown file's frontmatter and the
 *    `<corpus>/<doc>/<edition>/manifest.json` against these schemas before
 *    touching the DB. A malformed manifest is a load-time error, not a silent
 *    crash mid-walk.
 * 2. The reverse-citation BC (`libs/bc/study/src/references.ts`) validates
 *    the structured `Citation` shape coming off `knowledge_node.references`
 *    so a bad row never reaches `resolveCitationUrl` un-narrowed.
 *
 * The schemas mirror the discriminated union in `@ab/types` for storage shape
 * and the spec's "Section markdown shape" + "manifest.json" payloads for the
 * ingestion side. Zod gives us narrowing + helpful error messages; the file
 * lives in the BC (not `@ab/types`) so the dependency on `zod` stays out of
 * the type-only barrel.
 *
 * Manifest validator (post-WP-SUB) is a **discriminated union on manifest
 * kind**, where the discriminator is the manifest's own `kind` field:
 *
 *   - `kind: 'handbook'`   -- section-tree shape (PHAK / AFH / AVWX). Walks
 *                             chapter/section/subsection trees.
 *   - `kind: 'whole-doc'`  -- single-row shape (post-#384 risk-mgmt,
 *                             instructor, IFH, IPH, AMT-G, AMT-P). Body
 *                             stored on a single `reference_section` row at
 *                             depth 0, level 'document'.
 *
 * Manifest kind is NOT the same as `reference.kind` (the storage discriminator
 * for handbook vs CFR vs AC vs ...). A whole-doc manifest still produces a
 * `reference` row with `kind: 'handbook'`; the manifest kind only chooses
 * which seed adapter to dispatch to.
 */

import {
	AVIATION_TOPIC_VALUES,
	type AviationTopic,
	CERT_APPLICABILITY_VALUES,
	type CertApplicability,
	CITATION_FRAMING_VALUES,
	type CitationFraming,
	HANDBOOK_READ_STATUS_VALUES,
	type HandbookReadStatus,
	REFERENCE_KINDS,
} from '@ab/constants';
import { z } from 'zod';

/**
 * Optional fields shared by every {@link structuredCitationSchema} variant.
 *
 * The cert-syllabus WP extends the discriminated union with two optional
 * fields (`framing` and `airboss_ref`); both default to absent so entries
 * seeded by WP #1 keep validating. `airboss_ref` is checked syntactically
 * here (must start with `airboss-ref:`); full ADR 019 parsing happens in
 * `@ab/sources` at the BC + seed layer.
 */
const citationFramingSchema = z.enum(
	CITATION_FRAMING_VALUES as unknown as readonly [CitationFraming, ...CitationFraming[]],
);

const airbossRefShapeSchema = z.string().regex(/^airboss-ref:.+$/, {
	message: 'airboss_ref must start with `airboss-ref:`',
});

const structuredCitationCommonShape = {
	framing: citationFramingSchema.optional(),
	airboss_ref: airbossRefShapeSchema.optional(),
} as const;

/** Storage-shape regex for `reference.document_slug` (mirrors the DB CHECK). */
const DOCUMENT_SLUG_REGEX = /^[a-z0-9][a-z0-9-]{1,30}[a-z0-9]$/;

/**
 * Section code shape for the **section-tree handbook** corpus
 * (PHAK / AFH / AVWX / future sectioned handbooks). Dotted decimal up to
 * three levels: "12", "12.3", "12.3.2". Other corpora carry their own
 * code regex in their per-corpus manifest schema (CFR uses
 * `91.103(b)(1)(i)`-style; AIM uses `5-2-1`-style); the DB column itself
 * is now free-form text post-WP-SUB.
 */
const SECTION_TREE_CODE_REGEX = /^[0-9]+(\.[0-9]+){0,2}$/;

/**
 * Frontmatter on every per-section markdown file in the `handbooks/` tree.
 * Mirrors the spec's "Section markdown shape" block.
 */
export const handbookSectionFrontmatterSchema = z.object({
	handbook: z.string().regex(DOCUMENT_SLUG_REGEX),
	edition: z.string().min(1).max(64),
	chapter_number: z.number().int().nonnegative(),
	/** NULL on a chapter-level `index.md`; required for sections / subsections. */
	section_number: z.number().int().nonnegative().optional(),
	subsection_number: z.number().int().nonnegative().optional(),
	section_title: z.string().min(1),
	/** "12-7..12-9" or a single page like "12-7"; empty string when unknown. */
	faa_pages: z.string(),
	source_url: z.string().url().optional(),
});
export type HandbookSectionFrontmatter = z.infer<typeof handbookSectionFrontmatterSchema>;

/**
 * One figure record inside `manifest.json -> figures[]`.
 *
 * `asset_path` is repo-relative (`handbooks/<doc>/<edition>/figures/...`) so
 * the seed can stat the file before inserting; cross-platform path joins
 * happen at the seed layer, not here.
 */
export const handbookManifestFigureSchema = z.object({
	id: z.string().min(1),
	section_code: z.string().regex(SECTION_TREE_CODE_REGEX),
	ordinal: z.number().int().nonnegative(),
	caption: z.string(),
	asset_path: z.string().min(1),
	width: z.number().int().positive().optional(),
	height: z.number().int().positive().optional(),
});
export type HandbookManifestFigure = z.infer<typeof handbookManifestFigureSchema>;

/**
 * Level vocabulary accepted on a section-tree manifest's `sections[].level`.
 * Inline rather than imported from constants so it stays scoped to this
 * shape -- whole-doc manifests don't have a sections array, and other
 * corpora's manifests use different vocabulary.
 */
const SECTION_TREE_LEVELS = ['chapter', 'section', 'subsection'] as const;

/**
 * One section row inside `manifest.json -> sections[]`. The seed reads the
 * markdown body separately from disk; the manifest carries enough scaffolding
 * to walk the tree and validate the (parent, ordinal, hash) triples.
 */
export const handbookManifestSectionSchema = z.object({
	level: z.enum(SECTION_TREE_LEVELS),
	code: z.string().regex(SECTION_TREE_CODE_REGEX),
	ordinal: z.number().int().nonnegative(),
	parent_code: z.string().regex(SECTION_TREE_CODE_REGEX).nullable(),
	title: z.string().min(1),
	// FAA-printed page references (e.g. `"12-7"`). Stored as text so hyphenated
	// pagination round-trips intact; bare-digit pages still validate.
	faa_page_start: z.string().min(1).nullable(),
	faa_page_end: z.string().min(1).nullable(),
	source_locator: z.string().min(1),
	/** Repo-relative path to the per-section markdown file. */
	body_path: z.string().min(1),
	/** SHA-256 hex digest of the markdown file. */
	content_hash: z.string().regex(/^[0-9a-f]{64}$/i),
	has_figures: z.boolean(),
	has_tables: z.boolean(),
});
export type HandbookManifestSection = z.infer<typeof handbookManifestSectionSchema>;

/**
 * Pipeline warnings persisted on `manifest.json`. Errors fail the pipeline
 * up-front; these are the soft-fail cases the seed surfaces in its summary.
 */
export const handbookManifestWarningSchema = z.object({
	code: z.enum([
		'figure-without-caption',
		'caption-without-figure',
		'table-merge-failed',
		'table-empty',
		'cross-reference-unresolved',
		// Section-strategy warnings emitted by sections_via_toc / sections_via_llm.
		// `toc` family covers TOC parser issues (orphan entry, indent ambiguity);
		// `toc-verify` covers heading-fingerprint mismatches between TOC and body;
		// `llm` covers Claude API errors and malformed responses.
		'toc',
		'toc-verify',
		'llm',
		'section-strategy',
		// Page-label fallbacks emitted by sections.py when the printed FAA
		// header isn't readable on a given PDF page (e.g. chapter-summary
		// pages that omit the header). The walk-back recovery and the
		// offset-derived fallback both surface here so the failures are
		// visible to seed reviewers.
		'page-label',
	]),
	section_code: z.string().regex(SECTION_TREE_CODE_REGEX).nullish(),
	message: z.string().min(1),
});
export type HandbookManifestWarning = z.infer<typeof handbookManifestWarningSchema>;

/**
 * One section the errata pipeline patched. The Python apply path emits these
 * onto `manifest.json -> errata[].sections_patched[]` so future re-ingest can
 * round-trip the patched state. Mirrors the dataclass written by
 * `tools/handbook-ingest/ingest/handbooks/base.py`.
 */
export const handbookManifestErrataSectionPatchedSchema = z.object({
	section_code: z.string().min(1),
	section_path: z.string().min(1),
	chapter: z.string().min(1),
	target_page: z.string().min(1),
	patch_kind: z.string().min(1),
	section_anchor: z.string().min(1),
	new_heading: z.string().min(1).nullable(),
	content_hash: z.string().regex(/^[0-9a-f]{64}$/i),
	errata_note_path: z.string().min(1),
});
export type HandbookManifestErrataSectionPatched = z.infer<typeof handbookManifestErrataSectionPatchedSchema>;

/**
 * One applied errata entry on `manifest.json -> errata[]`.
 *
 * ADR 020 §"Errata flow" requires every applied errata to leave an audit
 * record on the manifest so the seed can verify SHA + applied_at without
 * re-running the apply pipeline. The id is kebab-case (matches the YAML
 * authoring shape in `scripts/sources/config/handbooks/<slug>.yaml`).
 */
export const handbookManifestErrataEntrySchema = z.object({
	id: z
		.string()
		.regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/)
		.min(3)
		.max(32),
	source_url: z.string().url(),
	published_at: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
	sha256: z.string().regex(/^[0-9a-f]{64}$/i),
	fetched_at: z.string().datetime({ offset: true }),
	applied_at: z.string().datetime({ offset: true }),
	parser: z.string().min(1),
	sections_patched: z.array(handbookManifestErrataSectionPatchedSchema),
});
export type HandbookManifestErrataEntry = z.infer<typeof handbookManifestErrataEntrySchema>;

/**
 * `manifest.json -> extraction` block (section-tree shape). The Python
 * pipeline records the strategy + per-strategy config it ran with so the
 * seed can audit which extraction path produced the in-repo derivative tree.
 *
 * Validated as a permissive object: the inner shape evolves with the
 * extraction pipeline (TOC vs prompt vs heading-style configs) and locking
 * each leaf would force a manifest-rewrite every time a strategy gets a new
 * tunable. The wrapping `section_strategy.kind` discriminator is what the
 * seed reads.
 */
export const handbookManifestExtractionSchema = z
	.object({
		section_strategy: z.object({
			kind: z.string().min(1),
			config: z.record(z.string(), z.unknown()).optional(),
		}),
	})
	.catchall(z.unknown());
export type HandbookManifestExtraction = z.infer<typeof handbookManifestExtractionSchema>;

/**
 * Fields shared by both manifest shapes. The discriminator (`kind`) and
 * shape-specific fields (sections/figures vs body_path/body_sha256) live
 * on the per-shape schemas below.
 *
 * `schema_version` is forward-compatibility plumbing per ADR 021: cache-tier
 * manifests already carry it, in-repo derivative manifests will start
 * carrying it as the Python ingest pipeline catches up. Optional today; the
 * seed uses presence to gate version-aware reads when it lands.
 */
const manifestCommonFields = {
	schema_version: z.number().int().positive().optional(),
	document_slug: z.string().regex(DOCUMENT_SLUG_REGEX),
	edition: z.string().min(1).max(64),
	title: z.string().min(1),
	publisher: z.string().min(1).default('FAA'),
	source_url: z.string().url(),
	source_checksum: z
		.string()
		.regex(/^[0-9a-f]{64}$/i)
		.optional(),
	// Allow ISO 8601 timestamps with timezone offsets (`+00:00`) -- Python's
	// `datetime.now(tz=UTC).isoformat()` produces this; Zod's `.datetime()`
	// rejects it by default. `offset: true` opts in.
	fetched_at: z.string().datetime({ offset: true }),
} as const;

/**
 * Optional metadata that can ride on either manifest shape -- subjects +
 * primary_cert. Whole-doc manifests typically omit these (they're carried
 * on the YAML row in `course/references/handbooks-noningested.yaml`);
 * section-tree manifests require subjects.
 */
const manifestSubjectsOptional = {
	subjects: z
		.array(z.enum(AVIATION_TOPIC_VALUES as [AviationTopic, ...AviationTopic[]]))
		.min(1)
		.max(3)
		.optional(),
	primary_cert: z
		.enum(CERT_APPLICABILITY_VALUES as [CertApplicability, ...CertApplicability[]])
		.nullable()
		.optional(),
} as const;

/**
 * Section-tree manifest (`kind: 'handbook'`). PHAK / AFH / AVWX shape.
 * Carries a hierarchy of chapter/section/subsection rows + per-figure
 * records. The seeder produces N `reference_section` rows.
 *
 * Subjects are **required** for the section-tree shape (the manifest is
 * the canonical authoring location; YAML rows carry the subjects for
 * non-ingested handbooks).
 */
export const sectionTreeManifestSchema = z.object({
	kind: z.literal('handbook'),
	...manifestCommonFields,
	subjects: z
		.array(z.enum(AVIATION_TOPIC_VALUES as [AviationTopic, ...AviationTopic[]]))
		.min(1)
		.max(3),
	/**
	 * Optional primary cert that owns this handbook for library-by-cert
	 * browsing. Mirrors the `primary_cert` field on `referenceEntrySchema`
	 * (`scripts/db/seed-references.ts`) so handbooks declare their cert
	 * placement in the same canonical location as their other metadata
	 * (title, subjects, fetched_at) rather than via a parallel override file.
	 * Omitted / null = cert-agnostic (renders only in topic + regulations
	 * spines). When present, must be one of `CERT_APPLICABILITY_VALUES`. The
	 * DB CHECK constraint on `study.reference.primary_cert` is the storage
	 * safety net.
	 */
	primary_cert: z
		.enum(CERT_APPLICABILITY_VALUES as [CertApplicability, ...CertApplicability[]])
		.nullable()
		.optional(),
	sections: z.array(handbookManifestSectionSchema).min(1),
	figures: z.array(handbookManifestFigureSchema),
	warnings: z.array(handbookManifestWarningSchema).default([]),
	/**
	 * Per-extraction-run audit (which strategy + config the Python pipeline ran).
	 * Optional because pre-extraction-audit manifests omit it.
	 */
	extraction: handbookManifestExtractionSchema.optional(),
	/**
	 * Applied errata audit per ADR 020. Each entry records one FAA-published
	 * amendment that the apply pipeline already merged into the in-repo body
	 * markdown. Optional because handbooks without errata omit the array.
	 */
	errata: z.array(handbookManifestErrataEntrySchema).optional(),
});
export type SectionTreeManifest = z.infer<typeof sectionTreeManifestSchema>;

/**
 * Whole-doc manifest (`kind: 'whole-doc'`). Post-#384 handbooks-extras
 * shape. Body lives in a single file (`document.md`); the seeder produces
 * **one** `reference_section` row at depth 0, level `'document'`.
 *
 * No `sections[]` or `figures[]` arrays. Subjects + primary_cert are
 * optional here (they can ride on the YAML seed row instead).
 */
export const wholeDocManifestSchema = z.object({
	kind: z.literal('whole-doc'),
	...manifestCommonFields,
	...manifestSubjectsOptional,
	/** Repo-relative path to the document body markdown. */
	body_path: z.string().min(1),
	/** SHA-256 hex digest of the body markdown file. */
	body_sha256: z.string().regex(/^[0-9a-f]{64}$/i),
	/** Source PDF page count (informational; surfaces in the reader). */
	page_count: z.number().int().positive().nullable().optional(),
	/** FAA document identifier (e.g. `faa-h-8083-2`). */
	doc_id: z.string().min(1).nullable().optional(),
	/** FAA-published edition tag (e.g. `2A`, `9B`). Display-only; canonical edition is the top-level `edition` field. */
	faa_edition: z.string().min(1).nullable().optional(),
	/**
	 * Applied errata audit per ADR 020. Whole-doc handbooks don't ship errata
	 * today (ADR 020 §"Class C handbooks"); the field is plumbed here so a
	 * future whole-doc errata stream parses cleanly without a schema change.
	 */
	errata: z.array(handbookManifestErrataEntrySchema).optional(),
});
export type WholeDocManifest = z.infer<typeof wholeDocManifestSchema>;

/**
 * AIM manifest entry kinds. Asymmetric depth -- chapters / appendices /
 * glossary entries sit at depth 0; sections at depth 1; paragraphs at
 * depth 2. The seeder builds the parent/child tree by parsing each
 * entry's `code` field rather than carrying explicit `parent_code`.
 */
const AIM_ENTRY_KINDS = ['chapter', 'section', 'paragraph', 'appendix', 'glossary'] as const;

/**
 * One entry inside an AIM manifest's `entries[]`. Flat array; the seeder
 * derives the chapter -> section -> paragraph tree from the dotted
 * `code` (`"1"`, `"1-1"`, `"1-1-3"`). Appendices use `"appendix-N"`;
 * glossary entries use `"glossary/<term-slug>"`.
 */
export const aimManifestEntrySchema = z.object({
	kind: z.enum(AIM_ENTRY_KINDS),
	code: z.string().min(1),
	title: z.string().min(1),
	/** Repo-relative path to the per-entry markdown body. */
	body_path: z.string().min(1),
	/** SHA-256 hex digest of the markdown file. */
	content_hash: z.string().regex(/^[0-9a-f]{64}$/i),
});
export type AimManifestEntry = z.infer<typeof aimManifestEntrySchema>;

/**
 * AIM manifest (`kind: 'aim'`). Flat `entries[]` carrying chapters /
 * sections / paragraphs / appendices / glossary terms. The seed adapter
 * walks the array, builds a parent/child tree by code prefix, and
 * produces N `reference_section` rows.
 *
 * Subjects + primary_cert are required at the manifest level so the AIM
 * lands cert-agnostic + topic-tagged on first seed without needing a
 * sibling YAML row.
 */
export const aimManifestSchema = z.object({
	kind: z.literal('aim'),
	...manifestCommonFields,
	subjects: z
		.array(z.enum(AVIATION_TOPIC_VALUES as [AviationTopic, ...AviationTopic[]]))
		.min(1)
		.max(3),
	primary_cert: z
		.enum(CERT_APPLICABILITY_VALUES as [CertApplicability, ...CertApplicability[]])
		.nullable()
		.optional(),
	entries: z.array(aimManifestEntrySchema).min(1),
});
export type AimManifest = z.infer<typeof aimManifestSchema>;

/**
 * AC revision shape. Single lowercase letter (`a`..`z`); the FAA's revision
 * letter is uppercased on the cover page (`AC 61-98D`) but the downloader
 * normalises to lowercase for filesystem safety. The seeder reverses this
 * when computing the DB edition tag (`AC 61-98D`).
 */
const AC_REVISION_REGEX = /^[a-z]$/;

/**
 * AC `doc_slug` regex -- filesystem-safe (dots replaced by dashes). The
 * canonical FAA doc number with dots preserved is carried separately on
 * `doc_number` so the locator round-trips.
 *
 *   'ac/00-6/b'   -> doc_slug='00-6'    doc_number='00-6'
 *   'ac/91-21-1/d' -> doc_slug='91-21-1' doc_number='91.21-1' (or '91-21.1' depending on the AC)
 */
const AC_DOC_SLUG_REGEX = /^[0-9]+(?:[-.][0-9]+)*$/;

/**
 * AC manifest (`kind: 'ac'`). One per `(doc_slug, revision)` pair under
 * `<repo>/ac/<doc_slug>/<revision>/manifest.json`. The seed adapter consumes
 * the whole-document body (`body_path`) and produces ONE `reference_section`
 * row at depth 0, level `'circular'`, code `'1'`.
 *
 * Distinct from the `whole-doc` shape because AC manifests carry a different
 * vocabulary (`doc_slug`/`revision` vs `document_slug`/`edition`) and a
 * `changes[]` cancellation/supersession array. Subjects + primary_cert are
 * NOT carried on the manifest -- those live on the YAML row in
 * `course/references/advisory-circulars.yaml` and survive seed via
 * `upsertReference`'s null-defaulting on conflict.
 *
 * `sections[]` and `changes[]` are validated as arrays of unknown today; AC
 * section + change extraction is a follow-up WP. The fields are required
 * (with default empty array) so the writer always emits them and forward-
 * compatibility plumbing stays simple.
 */
export const acManifestSchema = z.object({
	kind: z.literal('ac'),
	schema_version: z.number().int().positive().optional(),
	corpus: z.literal('ac'),
	doc_slug: z.string().regex(AC_DOC_SLUG_REGEX),
	doc_number: z.string().min(1),
	revision: z.string().regex(AC_REVISION_REGEX),
	title: z.string().min(1),
	publisher: z.string().min(1).default('FAA'),
	publication_date: z
		.string()
		.regex(/^\d{4}-\d{2}-\d{2}$/)
		.nullable(),
	source_url: z.string().url(),
	source_sha256: z.string().regex(/^[0-9a-f]{64}$/i),
	fetched_at: z.string().datetime({ offset: true }),
	page_count: z.number().int().positive(),
	body_path: z.string().min(1),
	body_sha256: z.string().regex(/^[0-9a-f]{64}$/i),
	sections: z.array(z.unknown()).default([]),
	changes: z.array(z.unknown()).default([]),
});
export type AcManifest = z.infer<typeof acManifestSchema>;

/**
 * Top-level shape of `<corpus>/<doc>/<edition>/manifest.json`. Discriminated
 * union over manifest kind: section-tree (`kind: 'handbook'`), whole-doc
 * (`kind: 'whole-doc'`), AIM (`kind: 'aim'`), or AC (`kind: 'ac'`). The seed
 * dispatches on the discriminator to choose the right adapter.
 */
export const manifestSchema = z.discriminatedUnion('kind', [
	sectionTreeManifestSchema,
	wholeDocManifestSchema,
	aimManifestSchema,
	acManifestSchema,
]);
export type Manifest = z.infer<typeof manifestSchema>;

// ---------------------------------------------------------------------------
// Citation discriminated-union schemas (validate `knowledge_node.references`)
// ---------------------------------------------------------------------------

const handbookLocatorSchema = z.object({
	chapter: z.number().int().nonnegative(),
	section: z.number().int().nonnegative().optional(),
	subsection: z.number().int().nonnegative().optional(),
	page_start: z.string().min(1).optional(),
	page_end: z.string().min(1).optional(),
});

const cfrLocatorSchema = z.object({
	title: z.number().int().positive(),
	part: z.number().int().positive(),
	section: z.string().min(1),
});

const acLocatorSchema = z.object({
	paragraph: z.string().min(1).optional(),
});

const acsLocatorSchema = z.object({
	area: z.string().min(1).optional(),
	task: z.string().min(1).optional(),
	element: z.string().min(1).optional(),
});

const aimLocatorSchema = z.object({
	paragraph: z.string().min(1).optional(),
});

const pcgLocatorSchema = z.object({
	term: z.string().min(1).optional(),
});

const detailLocatorSchema = z.object({
	detail: z.string().min(1).optional(),
});

/** Pre-WP freeform shape -- three string fields, no `kind` discriminator. */
export const legacyCitationSchema = z.object({
	source: z.string(),
	detail: z.string(),
	note: z.string(),
});

/**
 * Discriminated union of structured citations. v1 resolves `handbook`; the
 * cert-syllabus WP fills in the rest of the per-kind URL resolvers.
 *
 * Every variant accepts the optional `framing` + `airboss_ref` fields from
 * {@link structuredCitationCommonShape}. WP #1 entries lacking those fields
 * continue to validate (both are optional).
 */
export const structuredCitationSchema = z.discriminatedUnion('kind', [
	z.object({
		kind: z.literal(REFERENCE_KINDS.HANDBOOK),
		reference_id: z.string().min(1),
		locator: handbookLocatorSchema,
		note: z.string().optional(),
		...structuredCitationCommonShape,
	}),
	z.object({
		kind: z.literal(REFERENCE_KINDS.CFR),
		reference_id: z.string().min(1),
		locator: cfrLocatorSchema,
		note: z.string().optional(),
		...structuredCitationCommonShape,
	}),
	z.object({
		kind: z.literal(REFERENCE_KINDS.AC),
		reference_id: z.string().min(1),
		locator: acLocatorSchema,
		note: z.string().optional(),
		...structuredCitationCommonShape,
	}),
	z.object({
		kind: z.literal(REFERENCE_KINDS.ACS),
		reference_id: z.string().min(1),
		locator: acsLocatorSchema,
		note: z.string().optional(),
		...structuredCitationCommonShape,
	}),
	z.object({
		kind: z.literal(REFERENCE_KINDS.PTS),
		reference_id: z.string().min(1),
		locator: acsLocatorSchema,
		note: z.string().optional(),
		...structuredCitationCommonShape,
	}),
	z.object({
		kind: z.literal(REFERENCE_KINDS.AIM),
		reference_id: z.string().min(1),
		locator: aimLocatorSchema,
		note: z.string().optional(),
		...structuredCitationCommonShape,
	}),
	z.object({
		kind: z.literal(REFERENCE_KINDS.PCG),
		reference_id: z.string().min(1),
		locator: pcgLocatorSchema,
		note: z.string().optional(),
		...structuredCitationCommonShape,
	}),
	z.object({
		kind: z.literal(REFERENCE_KINDS.NTSB),
		reference_id: z.string().min(1),
		locator: detailLocatorSchema,
		note: z.string().optional(),
		...structuredCitationCommonShape,
	}),
	z.object({
		kind: z.literal(REFERENCE_KINDS.POH),
		reference_id: z.string().min(1),
		locator: detailLocatorSchema,
		note: z.string().optional(),
		...structuredCitationCommonShape,
	}),
	z.object({
		kind: z.literal(REFERENCE_KINDS.OTHER),
		reference_id: z.string().min(1),
		locator: detailLocatorSchema,
		note: z.string().optional(),
		...structuredCitationCommonShape,
	}),
]);

/** Either citation shape -- legacy freeform or structured. */
export const citationSchema = z.union([structuredCitationSchema, legacyCitationSchema]);

// ---------------------------------------------------------------------------
// Read-state input schemas (validate BC write inputs)
// ---------------------------------------------------------------------------

export const handbookReadStatusSchema = z.enum(
	HANDBOOK_READ_STATUS_VALUES as unknown as readonly [HandbookReadStatus, ...HandbookReadStatus[]],
);

/**
 * Heartbeat POST body shape. Wire field name is `delta` (seconds since the
 * client's previous tick). The endpoint enforces the anti-flood floor
 * `HANDBOOK_HEARTBEAT_MIN_DELTA_SEC` and caps the recorded value at
 * `HANDBOOK_HEARTBEAT_INTERVAL_SEC * 4` server-side; this schema only
 * checks shape (positive integer).
 */
export const handbookHeartbeatInputSchema = z.object({
	delta: z.number().int().positive(),
});

export const handbookNotesInputSchema = z.object({
	notesMd: z.string().max(16384),
});
