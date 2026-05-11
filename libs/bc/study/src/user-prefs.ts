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
	READING_DENSITY_VALUES,
	READING_FONT_FAMILY_VALUES,
	READING_FONT_SCALE_VALUES,
	READING_HEADING_SCALE_VALUES,
	READING_MEASURE_VALUES,
	RENDER_MODE_VALUES,
	STUDY_MAP_TAB_VALUES,
	USER_PREF_KEY_VALUES,
	USER_PREF_KEYS,
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
	// Owned by study-app-ia-cleanup WP. Value is a JSON object keyed by
	// `<PageExplainer>` `pageKey`; presence of a `true` flag means the
	// user collapsed that explainer. Absent / `false` means open by
	// default. Stored as one row (not one row per page key) so the
	// closed key list in `USER_PREF_KEYS` does not have to grow with
	// every new page that mounts an explainer.
	'study.page_explainer.dismissed': z.record(z.string().min(1), z.literal(true)),
	// Owned by wp-notes-primitive Phase 3. Value is a JSON object keyed
	// by the user-given saved-search name. Each entry carries the URL
	// (filter / search / view) the user wants to replay and the ISO
	// timestamp at which it was saved. Stored as a single row (not one
	// row per saved search) so the closed `USER_PREF_KEYS` list stays
	// finite as the user adds saved searches. Name capped at 120 chars
	// to keep the sidebar render tidy; URL capped at 2048 to honor the
	// historical browser address-bar limit.
	'study.notes.saved_searches': z.record(
		z.string().min(1).max(120),
		z.object({
			url: z.string().min(1).max(2048),
			createdAt: z.string().min(1),
		}),
	),
	// WP-FLIGHTBAG-READER-UX Phase 3 -- five reader typography preferences.
	// Each validates against the closed value set exported by
	// `libs/constants/src/reading.ts` so a malformed POST is rejected
	// before the upsert.
	'study.reading.font_family': z.enum([READING_FONT_FAMILY_VALUES[0], ...READING_FONT_FAMILY_VALUES.slice(1)] as [
		(typeof READING_FONT_FAMILY_VALUES)[number],
		...(typeof READING_FONT_FAMILY_VALUES)[number][],
	]),
	// Font scale is a number, not an enum -- a refine over the closed
	// numeric set so `1.0` round-trips as `1.0` (not `1`). z.union over
	// literals would be ideal but Zod's union signature wants explicit
	// types per arm; refine is simpler and equally narrow.
	'study.reading.font_scale': z
		.number()
		.refine(
			(v): v is (typeof READING_FONT_SCALE_VALUES)[number] =>
				(READING_FONT_SCALE_VALUES as readonly number[]).includes(v),
			{
				message: 'font_scale must be one of READING_FONT_SCALE_VALUES',
			},
		),
	'study.reading.density': z.enum([READING_DENSITY_VALUES[0], ...READING_DENSITY_VALUES.slice(1)] as [
		(typeof READING_DENSITY_VALUES)[number],
		...(typeof READING_DENSITY_VALUES)[number][],
	]),
	'study.reading.measure': z.enum([READING_MEASURE_VALUES[0], ...READING_MEASURE_VALUES.slice(1)] as [
		(typeof READING_MEASURE_VALUES)[number],
		...(typeof READING_MEASURE_VALUES)[number][],
	]),
	'study.reading.heading_scale': z
		.number()
		.refine(
			(v): v is (typeof READING_HEADING_SCALE_VALUES)[number] =>
				(READING_HEADING_SCALE_VALUES as readonly number[]).includes(v),
			{ message: 'heading_scale must be one of READING_HEADING_SCALE_VALUES' },
		),
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

/** Map of `pageKey -> true` for explainers the user has dismissed. */
export type PageExplainerDismissals = Record<string, true>;

/**
 * Raised when a caller passes an empty `pageKey` to
 * `setPageExplainerDismissal`. The endpoint's Zod refine catches this
 * before the BC sees it; the typed error is for direct callers (other
 * BCs, future internal routes, tests).
 */
