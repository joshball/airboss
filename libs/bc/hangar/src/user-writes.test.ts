/**
 * Behavior coverage for the user-write BC helpers. The DB-touching paths
 * are mocked: we verify (a) the right admin-plugin endpoint is called with
 * the right body shape, (b) the audit row is written with the correct
 * `op` / `targetType` / `before` / `after` / `metadata.subKind`, (c) errors
 * from the admin plugin are wrapped as `BetterAuthApiError`, and (d) the
 * guards run before the admin call so a forbidden state never reaches
 * better-auth.
 *
 * Drizzle queries are mocked at the module-import level via vi.mock so the
 * tests don't need a live Postgres -- the DB integration is exercised by
 * the manual test plan + Playwright E2E in Phase 9.
 */

import { ROLES } from '@ab/constants';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const auditWriteMock = vi.fn();
const getUserMock = vi.fn();
const countUsersByRoleMock = vi.fn();
const countUserSessionsMock = vi.fn();
const hasUserSessionWithIdMock = vi.fn();

// Minimal Drizzle query-builder shim. Each test seeds a result via
// `.__nextResult` and the chain returns it.
type DrizzleResult = unknown[];
const drizzleResults: DrizzleResult[] = [];
function makeChain() {
	const next = drizzleResults.shift() ?? [];
	const chain: Record<string, unknown> = {};
	const passthrough = () => chain;
	chain.from = passthrough;
	chain.where = passthrough;
	chain.orderBy = passthrough;
	chain.limit = () => Promise.resolve(next);
	return chain;
}
const dbStub = {
	select: () => makeChain(),
} as unknown as Parameters<typeof import('./user-writes').setUserRole>[1];

vi.mock('@ab/audit/server', async () => {
	const actual = await vi.importActual<typeof import('@ab/audit/server')>('@ab/audit/server');
	return {
		...actual,
		auditWrite: (input: unknown, db?: unknown) => auditWriteMock(input, db),
	};
});

vi.mock('./users', () => ({
	getUser: (id: string, db?: unknown) => getUserMock(id, db),
	countUsersByRole: (opts?: unknown, db?: unknown) => countUsersByRoleMock(opts, db),
	countUserSessions: (id: string, db?: unknown) => countUserSessionsMock(id, db),
	hasUserSessionWithId: (userId: string, sessionId: string, db?: unknown) =>
		hasUserSessionWithIdMock(userId, sessionId, db),
	USER_DETAIL_SESSION_LIMIT: 10,
}));

const {
	BetterAuthApiError,
	banUserAction,
	expiresAtToBanExpiresIn,
	revokeAllUserSessions,
	revokeUserSession,
	setUserRole,
	unbanUserAction,
} = await import('./user-writes');

const baseHeaders = new Headers({ 'user-agent': 'test-suite' });
const baseRequestCtx = {
	requestId: 'req_test',
	userAgent: 'test-suite',
};

beforeEach(() => {
	auditWriteMock.mockReset();
	getUserMock.mockReset();
	countUsersByRoleMock.mockReset();
	countUserSessionsMock.mockReset();
	hasUserSessionWithIdMock.mockReset();
	drizzleResults.length = 0;
	auditWriteMock.mockResolvedValue({ id: 'audit_test' });
});

afterEach(() => {
	expect(drizzleResults).toHaveLength(0);
});

function makeAdmin(overrides: Partial<Record<keyof MockApi, unknown>> = {}) {
	const api: MockApi = {
		setRole: vi.fn().mockResolvedValue({}),
		banUser: vi.fn().mockResolvedValue({}),
		unbanUser: vi.fn().mockResolvedValue({}),
		revokeUserSession: vi.fn().mockResolvedValue({ success: true }),
		revokeUserSessions: vi.fn().mockResolvedValue({ success: true }),
		...overrides,
	} as MockApi;
	return { api, bundle: { api } };
}

interface MockApi {
	setRole: ReturnType<typeof vi.fn>;
	banUser: ReturnType<typeof vi.fn>;
	unbanUser: ReturnType<typeof vi.fn>;
	revokeUserSession: ReturnType<typeof vi.fn>;
	revokeUserSessions: ReturnType<typeof vi.fn>;
}

