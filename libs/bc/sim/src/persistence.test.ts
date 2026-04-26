/**
 * Sim attempt persistence tests.
 *
 * Run against the local dev Postgres (same target drizzle-kit push hits).
 * Mirrors the study BC test convention: one fresh user per file via a
 * ULID-prefixed marker, FK cascades clean up on afterAll. No mocks.
 */

import { bauthUser } from '@ab/auth/schema';
import { db, simAttempt } from '@ab/db';
import { generateAuthId } from '@ab/utils';
import { eq } from 'drizzle-orm';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import {
	getRecentSimWeakness,
	listRecentSimAttempts,
	loadLatestSimAttempt,
	loadSimAttempt,
	recordSimAttempt,
	tapeFromRow,
} from './persistence';
import type { ReplayTape } from './replay/types';
import { EFATO_SCENARIO } from './scenarios/efato';
import type { ScenarioRunResult } from './types';

const TEST_USER_ID = generateAuthId();
const TEST_EMAIL = `sim-persistence-test-${TEST_USER_ID}@airboss.test`;
const OTHER_USER_ID = generateAuthId();
const OTHER_EMAIL = `sim-persistence-test-other-${OTHER_USER_ID}@airboss.test`;

beforeAll(async () => {
	const now = new Date();
	await db.insert(bauthUser).values([
		{
			id: TEST_USER_ID,
			email: TEST_EMAIL,
			name: 'Sim Persistence Test',
			firstName: 'Sim',
			lastName: 'Persist',
			emailVerified: true,
			role: 'learner',
			createdAt: now,
			updatedAt: now,
		},
		{
			id: OTHER_USER_ID,
			email: OTHER_EMAIL,
			name: 'Sim Persistence Other',
			firstName: 'Sim',
			lastName: 'Other',
			emailVerified: true,
			role: 'learner',
			createdAt: now,
			updatedAt: now,
		},
	]);
});

afterAll(async () => {
	// FK cascade on bauthUser deletes attempts. Belt-and-suspenders explicit
	// delete first in case the cascade ever changes.
	await db.delete(simAttempt).where(eq(simAttempt.userId, TEST_USER_ID));
	await db.delete(simAttempt).where(eq(simAttempt.userId, OTHER_USER_ID));
	await db.delete(bauthUser).where(eq(bauthUser.id, TEST_USER_ID));
	await db.delete(bauthUser).where(eq(bauthUser.id, OTHER_USER_ID));
});

function fakeResult(
	outcome: ScenarioRunResult['outcome'] = 'success',
	overrides: Partial<ScenarioRunResult> = {},
): ScenarioRunResult {
	return {
		scenarioId: EFATO_SCENARIO.id,
		outcome,
		elapsedSeconds: 42.5,
		peakAltitudeAgl: 150,
		maxAlpha: 0.18,
		reason: outcome === 'success' ? 'Reached safe altitude.' : 'Touched ground off-runway.',
		...overrides,
	};
}

function fakeTape(): ReplayTape {
	return {
		formatVersion: 1,
		scenarioId: EFATO_SCENARIO.id,
		scenarioHash: 'deadbeef',
		seed: 0,
		initial: EFATO_SCENARIO.initial,
		frames: [],
		result: fakeResult(),
	} as ReplayTape;
}

describe('recordSimAttempt', () => {
	it('inserts a row with grade + tape', async () => {
		const row = await recordSimAttempt({
			userId: TEST_USER_ID,
			scenarioId: EFATO_SCENARIO.id,
			result: fakeResult('success'),
			tape: fakeTape(),
			grade: { total: 0.82, components: [{ kind: 'altitude_hold', weight: 1, score: 0.82, summary: 'tight band' }] },
		});
		expect(row.id).toMatch(/^sat_/);
		expect(row.userId).toBe(TEST_USER_ID);
		expect(row.scenarioId).toBe(EFATO_SCENARIO.id);
		expect(row.outcome).toBe('success');
		expect(row.gradeTotal).toBeCloseTo(0.82);
		expect(row.tape).not.toBeNull();
	});

	it('inserts a row with no grade or tape (aborted run)', async () => {
		const row = await recordSimAttempt({
			userId: TEST_USER_ID,
			scenarioId: EFATO_SCENARIO.id,
			result: fakeResult('aborted'),
			tape: null,
			grade: null,
		});
		expect(row.outcome).toBe('aborted');
		expect(row.gradeTotal).toBeNull();
		expect(row.grade).toBeNull();
		expect(row.tape).toBeNull();
	});
});