export class EmptyPageKeyError extends Error {
	constructor() {
		super('pageKey must be non-empty');
		this.name = 'EmptyPageKeyError';
	}
}

/**
 * Read the per-page explainer dismissal map for a user. Returns an empty
 * object when nothing has been dismissed. The map is the value of the
 * `study.page_explainer.dismissed` user_pref row.
 */
export async function getPageExplainerDismissals(userId: string, db: Db = defaultDb): Promise<PageExplainerDismissals> {
	const prefs = await getUserPrefs(userId, [USER_PREF_KEYS.PAGE_EXPLAINER_DISMISSED], db);
	const raw = prefs[USER_PREF_KEYS.PAGE_EXPLAINER_DISMISSED];
	if (raw === undefined || raw === null || typeof raw !== 'object' || Array.isArray(raw)) return {};
	const out: PageExplainerDismissals = {};
	for (const [k, v] of Object.entries(raw as Record<string, UserPrefValue>)) {
		if (v === true) out[k] = true;
	}
	return out;
}

/**
 * Set the dismissal flag for a single `pageKey` without overwriting other
 * pages' dismissal state.
 *
 * Concurrency: the read-modify-write runs inside a transaction with
 * `SELECT ... FOR UPDATE` on the user_pref row, so two simultaneous
 * toggles for distinct page keys serialize and both land. Same-key
 * concurrent toggles are last-write-wins, which matches user intent.
 *
 * Audit-row size note: the audit row stores the full before/after map
 * (one JSONB row holds every page's dismissal). After many dismissals
 * the audit blob grows linearly. This is the cost of "one row per user"
 * -- replacing the JSON-map shape with one row per (userId, pageKey)
 * would shrink audit rows but would also force every new page key into
 * the closed `USER_PREF_KEYS` set. Keep the JSON map until that audit
 * cost matters.
 */
export async function setPageExplainerDismissal(
	userId: string,
	pageKey: string,
	dismissed: boolean,
	db: Db = defaultDb,
): Promise<PageExplainerDismissals> {
	if (pageKey.length === 0) throw new EmptyPageKeyError();

	return db.transaction(async (tx) => {
		// SELECT ... FOR UPDATE on the (userId, key) row serializes
		// concurrent toggles for this user without affecting reads from
		// other rows. If the row doesn't exist yet there's nothing to
		// lock; the upsert below handles that case.
		await tx.execute(sql`
			SELECT 1 FROM study.user_pref
			WHERE user_id = ${userId}
			  AND key = ${USER_PREF_KEYS.PAGE_EXPLAINER_DISMISSED}
			FOR UPDATE
		`);
		const current = await getPageExplainerDismissals(userId, tx as unknown as Db);
		const isCurrentlyDismissed = current[pageKey] === true;
		// No-op skip: if requested state matches stored state, return
		// without writing or auditing. Eliminates flip-flop abuse against
		// the audit log without a rate limiter, and keeps real toggles
		// snappy.
		if (isCurrentlyDismissed === dismissed) return current;

		const next: PageExplainerDismissals = { ...current };
		if (dismissed) {
			next[pageKey] = true;
		} else {
			delete next[pageKey];
		}
		// Use the typed setter so the audit row + per-key Zod validation
		// stay in sync with every other user_pref write.
		await setUserPref(userId, USER_PREF_KEYS.PAGE_EXPLAINER_DISMISSED, next, tx as unknown as Db);
		return next;
	});
}

// ---------------------------------------------------------------------------
// Notes saved searches (wp-notes-primitive Phase 3)
// ---------------------------------------------------------------------------

/** One saved-search entry stored under `study.notes.saved_searches`. */
export interface SavedNotesSearch {
	name: string;
	url: string;
	createdAt: string;
}

/** Stored shape of `study.notes.saved_searches`: name -> { url, createdAt }. */
export type NotesSavedSearchesValue = Record<string, { url: string; createdAt: string }>;

/** Cap on the number of saved searches per user. Sidebar surface only. */
export const NOTES_SAVED_SEARCHES_MAX = 24;