describe('expiresAtToBanExpiresIn', () => {
	it('returns undefined for null / undefined (permanent ban)', () => {
		expect(expiresAtToBanExpiresIn(null)).toBeUndefined();
		expect(expiresAtToBanExpiresIn(undefined)).toBeUndefined();
	});

	it('returns the seconds-from-now delta for a future date', () => {
		const now = new Date('2026-01-01T00:00:00Z');
		const future = new Date('2026-01-01T00:01:00Z');
		expect(expiresAtToBanExpiresIn(future, now)).toBe(60);
	});

	it('returns undefined for a past date (treats as permanent)', () => {
		const now = new Date('2026-01-01T00:00:00Z');
		const past = new Date('2025-12-31T23:00:00Z');
		expect(expiresAtToBanExpiresIn(past, now)).toBeUndefined();
	});
});

describe('setUserRole', () => {
	it('calls auth.api.setRole, audits before/after, returns post-snapshot', async () => {
		// 1st getUser: assertNotLastAdmin's pre-check (target currently LEARNER -> early return)
		getUserMock.mockResolvedValueOnce({ id: 'target', role: ROLES.LEARNER, email: 't@t.test' });
		// 2nd getUser: BC's `before` snapshot
		getUserMock.mockResolvedValueOnce({ id: 'target', role: ROLES.LEARNER, email: 't@t.test' });
		// 3rd getUser: BC's `after` snapshot post auth.api.setRole
		getUserMock.mockResolvedValueOnce({ id: 'target', role: ROLES.AUTHOR, email: 't@t.test' });
		const { api, bundle } = makeAdmin();

		const result = await setUserRole(
			{
				auth: bundle,
				actorId: 'admin1',
				actorEmail: 'admin@a.test',
				targetUserId: 'target',
				newRole: ROLES.AUTHOR,
				headers: baseHeaders,
				...baseRequestCtx,
			},
			dbStub,
		);

		expect(api.setRole).toHaveBeenCalledWith({
			body: { userId: 'target', role: ROLES.AUTHOR },
			headers: baseHeaders,
		});
		expect(auditWriteMock).toHaveBeenCalledTimes(1);
		const audit = auditWriteMock.mock.calls[0]?.[0] as Record<string, unknown>;
		expect(audit.op).toBe('update');
		expect(audit.targetType).toBe('hangar.user');
		expect(audit.targetId).toBe('target');
		expect(audit.before).toEqual({ role: ROLES.LEARNER });
		expect(audit.after).toEqual({ role: ROLES.AUTHOR });
		expect((audit.metadata as Record<string, unknown>).subKind).toBe('role-assign');
		expect((audit.metadata as Record<string, unknown>).actorEmail).toBe('admin@a.test');
		expect(result.user.role).toBe(ROLES.AUTHOR);
	});

	it('rejects self set-role before calling better-auth', async () => {
		const { api, bundle } = makeAdmin();
		await expect(
			setUserRole(
				{
					auth: bundle,
					actorId: 'me',
					actorEmail: 'me@a.test',
					targetUserId: 'me',
					newRole: ROLES.LEARNER,
					headers: baseHeaders,
					...baseRequestCtx,
				},
				dbStub,
			),
		).rejects.toThrow('Cannot change your own role.');
		expect(api.setRole).not.toHaveBeenCalled();
		expect(auditWriteMock).not.toHaveBeenCalled();
	});

	it('rejects last-admin demotion before calling better-auth', async () => {
		// First getUser call inside assertNotLastAdmin
		getUserMock.mockResolvedValueOnce({ id: 'target', role: ROLES.ADMIN });
		countUsersByRoleMock.mockResolvedValueOnce({ learner: 0, author: 0, operator: 0, admin: 1 });
		const { api, bundle } = makeAdmin();
		await expect(
			setUserRole(
				{
					auth: bundle,
					actorId: 'admin1',
					actorEmail: 'admin@a.test',
					targetUserId: 'target',
					newRole: ROLES.LEARNER,
					headers: baseHeaders,
					...baseRequestCtx,
				},
				dbStub,
			),
		).rejects.toThrow('Cannot demote the last admin.');
		expect(api.setRole).not.toHaveBeenCalled();
		expect(auditWriteMock).not.toHaveBeenCalled();
	});

	it('wraps better-auth thrown error as BetterAuthApiError', async () => {
		// assertNotLastAdmin pre-check
		getUserMock.mockResolvedValueOnce({ id: 'target', role: ROLES.LEARNER });
		// BC's `before` snapshot
		getUserMock.mockResolvedValueOnce({ id: 'target', role: ROLES.LEARNER });
		const { bundle } = makeAdmin({
			setRole: vi.fn().mockRejectedValue(new Error('admin plugin: forbidden')),
		});
		await expect(
			setUserRole(
				{
					auth: bundle,
					actorId: 'admin1',
					actorEmail: 'admin@a.test',
					targetUserId: 'target',
					newRole: ROLES.AUTHOR,
					headers: baseHeaders,
					...baseRequestCtx,
				},
				dbStub,
			),
		).rejects.toBeInstanceOf(BetterAuthApiError);
		expect(auditWriteMock).not.toHaveBeenCalled();
	});
});