describe('loadLatestSimAttempt', () => {
	it('returns the most recently ended attempt', async () => {
		const past = new Date('2026-01-01T12:00:00Z');
		const future = new Date('2026-04-01T12:00:00Z');
		await recordSimAttempt({
			userId: TEST_USER_ID,
			scenarioId: 'departure-stall',
			result: fakeResult('failure'),
			tape: null,
			grade: null,
			endedAt: past,
		});
		await recordSimAttempt({
			userId: TEST_USER_ID,
			scenarioId: 'departure-stall',
			result: fakeResult('success'),
			tape: null,
			grade: null,
			endedAt: future,
		});
		const latest = await loadLatestSimAttempt(TEST_USER_ID, 'departure-stall');
		expect(latest?.outcome).toBe('success');
		expect(latest?.endedAt.toISOString()).toBe(future.toISOString());
	});

	it('returns null when the user has not flown the scenario', async () => {
		const latest = await loadLatestSimAttempt(TEST_USER_ID, 'never-flown');
		expect(latest).toBeNull();
	});
});

describe('listRecentSimAttempts', () => {
	it('returns rows for the user newest-first, excluding the tape column', async () => {
		const rows = await listRecentSimAttempts(TEST_USER_ID, 50);
		expect(rows.length).toBeGreaterThan(0);
		// Newest-first ordering.
		for (let i = 1; i < rows.length; i++) {
			expect(rows[i - 1].endedAt.getTime()).toBeGreaterThanOrEqual(rows[i].endedAt.getTime());
		}
		// `tape` is omitted from the projection.
		expect(rows[0]).not.toHaveProperty('tape');
	});

	it('honours the limit', async () => {
		const rows = await listRecentSimAttempts(TEST_USER_ID, 1);
		expect(rows.length).toBe(1);
	});

	it('does not leak rows across users', async () => {
		await recordSimAttempt({
			userId: OTHER_USER_ID,
			scenarioId: EFATO_SCENARIO.id,
			result: fakeResult('failure'),
			tape: null,
			grade: null,
		});
		const otherRows = await listRecentSimAttempts(OTHER_USER_ID);
		const testRows = await listRecentSimAttempts(TEST_USER_ID);
		for (const r of otherRows) expect(r.userId).toBe(OTHER_USER_ID);
		for (const r of testRows) expect(r.userId).toBe(TEST_USER_ID);
	});
});

describe('loadSimAttempt', () => {
	it('returns the row when the requesting user owns it', async () => {
		const inserted = await recordSimAttempt({
			userId: TEST_USER_ID,
			scenarioId: 'efato',
			result: fakeResult('success'),
			tape: fakeTape(),
			grade: null,
		});
		const fetched = await loadSimAttempt(inserted.id, TEST_USER_ID);
		expect(fetched?.id).toBe(inserted.id);
	});

	it('returns null when a different user requests it (URL-guess guard)', async () => {
		const inserted = await recordSimAttempt({
			userId: TEST_USER_ID,
			scenarioId: 'efato',
			result: fakeResult('success'),
			tape: null,
			grade: null,
		});
		const fetched = await loadSimAttempt(inserted.id, OTHER_USER_ID);
		expect(fetched).toBeNull();
	});

	it('returns null for a non-existent id', async () => {
		const fetched = await loadSimAttempt('sat_nope', TEST_USER_ID);
		expect(fetched).toBeNull();
	});
});

