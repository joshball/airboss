# Goal Composer

The third leg of the cert/syllabus/goal/lens model (ADR 016 phase 9). Three SvelteKit routes that let a learner compose, edit, and manage personal study goals on top of the data layer that shipped in PRs #248, #254, #270.

A goal is a learner-owned union of certified syllabi (e.g., PPL ACS) + ad-hoc knowledge nodes + (optionally) courses, with an optional primary flag that anchors the daily study session and default-filters other surfaces (cert dashboard, engine). Lifecycle states (active, paused, completed, abandoned) let learners pause goals without losing them.

Spec: [docs/work-packages/goal-composer/](../../../work-packages/goal-composer/). Status: walkthrough owed per [NOW.md](../../NOW.md) line 21; check the WP for current shipping state.

## What it ships

The data layer already exists on main. The composer ships the three routes (`/program/goals`, `/program/goals/new`, `/program/goals/[id]`) and the UI that drives every goal mutation through the existing BC. No new BC functions, no new schema, no new constants.

## The journey

### 1. Index -- /program/goals

[apps/study/src/routes/(app)/program/goals/+page.server.ts](../../../../apps/study/src/routes/(app)/program/goals/+page.server.ts) +
[+page.svelte](../../../../apps/study/src/routes/(app)/program/goals/+page.svelte).

Lists all the user's goals grouped by status (active, paused, completed, abandoned). Primary goal pinned at top with a star badge. "New goal" CTA visible. Empty state when zero goals exist.

### 2. Create -- /program/goals/new

[apps/study/src/routes/(app)/program/goals/new/+page.server.ts](../../../../apps/study/src/routes/(app)/program/goals/new/+page.server.ts) +
[+page.svelte](../../../../apps/study/src/routes/(app)/program/goals/new/+page.svelte).

Form inputs:

- Title (required, max 200 chars per `GOAL_TITLE_MAX_LENGTH`).
- Notes (optional markdown, max 16 KB per `GOAL_NOTES_MAX_LENGTH`).
- Target date (optional, YYYY-MM-DD).
- `is_primary` checkbox.

Submit -> `createGoal()` -> redirect to `/program/goals/[id]`.

### 3. Detail -- /program/goals/[id]

[apps/study/src/routes/(app)/program/goals/[id]/+page.server.ts](../../../../apps/study/src/routes/(app)/program/goals/%5Bid%5D/+page.server.ts) +
[+page.svelte](../../../../apps/study/src/routes/(app)/program/goals/%5Bid%5D/+page.svelte).

Two modes:

#### Read mode (default)

- Header: title, status pill, primary star badge, target date.
- Notes (markdown rendered).
- Syllabus list with weights.
- Node list with weights.
- Courses tab (course-reader-and-editor WP Phase 5 extension; see below).
- Status action buttons: Pause / Resume / Complete / Archive.
- "Make primary" button.
- Footer: "This goal targets N knowledge nodes" -- the count from `getGoalNodeUnion`.

#### Edit mode -- /program/goals/[id]?edit=1

- Title, notes, target date, status all editable.
- Weight sliders per syllabus / node (range 0-10 per `GOAL_SYLLABUS_WEIGHT_MIN` and `..._MAX`; blur-to-save via `setGoalSyllabusWeight` / `setGoalNodeWeight` form actions).
- Remove buttons per row.
- "Add syllabus" -> syllabus picker modal (inline in `+page.svelte`).
- "Add node" -> node picker modal (inline).
- Save -> redirect to `/program/goals/[id]` (no query param).
- Cancel -> discard form changes.

### Picker modals

Inline in the detail page (`+page.svelte`); not yet extracted to subcomponents.

**Syllabus picker:** lists available syllabi grouped by credential (system + personal, minus already-attached). Select one, Add -> `addGoalSyllabus` form action -> row appears at weight 1.0.

**Node picker:** filter chips (domain, cert relevance, lifecycle) + text search (debounced 200 ms). Results from `listNodesWithFacets({ q, domains, certs, lifecycle })`. Already-attached nodes greyed and disabled. Add -> `addGoalNode` form action -> row appears at weight 1.0. Modal stays open for bulk add.

## Code map

