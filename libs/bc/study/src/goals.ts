/**
 * Goals BC -- learner-owned goals composing syllabi + ad-hoc nodes.
 *
 * Read paths:
 *   - listGoals / getActiveGoals                      per-user index
 *   - getGoalById                                     single-row
 *   - getPrimaryGoal                                  resolves the user's `is_primary` row
 *   - getGoalSyllabi / getGoalNodes                   composing rows
 *   - getGoalNodeUnion                                every reachable knowledge node + weight
 *   - getDerivedCertGoals                             cert slugs derived from primary goal
 *
 * Write paths:
 *   - createGoal / updateGoal / archiveGoal
 *   - setPrimaryGoal                                  transactional swap
 *   - addGoalSyllabus / removeGoalSyllabus / setGoalSyllabusWeight
 *   - addGoalNode / removeGoalNode / setGoalNodeWeight
 *
 * The primary-goal invariant ("at most one is_primary=true per user") is
 * enforced by a partial UNIQUE index on `goal (user_id) WHERE is_primary=true`.
 * `setPrimaryGoal` clears `is_primary` on every other goal in a single
 * transaction before flipping the target so the invariant never breaks
 * mid-write.
 *
 * `getDerivedCertGoals` is the back-compat shim: the existing session engine
 * reads `study_plan.cert_goals: Cert[]`; until the engine cutover lands in a
 * follow-on WP, this function projects the user's primary goal's syllabi back
 * to credential slugs so the engine sees the same shape it always did.
 *
 * See cert-syllabus WP spec + ADR 016 phase 6 for the model rationale.
 */

import { GOAL_STATUSES, type GoalStatus, SYLLABUS_PRIMACY } from '@ab/constants';
import { db as defaultDb } from '@ab/db';
import { generateGoalId } from '@ab/utils';
import { and, eq, sql } from 'drizzle-orm';
import type { PgDatabase, PgQueryResultHKT } from 'drizzle-orm/pg-core';
import type {
	AddGoalNodeInput,
	AddGoalSyllabusInput,
	CreateGoalInput,
	UpdateGoalInput,
} from './credentials.validation';
import {
	credential,
	credentialSyllabus,
	type GoalNodeRow,
	type GoalRow,
	type GoalSyllabusRow,
	goal,
	goalNode,
	goalSyllabus,
	type NewGoalNodeRow,
	type NewGoalRow,
	type NewGoalSyllabusRow,
	syllabusNode,
	syllabusNodeLink,
} from './schema';

type Db = PgDatabase<PgQueryResultHKT, Record<string, never>>;

// ---------------------------------------------------------------------------
// Errors
// ---------------------------------------------------------------------------

export class GoalNotFoundError extends Error {
	constructor(public readonly id: string) {
		super(`Goal not found: ${id}`);
		this.name = 'GoalNotFoundError';
	}
}

export class GoalNotOwnedError extends Error {
	constructor(
		public readonly goalId: string,
		public readonly userId: string,
	) {
		super(`Goal ${goalId} is not owned by user ${userId}`);
		this.name = 'GoalNotOwnedError';
	}
}

export class GoalAlreadyPrimaryError extends Error {
	constructor(
		public readonly userId: string,
		public readonly goalId: string,
	) {
		super(`User ${userId} already has a primary goal; setPrimaryGoal must clear before setting`);
		this.name = 'GoalAlreadyPrimaryError';
	}
}

// ---------------------------------------------------------------------------
// Read paths
// ---------------------------------------------------------------------------

export interface ListGoalsOptions {
	status?: GoalStatus;
}

/** List goals for a user, ordered by `is_primary` desc then `updatedAt` desc. */
export async function listGoals(
	userId: string,
	options: ListGoalsOptions = {},
	db: Db = defaultDb,
): Promise<GoalRow[]> {
	const conditions = [eq(goal.userId, userId)];
	if (options.status !== undefined) conditions.push(eq(goal.status, options.status));
	const where = conditions.length === 1 ? conditions[0] : and(...conditions);
	return db.select().from(goal).where(where).orderBy(sql`${goal.isPrimary} DESC`, sql`${goal.updatedAt} DESC`);
}

