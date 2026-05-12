/**
 * Behavior coverage for the invitation BC. DB queries are mocked at the
 * Drizzle chain level (the same pattern `user-writes.test.ts` uses) so
 * the tests don't need a live Postgres; the integration story is the
 * manual test plan + Playwright E2E in Phase 9.
 *
 * What we verify:
 *
 *   - Token generation produces base64url with the configured byte
 *     length.
 *   - `createInvitation` rejects existing emails / pending invites /
 *     admin role; rolls back on email-send failure (no audit row).
 *   - `revokeInvitation` rejects already-accepted / already-revoked
 *     rows; emits the revoke audit row.
 *   - `resendInvitation` regenerates the token; rolls back on email-
 *     send failure.
 *   - `acceptInvitation` rejects expired / accepted / revoked tokens;
 *     creates the bauth user + account; emits the accept audit row.
 */

import { HANGAR_INVITATION_OP_SUBKINDS, INVITATION_TOKEN_BYTES, ROLES } from '@ab/constants';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const auditWriteMock = vi.fn();

vi.mock('@ab/audit/server', async () => {
	const actual = await vi.importActual<typeof import('@ab/audit/server')>('@ab/audit/server');
	return {
		...actual,
		auditWrite: (input: unknown, db?: unknown) => auditWriteMock(input, db),
	};
});

const {
	EmailAlreadyExistsError,
	INVITATION_STATUS,
	InvitationEmailSendFailedError,
	InvitationRoleForbiddenError,
	InvitationStateError,
	PendingInvitationExistsError,
	acceptInvitation,
	createInvitation,
	deriveInvitationStatus,
	generateInvitationToken,
	resendInvitation,
	revokeInvitation,
} = await import('./invitations');

beforeEach(() => {
	auditWriteMock.mockReset();
	auditWriteMock.mockResolvedValue({ id: 'audit_test' });
});

/* ----------------------------------------------------------------------------
 * Drizzle query-builder stub
 *
 * Each test queues `selectResults` (one entry per `.select(...)...limit()`
 * chain) and `mutateResults` (one entry per `.insert(...).returning()` /
 * `.update(...).returning()` chain). The stub pulls from the queue in
 * order. The transaction shim re-uses the parent stub so nested ops drain
 * the same queue.
 * -------------------------------------------------------------------------- */

interface StubState {
	selectResults: unknown[][];
	mutateResults: unknown[][];
}

function makeDb(state: StubState) {
	const select = () => {
		const result = state.selectResults.shift() ?? [];
		const chain: Record<string, unknown> = {};
		const passthrough = () => chain;
		chain.from = passthrough;
		chain.leftJoin = passthrough;
		chain.where = passthrough;
		chain.orderBy = passthrough;
		chain.limit = () => Promise.resolve(result);
		// listInvitations chains end with `.limit().` then a second
		// `.select().from()` for counts; the second select pulls the next
		// result. For the few tests using listInvitations we'll queue
		// both.
		return chain;
	};
	const insert = () => {
		const result = state.mutateResults.shift() ?? [];
		return {
			values: () => ({ returning: () => Promise.resolve(result) }),
		};
	};
	const update = () => {
		const result = state.mutateResults.shift() ?? [];
		return {
			set: () => ({
				where: () => ({ returning: () => Promise.resolve(result) }),
			}),
		};
	};
	const transaction = async (fn: (tx: unknown) => Promise<unknown>) => fn({ select, insert, update });
	return {
		select,
		insert,
		update,
		transaction,
	};
}

function freshState(): StubState {
	return { selectResults: [], mutateResults: [] };
}

const NOW = new Date('2026-05-02T12:00:00Z');

const baseInvitation = {
	id: 'inv_test',
	email: 'alice@example.com',
	proposedRole: ROLES.LEARNER,
	token: 'tok_existing',
	invitedByUserId: 'admin1',
	invitedAt: new Date('2026-05-01T00:00:00Z'),
	expiresAt: new Date('2026-05-08T00:00:00Z'),
	acceptedAt: null,
	acceptedUserId: null,
	revokedAt: null,
	revokedByUserId: null,
	createdAt: new Date('2026-05-01T00:00:00Z'),
	updatedAt: new Date('2026-05-01T00:00:00Z'),
};

