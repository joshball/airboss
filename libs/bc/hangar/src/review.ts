/**
 * Hangar review queue BC primitives.
 *
 * Owns reads + writes of the eight review-queue tables (`board`,
 * `board_column`, `review_kind`, `review_bucket`, `review_item`,
 * `review_session`, `review_step`, `board_task`). Pages and form actions
 * call these helpers; the loader (review-loader.ts) layers discovery + FTS
 * walks on top.
 *
 * Design notes:
 *
 * - `getOrCreateBoard()` is idempotent and transactional: hangar boots into
 *   a single `Hangar Review` board with default columns + kinds seeded in
 *   one atomic write so a process kill mid-seed cannot leave a board with
 *   no columns.
 * - Items are upsert-keyed on `(boardId, kindId, ref)` among live rows. The
 *   loader soft-deletes when an artifact disappears so its session history
 *   survives a temporary rename / move. Resurrection clears any stale
 *   user pin so a downgraded `frontmatter_status` doesn't stay masked.
 * - One open review session per `(itemId, userId)` -- a `uniqueIndex`
 *   partial-on-`finishedAt IS NULL` enforces it; reopening the walker for
 *   an item with an open session reuses that row. The race-loser path only
 *   retries on PG `23505` (unique violation); other errors propagate.
 * - Step writes are idempotent on `(sessionId, stepRef)` -- saving the same
 *   step twice overwrites the prior outcome / note.
 */

import {
	type FrontmatterReviewStatus,
	type FrontmatterStatus,
	type ProductArea,
	REVIEW_BOARD_DEFAULT_COLUMNS,
	REVIEW_BOARD_DEFAULT_NAME,
	REVIEW_KIND_LABELS,
	REVIEW_KIND_VALUES,
	REVIEW_LIST_HARD_CAP,
	REVIEW_SESSION_HISTORY_LIMIT,
	type ReviewKind,
	type ReviewOutcome,
	type SessionOutcome,
	type TaskType,
} from '@ab/constants';
import { db as defaultDb } from '@ab/db/connection';
import {
	generateHangarBoardColumnId,
	generateHangarBoardId,
	generateHangarBoardTaskId,
	generateHangarReviewBucketId,
	generateHangarReviewItemId,
	generateHangarReviewSessionId,
	generateHangarReviewStepId,
} from '@ab/utils';
import { and, asc, desc, eq, inArray, isNull } from 'drizzle-orm';
import type { PgDatabase, PgQueryResultHKT } from 'drizzle-orm/pg-core';
import {
	type CachedFrontmatterFields,
	type HangarBoardRow,
	type HangarBoardTaskRow,
	type HangarReviewBucketRow,
	type HangarReviewItemRow,
	type HangarReviewKindRow,
	type HangarReviewSessionRow,
	type HangarReviewStepRow,
	hangarBoard,
	hangarBoardColumn,
	hangarBoardTask,
	hangarReviewBucket,
	hangarReviewItem,
	hangarReviewKind,
	hangarReviewSession,
	hangarReviewStep,
	type NewHangarBoardTaskRow,
} from './schema';

type Db = PgDatabase<PgQueryResultHKT, Record<string, never>>;

// ---------------------------------------------------------------------------
// Boards + columns
// ---------------------------------------------------------------------------

/**
 * Idempotent board getter. Creates the default `Hangar Review` board on first
 * call along with `REVIEW_BOARD_DEFAULT_COLUMNS` columns and `REVIEW_KIND_VALUES`
 * kinds. Buckets are NOT seeded here (callers seed buckets explicitly via
 * `seedDefaultBuckets()` after the board exists).
 *
 * Wraps the create-and-seed branch in a transaction so a process kill mid-seed
 * cannot leave a board with no columns.
 */
export async function getOrCreateBoard(db: Db = defaultDb): Promise<HangarBoardRow> {
	const existing = await db.select().from(hangarBoard).where(eq(hangarBoard.name, REVIEW_BOARD_DEFAULT_NAME)).limit(1);
	if (existing[0]) {
		// Existing board: ensure seeders have run (idempotent; no tx needed).
		await seedDefaultColumns(existing[0].id, db);
		await seedReviewKinds(db);
		return existing[0];
	}
	// Fresh board: insert + seed inside a single transaction.
	return db.transaction(async (tx) => {
		const id = generateHangarBoardId();
		const inserted = await tx.insert(hangarBoard).values({ id, name: REVIEW_BOARD_DEFAULT_NAME }).returning();
		const board = inserted[0];
		if (!board) {
			throw new Error('getOrCreateBoard: insert returned no row');
		}
		await seedDefaultColumns(board.id, tx);
		await seedReviewKinds(tx);
		return board;
	});
}