/** Active goals for a user. Multiple are allowed; exactly one is `is_primary`. */
export async function getActiveGoals(userId: string, db: Db = defaultDb): Promise<GoalRow[]> {
	return listGoals(userId, { status: GOAL_STATUSES.ACTIVE }, db);
}

/** The user's primary goal, or null when none is set. */
export async function getPrimaryGoal(userId: string, db: Db = defaultDb): Promise<GoalRow | null> {
	const rows = await db
		.select()
		.from(goal)
		.where(and(eq(goal.userId, userId), eq(goal.isPrimary, true)))
		.limit(1);
	return rows[0] ?? null;
}

/** Resolve a goal by id. Throws when missing. */
export async function getGoalById(id: string, db: Db = defaultDb): Promise<GoalRow> {
	const rows = await db.select().from(goal).where(eq(goal.id, id)).limit(1);
	const row = rows[0];
	if (!row) throw new GoalNotFoundError(id);
	return row;
}

/**
 * Resolve a goal by id and assert ownership. Throws either NotFound or
 * NotOwned. Used by route handlers that need to gate writes by user.
 */
export async function getOwnedGoal(id: string, userId: string, db: Db = defaultDb): Promise<GoalRow> {
	const row = await getGoalById(id, db);
	if (row.userId !== userId) throw new GoalNotOwnedError(id, userId);
	return row;
}

/** Goal-syllabus links for a goal. */
export async function getGoalSyllabi(goalId: string, db: Db = defaultDb): Promise<GoalSyllabusRow[]> {
	return db.select().from(goalSyllabus).where(eq(goalSyllabus.goalId, goalId));
}

/** Goal-node links (ad-hoc nodes pinned outside any syllabus). */
export async function getGoalNodes(goalId: string, db: Db = defaultDb): Promise<GoalNodeRow[]> {
	return db.select().from(goalNode).where(eq(goalNode.goalId, goalId));
}

/**
 * Union of every knowledge node reachable through the goal: walks each
 * `goal_syllabus -> syllabus_node (leaf) -> syllabus_node_link -> knowledge_node`,
 * plus every `goal_node` ad-hoc entry. Aggregates weights when a node is
 * reachable through multiple paths (the highest weight wins -- this matches
 * the relevance cache rebuild's "most-prominent context" semantic).
 */
export async function getGoalNodeUnion(
	goalId: string,
	db: Db = defaultDb,
): Promise<{ knowledgeNodeIds: string[]; weights: Record<string, number> }> {
	const [syllabusRows, adhocRows] = await Promise.all([
		db
			.select({
				knowledgeNodeId: syllabusNodeLink.knowledgeNodeId,
				goalWeight: goalSyllabus.weight,
				linkWeight: syllabusNodeLink.weight,
			})
			.from(goalSyllabus)
			.innerJoin(syllabusNode, eq(syllabusNode.syllabusId, goalSyllabus.syllabusId))
			.innerJoin(syllabusNodeLink, eq(syllabusNodeLink.syllabusNodeId, syllabusNode.id))
			.where(and(eq(goalSyllabus.goalId, goalId), eq(syllabusNode.isLeaf, true))),
		db
			.select({ knowledgeNodeId: goalNode.knowledgeNodeId, weight: goalNode.weight })
			.from(goalNode)
			.where(eq(goalNode.goalId, goalId)),
	]);

	const weights: Record<string, number> = {};
	for (const row of syllabusRows) {
		const w = row.goalWeight * row.linkWeight;
		const prev = weights[row.knowledgeNodeId];
		if (prev === undefined || w > prev) weights[row.knowledgeNodeId] = w;
	}
	for (const row of adhocRows) {
		const prev = weights[row.knowledgeNodeId];
		if (prev === undefined || row.weight > prev) weights[row.knowledgeNodeId] = row.weight;
	}
	return {
		knowledgeNodeIds: Object.keys(weights).sort(),
		weights,
	};
}

