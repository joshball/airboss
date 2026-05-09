// @browser-globals: server-only -- never imported by client .svelte
/**
 * Reference ingestion + reader BC.
 *
 * Reads, writes, and BC-internal helpers for the corpus-agnostic
 * `reference` + `reference_section` substrate (post-WP-SUB). Handbook
 * navigation primitives (chapter / section / figure) live here today because
 * handbooks were the first corpus; they continue to serve the handbook
 * reader unchanged. Future corpora (AIM, CFR, ...) add their own readers
 * alongside these.
 *
 * Read paths:
 *   - listReferences / getReferenceByDocument        index + per-document page
 *   - listHandbookChapters / listChapterSections     handbook chapter list, section list
 *   - getHandbookSection                              handbook section page payload
 *   - getNodesCitingSection                           reverse citation panel
 *   - getReadState / getHandbookProgress              read-state for a user
 *   - getReadableReferenceIds                         "has body content" probe
 *   - resolveCitationUrl                              link out from node refs
 *
 * Write paths:
 *   - setReadStatus / setComprehended / markAsReread / setNotes
 *   - recordHeartbeat
 *
 * Build-only helpers (not exported from the BC barrel):
 *   - upsertReference / upsertReferenceSection
 *   - replaceFiguresForSection / attachSupersededByLatest
 *
 * The reverse-citation query relies on the GIN index added on
 * `knowledge_node.references` -- containment (`@>`) on a JSONB column with
 * `jsonb_path_ops` keeps the candidate scan bounded. The locator narrowing
 * happens in-memory because `@>` against a partially-known shape (e.g.
 * "kind=handbook AND reference_id=X" without committing to the chapter)
 * produces too many false negatives for the citing-nodes panel.
 */

import {
	type CertApplicability,
	CITATION_URL_TEMPLATES,
	HANDBOOK_HEARTBEAT_INTERVAL_SEC,
	HANDBOOK_HEARTBEAT_MIN_DELTA_SEC,
	HANDBOOK_NOTES_MAX_LENGTH,
	HANDBOOK_READ_STATUSES,
	type HandbookReadStatus,
	REFERENCE_KINDS,
	REFERENCE_SECTION_LEVELS,
	ROUTES,
} from '@ab/constants';
import { client, db as defaultDb } from '@ab/db/connection';
import {
	getAcSeedMappingByReference,
	getCorpusResolver,
	isParseError,
	parseIdentifier,
	type SourceId,
} from '@ab/sources';
import type { Citation, StructuredCitation } from '@ab/types';
import { isHandbookCitation, isStructuredCitation } from '@ab/types';
import { generateReferenceFigureId, generateReferenceId, generateReferenceSectionId } from '@ab/utils';
import { and, asc, desc, eq, inArray, isNull, sql } from 'drizzle-orm';
import type { PgDatabase, PgQueryResultHKT } from 'drizzle-orm/pg-core';
import { notSupersededInRegistry } from './edition-predicates.ts';
import {
	type HandbookManifestWarningCode,
	type HandbookWarningTriageStatus,
	handbookWarningsFileSchema,
	handbookWarningsTriageFileSchema,
} from './manifest-validation';
import type { ReferenceSectionFaaPages } from './reference-metadata';
import {
	type KnowledgeNodeRow,
	knowledgeNode,
	type NewReferenceFigureRow,
	type NewReferenceRow,
	type NewReferenceSectionRow,
	type ReferenceFigureRow,
	type ReferenceRow,
	type ReferenceSectionReadStateRow,
	type ReferenceSectionRow,
	reference,
	referenceFigure,
	referenceSection,
	referenceSectionReadState,
} from './schema';

type Db = PgDatabase<PgQueryResultHKT, Record<string, never>>;

// ---------------------------------------------------------------------------
// Errors
// ---------------------------------------------------------------------------

export class ReferenceNotFoundError extends Error {
	constructor(public readonly key: { documentSlug: string; edition?: string } | { id: string }) {
		super(
			'id' in key
				? `Reference not found: ${key.id}`
				: `Reference not found: ${key.documentSlug}${key.edition ? `@${key.edition}` : ''}`,
		);
		this.name = 'ReferenceNotFoundError';
	}
}

export class HandbookSectionNotFoundError extends Error {
	constructor(
		public readonly key:
			| { id: string }
			| { referenceId: string; code: string }
			| { documentSlug: string; edition?: string; code: string },
	) {
		super(`Handbook section not found: ${JSON.stringify(key)}`);
		this.name = 'HandbookSectionNotFoundError';
	}
}

export class HandbookValidationError extends Error {
	constructor(message: string) {
		super(message);
		this.name = 'HandbookValidationError';
	}
}

// ---------------------------------------------------------------------------
// Read functions
// ---------------------------------------------------------------------------

export interface ListReferencesOptions {
	/** Default false. When true, includes references whose registry row carries `retired_at` (superseded editions). */
	includeSuperseded?: boolean;
	/** Optional `kind` filter -- e.g. only handbooks. */
	kind?: ReferenceRow['kind'];
}

/**
 * List every reference, newest editions first within a `document_slug`.
 *
 * The default excludes superseded editions (per ADR 026, "superseded" =
 * `sources_registry.editions.retired_at IS NOT NULL` for the row's
 * `(source_id, edition_label)` pair) so the index page renders one card per
 * active handbook. Opt in to `includeSuperseded` for archive views.
 */
export async function listReferences(options: ListReferencesOptions = {}, db: Db = defaultDb): Promise<ReferenceRow[]> {
	const conditions = [];
	if (!options.includeSuperseded) conditions.push(notSupersededInRegistry());
	if (options.kind) conditions.push(eq(reference.kind, options.kind));
	const where = conditions.length === 0 ? undefined : conditions.length === 1 ? conditions[0] : and(...conditions);
	const query = db.select().from(reference).orderBy(asc(reference.documentSlug), asc(reference.edition));
	const rows = await (where ? query.where(where) : query);
	return rows;
}

export interface GetReferenceOptions {
	/** Edition tag. Defaults to the latest non-superseded edition. */
	edition?: string;
}

/**
 * Resolve a reference by `document_slug`, defaulting to the latest non-
 * superseded edition. Throws `ReferenceNotFoundError` when no row matches.
 */
export async function getReferenceByDocument(
	documentSlug: string,
	options: GetReferenceOptions = {},
	db: Db = defaultDb,
): Promise<ReferenceRow> {
	if (options.edition !== undefined) {
		const rows = await db
			.select()
			.from(reference)
			.where(and(eq(reference.documentSlug, documentSlug), eq(reference.edition, options.edition)))
			.limit(1);
		const row = rows[0];
		if (!row) throw new ReferenceNotFoundError({ documentSlug, edition: options.edition });
		return row;
	}
	// ORDER BY edition DESC because edition tags sort lexicographically: the
	// FAA-H- prefix (`FAA-H-8083-3C`) outranks bare-prefix legacy rows
	// (`8083-3C`) when both somehow coexist. Without this, Postgres returns
	// rows in an indeterminate order and an empty legacy row can shadow the
	// real one. `db reset` rebuilds with one edition per handbook and the
	// problem disappears, but we lock in deterministic resolution so a
	// half-seeded DB can't silently render an empty page.
	const rows = await db
		.select()
		.from(reference)
		.where(and(eq(reference.documentSlug, documentSlug), notSupersededInRegistry()))
		.orderBy(desc(reference.edition))
		.limit(1);
	const row = rows[0];
	if (!row) throw new ReferenceNotFoundError({ documentSlug });
	return row;
}

/** Resolve a reference by primary key. */
export async function getReferenceById(id: string, db: Db = defaultDb): Promise<ReferenceRow> {
	const rows = await db.select().from(reference).where(eq(reference.id, id)).limit(1);
	const row = rows[0];
	if (!row) throw new ReferenceNotFoundError({ id });
	return row;
}

/**
 * Resolve a single `reference_section` row by id. Returns null when no row
 * exists (e.g. a stale page reposting after the section was re-ingested).
 * Used by the flightbag heartbeat endpoint to validate the target before
 * crediting reading time.
 */
export async function getReferenceSectionById(id: string, db: Db = defaultDb): Promise<ReferenceSectionRow | null> {
	const rows = await db.select().from(referenceSection).where(eq(referenceSection.id, id)).limit(1);
	return rows[0] ?? null;
}

/** Chapter rows for a reference, ordered by ordinal. */
export async function listHandbookChapters(referenceId: string, db: Db = defaultDb): Promise<ReferenceSectionRow[]> {
	return db
		.select()
		.from(referenceSection)
		.where(
			and(eq(referenceSection.referenceId, referenceId), eq(referenceSection.level, REFERENCE_SECTION_LEVELS.CHAPTER)),
		)
		.orderBy(asc(referenceSection.ordinal));
}

/** Section rows for a chapter, ordered by ordinal. Excludes the chapter row itself. */
export async function listChapterSections(chapterId: string, db: Db = defaultDb): Promise<ReferenceSectionRow[]> {
	return db
		.select()
		.from(referenceSection)
		.where(eq(referenceSection.parentId, chapterId))
		.orderBy(asc(referenceSection.ordinal));
}

/**
 * Flat top-level sections for a reference. Used by corpora that seed sections
 * directly under the reference with no chapter parent (notably CFR -- per
 * `REFERENCE_SECTION_LEVELS.PART` doc, the seeder produces level=section rows
 * flat under the reference). Returns rows where `parentId IS NULL` and
 * `level = 'section'`, ordered by ordinal.
 *
 * Distinct from {@link listHandbookChapters} (which filters level=chapter)
 * and from {@link listChapterSections} (which descends a known chapter).
 */
export async function listFlatTopLevelSections(
	referenceId: string,
	db: Db = defaultDb,
): Promise<ReferenceSectionRow[]> {
	return db
		.select()
		.from(referenceSection)
		.where(
			and(
				eq(referenceSection.referenceId, referenceId),
				eq(referenceSection.level, REFERENCE_SECTION_LEVELS.SECTION),
				isNull(referenceSection.parentId),
			),
		)
		.orderBy(asc(referenceSection.ordinal));
}

/**
 * Subpart rows for a reference. Used by the CFR section-list view to render
 * sections grouped under "Subpart A -- General", "Subpart B -- Flight
 * Rules", ... per Wave 2 of the CFR ingestion plan. Returns rows where
 * `level = 'subpart'` and `parentId IS NULL` (subparts sit at depth 0
 * directly under the reference); ordered by ordinal so the publisher's A,
 * B, C, ... order is preserved.
 */
export async function listSubpartsForReference(
	referenceId: string,
	db: Db = defaultDb,
): Promise<ReferenceSectionRow[]> {
	return db
		.select()
		.from(referenceSection)
		.where(
			and(
				eq(referenceSection.referenceId, referenceId),
				eq(referenceSection.level, REFERENCE_SECTION_LEVELS.SUBPART),
				isNull(referenceSection.parentId),
			),
		)
		.orderBy(asc(referenceSection.ordinal));
}

/**
 * Section rows that live under a Subpart parent. Pair with
 * {@link listSubpartsForReference} to render the Subpart -> Section tree
 * on the CFR Part page. Ordered by ordinal so sections render in
 * regulatory order.
 */
export async function listSectionsForSubpart(subpartId: string, db: Db = defaultDb): Promise<ReferenceSectionRow[]> {
	return db
		.select()
		.from(referenceSection)
		.where(and(eq(referenceSection.parentId, subpartId), eq(referenceSection.level, REFERENCE_SECTION_LEVELS.SECTION)))
		.orderBy(asc(referenceSection.ordinal));
}

/**
 * All section rows for a reference, regardless of subpart parent. Used by
 * the CFR detail view to assemble the cross-subpart sibling list and by
 * `getFlatSection` to resolve a section by full code without caring about
 * which Subpart owns it.
 */
export async function listAllSectionRowsForReference(
	referenceId: string,
	db: Db = defaultDb,
): Promise<ReferenceSectionRow[]> {
	return db
		.select()
		.from(referenceSection)
		.where(
			and(eq(referenceSection.referenceId, referenceId), eq(referenceSection.level, REFERENCE_SECTION_LEVELS.SECTION)),
		)
		.orderBy(asc(referenceSection.ordinal));
}

/**
 * Flat-corpus variant of {@link getHandbookSection}. Resolves a section row
 * by its full code (e.g. CFR `91.103`) under a reference whose sections sit
 * flat at depth 0 with no chapter row. Returns the section + figures +
 * sibling list (all flat top-level sections of the reference). The caller
 * synthesizes a "virtual chapter" payload from the reference itself.
 *
 * Throws `HandbookSectionNotFoundError` if the section doesn't exist.
 */
export async function getFlatSection(
	referenceId: string,
	fullCode: string,
	db: Db = defaultDb,
): Promise<{
	section: ReferenceSectionRow;
	figures: ReferenceFigureRow[];
	siblings: ReferenceSectionRow[];
}> {
	const sectionRows = await db
		.select()
		.from(referenceSection)
		.where(
			and(
				eq(referenceSection.referenceId, referenceId),
				eq(referenceSection.code, fullCode),
				eq(referenceSection.level, REFERENCE_SECTION_LEVELS.SECTION),
			),
		)
		.limit(1);
	const section = sectionRows[0];
	if (!section) throw new HandbookSectionNotFoundError({ referenceId, code: fullCode });

	const figures = await db
		.select()
		.from(referenceFigure)
		.where(eq(referenceFigure.sectionId, section.id))
		.orderBy(asc(referenceFigure.ordinal));

	// Siblings span every section under the reference (across all Subparts
	// post-Wave-2) so the detail page TOC stays book-experience consistent.
	// Pre-Wave-2 (handbooks / AIM with flat sections under the reference)
	// the result is unchanged because every section was already at the same
	// flat depth.
	const siblings = await listAllSectionRowsForReference(referenceId, db);
	return { section, figures, siblings };
}

