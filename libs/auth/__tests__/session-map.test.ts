import { ROLES } from '@ab/constants';
import { describe, expect, it } from 'vitest';
import { type BetterAuthSessionPayload, mapBetterAuthSession } from '../src/session-map';

const baseDate = new Date('2026-05-02T12:00:00Z');

function makePayload(overrides: Partial<BetterAuthSessionPayload['user']> = {}): BetterAuthSessionPayload {
	return {
		session: { id: 'sess_1', userId: 'user_1' },
		user: {
			id: 'user_1',
			email: 'pilot@example.com',
			name: 'Pat Pilot',
			emailVerified: true,
			role: ROLES.LEARNER,
			image: 'https://example.com/avatar.png',
			banned: false,
			createdAt: baseDate,
			updatedAt: baseDate,
			firstName: 'Pat',
			lastName: 'Pilot',
			...overrides,
		},
	};
}

describe('mapBetterAuthSession', () => {
	it('maps a full better-auth session to AuthUser', () => {
		const result = mapBetterAuthSession(makePayload());
		expect(result).toEqual({
			id: 'user_1',
			email: 'pilot@example.com',
			name: 'Pat Pilot',
			firstName: 'Pat',
			lastName: 'Pilot',
			emailVerified: true,
			role: ROLES.LEARNER,
			image: 'https://example.com/avatar.png',
			banned: false,
			createdAt: baseDate,
			updatedAt: baseDate,
		});
	});

	it('returns null when payload itself is null', () => {
		expect(mapBetterAuthSession(null)).toBeNull();
	});

	it('returns null when payload has no user (anonymous request)', () => {
		expect(mapBetterAuthSession({ session: null, user: null })).toBeNull();
	});

	it('collapses unknown role strings to null so requireRole fails closed', () => {
		const result = mapBetterAuthSession(makePayload({ role: 'super-admin' }));
		expect(result?.role).toBeNull();
	});

	it('collapses missing role to null', () => {
		const result = mapBetterAuthSession(makePayload({ role: null }));
		expect(result?.role).toBeNull();
	});

	it('passes banned=true straight through so the hook can short-circuit with 403', () => {
		const result = mapBetterAuthSession(makePayload({ banned: true }));
		expect(result?.banned).toBe(true);
	});

	it('defaults missing firstName/lastName to empty string at the boundary', () => {
		const result = mapBetterAuthSession(makePayload({ firstName: undefined, lastName: undefined }));
		expect(result?.firstName).toBe('');
		expect(result?.lastName).toBe('');
	});

	it('defaults missing image to null', () => {
		const result = mapBetterAuthSession(makePayload({ image: undefined }));
		expect(result?.image).toBeNull();
	});

	it('defaults missing banned to null', () => {
		const result = mapBetterAuthSession(makePayload({ banned: undefined }));
		expect(result?.banned).toBeNull();
	});
});