/** Insert any missing default columns for the given board. Idempotent. */
export async function seedDefaultColumns(boardId: string, db: Db = defaultDb): Promise<void> {
	const existing = await db
		.select({ name: hangarBoardColumn.name })
		.from(hangarBoardColumn)
		.where(eq(hangarBoardColumn.boardId, boardId));
	const have = new Set(existing.map((r) => r.name));
	// `name` is typed `ReviewBoardDefaultColumn`; sortOrder is its position
	// in the canonical default-column list. No fallback branch needed because
	// the filter source is the same array we're indexing into.
	const toInsert = REVIEW_BOARD_DEFAULT_COLUMNS.filter((name) => !have.has(name)).map((name) => ({
		id: generateHangarBoardColumnId(),
		boardId,
		name,
		sortOrder: REVIEW_BOARD_DEFAULT_COLUMNS.indexOf(name),
	}));
	if (toInsert.length === 0) return;
	await db.insert(hangarBoardColumn).values(toInsert);
}

/** List columns for a board ordered by `sortOrder`. */
export async function listColumns(boardId: string, db: Db = defaultDb) {
	return db
		.select()
		.from(hangarBoardColumn)
		.where(eq(hangarBoardColumn.boardId, boardId))
		.orderBy(asc(hangarBoardColumn.sortOrder));
}

/** Insert a single column. Returns the new row. */
export async function createColumn(input: { boardId: string; name: string; sortOrder?: number }, db: Db = defaultDb) {
	const id = generateHangarBoardColumnId();
	const inserted = await db
		.insert(hangarBoardColumn)
		.values({ id, boardId: input.boardId, name: input.name, sortOrder: input.sortOrder ?? 0 })
		.returning();
	if (!inserted[0]) throw new Error('createColumn: insert returned no row');
	return inserted[0];
}

// ---------------------------------------------------------------------------
// Kinds
// ---------------------------------------------------------------------------

/** List all review kinds in the database. Pre-seeded with `REVIEW_KIND_VALUES`. */
export async function listKinds(db: Db = defaultDb): Promise<readonly HangarReviewKindRow[]> {
	return db.select().from(hangarReviewKind).orderBy(asc(hangarReviewKind.id));
}

/**
 * Insert any kinds in `REVIEW_KIND_VALUES` that are missing. Idempotent;
 * safe to call on every boot.
 */
export async function seedReviewKinds(db: Db = defaultDb): Promise<void> {
	const existing = await db.select({ id: hangarReviewKind.id }).from(hangarReviewKind);
	const have = new Set(existing.map((r) => r.id as ReviewKind));
	const toInsert = REVIEW_KIND_VALUES.filter((k) => !have.has(k)).map((k) => ({
		id: k,
		label: REVIEW_KIND_LABELS[k],
		defaultColumnMapping: null,
		discoveryRule: null,
	}));
	if (toInsert.length === 0) return;
	await db.insert(hangarReviewKind).values(toInsert);
}

// ---------------------------------------------------------------------------
// Buckets
// ---------------------------------------------------------------------------

/** List buckets for a board ordered by `sortOrder`. */
export async function listBuckets(boardId: string, db: Db = defaultDb): Promise<readonly HangarReviewBucketRow[]> {
	return db
		.select()
		.from(hangarReviewBucket)
		.where(eq(hangarReviewBucket.boardId, boardId))
		.orderBy(asc(hangarReviewBucket.sortOrder));
}

/**
 * Default bucket seed list. The loader populates items; bucket admin (Phase 7)
 * lets a user customise. Each entry maps to a `REVIEW_KIND_VALUES` kind plus
 * a structured `filterCriteria` predicate.
 */