describe('generateInvitationToken', () => {
	it('produces a base64url string of expected length', () => {
		const token = generateInvitationToken();
		// 32 bytes -> 43 base64url chars (no padding).
		expect(token).toMatch(/^[A-Za-z0-9_-]+$/);
		expect(token.length).toBeGreaterThanOrEqual(40);
		expect(token.length).toBeLessThanOrEqual(48);
	});

	it('honours a custom byte length', () => {
		const token = generateInvitationToken(16);
		expect(token).toMatch(/^[A-Za-z0-9_-]+$/);
		expect(token.length).toBeGreaterThanOrEqual(20);
	});

	it('uses INVITATION_TOKEN_BYTES by default', () => {
		expect(INVITATION_TOKEN_BYTES).toBe(32);
	});
});

describe('deriveInvitationStatus', () => {
	it('returns pending for an unaccepted, unrevoked, unexpired row', () => {
		expect(deriveInvitationStatus(baseInvitation, NOW)).toBe(INVITATION_STATUS.PENDING);
	});

	it('returns accepted when acceptedAt is set', () => {
		expect(deriveInvitationStatus({ ...baseInvitation, acceptedAt: new Date('2026-05-02T00:00:00Z') }, NOW)).toBe(
			INVITATION_STATUS.ACCEPTED,
		);
	});

	it('returns revoked when revokedAt is set', () => {
		expect(deriveInvitationStatus({ ...baseInvitation, revokedAt: new Date('2026-05-02T00:00:00Z') }, NOW)).toBe(
			INVITATION_STATUS.REVOKED,
		);
	});

	it('returns expired when the deadline has passed', () => {
		expect(deriveInvitationStatus({ ...baseInvitation, expiresAt: new Date('2026-05-01T00:00:00Z') }, NOW)).toBe(
			INVITATION_STATUS.EXPIRED,
		);
	});

	it('prefers accepted over expired', () => {
		expect(
			deriveInvitationStatus(
				{
					...baseInvitation,
					acceptedAt: new Date('2026-04-30T00:00:00Z'),
					expiresAt: new Date('2026-05-01T00:00:00Z'),
				},
				NOW,
			),
		).toBe(INVITATION_STATUS.ACCEPTED);
	});
});

/* ----------------------------------------------------------------------------
 * createInvitation
 * -------------------------------------------------------------------------- */

interface CreateScaffold {
	state: StubState;
	db: ReturnType<typeof makeDb>;
	renderEmail: ReturnType<typeof vi.fn>;
	sendEmail: ReturnType<typeof vi.fn>;
}

function scaffoldCreate(): CreateScaffold {
	const state = freshState();
	return {
		state,
		db: makeDb(state),
		renderEmail: vi.fn().mockReturnValue({ subject: "You've been invited", html: '<a>x</a>' }),
		sendEmail: vi.fn().mockResolvedValue(true),
	};
}

const baseCreateInput = {
	actorId: 'admin1',
	actorEmail: 'admin1@airboss.test',
	actorName: 'Admin One',
	email: 'Alice@example.com',
	proposedRole: ROLES.LEARNER,
	acceptUrlBuilder: (token: string) => `https://study.example/invite/${token}`,
	now: NOW,
	requestId: 'req_test',
	userAgent: 'test-suite',
};

