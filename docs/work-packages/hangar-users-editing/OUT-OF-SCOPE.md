---
title: 'Out of Scope: Hangar Users Editing'
product: hangar
feature: hangar-users-editing
type: out-of-scope
status: unread
---

# Out of Scope: Hangar Users Editing

Deferred items, why they're deferred, and the trigger that should make
us revisit each. Future agents and humans: do not build these without
the documented trigger. If you think the trigger is hit, surface it
for a decision rather than building silently.

## Summary

| Item                                             | Status       | Trigger to revisit                                                          |
| ------------------------------------------------ | ------------ | --------------------------------------------------------------------------- |
| Invite / onboard flow                            | Follow-on WP | When new contributors need self-service onboarding                          |
| `removeUser` (account deletion)                  | Follow-on WP | When account-deletion request lands or GDPR / retention policy is authored  |
| `impersonateUser`                                | Follow-on WP | When support flow requires "log in as this user" diagnosis                  |
| Editing `name` / `email` / profile fields        | Rejected     | Never -- profile is user-owned                                              |
| Bulk operations                                  | Deferred     | When admin reports needing >5-target ban / role-change in a single incident |
| Per-app role policy                              | Rejected     | Never -- requires full schema redesign                                      |
| Role audit timeline UI (target-scoped)           | Follow-on WP | When target-scoped audit query lands in audit-explorer                      |
| Email notification to banned user                | Follow-on WP | When better-auth email integration ships or a moderation policy demands it  |
| Pagination of the sessions list                  | Rejected     | Never -- `USER_DETAIL_SESSION_LIMIT = 10` + revoke-all covers the tail      |
| Ops dashboard of recent admin actions            | Follow-on WP | When a second admin joins or incident triage needs cross-actor view         |
| Two-admin / dual-control gate                    | Deferred     | When a second admin joins the platform                                      |
| Hangar Playwright e2e infrastructure             | Follow-on WP | When a second hangar admin-write WP wants browser-level e2e coverage        |
| Confirmation gate on role change                 | Deferred     | When misclicks on the role picker become a real issue                       |
| Combined demote + revoke-all shortcut button     | Deferred     | When the two-step friction shows up in actual incident response             |
| Chunked revoke-all for very large session counts | Deferred     | When a target user with hundreds of sessions ever materialises              |

## Invite / onboard flow

Status: Follow-on WP

What was deferred:
The invite-link flow that creates a new `bauth_user` row at `role=learner` and emails a sign-up link. None of that flow ships in this WP; the WP only edits already-existing users.

Why:
Scope discipline. Invite is its own user-facing surface (email templating, token expiry, double-opt-in) and not load-bearing for the admin-write pattern this WP is establishing. The PRD backlog explicitly carves it out as a separate WP.

Trigger to revisit:
When new contributors need self-service onboarding (i.e. the user surface count is large enough that adding new authors / operators by hand stops working).

Implementation pattern when triggered:
Author a new WP under `docs/work-packages/hangar-users-invite/`. Mirror the dual-gate audit + form-action pattern this WP established; reuse `ConfirmDialog.svelte` for any destructive sub-actions (revoke invite, etc.). Better-auth admin plugin has `createUser` -- not used in this WP, would be the entry point for the new flow.

References:

- [spec.md](./spec.md) -- "Out of Scope (explicit)" originally listed this
- [docs/products/hangar/PRD.md](../../products/hangar/PRD.md) -- Backlog row separating invite from editing

## `removeUser` (account deletion)

Status: Follow-on WP

What was deferred:
The `auth.api.removeUser` admin-plugin endpoint. Better-auth exposes it; we do not surface it in this WP. No form action, no UI affordance.

Why:
Account deletion is destructive in a way that role / ban / revoke is not. It implicates retention (which user-owned rows do we keep / scrub?), GDPR (right-to-erasure response shape), and audit policy (do we keep the audit rows after the user is gone? -- yes, but with the target id pointing at a tombstone). That bundle of decisions is its own WP.

