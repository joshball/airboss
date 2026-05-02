/**
 * Pure-logic coverage for the BC guard helpers (`assertSelfTargetAllowed`,
 * `assertNotLastAdmin`). The DB-touching helper takes a `db` argument so we
 * inject a stub implementation of `getUser` + `countUsersByRole`'s read
 * surface via vitest module-mock.
 */

import { ROLES } from '@ab/constants';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const getUserMock = vi.fn();
const countUsersByRoleMock = vi.fn();

vi.mock('./users', () => ({
	getUser: (id: string, db?: unknown) => getUserMock(id, db),
	countUsersByRole: (opts?: unknown, db?: unknown) => countUsersByRoleMock(opts, db),
	countUserSessions: vi.fn(),
	hasUserSessionWithId: vi.fn(),
}));

const { assertNotLastAdmin, assertSelfTargetAllowed, LastAdminError, SelfTargetForbiddenError } = await import(
	'./user-writes'
);

beforeEach(() => {
	getUserMock.mockReset();
	countUsersByRoleMock.mockReset();
});

describe('assertSelfTargetAllowed', () => {
	it('throws SelfTargetForbiddenError on self set-role', () => {
		expect(() => assertSelfTargetAllowed({ actorId: 'u1', targetUserId: 'u1', op: 'set-role' })).toThrow(
			SelfTargetForbiddenError,
		);
	});

	it('throws SelfTargetForbiddenError on self ban', () => {
		expect(() => assertSelfTargetAllowed({ actorId: 'u1', targetUserId: 'u1', op: 'ban' })).toThrow(
			SelfTargetForbiddenError,
		);
	});

	it('allows non-self set-role', () => {
		expect(() => assertSelfTargetAllowed({ actorId: 'u1', targetUserId: 'u2', op: 'set-role' })).not.toThrow();
	});

	it('allows non-self ban', () => {
		expect(() => assertSelfTargetAllowed({ actorId: 'u1', targetUserId: 'u2', op: 'ban' })).not.toThrow();
	});
});

describe('assertNotLastAdmin', () => {
	it('no-ops when newRole is admin (promotion is always safe)', async () => {
		await expect(assertNotLastAdmin({ targetUserId: 'u1', newRole: ROLES.ADMIN })).resolves.toBeUndefined();
		expect(getUserMock).not.toHaveBeenCalled();
		expect(countUsersByRoleMock).not.toHaveBeenCalled();
	});

	it('no-ops when target user is not currently an admin (not a demotion)', async () => {
		getUserMock.mockResolvedValueOnce({ id: 'u1', role: ROLES.LEARNER });
		await expect(assertNotLastAdmin({ targetUserId: 'u1', newRole: ROLES.AUTHOR })).resolves.toBeUndefined();
		expect(countUsersByRoleMock).not.toHaveBeenCalled();
	});

	it('no-ops when the target user is not found (caller surfaces 404 elsewhere)', async () => {
		getUserMock.mockResolvedValueOnce(null);
		await expect(assertNotLastAdmin({ targetUserId: 'u1', newRole: ROLES.AUTHOR })).resolves.toBeUndefined();
		expect(countUsersByRoleMock).not.toHaveBeenCalled();
	});

	it('throws LastAdminError when demoting the only admin', async () => {
		getUserMock.mockResolvedValueOnce({ id: 'u1', role: ROLES.ADMIN });
		countUsersByRoleMock.mockResolvedValueOnce({ learner: 0, author: 0, operator: 0, admin: 1 });
		await expect(assertNotLastAdmin({ targetUserId: 'u1', newRole: ROLES.AUTHOR })).rejects.toBeInstanceOf(
			LastAdminError,
		);
	});

	it('allows demoting one of multiple admins', async () => {
		getUserMock.mockResolvedValueOnce({ id: 'u1', role: ROLES.ADMIN });
		countUsersByRoleMock.mockResolvedValueOnce({ learner: 0, author: 0, operator: 0, admin: 2 });
		await expect(assertNotLastAdmin({ targetUserId: 'u1', newRole: ROLES.AUTHOR })).resolves.toBeUndefined();
	});
});
