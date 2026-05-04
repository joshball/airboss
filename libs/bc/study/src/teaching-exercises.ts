/**
 * Teaching-exercise BC functions (evidence-kind-data-layer WP).
 *
 * Owns the lifecycle of `study.teaching_exercise` rows -- the substrate for
 * CFI-style "explain or demonstrate" prompts. Mirrors `scenarios.ts`'s shape
 * but kept separate because teaching exercises are free-response prompts,
 * not multiple-choice decision reps; reusing the scenario table would force
 * NULL `scenario_option` rows and break the "exactly one correct option"
 * invariant.
 *
 * Inputs are validated here (`newTeachingExerciseSchema` /
 * `updateTeachingExerciseSchema` in validation.ts) so cross-BC callers and
 * scripts can't inject invalid values.
 */

import { type Domain, SCENARIO_STATUSES, type ScenarioStatus } from '@ab/constants';
import { db as defaultDb } from '@ab/db/connection';
import { generateTeachingExerciseId } from '@ab/utils';
import { and, asc, desc, eq, isNull, type SQL } from 'drizzle-orm';
import type { PgDatabase, PgQueryResultHKT } from 'drizzle-orm/pg-core';
import { type TeachingExerciseRow, teachingExercise } from './schema';
import {
	type NewTeachingExerciseInput,
	newTeachingExerciseSchema,
	type UpdateTeachingExerciseInput,
	updateTeachingExerciseSchema,
} from './validation';

type Db = PgDatabase<PgQueryResultHKT, Record<string, never>>;

export type { NewTeachingExerciseInput, TeachingExerciseRow, UpdateTeachingExerciseInput };

/** Raised when a teaching exercise can't be found for the given user. */
export class TeachingExerciseNotFoundError extends Error {
	constructor(
		public readonly id: string,
		public readonly userId: string,
	) {
		super(`Teaching exercise ${id} not found for user ${userId}`);
		this.name = 'TeachingExerciseNotFoundError';
	}
}

/** Raised when caller tries to edit a non-editable teaching exercise. */
export class TeachingExerciseNotEditableError extends Error {
	constructor(public readonly id: string) {
		super(`Teaching exercise ${id} is not editable`);
		this.name = 'TeachingExerciseNotEditableError';
	}
}

export interface CreateTeachingExerciseInput extends NewTeachingExerciseInput {
	userId: string;
	/** Dev-seed marker. NULL on production rows. Mirrors the scenario seed pattern. */
	seedOrigin?: string | null;
}

export interface TeachingExerciseFilters {
	/** Scope to a single knowledge-graph node (NULL = unattached / personal). */
	nodeId?: string | null;
	status?: ScenarioStatus | ScenarioStatus[];
	limit?: number;
	offset?: number;
}

/**
 * Create a new teaching exercise. Validates via the zod schema and writes a
 * single row -- there are no companion rows (unlike scenario, which writes
 * `scenario_option` siblings). Defaults `status='active'` and `isEditable=true`.
 */
export async function createTeachingExercise(
	input: CreateTeachingExerciseInput,
	db: Db = defaultDb,
): Promise<TeachingExerciseRow> {
	const parsed = newTeachingExerciseSchema.parse({
		title: input.title,
		prompt: input.prompt,
		domain: input.domain,
		nodeId: input.nodeId,
		isEditable: input.isEditable,
	});
	const id = generateTeachingExerciseId();
	const now = new Date();
	const [inserted] = await db
		.insert(teachingExercise)
		.values({
			id,
			userId: input.userId,
			title: parsed.title,
			prompt: parsed.prompt,
			domain: parsed.domain as Domain,
			nodeId: parsed.nodeId ?? null,
			isEditable: parsed.isEditable ?? true,
			status: SCENARIO_STATUSES.ACTIVE,
			seedOrigin: input.seedOrigin ?? null,
			createdAt: now,
		})
		.returning();
	return inserted;
}

