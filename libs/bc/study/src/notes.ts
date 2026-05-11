/**
 * Notes BC -- platform-wide note primitive (wp-notes-primitive).
 *
 * A note is a markdown thought attached to optional context (reference,
 * section, knowledge node, course, goal, syllabus node) plus free-form
 * tags. None-of-context = freestanding note. Notes survive "where did
 * I write that" because every relevant FK is captured. Follow-ups
 * capture intent without becoming a task manager.
 *
 * This module owns the lifecycle: create, read, update, archive,
 * restore, delete, search. Every mutation writes one audit row tagged
 * `study.note` so an admin can trace per-user note history.
 *
 * Search uses Postgres ILIKE for Phase 1; Phase 3 of the WP adds a
 * `pg_trgm` GIN index on `body_md` if the data demands it.
 */

import { AUDIT_OPS, auditWrite } from '@ab/audit';
import {
	ANNOTATION_ANCHOR_TEXT_MAX_LENGTH,
	ANNOTATION_CONTEXT_MAX_LENGTH,
	ANNOTATION_KINDS,
	ANNOTATION_OP_SUBKINDS,
	AUDIT_TARGETS,
	NOTE_BODY_MAX_LENGTH,
	NOTE_EXCERPT_MAX_LENGTH,
	NOTE_FOLLOW_UP_MAX_LENGTH,
	NOTE_OP_SUBKINDS,
	NOTE_TAG_MAX_LENGTH,
	NOTE_TAGS_MAX,
	NOTE_TITLE_MAX_LENGTH,
	NOTES_ARCHIVED_FILTER,
	NOTES_LIST_DEFAULT_LIMIT,
	NOTES_LIST_HARD_CAP,
	NOTES_SORT,
	NOTES_SORT_DEFAULT,
	type NotesArchivedFilter,
	type NotesSort,
} from '@ab/constants';
// NOTES_SORT used by `sortColumn` / `applyCursor`.
import { escapeLikePattern } from '@ab/db';
import { db as defaultDb } from '@ab/db/connection';
import type { TextAnchor } from '@ab/utils';
import { generateAnnotationId, generateNoteId } from '@ab/utils';
import { and, asc, desc, eq, ilike, isNotNull, isNull, lt, or, type SQL, sql } from 'drizzle-orm';
import type { PgDatabase, PgQueryResultHKT } from 'drizzle-orm/pg-core';
import { z } from 'zod';
import { encodeNotesCursor } from './notes-display';
import { type NoteRow, note, type ReferenceSectionAnnotationRow, referenceSectionAnnotation } from './schema';

type Db = PgDatabase<PgQueryResultHKT, Record<string, never>>;

// ---------------------------------------------------------------------------
// Errors
// ---------------------------------------------------------------------------

/** Raised when a note can't be found for the given user. */
export class NoteNotFoundError extends Error {
	constructor(
		public readonly noteId: string,
		public readonly userId: string,
	) {
		super(`Note ${noteId} not found for user ${userId}`);
		this.name = 'NoteNotFoundError';
	}
}

/** Raised when a follow-up action targets a note that doesn't have a follow-up. */
export class NoFollowUpError extends Error {
	constructor(public readonly noteId: string) {
		super(`Note ${noteId} has no follow-up to mark done`);
		this.name = 'NoFollowUpError';
	}
}

// ---------------------------------------------------------------------------
// Zod input schemas
// ---------------------------------------------------------------------------

/**
 * Free-form tag string. Trimmed of surrounding whitespace; non-empty;
 * capped at NOTE_TAG_MAX_LENGTH. Casing is preserved -- the UI
 * lowercases at display, but the stored value retains author intent
 * (e.g. `FAR-91` vs `far-91`).
 */
const tagSchema = z
	.string()
	.transform((s) => s.trim())
	.refine((s) => s.length > 0, { message: 'Tag must not be empty.' })
	.refine((s) => s.length <= NOTE_TAG_MAX_LENGTH, {
		message: `Tag must be at most ${NOTE_TAG_MAX_LENGTH} characters.`,
	});

/**
 * Tag list. Trims, drops empties, deduplicates by lowercased value (so
 * `Stalls` and `stalls` collapse to whichever the author typed first),
 * and caps at NOTE_TAGS_MAX entries.
 */
