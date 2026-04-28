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

import { CITATION_FRAMINGS, type CitationFraming, REFERENCE_KINDS, type ReferenceKind } from '@ab/constants';
import { db as defaultDb } from '@ab/db';
import type { LegacyCitation, StructuredCitation } from '@ab/types';
import { isStructuredCitation } from '@ab/types';
import { and, eq } from 'drizzle-orm';
import type { PgDatabase, PgQueryResultHKT } from 'drizzle-orm/pg-core';
import { upsertReference } from '../../libs/bc/study/src/handbooks';
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
		slug: 'aih',
		defaultEdition: 'FAA-H-8083-9B',
		title: "Aviation Instructor's Handbook",
		url: 'https://www.faa.gov/regulations_policies/handbooks_manuals/aviation/aviation_instructors_handbook',
	},
	{
		regex: /\b(?:IPH|Instrument Procedures Handbook|FAA-H-8083-16[A-Z]?)\b/i,
		slug: 'iph',
		defaultEdition: 'FAA-H-8083-16B',
		title: 'Instrument Procedures Handbook',
		url: 'https://www.faa.gov/regulations_policies/handbooks_manuals/aviation/instrument_procedures_handbook',
	},
	{
		regex: /\b(?:Instrument Flying Handbook|IFH|FAA-H-8083-15[A-Z]?)\b/i,
		slug: 'ifh',
		defaultEdition: 'FAA-H-8083-15B',
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
		slug: 'faa-h-8083-2',
		defaultEdition: 'FAA-H-8083-2A',
		title: 'Risk Management Handbook',
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
		const editionMatch = source.match(/\bFAA-H-8083-\d+[A-Z]?\b/i);
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
			edition: 'current',
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

	// 9. Fallback: kind = other
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
		// upsertReference is idempotent at the (document_slug, edition)
		// uniqueness key. If the seed has already created a real row with
		// the same identity we will land on its id; otherwise the migration
		// creates a synthetic row stamped with `seed_origin`.
		const before = await db
			.select({ id: reference.id })
			.from(reference)
			.where(and(eq(reference.documentSlug, resolved.documentSlug), eq(reference.edition, resolved.edition)))
			.limit(1);
		const isFreshlyCreated = before.length === 0;
		const row = await upsertReference(
			{
				kind: resolved.kind,
				documentSlug: resolved.documentSlug,
				edition: resolved.edition,
				title: resolved.title,
				url: resolved.url ?? null,
				// Only stamp seed_origin on rows the migration creates fresh; an
				// existing real row keeps whatever the seed wrote.
				seedOrigin: isFreshlyCreated ? MIGRATION_SEED_ORIGIN : null,
			},
			db,
		);
		if (isFreshlyCreated) report.syntheticReferencesCreated += 1;
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
				const legacy = entry as LegacyCitation;
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

		await db.transaction(async (tx) => {
			await tx
				.update(knowledgeNode)
				.set({
					// Cast through unknown: the column's `$type<LegacyCitation[]>`
					// hint is the pre-migration shape; post-migration this column
					// holds StructuredCitation entries.
					references: newCitations as unknown as { source: string; detail: string; note: string }[],
					referencesV2Migrated: true,
					updatedAt: new Date(),
				})
				.where(eq(knowledgeNode.id, row.id));
		});
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
		`  citations reshaped: ${report.citationsReshaped}; already structured: ${report.citationsAlreadyStructured}; synthetic references created: ${report.syntheticReferencesCreated}\n`,
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
	main().catch((err) => {
		process.stderr.write(`migrate-references-to-structured: ${(err as Error).stack ?? err}\n`);
		process.exit(1);
	});
}
