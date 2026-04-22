/**
 * Study plan BC functions.
 *
 * Study plans are mutable config aggregates (spec "Plan lifecycle"): one
 * active plan per user, enforced by a partial UNIQUE index on
 * study.study_plan(user_id) WHERE status='active'. The index is declared in
 * the Drizzle schema (`planUserActiveUniq`) so `bun run db push` creates it;
 * `scripts/db/plan-active-unique.sql` is kept as a backward-compatible
 * one-shot for databases provisioned before the DSL expression landed.
 * Creating or activating a plan archives any other active plan for the user
 * inside the same transaction so the invariant holds even when the DB index
 * is missing in ancient environments.
 */

import {
	type Cert,
	type DepthPreference,
	type Domain,
	PLAN_STATUSES,
	type PlanStatus,
	type SessionMode,
} from '@ab/constants';
import { db as defaultDb } from '@ab/db';
import { generateStudyPlanId } from '@ab/utils';
import { and, desc, eq } from 'drizzle-orm';
import type { PgDatabase, PgQueryResultHKT } from 'drizzle-orm/pg-core';
import { createPlanSchema, updatePlanSchema } from './plans.validation';
import { type StudyPlanRow, studyPlan } from './schema';

type Db = PgDatabase<PgQueryResultHKT, Record<string, never>>;

export class PlanNotFoundError extends Error {
	constructor(
		public readonly planId: string,
		public readonly userId: string,
	) {
		super(`Plan ${planId} not found for user ${userId}`);
		this.name = 'PlanNotFoundError';
	}
}

/**
 * Raised when the caller attempts to perform an action that requires an
 * active plan (e.g., starting a session) and the user has none. The callers
 * in the route layer surface this as "set up your plan" empty state.
 */
export class NoActivePlanError extends Error {
	constructor(public readonly userId: string) {
		super(`User ${userId} has no active study plan`);
		this.name = 'NoActivePlanError';
	}
}

/** Defensive guard; the partial UNIQUE index prevents the race. */
export class DuplicateActivePlanError extends Error {
	constructor(public readonly userId: string) {
		super(`User ${userId} already has an active plan`);
		this.name = 'DuplicateActivePlanError';
	}
}

/**
 * Raised when a plan patch would leave `focus_domains` and `skip_domains`
 * overlapping -- the PRD invariant ("focus and skip are disjoint"). Typed so
 * route code can surface a fixed user-facing message rather than leaking
 * `Error.message` text directly.
 */
export class DomainOverlapError extends Error {
	constructor(public readonly domain: string) {
		super(`"${domain}" is in focus_domains; focus and skip must be disjoint`);
		this.name = 'DomainOverlapError';
	}
}

export interface CreatePlanInput {
	userId: string;
	title?: string;
	certGoals: readonly Cert[];
	focusDomains?: readonly Domain[];
	skipDomains?: readonly Domain[];
	skipNodes?: readonly string[];
	depthPreference?: DepthPreference;
	sessionLength?: number;
	defaultMode?: SessionMode;
}

export interface UpdatePlanInput {
	title?: string;
	certGoals?: readonly Cert[];
	focusDomains?: readonly Domain[];
	skipDomains?: readonly Domain[];
	skipNodes?: readonly string[];
	depthPreference?: DepthPreference;
	sessionLength?: number;
	defaultMode?: SessionMode;
	status?: PlanStatus;
}

/**
 * Create a plan and activate it. Any previously-active plan for the user is
 * archived inside the same transaction. The partial UNIQUE index is the
 * backstop.
 */
