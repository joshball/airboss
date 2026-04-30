---
title: 'Test Plan: Hangar invite flow'
product: hangar
feature: hangar-invite-flow
type: test-plan
status: draft
review_status: pending
---

Manual + automated acceptance for [spec.md](./spec.md). Prefix `HIF-`.

## Setup

- Hangar app + study app running locally (`bun run dev`).
- PostgreSQL on port 5435; migrations through this WP applied.
- Two seeded admins (`admin1@airboss.test`, `admin2@airboss.test`) so the role-change last-admin guard isn't tripped during testing.
- Resend disabled in dev (no `RESEND_API_KEY`); emails log to console. The test plan uses the console-logged URL as the click-target.
- `bun run check` passes on the branch.

When the test calls "open the invite modal" the test step is: navigate to `/users/invitations`, click "Invite user", observe the modal.

---

## Create invite

### HIF-1: create invite for a brand-new email

1. Sign in as `admin1@airboss.test`. Navigate to `/users/invitations`.
2. Click "Invite user". Enter `alice@example.com`, role `learner`. Submit.
3. **Expected:** modal closes, list refreshes, new row appears under Pending. Status pill says "pending". `expires_at` is ~7 days out.
4. **Expected:** dev console logs the invite email with a URL of the form `http://study.airboss.test:9620/invite/<token>`.
5. **Expected:** `/admin/audit?targetType=hangar.invitation` shows one row with `op = create`, `metadata.subKind = create`, actor `admin1`, `metadata.email = alice@example.com`.

### HIF-2: cannot create invite for an existing user

1. Existing user `existing@airboss.test` is in `bauth_user`.
2. Try to invite `existing@airboss.test`.
3. **Expected:** modal shows error banner "User already exists -- use the role picker to change their role" with a link to `/users/<id>`. No row inserted, no email sent, no audit row.

### HIF-3: cannot create invite targeting `admin`

1. Open the invite modal. Verify the role picker does NOT include `admin` as an option.
2. Use browser devtools to forge a POST with `proposedRole=admin`.
3. **Expected:** server returns `fail(400)` with "Invalid role". No row inserted.

### HIF-4: email-send failure rolls back the invitation row

1. Force `sendEmail` to return false (test-mode flag, OR set up a way to short-circuit Resend).
2. Try to create an invite.
3. **Expected:** modal shows "Failed to send invitation email -- please retry." No row in `hangar.invitation`. No audit row.

### HIF-5: cannot create two pending invites for the same email

1. Create invite for `alice@example.com` (HIF-1). It's pending.
2. Try to create a second invite for the same email.
3. **Expected:** modal shows "An invite for this email is already pending. Revoke or resend it." No second row inserted.

---

## Accept invite

### HIF-10: clicking the email link lands on the accept page with email pre-filled