| Concern             | Lives at                                                                                                                                                                                                                                                                                                                    |
| ------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Index loader + view | [apps/study/src/routes/(app)/program/goals/](../../../../apps/study/src/routes/(app)/program/goals/)                                                                                                                                                                                                                        |
| Create form         | [apps/study/src/routes/(app)/program/goals/new/](../../../../apps/study/src/routes/(app)/program/goals/new/)                                                                                                                                                                                                                |
| Detail + edit       | [apps/study/src/routes/(app)/program/goals/[id]/](../../../../apps/study/src/routes/(app)/program/goals/%5Bid%5D/) (9 form actions)                                                                                                                                                                                         |
| BC                  | [libs/bc/study/src/goals.ts](../../../../libs/bc/study/src/goals.ts) (300+ lines) + [goals.test.ts](../../../../libs/bc/study/src/goals.test.ts)                                                                                                                                                                            |
| Validation          | [libs/bc/study/src/credentials.validation.ts](../../../../libs/bc/study/src/credentials.validation.ts) -- `createGoalInputSchema`, `updateGoalInputSchema`, `addGoalSyllabusInputSchema`, `addGoalNodeInputSchema`, `goalDomainListSchema`, `goalNodeIdListSchema`, `applyCertGoalsInputSchema`                             |
| Schema              | [libs/bc/study/src/schema.ts](../../../../libs/bc/study/src/schema.ts) -- `goal`, `goalSyllabus`, `goalNode`, `goalCourse` (course-reader-and-editor WP extension, Phase 5)                                                                                                                                                 |
| Constants           | [libs/constants/src/credentials.ts](../../../../libs/constants/src/credentials.ts) -- `GOAL_STATUSES`, `GOAL_STATUS_LABELS`, `GOAL_SYLLABUS_WEIGHT_MIN/MAX`, `GOAL_TITLE_MAX_LENGTH`, `GOAL_ID_PREFIX`, `GOAL_NODE_NOTES_MAX_LENGTH`. `GOAL_NOTES_MAX_LENGTH` lives in [study.ts](../../../../libs/constants/src/study.ts). |
| Routes              | [libs/constants/src/routes.ts](../../../../libs/constants/src/routes.ts) -- `PROGRAM_GOALS`, `PROGRAM_GOALS_NEW`, `PROGRAM_GOAL(id)`, `PROGRAM_GOAL_EDIT(id)`                                                                                                                                                               |
| Help                | [apps/study/src/lib/help/content/goals.ts](../../../../apps/study/src/lib/help/content/goals.ts) + bodies                                                                                                                                                                                                                   |

## Key decisions

