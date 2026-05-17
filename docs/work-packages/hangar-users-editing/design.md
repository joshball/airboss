---
title: 'Design: Hangar Users Editing'
product: hangar
feature: hangar-users-editing
type: design
status: unread
review_status: pending
---

# Design: Hangar Users Editing

Rationale, alternatives, and decisions for [spec.md](./spec.md). Read the spec first; this document explains why the spec is shaped the way it is.

## Problem in one paragraph

The hangar `/users` directory is read-only. Adding write operations is straightforward in mechanics (call better-auth's admin plugin, audit the result) and load-bearing in pattern (this is the FIRST admin-write surface in hangar; whatever shape we land becomes the template every later admin-write WP copies). The interesting decisions are not "how do we ban a user" -- better-auth answers that. They are "how do we surface dangerous actions safely without making the safe actions tedious," "where does the BC-side write helper live," and "what does the audit row's `before/after` look like so a human reading it tomorrow can reconstruct what happened."

## Pattern this WP establishes

Every later admin-write surface in hangar will follow the same shape:

1. **Per-page auth gate.** `requireRole(event, ROLES.ADMIN)` in load AND in every form action. The dual-gate auth contract in `libs/auth/src/auth.ts:27-86` is non-negotiable. Layout-only gating is a security bug.
2. **Form actions in `+page.server.ts`.** No API endpoints. SvelteKit form actions or nothing.
3. **Zod-validated input.** Schema lives next to the form action's BC helper, not inline.
4. **BC helper does the work.** The form action is a thin shell: parse, gate, call BC, audit, return result. The BC helper is the unit of business logic and the unit of test.
5. **Audit row written in the same call.** Every write emits exactly one audit row. The audit write is not optional, deferred, or "best-effort." When the BC helper returns successfully, the audit row exists.
6. **Confirmation modal for destructive actions.** Reusable `ConfirmDialog` component (extends the existing `libs/ui/src/components/ConfirmDialog.svelte`). Typed-confirmation gate (admin types target email or equivalent). Caution / danger styling.
7. **Routing constants.** Form action ids in `ROUTES`. Pages reference the constants; never inline strings.

This WP ships steps 1-7 once. Future admin-write WPs ship steps 1-5 + reuse the `ConfirmAction` component from step 6 + reuse the routing-constant convention from step 7.

## Why better-auth's admin plugin is the right primitive

Three options for actually mutating `bauth_user`:

| Option                                                          | For                                                                                                                                                          | Against                                                                                                                                                              |
| --------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Call `auth.api.setRole` etc. directly from the BC (recommended) | Better-auth owns `bauth_user`. Going through the admin plugin honors the contract -- ban-expiry handling, session invalidation on ban, etc. all "just work." | A coupling: our BC depends on better-auth's surface API. Future better-auth upgrades may shift the signatures. Test mocks must match.                                |
| Drizzle UPDATE direct against `bauth_user`                      | No dependency on better-auth's admin plugin. Tighter control.                                                                                                | Re-implements better-auth's ban-side-effects (auto-revoke sessions on ban, auto-unban on expired ban). Bypasses the admin plugin's gating. Diverges from the source. |
| HTTP fetch to `/api/auth/admin/*` from server-side code         | Mimics what a client would do -- ensures admin plugin gating runs.                                                                                           | Fetch overhead from the server. Same coupling cost as direct call but with worse perf and harder error handling.                                                     |

Direct `auth.api.setRole` etc. wins. The admin plugin runs its own auth check (verifies the caller is admin via headers); we forward the request's headers untouched. Result: better-auth verifies the admin plugin gate AND we verify the page-level gate. Belt and suspenders.

The `logout/+page.server.ts` precedent confirms this is how hangar already calls better-auth's handlers.

## Audit row shape

The audit table (`audit.audit_log`) has `op`, `target_type`, `target_id`, `before`, `after`, `metadata`. We use these as follows:

| Op                  | `op`     | `target_type` | `target_id`    | `before`                                  | `after`                                                | `metadata.subKind`   | `metadata` extras                                          |
| ------------------- | -------- | ------------- | -------------- | ----------------------------------------- | ------------------------------------------------------ | -------------------- | ---------------------------------------------------------- |
| Set role            | `update` | `hangar.user` | target user id | `{ role: oldRole }`                       | `{ role: newRole }`                                    | `role-assign`        | requestId, userAgent, actorEmail                           |
| Ban                 | `update` | `hangar.user` | target user id | `{ banned, banReason, banExpires }`       | `{ banned, banReason, banExpires }`                    | `ban`                | requestId, userAgent, actorEmail                           |
| Unban               | `update` | `hangar.user` | target user id | `{ banned: true, banReason, banExpires }` | `{ banned: false, banReason: null, banExpires: null }` | `unban`              | requestId, userAgent, actorEmail                           |
| Revoke one session  | `action` | `hangar.user` | target user id | `null`                                    | `null`                                                 | `session-revoke`     | requestId, userAgent, actorEmail, revokedSessionId         |
| Revoke all sessions | `action` | `hangar.user` | target user id | `null`                                    | `null`                                                 | `session-revoke-all` | requestId, userAgent, actorEmail, revokedCount, revokedOwn |

Decisions baked in:

- **`target_type` is the user table, not the operation.** A reader querying "every change to user X" sorts by timestamp on `target_id`. They do not have to UNION across `hangar.user.role`, `hangar.user.ban`, etc.
- **`subKind` carries the operation.** Indexable via `metadata->>'subKind'`. Closed enum (`HANGAR_USER_OP_SUBKINDS`). Trivial to filter by.
- **`before` / `after` carry only the columns the op touches**, not the whole user row. A `setRole` audit row has `{ role }` snapshots, not `{ id, email, name, ... }`. This keeps rows tight and makes diffing legible. Reconstructing the full row at any moment is `getUser` + walk back.
- **Session revoke uses `op=action`**, not `update`. A revoke isn't a row mutation on `bauth_user`; it deletes a `bauth_session` row. The action classifier covers it.
- **`actorEmail` is denormalized into metadata.** `actorId` is the FK; the email is the human-readable handle. Saves a join on every audit-list render.

## Confirmation UX

The interesting axes:

1. **Which actions need a confirmation gate at all?**
2. **What kind of gate (simple click vs typed confirmation)?**
3. **Where does the modal component live?**

### Which actions

| Action              | Recoverable?                             | Recommendation                          |
| ------------------- | ---------------------------------------- | --------------------------------------- |
| Set role            | Yes (set it back)                        | No gate                                 |
| Ban                 | Sort of (unban) -- but sessions are gone | Typed-confirmation gate                 |
| Unban               | Yes -- but the user has to sign in fresh | Simple gate (click OK in a small modal) |
| Revoke one session  | No (the session token is gone forever)   | Typed-confirmation gate                 |
| Revoke all sessions | No (every session token is gone)         | Typed-confirmation gate, count in copy  |

The gating is asymmetric on purpose: the safe direction (unban) gets a lighter gate than the unsafe direction (ban). This mirrors GitHub's "delete repository" flow -- destructive op gets the typed gate, undo doesn't.

### Why typed-confirmation (and not just a confirm dialog)

The typed-confirmation gate (admin types the target user's email to confirm) does three things:

1. **Reads the target identity into the admin's brain.** The admin can't muscle-memory through it. They must look at the user they are operating on.
2. **Defends against tab-confusion.** A common admin failure mode is "I had two tabs open, banned the wrong user." Typing the email forces the admin to verify the tab.
3. **Defends against UI race conditions.** If a stale page load somehow surfaces a misclickable button, the typed gate is still a chokepoint.

The cost is one extra interaction per dangerous action. For a single-admin platform doing maybe one ban / month, the cost is invisible.

The simple-confirm alternative ("are you sure? yes/no") is less protective and not measurably faster -- the click count is the same; only the typing differs.

### Why a shared `ConfirmDialog` component in `@ab/ui`

Three places it could live:

| Location                                                                       | For                                                                   | Against                                                                                                                                      |
| ------------------------------------------------------------------------------ | --------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------- |
| `libs/ui/src/components/ConfirmDialog.svelte` (recommended -- extend in place) | Reused by every admin-write surface across every app. Already exists. | New props (`typedConfirmation`, `dangerLevel`) added additively; theme-tokens test must keep passing.                                        |
| `apps/hangar/src/lib/components/ConfirmDialog.svelte`                          | Local. Ships only if hangar uses it.                                  | Three months from now sources, references, jobs, sim, study all need the same component and someone copy-pastes. Convergent finding waiting. |
| Inline in `+page.svelte`                                                       | Zero new component.                                                   | Three modal flavours inline. Drift across the four actions in this WP alone.                                                                 |

Putting it in `@ab/ui` from day one reflects the reality: this is a platform component. Future WPs that need it import; they don't redesign.

> **Build-phase correction (2026-04-30):** the spec originally proposed a new `ConfirmAction.svelte`. We discovered `libs/ui/src/components/ConfirmAction.svelte` already exists as an inline two-step confirm widget with five active consumers in `apps/study/`. To avoid collision, the reusable modal lives at `ConfirmDialog.svelte` (extends the existing snippet-based, form-aware modal already in `libs/ui/`). The existing `ConfirmAction.svelte` is left untouched.

### Why the modal IS the form

A pattern question: is the modal a `<dialog>` containing a `<form>`, or two separate things?

The recommended shape: `<form method="post" action={formAction}>` is the modal's root element (within the dialog wrapper). The submit button is the form's submit. The typed-confirmation input is a regular form field whose value is checked client-side to enable the submit and re-checked server-side.

Reasons:

- One submission path. Modal close + form submit are decoupled events; if the form is part of the modal, the lifecycle is tighter.
- Server-side re-check is automatic. The `confirmEmail` field arrives in the form action's `formData`; the action validates it the same way it validates any other field. The client-side gate is UX, not security.
- SvelteKit's `use:enhance` works naturally on the form-as-modal -- progressive enhancement gives us success/error handling without page reload, and a no-JS browser still gets a full POST + page reload.

## Form action shape

Each form action follows the same skeleton:

```typescript
async setRole(event) {
  const user = requireRole(event, ROLES.ADMIN);
  const formData = await event.request.formData();
  const parsed = SetUserRoleInputSchema.safeParse({
    targetUserId: event.params.id,
    newRole: formData.get('newRole'),
  });
  if (!parsed.success) return fail(400, { error: 'Invalid input.' });

  try {
    const result = await setUserRole({
      actorId: user.id,
      targetUserId: parsed.data.targetUserId,
      newRole: parsed.data.newRole,
      headers: event.request.headers,
    });
    return { ok: true, op: 'set-role', user: result.user };
  } catch (err) {
    if (err instanceof SelfTargetForbiddenError) return fail(409, { error: err.message });
    if (err instanceof LastAdminError) return fail(409, { error: err.message });
    if (err instanceof BetterAuthApiError) return fail(409, { error: err.message });
    throw err; // unhandled -> 500 via SvelteKit's error boundary
  }
}
```

Reasons for the shape:

- **`requireRole` first, before reading formData.** A non-admin's POST never even gets parsed.
- **Schema validates first, BC second.** The BC helper assumes valid input; the schema is the gate.
- **Targeted catches mapped to 409.** `SelfTargetForbiddenError`, `LastAdminError`, `BetterAuthApiError` are domain errors; their messages are user-friendly. 409 is "this is a state conflict, not a bug."
- **Unhandled errors propagate.** A 500 lands in the SvelteKit error boundary; the page renders a "something went wrong" UI. We don't swallow.

The page's `use:enhance` handler reads `result.ok` for the success branch and `result.error` for the failure branch. Toast or inline notice based on the op.

## Self-target guards

Three operations interact with self-targeting:

- **Set role** -- self-demote-out-of-admin is a single-admin platform foot-gun. Hard-block.
- **Ban** -- self-ban is absurd. Hard-block.
- **Session revoke** -- self-revoke is useful (kill stale device). Allow.

The recommendation in [Open Question (g)](spec.md#g-self-target-guards) is the principled position: block irreversible self-foot-guns, allow self-revoke because the admin clearly knows what they are doing.

When the admin revokes their own current session via revoke-all, the form action's response indicates `revokedOwn: true` and the page redirects to `/login`. This is the only flow where the admin user is intentionally signed out by their own action. The audit row is written first (so the trail records the admin's own action) and the redirect happens after.

## Last-admin guard

The last-admin demotion guard is a critical correctness check, not a UX nicety:

- A platform with zero admins is unrecoverable from inside the platform. Recovery requires DB shell access.
- The guard runs in the BC (`assertNotLastAdmin`) before `auth.api.setRole`, so even a programmatic caller is protected.
- The guard counts admins via `countUsersByRole({}, db)` -- existing function. No new query.

Race window: two admins both demote each other "simultaneously." Both pass the guard at their respective moments (each sees the other still as admin). Both succeed. Result: zero admins.

The race is mitigated by the typed-confirmation gate -- a real user demoting another admin isn't going to hit the same millisecond. If we ever need a hard guarantee, the demote operation can run inside a serializable transaction with a fresh count after the role flip and a rollback if the post-count is zero. Defer until the bug surfaces.

## Cookie-cache TTL implication

`createAuth` sets `cookieCache.maxAge = 5 * 60`. Better-auth caches the session lookup result in a signed cookie, refreshing every 5 minutes. The implication for revoke:

- Revoke a session at `T0`.
- The target's browser, with a cache hit, may continue to authorize requests until `T0 + 5min`.
- After the cache expires (or the user clears it), the next request walks the DB, sees the missing session, bounces to `/login`.

We acknowledge this in the modal copy ("User will be logged out within 5 minutes") rather than tightening the cache. Tightening to e.g. 30s burns DB roundtrips on every authed request and is the wrong trade-off.

For a hard "kick out NOW" requirement (security incident), the right fix is to ban the user (which invalidates the session AND the cache because better-auth checks `banned` on every cache validation, not just every DB walk). Documented in the runbook section of `docs/products/hangar/PRD.md` if/when that doc gains a runbook.

## Why no impersonation in this WP

Better-auth's admin plugin exposes `impersonateUser`. We do not surface it.

Reasons:

- **Impersonation is the most powerful action an admin can take.** A leaked admin session that can impersonate is a leaked everyone session.
- **It deserves its own gating policy.** Two-admin approval, time-bounded sessions, separate audit shape (impersonation is not a "ban" or a "role-assign"; it's its own thing).
- **It deserves its own UI shape.** A "stop impersonating" affordance everywhere. A clear visual indicator that you are NOT yourself right now.

Better as a dedicated WP with its own design pass.

## Why no `removeUser` in this WP

`removeUser` deletes the `bauth_user` row + cascading cleanup. Considerations:

- **Audit rows reference `actorId`** with `onDelete: 'set null'`. A removed user's audit history loses the actor handle. Survivable but ugly.
- **Foreign keys across the app** -- card authorship, scenario reps, study plans, goals -- assume a user row exists. Removal needs a cascade plan.
- **GDPR / data-retention policy** intersects here. Pure delete vs anonymize vs soft-delete is a real product decision.

None of those are decisions to make in this WP. Ban + session-revoke covers the immediate need (stop the user from accessing the platform). Real removal is a separate WP.

## Alternatives considered

### Why not a dedicated `/users/[id]/edit` page

We could split the read-only detail (`/users/[id]`) and the editing surface (`/users/[id]/edit`). Both routes exist; one is for viewing, one is for editing.

Rejected:

- The edit affordances are small (one role picker, one ban toggle, one revoke column). They don't justify a second route.
- Switching pages between viewing and editing breaks flow ("I want to ban this user; I see them; but now I have to navigate to the edit page first").
- The dual-gate (`requireRole(ADMIN)` in load + every action) is uniform across both reads and writes here. No security argument for splitting.

### Why not API endpoints

`+server.ts` files in `/users/[id]/role/+server.ts` etc. would expose JSON endpoints, called from a SPA-style page.

Rejected:

- The CLAUDE.md rules say "SvelteKit form actions (no API endpoints)" for surface-level writes. The form action is the surface; the BC is the implementation.
- Form actions get progressive enhancement for free (no-JS browsers still work).
- API endpoints would force CSRF design decisions that form actions handle.

### Why not toast-based undo

A "Banned. Undo?" toast that auto-cancels the ban within 5 seconds is a common UX. We don't ship it.

Rejected:

- Better-auth's ban side-effects (session invalidation) happen immediately. Undoing within 5 seconds wouldn't restore the sessions.
- The audit trail with two rows (ban + immediate-undo) is noisier than a single rejected-confirmation modal.
- The typed-confirmation gate already covers misclick prevention. Undo is redundant.

### Why not store before/after as full user-row JSON

A simpler design: capture the entire `bauth_user` row in `before` and `after`. Deserialize for any future "show me this user's full history" view.

Rejected:

- Audit rows accumulate fast. A full row snapshot per write balloons the table.
- The set of mutated columns per op is small and known. Storing only the touched columns is more legible AND smaller.
- For "show me the full user row at time T" we walk audit rows + apply `after` deltas in order. Linear-time reconstruction. Acceptable.

## Decisions

| #   | Decision                                                                                         | Why                                                                                                             | Alternative considered          |
| --- | ------------------------------------------------------------------------------------------------ | --------------------------------------------------------------------------------------------------------------- | ------------------------------- |
| 1   | Better-auth's admin plugin is the mutation primitive (direct `auth.api.*` from BC).              | Honors the source-of-truth contract on `bauth_user`. Side-effects (ban-revoke, expiry handling) come along.     | Drizzle UPDATE direct.          |
| 2   | Single `AUDIT_TARGETS.HANGAR_USER` + `metadata.subKind` for op classification.                   | Tight enum. Existing pattern from audit-ping. Per-op queries via JSONB.                                         | Five separate target types.     |
| 3   | Typed-confirmation gate on ban / revoke / revoke-all; simple gate on unban; no gate on set-role. | Asymmetric protection -- destructive ops gate harder. Recoverable ops don't.                                    | Uniform gating; no gate at all. |
| 4   | `ConfirmAction.svelte` lives in `@ab/ui`.                                                        | Reusable across every future admin-write surface.                                                               | Local to hangar.                |
| 5   | Form actions, not API endpoints.                                                                 | Project rule + progressive enhancement.                                                                         | `+server.ts`.                   |
| 6   | Self role-change and self-ban are hard-blocked. Self session-revoke allowed.                     | Block irreversible self foot-guns. Allow self-revoke (kill stale device).                                       | Block all self-targeting.       |
| 7   | Last-admin demotion is hard-blocked.                                                             | Zero-admin platform is unrecoverable from inside.                                                               | Allow + warn.                   |
| 8   | Audit `before/after` carry only the touched columns.                                             | Tight rows, legible diffs. Full reconstruction via walk.                                                        | Full user-row snapshots.        |
| 9   | New BC module `libs/bc/hangar/src/user-writes.ts`.                                               | Read/write split is clear. `users.ts` stays read-only.                                                          | Extend `users.ts`.              |
| 10  | Cookie-cache TTL of 5 min is the upper bound on revoke propagation. We don't tighten it.         | Tightening burns DB on every authed request. UI copy acknowledges the window.                                   | Tighten cache to 30s.           |
| 11  | No impersonation, no remove-user in this WP.                                                     | Each is its own design surface. This WP is already establishing the pattern; piling on more dilutes the review. | Ship everything together.       |
| 12  | Form-action ids live in `ROUTES`.                                                                | Project rule -- no inline path/action strings.                                                                  | Inline strings.                 |

## Risks

| Risk                                                                                                                                                                           | Mitigation                                                                                                                                                                                                                                                                        |
| ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Better-auth admin plugin signature changes on upgrade.                                                                                                                         | BC helpers are the only callers. Tests mock the surface; an upgrade breaks tests at the BC layer, not at every form action.                                                                                                                                                       |
| The typed-confirmation gate doesn't actually prevent misclicks (admin always types correctly).                                                                                 | The point isn't "the admin can't type" -- it's "the admin reads the email." Even a fast-typing admin must look at the target's email. Bug-by-tab-confusion is the prevented case.                                                                                                 |
| Cookie-cache TTL means revoke isn't instant -- a user complains.                                                                                                               | Modal copy acknowledges. Real "kick out now" is ban (which clears the cache validation). Document in PRD.                                                                                                                                                                         |
| Last-admin race (two admins demote each other simultaneously).                                                                                                                 | Mitigated by typed-gate UX. Hard guarantee deferred until needed -- would require serializable transaction with post-count check.                                                                                                                                                 |
| Audit row is written but the better-auth call rolled back (transactional mismatch).                                                                                            | Audit is written AFTER the better-auth call returns successfully. If better-auth throws, we don't audit. Better-auth's writes aren't in our transaction; we accept that gap. (Belt-and-suspenders: a failed audit write doesn't fail the action -- the action already succeeded.) |
| Confirmation modal has accessibility regressions (focus trap leaks, Esc doesn't close).                                                                                        | E2E tests cover focus trap, Esc, backdrop click. Vitest mounts test the component in isolation.                                                                                                                                                                                   |
| `ConfirmAction` component grows so many props it becomes ungovernable.                                                                                                         | Keep it tight: title, body snippet, confirm/cancel text, dangerLevel, optional typedConfirmation, formAction. No optional themes / no slot-on-each-side. If a feature needs more, refactor or accept a sibling component.                                                         |
| Future WP wants ConfirmAction WITHOUT a form (e.g. an in-page state change).                                                                                                   | The current shape is form-anchored. If a non-form use case appears, factor a `Confirm.svelte` substrate and have `ConfirmAction.svelte` wrap it with the form. Defer until the second use case shows up.                                                                          |
| Hangar's existing detail page renders the ban badge based on a server-side `data.user.banned` boolean. After unban via form action, the page must reload to see the new state. | `use:enhance` invalidates the load on success, so the badge updates without a full page reload. Tested in HUE-4.                                                                                                                                                                  |

## References

- [Spec](./spec.md)
- [Tasks](./tasks.md)
- [Test plan](./test-plan.md)
- `libs/auth/src/auth.ts` -- dual-gate auth contract
- `libs/auth/src/server.ts` -- cookie-cache TTL
- `libs/audit/src/log.ts`, `libs/audit/src/schema.ts` -- audit primitives
- `libs/constants/src/audit.ts`, `libs/constants/src/roles.ts` -- enums
- `apps/hangar/src/routes/(app)/admin/audit-ping/+page.server.ts` -- precedent for the form-action -> audit-write pattern
- `apps/hangar/src/routes/logout/+page.server.ts` -- precedent for calling better-auth handlers from a form action
- `node_modules/better-auth/dist/plugins/admin/admin.d.mts` -- admin plugin types
- [Hangar VISION](../../products/hangar/VISION.md), [Hangar PRD](../../products/hangar/PRD.md)