const tagsSchema = z
	.array(tagSchema)
	.transform((arr) => {
		const seen = new Set<string>();
		const out: string[] = [];
		for (const t of arr) {
			const key = t.toLowerCase();
			if (seen.has(key)) continue;
			seen.add(key);
			out.push(t);
		}
		return out;
	})
	.refine((arr) => arr.length <= NOTE_TAGS_MAX, {
		message: `At most ${NOTE_TAGS_MAX} tags per note.`,
	});

const optionalIdSchema = z
	.union([z.string().min(1), z.null()])
	.optional()
	.transform((v) => (v === undefined || v === '' ? null : v));

/** Input for `createNote`. */
export const createNoteInputSchema = z
	.object({
		bodyMd: z
			.string()
			.transform((s) => s.trim())
			.refine((s) => s.length > 0, { message: 'Body must not be empty.' })
			.refine((s) => s.length <= NOTE_BODY_MAX_LENGTH, {
				message: `Body must be at most ${NOTE_BODY_MAX_LENGTH} characters.`,
			}),
		title: z
			.string()
			.max(NOTE_TITLE_MAX_LENGTH, { message: `Title must be at most ${NOTE_TITLE_MAX_LENGTH} characters.` })
			.optional()
			.default(''),
		quotedExcerpt: z
			.string()
			.max(NOTE_EXCERPT_MAX_LENGTH, { message: `Excerpt must be at most ${NOTE_EXCERPT_MAX_LENGTH} characters.` })
			.optional()
			.default(''),
		referenceId: optionalIdSchema,
		referenceSectionId: optionalIdSchema,
		knowledgeNodeId: optionalIdSchema,
		courseId: optionalIdSchema,
		goalId: optionalIdSchema,
		syllabusNodeId: optionalIdSchema,
		tags: tagsSchema.optional().default([]),
		followUpMd: z
			.string()
			.max(NOTE_FOLLOW_UP_MAX_LENGTH, {
				message: `Follow-up must be at most ${NOTE_FOLLOW_UP_MAX_LENGTH} characters.`,
			})
			.optional()
			.default(''),
	})
	.strict();

export type CreateNoteInput = z.input<typeof createNoteInputSchema>;
export type CreateNoteParsed = z.output<typeof createNoteInputSchema>;

/** Input for `updateNote`. Every field is optional; only set fields are patched. */
export const updateNoteInputSchema = z
	.object({
		bodyMd: z
			.string()
			.transform((s) => s.trim())
			.refine((s) => s.length > 0, { message: 'Body must not be empty.' })
			.refine((s) => s.length <= NOTE_BODY_MAX_LENGTH, {
				message: `Body must be at most ${NOTE_BODY_MAX_LENGTH} characters.`,
			})
			.optional(),
		title: z
			.string()
			.max(NOTE_TITLE_MAX_LENGTH, { message: `Title must be at most ${NOTE_TITLE_MAX_LENGTH} characters.` })
			.optional(),
		quotedExcerpt: z
			.string()
			.max(NOTE_EXCERPT_MAX_LENGTH, { message: `Excerpt must be at most ${NOTE_EXCERPT_MAX_LENGTH} characters.` })
			.optional(),
		referenceId: optionalIdSchema,
		referenceSectionId: optionalIdSchema,
		knowledgeNodeId: optionalIdSchema,
		courseId: optionalIdSchema,
		goalId: optionalIdSchema,
		syllabusNodeId: optionalIdSchema,
		tags: tagsSchema.optional(),
		followUpMd: z
			.string()
			.max(NOTE_FOLLOW_UP_MAX_LENGTH, {
				message: `Follow-up must be at most ${NOTE_FOLLOW_UP_MAX_LENGTH} characters.`,
			})
			.optional(),
	})
	.strict();

export type UpdateNoteInput = z.input<typeof updateNoteInputSchema>;

