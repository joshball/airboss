---
title: 'Test Plan: Hangar Users Editing'
product: hangar
feature: hangar-users-editing
type: test-plan
status: unread
review_status: pending
---

# Test Plan: Hangar Users Editing

Manual + automated acceptance for [spec.md](./spec.md). Prefix `HUE-`.

## Setup

- Hangar app running locally (`bun run dev:hangar`).
- PostgreSQL on port 5435; migrations through this WP applied.
- Seeded test users:
  - `admin1@airboss.test` -- role `admin` (acts as the calling admin).
  - `admin2@airboss.test` -- role `admin` (so last-admin guard scenarios have a second admin to fall back on).
  - `author1@airboss.test` -- role `author`.
  - `learner1@airboss.test` -- role `learner` (target for promotion / ban / revoke scenarios).
  - At least three active sessions on `learner1` for revoke scenarios (sign in from three browsers / `curl` the sign-in flow three times).
- `bun run check` passes on the branch.

When the test calls "open the ban modal" the test step is: navigate to `/users/<targetId>`, click the "Ban user" button, observe the modal.

---

## Audit emission (every op writes a row)

These are the most important tests in the plan -- the audit contract is load-bearing.

### HUE-1: setRole writes one audit row

1. Sign in as `admin1`. Navigate to `learner1`'s detail page.
2. Pick role "Author" from the picker. Click Save.
3. **Expected:** Toast "Role updated."
4. Run: `psql -h localhost -p 5435 -d airboss -c "SELECT op, target_type, target_id, before, after, metadata FROM audit.audit_log WHERE target_id = '<learner1-id>' AND timestamp > now() - interval '1 minute' ORDER BY timestamp DESC LIMIT 1;"`
5. **Expected:** one row with `op=update`, `target_type=hangar.user`, `before={"role":"learner"}`, `after={"role":"author"}`, `metadata.subKind="role-assign"`, `metadata.actorEmail="admin1@airboss.test"`.

### HUE-2: ban writes one audit row with reason + expiry

1. Sign in as `admin1`. Open ban modal on `learner1`.
2. Type `learner1@airboss.test` in the typed gate. Reason: "Test ban for HUE-2." No expiry.
3. Submit.
4. **Expected:** badge shows "Banned." Toast "User banned."
5. Query the latest audit row.
6. **Expected:** `op=update`, `before={"banned":false,"banReason":null,"banExpires":null}`, `after={"banned":true,"banReason":"Test ban for HUE-2.","banExpires":null}`, `metadata.subKind="ban"`.

### HUE-3: ban with expiry sets `banExpires`

1. Open ban modal. Reason: "7-day cool-off." Expiry: 7 days from now.
2. **Expected:** audit row shows `after.banExpires` is the chosen ISO timestamp.
3. **Expected:** `bauth_user.ban_expires` column matches.

### HUE-4: unban writes one audit row

1. Open unban modal on `learner1`. Submit.
2. **Expected:** "Banned" badge gone. Toast "User unbanned."
3. **Expected:** audit row with `before.banned=true`, `after.banned=false`, `subKind="unban"`.

### HUE-5: revoke single session writes one audit row

1. `learner1` has 3 sessions. Pick the topmost row in the sessions table; copy its session id.
2. Click "Revoke" on that row. Type the gate. Submit.
3. **Expected:** sessions table now shows 2 rows; the chosen one is gone.
4. **Expected:** audit row with `op=action`, `subKind="session-revoke"`, `metadata.revokedSessionId=<that id>`.

### HUE-6: revoke all sessions writes one audit row

1. `learner1` has 2 sessions. Click "Revoke all sessions." Type gate. Submit.
2. **Expected:** sessions table is empty. Toast "All sessions revoked."
3. **Expected:** audit row with `op=action`, `subKind="session-revoke-all"`, `metadata.revokedCount=2`.

### HUE-7: failed action writes NO audit row

1. Sign in as `admin1`. Try to set role on `admin1` itself ("Promote to admin" -> "Demote to learner").
2. **Expected:** error toast "Cannot change your own role." No audit row written for this attempt.
3. Verify with: `SELECT count(*) FROM audit.audit_log WHERE target_id = '<admin1-id>' AND timestamp > now() - interval '1 minute';` -> 0.

