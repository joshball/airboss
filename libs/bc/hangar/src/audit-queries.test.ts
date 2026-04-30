/**
 * Unit + integration coverage for the audit-queries module.
 *
 * Pure helpers (`clampAuditLimit`, `decodeAuditCursor`, `encodeAuditCursor`,
 * `buildAuditWhere`) run in-memory. The DB-touching helpers
 * (`listAuditEntries`, `getAuditEntry`, `searchActorIds`) seed isolated
 * fixtures, exercise filter composition, then clean up.
 *
 * The fixture pattern mirrors `jobs-queries.test.ts`: `beforeAll` inserts
 * a small dedicated dataset; `afterAll` deletes the inserted rows.
 */

import { auditLog, AUDIT_OPS, type AuditOp } from '@ab/audit';
import { bauthUser } from '@ab/auth/schema';
import { AUDIT_LIST_DEFAULT_LIMIT, AUDIT_LIST_HARD_CAP, AUDIT_TARGETS, ROLES } from '@ab/constants';
import { db } from '@ab/db/connection';
import { generateAuditLogId, generateAuthId } from '@ab/utils';
import { eq, inArray } from 'drizzle-orm';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import {
	AUDIT_ACTOR_SYSTEM,
	buildAuditWhere,
	clampAuditLimit,
	decodeAuditCursor,
	encodeAuditCursor,
	getAuditEntry,
	listAuditEntries,
	searchActorIds,
} from './audit-queries';

// -------- pure-helper coverage (no db) --------

describe('clampAuditLimit', () => {
	it('falls back to the default when undefined', () => {
		expect(clampAuditLimit(undefined)).toBe(AUDIT_LIST_DEFAULT_LIMIT);
	});

	it('falls back to the default for non-positive values', () => {
		expect(clampAuditLimit(0)).toBe(AUDIT_LIST_DEFAULT_LIMIT);
		expect(clampAuditLimit(-5)).toBe(AUDIT_LIST_DEFAULT_LIMIT);
		expect(clampAuditLimit(Number.NaN)).toBe(AUDIT_LIST_DEFAULT_LIMIT);
		expect(clampAuditLimit(Number.POSITIVE_INFINITY)).toBe(AUDIT_LIST_DEFAULT_LIMIT);
	});

	it('caps requested limits at the hard cap', () => {
		expect(clampAuditLimit(AUDIT_LIST_HARD_CAP + 50)).toBe(AUDIT_LIST_HARD_CAP);
		expect(clampAuditLimit(10_000)).toBe(AUDIT_LIST_HARD_CAP);
	});

	it('passes valid requests through unchanged', () => {
		expect(clampAuditLimit(25)).toBe(25);
		expect(clampAuditLimit(AUDIT_LIST_HARD_CAP)).toBe(AUDIT_LIST_HARD_CAP);
	});

	it('floors fractional requests', () => {
		expect(clampAuditLimit(50.9)).toBe(50);
	});
});

describe('audit cursor encode + decode', () => {
	it('round-trips a (timestamp, id) tuple', () => {
		const ts = new Date('2026-04-30T12:34:56.789Z');
		const id = 'aud_01HX0000000000000000000000';
		const encoded = encodeAuditCursor(ts, id);
		expect(encoded).toBe(`${ts.toISOString()}::${id}`);
		const decoded = decodeAuditCursor(encoded);
		expect(decoded).not.toBeNull();
		expect(decoded?.timestamp.toISOString()).toBe(ts.toISOString());
		expect(decoded?.id).toBe(id);
	});

	it('returns null for missing or malformed cursors', () => {
		expect(decodeAuditCursor(undefined)).toBeNull();
		expect(decodeAuditCursor(null)).toBeNull();
		expect(decodeAuditCursor('')).toBeNull();
		expect(decodeAuditCursor('::aud_x')).toBeNull(); // empty timestamp
		expect(decodeAuditCursor('2026-04-30T00:00:00Z::')).toBeNull(); // empty id
		expect(decodeAuditCursor('not-a-date::aud_x')).toBeNull(); // bad date
		expect(decodeAuditCursor('plainstring')).toBeNull(); // no delimiter
	});
});