export async function createPlan(input: CreatePlanInput, db: Db = defaultDb): Promise<StudyPlanRow> {
	const parsed = createPlanSchema.parse({
		title: input.title,
		certGoals: input.certGoals,
		focusDomains: input.focusDomains ?? [],
		skipDomains: input.skipDomains ?? [],
		skipNodes: input.skipNodes ?? [],
		depthPreference: input.depthPreference,
		sessionLength: input.sessionLength,
		defaultMode: input.defaultMode,
	});

	const id = generateStudyPlanId();
	const now = new Date();

	return await db.transaction(async (tx) => {
		await tx
			.update(studyPlan)
			.set({ status: PLAN_STATUSES.ARCHIVED, updatedAt: now })
			.where(and(eq(studyPlan.userId, input.userId), eq(studyPlan.status, PLAN_STATUSES.ACTIVE)));

		const rowsToInsert = {
			id,
			userId: input.userId,
			title: parsed.title ?? 'Default Plan',
			status: PLAN_STATUSES.ACTIVE,
			certGoals: parsed.certGoals as Cert[],
			focusDomains: (parsed.focusDomains ?? []) as Domain[],
			skipDomains: (parsed.skipDomains ?? []) as Domain[],
			skipNodes: parsed.skipNodes ?? [],
			...(parsed.depthPreference !== undefined ? { depthPreference: parsed.depthPreference as DepthPreference } : {}),
			...(parsed.sessionLength !== undefined ? { sessionLength: parsed.sessionLength } : {}),
			...(parsed.defaultMode !== undefined ? { defaultMode: parsed.defaultMode as SessionMode } : {}),
			createdAt: now,
			updatedAt: now,
		};
		try {
			const [inserted] = await tx.insert(studyPlan).values(rowsToInsert).returning();
			return inserted;
		} catch (err) {
			// The partial UNIQUE index is our race guard; unique_violation here
			// means another transaction just inserted an active plan between
			// our archive and insert.
			if (err instanceof Error && /unique|duplicate/i.test(err.message)) {
				throw new DuplicateActivePlanError(input.userId);
			}
			throw err;
		}
	});
}

/** Fetch a plan by id scoped to the caller. */
export async function getPlan(planId: string, userId: string, db: Db = defaultDb): Promise<StudyPlanRow | null> {
	const [row] = await db
		.select()
		.from(studyPlan)
		.where(and(eq(studyPlan.id, planId), eq(studyPlan.userId, userId)))
		.limit(1);
	return row ?? null;
}

/** The user's single active plan, if any. */
export async function getActivePlan(userId: string, db: Db = defaultDb): Promise<StudyPlanRow | null> {
	const [row] = await db
		.select()
		.from(studyPlan)
		.where(and(eq(studyPlan.userId, userId), eq(studyPlan.status, PLAN_STATUSES.ACTIVE)))
		.limit(1);
	return row ?? null;
}

/** All plans for a user, ordered newest-first. */
export async function getPlans(userId: string, db: Db = defaultDb): Promise<StudyPlanRow[]> {
	return await db.select().from(studyPlan).where(eq(studyPlan.userId, userId)).orderBy(desc(studyPlan.createdAt));
}

/** Patch a plan. Callers should not change `status` here; use archive/activate. */
export async function updatePlan(
	planId: string,
	userId: string,
	patch: UpdatePlanInput,
	db: Db = defaultDb,
): Promise<StudyPlanRow> {
	const parsed = updatePlanSchema.parse(patch);

	const existing = await getPlan(planId, userId, db);
	if (!existing) throw new PlanNotFoundError(planId, userId);

	// The patch-only schema can't enforce focus-vs-skip disjointness when only
	// one side is present in the patch. Re-check against the merged values
	// here so partial updates don't sneak past the invariant.
	const mergedFocus = new Set<Domain>((parsed.focusDomains ?? existing.focusDomains) as Domain[]);
	const mergedSkip = (parsed.skipDomains ?? existing.skipDomains) as Domain[];
	for (const d of mergedSkip) {
		if (mergedFocus.has(d)) {
			throw new DomainOverlapError(d);
		}
	}

	const update: Partial<StudyPlanRow> = { updatedAt: new Date() };
	if (parsed.title !== undefined) update.title = parsed.title;
	if (parsed.certGoals !== undefined) update.certGoals = parsed.certGoals as Cert[];
	if (parsed.focusDomains !== undefined) update.focusDomains = parsed.focusDomains as Domain[];
	if (parsed.skipDomains !== undefined) update.skipDomains = parsed.skipDomains as Domain[];
	if (parsed.skipNodes !== undefined) update.skipNodes = parsed.skipNodes;
	if (parsed.depthPreference !== undefined) update.depthPreference = parsed.depthPreference as DepthPreference;
	if (parsed.sessionLength !== undefined) update.sessionLength = parsed.sessionLength;
	if (parsed.defaultMode !== undefined) update.defaultMode = parsed.defaultMode as SessionMode;
	if (parsed.status !== undefined) update.status = parsed.status as PlanStatus;

	const [updated] = await db
		.update(studyPlan)
		.set(update)
		.where(and(eq(studyPlan.id, planId), eq(studyPlan.userId, userId)))
		.returning();

	return updated;
}

