/**
 * Coverage for the user-detail form-action schemas. Asserts each schema's
 * accept-set and the most important rejection paths so a future change
 * to better-auth's contract or to `ROLE_VALUES` lights up here first.
 */

import { ROLES } from '@ab/constants';
import { describe, expect, it } from 'vitest';
import {
	BanUserInputSchema,
	RevokeAllUserSessionsInputSchema,
	RevokeUserSessionInputSchema,
	SetUserRoleInputSchema,
	UnbanUserInputSchema,
} from './user-write-schemas';

describe('SetUserRoleInputSchema', () => {
	it.each(Object.values(ROLES))('accepts canonical role %s', (role) => {
		const parsed = SetUserRoleInputSchema.safeParse({ targetUserId: 'user_abc', newRole: role });
		expect(parsed.success).toBe(true);
	});

	it('rejects an unknown role', () => {
		const parsed = SetUserRoleInputSchema.safeParse({ targetUserId: 'user_abc', newRole: 'superuser' });
		expect(parsed.success).toBe(false);
	});

	it('rejects an empty target user id', () => {
		const parsed = SetUserRoleInputSchema.safeParse({ targetUserId: '   ', newRole: ROLES.ADMIN });
		expect(parsed.success).toBe(false);
	});
});

describe('BanUserInputSchema', () => {
	it('accepts a minimal ban with only required fields', () => {
		const parsed = BanUserInputSchema.safeParse({
			targetUserId: 'user_abc',
			reason: 'spam',
			confirmEmail: 'a@b.test',
		});
		expect(parsed.success).toBe(true);
	});

	it('coerces a future ISO string into a Date', () => {
		const future = new Date(Date.now() + 86_400_000).toISOString();
		const parsed = BanUserInputSchema.safeParse({
			targetUserId: 'user_abc',
			reason: 'temp',
			expiresAt: future,
			confirmEmail: 'a@b.test',
		});
		expect(parsed.success).toBe(true);
		if (parsed.success) {
			expect(parsed.data.expiresAt).toBeInstanceOf(Date);
		}
	});

	it('treats an empty expiresAt string as undefined (permanent ban)', () => {
		const parsed = BanUserInputSchema.safeParse({
			targetUserId: 'user_abc',
			reason: 'permanent',
			expiresAt: '',
			confirmEmail: 'a@b.test',
		});
		expect(parsed.success).toBe(true);
		if (parsed.success) {
			expect(parsed.data.expiresAt).toBeUndefined();
		}
	});

	it('rejects a past expiresAt', () => {
		const past = new Date(Date.now() - 86_400_000).toISOString();
		const parsed = BanUserInputSchema.safeParse({
			targetUserId: 'user_abc',
			reason: 'r',
			expiresAt: past,
			confirmEmail: 'a@b.test',
		});
		expect(parsed.success).toBe(false);
	});

	it('rejects an empty reason', () => {
		const parsed = BanUserInputSchema.safeParse({
			targetUserId: 'user_abc',
			reason: '   ',
			confirmEmail: 'a@b.test',
		});
		expect(parsed.success).toBe(false);
	});

	it('rejects a missing confirmEmail', () => {
		const parsed = BanUserInputSchema.safeParse({ targetUserId: 'user_abc', reason: 'r' });
		expect(parsed.success).toBe(false);
	});

	it('rejects a reason longer than 500 chars', () => {
		const reason = 'x'.repeat(501);
		const parsed = BanUserInputSchema.safeParse({
			targetUserId: 'user_abc',
			reason,
			confirmEmail: 'a@b.test',
		});
		expect(parsed.success).toBe(false);
	});
});

describe('UnbanUserInputSchema', () => {
	it('accepts the minimum payload', () => {
		const parsed = UnbanUserInputSchema.safeParse({ targetUserId: 'user_abc' });
		expect(parsed.success).toBe(true);
	});

	it('rejects an empty user id', () => {
		const parsed = UnbanUserInputSchema.safeParse({ targetUserId: '' });
		expect(parsed.success).toBe(false);
	});
});

describe('RevokeUserSessionInputSchema', () => {
	it('accepts a payload with a session id', () => {
		const parsed = RevokeUserSessionInputSchema.safeParse({
			targetUserId: 'user_abc',
			sessionId: 'sess_xyz',
			confirmEmail: 'a@b.test',
		});
		expect(parsed.success).toBe(true);
	});

	it('rejects when sessionId is empty', () => {
		const parsed = RevokeUserSessionInputSchema.safeParse({
			targetUserId: 'user_abc',
			sessionId: '   ',
			confirmEmail: 'a@b.test',
		});
		expect(parsed.success).toBe(false);
	});
});

describe('RevokeAllUserSessionsInputSchema', () => {
	it('accepts the minimum payload', () => {
		const parsed = RevokeAllUserSessionsInputSchema.safeParse({
			targetUserId: 'user_abc',
			confirmEmail: 'a@b.test',
		});
		expect(parsed.success).toBe(true);
	});

	it('rejects when confirmEmail is empty', () => {
		const parsed = RevokeAllUserSessionsInputSchema.safeParse({
			targetUserId: 'user_abc',
			confirmEmail: '   ',
		});
		expect(parsed.success).toBe(false);
	});
});
