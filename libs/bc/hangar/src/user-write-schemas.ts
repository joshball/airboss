/**
 * Zod schemas for the user-detail editing form actions
 * (`?/setRole`, `?/ban`, `?/unban`, `?/revokeSession`, `?/revokeAllSessions`).
 *
 * Mirrors the conventions in `form-schemas.ts`: a schema per action, fed
 * raw `FormData` entries from the page-server form action so the BC layer
 * receives a typed payload. Each schema except `SetUserRoleInputSchema`
 * also requires a `confirmEmail` field that mirrors the typed-confirmation
 * gate enforced in the modal UI -- the action re-checks `confirmEmail`
 * server-side because the client gate is UX, not security.
 *
 * Validates only the form-level shape; self-target / last-admin / target
 * existence checks live in `user-writes.ts`.
 *
 * See `docs/work-packages/hangar-users-editing/spec.md` (Phase 2).
 */

import { ROLE_VALUES } from '@ab/constants';
import { z } from 'zod';

/** Better-auth user ids are random strings, not our prefix_ULID format. */
const userIdSchema = z.string().trim().min(1, 'User id is required');

/** Email for the typed-confirmation gate; trim only -- equality check is exact. */
const confirmEmailSchema = z.string().trim().min(1, 'Type the user email to confirm');

/** Set the target user's `role`. */
export const SetUserRoleInputSchema = z.object({
	targetUserId: userIdSchema,
	newRole: z.enum(ROLE_VALUES as unknown as [string, ...string[]]),
});

/** Ban the target user. Optional future expiry; missing = permanent. */
export const BanUserInputSchema = z.object({
	targetUserId: userIdSchema,
	reason: z.string().trim().min(1, 'Reason is required').max(500, 'Reason capped at 500 characters'),
	expiresAt: z
		.preprocess(
			(value) => (value === '' || value == null ? undefined : value),
			z
				.union([z.coerce.date(), z.undefined()])
				.refine((d) => d === undefined || (d instanceof Date && d.getTime() > Date.now()), {
					message: 'Expiry must be in the future',
				}),
		)
		.optional(),
	confirmEmail: confirmEmailSchema,
});

/** Unban the target user. Simple modal -- typed gate per spec decision (c). */
export const UnbanUserInputSchema = z.object({
	targetUserId: userIdSchema,
});

/** Revoke a single named session for the target user. */
export const RevokeUserSessionInputSchema = z.object({
	targetUserId: userIdSchema,
	sessionId: z.string().trim().min(1, 'Session id is required'),
	confirmEmail: confirmEmailSchema,
});

/** Revoke every session for the target user. */
export const RevokeAllUserSessionsInputSchema = z.object({
	targetUserId: userIdSchema,
	confirmEmail: confirmEmailSchema,
});

export type SetUserRoleFormInput = z.infer<typeof SetUserRoleInputSchema>;
export type BanUserFormInput = z.infer<typeof BanUserInputSchema>;
export type UnbanUserFormInput = z.infer<typeof UnbanUserInputSchema>;
export type RevokeUserSessionFormInput = z.infer<typeof RevokeUserSessionInputSchema>;
export type RevokeAllUserSessionsFormInput = z.infer<typeof RevokeAllUserSessionsInputSchema>;