Trigger to revisit:
When an account-deletion request lands (user requests their data removed) or when retention / GDPR policy is authored at the platform level.

Implementation pattern when triggered:
Author a new WP under `docs/work-packages/hangar-users-delete/`. Mirror the typed-confirmation modal pattern; gate behind a higher confirmation bar than ban (probably also requires reason + a 24-hour delayed-execution window).

References:

- [spec.md](./spec.md) -- "Out of Scope (explicit)" originally listed this
- [Better Auth admin plugin types](../../../node_modules/better-auth/dist/plugins/admin/admin.d.mts) -- `removeUser`

## `impersonateUser`

Status: Follow-on WP

What was deferred:
The `auth.api.impersonateUser` admin-plugin endpoint. Lets an admin assume another user's session for diagnosis.

Why:
Powerful and dangerous. Impersonation needs its own audit shape (the actor in subsequent audit rows is technically the impersonator, not the impersonated user; mis-attribution is a real risk), session-isolation rules, and a hard time-bounded gate. Punted to its own WP behind an additional gate.

Trigger to revisit:
When a support flow requires "log in as this user" to diagnose an issue that screenshots / logs cannot resolve. Today's tiny user count and direct-channel support model makes this unnecessary.

Implementation pattern when triggered:
Author a new WP. Reuse the typed-confirmation modal. Audit emission needs to capture both the actor (impersonating admin) and the assumed session id. Consider a time-bounded gate (auto-revert after N minutes).

References:

- [spec.md](./spec.md) -- "Out of Scope (explicit)" originally listed this
- [Better Auth admin plugin types](../../../node_modules/better-auth/dist/plugins/admin/admin.d.mts) -- `impersonateUser`

## Editing `name` / `email` / `firstName` / `lastName` / `image` / `address`

Status: Rejected

What was rejected:
Admin-side editing of user-owned profile fields on `bauth_user`.

Why:
These fields are owned by the user, not by an admin. Admins shouldn't rewrite a user's name; that's an impersonation-shaped operation. If a name change is needed for moderation reasons (slur in display name, abuse), that belongs to a moderation WP with its own audit + reason capture, not to general admin user-editing.

Trigger to revisit:
Never via this WP. A moderation-driven name override is a separate problem requiring its own WP and audit shape.

References:

- [spec.md](./spec.md) -- "Out of Scope (explicit)" originally listed this

## Bulk operations

Status: Deferred

What was deferred:
Multi-target form actions ("ban 50 users", "set-role on a multi-select"). The WP ships single-target actions only.

Why:
Single-target is enough for v1 and avoids the foot-gun (one accidental click bans 50 people). Bulk is a power-user surface and warrants its own affordance design.

Trigger to revisit:
When admin reports needing >5-target ban / role-change in a single incident (e.g. spam burst, mass-import correction).

Implementation pattern when triggered:
Build a multi-select list page (rather than detail page) action. Mirror the typed-confirmation gate but require the typed token to encode the count (e.g. type "ban-50-users" to confirm). Audit emits one row per target, not one summary row.

References:

- [spec.md](./spec.md) -- "Out of Scope (explicit)" originally listed this

## Per-app role policy

Status: Rejected

What was rejected:
A schema where a single user can be `author` in study and `operator` in hangar simultaneously, with the apps reading per-app role columns.

Why:
All apps see the same `bauth_user.role` today. Per-app roles is a much bigger schema change (new join table `user_app_role`, every `requireRole` call site updated to take an app key, every audit row tagged with the app). Out of proportion to current need.

Trigger to revisit:
Never via a follow-on to this WP. If per-app roles ever become necessary, it's a platform-level redesign with its own ADR, not a hangar surface change.

References:

- [spec.md](./spec.md) -- "Out of Scope (explicit)" originally listed this
- `libs/auth/src/schema.ts` -- single `role` column on `bauth_user`

## Role audit timeline UI (target-scoped)

Status: Follow-on WP

