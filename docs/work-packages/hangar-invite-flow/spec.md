---
title: 'Spec: Hangar invite flow'
product: hangar
feature: hangar-invite-flow
type: spec
status: shipped
review_status: pending
created: 2026-04-30
ratified: 2026-05-02
shipped: 2026-05-02
---

Add an invite-by-email flow so an admin can onboard a new user from hangar without sharing a password. The admin enters an email + role, the platform sends a one-shot invite link, the recipient lands on a study route that creates their account via better-auth's signup, and the inviting admin sees the invite move from "pending" to "accepted" in the hangar UI.

This is the natural follow-on to [hangar-users-editing](../hangar-users-editing/spec.md). That WP shipped role assign, ban / unban, and session revoke -- the *edit* surface for users that already exist. This WP closes the loop on user *creation*: today the only path to a new airboss user is dev-seed scripts. Inviting a real person (the second user, eventually a CFI tester, eventually an open-source contributor) requires this surface.

## Why this WP exists

- **No production sign-up path.** Better-auth's email-and-password signup endpoint exists, but airboss has no sign-up button anywhere -- by design. We don't want anonymous self-signup; we want admin-controlled invites.
- **Unblocks the second user.** Joshua is user zero today. The runway-trigger conversation noted "second user joins" as the natural moment for runway to become real. Invite flow is the prerequisite.
- **Sets the email-with-redemption-link pattern.** Every later flow that sends an actionable email (forgot-password follow-up, ban-notification, future newsletters) reuses the token + accept-route shape this WP establishes.

## Anchors

- [hangar-users-editing](../hangar-users-editing/spec.md) -- the predecessor WP. The dual-gate pattern (per-page `requireRole` + audit + ConfirmDialog) carries forward here.
- [hangar-audit-explorer](../hangar-audit-explorer/spec.md) -- the read surface for invite-related audit rows.
- `libs/auth/src/email/transport.ts` -- existing `sendEmail` (Resend in prod, console-log fallback in dev). No new transport work.
- `libs/auth/src/email/templates.ts` -- existing `verificationEmail`, `resetPasswordEmail`, `magicLinkEmail`. The invite template lands here.
- `libs/auth/src/schema.ts` -- the `bauth_user` / `bauth_session` tables. Invites get a sibling `hangar_invitation` table in the hangar schema (NOT the auth schema -- invites are a hangar concern, not a better-auth one).
- `libs/bc/hangar/src/user-writes.ts` -- the dual-gate write pattern + `auth.api` shim + audit emission. Same shape.
- Better-auth admin plugin `createUser` endpoint -- the hand-off at accept time. Avoid better-auth's organization plugin; it carries unrelated multi-tenancy machinery.

## In scope

1. **`hangar.invitation` table** (Drizzle schema in a new `libs/bc/hangar/src/invitations.ts` or sibling, registered under SCHEMAS.HANGAR):
   - `id` (text PK, prefix `inv_`)
   - `email` (text, lowercased on insert)
   - `proposed_role` (text, narrowed to `ROLE_VALUES`)
   - `token` (text, unique, opaque random 32 bytes base64url)
   - `invited_by_user_id` (text, FK to bauth_user.id, on delete set null)
   - `invited_at` (timestamp)
   - `accepted_at` (timestamp, nullable)
   - `accepted_user_id` (text, FK to bauth_user.id, nullable -- set when redeemed)
   - `revoked_at` (timestamp, nullable)
   - `revoked_by_user_id` (text, FK, nullable)
   - `expires_at` (timestamp, default `invited_at + 7 days`; configurable by spec decision (a))
   - One CHECK: `proposed_role IN (ROLE_VALUES)`.
   - Unique partial index on `email` WHERE `accepted_at IS NULL AND revoked_at IS NULL` -- prevents two pending invites for the same email.