/** List options for `listNotesForUser` and `searchNotes`. */
export interface ListOpts {
	/**
	 * Archived filter -- `exclude` (default for the All view), `only`
	 * (Archived view), or `include` (audit reads).
	 */
	archived?: NotesArchivedFilter;
	/** Page size cap. Clamped at NOTES_LIST_HARD_CAP. */
	limit?: number;
	/**
	 * Cursor for pagination. Format: `<ISOTimestamp>::<noteId>`. The
	 * timestamp is the row's sort column for the active sort (createdAt
	 * for `newest` / `oldest`, updatedAt for `updated`); the id breaks
	 * ties so the cursor is monotone.
	 */
	cursor?: string | null;
	/** Sort key. Defaults to `newest`. */
	sort?: NotesSort;
}

interface ResolvedListOpts {
	archived: NotesArchivedFilter;
	limit: number;
	cursor: { timestamp: Date; noteId: string } | null;
	sort: NotesSort;
}

function resolveListOpts(opts: ListOpts | undefined): ResolvedListOpts {
	const archived = opts?.archived ?? NOTES_ARCHIVED_FILTER.EXCLUDE;
	const rawLimit = opts?.limit ?? NOTES_LIST_DEFAULT_LIMIT;
	const limit = Math.min(Math.max(1, Math.floor(rawLimit)), NOTES_LIST_HARD_CAP);
	const sort = opts?.sort ?? NOTES_SORT_DEFAULT;
	const cursor = parseCursor(opts?.cursor ?? null);
	return { archived, limit, cursor, sort };
}

function parseCursor(raw: string | null): { timestamp: Date; noteId: string } | null {
	if (raw === null) return null;
	const sep = raw.indexOf('::');
	if (sep === -1) return null;
	const ts = raw.slice(0, sep);
	const id = raw.slice(sep + 2);
	const date = new Date(ts);
	if (Number.isNaN(date.getTime()) || id.length === 0) return null;
	return { timestamp: date, noteId: id };
}

// `encodeNotesCursor` lives in `./notes-display` (browser-safe).

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function archiveCondition(archived: NotesArchivedFilter): SQL | undefined {
	if (archived === NOTES_ARCHIVED_FILTER.INCLUDE) return undefined;
	if (archived === NOTES_ARCHIVED_FILTER.ONLY) return isNotNull(note.archivedAt);
	return isNull(note.archivedAt);
}

function sortColumn(sort: NotesSort) {
	return sort === NOTES_SORT.UPDATED ? note.updatedAt : note.createdAt;
}

function applyCursor(sort: NotesSort, cursor: { timestamp: Date; noteId: string } | null): SQL | undefined {
	if (cursor === null) return undefined;
	const col = sortColumn(sort);
	if (sort === NOTES_SORT.OLDEST) {
		// Ascending sort -- next page rows have a larger (col, id).
		return or(
			sql`${col} > ${cursor.timestamp.toISOString()}::timestamptz`,
			and(eq(col, cursor.timestamp), sql`${note.id} > ${cursor.noteId}`),
		);
	}
	// Descending sort (newest / updated): next page rows have smaller (col, id).
	return or(lt(col, cursor.timestamp), and(eq(col, cursor.timestamp), sql`${note.id} < ${cursor.noteId}`));
}

function orderClause(sort: NotesSort) {
	const col = sortColumn(sort);
	return sort === NOTES_SORT.OLDEST ? [asc(col), asc(note.id)] : [desc(col), desc(note.id)];
}

function ownerScope(userId: string): SQL {
	return eq(note.userId, userId);
}

async function loadOwnedNote(noteId: string, userId: string, db: Db): Promise<NoteRow> {
	const [row] = await db
		.select()
		.from(note)
		.where(and(eq(note.id, noteId), ownerScope(userId)))
		.limit(1);
	if (!row) throw new NoteNotFoundError(noteId, userId);
	return row;
}

// ---------------------------------------------------------------------------
// Mutations
// ---------------------------------------------------------------------------

export async function createNote(userId: string, input: CreateNoteInput, db: Db = defaultDb): Promise<NoteRow> {
	const parsed = createNoteInputSchema.parse(input);

	const id = generateNoteId();
	const [row] = await db
		.insert(note)
		.values({
			id,
			userId,
			bodyMd: parsed.bodyMd,
			title: parsed.title,
			quotedExcerpt: parsed.quotedExcerpt,
			referenceId: parsed.referenceId,
			referenceSectionId: parsed.referenceSectionId,
			knowledgeNodeId: parsed.knowledgeNodeId,
			courseId: parsed.courseId,
			goalId: parsed.goalId,
			syllabusNodeId: parsed.syllabusNodeId,
			tags: parsed.tags,
			followUpMd: parsed.followUpMd,
		})
		.returning();
	if (!row) throw new Error('createNote: insert returned no row');

	await auditWrite(
		{
			actorId: userId,
			op: AUDIT_OPS.CREATE,
			targetType: AUDIT_TARGETS.NOTE,
			targetId: row.id,
			before: null,
			after: row,
		},
		db,
	);

	return row;
}

