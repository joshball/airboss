/**
 * User editing help page (the dynamic /users/[id] surface).
 *
 * Lands as part of `docs/work-packages/hangar-users-editing/spec.md`
 * Phase 7 -- the page covers the role picker, ban / unban flow, single
 * + bulk session revoke, the typed-confirmation gate, and the audit
 * trail every write emits.
 */

import { APP_SURFACES, HELP_KINDS } from '@ab/constants';
import type { HelpPageIndex } from '@ab/help';

export const usersIndex: HelpPageIndex = {
	id: 'users-detail',
	title: 'User editing',
	summary: 'Change roles, ban / unban, and revoke sessions for a single user from /users/[id].',
	tags: {
		appSurface: [APP_SURFACES.HANGAR],
		helpKind: HELP_KINDS.REFERENCE,
		keywords: ['users', 'role', 'ban', 'unban', 'revoke', 'session', 'admin', 'better-auth'],
	},
	sections: [
		{ id: 'what-this-surface-does', title: 'What this surface does' },
		{ id: 'role-changes', title: 'Changing roles' },
		{ id: 'ban-and-unban', title: 'Banning and unbanning' },
		{ id: 'session-revoke', title: 'Revoking sessions' },
		{ id: 'audit-emission', title: 'Audit trail' },
		{ id: 'related-surfaces', title: 'Related surfaces' },
	],
	searchHaystack:
		"change roles, ban / unban, and revoke sessions for a single user from /users/[id]. `/users/[id]` is the single-user admin write surface. from it you can:\n\n- **change role** between `learner` / `author` / `operator` / `admin`.\n- **ban or unban** the user -- ban blocks sign-in via better-auth's admin plugin until you unban or the optional expiry passes.\n- **revoke a single session** to kick a stale device without disrupting the user's other sessions.\n- **revoke all sessions** when you need to force every active device to re-authenticate (security incident, leaked credential, etc.).\n\nadmin-only. form actions verify the role per request -- form-action posts do not walk the layout-level gate, so each action re-checks. every write emits a row to the audit log; the recent-audit table at the bottom of the page reflects writes against this user, and the [audit explorer](#related-surfaces) is the cross-cutting read surface. the role picker is the simplest action: pick the new role, hit **save role**. no confirmation modal -- role is a recoverable change (set it back if wrong), and demanding a typed gate would slow down a frequent operation.\n\ntwo guardrails apply server-side:\n\n- **self role-change is blocked.** you cannot demote (or promote) yourself. trying it returns \"cannot change your own role.\" the single-admin foot-gun is too sharp; if you ever need it, sign in as a sibling admin.\n- **last-admin demotion is blocked.** if demoting this user would leave zero admins in the system, the action fails with \"cannot leave the platform without an admin.\" the bc walks `countusersbyrole` before the better-auth call.\n\nthe audit row carries `{ before: { role: oldrole }, after: { role: newrole } }`, with `metadata.subkind = 'role-assign'`. **ban** opens a modal that requires:\n\n- a short reason (1-500 chars). lands in `bauth_user.banreason`.\n- an optional expiry. leave blank for a permanent ban; pick a date / time and better-auth's admin plugin lifts the ban automatically at the next sign-in attempt past that point.\n- typing the user's email exactly to confirm. the confirm button stays disabled until the typed string matches.\n\nthe server re-verifies the typed email against the target row before calling better-auth, so a typo on a stale page can't accidentally ban the wrong user.\n\n**unban** is the safe direction: a single confirmation modal (no typed gate per spec decision (c)). sets `banned = false` and clears the reason / expiry.\n\nbanning does not invalidate existing sessions on its own -- a banned user stays signed in until their cookie cache expires (5 minutes) or they sign out. pair a ban with **revoke all sessions** if the situation is security-critical.\n\nself-ban is blocked. last-admin guard does not apply here -- you can ban a non-admin freely. **revoke a single session** kicks one device. use this to clear a stale browser tab or a session that's outlived its usefulness without affecting the user's other devices.\n\n**revoke all sessions** kicks every device. the modal shows the count and requires the typed-email gate. if your own session is in the revoked set (i.e. you're revoking yourself), the form action redirects you to `/login` after the call returns.\n\nrevoke is fire-and-forget on better-auth's side -- the admin plugin's `revokeusersessions` returns `{ success: true }` without a count. the bc reads the session list before the call so the audit row carries an accurate `metadata.revokedcount`.\n\nself-revoke is allowed (single + bulk). it's a useful \"kill stale device\" affordance even for the active admin. every write emits exactly one row to `audit.audit_log`:\n\n| op                  | `op`     | `metadata.subkind`   | before / after                                     |\n| ------------------- | --------- | --------------------- | -------------------------------------------------- |\n| set role            | `update` | `role-assign`         | `{ role: oldrole }` -> `{ role: newrole }`       |\n| ban                 | `update` | `ban`                 | `{ banned, banreason, banexpires }` (before/after) |\n| unban               | `update` | `unban`               | `{ banned: true, ... }` -> `{ banned: false }`   |\n| revoke one session  | `action` | `session-revoke`      | null / null (the session id is in metadata)        |\n| revoke all sessions | `action` | `session-revoke-all`  | null / null (count is in metadata.revokedcount)    |\n\n`metadata` always carries `requestid`, `useragent`, and the calling admin's email. the audit row is written **after** the better-auth call returns successfully -- a thrown admin-plugin error means no audit row.\n\nfilter the [audit explorer](#related-surfaces) by `targettype = hangar.user` to scan all five op kinds together, or by `metadata.subkind` for a single op type. - **/users** -- the directory list. use it to find the user you want to edit.\n- **/admin/audit** -- the read surface for every audit row. filter by actor (you), target type (`hangar.user`), or target id (this user's id) to see the trail of admin writes.\n- **better-auth admin plugin** -- the underlying api. the bc layer (`libs/bc/hangar/src/user-writes.ts`) wraps it with airboss-specific guards (self-target, last-admin, audit emission). users role ban unban revoke session admin better-auth",
	documents: '/users/:id',
	reviewedAt: '2026-04-30',
};
