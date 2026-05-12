---
title: 'Out of Scope: Hangar scaffold'
product: hangar
feature: hangar-scaffold
type: out-of-scope
status: unread
---

# Out of Scope: Hangar scaffold

Deferred items, why they're deferred, and the trigger that should make us revisit each. Future agents and humans: do not build these without the documented trigger. If you think the trigger is hit, surface it for a decision rather than building silently.

The source is the "Out of scope" section of [spec.md](./spec.md) (lines 42-48) and the "Deferred to later WPs" section of [tasks.md](./tasks.md) (lines 40-44). This WP stood up `apps/hangar/` as the airboss admin app skeleton: auth wiring, role gate, login/logout, audit logging, dev wiring, and a heartbeat home page. The deferrals here are the boundaries this WP drew between "stand up the skeleton" and "stand up the actual admin features that hang off the skeleton."

Each of the four major deferrals points to a concrete follow-on WP that has since been authored under `docs/work-packages/` (`hangar-registry`, `hangar-sources-v1`, `hangar-non-textual`, `hangar-invite-flow`). The carrier-metaphor / FIRC compliance UI rejection mirrors the broader post-pivot stance recorded in `project_firc_compliance_dormant` and ADR 017.

## Summary

| Item                                                                           | Status       | Trigger to revisit                                            |
| ------------------------------------------------------------------------------ | ------------ | ------------------------------------------------------------- |
| Data-management surfaces (sources, references, jobs)                           | Follow-on WP | When `hangar-registry` and `hangar-sources-v1` are in flight  |
| Shared nav / breadcrumbs between hangar admin sections                         | Deferred     | When a second hangar admin surface lands beside the home page |
| User administration / invite flow                                              | Follow-on WP | When `hangar-invite-flow` is in flight                        |
| FIRC compliance UI / carrier-metaphor language                                 | Rejected     | Never -- see detail below                                     |
| ADR on hangar's relationship to identity (role model, verified-email, invites) | Deferred     | When user administration becomes concrete in the ops app      |
| Playwright e2e for the login -> ping -> audit-read cycle                       | Follow-on WP | When `hangar-sources-v1` lands the fuller test plan           |

## Data-management surfaces (sources, references, jobs)

Status: Follow-on WP

What was postponed:
The actual admin surfaces that read and mutate data -- the sources list, the reference registry editor, the job queue dashboard, and the data flows that connect them. The scaffold ships only a heartbeat home page that proves the auth / role / form action / DB write / DB read / render chain works end-to-end.

Why:
Per [spec.md](./spec.md) Out of scope and the spec's "Why the heartbeat page instead of a placeholder" section: data-management features have their own review surface (per-corpus shape, job-queue semantics, registry validators) and benefit from landing on top of a working skeleton rather than being conflated with it. Shipping the skeleton first lets the data-management WPs focus on their actual concerns instead of also wrestling with the auth / role / audit plumbing.

Trigger that fires the follow-on:
`hangar-registry` and `hangar-sources-v1` are in flight. Both WPs already exist under `docs/work-packages/`.

