---
title: 'Tasks: Hangar Users Editing'
product: hangar
feature: hangar-users-editing
type: tasks
status: unread
review_status: pending
---

# Tasks: Hangar Users Editing

Phased plan for [spec.md](./spec.md). Order is dependency-driven: types + constants first, BC writes next, form actions, UI, confirmation component, tests, docs. Small commits per phase.

Depends on: `extract-hangar-bc` (shipped; gives `libs/bc/hangar/src/users.ts`). Depends on: `hangar-scaffold` (shipped; gives the audit-ping precedent).

## Pre-flight

- [ ] Read this WP's [spec.md](./spec.md). Confirm Open Questions (a)-(j) resolved by user before writing code.
- [ ] Read `libs/auth/src/auth.ts:27-86`. Confirm dual-gate auth contract: every form action calls `requireRole(event, ROLES.ADMIN)` first.
- [ ] Read `libs/auth/src/server.ts:106-130`. Note the `cookieCache.maxAge: 5 * 60` constraint -- session revoke propagates within that window.
- [ ] Read `libs/auth/src/schema.ts:13-28`. Confirm `bauthUser` columns: `role`, `banned`, `banReason`, `banExpires`.
- [ ] Read `libs/audit/src/log.ts`. Confirm `auditWrite` shape.
- [ ] Read `libs/constants/src/audit.ts`. Confirm `AUDIT_TARGETS` enum + DB CHECK regen pattern.
- [ ] Read `libs/bc/hangar/src/users.ts:1-247`. Confirm read-only contract; the new write helpers sit alongside.
- [ ] Read `apps/hangar/src/routes/(app)/admin/audit-ping/+page.server.ts`. Confirm form-action -> auditWrite precedent.
- [ ] Read `apps/hangar/src/routes/logout/+page.server.ts:14-50`. Confirm pattern for calling better-auth handlers from form actions.
- [ ] Read `node_modules/better-auth/dist/plugins/admin/admin.d.mts`. Confirm `setRole`, `banUser`, `unbanUser`, `revokeUserSession`, `revokeUserSessions` signatures.
- [ ] Verify DB on port 5435.
- [ ] Verify `bun run check` passes on baseline main.

## Implementation

### Phase 0: Constants + types

- [ ] Add `HANGAR_USER` to `AUDIT_TARGETS` in `libs/constants/src/audit.ts`.
- [ ] Add `HANGAR_USER_OP_SUBKINDS` const + type + values per spec.
- [ ] Add the five form-action ids to `ROUTES` in `libs/constants/src/routes.ts`:
  - [ ] `HANGAR_USER_SET_ROLE_ACTION`
  - [ ] `HANGAR_USER_BAN_ACTION`
  - [ ] `HANGAR_USER_UNBAN_ACTION`
  - [ ] `HANGAR_USER_REVOKE_SESSION_ACTION`
  - [ ] `HANGAR_USER_REVOKE_ALL_SESSIONS_ACTION`
- [ ] Re-export the new audit constants from `libs/constants/src/index.ts`.
- [ ] Run `bun run check`. Expect 0 errors, 0 warnings.
- [ ] Commit.

### Phase 1: DB migration -- widen `audit_log.target_type` CHECK

- [ ] Generate migration via `bun run db:gen`. Inspect resulting SQL: a single `ALTER TABLE ... DROP CONSTRAINT audit_log_target_type_check` followed by `ADD CONSTRAINT audit_log_target_type_check CHECK (...)`.
- [ ] Run `bun run db:migrate` against dev DB. Verify the constraint is recreated with `hangar.user` in the value list: `psql -h localhost -p 5435 -d airboss -c '\d+ audit.audit_log'`.
- [ ] Run `bun run check` clean.
- [ ] Commit.

### Phase 2: BC -- Zod schemas