describe('BetterAuthApiError wrap (api-throws on every write op)', () => {
	it('banUserAction wraps a thrown api error and skips the audit', async () => {
		// readBanSnapshot before -> banned=false (mid-flight DB read works).
		drizzleResults.push([{ banned: false, banReason: null, banExpires: null }]);
		const { bundle } = makeAdmin({
			banUser: vi.fn().mockRejectedValue(new Error('admin plugin: forbidden')),
		});
		await expect(
			banUserAction(
				{
					auth: bundle,
					actorId: 'admin1',
					actorEmail: 'admin@a.test',
					targetUserId: 'target',
					reason: 'spam',
					headers: baseHeaders,
					...baseRequestCtx,
				},
				dbStub,
			),
		).rejects.toBeInstanceOf(BetterAuthApiError);
		expect(auditWriteMock).not.toHaveBeenCalled();
	});

	it('unbanUserAction wraps a thrown api error and skips the audit', async () => {
		drizzleResults.push([{ banned: true, banReason: 'old', banExpires: null }]);
		const { bundle } = makeAdmin({
			unbanUser: vi.fn().mockRejectedValue(new Error('admin plugin: forbidden')),
		});
		await expect(
			unbanUserAction(
				{
					auth: bundle,
					actorId: 'admin1',
					actorEmail: 'admin@a.test',
					targetUserId: 'target',
					headers: baseHeaders,
					...baseRequestCtx,
				},
				dbStub,
			),
		).rejects.toBeInstanceOf(BetterAuthApiError);
		expect(auditWriteMock).not.toHaveBeenCalled();
	});

	it('revokeUserSession wraps a thrown api error and skips the audit', async () => {
		// Session lookup succeeds; better-auth then throws.
		drizzleResults.push([{ token: 'tok_xyz', userId: 'target' }]);
		const { bundle } = makeAdmin({
			revokeUserSession: vi.fn().mockRejectedValue(new Error('admin plugin: forbidden')),
		});
		await expect(
			revokeUserSession(
				{
					auth: bundle,
					actorId: 'admin1',
					actorEmail: 'admin@a.test',
					targetUserId: 'target',
					sessionId: 'sess_abc',
					headers: baseHeaders,
					...baseRequestCtx,
				},
				dbStub,
			),
		).rejects.toBeInstanceOf(BetterAuthApiError);
		expect(auditWriteMock).not.toHaveBeenCalled();
	});

	it('revokeAllUserSessions wraps a thrown api error and skips the audit', async () => {
		countUserSessionsMock.mockResolvedValueOnce(2);
		hasUserSessionWithIdMock.mockResolvedValueOnce(false);
		const { bundle } = makeAdmin({
			revokeUserSessions: vi.fn().mockRejectedValue(new Error('admin plugin: forbidden')),
		});
		await expect(
			revokeAllUserSessions(
				{
					auth: bundle,
					actorId: 'admin1',
					actorEmail: 'admin@a.test',
					targetUserId: 'target',
					currentSessionId: 'sess_self',
					headers: baseHeaders,
					...baseRequestCtx,
				},
				dbStub,
			),
		).rejects.toBeInstanceOf(BetterAuthApiError);
		expect(auditWriteMock).not.toHaveBeenCalled();
	});
});

