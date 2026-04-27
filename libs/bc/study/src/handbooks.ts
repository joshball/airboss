/**
 * Handbook ingestion + reader BC.
 *
 * Read paths:
 *   - listReferences / getReferenceByDocument        index + per-handbook page
 *   - listHandbookChapters / listChapterSections     chapter list, section list
 *   - getHandbookSection                              section page payload
 *   - getNodesCitingSection                           reverse citation panel
 *   - getReadState / getHandbookProgress              read-state for a user
 *   - resolveCitationUrl                              link out from node refs
 *
 * Write paths (Phase 4):
 *   - setReadStatus / setComprehended / markAsReread / setNotes
 *   - recordHeartbeat
 *
 * Build-only helpers (Phase 4, not exported from the BC barrel):
 *   - upsertReference / upsertHandbookSection
 *   - replaceFiguresForSection / attachSupersededByLatest
 *
 * The reverse-citation reverse query relies on the GIN index added on
 * `knowledge_node.references` -- containment (`@>`) on a JSONB column with
 * `jsonb_path_ops` keeps the candidate scan bounded. The locator narrowing
 * happens in-memory because `@>` against a partially-known shape (e.g.
 * "kind=handbook AND reference_id=X" without committing to the chapter)
 * produces too many false negatives for the citing-nodes panel.
 */