/** All sections under a reference flattened in tree order (chapter, then sections, then subsections). */
export async function listAllSectionsForReference(
	referenceId: string,
	db: Db = defaultDb,
): Promise<ReferenceSectionRow[]> {
	return db
		.select()
		.from(referenceSection)
		.where(eq(referenceSection.referenceId, referenceId))
		.orderBy(asc(referenceSection.code));
}

// ---------------------------------------------------------------------------
// Reading order (book-experience WP)
// ---------------------------------------------------------------------------

export interface ReadingOrderEntry {
	readonly sectionId: string;
	readonly code: string;
	readonly title: string;
	readonly depth: number;
	readonly level: ReferenceSectionRow['level'];
	readonly parentId: string | null;
	/** Code of the row's parent chapter -- top-level entries are their own chapter. */
	readonly parentChapterCode: string | null;
	readonly parentChapterTitle: string | null;
	/** Word count of the section's body markdown. Powers reading-time estimates. */
	readonly wordCount: number;
}

/**
 * Compute the canonical reading order for a reference.
 *
 * Walk: depth-first by `ordinal` within each parent. Top-level rows
 * (chapters / front-matter / appendices) appear in `ordinal` order; each
 * row's children follow it before the next sibling.
 *
 * The `parentChapterCode` / `parentChapterTitle` fields point at the row's
 * nearest level=`chapter` ancestor (or itself, when the row IS a chapter).
 * Non-handbook corpora that don't carry a chapter level (CFR sections,
 * AIM paragraphs nested under sections, ACS tasks under areas) fall back
 * to the topmost ancestor.
 *
 * Pure function: caller hands in the section rows (typically via
 * {@link listAllSectionsForReference}). No DB access. Determines the canonical
 * order each surface (the prev/up/next nav strip + the TOC drawer + the
 * "you've read N of M" coverage counter) reads from.
 */
export function computeReadingOrder(allSections: ReadonlyArray<ReferenceSectionRow>): ReadingOrderEntry[] {
	const byId = new Map<string, ReferenceSectionRow>();
	const childrenByParent = new Map<string | null, ReferenceSectionRow[]>();
	for (const row of allSections) {
		byId.set(row.id, row);
		const list = childrenByParent.get(row.parentId) ?? [];
		list.push(row);
		childrenByParent.set(row.parentId, list);
	}
	for (const list of childrenByParent.values()) {
		list.sort((a, b) => a.ordinal - b.ordinal);
	}

	const order: ReadingOrderEntry[] = [];
	const visit = (parentId: string | null, chapterCtx: ReferenceSectionRow | null): void => {
		const kids = childrenByParent.get(parentId) ?? [];
		for (const kid of kids) {
			// A row is its own chapter context when the row itself is a chapter
			// (handbook + AC) or when no chapter ancestor has been resolved yet
			// (whole-doc corpora that don't carry a chapter level).
			const ownChapter = kid.level === REFERENCE_SECTION_LEVELS.CHAPTER ? kid : (chapterCtx ?? kid);
			order.push({
				sectionId: kid.id,
				code: kid.code,
				title: kid.title,
				depth: kid.depth,
				level: kid.level,
				parentId: kid.parentId,
				parentChapterCode: ownChapter.id === kid.id ? null : ownChapter.code,
				parentChapterTitle: ownChapter.id === kid.id ? null : ownChapter.title,
				wordCount: countWords(kid.contentMd),
			});
			visit(kid.id, ownChapter);
		}
	};
	visit(null, null);
	return order;
}

/**
 * Count words in a markdown body. Approximate -- strips fences/HTML tags,
 * collapses whitespace, then splits on whitespace runs. Drives the
 * `≈ N min read` estimate at `WORDS_PER_MINUTE_READING_RATE`.
 */