1. From HIF-1, copy the URL from the dev console.
2. Open it in an incognito window (no existing session).
3. **Expected:** accept page renders. Email field shows `alice@example.com`, read-only (no edit affordance, attempting to edit via devtools doesn't change the bound value).

### HIF-11: completing the form creates the user + signs them in + redirects to dashboard

1. From HIF-10, enter a password. Submit.
2. **Expected:** redirect to `/dashboard` (study). The user is signed in -- the avatar / nav reflects `alice@example.com`.
3. **Expected:** `/users` (hangar) lists `alice@example.com` with role `learner`.
4. **Expected:** `/admin/audit?targetType=hangar.invitation` shows a new row with `op = action`, `metadata.subKind = accept`, `metadata.acceptedUserId = <new user id>`.
5. **Expected:** the original invitation row in `/users/invitations` moves from Pending to Accepted, with `accepted_at` populated.

### HIF-12: accept page 404s for an unknown token

1. Navigate to `/invite/notarealtoken`.
2. **Expected:** 404. No leakage of "this token doesn't exist" vs "this token has been revoked" -- both are 404.

### HIF-13: accept page 404s for an already-accepted invitation

1. From HIF-11, copy the same accept URL again.
2. Open in a fresh incognito window.
3. **Expected:** 404.

### HIF-14: accept page 404s for a revoked invitation

1. Create invite (HIF-1), copy URL.
2. As admin, revoke the invitation (HIF-20).
3. Open the URL.
4. **Expected:** 404.

### HIF-15: accept page 404s for an expired invitation

1. Insert an invite with `expires_at = now() - 1 hour` directly in the DB (test-only fixture).
2. Try to accept its token.
3. **Expected:** 404.

---

## Revoke

### HIF-20: revoke a pending invitation

1. Sign in as admin. Navigate to `/users/invitations/<id>` for a pending invite.
2. Click "Revoke". The ConfirmDialog opens with a typed-email gate.
3. Type the recipient's email exactly. Click "Revoke".
4. **Expected:** the row moves from Pending to Revoked. `revoked_at` populated. `revoked_by_user_id` is the calling admin's id.
5. **Expected:** audit row with `op = update`, `metadata.subKind = revoke`.

### HIF-21: typed-email gate disables Revoke until exact match

1. From HIF-20, open the revoke modal. Confirm button is disabled.
2. Type the email with one character off. Confirm stays disabled.
3. Type the email exactly. Confirm enables.

### HIF-22: cannot revoke an already-accepted invitation

1. From HIF-11, the invite is accepted.
2. Open `/users/invitations/<id>` for that invitation.
3. **Expected:** the Revoke button is hidden (or disabled with a hint "Already accepted").

---

## Resend

### HIF-30: resend regenerates the token + re-emails

1. From HIF-1 (pending invite), open the detail page.
2. Click "Resend" (no typed gate per decision (d)).
3. **Expected:** `invited_at` bumps to `now()`. `expires_at` bumps to `now() + 7 days`. The dev console logs a new email with a different URL than HIF-1.
4. **Expected:** trying the OLD URL (from HIF-1) returns 404.
5. **Expected:** trying the NEW URL renders the accept page.
6. **Expected:** audit row with `op = action`, `metadata.subKind = resend`. `metadata.oldTokenSuffix` and `metadata.newTokenSuffix` differ.

### HIF-31: cannot resend an already-accepted invitation

1. From HIF-11, the invite is accepted.
2. Open the detail page.
3. **Expected:** Resend button hidden / disabled with a hint.

---

## Auth gating

### HIF-40: AUTHOR / OPERATOR / learner cannot reach `/users/invitations`

1. Sign in as `author1@airboss.test`. Navigate to `/users/invitations`.
2. **Expected:** redirected (per the existing `/users` precedent) -- 403 or layout-level gate denial.
3. Repeat for `operator1` and `learner1`. Each is denied.

### HIF-41: signed-out user cannot reach `/users/invitations`

1. Sign out. Navigate to `/users/invitations`.
2. **Expected:** redirected to `/login`.

### HIF-42: accept route is reachable when signed out

1. Sign out. Navigate to `/invite/<valid-pending-token>`.
2. **Expected:** accept page renders. No redirect to `/login`. (This is the only public study route that mutates state.)

### HIF-43: accept route is reachable when signed in (but warns)

1. Sign in as `admin1`. Navigate to `/invite/<valid-pending-token>` for a different email.
2. **Expected:** accept page renders with a banner "You are signed in as admin1@airboss.test. Accepting this invite will sign you out and create a new account for alice@example.com." This is a UX safety net -- accidentally clicking your own admin's "invite alice" link shouldn't silently swap accounts.

---

## Concurrency / edge cases

### HIF-50: two admins try to create the same invite simultaneously

1. Two browser tabs as `admin1`. Both open the invite modal for `alice@example.com` (no existing pending invite).
2. Submit both within the same second.
3. **Expected:** one succeeds, the other returns 409 "Invite already pending" (the unique partial index catches the race).

### HIF-51: invitation expires while the accept page is open

1. Open accept page for a pending invite. Hold it open.
2. Manually expire the invitation in the DB (`UPDATE ... SET expires_at = now() - 1 hour`).
3. Submit the form.
4. **Expected:** server-side check rejects with 410-shaped error. The page doesn't accept stale state.

### HIF-52: better-auth `createUser` fails during accept

1. Force `auth.api.createUser` to throw (e.g. corrupt the DB unique constraint to fail on insert).
2. Submit the accept form.
3. **Expected:** the BC's transaction wrapping the createUser + invitation update rolls back. The invitation row stays pending. The user can retry.

---

## Regression

### HIF-90: existing /users / /users/[id] surfaces still work

1. Navigate to `/users`. List renders, search works.
2. Navigate to `/users/<existing-id>`. Edit affordances still present.
3. Audit history still shows pre-existing rows.

### HIF-91: `bun run check` and unit suite pass

1. `bun run check` -> 0 errors, 0 warnings.
2. `bunx vitest run libs/bc/hangar/src/invitations.test.ts` -> all green.
3. `bun run test:e2e` -> green for the existing suite. (Hangar e2e for this WP is deferred to `hangar-e2e-infrastructure` per the precedent in users-editing's coverage matrix.)

---

## Coverage matrix

- **BC writes** -- create / revoke / resend / accept happy paths + guards (existing-email, role-not-admin, send-failure-rollback, race-condition unique-index, expired/accepted/revoked states). Covered by `libs/bc/hangar/src/invitations.test.ts` (Vitest).
- **Email template render** -- subject + html shape. Covered by a Vitest case in the same file.
- **Form action wiring** -- Zod validation, ConfirmDialog typed gate, redirect after accept. Covered by manual scenarios HIF-1 .. HIF-91.
- **End-to-end flows** -- dev-console URL -> incognito click -> sign-up -> dashboard. Covered by manual scenarios HIF-1 .. HIF-91.

## Deferred automation

Browser-level e2e for the full create-email-click-accept loop is deferred to [`hangar-e2e-infrastructure`](../hangar-e2e-infrastructure/spec.md), the same prerequisite that holds back audit-explorer and users-editing e2e suites. Until that lands, manual smoke is the integration coverage.