- [ ] Create `libs/bc/hangar/src/user-write-schemas.ts`. Mirror the conventions in `form-schemas.ts`.
- [ ] Define + export Zod schemas:
  - [ ] `SetUserRoleInputSchema` -- `targetUserId: ULID`, `newRole: enum(ROLE_VALUES)`.
  - [ ] `BanUserInputSchema` -- `targetUserId`, `reason: string min(1).max(500).trim()`, `expiresAt: optional(z.coerce.date()).refine(d => !d || d > new Date(), 'must be in the future')`.
  - [ ] `UnbanUserInputSchema` -- `targetUserId`.
  - [ ] `RevokeUserSessionInputSchema` -- `targetUserId`, `sessionId: string min(1)`.
  - [ ] `RevokeAllUserSessionsInputSchema` -- `targetUserId`.
  - [ ] Each schema also requires `confirmEmail` for the typed-confirmation gate (except `SetUserRoleInputSchema` per Open Question (b)).
- [ ] Export inferred input types: `SetUserRoleInput`, `BanUserInput`, etc.
- [ ] Re-export from `libs/bc/hangar/src/index.ts`.
- [ ] Author `user-write-schemas.test.ts` covering parse-success and parse-fail paths for each schema.
- [ ] Run `bun test libs/bc/hangar/src/user-write-schemas.test.ts`. Run `bun run check`. Commit.

### Phase 3: BC -- guard helpers

