---
title: 'Out of Scope: Hangar invite flow'
product: hangar
feature: hangar-invite-flow
type: out-of-scope
status: unread
---

# Out of Scope: Hangar invite flow

Deferred items, why they're deferred, and the trigger that should make
us revisit each. Future agents and humans: do not build these without
the documented trigger. If you think the trigger is hit, surface it
for a decision rather than building silently.

## Summary

| Item                                                | Status       | Trigger to revisit                                                  |
| --------------------------------------------------- | ------------ | ------------------------------------------------------------------- |
| Anonymous self-signup                               | Rejected     | Never -- see detail below                                           |
| Bulk invite (CSV upload, paste-list)                | Deferred     | First cohort-onboarding ask (likely a CFI tester group)             |
| Self-service password reset on accept               | Follow-on WP | When forgot-password / password-reset becomes its own WP            |
| Re-invite an already-accepted user                  | Deferred     | A real workflow needs it; today the role picker covers the use case |
| Invite quotas / rate limits                         | Deferred     | First abuse signal on the platform                                  |
| Role escalation via invite (invite -> `admin` role) | Rejected     | Never -- see detail below                                           |
| Invite organizations / teams                        | Rejected     | Never -- see detail below                                           |
| Better-auth organization plugin                     | Rejected     | Never -- see detail below                                           |
| Cron cleanup of long-expired invites                | Deferred     | `hangar.invitation` table exceeds ~10k rows                         |
| Public sign-up (without invite)                     | Deferred     | Joshua opens the "going public" question on hosting / licensing     |
| Browser-level e2e for the full flow                 | Follow-on WP | `hangar-e2e-infrastructure` lands                                   |
| Per-app invitation roles                            | Follow-on WP | Per-app role policy ships as its own cross-cutting WP               |

## Anonymous self-signup

Status: Rejected

What was deferred / rejected / postponed:
A public sign-up button or form on any airboss surface that lets a
random person create an account without an admin-issued invite.

Why:
Invites are admin-controlled by design. Spec "Out of scope (explicit)"
first bullet: "Anonymous self-signup. No public sign-up form, no link
to one. Invites are admin-controlled by design." Joshua's "private
hosted" posture (see global memory: "License + hosting") makes
self-signup undesirable. Even when the platform opens up, the right
answer is the deferred "Public sign-up" question below, not flipping
this rejection.

References:

- [spec.md](./spec.md) "Out of scope (explicit)" first bullet
- Global memory: project_license_and_hosting

## Bulk invite (CSV upload, paste-list)

Status: Deferred

What was deferred / rejected / postponed:
A surface that accepts more than one invite at a time (CSV upload,
newline-separated paste-list, or similar). v1 is single-target only.

Why:
"Single-target only for v1; bulk lands when it earns its place
(specifically: when a CFI cohort needs to be onboarded)." A single
admin manually inviting one user at a time is the operating mode.

Trigger to revisit:
First cohort-onboarding ask -- likely a CFI tester group, or any
moment where the admin needs to invite more than ~5 people.

Implementation pattern when triggered:
Mirror the existing single-invite form. Add an "Invite many" affordance
that accepts CSV / paste-list, validates each row, and surfaces
per-row errors before queuing the writes. Per-invite still goes through
`createInvitation` so audit rows and email-send semantics stay
identical to the single-invite path.

References:

- [spec.md](./spec.md) "Out of scope (explicit)" -- "Bulk invite"
- [spec.md](./spec.md) "Deferred (with explicit triggers)" table

## Self-service password reset on accept

Status: Follow-on WP

What was deferred / rejected / postponed:
A "set new password later" flow on the accept page. v1 asks for the
password directly during accept.

Why:
"The accept route asks for the password directly. Password reset is a
separate flow." Conflating accept with reset would bloat the accept
page and confuse the recipient.

Trigger to revisit:
When forgot-password / password-reset becomes its own WP. The token +
accept-route pattern this WP establishes will be reused.