/**
 * Create a note AND its `study.reference_section_annotation` anchor row in
 * one transaction (wp-flightbag-rich-reader Phase 5). The annotation's
 * `kind = 'note_anchor'`; its `noteId` points back at the note.
 *
 * `input.referenceSectionId` is required: a note-anchor without a section
 * has nothing to anchor to. Callers that want a freestanding note should
 * use `createNote` directly.
 */
export async function createNoteWithAnchor(
	userId: string,
	sectionId: string,
	anchor: TextAnchor,
	input: CreateNoteInput,
	db: Db = defaultDb,
): Promise<{ note: NoteRow; annotation: ReferenceSectionAnnotationRow }> {
	const parsedAnchor = z
		.object({
			text: z
				.string()
				.min(1, { message: 'Anchor text must not be empty.' })
				.max(ANNOTATION_ANCHOR_TEXT_MAX_LENGTH, {
					message: `Anchor text must be at most ${ANNOTATION_ANCHOR_TEXT_MAX_LENGTH} characters.`,
				}),
			start: z.number().int().nonnegative(),
			end: z.number().int().nonnegative(),
			prefix: z.string().max(ANNOTATION_CONTEXT_MAX_LENGTH).default(''),
			suffix: z.string().max(ANNOTATION_CONTEXT_MAX_LENGTH).default(''),
		})
		.parse(anchor);

	// Force the section context onto the note so the FK is consistent with
	// the annotation row.
	const noteInput: CreateNoteInput = { ...input, referenceSectionId: sectionId };
	const parsed = createNoteInputSchema.parse(noteInput);

	return await db.transaction(async (tx) => {
		const noteId = generateNoteId();
		const [noteRow] = await tx
			.insert(note)
			.values({
				id: noteId,
				userId,
				bodyMd: parsed.bodyMd,
				title: parsed.title,
				quotedExcerpt: parsed.quotedExcerpt,
				referenceId: parsed.referenceId,
				referenceSectionId: parsed.referenceSectionId,
				knowledgeNodeId: parsed.knowledgeNodeId,
				courseId: parsed.courseId,
				goalId: parsed.goalId,
				syllabusNodeId: parsed.syllabusNodeId,
				tags: parsed.tags,
				followUpMd: parsed.followUpMd,
			})
			.returning();
		if (!noteRow) throw new Error('createNoteWithAnchor: note insert returned no row');

		await auditWrite(
			{
				actorId: userId,
				op: AUDIT_OPS.CREATE,
				targetType: AUDIT_TARGETS.NOTE,
				targetId: noteRow.id,
				before: null,
				after: noteRow,
			},
			tx,
		);

		const annId = generateAnnotationId();
		const [annRow] = await tx
			.insert(referenceSectionAnnotation)
			.values({
				id: annId,
				userId,
				referenceSectionId: sectionId,
				kind: ANNOTATION_KINDS.NOTE_ANCHOR,
				color: null,
				anchorText: parsedAnchor.text,
				anchorStart: parsedAnchor.start,
				anchorEnd: parsedAnchor.end,
				prefixContext: parsedAnchor.prefix,
				suffixContext: parsedAnchor.suffix,
				noteId: noteRow.id,
				cardDraftId: null,
			})
			.returning();
		if (!annRow) throw new Error('createNoteWithAnchor: annotation insert returned no row');

		await auditWrite(
			{
				actorId: userId,
				op: AUDIT_OPS.CREATE,
				targetType: AUDIT_TARGETS.ANNOTATION,
				targetId: annRow.id,
				before: null,
				after: annRow,
				metadata: { subKind: ANNOTATION_OP_SUBKINDS.NOTE_ANCHOR },
			},
			tx,
		);

		return { note: noteRow, annotation: annRow };
	});
}