/**
 * Cert slugs derived from a user's primary goal. Walks
 * `goal_syllabus -> credential_syllabus (primary) -> credential.slug` and
 * returns the unique sorted slug list.
 *
 * Returns the empty array when the user has no primary goal -- the engine
 * keeps reading `study_plan.cert_goals` directly until the cutover, so this
 * shim is a polite no-op in that case.
 */
export async function getDerivedCertGoals(userId: string, db: Db = defaultDb): Promise<string[]> {
	const primary = await getPrimaryGoal(userId, db);
	if (primary === null) return [];
	const rows = await db
		.select({ slug: credential.slug })
		.from(goalSyllabus)
		.innerJoin(credentialSyllabus, eq(credentialSyllabus.syllabusId, goalSyllabus.syllabusId))
		.innerJoin(credential, eq(credential.id, credentialSyllabus.credentialId))
		.where(and(eq(goalSyllabus.goalId, primary.id), eq(credentialSyllabus.primacy, SYLLABUS_PRIMACY.PRIMARY)));
	return [...new Set(rows.map((r) => r.slug))].sort();
}

// ---------------------------------------------------------------------------
// Write paths
// ---------------------------------------------------------------------------

export interface CreateGoalParams extends CreateGoalInput {
	userId: string;
}

/**
 * Create a goal. When `isPrimary=true`, the call is transactional: any
 * other primary goal for the user is cleared first so the partial UNIQUE
 * never trips.
 */
export async function createGoal(params: CreateGoalParams, db: Db = defaultDb): Promise<GoalRow> {
	const id = generateGoalId();
	const now = new Date();
	const row: NewGoalRow = {
		id,
		userId: params.userId,
		title: params.title,
		notesMd: params.notesMd ?? '',
		status: GOAL_STATUSES.ACTIVE,
		isPrimary: params.isPrimary ?? false,
		targetDate: params.targetDate === null ? null : params.targetDate ? new Date(params.targetDate) : null,
		seedOrigin: null,
		createdAt: now,
		updatedAt: now,
	};
	if (row.isPrimary) {
		return db.transaction(async (tx) => {
			await tx.update(goal).set({ isPrimary: false, updatedAt: new Date() }).where(eq(goal.userId, params.userId));
			const [inserted] = await tx.insert(goal).values(row).returning();
			if (!inserted) throw new Error('createGoal failed');
			return inserted;
		});
	}
	const [inserted] = await db.insert(goal).values(row).returning();
	if (!inserted) throw new Error('createGoal failed');
	return inserted;
}

/**
 * Patch fields on a goal. Returns the updated row. `setPrimaryGoal` is a
 * separate function -- updating `is_primary` here would risk colliding with
 * the partial UNIQUE without the explicit clear-others step.
 */
export async function updateGoal(
	goalId: string,
	userId: string,
	input: UpdateGoalInput,
	db: Db = defaultDb,
): Promise<GoalRow> {
	const existing = await getOwnedGoal(goalId, userId, db);
	const updates: Partial<NewGoalRow> = { updatedAt: new Date() };
	if (input.title !== undefined) updates.title = input.title;
	if (input.notesMd !== undefined) updates.notesMd = input.notesMd;
	if (input.status !== undefined) updates.status = input.status;
	if (input.targetDate !== undefined) {
		updates.targetDate = input.targetDate === null ? null : new Date(input.targetDate);
	}
	const [row] = await db.update(goal).set(updates).where(eq(goal.id, existing.id)).returning();
	if (!row) throw new GoalNotFoundError(goalId);
	return row;
}

/** Archive a goal (status='abandoned' is the chosen archive lifecycle). */
export async function archiveGoal(goalId: string, userId: string, db: Db = defaultDb): Promise<GoalRow> {
	return updateGoal(goalId, userId, { status: GOAL_STATUSES.ABANDONED }, db);
}

/**
 * Atomically clear `is_primary` on every other goal for the user, then set
 * `is_primary=true` on the target. Throws NotFound or NotOwned per usual.
 */
