#!/usr/bin/env bun

/**
 * knowledge_node.references migration to uniform StructuredCitation
 * (cert-syllabus WP phase 17).
 *
 * Walks every `knowledge_node` row whose `references_v2_migrated = false`.
 * For each `LegacyCitation` entry on the row's `references` JSONB array,
 * resolves the legacy `{source, detail, note}` triple to a typed
 * `StructuredCitation` discriminated by `kind`:
 *
 *   handbook  PHAK / AFH / AIH / IPH / Instrument Flying Handbook / FAA-H-...
 *   cfr       14 CFR ..., FAR 23 / Part 91, ...
 *   ac        AC NN-NN(L)
 *   acs / pts ACS / PTS standards (ACS / PTS)
 *   aim       AIM
 *   pcg       Pilot/Controller Glossary
 *   ntsb      NTSB ...
 *   poh       POH / AFM ...
 *   other     fallback for unrecognised sources
 *
 * Reference resolution: every reshaped entry must carry a real
 * `reference_id` pointing at a `study.reference` row. The migration
 * resolves known FAA publications (handbooks, ACS / PTS) against the
 * already-seeded registry. For source families that don't yet have
 * reference rows (AC, CFR, AIM, PCG, POH, NTSB, "other"), the script
 * upserts a synthetic reference row keyed by a deterministic
 * `(documentSlug, edition)` pair so downstream URL resolvers always have
 * a row to look up. Synthetic rows carry `seed_origin` =
 * `MIGRATION_SEED_ORIGIN` so they are removable.
 *
 * `framing` defaults per kind (see `DEFAULT_FRAMING_BY_KIND`); locator
 * fields are extracted from the legacy `detail` string when a
 * kind-specific extractor is available, else left empty (the
 * `StructuredCitation` shape allows empty locators on every kind).
 *
 * Idempotency: the migration only processes rows where
 * `references_v2_migrated = false`; it stamps the flag to true after
 * writing. Re-running is a no-op apart from the first-run write. A
 * `--dry-run` flag reports the planned reshapes without writing.
 *
 * Wraps each row in its own transaction so a single corrupt entry does
 * not poison the whole batch (see also `study_plan -> goal` migration
 * for the same per-row pattern).
 *
 * Usage:
 *   bun scripts/db/migrate-references-to-structured.ts
 *   bun scripts/db/migrate-references-to-structured.ts --dry-run
 */

import {
	AIM_CURRENT_EDITION,
	CITATION_FRAMINGS,
	type CitationFraming,
	REFERENCE_KINDS,
	type ReferenceKind,
} from '@ab/constants';
import { client, db as defaultDb } from '@ab/db/connection';
import type { LegacyCitation, StructuredCitation } from '@ab/types';
import { isStructuredCitation } from '@ab/types';
import { and, eq } from 'drizzle-orm';
import type { PgDatabase, PgQueryResultHKT } from 'drizzle-orm/pg-core';
import { upsertReference } from '../../libs/bc/study/src/references';
import { knowledgeNode, reference } from '../../libs/bc/study/src/schema';

type Db = PgDatabase<PgQueryResultHKT, Record<string, never>>;

/** Stamped on every synthetic `study.reference` row created by this migration. */
export const MIGRATION_SEED_ORIGIN = 'migrate-references-to-structured-v1' as const;

// ---------------------------------------------------------------------------
// Pure reshape (exported for unit tests)
// ---------------------------------------------------------------------------

/** Per-kind default framing applied when a citation has no authored framing. */
export const DEFAULT_FRAMING_BY_KIND: Record<ReferenceKind, CitationFraming | null> = {
	[REFERENCE_KINDS.HANDBOOK]: CITATION_FRAMINGS.SURVEY,
	[REFERENCE_KINDS.CFR]: CITATION_FRAMINGS.REGULATORY,
	[REFERENCE_KINDS.AC]: CITATION_FRAMINGS.REGULATORY,
	[REFERENCE_KINDS.ACS]: CITATION_FRAMINGS.EXAMINER,
	[REFERENCE_KINDS.PTS]: CITATION_FRAMINGS.EXAMINER,
	[REFERENCE_KINDS.AIM]: CITATION_FRAMINGS.PROCEDURAL,
	[REFERENCE_KINDS.PCG]: CITATION_FRAMINGS.SURVEY,
	[REFERENCE_KINDS.NTSB]: CITATION_FRAMINGS.OPERATIONAL,
	[REFERENCE_KINDS.POH]: CITATION_FRAMINGS.OPERATIONAL,
	[REFERENCE_KINDS.OTHER]: null,
};

/**
 * Reference-row identity used by the migration. The reshape function emits
 * a `ResolvedReference` per legacy citation; the script side then ensures a
 * `study.reference` row exists for that identity (resolving an existing row
 * by `(documentSlug, edition)` or upserting a synthetic one) before
 * writing the StructuredCitation.
 */