export async function updateNote(
	noteId: string,
	userId: string,
	patch: UpdateNoteInput,
	db: Db = defaultDb,
): Promise<NoteRow> {
	const parsed = updateNoteInputSchema.parse(patch);
	const before = await loadOwnedNote(noteId, userId, db);

	// Use the raw `patch` to decide which fields the caller actually set --
	// `optionalIdSchema` transforms `undefined` to `null`, so checking
	// `parsed.referenceId !== undefined` would treat omitted fields as
	// "set to null" and trigger spurious updates.
	const has = (key: string) => Object.hasOwn(patch as Record<string, unknown>, key);
	const updates: Partial<NoteRow> = {};
	if (has('bodyMd') && parsed.bodyMd !== undefined) updates.bodyMd = parsed.bodyMd;
	if (has('title') && parsed.title !== undefined) updates.title = parsed.title;
	if (has('quotedExcerpt') && parsed.quotedExcerpt !== undefined) updates.quotedExcerpt = parsed.quotedExcerpt;
	if (has('referenceId')) updates.referenceId = parsed.referenceId;
	if (has('referenceSectionId')) updates.referenceSectionId = parsed.referenceSectionId;
	if (has('knowledgeNodeId')) updates.knowledgeNodeId = parsed.knowledgeNodeId;
	if (has('courseId')) updates.courseId = parsed.courseId;
	if (has('goalId')) updates.goalId = parsed.goalId;
	if (has('syllabusNodeId')) updates.syllabusNodeId = parsed.syllabusNodeId;
	if (has('tags') && parsed.tags !== undefined) updates.tags = parsed.tags;
	// follow_up_md edits route through `updateNote` as a regular field; the
	// CHECK constraint guards "done timestamp without a follow-up" so emptying
	// the body without using `clearFollowUp` would fail at DB layer if a
	// done timestamp existed.
	if (parsed.followUpMd !== undefined) {
		updates.followUpMd = parsed.followUpMd;
		// Clearing the follow-up clears the done timestamp too -- otherwise the
		// CHECK would reject the row.
		if (parsed.followUpMd === '') updates.followUpDoneAt = null;
	}

	if (Object.keys(updates).length === 0) {
		// No-op patch -- skip the write + audit. Avoids `updated_at` churn
		// on accidental empty submits.
		return before;
	}

	const [after] = await db
		.update(note)
		.set({ ...updates, updatedAt: sql`now()` })
		.where(and(eq(note.id, noteId), ownerScope(userId)))
		.returning();
	if (!after) throw new NoteNotFoundError(noteId, userId);

	await auditWrite(
		{
			actorId: userId,
			op: AUDIT_OPS.UPDATE,
			targetType: AUDIT_TARGETS.NOTE,
			targetId: after.id,
			before,
			after,
		},
		db,
	);

	return after;
}

export async function archiveNote(noteId: string, userId: string, db: Db = defaultDb): Promise<NoteRow> {
	const before = await loadOwnedNote(noteId, userId, db);
	if (before.archivedAt !== null) return before;

	const [after] = await db
		.update(note)
		.set({ archivedAt: sql`now()`, updatedAt: sql`now()` })
		.where(and(eq(note.id, noteId), ownerScope(userId)))
		.returning();
	if (!after) throw new NoteNotFoundError(noteId, userId);

	await auditWrite(
		{
			actorId: userId,
			op: AUDIT_OPS.UPDATE,
			targetType: AUDIT_TARGETS.NOTE,
			targetId: after.id,
			before,
			after,
			metadata: { subKind: NOTE_OP_SUBKINDS.ARCHIVE },
		},
		db,
	);
	return after;
}

export async function restoreNote(noteId: string, userId: string, db: Db = defaultDb): Promise<NoteRow> {
	const before = await loadOwnedNote(noteId, userId, db);
	if (before.archivedAt === null) return before;

	const [after] = await db
		.update(note)
		.set({ archivedAt: null, updatedAt: sql`now()` })
		.where(and(eq(note.id, noteId), ownerScope(userId)))
		.returning();
	if (!after) throw new NoteNotFoundError(noteId, userId);

	await auditWrite(
		{
			actorId: userId,
			op: AUDIT_OPS.UPDATE,
			targetType: AUDIT_TARGETS.NOTE,
			targetId: after.id,
			before,
			after,
			metadata: { subKind: NOTE_OP_SUBKINDS.RESTORE },
		},
		db,
	);
	return after;
}

