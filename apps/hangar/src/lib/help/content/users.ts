/**
 * User editing help page (the dynamic /users/[id] surface).
 *
 * Lands as part of `docs/work-packages/hangar-users-editing/spec.md`
 * Phase 7 -- the page covers the role picker, ban / unban flow, single
 * + bulk session revoke, the typed-confirmation gate, and the audit
 * trail every write emits.
 */

import { APP_SURFACES, HELP_KINDS } from '@ab/constants';
import type { HelpPage } from '@ab/help';

export const users: HelpPage = {
	id: 'users-detail',
	title: 'User editing',
	summary: 'Change roles, ban / unban, and revoke sessions for a single user from /users/[id].',
	documents: '/users/:id',
	tags: {
		appSurface: [APP_SURFACES.HANGAR],
		helpKind: HELP_KINDS.REFERENCE,
		keywords: ['users', 'role', 'ban', 'unban', 'revoke', 'session', 'admin', 'better-auth'],
	},
	related: [],
	reviewedAt: '2026-04-30',
	sections: [
		{
			id: 'what-this-surface-does',
			title: 'What this surface does',
			body: `\`/users/[id]\` is the single-user admin write surface. From it you can:

- **Change role** between \`learner\` / \`author\` / \`operator\` / \`admin\`.
- **Ban or unban** the user -- ban blocks sign-in via better-auth's admin plugin until you unban or the optional expiry passes.
- **Revoke a single session** to kick a stale device without disrupting the user's other sessions.
- **Revoke all sessions** when you need to force every active device to re-authenticate (security incident, leaked credential, etc.).

ADMIN-only. Form actions verify the role per request -- form-action POSTs do not walk the layout-level gate, so each action re-checks. Every write emits a row to the audit log; the recent-audit table at the bottom of the page reflects writes against this user, and the [Audit explorer](#related-surfaces) is the cross-cutting read surface.`,
		},
		{
			id: 'role-changes',
			title: 'Changing roles',
			body: `The role picker is the simplest action: pick the new role, hit **Save role**. No confirmation modal -- role is a recoverable change (set it back if wrong), and demanding a typed gate would slow down a frequent operation.

Two guardrails apply server-side:

- **Self role-change is blocked.** You cannot demote (or promote) yourself. Trying it returns "Cannot change your own role." The single-admin foot-gun is too sharp; if you ever need it, sign in as a sibling admin.
- **Last-admin demotion is blocked.** If demoting this user would leave zero admins in the system, the action fails with "Cannot leave the platform without an admin." The BC walks \`countUsersByRole\` before the better-auth call.

The audit row carries \`{ before: { role: oldRole }, after: { role: newRole } }\`, with \`metadata.subKind = 'role-assign'\`.`,
		},
		{
			id: 'ban-and-unban',
			title: 'Banning and unbanning',
			body: `**Ban** opens a modal that requires:

- A short reason (1-500 chars). Lands in \`bauth_user.banReason\`.
- An optional expiry. Leave blank for a permanent ban; pick a date / time and better-auth's admin plugin lifts the ban automatically at the next sign-in attempt past that point.
- Typing the user's email exactly to confirm. The Confirm button stays disabled until the typed string matches.

The server re-verifies the typed email against the target row before calling better-auth, so a typo on a stale page can't accidentally ban the wrong user.

**Unban** is the safe direction: a single confirmation modal (no typed gate per spec decision (c)). Sets \`banned = false\` and clears the reason / expiry.

Banning does not invalidate existing sessions on its own -- a banned user stays signed in until their cookie cache expires (5 minutes) or they sign out. Pair a ban with **Revoke all sessions** if the situation is security-critical.

Self-ban is blocked. Last-admin guard does not apply here -- you can ban a non-admin freely.`,
		},
		{
			id: 'session-revoke',
			title: 'Revoking sessions',
			body: `**Revoke a single session** kicks one device. Use this to clear a stale browser tab or a session that's outlived its usefulness without affecting the user's other devices.

**Revoke all sessions** kicks every device. The modal shows the count and requires the typed-email gate. If your own session is in the revoked set (i.e. you're revoking yourself), the form action redirects you to \`/login\` after the call returns.

Revoke is fire-and-forget on better-auth's side -- the admin plugin's \`revokeUserSessions\` returns \`{ success: true }\` without a count. The BC reads the session list before the call so the audit row carries an accurate \`metadata.revokedCount\`.

Self-revoke is allowed (single + bulk). It's a useful "kill stale device" affordance even for the active admin.`,
		},
		{
			id: 'audit-emission',
			title: 'Audit trail',
			body: `Every write emits exactly one row to \`audit.audit_log\`:

| Op                  | \`op\`     | \`metadata.subKind\`   | Before / After                                     |
| ------------------- | --------- | --------------------- | -------------------------------------------------- |
| Set role            | \`update\` | \`role-assign\`         | \`{ role: oldRole }\` -> \`{ role: newRole }\`       |
| Ban                 | \`update\` | \`ban\`                 | \`{ banned, banReason, banExpires }\` (before/after) |
| Unban               | \`update\` | \`unban\`               | \`{ banned: true, ... }\` -> \`{ banned: false }\`   |
| Revoke one session  | \`action\` | \`session-revoke\`      | null / null (the session id is in metadata)        |
| Revoke all sessions | \`action\` | \`session-revoke-all\`  | null / null (count is in metadata.revokedCount)    |

\`metadata\` always carries \`requestId\`, \`userAgent\`, and the calling admin's email. The audit row is written **after** the better-auth call returns successfully -- a thrown admin-plugin error means no audit row.

Filter the [Audit explorer](#related-surfaces) by \`targetType = hangar.user\` to scan all five op kinds together, or by \`metadata.subKind\` for a single op type.`,
		},
		{
			id: 'related-surfaces',
			title: 'Related surfaces',
			body: `- **/users** -- the directory list. Use it to find the user you want to edit.
- **/admin/audit** -- the read surface for every audit row. Filter by actor (you), target type (\`hangar.user\`), or target id (this user's id) to see the trail of admin writes.
- **better-auth admin plugin** -- the underlying API. The BC layer (\`libs/bc/hangar/src/user-writes.ts\`) wraps it with airboss-specific guards (self-target, last-admin, audit emission).`,
		},
	],
};
