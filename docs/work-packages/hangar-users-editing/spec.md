---
title: 'Spec: Hangar Users Editing'
product: hangar
feature: hangar-users-editing
type: spec
status: unread
review_status: pending
---

# Spec: Hangar Users Editing

The hangar `/users` directory is read-only today (PR #226). This WP turns it into the first admin-write surface in hangar by adding three operations against `bauth_user`: role assignment, ban/unban, and session revoke. Every write emits an audit row tagged with the actor (current admin) and the target user. Dangerous actions (ban, session revoke) sit behind a confirmation gate.

This WP is small in surface and load-bearing in pattern. It is the **first** admin-write surface hangar ships, and it sets the dual-gate pattern (per-page auth + audit emission + confirmation UX) that every later admin-write surface in hangar will copy. Get the shape right here.

## Why this WP exists

The read-only directory shipped in PR #226 (extracted into `libs/bc/hangar/src/users.ts` by the `extract-hangar-bc` WP) intentionally deferred mutations. The deferred work is:

- **Role assignment.** A new contributor lands in the system with `role=learner` (better-auth default). Promoting them to `author` or `operator` to author content, and demoting if needed, has to be a hangar surface; nothing else writes to `bauth_user.role`.
- **Ban/unban.** A misbehaving user (spam, abuse) needs to be banned. Better-auth's admin plugin maintains `bauth_user.banned`, `bauth_user.banReason`, `bauth_user.banExpires`; the gate that prevents the user from logging in is enforced by better-auth at sign-in time when `banned=true`.
- **Session revoke.** A leaked credential, a shared device, a security incident -- any of these requires forcing the target's existing sessions to invalidate. The admin plugin exposes `revokeUserSession` (single session) and `revokeUserSessions` (all sessions). Cookie-cache TTL is 5 minutes (per `createAuth` in `libs/auth/src/server.ts`), so revocation propagates within that window even if the cookie cache is warm on a request edge.

Three writes; one surface. Plus the audit + confirmation contract that future admin-write surfaces will follow.

## Anchors

- [Better Auth admin plugin endpoints](../../../node_modules/better-auth/dist/plugins/admin/admin.d.mts) -- `setRole`, `banUser`, `unbanUser`, `listUserSessions`, `revokeUserSession`, `revokeUserSessions`, `removeUser`. Mounted under `/api/auth/admin/*`. We do not call HTTP; we call `auth.api.setRole({ body, headers })` etc. directly the same way `apps/hangar/src/routes/logout/+page.server.ts` calls the sign-out handler.
- `apps/hangar/src/routes/(app)/users/+page.server.ts` -- existing read-only list load. Still works after this WP; the list page gains no actions.
- `apps/hangar/src/routes/(app)/users/[id]/+page.server.ts` -- existing read-only detail load. Gains the form actions in this WP.
- `apps/hangar/src/routes/(app)/users/[id]/+page.svelte` -- existing detail page. Gains role picker, ban toggle, "revoke this session" buttons in the sessions table, "revoke all sessions" button, and the confirmation modal.
- `libs/bc/hangar/src/users.ts:1-247` -- existing read queries (`listUsers`, `getUser`, `listRecentUserSessions`, `listRecentUserAudits`). New write helpers added in a sibling module per [Open Question (e)](#e-bc-write-module-location).
- `libs/auth/src/auth.ts:79-86` -- `requireRole`. Used by every load + every form action. Per the dual-gate auth contract.
- `libs/auth/src/server.ts:106-130` -- session cookie-cache config; `maxAge: 5 * 60`. Constrains the upper bound on how long a revoked session can ride the cache before the BC re-validates.
- `libs/auth/src/schema.ts:13-28` -- `bauthUser` columns include `role`, `banned`, `banReason`, `banExpires`.
- `libs/audit/src/log.ts:17-43` -- `auditWrite`. Single insert, accepts `actorId`, `op`, `targetType`, `targetId`, `before`, `after`, `metadata`. Already proven end-to-end by the audit-ping flow.
- `libs/constants/src/audit.ts:12-39` -- `AUDIT_TARGETS`. We add `HANGAR_USER` (`hangar.user`) here and a small set of action-flavour kinds for the ops; see [Open Question (a)](#a-audit-target-and-op-shape).
- `libs/constants/src/roles.ts` -- `ROLES`, `ROLE_VALUES`, `ROLE_LABELS`. The picker populates from `ROLE_VALUES`.
- `apps/hangar/src/routes/(app)/admin/audit-ping/+page.server.ts` -- canonical example of `requireRole(ADMIN) -> form action -> auditWrite -> read-back via auditRecent`. The shape this WP repeats four times (set-role, ban, unban, revoke).
- [`hangar-non-textual` spec](../hangar-non-textual/spec.md) -- closest sibling that already runs admin writes through `auditWrite`, gives a precedent for `before/after` snapshots.
- [`extract-hangar-bc` spec](../extract-hangar-bc/spec.md) -- the WP that extracted `libs/bc/hangar/src/users.ts`. New write helpers land in the same lib.

## In Scope

1. **BC write helpers under `libs/bc/hangar/src/user-writes.ts`** ([Open Question (e)](#e-bc-write-module-location); recommended new file rather than swelling `users.ts`):
   - `setUserRole(input: { actorId, targetUserId, newRole, headers }, db?) -> { user: UserDirectoryRow }` -- delegates to `auth.api.setRole`, then re-reads the user via `getUser`, then `auditWrite` with `before` / `after` snapshots.
   - `banUserAction(input: { actorId, targetUserId, reason, expiresAt?, headers }, db?) -> { user: UserDirectoryRow }` -- delegates to `auth.api.banUser`, re-reads, audits.
   - `unbanUserAction(input: { actorId, targetUserId, headers }, db?) -> { user: UserDirectoryRow }` -- delegates to `auth.api.unbanUser`, re-reads, audits.
   - `revokeUserSession(input: { actorId, targetUserId, sessionId, headers }, db?) -> { revokedSessionId: string }` -- delegates to `auth.api.revokeUserSession`, audits the action.
   - `revokeAllUserSessions(input: { actorId, targetUserId, headers }, db?) -> { revokedCount: number }` -- delegates to `auth.api.revokeUserSessions`, audits with the count in `metadata`.

   Each helper accepts the calling request's `headers` so better-auth can authorize the admin plugin call; this is how the admin plugin verifies the caller is an admin (it has its own session walk). We pass the headers untouched. The helpers emit audit rows in the same transaction as any DB-side bookkeeping; better-auth's writes are not in the transaction (the admin plugin writes through its own adapter), so the audit row is inserted **after** the admin plugin call returns successfully -- if the admin call throws, no audit row.

2. **Form actions on `/users/[id]/+page.server.ts`** -- the detail page gains an `actions` export with the four/five named actions. Each action:
   - Calls `requireRole(event, ROLES.ADMIN)` first. Per-page gate, even though `(app)/+layout.server.ts` already gates -- form-action POSTs do not walk the layout per the dual-gate contract in `libs/auth/src/auth.ts`.
   - Validates form input with a Zod schema in `libs/bc/hangar/src/user-write-schemas.ts` (sibling to existing `form-schemas.ts`). Returns `fail(400, { error })` on invalid input.
   - Forwards `event.request.headers` into the BC helper. Better-auth uses them.
   - On success returns `{ ok: true, op: 'set-role' | 'ban' | 'unban' | 'revoke-session' | 'revoke-all-sessions' }` so the page can render a success toast.
   - On the admin plugin throwing (forbidden, target-not-found, ...), surfaces `fail(409, { error: err.message })`.

   Form action ids:
   - `?/setRole`
   - `?/ban`
   - `?/unban`
   - `?/revokeSession`
   - `?/revokeAllSessions`

   Constants live in `ROUTES` (no inline strings); see "Routes" below.

3. **Role-edit UI on `/users/[id]/+page.svelte`** -- a `<form method="post" action="?/setRole">` with a `<select>` populated from `ROLE_VALUES` and a "Save" button. Disabled when the chosen role equals the current role. Shows current role in the select's default value. No confirmation gate -- role change is recoverable and not destructive ([Open Question (b)](#b-confirmation-gate-on-role-change)).

4. **Ban / unban UI** -- a single button:
   - When `data.user.banned === false`: renders "Ban user" button. Clicking opens the confirmation modal. Modal has a required `reason` textarea + optional `expiresAt` input + a typed-confirmation gate (the admin types the user's email to confirm; see [Open Question (c)](#c-confirmation-gate-style)). Submit hits `?/ban`.
   - When `data.user.banned === true`: renders "Unban user" button. Clicking opens a smaller confirmation modal (no typed gate -- unban is the safe direction). Submit hits `?/unban`.

5. **Session revoke UI** -- the existing sessions table gains a "Revoke" column with a button per row. Clicking opens the confirmation modal (typed-confirmation gate). Submit hits `?/revokeSession` with the session id. Above the table, a "Revoke all sessions" button (typed-confirmation gate, count in the modal copy) hits `?/revokeAllSessions`. After revoke, the page reloads the load function, sessions list shrinks accordingly.

6. **Confirmation modal component** -- `libs/ui/src/components/ConfirmAction.svelte`. Snippet-based ([Open Question (d)](#d-modal-component-location-and-shape)). Props: `open`, `title`, `body` snippet, `confirmText`, `dangerLevel: 'caution' | 'danger'`, optional `typedConfirmation: { label: string; expected: string }`. Emits `cancel` / `confirm` events. Wraps a SvelteKit `<form>` so the action button is the form's submit and posts the form when the typed confirmation matches `expected`. The component lives in `libs/ui/` because the dual-gate pattern (audit + confirmation) will be reused on every future admin-write surface (sources delete, references delete, jobs cancel, future sim flag-overrides, ...).

7. **AUDIT_TARGETS additions** -- `HANGAR_USER` (`hangar.user`) added to `libs/constants/src/audit.ts`. The five operations all share `targetType = HANGAR_USER`; the operation kind is captured by `op` + `metadata.subKind` ([Open Question (a)](#a-audit-target-and-op-shape)).

8. **Audit-emission contract for each op:**

   | Op                  | `op`                  | `targetId`        | `before` snapshot                   | `after` snapshot                              | `metadata.subKind`        |
   | ------------------- | --------------------- | ----------------- | ----------------------------------- | --------------------------------------------- | ------------------------- |
   | Set role            | `AUDIT_OPS.UPDATE`    | target user id    | `{ role: oldRole }`                 | `{ role: newRole }`                           | `'role-assign'`           |
   | Ban                 | `AUDIT_OPS.UPDATE`    | target user id    | `{ banned, banReason, banExpires }` | `{ banned: true, banReason, banExpires }`     | `'ban'`                   |
   | Unban               | `AUDIT_OPS.UPDATE`    | target user id    | `{ banned: true, ... }`             | `{ banned: false, banReason: null, ... }`     | `'unban'`                 |
   | Revoke one session  | `AUDIT_OPS.ACTION`    | target user id    | `null`                              | `null`                                        | `'session-revoke'`        |
   | Revoke all sessions | `AUDIT_OPS.ACTION`    | target user id    | `null`                              | `null`                                        | `'session-revoke-all'`    |

   `metadata` always carries `requestId`, `userAgent`, the calling admin's email (denormalized for ease of reading), and op-specific extras: revoked-session-id for the single revoke; revoked count for the bulk revoke; ban reason + expiry for the ban (also in `after`, intentional duplication for query speed).

9. **Self-target guards.** Every action rejects when `targetUserId === actorId`:
   - Self role demotion is dangerous (admin demotes themselves out of admin and locks themselves out). Hard-blocked with `fail(409, { error: 'Cannot change your own role.' })`. ([Open Question (g)](#g-self-target-guards))
   - Self ban is absurd. Hard-blocked.
   - Self session-revoke (single) is allowed (you may want to revoke a stale device); just revokes the targeted row. Self revoke-all is allowed but blocks the current session, which means the next request 401s -- the form action's success response includes a redirect to `/login` when the current admin's session is among the revoked.
   - Last-admin guard: a role change that would leave zero admins in the system is hard-blocked. The BC walks `countUsersByRole` (existing) before the `auth.api.setRole` call.

10. **Routing constants.** New entries in `libs/constants/src/routes.ts`:

    ```typescript
    /** Form-action ids for the user-detail editing surface. */
    HANGAR_USER_SET_ROLE_ACTION: '?/setRole',
    HANGAR_USER_BAN_ACTION: '?/ban',
    HANGAR_USER_UNBAN_ACTION: '?/unban',
    HANGAR_USER_REVOKE_SESSION_ACTION: '?/revokeSession',
    HANGAR_USER_REVOKE_ALL_SESSIONS_ACTION: '?/revokeAllSessions',
    ```

    Page bindings reference these constants via `<form action={ROUTES.HANGAR_USER_SET_ROLE_ACTION} method="post">`.

11. **Tests.** Unit (Vitest) for each BC helper: happy path, admin-plugin throw, self-target rejection, last-admin guard. Integration test exercising the full form-action -> audit-row read-back path. E2E (Playwright) for the confirmation modal flow, the typed-confirmation gate, and the session-revoke-induced logout. Test plan details in `test-plan.md`.

12. **Documentation updates.** `docs/products/hangar/PRD.md` Backlog row "`/users` editing (role assignment, ban/unban, session revoke)" flips from "Not started" to "shipped" + linked to this WP.

## Out of Scope (explicit)

- **Invite flow.** Per the PRD backlog, the invite/onboard flow is a separate WP. This WP only edits already-existing users.
- **`removeUser` (account deletion).** Better-auth exposes it; we do not surface it. Account deletion is destructive enough to deserve its own WP with retention / GDPR considerations.
- **`impersonateUser`.** Better-auth's impersonation is powerful (and dangerous). Punted to its own WP behind an additional gate.
- **Editing `name`, `email`, `firstName`, `lastName`, `image`, `address`.** These are profile fields owned by the user, not by an admin. Admins shouldn't rewrite a user's name. If a name change is needed for moderation reasons, that's a separate moderation WP.
- **Bulk operations.** No "ban 50 users" or "set-role on a multi-select." Single-target only. Bulk is a future power-user surface; for v1 single-target is enough and avoids the foot-gun.
- **Per-app role policy.** All apps see the same `bauth_user.role`. Per-app roles (a user is `author` in study and `operator` in hangar) are a much bigger schema change.
- **Role audit timeline UI.** The audit page already shows the actor-scoped audit list at the bottom. A target-scoped timeline ("everything that happened TO this user") is a follow-on; the audit data is captured here and the follow-on consumes it.
- **Email notification to the banned user.** Better-auth doesn't auto-mail; we don't either. A "you have been banned" mail is a follow-on.
- **Pagination of the sessions list.** The detail page already shows the most recent N (`USER_DETAIL_SESSION_LIMIT = 10`); revoke-all covers the long tail.
- **An "ops dashboard" of recent admin actions.** The audit-ping page is the placeholder; a real recent-admin-actions tile is a follow-on.
- **Two-admin / dual-control gate** ("a ban requires a second admin to approve"). Not a v1 requirement -- single-admin platform today. If/when a second admin joins, this is the natural follow-on.

## Architecture overview

```text
┌─────────────────────────────────────────────────────────────────────────┐
│  Before this WP                                                         │
│    /users/[id] +page.server.ts                                          │
│      load: requireRole(ADMIN) -> read-only data                         │
│      no actions export                                                  │
│                                                                         │
│    libs/bc/hangar/src/users.ts                                          │
│      read-only: listUsers, getUser, listRecentUserSessions,             │
│                 listRecentUserAudits                                    │
└─────────────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────────────┐
│  After this WP                                                          │
│    /users/[id] +page.server.ts                                          │
│      load: requireRole(ADMIN) -> read-only data (unchanged)             │
│      actions:                                                           │
│        setRole         -> setUserRole          -> auth.api.setRole      │
│        ban             -> banUserAction        -> auth.api.banUser      │
│        unban           -> unbanUserAction      -> auth.api.unbanUser    │
│        revokeSession   -> revokeUserSession    -> auth.api.revokeSession│
│        revokeAllSessions -> revokeAllUserSessions -> auth.api.revoke*   │
│      every action: requireRole(ADMIN), forwards headers,                │
│                    auditWrite after success, fail(...) on error         │
│                                                                         │
│    libs/bc/hangar/src/user-writes.ts (new)                              │
│      setUserRole, banUserAction, unbanUserAction,                       │
│      revokeUserSession, revokeAllUserSessions                           │
│      each: pre-read snapshot -> better-auth admin call ->               │
│             post-read snapshot -> auditWrite                            │
│                                                                         │
│    libs/bc/hangar/src/user-write-schemas.ts (new)                       │
│      Zod schemas: SetRoleInput, BanUserInput, UnbanUserInput,           │
│                   RevokeSessionInput, RevokeAllSessionsInput            │
│                                                                         │
│    libs/ui/src/components/ConfirmAction.svelte (new, reusable)          │
│      typed-confirmation gate, dangerLevel, snippet body,                │
│      wraps form, emits cancel/confirm                                   │
│                                                                         │
│    libs/constants/src/audit.ts                                          │
│      + HANGAR_USER (target type)                                        │
│                                                                         │
│    libs/constants/src/routes.ts                                         │
│      + HANGAR_USER_SET_ROLE_ACTION                                      │
│      + HANGAR_USER_BAN_ACTION                                           │
│      + HANGAR_USER_UNBAN_ACTION                                         │
│      + HANGAR_USER_REVOKE_SESSION_ACTION                                │
│      + HANGAR_USER_REVOKE_ALL_SESSIONS_ACTION                           │
└─────────────────────────────────────────────────────────────────────────┘
```

## BC Surface

New file `libs/bc/hangar/src/user-writes.ts`:

| Function                  | Signature                                                                                                                 |
| ------------------------- | ------------------------------------------------------------------------------------------------------------------------- |
| `setUserRole`             | `(input: SetUserRoleInput, db?: Db) -> Promise<{ user: UserDirectoryRow }>`                                               |
| `banUserAction`           | `(input: BanUserInput, db?: Db) -> Promise<{ user: UserDirectoryRow }>`                                                   |
| `unbanUserAction`         | `(input: UnbanUserInput, db?: Db) -> Promise<{ user: UserDirectoryRow }>`                                                 |
| `revokeUserSession`       | `(input: RevokeUserSessionInput, db?: Db) -> Promise<{ revokedSessionId: string }>`                                       |
| `revokeAllUserSessions`   | `(input: RevokeAllUserSessionsInput, db?: Db) -> Promise<{ revokedCount: number; revokedOwn: boolean }>`                  |
| `assertSelfTargetAllowed` | `(input: { actorId: string; targetUserId: string; op: 'set-role' \| 'ban' }) -> void` (throws `SelfTargetForbiddenError`) |
| `assertNotLastAdmin`      | `(input: { targetUserId: string; newRole: Role; db: Db }) -> Promise<void>` (throws `LastAdminError`)                     |

Input shapes (all also validated by Zod schemas in `user-write-schemas.ts`):

```typescript
export interface SetUserRoleInput {
	actorId: string;
	targetUserId: string;
	newRole: Role;
	headers: Headers;
}

export interface BanUserInput {
	actorId: string;
	targetUserId: string;
	reason: string;
	expiresAt?: Date | null; // null/undefined = permanent (Open Question (f))
	headers: Headers;
}

export interface UnbanUserInput {
	actorId: string;
	targetUserId: string;
	headers: Headers;
}

export interface RevokeUserSessionInput {
	actorId: string;
	targetUserId: string;
	sessionId: string;
	headers: Headers;
}

export interface RevokeAllUserSessionsInput {
	actorId: string;
	targetUserId: string;
	headers: Headers;
}
```

### Errors

- `SelfTargetForbiddenError` -- thrown by `assertSelfTargetAllowed` when an admin tries to set their own role or ban themselves.
- `LastAdminError` -- thrown by `assertNotLastAdmin` when a role change would leave the system with zero admins.
- `BetterAuthApiError` -- thin wrapper around the admin plugin's thrown error so callers can map to a 409 fail. Message comes through unchanged.

## Constants

`libs/constants/src/audit.ts` additions:

```typescript
/** Edits to a `bauth_user` row from the hangar admin surface. */
HANGAR_USER: 'hangar.user',
```

Added to `AUDIT_TARGETS`. `AUDIT_TARGET_VALUES` picks it up automatically; the DB CHECK constraint regenerates from the values list (see [Open Question (h)](#h-db-check-constraint-regen)).

`libs/constants/src/routes.ts` additions: see In Scope #10.

No new role values, no new audit op kinds (we use the existing `UPDATE` and `ACTION`), no new schemas. The op subKinds (`'role-assign' | 'ban' | 'unban' | 'session-revoke' | 'session-revoke-all'`) are constants:

```typescript
export const HANGAR_USER_OP_SUBKINDS = {
	ROLE_ASSIGN: 'role-assign',
	BAN: 'ban',
	UNBAN: 'unban',
	SESSION_REVOKE: 'session-revoke',
	SESSION_REVOKE_ALL: 'session-revoke-all',
} as const;

export type HangarUserOpSubkind = (typeof HANGAR_USER_OP_SUBKINDS)[keyof typeof HANGAR_USER_OP_SUBKINDS];
export const HANGAR_USER_OP_SUBKIND_VALUES = Object.values(HANGAR_USER_OP_SUBKINDS);
```

Lives in `libs/constants/src/audit.ts` next to `AUDIT_TARGETS`.

## Routes

| Route                         | Method | Purpose                                                                                                       |
| ----------------------------- | ------ | ------------------------------------------------------------------------------------------------------------- |
| `/users/[id]`                 | GET    | Existing read-only detail load. Unchanged.                                                                    |
| `/users/[id]?/setRole`        | POST   | Form action. Body: `newRole`. Calls `setUserRole` BC. Audits.                                                 |
| `/users/[id]?/ban`            | POST   | Form action. Body: `reason`, `expiresAt?`, `confirmEmail` (typed gate). Calls `banUserAction`. Audits.        |
| `/users/[id]?/unban`          | POST   | Form action. Body: (none). Calls `unbanUserAction`. Audits.                                                   |
| `/users/[id]?/revokeSession`  | POST   | Form action. Body: `sessionId`, `confirmEmail`. Calls `revokeUserSession`. Audits.                            |
| `/users/[id]?/revokeAllSessions` | POST | Form action. Body: `confirmEmail`. Calls `revokeAllUserSessions`. Audits. Redirects to `/login` if self.      |

The list page `/users` does not gain actions in this WP -- all editing happens on the detail page so the surface stays focused.

## Validation

| Field / surface                           | Rule                                                                                                                       |
| ----------------------------------------- | -------------------------------------------------------------------------------------------------------------------------- |
| `newRole` form field                      | Required. One of `ROLE_VALUES`. `fail(400)` otherwise.                                                                     |
| `reason` form field (ban)                 | Required. Length 1..500. Trimmed. `fail(400)` otherwise.                                                                   |
| `expiresAt` form field (ban)              | Optional ISO-8601 string. If provided, must parse to a future `Date`. `fail(400)` otherwise.                               |
| `sessionId` form field (revoke single)    | Required. Must match an existing session for the target user. BC re-validates via `listRecentUserSessions` before revoking. |
| `confirmEmail` form field (typed gate)    | Required for ban / revoke / revoke-all. Must equal the target user's email. `fail(400)` otherwise.                         |
| Self-target on set-role / ban             | Hard-blocked. `fail(409, { error: 'Cannot ... yourself.' })`.                                                              |
| Last-admin demotion                       | Hard-blocked. `fail(409, { error: 'Cannot demote the last admin.' })`.                                                     |
| Banned target attempting to be banned again | Better-auth admin plugin handles idempotently. We still emit the audit row (the reason or expiry may have changed).      |

## Edge cases

- **Admin demotes self via different admin's session.** Allowed -- only self-demote-via-own-session is blocked. Two admins, A and B; A bans/demotes B; B is locked out next request. Right behavior.
- **Admin revokes own current session via revoke-all.** The action succeeds, the audit row is written, the form action's response sets a redirect to `/login` (admin's session no longer valid for the redirect's load). The form-action result indicates `revokedOwn: true` so the page renders the redirect.
- **Admin revokes own current session via revoke-single.** Same as above when `sessionId === currentSessionId`. Otherwise it just revokes a stale device.
- **Target user has zero sessions.** Revoke-all returns `revokedCount: 0`. We still emit an audit row (no-op is auditworthy because the admin tried).
- **Banning an already-banned user with new reason/expiry.** Better-auth admin plugin updates the columns. We capture the before/after diff in the audit row.
- **Unban while session-revoke didn't happen.** Better-auth already invalidated sessions on ban. Unban does NOT restore sessions; the user must log in again. UI copy in the unban modal says "the user must sign in again."
- **Session id from a stale page load (the session expired between the page load and the action).** Better-auth admin plugin no-ops gracefully. Audit row still written (admin's intent is auditworthy).
- **Cookie-cache TTL window.** A revoked session may continue to authorize requests for up to `5 * 60` seconds because of the better-auth `cookieCache.maxAge`. The audit row is written immediately; the user-facing logout may lag the cache TTL. Documented in the modal's body copy: "User will be logged out within 5 minutes."
- **Demotion that strips ADMIN from a user mid-flow.** That user's existing sessions remain valid (sessions don't carry role; role is read from `bauth_user` on each `getSession`). Their next request 403s on the per-page `requireRole(ADMIN)` gate. UI offers "demote + revoke-all sessions" as a follow-on micro-flow ([Open Question (i)](#i-demote-plus-revoke-shortcut)).
- **Better-auth admin plugin throws because the calling user lost ADMIN between layout-load and form-action POST.** `requireRole(event, ROLES.ADMIN)` catches it first (per-page gate). Form action 403s before the BC is touched.
- **Race: two admins set role on the same user simultaneously.** Better-auth's adapter is last-write-wins on the `role` column. Both audit rows are written; the timestamp ordering tells the story. No optimistic lock here -- this isn't `hangar_source` with rev numbers.

## Open Questions

The user resolves each before tasks.md finalizes.

### (a) Audit target and op shape

**Recommended:** single `AUDIT_TARGETS.HANGAR_USER` target type, existing `AUDIT_OPS.UPDATE` / `AUDIT_OPS.ACTION` op, op-distinguishing kind in `metadata.subKind` from a closed `HANGAR_USER_OP_SUBKINDS` set. Keeps the audit op enum tight (per the comment in `libs/audit/src/schema.ts`) while making the per-op queries trivial via `metadata->>'subKind'`.

| Option                                                          | For                                                                  | Against                                                                                                       |
| --------------------------------------------------------------- | -------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------- |
| Single target + subKind metadata (recommended)                  | Tight enum. Existing pattern (audit-ping uses subKind).              | Per-op queries go through JSONB.                                                                              |
| Separate target per op (`hangar.user.role`, `hangar.user.ban`)  | Per-op queries are pure column scans.                                | Target enum bloat (5 new values for one feature). Sets bad precedent for every future admin-write WP.         |
| Add new op kinds (`role-assign`, `ban`, `unban`)                | Each op classified at the column.                                    | Op enum was deliberately kept to 4 (per the schema comment). Adding 5 more for one feature is the wrong move. |

### (b) Confirmation gate on role change

**Recommended:** no confirmation gate on role change. Role change is recoverable (set it back) and not destructive. The picker requires an explicit Save click; that's enough.

| Option                                            | For                                                                 | Against                                                              |
| ------------------------------------------------- | ------------------------------------------------------------------- | -------------------------------------------------------------------- |
| No gate (recommended)                             | Recoverable. Frequent op for content authors.                       | A misclick promotes a learner to admin.                              |
| Simple modal ("Change role from X to Y? Yes/No.") | Catches misclicks.                                                  | One more click for every role change.                                |
| Typed-confirmation gate                           | Maximally safe.                                                     | Overkill for a recoverable change.                                   |

If misclicks become a real issue we add the simple modal in a follow-on.

### (c) Confirmation gate style

**Recommended:** typed-confirmation (admin types the target user's email) for ban + revoke + revoke-all. Simple modal (no typed gate) for unban.

| Option                                                                          | For                                                                                              | Against                                                                                |
| ------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------ | -------------------------------------------------------------------------------------- |
| Typed-confirmation on ban/revoke/revoke-all + simple on unban (recommended)     | Reads the user identity into the admin's brain before the action. Used by GitHub for repo delete. | Two-stage flow.                                                                        |
| Simple modal on everything                                                      | One pattern.                                                                                     | Easy to misclick "revoke all sessions." Admin doesn't have to look at the target user. |
| Type a verb (`ban`, `revoke`)                                                   | Pattern from Stripe.                                                                             | Doesn't bind the action to the target. Admin could type `ban` while looking at user A and submit on user B. |

### (d) Modal component location and shape

**Recommended:** `libs/ui/src/components/ConfirmAction.svelte`. Snippet-based body (Svelte 5; no `<slot>`). Wraps a SvelteKit `<form>` so the modal IS the form. Reused on every later admin-write surface.

| Option                                                          | For                                                            | Against                                                                          |
| --------------------------------------------------------------- | -------------------------------------------------------------- | -------------------------------------------------------------------------------- |
| `libs/ui/components/ConfirmAction.svelte` (recommended)         | Reusable across every admin-write surface in every app.        | Adds a component to `@ab/ui` -- minor surface growth, well-scoped.               |
| `apps/hangar/src/lib/components/ConfirmAction.svelte`           | Local to hangar; ships only if hangar uses it.                 | Next admin-write WP duplicates it. Convergent finding waiting to happen.         |
| Inline modal in `+page.svelte`                                  | No new component.                                              | Three modal flavours inline; copy-paste drift across the four actions in this WP. |

### (e) BC write module location

**Recommended:** new file `libs/bc/hangar/src/user-writes.ts`. Sibling to `users.ts` (read-only). Symmetric with the `source-form.ts` / `registry.ts` split (forms vs registry).

| Option                                              | For                                                          | Against                                                                                                       |
| --------------------------------------------------- | ------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------- |
| New `user-writes.ts` (recommended)                  | Read/write split is clear. `users.ts` stays read-only.       | One more file in `libs/bc/hangar/src/`.                                                                       |
| Extend `users.ts`                                   | Single module for "user stuff."                              | Mixes read and write. Read-only callers pulled into a module that imports `auth.api`.                         |
| Extend `registry.ts`                                | Already has the `auditWrite` pattern.                        | `registry.ts` is for hangar's own tables (sources, references). User table is owned by better-auth.           |

### (f) Ban duration -- permanent or time-bounded?

**Recommended:** ban duration optional; UI offers a date picker for `expiresAt`. Default = permanent (no expiry). If the user enters an expiry, we pass it through to better-auth's `banExpires`. Better-auth handles auto-unban at expiry on the next sign-in attempt (its admin plugin checks `banExpires` against current time).

| Option                                                  | For                                                                  | Against                                                                                          |
| ------------------------------------------------------- | -------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------ |
| Optional expiry; default permanent (recommended)        | Matches better-auth's column shape directly. Flexible.               | Admin has to remember to clear the field for permanent bans.                                     |
| Always permanent                                        | Simplest UI.                                                         | Loses the "cool-off" use case (ban for 7 days).                                                  |
| Always time-bounded with hard-coded options (1d/7d/30d) | Forces admin to pick a duration -- explicit.                         | Doesn't match better-auth's flexible expiry. Hard to do "ban indefinitely until further notice." |

### (g) Self-target guards

**Recommended:** hard-block self role-change and self-ban; allow self session-revoke (single + bulk).

| Option                                                       | For                                                                                                                                                           | Against                                                                                |
| ------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------- |
| Block self role + ban; allow self revoke (recommended)       | Self-demote-out-of-admin is an irreversible foot-gun for a single-admin platform. Self-revoke is useful (kill stale device).                                  | Two admins on a team eventually lift the role-change block; this WP doesn't have that. |
| Block all self-targeting                                     | Maximally safe.                                                                                                                                               | Loses self-revoke utility.                                                             |
| Allow everything                                             | Trust the admin.                                                                                                                                              | Single-admin lockout is one click away.                                                |

### (h) DB CHECK constraint regen

The `audit.audit_log.target_type` column has a CHECK that lists the allowed values. `AUDIT_TARGET_VALUES` is the source. Adding `HANGAR_USER` to `AUDIT_TARGETS` widens the value list. The migration that updates the CHECK ships with this WP.

**Recommended:** Drizzle migration drops + recreates the CHECK with the new value list. Single-statement migration. No data migration -- existing audit rows have target_type values already in the new list.

| Option                                                              | For                                                  | Against                                                                                                                |
| ------------------------------------------------------------------- | ---------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------- |
| Drop + recreate CHECK in migration (recommended)                    | Keeps DB CHECK aligned with `AUDIT_TARGET_VALUES`.    | Migration touches a constraint every time a new audit target lands.                                                    |
| Remove the CHECK constraint entirely                                | No more migrations on the constraint.                | Loses DB-level guarantee that `target_type` is always a known value. Drift between code and rows becomes possible.    |
| Convert `target_type` to a Postgres enum                            | Type safety.                                         | Postgres enum migrations are painful. Better-auth's pattern in this codebase already uses CHECK; consistency wins.    |

### (i) Demote + revoke shortcut

**Recommended:** ship the two operations separately in this WP. A "demote and revoke all sessions" combo button is a nice-to-have but adds a second form action, second audit row, and orchestration logic. Punt to a follow-on if the friction shows up.

| Option                                                  | For                                                                | Against                                                                                                  |
| ------------------------------------------------------- | ------------------------------------------------------------------ | -------------------------------------------------------------------------------------------------------- |
| Separate ops (recommended)                              | Each op is auditable. UI keeps modeling clean.                     | Admin must perform two actions for the security-critical case ("demote AND kick out their sessions").   |
| Combo "demote + revoke" action                          | Single click for the security case.                                | Two audit rows or one composite row -- ambiguity. Reverts get messy.                                    |
| Auto-revoke on demote                                   | Admin doesn't have to remember.                                    | Not all demotions are security events. A learner self-promoted to author by mistake doesn't need revoke. |

### (j) Revoke-all when target has many sessions

**Recommended:** revoke-all is fire-and-forget on the better-auth side. We don't fetch the count first; we let the admin plugin do its thing and read the resulting count from its return value. `metadata.revokedCount` carries it.

If this becomes a perf concern (a target user with hundreds of sessions), we add a hard cap or a confirmation step that surfaces the count. Defer.

## References

- [Tasks](./tasks.md) -- phased implementation plan
- [Test plan](./test-plan.md) -- manual + automated acceptance scenarios
- [Design](./design.md) -- confirmation UX shape, form action shape, error/success feedback
- [`extract-hangar-bc` spec](../extract-hangar-bc/spec.md) -- the read-only directory's BC extraction
- [`hangar-non-textual` spec](../hangar-non-textual/spec.md) -- precedent for `before/after` snapshots in audit rows
- [Better Auth admin plugin types](../../../node_modules/better-auth/dist/plugins/admin/admin.d.mts)
- [Hangar Vision](../../products/hangar/VISION.md) -- People area
- [Hangar PRD](../../products/hangar/PRD.md) -- Backlog row this WP closes
- `libs/auth/src/auth.ts` -- dual-gate auth contract that every form action follows
- `libs/auth/src/server.ts` -- cookie-cache TTL that bounds revoke propagation
- `libs/audit/src/log.ts` -- `auditWrite`
- `libs/constants/src/audit.ts` -- `AUDIT_TARGETS`
- `libs/constants/src/roles.ts` -- `ROLES`, `ROLE_VALUES`, `ROLE_LABELS`
- `apps/hangar/src/routes/(app)/admin/audit-ping/+page.server.ts` -- canonical audit-write form-action precedent