const DEFAULT_BUCKET_SEEDS: ReadonlyArray<{
	name: string;
	kindId: ReviewKind;
	sortOrder: number;
	filterCriteria: Record<string, unknown>;
}> = [
	{
		name: 'WP Specs -- unread',
		kindId: 'wp_spec',
		sortOrder: 0,
		filterCriteria: { kind: 'wp_spec', frontmatterStatus: ['unread'] },
	},
	{
		name: 'WP Specs -- reading',
		kindId: 'wp_spec',
		sortOrder: 1,
		filterCriteria: { kind: 'wp_spec', frontmatterStatus: ['reading'] },
	},
	{
		name: 'WP Test Plans -- pending',
		kindId: 'wp_test_plan',
		sortOrder: 2,
		filterCriteria: { kind: 'wp_test_plan', reviewStatus: ['pending'] },
	},
	{
		name: 'References -- TOC review',
		kindId: 'reference_toc',
		sortOrder: 3,
		filterCriteria: { kind: 'reference_toc' },
	},
	{
		name: 'Knowledge nodes -- pending discovery',
		kindId: 'knowledge_node',
		sortOrder: 4,
		filterCriteria: { kind: 'knowledge_node', reviewStatus: ['pending'] },
	},
	{
		name: 'Ad-hoc tasks',
		kindId: 'ad_hoc',
		sortOrder: 5,
		filterCriteria: { kind: 'ad_hoc' },
	},
];

/** Insert any default buckets that are missing for the given board. Idempotent. */
export async function seedDefaultBuckets(boardId: string, db: Db = defaultDb): Promise<void> {
	const existing = await db
		.select({ name: hangarReviewBucket.name })
		.from(hangarReviewBucket)
		.where(eq(hangarReviewBucket.boardId, boardId));
	const have = new Set(existing.map((r) => r.name));
	const toInsert = DEFAULT_BUCKET_SEEDS.filter((b) => !have.has(b.name)).map((b) => ({
		id: generateHangarReviewBucketId(),
		boardId,
		name: b.name,
		kindId: b.kindId,
		filterCriteria: b.filterCriteria,
		sortOrder: b.sortOrder,
	}));
	if (toInsert.length === 0) return;
	await db.insert(hangarReviewBucket).values(toInsert);
}

export interface CreateBucketInput {
	boardId: string;
	name: string;
	kindId: ReviewKind;
	filterCriteria: Record<string, unknown>;
	sortOrder: number;
}

/** Create a new bucket. Throws if the name is not unique on the board. */
export async function createBucket(input: CreateBucketInput, db: Db = defaultDb): Promise<HangarReviewBucketRow> {
	const id = generateHangarReviewBucketId();
	const inserted = await db
		.insert(hangarReviewBucket)
		.values({ id, ...input })
		.returning();
	if (!inserted[0]) throw new Error('createBucket: insert returned no row');
	return inserted[0];
}

/** Update an existing bucket. Returns the updated row. */
export async function updateBucket(
	id: string,
	patch: Partial<Omit<CreateBucketInput, 'boardId'>>,
	db: Db = defaultDb,
): Promise<HangarReviewBucketRow> {
	const updated = await db.update(hangarReviewBucket).set(patch).where(eq(hangarReviewBucket.id, id)).returning();
	if (!updated[0]) throw new Error(`updateBucket: bucket ${id} not found`);
	return updated[0];
}

/** Hard-delete a bucket. Items are not deleted; they fall through to whatever bucket catches them. */
export async function deleteBucket(id: string, db: Db = defaultDb): Promise<void> {
	await db.delete(hangarReviewBucket).where(eq(hangarReviewBucket.id, id));
}

// ---------------------------------------------------------------------------
// Items
// ---------------------------------------------------------------------------

export interface ListItemsFilters {
	kindIds?: readonly ReviewKind[];
	/** Restrict to items whose `frontmatterStatus` is in this set. */
	frontmatterStatus?: readonly FrontmatterStatus[];
	/** Restrict to items whose `reviewStatus` is in this set. */
	reviewStatus?: readonly FrontmatterReviewStatus[];
	/** Cap; defaults to `REVIEW_LIST_HARD_CAP`. */
	limit?: number;
}

/**
 * List items for a board with optional kind / status filters. Soft-deleted
 * rows are excluded. Capped at `REVIEW_LIST_HARD_CAP` so a runaway loader
 * scan doesn't fan out the page. Tie-broken on `id` (ULID time-ascending) so
 * equal-(sortOrder, title) pairs render in a stable order across requests.
 */