2. **BC reads + writes** in `libs/bc/hangar/src/invitations.ts`:
   - `listInvitations(filters?, db?) -> InvitationRow[]` -- pending / accepted / revoked / expired tabs (status derived).
   - `getInvitation(id, db?) -> InvitationRow | null` for the detail view.
   - `getInvitationByToken(token, db?) -> InvitationRow | null` for the accept route.
   - `createInvitation(input, db?)` -- generates token, sends email via `sendEmail`, audits with `metadata.subKind = 'create'`. Same dual-gate shape as `setUserRole`: ADMIN-only, threads actor identity, audits after the email send returns successfully (an email-send failure ROLLS BACK the row insert).
   - `revokeInvitation(input, db?)` -- soft-delete (sets `revoked_at` + `revoked_by_user_id`). Audits.
   - `resendInvitation(input, db?)` -- regenerates the token, bumps `invited_at`, re-emails. Audits as `subKind = 'resend'`.
   - `acceptInvitation(input, db?)` -- called from the accept route's form action. Validates token + email match + not expired + not already accepted/revoked. Creates the user via `auth.api.createUser` with `proposed_role`. Sets `accepted_at` + `accepted_user_id`. Audits.
3. **Audit emission contract.** Reuse `AUDIT_TARGETS.HANGAR_INVITATION` (new value); the per-op kind goes in `metadata.subKind` from a closed `HANGAR_INVITATION_OP_SUBKINDS` set:
   - `create` (`op = create`, before = null, after = invitation snapshot)
   - `revoke` (`op = update`, before = pending snapshot, after = revoked snapshot)
   - `resend` (`op = action`, before/after both null, metadata carries old/new token-suffix)
   - `accept` (`op = action`, metadata carries `acceptedUserId` + `acceptedRole`)
4. **Hangar surface** at `/users/invitations` (list) + `/users/invitations/[id]` (detail):
   - List: tabs for Pending / Accepted / Revoked / Expired, count per tab, table with `email`, `proposed_role`, `invited_at`, `expires_at`, `invited_by`. ADMIN-only.
   - "Invite user" button at the top opens a `ConfirmDialog` (the same component shipped in users-editing) with `email` + `role` picker + "Send invite" action. On success the new pending invite appears in the list.
   - Detail page: shows the full row + audit history for this invitation. "Revoke" button (typed-confirmation gate on the email -- per decision (c) precedent in users-editing). "Resend" button (no typed gate; resend is recoverable -- new token shipped, old one invalidated).
5. **Accept route on study** at `/invite/[token]`:
   - Public route (no auth gate). The token IS the credential.
   - Server load: fetch invitation by token via `getInvitationByToken`. 404 if not found / accepted / revoked / expired. Render a sign-up form with the email pre-filled (and read-only) and a password field.
   - Form action: validate the password, call `acceptInvitation`. On success: better-auth creates the user + session, redirect to the study dashboard.
   - Public-route policy: this is the **only** non-auth-gated mutation surface in study. Document it as such; the hooks layer should explicitly allow `/invite/[token]` past the layout-level auth gate.
6. **Email template.** New `inviteEmail(url, role, invitedByName)` in `libs/auth/src/email/templates.ts` mirroring the existing `magicLinkEmail` shape. Plain text + html parts (the existing templates only have html; this WP keeps that pattern). Subject: "You've been invited to airboss". Body: who invited them, what role, the click-to-accept link, and the expiry.
7. **Constants additions:**
   - `AUDIT_TARGETS.HANGAR_INVITATION = 'hangar.invitation'` in `libs/constants/src/audit.ts`.
   - `HANGAR_INVITATION_OP_SUBKINDS = { CREATE, REVOKE, RESEND, ACCEPT }` -- closed enum.
   - `ROUTES.HANGAR_USERS_INVITATIONS = '/users/invitations'`, `HANGAR_USERS_INVITATION_DETAIL: (id) => ...`, plus form-action ids `HANGAR_INVITATION_*_ACTION`.
   - `ROUTES.STUDY_INVITE_ACCEPT: (token) => '/invite/' + encodeURIComponent(token)`.
   - `INVITATION_DEFAULT_EXPIRY_DAYS = 7` -- matches decision (a).
   - `INVITATION_TOKEN_BYTES = 32` -- matches decision (b).