- [ ] Create `libs/bc/hangar/src/user-writes.ts`.
- [ ] Define `SelfTargetForbiddenError`, `LastAdminError`, `BetterAuthApiError` classes.
- [ ] Implement `assertSelfTargetAllowed({ actorId, targetUserId, op })` -- throws `SelfTargetForbiddenError` when `actorId === targetUserId` and `op` is `'set-role'` or `'ban'`. Self-targeting on `'session-revoke'` and `'session-revoke-all'` is allowed.
- [ ] Implement `assertNotLastAdmin({ targetUserId, newRole, db })`:
  - [ ] If `newRole === ROLES.ADMIN`, no-op (the change isn't a demotion).
  - [ ] Pull the target's current role via `getUser`. If they aren't currently admin, no-op.
  - [ ] Call `countUsersByRole({}, db)` (existing). If `result.admin <= 1`, throw `LastAdminError`.
- [ ] Author tests (`user-writes.guards.test.ts`):
  - [ ] Self set-role + self ban -> throws.
  - [ ] Self revoke -> no-op.
  - [ ] Demoting last admin -> throws `LastAdminError`.
  - [ ] Demoting one of two admins -> ok.
  - [ ] Promoting a learner to admin -> ok.
- [ ] Run `bun test`. Commit.

### Phase 4: BC -- write helpers

- [ ] In `user-writes.ts`, implement `setUserRole(input, db)`:
  - [ ] `assertSelfTargetAllowed({ actorId: input.actorId, targetUserId: input.targetUserId, op: 'set-role' })`.
  - [ ] `assertNotLastAdmin({ targetUserId: input.targetUserId, newRole: input.newRole, db })`.
  - [ ] Read pre-snapshot via `getUser(input.targetUserId, db)` -> `before = { role }`.
  - [ ] Call `auth.api.setRole({ body: { userId, role }, headers: input.headers })`. Wrap throws in `BetterAuthApiError`.
  - [ ] Read post-snapshot via `getUser` -> `after = { role }`.
  - [ ] `auditWrite({ actorId, op: AUDIT_OPS.UPDATE, targetType: AUDIT_TARGETS.HANGAR_USER, targetId: input.targetUserId, before, after, metadata: { subKind: 'role-assign', requestId, userAgent, actorEmail } }, db)`.
  - [ ] Return `{ user: postSnapshot }`.
- [ ] Implement `banUserAction(input, db)`:
  - [ ] Self-target guard.
  - [ ] Pre-snapshot: `{ banned, banReason, banExpires }`.
  - [ ] `auth.api.banUser({ body: { userId, banReason, banExpiresIn? }, headers })`. Map `expiresAt` to `banExpiresIn` (seconds) per better-auth contract.
  - [ ] Post-snapshot.
  - [ ] Audit with `subKind: 'ban'`.
- [ ] Implement `unbanUserAction(input, db)`:
  - [ ] Pre-snapshot.
  - [ ] `auth.api.unbanUser({ body: { userId }, headers })`.
  - [ ] Post-snapshot.
  - [ ] Audit with `subKind: 'unban'`.
- [ ] Implement `revokeUserSession(input, db)`:
  - [ ] Pre-validate the session belongs to the target via `listRecentUserSessions`. If not, throw `BetterAuthApiError` with a 404-shaped message.
  - [ ] `auth.api.revokeUserSession({ body: { sessionToken }, headers })` -- the admin plugin keys by token; we need to fetch the token. Inspect the admin plugin source / types to confirm whether it accepts `sessionId` or `sessionToken`. If token-only, the BC fetches the token from `bauth_session.token` for the matching id within the same call.
  - [ ] Audit with `op: AUDIT_OPS.ACTION`, `subKind: 'session-revoke'`, `metadata.revokedSessionId: input.sessionId`.
  - [ ] Return `{ revokedSessionId: input.sessionId }`.
- [ ] Implement `revokeAllUserSessions(input, db)`:
  - [ ] **Build-phase note (2026-04-30):** better-auth's `revokeUserSessions` returns `{ success: boolean }`, NOT a count. We count BEFORE the revoke. Add a tiny `countUserSessions(targetUserId, db)` helper in `users.ts` (or compute from `listRecentUserSessions` if it returns all sessions for the target). Fire-and-forget the revoke itself; the count is informational only and lands in `metadata.revokedCount`.
  - [ ] Compute `revokedCount` via `countUserSessions(targetUserId, db)` BEFORE calling the admin plugin.
  - [ ] `auth.api.revokeUserSessions({ body: { userId }, headers })`.
  - [ ] Detect `revokedOwn`: if the actor's current session id (threaded in via input from `event.locals.session.id`) was among the pre-revoke session list, set the flag.
  - [ ] Audit with `op: AUDIT_OPS.ACTION`, `subKind: 'session-revoke-all'`, `metadata.revokedCount: count`.
  - [ ] Return `{ revokedCount: count, revokedOwn: boolean }`.
- [ ] Author `user-writes.test.ts`:
  - [ ] `setUserRole` happy path -> audit row written, `before.role` and `after.role` correct.
  - [ ] `setUserRole` last-admin demotion -> throws.
  - [ ] `setUserRole` self -> throws.
  - [ ] `banUserAction` happy path -> banned column flipped, audit row.
  - [ ] `banUserAction` with expiresAt -> `banExpires` set, audit row.
  - [ ] `unbanUserAction` -> banned column cleared.
  - [ ] `revokeUserSession` -> session row gone.
  - [ ] `revokeAllUserSessions` -> all sessions gone, count metadata correct, `revokedOwn` true when relevant.
  - [ ] Better-auth throw -> wrapped as `BetterAuthApiError`.
  - [ ] Mock `auth.api` per the existing test pattern in `libs/auth/src/auth.test.ts`.
- [ ] Re-export from `libs/bc/hangar/src/index.ts`.
- [ ] Run `bun test libs/bc/hangar/`. Run `bun run check`. Commit.

### Phase 5: Form actions

- [ ] Edit `apps/hangar/src/routes/(app)/users/[id]/+page.server.ts`:
  - [ ] Import the BC helpers + Zod schemas + `auth` instance + `AUDIT_TARGETS` etc.
  - [ ] Add `actions: Actions` export with `setRole`, `ban`, `unban`, `revokeSession`, `revokeAllSessions`.
  - [ ] Each action: `requireRole(event, ROLES.ADMIN)`, parse formData via the corresponding schema, validate `confirmEmail` matches target email, call BC helper passing `event.request.headers`, catch `SelfTargetForbiddenError | LastAdminError | BetterAuthApiError` -> `fail(409, { error: err.message })`, catch other errors -> `fail(500, { error: 'Internal error' })`. On success return `{ ok: true, op: 'set-role' | ... }`.
  - [ ] On `revokeAllSessions` success when `revokedOwn`: `redirect(303, ROUTES.LOGIN)` so the now-invalid session is replaced.
- [ ] Run `bun run check`. Commit.

### Phase 6: ConfirmDialog component

> **Build-phase correction (2026-04-30):** spec originally named this component `ConfirmAction.svelte`. The reusable modal extends the existing `libs/ui/src/components/ConfirmDialog.svelte` instead, because `ConfirmAction.svelte` is already taken by an inline two-step affordance with 5 active consumers in `apps/study/`. The existing `ConfirmDialog.svelte` is snippet-based, form-aware, and modal-shaped (90% of the spec's contract); we extend it additively with `typedConfirmation` and `dangerLevel`. The existing theme-tokens test must keep passing. The existing `ConfirmAction.svelte` is left untouched.

- [ ] Extend `libs/ui/src/components/ConfirmDialog.svelte` additively. Svelte 5 runes; snippet-based body; no `<slot>`. Existing props/behaviors stay backwards-compatible.
- [ ] Props (`$props`):
  - [ ] `open: boolean` (bindable -- caller drives open/close)
  - [ ] `title: string`
  - [ ] `body: Snippet` (optional)
  - [ ] `confirmText: string` (default "Confirm")
  - [ ] `cancelText: string` (default "Cancel")
  - [ ] `dangerLevel: 'caution' | 'danger'` (default 'caution')
  - [ ] `typedConfirmation?: { label: string; expected: string; placeholder?: string }`
  - [ ] `formAction: string` (e.g. `?/ban`)
  - [ ] `formMethod: 'post'` (always)
  - [ ] `oncancel?: () => void`
  - [ ] children snippet for additional form fields (textarea for ban reason, hidden inputs for sessionId, etc.)
- [ ] Render: a SvelteKit `<form method="post" action={formAction}>` inside a `role="dialog" aria-modal="true"` overlay. Title with `id` referenced by `aria-labelledby`. Body via `{@render body?.()}`. Children form fields via `{@render children()}`. The typed-confirmation input is wired so the submit button is `disabled` until the typed value strictly equals `expected`.
- [ ] Focus trap: focus the typed-confirmation input on open (or the cancel button when there's no typed gate). Esc closes the modal. Tab cycles within the modal.
- [ ] Backdrop click: closes only when not in mid-typing the confirmation gate (the typed gate defends against click-out as well).
- [ ] Style: tokens only; `dangerLevel='danger'` highlights the confirm button with `--signal-warning` family. Match `card` / `badge.banned` palette already in `apps/hangar/src/routes/(app)/users/[id]/+page.svelte`.
- [ ] Re-export from `libs/ui/src/index.ts` (or whatever the `@ab/ui` re-export pattern is).
- [ ] Author Vitest mounts test (`ConfirmDialog.svelte.test.ts`) covering: open/close, typed-confirmation enables submit only on match, `oncancel` fires on Esc + cancel-button + backdrop, focus trap, snippet body renders. Keep the existing theme-tokens test for `ConfirmDialog.svelte` passing.
- [ ] Run `bun test libs/ui/`. Run `bun run check`. Commit.

### Phase 7: Detail page UI

- [ ] Edit `apps/hangar/src/routes/(app)/users/[id]/+page.svelte`:
  - [ ] Import `ConfirmDialog`, `ROLE_VALUES`, `ROLE_LABELS`, `ROUTES`, `enhance` from `$app/forms`.
  - [ ] Add a `Role` card section above the existing Profile card:
    - [ ] `<form method="post" action={ROUTES.HANGAR_USER_SET_ROLE_ACTION} use:enhance>` with a `<select>` populated from `ROLE_VALUES`. Default to `data.user.role`. "Save" button disabled until selection differs.
    - [ ] On success, render a transient toast / notice region.
  - [ ] Add a `Ban / unban` card:
    - [ ] When `data.user.banned === false`: a "Ban user" button that opens a `ConfirmDialog` modal with `dangerLevel='danger'`, `typedConfirmation: { label: 'Type the user email to confirm', expected: data.user.email }`. Modal body has `<textarea name="reason" required>` and `<input type="datetime-local" name="expiresAt">`. Form action: `ROUTES.HANGAR_USER_BAN_ACTION`.
    - [ ] When `data.user.banned === true`: an "Unban user" button that opens a simpler `ConfirmAction` modal with `dangerLevel='caution'` and no typed gate. Form action: `ROUTES.HANGAR_USER_UNBAN_ACTION`. Body: "Unbanning lets the user sign in again. They will need to sign in fresh -- existing sessions were already invalidated by the original ban."
  - [ ] Modify the sessions table:
    - [ ] Add a "Revoke" column. Per row, a "Revoke" button that opens a `ConfirmDialog` modal with `dangerLevel='danger'` + typed gate. Hidden `<input name="sessionId" value={session.id}>` carries the id.
    - [ ] Above the table, "Revoke all sessions" button (only when count > 0). Opens a `ConfirmDialog` with body copy "This will sign out the user from all N devices. They must sign in again on each."
  - [ ] All form submissions use `use:enhance` to prevent full-page reload + handle the success toast / error message.
  - [ ] Bind one shared `dialogOpen` state for the modal + a derived `dialogIntent` so only one modal is open at a time.
- [ ] Run `bun run check`. Commit.

### Phase 8: Manual smoke + page polish

- [ ] Run `bun run dev:hangar`. Sign in as the seed admin. Visit `/users/<some-id>`.
- [ ] Walk every action: set role (promote + demote), ban (with reason + expiry), unban, revoke single session, revoke all sessions.
- [ ] Verify each action emits exactly one audit row by visiting `/admin/audit-ping` (or a temporary log statement) and confirm the `subKind` field is correct.
- [ ] Verify session revoke actually invalidates the target's existing sessions: open a second browser logged in as the target; trigger revoke; refresh -> get bounced to `/login`. (May take up to 5 minutes due to cookie cache; document this for testers in test-plan.md.)
- [ ] Verify ban prevents login: ban target; sign out as admin; attempt to sign in as target -> better-auth rejects.
- [ ] Verify last-admin demotion is blocked.
- [ ] Verify self set-role / self ban are blocked.
- [ ] Polish styles: spacing, modal focus-ring, danger button contrast, success toast position. Run `bun run dev:hangar` until the page feels finished.
- [ ] Commit polish.

### Phase 9: E2E tests

- [ ] Add `tests/hangar-users-editing.spec.ts` (Playwright). Setup: seed an extra admin + two non-admin test users.
- [ ] E2E: admin promotes a learner to author. Reload the user-detail page. Role pill shows "Author."
- [ ] E2E: admin opens the ban modal, types the wrong email, observes confirm button disabled. Types the right email, ban succeeds. The badges show "Banned."
- [ ] E2E: admin unbans the user.
- [ ] E2E: admin revokes a single session. Sessions table shrinks by one row.
- [ ] E2E: admin revokes all sessions on themselves. Page redirects to `/login`.
- [ ] E2E: admin attempts to demote themselves -> error toast "Cannot change your own role."
- [ ] Run `bun run test:e2e -- tests/hangar-users-editing.spec.ts`. Commit.

### Phase 10: Documentation

- [ ] Update `docs/products/hangar/PRD.md`: flip the `/users` editing backlog row from "Not started" to "shipped (PR #...)" with link to this WP.
- [ ] Update `docs/work/NOW.md`: add this WP to "recently closed" once merged.
- [ ] Cross-link from `docs/work-packages/extract-hangar-bc/spec.md` Out of Scope -> link to this WP.
- [ ] Update `libs/constants/src/routes.ts` comment block above `HANGAR_USERS` -- the deferred-editing note is now stale; mark editing as shipped here.
- [ ] If the typed-confirmation pattern is reusable beyond hangar, mention `ConfirmDialog` in `docs/agents/best-practices.md` or `docs/agents/common-pitfalls.md` so future agents reach for it instead of inventing inline modals. (Skip if the doc layout doesn't have a fit.)
- [ ] Commit docs.

## Verification

- [ ] `bun run check` passes 0 errors, 0 warnings.
- [ ] `bun test libs/bc/hangar/ libs/ui/ libs/auth/` passes.
- [ ] `bun run test:e2e` passes the new spec.
- [ ] All scenarios in [test-plan.md](./test-plan.md) executed manually with the dev seed.
- [ ] `grep -rn "HANGAR_USER_OP_SUBKINDS\|setUserRole\|banUserAction" libs/ apps/` returns the expected sites and no others.
- [ ] No `TODO(retire)`, no "for now," no stubs in the diff.
- [ ] Audit row read-back works on every op (verify in dev DB).
