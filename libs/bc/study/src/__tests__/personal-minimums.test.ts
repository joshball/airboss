/**
 * Personal-minimums BC tests (personal-minimums-as-typed-contract WP).
 *
 * Runs against the local unit-test Postgres -- the BC under test is the
 * revision-log persistence, so testing it without a DB would mean mocking
 * the table, the partial unique index, and the transaction. Every test
 * uses a fresh user for full isolation.
 */

import { auditLog } from '@ab/audit';
import { bauthUser } from '@ab/auth/schema';
import { PERSONAL_MINIMUMS_DEFAULTS } from '@ab/constants';
import { db } from '@ab/db/connection';
import type { PersonalMinimumsInput } from '@ab/types';
import { generateAuthId, generatePersonalMinimumsId } from '@ab/utils';
import { and, eq } from 'drizzle-orm';
import { describe, expect, it } from 'vitest';
import {
	createPersonalMinimumsRevision,
	deactivatePersonalMinimums,
	getActivePersonalMinimums,
	getPersonalMinimumsHistory,
} from '../personal-minimums';
import { personalMinimums } from '../schema';

const defaultsInput: PersonalMinimumsInput = {
	ceilingFt: PERSONAL_MINIMUMS_DEFAULTS.CEILING_FT,
	visibilitySm: PERSONAL_MINIMUMS_DEFAULTS.VISIBILITY_SM,
	windTotalKt: PERSONAL_MINIMUMS_DEFAULTS.WIND_TOTAL_KT,
	crosswindTotalKt: PERSONAL_MINIMUMS_DEFAULTS.CROSSWIND_TOTAL_KT,
	nightRequiredRecencyLandings: PERSONAL_MINIMUMS_DEFAULTS.NIGHT_REQUIRED_RECENCY_LANDINGS,
	imcRequiredRecencyApproaches: PERSONAL_MINIMUMS_DEFAULTS.IMC_REQUIRED_RECENCY_APPROACHES,
	paxMax: PERSONAL_MINIMUMS_DEFAULTS.PAX_MAX,
	terrainBufferAgl: PERSONAL_MINIMUMS_DEFAULTS.TERRAIN_BUFFER_AGL,
};

async function withFreshUser<T>(fn: (userId: string) => Promise<T>): Promise<T> {
	const userId = generateAuthId();
	const now = new Date();
	await db.insert(bauthUser).values({
		id: userId,
		email: `pmin-${userId}@airboss.test`,
		name: 'Pmin',
		firstName: 'Pmin',
		lastName: 'User',
		emailVerified: true,
		role: 'learner',
		createdAt: now,
		updatedAt: now,
	});
	return await fn(userId);
}

describe('personal-minimums BC', () => {
	it('getActivePersonalMinimums returns null for a user with no records', async () => {
		await withFreshUser(async (userId) => {
			const active = await getActivePersonalMinimums(userId);
			expect(active).toBeNull();
		});
	});

	it('createPersonalMinimumsRevision returns the active row for a clean state', async () => {
		await withFreshUser(async (userId) => {
			const row = await createPersonalMinimumsRevision(userId, defaultsInput);
			expect(row.id.startsWith('pmin_')).toBe(true);
			expect(row.isActive).toBe(true);
			expect(row.effectiveUntil).toBeNull();
			expect(row.ceilingFt).toBe(1500);
			expect(row.visibilitySm).toBe(5.0);

			const active = await getActivePersonalMinimums(userId);
			expect(active?.id).toBe(row.id);
		});
	});

	it('a second revision supersedes the first and flips its active flag', async () => {
		await withFreshUser(async (userId) => {
			const first = await createPersonalMinimumsRevision(userId, defaultsInput);
			const second = await createPersonalMinimumsRevision(userId, { ...defaultsInput, ceilingFt: 2500 });

			expect(second.isActive).toBe(true);
			expect(second.effectiveUntil).toBeNull();
			expect(second.ceilingFt).toBe(2500);

			const [priorRow] = await db.select().from(personalMinimums).where(eq(personalMinimums.id, first.id));
			expect(priorRow?.isActive).toBe(false);
			expect(priorRow?.effectiveUntil).not.toBeNull();

			const active = await getActivePersonalMinimums(userId);
			expect(active?.id).toBe(second.id);
		});
	});

	it('getPersonalMinimumsHistory returns every revision newest-first', async () => {
		await withFreshUser(async (userId) => {
			const first = await createPersonalMinimumsRevision(userId, defaultsInput);
			const second = await createPersonalMinimumsRevision(userId, { ...defaultsInput, ceilingFt: 2500 });

			const history = await getPersonalMinimumsHistory(userId);
			expect(history).toHaveLength(2);
			expect(history[0]?.id).toBe(second.id);
			expect(history[1]?.id).toBe(first.id);
		});
	});

	it('deactivatePersonalMinimums flips the active row without inserting', async () => {
		await withFreshUser(async (userId) => {
			await createPersonalMinimumsRevision(userId, defaultsInput);
			await deactivatePersonalMinimums(userId);

			const active = await getActivePersonalMinimums(userId);
			expect(active).toBeNull();

			const history = await getPersonalMinimumsHistory(userId);
			expect(history).toHaveLength(1);
			expect(history[0]?.isActive).toBe(false);
			expect(history[0]?.effectiveUntil).not.toBeNull();
		});
	});

	it('the partial unique index rejects two simultaneous active rows for one user', async () => {
		await withFreshUser(async (userId) => {
			await createPersonalMinimumsRevision(userId, defaultsInput);
			// Bypass the BC -- insert a second active row directly to exercise
			// the storage-layer guarantee.
			await expect(
				db.insert(personalMinimums).values({
					id: generatePersonalMinimumsId(),
					userId,
					ceilingFt: 2000,
					visibilitySm: '6.0',
					windTotalKt: 18,
					crosswindTotalKt: 10,
					paxMax: 2,
					terrainBufferAgl: 1000,
					isActive: true,
				}),
			).rejects.toThrow();
		});
	});

	it('emits an audit row for each revision write', async () => {
		await withFreshUser(async (userId) => {
			const row = await createPersonalMinimumsRevision(userId, defaultsInput);
			const audits = await db
				.select()
				.from(auditLog)
				.where(and(eq(auditLog.targetType, 'study.personal_minimums'), eq(auditLog.targetId, row.id)));
			expect(audits).toHaveLength(1);
			expect(audits[0]?.actorId).toBe(userId);
		});
	});
});
