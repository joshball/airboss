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
	REVIEW_BOARD_COLUMN_NAMES,
	REVIEW_BOARD_DEFAULT_COLUMNS,
	REVIEW_BOARD_DEFAULT_NAME,
	REVIEW_KIND_LABELS,
	REVIEW_KIND_VALUES,
	REVIEW_LIST_HARD_CAP,
	REVIEW_SESSION_HISTORY_LIMIT,
	type ReviewBoardDefaultColumn,
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
import { and, asc, desc, eq, inArray, isNull, not, sql } from 'drizzle-orm';
import type { PgDatabase, PgQueryResultHKT } from 'drizzle-orm/pg-core';
import {
	type BucketFilterCriteria,
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
// Per-item view summaries (shared between the dispatcher loader and the
// walker route's loader). These shapes are derived from the BC primitives
// (`listSteps`, `parseTestPlan`, `getOpenSession`) so co-locating the type
// next to the BC keeps a future reshape one-touch rather than splatted
// across two route files.
// ---------------------------------------------------------------------------

export interface WalkerSummary {
	readonly stepCount: number;
	readonly hasPlan: boolean;
	readonly openSessionId: string | null;
	readonly recordedSteps: number;
	readonly passCount: number;
	readonly failCount: number;
	readonly blockedCount: number;
}

export interface SessionSummary {
	readonly id: string;
	readonly startedAt: string;
	readonly finishedAt: string | null;
	readonly outcome: string | null;
	readonly note: string;
}

// ---------------------------------------------------------------------------
// Boards + columns
// ---------------------------------------------------------------------------

/**
 * Read-only lookup for the singleton review board. Returns `null` when the
 * board hasn't been seeded yet (first-ever request after a clean DB) so a
 * caller that doesn't want admin-grade write side-effects can skip the
 * default-column / default-kind seeding step. Pair with {@link getOrCreateBoard}
 * on admin-only or loader-only call sites where seeding is the right behavior.
 */
export async function getBoard(db: Db = defaultDb): Promise<HangarBoardRow | null> {
	const rows = await db.select().from(hangarBoard).where(eq(hangarBoard.name, REVIEW_BOARD_DEFAULT_NAME)).limit(1);
	return rows[0] ?? null;
}

/**
 * Idempotent board getter. Creates the default `Hangar Review` board on first
 * call along with `REVIEW_BOARD_DEFAULT_COLUMNS` columns and `REVIEW_KIND_VALUES`
 * kinds. Buckets are NOT seeded here (callers seed buckets explicitly via
 * `seedDefaultBuckets()` after the board exists).
 *
 * Wraps the create-and-seed branch in a transaction so a process kill mid-seed
 * cannot leave a board with no columns. Two concurrent first-run callers race
 * the unique-on-name index; the loser catches PG `23505` and re-fetches.
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
	try {
		return await db.transaction(async (tx) => {
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
	} catch (err) {
		// Concurrent caller won the race -- the unique-on-name index rejected
		// our INSERT. Re-fetch the winner's row.
		if (!isPgUniqueViolation(err)) throw err;
		const retry = await db.select().from(hangarBoard).where(eq(hangarBoard.name, REVIEW_BOARD_DEFAULT_NAME)).limit(1);
		if (retry[0]) return retry[0];
		throw err;
	}
}

/**
 * Insert any missing default columns for the given board. Idempotent and
 * race-safe: `onConflictDoNothing` on the (boardId, name) unique index means
 * two concurrent boots converge without surfacing PG `23505`.
 */
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
	await db.insert(hangarBoardColumn).values(toInsert).onConflictDoNothing();
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
 * Insert any kinds in `REVIEW_KIND_VALUES` that are missing. Idempotent and
 * race-safe via `onConflictDoNothing` on the PK.
 */
export async function seedReviewKinds(db: Db = defaultDb): Promise<void> {
	const existing = await db.select({ id: hangarReviewKind.id }).from(hangarReviewKind);
	const have = new Set(existing.map((r) => r.id as ReviewKind));
	const toInsert = REVIEW_KIND_VALUES.filter((k) => !have.has(k)).map((k) => ({
		id: k,
		label: REVIEW_KIND_LABELS[k],
	}));
	if (toInsert.length === 0) return;
	await db.insert(hangarReviewKind).values(toInsert).onConflictDoNothing();
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
 *
 * `reference_toc` carries `noPassingSession: true` so a TOC that has been
 * walked + passed at least once disappears from the bucket -- spec gap #2's
 * "needs review" derivation lives in the bucket filter, not the discovery
 * rule.
 */
const DEFAULT_BUCKET_SEEDS: ReadonlyArray<{
	name: string;
	kindId: ReviewKind;
	sortOrder: number;
	filterCriteria: BucketFilterCriteria;
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
		filterCriteria: { kind: 'reference_toc', noPassingSession: true },
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

/**
 * Validate a bucket filter predicate at the BC boundary. Schema-level CHECK on
 * a deeply-nested jsonb path is fragile; the BC validator is the only write
 * path so unknown keys / wrong-typed values are rejected here before the row
 * lands. Throws a `RangeError` with a useful message; callers (form actions,
 * loader) surface it back to the user.
 */
export function validateBucketFilterCriteria(input: unknown): BucketFilterCriteria {
	if (input === null || typeof input !== 'object' || Array.isArray(input)) {
		throw new RangeError('filterCriteria must be a structured object');
	}
	const obj = input as Record<string, unknown>;
	const allowed = new Set(['kind', 'frontmatterStatus', 'reviewStatus', 'noPassingSession']);
	for (const k of Object.keys(obj)) {
		if (!allowed.has(k)) throw new RangeError(`filterCriteria: unknown key '${k}'`);
	}
	const out: { -readonly [K in keyof BucketFilterCriteria]: BucketFilterCriteria[K] } = {};
	if (obj.kind !== undefined) {
		if (typeof obj.kind !== 'string') throw new RangeError('filterCriteria.kind must be a string');
		out.kind = obj.kind;
	}
	if (obj.frontmatterStatus !== undefined) {
		if (!Array.isArray(obj.frontmatterStatus))
			throw new RangeError('filterCriteria.frontmatterStatus must be a string array');
		const fs: Array<'unread' | 'reading' | 'done'> = [];
		for (const v of obj.frontmatterStatus) {
			if (v !== 'unread' && v !== 'reading' && v !== 'done')
				throw new RangeError(`filterCriteria.frontmatterStatus[]: invalid '${String(v)}'`);
			fs.push(v);
		}
		out.frontmatterStatus = fs;
	}
	if (obj.reviewStatus !== undefined) {
		if (!Array.isArray(obj.reviewStatus)) throw new RangeError('filterCriteria.reviewStatus must be a string array');
		const rs: Array<'pending' | 'done'> = [];
		for (const v of obj.reviewStatus) {
			if (v !== 'pending' && v !== 'done')
				throw new RangeError(`filterCriteria.reviewStatus[]: invalid '${String(v)}'`);
			rs.push(v);
		}
		out.reviewStatus = rs;
	}
	if (obj.noPassingSession !== undefined) {
		if (typeof obj.noPassingSession !== 'boolean')
			throw new RangeError('filterCriteria.noPassingSession must be a boolean');
		out.noPassingSession = obj.noPassingSession;
	}
	return out;
}

/**
 * Insert any default buckets that are missing for the given board. Idempotent
 * and race-safe via `onConflictDoNothing` on the (boardId, name) unique index.
 */
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
	await db.insert(hangarReviewBucket).values(toInsert).onConflictDoNothing();
}

export interface CreateBucketInput {
	boardId: string;
	name: string;
	kindId: ReviewKind;
	/** Validated through `validateBucketFilterCriteria` before insert. */
	filterCriteria: BucketFilterCriteria | Record<string, unknown>;
	sortOrder: number;
}

/** Create a new bucket. Throws if the name is not unique on the board. */
export async function createBucket(input: CreateBucketInput, db: Db = defaultDb): Promise<HangarReviewBucketRow> {
	const id = generateHangarReviewBucketId();
	const filterCriteria = validateBucketFilterCriteria(input.filterCriteria);
	const inserted = await db
		.insert(hangarReviewBucket)
		.values({
			id,
			boardId: input.boardId,
			name: input.name,
			kindId: input.kindId,
			filterCriteria,
			sortOrder: input.sortOrder,
		})
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
	const set: { name?: string; kindId?: ReviewKind; filterCriteria?: BucketFilterCriteria; sortOrder?: number } = {};
	if (patch.name !== undefined) set.name = patch.name;
	if (patch.kindId !== undefined) set.kindId = patch.kindId;
	if (patch.filterCriteria !== undefined) set.filterCriteria = validateBucketFilterCriteria(patch.filterCriteria);
	if (patch.sortOrder !== undefined) set.sortOrder = patch.sortOrder;
	const updated = await db.update(hangarReviewBucket).set(set).where(eq(hangarReviewBucket.id, id)).returning();
	if (!updated[0]) throw new Error(`updateBucket: bucket ${id} not found`);
	return updated[0];
}

/** Hard-delete a bucket. Items are not deleted; they fall through to whatever bucket catches them. */
export async function deleteBucket(id: string, db: Db = defaultDb): Promise<void> {
	await db.delete(hangarReviewBucket).where(eq(hangarReviewBucket.id, id));
}

/**
 * Get a single bucket by id. Returns null when no row matches. Pass `boardId`
 * to scope the lookup -- defends against a bucket id from a different board
 * being edited via URL guess once the singleton-board invariant is relaxed
 * (today there is one board, but threading the board id keeps the call site
 * honest about scope).
 */
export async function getBucket(
	id: string,
	boardId?: string,
	db: Db = defaultDb,
): Promise<HangarReviewBucketRow | null> {
	const where =
		boardId !== undefined
			? and(eq(hangarReviewBucket.id, id), eq(hangarReviewBucket.boardId, boardId))
			: eq(hangarReviewBucket.id, id);
	const rows = await db.select().from(hangarReviewBucket).where(where).limit(1);
	return rows[0] ?? null;
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

/**
 * Count live review items that still need review -- everything that doesn't
 * land in the Done column under `getDerivedColumnName`. Used by the hangar
 * nav badge so a reviewer can see "X open" at a glance without expanding
 * the board.
 *
 * "Needs review" = soft-deleted-excluded + NOT (frontmatterStatus = done AND
 * reviewStatus = done). Pinned columns aren't consulted -- the nav badge is
 * a derived-state count, not a column-membership count, so a user pinning
 * an item to Done without flipping frontmatter still surfaces in the badge.
 *
 * Plan: indexed scan over `(boardId, deletedAt)` (the
 * `hangar_review_item_board_idx` partial-on-live index covers the leading
 * predicates), with a heap-side `frontmatter_status` / `review_status`
 * check. The cardinality is bounded (one singleton board, hundreds of
 * items today) so the heap check is cheap; if the count grows hot a
 * partial index over the open-rows-only set is the next step.
 */
export async function countReviewQueueOpen(boardId: string, db: Db = defaultDb): Promise<number> {
	// "Done" is `frontmatterStatus === 'done' AND reviewStatus === 'done'`;
	// anything that isn't that pair is "open." Express via Drizzle's `not`
	// + `and` rather than a raw SQL literal so the constant strings come
	// straight from `FRONTMATTER_STATUSES.DONE` -- no magic strings. Both
	// `eq` calls have known arguments so `and(...)` cannot return undefined
	// here; the type-narrowing fallback that used to live on this line was
	// dead code.
	const doneCondition = and(
		eq(hangarReviewItem.frontmatterStatus, FRONTMATTER_DONE),
		eq(hangarReviewItem.reviewStatus, REVIEW_STATUS_DONE),
	);
	if (doneCondition === undefined) {
		// Type-only branch: drizzle's `and()` is typed as possibly undefined.
		// In practice both eq() args are defined, so this never fires.
		throw new Error('countReviewQueueOpen: drizzle and(...) returned undefined');
	}
	const rows = await db
		.select({ count: sql<number>`count(*)::int` })
		.from(hangarReviewItem)
		.where(and(eq(hangarReviewItem.boardId, boardId), isNull(hangarReviewItem.deletedAt), not(doneCondition)));
	return rows[0]?.count ?? 0;
}

/**
 * Count live review items on `boardId` that match a {@link BucketFilterCriteria}
 * predicate. Differs from `filterItemsByCriteria(listItems(boardId), ...)` in
 * two important ways:
 *
 *  - SQL `COUNT(*)` rather than an in-memory `.filter`, so the count is
 *    correct above `REVIEW_LIST_HARD_CAP` (the in-memory path silently
 *    truncates).
 *  - `noPassingSession: true` joins against the latest finished session per
 *    item via the same window-function shape as
 *    {@link listItemsWithPassingSession}.
 *
 * Used by the bucket admin list page so an operator reasoning about a
 * predicate sees the real count, not a capped-and-truncated one.
 */
export async function countItemsByCriteria(
	boardId: string,
	criteria: BucketFilterCriteria,
	db: Db = defaultDb,
): Promise<number> {
	const conditions = [eq(hangarReviewItem.boardId, boardId), isNull(hangarReviewItem.deletedAt)];
	if (criteria.kind !== undefined) {
		conditions.push(eq(hangarReviewItem.kindId, criteria.kind));
	}
	if (criteria.frontmatterStatus !== undefined && criteria.frontmatterStatus.length > 0) {
		conditions.push(inArray(hangarReviewItem.frontmatterStatus, [...criteria.frontmatterStatus]));
	}
	if (criteria.reviewStatus !== undefined && criteria.reviewStatus.length > 0) {
		conditions.push(inArray(hangarReviewItem.reviewStatus, [...criteria.reviewStatus]));
	}
	if (criteria.noPassingSession === true) {
		// Items without a latest-pass session: subtract the passing-session
		// item set. Matches the semantics of `filterItemsByCriteria` exactly.
		const passingIds = await listItemsWithPassingSession(boardId, db);
		const exclude = [...passingIds];
		if (exclude.length > 0) {
			conditions.push(not(inArray(hangarReviewItem.id, exclude)));
		}
	}
	const rows = await db
		.select({ count: sql<number>`count(*)::int` })
		.from(hangarReviewItem)
		.where(and(...conditions));
	return rows[0]?.count ?? 0;
}

const FRONTMATTER_DONE: FrontmatterStatus = 'done';
const REVIEW_STATUS_DONE: FrontmatterReviewStatus = 'done';

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
	/** Optional. Falls through to schema default `{ otherFields: {} }` on insert. */
	cachedFields?: CachedFrontmatterFields;
}

/**
 * Upsert an item by `(boardId, kindId, ref)` among live rows. Resurrects a
 * soft-deleted row if one exists so session history survives a transient
 * rename. Resurrection clears any prior `pinnedColumnId` so a stale pin
 * doesn't mask a frontmatter status change while the file was missing.
 * Returns the upserted row.
 *
 * Atomic: a single SELECT-existing pass against the unique partial
 * `(boardId, kindId, ref) WHERE deletedAt IS NULL` followed by either an
 * UPDATE-by-id (existing) or an INSERT (new). When a soft-deleted row
 * matches, we extend the SELECT by also reading the deleted row to enable
 * resurrection with pin clear.
 *
 * Concurrency: two concurrent loader processes both miss the live partial
 * and both INSERT -> the loser hits PG `23505` on the unique partial. We
 * catch + retry the SELECT once, mirroring `startSession`'s pattern.
 */
export async function upsertItem(input: UpsertItemInput, db: Db = defaultDb): Promise<HangarReviewItemRow> {
	const cachedFields: CachedFrontmatterFields = input.cachedFields ?? { otherFields: {} };
	for (let attempt = 0; attempt < 2; attempt++) {
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
					cachedFields,
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
		try {
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
					cachedFields,
				})
				.returning();
			if (!inserted[0]) throw new Error('upsertItem: insert returned no row');
			return inserted[0];
		} catch (err) {
			// Concurrent loader writer beat us to the unique partial; retry the
			// SELECT-then-UPDATE branch. Only the unique-violation SQLSTATE is
			// retryable; FK / connection / CHECK errors propagate.
			if (!isPgUniqueViolation(err) || attempt > 0) throw err;
		}
	}
	throw new Error('upsertItem: insert + select retry both failed');
}

