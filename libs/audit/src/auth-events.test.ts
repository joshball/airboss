/**
 * Audit auth-event emitter tests.
 *
 * Drives the real `createAuditAuthEventEmitter()` against the real Postgres
 * dev database and asserts each emitter call lands an `audit_log` row with
 * the right `targetType`, `actorId`, `op`, and `metadata` shape. These rows
 * back the hangar admin home's "who signed in" / "is this email being brute
 * forced" reads, so the schema mapping has to stay pinned -- if a future
 * refactor flips `actorId` from null to "" on failed sign-ins, every count
 * query on `WHERE actor_id IS NULL` silently breaks.
 *
 * No mocks: a unit test that mocks `auditWrite` would catch nothing the type
 * system already proves. Real DB writes plus a targeted clean-up keep the
 * suite deterministic across re-runs.
 */

import { bauthUser } from '@ab/auth';
import { AUDIT_TARGETS } from '@ab/constants';
import { db } from '@ab/db/connection';
import { generateAuthId } from '@ab/utils';
import { eq } from 'drizzle-orm';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { AUTH_LOGIN_FAILED_OUTCOMES, createAuditAuthEventEmitter } from './auth-events';
import { AUDIT_OPS, auditLog } from './schema';

const TEST_RUN_ID = `audit-auth-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
// `audit_log.actor_id` FKs back to `bauth_user`, so the test must insert a
// real user row before writing audit rows that reference it.
const TEST_USER_ID = generateAuthId();
const TEST_EMAIL = `${TEST_RUN_ID}@airboss.test`;

beforeAll(async () => {
	const now = new Date();
	await db.insert(bauthUser).values({
		id: TEST_USER_ID,
		email: TEST_EMAIL,
		name: 'Audit Auth-Events Test',
		firstName: 'Audit',
		lastName: 'Events',
		emailVerified: false,
		createdAt: now,
		updatedAt: now,
	});
});

afterAll(async () => {
	// Audit rows tied to the actor must go before the user row so the FK
	// `audit_log_actor_id_bauth_user_id_fk` is satisfied during deletion.
	// `set null` on the FK would also handle this, but explicit cleanup
	// keeps the audit table tidy in dev.
	await db.delete(auditLog).where(eq(auditLog.actorId, TEST_USER_ID));
	await db.delete(auditLog).where(eq(auditLog.targetId, TEST_USER_ID));
	await db.delete(bauthUser).where(eq(bauthUser.id, TEST_USER_ID));
});

describe('createAuditAuthEventEmitter', () => {
	const emitter = createAuditAuthEventEmitter();

	it('onSignInSuccess writes an AUTH_LOGIN row with the actor id', async () => {
		await emitter.onSignInSuccess({
			userId: TEST_USER_ID,
			ctx: { ip: '198.51.100.10', userAgent: 'vitest-ua/1.0', sessionId: `sess_${TEST_RUN_ID}` },
		});

		const rows = await db.select().from(auditLog).where(eq(auditLog.actorId, TEST_USER_ID));
		const loginRow = rows.find((r) => r.targetType === AUDIT_TARGETS.AUTH_LOGIN);
		expect(loginRow, 'AUTH_LOGIN row should exist').toBeDefined();
		expect(loginRow?.op).toBe(AUDIT_OPS.ACTION);
		expect(loginRow?.targetId).toBe(TEST_USER_ID);
		expect(loginRow?.metadata).toMatchObject({
			ip: '198.51.100.10',
			userAgent: 'vitest-ua/1.0',
			sessionId: `sess_${TEST_RUN_ID}`,
		});
	});

	it('onSignInFailure writes an AUTH_LOGIN_FAILED row with null actor and outcome metadata', async () => {
		await emitter.onSignInFailure({
			outcome: AUTH_LOGIN_FAILED_OUTCOMES.INVALID_CREDENTIALS,
			status: 401,
			ctx: { ip: '198.51.100.20', userAgent: 'vitest-ua/1.0' },
		});

		// Failure rows have actor_id NULL by design (the request never authed),
		// so we can't filter by actor. Use targetType + a metadata fingerprint
		// from this run.
		const rows = await db.select().from(auditLog).where(eq(auditLog.targetType, AUDIT_TARGETS.AUTH_LOGIN_FAILED));
		const failureRow = rows.find((r) => {
			const md = r.metadata as Record<string, unknown>;
			return md.ip === '198.51.100.20' && md.outcome === AUTH_LOGIN_FAILED_OUTCOMES.INVALID_CREDENTIALS;
		});
		expect(failureRow, 'AUTH_LOGIN_FAILED row for this test ip should exist').toBeDefined();
		expect(failureRow?.actorId).toBeNull();
		expect(failureRow?.targetId).toBeNull();
		expect(failureRow?.op).toBe(AUDIT_OPS.ACTION);
		expect(failureRow?.metadata).toMatchObject({
			outcome: AUTH_LOGIN_FAILED_OUTCOMES.INVALID_CREDENTIALS,
			status: 401,
			ip: '198.51.100.20',
		});
		// Clean up this stand-alone failure row -- the afterAll hook can't reach
		// it because actor_id and target_id are both null.
		if (failureRow) {
			await db.delete(auditLog).where(eq(auditLog.id, failureRow.id));
		}
	});

	it('onSignInFailure with rate-limited outcome records status 429', async () => {
		await emitter.onSignInFailure({
			outcome: AUTH_LOGIN_FAILED_OUTCOMES.RATE_LIMITED,
			status: 429,
			ctx: { ip: '198.51.100.21' },
		});

		const rows = await db.select().from(auditLog).where(eq(auditLog.targetType, AUDIT_TARGETS.AUTH_LOGIN_FAILED));
		const row = rows.find((r) => {
			const md = r.metadata as Record<string, unknown>;
			return md.ip === '198.51.100.21';
		});
		expect(row?.metadata).toMatchObject({
			outcome: AUTH_LOGIN_FAILED_OUTCOMES.RATE_LIMITED,
			status: 429,
		});
		if (row) await db.delete(auditLog).where(eq(auditLog.id, row.id));
	});

	it('onSignOut writes an AUTH_LOGOUT row with the actor id', async () => {
		await emitter.onSignOut({
			userId: TEST_USER_ID,
			ctx: { ip: '198.51.100.30', userAgent: 'vitest-ua/1.0' },
		});

		const rows = await db.select().from(auditLog).where(eq(auditLog.actorId, TEST_USER_ID));
		const logoutRow = rows.find((r) => r.targetType === AUDIT_TARGETS.AUTH_LOGOUT);
		expect(logoutRow, 'AUTH_LOGOUT row should exist').toBeDefined();
		expect(logoutRow?.op).toBe(AUDIT_OPS.ACTION);
		expect(logoutRow?.targetId).toBe(TEST_USER_ID);
		expect(logoutRow?.metadata).toMatchObject({ ip: '198.51.100.30', userAgent: 'vitest-ua/1.0' });
	});

	it('onSignOut with null userId records actor and target as null', async () => {
		await emitter.onSignOut({ userId: null, ctx: { ip: '198.51.100.31' } });

		const rows = await db.select().from(auditLog).where(eq(auditLog.targetType, AUDIT_TARGETS.AUTH_LOGOUT));
		const row = rows.find((r) => {
			const md = r.metadata as Record<string, unknown>;
			return md.ip === '198.51.100.31';
		});
		expect(row, 'logout-with-no-session row should exist').toBeDefined();
		expect(row?.actorId).toBeNull();
		expect(row?.targetId).toBeNull();
		if (row) await db.delete(auditLog).where(eq(auditLog.id, row.id));
	});

	it('strips empty / null metadata fields so the jsonb stays compact', async () => {
		await emitter.onSignInSuccess({
			userId: TEST_USER_ID,
			ctx: { ip: '198.51.100.40', userAgent: null, sessionId: '' },
		});

		const rows = await db.select().from(auditLog).where(eq(auditLog.actorId, TEST_USER_ID));
		const row = rows
			.filter((r) => r.targetType === AUDIT_TARGETS.AUTH_LOGIN)
			.find((r) => (r.metadata as Record<string, unknown>).ip === '198.51.100.40');
		expect(row).toBeDefined();
		const md = row?.metadata as Record<string, unknown>;
		expect(md.userAgent).toBeUndefined();
		expect(md.sessionId).toBeUndefined();
		expect(md.ip).toBe('198.51.100.40');
	});
});
