---
title: 'Out of Scope: Hangar Playwright e2e infrastructure'
product: hangar
feature: hangar-e2e-infrastructure
type: out-of-scope
status: unread
---

# Out of Scope: Hangar Playwright e2e infrastructure

Deferred items, why they're deferred, and the trigger that should make
us revisit each. Future agents and humans: do not build these without
the documented trigger. If you think the trigger is hit, surface it
for a decision rather than building silently.

## Summary

| Item                                        | Status       | Trigger to revisit                                                        |
| ------------------------------------------- | ------------ | ------------------------------------------------------------------------- |
| Authoring the deferred audit-explorer suite | Follow-on WP | Lands after this infrastructure WP merges                                 |
| Authoring the deferred users-editing suite  | Follow-on WP | Lands after this infrastructure WP merges                                 |
| Multi-role auth fixtures                    | Deferred     | When per-spec inline cost of seeding non-admin roles gets painful         |
| Cross-app e2e tests                         | Deferred     | When a power-user flow that crosses hangar and study becomes load-bearing |
| CI integration                              | Deferred     | When the project adopts CI (currently no CI by design -- see CLAUDE.md)   |

## Authoring the deferred audit-explorer suite

Status: Follow-on WP

What was deferred:
The Playwright e2e suite for the hangar audit explorer (list smoke / filter round-trip /
detail render / ADMIN-only redirect) that was deferred when `hangar-audit-explorer` shipped
in PR #365.

Why:
Per spec §Why this WP exists: per-WP cost of building hangar test infrastructure is bigger
than each feature WP. This infrastructure WP builds it once; the audit-explorer suite then
becomes a routine follow-up PR.

Trigger to revisit:
Lands after this infrastructure WP merges. The follow-on WP slug is
`hangar-audit-explorer-e2e` per spec §Triggers.

Implementation pattern when triggered:
Mirror the smoke spec authored in this WP. New file under `tests/e2e/hangar/`. Use the
admin auth state from `tests/e2e/.auth/hangar-admin.json`. The original ratified spec for
audit-explorer enumerates the four test cases (list smoke / filter round-trip / detail
render / ADMIN-only redirect).

References:

- [spec.md §Triggers](./spec.md)
- [hangar-audit-explorer spec](../hangar-audit-explorer/spec.md) -- first deferred consumer

## Authoring the deferred users-editing suite

Status: Follow-on WP

What was deferred:
The Playwright e2e suite for hangar user editing (typed-gate / role assign / ban +
login-blocked / revoke-induced logout / last-admin guard / self-target rejection) that was
deferred when `hangar-users-editing` shipped in PR #371.

Why:
Same as the audit-explorer suite: per-spec infra cost made the test authoring scope balloon.
This infrastructure WP unblocks it.

Trigger to revisit:
Lands after this infrastructure WP merges. The follow-on WP slug is
`hangar-users-editing-e2e` per spec §Triggers.

Implementation pattern when triggered:
Mirror the smoke spec authored in this WP. The negative-path tests (role rejection, ban,
last-admin guard, self-target) may need additional auth fixtures (e.g. a non-admin user to
prove the ADMIN gate); if inline seeding becomes painful, surface the trigger for the
multi-role fixtures deferred item.

References:

- [spec.md §Triggers](./spec.md)
- [hangar-users-editing spec](../hangar-users-editing/spec.md) -- second deferred consumer

## Multi-role auth fixtures

Status: Deferred

What was deferred:
Additional auth state fixtures for author / operator / learner roles. This WP seeds one
admin (`tests/e2e/.auth/hangar-admin.json`).

Why:
Per spec §Out of Scope: "Author / operator / learner fixtures for negative-path tests (the
redirect-on-403 scenarios) come in a follow-on if the per-spec inline cost gets painful."
A single admin fixture is sufficient for v1 happy-path coverage; negative-path tests can
seed inline until the inline cost dominates.

Trigger to revisit:
When per-spec inline cost of seeding non-admin roles gets painful. Concrete signal: 3+ specs
duplicate the same "seed a learner, log them in, attempt a hangar admin action, assert
403/redirect" boilerplate. At that point, factor the fixture.

Implementation pattern when triggered:
Mirror the admin auth seed at `tests/e2e/global.setup.ts`. Add learner / author / operator
seeds and persist to `tests/e2e/.auth/hangar-<role>.json`. Add corresponding Playwright
projects (or a shared `storageState` option per spec) so tests can opt-in to a role.

References:

- [spec.md §Out of Scope (explicit)](./spec.md)
- [spec.md §2. Hangar admin auth seed](./spec.md)

## Cross-app e2e tests

Status: Deferred

What was deferred:
Specs that walk between hangar and study (e.g. an admin promotes someone in hangar; the user
logs into study and sees the new role).

Why:
Per spec §Out of Scope: "Specs that walk between hangar and study are a power-user pattern.
Not needed for v1." Cross-app flows multiply the auth fixture surface and the dev-server
orchestration cost; deferring keeps the infrastructure WP small.

Trigger to revisit:
When a power-user flow that crosses hangar and study becomes load-bearing -- e.g. a
regression where a hangar role change doesn't propagate to study session state, and the
team wants automated coverage to prevent recurrence.

Implementation pattern when triggered:
A Playwright spec that uses two storage states in a single test (sign in as admin via
`hangar-admin.json`, perform the action, switch storage state to the affected learner,
assert the propagated change). Playwright supports per-context storage state; no new
infrastructure required beyond the multi-role fixtures.

References:

- [spec.md §Out of Scope (explicit)](./spec.md)

## CI integration

Status: Deferred

What was deferred:
Wiring `bun run test:e2e` (or any Playwright invocation) into a CI pipeline.

Why:
Per spec §Out of Scope: "This WP gets local + manual `bun run test:e2e` passing. CI wiring
is a separate concern." Airboss has no CI today by design (per CLAUDE.md "Critical Rules":
"There is no CI."). The only gate is `bun run check` locally before commit.

Trigger to revisit:
When the project adopts CI as a platform-wide decision (would be an ADR or a CLAUDE.md
change). Not driven by this WP.

Implementation pattern when triggered:
Out of scope for this WP. Whichever ADR introduces CI defines the pattern; this WP would
become a consumer of that pattern, not its driver.

References:

- [spec.md §Out of Scope (explicit)](./spec.md)
- [CLAUDE.md §Critical Rules](../../../CLAUDE.md) -- "There is no CI."
