/**
 * Body markdown for help page `invite-accept`.
 *
 * Hand-edit this file -- the body is the source of truth. Run
 * `bun scripts/help/split-content.ts` to re-sync the matching index
 * file (precomputed search haystack) after editing a body.
 */

import type { HelpPageBody } from '@ab/help';

export const inviteAcceptBody: HelpPageBody = {
	id: 'invite-accept',
	sections: [
		{
			id: 'what-this-is',
			title: 'What this page is',
			body: `You landed here from an invitation email. The link contains a one-shot token that ties this signup to the email an admin invited you with. Pick a password, confirm it, and you'll be signed in.

The email field is read-only -- the invitation is bound to that specific recipient. If you need to use a different email, ask the admin who invited you to send a fresh invite to the new address.`,
		},
		{
			id: 'expiry',
			title: 'How long the link is good for',
			body: `Invitations expire 7 days after they're sent. The bottom of the accept page tells you how much time is left. If your link has expired, the page will show "Invitation not found" -- contact the admin who invited you and ask them to resend.`,
		},
		{
			id: 'already-signed-in',
			title: 'If you are already signed in',
			body: `If you click an invite link while signed in to a different airboss account, you'll see a banner explaining that accepting will sign you out and create a new account for the invited email. Your original account is unaffected -- you can sign back into it from /login.`,
		},
		{
			id: 'after-accept',
			title: 'What happens when you accept',
			body: `The platform creates your user account, signs you in, and sends you to the dashboard at /dashboard. The role on your account is whatever the admin chose when they invited you (learner, author, or operator). Admin promotion is a separate step that happens after accept.`,
		},
	],
};