describe('post-write snapshot failure (mid-flight DB / FK race)', () => {
	it('banUserAction throws BetterAuthApiError when the after-snapshot user has disappeared', async () => {
		// readBanSnapshot before -> succeeds
		drizzleResults.push([{ banned: false, banReason: null, banExpires: null }]);
		// readBanSnapshot after -> empty (user vanished); BC code throws
		// `BetterAuthApiError` so the audit row is not written.
		drizzleResults.push([]);
		const { bundle } = makeAdmin();
		await expect(
			banUserAction(
				{
					auth: bundle,
					actorId: 'admin1',
					actorEmail: 'admin@a.test',
					targetUserId: 'target',
					reason: 'spam',
					headers: baseHeaders,
					...baseRequestCtx,
				},
				dbStub,
			),
		).rejects.toBeInstanceOf(BetterAuthApiError);
		expect(auditWriteMock).not.toHaveBeenCalled();
	});

	it('unbanUserAction throws BetterAuthApiError when the after-snapshot is missing', async () => {
		drizzleResults.push([{ banned: true, banReason: 'old', banExpires: null }]);
		drizzleResults.push([]); // after-snapshot empty
		const { bundle } = makeAdmin();
		await expect(
			unbanUserAction(
				{
					auth: bundle,
					actorId: 'admin1',
					actorEmail: 'admin@a.test',
					targetUserId: 'target',
					headers: baseHeaders,
					...baseRequestCtx,
				},
				dbStub,
			),
		).rejects.toBeInstanceOf(BetterAuthApiError);
		expect(auditWriteMock).not.toHaveBeenCalled();
	});

	it('setUserRole throws BetterAuthApiError when the after-snapshot user has disappeared', async () => {
		// assertNotLastAdmin pre-check -> not an admin, early return.
		getUserMock.mockResolvedValueOnce({ id: 'target', role: ROLES.LEARNER });
		// before snapshot -> exists
		getUserMock.mockResolvedValueOnce({ id: 'target', role: ROLES.LEARNER });
		// after snapshot -> null (user disappeared mid-flight)
		getUserMock.mockResolvedValueOnce(null);
		const { bundle } = makeAdmin();
		await expect(
			setUserRole(
				{
					auth: bundle,
					actorId: 'admin1',
					actorEmail: 'admin@a.test',
					targetUserId: 'target',
					newRole: ROLES.AUTHOR,
					headers: baseHeaders,
					...baseRequestCtx,
				},
				dbStub,
			),
		).rejects.toBeInstanceOf(BetterAuthApiError);
		expect(auditWriteMock).not.toHaveBeenCalled();
	});
});