/** Soft-delete an item (loader uses this when its source artifact disappears). */
export async function softDeleteItem(id: string, db: Db = defaultDb): Promise<void> {
	await db.update(hangarReviewItem).set({ deletedAt: new Date() }).where(eq(hangarReviewItem.id, id));
}

/**
 * Find a live `review_item` by `(boardId, kindId, ref)`. Used by the ad-hoc
 * task edit / delete path to keep the mirrored review_item row in sync with
 * the underlying `board_task` row.
 */
export async function findItemByRef(
	boardId: string,
	kindId: ReviewKind,
	ref: string,
	db: Db = defaultDb,
): Promise<HangarReviewItemRow | null> {
	const rows = await db
		.select()
		.from(hangarReviewItem)
		.where(
			and(
				eq(hangarReviewItem.boardId, boardId),
				eq(hangarReviewItem.kindId, kindId),
				eq(hangarReviewItem.ref, ref),
				isNull(hangarReviewItem.deletedAt),
			),
		)
		.limit(1);
	return rows[0] ?? null;
}

/**
 * Derive the default column name for an item from its `(frontmatterStatus,
 * reviewStatus)` snapshot. Callers map the resulting NAME to a column id by
 * consulting the board's column list.
 *
 * Mapping (per spec.md "Frontmatter rules"):
 *
 *   frontmatterStatus    reviewStatus    -> column
 *   ------------------   ------------    -------------
 *   null / unread        any             -> Backlog
 *   reading              any             -> In Progress
 *   done                 pending / null  -> Review
 *   done                 done            -> Done
 *
 * Items with no frontmatter (e.g. `ad_hoc`) land in Backlog by default.
 */