import {
	HANDBOOK_HEARTBEAT_INTERVAL_SEC,
	HANDBOOK_HEARTBEAT_MIN_DELTA_SEC,
	HANDBOOK_NOTES_MAX_LENGTH,
	HANDBOOK_READ_STATUSES,
	HANDBOOK_SECTION_LEVELS,
	type HandbookReadStatus,
	REFERENCE_KINDS,
	ROUTES,
} from '@ab/constants';
import { db as defaultDb } from '@ab/db';
import type { Citation, StructuredCitation } from '@ab/types';
import { isHandbookCitation, isStructuredCitation } from '@ab/types';
import { generateHandbookFigureId, generateHandbookSectionId, generateReferenceId } from '@ab/utils';
import { and, asc, eq, isNull, sql } from 'drizzle-orm';
import type { PgDatabase, PgQueryResultHKT } from 'drizzle-orm/pg-core';
import {
	type HandbookFigureRow,
	type HandbookReadStateRow,
	type HandbookSectionRow,
	handbookFigure,
	handbookReadState,
	handbookSection,
	type KnowledgeNodeRow,
	knowledgeNode,
	type NewHandbookFigureRow,
	type NewHandbookSectionRow,
	type NewReferenceRow,
	type ReferenceRow,
	reference,
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
export async function listHandbookChapters(referenceId: string, db: Db = defaultDb): Promise<HandbookSectionRow[]> {
	return db
		.select()
		.from(handbookSection)
		.where(
			and(eq(handbookSection.referenceId, referenceId), eq(handbookSection.level, HANDBOOK_SECTION_LEVELS.CHAPTER)),
		)
		.orderBy(asc(handbookSection.ordinal));
}

/** Section rows for a chapter, ordered by ordinal. Excludes the chapter row itself. */
export async function listChapterSections(chapterId: string, db: Db = defaultDb): Promise<HandbookSectionRow[]> {
	return db
		.select()
		.from(handbookSection)
		.where(eq(handbookSection.parentId, chapterId))
		.orderBy(asc(handbookSection.ordinal));
}

/** All sections under a reference flattened in tree order (chapter, then sections, then subsections). */
export async function listAllSectionsForReference(
	referenceId: string,
	db: Db = defaultDb,
): Promise<HandbookSectionRow[]> {
	return db
		.select()
		.from(handbookSection)
		.where(eq(handbookSection.referenceId, referenceId))
		.orderBy(asc(handbookSection.code));
}

export interface HandbookSectionView {
	section: HandbookSectionRow;
	chapter: HandbookSectionRow;
	figures: HandbookFigureRow[];
	/** Sibling sections under the same chapter -- powers the sticky TOC. */
	siblings: HandbookSectionRow[];
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
		.from(handbookSection)
		.where(and(eq(handbookSection.referenceId, referenceId), eq(handbookSection.code, fullCode)))
		.limit(1);
	const section = sectionRows[0];
	if (!section) throw new HandbookSectionNotFoundError({ referenceId, code: fullCode });

	const chapterRows = await db
		.select()
		.from(handbookSection)
		.where(and(eq(handbookSection.referenceId, referenceId), eq(handbookSection.code, chapterCode)))
		.limit(1);
	const chapter = chapterRows[0];
	if (!chapter) throw new HandbookSectionNotFoundError({ referenceId, code: chapterCode });

	const figures = await db
		.select()
		.from(handbookFigure)
		.where(eq(handbookFigure.sectionId, section.id))
		.orderBy(asc(handbookFigure.ordinal));

	const siblings = await db
		.select()
		.from(handbookSection)
		.where(eq(handbookSection.parentId, chapter.id))
		.orderBy(asc(handbookSection.ordinal));

	return { section, chapter, figures, siblings };
}

/** Convenience: resolve a section by chapter-only code (chapter overview pages). */
export async function getHandbookChapter(
	referenceId: string,
	chapterCode: string,
	db: Db = defaultDb,
): Promise<HandbookSectionRow> {
	const rows = await db
		.select()
		.from(handbookSection)
		.where(and(eq(handbookSection.referenceId, referenceId), eq(handbookSection.code, chapterCode)))
		.limit(1);
	const row = rows[0];
	if (!row) throw new HandbookSectionNotFoundError({ referenceId, code: chapterCode });
	return row;
}

/** Figures bound to any handbook_section row (chapter or section), ordered. */
export async function listFiguresForSection(sectionId: string, db: Db = defaultDb): Promise<HandbookFigureRow[]> {
	return db
		.select()
		.from(handbookFigure)
		.where(eq(handbookFigure.sectionId, sectionId))
		.orderBy(asc(handbookFigure.ordinal));
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

// ---------------------------------------------------------------------------
// Citation URL resolver
// ---------------------------------------------------------------------------

/**
 * Resolve a structured citation to a URL. v1 only handles `kind === 'handbook'`;
 * every other kind returns `null` so the UI can fall back to "no link
 * available." Legacy freeform citations (no `kind` field) also return `null`.
 */
export function resolveCitationUrl(citation: Citation, references: ReadonlyArray<ReferenceRow>): string | null {
	if (!isStructuredCitation(citation)) return null;
	if (citation.kind !== REFERENCE_KINDS.HANDBOOK) return null;
	const ref = references.find((r) => r.id === citation.reference_id);
	if (!ref) return null;
	const { chapter, section } = citation.locator;
	if (section === undefined) return ROUTES.HANDBOOK_CHAPTER(ref.documentSlug, chapter);
	return ROUTES.HANDBOOK_SECTION(ref.documentSlug, chapter, section);
}

// ---------------------------------------------------------------------------
// Read state -- read paths
// ---------------------------------------------------------------------------

/** Fetch the read-state row for a (user, section) pair. Returns null when none exists. */
export async function getReadState(
	userId: string,
	handbookSectionId: string,
	db: Db = defaultDb,
): Promise<HandbookReadStateRow | null> {
	const rows = await db
		.select()
		.from(handbookReadState)
		.where(and(eq(handbookReadState.userId, userId), eq(handbookReadState.handbookSectionId, handbookSectionId)))
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
 * Per-(user, reference) progress summary used on the handbook overview card.
 * Counts every non-chapter row as a section -- chapters are scaffolding, not
 * content, so coverage is computed against the leaf-bearing rows.
 */
export async function getHandbookProgress(
	userId: string,
	referenceId: string,
	db: Db = defaultDb,
): Promise<HandbookProgressSummary> {
	const totalsRow = await db
		.select({ total: sql<number>`count(*)::int` })
		.from(handbookSection)
		.where(
			and(
				eq(handbookSection.referenceId, referenceId),
				sql`${handbookSection.level} <> ${HANDBOOK_SECTION_LEVELS.CHAPTER}`,
			),
		);
	const totalSections = totalsRow[0]?.total ?? 0;

	const readStateRows = await db
		.select({
			status: handbookReadState.status,
			comprehended: handbookReadState.comprehended,
		})
		.from(handbookReadState)
		.innerJoin(handbookSection, eq(handbookReadState.handbookSectionId, handbookSection.id))
		.where(and(eq(handbookReadState.userId, userId), eq(handbookSection.referenceId, referenceId)));

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

// ---------------------------------------------------------------------------
// Read state -- write paths
// ---------------------------------------------------------------------------

/**
 * Set the explicit read status for a (user, section) pair. Upserts the row
 * (composite PK is `(user_id, handbook_section_id)`). Updates `last_read_at`
 * on every write so the dashboard's "recent reads" lens stays current.
 *
 * Allowed transitions: any of unread / reading / read. The system never
 * automatically advances to `read`; users do that explicitly via this entry.
 */
export async function setReadStatus(
	userId: string,
	handbookSectionId: string,
	status: HandbookReadStatus,
	db: Db = defaultDb,
): Promise<HandbookReadStateRow> {
	const insert = {
		userId,
		handbookSectionId,
		status,
		comprehended: false,
		lastReadAt: new Date(),
		openedCount: 0,
		totalSecondsVisible: 0,
		notesMd: '',
	} satisfies Omit<HandbookReadStateRow, 'createdAt' | 'updatedAt' | 'seedOrigin'> & { seedOrigin?: string | null };

	const rows = await db
		.insert(handbookReadState)
		.values(insert)
		.onConflictDoUpdate({
			target: [handbookReadState.userId, handbookReadState.handbookSectionId],
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
	handbookSectionId: string,
	comprehended: boolean,
	db: Db = defaultDb,
): Promise<HandbookReadStateRow> {
	const existing = await getReadState(userId, handbookSectionId, db);
	if (comprehended && (!existing || existing.status === HANDBOOK_READ_STATUSES.UNREAD)) {
		throw new HandbookValidationError('Cannot mark a section "didn\'t get it" before opening it.');
	}

	const insert = {
		userId,
		handbookSectionId,
		status: existing?.status ?? HANDBOOK_READ_STATUSES.UNREAD,
		comprehended,
		lastReadAt: existing?.lastReadAt ?? null,
		openedCount: existing?.openedCount ?? 0,
		totalSecondsVisible: existing?.totalSecondsVisible ?? 0,
		notesMd: existing?.notesMd ?? '',
	};

	const rows = await db
		.insert(handbookReadState)
		.values(insert)
		.onConflictDoUpdate({
			target: [handbookReadState.userId, handbookReadState.handbookSectionId],
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
	handbookSectionId: string,
	db: Db = defaultDb,
): Promise<HandbookReadStateRow> {
	const rows = await db
		.update(handbookReadState)
		.set({
			status: HANDBOOK_READ_STATUSES.UNREAD,
			comprehended: false,
			updatedAt: new Date(),
		})
		.where(and(eq(handbookReadState.userId, userId), eq(handbookReadState.handbookSectionId, handbookSectionId)))
		.returning();
	const row = rows[0];
	if (!row) {
		throw new HandbookValidationError(
			`markAsReread: no read-state row for user ${userId} on section ${handbookSectionId}`,
		);
	}
	return row;
}

/** Persist user notes for a section. Validates length against `HANDBOOK_NOTES_MAX_LENGTH`. */
export async function setNotes(
	userId: string,
	handbookSectionId: string,
	notesMd: string,
	db: Db = defaultDb,
): Promise<HandbookReadStateRow> {
	if (notesMd.length > HANDBOOK_NOTES_MAX_LENGTH) {
		throw new HandbookValidationError(`Notes exceed ${HANDBOOK_NOTES_MAX_LENGTH} characters.`);
	}

	const insert = {
		userId,
		handbookSectionId,
		status: HANDBOOK_READ_STATUSES.UNREAD,
		comprehended: false,
		openedCount: 0,
		totalSecondsVisible: 0,
		notesMd,
	};

	const rows = await db
		.insert(handbookReadState)
		.values(insert)
		.onConflictDoUpdate({
			target: [handbookReadState.userId, handbookReadState.handbookSectionId],
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
	handbookSectionId: string,
	deltaSeconds: number,
	db: Db = defaultDb,
): Promise<HandbookReadStateRow> {
	if (deltaSeconds < HANDBOOK_HEARTBEAT_MIN_DELTA_SEC) {
		throw new HandbookValidationError(
			`Heartbeat delta ${deltaSeconds}s below minimum ${HANDBOOK_HEARTBEAT_MIN_DELTA_SEC}s.`,
		);
	}
	const cappedDelta = Math.min(deltaSeconds, HANDBOOK_HEARTBEAT_INTERVAL_SEC * 4);
	const now = new Date();

	const insert = {
		userId,
		handbookSectionId,
		status: HANDBOOK_READ_STATUSES.READING,
		comprehended: false,
		lastReadAt: now,
		openedCount: 1,
		totalSecondsVisible: cappedDelta,
		notesMd: '',
	};

	const rows = await db
		.insert(handbookReadState)
		.values(insert)
		.onConflictDoUpdate({
			target: [handbookReadState.userId, handbookReadState.handbookSectionId],
			set: {
				totalSecondsVisible: sql`${handbookReadState.totalSecondsVisible} + ${cappedDelta}`,
				lastReadAt: now,
				// Only auto-advance unread -> reading; never overwrite an explicit
				// `read` status with the heartbeat tick.
				status: sql`CASE WHEN ${handbookReadState.status} = ${HANDBOOK_READ_STATUSES.UNREAD} THEN ${HANDBOOK_READ_STATUSES.READING} ELSE ${handbookReadState.status} END`,
				updatedAt: now,
			},
		})
		.returning();

	const row = rows[0];
	if (!row) throw new HandbookValidationError('recordHeartbeat: upsert returned no row');
	return row;
}

// ---------------------------------------------------------------------------
// Build-only helpers (consumed by scripts/db/seed-handbooks.ts; not exported
// from the BC barrel).
// ---------------------------------------------------------------------------

export interface UpsertReferenceInput {
	kind: ReferenceRow['kind'];
	documentSlug: string;
	edition: string;
	title: string;
	publisher?: string;
	url?: string | null;
	seedOrigin?: string | null;
}

/** Insert or update a `reference` row; returns the post-write row. */
export async function upsertReference(input: UpsertReferenceInput, db: Db = defaultDb): Promise<ReferenceRow> {
	const values: NewReferenceRow = {
		id: generateReferenceId(),
		kind: input.kind,
		documentSlug: input.documentSlug,
		edition: input.edition,
		title: input.title,
		publisher: input.publisher ?? 'FAA',
		url: input.url ?? null,
		seedOrigin: input.seedOrigin ?? null,
	};

	const rows = await db
		.insert(reference)
		.values(values)
		.onConflictDoUpdate({
			target: [reference.documentSlug, reference.edition],
			set: {
				kind: input.kind,
				title: input.title,
				publisher: input.publisher ?? 'FAA',
				url: input.url ?? null,
				seedOrigin: input.seedOrigin ?? null,
				updatedAt: new Date(),
			},
		})
		.returning();

	const row = rows[0];
	if (!row)
		throw new HandbookValidationError(
			`upsertReference: insert returned no row for ${input.documentSlug}@${input.edition}`,
		);
	return row;
}

export interface UpsertHandbookSectionInput {
	referenceId: string;
	parentId: string | null;
	level: HandbookSectionRow['level'];
	ordinal: number;
	code: string;
	title: string;
	faaPageStart: number | null;
	faaPageEnd: number | null;
	sourceLocator: string;
	contentMd: string;
	contentHash: string;
	hasFigures: boolean;
	hasTables: boolean;
	seedOrigin?: string | null;
}

/**
 * Upsert a handbook_section row by `(reference_id, code)`. Returns
 * `{row, changed}` so the caller can mass-replace figures only when the
 * section's body actually changed (idempotent re-seed).
 */
export async function upsertHandbookSection(
	input: UpsertHandbookSectionInput,
	db: Db = defaultDb,
): Promise<{ row: HandbookSectionRow; changed: boolean }> {
	const existing = await db
		.select()
		.from(handbookSection)
		.where(and(eq(handbookSection.referenceId, input.referenceId), eq(handbookSection.code, input.code)))
		.limit(1);
	const prev = existing[0];

	const values: NewHandbookSectionRow = {
		id: prev?.id ?? generateHandbookSectionId(),
		referenceId: input.referenceId,
		parentId: input.parentId,
		level: input.level,
		ordinal: input.ordinal,
		code: input.code,
		title: input.title,
		faaPageStart: input.faaPageStart,
		faaPageEnd: input.faaPageEnd,
		sourceLocator: input.sourceLocator,
		contentMd: input.contentMd,
		contentHash: input.contentHash,
		hasFigures: input.hasFigures,
		hasTables: input.hasTables,
		seedOrigin: input.seedOrigin ?? null,
	};

	if (prev && prev.contentHash === input.contentHash) {
		// Hash matches -- skip body upsert. Refresh scaffolding fields
		// (parent / ordinal / locator / hasFigures / hasTables) in case the
		// extractor moved a section without re-extracting its body.
		const rows = await db
			.update(handbookSection)
			.set({
				parentId: input.parentId,
				ordinal: input.ordinal,
				title: input.title,
				faaPageStart: input.faaPageStart,
				faaPageEnd: input.faaPageEnd,
				sourceLocator: input.sourceLocator,
				hasFigures: input.hasFigures,
				hasTables: input.hasTables,
				updatedAt: new Date(),
			})
			.where(eq(handbookSection.id, prev.id))
			.returning();
		const row = rows[0] ?? prev;
		return { row, changed: false };
	}

	const rows = await db
		.insert(handbookSection)
		.values(values)
		.onConflictDoUpdate({
			target: [handbookSection.referenceId, handbookSection.code],
			set: {
				parentId: input.parentId,
				level: input.level,
				ordinal: input.ordinal,
				title: input.title,
				faaPageStart: input.faaPageStart,
				faaPageEnd: input.faaPageEnd,
				sourceLocator: input.sourceLocator,
				contentMd: input.contentMd,
				contentHash: input.contentHash,
				hasFigures: input.hasFigures,
				hasTables: input.hasTables,
				seedOrigin: input.seedOrigin ?? null,
				updatedAt: new Date(),
			},
		})
		.returning();
	const row = rows[0];
	if (!row) {
		throw new HandbookValidationError(
			`upsertHandbookSection: insert returned no row for ${input.referenceId} / ${input.code}`,
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
): Promise<HandbookFigureRow[]> {
	await db.delete(handbookFigure).where(eq(handbookFigure.sectionId, sectionId));
	if (figures.length === 0) return [];
	const values: NewHandbookFigureRow[] = figures.map((f) => ({
		id: generateHandbookFigureId(),
		sectionId,
		ordinal: f.ordinal,
		caption: f.caption,
		assetPath: f.assetPath,
		width: f.width,
		height: f.height,
		seedOrigin,
	}));
	return db.insert(handbookFigure).values(values).returning();
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