export async function listItems(
	boardId: string,
	filters: ListItemsFilters = {},
	db: Db = defaultDb,
): Promise<readonly HangarReviewItemRow[]> {
	const limit = Math.min(filters.limit ?? REVIEW_LIST_HARD_CAP, REVIEW_LIST_HARD_CAP);
	const conditions = [eq(hangarReviewItem.boardId, boardId), isNull(hangarReviewItem.deletedAt)];
	if (filters.kindIds && filters.kindIds.length > 0) {
		conditions.push(inArray(hangarReviewItem.kindId, [...filters.kindIds]));
	}
	if (filters.frontmatterStatus && filters.frontmatterStatus.length > 0) {
		conditions.push(inArray(hangarReviewItem.frontmatterStatus, [...filters.frontmatterStatus]));
	}
	if (filters.reviewStatus && filters.reviewStatus.length > 0) {
		conditions.push(inArray(hangarReviewItem.reviewStatus, [...filters.reviewStatus]));
	}
	return db
		.select()
		.from(hangarReviewItem)
		.where(and(...conditions))
		.orderBy(asc(hangarReviewItem.sortOrder), asc(hangarReviewItem.title), asc(hangarReviewItem.id))
		.limit(limit);
}

/** Get a single item by id (live or soft-deleted). */
export async function getItem(id: string, db: Db = defaultDb): Promise<HangarReviewItemRow | null> {
	const rows = await db.select().from(hangarReviewItem).where(eq(hangarReviewItem.id, id)).limit(1);
	return rows[0] ?? null;
}

export interface UpsertItemInput {
	boardId: string;
	kindId: ReviewKind;
	ref: string;
	title: string;
	frontmatterStatus: FrontmatterStatus | null;
	reviewStatus: FrontmatterReviewStatus | null;
	cachedFields: CachedFrontmatterFields;
}

/**
 * Upsert an item by `(boardId, kindId, ref)` among live rows. Resurrects a
 * soft-deleted row if one exists so session history survives a transient
 * rename. Resurrection clears any prior `pinnedColumnId` so a stale pin
 * doesn't mask a frontmatter status change while the file was missing.
 * Returns the upserted row.
 */
export async function upsertItem(input: UpsertItemInput, db: Db = defaultDb): Promise<HangarReviewItemRow> {
	const now = new Date();
	// Try to find an existing row (live or deleted) for the loader's idempotency key.
	const existing = await db
		.select()
		.from(hangarReviewItem)
		.where(
			and(
				eq(hangarReviewItem.boardId, input.boardId),
				eq(hangarReviewItem.kindId, input.kindId),
				eq(hangarReviewItem.ref, input.ref),
			),
		)
		.limit(1);
	if (existing[0]) {
		const row = existing[0];
		const wasDeleted = row.deletedAt !== null;
		const updated = await db
			.update(hangarReviewItem)
			.set({
				title: input.title,
				frontmatterStatus: input.frontmatterStatus,
				reviewStatus: input.reviewStatus,
				cachedFields: input.cachedFields,
				cachedAt: now,
				deletedAt: null,
				// Resurrection: clear stale pin so a downgraded frontmatter status
				// is reflected in the derived column. The user can re-pin if they
				// want, but a stale pin masking new state is the bigger surprise.
				...(wasDeleted ? { pinnedColumnId: null } : {}),
			})
			.where(eq(hangarReviewItem.id, row.id))
			.returning();
		if (!updated[0]) throw new Error('upsertItem: update returned no row');
		return updated[0];
	}
	const id = generateHangarReviewItemId();
	const inserted = await db
		.insert(hangarReviewItem)
		.values({
			id,
			boardId: input.boardId,
			kindId: input.kindId,
			ref: input.ref,
			title: input.title,
			frontmatterStatus: input.frontmatterStatus,
			reviewStatus: input.reviewStatus,
			cachedFields: input.cachedFields,
			cachedAt: now,
		})
		.returning();
	if (!inserted[0]) throw new Error('upsertItem: insert returned no row');
	return inserted[0];
}

/** Soft-delete an item (loader uses this when its source artifact disappears). */
export async function softDeleteItem(id: string, db: Db = defaultDb): Promise<void> {
	await db.update(hangarReviewItem).set({ deletedAt: new Date() }).where(eq(hangarReviewItem.id, id));
}