export interface ResolvedReference {
	kind: ReferenceKind;
	/** Stable cross-edition slug; used as the conflict key for synthetic rows. */
	documentSlug: string;
	/** Edition tag stored alongside the slug. Free-form per kind. */
	edition: string;
	/** Display title for synthetic rows when no row exists yet. */
	title: string;
	/** Optional canonical URL (used only when upserting a synthetic row). */
	url?: string;
}

/** A reshape result: the StructuredCitation minus `reference_id`, plus the resolved reference identity. */
export interface ReshapedCitation {
	resolved: ResolvedReference;
	/** The discriminated shape minus `reference_id` -- the script fills it in after resolving the row. */
	citation: Omit<StructuredCitation, 'reference_id'>;
}

/** Match a known handbook source string -> resolved reference identity. */
interface HandbookPattern {
	regex: RegExp;
	slug: string;
	defaultEdition: string;
	title: string;
	url?: string;
	/**
	 * When true, ignore any inline `FAA-H-8083-...` edition tag in the source
	 * string and always resolve to `defaultEdition`. Used for handbooks whose
	 * canonical edition is the short edition-slug (`8083-15B`) emitted by the
	 * handbooks-extras ingest pipeline; honoring the long FAA tag in `source`
	 * would create a duplicate synthetic row keyed on the long tag.
	 */
	pinDefaultEdition?: boolean;
}

/**
 * Known handbook publications. Keyed by `(documentSlug, edition)` so the
 * migration can look up an existing reference row before falling back to
 * a synthetic upsert. Editions match what `seed-handbooks.ts` produces.
 */