/** Archive a plan. Safe even when the plan is already archived. */
export async function archivePlan(planId: string, userId: string, db: Db = defaultDb): Promise<StudyPlanRow> {
	const existing = await getPlan(planId, userId, db);
	if (!existing) throw new PlanNotFoundError(planId, userId);
	const [updated] = await db
		.update(studyPlan)
		.set({ status: PLAN_STATUSES.ARCHIVED, updatedAt: new Date() })
		.where(and(eq(studyPlan.id, planId), eq(studyPlan.userId, userId)))
		.returning();
	return updated;
}

/**
 * Activate a plan. Archives any other active plan for the user in the same
 * transaction -- the partial UNIQUE index is the backstop. The target plan
 * itself is flipped to active last, after any other active plan for the
 * user has been archived.
 */
export async function activatePlan(planId: string, userId: string, db: Db = defaultDb): Promise<StudyPlanRow> {
	const existing = await getPlan(planId, userId, db);
	if (!existing) throw new PlanNotFoundError(planId, userId);

	const now = new Date();
	return await db.transaction(async (tx) => {
		// Archive any active plan owned by this user -- the one we're about to
		// activate has status != 'active' so it's unaffected.
		await tx
			.update(studyPlan)
			.set({ status: PLAN_STATUSES.ARCHIVED, updatedAt: now })
			.where(and(eq(studyPlan.userId, userId), eq(studyPlan.status, PLAN_STATUSES.ACTIVE)));
		const [row] = await tx
			.update(studyPlan)
			.set({ status: PLAN_STATUSES.ACTIVE, updatedAt: now })
			.where(and(eq(studyPlan.id, planId), eq(studyPlan.userId, userId)))
			.returning();
		return row;
	});
}

/**
 * Append a node id to `plan.skip_nodes`. Idempotent -- calling twice with
 * the same node id does not create duplicates.
 */
export async function addSkipNode(
	planId: string,
	userId: string,
	nodeId: string,
	db: Db = defaultDb,
): Promise<StudyPlanRow> {
	const existing = await getPlan(planId, userId, db);
	if (!existing) throw new PlanNotFoundError(planId, userId);
	if (existing.skipNodes.includes(nodeId)) return existing;
	return await updatePlan(planId, userId, { skipNodes: [...existing.skipNodes, nodeId] }, db);
}

/** Append a domain to `plan.skip_domains`. Idempotent. */
export async function addSkipDomain(
	planId: string,
	userId: string,
	domain: Domain,
	db: Db = defaultDb,
): Promise<StudyPlanRow> {
	const existing = await getPlan(planId, userId, db);
	if (!existing) throw new PlanNotFoundError(planId, userId);
	if (existing.skipDomains.includes(domain)) return existing;
	// If the user has this domain in focus_domains, also drop it so the
	// disjoint invariant holds.
	const focusDomains = existing.focusDomains.filter((d) => d !== domain);
	return await updatePlan(planId, userId, { skipDomains: [...existing.skipDomains, domain], focusDomains }, db);
}

/**
 * Remove a node from plan.skip_nodes. Used by the plan detail page to let
 * the user reactivate a skipped topic without losing other skip entries.
 */
export async function removeSkipNode(
	planId: string,
	userId: string,
	nodeId: string,
	db: Db = defaultDb,
): Promise<StudyPlanRow> {
	const existing = await getPlan(planId, userId, db);
	if (!existing) throw new PlanNotFoundError(planId, userId);
	const next = existing.skipNodes.filter((n) => n !== nodeId);
	if (next.length === existing.skipNodes.length) return existing;
	return await updatePlan(planId, userId, { skipNodes: next }, db);
}

/** Remove a domain from plan.skip_domains. */
export async function removeSkipDomain(
	planId: string,
	userId: string,
	domain: Domain,
	db: Db = defaultDb,
): Promise<StudyPlanRow> {
	const existing = await getPlan(planId, userId, db);
	if (!existing) throw new PlanNotFoundError(planId, userId);
	const next = existing.skipDomains.filter((d) => d !== domain);
	if (next.length === existing.skipDomains.length) return existing;
	return await updatePlan(planId, userId, { skipDomains: next as Domain[] }, db);
}