export async function setPrimaryGoal(goalId: string, userId: string, db: Db = defaultDb): Promise<GoalRow> {
	const existing = await getOwnedGoal(goalId, userId, db);
	return db.transaction(async (tx) => {
		await tx
			.update(goal)
			.set({ isPrimary: false, updatedAt: new Date() })
			.where(and(eq(goal.userId, userId), eq(goal.isPrimary, true)));
		const [row] = await tx
			.update(goal)
			.set({ isPrimary: true, updatedAt: new Date() })
			.where(eq(goal.id, existing.id))
			.returning();
		if (!row) throw new GoalNotFoundError(goalId);
		return row;
	});
}

/**
 * Add a syllabus to a goal. Idempotent on the (goal_id, syllabus_id)
 * composite PK -- re-running with a different weight updates the weight.
 */
export async function addGoalSyllabus(
	goalId: string,
	userId: string,
	input: AddGoalSyllabusInput,
	db: Db = defaultDb,
): Promise<GoalSyllabusRow> {
	const existing = await getOwnedGoal(goalId, userId, db);
	const row: NewGoalSyllabusRow = {
		goalId: existing.id,
		syllabusId: input.syllabusId,
		weight: input.weight,
		seedOrigin: null,
		createdAt: new Date(),
	};
	const [result] = await db
		.insert(goalSyllabus)
		.values(row)
		.onConflictDoUpdate({
			target: [goalSyllabus.goalId, goalSyllabus.syllabusId],
			set: { weight: input.weight },
		})
		.returning();
	if (!result) throw new Error('addGoalSyllabus failed');
	return result;
}

/** Remove a syllabus from a goal. No-op when not linked. */
export async function removeGoalSyllabus(
	goalId: string,
	userId: string,
	syllabusId: string,
	db: Db = defaultDb,
): Promise<void> {
	const existing = await getOwnedGoal(goalId, userId, db);
	await db
		.delete(goalSyllabus)
		.where(and(eq(goalSyllabus.goalId, existing.id), eq(goalSyllabus.syllabusId, syllabusId)));
}

/** Update the weight on an existing goal_syllabus row. */
export async function setGoalSyllabusWeight(
	goalId: string,
	userId: string,
	syllabusId: string,
	weight: number,
	db: Db = defaultDb,
): Promise<void> {
	const existing = await getOwnedGoal(goalId, userId, db);
	await db
		.update(goalSyllabus)
		.set({ weight })
		.where(and(eq(goalSyllabus.goalId, existing.id), eq(goalSyllabus.syllabusId, syllabusId)));
}

/** Add an ad-hoc knowledge node to a goal. Idempotent on (goal_id, node_id). */
export async function addGoalNode(
	goalId: string,
	userId: string,
	input: AddGoalNodeInput,
	db: Db = defaultDb,
): Promise<GoalNodeRow> {
	const existing = await getOwnedGoal(goalId, userId, db);
	const row: NewGoalNodeRow = {
		goalId: existing.id,
		knowledgeNodeId: input.knowledgeNodeId,
		weight: input.weight,
		notes: input.notes,
		seedOrigin: null,
		createdAt: new Date(),
	};
	const [result] = await db
		.insert(goalNode)
		.values(row)
		.onConflictDoUpdate({
			target: [goalNode.goalId, goalNode.knowledgeNodeId],
			set: { weight: input.weight, notes: input.notes },
		})
		.returning();
	if (!result) throw new Error('addGoalNode failed');
	return result;
}

/** Remove an ad-hoc knowledge node from a goal. No-op when not linked. */
export async function removeGoalNode(
	goalId: string,
	userId: string,
	knowledgeNodeId: string,
	db: Db = defaultDb,
): Promise<void> {
	const existing = await getOwnedGoal(goalId, userId, db);
	await db.delete(goalNode).where(and(eq(goalNode.goalId, existing.id), eq(goalNode.knowledgeNodeId, knowledgeNodeId)));
}

void GoalAlreadyPrimaryError; // exported for callers that pre-validate primary swaps