describe('getRecentSimWeakness', () => {
	const WEAKNESS_USER_ID = generateAuthId();
	const WEAKNESS_EMAIL = `sim-weakness-${WEAKNESS_USER_ID}@airboss.test`;

	beforeAll(async () => {
		const now = new Date();
		await db.insert(bauthUser).values({
			id: WEAKNESS_USER_ID,
			email: WEAKNESS_EMAIL,
			name: 'Sim Weakness Test',
			firstName: 'Sim',
			lastName: 'Weakness',
			emailVerified: true,
			role: 'learner',
			createdAt: now,
			updatedAt: now,
		});
	});

	afterAll(async () => {
		await db.delete(simAttempt).where(eq(simAttempt.userId, WEAKNESS_USER_ID));
		await db.delete(bauthUser).where(eq(bauthUser.id, WEAKNESS_USER_ID));
	});

	function gradeOf(total: number) {
		return { total, components: [{ kind: 'altitude_hold' as const, weight: 1, score: total }] };
	}

	it('returns nothing when the user has no recent attempts', async () => {
		const signals = await getRecentSimWeakness(WEAKNESS_USER_ID);
		expect(signals.length).toBe(0);
	});

	it('returns nothing when only one weak attempt exists (below MIN_ATTEMPTS)', async () => {
		await recordSimAttempt({
			userId: WEAKNESS_USER_ID,
			scenarioId: 'efato',
			result: fakeResult('failure'),
			tape: null,
			grade: gradeOf(0.3),
		});
		const signals = await getRecentSimWeakness(WEAKNESS_USER_ID);
		expect(signals.find((s) => s.scenarioId === 'efato')).toBeUndefined();
	});

	it('returns a signal once two weak attempts exist; weight scales with how poor the average is', async () => {
		await recordSimAttempt({
			userId: WEAKNESS_USER_ID,
			scenarioId: 'efato',
			result: fakeResult('failure'),
			tape: null,
			grade: gradeOf(0.4),
		});
		const signals = await getRecentSimWeakness(WEAKNESS_USER_ID);
		const efato = signals.find((s) => s.scenarioId === 'efato');
		expect(efato).toBeDefined();
		if (!efato) return;
		expect(efato.attempts).toBe(2);
		// avg = (0.3 + 0.4) / 2 = 0.35; below the 0.6 threshold.
		expect(efato.avgGradeTotal).toBeCloseTo(0.35, 2);
		// Weight is in [WEIGHT_FLOOR, 1].
		expect(efato.weight).toBeGreaterThan(0.1);
		expect(efato.weight).toBeLessThanOrEqual(1);
	});

	it('returns nothing when grades are above the poor threshold', async () => {
		await recordSimAttempt({
			userId: WEAKNESS_USER_ID,
			scenarioId: 'departure-stall',
			result: fakeResult('success'),
			tape: null,
			grade: gradeOf(0.85),
		});
		await recordSimAttempt({
			userId: WEAKNESS_USER_ID,
			scenarioId: 'departure-stall',
			result: fakeResult('success'),
			tape: null,
			grade: gradeOf(0.9),
		});
		const signals = await getRecentSimWeakness(WEAKNESS_USER_ID);
		expect(signals.find((s) => s.scenarioId === 'departure-stall')).toBeUndefined();
	});

	it('honours the `since` cutoff', async () => {
		// All recent attempts are within the default window; with a future
		// `since` (an hour from now), nothing should match.
		const signals = await getRecentSimWeakness(WEAKNESS_USER_ID, { since: new Date(Date.now() + 60 * 60 * 1000) });
		expect(signals.length).toBe(0);
	});

	it('sorts strongest weakness signal first', async () => {
		await recordSimAttempt({
			userId: WEAKNESS_USER_ID,
			scenarioId: 'partial-panel',
			result: fakeResult('failure'),
			tape: null,
			grade: gradeOf(0.1),
		});
		await recordSimAttempt({
			userId: WEAKNESS_USER_ID,
			scenarioId: 'partial-panel',
			result: fakeResult('failure'),
			tape: null,
			grade: gradeOf(0.05),
		});
		const signals = await getRecentSimWeakness(WEAKNESS_USER_ID);
		// partial-panel (avg ~0.075) should outrank efato (avg 0.35).
		const ids = signals.map((s) => s.scenarioId);
		expect(ids[0]).toBe('partial-panel');
	});
});

describe('tapeFromRow', () => {
	it('returns null when the row has no tape', () => {
		expect(tapeFromRow({ tape: null })).toBeNull();
	});

	it('parses a stored tape back to a ReplayTape', async () => {
		const inserted = await recordSimAttempt({
			userId: TEST_USER_ID,
			scenarioId: 'efato',
			result: fakeResult('success'),
			tape: fakeTape(),
			grade: null,
		});
		const fetched = await loadSimAttempt(inserted.id, TEST_USER_ID);
		expect(fetched).not.toBeNull();
		if (!fetched) return;
		const parsed = tapeFromRow(fetched);
		expect(parsed?.scenarioId).toBe(EFATO_SCENARIO.id);
	});
});