function countWords(md: string): number {
	if (md.length === 0) return 0;
	const stripped = md
		.replace(/```[\s\S]*?```/g, ' ')
		.replace(/`[^`]*`/g, ' ')
		.replace(/<[^>]+>/g, ' ')
		.replace(/!\[[^\]]*\]\([^)]+\)/g, ' ')
		.replace(/\[([^\]]*)\]\([^)]+\)/g, '$1')
		.replace(/[#*_>~|-]+/g, ' ')
		.replace(/\s+/g, ' ')
		.trim();
	if (stripped.length === 0) return 0;
	return stripped.split(' ').length;
}

/** Convenience wrapper: load + compute. */
export async function getReadingOrder(referenceId: string, db: Db = defaultDb): Promise<ReadingOrderEntry[]> {
	const rows = await listAllSectionsForReference(referenceId, db);
	return computeReadingOrder(rows);
}

/** Return the entry following `sectionId` in reading order, or `null` at the end. */
export function getNextInReadingOrder(
	order: ReadonlyArray<ReadingOrderEntry>,
	sectionId: string,
): ReadingOrderEntry | null {
	const idx = order.findIndex((e) => e.sectionId === sectionId);
	if (idx < 0) return null;
	return order[idx + 1] ?? null;
}

/** Return the entry preceding `sectionId` in reading order, or `null` at the start. */
export function getPreviousInReadingOrder(
	order: ReadonlyArray<ReadingOrderEntry>,
	sectionId: string,
): ReadingOrderEntry | null {
	const idx = order.findIndex((e) => e.sectionId === sectionId);
	if (idx <= 0) return null;
	return order[idx - 1] ?? null;
}

export interface HandbookSectionView {
	section: ReferenceSectionRow;
	chapter: ReferenceSectionRow;
	figures: ReferenceFigureRow[];
	/** Sibling sections under the same chapter -- powers the sticky TOC. */
	siblings: ReferenceSectionRow[];
}

/**
 * Hydrated section payload for the reader. Includes figures (ordered) and
 * the sibling sections the sticky TOC renders.
 *
 * Throws `HandbookSectionNotFoundError` if either the chapter or the section
 * doesn't exist for the given reference.
 */
export async function getHandbookSection(
	referenceId: string,
	chapterCode: string,
	sectionCode: string,
	db: Db = defaultDb,
): Promise<HandbookSectionView> {
	const fullCode = `${chapterCode}.${sectionCode}`;
	const sectionRows = await db
		.select()
		.from(referenceSection)
		.where(and(eq(referenceSection.referenceId, referenceId), eq(referenceSection.code, fullCode)))
		.limit(1);
	const section = sectionRows[0];
	if (!section) throw new HandbookSectionNotFoundError({ referenceId, code: fullCode });

	// The chapter slot must be a real chapter row -- a level=section row
	// whose code happens to match `chapterCode` (e.g. `12.3` when the
	// caller passes a multi-dot path) is NOT a chapter and would render
	// the page with a section header pretending to be a chapter. Filtering
	// by `level=chapter` here also blocks the URL-aliasing pathological
	// case where two distinct (chapter, section) URL splits collide on
	// the same `fullCode`. See Wave 4 of library-by-cert.
	const chapterRows = await db
		.select()
		.from(referenceSection)
		.where(
			and(
				eq(referenceSection.referenceId, referenceId),
				eq(referenceSection.code, chapterCode),
				eq(referenceSection.level, REFERENCE_SECTION_LEVELS.CHAPTER),
			),
		)
		.limit(1);
	const chapter = chapterRows[0];
	if (!chapter) throw new HandbookSectionNotFoundError({ referenceId, code: chapterCode });

	const figures = await db
		.select()
		.from(referenceFigure)
		.where(eq(referenceFigure.sectionId, section.id))
		.orderBy(asc(referenceFigure.ordinal));

	const siblings = await db
		.select()
		.from(referenceSection)
		.where(eq(referenceSection.parentId, chapter.id))
		.orderBy(asc(referenceSection.ordinal));

	return { section, chapter, figures, siblings };
}

/**
 * Convenience: resolve a chapter row by code. Filters by `level=chapter`
 * so a section row whose code happens to match (e.g. `12.3` when the URL
 * is hand-typed as `/library/handbook/<slug>/12.3`) is NOT returned -- the
 * chapter page renders the chapter header from this row, and a section
 * row sitting in that slot would mislabel the page. See Wave 4 of
 * library-by-cert.
 */
export async function getHandbookChapter(
	referenceId: string,
	chapterCode: string,
	db: Db = defaultDb,
): Promise<ReferenceSectionRow> {
	const rows = await db
		.select()
		.from(referenceSection)
		.where(
			and(
				eq(referenceSection.referenceId, referenceId),
				eq(referenceSection.code, chapterCode),
				eq(referenceSection.level, REFERENCE_SECTION_LEVELS.CHAPTER),
			),
		)
		.limit(1);
	const row = rows[0];
	if (!row) throw new HandbookSectionNotFoundError({ referenceId, code: chapterCode });
	return row;
}

/** Figures bound to any reference_section row, ordered. */
export async function listFiguresForSection(sectionId: string, db: Db = defaultDb): Promise<ReferenceFigureRow[]> {
	return db
		.select()
		.from(referenceFigure)
		.where(eq(referenceFigure.sectionId, sectionId))
		.orderBy(asc(referenceFigure.ordinal));
}

// ---------------------------------------------------------------------------
// Reverse citation: nodes that cite this section
// ---------------------------------------------------------------------------

export interface CitingNodesQuery {
	/** Required. Limits to handbook citations against this reference id. */
	referenceId: string;
	/** When set, only matches citations whose `locator.chapter` equals this. */
	chapter?: number;
	/** When set (with `chapter`), only matches citations whose `locator.section` equals this. */
	section?: number;
}

/**
 * Walk `knowledge_node.references` looking for handbook citations that match
 * the given reference + locator. Two-stage filter:
 *
 * 1. JSONB containment probe `references @> ?::jsonb` with `kind=handbook`
 *    and `reference_id=<id>`. The GIN index keeps this bounded.
 * 2. In-memory locator filter on chapter / section. Cheap once the candidate
 *    set is bounded; sidesteps Postgres path-extraction operators that the
 *    `jsonb_path_ops` opclass doesn't support.
 *
 * Returns matching node rows. Order: title ascending so the citing-nodes
 * panel renders deterministically.
 */
export async function getNodesCitingSection(query: CitingNodesQuery, db: Db = defaultDb): Promise<KnowledgeNodeRow[]> {
	const probe = JSON.stringify([{ kind: REFERENCE_KINDS.HANDBOOK, reference_id: query.referenceId }]);
	const candidates = await db
		.select()
		.from(knowledgeNode)
		.where(sql`${knowledgeNode.references} @> ${probe}::jsonb`)
		.orderBy(asc(knowledgeNode.title));

	if (query.chapter === undefined) return candidates;

	return candidates.filter((node) => {
		const refs = node.references as unknown as Citation[];
		return refs.some((entry) => {
			if (!isHandbookCitation(entry)) return false;
			if (entry.reference_id !== query.referenceId) return false;
			if (entry.locator.chapter !== query.chapter) return false;
			if (query.section === undefined) return true;
			return entry.locator.section === query.section;
		});
	});
}

export interface CitingNodesBatchQuery {
	referenceId: string;
	chapter: number;
	sections: readonly number[];
}

/**
 * Batched counterpart to {@link getNodesCitingSection}: pull every node that
 * cites this `reference + chapter` once via the JSONB containment + GIN
 * index, then fan the result out per-section in memory.
 *
 * The single SQL query bounds the candidate set with the reference-id probe
 * (the same indexed predicate `getNodesCitingSection` uses); the per-section
 * filter is a JS pass over the bounded result. Sections with no citing
 * nodes are present in the output Map with an empty array so the caller can
 * render the "no citations" state without a missing-key check.
 *
 * Closes the per-row N+1 in
 * `apps/study/src/routes/(app)/lens/handbook/[doc]/[chapter]/+page.server.ts`
 * (one `getNodesCitingSection` call per section in the chapter).
 *
 * Empty `sections` short-circuits.
 */
export async function getNodesCitingSectionsBatch(
	query: CitingNodesBatchQuery,
	db: Db = defaultDb,
): Promise<Map<number, KnowledgeNodeRow[]>> {
	const out = new Map<number, KnowledgeNodeRow[]>();
	for (const s of query.sections) {
		out.set(s, []);
	}
	if (query.sections.length === 0) return out;

	const probe = JSON.stringify([{ kind: REFERENCE_KINDS.HANDBOOK, reference_id: query.referenceId }]);
	const candidates = await db
		.select()
		.from(knowledgeNode)
		.where(sql`${knowledgeNode.references} @> ${probe}::jsonb`)
		.orderBy(asc(knowledgeNode.title));

	const sectionSet = new Set<number>(query.sections);
	for (const node of candidates) {
		const refs = node.references as unknown as Citation[];
		const matchedSections = new Set<number>();
		for (const entry of refs) {
			if (!isHandbookCitation(entry)) continue;
			if (entry.reference_id !== query.referenceId) continue;
			if (entry.locator.chapter !== query.chapter) continue;
			const section = entry.locator.section;
			if (section === undefined) continue;
			if (!sectionSet.has(section)) continue;
			matchedSections.add(section);
		}
		for (const s of matchedSections) {
			const list = out.get(s);
			if (list !== undefined) list.push(node);
		}
	}

	return out;
}

// ---------------------------------------------------------------------------
// Citation URL resolver
// ---------------------------------------------------------------------------

/**
 * Resolve a structured citation to a URL.
 *
 * Routing rules:
 *
 * 1. Handbook citations resolve to the in-app handbook reader route
 *    (`ROUTES.LIBRARY_HANDBOOK_CHAPTER` or `ROUTES.LIBRARY_HANDBOOK_SECTION`).
 * 2. When `airboss_ref` is set, attempt the `@ab/sources` registry's
 *    per-corpus `getLiveUrl()`. This is the canonical resolution path for
 *    cross-corpus identifiers per ADR 019. Falls through to the
 *    kind-specific template on resolver miss so a misregistered identifier
 *    doesn't strand the user with no link at all.
 * 3. Otherwise dispatch on `kind` and use the per-kind URL template from
 *    `CITATION_URL_TEMPLATES`. Kinds without a useful per-locator deep link
 *    return the index URL; kinds with no public landing page (NTSB, POH,
 *    other, plus catastrophic missing-locator-data cases) return `null` so
 *    the UI can render the freeform note instead.
 *
 * Legacy freeform citations (no `kind` field) always return `null`.
 */
export function resolveCitationUrl(citation: Citation, references: ReadonlyArray<ReferenceRow>): string | null {
	if (!isStructuredCitation(citation)) return null;

	// Handbook citations are app-internal: they route to the in-app reader,
	// NOT to an FAA URL. The airboss_ref delegation deliberately runs AFTER
	// this handbook check so the in-app route wins for handbook reads.
	if (citation.kind === REFERENCE_KINDS.HANDBOOK) {
		return resolveHandbookCitationUrl(citation, references);
	}

	// `airboss_ref` is the canonical cross-corpus identifier per ADR 019.
	// Delegate when present; fall through on miss so a stale identifier
	// doesn't strand the user.
	if (citation.airboss_ref !== undefined) {
		const url = resolveAirbossRefUrl(citation.airboss_ref);
		if (url !== null) return url;
	}

	switch (citation.kind) {
		case REFERENCE_KINDS.CFR: {
			const { title, part, section } = citation.locator;
			return CITATION_URL_TEMPLATES.CFR(title, part, section);
		}
		case REFERENCE_KINDS.AC:
			return CITATION_URL_TEMPLATES.AC_INDEX;
		case REFERENCE_KINDS.ACS:
		case REFERENCE_KINDS.PTS:
			return CITATION_URL_TEMPLATES.ACS_INDEX;
		case REFERENCE_KINDS.AIM:
			return CITATION_URL_TEMPLATES.AIM_INDEX;
		case REFERENCE_KINDS.PCG:
			return CITATION_URL_TEMPLATES.PCG_INDEX;
		case REFERENCE_KINDS.NTSB:
		case REFERENCE_KINDS.POH:
		case REFERENCE_KINDS.OTHER:
			return null;
		default: {
			const exhaustive: never = citation;
			void exhaustive;
			return null;
		}
	}
}

/**
 * Handbook-citation routing. Extracted so the main switch in
 * {@link resolveCitationUrl} stays a single line per kind.
 */
function resolveHandbookCitationUrl(
	citation: Extract<StructuredCitation, { kind: 'handbook' }>,
	references: ReadonlyArray<ReferenceRow>,
): string | null {
	const ref = references.find((r) => r.id === citation.reference_id);
	if (!ref) return null;
	const { chapter, section } = citation.locator;
	if (section === undefined) return ROUTES.LIBRARY_HANDBOOK_CHAPTER(ref.documentSlug, chapter);
	return ROUTES.LIBRARY_HANDBOOK_SECTION(ref.documentSlug, chapter, section);
}

/**
 * Parse an `airboss-ref:` identifier and dispatch to its corpus resolver's
 * `getLiveUrl()`. Returns `null` when the identifier is malformed, the corpus
 * has no registered resolver, or the resolver itself returns null.
 *
 * Edition pin defaults to the empty string when no `?at=` is present; the
 * per-corpus resolver decides what to do with that. Most resolvers (handbooks,
 * acs) ignore the edition for the live URL; regs uses it for eCFR pinning.
 */
function resolveAirbossRefUrl(ref: string): string | null {
	const parsed = parseIdentifier(ref);
	if (isParseError(parsed)) return null;
	const resolver = getCorpusResolver(parsed.corpus);
	if (resolver === null) return null;
	return resolver.getLiveUrl(parsed.raw as SourceId, parsed.pin ?? '');
}

// ---------------------------------------------------------------------------
// Citation rendering resolver (ADR 019 amendment 2026-05 step 5)
// ---------------------------------------------------------------------------

/**
 * Citation as the knowledge-node renderer needs it: registry-resolved title
 * and edition (so the card shows "Airplane Flying Handbook", not "Handbook"),
 * plus the existing URL routing and the optional sentinel locator captured by
 * the new `ref:` shape.
 *
 * `kind` -- the family discriminator (handbook/cfr/...) when known. Drives
 * icon choice on the renderer; preserved across all three input shapes.
 *
 * `title` -- the registry's `reference.title`. Empty string when the citation
 * isn't resolvable to a registry row (legacy freeform, an unknown handbook
 * slug, a corpus we don't yet resolve). The renderer falls back to the
 * citation's own `source` text in that case.
 *
 * `edition` -- the resolved edition tag ("FAA-H-8083-3C", "2024-08-22").
 * Empty string when the citation didn't pin one and the registry has no
 * current edition for the slug.
 *
 * `locatorLabel` -- the chapter/section/page text the renderer puts under
 * the title. Filled from sentinel fields on the new ref-shape (e.g.
 * `chapter_title: Basic Flight Maneuvers`), from `detail` on legacy
 * citations, or formatted from the typed `StructuredCitation` locator.
 *
 * `isPriorEdition` -- true when the citation pinned an explicit edition AND
 * that edition is older than the current one. The renderer annotates with
 * the pinned edition slug so the reader sees the difference.
 *
 * `pinnedEditionSlug` -- the literal pinned edition tag when
 * `isPriorEdition` is true; null otherwise. Surfaced as "(FAA-H-8083-3B)"
 * style annotation.
 *
 * `note` -- the citation's optional commentary, preserved verbatim.
 *
 * `redirectedFrom` -- the original `airboss-ref:` URI captured on the
 * structured citation when a human override moved the citation across
 * editions, chapters, or books (the well-known non-sentinel field
 * introduced in ADR 019 amendment 2026-05 §2). Null on legacy and in-type
 * structured shapes; non-null on `ref:`-shape citations whose YAML carried
 * a `redirected_from:` line. The renderer surfaces this as a small
 * annotation under the citation title, mirroring the prior-edition
 * annotation pattern.
 *
 * `resolvedUrl` -- the in-app deep link or external URL via
 * {@link resolveCitationUrl}. Null for citations the URL resolver can't yet
 * route (legacy freeform, future corpora).
 *
 * `broken` -- structured handbook citation whose registry lookup missed.
 * The renderer flags as "(citation broken)".
 *
 * `fallbackLabel` -- the citation's own free-text label (legacy `source`
 * field) or the raw `ref:` URI for unresolvable structured citations. The
 * renderer uses this only when `title` is empty, so a broken or future-
 * corpus citation still renders something readable.
 */
export interface ResolvedCitation {
	readonly kind: string | null;
	readonly title: string;
	readonly edition: string;
	readonly locatorLabel: string;
	readonly isPriorEdition: boolean;
	readonly pinnedEditionSlug: string | null;
	readonly note: string;
	readonly redirectedFrom: string | null;
	readonly resolvedUrl: string | null;
	readonly broken: boolean;
	readonly fallbackLabel: string;
}

/**
 * Build a slug -> latest {@link ReferenceRow} index. Used by the new
 * ref-shape resolver to find the current edition when the citation doesn't
 * pin one (the amendment §1 default).
 *
 * Picks the lex-greatest edition string per slug. Pre-ADR-026 this also
 * filtered `row.supersededById !== null`; that column is gone, and the
 * registry-driven supersession is checked at SQL time before rows reach this
 * helper. Callers that want active-only rows must already be filtering at
 * the DB layer (`listReferences({ includeSuperseded: false })` -- the
 * default).
 */
function indexCurrentByDocumentSlug(references: ReadonlyArray<ReferenceRow>): Map<string, ReferenceRow> {
	const map = new Map<string, ReferenceRow>();
	for (const row of references) {
		const existing = map.get(row.documentSlug);
		// Deterministic pick when multiple rows exist for one slug: prefer the
		// lexicographically larger edition tag, matching the ORDER BY edition
		// DESC in `getReferenceByDocument`.
		if (existing === undefined || row.edition > existing.edition) {
			map.set(row.documentSlug, row);
		}
	}
	return map;
}

/** Build a `(slug, edition) -> ReferenceRow` index. Used for pinned citations. */
function indexBySlugAndEdition(references: ReadonlyArray<ReferenceRow>): Map<string, ReferenceRow> {
	const map = new Map<string, ReferenceRow>();
	for (const row of references) {
		map.set(`${row.documentSlug}::${row.edition}`, row);
	}
	return map;
}

interface RefShape {
	readonly ref: string;
	readonly note?: unknown;
	readonly quote?: unknown;
	readonly chapter_title?: unknown;
	readonly section_title?: unknown;
	readonly paragraph_text?: unknown;
	readonly page_heading?: unknown;
	readonly redirected_from?: unknown;
}

function isRefShape(value: unknown): value is RefShape {
	return typeof value === 'object' && value !== null && typeof (value as RefShape).ref === 'string';
}

function isLegacyShape(value: unknown): value is { source: string; detail?: string; note?: string } {
	if (typeof value !== 'object' || value === null) return false;
	const v = value as { source?: unknown };
	return typeof v.source === 'string';
}

function pickSentinelLabel(value: RefShape): string {
	if (typeof value.chapter_title === 'string' && value.chapter_title.length > 0) return value.chapter_title;
	if (typeof value.section_title === 'string' && value.section_title.length > 0) return value.section_title;
	if (typeof value.paragraph_text === 'string' && value.paragraph_text.length > 0) return value.paragraph_text;
	if (typeof value.page_heading === 'string' && value.page_heading.length > 0) return value.page_heading;
	return '';
}

/**
 * Resolve the new `ref:`-shape citation (amendment 2026-05 §1) against the
 * registry. Returns title/edition/url/locator triples wired through the
 * existing resolveCitationUrl pipeline.
 *
 * v1 only resolves the `handbooks` corpus to a registry row. Other corpora
 * resolve to a URL via the existing per-corpus `getLiveUrl()` but render
 * with an empty title; the renderer falls back to the URI's corpus literal.
 * Per-corpus title resolution lands as those corpus WPs ship.
 */
function resolveRefShapeCitation(
	value: RefShape,
	allReferences: ReadonlyArray<ReferenceRow>,
	currentBySlug: Map<string, ReferenceRow>,
	bySlugEdition: Map<string, ReferenceRow>,
): ResolvedCitation {
	const note = typeof value.note === 'string' ? value.note : '';
	const locatorLabel = pickSentinelLabel(value);
	// `redirected_from` is the well-known non-sentinel field per ADR 019
	// amendment 2026-05 §2: the original airboss-ref URI before a human
	// override moved this citation. The renderer surfaces it as a small
	// annotation; we propagate the string verbatim so the formatter at the
	// edge can decide how to humanise it (e.g. "FAA-H-8083-3B Ch. 4").
	const redirectedFrom =
		typeof value.redirected_from === 'string' && value.redirected_from.length > 0 ? value.redirected_from : null;
	const parsed = parseIdentifier(value.ref);
	if (isParseError(parsed)) {
		return {
			kind: null,
			title: '',
			edition: '',
			locatorLabel,
			isPriorEdition: false,
			pinnedEditionSlug: null,
			note,
			redirectedFrom,
			resolvedUrl: null,
			broken: true,
			fallbackLabel: value.ref,
		};
	}

	// Handbooks corpus: extract slug + optional edition from the locator path
	// using the registry-aware predicate per amendment §1 path-grammar
	// disambiguation.
	if (parsed.corpus === 'handbooks') {
		const segments = parsed.locator.split('/');
		const slug = segments[0] ?? '';
		const candidate = segments[1] ?? '';
		const candidateRow = bySlugEdition.get(`${slug}::${candidate}`);
		const pinnedEdition = candidateRow !== undefined ? candidate : '';
		const currentRow = currentBySlug.get(slug) ?? null;
		const resolvedRow = pinnedEdition !== '' ? (candidateRow ?? null) : currentRow;
		const isPriorEdition =
			pinnedEdition !== '' && currentRow !== null && resolvedRow !== null && resolvedRow.id !== currentRow.id;
		const url =
			resolvedRow !== null
				? (resolveAirbossRefUrl(value.ref) ??
					buildHandbookUrlFallback(resolvedRow.documentSlug, segments, pinnedEdition !== ''))
				: null;
		return {
			kind: REFERENCE_KINDS.HANDBOOK,
			title: resolvedRow?.title ?? '',
			edition: resolvedRow?.edition ?? '',
			locatorLabel,
			isPriorEdition,
			pinnedEditionSlug: isPriorEdition ? pinnedEdition : null,
			note,
			redirectedFrom,
			resolvedUrl: url,
			broken: resolvedRow === null,
			fallbackLabel: value.ref,
		};
	}

	// Other corpora: defer to the per-corpus live-URL resolver. Title comes
	// from the registry once those corpus resolvers ship.
	const url = resolveAirbossRefUrl(value.ref);
	void allReferences;
	return {
		kind: parsed.corpus,
		title: '',
		edition: parsed.pin ?? '',
		locatorLabel,
		isPriorEdition: false,
		pinnedEditionSlug: null,
		note,
		redirectedFrom,
		resolvedUrl: url,
		broken: false,
		fallbackLabel: value.ref,
	};
}

/**
 * Build the in-app handbook URL from a parsed handbooks locator. Used as a
 * fallback when {@link resolveAirbossRefUrl} returns null (the per-corpus
 * resolver returned the doc-level live URL, but the in-app reader has a
 * deeper deep-link).
 */
function buildHandbookUrlFallback(
	documentSlug: string,
	segments: ReadonlyArray<string>,
	editionConsumed: boolean,
): string | null {
	const tailStart = editionConsumed ? 2 : 1;
	const chapterSegment = segments[tailStart];
	if (chapterSegment === undefined || !/^\d+$/.test(chapterSegment)) return null;
	const chapter = Number(chapterSegment);
	const sectionSegment = segments[tailStart + 1];
	if (sectionSegment === undefined) return ROUTES.LIBRARY_HANDBOOK_CHAPTER(documentSlug, chapter);
	if (!/^\d+$/.test(sectionSegment)) return ROUTES.LIBRARY_HANDBOOK_CHAPTER(documentSlug, chapter);
	return ROUTES.LIBRARY_HANDBOOK_SECTION(documentSlug, chapter, Number(sectionSegment));
}

/**
 * Format the locator portion of a typed structured citation (the in-type
 * `StructuredCitation` discriminated union, distinct from the new `ref:`
 * shape). Mirrors the renderer's prior inline logic so legacy structured
 * rows in the DB keep rendering correctly.
 */
function formatStructuredLocator(citation: StructuredCitation): string {
	switch (citation.kind) {
		case REFERENCE_KINDS.HANDBOOK: {
			const parts: string[] = [`Ch. ${citation.locator.chapter}`];
			if (citation.locator.section !== undefined) parts.push(`§${citation.locator.section}`);
			if (citation.locator.subsection !== undefined) parts.push(`.${citation.locator.subsection}`);
			if (citation.locator.page_start !== undefined && citation.locator.page_start.length > 0) {
				const pages =
					citation.locator.page_end !== undefined && citation.locator.page_end.length > 0
						? `pp. ${citation.locator.page_start}..${citation.locator.page_end}`
						: `p. ${citation.locator.page_start}`;
				parts.push(`(${pages})`);
			}
			return parts.join(' ');
		}
		case REFERENCE_KINDS.CFR:
			return `${citation.locator.title} CFR ${citation.locator.part}.${citation.locator.section}`;
		case REFERENCE_KINDS.AC:
			return citation.locator.paragraph !== undefined ? `¶${citation.locator.paragraph}` : '';
		case REFERENCE_KINDS.ACS:
		case REFERENCE_KINDS.PTS: {
			const parts: string[] = [];
			if (citation.locator.area !== undefined) parts.push(`Area ${citation.locator.area}`);
			if (citation.locator.task !== undefined) parts.push(`Task ${citation.locator.task}`);
			if (citation.locator.element !== undefined) parts.push(`Element ${citation.locator.element}`);
			return parts.join(', ');
		}
		case REFERENCE_KINDS.AIM:
			return citation.locator.paragraph !== undefined ? `¶${citation.locator.paragraph}` : '';
		case REFERENCE_KINDS.PCG:
			return citation.locator.term ?? '';
		case REFERENCE_KINDS.NTSB:
		case REFERENCE_KINDS.POH:
		case REFERENCE_KINDS.OTHER:
			return citation.locator.detail ?? '';
		default:
			return '';
	}
}

/**
 * Resolve every citation in `rawCitations` to a {@link ResolvedCitation}.
 * The JSONB column accepts three shapes today (legacy freeform, in-type
 * structured-with-`kind`, new `ref:`-shape from amendment 2026-05); this
 * function normalises all three so the renderer reads one structure.
 *
 * Pure: no DB calls. Pass the full reference table (or a subset including
 * superseded rows when prior-edition citations may resolve back).
 */
export function resolveCitationsForRender(
	rawCitations: ReadonlyArray<unknown>,
	references: ReadonlyArray<ReferenceRow>,
): ResolvedCitation[] {
	const currentBySlug = indexCurrentByDocumentSlug(references);
	const bySlugEdition = indexBySlugAndEdition(references);
	const out: ResolvedCitation[] = [];

	for (const value of rawCitations) {
		// Shape 1: new ref-shape (amendment 2026-05 §2). Discriminated by the
		// presence of a `ref` string field.
		if (isRefShape(value)) {
			out.push(resolveRefShapeCitation(value, references, currentBySlug, bySlugEdition));
			continue;
		}

		// Shape 2: in-type structured citation with `kind` discriminator. Pre-
		// amendment authoring path; still present in the DB until migration
		// (step 6) runs.
		if (typeof value === 'object' && value !== null && typeof (value as { kind?: unknown }).kind === 'string') {
			const citation = value as Citation;
			if (isStructuredCitation(citation)) {
				const locatorLabel = formatStructuredLocator(citation);
				const url = resolveCitationUrl(citation, references);
				const row = references.find((r) => r.id === citation.reference_id) ?? null;
				const broken = isHandbookCitation(citation) ? row === null : false;
				out.push({
					kind: citation.kind,
					title: row?.title ?? '',
					edition: row?.edition ?? '',
					locatorLabel,
					isPriorEdition: false,
					pinnedEditionSlug: null,
					note: citation.note ?? '',
					redirectedFrom: null,
					resolvedUrl: url,
					broken,
					fallbackLabel: citation.reference_id,
				});
				continue;
			}
		}

		// Shape 3: legacy freeform.
		if (isLegacyShape(value)) {
			const detail = typeof value.detail === 'string' ? value.detail : '';
			const legacyNote = typeof value.note === 'string' ? value.note : '';
			out.push({
				kind: null,
				title: value.source,
				edition: '',
				locatorLabel: detail,
				isPriorEdition: false,
				pinnedEditionSlug: null,
				note: legacyNote,
				redirectedFrom: null,
				resolvedUrl: null,
				broken: false,
				fallbackLabel: value.source,
			});
			continue;
		}

		// Unrecognised shape -- render an inert row so the page doesn't crash.
		out.push({
			kind: null,
			title: '',
			edition: '',
			locatorLabel: '',
			isPriorEdition: false,
			pinnedEditionSlug: null,
			note: '',
			redirectedFrom: null,
			resolvedUrl: null,
			broken: true,
			fallbackLabel: '',
		});
	}

	return out;
}

// ---------------------------------------------------------------------------
// Open-warnings reader (WP-HANDBOOK-RE-EXTRACTION-V2 Phase 3)
// ---------------------------------------------------------------------------

/**
 * One open warning surfaced to the hangar warning-triage dashboard.
 *
 * "Open" = the warning exists in `warnings.json` AND its `id` is either
 * absent from `warnings-triage.json` OR carries `status: 'open'`. Closed
 * triage states (`wontfix`, `fixed`, `duplicate`) are filtered out by the
 * reader so the dashboard only sees what still needs attention.
 *
 * `triage_note` is the optional reviewer note from the triage file; it
 * survives even on `open` decisions (e.g. "investigating", "blocked on
 * extractor change") so the dashboard can render context next to the row.
 */
export interface OpenWarning {
	readonly id: string;
	readonly code: HandbookManifestWarningCode;
	readonly section_code: string | null;
	readonly message: string;
	readonly triage_note?: string;
}

/**
 * Thrown by {@link getOpenWarningsForReference} when the triage file's
 * `manifest_sha256` does not match the digest recorded on the live
 * `warnings.json`. The triage decisions were made against an older
 * extraction; the dashboard surfaces a "manifest drift" prompt and asks
 * the reviewer to re-triage rather than silently applying decisions whose
 * underlying warning text may have moved.
 */
export class StaleWarningsTriageError extends Error {
	constructor(
		public readonly referenceId: string,
		public readonly expectedManifestSha: string,
		public readonly recordedManifestSha: string,
	) {
		super(
			`Stale warnings triage for reference ${referenceId}: ` +
				`triage file recorded manifest_sha256=${recordedManifestSha}, warnings.json reports ${expectedManifestSha}. ` +
				`Re-triage required after re-extraction.`,
		);
		this.name = 'StaleWarningsTriageError';
	}
}

type NodeFs = {
	existsSync: (p: string) => boolean;
	readFileSync: (p: string, encoding: 'utf-8') => string;
};
type NodePath = { join: (...parts: string[]) => string };

let cachedFs: NodeFs | null = null;
let cachedPath: NodePath | null = null;

type GetBuiltinModule = (spec: string) => unknown;

/**
 * Lazy-load Node built-ins so this module stays browser-bundle safe.
 * `libs/bc/study` is hoisted into the SvelteKit client bundle by the BC
 * barrel; a top-level `import 'node:fs'` would crash the dev server with
 * a Vite externalization error. Mirrors `libs/constants/src/source-cache.ts`.
 */
function loadBuiltin<T>(spec: string): T {
	const proc = (typeof process !== 'undefined' ? process : undefined) as
		| (NodeJS.Process & { getBuiltinModule?: GetBuiltinModule })
		| undefined;
	const getBuiltin = proc?.getBuiltinModule;
	if (typeof getBuiltin !== 'function') {
		throw new Error(`references: ${spec} unavailable in this runtime (no process.getBuiltinModule)`);
	}
	return getBuiltin(spec) as T;
}

function nodeFs(): NodeFs {
	if (!cachedFs) cachedFs = loadBuiltin<NodeFs>('node:fs');
	return cachedFs;
}

function nodePath(): NodePath {
	if (!cachedPath) cachedPath = loadBuiltin<NodePath>('node:path');
	return cachedPath;
}

/**
 * Resolve the on-disk `warnings.json` path for a reference row.
 *
 * Dispatches on `reference.kind`:
 *
 * - `handbook` -> `handbooks/<documentSlug>/<edition>/warnings.json`. Same
 *    layout for sectioned (PHAK / AFH / AVWX / IFH / IPH / RMH / AIH) and
 *    whole-doc handbooks; the manifest discriminator differs but the
 *    sibling `warnings.json` lives at the same path.
 * - `ac`       -> `ac/<doc_slug>/<revision>/warnings.json` per WP-AC-V2
 *    conformance shim. The reverse lookup goes through
 *    {@link getAcSeedMappingByReference} so AC reference rows resolve to
 *    the on-disk locator regardless of edition string casing.
 *
 * Other kinds return null today; the reader treats null as "no warnings
 * surface" (zero open warnings, no error). When future corpora gain
 * triage warnings, extend this dispatch.
 */
function warningsJsonRelPath(referenceRow: ReferenceRow): string | null {
	if (referenceRow.kind === REFERENCE_KINDS.HANDBOOK) {
		return `handbooks/${referenceRow.documentSlug}/${referenceRow.edition}/warnings.json`;
	}
	if (referenceRow.kind === REFERENCE_KINDS.AC) {
		const mapping = getAcSeedMappingByReference(referenceRow.documentSlug, referenceRow.edition);
		if (mapping === null) return null;
		return `ac/${mapping.docSlug}/${mapping.revision}/warnings.json`;
	}
	return null;
}

/**
 * Resolve the triage file path for a reference row. Mirrors the
 * `warnings.json` dispatch but rooted under `validation/` and pinned
 * to the corpus directory keyed off `reference.kind`.
 */
function warningsTriageJsonRelPath(referenceRow: ReferenceRow): string | null {
	if (referenceRow.kind === REFERENCE_KINDS.HANDBOOK) {
		return `validation/handbooks/${referenceRow.documentSlug}/${referenceRow.edition}/warnings-triage.json`;
	}
	if (referenceRow.kind === REFERENCE_KINDS.AC) {
		const mapping = getAcSeedMappingByReference(referenceRow.documentSlug, referenceRow.edition);
		if (mapping === null) return null;
		return `validation/ac/${mapping.docSlug}/${mapping.revision}/warnings-triage.json`;
	}
	return null;
}

export interface GetOpenWarningsOptions {
	/**
	 * Filesystem root for the repo. Defaults to `process.cwd()`. Tests pass
	 * an absolute path under `tmpdir()` so they can stage fixture
	 * `warnings.json` + `warnings-triage.json` files without touching the
	 * real derivative trees.
	 */
	repoRoot?: string;
}

/**
 * Read the open (untriaged or `status: 'open'`) warnings for a reference.
 *
 * Reads two files from disk:
 *
 *   1. `<corpus>/<doc>/<edition>/warnings.json`         (extractor-emitted)
 *   2. `validation/<corpus>/<doc>/<edition>/warnings-triage.json`  (reviewer-curated)
 *
 * Behavior:
 *
 * - When `warnings.json` is absent: returns `[]`. The corpus has not been
 *   re-extracted under the v2 substrate yet (or the corpus has no warning
 *   surface, e.g. CFR / SAFO / InFO).
 * - When the triage file is absent: every warning surfaces as `open`.
 * - When the triage file is present and `manifest_sha256` matches: returns
 *   only warnings whose triage status is `open` (or untriaged). Triage
 *   notes ride along on the result so the dashboard can render context.
 * - When the triage file is present but `manifest_sha256` differs from the
 *   live `warnings.json`: throws {@link StaleWarningsTriageError}. The
 *   dashboard prompts the reviewer to re-triage; the reader refuses to
 *   apply potentially-irrelevant decisions silently.
 *
 * Pure read; no DB writes. Server-only (uses `node:fs` lazily; safe to
 * import from the browser bundle but never executed there).
 */
export async function getOpenWarningsForReference(
	referenceId: string,
	options: GetOpenWarningsOptions = {},
	db: Db = defaultDb,
): Promise<OpenWarning[]> {
	const referenceRow = await getReferenceById(referenceId, db);
	const warningsRel = warningsJsonRelPath(referenceRow);
	if (warningsRel === null) return [];

	const repoRoot = options.repoRoot ?? process.cwd();
	const fs = nodeFs();
	const path = nodePath();

	const warningsAbs = path.join(repoRoot, warningsRel);
	if (!fs.existsSync(warningsAbs)) return [];

	const warningsRaw = fs.readFileSync(warningsAbs, 'utf-8');
	const warningsParsed = handbookWarningsFileSchema.parse(JSON.parse(warningsRaw));

	const triageRel = warningsTriageJsonRelPath(referenceRow);
	let triage: Map<string, { status: HandbookWarningTriageStatus; note?: string }> | null = null;
	if (triageRel !== null) {
		const triageAbs = path.join(repoRoot, triageRel);
		if (fs.existsSync(triageAbs)) {
			const triageRaw = fs.readFileSync(triageAbs, 'utf-8');
			const triageParsed = handbookWarningsTriageFileSchema.parse(JSON.parse(triageRaw));
			if (triageParsed.manifest_sha256.toLowerCase() !== warningsParsed.manifest_sha256.toLowerCase()) {
				throw new StaleWarningsTriageError(referenceId, warningsParsed.manifest_sha256, triageParsed.manifest_sha256);
			}
			triage = new Map();
			for (const [warningId, entry] of Object.entries(triageParsed.triage)) {
				triage.set(warningId, { status: entry.status, note: entry.note });
			}
		}
	}

	const out: OpenWarning[] = [];
	for (const w of warningsParsed.warnings) {
		const triageEntry = triage?.get(w.id);
		// Untriaged or explicitly `open` -> surface it. `wontfix` / `fixed` /
		// `duplicate` -> drop it; the dashboard's open queue ignores closed rows.
		if (triageEntry !== undefined && triageEntry.status !== 'open') continue;
		const open: OpenWarning = {
			id: w.id,
			code: w.code,
			section_code: w.section_code ?? null,
			message: w.message,
			...(triageEntry?.note !== undefined ? { triage_note: triageEntry.note } : {}),
		};
		out.push(open);
	}
	return out;
}

// ---------------------------------------------------------------------------
// Read state -- read paths
// ---------------------------------------------------------------------------

/** Fetch the read-state row for a (user, section) pair. Returns null when none exists. */
export async function getReadState(
	userId: string,
	referenceSectionId: string,
	db: Db = defaultDb,
): Promise<ReferenceSectionReadStateRow | null> {
	const rows = await db
		.select()
		.from(referenceSectionReadState)
		.where(
			and(
				eq(referenceSectionReadState.userId, userId),
				eq(referenceSectionReadState.referenceSectionId, referenceSectionId),
			),
		)
		.limit(1);
	return rows[0] ?? null;
}

/**
 * Bulk fetch every read-state row for one user across one reference. Powers
 * the flightbag's TOC drawer checkmark column -- we render the entire
 * reading order, so loading per-section state via {@link getReadState} would
 * fan out N round-trips per page render.
 *
 * One round-trip: inner-join on `reference_section.reference_id = $1` so the
 * filter happens in Postgres. Returns the rows the user has any state for;
 * sections the user has never opened produce no row (the caller treats
 * absence as "unread").
 */
export async function listReadStatesForReference(
	userId: string,
	referenceId: string,
	db: Db = defaultDb,
): Promise<ReferenceSectionReadStateRow[]> {
	return db
		.select({
			userId: referenceSectionReadState.userId,
			referenceSectionId: referenceSectionReadState.referenceSectionId,
			status: referenceSectionReadState.status,
			comprehended: referenceSectionReadState.comprehended,
			lastReadAt: referenceSectionReadState.lastReadAt,
			openedCount: referenceSectionReadState.openedCount,
			totalSecondsVisible: referenceSectionReadState.totalSecondsVisible,
			notesMd: referenceSectionReadState.notesMd,
			seedOrigin: referenceSectionReadState.seedOrigin,
			createdAt: referenceSectionReadState.createdAt,
			updatedAt: referenceSectionReadState.updatedAt,
		})
		.from(referenceSectionReadState)
		.innerJoin(referenceSection, eq(referenceSectionReadState.referenceSectionId, referenceSection.id))
		.where(and(eq(referenceSectionReadState.userId, userId), eq(referenceSection.referenceId, referenceId)));
}

export interface HandbookProgressSummary {
	totalSections: number;
	readSections: number;
	readingSections: number;
	unreadSections: number;
	comprehendedSections: number;
}

/**
 * Batched counterpart to {@link getHandbookProgress}: per-(user, reference)
 * progress summaries for an arbitrary set of reference ids in two queries
 * (one COUNT-by-reference for total sections, one read-state aggregate),
 * keyed back to the input by `referenceId`.
 *
 * Closes the per-row N+1 in
 * `apps/study/src/routes/(app)/lens/handbook/+page.server.ts` (one
 * `getHandbookProgress` call per handbook).
 *
 * Missing reference ids show up in the Map with the zero summary
 * (`{ totalSections: 0, ... }`), matching the per-row helper's behaviour for
 * a reference that has no `reference_section` rows yet. Empty input
 * short-circuits.
 */
export async function getHandbookProgressMap(
	userId: string,
	referenceIds: readonly string[],
	db: Db = defaultDb,
): Promise<Map<string, HandbookProgressSummary>> {
	const out = new Map<string, HandbookProgressSummary>();
	if (referenceIds.length === 0) return out;
	const ids = referenceIds as string[];

	const [totalsRows, readStateRows] = await Promise.all([
		db
			.select({
				referenceId: referenceSection.referenceId,
				total: sql<number>`count(*)::int`,
			})
			.from(referenceSection)
			.where(
				and(
					inArray(referenceSection.referenceId, ids),
					sql`${referenceSection.level} <> ${REFERENCE_SECTION_LEVELS.CHAPTER}`,
				),
			)
			.groupBy(referenceSection.referenceId),
		db
			.select({
				referenceId: referenceSection.referenceId,
				status: referenceSectionReadState.status,
				comprehended: referenceSectionReadState.comprehended,
			})
			.from(referenceSectionReadState)
			.innerJoin(referenceSection, eq(referenceSectionReadState.referenceSectionId, referenceSection.id))
			.where(and(eq(referenceSectionReadState.userId, userId), inArray(referenceSection.referenceId, ids))),
	]);

	const totalsByRef = new Map<string, number>();
	for (const row of totalsRows) {
		totalsByRef.set(row.referenceId, Number(row.total ?? 0));
	}

	const summaryByRef = new Map<string, { read: number; reading: number; comprehended: number }>();
	for (const row of readStateRows) {
		const acc = summaryByRef.get(row.referenceId) ?? { read: 0, reading: 0, comprehended: 0 };
		if (row.status === HANDBOOK_READ_STATUSES.READ) acc.read += 1;
		else if (row.status === HANDBOOK_READ_STATUSES.READING) acc.reading += 1;
		if (row.comprehended) acc.comprehended += 1;
		summaryByRef.set(row.referenceId, acc);
	}

	for (const id of ids) {
		const totalSections = totalsByRef.get(id) ?? 0;
		const acc = summaryByRef.get(id) ?? { read: 0, reading: 0, comprehended: 0 };
		const unreadSections = Math.max(0, totalSections - acc.read - acc.reading);
		out.set(id, {
			totalSections,
			readSections: acc.read,
			readingSections: acc.reading,
			unreadSections,
			comprehendedSections: acc.comprehended,
		});
	}

	return out;
}

/**
 * Per-(user, reference) progress summary used on the handbook overview card.
 * Counts every non-chapter row as a section -- chapters are scaffolding, not
 * content, so coverage is computed against the leaf-bearing rows.
 */
export async function getHandbookProgress(
	userId: string,
	referenceId: string,
	db: Db = defaultDb,
): Promise<HandbookProgressSummary> {
	// Two independent reads -- total-section count and per-user read state.
	// Fan out in parallel to halve the page-build latency on the lens index
	// where this helper is invoked once per handbook.
	const [totalsRow, readStateRows] = await Promise.all([
		db
			.select({ total: sql<number>`count(*)::int` })
			.from(referenceSection)
			.where(
				and(
					eq(referenceSection.referenceId, referenceId),
					sql`${referenceSection.level} <> ${REFERENCE_SECTION_LEVELS.CHAPTER}`,
				),
			),
		db
			.select({
				status: referenceSectionReadState.status,
				comprehended: referenceSectionReadState.comprehended,
			})
			.from(referenceSectionReadState)
			.innerJoin(referenceSection, eq(referenceSectionReadState.referenceSectionId, referenceSection.id))
			.where(and(eq(referenceSectionReadState.userId, userId), eq(referenceSection.referenceId, referenceId))),
	]);
	const totalSections = totalsRow[0]?.total ?? 0;

	let readSections = 0;
	let readingSections = 0;
	let comprehendedSections = 0;
	for (const row of readStateRows) {
		if (row.status === HANDBOOK_READ_STATUSES.READ) readSections += 1;
		else if (row.status === HANDBOOK_READ_STATUSES.READING) readingSections += 1;
		if (row.comprehended) comprehendedSections += 1;
	}
	const unreadSections = Math.max(0, totalSections - readSections - readingSections);
	return { totalSections, readSections, readingSections, unreadSections, comprehendedSections };
}

/**
 * Bulk readability probe over a set of references. Returns the set of
 * reference ids that have at least one `reference_section` row with non-empty
 * body content -- the criterion the library spines use to flag "Read in-app"
 * cards.
 *
 * Probes `content_md` directly rather than naming a level (the pre-WP-SUB
 * probe filtered `level <> 'chapter'`, which baked the handbook hierarchy
 * into the library page). The new probe works for sectioned handbooks
 * (chapter rows have empty `content_md`, child sections carry the body),
 * whole-doc handbooks (one `level: 'document'` row carries the body), CFR
 * (paragraph rows carry the body, Subpart rows are containers), and any
 * future corpus that follows the same "container vs leaf" pattern.
 *
 * Single query so the `/library` spine loaders make one round-trip per N
 * references rather than N. Empty input short-circuits so callers don't
 * have to. The `reference_section_readable_idx` partial index keeps this
 * O(log N) on a sparse predicate.
 */
export async function getReadableReferenceIds(
	referenceIds: readonly string[],
	db: Db = defaultDb,
): Promise<Set<string>> {
	if (referenceIds.length === 0) return new Set();
	const rows = await db
		.selectDistinct({ referenceId: referenceSection.referenceId })
		.from(referenceSection)
		.where(and(inArray(referenceSection.referenceId, [...referenceIds]), sql`${referenceSection.contentMd} <> ''`));
	return new Set(rows.map((r) => r.referenceId));
}

// ---------------------------------------------------------------------------
// Read state -- write paths
// ---------------------------------------------------------------------------

/**
 * Set the explicit read status for a (user, section) pair. Upserts the row
 * (composite PK is `(user_id, reference_section_id)`). Updates `last_read_at`
 * on every write so the dashboard's "recent reads" lens stays current.
 *
 * Allowed transitions: any of unread / reading / read. The system never
 * automatically advances to `read`; users do that explicitly via this entry.
 */
export async function setReadStatus(
	userId: string,
	referenceSectionId: string,
	status: HandbookReadStatus,
	db: Db = defaultDb,
): Promise<ReferenceSectionReadStateRow> {
	const insert = {
		userId,
		referenceSectionId,
		status,
		comprehended: false,
		lastReadAt: new Date(),
		openedCount: 0,
		totalSecondsVisible: 0,
		notesMd: '',
	} satisfies Omit<ReferenceSectionReadStateRow, 'createdAt' | 'updatedAt' | 'seedOrigin'> & {
		seedOrigin?: string | null;
	};

	const rows = await db
		.insert(referenceSectionReadState)
		.values(insert)
		.onConflictDoUpdate({
			target: [referenceSectionReadState.userId, referenceSectionReadState.referenceSectionId],
			set: {
				status,
				lastReadAt: new Date(),
				updatedAt: new Date(),
			},
		})
		.returning();

	const row = rows[0];
	if (!row) throw new HandbookValidationError('setReadStatus: upsert returned no row');
	return row;
}

/**
 * Toggle the "read but didn't get it" flag. Disallowed when the row is
 * `unread` -- the toggle is meaningless without at least one read pass.
 *
 * The disallow is enforced here rather than at the DB layer because Postgres
 * CHECK constraints can't reference both the new and the existing value of
 * the same column atomically.
 */
export async function setComprehended(
	userId: string,
	referenceSectionId: string,
	comprehended: boolean,
	db: Db = defaultDb,
): Promise<ReferenceSectionReadStateRow> {
	const existing = await getReadState(userId, referenceSectionId, db);
	if (comprehended && (!existing || existing.status === HANDBOOK_READ_STATUSES.UNREAD)) {
		throw new HandbookValidationError('Cannot mark a section "didn\'t get it" before opening it.');
	}

	const insert = {
		userId,
		referenceSectionId,
		status: existing?.status ?? HANDBOOK_READ_STATUSES.UNREAD,
		comprehended,
		lastReadAt: existing?.lastReadAt ?? null,
		openedCount: existing?.openedCount ?? 0,
		totalSecondsVisible: existing?.totalSecondsVisible ?? 0,
		notesMd: existing?.notesMd ?? '',
	};

	const rows = await db
		.insert(referenceSectionReadState)
		.values(insert)
		.onConflictDoUpdate({
			target: [referenceSectionReadState.userId, referenceSectionReadState.referenceSectionId],
			set: {
				comprehended,
				updatedAt: new Date(),
			},
		})
		.returning();

	const row = rows[0];
	if (!row) throw new HandbookValidationError('setComprehended: upsert returned no row');
	return row;
}

/**
 * Re-read action: resets `status` to `unread` and clears `comprehended`.
 * Notes survive (the user's annotations are independent of the read counter)
 * and `last_read_at` is intentionally left alone -- the historical "I once
 * read this" lives there, not on a soft-delete / undo path.
 */
export async function markAsReread(
	userId: string,
	referenceSectionId: string,
	db: Db = defaultDb,
): Promise<ReferenceSectionReadStateRow> {
	const rows = await db
		.update(referenceSectionReadState)
		.set({
			status: HANDBOOK_READ_STATUSES.UNREAD,
			comprehended: false,
			updatedAt: new Date(),
		})
		.where(
			and(
				eq(referenceSectionReadState.userId, userId),
				eq(referenceSectionReadState.referenceSectionId, referenceSectionId),
			),
		)
		.returning();
	const row = rows[0];
	if (!row) {
		throw new HandbookValidationError(
			`markAsReread: no read-state row for user ${userId} on section ${referenceSectionId}`,
		);
	}
	return row;
}

/** Persist user notes for a section. Validates length against `HANDBOOK_NOTES_MAX_LENGTH`. */
export async function setNotes(
	userId: string,
	referenceSectionId: string,
	notesMd: string,
	db: Db = defaultDb,
): Promise<ReferenceSectionReadStateRow> {
	if (notesMd.length > HANDBOOK_NOTES_MAX_LENGTH) {
		throw new HandbookValidationError(`Notes exceed ${HANDBOOK_NOTES_MAX_LENGTH} characters.`);
	}

	const insert = {
		userId,
		referenceSectionId,
		status: HANDBOOK_READ_STATUSES.UNREAD,
		comprehended: false,
		openedCount: 0,
		totalSecondsVisible: 0,
		notesMd,
	};

	const rows = await db
		.insert(referenceSectionReadState)
		.values(insert)
		.onConflictDoUpdate({
			target: [referenceSectionReadState.userId, referenceSectionReadState.referenceSectionId],
			set: {
				notesMd,
				updatedAt: new Date(),
			},
		})
		.returning();

	const row = rows[0];
	if (!row) throw new HandbookValidationError('setNotes: upsert returned no row');
	return row;
}

/**
 * Heartbeat tick from the section reader. Increments `total_seconds_visible`
 * by `deltaSeconds`, capped at `HANDBOOK_HEARTBEAT_INTERVAL_SEC * 4` to
 * absorb sessionization gaps without letting one stuck client run up the
 * counter. First write also flips status `unread -> reading` (the only
 * automatic transition the spec allows).
 */
export async function recordHeartbeat(
	userId: string,
	referenceSectionId: string,
	deltaSeconds: number,
	db: Db = defaultDb,
): Promise<ReferenceSectionReadStateRow> {
	if (deltaSeconds < HANDBOOK_HEARTBEAT_MIN_DELTA_SEC) {
		throw new HandbookValidationError(
			`Heartbeat delta ${deltaSeconds}s below minimum ${HANDBOOK_HEARTBEAT_MIN_DELTA_SEC}s.`,
		);
	}
	const cappedDelta = Math.min(deltaSeconds, HANDBOOK_HEARTBEAT_INTERVAL_SEC * 4);
	const now = new Date();

	const insert = {
		userId,
		referenceSectionId,
		status: HANDBOOK_READ_STATUSES.READING,
		comprehended: false,
		lastReadAt: now,
		openedCount: 1,
		totalSecondsVisible: cappedDelta,
		notesMd: '',
	};

	const rows = await db
		.insert(referenceSectionReadState)
		.values(insert)
		.onConflictDoUpdate({
			target: [referenceSectionReadState.userId, referenceSectionReadState.referenceSectionId],
			set: {
				totalSecondsVisible: sql`${referenceSectionReadState.totalSecondsVisible} + ${cappedDelta}`,
				lastReadAt: now,
				// Only auto-advance unread -> reading; never overwrite an explicit
				// `read` status with the heartbeat tick.
				status: sql`CASE WHEN ${referenceSectionReadState.status} = ${HANDBOOK_READ_STATUSES.UNREAD} THEN ${HANDBOOK_READ_STATUSES.READING} ELSE ${referenceSectionReadState.status} END`,
				updatedAt: now,
			},
		})
		.returning();

	const row = rows[0];
	if (!row) throw new HandbookValidationError('recordHeartbeat: upsert returned no row');
	return row;
}

// ---------------------------------------------------------------------------
// Build-only helpers (consumed by scripts/db/seed-references-from-manifest.ts;
// not exported from the BC barrel).
// ---------------------------------------------------------------------------

/**
 * Per-kind hierarchy declaration stored on `reference.section_schema`.
 * Validated against this Zod-equivalent shape at ingest; the DB only sees
 * a free-form jsonb. `levels[]` is the vocabulary of legal `level` values
 * for child `reference_section` rows; `strict_sequence` (handbooks)
 * additionally pins level to depth.
 */
export interface SectionSchema {
	levels: readonly string[];
	strictSequence?: boolean;
}

export interface UpsertReferenceInput {
	kind: ReferenceRow['kind'];
	documentSlug: string;
	edition: string;
	title: string;
	publisher?: string;
	url?: string | null;
	subjects?: readonly string[];
	/**
	 * Optional primary cert that "owns" this reference for library browsing.
	 * NULL/undefined = cert-agnostic. See `study.reference.primary_cert` doc
	 * comment in `schema.ts` for the carryover-derivation rationale.
	 */
	primaryCert?: CertApplicability | null;
	/**
	 * Per-kind level vocabulary for child `reference_section` rows. Defaults
	 * to `{ levels: [] }` (empty) when omitted -- meaning "no per-kind
	 * hierarchy declared." Seeders should always populate this so production
	 * rows are fully specified.
	 */
	sectionSchema?: SectionSchema;
	/**
	 * Per-kind document-level extras (CFR title number, NTSB docket, AC
	 * cancels-list, the source-PDF page count for a whole-doc handbook).
	 */
	metadata?: Record<string, unknown>;
	seedOrigin?: string | null;
}

/** Insert or update a `reference` row; returns the post-write row. */
export async function upsertReference(input: UpsertReferenceInput, db: Db = defaultDb): Promise<ReferenceRow> {
	const subjects = [...(input.subjects ?? [])];
	const sectionSchema = input.sectionSchema ?? { levels: [] };
	const metadata = input.metadata ?? {};
	const values: NewReferenceRow = {
		id: generateReferenceId(),
		kind: input.kind,
		documentSlug: input.documentSlug,
		edition: input.edition,
		title: input.title,
		publisher: input.publisher ?? 'FAA',
		url: input.url ?? null,
		subjects,
		primaryCert: input.primaryCert ?? null,
		sectionSchema,
		metadata,
		seedOrigin: input.seedOrigin ?? null,
	};

	// Two callers upsert the same `(document_slug, edition)` row in seed-all:
	// the manifest-phase adapters (which know the per-kind level vocabulary
	// and pass `sectionSchema`) and the YAML phase (which doesn't carry the
	// vocabulary and would otherwise overwrite it back to `{ levels: [] }`).
	// On conflict, only overwrite caller-controlled fields when they were
	// actually supplied; passing `undefined` should preserve the existing DB
	// value rather than blanking it. This lets the manifest-phase seeders
	// (AC, ACS, NTSB-ALJ, SAFO, InFO) leave subjects + primary_cert alone so
	// the YAML-phase values survive when the manifest phase runs second.
	const onConflictSet: Record<string, unknown> = {
		kind: input.kind,
		title: input.title,
		publisher: input.publisher ?? 'FAA',
		url: input.url ?? null,
		metadata,
		seedOrigin: input.seedOrigin ?? null,
		updatedAt: new Date(),
	};
	if (input.subjects !== undefined) {
		onConflictSet.subjects = subjects;
	}
	if (input.primaryCert !== undefined) {
		onConflictSet.primaryCert = input.primaryCert ?? null;
	}
	if (input.sectionSchema !== undefined) {
		onConflictSet.sectionSchema = sectionSchema;
	}

	const rows = await db
		.insert(reference)
		.values(values)
		.onConflictDoUpdate({
			target: [reference.documentSlug, reference.edition],
			set: onConflictSet,
		})
		.returning();

	const row = rows[0];
	if (!row)
		throw new HandbookValidationError(
			`upsertReference: insert returned no row for ${input.documentSlug}@${input.edition}`,
		);
	return row;
}

// FAA pagination helpers live in `./reference-metadata.ts` so the runtime
// barrel can re-export them safely (this file is server-only). The
// upsert input shape consumes the type below.
export type { ReferenceSectionFaaPages } from './reference-metadata';
export { faaPagesFromMetadata } from './reference-metadata';

export interface UpsertReferenceSectionInput {
	referenceId: string;
	parentId: string | null;
	level: ReferenceSectionRow['level'];
	ordinal: number;
	depth: number;
	code: string;
	/**
	 * Canonical `airboss-ref:` URI for this section. Required by the schema's
	 * NOT NULL + shape CHECK + unique index. Each seeder builds the URI per
	 * its corpus's locator shape (handbooks: dotted-code -> slashed; AIM:
	 * dashed; CFR: paragraph chains; AC: section-N; ACS: area-{a}/task-{t}).
	 */
	airbossRef: string;
	title: string;
	/**
	 * Optional FAA-printed page references (handbook only; null for every
	 * other corpus). Stored under `metadata.faaPages` per the 2026-05-06
	 * review §K. The seeder passes `{ start, end }` (with `end` either a
	 * single page or NULL when the section ends on its start page); the
	 * upsert folds it into the metadata jsonb. NULL means "no page reference
	 * for this row" (CFR / ACS / AC / AIM rows).
	 */
	faaPages?: ReferenceSectionFaaPages | null;
	sourceLocator: string;
	contentMd: string;
	contentHash: string;
	hasFigures: boolean;
	hasTables: boolean;
	metadata?: Record<string, unknown>;
	seedOrigin?: string | null;
}

/**
 * Build the `metadata` jsonb the row carries. When `faaPages` is provided,
 * it merges in under the `faaPages` key; otherwise the input metadata
 * passes through unchanged. Other per-corpus extras (CFR effective dates,
 * AC paragraph cancellations) live next to `faaPages` in the same blob.
 */
function mergeFaaPagesIntoMetadata(
	metadata: Record<string, unknown> | undefined,
	faaPages: ReferenceSectionFaaPages | null | undefined,
): Record<string, unknown> {
	const base = metadata ?? {};
	if (!faaPages) return base;
	return { ...base, faaPages };
}

/**
 * Process-local cache of `(referenceId -> code -> SectionIndexEntry)` built
 * lazily by {@link upsertReferenceSection}. The seed pipeline upserts
 * thousands of `reference_section` rows per run (CFR alone has ~6300); doing
 * one SELECT per row to discover whether it exists costs 30+ seconds of
 * round-trip latency on a warm dev DB. The cache turns that into one
 * SELECT per reference (the first call for that reference) plus pure
 * in-memory lookup for every subsequent call. Mutated in place by the
 * upsert path so a re-checked row sees the freshly-inserted hash.
 *
 * `metadata` is cached too so the handbook fast-path can merge `faaPages`
 * locally (every handbook section sets `faaPages`, so the merge would
 * otherwise force the slow SELECT-then-UPDATE branch on every row).
 *
 * Lifetime: process. The seed orchestrator runs once and exits, so the
 * cache lives only for that run. Tests that build their own DB instance
 * pass a non-default `db`, which still hits the cache safely because the
 * key includes the reference id (UUID); collisions across DBs would
 * require a UUID collision.
 */
/**
 * Cached section row carries enough state to:
 *   1. detect a no-op (hash + scaffolding all match -> skip the UPDATE)
 *   2. merge faaPages into prior metadata locally (no SELECT needed)
 *   3. synthesise a {@link ReferenceSectionRow} return value without
 *      hitting the DB on the no-op path
 */
interface SectionIndexEntry {
	row: ReferenceSectionRow;
}

const sectionIndexByReference: Map<string, Map<string, SectionIndexEntry>> = new Map();

/**
 * Cheap deep-equal for the metadata jsonb. Most rows carry small flat objects
 * (`{ faaPages: { start, end } }`, `{ last_amended_date }`); a key-sorted
 * JSON serialization is good enough to detect "nothing changed" on the re-seed
 * fast path without paying for a recursive equality walk. Postgres jsonb
 * returns keys in storage order (not insertion order), and our seeders build
 * the merged metadata in a different order than the stored row, so an order-
 * sensitive `JSON.stringify` would falsely flag every handbook section as
 * changed and re-issue the UPDATE we are trying to skip. Order-independent
 * via deterministic key sort. Returns true when both sides are null/empty.
 */
function stableStringify(value: unknown): string {
	if (value === null || typeof value !== 'object') return JSON.stringify(value);
	if (Array.isArray(value)) return `[${value.map(stableStringify).join(',')}]`;
	const obj = value as Record<string, unknown>;
	const keys = Object.keys(obj).sort();
	const parts = keys.map((k) => `${JSON.stringify(k)}:${stableStringify(obj[k])}`);
	return `{${parts.join(',')}}`;
}

function metadataEqual(a: Record<string, unknown> | null, b: Record<string, unknown> | null): boolean {
	const aEmpty = a === null || a === undefined || Object.keys(a).length === 0;
	const bEmpty = b === null || b === undefined || Object.keys(b).length === 0;
	if (aEmpty && bEmpty) return true;
	if (aEmpty || bEmpty) return false;
	return stableStringify(a) === stableStringify(b);
}

async function loadSectionIndex(referenceId: string, db: Db): Promise<Map<string, SectionIndexEntry>> {
	const cached = sectionIndexByReference.get(referenceId);
	if (cached !== undefined) return cached;
	const rows = await db.select().from(referenceSection).where(eq(referenceSection.referenceId, referenceId));
	const map = new Map<string, SectionIndexEntry>();
	for (const row of rows) {
		map.set(row.code, { row });
	}
	sectionIndexByReference.set(referenceId, map);
	return map;
}

/**
 * Upsert a `reference_section` row by `(reference_id, code)`. Returns
 * `{row, changed}` so the caller can mass-replace figures only when the
 * section's body actually changed (idempotent re-seed). Corpus-agnostic:
 * accepts handbook chapters/sections/subsections, whole-doc rows
 * (`level: 'document'`), CFR paragraphs, AIM sections, etc. -- per-kind
 * shape validation belongs at ingest, not here.
 *
 * Reads use a process-local index (one SELECT per reference, not per row);
 * the unchanged-hash path issues a single UPDATE; the changed path uses
 * INSERT ... ON CONFLICT. Net cost on a re-seed of 6k unchanged rows is
 * ~6k UPDATEs (one round trip each) instead of ~12k.
 */
export async function upsertReferenceSection(
	input: UpsertReferenceSectionInput,
	db: Db = defaultDb,
): Promise<{ row: ReferenceSectionRow; changed: boolean }> {
	const index = await loadSectionIndex(input.referenceId, db);
	const cachedHit = index.get(input.code);

	// Fast path: cache says the row exists AND its content_hash matches the
	// inbound section. If every scaffolding field also matches we issue zero
	// queries; otherwise one UPDATE-by-id to refresh scaffolding. Cached
	// metadata supplies the merge target for `faaPages`, which every handbook
	// section carries -- without that the handbook fast path would never fire.
	if (cachedHit !== undefined && cachedHit.row.contentHash === input.contentHash) {
		const prevRow = cachedHit.row;
		const refreshedMetadata = input.faaPages
			? mergeFaaPagesIntoMetadata((prevRow.metadata as Record<string, unknown>) ?? {}, input.faaPages)
			: ((input.metadata ?? (prevRow.metadata as Record<string, unknown>) ?? {}) as Record<string, unknown>);

		const scaffoldingMatches =
			prevRow.parentId === input.parentId &&
			prevRow.ordinal === input.ordinal &&
			prevRow.depth === input.depth &&
			prevRow.airbossRef === input.airbossRef &&
			prevRow.title === input.title &&
			prevRow.sourceLocator === input.sourceLocator &&
			prevRow.hasFigures === input.hasFigures &&
			prevRow.hasTables === input.hasTables &&
			metadataEqual(prevRow.metadata as Record<string, unknown> | null, refreshedMetadata);

		if (scaffoldingMatches) {
			// Truly nothing changed -- skip the DB round-trip entirely.
			return { row: prevRow, changed: false };
		}

		const rows = await db
			.update(referenceSection)
			.set({
				parentId: input.parentId,
				ordinal: input.ordinal,
				depth: input.depth,
				airbossRef: input.airbossRef,
				title: input.title,
				sourceLocator: input.sourceLocator,
				hasFigures: input.hasFigures,
				hasTables: input.hasTables,
				metadata: refreshedMetadata,
				updatedAt: new Date(),
			})
			.where(eq(referenceSection.id, prevRow.id))
			.returning();
		const row = rows[0];
		if (!row) {
			// Cache is stale (row was deleted out from under us). Drop the
			// entry and fall through to the full path below.
			index.delete(input.code);
		} else {
			cachedHit.row = row;
			return { row, changed: false };
		}
	}

	// Slow path: either no cached entry, or hash differs. Fetch the existing
	// row only when the cache suggests it exists; otherwise straight to insert.
	let prev: ReferenceSectionRow | undefined;
	if (cachedHit !== undefined) {
		const existing = await db.select().from(referenceSection).where(eq(referenceSection.id, cachedHit.row.id)).limit(1);
		prev = existing[0];
	}

	const mergedMetadata = mergeFaaPagesIntoMetadata(input.metadata, input.faaPages);

	const values: NewReferenceSectionRow = {
		id: prev?.id ?? generateReferenceSectionId(),
		referenceId: input.referenceId,
		parentId: input.parentId,
		level: input.level,
		ordinal: input.ordinal,
		depth: input.depth,
		code: input.code,
		airbossRef: input.airbossRef,
		title: input.title,
		sourceLocator: input.sourceLocator,
		contentMd: input.contentMd,
		contentHash: input.contentHash,
		hasFigures: input.hasFigures,
		hasTables: input.hasTables,
		metadata: mergedMetadata,
		seedOrigin: input.seedOrigin ?? null,
	};

	if (prev && prev.contentHash === input.contentHash) {
		// Hash matches -- skip body upsert. Refresh scaffolding fields
		// (parent / ordinal / locator / hasFigures / hasTables) in case the
		// extractor moved a section without re-extracting its body.
		const refreshedMetadata = input.faaPages
			? mergeFaaPagesIntoMetadata((prev.metadata as Record<string, unknown>) ?? {}, input.faaPages)
			: ((input.metadata ?? (prev.metadata as Record<string, unknown>)) as Record<string, unknown>);
		const rows = await db
			.update(referenceSection)
			.set({
				parentId: input.parentId,
				ordinal: input.ordinal,
				depth: input.depth,
				airbossRef: input.airbossRef,
				title: input.title,
				sourceLocator: input.sourceLocator,
				hasFigures: input.hasFigures,
				hasTables: input.hasTables,
				metadata: refreshedMetadata,
				updatedAt: new Date(),
			})
			.where(eq(referenceSection.id, prev.id))
			.returning();
		const row = rows[0] ?? prev;
		index.set(input.code, { row });
		return { row, changed: false };
	}

	const rows = await db
		.insert(referenceSection)
		.values(values)
		.onConflictDoUpdate({
			target: [referenceSection.referenceId, referenceSection.code],
			set: {
				parentId: input.parentId,
				level: input.level,
				ordinal: input.ordinal,
				depth: input.depth,
				airbossRef: input.airbossRef,
				title: input.title,
				sourceLocator: input.sourceLocator,
				contentMd: input.contentMd,
				contentHash: input.contentHash,
				hasFigures: input.hasFigures,
				hasTables: input.hasTables,
				metadata: mergedMetadata,
				seedOrigin: input.seedOrigin ?? null,
				updatedAt: new Date(),
			},
		})
		.returning();
	const row = rows[0];
	if (!row) {
		throw new HandbookValidationError(
			`upsertReferenceSection: insert returned no row for ${input.referenceId} / ${input.code}`,
		);
	}
	index.set(input.code, { row });
	return { row, changed: true };
}

// ---------------------------------------------------------------------------
// Bulk upsert (cold-path: one COPY-and-merge per `(referenceId, depth)` group)
// ---------------------------------------------------------------------------

/**
 * Result of one entry in a {@link bulkUpsertReferenceSections} batch.
 * Mirrors the per-row return shape of {@link upsertReferenceSection} so the
 * seeder loop can stay structurally identical (return ids, fan out figures
 * for changed rows, accumulate `summary.sectionsChanged`).
 */
export interface BulkUpsertReferenceSectionResult {
	row: ReferenceSectionRow;
	changed: boolean;
}

/**
 * Bulk-upsert many `reference_section` rows on the cold seed path.
 *
 * Semantics match {@link upsertReferenceSection} run row-by-row, but the
 * physical execution is:
 *
 *   1. Group inputs by `referenceId` (each reference's section index is
 *      independent; FKs only point intra-reference via `parent_id`).
 *   2. For each reference:
 *        a. Load the process-local section index (cache fast-path; one
 *           SELECT per reference, shared with {@link upsertReferenceSection}).
 *        b. Partition into "no-op" rows (cache hit + content_hash match +
 *           every scaffolding field equal) and "dirty" rows (everything
 *           else). No-ops return the cached row with `changed: false` and
 *           pay zero DB round-trips.
 *        c. Group dirty rows by `depth` ascending so depth-0 rows land
 *           before depth-1 etc. (`parent_id` FK is intra-reference and
 *           always points to a strictly-lower depth).
 *        d. For each depth group, open one connection-bound transaction:
 *           COPY the rows into a temp table, then `INSERT ... SELECT ...
 *           ON CONFLICT (reference_id, code) DO UPDATE` and `RETURNING *`.
 *
 * Net cost on a cold re-seed of 8.7k rows is ~1 SELECT + ~10 COPY+merge
 * round trips (across all references and depths) instead of ~8.7k single-
 * row INSERTs.
 *
 * Returns one {@link BulkUpsertReferenceSectionResult} per input, in the
 * same order as `inputs`. The cache (`sectionIndexByReference`) is updated
 * in place so subsequent calls -- including any leftover per-row
 * {@link upsertReferenceSection} callers -- see the freshly-written rows.
 *
 * Uses the underlying `postgres-js` client for COPY because Drizzle does
 * not surface the COPY protocol. The `db` argument is honored for the
 * read-side cache load (so tests that point at an alternate DB still see
 * the right index), but the write-side COPY always targets the prod
 * `client` from `@ab/db/connection`. The seed pipeline only uses the
 * default DB so this asymmetry never shows up in production. Per-row
 * {@link upsertReferenceSection} remains the canonical API for callers
 * that genuinely upsert one row at a time, and unit tests that need to
 * write against a custom DB.
 */
export async function bulkUpsertReferenceSections(
	inputs: ReadonlyArray<UpsertReferenceSectionInput>,
	db: Db = defaultDb,
): Promise<BulkUpsertReferenceSectionResult[]> {
	const results: Array<BulkUpsertReferenceSectionResult | undefined> = new Array(inputs.length);
	if (inputs.length === 0) return [];

	// Group input indices by referenceId. Preserve original positions so the
	// returned array maps back to the caller's input order.
	const indicesByReference = new Map<string, number[]>();
	for (let i = 0; i < inputs.length; i += 1) {
		const input = inputs[i];
		if (input === undefined) continue;
		const list = indicesByReference.get(input.referenceId);
		if (list) list.push(i);
		else indicesByReference.set(input.referenceId, [i]);
	}

	for (const [referenceId, indices] of indicesByReference) {
		await processReferenceBatch(referenceId, indices, inputs, results, db);
	}

	const out: BulkUpsertReferenceSectionResult[] = [];
	for (let i = 0; i < inputs.length; i += 1) {
		const r = results[i];
		if (r === undefined) {
			throw new HandbookValidationError(`bulkUpsertReferenceSections: missing result for input #${i}`);
		}
		out.push(r);
	}
	return out;
}