describe('banUserAction', () => {
	it('calls auth.api.banUser with banExpiresIn (seconds), audits before/after', async () => {
		const future = new Date(Date.now() + 60_000);
		// readBanSnapshot before -> banned=false
		drizzleResults.push([{ banned: false, banReason: null, banExpires: null }]);
		// readBanSnapshot after -> banned=true
		drizzleResults.push([{ banned: true, banReason: 'spam', banExpires: future }]);
		// getUser after
		getUserMock.mockResolvedValueOnce({ id: 'target', role: ROLES.LEARNER, email: 't@t.test', banned: true });

		const { api, bundle } = makeAdmin();
		const result = await banUserAction(
			{
				auth: bundle,
				actorId: 'admin1',
				actorEmail: 'admin@a.test',
				targetUserId: 'target',
				reason: 'spam',
				expiresAt: future,
				headers: baseHeaders,
				...baseRequestCtx,
			},
			dbStub,
		);

		const banCall = api.banUser.mock.calls[0]?.[0] as { body: { banExpiresIn?: number; banReason?: string } };
		expect(banCall.body.banReason).toBe('spam');
		expect(banCall.body.banExpiresIn).toBeGreaterThan(0);

		const audit = auditWriteMock.mock.calls[0]?.[0] as Record<string, unknown>;
		expect((audit.metadata as Record<string, unknown>).subKind).toBe('ban');
		expect(audit.op).toBe('update');
		expect(audit.before).toEqual({ banned: false, banReason: null, banExpires: null });
		expect((audit.after as Record<string, unknown>).banned).toBe(true);
		expect(result.user.banned).toBe(true);
	});

	it('omits banExpiresIn for permanent ban', async () => {
		drizzleResults.push([{ banned: false, banReason: null, banExpires: null }]);
		drizzleResults.push([{ banned: true, banReason: 'permanent', banExpires: null }]);
		getUserMock.mockResolvedValueOnce({ id: 'target', role: ROLES.LEARNER });

		const { api, bundle } = makeAdmin();
		await banUserAction(
			{
				auth: bundle,
				actorId: 'admin1',
				actorEmail: 'admin@a.test',
				targetUserId: 'target',
				reason: 'permanent',
				headers: baseHeaders,
				...baseRequestCtx,
			},
			dbStub,
		);

		const banCall = api.banUser.mock.calls[0]?.[0] as { body: { banExpiresIn?: number } };
		expect(banCall.body.banExpiresIn).toBeUndefined();
	});

	it('rejects self-ban before calling better-auth', async () => {
		const { api, bundle } = makeAdmin();
		await expect(
			banUserAction(
				{
					auth: bundle,
					actorId: 'me',
					actorEmail: 'me@a.test',
					targetUserId: 'me',
					reason: 'no',
					headers: baseHeaders,
					...baseRequestCtx,
				},
				dbStub,
			),
		).rejects.toThrow('Cannot ban yourself.');
		expect(api.banUser).not.toHaveBeenCalled();
	});
});

describe('unbanUserAction', () => {
	it('calls auth.api.unbanUser, audits ban -> unban transition', async () => {
		drizzleResults.push([{ banned: true, banReason: 'old', banExpires: null }]);
		drizzleResults.push([{ banned: false, banReason: null, banExpires: null }]);
		getUserMock.mockResolvedValueOnce({ id: 'target', role: ROLES.LEARNER, banned: false });

		const { api, bundle } = makeAdmin();
		await unbanUserAction(
			{
				auth: bundle,
				actorId: 'admin1',
				actorEmail: 'admin@a.test',
				targetUserId: 'target',
				headers: baseHeaders,
				...baseRequestCtx,
			},
			dbStub,
		);

		expect(api.unbanUser).toHaveBeenCalledWith({
			body: { userId: 'target' },
			headers: baseHeaders,
		});
		const audit = auditWriteMock.mock.calls[0]?.[0] as Record<string, unknown>;
		expect((audit.metadata as Record<string, unknown>).subKind).toBe('unban');
		expect((audit.before as Record<string, unknown>).banned).toBe(true);
		expect((audit.after as Record<string, unknown>).banned).toBe(false);
	});
});

describe('revokeUserSession', () => {
	it('looks up the session token by id and forwards it as sessionToken', async () => {
		drizzleResults.push([{ token: 'tok_xyz', userId: 'target' }]);

		const { api, bundle } = makeAdmin();
		const result = await revokeUserSession(
			{
				auth: bundle,
				actorId: 'admin1',
				actorEmail: 'admin@a.test',
				targetUserId: 'target',
				sessionId: 'sess_abc',
				headers: baseHeaders,
				...baseRequestCtx,
			},
			dbStub,
		);

		expect(api.revokeUserSession).toHaveBeenCalledWith({
			body: { sessionToken: 'tok_xyz' },
			headers: baseHeaders,
		});
		const audit = auditWriteMock.mock.calls[0]?.[0] as Record<string, unknown>;
		expect(audit.op).toBe('action');
		expect((audit.metadata as Record<string, unknown>).subKind).toBe('session-revoke');
		expect((audit.metadata as Record<string, unknown>).revokedSessionId).toBe('sess_abc');
		expect(result.revokedSessionId).toBe('sess_abc');
	});

	it('throws BetterAuthApiError when no matching session is found', async () => {
		drizzleResults.push([]); // no row

		const { api, bundle } = makeAdmin();
		await expect(
			revokeUserSession(
				{
					auth: bundle,
					actorId: 'admin1',
					actorEmail: 'admin@a.test',
					targetUserId: 'target',
					sessionId: 'sess_missing',
					headers: baseHeaders,
					...baseRequestCtx,
				},
				dbStub,
			),
		).rejects.toBeInstanceOf(BetterAuthApiError);
		expect(api.revokeUserSession).not.toHaveBeenCalled();
		expect(auditWriteMock).not.toHaveBeenCalled();
	});
});