---

## Effects: the writes do what they claim

### HUE-10: setRole actually changes the role column

1. After HUE-1, query: `SELECT role FROM bauth_user WHERE id = '<learner1-id>';`
2. **Expected:** `author`.

### HUE-11: ban actually prevents login

1. After HUE-2 (target banned). Sign out as `admin1`.
2. Attempt to sign in as `learner1` with their password.
3. **Expected:** sign-in fails. Better-auth's response says the account is banned. The target is not signed in.
4. Confirm `bauth_user.banned = true` in the DB.

### HUE-12: ban with future expiry auto-unbans on attempted login after expiry

1. Set the ban expiry on `learner1` to "now + 30 seconds" (use a temporary direct UPDATE for speed, or wait if testing real-clock).
2. Wait until the expiry passes.
3. Attempt to sign in as `learner1`.
4. **Expected:** better-auth's admin plugin clears the ban on the next sign-in attempt; the user is signed in. (This is better-auth behavior, not ours.)

### HUE-13: unban does NOT restore previously revoked sessions

1. Ban `learner1`. Better-auth invalidates their sessions on ban.
2. Unban.
3. **Expected:** the `bauth_session` rows for `learner1` are still gone. The user has to sign in fresh. The unban modal copy says exactly this.

### HUE-14: revoke single session invalidates that session's cookie

1. `learner1` has 3 sessions; one of them is from a known browser.
2. From the user-detail page, revoke that specific session id.
3. In the known browser (the one whose session was revoked), wait up to 5 minutes (cookie-cache TTL) and refresh.
4. **Expected:** the user is bounced to `/login`. The other two browsers stay signed in.

### HUE-15: revoke all sessions invalidates every session

1. After HUE-14, revoke all sessions on `learner1`.
2. In the remaining two browsers, wait up to 5 minutes. Refresh.
3. **Expected:** both bounce to `/login`. The session table for `learner1` is empty.

### HUE-16: admin revoking own session via revoke-all redirects to `/login`

1. Sign in as `admin1`. Navigate to `admin1`'s own user-detail page.
2. Revoke all sessions.
3. **Expected:** the form-action response redirects to `/login`. After redirect, attempting any authed action 401s until re-login.
4. Audit row written with `revokedOwn` reflected in metadata.

---

## Confirmation gate

### HUE-20: ban modal -- typed gate enables submit only on exact email match

1. Open ban modal on `learner1`.
2. Type `learner1@airboss.tes` (one char short).
3. **Expected:** confirm button stays `disabled`.
4. Type the full `learner1@airboss.test`.
5. **Expected:** confirm button enables.

### HUE-21: ban modal -- mismatched email rejected on the server too

1. Bypass the client gate (e.g. submit the form via curl with `confirmEmail=wrong@example.com`).
2. **Expected:** server returns `fail(400)` with "confirmation email does not match" error.

### HUE-22: revoke-all modal shows session count

1. `learner1` has 4 sessions. Open the "Revoke all sessions" modal.
2. **Expected:** body copy includes "4 sessions" or "4 devices."

### HUE-23: cancel closes modal without action

1. Open any modal. Click Cancel (or Esc).
2. **Expected:** modal closes. No form submitted. No audit row.

### HUE-24: backdrop click only closes when no typed-gate input

1. Open the unban modal (no typed gate). Click backdrop.
2. **Expected:** modal closes.
3. Open the ban modal (typed gate). Click backdrop while the gate input has focus.
4. **Expected:** modal stays open.

### HUE-25: Esc closes any modal

1. Open the ban modal. Press Esc.
2. **Expected:** modal closes.

### HUE-26: focus management

1. Open the ban modal. Tab through.
2. **Expected:** focus is trapped in the modal -- it cycles through the typed gate, reason, expiry, cancel, confirm. Doesn't leak to the page underneath.
3. Close the modal.
4. **Expected:** focus returns to the "Ban user" button that opened it.

---

## Self-target guards

### HUE-30: cannot change own role