What was deferred:
A target-scoped audit timeline ("everything that happened TO this user"). Today the audit page shows the actor-scoped audit list at the bottom.

Why:
The audit data is captured here -- every write emits a row with `targetType = HANGAR_USER` and `targetId = userId`. The query and rendering surface is the follow-on; the data is ready.

Trigger to revisit:
When target-scoped audit query support lands in the audit-explorer surface, or when an incident requires "show me everything that happened to user X" as a self-service view.

Implementation pattern when triggered:
Author a new WP that adds a query helper `listAuditByTarget(targetType, targetId)` and surfaces it on the user-detail page. Mirror the existing recent-audit list affordance; filter changes from actor-scoped to target-scoped.

References:

- [spec.md](./spec.md) -- "Out of Scope (explicit)" originally listed this
- [hangar-audit-explorer spec](../hangar-audit-explorer/spec.md)

## Email notification to banned user

Status: Follow-on WP

What was deferred:
An automated "you have been banned" / "your sessions have been revoked" email to the target user.

Why:
Better-auth doesn't auto-mail on these actions; we don't either. Email integration is a separate platform concern (template authoring, send infrastructure, retry / suppression logic) and not load-bearing for the admin-write pattern.

Trigger to revisit:
When better-auth email integration ships, or when a moderation policy demands user notification on ban / session revoke.

Implementation pattern when triggered:
Hook the email send into the BC helpers (`banUserAction`, `revokeAllUserSessions`) after the successful admin-plugin call and before the audit write. Capture the send status in `metadata.notificationSent`.

References:

- [spec.md](./spec.md) -- "Out of Scope (explicit)" originally listed this

## Pagination of the sessions list

Status: Rejected

What was rejected:
A paginator on the sessions table on the user detail page.

Why:
The detail page already shows the most recent N sessions (`USER_DETAIL_SESSION_LIMIT = 10`). Revoke-all covers the long tail. Adding pagination would require a query API and UI affordance for a problem (browse old sessions) that has no real user need: nobody pages through stale sessions; they either revoke a specific recent one or revoke all.

Trigger to revisit:
Never -- the affordance solves a non-problem.

References:

- [spec.md](./spec.md) -- "Out of Scope (explicit)" originally listed this

## Ops dashboard of recent admin actions

Status: Follow-on WP

What was deferred:
A real "recent admin actions" tile (the audit-ping page is the current placeholder).

Why:
The audit-ping page already serves the "did writes work?" debugging role. A real ops dashboard requires query design (filter by op type / actor / target / date range), rendering polish (timeline component), and is more useful when the audit volume gets non-trivial. Not load-bearing for this WP.

Trigger to revisit:
When a second admin joins the platform, or when incident triage needs a cross-actor view of recent admin writes.

Implementation pattern when triggered:
Author a new WP `hangar-admin-actions-dashboard`. Build on the audit-explorer query primitives. Default view = last 24h across all admins.

References:

- [spec.md](./spec.md) -- "Out of Scope (explicit)" originally listed this
- [hangar-audit-explorer spec](../hangar-audit-explorer/spec.md)

## Two-admin / dual-control gate

Status: Deferred

What was deferred:
A workflow where a destructive admin action (ban, account delete) requires a second admin to approve before it takes effect.

Why:
Not a v1 requirement on a single-admin platform; without a second admin, the gate has nobody to approve. The typed-confirmation gate covers the misclick failure mode that dual-control would also address.

Trigger to revisit:
When a second admin joins the platform.

Implementation pattern when triggered:
Author a new WP. Add a pending-action table that captures (actor, target, op, payload, requestedAt). Second admin sees pending actions on a dashboard and clicks approve / reject (each a form action with the same dual-gate + audit pattern as this WP). Original action executes against the BC only after approval.

References:

- [spec.md](./spec.md) -- decision (g) and "Out of Scope (explicit)" originally listed this

## Hangar Playwright e2e infrastructure

Status: Follow-on WP

