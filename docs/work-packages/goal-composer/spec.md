---
title: 'Spec: Goal Composer'
product: study
feature: goal-composer
type: spec
status: draft
review_status: pending
created: 2026-04-28
adr: 016
phase: 9
---

# Spec: Goal Composer

ADR 016 phase 9. The page-level CRUD surface for `goal`, `goal_syllabus`, and `goal_node`. The data model, BC, and route constants already exist on main (PRs #248, #254, #270); this WP ships the SvelteKit pages that drive the writes.

Three SvelteKit routes (`/goals`, `/goals/new`, `/goals/[id]` with edit toggled by `?edit=1`). All goal mutations go through the existing BC; no new BC functions, no new schema, no new constants.

## Why this WP exists

| Need                                                                                | What's missing today                                                                                       |
| ----------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------- |
| "What am I actually pursuing right now, and what feeds it?"                         | Goal data model is shipped; no surface lets a learner see, edit, or compose a goal.                         |
| Set a primary goal so other surfaces (cert dashboard, engine) default-filter to it. | `setPrimaryGoal` is a BC write; no UI calls it.                                                            |
| Compose a goal from one or more syllabi plus ad-hoc knowledge nodes.                | `addGoalSyllabus` / `addGoalNode` are BC writes; no UI calls them. No node-picker exists.                   |
| Pause / resume / archive goals as life happens (returning CFI juggling 7 cred path). | Lifecycle (`active` / `paused` / `completed` / `abandoned`) is in the schema; no UI exposes the transitions. |

## Anchors

- [ADR 016 -- Cert / Syllabus / Goal model](../../decisions/016-cert-syllabus-goal-model/decision.md). Phase 9 row of the migration plan; this WP is its acceptance.
- [ADR 016 context](../../decisions/016-cert-syllabus-goal-model/context.md) -- why goals compose syllabi + ad-hoc nodes.
- [Learning Philosophy](../../platform/LEARNING_PHILOSOPHY.md) principle 4 -- goal vs course; a goal is the learner's union, not the FAA's.
- [Predecessor WP -- cert-syllabus-and-goal-composer](../cert-syllabus-and-goal-composer/spec.md). The data layer this WP consumes.
- [Sibling WP -- cert-dashboard](../cert-dashboard/spec.md). Reads `getPrimaryGoal` for default-filter; never writes goals.
- [Sibling WP -- lens-ui](../lens-ui/spec.md). Owns `/lens/...` (ACS lens, handbook lens, weakness lens); never writes goals.
- [reference-sveltekit-patterns.md](../../agents/reference-sveltekit-patterns.md). Form-action / page-server conventions.
- [Reference pattern -- plans detail](../../../apps/study/src/routes/(app)/plans/[id]/+page.server.ts). Closest existing CRUD shape; mirror its action handlers.

## In Scope

| #  | Item                                                                                                                                                  |
| -- | ----------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1  | `/goals` index page. Lists the user's goals, grouped by status (active, paused, completed, abandoned). Primary goal pinned to top with a star badge.  |
| 2  | `/goals/new` create page. Title, notes, optional target date, optional `is_primary`. Empty syllabus + node lists; populated post-create on the detail. |
| 3  | `/goals/[id]` detail page (read mode). Header (title, status, primary badge, target date), notes, syllabus list with weights, node list with weights.  |
| 4  | `/goals/[id]?edit=1` detail page (edit mode). Title / notes / status / target date editable; add/remove syllabi; add/remove nodes; weight sliders.     |
| 5  | Status transitions. Buttons for `pause`, `resume` (paused -> active), `complete`, `abandon`. Each is a form action calling `updateGoal({ status })`.    |
| 6  | "Make primary" action. Single-button form on detail; calls `setPrimaryGoal`. Atomic: previous primary auto-unflagged in the BC.                       |
| 7  | Syllabus picker. Lightweight modal listing the user's reachable syllabi (system credentials + personal). Add adds a `goal_syllabus` row at default weight 1.0. |
| 8  | Node picker (the new interaction work). Modal with filter chips (domain, cert relevance, lifecycle) + text search; add appends `goal_node` rows.       |
| 9  | Weight editing. Slider per `goal_syllabus` and `goal_node` row, bounded by `GOAL_SYLLABUS_WEIGHT_MIN..MAX`. Saves on blur via `setGoal*Weight`.         |
| 10 | Help page (`apps/study/src/lib/help/content/goals.ts`) covering compose flow, primary semantics, status lifecycle.                                    |
| 11 | Playwright e2e: create goal, add syllabus, add node, set primary, archive. Vitest unit tests for loader + action error mapping.                       |
| 12 | Empty / fallback states. Zero goals, zero syllabi available, zero nodes matching filter -- each has explicit copy.                                    |

## Out of Scope (explicit)

- **Goal collaboration / sharing** (read-only links, multi-user goals). Per-user only for v1.
- **Goal templates** ("PPL prep starter," "IR refresh starter"). Manual composition is the v1 muscle; templates earn their keep after the picker UX is proven.
- **Multi-tenant ACL.** No org-level goals. Owner is always the authenticated user.
- **Engine cutover.** The engine still reads `study_plan` to drive rep selection. Routing the engine through `getGoalNodeUnion` is a follow-on WP per the predecessor [cert-syllabus-and-goal-composer](../cert-syllabus-and-goal-composer/spec.md) phase plan.
- **Derived-cert visualisation.** `getDerivedCertGoals` is callable, but rendering "this goal touches X credentials" is deferred until the picker proves out.
- **Mobile-specific layouts.** Desktop-first per the rest of the study app.
- **Bulk node operations** (multi-select + bulk add). Single-add per click in v1; bulk earns its keep when the picker hits friction in real use.

## BC reads consumed (no new functions)

| Function                                            | File                                  | Used on                              |
| --------------------------------------------------- | ------------------------------------- | ------------------------------------ |
| `listGoals(userId, { status? })`                    | `libs/bc/study/src/goals.ts`          | `/goals` index                       |
| `getActiveGoals(userId)`                            | `libs/bc/study/src/goals.ts`          | Index sectioning                     |
| `getPrimaryGoal(userId)`                            | `libs/bc/study/src/goals.ts`          | Index pin + detail badge             |
| `getOwnedGoal(id, userId)`                          | `libs/bc/study/src/goals.ts`          | Detail loader (404 + ownership)      |
| `getGoalSyllabi(goalId)`                            | `libs/bc/study/src/goals.ts`          | Detail syllabus list                 |
| `getGoalNodes(goalId)`                              | `libs/bc/study/src/goals.ts`          | Detail node list                     |
| `getGoalNodeUnion(goalId)`                          | `libs/bc/study/src/goals.ts`          | Detail "this goal targets N nodes"   |
| `listNodesWithFacets({ q, domains, certs, lifecycle })` | `libs/bc/study/src/knowledge.ts`  | Node-picker results                  |
| `listCredentials({ status: 'active' })`             | `libs/bc/study/src/credentials.ts`    | Syllabus-picker grouping             |
| `getCredentialSyllabi(credId)`                      | `libs/bc/study/src/credentials.ts`    | Syllabus-picker rows per credential  |

## BC writes consumed (no new functions)

| Function                                            | Trigger                                                     |
| --------------------------------------------------- | ----------------------------------------------------------- |
| `createGoal({ title, notesMd, isPrimary, targetDate })` | `/goals/new` submit                                       |
| `updateGoal(id, userId, { title?, notesMd?, status?, targetDate? })` | Detail edit-mode save + status buttons        |
| `archiveGoal(id, userId)`                           | "Archive" button on detail                                  |
| `setPrimaryGoal(id, userId)`                        | "Make primary" button on detail; star-toggle on index card  |
| `addGoalSyllabus(goalId, userId, { syllabusId, weight })` | Syllabus picker "Add"                                  |
| `removeGoalSyllabus(goalId, userId, syllabusId)`    | Syllabus row "Remove"                                       |
| `setGoalSyllabusWeight(goalId, userId, syllabusId, weight)` | Syllabus weight slider blur                         |
| `addGoalNode(goalId, userId, { knowledgeNodeId, weight, notes })` | Node picker "Add"                              |
| `removeGoalNode(goalId, userId, knowledgeNodeId)`   | Node row "Remove"                                           |
| `setGoalNodeWeight(goalId, userId, knowledgeNodeId, weight)` | Node weight slider blur                            |

## Validation (already shipped)

| Schema                       | File                                              | Used by                |
| ---------------------------- | ------------------------------------------------- | ---------------------- |
| `createGoalInputSchema`      | `libs/bc/study/src/credentials.validation.ts`     | `/goals/new` action    |
| `updateGoalInputSchema`      | `libs/bc/study/src/credentials.validation.ts`     | Detail update action   |
| `addGoalSyllabusInputSchema` | `libs/bc/study/src/credentials.validation.ts`     | Syllabus-picker action |
| `addGoalNodeInputSchema`     | `libs/bc/study/src/credentials.validation.ts`     | Node-picker action     |

## Constants and routes (already shipped)

- `ROUTES.GOALS`, `ROUTES.GOALS_NEW`, `ROUTES.GOAL(id)`, `ROUTES.GOAL_EDIT(id)` -- in `libs/constants/src/routes.ts`.
- `GOAL_STATUSES`, `GOAL_STATUS_VALUES`, `GOAL_STATUS_LABELS` -- in `libs/constants/src/credentials.ts`.
- `GOAL_SYLLABUS_WEIGHT_MIN = 0`, `GOAL_SYLLABUS_WEIGHT_MAX = 10` -- in `libs/constants/src/credentials.ts`.
- `QUERY_PARAMS.EDIT` -- already defined; mirrored from the memory-card edit pattern.
- No new constants required.

## Errors and mapping

| BC error                  | HTTP                  | UX                                                           |
| ------------------------- | --------------------- | ------------------------------------------------------------ |
| `GoalNotFoundError`       | 404                   | Detail page error route                                      |
| `GoalNotOwnedError`       | 404                   | Identical UX to not-found; do not leak ownership existence   |
| `GoalAlreadyPrimaryError` | `fail(400, { error })` | Inline form error: "This goal is already your primary."     |
| Zod validation failure    | `fail(400, { error })` | Inline field-level errors, mirroring the plans-detail pattern |

## Open question

| #  | Question                                                                                            | Default                                                                                                                                                                      |
| -- | --------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1  | Node-picker UX shape: (a) modal with filter chips + search, (b) inline collapsible groups by domain, (c) dedicated subpage `/goals/[id]/nodes`. | (a) Modal with filter chips + search. Mirrors the citation picker idiom already used in the app, keeps the user in the goal context, scales to hundreds of nodes via search + filter. Confirm before build. |

## Acceptance

- All three routes render against the existing BC with zero new BC functions.
- `bun run check` clean. Unit + e2e tests pass.
- Help page exists, validated, and linked from the surfaces.
- `?edit=1` round-trips correctly (Save returns to read mode at the same id; Cancel discards).
- Empty / fallback states render with explicit copy (no blank pages, no console errors).
- All BC error classes mapped to user-visible UX (404 / inline failure / banner).
- Manual test plan in [test-plan.md](./test-plan.md) walked end-to-end by the user.