/** Pin an item to a column (drag-drop). Pass `null` to clear the pin. */
export async function pinItemToColumn(
	itemId: string,
	columnId: string | null,
	db: Db = defaultDb,
): Promise<HangarReviewItemRow> {
	const updated = await db
		.update(hangarReviewItem)
		.set({ pinnedColumnId: columnId })
		.where(eq(hangarReviewItem.id, itemId))
		.returning();
	if (!updated[0]) throw new Error(`pinItemToColumn: item ${itemId} not found`);
	return updated[0];
}

// ---------------------------------------------------------------------------
// Sessions + steps
// ---------------------------------------------------------------------------

/**
 * Look up the open session for `(itemId, userId)`. Returns null when no
 * open session exists; the caller wraps this with `startSession()` to create
 * one when entering the walker.
 */
export async function getOpenSession(
	itemId: string,
	userId: string,
	db: Db = defaultDb,
): Promise<HangarReviewSessionRow | null> {
	const rows = await db
		.select()
		.from(hangarReviewSession)
		.where(
			and(
				eq(hangarReviewSession.itemId, itemId),
				eq(hangarReviewSession.userId, userId),
				isNull(hangarReviewSession.finishedAt),
			),
		)
		.limit(1);
	return rows[0] ?? null;
}

/**
 * Get the open session for `(itemId, userId)` or create a new one. Idempotent
 * for entering the walker; concurrent entries race the unique-on-finishedAt-null
 * partial index (one wins, the loser retries the SELECT). Only retries on the
 * Postgres unique-violation code (`23505`) -- other errors (FK, conn drop)
 * propagate without a redundant retry.
 */
export async function startSession(
	itemId: string,
	userId: string,
	db: Db = defaultDb,
): Promise<HangarReviewSessionRow> {
	const existing = await getOpenSession(itemId, userId, db);
	if (existing) return existing;
	const id = generateHangarReviewSessionId();
	try {
		const inserted = await db.insert(hangarReviewSession).values({ id, itemId, userId }).returning();
		if (!inserted[0]) throw new Error('startSession: insert returned no row');
		return inserted[0];
	} catch (err) {
		// Only the unique-on-(item,user)-where-finishedAt-IS-NULL violation
		// indicates a concurrent winner. Any other error (FK violation,
		// connection drop) propagates.
		if (!isPgUniqueViolation(err)) throw err;
		const retry = await getOpenSession(itemId, userId, db);
		if (retry) return retry;
		throw err;
	}
}

/** Narrow an unknown thrown value to a Postgres unique-violation error (SQLSTATE 23505). */
function isPgUniqueViolation(err: unknown): boolean {
	if (typeof err !== 'object' || err === null) return false;
	const candidate = err as { code?: unknown };
	return candidate.code === '23505';
}

/** Close a session with an outcome. Idempotent for completed sessions. */
export async function finishSession(
	sessionId: string,
	outcome: SessionOutcome,
	note: string,
	db: Db = defaultDb,
): Promise<HangarReviewSessionRow> {
	const updated = await db
		.update(hangarReviewSession)
		.set({ finishedAt: new Date(), outcome, note })
		.where(eq(hangarReviewSession.id, sessionId))
		.returning();
	if (!updated[0]) throw new Error(`finishSession: session ${sessionId} not found`);
	return updated[0];
}

/**
 * List sessions for an item, newest first. Caps at `REVIEW_SESSION_HISTORY_LIMIT`
 * (or the caller-supplied limit, whichever is smaller) so a heavy reviewer
 * doesn't fan out the right-rail history panel.
 */
export async function listSessions(
	itemId: string,
	options: { limit?: number } = {},
	db: Db = defaultDb,
): Promise<readonly HangarReviewSessionRow[]> {
	const limit = Math.min(options.limit ?? REVIEW_SESSION_HISTORY_LIMIT, REVIEW_SESSION_HISTORY_LIMIT);
	return db
		.select()
		.from(hangarReviewSession)
		.where(eq(hangarReviewSession.itemId, itemId))
		.orderBy(desc(hangarReviewSession.startedAt))
		.limit(limit);
}

export interface RecordStepInput {
	sessionId: string;
	stepIndex: number;
	stepRef: string;
	outcome: ReviewOutcome;
	note: string;
}