export async function deleteNote(noteId: string, userId: string, db: Db = defaultDb): Promise<void> {
	const before = await loadOwnedNote(noteId, userId, db);

	const result = await db
		.delete(note)
		.where(and(eq(note.id, noteId), ownerScope(userId)))
		.returning({ id: note.id });
	if (result.length === 0) throw new NoteNotFoundError(noteId, userId);

	await auditWrite(
		{
			actorId: userId,
			op: AUDIT_OPS.DELETE,
			targetType: AUDIT_TARGETS.NOTE,
			targetId: noteId,
			before,
			after: null,
		},
		db,
	);
}

export async function markFollowUpDone(noteId: string, userId: string, db: Db = defaultDb): Promise<NoteRow> {
	const before = await loadOwnedNote(noteId, userId, db);
	if (before.followUpMd === '') throw new NoFollowUpError(noteId);
	if (before.followUpDoneAt !== null) return before;

	const [after] = await db
		.update(note)
		.set({ followUpDoneAt: sql`now()`, updatedAt: sql`now()` })
		.where(and(eq(note.id, noteId), ownerScope(userId)))
		.returning();
	if (!after) throw new NoteNotFoundError(noteId, userId);

	await auditWrite(
		{
			actorId: userId,
			op: AUDIT_OPS.UPDATE,
			targetType: AUDIT_TARGETS.NOTE,
			targetId: after.id,
			before,
			after,
			metadata: { subKind: NOTE_OP_SUBKINDS.MARK_FOLLOWUP_DONE },
		},
		db,
	);
	return after;
}

export async function clearFollowUp(noteId: string, userId: string, db: Db = defaultDb): Promise<NoteRow> {
	const before = await loadOwnedNote(noteId, userId, db);
	if (before.followUpMd === '' && before.followUpDoneAt === null) return before;

	const [after] = await db
		.update(note)
		.set({ followUpMd: '', followUpDoneAt: null, updatedAt: sql`now()` })
		.where(and(eq(note.id, noteId), ownerScope(userId)))
		.returning();
	if (!after) throw new NoteNotFoundError(noteId, userId);

	await auditWrite(
		{
			actorId: userId,
			op: AUDIT_OPS.UPDATE,
			targetType: AUDIT_TARGETS.NOTE,
			targetId: after.id,
			before,
			after,
			metadata: { subKind: NOTE_OP_SUBKINDS.CLEAR_FOLLOWUP },
		},
		db,
	);
	return after;
}

// ---------------------------------------------------------------------------
// Lookups
// ---------------------------------------------------------------------------

export async function getNote(noteId: string, userId: string, db: Db = defaultDb): Promise<NoteRow | null> {
	const [row] = await db
		.select()
		.from(note)
		.where(and(eq(note.id, noteId), ownerScope(userId)))
		.limit(1);
	return row ?? null;
}

export interface NotesListResult {
	notes: NoteRow[];
	/** Cursor to fetch the next page; `null` when there's no more data. */
	nextCursor: string | null;
}

export async function listNotesForUser(
	userId: string,
	opts: ListOpts = {},
	db: Db = defaultDb,
): Promise<NotesListResult> {
	const resolved = resolveListOpts(opts);
	const conditions: SQL[] = [ownerScope(userId)];
	const archived = archiveCondition(resolved.archived);
	if (archived !== undefined) conditions.push(archived);
	const cursor = applyCursor(resolved.sort, resolved.cursor);
	if (cursor !== undefined) conditions.push(cursor);

	const rows = await db
		.select()
		.from(note)
		.where(and(...conditions))
		.orderBy(...orderClause(resolved.sort))
		.limit(resolved.limit + 1);

	const hasMore = rows.length > resolved.limit;
	const page = hasMore ? rows.slice(0, resolved.limit) : rows;
	const last = page[page.length - 1];
	const nextCursor = hasMore && last !== undefined ? encodeNotesCursor(last, resolved.sort) : null;
	return { notes: page, nextCursor };
}

