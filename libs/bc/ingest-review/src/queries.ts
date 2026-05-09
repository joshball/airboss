/**
 * Ingest-Review BC -- server-only queries.
 *
 * Reachable from `+page.server.ts`, `+server.ts`, scripts, and tests. Imports
 * `@ab/db/connection`, which loads the `postgres` driver -- never reach this
 * file from a `.svelte` component or a runtime barrel re-export.
 *
 * @browser-globals: server-only -- never imported by client .svelte
 */

import { auditWrite } from '@ab/audit';
import {
	AUDIT_TARGETS,
	type Corpus,
	INGEST_ISSUE_ID_PREFIX,
	INGEST_OVERRIDE_ID_PREFIX,
	INGEST_QUEUE_DEFAULT_LIMIT,
	INGEST_REVIEW,
	type IngestIssueKind,
	type IngestOverrideAction,
	type IngestStatus,
} from '@ab/constants';
import { db as defaultDb } from '@ab/db/connection';
import { createId } from '@ab/utils';
import { and, desc, eq, inArray, sql } from 'drizzle-orm';
import type { PgDatabase, PgQueryResultHKT } from 'drizzle-orm/pg-core';
import { type IngestIssueRow, type IngestOverrideRow, ingestIssue, ingestOverride } from './schema';
import type { ActionInput, IssueInput, IssueRecord, OverrideRecord } from './types';

type Db = PgDatabase<PgQueryResultHKT, Record<string, never>>;

/** Raised when a caller looks up an issue id that does not exist. */
export class IssueNotFoundError extends Error {
	readonly code = 'INGEST_ISSUE_NOT_FOUND';
	constructor(public readonly issueId: string) {
		super(`ingest issue ${issueId} not found`);
		this.name = 'IssueNotFoundError';
	}
}

/** Raised when an action payload fails the plugin's validator. */
export class InvalidActionPayloadError extends Error {
	readonly code = 'INGEST_INVALID_ACTION_PAYLOAD';
	constructor(message: string) {
		super(message);
		this.name = 'InvalidActionPayloadError';
	}
}

function rowToRecord<P>(row: IngestIssueRow): IssueRecord<P> {
	return {
		id: row.id,
		corpus: row.corpus as Corpus,
		sourceId: row.sourceId,
		edition: row.edition,
		pageNum: row.pageNum,
		kind: row.kind as IngestIssueKind,
		externalId: row.externalId,
		payload: row.payload as P,
		status: row.status as IngestStatus,
		firstSeenAt: row.firstSeenAt,
		lastSeenAt: row.lastSeenAt,
	};
}

function overrideRowToRecord<A>(row: IngestOverrideRow): OverrideRecord<A> {
	return {
		id: row.id,
		issueId: row.issueId,
		action: row.action as IngestOverrideAction,
		payload: row.payload as A,
		createdByUserId: row.createdByUserId,
		createdAt: row.createdAt,
		updatedAt: row.updatedAt,
	};
}

/**
 * Upsert one issue keyed on `(kind, external_id)`. Inserts a new row when
 * the pair is unseen; otherwise updates `payload`, `last_seen_at`,
 * `corpus / source_id / edition / page_num` (the producer always wins on
 * these), and bumps `status` from `stale -> unresolved` if the producer
 * re-emitted the issue (an override row, if any, is left untouched).
 *
 * `first_seen_at` is preserved across updates.
 */
export async function upsertIssue(input: IssueInput, db: Db = defaultDb): Promise<IssueRecord> {
	const now = new Date();
	const id = createId(INGEST_ISSUE_ID_PREFIX);
	const [row] = await db
		.insert(ingestIssue)
		.values({
			id,
			corpus: input.corpus,
			sourceId: input.sourceId,
			edition: input.edition,
			pageNum: input.pageNum,
			kind: input.kind,
			externalId: input.externalId,
			payload: input.payload,
			status: INGEST_REVIEW.STATUS.UNRESOLVED,
			firstSeenAt: now,
			lastSeenAt: now,
		})
		.onConflictDoUpdate({
			target: [ingestIssue.kind, ingestIssue.externalId],
			set: {
				corpus: input.corpus,
				sourceId: input.sourceId,
				edition: input.edition,
				pageNum: input.pageNum,
				payload: input.payload,
				lastSeenAt: now,
				// Re-emergence flips a stale row back to unresolved.
				// Already-resolved rows keep their status (the override survives).
				status: sql`CASE WHEN ${ingestIssue.status} = 'stale' THEN 'unresolved' ELSE ${ingestIssue.status} END`,
			},
		})
		.returning();
	if (!row)
		throw new Error(`upsertIssue: insert returned no row for kind=${input.kind} external_id=${input.externalId}`);
	return rowToRecord(row);
}