/** Fetch a single teaching exercise by id (must belong to the user). */
export async function getTeachingExercise(
	id: string,
	userId: string,
	db: Db = defaultDb,
): Promise<TeachingExerciseRow | null> {
	const [row] = await db
		.select()
		.from(teachingExercise)
		.where(and(eq(teachingExercise.id, id), eq(teachingExercise.userId, userId)))
		.limit(1);
	return row ?? null;
}

/**
 * Browse teaching exercises for a user. Default order: most recently created
 * first. Default status filter: active only. `nodeId: null` filters to
 * unattached / personal exercises explicitly; omit the field to mix.
 */
export async function getTeachingExercises(
	userId: string,
	filters: TeachingExerciseFilters = {},
	db: Db = defaultDb,
): Promise<TeachingExerciseRow[]> {
	const statusFilter = filters.status
		? Array.isArray(filters.status)
			? filters.status
			: [filters.status]
		: [SCENARIO_STATUSES.ACTIVE];

	const clauses: SQL[] = [eq(teachingExercise.userId, userId)];
	for (const s of statusFilter) clauses.push(eq(teachingExercise.status, s));
	if (filters.nodeId === null) {
		clauses.push(isNull(teachingExercise.nodeId));
	} else if (filters.nodeId !== undefined) {
		clauses.push(eq(teachingExercise.nodeId, filters.nodeId));
	}

	let q = db
		.select()
		.from(teachingExercise)
		.where(and(...clauses))
		.orderBy(desc(teachingExercise.createdAt))
		.$dynamic();

	if (filters.limit !== undefined && filters.limit > 0) q = q.limit(filters.limit);
	if (filters.offset !== undefined && filters.offset > 0) q = q.offset(filters.offset);

	return await q;
}

/**
 * Update an editable teaching exercise. Refuses to update non-editable rows
 * (course-authored content). Whitelists fields explicitly so callers that
 * bypass TypeScript can't slip extra columns into the patch.
 */
export async function updateTeachingExercise(
	id: string,
	userId: string,
	patch: UpdateTeachingExerciseInput,
	db: Db = defaultDb,
): Promise<TeachingExerciseRow> {
	const parsed = updateTeachingExerciseSchema.parse(patch);

	const [existing] = await db
		.select()
		.from(teachingExercise)
		.where(and(eq(teachingExercise.id, id), eq(teachingExercise.userId, userId)))
		.limit(1);
	if (!existing) throw new TeachingExerciseNotFoundError(id, userId);
	if (!existing.isEditable) throw new TeachingExerciseNotEditableError(id);

	const update: Partial<TeachingExerciseRow> = {};
	if (parsed.title !== undefined) update.title = parsed.title;
	if (parsed.prompt !== undefined) update.prompt = parsed.prompt;
	if (parsed.domain !== undefined) update.domain = parsed.domain as Domain;
	// `nodeId` is nullish in the schema: undefined leaves the field alone,
	// `null` explicitly clears the link.
	if (parsed.nodeId !== undefined) update.nodeId = parsed.nodeId ?? null;

	if (Object.keys(update).length === 0) return existing;

	const [updated] = await db
		.update(teachingExercise)
		.set(update)
		.where(and(eq(teachingExercise.id, id), eq(teachingExercise.userId, userId)))
		.returning();
	return updated;
}

/** Delete a teaching exercise. session_item_result rows that referenced it
 * keep their row; the FK clears `teaching_exercise_id` to NULL. */
export async function deleteTeachingExercise(id: string, userId: string, db: Db = defaultDb): Promise<void> {
	await db.delete(teachingExercise).where(and(eq(teachingExercise.id, id), eq(teachingExercise.userId, userId)));
}

/** Browse teaching exercises attached to a single (user, node). Powers the
 * teaching-gate query in `mastery.ts`. */
export async function getTeachingExercisesForNode(
	userId: string,
	nodeId: string,
	db: Db = defaultDb,
): Promise<TeachingExerciseRow[]> {
	return await db
		.select()
		.from(teachingExercise)
		.where(
			and(
				eq(teachingExercise.userId, userId),
				eq(teachingExercise.nodeId, nodeId),
				eq(teachingExercise.status, SCENARIO_STATUSES.ACTIVE),
			),
		)
		.orderBy(asc(teachingExercise.createdAt));
}