/** Raised when a user tries to save a search past `NOTES_SAVED_SEARCHES_MAX`. */
export class NotesSavedSearchLimitError extends Error {
	constructor() {
		super(`At most ${NOTES_SAVED_SEARCHES_MAX} saved searches per user.`);
		this.name = 'NotesSavedSearchLimitError';
	}
}

/**
 * Read the current saved-search map for a user. Empty object when nothing
 * is stored. Sorted by `createdAt` descending (newest first) for sidebar
 * display.
 */
export async function listSavedSearches(userId: string, db: Db = defaultDb): Promise<SavedNotesSearch[]> {
	const prefs = await getUserPrefs(userId, [USER_PREF_KEYS.NOTES_SAVED_SEARCHES], db);
	const raw = prefs[USER_PREF_KEYS.NOTES_SAVED_SEARCHES];
	if (raw === undefined || raw === null || typeof raw !== 'object' || Array.isArray(raw)) return [];
	const out: SavedNotesSearch[] = [];
	for (const [name, entry] of Object.entries(raw as NotesSavedSearchesValue)) {
		if (entry === null || typeof entry !== 'object') continue;
		const e = entry as { url?: unknown; createdAt?: unknown };
		if (typeof e.url !== 'string' || typeof e.createdAt !== 'string') continue;
		out.push({ name, url: e.url, createdAt: e.createdAt });
	}
	out.sort((a, b) => (a.createdAt > b.createdAt ? -1 : a.createdAt < b.createdAt ? 1 : 0));
	return out;
}

/**
 * Persist (or update) a saved search. The transaction guards against a
 * read-modify-write race when two browser tabs save at once. Capacity
 * is bounded by `NOTES_SAVED_SEARCHES_MAX`.
 */
export async function saveNotesSearch(
	userId: string,
	name: string,
	url: string,
	db: Db = defaultDb,
): Promise<SavedNotesSearch[]> {
	return db.transaction(async (tx) => {
		await tx.execute(sql`
			SELECT 1 FROM study.user_pref
			WHERE user_id = ${userId}
			  AND key = ${USER_PREF_KEYS.NOTES_SAVED_SEARCHES}
			FOR UPDATE
		`);
		const current = await listSavedSearches(userId, tx as unknown as Db);
		const trimmed = name.trim();
		const isNew = !current.some((s) => s.name === trimmed);
		if (isNew && current.length >= NOTES_SAVED_SEARCHES_MAX) {
			throw new NotesSavedSearchLimitError();
		}
		const next: NotesSavedSearchesValue = {};
		const createdAt = new Date().toISOString();
		for (const s of current) {
			next[s.name] = { url: s.url, createdAt: s.createdAt };
		}
		next[trimmed] = { url, createdAt };
		await setUserPref(userId, USER_PREF_KEYS.NOTES_SAVED_SEARCHES, next, tx as unknown as Db);
		return listSavedSearches(userId, tx as unknown as Db);
	});
}

/** Drop a saved search. No-op when the name isn't stored. */
export async function removeNotesSearch(userId: string, name: string, db: Db = defaultDb): Promise<SavedNotesSearch[]> {
	return db.transaction(async (tx) => {
		await tx.execute(sql`
			SELECT 1 FROM study.user_pref
			WHERE user_id = ${userId}
			  AND key = ${USER_PREF_KEYS.NOTES_SAVED_SEARCHES}
			FOR UPDATE
		`);
		const current = await listSavedSearches(userId, tx as unknown as Db);
		const trimmed = name.trim();
		if (!current.some((s) => s.name === trimmed)) return current;
		const next: NotesSavedSearchesValue = {};
		for (const s of current) {
			if (s.name === trimmed) continue;
			next[s.name] = { url: s.url, createdAt: s.createdAt };
		}
		await setUserPref(userId, USER_PREF_KEYS.NOTES_SAVED_SEARCHES, next, tx as unknown as Db);
		return listSavedSearches(userId, tx as unknown as Db);
	});
}
