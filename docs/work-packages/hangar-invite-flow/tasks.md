---
title: 'Tasks: Hangar invite flow'
product: hangar
feature: hangar-invite-flow
type: tasks
status: shipped
review_status: pending
shipped: 2026-05-02
---

Phased implementation per [spec.md](./spec.md). Each phase ends with `bun run check` clean. Decisions in spec are ratified before this file finalises.

## Phase 1 -- Constants + types

- [x] Add `AUDIT_TARGETS.HANGAR_INVITATION = 'hangar.invitation'` to `libs/constants/src/audit.ts`. Add `HANGAR_INVITATION_OP_SUBKINDS` enum (`CREATE`, `REVOKE`, `RESEND`, `ACCEPT`) + values export.
- [x] Add `INVITATION_DEFAULT_EXPIRY_DAYS = 7` and `INVITATION_TOKEN_BYTES = 32` to a new (or existing) hangar constants block.
- [x] Add to `libs/constants/src/routes.ts`:
  - `ROUTES.HANGAR_USERS_INVITATIONS = '/users/invitations'`
  - `ROUTES.HANGAR_USERS_INVITATION_DETAIL: (id) => ...`
  - `ROUTES.STUDY_INVITE_ACCEPT: (token) => '/invite/' + encodeURIComponent(token)`
  - `ROUTES.HANGAR_INVITATION_CREATE_ACTION = '?/createInvitation'`, `_REVOKE_`, `_RESEND_`, `_ACCEPT_` form-action ids.
- [x] Re-export everything from `libs/constants/src/index.ts`.

## Phase 2 -- Drizzle schema + migration

- [x] Add `invitation` table to a new `libs/bc/hangar/src/schema.ts` (or existing if one is co-located) under `hangarSchema`:
  - Columns per spec In Scope #1.
  - Unique partial index on `email` WHERE `accepted_at IS NULL AND revoked_at IS NULL`.
  - CHECK on `proposed_role` against `ROLE_VALUES`.
- [x] Re-derive the audit_log target_type CHECK from `AUDIT_TARGET_VALUES` (which now includes `hangar.invitation`).
- [x] `bunx drizzle-kit generate --name=add_hangar_invitation`. Verify the SQL captures both the new table + the CHECK widening.

## Phase 3 -- Zod schemas

- [x] `libs/bc/hangar/src/invitation-schemas.ts` (new, mirrors `user-write-schemas.ts`):
  - `CreateInvitationInputSchema` -- email (lowercase + valid), proposedRole (enum minus `admin` per decision (e)), confirmEmail none (no typed gate on create per decision precedent).
  - `RevokeInvitationInputSchema` -- invitationId, confirmEmail (typed gate on revoke per decision (c) precedent in users-editing).
  - `ResendInvitationInputSchema` -- invitationId only.
  - `AcceptInvitationInputSchema` -- token, password (min length per `MIN_PASSWORD_LENGTH`).

## Phase 4 -- BC reads + writes

- [x] `libs/bc/hangar/src/invitations.ts` (new):
  - `listInvitations(filters?, db?)` -- supports `status: 'pending' | 'accepted' | 'revoked' | 'expired' | 'all'`. Status is derived (timestamps + `now()`).
  - `getInvitation(id, db?)` and `getInvitationByToken(token, db?)`.
  - `createInvitation(input, db?)`:
    - Validates the email isn't already a `bauth_user` (decision (f)) -- if so, return a typed `EmailAlreadyExistsError` with the existing user id.
    - Generates token via `crypto.getRandomValues(new Uint8Array(INVITATION_TOKEN_BYTES))` -> base64url.
    - Computes `expires_at = invited_at + INVITATION_DEFAULT_EXPIRY_DAYS`.
    - Wraps insert + `sendEmail` in a transaction (decision (c)). If `sendEmail` returns false, rolls back.
    - Audits with `subKind = CREATE`, `before = null`, `after = invitationSnapshot`.
  - `revokeInvitation(input, db?)` -- soft-delete: sets `revoked_at` + `revoked_by_user_id`. Audits.
  - `resendInvitation(input, db?)` -- regenerates token (decision (d)), bumps `invited_at`, re-emails (transactional like create), audits.
  - `acceptInvitation(input, db?)`:
    - Re-validates token + invitation not expired / accepted / revoked.
    - Calls `auth.api.createUser({ body: { email, password, name: '', role: proposedRole }, headers })`.
    - Sets `accepted_at`, `accepted_user_id`. Audits with `subKind = ACCEPT`.
- [x] Vitest unit tests cover every guard + audit emission.

## Phase 5 -- Email template

- [x] Add `inviteEmail(url, role, invitedByName)` to `libs/auth/src/email/templates.ts`. Match the `magicLinkEmail` shape (subject + html). Spec design.md will dictate the copy.

## Phase 6 -- Hangar UI

- [x] `apps/hangar/src/routes/(app)/users/invitations/+page.{server.ts,svelte}` -- list, ADMIN-only.
  - Server load: `listInvitations` per the active tab.
  - Page: tabs (Pending / Accepted / Revoked / Expired / All), table of invites, "Invite user" button opens `ConfirmDialog` with email + role picker.
  - Form action: `?/createInvitation`. On `EmailAlreadyExistsError`, show a banner with a link to the existing user's `/users/[id]`.
- [x] `apps/hangar/src/routes/(app)/users/invitations/[id]/+page.{server.ts,svelte}` -- detail.
  - Server load: `getInvitation` + `listRecentUserAudits` filtered to this invitation id.
  - Page: full row + audit history. Revoke button (typed-gate). Resend button (no typed gate).
- [x] Wire a link on `/users` (the existing list route) to `/users/invitations` so the surface is discoverable.

## Phase 7 -- Study accept route

- [x] `apps/study/src/routes/invite/[token]/+page.{server.ts,svelte}` -- public route.
- [x] `apps/study/src/hooks.server.ts` (or wherever the auth gate lives) -- explicit allow-list for `/invite/<token>` past the layout-level auth check.
- [x] Server load: `getInvitationByToken`. 404 on not-found / expired / revoked / accepted (no leakage).
- [x] Page: sign-up form (email pre-filled, read-only per decision (g); password input).
- [x] Form action: `?/accept`. Calls `acceptInvitation`. On success, the better-auth response includes the new session; redirect to the dashboard.

## Phase 8 -- Help pages

- [x] `apps/hangar/src/lib/help/content/invitations.ts` -- list + detail surface help.
- [x] `apps/study/src/lib/help/content/invite-accept.ts` -- thin help for the recipient.
- [x] Wire both into the respective `pages.ts`.

## Phase 9 -- Verify clean state

- [x] `bun run check` -> 0 errors, 0 warnings.
- [x] `bunx vitest run libs/bc/hangar/src/invitations.test.ts` green.
- [x] Manual smoke per [test-plan.md](./test-plan.md).

## Phase 10 -- Ship

- [x] Commit messages follow the audit-explorer + users-editing precedent (one commit per phase, signed-off).
- [x] Update hangar PRD: new row for `/users/invitations` under Shipped; remove "Invite flow" from "In flight or imminent."
- [x] Update platform ROADMAP: drop the invite-flow line from "Near-term."
- [x] Push branch, open PR with the test-plan checklist embedded in the body.
- [x] After merge, flip WP frontmatter `status: shipped` (per CLAUDE.md, agent flips its own field; user flips `review_status` after smoke).
