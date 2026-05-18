/**
 * Personal-minimums BC -- server-only persistence for a pilot's stated
 * go/no-go floors (personal-minimums-as-typed-contract WP).
 *
 * Append-only revision log: every save inserts a new row; the prior active
 * row flips `is_active = false` and stamps `effective_until = now()`. The
 * partial unique index `personal_minimums_one_active_per_user_uidx`
 * guarantees at most one active row per user at the storage layer; the
 * `createPersonalMinimumsRevision` transaction enforces the same invariant
 * at the app layer and serialises concurrent writers.
 *
 * This module touches `@ab/db/connection` (the postgres driver) and is
 * therefore server-only. It is re-exported from `@ab/bc-study/server` only;
 * the runtime barrel `@ab/bc-study` re-exports only its `type`s. The pure
 * lens projection lives in `./personal-minimums-lens.ts` (browser-safe).
 *
 * Every mutation emits one `audit_log` row (`AUDIT_TARGETS.PERSONAL_MINIMUMS`)
 * with the before / after record snapshots so the change history is
 * reconstructable from the audit trail.
 */

import { AUDIT_OPS } from '@ab/audit';
import { auditWrite } from '@ab/audit/server';
import { AUDIT_TARGETS, PERSONAL_MINIMUMS_OP_SUBKINDS } from '@ab/constants';
import { db as defaultDb } from '@ab/db/connection';
import type { PersonalMinimumsInput } from '@ab/types';
import { personalMinimumsInputSchema } from '@ab/types';
import { generatePersonalMinimumsId } from '@ab/utils';
import { and, desc, eq, sql } from 'drizzle-orm';
import type { PgDatabase, PgQueryResultHKT } from 'drizzle-orm/pg-core';
import { type PersonalMinimumsRow, personalMinimums } from './schema';

type Db = PgDatabase<PgQueryResultHKT, Record<string, never>>;

/**
 * The personal-minimums record as consumers see it. Mirrors the Drizzle
 * `$inferSelect` of `study.personal_minimums` except `visibilitySm`, which
 * Drizzle returns as a `string` for `numeric` columns -- the BC normalises
 * it to a `number` so every consumer reads a uniform shape.
 *
 * See the WP CONSUMER-CONTRACT.md for the full per-field documentation.
 */
export interface PersonalMinimums {
	id: string;
	userId: string;
	ceilingFt: number;
	visibilitySm: number;
	windTotalKt: number;
	crosswindTotalKt: number;
	nightRequiredRecencyLandings: number;
	imcRequiredRecencyApproaches: number;
	paxMax: number;
	terrainBufferAgl: number;
	notes: string | null;
	isActive: boolean;
	effectiveFrom: Date;
	effectiveUntil: Date | null;
	seedOrigin: string | null;
	createdAt: Date;
	updatedAt: Date;
}

/**
 * Raised when the partial unique index rejects a second active row for a
 * user -- the concurrent-edit race (two browser tabs both saving). The
 * form action translates this into a 409 "your minimums changed in another
 * tab -- reload."
 */
export class PersonalMinimumsConflictError extends Error {
	readonly code = 'PERSONAL_MINIMUMS_CONFLICT';
	constructor(public readonly userId: string) {
		super(`Personal minimums for user ${userId} changed concurrently; reload before saving.`);
		this.name = 'PersonalMinimumsConflictError';
	}
}

/** Postgres unique-violation SQLSTATE. */
const UNIQUE_VIOLATION = '23505';

/** Name of the partial unique index that enforces one-active-per-user. */
const ONE_ACTIVE_INDEX = 'personal_minimums_one_active_per_user_uidx';

/**
 * True when `err` is a postgres unique-constraint violation on the
 * personal-minimums one-active index. postgres-js surfaces the violated
 * constraint on either `constraint` or `constraint_name` depending on the
 * driver path (see `composite-fks.schema.test.ts`); we check both, gated
 * on the `23505` SQLSTATE.
 */
function isOneActiveUniqueViolation(err: unknown): boolean {
	if (typeof err !== 'object' || err === null) return false;
	const e = err as { code?: unknown; constraint?: unknown; constraint_name?: unknown };
	if (e.code !== UNIQUE_VIOLATION) return false;
	return e.constraint === ONE_ACTIVE_INDEX || e.constraint_name === ONE_ACTIVE_INDEX;
}

/** Normalise a raw Drizzle row (`visibility_sm` is `string`) to {@link PersonalMinimums}. */
function toPersonalMinimums(row: PersonalMinimumsRow): PersonalMinimums {
	return {
		id: row.id,
		userId: row.userId,
		ceilingFt: row.ceilingFt,
		visibilitySm: Number(row.visibilitySm),
		windTotalKt: row.windTotalKt,
		crosswindTotalKt: row.crosswindTotalKt,
		nightRequiredRecencyLandings: row.nightRequiredRecencyLandings,
		imcRequiredRecencyApproaches: row.imcRequiredRecencyApproaches,
		paxMax: row.paxMax,
		terrainBufferAgl: row.terrainBufferAgl,
		notes: row.notes,
		isActive: row.isActive,
		effectiveFrom: row.effectiveFrom,
		effectiveUntil: row.effectiveUntil,
		seedOrigin: row.seedOrigin,
		createdAt: row.createdAt,
		updatedAt: row.updatedAt,
	};
}