/**
 * Record (or overwrite) a step outcome inside a session. Idempotent on
 * `(sessionId, stepRef)`; saving the same step twice flips the prior outcome.
 */
export async function recordStep(input: RecordStepInput, db: Db = defaultDb): Promise<HangarReviewStepRow> {
	const existing = await db
		.select()
		.from(hangarReviewStep)
		.where(and(eq(hangarReviewStep.sessionId, input.sessionId), eq(hangarReviewStep.stepRef, input.stepRef)))
		.limit(1);
	if (existing[0]) {
		const updated = await db
			.update(hangarReviewStep)
			.set({ outcome: input.outcome, note: input.note, stepIndex: input.stepIndex })
			.where(eq(hangarReviewStep.id, existing[0].id))
			.returning();
		if (!updated[0]) throw new Error('recordStep: update returned no row');
		return updated[0];
	}
	const id = generateHangarReviewStepId();
	const inserted = await db
		.insert(hangarReviewStep)
		.values({
			id,
			sessionId: input.sessionId,
			stepIndex: input.stepIndex,
			stepRef: input.stepRef,
			outcome: input.outcome,
			note: input.note,
		})
		.returning();
	if (!inserted[0]) throw new Error('recordStep: insert returned no row');
	return inserted[0];
}

/** List steps for a session ordered by `stepIndex`. */
export async function listSteps(sessionId: string, db: Db = defaultDb): Promise<readonly HangarReviewStepRow[]> {
	return db
		.select()
		.from(hangarReviewStep)
		.where(eq(hangarReviewStep.sessionId, sessionId))
		.orderBy(asc(hangarReviewStep.stepIndex));
}

// ---------------------------------------------------------------------------
// Tasks (ad-hoc)
// ---------------------------------------------------------------------------

/** List tasks on a board. */
export async function listTasks(boardId: string, db: Db = defaultDb): Promise<readonly HangarBoardTaskRow[]> {
	return db
		.select()
		.from(hangarBoardTask)
		.where(eq(hangarBoardTask.boardId, boardId))
		.orderBy(asc(hangarBoardTask.sortOrder));
}

export interface CreateTaskInput {
	boardId: string;
	columnId?: string | null;
	title: string;
	description?: string;
	type: TaskType;
	productArea: ProductArea;
	assigneeId?: string | null;
	createdBy?: string | null;
	sortOrder?: number;
}

/**
 * Create a new ad-hoc task. Optional fields fall through to the schema
 * defaults (no double source-of-truth on default values); only fields the
 * caller actually provided are passed to the insert.
 */
export async function createTask(input: CreateTaskInput, db: Db = defaultDb): Promise<HangarBoardTaskRow> {
	const id = generateHangarBoardTaskId();
	const values: NewHangarBoardTaskRow = {
		id,
		boardId: input.boardId,
		title: input.title,
		type: input.type,
		productArea: input.productArea,
	};
	if (input.columnId !== undefined) values.columnId = input.columnId;
	if (input.description !== undefined) values.description = input.description;
	if (input.assigneeId !== undefined) values.assigneeId = input.assigneeId;
	if (input.createdBy !== undefined) values.createdBy = input.createdBy;
	if (input.sortOrder !== undefined) values.sortOrder = input.sortOrder;
	const inserted = await db.insert(hangarBoardTask).values(values).returning();
	if (!inserted[0]) throw new Error('createTask: insert returned no row');
	return inserted[0];
}

export interface UpdateTaskInput {
	columnId?: string | null;
	title?: string;
	description?: string;
	type?: TaskType;
	productArea?: ProductArea;
	assigneeId?: string | null;
	sortOrder?: number;
}

/** Update a task. Returns the updated row. */
export async function updateTask(id: string, patch: UpdateTaskInput, db: Db = defaultDb): Promise<HangarBoardTaskRow> {
	const updated = await db.update(hangarBoardTask).set(patch).where(eq(hangarBoardTask.id, id)).returning();
	if (!updated[0]) throw new Error(`updateTask: task ${id} not found`);
	return updated[0];
}

/** Delete a task. Idempotent. */
export async function deleteTask(id: string, db: Db = defaultDb): Promise<void> {
	await db.delete(hangarBoardTask).where(eq(hangarBoardTask.id, id));
}
