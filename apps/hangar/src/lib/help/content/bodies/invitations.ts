/**
 * Body markdown for help page `users-invitations`.
 *
 * Hand-edit this file -- the body is the source of truth. Run
 * `bun scripts/help/split-content.ts` to re-sync the matching index
 * file (precomputed search haystack) after editing a body.
 */

import type { HelpPageBody } from '@ab/help';

export const invitationsBody: HelpPageBody = {
	id: 'users-invitations',
	sections: [
		{
			id: 'overview',
			title: 'What this surface does',
			body: `Invitations are how you onboard a new user without sharing a password. You enter the recipient's email and pick a role; the platform sends a one-shot link that lands on study's accept page; the recipient picks their own password; the new account is created with the role you chose.

This is the only path to a new user account today (public sign-up is disabled by design).`,
		},
		{
			id: 'create',
			title: 'Sending an invitation',
			body: `Click **Invite user**, enter the recipient's email, and pick the role they should land in. Click **Send invite**.

The system:

1. Validates the email isn't already a user (duplicate accounts get redirected to /users/[id] for a role change).
2. Checks no pending invite already exists for that email.
3. Generates a 32-byte random token and inserts the row + the email send in one transaction. If the email transport fails the row rolls back and you get a clear error.
4. Audits the create with \`metadata.subKind = create\`.

The invite link is good for 7 days. The recipient sees a single-purpose page with their email pre-filled (read-only) and a password field.`,
		},
		{
			id: 'revoke',
			title: 'Revoking a pending invitation',
			body: `Open the invitation detail page (any row in the Pending tab links there), click **Revoke**, and type the recipient's email exactly to confirm. The link becomes un-redeemable on the next click.

Use revoke when:

- You sent it to the wrong recipient.
- The recipient quit / declined / changed roles before accepting.
- You need to invalidate a leaked link.

A revoked invitation can't be un-revoked. Send a fresh invite if needed.`,
		},
		{
			id: 'resend',
			title: 'Resending an invitation',
			body: `Resend regenerates the token (the old link stops working) and re-emails the recipient. Use resend when:

- The recipient lost the email.
- The link is about to expire and you want to give them another week.

No typed-confirmation gate -- resend is recoverable. The audit row records both the old and new token suffixes (the last 8 chars; the full token is never logged).`,
		},
		{
			id: 'admin-grants',
			title: 'Why invites cannot grant admin',
			body: `By design, invites can target \`learner\`, \`author\`, or \`operator\` -- never \`admin\`. To grant admin:

1. Invite the user as \`operator\`.
2. After they accept, navigate to /users/[id] and use the role picker to promote them. That picker has the last-admin guard; the invite flow does not.

This means an admin grant always passes through the explicit promotion bar, with the existing audit shape and the same scrutiny.`,
		},
		{
			id: 'audit',
			title: 'Audit trail',
			body: `Every invitation operation emits a row to \`audit.audit_log\`:

- **create** -- targetId = invitation id, before = null, after = invitation snapshot, metadata.subKind = create.
- **revoke** -- targetId = invitation id, before = pending snapshot, after = revoked snapshot, metadata.subKind = revoke.
- **resend** -- targetId = invitation id, metadata carries old + new token suffix, metadata.subKind = resend.
- **accept** -- actorId = the new user id, targetId = invitation id, metadata carries acceptedUserId + acceptedRole, metadata.subKind = accept.

Filter by \`targetType = hangar.invitation\` in the audit explorer (/admin/audit) to see the full history.`,
		},
	],
};