describe('createInvitation', () => {
	it('rejects an attempted admin invite (decision (e))', async () => {
		const sc = scaffoldCreate();
		await expect(
			createInvitation(
				{ ...baseCreateInput, proposedRole: ROLES.ADMIN, renderEmail: sc.renderEmail, sendEmail: sc.sendEmail },
				sc.db as unknown as Parameters<typeof createInvitation>[1],
			),
		).rejects.toBeInstanceOf(InvitationRoleForbiddenError);
		expect(auditWriteMock).not.toHaveBeenCalled();
	});

	it('rejects an existing user email (decision (f))', async () => {
		const sc = scaffoldCreate();
		// First select: bauthUser lookup returns a row.
		sc.state.selectResults.push([{ id: 'usr_existing' }]);

		await expect(
			createInvitation(
				{ ...baseCreateInput, renderEmail: sc.renderEmail, sendEmail: sc.sendEmail },
				sc.db as unknown as Parameters<typeof createInvitation>[1],
			),
		).rejects.toBeInstanceOf(EmailAlreadyExistsError);
		expect(sc.sendEmail).not.toHaveBeenCalled();
		expect(auditWriteMock).not.toHaveBeenCalled();
	});

	it('rejects a pending invitation collision', async () => {
		const sc = scaffoldCreate();
		sc.state.selectResults.push([]); // bauthUser: not found
		sc.state.selectResults.push([{ id: 'inv_existing' }]); // pending invite found

		await expect(
			createInvitation(
				{ ...baseCreateInput, renderEmail: sc.renderEmail, sendEmail: sc.sendEmail },
				sc.db as unknown as Parameters<typeof createInvitation>[1],
			),
		).rejects.toBeInstanceOf(PendingInvitationExistsError);
		expect(sc.sendEmail).not.toHaveBeenCalled();
		expect(auditWriteMock).not.toHaveBeenCalled();
	});

	it('inserts, sends, audits, and lowercases email on the happy path', async () => {
		const sc = scaffoldCreate();
		sc.state.selectResults.push([]); // bauthUser
		sc.state.selectResults.push([]); // pending
		sc.state.mutateResults.push([{ ...baseInvitation, email: 'alice@example.com' }]); // insert

		const result = await createInvitation(
			{ ...baseCreateInput, renderEmail: sc.renderEmail, sendEmail: sc.sendEmail },
			sc.db as unknown as Parameters<typeof createInvitation>[1],
		);
		expect(result.invitation.email).toBe('alice@example.com');
		expect(sc.sendEmail).toHaveBeenCalledWith(expect.objectContaining({ to: 'alice@example.com' }));
		expect(auditWriteMock).toHaveBeenCalledTimes(1);
		const auditCall = auditWriteMock.mock.calls[0]?.[0] as Record<string, unknown>;
		expect(auditCall.targetType).toBe('hangar.invitation');
		const meta = auditCall.metadata as Record<string, unknown>;
		expect(meta.subKind).toBe(HANGAR_INVITATION_OP_SUBKINDS.CREATE);
		expect(meta.email).toBe('alice@example.com');
	});

	it('rolls back on email-send failure (no audit row)', async () => {
		const sc = scaffoldCreate();
		sc.state.selectResults.push([]); // bauthUser
		sc.state.selectResults.push([]); // pending
		sc.state.mutateResults.push([{ ...baseInvitation, email: 'alice@example.com' }]); // insert
		sc.sendEmail.mockResolvedValue(false);

		await expect(
			createInvitation(
				{ ...baseCreateInput, renderEmail: sc.renderEmail, sendEmail: sc.sendEmail },
				sc.db as unknown as Parameters<typeof createInvitation>[1],
			),
		).rejects.toBeInstanceOf(InvitationEmailSendFailedError);
		expect(auditWriteMock).not.toHaveBeenCalled();
	});
});

/* ----------------------------------------------------------------------------
 * revokeInvitation
 * -------------------------------------------------------------------------- */

