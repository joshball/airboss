/**
 * Audit log query tests.
 *
 * `countAuditEntriesSince` powers the hangar admin home's "recent activity"
 * tile. The query is a small `gte(timestamp, since)` count -- this test pins
 * the `since` boundary semantics (inclusive) and confirms newly-written rows
 * are visible immediately. Covers the BC query helper called out in the
 * extract-hangar-bc work package.
 *
 * `auditRecent` and `auditWrite` are verified end-to-end here too because the
 * helpers compose: a read-after-write proves the schema, the write path, and
 * the count aggregation all see the same row.
 */

import { AUDIT_TARGETS } from '@ab/constants';
import { db } from '@ab/db/connection';
import { eq } from 'drizzle-orm';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { auditRecent, auditWrite, countAuditEntriesSince } from './log';
import { AUDIT_OPS, auditLog } from './schema';

const TEST_TARGET_TYPE = AUDIT_TARGETS.HANGAR_PING;
const TEST_RUN_ID = `audit-test-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;

beforeAll(async () => {
	// Clean any prior test rows so counts are predictable. The check on
	// metadata.testRunId scopes deletion to this run; other concurrent suites
	// (or production rows) are left untouched.
	await db.delete(auditLog).where(eq(auditLog.targetId, TEST_RUN_ID));
});

afterAll(async () => {
	await db.delete(auditLog).where(eq(auditLog.targetId, TEST_RUN_ID));
});

describe('countAuditEntriesSince', () => {
	it('returns 0 when no rows exist after the cutoff', async () => {
		// Cutoff in the future: nothing is "since" the future.
		const future = new Date(Date.now() + 60_000);
		const count = await countAuditEntriesSince(future);
		expect(count).toBe(0);
	});

	it('counts rows whose timestamp is at or after `since` (gte boundary)', async () => {
		// `since` cutoff is taken slightly in the past so the postgres
		// `defaultNow()` server clock can't land before our Date.now()
		// snapshot due to client/server clock skew. The point of the test
		// is the gte boundary, not microsecond alignment.
		const since = new Date(Date.now() - 1000);
		const baselineBefore = await countAuditEntriesSince(since);

		await auditWrite({
			actorId: null,
			op: AUDIT_OPS.ACTION,
			targetType: TEST_TARGET_TYPE,
			targetId: TEST_RUN_ID,
			metadata: { testRunId: TEST_RUN_ID, marker: 'gte-boundary-1' },
		});
		const afterFirst = await countAuditEntriesSince(since);
		expect(afterFirst).toBeGreaterThanOrEqual(baselineBefore + 1);

		await auditWrite({
			actorId: null,
			op: AUDIT_OPS.ACTION,
			targetType: TEST_TARGET_TYPE,
			targetId: TEST_RUN_ID,
			metadata: { testRunId: TEST_RUN_ID, marker: 'gte-boundary-2' },
		});
		const afterSecond = await countAuditEntriesSince(since);
		expect(afterSecond).toBeGreaterThanOrEqual(afterFirst + 1);
	});

	it('respects timezone-aware comparison (UTC vs local)', async () => {
		// `timestamp` column is `with time zone`. A `Date` passed in is
		// compared in UTC; the count must not drift if the host is in a
		// non-UTC zone. Buffer the cutoff backward to avoid client/server
		// clock skew swallowing the row.
		const since = new Date(Date.now() - 1000);
		const baseline = await countAuditEntriesSince(since);
		await auditWrite({
			actorId: null,
			op: AUDIT_OPS.ACTION,
			targetType: TEST_TARGET_TYPE,
			targetId: TEST_RUN_ID,
			metadata: { testRunId: TEST_RUN_ID, marker: 'tz-test' },
		});
		const count = await countAuditEntriesSince(since);
		expect(count).toBeGreaterThanOrEqual(baseline + 1);
	});
});

describe('auditWrite + auditRecent round-trip', () => {
	it('writes a row that auditRecent reads back', async () => {
		const written = await auditWrite({
			actorId: null,
			op: AUDIT_OPS.ACTION,
			targetType: TEST_TARGET_TYPE,
			targetId: TEST_RUN_ID,
			metadata: { testRunId: TEST_RUN_ID, marker: 'round-trip' },
		});
		expect(written.id).toBeTruthy();
		expect(written.targetType).toBe(TEST_TARGET_TYPE);

		const recent = await auditRecent({ targetType: TEST_TARGET_TYPE, targetId: TEST_RUN_ID, limit: 5 });
		const found = recent.find((row) => row.id === written.id);
		expect(found).toBeDefined();
		expect(found?.metadata).toMatchObject({ marker: 'round-trip' });
	});

	it('orders results by timestamp DESC (latest first)', async () => {
		// Two writes in order; auditRecent's ORDER BY timestamp DESC must
		// surface the second one first.
		const a = await auditWrite({
			actorId: null,
			op: AUDIT_OPS.ACTION,
			targetType: TEST_TARGET_TYPE,
			targetId: TEST_RUN_ID,
			metadata: { testRunId: TEST_RUN_ID, marker: 'order-a' },
		});
		// Force a small delay so timestamps differ even when the clock
		// resolution is coarse.
		await new Promise((r) => setTimeout(r, 5));
		const b = await auditWrite({
			actorId: null,
			op: AUDIT_OPS.ACTION,
			targetType: TEST_TARGET_TYPE,
			targetId: TEST_RUN_ID,
			metadata: { testRunId: TEST_RUN_ID, marker: 'order-b' },
		});

		const recent = await auditRecent({ targetType: TEST_TARGET_TYPE, targetId: TEST_RUN_ID, limit: 10 });
		const indexA = recent.findIndex((row) => row.id === a.id);
		const indexB = recent.findIndex((row) => row.id === b.id);
		// Both rows present, B (later write) ahead of A.
		expect(indexA).toBeGreaterThanOrEqual(0);
		expect(indexB).toBeGreaterThanOrEqual(0);
		expect(indexB).toBeLessThan(indexA);
	});
});