describe('buildAuditWhere', () => {
	it('returns undefined when no filters are present', () => {
		expect(buildAuditWhere({})).toBeUndefined();
	});

	it('emits a single clause per filter and AND-combines multiple', () => {
		// Drizzle returns SQL chunks that are not safely serialisable; the
		// surface assertion is "expression is non-undefined". The integration
		// tests below verify the WHERE actually narrows the result set.
		expect(buildAuditWhere({ actorId: 'usr_x' })).toBeDefined();
		expect(buildAuditWhere({ actorId: AUDIT_ACTOR_SYSTEM })).toBeDefined();
		expect(buildAuditWhere({ targetType: AUDIT_TARGETS.HANGAR_PING })).toBeDefined();
		expect(buildAuditWhere({ targetId: 'src_x' })).toBeDefined();
		expect(buildAuditWhere({ op: AUDIT_OPS.UPDATE })).toBeDefined();
		expect(buildAuditWhere({ from: new Date(), to: new Date() })).toBeDefined();
		expect(buildAuditWhere({ cursor: '2026-04-30T00:00:00Z::aud_x' })).toBeDefined();
	});

	it('drops the cursor clause when the cursor is malformed', () => {
		// A bad cursor should not produce a WHERE that always evaluates false.
		// With an empty filter set + bad cursor, we expect undefined.
		expect(buildAuditWhere({ cursor: 'garbage' })).toBeUndefined();
	});
});

// -------- integration coverage (live db) --------

const ACTOR_A_ID = generateAuthId();
const ACTOR_B_ID = generateAuthId();
const ACTOR_A_EMAIL = `audit-explorer-a-${ACTOR_A_ID}@airboss.test`;
const ACTOR_B_EMAIL = `audit-explorer-b-${ACTOR_B_ID}@airboss.test`;

const TEST_TARGET_TYPE = AUDIT_TARGETS.HANGAR_PING;
const TEST_TARGET_ID_X = `tgt_x_${ACTOR_A_ID}`;
const TEST_TARGET_ID_Y = `tgt_y_${ACTOR_A_ID}`;

const insertedAuditIds: string[] = [];

interface SeedRow {
	id: string;
	actorId: string | null;
	op: AuditOp;
	targetType: string;
	targetId: string | null;
	timestamp: Date;
	before?: unknown;
	after?: unknown;
}

async function insertAudit(row: SeedRow): Promise<void> {
	insertedAuditIds.push(row.id);
	await db.insert(auditLog).values({
		id: row.id,
		actorId: row.actorId,
		op: row.op,
		targetType: row.targetType,
		targetId: row.targetId,
		timestamp: row.timestamp,
		before: row.before ?? null,
		after: row.after ?? null,
		metadata: { requestId: 'req-test', reason: 'unit-test-fixture' },
	});
}

beforeAll(async () => {
	const now = new Date();
	await db
		.insert(bauthUser)
		.values([
			{
				id: ACTOR_A_ID,
				email: ACTOR_A_EMAIL,
				name: 'Audit Tester Alpha',
				firstName: 'Audit',
				lastName: 'Alpha',
				emailVerified: false,
				role: ROLES.ADMIN,
				createdAt: now,
				updatedAt: now,
			},
			{
				id: ACTOR_B_ID,
				email: ACTOR_B_EMAIL,
				name: 'Audit Tester Beta',
				firstName: 'Audit',
				lastName: 'Beta',
				emailVerified: false,
				role: ROLES.AUTHOR,
				createdAt: now,
				updatedAt: now,
			},
		])
		.onConflictDoNothing();

	const base = Date.now();
	// 6 fixture rows, monotonically increasing timestamps, so newest-first
	// order is row6 -> row1.
	await insertAudit({
		id: generateAuditLogId(),
		actorId: ACTOR_A_ID,
		op: AUDIT_OPS.CREATE,
		targetType: TEST_TARGET_TYPE,
		targetId: TEST_TARGET_ID_X,
		timestamp: new Date(base + 1_000),
		after: { foo: 'bar' },
	});
	await insertAudit({
		id: generateAuditLogId(),
		actorId: ACTOR_A_ID,
		op: AUDIT_OPS.UPDATE,
		targetType: TEST_TARGET_TYPE,
		targetId: TEST_TARGET_ID_X,
		timestamp: new Date(base + 2_000),
		before: { foo: 'bar' },
		after: { foo: 'baz' },
	});
	await insertAudit({
		id: generateAuditLogId(),
		actorId: ACTOR_B_ID,
		op: AUDIT_OPS.UPDATE,
		targetType: TEST_TARGET_TYPE,
		targetId: TEST_TARGET_ID_Y,
		timestamp: new Date(base + 3_000),
	});
	await insertAudit({
		id: generateAuditLogId(),
		actorId: null, // system write
		op: AUDIT_OPS.ACTION,
		targetType: TEST_TARGET_TYPE,
		targetId: null,
		timestamp: new Date(base + 4_000),
	});
	await insertAudit({
		id: generateAuditLogId(),
		actorId: ACTOR_B_ID,
		op: AUDIT_OPS.DELETE,
		targetType: TEST_TARGET_TYPE,
		targetId: TEST_TARGET_ID_Y,
		timestamp: new Date(base + 5_000),
		before: { foo: 'baz' },
	});
	await insertAudit({
		id: generateAuditLogId(),
		actorId: ACTOR_A_ID,
		op: AUDIT_OPS.UPDATE,
		targetType: TEST_TARGET_TYPE,
		targetId: TEST_TARGET_ID_X,
		timestamp: new Date(base + 6_000),
		before: { foo: 'baz' },
		after: { foo: 'qux' },
	});
});