Implementation pattern when triggered:
New WP that follows the same token + `sendEmail` + redemption-route
shape this WP establishes (see [spec.md](./spec.md) "Why this WP
exists": "Sets the email-with-redemption-link pattern. Every later flow
that sends an actionable email reuses the token + accept-route shape
this WP establishes.").

References:

- [spec.md](./spec.md) "Out of scope (explicit)" -- "Self-service password reset on accept"

## Re-invite an already-accepted user

Status: Deferred

What was deferred / rejected / postponed:
A workflow that creates a second invite for a user who has already
accepted a prior invite (e.g. to reset their account, or to issue a
different role).

Why:
Once `accepted_at` is set, role changes flow through the existing role
picker on `/users/[id]` (per spec decision (f) and the predecessor WP
`hangar-users-editing`). Re-inviting an existing user would be a second
way to reach the same end-state. Worth noting: the BC's unique partial
index already allows a fresh invite row for the same email if the
prior was accepted/revoked -- the gap is UX, not schema.

Trigger to revisit:
A real workflow needs it (e.g. user forgot their password AND
forgot-password / password-reset isn't implemented yet, OR an admin
wants to revoke + re-issue at a new role).

Implementation pattern when triggered:
The BC already supports it via a fresh `createInvitation` call. Add a
"Re-invite" affordance on `/users/[id]` next to the role picker; gate
on the same ConfirmDialog pattern as revoke. Audit as a `create`
sub-kind with `metadata.reInviteOf = <prior invitation id>`.

References:

- [spec.md](./spec.md) "Out of scope (explicit)" -- "Re-invite an already-accepted user"
- [spec.md](./spec.md) "Deferred (with explicit triggers)" table
- [design.md](./design.md) deferred items list

## Invite quotas / rate limits

Status: Deferred

What was deferred / rejected / postponed:
Quota enforcement on the number of pending or recent invites an admin
can create. No rate limit on the create endpoint either.

Why:
"A single admin manually creating one invite at a time is the operating
mode." Per Joshua's private-hosted posture, an abuse signal isn't
credible.

Trigger to revisit:
First abuse signal on the platform. Self-service onboarding becoming a
product direction would also trigger this (paired with the "Public
sign-up" deferral below).

Implementation pattern when triggered:
Per-actor rate limit on `createInvitation` in the BC (e.g. via a small
in-memory token bucket keyed on `invited_by_user_id`). Gate at the
form-action layer with an explicit "rate limited" error. For higher
load, externalise the counter to Postgres or Redis.

References:

- [spec.md](./spec.md) "Out of scope (explicit)" -- "Invite quotas / rate limits"
- [spec.md](./spec.md) "Deferred (with explicit triggers)" table

## Role escalation via invite (invite -> `admin` role)

Status: Rejected

What was deferred / rejected / postponed:
The ability to set `proposed_role = 'admin'` on an invitation. Spec
decision (e): "Invites can target any role except admin. To grant
admin, the existing role picker on `/users/[id]` is the right path."

Why:
The role picker on `/users/[id]` already has the last-admin guard and a
two-confirmation pattern from `hangar-users-editing`. Letting an invite
short-circuit that gate would skip the explicit promotion bar. An
admin who wants to create another admin does the two-step (invite as
operator, then promote) -- the friction is intentional.

References:

- [spec.md](./spec.md) Ratifications (e)
- [spec.md](./spec.md) "Open questions" (e) -- options analysed
- [docs/work-packages/hangar-users-editing/spec.md](../hangar-users-editing/spec.md) (role picker + last-admin guard)

## Invite organizations / teams

Status: Rejected

What was deferred / rejected / postponed:
Multi-tenant invite shape: inviting someone "to organisation X" rather
than just "to airboss."

Why:
"No multi-tenant story today. Keep flat." Airboss is single-tenant by
posture. Multi-tenancy would change the auth model, the role model,
and the route shape across the platform, not just the invite flow.

A re-decision needs a product direction change (e.g. airboss as a
multi-school platform). Cost of unwinding the flat model later is
much higher than the cost of carrying the flat model now.

References:

- [spec.md](./spec.md) "Out of scope (explicit)" -- "Invite organizations / teams"

## Better-auth organization plugin

Status: Rejected

What was deferred / rejected / postponed:
Using better-auth's organization plugin instead of the hand-rolled
`hangar.invitation` table.

Why:
"Better-auth organization plugin -- it carries multi-tenancy machinery
we don't want. Hand-roll the table." The organisation plugin bundles
multi-tenant org tables, team tables, and member tables that don't fit
airboss's flat model. Hand-rolling the invitation table is smaller,
clearer, and keeps invites a hangar concern (in the hangar schema,
not the better-auth schema).

A re-decision requires multi-tenancy to land first (see Reject above).

References:

- [spec.md](./spec.md) "Out of scope (explicit)" -- "Better-auth organization plugin"
- [spec.md](./spec.md) Anchors -- "Avoid better-auth's organization plugin"

## Cron cleanup of long-expired invites

Status: Deferred

What was deferred / rejected / postponed:
A scheduled job that hard-deletes (or soft-deletes) invites past
`expires_at + 90 days`. v1 leaves expired invites in the table.

Why:
Spec decision (j): "None in v1. Expired invites stay in the table; the
list filters them by default. A future cleanup WP can add a cron job
that hard-deletes invites past `expires_at + 90 days` if the table
grows." Audit history value > table-size savings while volume is low.

Trigger to revisit:
`hangar.invitation` table exceeds ~10k rows, OR a privacy/retention
policy decision forces a retention window.

Implementation pattern when triggered:
New scheduled job under `scripts/scheduled-jobs/` (see
[scripts/scheduler/README.md](../../../scripts/scheduler/README.md))
that hard-deletes invites where `expires_at < now() - interval '90 days'`
AND `accepted_at IS NULL`. Audit the deletion as a `system` actor with
`metadata.subKind = 'cleanup'`. Coordinate with audit-explorer to
ensure the cleanup rows are visible.

References:

- [spec.md](./spec.md) Ratifications (j)
- [spec.md](./spec.md) "Deferred (with explicit triggers)" table
- [design.md](./design.md) deferred items list

## Public sign-up (without invite)

Status: Deferred

What was deferred / rejected / postponed:
A public sign-up form on any airboss surface. Different from
"Anonymous self-signup" above only by intent: that one is rejected
forever as long as the platform is private; this one is deferred
behind the "going public" decision.

Why:
Tied to Joshua's "private hosted" posture (see global memory:
`project_license_and_hosting`). Opening sign-up is a platform-direction
decision, not a feature decision.

Trigger to revisit:
Joshua opens the "going public" question on hosting / licensing.

Implementation pattern when triggered:
Likely a new app surface (runway?) or a new study route. Reuse the
accept-route shape this WP establishes; the form just creates the user
directly rather than redeeming a token.

References:

- [spec.md](./spec.md) "Deferred (with explicit triggers)" -- "Public sign-up"
- Global memory: project_license_and_hosting

## Browser-level e2e for the full flow

Status: Follow-on WP

What was deferred / rejected / postponed:
Playwright e2e coverage of the full invite -> email -> accept ->
sign-in flow in a real browser. v1 covers the BC unit tests +
manual test plan walkthrough.

Why:
Per the precedent in `hangar-users-editing`: browser-level e2e on
auth-mutation flows is deferred to the `hangar-e2e-infrastructure`
follow-up WP. Doing it inline would block this WP on test infrastructure
that's better landed once.

Trigger to revisit:
`hangar-e2e-infrastructure` lands.

Implementation pattern when triggered:
Mirror the Playwright e2e patterns shipped by `hangar-e2e-infrastructure`.
Cover: create invite (admin), receive email (test transport in fake-mode),
accept (sign-up), redirect to study. Plus the revoke / resend / expired
paths.

References:

- [spec.md](./spec.md) "Deferred (with explicit triggers)" -- "Browser-level e2e"
- [docs/work-packages/hangar-e2e-infrastructure/spec.md](../hangar-e2e-infrastructure/spec.md)
- [design.md](./design.md) deferred items list

## Per-app invitation roles

Status: Follow-on WP

What was deferred / rejected / postponed:
Roles scoped per-app (e.g. someone is `author` in study and `operator`
in hangar). v1 has flat global roles only.

Why:
Per-app role policy is a cross-cutting concern that affects the role
model, the route guards, and the audit row shape across every surface.
Doing it inside the invite WP would either ship a half-version (invites
support per-app roles but the rest of the system doesn't) or block
this WP on a much larger redesign.

Trigger to revisit:
A per-app role policy WP lands. At that point, the invite flow becomes
a consumer of the new role model.

Implementation pattern when triggered:
Mirror whatever per-app role shape lands. Add `proposed_app` to the
`hangar.invitation` row alongside `proposed_role`. UI: per-app role
picker in the invite form. Accept-route writes the per-app role at user
creation time.

References:

- [spec.md](./spec.md) "Deferred (with explicit triggers)" -- "Per-app invitation roles"
