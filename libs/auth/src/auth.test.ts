import { ROLES, ROUTES, type Role } from '@ab/constants';
import type { RequestEvent } from '@sveltejs/kit';
import { describe, expect, it } from 'vitest';
import type { AuthUser } from './auth';
import { requireAuth, requireRole } from './auth';

function makeUser(role: Role = ROLES.AUTHOR): AuthUser {
	return {
		id: 'user-1',
		email: 'test@example.com',
		name: 'Test User',
		firstName: 'Test',
		lastName: 'User',
		emailVerified: true,
		role,
		image: null,
		banned: false,
		createdAt: new Date(),
		updatedAt: new Date(),
	};
}

function makeEvent(user: AuthUser | null = null, path = '/memory'): RequestEvent {
	return {
		locals: { user } as unknown as RequestEvent['locals'],
		url: new URL(`http://localhost${path}`),
	} as unknown as RequestEvent;
}

function expectRedirect(thrown: unknown, expectedStatus: number, expectedPath: string) {
	const r = thrown as { status: number; location: string };
	expect(r.status).toBe(expectedStatus);
	expect(r.location).toContain(expectedPath);
}

function expectForbidden(thrown: unknown) {
	const r = thrown as { status: number };
	expect(r.status).toBe(403);
}

describe('requireAuth', () => {
	it('returns the user when authenticated', () => {
		const user = makeUser();
		const result = requireAuth(makeEvent(user));
		expect(result).toBe(user);
	});

	it('redirects to login when not authenticated', () => {
		expect.assertions(2);
		try {
			requireAuth(makeEvent(null));
		} catch (e) {
			expectRedirect(e, 302, ROUTES.LOGIN);
		}
	});

	it('encodes the current path in the redirectTo param', () => {
		expect.assertions(1);
		try {
			requireAuth(makeEvent(null, '/memory/review'));
		} catch (e) {
			const r = e as { location: string };
			expect(r.location).toContain(encodeURIComponent('/memory/review'));
		}
	});
});

describe('requireRole', () => {
	it('returns the user when role matches', () => {
		const user = makeUser(ROLES.AUTHOR);
		const result = requireRole(makeEvent(user), ROLES.AUTHOR);
		expect(result).toBe(user);
	});

	it('returns the user when role is any of the allowed set', () => {
		const user = makeUser(ROLES.ADMIN);
		const result = requireRole(makeEvent(user), ROLES.AUTHOR, ROLES.ADMIN);
		expect(result).toBe(user);
	});

	it('throws 403 when user has wrong role', () => {
		expect.assertions(1);
		const user = makeUser(ROLES.LEARNER);
		try {
			requireRole(makeEvent(user), ROLES.AUTHOR);
		} catch (e) {
			expectForbidden(e);
		}
	});

	it('redirects to login first when not authenticated', () => {
		expect.assertions(2);
		try {
			requireRole(makeEvent(null), ROLES.AUTHOR);
		} catch (e) {
			expectRedirect(e, 302, ROUTES.LOGIN);
		}
	});

	it('throws 403 when user role is null', () => {
		expect.assertions(1);
		const user = makeUser(ROLES.AUTHOR);
		const userWithNullRole: AuthUser = { ...user, role: null };
		try {
			requireRole(makeEvent(userWithNullRole), ROLES.AUTHOR);
		} catch (e) {
			expectForbidden(e);
		}
	});

	it('LEARNER is blocked from AUTHOR-only routes', () => {
		expect.assertions(1);
		const user = makeUser(ROLES.LEARNER);
		try {
			requireRole(makeEvent(user), ROLES.AUTHOR, ROLES.ADMIN);
		} catch (e) {
			expectForbidden(e);
		}
	});

	it('OPERATOR is blocked when only ADMIN is allowed', () => {
		expect.assertions(1);
		const user = makeUser(ROLES.OPERATOR);
		try {
			requireRole(makeEvent(user), ROLES.ADMIN);
		} catch (e) {
			expectForbidden(e);
		}
	});
});