afterAll(async () => {
	if (insertedAuditIds.length > 0) {
		await db.delete(auditLog).where(inArray(auditLog.id, insertedAuditIds));
	}
	await db.delete(bauthUser).where(inArray(bauthUser.id, [ACTOR_A_ID, ACTOR_B_ID]));
});

describe('listAuditEntries -- filter composition', () => {
	it('returns rows newest-first for the seeded target', async () => {
		const page = await listAuditEntries({ targetType: TEST_TARGET_TYPE, limit: 10 });
		const ours = page.rows.filter((r) => insertedAuditIds.includes(r.id));
		expect(ours).toHaveLength(6);
		// newest -> oldest
		const ts = ours.map((r) => r.timestamp.getTime());
		const sorted = [...ts].sort((a, b) => b - a);
		expect(ts).toEqual(sorted);
	});

	it('filters by exact actor id', async () => {
		const page = await listAuditEntries({ actorId: ACTOR_A_ID, targetType: TEST_TARGET_TYPE });
		const ours = page.rows.filter((r) => insertedAuditIds.includes(r.id));
		expect(ours).toHaveLength(3);
		expect(ours.every((r) => r.actorId === ACTOR_A_ID)).toBe(true);
	});

	it('filters by system writes (actor_id IS NULL) via the sentinel', async () => {
		const page = await listAuditEntries({ actorId: AUDIT_ACTOR_SYSTEM, targetType: TEST_TARGET_TYPE });
		const ours = page.rows.filter((r) => insertedAuditIds.includes(r.id));
		expect(ours).toHaveLength(1);
		expect(ours[0]?.actorId).toBeNull();
	});

	it('filters by op', async () => {
		const page = await listAuditEntries({ op: AUDIT_OPS.UPDATE, targetType: TEST_TARGET_TYPE });
		const ours = page.rows.filter((r) => insertedAuditIds.includes(r.id));
		expect(ours).toHaveLength(3);
		expect(ours.every((r) => r.op === AUDIT_OPS.UPDATE)).toBe(true);
	});

	it('filters by target id', async () => {
		const page = await listAuditEntries({ targetType: TEST_TARGET_TYPE, targetId: TEST_TARGET_ID_X });
		const ours = page.rows.filter((r) => insertedAuditIds.includes(r.id));
		expect(ours).toHaveLength(3);
		expect(ours.every((r) => r.targetId === TEST_TARGET_ID_X)).toBe(true);
	});

	it('combines actor + op + target filters', async () => {
		const page = await listAuditEntries({
			actorId: ACTOR_A_ID,
			op: AUDIT_OPS.UPDATE,
			targetType: TEST_TARGET_TYPE,
			targetId: TEST_TARGET_ID_X,
		});
		const ours = page.rows.filter((r) => insertedAuditIds.includes(r.id));
		expect(ours).toHaveLength(2);
		expect(ours.every((r) => r.actorId === ACTOR_A_ID && r.op === AUDIT_OPS.UPDATE)).toBe(true);
	});

	it('honours the time-window filter', async () => {
		// All seeded rows landed inside a 6-second window. Filter to the
		// last 3 seconds of that window.
		const last3 = await db
			.select({ ts: auditLog.timestamp })
			.from(auditLog)
			.where(inArray(auditLog.id, insertedAuditIds));
		const newest = Math.max(...last3.map((r) => r.ts.getTime()));
		const lowerBound = new Date(newest - 2_500);

		const page = await listAuditEntries({
			targetType: TEST_TARGET_TYPE,
			from: lowerBound,
		});
		const ours = page.rows.filter((r) => insertedAuditIds.includes(r.id));
		// rows 5 and 6 fall inside the 2.5s window; row 4 is exactly 1s
		// older than the cutoff. Spec says inclusive, but the cutoff is
		// 2.5s so only rows 5 + 6 land inside.
		expect(ours.length).toBeGreaterThanOrEqual(2);
		expect(ours.every((r) => r.timestamp.getTime() >= lowerBound.getTime())).toBe(true);
	});

	it('paginates with cursor + limit', async () => {
		const first = await listAuditEntries({ targetType: TEST_TARGET_TYPE, targetId: TEST_TARGET_ID_X, limit: 2 });
		const ours1 = first.rows.filter((r) => insertedAuditIds.includes(r.id));
		expect(ours1).toHaveLength(2);
		expect(first.nextCursor).not.toBeNull();

		const second = await listAuditEntries({
			targetType: TEST_TARGET_TYPE,
			targetId: TEST_TARGET_ID_X,
			limit: 2,
			cursor: first.nextCursor ?? undefined,
		});
		const ours2 = second.rows.filter((r) => insertedAuditIds.includes(r.id));
		expect(ours2).toHaveLength(1);
		// second page has no overlap with the first
		const overlap = ours1.some((a) => ours2.some((b) => a.id === b.id));
		expect(overlap).toBe(false);
		expect(second.nextCursor).toBeNull();
	});

	it('joins the actor display name + email on hits with a known actor', async () => {
		const page = await listAuditEntries({ actorId: ACTOR_A_ID, targetType: TEST_TARGET_TYPE, limit: 1 });
		const ours = page.rows.filter((r) => insertedAuditIds.includes(r.id));
		expect(ours[0]?.actorName).toBe('Audit Tester Alpha');
		expect(ours[0]?.actorEmail).toBe(ACTOR_A_EMAIL);
	});

	it('returns null actor name + email for system writes', async () => {
		const page = await listAuditEntries({ actorId: AUDIT_ACTOR_SYSTEM, targetType: TEST_TARGET_TYPE });
		const ours = page.rows.filter((r) => insertedAuditIds.includes(r.id));
		expect(ours[0]?.actorName).toBeNull();
		expect(ours[0]?.actorEmail).toBeNull();
	});
});

