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

import {
	type Cert,
	type Domain,
	GOAL_STATUSES,
	type GoalStatus,
	SYLLABUS_PRIMACY,
	SYLLABUS_STATUSES,
} from '@ab/constants';
import { db as defaultDb } from '@ab/db/connection';
import { generateGoalId } from '@ab/utils';
import { and, eq, inArray, sql } from 'drizzle-orm';
import type { PgDatabase, PgQueryResultHKT } from 'drizzle-orm/pg-core';
import {
	type AddGoalNodeInput,
	type AddGoalSyllabusInput,
	addGoalNodeInputSchema,
	addGoalSyllabusInputSchema,
	applyCertGoalsInputSchema,
	type CreateGoalInput,
	createGoalInputSchema,
	goalDomainListSchema,
	goalNodeIdListSchema,
	type UpdateGoalInput,
	updateGoalInputSchema,
} from './credentials.validation';
import { UpsertReturnedNoRowError } from './errors';
import {
	courseStep,
	credential,
	credentialSyllabus,
	type GoalNodeRow,
	type GoalRow,
	type GoalSyllabusRow,
	goal,
	goalCourse,
	goalNode,
	goalSyllabus,
	type NewGoalNodeRow,
	type NewGoalRow,
	type NewGoalSyllabusRow,
	syllabus,
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
 * Union of every knowledge node reachable through the goal. Walks three
 * sources in parallel:
 *
 *   1. `goal_syllabus -> syllabus_node (leaf) -> syllabus_node_link ->
 *      knowledge_node` (cert / school / personal syllabus paths)
 *   2. `goal_course -> course_step (level='step') -> knowledge_node` (course
 *      paths -- course-primitive WP, ADR 016 refinement 2026-05-08)
 *   3. `goal_node` (ad-hoc nodes pinned outside any syllabus or course)
 *
 * Aggregates weights when a node is reachable through multiple paths: the
 * highest weight wins. This matches the relevance cache rebuild's
 * "most-prominent context" semantic and pins the existing test in
 * `goals.test.ts` ("takes the max weight when a node is reachable via
 * multiple paths"). The course-primitive spec / design refer to this as
 * "summing weights"; the implementation preserves the shipped max-of-paths
 * behavior so cross-source aggregation stays consistent with the
 * pre-course goal_syllabus + goal_node case.
 */
export async function getGoalNodeUnion(
	goalId: string,
	db: Db = defaultDb,
): Promise<{ knowledgeNodeIds: string[]; weights: Record<string, number> }> {
	const [syllabusRows, courseRows, adhocRows] = await Promise.all([
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
			.select({
				knowledgeNodeId: courseStep.knowledgeNodeId,
				goalWeight: goalCourse.weight,
			})
			.from(goalCourse)
			.innerJoin(courseStep, eq(courseStep.courseId, goalCourse.courseId))
			.where(and(eq(goalCourse.goalId, goalId), eq(courseStep.level, 'step'))),
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
	for (const row of courseRows) {
		// Course steps with level='step' always carry a non-null knowledge
		// node (enforced by `course_step_consistency_check`), but TypeScript
		// sees the FK column as nullable. Skip defensively.
		if (row.knowledgeNodeId === null) continue;
		const prev = weights[row.knowledgeNodeId];
		if (prev === undefined || row.goalWeight > prev) weights[row.knowledgeNodeId] = row.goalWeight;
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
 *
 * Inputs are parsed against `createGoalInputSchema` at the BC boundary so
 * cross-BC callers and scripts can't inject oversized titles, oversized
 * notes, or malformed `targetDate` strings even when the route layer is
 * bypassed. Targeting fields (`focusDomains`, `skipDomains`, `skipNodes`)
 * land via separate setter helpers post-create.
 */
export async function createGoal(params: CreateGoalParams, db: Db = defaultDb): Promise<GoalRow> {
	const { userId } = params;
	const parsed = createGoalInputSchema.parse({
		title: params.title,
		notesMd: params.notesMd,
		isPrimary: params.isPrimary,
		targetDate: params.targetDate,
	});
	const id = generateGoalId();
	const now = new Date();
	const row: NewGoalRow = {
		id,
		userId,
		title: parsed.title,
		notesMd: parsed.notesMd ?? '',
		status: GOAL_STATUSES.ACTIVE,
		isPrimary: parsed.isPrimary ?? false,
		targetDate: parsed.targetDate ?? null,
		seedOrigin: null,
		createdAt: now,
		updatedAt: now,
	};
	if (row.isPrimary) {
		return db.transaction(async (tx) => {
			// Narrow to `is_primary = true` rows -- only those collide with the
			// partial UNIQUE. Sweeping every goal bumps `updatedAt` on rows
			// that didn't actually change, polluting `listGoals` ordering and
			// audit consumers. Mirrors `setPrimaryGoal` (`goals.ts:295`).
			await tx
				.update(goal)
				.set({ isPrimary: false, updatedAt: new Date() })
				.where(and(eq(goal.userId, userId), eq(goal.isPrimary, true)));
			const [inserted] = await tx.insert(goal).values(row).returning();
			if (!inserted) throw new UpsertReturnedNoRowError('goal', id);
			return inserted;
		});
	}
	const [inserted] = await db.insert(goal).values(row).returning();
	if (!inserted) throw new UpsertReturnedNoRowError('goal', id);
	return inserted;
}

/**
 * Patch fields on a goal. Returns the updated row. `setPrimaryGoal` is a
 * separate function -- updating `is_primary` here would risk colliding with
 * the partial UNIQUE without the explicit clear-others step.
 *
 * Inputs are parsed against `updateGoalInputSchema` at the BC boundary so
 * length/format/enum violations throw a `ZodError` regardless of caller.
 */
export async function updateGoal(
	goalId: string,
	userId: string,
	input: UpdateGoalInput,
	db: Db = defaultDb,
): Promise<GoalRow> {
	const parsed = updateGoalInputSchema.parse(input);
	const existing = await getOwnedGoal(goalId, userId, db);
	const updates: Partial<NewGoalRow> = { updatedAt: new Date() };
	if (parsed.title !== undefined) updates.title = parsed.title;
	if (parsed.notesMd !== undefined) updates.notesMd = parsed.notesMd;
	if (parsed.status !== undefined) updates.status = parsed.status;
	if (parsed.targetDate !== undefined) {
		updates.targetDate = parsed.targetDate;
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
 *
 * Inputs are parsed against `addGoalSyllabusInputSchema` so out-of-range
 * weights and missing syllabus ids fail at the BC boundary.
 */
export async function addGoalSyllabus(
	goalId: string,
	userId: string,
	input: AddGoalSyllabusInput,
	db: Db = defaultDb,
): Promise<GoalSyllabusRow> {
	const parsed = addGoalSyllabusInputSchema.parse(input);
	const existing = await getOwnedGoal(goalId, userId, db);
	const row: NewGoalSyllabusRow = {
		goalId: existing.id,
		syllabusId: parsed.syllabusId,
		weight: parsed.weight,
		seedOrigin: null,
		createdAt: new Date(),
	};
	const [result] = await db
		.insert(goalSyllabus)
		.values(row)
		.onConflictDoUpdate({
			target: [goalSyllabus.goalId, goalSyllabus.syllabusId],
			set: { weight: parsed.weight },
		})
		.returning();
	if (!result) throw new UpsertReturnedNoRowError('goal_syllabus', `${existing.id}:${input.syllabusId}`);
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

/**
 * Add an ad-hoc knowledge node to a goal. Idempotent on (goal_id, node_id).
 *
 * Inputs are parsed against `addGoalNodeInputSchema` so out-of-range
 * weights and oversized notes fail at the BC boundary.
 */
export async function addGoalNode(
	goalId: string,
	userId: string,
	input: AddGoalNodeInput,
	db: Db = defaultDb,
): Promise<GoalNodeRow> {
	const parsed = addGoalNodeInputSchema.parse(input);
	const existing = await getOwnedGoal(goalId, userId, db);
	const row: NewGoalNodeRow = {
		goalId: existing.id,
		knowledgeNodeId: parsed.knowledgeNodeId,
		weight: parsed.weight,
		notes: parsed.notes,
		seedOrigin: null,
		createdAt: new Date(),
	};
	const [result] = await db
		.insert(goalNode)
		.values(row)
		.onConflictDoUpdate({
			target: [goalNode.goalId, goalNode.knowledgeNodeId],
			set: { weight: parsed.weight, notes: parsed.notes },
		})
		.returning();
	if (!result) throw new UpsertReturnedNoRowError('goal_node', `${existing.id}:${input.knowledgeNodeId}`);
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

/**
 * Update the weight on an existing goal_node row. Mirrors the shape of
 * `setGoalSyllabusWeight`; idempotent. Silently no-ops when the
 * (goal_id, knowledge_node_id) pair has no row -- callers that need
 * upsert-style behavior should use `addGoalNode`.
 */
export async function setGoalNodeWeight(
	goalId: string,
	userId: string,
	knowledgeNodeId: string,
	weight: number,
	db: Db = defaultDb,
): Promise<void> {
	const existing = await getOwnedGoal(goalId, userId, db);
	await db
		.update(goalNode)
		.set({ weight })
		.where(and(eq(goalNode.goalId, existing.id), eq(goalNode.knowledgeNodeId, knowledgeNodeId)));
}

// ---------------------------------------------------------------------------
// Goal targeting fields -- engine-goal-cutover
// ---------------------------------------------------------------------------

/**
 * Read the goal's `focus_domains` array. Empty array means "no narrowing"
 * (engine sees the full domain pool).
 */
export async function getGoalFocusDomains(goalId: string, db: Db = defaultDb): Promise<Domain[]> {
	const row = await getGoalById(goalId, db);
	return row.focusDomains;
}

/** Read the goal's `skip_domains` array. */
export async function getGoalSkipDomains(goalId: string, db: Db = defaultDb): Promise<Domain[]> {
	const row = await getGoalById(goalId, db);
	return row.skipDomains;
}

/** Read the goal's `skip_nodes` array. */
export async function getGoalSkipNodes(goalId: string, db: Db = defaultDb): Promise<string[]> {
	const row = await getGoalById(goalId, db);
	return row.skipNodes;
}

/**
 * Set the goal's `focus_domains` list. Owned-goal check enforces caller
 * authorization; the input is parsed against `goalDomainListSchema` so an
 * unknown domain slug fails at the BC boundary regardless of caller.
 */
export async function setGoalFocusDomains(
	goalId: string,
	userId: string,
	domains: readonly Domain[],
	db: Db = defaultDb,
): Promise<void> {
	const parsed = goalDomainListSchema.parse(domains);
	const existing = await getOwnedGoal(goalId, userId, db);
	await db.update(goal).set({ focusDomains: parsed, updatedAt: new Date() }).where(eq(goal.id, existing.id));
}

/** Set the goal's `skip_domains` list. Domains validated at the BC boundary. */
export async function setGoalSkipDomains(
	goalId: string,
	userId: string,
	domains: readonly Domain[],
	db: Db = defaultDb,
): Promise<void> {
	const parsed = goalDomainListSchema.parse(domains);
	const existing = await getOwnedGoal(goalId, userId, db);
	await db.update(goal).set({ skipDomains: parsed, updatedAt: new Date() }).where(eq(goal.id, existing.id));
}

/** Set the goal's `skip_nodes` list. Node ids validated at the BC boundary. */
export async function setGoalSkipNodes(
	goalId: string,
	userId: string,
	nodes: readonly string[],
	db: Db = defaultDb,
): Promise<void> {
	const parsed = goalNodeIdListSchema.parse(nodes);
	const existing = await getOwnedGoal(goalId, userId, db);
	await db.update(goal).set({ skipNodes: parsed, updatedAt: new Date() }).where(eq(goal.id, existing.id));
}

/**
 * Result of `applyCertGoalsToPrimaryGoal`.
 *
 * `skippedCerts` lists the cert slugs that could not be linked because
 * either the credential or its primary syllabus was missing. The caller
 * should surface these so the operator can finish seeding credentials.
 */
export interface ApplyCertGoalsResult {
	goalId: string;
	created: boolean;
	skippedCerts: readonly string[];
}

/**
 * Apply a list of cert slugs to the user's primary goal, creating one
 * if none exists. Resolves all slugs in two batched reads
 * (`credential` by slug, then primary `credential_syllabus` by credential
 * id) instead of a per-cert sequential walk; the resulting
 * `goal_syllabus` rows are upserted via `addGoalSyllabus` so the call is
 * idempotent on re-run.
 *
 * Replaces the legacy "write to `study_plan.cert_goals`" path. Used by
 * write-through callers (preset start, dev seed) that need to install
 * cert intent without forcing the learner through the goal-composer
 * flow. Plan-edit pages redirect to the goal composer instead and never
 * call this helper.
 */
export async function applyCertGoalsToPrimaryGoal(
	userId: string,
	certs: readonly Cert[],
	options: { goalTitle?: string; focusDomains?: readonly Domain[]; skipDomains?: readonly Domain[] } = {},
	db: Db = defaultDb,
): Promise<ApplyCertGoalsResult> {
	// Validate at the BC boundary: shape-check `userId`, the `certs` array
	// (every entry a non-empty string), and the optional targeting overrides
	// against `DOMAIN_VALUES` plus the goal-title length cap. The schema's
	// `parse` throws `ZodError` for any shape violation before any DB I/O
	// fires. Cert slug enum-checking is intentionally NOT done here -- the
	// function already resolves each slug against `credential.slug` and
	// reports unknown slugs through `skippedCerts`.
	applyCertGoalsInputSchema.parse({ userId, certs, options });
	// Resolve everything we need to write before opening the transaction
	// (read-only credential / syllabus lookups don't need the tx scope).
	// The transaction then takes ownership of every write -- targeting
	// patch + per-cert goal_syllabus upserts -- so a mid-loop failure
	// cannot leave a partially-built primary goal that
	// `getDerivedCertGoals` could read while the user is mid-action.
	const certSlugs = [...new Set(certs)];

	const credentialRows =
		certSlugs.length === 0
			? []
			: await db
					.select({ id: credential.id, slug: credential.slug })
					.from(credential)
					.where(inArray(credential.slug, certSlugs));
	const credBySlug = new Map(credentialRows.map((r) => [r.slug, r.id] as const));

	const foundCredIds = credentialRows.map((r) => r.id);

	const primarySyllabusRows =
		foundCredIds.length === 0
			? []
			: await db
					.select({ credentialId: credentialSyllabus.credentialId, syllabusId: credentialSyllabus.syllabusId })
					.from(credentialSyllabus)
					.innerJoin(syllabus, eq(syllabus.id, credentialSyllabus.syllabusId))
					.where(
						and(
							inArray(credentialSyllabus.credentialId, foundCredIds),
							eq(credentialSyllabus.primacy, SYLLABUS_PRIMACY.PRIMARY),
							eq(syllabus.status, SYLLABUS_STATUSES.ACTIVE),
						),
					);
	const syllabusByCredId = new Map(primarySyllabusRows.map((r) => [r.credentialId, r.syllabusId] as const));

	// Resolve each requested slug; record skips when either lookup missed.
	// Preserves input order so deterministic re-runs hit goal_syllabus
	// rows in the same order.
	const skippedCerts: string[] = [];
	const resolved: Array<{ slug: Cert; syllabusId: string }> = [];
	const seen = new Set<Cert>();
	for (const certSlug of certs) {
		if (seen.has(certSlug)) continue;
		seen.add(certSlug);
		const credId = credBySlug.get(certSlug);
		if (credId === undefined) {
			skippedCerts.push(certSlug);
			continue;
		}
		const syllabusId = syllabusByCredId.get(credId);
		if (syllabusId === undefined) {
			skippedCerts.push(certSlug);
			continue;
		}
		resolved.push({ slug: certSlug, syllabusId });
	}

	return await db.transaction(async (tx) => {
		let primary = await getPrimaryGoal(userId, tx);
		let created = false;
		if (primary === null) {
			primary = await createGoal(
				{
					userId,
					title: options.goalTitle ?? 'Study goal',
					notesMd: '',
					isPrimary: true,
				},
				tx,
			);
			created = true;
		}

		// Apply optional targeting fields to the primary goal in a single
		// update so the helper is the only writer for these columns on this
		// path. Empty arrays are valid -- they unset narrowing.
		const targetingPatch: Partial<{ focusDomains: Domain[]; skipDomains: Domain[]; updatedAt: Date }> = {};
		if (options.focusDomains !== undefined) targetingPatch.focusDomains = [...options.focusDomains];
		if (options.skipDomains !== undefined) targetingPatch.skipDomains = [...options.skipDomains];
		if (Object.keys(targetingPatch).length > 0) {
			targetingPatch.updatedAt = new Date();
			await tx.update(goal).set(targetingPatch).where(eq(goal.id, primary.id));
		}

		// Each upsert targets a distinct (goal_id, syllabus_id) row; running
		// in parallel via Promise.all collapses N round-trips into one
		// batched wait. A failure on any one will roll the targeting patch
		// (and the just-created primary goal, when applicable) back.
		if (resolved.length > 0) {
			await Promise.all(
				resolved.map((r) => addGoalSyllabus(primary.id, userId, { syllabusId: r.syllabusId, weight: 1.0 }, tx)),
			);
		}

		return { goalId: primary.id, created, skippedCerts };
	});
}