async function listByContext(userId: string, contextColumn: SQL, opts: ListOpts, db: Db): Promise<NoteRow[]> {
	const resolved = resolveListOpts({ ...opts, limit: opts.limit ?? NOTES_LIST_HARD_CAP });
	const conditions: SQL[] = [ownerScope(userId), contextColumn];
	const archived = archiveCondition(resolved.archived);
	if (archived !== undefined) conditions.push(archived);

	return db
		.select()
		.from(note)
		.where(and(...conditions))
		.orderBy(...orderClause(resolved.sort))
		.limit(resolved.limit);
}

export async function listNotesForSection(
	userId: string,
	sectionId: string,
	opts: ListOpts = {},
	db: Db = defaultDb,
): Promise<NoteRow[]> {
	return listByContext(userId, eq(note.referenceSectionId, sectionId), opts, db);
}

/**
 * "Notes for reference X" includes both notes attached directly to the
 * reference and notes attached to one of its sections. Useful for the
 * library reader's "Notes on this handbook" panel.
 */
export async function listNotesForReference(
	userId: string,
	referenceId: string,
	opts: ListOpts = {},
	db: Db = defaultDb,
): Promise<NoteRow[]> {
	const resolved = resolveListOpts({ ...opts, limit: opts.limit ?? NOTES_LIST_HARD_CAP });
	const conditions: SQL[] = [
		ownerScope(userId),
		// Either FK matches; partial indexes cover both columns.
		// The OR cannot use both indexes simultaneously without a UNION;
		// at this scale a single seq scan over the user's notes is fine.
		or(
			eq(note.referenceId, referenceId),
			sql`${note.referenceSectionId} IN (
			SELECT id FROM study.reference_section WHERE reference_id = ${referenceId}
		)`,
		) as SQL,
	];
	const archived = archiveCondition(resolved.archived);
	if (archived !== undefined) conditions.push(archived);

	return db
		.select()
		.from(note)
		.where(and(...conditions))
		.orderBy(...orderClause(resolved.sort))
		.limit(resolved.limit);
}

export async function listNotesForGoal(
	userId: string,
	goalId: string,
	opts: ListOpts = {},
	db: Db = defaultDb,
): Promise<NoteRow[]> {
	return listByContext(userId, eq(note.goalId, goalId), opts, db);
}

export async function listNotesForCourse(
	userId: string,
	courseId: string,
	opts: ListOpts = {},
	db: Db = defaultDb,
): Promise<NoteRow[]> {
	return listByContext(userId, eq(note.courseId, courseId), opts, db);
}

export async function listNotesForKnowledgeNode(
	userId: string,
	knowledgeNodeId: string,
	opts: ListOpts = {},
	db: Db = defaultDb,
): Promise<NoteRow[]> {
	return listByContext(userId, eq(note.knowledgeNodeId, knowledgeNodeId), opts, db);
}

export async function listNotesForSyllabusNode(
	userId: string,
	syllabusNodeId: string,
	opts: ListOpts = {},
	db: Db = defaultDb,
): Promise<NoteRow[]> {
	return listByContext(userId, eq(note.syllabusNodeId, syllabusNodeId), opts, db);
}

/**
 * Open follow-ups inbox: notes with a non-empty follow-up that has not
 * been marked done and isn't archived. Backed by the partial index
 * `note_follow_up_open_idx`.
 */
export async function listOpenFollowUps(userId: string, db: Db = defaultDb): Promise<NoteRow[]> {
	return db
		.select()
		.from(note)
		.where(and(ownerScope(userId), isNull(note.followUpDoneAt), isNull(note.archivedAt), sql`${note.followUpMd} != ''`))
		.orderBy(desc(note.createdAt), desc(note.id))
		.limit(NOTES_LIST_HARD_CAP);
}

/**
 * Search across body, title, quoted excerpt, and tags. Phase 1 uses
 * Postgres ILIKE -- correct for any prefix / substring query under
 * the data sizes we expect this year. Phase 3 of the WP adds a
 * `pg_trgm` GIN index when the row count justifies it.
 *
 * Empty query returns the same shape as `listNotesForUser` (no filter).
 */