describe('getAuditEntry', () => {
	it('returns null for an unknown id', async () => {
		const row = await getAuditEntry('aud_does_not_exist');
		expect(row).toBeNull();
	});

	it('returns the full row with actor join populated', async () => {
		const id = insertedAuditIds[1]; // the seeded UPDATE on actor A
		expect(id).toBeDefined();
		if (!id) return;
		const row = await getAuditEntry(id);
		expect(row).not.toBeNull();
		expect(row?.id).toBe(id);
		expect(row?.actorId).toBe(ACTOR_A_ID);
		expect(row?.actorName).toBe('Audit Tester Alpha');
		expect(row?.actorEmail).toBe(ACTOR_A_EMAIL);
		expect(row?.actorRole).toBe(ROLES.ADMIN);
		expect(row?.before).toEqual({ foo: 'bar' });
		expect(row?.after).toEqual({ foo: 'baz' });
		expect(row?.metadata).toEqual({ requestId: 'req-test', reason: 'unit-test-fixture' });
	});

	it('returns the row with null actor identity for system writes', async () => {
		const systemId = insertedAuditIds[3]; // the seeded ACTION row with null actor
		expect(systemId).toBeDefined();
		if (!systemId) return;
		const row = await getAuditEntry(systemId);
		expect(row).not.toBeNull();
		expect(row?.actorId).toBeNull();
		expect(row?.actorName).toBeNull();
		expect(row?.actorEmail).toBeNull();
		expect(row?.actorRole).toBeNull();
	});
});

describe('searchActorIds', () => {
	it('returns an empty list for empty input', async () => {
		expect(await searchActorIds('')).toEqual([]);
		expect(await searchActorIds('   ')).toEqual([]);
		expect(await searchActorIds(undefined)).toEqual([]);
		expect(await searchActorIds(null)).toEqual([]);
	});

	it('matches by partial name', async () => {
		const hits = await searchActorIds('Tester Alpha');
		expect(hits.some((h) => h.id === ACTOR_A_ID)).toBe(true);
	});

	it('matches by partial email', async () => {
		const hits = await searchActorIds(ACTOR_B_EMAIL.slice(0, 12));
		expect(hits.some((h) => h.id === ACTOR_B_ID)).toBe(true);
	});

	it('escapes wildcards so a literal % does not match every user', async () => {
		// `%` is a SQL LIKE wildcard. With escaping, a literal `%` should
		// not match -- our seeded users have no `%` in their name/email so
		// the result excludes both fixture actors.
		const hits = await searchActorIds('%');
		expect(hits.some((h) => h.id === ACTOR_A_ID || h.id === ACTOR_B_ID)).toBe(false);
	});

	it('respects the cap', async () => {
		// Cap at 1 even though 2 fixtures match the prefix.
		const hits = await searchActorIds('Audit Tester', 1);
		expect(hits.length).toBeLessThanOrEqual(1);
	});
});