/**
 * Process every input that targets one `referenceId`. Splits cache-hit
 * no-ops from dirty rows, then drives one COPY+merge per depth (parents
 * before children).
 */
async function processReferenceBatch(
	referenceId: string,
	indices: readonly number[],
	inputs: ReadonlyArray<UpsertReferenceSectionInput>,
	results: Array<BulkUpsertReferenceSectionResult | undefined>,
	db: Db,
): Promise<void> {
	const index = await loadSectionIndex(referenceId, db);

	// Build the per-input merged-metadata + dirty-flag without any DB
	// round-trips. Cache hit + content_hash match + all scaffolding equal =
	// no-op; everything else needs the COPY path.
	interface DirtyRow {
		readonly inputIdx: number;
		readonly id: string;
		readonly mergedMetadata: Record<string, unknown>;
	}
	const dirtyByDepth: Map<number, DirtyRow[]> = new Map();

	for (const idx of indices) {
		const input = inputs[idx];
		if (input === undefined) continue;
		const cached = index.get(input.code);

		// No-op fast-path: identical to upsertReferenceSection's fast path.
		if (cached !== undefined && cached.row.contentHash === input.contentHash) {
			const prevRow = cached.row;
			const refreshedMetadata = input.faaPages
				? mergeFaaPagesIntoMetadata((prevRow.metadata as Record<string, unknown>) ?? {}, input.faaPages)
				: ((input.metadata ?? (prevRow.metadata as Record<string, unknown>) ?? {}) as Record<string, unknown>);
			const scaffoldingMatches =
				prevRow.parentId === input.parentId &&
				prevRow.ordinal === input.ordinal &&
				prevRow.depth === input.depth &&
				prevRow.airbossRef === input.airbossRef &&
				prevRow.title === input.title &&
				prevRow.sourceLocator === input.sourceLocator &&
				prevRow.hasFigures === input.hasFigures &&
				prevRow.hasTables === input.hasTables &&
				metadataEqual(prevRow.metadata as Record<string, unknown> | null, refreshedMetadata);
			if (scaffoldingMatches) {
				results[idx] = { row: prevRow, changed: false };
				continue;
			}
		}

		// Dirty: ID is the existing one (if cached) or a fresh ULID. Merged
		// metadata folds in faaPages exactly like the single-row path so
		// re-seeded handbook rows stay byte-equivalent across the two writers.
		const id = cached?.row.id ?? generateReferenceSectionId();
		const mergedMetadata = mergeFaaPagesIntoMetadata(input.metadata, input.faaPages);
		const list = dirtyByDepth.get(input.depth);
		if (list) list.push({ inputIdx: idx, id, mergedMetadata });
		else dirtyByDepth.set(input.depth, [{ inputIdx: idx, id, mergedMetadata }]);
	}

	if (dirtyByDepth.size === 0) return;

	// Process depths ascending so parent rows commit before children. The
	// FK is `parent_id -> reference_section.id`; intra-reference and
	// strictly increasing depth (the seeders all enforce this).
	const depths = [...dirtyByDepth.keys()].sort((a, b) => a - b);
	for (const depth of depths) {
		const rows = dirtyByDepth.get(depth);
		if (!rows || rows.length === 0) continue;
		await copyAndMerge(rows, inputs, results, index);
	}
}

