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
import { db as defaultDb } from '@ab/db/connection';
import { getCorpusResolver, isParseError, parseIdentifier, type SourceId } from '@ab/sources';
import type { Citation, StructuredCitation } from '@ab/types';
import { isHandbookCitation, isStructuredCitation } from '@ab/types';
import { generateReferenceFigureId, generateReferenceId, generateReferenceSectionId } from '@ab/utils';
import { and, asc, eq, inArray, isNull, sql } from 'drizzle-orm';
import type { PgDatabase, PgQueryResultHKT } from 'drizzle-orm/pg-core';
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
	/** Default false. When true, includes references whose `superseded_by_id` is set. */
	includeSuperseded?: boolean;
	/** Optional `kind` filter -- e.g. only handbooks. */
	kind?: ReferenceRow['kind'];
}

/**
 * List every reference, newest editions first within a `document_slug`.
 *
 * The default excludes superseded editions so the index page renders one card
 * per active handbook; opt in to `includeSuperseded` for archive views.
 */
export async function listReferences(options: ListReferencesOptions = {}, db: Db = defaultDb): Promise<ReferenceRow[]> {
	const conditions = [];
	if (!options.includeSuperseded) conditions.push(isNull(reference.supersededById));
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
	const rows = await db
		.select()
		.from(reference)
		.where(and(eq(reference.documentSlug, documentSlug), isNull(reference.supersededById)))
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
	faaPageStart: string | null;
	faaPageEnd: string | null;
	sourceLocator: string;
	contentMd: string;
	contentHash: string;
	hasFigures: boolean;
	hasTables: boolean;
	metadata?: Record<string, unknown>;
	seedOrigin?: string | null;
}

/**
 * Upsert a `reference_section` row by `(reference_id, code)`. Returns
 * `{row, changed}` so the caller can mass-replace figures only when the
 * section's body actually changed (idempotent re-seed). Corpus-agnostic:
 * accepts handbook chapters/sections/subsections, whole-doc rows
 * (`level: 'document'`), CFR paragraphs, AIM sections, etc. -- per-kind
 * shape validation belongs at ingest, not here.
 */
export async function upsertReferenceSection(
	input: UpsertReferenceSectionInput,
	db: Db = defaultDb,
): Promise<{ row: ReferenceSectionRow; changed: boolean }> {
	const existing = await db
		.select()
		.from(referenceSection)
		.where(and(eq(referenceSection.referenceId, input.referenceId), eq(referenceSection.code, input.code)))
		.limit(1);
	const prev = existing[0];

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
		faaPageStart: input.faaPageStart,
		faaPageEnd: input.faaPageEnd,
		sourceLocator: input.sourceLocator,
		contentMd: input.contentMd,
		contentHash: input.contentHash,
		hasFigures: input.hasFigures,
		hasTables: input.hasTables,
		metadata: input.metadata ?? {},
		seedOrigin: input.seedOrigin ?? null,
	};

	if (prev && prev.contentHash === input.contentHash) {
		// Hash matches -- skip body upsert. Refresh scaffolding fields
		// (parent / ordinal / locator / hasFigures / hasTables) in case the
		// extractor moved a section without re-extracting its body.
		const rows = await db
			.update(referenceSection)
			.set({
				parentId: input.parentId,
				ordinal: input.ordinal,
				depth: input.depth,
				airbossRef: input.airbossRef,
				title: input.title,
				faaPageStart: input.faaPageStart,
				faaPageEnd: input.faaPageEnd,
				sourceLocator: input.sourceLocator,
				hasFigures: input.hasFigures,
				hasTables: input.hasTables,
				metadata: input.metadata ?? prev.metadata,
				updatedAt: new Date(),
			})
			.where(eq(referenceSection.id, prev.id))
			.returning();
		const row = rows[0] ?? prev;
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
				faaPageStart: input.faaPageStart,
				faaPageEnd: input.faaPageEnd,
				sourceLocator: input.sourceLocator,
				contentMd: input.contentMd,
				contentHash: input.contentHash,
				hasFigures: input.hasFigures,
				hasTables: input.hasTables,
				metadata: input.metadata ?? {},
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
	return { row, changed: true };
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
 * Wire a `superseded_by_id` chain: every reference for `documentSlug` other
 * than the given `latestReferenceId` is updated to point at it. Idempotent.
 */
export async function attachSupersededByLatest(
	documentSlug: string,
	latestReferenceId: string,
	db: Db = defaultDb,
): Promise<void> {
	await db
		.update(reference)
		.set({ supersededById: latestReferenceId, updatedAt: new Date() })
		.where(and(eq(reference.documentSlug, documentSlug), sql`${reference.id} <> ${latestReferenceId}`));
}

// Re-export type guards so callers reading from a single barrel don't have
// to import twice. (`@ab/types` keeps the source of truth.)
export type { Citation, StructuredCitation };
export { isHandbookCitation, isStructuredCitation };