export function getDerivedColumnName(
	frontmatterStatus: FrontmatterStatus | null,
	reviewStatus: FrontmatterReviewStatus | null,
): ReviewBoardDefaultColumn {
	if (frontmatterStatus === 'reading') return REVIEW_BOARD_COLUMN_NAMES.IN_PROGRESS;
	if (frontmatterStatus === 'done') {
		if (reviewStatus === 'done') return REVIEW_BOARD_COLUMN_NAMES.DONE;
		return REVIEW_BOARD_COLUMN_NAMES.REVIEW;
	}
	return REVIEW_BOARD_COLUMN_NAMES.BACKLOG;
}

/**
 * Resolve an item's effective column id. If the user explicitly pinned the
 * item via drag-drop, the pin wins. Otherwise the derived mapping above
 * applies; the matching column from `columns` is returned, falling back to
 * the first column when nothing matches (defensive -- a board missing
 * `Backlog` is malformed but shouldn't crash the page).
 */
export function resolveItemColumnId(
	item: {
		pinnedColumnId: string | null;
		frontmatterStatus: FrontmatterStatus | null;
		reviewStatus: FrontmatterReviewStatus | null;
	},
	columns: ReadonlyArray<{ id: string; name: string }>,
): string {
	if (item.pinnedColumnId !== null) return item.pinnedColumnId;
	const derived = getDerivedColumnName(item.frontmatterStatus, item.reviewStatus);
	const match = columns.find((c) => c.name === derived);
	if (match) return match.id;
	const first = columns[0];
	if (!first) throw new Error('resolveItemColumnId: board has no columns');
	return first.id;
}

