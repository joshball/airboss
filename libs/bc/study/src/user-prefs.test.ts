/**
 * Integration tests for the per-user preference store.
 *
 * Hits the dev Postgres directly (same convention as other BC tests) so the
 * Zod-validated upsert + audit + cascade are exercised end-to-end against
 * real schema constraints.
 */

import { auditLog } from '@ab/audit';
import { bauthUser } from '@ab/auth/schema';
import { AUDIT_TARGETS, USER_PREF_KEYS } from '@ab/constants';
import { db } from '@ab/db/connection';
import { generateAuthId } from '@ab/utils';
import { and, eq } from 'drizzle-orm';
import { describe, expect, it } from 'vitest';
import { userPref } from './schema';
import {
	getUserPrefs,
	InvalidUserPrefValueError,
	setUserPref,
	UnknownUserPrefKeyError,
	type UserPrefValue,
} from './user-prefs';

async function isolatedUser(label: string): Promise<{ userId: string; cleanup: () => Promise<void> }> {
	const userId = generateAuthId();
	const now = new Date();
	await db.insert(bauthUser).values({
		id: userId,
		email: `userprefs-${label}-${userId}@airboss.test`,
		name: `${label} Test`,
		firstName: label,
		lastName: 'Test',
		emailVerified: true,
		role: 'learner',
		createdAt: now,
		updatedAt: now,
	});
	return {
		userId,
		cleanup: async () => {
			await db.delete(auditLog).where(eq(auditLog.actorId, userId));
			await db.delete(userPref).where(eq(userPref.userId, userId));
			await db.delete(bauthUser).where(eq(bauthUser.id, userId));
		},
	};
}

describe('getUserPrefs', () => {
	it('returns empty record when no keys are requested', async () => {
		const { userId, cleanup } = await isolatedUser('empty-keys');
		try {
			const result = await getUserPrefs(userId, []);
			expect(result).toEqual({});
		} finally {
			await cleanup();
		}
	});

	it('returns empty record when user has no prefs set', async () => {
		const { userId, cleanup } = await isolatedUser('no-prefs');
		try {
			const result = await getUserPrefs(userId, [USER_PREF_KEYS.CITATION_ORDER, USER_PREF_KEYS.MAP_TAB]);
			expect(result).toEqual({});
		} finally {
			await cleanup();
		}
	});

	it('returns only the keys that are set (partial)', async () => {
		const { userId, cleanup } = await isolatedUser('partial');
		try {
			await setUserPref(userId, USER_PREF_KEYS.CITATION_ORDER, 'reg');
			const result = await getUserPrefs(userId, [USER_PREF_KEYS.CITATION_ORDER, USER_PREF_KEYS.MAP_TAB]);
			expect(result).toEqual({ [USER_PREF_KEYS.CITATION_ORDER]: 'reg' });
		} finally {
			await cleanup();
		}
	});

	it('returns all requested keys when all are set', async () => {
		const { userId, cleanup } = await isolatedUser('all-set');
		try {
			await setUserPref(userId, USER_PREF_KEYS.CITATION_ORDER, 'hb');
			await setUserPref(userId, USER_PREF_KEYS.MAP_TAB, 'handbook');
			const result = await getUserPrefs(userId, [USER_PREF_KEYS.CITATION_ORDER, USER_PREF_KEYS.MAP_TAB]);
			expect(result).toEqual({
				[USER_PREF_KEYS.CITATION_ORDER]: 'hb',
				[USER_PREF_KEYS.MAP_TAB]: 'handbook',
			});
		} finally {
			await cleanup();
		}
	});
});

