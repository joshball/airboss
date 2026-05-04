/**
 * Per-user, per-key preference store for the study app (study-home WP).
 *
 * Two operations: `getUserPrefs(userId, keys)` (batched read) and
 * `setUserPref(userId, key, value)` (validated upsert + audit). Per-key
 * Zod schemas in `USER_PREF_SCHEMAS` enforce the closed value sets the
 * spec is built around (e.g. `study.home.citation_order` is `'hb' | 'reg'`).
 *
 * The table is shared infra: WP 3 will reuse it for the knowledge-node
 * render-mode key. `setUserPref` is the only write path; the audit log
 * captures every change with `target_type = 'study.user_pref'` so an
 * admin can trace preference history per user.
 */

import { AUDIT_OPS, auditWrite } from '@ab/audit';
import {
	AUDIT_TARGETS,
	CITATION_ORDER_VALUES,
	RENDER_MODE_VALUES,
	STUDY_MAP_TAB_VALUES,
	USER_PREF_KEY_VALUES,
	type UserPrefKey,
} from '@ab/constants';
import { db as defaultDb } from '@ab/db/connection';
import { and, eq, inArray, sql } from 'drizzle-orm';
import type { PgDatabase, PgQueryResultHKT } from 'drizzle-orm/pg-core';
import { z } from 'zod';
import { userPref } from './schema';

type Db = PgDatabase<PgQueryResultHKT, Record<string, never>>;

/** Allowed JSON shape stored in `study.user_pref.value`. */
export type UserPrefValue = string | number | boolean | null | { [k: string]: UserPrefValue } | UserPrefValue[];

/**
 * Per-key value schema. The closed value sets live in `@ab/constants`
 * (`CITATION_ORDER_VALUES`, `STUDY_MAP_TAB_VALUES`); this map binds them
 * to their preference keys so a runtime validator exists per write.
 */
export const USER_PREF_SCHEMAS = {
	'study.home.citation_order': z.enum([CITATION_ORDER_VALUES[0], ...CITATION_ORDER_VALUES.slice(1)] as [
		(typeof CITATION_ORDER_VALUES)[number],
		...(typeof CITATION_ORDER_VALUES)[number][],
	]),
	'study.home.map_tab': z.enum([STUDY_MAP_TAB_VALUES[0], ...STUDY_MAP_TAB_VALUES.slice(1)] as [
		(typeof STUDY_MAP_TAB_VALUES)[number],
		...(typeof STUDY_MAP_TAB_VALUES)[number][],
	]),
	// Owned by WP 2 (flight-evidence-and-cfi-feedback). Value is a teacher
	// `bauth_user.id`; validated as a non-empty string here -- referential
	// integrity is enforced by the route loader (only an active teacher
	// link's id is accepted).
	'study.home.course_teacher_id': z.string().min(1),
	// Owned by WP 3 (node-render-modes). Value is one of `'learn' / 'review' / 'memorize'`.
	'study.knowledge.render_mode': z.enum([RENDER_MODE_VALUES[0], ...RENDER_MODE_VALUES.slice(1)] as [
		(typeof RENDER_MODE_VALUES)[number],
		...(typeof RENDER_MODE_VALUES)[number][],
	]),
} satisfies Record<UserPrefKey, z.ZodType>;

export class UnknownUserPrefKeyError extends Error {
	constructor(public readonly key: string) {
		super(`Unknown user_pref key: ${key}`);
		this.name = 'UnknownUserPrefKeyError';
	}
}

export class InvalidUserPrefValueError extends Error {
	constructor(
		public readonly key: UserPrefKey,
		public readonly issues: z.ZodIssue[],
	) {
		super(`Invalid value for user_pref key ${key}: ${issues.map((i) => i.message).join('; ')}`);
		this.name = 'InvalidUserPrefValueError';
	}
}

/**
 * Type-guard: is the given string one of the closed user_pref keys.
 * Lets a route handler accept arbitrary form input and reject early
 * before calling `setUserPref`.
 */
export function isUserPrefKey(key: string): key is UserPrefKey {
	return (USER_PREF_KEY_VALUES as readonly string[]).includes(key);
}

/**
 * Read multiple preferences for a user in one query. Returns a map keyed
 * by the requested keys; absent keys are omitted (no default-injection at
 * this layer -- callers apply defaults with knowledge of the key's
 * semantics).
 *
 * Empty `keys` short-circuits to an empty record without round-tripping.
 */
export async function getUserPrefs(
	userId: string,
	keys: readonly UserPrefKey[],
	db: Db = defaultDb,
): Promise<Partial<Record<UserPrefKey, UserPrefValue>>> {
	if (keys.length === 0) return {};
	const rows = await db
		.select({ key: userPref.key, value: userPref.value })
		.from(userPref)
		.where(and(eq(userPref.userId, userId), inArray(userPref.key, keys as unknown as string[])));
	const out: Partial<Record<UserPrefKey, UserPrefValue>> = {};
	for (const row of rows) {
		if (isUserPrefKey(row.key)) {
			out[row.key] = row.value as UserPrefValue;
		}
	}
	return out;
}

/**
 * Upsert one preference. Validates `value` against the per-key schema,
 * writes the row (`INSERT ... ON CONFLICT DO UPDATE`), and emits an
 * audit row tagged `study.user_pref`.
 *
 * `target_id` carries `<userId>:<key>` so the composite-PK pair stays
 * addressable from the audit log filter without joining the user_pref
 * table back.
 */
export async function setUserPref(
	userId: string,
	key: UserPrefKey,
	value: UserPrefValue,
	db: Db = defaultDb,
): Promise<void> {
	const schema = USER_PREF_SCHEMAS[key];
	if (schema === undefined) throw new UnknownUserPrefKeyError(key);
	const parsed = schema.safeParse(value);
	if (!parsed.success) throw new InvalidUserPrefValueError(key, parsed.error.issues);

	// Capture the prior value for the audit row's `before` payload. One extra
	// round-trip per write is acceptable for a low-frequency mutation; the
	// alternative (RETURNING old value via CTE) hurts portability without
	// meaningful latency gain at this call frequency.
	const prior = await db
		.select({ value: userPref.value })
		.from(userPref)
		.where(and(eq(userPref.userId, userId), eq(userPref.key, key)))
		.limit(1);
	const before = prior[0]?.value ?? null;

	await db
		.insert(userPref)
		.values({ userId, key, value: parsed.data })
		.onConflictDoUpdate({
			target: [userPref.userId, userPref.key],
			set: { value: parsed.data, updatedAt: sql`now()` },
		});

	await auditWrite(
		{
			actorId: userId,
			op: before === null ? AUDIT_OPS.CREATE : AUDIT_OPS.UPDATE,
			targetType: AUDIT_TARGETS.USER_PREF,
			targetId: `${userId}:${key}`,
			before: before === null ? null : { value: before },
			after: { value: parsed.data },
		},
		db,
	);
}