/**
 * Bulk version. Used by the producer pipeline to push a batch from
 * `warnings.json` in one round-trip per source.
 */
export async function upsertIssues(inputs: readonly IssueInput[], db: Db = defaultDb): Promise<readonly IssueRecord[]> {
	const out: IssueRecord[] = [];
	for (const input of inputs) {
		out.push(await upsertIssue(input, db));
	}
	return out;
}

export interface ListIssuesFilters {
	corpus?: Corpus;
	sourceId?: string;
	kind?: IngestIssueKind;
	status?: IngestStatus | readonly IngestStatus[];
	limit?: number;
}

/**
 * List issues with filter chips honoured. Default order is most-recently-seen
 * first so the queue surfaces the latest work at the top.
 */
export async function listIssues(filters: ListIssuesFilters = {}, db: Db = defaultDb): Promise<readonly IssueRecord[]> {
	const conditions = [];
	if (filters.corpus) conditions.push(eq(ingestIssue.corpus, filters.corpus));
	if (filters.sourceId) conditions.push(eq(ingestIssue.sourceId, filters.sourceId));
	if (filters.kind) conditions.push(eq(ingestIssue.kind, filters.kind));
	if (filters.status !== undefined) {
		const statuses = Array.isArray(filters.status) ? filters.status : [filters.status as IngestStatus];
		conditions.push(inArray(ingestIssue.status, statuses as string[]));
	}
	const limit = filters.limit ?? INGEST_QUEUE_DEFAULT_LIMIT;
	const rows = await db
		.select()
		.from(ingestIssue)
		.where(conditions.length > 0 ? and(...conditions) : undefined)
		.orderBy(desc(ingestIssue.lastSeenAt))
		.limit(limit);
	return rows.map((r) => rowToRecord(r));
}

/**
 * Fetch one issue by id. Throws `IssueNotFoundError` on miss.
 */
export async function getIssue(id: string, db: Db = defaultDb): Promise<IssueRecord> {
	const [row] = await db.select().from(ingestIssue).where(eq(ingestIssue.id, id)).limit(1);
	if (!row) throw new IssueNotFoundError(id);
	return rowToRecord(row);
}

/**
 * Look up the current override for an issue, if any.
 */
export async function getCurrentOverride(issueId: string, db: Db = defaultDb): Promise<OverrideRecord | null> {
	const [row] = await db.select().from(ingestOverride).where(eq(ingestOverride.issueId, issueId)).limit(1);
	if (!row) return null;
	return overrideRowToRecord(row);
}

/**
 * Bulk override fetch keyed by issue id. Used by the queue list page to
 * decorate every row with its resolved action without per-row queries.
 */
export async function getCurrentOverrides(
	issueIds: readonly string[],
	db: Db = defaultDb,
): Promise<ReadonlyMap<string, OverrideRecord>> {
	if (issueIds.length === 0) return new Map();
	const rows = await db
		.select()
		.from(ingestOverride)
		.where(inArray(ingestOverride.issueId, issueIds as string[]));
	const out = new Map<string, OverrideRecord>();
	for (const r of rows) out.set(r.issueId, overrideRowToRecord(r));
	return out;
}

/**
 * List every override across a corpus (or a single source). Used by the
 * export-overrides script to project the YAML sidecars per source.
 */