/**
 * The user's currently-active personal minimums, or `null` if they have
 * never set any (or have just deactivated). The consumer entrypoint.
 */
export async function getActivePersonalMinimums(userId: string, db: Db = defaultDb): Promise<PersonalMinimums | null> {
	const [row] = await db
		.select()
		.from(personalMinimums)
		.where(and(eq(personalMinimums.userId, userId), eq(personalMinimums.isActive, true)))
		.limit(1);
	return row === undefined ? null : toPersonalMinimums(row);
}

/**
 * Every personal-minimums revision for the user, newest first (ordered by
 * `effective_from DESC`). The audit / debrief entrypoint -- a future
 * decision-debrief replay walks this to find the revision active on a
 * given flight date.
 */
export async function getPersonalMinimumsHistory(userId: string, db: Db = defaultDb): Promise<PersonalMinimums[]> {
	const rows = await db
		.select()
		.from(personalMinimums)
		.where(eq(personalMinimums.userId, userId))
		.orderBy(desc(personalMinimums.effectiveFrom));
	return rows.map(toPersonalMinimums);
}

/**
 * Record a new personal-minimums revision.
 *
 * Transactional: (1) flips the existing active row's `is_active = false`
 * and stamps `effective_until = now()`, (2) inserts the new row with
 * `is_active = true`, `effective_from = now()`, `effective_until = null`,
 * (3) emits an `audit_log` row referencing the prior + next snapshots.
 *
 * The prior row is never mutated beyond the active flag + the close
 * timestamp -- the history is append-only. Identical re-saves are NOT
 * deduped: a pilot deliberately re-affirming their floor at the start of a
 * training block is a legitimate audit event.
 *
 * Throws {@link PersonalMinimumsConflictError} when a concurrent writer
 * wins the partial-unique-index race.
 */
export async function createPersonalMinimumsRevision(
	userId: string,
	input: PersonalMinimumsInput,
	db: Db = defaultDb,
): Promise<PersonalMinimums> {
	const parsed = personalMinimumsInputSchema.parse(input);
	try {
		const inserted = await db.transaction(async (tx) => {
			const [prior] = await tx
				.update(personalMinimums)
				.set({ isActive: false, effectiveUntil: sql`now()` })
				.where(and(eq(personalMinimums.userId, userId), eq(personalMinimums.isActive, true)))
				.returning();

			const [next] = await tx
				.insert(personalMinimums)
				.values({
					id: generatePersonalMinimumsId(),
					userId,
					ceilingFt: parsed.ceilingFt,
					visibilitySm: parsed.visibilitySm.toFixed(1),
					windTotalKt: parsed.windTotalKt,
					crosswindTotalKt: parsed.crosswindTotalKt,
					nightRequiredRecencyLandings: parsed.nightRequiredRecencyLandings,
					imcRequiredRecencyApproaches: parsed.imcRequiredRecencyApproaches,
					paxMax: parsed.paxMax,
					terrainBufferAgl: parsed.terrainBufferAgl,
					notes: parsed.notes ?? null,
					isActive: true,
				})
				.returning();
			if (next === undefined) throw new Error('createPersonalMinimumsRevision: insert returned no row');

			await auditWrite(
				{
					actorId: userId,
					op: AUDIT_OPS.CREATE,
					targetType: AUDIT_TARGETS.PERSONAL_MINIMUMS,
					targetId: next.id,
					before: prior ?? null,
					after: next,
					metadata: { subKind: PERSONAL_MINIMUMS_OP_SUBKINDS.REVISE },
				},
				tx,
			);
			return next;
		});
		return toPersonalMinimums(inserted);
	} catch (err) {
		if (isOneActiveUniqueViolation(err)) throw new PersonalMinimumsConflictError(userId);
		throw err;
	}
}

/**
 * Retract the user's active minimums without replacing them. Flips
 * `is_active = false` and stamps `effective_until = now()` on the active
 * row; inserts nothing. `getActivePersonalMinimums` returns `null`
 * afterwards. Used for "I'm intentionally retracting these and will think
 * about it" -- not a delete; the history is preserved.
 *
 * A no-op (no active row) returns without an audit write.
 */
export async function deactivatePersonalMinimums(userId: string, db: Db = defaultDb): Promise<void> {
	await db.transaction(async (tx) => {
		const [prior] = await tx
			.update(personalMinimums)
			.set({ isActive: false, effectiveUntil: sql`now()` })
			.where(and(eq(personalMinimums.userId, userId), eq(personalMinimums.isActive, true)))
			.returning();
		if (prior === undefined) return;
		await auditWrite(
			{
				actorId: userId,
				op: AUDIT_OPS.UPDATE,
				targetType: AUDIT_TARGETS.PERSONAL_MINIMUMS,
				targetId: prior.id,
				before: prior,
				after: { ...prior, isActive: false },
				metadata: { subKind: PERSONAL_MINIMUMS_OP_SUBKINDS.DEACTIVATE },
			},
			tx,
		);
	});
}