1. Sign in as `admin1`. Open `admin1`'s detail. Try to demote.
2. **Expected:** server returns `fail(409)` with "Cannot change your own role." No audit row.

### HUE-31: cannot ban self

1. Open the ban modal on `admin1`'s own detail page.
2. Type the gate, submit.
3. **Expected:** server returns `fail(409)` with "Cannot ban yourself." No audit row.

### HUE-32: can revoke own session

1. `admin1` has 2 sessions. Revoke one (not the current one).
2. **Expected:** action succeeds. No 409.
3. **Expected:** audit row written.

---

## Last-admin guard

### HUE-40: cannot demote the last admin

1. Setup: only `admin1` has `role=admin`. Demote `admin2` to learner first.
2. Sign in as `admin1`. Open `admin1`'s own detail page. (The previous test (HUE-30) blocks this anyway, so use a second admin.)
3. Alternative: have `admin2` perform the demote. Sign in as `admin2`. Open `admin1`'s detail. Try to demote.
4. **Expected:** server returns `fail(409)` with "Cannot demote the last admin." No audit row.

### HUE-41: can demote one of two admins

1. Both `admin1` and `admin2` are admins. `admin1` demotes `admin2` to operator.
2. **Expected:** succeeds.

---

## Validation

### HUE-50: setRole rejects unknown role value

1. POST to `?/setRole` with `newRole=tyrant`.
2. **Expected:** `fail(400)` with "Invalid role."

### HUE-51: ban rejects empty reason

1. Submit ban form with reason `   ` (whitespace).
2. **Expected:** `fail(400)` with "Reason is required."

### HUE-52: ban rejects past expiry

1. Submit ban form with `expiresAt` in the past.
2. **Expected:** `fail(400)` with "must be in the future."

### HUE-53: revokeSession rejects non-existent session id

1. Submit `?/revokeSession` with `sessionId=ses_BOGUS123`.
2. **Expected:** server returns `fail(409)` with "Session not found." No audit row.

### HUE-54: revokeSession rejects session belonging to another user

1. Sign in as `admin1`. Find a session id on `admin2`'s detail page. Submit `?/revokeSession` on `learner1`'s detail with that other id.
2. **Expected:** server validation rejects -- the session id doesn't belong to the route's `[id]`.

---

## Authz / dual-gate

### HUE-60: non-admin cannot reach `/users/[id]`

1. Sign in as `learner1`. Navigate to `/users/<any-id>`.
2. **Expected:** 403 (per `requireRole(ADMIN)` in load).

### HUE-61: non-admin cannot POST to a form action

1. Sign in as `learner1`. POST to `?/setRole`.
2. **Expected:** 403 (per `requireRole(ADMIN)` in the action). No audit row.

### HUE-62: layout gate alone is not enough -- per-action gate fires

1. Confirm via test: comment out the per-action `requireRole` (just to demonstrate; revert immediately). Sign in as a non-admin AUTHOR. POST to `?/setRole`.
2. **Expected (with the missing gate):** the action runs. THIS IS THE BUG.
3. Restore the per-action gate. Re-test.
4. **Expected:** 403.

(This test is informational -- not a release gate; included to make explicit that the dual-gate is load-bearing.)

---

## E2E (Playwright) -- automated

### HUE-70: full role-change flow

1. Setup: admin1 + learner1 seeded.
2. Test: admin1 signs in -> navigates to learner1 -> picks role "Author" -> clicks Save.
3. **Assertion:** role pill becomes "Author." Toast appears. DB shows `bauth_user.role='author'`.

### HUE-71: full ban flow with typed gate

1. Test: admin1 opens ban modal on learner1. Types wrong email -> button disabled. Types right email -> button enables. Reason "Spam." Submit.
2. **Assertion:** banned badge appears. DB shows `banned=true`.

### HUE-72: full revoke-all flow

1. Test: learner1 has 3 sessions. admin1 opens revoke-all modal. Types gate. Submit.
2. **Assertion:** sessions table is empty.

### HUE-73: self revoke-all redirects to login

1. Test: admin1 is the actor. Their own detail page. Revoke all.
2. **Assertion:** redirected to `/login`.

### HUE-74: self role-change rejected