/**
 * Apply a `BucketFilterCriteria` predicate to an in-memory item list. Used
 * by the `/review` board to compute bucket counts + drawer items without a
 * round-trip per filter chip change.
 *
 * `passingSessionItemIds` is the (precomputed) set of items whose latest
 * session closed `outcome = 'pass'`. Required when any bucket uses the
 * `noPassingSession: true` predicate; otherwise the empty set works.
 */
export function filterItemsByCriteria<
	T extends {
		kindId: string;
		frontmatterStatus: FrontmatterStatus | null;
		reviewStatus: FrontmatterReviewStatus | null;
		id: string;
	},
>(
	items: ReadonlyArray<T>,
	criteria: BucketFilterCriteria,
	passingSessionItemIds: ReadonlySet<string> = new Set(),
): ReadonlyArray<T> {
	return items.filter((item) => {
		if (criteria.kind !== undefined && item.kindId !== criteria.kind) return false;
		if (
			criteria.frontmatterStatus !== undefined &&
			criteria.frontmatterStatus.length > 0 &&
			(item.frontmatterStatus === null || !criteria.frontmatterStatus.includes(item.frontmatterStatus))
		) {
			return false;
		}
		if (
			criteria.reviewStatus !== undefined &&
			criteria.reviewStatus.length > 0 &&
			(item.reviewStatus === null || !criteria.reviewStatus.includes(item.reviewStatus))
		) {
			return false;
		}
		if (criteria.noPassingSession === true && passingSessionItemIds.has(item.id)) return false;
		return true;
	});
}

