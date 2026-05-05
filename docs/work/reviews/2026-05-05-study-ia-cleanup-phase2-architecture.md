# Architecture review -- study-ia-cleanup Phase 2

Branch: `ball/study-ia-cleanup-phase2-a1d81812` vs `main` (squash of PR #649)
Reviewer: architecture (sequential walkthrough; harness can't dispatch parallel sub-agents -- substitute pattern matched Phase 1's accepted approach)

issues_found: 3

## AR-1 (info) -- legacy `/credentials`, `/goals`, `/plans` paths now 404 in Phase 2

Phase 3 explicitly handles redirects (per `tasks.md` 3.3 + design.md `redirectMap`). For the in-flight Phase 2 PR every renamed route returns 404 between merge and Phase 3 ship. This is the documented sequencing -- not a bug, but worth surfacing as a deliberate choice for the test plan and a "do not bookmark old paths during the gap" reminder.

No fix in this slice. Phase 3 closes the gap.

## AR-2 (minor) -- `/program/+layout.server.ts` duplicates per-page goal / plan fetches

The layout fans out `getPrimaryGoal` + `getActivePlan` so the tab strip can render the active deep-link targets. `/program/goals/[id]/+page.server.ts` does its own goal fetch by id; `/program/quals/+page.server.ts` calls `getPrimaryGoal` again to compute `hasPrimaryGoal`. After Phase 2 a request for `/program/quals` triggers two `getPrimaryGoal` round trips serialised by SvelteKit's load order.

Two reasonable closes:

- Stash the layout result on `event.locals` and have child loads read from it. Adds a coupling but kills the duplicate.
- Leave it: the queries are indexed and cheap, and the duplication is local to the `/program/*` group.

Recommendation: leave it. Note in the layout's jsdoc so a future agent doesn't "fix" it without measuring. (Done -- the comment block already calls out the responsibilities.)

## AR-3 (info) -- "single Program nav, four sub-routes" matches design.md Q1

The four sub-routes (`/program/quals`, `/program/goals`, `/program/plans`, `/program/coverage`) plus the `/program` redirect-loader is the literal shape design.md prescribes. The BC boundary stays intact (Goal and Plan remain separate aggregates with their own `is_primary` / `status='active'` invariants); only the UI consolidates. Validates the spec's "the user-facing surface does not have to mirror the BC structure" decision.

No fix.