| Decision                                                                       | Why                                                                                                                                                                                                                                                                                                                  |
| ------------------------------------------------------------------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Node-picker as modal with filter chips + search.                               | Mirrors the citation-picker idiom already in the app. Keeps the goal page dense. Scales to 2000+ nodes via search + filters. Alternatives (inline groups, dedicated subpage) would overwhelm density or pull the user away from goal context.                                                                        |
| Primary-goal invariant: at most one `is_primary=true` per user.                | Enforced by partial `UNIQUE` index on `goal (user_id) WHERE is_primary=true`. `setPrimaryGoal` atomically clears `is_primary` on every other goal in a transaction before flipping the target. The invariant never breaks mid-write.                                                                                 |
| Weight aggregation in `getGoalNodeUnion`: max of all paths.                    | When a node is reachable through multiple paths (syllabus A at weight 2.0 + syllabus B at weight 3.0 both link to it), highest weight wins. Matches the relevance-cache rebuild's "most-prominent context" semantic. Implementation detail in [goals.ts](../../../../libs/bc/study/src/goals.ts) `getGoalNodeUnion`. |
| Three goal sources in node union: syllabi + courses + ad-hoc nodes.            | Reflects ADR 016 phase 6 model. Courses path added by course-reader-and-editor WP Phase 5 (PR #772).                                                                                                                                                                                                                 |
| `archiveGoal` sets status to ABANDONED **and** clears `is_primary` atomically. | Prevents orphaning a primary goal in abandoned state.                                                                                                                                                                                                                                                                |
| Edit mode via `?edit=1`, not a separate route.                                 | Keeps deep links stable: `/program/goals/[id]` always works. Edit state is ephemeral. Mirrors the `/memory/[id]?edit=1` precedent.                                                                                                                                                                                   |
| No new BC functions.                                                           | All goal mutations route through existing BC. Composer is pure UI.                                                                                                                                                                                                                                                   |
| Courses tab from course-reader-and-editor WP Phase 5 lands here.               | Distinct from syllabi + nodes -- a goal can include curated course paths with per-link weight. Handled via `addCourse`, `removeCourse`, `setCourseWeight` form actions.                                                                                                                                              |

The full decision trail is in [spec.md](../../../work-packages/goal-composer/spec.md). The ADR 016 phase table identifies goal-composer as phase 9 (data shipped, UI in this WP); the next phase is engine cutover to `getGoalNodeUnion` (a separate follow-on WP that touches the engine, every rep loader, and calibration).

## Operator notes

### Seed Abby

Abby is the dev-seed test user (see `project_abby_dev_seed_user.md` in memory). Her seeded primary goal is titled "Study goal" and includes the PPL credential's primary syllabus + focus domains [AIRSPACE, WEATHER, EMERGENCY_PROCEDURES].

```bash
bun run db:seed                  # full reset + seed
bun run db seed goals            # just goals
bun run db:seed --user abby      # one user
```

Seed logic at [scripts/db/seed-abby.ts](../../../../scripts/db/seed-abby.ts) -- `seedAbbyGoal(databaseUrl, userId)` uses `applyCertGoalsToPrimaryGoal(...)` and is idempotent (re-runs upsert the `goal_syllabus` rows).

### Run

```bash
bun run dev study
```

Visit:

- `/program/goals` -- the index.
- `/program/goals/new` -- create a goal.
- `/program/goals/<id>` -- detail.
- `/program/goals/<id>?edit=1` -- edit mode.

### Useful BC calls (REPL or one-off scripts)

```typescript
import {
  getPrimaryGoal,
  listGoals,
  getGoalSyllabi,
  getGoalNodes,
  getGoalNodeUnion,
  getDerivedCertGoals,
} from '@ab/bc-study/server';

const primary = await getPrimaryGoal(abby.id);
const goals = await listGoals(userId);
const syllabi = await getGoalSyllabi(goalId);
const nodes = await getGoalNodes(goalId);
const union = await getGoalNodeUnion(goalId);    // canonical reachable-node list
const certGoals = await getDerivedCertGoals(userId);  // engine compat shim
```

### Test

```bash
bun test goals.test.ts
bun test credentials.test.ts
bunx playwright test goals.spec.ts        # if written
bun run check                              # full pipeline
```

## Deferred / follow-ups

From [docs/work-packages/goal-composer/OUT-OF-SCOPE.md](../../../work-packages/goal-composer/OUT-OF-SCOPE.md):

| Item                                            | Status       | Trigger                                                                                                                                                                                                                                                                     |
| ----------------------------------------------- | ------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Goal collaboration / sharing                    | Deferred     | When multi-user CFI/student pairing lands. Pattern: `study.goal_member (goal_id, user_id, role)` join.                                                                                                                                                                      |
| Goal templates                                  | Deferred     | When manual compose proves friction. Re-ask when a pattern emerges ("every user builds the same PPL-prep goal three times").                                                                                                                                                |
| Derived-cert visualisation panel on detail page | Deferred     | After picker proves out in real use. BC `getDerivedCertGoals` is callable; UI is not.                                                                                                                                                                                       |
| Bulk node operations (multi-select add)         | Deferred     | When single-add hits friction. Extend node picker with selection state + "Add N" button.                                                                                                                                                                                    |
| Engine cutover to `getGoalNodeUnion`            | Follow-on WP | When goal-composer ships + engine still reads `study_plan` for rep selection. Substantial cross-BC migration (engine, every rep loader, calibration). See [predecessor WP cert-syllabus-and-goal-composer](../../../work-packages/cert-syllabus-and-goal-composer/spec.md). |
| Mobile-specific layouts                         | Rejected     | Desktop-first per study app posture.                                                                                                                                                                                                                                        |
| Multi-tenant ACL                                | Rejected     | Single-user / single-tenant product.                                                                                                                                                                                                                                        |

## Related docs

- [docs/work-packages/goal-composer/](../../../work-packages/goal-composer/) -- spec, design, user-stories, test-plan, OUT-OF-SCOPE
- [docs/work-packages/cert-syllabus-and-goal-composer/](../../../work-packages/cert-syllabus-and-goal-composer/) -- predecessor WP (data layer)
- [docs/work-packages/course-reader-and-editor/](../../../work-packages/course-reader-and-editor/) -- Phase 5 added the Courses tab
- [docs/work-packages/wp-notes-primitive/](../../../work-packages/wp-notes-primitive/) -- Phase 2 added the notes panel
- [docs/decisions/016-cert-syllabus-goal-model/decision.md](../../../decisions/016-cert-syllabus-goal-model/decision.md)

## Read next

[04 -- course-tree-arbitrary-depth](04-course-tree-arbitrary-depth.md). Courses are the third source for `getGoalNodeUnion`; the tree shape changed under it. Reading these together makes the goal -> nodes story complete.