export async function listOverridesWithIssues(
	filters: { corpus?: Corpus; sourceId?: string },
	db: Db = defaultDb,
): Promise<ReadonlyArray<{ issue: IssueRecord; override: OverrideRecord }>> {
	const conditions = [];
	if (filters.corpus) conditions.push(eq(ingestIssue.corpus, filters.corpus));
	if (filters.sourceId) conditions.push(eq(ingestIssue.sourceId, filters.sourceId));
	const rows = await db
		.select({
			issue: ingestIssue,
			override: ingestOverride,
		})
		.from(ingestOverride)
		.innerJoin(ingestIssue, eq(ingestOverride.issueId, ingestIssue.id))
		.where(conditions.length > 0 ? and(...conditions) : undefined)
		.orderBy(ingestIssue.sourceId, ingestIssue.pageNum, ingestIssue.externalId);
	return rows.map((r) => ({
		issue: rowToRecord(r.issue),
		override: overrideRowToRecord(r.override),
	}));
}

export interface ApplyOverrideInput {
	issueId: string;
	action: ActionInput;
	actorUserId: string | null;
}

/**
 * Write or replace the override row for an issue and flip the issue to
 * `resolved`. Idempotent: re-applying the same action overwrites the
 * payload + bumps `updated_at`; re-applying a different action overwrites
 * the action too.
 *
 * Records one `audit.audit_log` row per write through `auditWrite`; the
 * before / after snapshot is the override-row diff.
 */
export async function applyOverride(input: ApplyOverrideInput, db: Db = defaultDb): Promise<OverrideRecord> {
	return await db.transaction(async (tx) => {
		const issue = await getIssue(input.issueId, tx);
		const previous = await getCurrentOverride(input.issueId, tx);
		const id = previous?.id ?? createId(INGEST_OVERRIDE_ID_PREFIX);
		const now = new Date();
		const [row] = await tx
			.insert(ingestOverride)
			.values({
				id,
				issueId: input.issueId,
				action: input.action.action,
				payload: input.action.payload,
				createdByUserId: input.actorUserId,
				createdAt: now,
				updatedAt: now,
			})
			.onConflictDoUpdate({
				target: ingestOverride.issueId,
				set: {
					action: input.action.action,
					payload: input.action.payload,
					createdByUserId: input.actorUserId,
					updatedAt: now,
				},
			})
			.returning();
		if (!row) throw new Error(`applyOverride: insert returned no row for issue ${input.issueId}`);
		// Flip status to resolved on every action write.
		await tx
			.update(ingestIssue)
			.set({ status: INGEST_REVIEW.STATUS.RESOLVED })
			.where(eq(ingestIssue.id, input.issueId));
		await auditWrite(
			{
				actorId: input.actorUserId,
				op: previous ? 'update' : 'create',
				targetType: AUDIT_TARGETS.HANGAR_INGEST_OVERRIDE,
				targetId: input.issueId,
				before: previous,
				after: overrideRowToRecord(row),
				metadata: {
					kind: issue.kind,
					action: input.action.action,
				},
			},
			tx,
		);
		return overrideRowToRecord(row);
	});
}

/**
 * Mark an issue as `dismissed` without writing an override. Used when an
 * author wants to clear a noise row from the queue without authoring a
 * resolution. Drops any prior override.
 */
export async function dismissIssue(issueId: string, actorUserId: string | null, db: Db = defaultDb): Promise<void> {
	await db.transaction(async (tx) => {
		const issue = await getIssue(issueId, tx);
		await tx.delete(ingestOverride).where(eq(ingestOverride.issueId, issueId));
		await tx.update(ingestIssue).set({ status: INGEST_REVIEW.STATUS.DISMISSED }).where(eq(ingestIssue.id, issueId));
		await auditWrite(
			{
				actorId: actorUserId,
				op: 'update',
				targetType: AUDIT_TARGETS.HANGAR_INGEST_ISSUE,
				targetId: issueId,
				before: { status: issue.status },
				after: { status: INGEST_REVIEW.STATUS.DISMISSED },
				metadata: { kind: issue.kind, subKind: 'dismiss' },
			},
			tx,
		);
	});
}

/**
 * Reopen a dismissed or resolved issue. Drops any override row and flips
 * status to `unresolved`. Used by the "Reopen" action on the detail page.
 */
