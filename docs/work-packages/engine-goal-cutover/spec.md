---
id: engine-goal-cutover
title: "Spec: Engine Goal Cutover"
product: study
category: feature
status: in-flight
agent_review_status: pending
human_review_status: pending
created: 2026-04-29
owner: agent
depends_on: []
unblocks: []
tags:
  - engine
  - goals
legacy_fields:
  feature: engine-goal-cutover
  type: spec
  review_status: pending
---

<!-- Shipped in code but pending user walkthrough; transition to `status: shipped` requires user to set `human_review_status: signed-off`. -->

# Spec: Engine Goal Cutover

The session engine's targeting filter is rewritten to read from the user's primary `goal` + `goal_syllabus` rows instead of `study_plan.cert_goals`. After this WP, `cert_goals` is dead column metadata that can be dropped.

This is the deferred phase from [`cert-syllabus-and-goal-composer`](../cert-syllabus-and-goal-composer/spec.md): the goal model exists and is populated (PRs #270, #321, #324) but the engine has not been moved over. The goal composer page (PR #324) lets a learner curate the right targeting, then the engine ignores it.

## Why this WP exists

Today the engine's selection contract reads:

```typescript
// libs/bc/study/src/sessions.ts:609
const certFilter: readonly Cert[] = cert ? [cert] : plan.certGoals;
const focusFilter: readonly Domain[] = focus ? [focus] : plan.focusDomains;
// ...
skipDomains: plan.skipDomains,
skipNodes: plan.skipNodes,
```

`plan.certGoals` is the JSONB array shipped on `study.study_plan`. The migrator from PR #270 (or its equivalent) populated `goal` + `goal_syllabus` rows from the same data, but the engine never started reading them. Two consequences:

- **The goal composer is bookkeeping.** A learner who sets a primary goal of "PPL refresh + IR" does not change which scenarios appear in the next session unless they also re-edit `study_plan.cert_goals` -- the engine reads only the latter.
- **`cert_goals` is duplicated state.** The `study_plan.cert_goals` column and the goal_syllabus rows can drift; the dashboard and the cert-syllabus follow-on already read `getDerivedCertGoals()` from the goal, while the engine reads `cert_goals` from the plan. Two paths, two truths.

The cutover closes the loop: primary goal -> engine targeting -> session contents. Until it ships, the goal composer is a UI without a downstream consumer.

## Anchors

- [ADR 016 -- Cert, Syllabus, Goal, and the Multi-Lens Learning Model](../../decisions/016-cert-syllabus-goal-model/decision.md), phase 6 in particular: the engine reads goal-derived filters.
- [Learning Philosophy](../../platform/LEARNING_PHILOSOPHY.md), principle 4 (personal learning is orthogonal to certificates -- the goal is what the learner is pursuing) and principle 5 (mastery rolls up at every level).
- [Cert, Syllabus, and Goal Composer spec](../cert-syllabus-and-goal-composer/spec.md), specifically item 13 ("Goal table and goal-aware engine handoff") and Open Question 4 ("What happens to `study_plan.cert_goals` after Goal is introduced?"). This WP is the resolution of OQ4.
- [Cert, Syllabus, and Goal Composer design](../cert-syllabus-and-goal-composer/design.md) -- goal model rationale.
- [Cert Dashboard spec](../cert-dashboard/spec.md) (PR #321) -- already reads from goals; pattern to mirror.
- [Goal Composer spec](../goal-composer/spec.md) (PR #324) -- the UI that writes to goals; this WP makes its writes engine-visible.
- [docs/work/NOW.md](../../work/NOW.md) -- "Follow-on 3 -- Engine cutover to goal-derived filters" is the source sketch this WP formalizes.
- `libs/bc/study/src/sessions.ts:192-202, 587-654` -- where the engine reads `plan.certGoals`, `plan.focusDomains`, `plan.skipDomains`, `plan.skipNodes` today.
- `libs/bc/study/src/goals.ts:208-218` -- `getDerivedCertGoals(userId)`, the back-compat shim this WP turns into the engine's primary read path.
- `libs/bc/study/src/goals.ts:118-125, 155-197` -- `getPrimaryGoal`, `getGoalNodeUnion`, the building blocks for the new targeting helper.
- `libs/bc/study/src/schema.ts:690-720, 1620-1640` -- `study_plan` and `goal` table definitions; `cert_goals` column with the comment about cutover.
- `libs/bc/study/src/plans.ts` -- plan-creation flow (`createPlan`, `updatePlan`); writes `cert_goals` directly today.
- `apps/study/src/routes/(app)/plans/new/+page.server.ts`, `apps/study/src/routes/(app)/plans/[id]/+page.server.ts` -- the page-level plan-edit flows that surface `cert_goals` to the user.

## In Scope

1. **`getEngineTargeting(userId)` BC helper.** New function (in `libs/bc/study/src/engine-targeting.ts`, or alternatively co-located in `goals.ts` -- see Open Question (e)) returns the full `EngineTargeting` shape the engine needs:

   ```typescript
   export interface EngineTargeting {
   	source: 'goal' | 'plan' | 'empty';
   	certs: readonly Cert[];          // from primary goal -> goal_syllabus -> credential_syllabus.primary -> credential.slug
   	focusDomains: readonly Domain[]; // from primary goal's focus_filter (when set) or plan.focusDomains
   	skipDomains: readonly Domain[];  // from primary goal's skip rules or plan.skipDomains
   	skipNodes: readonly string[];    // from primary goal's skip rules or plan.skipNodes
   	depthPreference: PlanDepthPreference; // unchanged -- still on plan; goals do not own session length / depth
   	sessionLength: number;           // unchanged -- still on plan
   }
   ```

   Reads in this order: primary goal where available; falls back to `study_plan` columns when no primary goal exists; returns `source: 'empty'` when neither is present (anonymous engine call). `depthPreference` and `sessionLength` always come from `study_plan` -- they describe per-session shape, not learner intent, and stay on the plan post-cutover.

2. **Dual-read window with telemetry.** `getEngineTargeting` records which path was taken on every call. Telemetry counts `goal` reads, `plan` fallback reads, and `empty` reads, plus a "disagreement" counter for the case where the user has both a primary goal and a non-empty `cert_goals` array but the two project to different cert sets. Telemetry ships via Open Question (c)'s mechanism. Disagreements never lose work: the goal wins (Open Question (b)).

3. **Engine slice cuts.** Each of `pickContinue`, `pickStrengthen`, `pickExpand`, `pickDiversify` switches from `plan.certGoals` / `plan.focusDomains` / `plan.skipDomains` / `plan.skipNodes` to `getEngineTargeting(userId).{certs,focusDomains,skipDomains,skipNodes}`. The targeting helper is fetched once per `previewSession` / `commitSession` call and threaded through the engine's `EnginePoolFilters`. The engine's internal types stay -- `Cert[]`, `Domain[]`, `nodeId[]` -- so the slice pickers see no shape change beyond who provides the values.

4. **`previewSession` integration.** The targeting helper is fetched alongside `getActivePlan(userId)` in `previewSession` (and the equivalents called from session start / commit paths). The composed `EnginePoolFilters` is built from the helper output, not from `plan` directly. Manual cert override (`options.cert ?? null`) and manual focus override (`options.focus ?? null`) survive unchanged -- per-session overrides win over both goal and plan, matching today's contract.

5. **Backfill sanity script.** `bun run db check goal-targeting-backfill` walks every active `study_plan` with non-empty `cert_goals`, asks `getEngineTargeting()` for the same user, and reports rows where `source='plan'` (no primary goal materialized). The script is idempotent and read-only. The expected output post-PR-#270 is "0 plans without a corresponding primary goal." Any rows surfaced get a one-shot remediation step (re-run the migrator against the affected user) before the engine cutover lands so no learner falls into the legacy fallback path on day one.

6. **Plan-creation UX cutover.** Today `/plans/new` and `/plans/[id]` mutate `study_plan.cert_goals` directly. Resolution of Open Question (a) below decides whether the plan flow redirects to the goal composer or writes through to a goal under the hood. Either way, after this WP no production code path writes a non-empty `cert_goals` value. The column stays for the dual-read window; the plan-edit UI no longer surfaces it.

7. **Engine integration tests.** New tests in `libs/bc/study/src/sessions.test.ts` (or a new `engine-targeting.test.ts`) cover:

   - User with a primary goal -> engine reads from goal.
   - User with `study_plan.cert_goals` non-empty but no primary goal (legacy / pre-migration) -> engine falls back to plan.
   - User with both -> goal wins; disagreement telemetry fires.
   - User with neither -> engine sees an empty cert filter, falls back to per-domain selection (existing behavior for `cert_goals=[]`).
   - User switches primary goal mid-session -> next `previewSession` call sees the new targeting (no caching across calls).
   - Manual `options.cert` / `options.focus` overrides win over both goal and plan.

8. **Drop `cert_goals` migration.** A final-phase Drizzle migration removes `study_plan.cert_goals`. The migration is gated on the trigger condition from Open Question (d) -- N consecutive sessions with zero legacy-path reads, or a fixed time window, locked at WP author time. The migration file ships in this WP but lands in a separate PR after telemetry confirms the trigger; the WP is not "done" until the column is dropped (or the trigger explicitly extends the window). After drop, `cert_goals` survives on `getDerivedCertGoals()` only as a derived projection from the goal.

9. **Rollback plan.** If post-cutover engine behavior misbehaves, the revert is a one-line code change in `previewSession`: swap `getEngineTargeting(userId)` for the old `planRowToEnginePlan(plan)` read and the engine sees the legacy filter set. The backfill script and the plan -> goal data are left in place; only the read path reverts. Rollback is reversible without a migration. Documented in design.md.

10. **Observability.** Beyond the dual-read counter, log every `previewSession` call's resolved targeting at `info` level (cert list, focus list, skip lists, source). Production-grade telemetry uses Open Question (c)'s mechanism; dev-mode logs are for the manual test plan. The log line is structured (JSON or key=value) so an analyst can `jq` over an hour of sessions to confirm the goal path is the dominant one.

## Out of Scope (explicit)

- **Goal composer page changes.** PR #324 already shipped primary-goal designation; this WP consumes that, doesn't change it.
- **Cert dashboard changes.** PR #321 ships independent of this; the dashboard already reads from goals via the cert-syllabus BC.
- **Lens implementations beyond what already exists.** ACS lens + Domain lens are the only implemented lenses; this WP touches neither.
- **Dropping `study_plan` entirely.** Still load-bearing for `session_length`, `default_mode`, `depth_preference`, `focus_domains`, `skip_domains`, `skip_nodes`. Only `cert_goals` is targeted for removal here. The plan continues to model "session shape preferences"; the goal models "what the learner is pursuing." See ADR 016 phase 6 for why the split survives.
- **Multi-goal weighted targeting.** The engine reads the primary goal only. A learner with two active goals gets the primary; secondary actives have no engine effect this WP. Multi-goal weighting is a future feature with its own design problem (how to allocate session time across goals; what disagreement rules apply when two goals' targeting conflicts).
- **Per-leaf evidence-kind gating.** ADR 016's "S leaves require scenario evidence" rule is a separate engine improvement -- see [`evidence-kind-gating`](../evidence-kind-gating/spec.md) WP. Both ship in parallel after sign-off.
- **Audit trail of plan-to-goal sync events.** If Open Question (a) lands as "plan UI writes through to goal," each write creates an `audit_log` entry per existing audit conventions; the audit shape is unchanged from prior plan-edit logging, no new events introduced.
- **Backfill of `cert_goals` from goal post-drop.** Once the column is dropped, it does not come back. The migration is one-way. A learner who creates a `study_plan` after the drop never has a `cert_goals` slot to fill; their targeting comes from the goal, full stop.

## Architecture overview

```text
┌──────────────────────────────────────────────────────────────────────┐
│  Before this WP (current main)                                       │
│    study_plan.cert_goals (JSONB Cert[])                              │
│        |                                                             │
│        v                                                             │
│    sessions.ts:planRowToEnginePlan()                                 │
│        |                                                             │
│        v                                                             │
│    engine.pickContinue / pickStrengthen / pickExpand / pickDiversify │
│                                                                      │
│  Goal model (also live, but ignored by the engine):                  │
│    goal -> goal_syllabus -> credential_syllabus -> credential.slug   │
│        |                                                             │
│        v                                                             │
│    getDerivedCertGoals(userId) -- read by dashboard / cert pages     │
└──────────────────────────────────────────────────────────────────────┘

┌──────────────────────────────────────────────────────────────────────┐
│  After this WP                                                       │
│    goal (is_primary=true) -> goal_syllabus -> credential.slug        │
│    goal.focus_filter / skip_rules                                    │
│        |                                                             │
│        v                                                             │
│    getEngineTargeting(userId)                                        │
│       returns { source, certs, focusDomains, skipDomains,            │
│                 skipNodes, depthPreference, sessionLength }          │
│       (depthPreference + sessionLength still come from study_plan)   │
│        |                                                             │
│        v                                                             │
│    sessions.ts:previewSession() -> EnginePoolFilters                 │
│        |                                                             │
│        v                                                             │
│    engine slice pickers (unchanged internals)                        │
│                                                                      │
│  study_plan.cert_goals: dropped via migration once telemetry         │
│  confirms zero legacy-path reads (Open Question d).                  │
└──────────────────────────────────────────────────────────────────────┘
```

## Behavior

### Read order

`getEngineTargeting(userId)` resolves in three steps:

1. Look up `getPrimaryGoal(userId)`. If non-null, derive `certs` via `getDerivedCertGoals(userId)`, derive `focusDomains` / `skipDomains` / `skipNodes` from the goal's `focus_filter` and skip-rule columns (see "Goal targeting fields" below). `source = 'goal'`.
2. Else look up the user's active `study_plan`. If present, copy `certGoals`, `focusDomains`, `skipDomains`, `skipNodes` from the plan. `source = 'plan'`.
3. Else return empty arrays for every list and `source = 'empty'`. The engine treats empty cert filter as "all certs," matching today's behavior for users with `cert_goals=[]`.

`depthPreference` and `sessionLength` always come from the `study_plan` (or `DEFAULT_SESSION_LENGTH` / default mode constants when no plan exists). They are session-shape settings, not learner-intent, and stay on the plan post-drop.

### Goal targeting fields

The goal table needs targeting columns the engine can read. Today `goal` carries `title`, `notes_md`, `status`, `is_primary`, `target_date` -- nothing for focus / skip lists. This WP adds:

| Column          | Type             | Notes                                                                      |
| --------------- | ---------------- | -------------------------------------------------------------------------- |
| `focus_domains` | jsonb (Domain[]) | Optional. When set, narrows the engine's domain pool. NULL = no narrowing. |
| `skip_domains`  | jsonb (Domain[]) | Optional. Engine excludes these from the pool.                             |
| `skip_nodes`    | jsonb (string[]) | Optional. Knowledge node ids the engine never schedules.                   |

Every column defaults to `'[]'` so existing rows pass the NOT NULL check. The migration backfills from each user's active study_plan: a goal that the migration creates inherits the plan's `focus_domains` / `skip_domains` / `skip_nodes` so the user's targeting carries forward end-to-end without re-curation.

### Disagreement handling

When both a primary goal and a non-empty `study_plan.cert_goals` exist and project to different cert sets, the goal wins. The disagreement counter increments. The legacy `cert_goals` value is never used in that read; the helper does not silently merge.

A separate "drift detector" script (`bun run db check plan-goal-drift`) reports the count and identity of users whose goal-derived cert set differs from their plan's `cert_goals`. Run periodically during the dual-read window to catch flows that still write `cert_goals`.

### Plan-creation UX (resolved by Open Question (a))

If "redirect to goal composer" is chosen: `/plans/new` becomes a thin shim that, after creating the plan row (sessionLength, defaultMode, focusDomains, skipDomains -- everything except `cert_goals`), redirects to `/goals/new` if the user has no primary goal, else `/goals/[primary]`. The plan UI never surfaces a cert-goals widget again.

If "write through" is chosen: the existing plan UI keeps its cert chooser, but on save the page action calls `setPrimaryGoal()` + `addGoalSyllabus()` instead of writing `study_plan.cert_goals`. The user does not see a UI difference; `cert_goals` is no longer mutated. This option is heavier on the page action but lighter on user-visible flow.

The user resolves before tasks.md finalizes. Either resolution lands in this WP; the spec covers both shapes.

### Engine call sites

Every read of `plan.certGoals`, `plan.focusDomains`, `plan.skipDomains`, `plan.skipNodes` migrates. Today's call graph (per `grep` against `libs/bc/study/src/`):

| Call site                                                                    | Today                                                                       | After                                                         |
| ---------------------------------------------------------------------------- | --------------------------------------------------------------------------- | ------------------------------------------------------------- |
| `sessions.ts:planRowToEnginePlan`                                            | reads `row.certGoals`                                                       | helper composes `EnginePlan`; deletes / repurposes the helper |
| `sessions.ts:previewSession`                                                 | `plan.certGoals`, `plan.focusDomains`, `plan.skipDomains`, `plan.skipNodes` | reads from `getEngineTargeting()` once                        |
| `engine.ts:pickContinue` / `pickStrengthen` / `pickExpand` / `pickDiversify` | filters via `EnginePlan.certGoals` etc.                                     | unchanged signature; gets values from helper-built filter     |
| `dashboard.ts`                                                               | already reads `getDerivedCertGoals()`                                       | unchanged                                                     |
| `plans.ts:createPlan` / `updatePlan`                                         | accepts `certGoals` input                                                   | resolves per Open Question (a); no longer writes `cert_goals` |

After this WP, `EnginePlan.certGoals` -- the in-memory shape carried through the engine -- still exists; it's the helper's projection of the targeting helper output. The contract toward the engine pickers does not change. The contract toward `study_plan` storage does.

## BC Surface

New file: `libs/bc/study/src/engine-targeting.ts` (or extension of `goals.ts` -- see Open Question (e)).

| Function                     | Signature                                                                                          |
| ---------------------------- | -------------------------------------------------------------------------------------------------- |
| `getEngineTargeting`         | `(userId: string, db?: Db) -> Promise<EngineTargeting>`                                            |
| `getEngineTargetingSnapshot` | `(userId: string, db?: Db) -> Promise<EngineTargetingSnapshot>` (helper output + telemetry record) |

`EngineTargetingSnapshot` carries the targeting plus the telemetry envelope (source, disagreement flag, timestamp) so the caller can both consume and emit.

`goals.ts` extensions:

| Function              | Signature                                                                       |
| --------------------- | ------------------------------------------------------------------------------- |
| `getGoalFocusDomains` | `(goalId: string, db?: Db) -> Promise<Domain[]>`                                |
| `getGoalSkipDomains`  | `(goalId: string, db?: Db) -> Promise<Domain[]>`                                |
| `getGoalSkipNodes`    | `(goalId: string, db?: Db) -> Promise<string[]>`                                |
| `setGoalFocusDomains` | `(goalId: string, userId: string, domains: Domain[], db?: Db) -> Promise<void>` |
| `setGoalSkipDomains`  | `(goalId: string, userId: string, domains: Domain[], db?: Db) -> Promise<void>` |
| `setGoalSkipNodes`    | `(goalId: string, userId: string, nodes: string[], db?: Db) -> Promise<void>`   |

`sessions.ts` extensions:

- `previewSession` and `commitSession` no longer thread `plan.certGoals` etc. through the filter; they call `getEngineTargeting(userId, db)` and pass the result.
- `planRowToEnginePlan` either deletes (callers move to a `targetingToEnginePlan` analog) or shrinks to the session-shape fields only.

`plans.ts` changes:

- `createPlan` / `updatePlan` reject non-empty `certGoals` input post-cutover (returns `PlanCertGoalsDeprecatedError`). The schema column stays during the dual-read window so existing rows survive.
- `createPlan` continues to accept `focusDomains`, `skipDomains`, `skipNodes`, `sessionLength`, `defaultMode`, `depthPreference`. These do not move to goal.

## Constants

`libs/constants/src/study.ts` additions:

```typescript
/**
 * Telemetry source label for getEngineTargeting reads. Used by the dual-read
 * window's counters and surfaced in the structured log line.
 */
export const ENGINE_TARGETING_SOURCES = {
	GOAL: 'goal',
	PLAN: 'plan',
	EMPTY: 'empty',
} as const;
export type EngineTargetingSource = (typeof ENGINE_TARGETING_SOURCES)[keyof typeof ENGINE_TARGETING_SOURCES];
export const ENGINE_TARGETING_SOURCE_VALUES = Object.values(ENGINE_TARGETING_SOURCES);
```

No new ID prefixes (no new tables). No new route entries (no new pages -- plan-edit and goal pages are already on routes).

## Validation

| Field / surface                                   | Rule                                                                                                                                                                           |
| ------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `goal.focus_domains` / `goal.skip_domains`        | Each entry in `DOMAIN_VALUES`. CHECK or BC-layer.                                                                                                                              |
| `goal.skip_nodes`                                 | Each entry resolves to an existing `knowledge_node.id`. BC-layer; FK enforcement is impractical for a JSONB array.                                                             |
| `study_plan.cert_goals` (during dual-read window) | Stays NOT NULL DEFAULT '[]'; new writes from `createPlan` / `updatePlan` reject non-empty. CHECK can't express "must be empty" without breaking existing rows; enforced at BC. |
| `getEngineTargeting` source                       | Returns one of `ENGINE_TARGETING_SOURCE_VALUES`. Type-checked.                                                                                                                 |
| Backfill script result                            | Reports 0 active study_plans with `cert_goals != [] AND source='plan'` before cutover lands.                                                                                   |

## Edge cases

- **User has a primary goal with zero `goal_syllabus` rows.** Goal is the source; `certs = []`. Engine treats empty cert filter as "all certs" (existing behavior). No fallback to `study_plan` -- the goal is the truth, even when empty.
- **User has a primary goal AND a non-empty study_plan, and they disagree.** Goal wins. Disagreement counter increments. No silent merge.
- **User has multiple active goals, none `is_primary=true`.** Partial UNIQUE prevents the missing-primary case at insert-time; pre-existing rows could lack a primary if the migration didn't run cleanly. `getPrimaryGoal()` returns null in that case; `getEngineTargeting()` falls back to `study_plan`. Surface a one-time backfill log line ("user X has active goals but no primary; falling back to plan").
- **User switches primary goal mid-session.** `previewSession` reads the targeting at the start of the call; once a session is committed, its slots are locked. The next `previewSession` (for the next session) reads the new targeting. The engine never re-resolves mid-session; this is consistent with how `study_plan` worked.
- **Manual `cert` / `focus` override on `previewSession`.** Wins over both goal and plan. Same precedence as today's `options.cert ?? plan.certGoals[0]`. Documented in `previewSession` JSDoc.
- **`sessionLength` / `depthPreference` on the plan are stale relative to the goal's intent.** Out of scope -- those are session-shape settings, not learner intent. If the user wants longer sessions they edit the plan; the goal stays focused on what to study. Spec covers in design.md ("session shape vs learner intent split").
- **A `goal_syllabus` row points at a syllabus whose primary credential has been archived.** `getDerivedCertGoals()` already filters on `credential_syllabus.primacy='primary'`; archived credential_syllabus rows are excluded from the cert projection. The goal still surfaces the syllabus to the user; the engine just sees no cert filter contribution from it. Same behavior as today's "archived cert in study_plan.cert_goals" edge case.
- **`getEngineTargeting()` called for a deleted user.** Returns `source='empty'`. No crash. Log line reflects the empty path.
- **Telemetry mechanism (Open Question c) goes down.** The targeting helper logs a fallback warning to stderr but does not block the engine. Targeting reads are not gated on telemetry.

## Open Questions

The user resolves each before tasks.md finalizes.

### (a) Plan-creation UX -- redirect or write-through?

**Recommended: write-through with the existing UI for the dual-read window, then redirect to goal composer once the column is dropped.**

| Option                                                    | For                                                                                 | Against                                                                                                                                                               |
| --------------------------------------------------------- | ----------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Redirect to goal composer immediately (recommended-alt)   | Single source of truth from day one. No write-through plumbing.                     | Forces plan-edit -> goal-edit context switch. Existing learners with mental model of "plan = my study config" hit a redirect mid-flow.                                |
| Write-through under the hood                              | Zero user-visible change. Safest mid-flight. Existing test suite continues passing. | Two writes per save (plan + goal); easy to drift if the implementation forgets to keep them in sync. Mitigated by writing only to goal post-validation, then derived. |
| Both: write-through during dual-read, redirect after drop | Best of both -- nothing breaks now; mental model migrates with the column drop.     | Two implementations (write-through for dual-read; redirect post-drop). Code lives only one extra release.                                                             |

### (b) Goal-vs-plan precedence -- goal wins, last-write-wins, or merge?

**Recommended: goal wins.**

The goal is owned by the cert-syllabus model; the plan's `cert_goals` is the legacy slot scheduled for removal. No merge: the legacy slot is on its way out, and a merge introduces a third semantic ("this cert is in goal AND plan -> something different from either alone") that would have to be specced and tested with no value.

| Option                  | For                                                                                   | Against                                                                                                                            |
| ----------------------- | ------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------- |
| Goal wins (recommended) | One direction of truth. Plan's `cert_goals` cannot influence the engine post-cutover. | Users who edit `cert_goals` directly (via legacy API or DB) see no engine effect. Mitigated by the plan UI no longer surfacing it. |
| Last-write-wins         | Whoever wrote most recently is "right." Robust to either edit path.                   | Two writers, two semantics, easy to confuse. The whole point of the cutover is to retire the second writer.                        |
| Union of both           | Defensive: takes both lists, dedupes.                                                 | Three-way semantic. A user who removed a cert from the goal still sees it in targeting. Counter-intuitive.                         |

### (c) Telemetry mechanism for the dual-read counter

**Recommended: structured logger output (`info` level) with a parseable JSON payload, scraped from production logs by a small `bun run` script when verifying the trigger condition. No new metrics row, no audit_log entry per session preview.**

| Option                                             | For                                                                                          | Against                                                                                                                                 |
| -------------------------------------------------- | -------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------- |
| Structured logger (recommended)                    | Existing infrastructure. Zero schema work. Easy to scrape via `jq`. Disposable post-cutover. | Log retention is the only window; if logs roll before the trigger is hit, signal is lost. Mitigated by log retention being long enough. |
| New metrics row in DB (`engine_targeting_metrics`) | Permanent record. SQL-queryable. Survives log rotation.                                      | New table for one observability window then orphaned. Schema bloat for a transient telemetry need.                                      |
| Audit log entry per preview                        | Reuses the audit_log infrastructure. SQL-queryable.                                          | High write volume (one entry per preview, every session). audit_log is for state-changing events, not read-side observability.          |

### (d) Trigger to drop `cert_goals` -- N sessions or fixed window?

**Recommended: N consecutive days where every `previewSession` call across all production users resolves with `source='goal'` (i.e. legacy-path read count = 0). Lock N at 14 days.**

A fixed time window (e.g. "two weeks post-cutover") is defensible but couples the trigger to wall-clock time rather than evidence of behavior. The N-consecutive-days rule directly verifies that no user is still falling through to the plan path; if a stale user's first session in 30 days hits the legacy path, the counter resets. Once 14 consecutive days pass with the legacy counter at zero, the migration runs.

| Option                                              | For                                                                     | Against                                                                                                               |
| --------------------------------------------------- | ----------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------- |
| 14 consecutive days zero legacy reads (recommended) | Direct evidence the legacy path is unused. Resists stale-user re-entry. | Requires the telemetry mechanism above to be live the whole window.                                                   |
| Fixed 30-day window post-cutover                    | Predictable. Calendar-driven.                                           | Doesn't account for stale users who haven't logged in. A returning learner could still hit the legacy path on day 31. |
| Manual user sign-off only                           | Joshua decides when to drop.                                            | Subjective; not reproducible.                                                                                         |

### (e) Helper file location -- new `engine-targeting.ts`, extend `goals.ts`, or extend `sessions.ts`?

**Recommended: new file `libs/bc/study/src/engine-targeting.ts`.**

`goals.ts` is already mid-sized and owns the goal CRUD; the targeting helper depends on goal reads but spans goal + plan + telemetry, which is broader than goals alone. `sessions.ts` is the consumer; co-locating would invert the dependency. A dedicated file makes the cutover boundary clear and gives future "multi-goal targeting" extensions a home.

| Option                                  | For                                                                         | Against                                                                                                                  |
| --------------------------------------- | --------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------ |
| New `engine-targeting.ts` (recommended) | Clear boundary. Multi-goal extensions land here. Easy to test in isolation. | One more file. Slight cross-import overhead between goals + plans + sessions.                                            |
| Extend `goals.ts`                       | Targeting is goal-derived; co-location reduces imports.                     | `goals.ts` grows past the "single responsibility" line. Plan reads + telemetry + engine concerns leak in.                |
| Extend `sessions.ts`                    | Consumer-co-located.                                                        | Inverts dependency direction; sessions imports from goals + plans, not the other way around. Logic ownership is unclear. |

## Migration considerations

- **Goal targeting columns ship in this WP's migration.** `goal.focus_domains`, `goal.skip_domains`, `goal.skip_nodes` added as `jsonb NOT NULL DEFAULT '[]'`. Backfill: each existing goal inherits values from its owner's active `study_plan` -- a goal a user owns sees that user's plan's lists. If the user has multiple active goals (only one primary), all of them inherit -- the migration is a one-shot initial state, not an ongoing sync.
- **No new tables.** The targeting helper composes existing rows.
- **`cert_goals` drop is a separate migration.** Ships as `0NNN_drop_cert_goals.sql` in this WP's directory but lands in a follow-up PR after telemetry verifies the trigger. The PR is one file plus a status update on this WP.
- **Drizzle migration ordering.** Run after the goal + goal_syllabus tables exist (already on main from cert-syllabus WP). Run before the engine cutover code lands -- the targeting columns must exist before `getEngineTargeting()` reads them, otherwise the BC throws on missing columns.
- **Telemetry counters reset on every deploy.** No persisted state across restarts; the trigger condition needs N consecutive days of clean logs, not N consecutive deploys. If a deploy resets the counter mid-window, the window restarts -- fine for a 14-day target.
- **Rollback.** If the cutover misbehaves, revert is a single `git revert` against the engine PR. The goal targeting columns stay (they're additive); the plan's `cert_goals` is still populated; the engine reverts to reading `plan.certGoals`. No data loss.

## Risks

| Risk                                                                                                                      | Mitigation                                                                                                                                                                                                                                                                                       |               |              |                                                                                                |
| ------------------------------------------------------------------------------------------                                | ----------------------------------------------------------------------------------------------------------------                                                                                                                                                                                 |               |              |                                                                                                |
| The PR #270 migrator missed users; backfill script surfaces orphaned plans.                                               | Re-run the migrator (or its equivalent in this WP) against affected users before the engine cutover lands. Backfill script is required to report zero before merge.                                                                                                                              |               |              |                                                                                                |
| Engine call-graph is wider than the spec captures; some slice picker still reads `plan.certGoals` directly.               | Phase 3 grep contract: `grep -rn "certGoals\                                                                                                                                                                                                                                                     | focusDomains\ | skipDomains\ | skipNodes" libs/bc/study/src/` returns only the new helper file + tests. CI gate on this grep. |
| `getEngineTargeting()` adds a round-trip per `previewSession`.                                                            | The helper makes 1-2 reads (goal lookup + optional plan lookup). Cache within a single `previewSession` call (request-scoped). Aggregate latency increase is sub-millisecond.                                                                                                                    |               |              |                                                                                                |
| Disagreement counter spikes after release because the migrator's snapshot is older than the user's most recent plan edit. | The first 24h post-deploy may show high disagreements; the drift script identifies which users; the migrator re-runs against them. The trigger window starts fresh after stabilization.                                                                                                          |               |              |                                                                                                |
| Plan-edit page action accidentally double-writes (writes both plan and goal) and they drift.                              | If write-through is chosen, the page action writes only to goal; the derived `cert_goals` projection on plan reads is the only place the column gets a value, and that projection is read-only post-cutover. Tests assert the page action does not call `update(study_plan).set({ certGoals })`. |               |              |                                                                                                |
| The `cert_goals` column drop migration races with a long-running `previewSession`.                                        | Migration window is the same as any other Drizzle migration; readers either see the column or they don't, never half-state. Drop ships in maintenance window.                                                                                                                                    |               |              |                                                                                                |
| Telemetry log volume balloons.                                                                                            | Log line is single-line JSON; one per preview is acceptable in volume terms (sessions/day << logs/day from other surfaces). Sample at 100% during the dual-read window; sampling is reconsidered post-drop.                                                                                      |               |              |                                                                                                |
| Multi-goal future work requires a different targeting shape (weighted union).                                             | The `EngineTargeting` type lives in `engine-targeting.ts`; multi-goal becomes a different return shape on the same helper. The engine pickers' contract is the resolved cert/domain/node lists, not the goal model -- the abstraction holds.                                                     |               |              |                                                                                                |
| Engine integration tests on legacy-path users break if the test fixture predates the goal migrator.                       | Test fixtures explicitly seed both shapes (one user with goal, one with plan-only, one with both). No fixture relies on PR #270 having run.                                                                                                                                                      |               |              |                                                                                                |

## References

- [Design](./design.md) -- rationale, alternatives considered, key decisions
- [Tasks](./tasks.md) -- phased implementation plan
- [Test plan](./test-plan.md) -- manual acceptance scenarios
- [User stories](./user-stories.md) -- learner-perspective narratives
- [ADR 016 -- Cert, Syllabus, Goal, and the Multi-Lens Learning Model](../../decisions/016-cert-syllabus-goal-model/decision.md)
- [Learning Philosophy](../../platform/LEARNING_PHILOSOPHY.md)
- [Cert, Syllabus, and Goal Composer spec](../cert-syllabus-and-goal-composer/spec.md) -- the WP whose Open Question 4 this WP resolves
- [Cert Dashboard spec](../cert-dashboard/spec.md) (PR #321)
- [Goal Composer spec](../goal-composer/spec.md) (PR #324)
- [Evidence Kind Gating spec](../evidence-kind-gating/spec.md) -- parallel WP that touches the same goal model
- [docs/work/NOW.md](../../work/NOW.md) -- "Follow-on 3" sketch
