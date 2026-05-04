/**
 * Invitation flow help page (the /users/invitations + /users/invitations/[id]
 * admin surfaces). Lands as Phase 8 of
 * `docs/work-packages/hangar-invite-flow/spec.md`.
 */

import { APP_SURFACES, HELP_KINDS } from '@ab/constants';
import type { HelpPageIndex } from '@ab/help';

export const invitationsIndex: HelpPageIndex = {
	id: 'users-invitations',
	title: 'Invite a user',
	summary: 'Send a one-shot invite link to a new user; revoke or resend pending invites.',
	tags: {
		appSurface: [APP_SURFACES.HANGAR],
		helpKind: HELP_KINDS.REFERENCE,
		keywords: ['invite', 'invitation', 'onboard', 'signup', 'sign-up', 'token', 'email', 'admin'],
	},
	sections: [
		{ id: 'overview', title: 'What this surface does' },
		{ id: 'create', title: 'Sending an invitation' },
		{ id: 'revoke', title: 'Revoking a pending invitation' },
		{ id: 'resend', title: 'Resending an invitation' },
		{ id: 'admin-grants', title: 'Why invites cannot grant admin' },
		{ id: 'audit', title: 'Audit trail' },
	],
	searchHaystack:
		"send a one-shot invite link to a new user; revoke or resend pending invites. invitations are how you onboard a new user without sharing a password. you enter the recipient's email and pick a role; the platform sends a one-shot link that lands on study's accept page; the recipient picks their own password; the new account is created with the role you chose.\n\nthis is the only path to a new user account today (public sign-up is disabled by design). click **invite user**, enter the recipient's email, and pick the role they should land in. click **send invite**.\n\nthe system:\n\n1. validates the email isn't already a user (duplicate accounts get redirected to /users/[id] for a role change).\n2. checks no pending invite already exists for that email.\n3. generates a 32-byte random token and inserts the row + the email send in one transaction. if the email transport fails the row rolls back and you get a clear error.\n4. audits the create with `metadata.subkind = create`.\n\nthe invite link is good for 7 days. the recipient sees a single-purpose page with their email pre-filled (read-only) and a password field. open the invitation detail page (any row in the pending tab links there), click **revoke**, and type the recipient's email exactly to confirm. the link becomes un-redeemable on the next click.\n\nuse revoke when:\n\n- you sent it to the wrong recipient.\n- the recipient quit / declined / changed roles before accepting.\n- you need to invalidate a leaked link.\n\na revoked invitation can't be un-revoked. send a fresh invite if needed. resend regenerates the token (the old link stops working) and re-emails the recipient. use resend when:\n\n- the recipient lost the email.\n- the link is about to expire and you want to give them another week.\n\nno typed-confirmation gate -- resend is recoverable. the audit row records both the old and new token suffixes (the last 8 chars; the full token is never logged). by design, invites can target `learner`, `author`, or `operator` -- never `admin`. to grant admin:\n\n1. invite the user as `operator`.\n2. after they accept, navigate to /users/[id] and use the role picker to promote them. that picker has the last-admin guard; the invite flow does not.\n\nthis means an admin grant always passes through the explicit promotion bar, with the existing audit shape and the same scrutiny. every invitation operation emits a row to `audit.audit_log`:\n\n- **create** -- targetid = invitation id, before = null, after = invitation snapshot, metadata.subkind = create.\n- **revoke** -- targetid = invitation id, before = pending snapshot, after = revoked snapshot, metadata.subkind = revoke.\n- **resend** -- targetid = invitation id, metadata carries old + new token suffix, metadata.subkind = resend.\n- **accept** -- actorid = the new user id, targetid = invitation id, metadata carries accepteduserid + acceptedrole, metadata.subkind = accept.\n\nfilter by `targettype = hangar.invitation` in the audit explorer (/admin/audit) to see the full history. invite invitation onboard signup sign-up token email admin",
	documents: '/users/invitations',
	reviewedAt: '2026-05-02',
};