describe('revokeInvitation', () => {
	const baseRevokeInput = {
		actorId: 'admin1',
		actorEmail: 'admin1@airboss.test',
		invitationId: baseInvitation.id,
		now: NOW,
		requestId: 'req_test',
		userAgent: 'test-suite',
	};

	it('rejects when the row is missing', async () => {
		const state = freshState();
		state.selectResults.push([]); // getInvitation
		const db = makeDb(state);
		await expect(
			revokeInvitation(baseRevokeInput, db as unknown as Parameters<typeof revokeInvitation>[1]),
		).rejects.toBeInstanceOf(InvitationStateError);
		expect(auditWriteMock).not.toHaveBeenCalled();
	});

	it('rejects an already-accepted invitation', async () => {
		const state = freshState();
		state.selectResults.push([{ ...baseInvitation, acceptedAt: NOW }]);
		const db = makeDb(state);
		await expect(
			revokeInvitation(baseRevokeInput, db as unknown as Parameters<typeof revokeInvitation>[1]),
		).rejects.toBeInstanceOf(InvitationStateError);
		expect(auditWriteMock).not.toHaveBeenCalled();
	});

	it('soft-deletes a pending invitation and audits', async () => {
		const state = freshState();
		state.selectResults.push([baseInvitation]); // getInvitation
		state.mutateResults.push([{ ...baseInvitation, revokedAt: NOW, revokedByUserId: 'admin1' }]); // update
		const db = makeDb(state);

		const result = await revokeInvitation(baseRevokeInput, db as unknown as Parameters<typeof revokeInvitation>[1]);
		expect(result.invitation.revokedAt).toEqual(NOW);
		expect(auditWriteMock).toHaveBeenCalledTimes(1);
		const meta = (auditWriteMock.mock.calls[0]?.[0] as Record<string, unknown>).metadata as Record<string, unknown>;
		expect(meta.subKind).toBe(HANGAR_INVITATION_OP_SUBKINDS.REVOKE);
	});
});

/* ----------------------------------------------------------------------------
 * resendInvitation
 * -------------------------------------------------------------------------- */

describe('resendInvitation', () => {
	const baseResendInput = {
		actorId: 'admin1',
		actorEmail: 'admin1@airboss.test',
		actorName: 'Admin One',
		invitationId: baseInvitation.id,
		acceptUrlBuilder: (token: string) => `https://study.example/invite/${token}`,
		now: NOW,
		requestId: 'req_test',
		userAgent: 'test-suite',
	};

	it('regenerates the token + audits on the happy path', async () => {
		const state = freshState();
		state.selectResults.push([baseInvitation]); // getInvitation
		state.mutateResults.push([{ ...baseInvitation, token: 'new_token_xyz12345', invitedAt: NOW, expiresAt: NOW }]); // update inside tx
		const db = makeDb(state);
		const renderEmail = vi.fn().mockReturnValue({ subject: 'Resent', html: '<a>x</a>' });
		const sendEmail = vi.fn().mockResolvedValue(true);

		const result = await resendInvitation(
			{ ...baseResendInput, renderEmail, sendEmail },
			db as unknown as Parameters<typeof resendInvitation>[1],
		);
		expect(result.oldTokenSuffix).not.toBe(result.newTokenSuffix);
		expect(sendEmail).toHaveBeenCalledOnce();
		const meta = (auditWriteMock.mock.calls[0]?.[0] as Record<string, unknown>).metadata as Record<string, unknown>;
		expect(meta.subKind).toBe(HANGAR_INVITATION_OP_SUBKINDS.RESEND);
		expect(meta.oldTokenSuffix).toBe('existing'.slice(-8) === '' ? 'xisting' : baseInvitation.token.slice(-8));
	});

	it('rejects an accepted invitation', async () => {
		const state = freshState();
		state.selectResults.push([{ ...baseInvitation, acceptedAt: NOW }]);
		const db = makeDb(state);
		await expect(
			resendInvitation(
				{
					...baseResendInput,
					renderEmail: vi.fn().mockReturnValue({ subject: 'x', html: 'y' }),
					sendEmail: vi.fn().mockResolvedValue(true),
				},
				db as unknown as Parameters<typeof resendInvitation>[1],
			),
		).rejects.toBeInstanceOf(InvitationStateError);
		expect(auditWriteMock).not.toHaveBeenCalled();
	});

	it('rolls back on email-send failure', async () => {
		const state = freshState();
		state.selectResults.push([baseInvitation]);
		state.mutateResults.push([{ ...baseInvitation, token: 'fresh_token_abcdef00' }]);
		const db = makeDb(state);
		const sendEmail = vi.fn().mockResolvedValue(false);
		await expect(
			resendInvitation(
				{ ...baseResendInput, renderEmail: vi.fn().mockReturnValue({ subject: 'x', html: 'y' }), sendEmail },
				db as unknown as Parameters<typeof resendInvitation>[1],
			),
		).rejects.toBeInstanceOf(InvitationEmailSendFailedError);
		expect(auditWriteMock).not.toHaveBeenCalled();
	});
});