8. **Drizzle migration** that creates the `hangar.invitation` table, the unique partial index, the CHECK, and widens `audit.audit_log.target_type` to include `'hangar.invitation'`.
9. **Tests.** Vitest unit for each BC helper (happy path / not-found / already-accepted / already-revoked / expired / role guards / audit emission / email-send failure rolls back the row). The accept route gets manual coverage in `test-plan.md` (real-browser sign-up flow); per the precedent in users-editing, browser-level e2e is deferred to the `hangar-e2e-infrastructure` follow-up.
10. **Help pages.** `/users/invitations` gets a help entry covering the create / revoke / resend flow + the expiry semantics. `/invite/[token]` gets a thin help-page stub (the recipient may have questions about who invited them and what they're consenting to).
11. **Docs updates.** Hangar PRD: new row for `/users/invitations` + `/users/invitations/[id]` under "Shipped" once this lands. Platform ROADMAP: invite-flow row removed from "Near-term."

## Out of scope (explicit)

- **Anonymous self-signup.** No public sign-up form, no link to one. Invites are admin-controlled by design.
- **Bulk invite.** No CSV upload, no "invite N emails" surface. Single-target only for v1; bulk lands when it earns its place (specifically: when a CFI cohort needs to be onboarded).
- **Self-service password reset on accept.** The accept route asks for the password directly. Password reset is a separate flow.
- **Re-invite an already-accepted user.** Once `accepted_at` is set, a second invite for the same email creates a fresh row (different id, different token); the BC's unique partial index allows it because the partial WHERE clause excludes accepted/revoked rows.
- **Invite quotas / rate limits.** A single admin manually creating one invite at a time is the operating mode. If self-service onboarding ever happens (which it won't on Joshua's "private hosted" posture), revisit.
- **Role escalation via invite.** Invites can target any role except `admin`. To grant admin, the existing role picker on `/users/[id]` is the right path. Spec decision (e) below.
- **Invite organizations / teams.** No multi-tenant story today. Keep flat.
- **Better-auth organization plugin.** It carries multi-tenancy machinery we don't want. Hand-roll the table.

## Ratifications (2026-05-02)

User ratified all 10 recommended defaults. Build proceeds against the recommendations below; the alternative options stay for future readers but are no longer live.

| Q   | Decision                                       | Ratified value                                       |
| --- | ---------------------------------------------- | ---------------------------------------------------- |
| (a) | Invite expiry default                          | 7 days                                               |
| (b) | Token shape                                    | 32 bytes from `crypto.getRandomValues`, base64url    |
| (c) | Send-failure semantics                         | Roll back row insert on email-send failure           |
| (d) | Resend regenerates token                       | Yes -- old token invalidated on resend               |
| (e) | Can invite target `admin` role?                | No -- admin grants stay on `/users/[id]` role picker |
| (f) | Allow inviting an existing user's email?       | No -- block + redirect to existing user              |
| (g) | Email pre-filled and read-only on accept page? | Yes                                                  |
| (h) | Audit `targetId` for invite create             | `invitation.id`; recipient email in `metadata.email` |
| (i) | Public accept route lives in study app         | Yes -- `/invite/[token]` with hooks-layer exemption  |
| (j) | Cleanup of expired invites                     | None in v1; future cron WP if table grows            |

## Open questions (history -- now ratified above)

The user resolves each before tasks.md finalizes. **Resolved 2026-05-02; see Ratifications section above.**

### (a) Expiry default

**Recommended:** 7 days. Long enough that a busy CFI gets to it on the weekend; short enough that a stale invite found in someone's inbox months later doesn't open the door.

| Option   | For                                                              | Against                                                  |
| -------- | ---------------------------------------------------------------- | -------------------------------------------------------- |
| 7 days   | Realistic for casual recipients                                  | One round of follow-up may be needed                     |
| 24 hours | Tight; encourages immediate action                               | Misses anyone offline for a day                          |
| 30 days  | "Send and forget"                                                | Stale tokens lying around in inboxes are a security risk |
| No expiry | Simplest                                                         | Same as above; never lapses without explicit revoke     |

### (b) Token shape

**Recommended:** 32 bytes from `crypto.getRandomValues`, encoded base64url (43-char URL-safe string). Standard size; lookup is a unique-index hit.

| Option                        | For                          | Against                                                   |
| ----------------------------- | ---------------------------- | --------------------------------------------------------- |
| 32B random + base64url        | Standard, plenty of entropy  | None                                                      |
| Signed JWT carrying `{id}`    | Stateless verification       | Token revocation requires a denylist; defeats simplicity  |
| HMAC of `id` with server secret | Compact                    | Doesn't gain anything over the random token + DB lookup   |

### (c) Send-failure semantics

**Recommended:** insert the row in the same transaction as the email send; if the email send returns false (or throws), roll the row back. The admin sees a clear failure and retries. No half-state.

| Option                                                       | For                                              | Against                                                                        |
| ------------------------------------------------------------ | ------------------------------------------------ | ------------------------------------------------------------------------------ |
| Roll back on email failure (recommended)                     | No half-state; admin retries cleanly             | Email send happens inside a DB transaction; longer-than-usual transaction      |
| Insert row first, send second; mark "send failed" on error   | Decouples DB from email transport                | Surface needs a "retry send" affordance for the failed-send case               |
| Insert + send asynchronously (job queue)                     | Fast UI feedback                                 | Adds a job kind + a worker dependency; overkill for v1                         |

### (d) Resend regenerates the token

**Recommended:** yes. Resending invalidates the previous token and ships a fresh one. Prevents an old email and a new email from both being valid at once.

| Option                              | For                                                  | Against                                                                |
| ----------------------------------- | ---------------------------------------------------- | ---------------------------------------------------------------------- |
| Regenerate (recommended)            | Old email's token becomes useless                    | Mild surprise if recipient already clicked the old one but not finished |
| Keep same token                     | Recipient can use either email                       | Two valid links per invite; the older one might be in the wrong inbox  |
| Resend without regenerating, but bump expiry | Compromise                                  | Same risk as "keep same token"                                         |

### (e) Can an invite target `admin`?

**Recommended:** no. Invites can target `learner`, `author`, `operator`. To grant admin, the existing role picker on `/users/[id]` is the path -- it has the last-admin guard and the existing audit shape. This sidesteps the question of "an invite lands an admin who never had to clear the explicit promotion bar."

| Option                                  | For                                                                | Against                                                                                          |
| --------------------------------------- | ------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------ |
| Block invite -> admin (recommended)     | Forces admin grants through the existing review path               | Admin creating an admin requires a two-step (invite as operator, then promote)                   |
| Allow with same audit shape             | Single flow                                                        | Skips the explicit promotion step; admin grants don't get the same scrutiny                      |
| Allow with extra confirmation gate      | Catches misclicks                                                  | Slightly more code; the two-step alternative already gives that scrutiny without extra UI surface |

### (f) Allow inviting an existing user's email

**Recommended:** no. If the email already exists in `bauth_user`, the create path returns "User already exists -- use the role picker on `/users/[id]/<id>` to change their role" and links straight to the existing user.

| Option                                | For                                                  | Against                                                          |
| ------------------------------------- | ---------------------------------------------------- | ---------------------------------------------------------------- |
| Block + redirect (recommended)        | Avoids two paths for the same outcome (role change)  | Slight friction if the admin doesn't realize the email exists    |
| Allow; treat as role-change-by-invite | Uniform UX                                           | Two flows reach the same end-state; confusing                    |

### (g) Email pre-fill on accept page is read-only

**Recommended:** yes. The token binds the invite to a specific email; allowing the recipient to change it would let an attacker who intercepts the token paste their own email and become a different role. Email is read-only on the accept form.

| Option                              | For                                              | Against                       |
| ----------------------------------- | ------------------------------------------------ | ----------------------------- |
| Read-only (recommended)             | Token + email bound; intercept attack mitigated  | None                          |
| Editable                            | Recipient who changed email since the invite can use a different one | Opens the intercept attack    |

### (h) Audit row when an invite is created

**Recommended:** the audit row's `targetId` is the invitation id (`inv_*`), not the recipient's user id (which doesn't exist yet). The recipient's email goes in `metadata.email` so audit-explorer queries can find "all invites to alice@example.com" via metadata jsonb.

This is consistent with `hangar.user` audit rows, which use the user id as `targetId`. Invitations are their own row type.

| Option                                                | For                                          | Against                                                                  |
| ----------------------------------------------------- | -------------------------------------------- | ------------------------------------------------------------------------ |
| `targetId = invitation.id` (recommended)              | Each invitation row is a discrete audit target | "All audit rows for this user" needs both `hangar.user` and `hangar.invitation` queries |
| `targetId = recipient.email` (string, not id)         | Easy to filter by recipient                  | Mixes types -- other targets are ids, not strings                        |
| `targetId = accepted_user_id` (null until accepted)   | Joins straight to the user row               | Null targetId on every pending invite breaks "view all on this target"  |

### (i) Public accept route's role in the study app

**Recommended:** the accept route lives in study (`apps/study/src/routes/invite/[token]/+page.{server.ts,svelte}`). Reasoning: study is the learner-facing app and where the new user actually lands. The hooks layer needs an explicit allow-list entry for `/invite/[token]` since the study layout is auth-gated.

| Option                                       | For                                                                  | Against                                                                       |
| -------------------------------------------- | -------------------------------------------------------------------- | ----------------------------------------------------------------------------- |
| Accept on study (recommended)                | Lands directly in the surface they'll use                            | Study hooks need a narrow public-route exemption                              |
| Accept on hangar                             | Hangar already has admin auth                                        | New users land in the operator app, then have to navigate to study           |
| Accept on a future runway app                | Public face                                                          | Runway is deferred; this WP would block on it                                 |

### (j) Cleanup of expired invites

**Recommended:** none in v1. Expired invites stay in the table; the list filters them by default. A future cleanup WP can add a cron job that hard-deletes invites past `expires_at + 90 days` if the table grows.

| Option                              | For                                                            | Against                                  |
| ----------------------------------- | -------------------------------------------------------------- | ---------------------------------------- |
| Leave them (recommended)            | Audit history preserved                                        | Table grows                              |
| Hard-delete on expiry               | Table stays small                                              | Loses audit-row provenance for the invite row |
| Soft-delete on expiry               | Same as recommended; still worth a flag for dashboard tallies | Adds a column for nothing visible        |

## Acceptance

- `/users/invitations` and `/users/invitations/[id]` render against the proposed BC reads with the new schema applied.
- ADMIN-only gate verified: AUTHOR / OPERATOR / learner roles 403 on both routes.
- Create invite -> recipient receives email (Resend in prod, console-log in dev) -> recipient clicks link -> accept page renders with email pre-filled and read-only -> recipient enters password -> account created via `auth.api.createUser` with `proposed_role` -> redirect to study dashboard.
- Audit rows emitted for create / revoke / resend / accept; verifiable in `/admin/audit` filtered by `targetType = hangar.invitation`.
- Revoke makes the token un-redeemable (404 on accept).
- Resend invalidates the old token (404 on the old link, 200 on the new).
- Expired invites 404 on accept (server-side check; the link doesn't simply omit a button).
- Self-target / last-admin guards: invite-to-admin blocked (decision (e)); invite-existing-email blocked with redirect to `/users/[id]` (decision (f)).
- `bun run check` clean. Vitest BC tests pass. ConfirmDialog reused; no new modal component.
- Manual test plan in `test-plan.md` walked end-to-end by Joshua.
- `review_status: done` after `/ball-review-full` closes findings.

## Deferred (with explicit triggers)

| Item                                                 | Trigger to revisit                                            |
| ---------------------------------------------------- | ------------------------------------------------------------- |
| Bulk invite (CSV upload, paste-list)                 | First cohort-onboarding ask (likely a CFI tester group)       |
| Invite quotas / rate limits                          | First abuse signal -- not credible on a private-hosted single-admin platform |
| Cron cleanup of long-expired invites                 | The `hangar.invitation` table exceeds ~10k rows               |
| Re-invite an already-accepted user                   | A real workflow needs it; right now role picker handles this |
| Public sign-up (without invite)                      | Joshua opens the "going public" question                      |
| Browser-level e2e for the full flow                  | `hangar-e2e-infrastructure` lands                              |
| Per-app invitation roles (someone is `author` in study + `operator` in hangar) | Per-app role policy lands as its own cross-cutting WP |

## References

- [Tasks](./tasks.md) -- phased implementation plan (authored after decisions ratified)
- [Test plan](./test-plan.md) -- manual + automated acceptance scenarios
- [Design](./design.md) -- accept-route UX, modal shape, email template content
- [hangar-users-editing](../hangar-users-editing/spec.md) -- predecessor; sets the dual-gate audit + ConfirmDialog pattern
- [hangar-audit-explorer](../hangar-audit-explorer/spec.md) -- read surface for invite audit rows
- [hangar-e2e-infrastructure](../hangar-e2e-infrastructure/spec.md) -- prerequisite for browser-level e2e on this WP