describe('revokeAllUserSessions', () => {
	it('counts sessions before the revoke, writes audit with revokedCount + revokedOwn', async () => {
		countUserSessionsMock.mockResolvedValueOnce(2);
		hasUserSessionWithIdMock.mockResolvedValueOnce(true);

		const { api, bundle } = makeAdmin();
		const result = await revokeAllUserSessions(
			{
				auth: bundle,
				actorId: 'admin1',
				actorEmail: 'admin@a.test',
				targetUserId: 'target',
				currentSessionId: 'sess_self',
				headers: baseHeaders,
				...baseRequestCtx,
			},
			dbStub,
		);

		expect(api.revokeUserSessions).toHaveBeenCalledWith({
			body: { userId: 'target' },
			headers: baseHeaders,
		});
		expect(countUserSessionsMock).toHaveBeenCalledWith('target', dbStub);
		expect(hasUserSessionWithIdMock).toHaveBeenCalledWith('target', 'sess_self', dbStub);
		const audit = auditWriteMock.mock.calls[0]?.[0] as Record<string, unknown>;
		expect((audit.metadata as Record<string, unknown>).subKind).toBe('session-revoke-all');
		expect((audit.metadata as Record<string, unknown>).revokedCount).toBe(2);
		expect((audit.metadata as Record<string, unknown>).revokedOwn).toBe(true);
		expect(result.revokedCount).toBe(2);
		expect(result.revokedOwn).toBe(true);
	});

	it('reports revokedOwn=false when the actor session is not in the set', async () => {
		countUserSessionsMock.mockResolvedValueOnce(1);
		hasUserSessionWithIdMock.mockResolvedValueOnce(false);
		const { bundle } = makeAdmin();
		const result = await revokeAllUserSessions(
			{
				auth: bundle,
				actorId: 'admin1',
				actorEmail: 'admin@a.test',
				targetUserId: 'target',
				currentSessionId: 'sess_other',
				headers: baseHeaders,
				...baseRequestCtx,
			},
			dbStub,
		);
		expect(result.revokedOwn).toBe(false);
		expect(hasUserSessionWithIdMock).toHaveBeenCalledTimes(1);
	});

	it('skips the session-id lookup entirely when currentSessionId is null', async () => {
		countUserSessionsMock.mockResolvedValueOnce(3);
		const { bundle } = makeAdmin();
		const result = await revokeAllUserSessions(
			{
				auth: bundle,
				actorId: 'admin1',
				actorEmail: 'admin@a.test',
				targetUserId: 'target',
				currentSessionId: null,
				headers: baseHeaders,
				...baseRequestCtx,
			},
			dbStub,
		);
		expect(result.revokedCount).toBe(3);
		expect(result.revokedOwn).toBe(false);
		expect(hasUserSessionWithIdMock).not.toHaveBeenCalled();
	});

	it('reports revokedCount=0 when target has no sessions but still audits', async () => {
		countUserSessionsMock.mockResolvedValueOnce(0);
		const { bundle } = makeAdmin();
		const result = await revokeAllUserSessions(
			{
				auth: bundle,
				actorId: 'admin1',
				actorEmail: 'admin@a.test',
				targetUserId: 'target',
				currentSessionId: null,
				headers: baseHeaders,
				...baseRequestCtx,
			},
			dbStub,
		);
		expect(result.revokedCount).toBe(0);
		expect(auditWriteMock).toHaveBeenCalledTimes(1);
	});
});