1. Test: admin1 attempts to change own role.
2. **Assertion:** error toast "Cannot change your own role." Page does not refresh.

---

## Edge cases

### HUE-80: ban an already-banned user updates reason / expiry

1. `learner1` is banned with reason A. Open ban modal again. Reason B + expiry. Submit.
2. **Expected:** action succeeds. Audit row's `before` reflects reason A; `after` reflects reason B + the new expiry. Better-auth's ban call is idempotent on the boolean but does update the metadata columns.

### HUE-81: revoke-all on a target with zero sessions

1. `learner1` has zero sessions. Open revoke-all modal.
2. **Expected:** the "Revoke all sessions" button is hidden (not rendered when count is 0). Skip path.

### HUE-82: cookie-cache TTL window observed

1. Revoke a session belonging to a known browser at `T0`.
2. Refresh that browser at `T0 + 30s`.
3. **Expected:** session may still authorize (cache hit). Document this in the modal copy as "User will be logged out within 5 minutes."
4. Refresh at `T0 + 5min`.
5. **Expected:** bounce to `/login`.

### HUE-83: stale page loads -- session id no longer exists

1. Open `learner1`'s detail page in tab A. Sessions table shows 3 rows.
2. In tab B, revoke session 2.
3. In tab A, click "Revoke" on session 2 (still in the stale render).
4. **Expected:** server returns 409 "Session not found." Tab A's page reloads to show the updated state.

---

## Regression

### HUE-90: read-only directory still works

1. Visit `/users`. Verify list renders, search works, role pills + banned badges render.
2. Visit `/users/[id]` as admin. Verify Profile / Sessions / Audit cards still render exactly as before plus the new edit affordances above them.

### HUE-91: existing audit-ping path still works

1. Visit `/admin/audit-ping`. Click Ping. Verify it still writes a row.
2. **Expected:** unchanged behavior. The `AUDIT_TARGETS` enum gained a value but didn't change existing values.

### HUE-92: `bun run check` and unit suite pass

1. `bun run check` -> 0 errors, 0 warnings.
2. `bunx vitest run` -> all green. The hangar BC user-writes test (`libs/bc/hangar/src/user-writes.test.ts`) covers self-target / last-admin / better-auth-throw / audit-emission paths for all five operations. The ConfirmDialog test (`libs/ui/__tests__/ConfirmDialog.svelte.test.ts`) covers the typed-gate disabled / enabled / form-action mode.
3. `bun run test:e2e` -> green for the existing study-app suite. Hangar Playwright coverage is deferred (see "Coverage matrix" below).

---

## Coverage matrix

- **BC writes** -- self-target / last-admin / better-auth-throw / audit-emission, all 5 ops. Covered by `libs/bc/hangar/src/user-writes.test.ts` (Vitest).
- **Modal contract** -- typed-gate disabled / enabled / form-action mode / dangerLevel mapping. Covered by `libs/ui/__tests__/ConfirmDialog.svelte.test.ts` (Vitest).
- **Form action wiring** -- Zod validation, fail() shape, redirect on self-revoke-all. Covered by manual scenarios HUE-1 .. HUE-92 in this file.
- **End-to-end flows** -- real-browser typed-gate + login-blocked + revoke-induced logout. Covered by manual scenarios HUE-1 .. HUE-92 in this file.

## Deferred automation

**Hangar Playwright e2e infrastructure does not exist on this branch.** `playwright.config.ts` targets the study app only -- single project, single auth state (learner), single dev server. Adding admin-authed hangar specs would require: a hangar `global.setup`, a hangar admin auth seed, a separate Playwright project, and dev-server orchestration to boot hangar alongside study.

That work is bigger than the e2e specs themselves and out of scope for this WP. Tracked as a follow-up: **`hangar-e2e-infrastructure`** -- author the Playwright project + admin seed + dev orchestration so this WP, the audit-explorer WP, and every future hangar admin-write WP can ship browser-level e2e coverage without per-WP infrastructure work.

Until that follow-up lands, the hangar manual test plans (this file + `hangar-audit-explorer/test-plan.md`) carry the integration coverage. BC + component unit tests carry the security-critical paths.