What was deferred:
A hangar-specific Playwright project with admin auth seed and dev-server orchestration. Today `playwright.config.ts` targets the study app only -- single project, single auth state (learner), single dev server.

Why:
Adding admin-authed hangar specs would require a hangar `global.setup`, a hangar admin auth seed, a separate Playwright project, and dev-server orchestration to boot hangar alongside study. That work is larger than the e2e specs themselves and out of scope for this WP. Manual test scenarios HUE-1 .. HUE-92 + BC unit tests carry the security-critical paths in the meantime.

Trigger to revisit:
When a second hangar admin-write WP (audit-explorer, sources delete, jobs cancel, etc.) wants browser-level e2e coverage. Two WPs sharing the same gap is the signal that the infrastructure work earns its keep.

Implementation pattern when triggered:
Author a new WP `hangar-e2e-infrastructure`. Mirror the study `global.setup` shape at `tests/global.setup.ts`. Add a hangar Playwright project entry with its own `storageState` for an admin user. Orchestrate study + hangar dev servers in the Playwright `webServer` config. Once landed, port the manual scenarios HUE-1 .. HUE-92 (and the equivalent audit-explorer scenarios) into Playwright specs.

References:

- [test-plan.md](./test-plan.md) -- "Deferred automation" section
- [hangar-audit-explorer test-plan](../hangar-audit-explorer/test-plan.md) -- second WP that shares this gap

## Confirmation gate on role change

Status: Deferred

What was deferred:
A confirmation modal on the role-change action. Today it's a `<select>` + Save button with no modal.

Why:
Role change is recoverable (set-back is one click). The picker already requires an explicit Save click after a value change. Adding a modal is friction without clear benefit at v1.

Trigger to revisit:
When misclicks on the role picker become a real issue (a learner accidentally promoted to admin and not caught, or an admin demoted to learner mid-incident).

Implementation pattern when triggered:
Wrap the role-change form in `<ConfirmDialog>` with `dangerLevel="caution"` and no typed gate (the change is recoverable, so typed-gate would be over-fitted). Mirror the unban modal shape.

References:

- [spec.md](./spec.md) -- decision (b)
- `libs/ui/src/components/ConfirmDialog.svelte` -- the modal component to reuse

## Combined demote + revoke-all shortcut button

Status: Deferred

What was deferred:
A single "demote and revoke all sessions" button. Today the admin clicks demote, then clicks revoke-all separately.

Why:
Keeps each action atomic + auditable as its own row. Combined buttons hide intent in the audit log (which action did the admin think they were doing?). Friction is the safety feature here.

Trigger to revisit:
When the two-step friction shows up in actual incident response (e.g. an admin reports they demoted a compromised user but forgot to revoke sessions and the user kept acting maliciously).

Implementation pattern when triggered:
Add a "Demote + revoke-all" form action that calls both BC helpers in sequence within a single typed-confirmation modal. Audit emits two rows (one per underlying op) tagged with a shared `metadata.combinedOpId` so the pair is queryable together. Decision (i) explicitly calls this out as a follow-on.

References:

- [spec.md](./spec.md) -- decision (i)

## Chunked revoke-all for very large session counts

Status: Deferred

What was deferred:
Chunking or backgrounding the `revokeUserSessions` call when the target has many sessions. Today the form action calls better-auth fire-and-forget and reads `revokedCount` from the return value into `metadata.revokedCount`.

Why:
At today's session counts (single-admin platform, modest user base), one synchronous call returns fast enough that chunking is premature optimisation.

Trigger to revisit:
When a target user with hundreds of sessions ever materialises (long-running automated agents, kiosk sign-in patterns, or an actual attack pumping sessions).

Implementation pattern when triggered:
Move `revokeAllUserSessions` behind a hangar job (the `hangar-jobs` lib already exists). Form action queues the job and returns immediately with a "queued" toast; audit row writes after the job completes with the real count.

References:

- [spec.md](./spec.md) -- decision (j)
- `libs/hangar-jobs/` -- the job queue infrastructure to reuse