export async function searchNotes(
	userId: string,
	query: string,
	opts: ListOpts = {},
	db: Db = defaultDb,
): Promise<NotesListResult> {
	const trimmed = query.trim();
	if (trimmed === '') return listNotesForUser(userId, opts, db);

	const resolved = resolveListOpts(opts);
	const conditions: SQL[] = [ownerScope(userId)];
	const archived = archiveCondition(resolved.archived);
	if (archived !== undefined) conditions.push(archived);
	const pattern = `%${escapeLikePattern(trimmed)}%`;
	const matchClause = or(
		ilike(note.bodyMd, pattern),
		ilike(note.title, pattern),
		ilike(note.quotedExcerpt, pattern),
		// `tags` is text[]; cast to text for ILIKE so a tag whose value
		// contains the query (or a substring of it) matches.
		sql`array_to_string(${note.tags}, ' ') ILIKE ${pattern}`,
	) as SQL;
	conditions.push(matchClause);
	const cursor = applyCursor(resolved.sort, resolved.cursor);
	if (cursor !== undefined) conditions.push(cursor);

	const rows = await db
		.select()
		.from(note)
		.where(and(...conditions))
		.orderBy(...orderClause(resolved.sort))
		.limit(resolved.limit + 1);

	const hasMore = rows.length > resolved.limit;
	const page = hasMore ? rows.slice(0, resolved.limit) : rows;
	const last = page[page.length - 1];
	const nextCursor = hasMore && last !== undefined ? encodeNotesCursor(last, resolved.sort) : null;
	return { notes: page, nextCursor };
}

// `deriveNoteTitle` lives in `./notes-display` (browser-safe).

// ---------------------------------------------------------------------------
// Tag cloud + autocomplete (Phase 3)
// ---------------------------------------------------------------------------

/**
 * Tag-cloud entry returned by `listTagCloud`.
 */
export interface NoteTagCount {
	tag: string;
	count: number;
}

/**
 * Distinct tags across the user's non-archived notes, with usage counts.
 * The render layer sorts and lays them out (size proportional to count).
 *
 * Implementation: a single SQL aggregation via `unnest` so the work
 * stays in Postgres rather than streaming every row to the application
 * tier. The partial GIN index on `tags` is geared toward "tag contains
 * X" queries; this aggregation is a sequential scan over the user's
 * notes regardless. Acceptable: the user note count is small (single-
 * digit thousands at most), and the tag-cloud surface is opt-in.
 *
 * Returned ordering: count descending, then tag ascending for stability.
 */
export async function listTagCloud(userId: string, db: Db = defaultDb): Promise<NoteTagCount[]> {
	const result = await db.execute<{ tag: string; count: number }>(sql`
		SELECT tag, COUNT(*)::int AS count
		FROM (
			SELECT UNNEST(tags) AS tag
			FROM study.note
			WHERE user_id = ${userId}
			  AND archived_at IS NULL
		) t
		WHERE tag <> ''
		GROUP BY tag
		ORDER BY count DESC, tag ASC
	`);
	const rows: NoteTagCount[] = [];
	for (const row of result as unknown as ReadonlyArray<{ tag: string; count: number | string }>) {
		rows.push({ tag: row.tag, count: Number(row.count) });
	}
	return rows;
}

/**
 * Distinct tags for the user, used by the chip-input autocomplete.
 * Returns just the tag strings (no counts) sorted alphabetically by
 * lowercased value -- the chip input renders them as a flat list.
 *
 * Implementation note: we use GROUP BY rather than SELECT DISTINCT so
 * the ORDER BY can reference an expression (`LOWER(tag)`) that isn't in
 * the projected column list. Postgres rejects `SELECT DISTINCT col ...
 * ORDER BY expr(col)` (SQL state 42P10) but accepts `GROUP BY col`.
 */
export async function listDistinctTags(userId: string, db: Db = defaultDb): Promise<string[]> {
	const result = await db.execute<{ tag: string }>(sql`
		SELECT tag
		FROM (
			SELECT UNNEST(tags) AS tag
			FROM study.note
			WHERE user_id = ${userId}
			  AND archived_at IS NULL
		) t
		WHERE tag <> ''
		GROUP BY tag
		ORDER BY LOWER(tag) ASC
	`);
	const rows: string[] = [];
	for (const row of result as unknown as ReadonlyArray<{ tag: string }>) {
		rows.push(row.tag);
	}
	return rows;
}