export async function reopenIssue(issueId: string, actorUserId: string | null, db: Db = defaultDb): Promise<void> {
	await db.transaction(async (tx) => {
		const issue = await getIssue(issueId, tx);
		await tx.delete(ingestOverride).where(eq(ingestOverride.issueId, issueId));
		await tx.update(ingestIssue).set({ status: INGEST_REVIEW.STATUS.UNRESOLVED }).where(eq(ingestIssue.id, issueId));
		await auditWrite(
			{
				actorId: actorUserId,
				op: 'update',
				targetType: AUDIT_TARGETS.HANGAR_INGEST_ISSUE,
				targetId: issueId,
				before: { status: issue.status },
				after: { status: INGEST_REVIEW.STATUS.UNRESOLVED },
				metadata: { kind: issue.kind, subKind: 'reopen' },
			},
			tx,
		);
	});
}

/**
 * Flip every issue NOT in `seenExternalIds` (within a `(corpus, kind)`)
 * to `stale`. Called by the producer at end-of-run so disappeared issues
 * don't pollute the live queue.
 */
export async function markStaleByDifference(
	scope: { corpus: Corpus; kind: IngestIssueKind; sourceId?: string },
	seenExternalIds: readonly string[],
	db: Db = defaultDb,
): Promise<readonly string[]> {
	const conditions = [eq(ingestIssue.corpus, scope.corpus), eq(ingestIssue.kind, scope.kind)];
	if (scope.sourceId !== undefined) {
		// Scope to one source so a `--source ifh` producer never staleds
		// rows from `phak` etc. Without this, every per-source run treats
		// every other source's rows as "disappeared" and flips them all.
		conditions.push(eq(ingestIssue.sourceId, scope.sourceId));
	}
	if (seenExternalIds.length > 0) {
		// Postgres NOT IN with parameter list. Drizzle's `notInArray` would
		// emit `<> ALL`, which is equivalent for our case but less greppable.
		conditions.push(sql`${ingestIssue.externalId} NOT IN ${seenExternalIds}`);
	}
	const rows = await db
		.update(ingestIssue)
		.set({ status: INGEST_REVIEW.STATUS.STALE })
		.where(
			and(
				...conditions,
				inArray(ingestIssue.status, [INGEST_REVIEW.STATUS.UNRESOLVED, INGEST_REVIEW.STATUS.RESOLVED] as string[]),
			),
		)
		.returning({ id: ingestIssue.id });
	return rows.map((r) => r.id);
}

/**
 * Count rows in each status, scoped to a corpus / source. Drives the
 * dashboard summary tile + queue header counts.
 */
export async function getStatusCounts(
	filters: { corpus?: Corpus; sourceId?: string } = {},
	db: Db = defaultDb,
): Promise<Readonly<Record<IngestStatus, number>>> {
	const conditions = [];
	if (filters.corpus) conditions.push(eq(ingestIssue.corpus, filters.corpus));
	if (filters.sourceId) conditions.push(eq(ingestIssue.sourceId, filters.sourceId));
	const rows = await db
		.select({ status: ingestIssue.status, c: sql<number>`count(*)::int` })
		.from(ingestIssue)
		.where(conditions.length > 0 ? and(...conditions) : undefined)
		.groupBy(ingestIssue.status);
	const out: Record<IngestStatus, number> = {
		unresolved: 0,
		resolved: 0,
		stale: 0,
		dismissed: 0,
	};
	for (const r of rows) {
		out[r.status as IngestStatus] = Number(r.c);
	}
	return out;
}

/**
 * List the distinct `(corpus, source_id)` pairs present in the issue
 * table -- the queue's "filter by source" dropdown reads this.
 */
export async function listSources(
	corpus: Corpus | undefined,
	db: Db = defaultDb,
): Promise<ReadonlyArray<{ corpus: Corpus; sourceId: string; total: number }>> {
	const rows = await db
		.select({
			corpus: ingestIssue.corpus,
			sourceId: ingestIssue.sourceId,
			total: sql<number>`count(*)::int`,
		})
		.from(ingestIssue)
		.where(corpus ? eq(ingestIssue.corpus, corpus) : undefined)
		.groupBy(ingestIssue.corpus, ingestIssue.sourceId)
		.orderBy(ingestIssue.corpus, ingestIssue.sourceId);
	return rows.map((r) => ({
		corpus: r.corpus as Corpus,
		sourceId: r.sourceId,
		total: Number(r.total),
	}));
}