/**
 * Set of item ids whose most recent finished session closed with
 * `outcome = 'pass'`. Used by the `noPassingSession: true` bucket predicate
 * to surface items that still need review (i.e., never passed, OR last
 * session closed with `fail` / `blocked`).
 *
 * Implementation: pulls the latest finished session per item via a window
 * function, then filters to `outcome = 'pass'`.
 */
export async function listItemsWithPassingSession(boardId: string, db: Db = defaultDb): Promise<ReadonlySet<string>> {
	const rows = await db.execute<{ item_id: string }>(sql`
		SELECT item_id FROM (
			SELECT
				rs.item_id,
				rs.outcome,
				ROW_NUMBER() OVER (PARTITION BY rs.item_id ORDER BY rs.finished_at DESC NULLS LAST) AS rn
			FROM ${hangarReviewSession} rs
			JOIN ${hangarReviewItem} ri ON ri.id = rs.item_id
			WHERE ri.board_id = ${boardId}
			  AND rs.finished_at IS NOT NULL
		) latest
		WHERE latest.rn = 1 AND latest.outcome = 'pass'
	`);
	const out = new Set<string>();
	const list = (rows as unknown as { rows?: ReadonlyArray<{ item_id: string }> }).rows ?? rows;
	for (const r of list as ReadonlyArray<{ item_id: string }>) {
		if (r.item_id) out.add(r.item_id);
	}
	return out;
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
 * one when entering the walker. `userId` is required at the BC entry point;
 * orphaned sessions (whose `userId` was nulled by a user delete) are
 * unreachable here -- they show up as read-only history rows in the
 * `listSessions(itemId)` view.
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
 *
 * Implemented as a single `INSERT ... ON CONFLICT DO UPDATE` against the
 * `(sessionId, stepRef)` unique index so two concurrent writers (fast double-
 * click, two browser tabs) collapse into one row without surfacing PG `23505`.
 * The class JSDoc on this file names idempotency a hard guarantee.
 */
export async function recordStep(input: RecordStepInput, db: Db = defaultDb): Promise<HangarReviewStepRow> {
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
		.onConflictDoUpdate({
			target: [hangarReviewStep.sessionId, hangarReviewStep.stepRef],
			set: {
				outcome: input.outcome,
				note: input.note,
				stepIndex: input.stepIndex,
			},
		})
		.returning();
	if (!inserted[0]) throw new Error('recordStep: upsert returned no row');
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

/**
 * Pure decision: did the walker complete the test plan with a clean pass?
 *
 * The walker's `?/finishSession` action consults this before flipping
 * `review_status: done` on the spec frontmatter. Conditions:
 *   1. The plan has at least one step (no flip on an empty plan).
 *   2. Every step in the plan has been recorded.
 *   3. Every plan step's recorded outcome is `pass` (no fails, no blockeds).
 *
 * Orphan recorded rows (whose `stepRef` is not in the live plan -- e.g.
 * test-plan.md was edited mid-walk) are ignored entirely: their outcome
 * neither contributes to nor blocks the pass count. The plan's stepRefs
 * are the authoritative universe. A stale orphan-`pass` row from a prior
 * plan revision must NOT inflate `passCount` past `steps.length`.
 *
 * Lives in the BC alongside the other test-plan helpers so it's reachable
 * from unit tests without touching the route layer.
 */
export function everyStepPassed(
	steps: ReadonlyArray<{ stepRef: string }>,
	recorded: ReadonlyArray<{ stepRef: string; outcome: string }>,
): boolean {
	if (steps.length === 0) return false;
	const planRefs = new Set(steps.map((s) => s.stepRef));
	// Filter to plan stepRefs first; dedupe in case `recorded` somehow surfaces
	// duplicates (defensive -- the unique index on `(sessionId, stepRef)`
	// prevents duplicate rows, but the comparator stays robust if a future
	// caller passes pre-merged data).
	const passByRef = new Map<string, boolean>();
	for (const r of recorded) {
		if (!planRefs.has(r.stepRef)) continue;
		// Once a non-pass row is seen for a ref, it stays non-pass; subsequent
		// pass rows for the same ref do NOT promote it back. (Idempotency at
		// the BC level means there's only one row per ref anyway.)
		if (passByRef.get(r.stepRef) === false) continue;
		passByRef.set(r.stepRef, r.outcome === 'pass');
	}
	for (const step of steps) {
		if (passByRef.get(step.stepRef) !== true) return false;
	}
	return true;
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

/** Get a single task by id. Returns null when no row matches. */
export async function getTask(id: string, db: Db = defaultDb): Promise<HangarBoardTaskRow | null> {
	const rows = await db.select().from(hangarBoardTask).where(eq(hangarBoardTask.id, id)).limit(1);
	return rows[0] ?? null;
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
