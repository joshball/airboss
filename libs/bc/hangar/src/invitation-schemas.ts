/**
 * Zod schemas for the invitation form actions
 * (`?/createInvitation`, `?/revokeInvitation`, `?/resendInvitation`,
 * `?/accept` on the study side).
 *
 * Mirrors the conventions in `user-write-schemas.ts`: a schema per action,
 * fed raw `FormData` entries from the page-server form action so the BC
 * layer receives a typed payload.
 *
 * Validates form-level shape only; the business guards (existing-email
 * collision, role gate, expiry recheck, token validity) live in
 * `invitations.ts`.
 *
 * See `docs/work-packages/hangar-invite-flow/spec.md` (Phase 3 in
 * `tasks.md`).
 */

import { MIN_PASSWORD_LENGTH, ROLE_VALUES, ROLES, type Role } from '@ab/constants';
import { z } from 'zod';

/**
 * Roles an invite may target. Decision (e) in the spec: invites cannot
 * grant `admin` -- the existing role picker on `/users/[id]` is the path
 * for admin promotion (it has the last-admin guard and the existing
 * audit shape). Excluding `admin` here means the create form's `<select>`
 * options stay tight and the server-side parse rejects a forged
 * `proposedRole=admin` payload.
 */
export const INVITABLE_ROLE_VALUES: readonly Role[] = ROLE_VALUES.filter((r) => r !== ROLES.ADMIN);

/** Lowercased + trimmed email. The DB unique partial index relies on the
 * lowercased value being canonical. */
const emailSchema = z
	.string()
	.trim()
	.toLowerCase()
	.min(3, 'Email is required')
	.max(254, 'Email is too long')
	.email('Enter a valid email address');

const invitationIdSchema = z.string().trim().min(1, 'Invitation id is required');

const tokenSchema = z.string().trim().min(1, 'Token is required');

const confirmEmailSchema = z.string().trim().min(1, 'Type the recipient email to confirm');

const passwordSchema = z
	.string()
	.min(MIN_PASSWORD_LENGTH, `Password must be at least ${MIN_PASSWORD_LENGTH} characters`)
	.max(256, 'Password is too long');

/** Create a new invitation. No typed-confirmation gate -- creation is
 * recoverable (revoke if wrong recipient). */
export const CreateInvitationInputSchema = z.object({
	email: emailSchema,
	proposedRole: z.enum(INVITABLE_ROLE_VALUES as unknown as [string, ...string[]]),
});

/** Revoke a pending invitation. Typed-email gate (decision (c) precedent
 * in users-editing -- destructive ops require typed confirmation). */
export const RevokeInvitationInputSchema = z.object({
	invitationId: invitationIdSchema,
	confirmEmail: confirmEmailSchema,
});

/** Re-send a pending invitation. No typed gate -- resend is recoverable
 * (it issues a fresh token; the old one becomes invalid). */
export const ResendInvitationInputSchema = z.object({
	invitationId: invitationIdSchema,
});

/** Recipient redeems the invitation -- token + new password. */
export const AcceptInvitationInputSchema = z.object({
	token: tokenSchema,
	password: passwordSchema,
});

export type CreateInvitationFormInput = z.infer<typeof CreateInvitationInputSchema>;
export type RevokeInvitationFormInput = z.infer<typeof RevokeInvitationInputSchema>;
export type ResendInvitationFormInput = z.infer<typeof ResendInvitationInputSchema>;
export type AcceptInvitationFormInput = z.infer<typeof AcceptInvitationInputSchema>;