const HANDBOOK_PATTERNS: readonly HandbookPattern[] = [
	{
		regex: /\b(?:PHAK|Pilot's Handbook of Aeronautical Knowledge|FAA-H-8083-25[A-Z]?)\b/i,
		slug: 'phak',
		defaultEdition: 'FAA-H-8083-25C',
		title: "Pilot's Handbook of Aeronautical Knowledge",
		url: 'https://www.faa.gov/regulations_policies/handbooks_manuals/aviation/phak',
	},
	{
		regex: /\b(?:AFH|Airplane Flying Handbook|FAA-H-8083-3[A-Z]?)\b/i,
		slug: 'afh',
		defaultEdition: 'FAA-H-8083-3C',
		title: 'Airplane Flying Handbook',
		url: 'https://www.faa.gov/regulations_policies/handbooks_manuals/aviation/airplane_handbook',
	},
	{
		regex: /\b(?:AIH|Aviation Instructor's Handbook|FAA-H-8083-9[A-Z]?)\b/i,
		// Matches the canonical row seeded by the handbooks-extras pipeline
		// (`libs/sources/src/handbooks-extras/ingest.ts`). The legacy
		// `(aih, FAA-H-8083-9B)` pair was retired with
		// `course/references/handbooks-noningested.yaml` -- using it here
		// would re-create a synthetic dupe of the authored row.
		slug: 'aviation-instructor',
		defaultEdition: '8083-9',
		pinDefaultEdition: true,
		title: "Aviation Instructor's Handbook",
		url: 'https://www.faa.gov/regulations_policies/handbooks_manuals/aviation/aviation_instructors_handbook',
	},
	{
		regex: /\b(?:IPH|Instrument Procedures Handbook|FAA-H-8083-16[A-Z]?)\b/i,
		slug: 'iph',
		// Matches the edition slug emitted by the handbooks-extras ingest
		// pipeline (`libs/sources/src/handbooks-extras/ingest.ts`), so the
		// migration resolves to the authored row instead of creating a
		// duplicate synthetic one keyed on the long FAA tag.
		defaultEdition: '8083-16B',
		pinDefaultEdition: true,
		title: 'Instrument Procedures Handbook',
		url: 'https://www.faa.gov/regulations_policies/handbooks_manuals/aviation/instrument_procedures_handbook',
	},
	{
		regex: /\b(?:Instrument Flying Handbook|IFH|FAA-H-8083-15[A-Z]?)\b/i,
		slug: 'ifh',
		// See note on iph above -- aligned with the extras pipeline's
		// edition slug to prevent duplicate synthetic rows.
		defaultEdition: '8083-15B',
		pinDefaultEdition: true,
		title: 'Instrument Flying Handbook',
		url: 'https://www.faa.gov/regulations_policies/handbooks_manuals/aviation/instrument_flying_handbook',
	},
	{
		regex: /\b(?:AvWx|Aviation Weather Handbook|FAA-H-8083-28[A-Z]?)\b/i,
		slug: 'avwx',
		defaultEdition: 'FAA-H-8083-28B',
		title: 'Aviation Weather Handbook',
		url: 'https://www.faa.gov/regulations_policies/handbooks_manuals/aviation/aviation_weather_handbook',
	},
	{
		regex: /\bFAA-H-8083-2[A-Z]?\b/i,
		// Matches the canonical row seeded by the handbooks-extras pipeline.
		// The legacy `(faa-h-8083-2, FAA-H-8083-2A)` pair was retired with
		// `course/references/handbooks-noningested.yaml` -- using it here
		// would re-create a synthetic dupe of the authored row.
		slug: 'risk-management',
		defaultEdition: '8083-2A',
		pinDefaultEdition: true,
		title: 'Risk Management Handbook',
		url: 'https://www.faa.gov/regulations_policies/handbooks_manuals/aviation/risk_management_handbook',
	},
];

/**
 * Extract a handbook locator (`chapter`, optional `page_start`/`page_end`)
 * from the legacy `detail` string. Returns `chapter: 0` when no chapter
 * number is present -- callers should treat zero as "no chapter".
 *
 * Examples:
 *   "Chapter 5 -- Aerodynamics"                -> { chapter: 5 }
 *   "Chapter 12 -- Flight Instruments; pp 12-7..12-9"
 *                                              -> { chapter: 12, page_start: '12-7', page_end: '12-9' }
 *   "Chapter 6 -- Airplane Basic ...; Chapter 5 -- ..."
 *                                              -> { chapter: 6 }   (first chapter wins)
 */
export function extractHandbookLocator(detail: string): {
	chapter: number;
	page_start?: string;
	page_end?: string;
} {
	const chapterMatch = detail.match(/\bChapter\s+(\d+)\b/i);
	const chapter = chapterMatch ? Number.parseInt(chapterMatch[1], 10) : 0;
	// FAA pagination is `<chapter>-<page>`; we accept either a single
	// page (`pp 12-7`) or a range (`pp 12-7..12-9` or `pp 12-7-12-9`).
	const rangeMatch = detail.match(/\bpp\.?\s*(\d+-\d+)\s*(?:\.\.|–|--|-)\s*(\d+-\d+)/i);
	if (rangeMatch) {
		return { chapter, page_start: rangeMatch[1], page_end: rangeMatch[2] };
	}
	const singleMatch = detail.match(/\bpp?\.?\s*(\d+-\d+)\b/i);
	if (singleMatch) {
		return { chapter, page_start: singleMatch[1] };
	}
	return { chapter };
}

/** Extract a CFR locator (`title`, `part`, `section`) from `source` + `detail`. */
export function extractCfrLocator(source: string, detail: string): { title: number; part: number; section: string } {
	// Try `source` first ("14 CFR 91.126 / 91.127"), then `detail`
	// ("91.3 -- Responsibility...").
	const haystack = `${source} ${detail}`;
	const titleMatch = haystack.match(/\b(\d{1,3})\s+CFR\b/i);
	const cfrTitle = titleMatch ? Number.parseInt(titleMatch[1], 10) : 14;
	// First "<part>.<section>" pair wins. `section` may carry parentheticals
	// like `175(b)(2)` per the StructuredCitation shape.
	const sectionMatch = haystack.match(/\b(\d{1,3})\.([\d\w()]+(?:[a-z]\d?)?)/);
	if (sectionMatch) {
		return { title: cfrTitle, part: Number.parseInt(sectionMatch[1], 10), section: sectionMatch[2] };
	}
	// Bare "<part>" or "Part NN" without a section -- emit part with empty section.
	const partMatch = haystack.match(/\bPart\s+(\d{1,3})\b/i);
	if (partMatch) return { title: cfrTitle, part: Number.parseInt(partMatch[1], 10), section: '' };
	const bareMatch = haystack.match(/\b(\d{1,3})\b/);
	if (bareMatch) return { title: cfrTitle, part: Number.parseInt(bareMatch[1], 10), section: '' };
	return { title: cfrTitle, part: 0, section: '' };
}

/**
 * AC document slug for a source like "AC 61-67C": stable across editions
 * (the trailing letter is the edition revision). The migration upserts
 * one synthetic row per unique AC number so future updates can wire
 * `superseded_by_id` between editions if desired.
 */
function acSlugFromSource(source: string): { slug: string; edition: string; number: string } | null {
	// Match "AC NN-NN(L)" -- e.g. "AC 61-67C", "AC 91-79B", "AC 00-6B".
	const match = source.match(/\bAC\s+(\d{1,3}-\d{1,3})([A-Z])?\b/i);
	if (!match) return null;
	const number = match[1];
	const editionLetter = match[2] ?? '';
	const slug = `ac-${number}`;
	const edition = `AC ${number}${editionLetter}`;
	return { slug, edition, number };
}

/**
 * Slugify a free-form source string for `kind: 'other'` fallback rows.
 * Lower-cases, replaces non-alphanumeric runs with single hyphens, trims
 * leading/trailing hyphens, and clamps to the schema's slug-length CHECK
 * (3..32 chars; longer strings are truncated).
 */
export function slugifySource(source: string): string {
	const normalised = source
		.toLowerCase()
		.replace(/[^a-z0-9]+/g, '-')
		.replace(/^-+|-+$/g, '');
	if (normalised.length === 0) return 'unknown-source';
	if (normalised.length < 3) return `src-${normalised}`;
	// Schema CHECK: 3..32 chars, must start and end with alphanumeric.
	const truncated = normalised.length > 32 ? normalised.slice(0, 32) : normalised;
	return truncated.replace(/^-+|-+$/g, '').slice(0, 32) || 'unknown-source';
}

/**
 * Authored ref-shape contract (ADR 019 amendment 2026-05 §1). The pass-through
 * path validates against this set so a future change to `serializeReferenceForDb`
 * surfaces here as a typed rejection instead of silent coercion through
 * `as unknown as StructuredCitation`.
 *
 * `ref` is required; the rest are optional sentinel fields the reader uses
 * for human-readable locator text. Unknown keys are flagged: if the writer
 * starts emitting a new sentinel, the migration will reject so we update
 * the contract (and the renderer) deliberately instead of dropping data.
 */
const REF_SHAPE_REQUIRED_KEYS = new Set(['ref']);
const REF_SHAPE_OPTIONAL_KEYS = new Set([
	'ref',
	'note',
	'quote',
	'chapter_title',
	'section_title',
	'paragraph_text',
	'page_heading',
	'redirected_from',
]);

interface RefShapeValidation {
	readonly ok: boolean;
	readonly reason: string | null;
}

function validateRefShape(value: unknown): RefShapeValidation {
	if (typeof value !== 'object' || value === null) {
		return { ok: false, reason: 'expected object' };
	}
	const obj = value as Record<string, unknown>;
	for (const key of REF_SHAPE_REQUIRED_KEYS) {
		if (typeof obj[key] !== 'string' || (obj[key] as string).length === 0) {
			return { ok: false, reason: `missing required string field '${key}'` };
		}
	}
	for (const key of Object.keys(obj)) {
		if (!REF_SHAPE_OPTIONAL_KEYS.has(key)) {
			return { ok: false, reason: `unknown sentinel field '${key}'; update REF_SHAPE_OPTIONAL_KEYS in scripts/db/migrate-references-to-structured.ts`,
			};
		}
		const v = obj[key];
		if (v !== undefined && typeof v !== 'string') {
			return { ok: false, reason: `field '${key}' must be string when present, got ${typeof v}` };
		}
	}
	return { ok: true, reason: null };
}

/**
 * Detect entries written in the `ref:`-shape (ADR 019 amendment 2026-05 §1).
 * Build-knowledge-index emits `{ ref: "airboss-ref:...", ...sentinels }` for
 * any reference that pre-resolves to the registry; the reader walks them via
 * `@ab/sources` directly. The legacy migration has nothing to do with these
 * entries -- pass them through untouched. Without this guard, the loop
 * mistakes them for legacy citations and crashes on `legacy.source.trim()`.
 */
function isAuthoredRefShape(value: unknown): boolean {
	return (
		typeof value === 'object' &&
		value !== null &&
		typeof (value as { ref?: unknown }).ref === 'string' &&
		(value as { ref: string }).ref.length > 0
	);
}

/**
 * Reshape one legacy citation into a `ReshapedCitation` carrying a
 * resolved reference identity + the StructuredCitation shape minus
 * `reference_id`. Pure -- no DB access. The script side wraps this with
 * the registry-resolution + row-write transaction.
 *
 * Resolution precedence:
 *   1. Handbook patterns (PHAK, AFH, AIH, IPH, IFH, AvWx, FAA-H-8083-2)
 *   2. CFR / FAR pattern
 *   3. AC pattern
 *   4. ACS / PTS pattern
 *   5. AIM pattern
 *   6. PCG / Pilot/Controller Glossary pattern
 *   7. NTSB pattern
 *   8. POH / AFM pattern
 *   9. Fallback: kind = `other`, slug derived from source
 */
export function reshapeLegacyCitation(legacy: LegacyCitation): ReshapedCitation {
	const source = legacy.source.trim();
	const detail = legacy.detail.trim();
	const note = legacy.note.trim();
	const noteOrUndefined = note.length === 0 ? undefined : note;

	// 1. Handbook patterns
	for (const pattern of HANDBOOK_PATTERNS) {
		if (!pattern.regex.test(source)) continue;
		const locator = extractHandbookLocator(detail);
		// Honor an explicit edition tag in `source` if it matches the pattern's
		// edition family (e.g. `AFH (FAA-H-8083-3B)` overrides the default).
		// Patterns that pin the default edition ignore inline tags entirely
		// (see HandbookPattern.pinDefaultEdition).
		const editionMatch = pattern.pinDefaultEdition ? null : source.match(/\bFAA-H-8083-\d+[A-Z]?\b/i);
		const edition = editionMatch ? editionMatch[0].toUpperCase() : pattern.defaultEdition;
		const resolved: ResolvedReference = {
			kind: REFERENCE_KINDS.HANDBOOK,
			documentSlug: pattern.slug,
			edition,
			title: pattern.title,
			url: pattern.url,
		};
		return {
			resolved,
			citation: {
				kind: 'handbook',
				locator: {
					chapter: locator.chapter,
					...(locator.page_start !== undefined ? { page_start: locator.page_start } : {}),
					...(locator.page_end !== undefined ? { page_end: locator.page_end } : {}),
				},
				framing: CITATION_FRAMINGS.SURVEY,
				...(noteOrUndefined !== undefined ? { note: noteOrUndefined } : {}),
			},
		};
	}

	// 2. CFR / FAR
	if (/\b(?:CFR|FAR)\b/i.test(source)) {
		const cfrLocator = extractCfrLocator(source, detail);
		const slug = `${cfrLocator.title}cfr${cfrLocator.part}`;
		const edition = `current`;
		const resolved: ResolvedReference = {
			kind: REFERENCE_KINDS.CFR,
			documentSlug: slug,
			edition,
			title: `${cfrLocator.title} CFR Part ${cfrLocator.part}`,
			url: `https://www.ecfr.gov/current/title-${cfrLocator.title}/part-${cfrLocator.part}`,
		};
		return {
			resolved,
			citation: {
				kind: 'cfr',
				locator: { title: cfrLocator.title, part: cfrLocator.part, section: cfrLocator.section },
				framing: CITATION_FRAMINGS.REGULATORY,
				...(noteOrUndefined !== undefined ? { note: noteOrUndefined } : {}),
			},
		};
	}

	// 3. AC
	const acInfo = acSlugFromSource(source);
	if (acInfo) {
		const resolved: ResolvedReference = {
			kind: REFERENCE_KINDS.AC,
			documentSlug: acInfo.slug,
			edition: acInfo.edition,
			title: `Advisory Circular ${acInfo.number}`,
		};
		// Try to lift a paragraph reference out of `detail` (e.g. "Para 5.2.1").
		const paraMatch = detail.match(/\b(?:Para|Paragraph|§)\s*([0-9.]+[a-z]?)\b/i);
		return {
			resolved,
			citation: {
				kind: 'ac',
				locator: paraMatch !== null ? { paragraph: paraMatch[1] } : {},
				framing: CITATION_FRAMINGS.REGULATORY,
				...(noteOrUndefined !== undefined ? { note: noteOrUndefined } : {}),
			},
		};
	}

	// 4. ACS / PTS
	if (/\bACS\b|\bPTS\b/i.test(source)) {
		const isPts = /\bPTS\b/i.test(source);
		const resolved: ResolvedReference = {
			kind: isPts ? REFERENCE_KINDS.PTS : REFERENCE_KINDS.ACS,
			documentSlug: isPts ? 'generic-pts' : 'generic-acs',
			edition: 'unspecified',
			title: isPts ? 'Practical Test Standards (unspecified)' : 'Airman Certification Standards (unspecified)',
		};
		return {
			resolved,
			citation: {
				kind: isPts ? 'pts' : 'acs',
				locator: {},
				framing: CITATION_FRAMINGS.EXAMINER,
				...(noteOrUndefined !== undefined ? { note: noteOrUndefined } : {}),
			},
		};
	}

	// 5. AIM
	if (/\bAIM\b/i.test(source)) {
		const resolved: ResolvedReference = {
			kind: REFERENCE_KINDS.AIM,
			documentSlug: 'aim',
			// Pin to the on-disk edition so the migrator resolves to the
			// authored row from `aim/<edition>/manifest.json` instead of
			// upserting a synthetic `(aim, current)` orphan. When the FAA
			// publishes a new AIM, bump AIM_CURRENT_EDITION in libs/constants
			// in the same PR as the new on-disk edition.
			edition: AIM_CURRENT_EDITION,
			title: 'Aeronautical Information Manual',
			url: 'https://www.faa.gov/air_traffic/publications/atpubs/aim_html/',
		};
		// AIM paragraph is hyphenated like `5-1-7`; pull it from `detail`.
		const paraMatch = detail.match(/\b(\d+(?:-\d+){1,3})\b/);
		return {
			resolved,
			citation: {
				kind: 'aim',
				locator: paraMatch !== null ? { paragraph: paraMatch[1] } : {},
				framing: CITATION_FRAMINGS.PROCEDURAL,
				...(noteOrUndefined !== undefined ? { note: noteOrUndefined } : {}),
			},
		};
	}

	// 6. PCG
	if (/\bPCG\b|Pilot\/Controller Glossary/i.test(source)) {
		const resolved: ResolvedReference = {
			kind: REFERENCE_KINDS.PCG,
			documentSlug: 'pcg',
			edition: 'current',
			title: 'Pilot/Controller Glossary',
		};
		return {
			resolved,
			citation: {
				kind: 'pcg',
				locator: detail.length > 0 ? { term: detail } : {},
				framing: CITATION_FRAMINGS.SURVEY,
				...(noteOrUndefined !== undefined ? { note: noteOrUndefined } : {}),
			},
		};
	}

	// 7. NTSB
	if (/\bNTSB\b/i.test(source)) {
		const resolved: ResolvedReference = {
			kind: REFERENCE_KINDS.NTSB,
			documentSlug: 'ntsb',
			edition: 'archive',
			title: 'NTSB accident reports',
			url: 'https://www.ntsb.gov/Pages/AviationQuery.aspx',
		};
		return {
			resolved,
			citation: {
				kind: 'ntsb',
				locator: detail.length > 0 ? { detail } : {},
				framing: CITATION_FRAMINGS.OPERATIONAL,
				...(noteOrUndefined !== undefined ? { note: noteOrUndefined } : {}),
			},
		};
	}

	// 8. POH / AFM
	if (/\bPOH\b|\bAFM\b/i.test(source)) {
		const resolved: ResolvedReference = {
			kind: REFERENCE_KINDS.POH,
			documentSlug: 'poh-afm',
			edition: 'aircraft-specific',
			title: 'Pilot Operating Handbook / Aircraft Flight Manual',
		};
		return {
			resolved,
			citation: {
				kind: 'poh',
				locator: detail.length > 0 ? { detail } : {},
				framing: CITATION_FRAMINGS.OPERATIONAL,
				...(noteOrUndefined !== undefined ? { note: noteOrUndefined } : {}),
			},
		};
	}

	// 9. Specific `other` publications with stable identities. These are
	// authored in `course/references/other-publications.yaml`; matching here
	// emits the same `(slug, edition)` pair the seed uses, so the migration
	// resolves against the authored row instead of upserting a synthetic.
	const specific = matchSpecificOtherPublication(source);
	if (specific !== null) {
		return {
			resolved: specific,
			citation: {
				kind: 'other',
				locator: detail.length > 0 ? { detail } : {},
				...(noteOrUndefined !== undefined ? { note: noteOrUndefined } : {}),
			},
		};
	}

	// 10. Fallback: kind = other
	const slug = slugifySource(source);
	const resolved: ResolvedReference = {
		kind: REFERENCE_KINDS.OTHER,
		documentSlug: slug,
		edition: 'unspecified',
		title: source.length > 0 ? source : 'Unknown source',
	};
	return {
		resolved,
		citation: {
			kind: 'other',
			locator: detail.length > 0 ? { detail } : {},
			...(noteOrUndefined !== undefined ? { note: noteOrUndefined } : {}),
		},
	};
}

/**
 * Recognise a specific non-FAA-handbook / non-CFR publication by its
 * canonical source string and return a `ResolvedReference` whose
 * `(documentSlug, edition)` pair matches the authored row in
 * `course/references/other-publications.yaml`. Returns `null` when no
 * recognizer fires, letting the generic fallback take over.
 */
function matchSpecificOtherPublication(source: string): ResolvedReference | null {
	// AOPA Air Safety Institute -- canonical form for the AOPA cluster.
	// Knowledge nodes have been normalised to this exact string; the
	// recognizer is an additional defence so future variants resolve too.
	if (/\bAOPA\b/i.test(source)) {
		return {
			kind: REFERENCE_KINDS.OTHER,
			documentSlug: 'aopa-air-safety-institute',
			edition: 'current',
			title: 'AOPA Air Safety Institute',
			url: 'https://www.aopa.org/training-and-safety/air-safety-institute',
		};
	}
	// FAA-P-8740-NN pilot safety brochures. Slug is per-brochure; this
	// recognizer covers `FAA-P-8740-36` (Aviation Decision Making) which is
	// the only one currently cited. Future brochures get their own row.
	const safetyBrochureMatch = source.match(/\bFAA-P-8740-(\d+)\b/i);
	if (safetyBrochureMatch !== null) {
		const number = safetyBrochureMatch[1];
		return {
			kind: REFERENCE_KINDS.OTHER,
			documentSlug: `faa-p-8740-${number}`,
			edition: 'unspecified',
			title: `FAA-P-8740-${number}`,
		};
	}
	// FAA Order 8260.3 (TERPS).
	if (/\bFAA\s+Order\s+8260\.3\b/i.test(source)) {
		return {
			kind: REFERENCE_KINDS.OTHER,
			documentSlug: 'faa-order-8260-3',
			edition: '8260.3C',
			title: 'United States Standard for Terminal Instrument Procedures (TERPS)',
			url: 'https://www.faa.gov/regulations_policies/orders_notices?searchedQuery=8260.3',
		};
	}
	// FAA approach plates (per-airport).
	if (/\bApproach plates\b/i.test(source)) {
		return {
			kind: REFERENCE_KINDS.OTHER,
			documentSlug: 'faa-approach-plates',
			edition: 'current',
			title: 'FAA Approach Plates (per-airport)',
			url: 'https://www.faa.gov/air_traffic/flight_info/aeronav/digital_products/',
		};
	}
	// Jeppesen / FAA aeronautical charts.
	if (/\bJeppesen\b/i.test(source) && /\bcharts?\b/i.test(source)) {
		return {
			kind: REFERENCE_KINDS.OTHER,
			documentSlug: 'jeppesen-faa-charts',
			edition: 'current',
			title: 'Jeppesen and FAA aeronautical charts',
		};
	}
	// Rogers, D. F. -- "The Possible 'Impossible' Turn" (AIAA, 1995).
	if (/\bRogers,\s*D\.\s*F\.?\b/i.test(source)) {
		return {
			kind: REFERENCE_KINDS.OTHER,
			documentSlug: 'rogers-d-f',
			edition: '1995',
			title: "The Possible 'Impossible' Turn (AIAA Journal of Aircraft, 1995)",
		};
	}
	return null;
}

// ---------------------------------------------------------------------------
// Migration runner
// ---------------------------------------------------------------------------

export interface MigrationOptions {
	dryRun?: boolean;
	/**
	 * Restrict the migration to a specific set of `knowledge_node.id`
	 * values. Used by the test fixture so its run does not touch
	 * production rows; production runs leave this undefined.
	 */
	onlyNodeIds?: ReadonlyArray<string>;
}

export interface MigrationReport {
	rowsScanned: number;
	rowsAlreadyMigrated: number;
	rowsMigrated: number;
	citationsReshaped: number;
	citationsAlreadyStructured: number;
	/**
	 * Entries already authored in the `ref:`-shape (ADR 019 amendment 2026-05).
	 * Pass-through: we don't reshape them and don't touch the registry row.
	 */
	citationsAlreadyRefShape: number;
	syntheticReferencesCreated: number;
	/** Failures that would otherwise have aborted the script; populated only on success runs. */
	errors: Array<{ nodeId: string; error: string }>;
}

interface ReferenceCacheEntry {
	id: string;
}

/**
 * Walk every un-migrated knowledge_node row and reshape its `references`
 * JSONB array. Idempotent via `references_v2_migrated`.
 */
export async function migrateReferencesToStructured(
	options: MigrationOptions = {},
	db: Db = defaultDb,
): Promise<MigrationReport> {
	const dryRun = options.dryRun ?? false;
	const report: MigrationReport = {
		rowsScanned: 0,
		rowsAlreadyMigrated: 0,
		rowsMigrated: 0,
		citationsReshaped: 0,
		citationsAlreadyStructured: 0,
		citationsAlreadyRefShape: 0,
		syntheticReferencesCreated: 0,
		errors: [],
	};

	const allRowsRaw = await db
		.select({
			id: knowledgeNode.id,
			references: knowledgeNode.references,
			referencesV2Migrated: knowledgeNode.referencesV2Migrated,
		})
		.from(knowledgeNode);
	const rows =
		options.onlyNodeIds === undefined
			? allRowsRaw
			: allRowsRaw.filter((r) => options.onlyNodeIds?.includes(r.id) ?? false);
	report.rowsScanned = rows.length;

	// Cache resolved reference rows by `(documentSlug, edition)` so a node
	// citing PHAK three times only round-trips the upsert once.
	const referenceCache = new Map<string, ReferenceCacheEntry>();
	const cacheKey = (slug: string, edition: string): string => `${slug}@${edition}`;

	const resolveReference = async (resolved: ResolvedReference): Promise<string> => {
		const key = cacheKey(resolved.documentSlug, resolved.edition);
		const cached = referenceCache.get(key);
		if (cached !== undefined) return cached.id;
		// If the seed has already created a real row with the same identity,
		// return its id without re-upserting -- otherwise the migration
		// would clobber publisher / url / title authored by the seed.
		const before = await db
			.select({ id: reference.id })
			.from(reference)
			.where(and(eq(reference.documentSlug, resolved.documentSlug), eq(reference.edition, resolved.edition)))
			.limit(1);
		const existing = before[0];
		if (existing !== undefined) {
			referenceCache.set(key, { id: existing.id });
			return existing.id;
		}
		// No row yet: upsert a synthetic stamped with `seed_origin` so it
		// remains distinguishable from authored rows.
		const row = await upsertReference(
			{
				kind: resolved.kind,
				documentSlug: resolved.documentSlug,
				edition: resolved.edition,
				title: resolved.title,
				url: resolved.url ?? null,
				seedOrigin: MIGRATION_SEED_ORIGIN,
			},
			db,
		);
		report.syntheticReferencesCreated += 1;
		referenceCache.set(key, { id: row.id });
		return row.id;
	};

	for (const row of rows) {
		if (row.referencesV2Migrated) {
			report.rowsAlreadyMigrated += 1;
			continue;
		}

		const entries = (row.references ?? []) as readonly unknown[];
		const newCitations: StructuredCitation[] = [];

		try {
			for (const entry of entries) {
				const candidate = entry as unknown as Parameters<typeof isStructuredCitation>[0];
				if (isStructuredCitation(candidate)) {
					// Already structured (e.g. seeded by a syllabus author or a
					// later ingest pass). Pass through unchanged so the migration
					// is safe to re-run after partial authoring.
					newCitations.push(candidate);
					report.citationsAlreadyStructured += 1;
					continue;
				}
				if (isAuthoredRefShape(entry)) {
					// New `ref:`-shape entry written by build-knowledge-index
					// (ADR 019 amendment 2026-05 §1). The reader resolves these
					// directly via `@ab/sources`; the migration has nothing to
					// reshape and the registry row already exists. We still
					// validate the shape so a future change to the writer
					// surfaces here as a typed rejection instead of silently
					// flowing through `as unknown as StructuredCitation`.
					const validated = validateRefShape(entry);
					if (!validated.ok) {
						throw new Error(`ref-shape validation failed: ${validated.reason}`);
					}
					newCitations.push(entry as unknown as StructuredCitation);
					report.citationsAlreadyRefShape += 1;
					continue;
				}
				const legacy = entry as LegacyCitation;
				if (typeof legacy?.source !== 'string') {
					throw new Error(
						`unrecognised citation entry shape (expected legacy {source,detail,note}, structured {kind,...}, or ref-shape {ref,...}); keys=[${Object.keys((legacy as object) ?? {}).join(',')}]`,
					);
				}
				const reshaped = reshapeLegacyCitation(legacy);
				if (dryRun) {
					// In dry-run we do not touch the reference table. Use a
					// synthetic placeholder id so the citation type-checks; the
					// caller never inspects this on the dry-run path.
					newCitations.push({
						...reshaped.citation,
						reference_id: `dry-run:${reshaped.resolved.documentSlug}@${reshaped.resolved.edition}`,
					} as StructuredCitation);
				} else {
					const referenceId = await resolveReference(reshaped.resolved);
					newCitations.push({
						...reshaped.citation,
						reference_id: referenceId,
					} as StructuredCitation);
				}
				report.citationsReshaped += 1;
			}
		} catch (err) {
			const message = err instanceof Error ? err.message : String(err);
			report.errors.push({ nodeId: row.id, error: message });
			throw new Error(`migrate-references-to-structured: row ${row.id}: ${message}`);
		}

		if (dryRun) {
			report.rowsMigrated += 1;
			continue;
		}

		// One UPDATE per row, not one transaction per row: the operation is a
		// single statement, so begin/commit per row was pure overhead. The
		// column's `$type<LegacyCitation[]>` hint is the pre-migration shape;
		// post-migration this column holds StructuredCitation entries (cast
		// through unknown to silence the type bridge).
		await db
			.update(knowledgeNode)
			.set({
				references: newCitations as unknown as { source: string; detail: string; note: string }[],
				referencesV2Migrated: true,
				updatedAt: new Date(),
			})
			.where(eq(knowledgeNode.id, row.id));
		report.rowsMigrated += 1;
	}

	return report;
}

async function main(): Promise<void> {
	const args = new Set(process.argv.slice(2));
	const dryRun = args.has('--dry-run');
	const report = await migrateReferencesToStructured({ dryRun });
	const tag = dryRun ? '(dry-run) ' : '';
	process.stdout.write(
		`${tag}migrate-references-to-structured: scanned ${report.rowsScanned}, already-migrated ${report.rowsAlreadyMigrated}, migrated ${report.rowsMigrated}\n`,
	);
	process.stdout.write(
		`  citations reshaped: ${report.citationsReshaped}; already structured: ${report.citationsAlreadyStructured}; ref-shape pass-through: ${report.citationsAlreadyRefShape}; synthetic references created: ${report.syntheticReferencesCreated}\n`,
	);
	if (report.errors.length > 0) {
		process.stdout.write(`  errors: ${report.errors.length}\n`);
		for (const e of report.errors) {
			process.stdout.write(`    ${e.nodeId}: ${e.error}\n`);
		}
		process.exit(1);
	}
}

if (import.meta.main) {
	main()
		.catch((err) => {
			process.stderr.write(`migrate-references-to-structured: ${(err as Error).stack ?? err}\n`);
			process.exitCode = 1;
		})
		.finally(() => client.end());
}