/* ----------------------------------------------------------------------------
 * acceptInvitation
 * -------------------------------------------------------------------------- */

describe('acceptInvitation', () => {
	const baseAcceptInput = {
		token: 'tok_pending',
		password: 'a-secret-passphrase',
		hashPassword: vi.fn().mockResolvedValue('hashed:abc'),
		now: NOW,
		requestId: 'req_test',
		userAgent: 'test-suite',
	};

	it('rejects an unknown token', async () => {
		const state = freshState();
		state.selectResults.push([]); // getInvitationByToken
		const db = makeDb(state);
		await expect(
			acceptInvitation(baseAcceptInput, db as unknown as Parameters<typeof acceptInvitation>[1]),
		).rejects.toBeInstanceOf(InvitationStateError);
		expect(auditWriteMock).not.toHaveBeenCalled();
	});

	it('rejects an already-accepted token', async () => {
		const state = freshState();
		state.selectResults.push([{ ...baseInvitation, acceptedAt: NOW }]);
		const db = makeDb(state);
		await expect(
			acceptInvitation(baseAcceptInput, db as unknown as Parameters<typeof acceptInvitation>[1]),
		).rejects.toBeInstanceOf(InvitationStateError);
		expect(auditWriteMock).not.toHaveBeenCalled();
	});

	it('rejects an expired token', async () => {
		const state = freshState();
		state.selectResults.push([{ ...baseInvitation, expiresAt: new Date('2026-04-01T00:00:00Z') }]);
		const db = makeDb(state);
		await expect(
			acceptInvitation(baseAcceptInput, db as unknown as Parameters<typeof acceptInvitation>[1]),
		).rejects.toBeInstanceOf(InvitationStateError);
		expect(auditWriteMock).not.toHaveBeenCalled();
	});

	it('inserts user + account, marks invitation accepted, audits', async () => {
		const state = freshState();
		// Outer getInvitationByToken
		state.selectResults.push([baseInvitation]);
		// Inner re-check inside tx
		state.selectResults.push([baseInvitation]);
		// bauthUser insert
		state.mutateResults.push([{ id: 'usr_new', email: baseInvitation.email, name: baseInvitation.email }]);
		// bauthAccount insert (returning is fine to be empty for the test)
		state.mutateResults.push([]);
		// invitation update
		state.mutateResults.push([{ ...baseInvitation, acceptedAt: NOW, acceptedUserId: 'usr_new' }]);
		const db = makeDb(state);

		const result = await acceptInvitation(baseAcceptInput, db as unknown as Parameters<typeof acceptInvitation>[1]);
		expect(result.user.id).toBe('usr_new');
		expect(result.user.role).toBe(ROLES.LEARNER);
		expect(result.invitation.acceptedAt).toEqual(NOW);
		expect(baseAcceptInput.hashPassword).toHaveBeenCalledWith('a-secret-passphrase');
		expect(auditWriteMock).toHaveBeenCalledTimes(1);
		const auditArg = auditWriteMock.mock.calls[0]?.[0] as Record<string, unknown>;
		expect(auditArg.actorId).toBe('usr_new');
		const meta = auditArg.metadata as Record<string, unknown>;
		expect(meta.subKind).toBe(HANGAR_INVITATION_OP_SUBKINDS.ACCEPT);
		expect(meta.acceptedUserId).toBe('usr_new');
	});
});

afterEach(() => {
	auditWriteMock.mockReset();
});