describe('setUserPref', () => {
	it('inserts a new row and emits a create audit row', async () => {
		const { userId, cleanup } = await isolatedUser('insert');
		try {
			await setUserPref(userId, USER_PREF_KEYS.CITATION_ORDER, 'reg');

			const rows = await db
				.select()
				.from(userPref)
				.where(and(eq(userPref.userId, userId), eq(userPref.key, USER_PREF_KEYS.CITATION_ORDER)));
			expect(rows).toHaveLength(1);
			expect(rows[0]?.value).toBe('reg');

			const audits = await db
				.select()
				.from(auditLog)
				.where(and(eq(auditLog.actorId, userId), eq(auditLog.targetType, AUDIT_TARGETS.USER_PREF)));
			expect(audits).toHaveLength(1);
			expect(audits[0]?.op).toBe('create');
			expect(audits[0]?.targetId).toBe(`${userId}:${USER_PREF_KEYS.CITATION_ORDER}`);
		} finally {
			await cleanup();
		}
	});

	it('upserts on conflict and emits an update audit row', async () => {
		const { userId, cleanup } = await isolatedUser('upsert');
		try {
			await setUserPref(userId, USER_PREF_KEYS.CITATION_ORDER, 'hb');
			await setUserPref(userId, USER_PREF_KEYS.CITATION_ORDER, 'reg');

			const rows = await db
				.select()
				.from(userPref)
				.where(and(eq(userPref.userId, userId), eq(userPref.key, USER_PREF_KEYS.CITATION_ORDER)));
			expect(rows).toHaveLength(1);
			expect(rows[0]?.value).toBe('reg');

			const audits = await db
				.select()
				.from(auditLog)
				.where(and(eq(auditLog.actorId, userId), eq(auditLog.targetType, AUDIT_TARGETS.USER_PREF)));
			const ops = audits.map((a) => a.op).sort();
			expect(ops).toEqual(['create', 'update']);
		} finally {
			await cleanup();
		}
	});

	it('rejects values outside the closed enum (citation_order)', async () => {
		const { userId, cleanup } = await isolatedUser('invalid-citation');
		try {
			await expect(setUserPref(userId, USER_PREF_KEYS.CITATION_ORDER, 'bogus' as UserPrefValue)).rejects.toBeInstanceOf(
				InvalidUserPrefValueError,
			);
			const rows = await db.select().from(userPref).where(eq(userPref.userId, userId));
			expect(rows).toHaveLength(0);
		} finally {
			await cleanup();
		}
	});

	it('rejects values outside the closed enum (map_tab)', async () => {
		const { userId, cleanup } = await isolatedUser('invalid-tab');
		try {
			await expect(setUserPref(userId, USER_PREF_KEYS.MAP_TAB, 'bogus' as UserPrefValue)).rejects.toBeInstanceOf(
				InvalidUserPrefValueError,
			);
		} finally {
			await cleanup();
		}
	});

	it('rejects unknown keys', async () => {
		const { userId, cleanup } = await isolatedUser('unknown');
		try {
			await expect(
				// biome-ignore lint/suspicious/noExplicitAny: testing a runtime-bypass of the type system
				setUserPref(userId, 'study.bogus.key' as any, 'value'),
			).rejects.toBeInstanceOf(UnknownUserPrefKeyError);
		} finally {
			await cleanup();
		}
	});

	it('cascades on user delete (FK ON DELETE CASCADE)', async () => {
		// Bespoke cleanup -- this test deletes the user as the test action,
		// so the standard isolatedUser cleanup closure doesn't apply.
		const { userId } = await isolatedUser('cascade');
		try {
			await setUserPref(userId, USER_PREF_KEYS.CITATION_ORDER, 'reg');
			await setUserPref(userId, USER_PREF_KEYS.MAP_TAB, 'course');

			// Audit rows reference the actor via `set null` on delete, so we
			// scrub them first; without that the bauthUser delete would only
			// orphan them, not block. Then the user_pref rows must vanish via
			// the CASCADE FK on this WP's table.
			await db.delete(auditLog).where(eq(auditLog.actorId, userId));
			await db.delete(bauthUser).where(eq(bauthUser.id, userId));

			const rows = await db.select().from(userPref).where(eq(userPref.userId, userId));
			expect(rows).toHaveLength(0);
		} finally {
			// User is already deleted; sweep any straggler audit rows defensively.
			await db.delete(auditLog).where(eq(auditLog.actorId, userId));
		}
	});
});