/**
 * COPY the dirty rows into a temp table, then `INSERT ... SELECT ... ON
 * CONFLICT DO UPDATE RETURNING *`. Returned rows are slotted into the
 * caller's `results` array and the in-process index cache is refreshed.
 *
 * Each call opens its own transaction (and therefore its own pooled
 * connection). The temp table is created `ON COMMIT DROP` so the
 * connection comes back clean for the next caller.
 */
async function copyAndMerge(
	dirty: ReadonlyArray<{
		readonly inputIdx: number;
		readonly id: string;
		readonly mergedMetadata: Record<string, unknown>;
	}>,
	inputs: ReadonlyArray<UpsertReferenceSectionInput>,
	results: Array<BulkUpsertReferenceSectionResult | undefined>,
	index: Map<string, SectionIndexEntry>,
): Promise<void> {
	if (dirty.length === 0) return;
	const now = new Date();

	const csv = encodeReferenceSectionsAsCsv(dirty, inputs, now);

	await client.begin(async (tx) => {
		// `LIKE study.reference_section INCLUDING DEFAULTS` mirrors the live
		// table's column inventory + defaults so a future column add doesn't
		// silently shift the COPY column order. `ON COMMIT DROP` keeps the
		// connection clean across pool reuse.
		await tx`
			CREATE TEMP TABLE _seed_section (LIKE study.reference_section INCLUDING DEFAULTS)
			ON COMMIT DROP
		`;

		const writable = await tx`
			COPY _seed_section (
				id, reference_id, parent_id, level, ordinal, depth, code,
				airboss_ref, title, source_locator, content_md, content_hash,
				has_figures, has_tables, metadata, seed_origin, created_at, updated_at
			) FROM STDIN WITH (FORMAT csv, HEADER false, NULL '\\N')
		`.writable();
		await new Promise<void>((resolvePromise, rejectPromise) => {
			writable.on('error', rejectPromise);
			writable.on('finish', () => resolvePromise());
			writable.end(csv);
		});

		const merged = await tx<MergedRow[]>`
			INSERT INTO study.reference_section (
				id, reference_id, parent_id, level, ordinal, depth, code,
				airboss_ref, title, source_locator, content_md, content_hash,
				has_figures, has_tables, metadata, seed_origin, created_at, updated_at
			)
			SELECT
				id, reference_id, parent_id, level, ordinal, depth, code,
				airboss_ref, title, source_locator, content_md, content_hash,
				has_figures, has_tables, metadata, seed_origin, created_at, updated_at
			FROM _seed_section
			ON CONFLICT (reference_id, code) DO UPDATE SET
				parent_id      = EXCLUDED.parent_id,
				level          = EXCLUDED.level,
				ordinal        = EXCLUDED.ordinal,
				depth          = EXCLUDED.depth,
				airboss_ref    = EXCLUDED.airboss_ref,
				title          = EXCLUDED.title,
				source_locator = EXCLUDED.source_locator,
				content_md     = EXCLUDED.content_md,
				content_hash   = EXCLUDED.content_hash,
				has_figures    = EXCLUDED.has_figures,
				has_tables     = EXCLUDED.has_tables,
				metadata       = EXCLUDED.metadata,
				seed_origin    = EXCLUDED.seed_origin,
				updated_at     = EXCLUDED.updated_at
			RETURNING
				id, reference_id AS "referenceId", parent_id AS "parentId", level, ordinal, depth, code,
				airboss_ref AS "airbossRef", title, source_locator AS "sourceLocator",
				content_md AS "contentMd", content_hash AS "contentHash",
				has_figures AS "hasFigures", has_tables AS "hasTables", metadata,
				seed_origin AS "seedOrigin",
				created_at AS "createdAt", updated_at AS "updatedAt"
		`;

		// Map RETURNING rows back to the caller's input positions by code.
		// Within one reference, code is unique, so the (code -> dirty entry)
		// lookup is unambiguous.
		const codeToDirty = new Map<string, { inputIdx: number }>();
		for (const d of dirty) {
			const input = inputs[d.inputIdx];
			if (input === undefined) continue;
			codeToDirty.set(input.code, { inputIdx: d.inputIdx });
		}
		for (const r of merged) {
			const dest = codeToDirty.get(r.code);
			if (dest === undefined) continue;
			const row: ReferenceSectionRow = {
				id: r.id,
				referenceId: r.referenceId,
				parentId: r.parentId,
				level: r.level,
				ordinal: r.ordinal,
				depth: r.depth,
				code: r.code,
				airbossRef: r.airbossRef,
				title: r.title,
				sourceLocator: r.sourceLocator,
				contentMd: r.contentMd,
				contentHash: r.contentHash,
				hasFigures: r.hasFigures,
				hasTables: r.hasTables,
				metadata: r.metadata,
				seedOrigin: r.seedOrigin,
				createdAt: r.createdAt,
				updatedAt: r.updatedAt,
			};
			results[dest.inputIdx] = { row, changed: true };
			index.set(row.code, { row });
		}

		// Validate every dirty row got a RETURNING entry. A miss means the
		// COPY landed but the merge silently dropped a row (would only
		// happen on a DB-level issue we want to surface loudly).
		for (const d of dirty) {
			if (results[d.inputIdx] === undefined) {
				const input = inputs[d.inputIdx];
				throw new HandbookValidationError(
					`bulkUpsertReferenceSections: COPY+merge returned no row for ${
						input ? `${input.referenceId} / ${input.code}` : `input #${d.inputIdx}`
					}`,
				);
			}
		}
	});
}

/** Shape of one row returned by the COPY+merge `RETURNING` clause. */
interface MergedRow {
	id: string;
	referenceId: string;
	parentId: string | null;
	level: string;
	ordinal: number;
	depth: number;
	code: string;
	airbossRef: string;
	title: string;
	sourceLocator: string;
	contentMd: string;
	contentHash: string;
	hasFigures: boolean;
	hasTables: boolean;
	metadata: unknown;
	seedOrigin: string | null;
	createdAt: Date;
	updatedAt: Date;
}

/**
 * Encode dirty rows as CSV for `COPY ... FROM STDIN WITH (FORMAT csv,
 * HEADER false, NULL '\\N')`.
 *
 * CSV format rules we honor:
 *   - Fields containing `,`, `"`, `\r`, or `\n` are wrapped in `"..."`.
 *   - `"` inside a wrapped field is doubled (`""`).
 *   - `\N` is the NULL marker (matches the COPY option above).
 *   - Booleans use postgres `t` / `f`.
 *   - JSON metadata is serialized to text, then CSV-escaped; postgres
 *     parses jsonb from the text.
 *   - Timestamps use ISO-8601 (`toISOString`); postgres' `timestamptz` text
 *     parser accepts this verbatim.
 */
function encodeReferenceSectionsAsCsv(
	dirty: ReadonlyArray<{
		readonly inputIdx: number;
		readonly id: string;
		readonly mergedMetadata: Record<string, unknown>;
	}>,
	inputs: ReadonlyArray<UpsertReferenceSectionInput>,
	now: Date,
): string {
	const lines: string[] = [];
	const ts = now.toISOString();
	for (const d of dirty) {
		const input = inputs[d.inputIdx];
		if (input === undefined) continue;
		const fields: string[] = [
			d.id,
			input.referenceId,
			input.parentId === null ? '\\N' : input.parentId,
			input.level,
			String(input.ordinal),
			String(input.depth),
			input.code,
			input.airbossRef,
			input.title,
			input.sourceLocator,
			input.contentMd,
			input.contentHash,
			input.hasFigures ? 't' : 'f',
			input.hasTables ? 't' : 'f',
			JSON.stringify(d.mergedMetadata),
			input.seedOrigin === undefined || input.seedOrigin === null ? '\\N' : input.seedOrigin,
			ts,
			ts,
		];
		lines.push(fields.map(csvEscape).join(','));
	}
	// Postgres' COPY is line-terminated; trailing newline is required.
	return `${lines.join('\n')}\n`;
}

/**
 * CSV-escape one field. The NULL sentinel `\N` is passed through verbatim
 * (postgres recognises it before applying the CSV quoting rules).
 */
function csvEscape(field: string): string {
	if (field === '\\N') return field;
	// Quote when the field contains the delimiter, the quote char, CR, LF,
	// or starts with `\N` literally (rare but safe).
	const needsQuote = /[",\r\n]/.test(field);
	if (!needsQuote) return field;
	return `"${field.replace(/"/g, '""')}"`;
}

export interface FigureInput {
	ordinal: number;
	caption: string;
	assetPath: string;
	width: number | null;
	height: number | null;
}

/**
 * Replace every figure for a section in one shot. The seed calls this only
 * when the section's `content_hash` actually changed, so the cost of the
 * delete-and-reinsert is only paid on real ingestion deltas.
 */
export async function replaceFiguresForSection(
	sectionId: string,
	figures: ReadonlyArray<FigureInput>,
	db: Db = defaultDb,
	seedOrigin: string | null = null,
): Promise<ReferenceFigureRow[]> {
	await db.delete(referenceFigure).where(eq(referenceFigure.sectionId, sectionId));
	if (figures.length === 0) return [];
	const values: NewReferenceFigureRow[] = figures.map((f) => ({
		id: generateReferenceFigureId(),
		sectionId,
		ordinal: f.ordinal,
		caption: f.caption,
		assetPath: f.assetPath,
		width: f.width,
		height: f.height,
		seedOrigin,
	}));
	return db.insert(referenceFigure).values(values).returning();
}

/**
 * Bulk variant of {@link replaceFiguresForSection}. Drops every figure for
 * the given section ids in one DELETE, then inserts every new row in one
 * chunked multi-row INSERT (chunk size capped to keep parameter counts
 * within Postgres' protocol limits).
 *
 * The seed calls this for every section whose `content_hash` actually
 * changed in this run; on a cold rebuild that's all 1.8k handbook
 * sections, on a re-seed it's typically zero. Per-row
 * {@link replaceFiguresForSection} remains for callers that change one
 * section at a time.
 */
export async function bulkReplaceFiguresForSections(
	inputs: ReadonlyArray<{ readonly sectionId: string; readonly figures: ReadonlyArray<FigureInput> }>,
	db: Db = defaultDb,
	seedOrigin: string | null = null,
): Promise<number> {
	if (inputs.length === 0) return 0;
	const sectionIds = inputs.map((i) => i.sectionId);
	await db.delete(referenceFigure).where(inArray(referenceFigure.sectionId, sectionIds));
	const all: NewReferenceFigureRow[] = [];
	for (const inp of inputs) {
		for (const f of inp.figures) {
			all.push({
				id: generateReferenceFigureId(),
				sectionId: inp.sectionId,
				ordinal: f.ordinal,
				caption: f.caption,
				assetPath: f.assetPath,
				width: f.width,
				height: f.height,
				seedOrigin,
			});
		}
	}
	if (all.length === 0) return 0;
	// Chunk to stay well below Postgres' 65535-parameter cap. With 8 columns
	// per row, 500 rows = 4000 params per call; comfortable headroom.
	const CHUNK = 500;
	let written = 0;
	for (let i = 0; i < all.length; i += CHUNK) {
		const slice = all.slice(i, i + CHUNK);
		const inserted = await db.insert(referenceFigure).values(slice).returning({ id: referenceFigure.id });
		written += inserted.length;
	}
	return written;
}

// Re-export type guards so callers reading from a single barrel don't have
// to import twice. (`@ab/types` keeps the source of truth.)
export type { Citation, StructuredCitation };
export { isHandbookCitation, isStructuredCitation };
