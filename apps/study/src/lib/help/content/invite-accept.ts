/**
 * Invite-acceptance help page (the public /invite/[token] surface).
 *
 * Lands as Phase 8 of `docs/work-packages/hangar-invite-flow/spec.md`.
 * Thin -- the recipient is mostly there to set a password and click
 * "Accept invite". The page exists so the help search palette returns
 * something coherent if the recipient looks for "what is this email?".
 */

import { APP_SURFACES, HELP_KINDS } from '@ab/constants';
import type { HelpPageIndex } from '@ab/help';

export const inviteAcceptIndex: HelpPageIndex = {
	id: 'invite-accept',
	title: 'Accepting an invitation',
	summary: 'What to expect on the airboss invite-accept page.',
	tags: {
		appSurface: [APP_SURFACES.GLOBAL],
		helpKind: HELP_KINDS.REFERENCE,
		keywords: ['invite', 'invitation', 'sign-up', 'accept', 'token', 'onboard'],
	},
	sections: [
		{ id: 'what-this-is', title: 'What this page is' },
		{ id: 'expiry', title: 'How long the link is good for' },
		{ id: 'already-signed-in', title: 'If you are already signed in' },
		{ id: 'after-accept', title: 'What happens when you accept' },
	],
	searchHaystack:
		"what to expect on the airboss invite-accept page. you landed here from an invitation email. the link contains a one-shot token that ties this signup to the email an admin invited you with. pick a password, confirm it, and you'll be signed in.\n\nthe email field is read-only -- the invitation is bound to that specific recipient. if you need to use a different email, ask the admin who invited you to send a fresh invite to the new address. invitations expire 7 days after they're sent. the bottom of the accept page tells you how much time is left. if your link has expired, the page will show \"invitation not found\" -- contact the admin who invited you and ask them to resend. if you click an invite link while signed in to a different airboss account, you'll see a banner explaining that accepting will sign you out and create a new account for the invited email. your original account is unaffected -- you can sign back into it from /login. the platform creates your user account, signs you in, and sends you to the dashboard at /dashboard. the role on your account is whatever the admin chose when they invited you (learner, author, or operator). admin promotion is a separate step that happens after accept. invite invitation sign-up accept token onboard",
	documents: '/invite/:token',
	related: [],
	reviewedAt: '2026-05-02',
};