Implementation pattern when triggered:
The follow-on WPs replace the heartbeat home page wholesale (per the spec's note: "Replaced wholesale by the interactive flow diagram in `wp-hangar-sources-v1`"). The scaffold's auth / role / audit plumbing stays put; the new surfaces register their own routes under `apps/hangar/src/routes/` and call `auditWrite` for every mutation per the pattern shipped on the heartbeat home page.

References:

- [spec.md](./spec.md) Out of scope -- "Data-management surfaces"
- [docs/work-packages/hangar-registry/spec.md](../hangar-registry/spec.md)
- [docs/work-packages/hangar-sources-v1/spec.md](../hangar-sources-v1/spec.md)
- [docs/work-packages/hangar-non-textual/spec.md](../hangar-non-textual/spec.md)

## Shared nav / breadcrumbs between hangar admin sections

Status: Deferred

What was deferred:
A shared navigation chrome between hangar admin sections -- top nav, breadcrumbs, section sidebar, or whatever shape the multi-surface admin app wants. The scaffold ships only the root `+layout.svelte` that loads `@ab/themes/tokens.css` and renders children; no nav primitive lives in the layout yet.

Why:
Per [spec.md](./spec.md) Out of scope ("Nav between admin sections -- nothing to navigate to yet") and [tasks.md](./tasks.md) Deferred: with only the heartbeat home page in place, nav has nowhere to navigate to. Building it before the second surface lands would be guessing at the shape; landing it alongside the second surface lets the nav be informed by real surfaces rather than hypothetical ones.

Trigger to revisit:
A second hangar admin surface lands beside the home page. The first concrete one is `hangar-sources-v1` per [tasks.md](./tasks.md); when its surfaces ship, the nav lands with them.

Implementation pattern when triggered:
The `hangar-sources-v1` WP owns the nav primitive. Mirror the pattern that ships there in `apps/hangar/src/lib/components/`. Study's app shell at `apps/study/src/routes/(app)/+layout.svelte` is the closest existing reference for a multi-surface app with consistent chrome.

References:

- [spec.md](./spec.md) Out of scope -- "Nav between admin sections"
- [tasks.md](./tasks.md) Deferred to later WPs -- "Shared nav / breadcrumbs"
- [docs/work-packages/hangar-sources-v1/spec.md](../hangar-sources-v1/spec.md)

## User administration / invite flow

Status: Follow-on WP

What was postponed:
The user administration surfaces -- inviting new users, assigning roles, listing existing users, deactivating accounts. The scaffold ships role-gated entry (`AUTHOR | OPERATOR | ADMIN`) but no UI for managing who has which role.

Why:
Per [spec.md](./spec.md) Out of scope: "User administration / invite flow -- lives in ops when it lands." The decision recorded in the spec was that user-admin lives in the future ops app, not the hangar app. The hangar app's domain is content authoring + data management; user administration is a cross-product concern that belongs in the operator-facing surface.

Trigger that fires the follow-on:
`hangar-invite-flow` is in flight. The WP already exists under `docs/work-packages/`. Note: the slug carries `hangar-` but the spec's original intent was for ops; surface the divergence to the user if the trigger fires and `hangar-invite-flow`'s scope contradicts the ops-app placement.

Implementation pattern when triggered:
The follow-on WP defines the invite surface (email + role selector, secure invite link, accept flow). Mirror the auth-cookie patterns shipped in this scaffold (cross-subdomain `.airboss.test` cookie, `requireRole` gating, audit-logged mutations).

References:

- [spec.md](./spec.md) Out of scope -- "User administration / invite flow"
- [docs/work-packages/hangar-invite-flow/spec.md](../hangar-invite-flow/spec.md)

## FIRC compliance UI / carrier-metaphor language

Status: Rejected

What was rejected:
The FIRC compliance UI surfaces and carrier-metaphor brand language ("Trap", "Bolter", "Greenie Board", etc.) from the airboss-firc admin app. None of this was ported into `apps/hangar/`.

Why:
Per [spec.md](./spec.md) Out of scope ("FIRC compliance UI / carrier language -- not being ported") and the broader post-pivot stance recorded in [docs/platform/PIVOT.md](../../platform/PIVOT.md) + ADR 017: FIRC is no longer the product. Airboss is a pilot performance and rehearsal platform; FIRC will eventually return as `apps/firc/` per the multi-product architecture, but the carrier metaphor is a FIRC-product brand choice, not platform vocabulary. Mixing FIRC brand language into the hangar admin app would dilute the cross-product admin surface and entangle the platform with FIRC-only naming. The dormant FIRC-era hangar PRD lives at `docs/.archive/firc-era/products/hangar/` per the `project_firc_compliance_dormant` memory.

A re-decision would have to clear: the FIRC product surface returns (`apps/firc/` is created), AND `apps/firc/` needs an admin counterpart that the hangar app cannot host, AND the carrier metaphor is the chosen brand language for that surface. Even then, the better answer is likely a FIRC-specific admin app or a FIRC-scoped section within hangar that does not bleed brand language into the platform-wide chrome.

References:

- [spec.md](./spec.md) Out of scope -- "FIRC compliance UI / carrier language"
- [docs/platform/PIVOT.md](../../platform/PIVOT.md) (post-pivot framing)
- [docs/decisions/017-firc-product-dormancy/](../../decisions/017-firc-product-dormancy/) (FIRC dormancy)
- [docs/.archive/firc-era/products/hangar/](../../.archive/firc-era/products/hangar/) (archived FIRC-era hangar PRD)
- [docs/platform/MULTI_PRODUCT_ARCHITECTURE.md](../../platform/MULTI_PRODUCT_ARCHITECTURE.md) (future `apps/firc/` surface)

## ADR on hangar's relationship to identity (role model, verified-email, invite flow)

Status: Deferred

What was deferred:
A dedicated ADR that captures hangar's relationship to identity -- the role model (LEARNER / AUTHOR / OPERATOR / ADMIN, hangar gates to the upper three), verified-email enforcement, invite-flow shape, cross-subdomain cookie boundaries, and the audit-log contract for identity mutations. The scaffold ships the role gate and cross-subdomain cookie wiring; no ADR yet codifies the decisions behind them.

Why:
Per [tasks.md](./tasks.md) Deferred: "lands when user administration becomes concrete (ops app)." The ADR would lock in the role model and identity shape; doing so before user administration is concrete would lock in guesses. The scaffold's role-gate implementation is the smallest possible commitment (gate to existing roles via existing `requireRole`); the ADR follows the concrete user-admin work that pressure-tests the shape.

Trigger to revisit:
User administration becomes concrete -- either `hangar-invite-flow` lands and pressure-tests the role model, or the ops app surfaces user-admin features that need a stable identity-model contract to build against.

Implementation pattern when triggered:
Author a new ADR under `docs/decisions/NNN-hangar-identity-contract/` (directory ADR for the multi-decision context). Reference the role enum at `libs/constants/src/roles.ts`, the auth wiring at `libs/auth/src/auth.ts`, the cookie domain pattern in `apps/hangar/src/lib/server/cookies.ts`, and the audit-log shape in `libs/audit/`. Mirror the structure of an existing directory ADR -- ADR 011 or ADR 016 are good shapes.

References:

- [tasks.md](./tasks.md) Deferred to later WPs -- "ADR on hangar's relationship to identity"
- [libs/constants/src/roles.ts](../../../libs/constants/src/roles.ts)
- [libs/auth/src/auth.ts](../../../libs/auth/src/auth.ts)
- [docs/work-packages/hangar-invite-flow/spec.md](../hangar-invite-flow/spec.md)

## Playwright e2e for the login -> ping -> audit-read cycle

Status: Follow-on WP

What was postponed:
A Playwright end-to-end test that drives the scaffold's full happy path: sign in via `/login`, click the heartbeat button on `/`, confirm the audit row appears after reload. The scaffold ships the manual test plan at [test-plan.md](./test-plan.md) but no automated coverage.

Why:
Per [tasks.md](./tasks.md) Deferred: the e2e lands in `hangar-sources-v1` "as part of the fuller test-plan." Authoring an isolated e2e for the scaffold's heartbeat page would be throwaway, since the spec notes the heartbeat home is "replaced wholesale by the interactive flow diagram in `wp-hangar-sources-v1`." The e2e is better authored against the surfaces that actually persist past the scaffold WP.

Trigger that fires the follow-on:
`hangar-sources-v1` lands its fuller test plan. The WP already exists under `docs/work-packages/hangar-sources-v1/test-plan.md`.

Implementation pattern when triggered:
The follow-on WP authors Playwright specs under `tests/e2e/hangar/`. Mirror the patterns in `tests/e2e/` for study's sign-in flow (cross-subdomain cookie handling) and any existing audit-log assertion helpers. The hangar e2e covers the auth-gate redirects, the role-rejection path for LEARNER, and the audit-row-after-reload pattern proven manually in this WP's [test-plan.md](./test-plan.md).

References:

- [tasks.md](./tasks.md) Deferred to later WPs -- "Playwright e2e for the login -> ping -> audit-read cycle"
- [test-plan.md](./test-plan.md) (the manual plan the e2e mirrors)
- [docs/work-packages/hangar-sources-v1/test-plan.md](../hangar-sources-v1/test-plan.md)
