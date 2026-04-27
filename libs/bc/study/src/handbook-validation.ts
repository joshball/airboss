/**
 * Zod schemas for the handbook ingestion pipeline + reader BC.
 *
 * Two audiences:
 *
 * 1. The seed (`scripts/db/seed-handbooks.ts`) parses every section markdown
 *    file's frontmatter and the `<doc>/<edition>/manifest.json` against these
 *    schemas before touching the DB. A malformed manifest is a load-time
 *    error, not a silent crash mid-walk.
 * 2. The reverse-citation BC (`libs/bc/study/src/handbooks.ts`) validates the
 *    structured `Citation` shape coming off `knowledge_node.references` so a
 *    bad row never reaches `resolveCitationUrl` un-narrowed.
 *
 * The schemas mirror the discriminated union in `@ab/types` for storage shape
 * and the spec's "Section markdown shape" + "manifest.json" payloads for the
 * ingestion side. Zod gives us narrowing + helpful error messages; the file
 * lives in the BC (not `@ab/types`) so the dependency on `zod` stays out of
 * the type-only barrel.
 */

import {
	HANDBOOK_READ_STATUS_VALUES,
	HANDBOOK_SECTION_LEVEL_VALUES,
	type HandbookReadStatus,
	type HandbookSectionLevel,
	REFERENCE_KIND_VALUES,
	REFERENCE_KINDS,
} from '@ab/constants';
import { z } from 'zod';

/** Storage-shape regex for `reference.document_slug` (mirrors the DB CHECK). */
const DOCUMENT_SLUG_REGEX = /^[a-z0-9][a-z0-9-]{1,30}[a-z0-9]$/;

/** Storage-shape regex for `handbook_section.code` (mirrors the DB CHECK). */
const SECTION_CODE_REGEX = /^[0-9]+(\.[0-9]+){0,2}$/;

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
	section_code: z.string().regex(SECTION_CODE_REGEX),
	ordinal: z.number().int().nonnegative(),
	caption: z.string(),
	asset_path: z.string().min(1),
	width: z.number().int().positive().optional(),
	height: z.number().int().positive().optional(),
});
export type HandbookManifestFigure = z.infer<typeof handbookManifestFigureSchema>;

/**
 * One section row inside `manifest.json -> sections[]`. The seed reads the
 * markdown body separately from disk; the manifest carries enough scaffolding
 * to walk the tree and validate the (parent, ordinal, hash) triples.
 */
export const handbookManifestSectionSchema = z.object({
	level: z.enum(HANDBOOK_SECTION_LEVEL_VALUES as unknown as readonly [HandbookSectionLevel, ...HandbookSectionLevel[]]),
	code: z.string().regex(SECTION_CODE_REGEX),
	ordinal: z.number().int().nonnegative(),
	parent_code: z.string().regex(SECTION_CODE_REGEX).nullable(),
	title: z.string().min(1),
	faa_page_start: z.number().int().nonnegative().nullable(),
	faa_page_end: z.number().int().nonnegative().nullable(),
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
	]),
	section_code: z.string().regex(SECTION_CODE_REGEX).optional(),
	message: z.string().min(1),
});
export type HandbookManifestWarning = z.infer<typeof handbookManifestWarningSchema>;

/**
 * Top-level shape of `handbooks/<doc>/<edition>/manifest.json`. The seed
 * reads this once per edition tree and walks the sections + figures arrays
 * to upsert the DB rows. Idempotency keys off `sections[].content_hash`.
 */
export const handbookManifestSchema = z.object({
	document_slug: z.string().regex(DOCUMENT_SLUG_REGEX),
	edition: z.string().min(1).max(64),
	kind: z.enum(REFERENCE_KIND_VALUES as [string, ...string[]]),
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
	sections: z.array(handbookManifestSectionSchema).min(1),
	figures: z.array(handbookManifestFigureSchema),
	warnings: z.array(handbookManifestWarningSchema).default([]),
});
export type HandbookManifest = z.infer<typeof handbookManifestSchema>;

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

/** Discriminated union of structured citations. v1 only resolves `handbook`. */
export const structuredCitationSchema = z.discriminatedUnion('kind', [
	z.object({
		kind: z.literal(REFERENCE_KINDS.HANDBOOK),
		reference_id: z.string().min(1),
		locator: handbookLocatorSchema,
		note: z.string().optional(),
	}),
	z.object({
		kind: z.literal(REFERENCE_KINDS.CFR),
		reference_id: z.string().min(1),
		locator: cfrLocatorSchema,
		note: z.string().optional(),
	}),
	z.object({
		kind: z.literal(REFERENCE_KINDS.AC),
		reference_id: z.string().min(1),
		locator: acLocatorSchema,
		note: z.string().optional(),
	}),
	z.object({
		kind: z.literal(REFERENCE_KINDS.ACS),
		reference_id: z.string().min(1),
		locator: acsLocatorSchema,
		note: z.string().optional(),
	}),
	z.object({
		kind: z.literal(REFERENCE_KINDS.PTS),
		reference_id: z.string().min(1),
		locator: acsLocatorSchema,
		note: z.string().optional(),
	}),
	z.object({
		kind: z.literal(REFERENCE_KINDS.AIM),
		reference_id: z.string().min(1),
		locator: aimLocatorSchema,
		note: z.string().optional(),
	}),
	z.object({
		kind: z.literal(REFERENCE_KINDS.PCG),
		reference_id: z.string().min(1),
		locator: pcgLocatorSchema,
		note: z.string().optional(),
	}),
	z.object({
		kind: z.literal(REFERENCE_KINDS.NTSB),
		reference_id: z.string().min(1),
		locator: detailLocatorSchema,
		note: z.string().optional(),
	}),
	z.object({
		kind: z.literal(REFERENCE_KINDS.POH),
		reference_id: z.string().min(1),
		locator: detailLocatorSchema,
		note: z.string().optional(),
	}),
	z.object({
		kind: z.literal(REFERENCE_KINDS.OTHER),
		reference_id: z.string().min(1),
		locator: detailLocatorSchema,
		note: z.string().optional(),
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

export const handbookHeartbeatInputSchema = z.object({
	deltaSeconds: z.number().int().nonnegative(),
});

export const handbookNotesInputSchema = z.object({
	notesMd: z.string().max(16384),
});
