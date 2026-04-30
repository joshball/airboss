---
title: 'Tasks: Engine Goal Cutover'
product: study
feature: engine-goal-cutover
type: tasks
status: unread
review_status: done
---

# Tasks: Engine Goal Cutover

Phased plan for [spec.md](./spec.md). Order is dependency-driven: schema columns first, BC helper next, engine read sites after, plan-UI cutover, telemetry window, finally the column drop.

Depends on: cert-syllabus-and-goal-composer (shipped; provides `goal`, `goal_syllabus`, `goal_node`, `getDerivedCertGoals`, `getPrimaryGoal`). Depends on: cert-dashboard (PR #321; demonstrates the goal-read pattern). Depends on: goal-composer (PR #324; primary-goal designation surface).

## Pre-flight

- [x] Read `docs/decisions/016-cert-syllabus-goal-model/decision.md`, especially phase 6.
- [x] Read `docs/platform/LEARNING_PHILOSOPHY.md`, principles 4 and 5.
- [x] Read `docs/work-packages/cert-syllabus-and-goal-composer/spec.md`, item 13 + Open Question 4.
- [x] Read `libs/bc/study/src/sessions.ts:180-260, 580-660`. Confirm the call-sites grep (Phase 3) covers every read of `plan.certGoals`.
- [x] Read `libs/bc/study/src/goals.ts` end-to-end. Confirm `getPrimaryGoal`, `getDerivedCertGoals`, `getGoalNodeUnion`, `setPrimaryGoal` shapes.
- [x] Read `libs/bc/study/src/plans.ts`. Confirm `createPlan` / `updatePlan` shape; identify the page-action call sites.
- [x] Read `libs/bc/study/src/schema.ts:690-740` (study_plan), `:1620-1690` (goal). Confirm the goal table shape; note absence of focus_domains / skip_domains / skip_nodes columns.
- [x] Read `apps/study/src/routes/(app)/plans/new/+page.server.ts` and `apps/study/src/routes/(app)/plans/[id]/+page.server.ts`. Map every place `cert_goals` is written.
- [x] Read `docs/work/NOW.md` "Follow-on 3" sketch end-to-end.
- [x] Read `docs/work-packages/cert-dashboard/spec.md` for the goal-read pattern that's already on main.
- [x] Read this WP's spec.md. Confirm Open Questions (a)-(e) resolved by user before writing code.
- [x] Verify DB is running (OrbStack postgres on port 5435).
- [x] Verify `bun run check` passes on a clean main as the baseline (pre-existing fast-xml-parser / three errors unrelated to this WP).

## Implementation

### Phase 0: Schema additions -- goal targeting columns

- [ ] Add `goal.focus_domains` column: `jsonb('focus_domains').$type<Domain[]>().notNull().default([])`. Schema: `libs/bc/study/src/schema.ts`.
- [ ] Add `goal.skip_domains`: same shape.
- [ ] Add `goal.skip_nodes`: `jsonb('skip_nodes').$type<string[]>().notNull().default([])`.
- [ ] Generate Drizzle migration via `bun run db:gen`. Inspect the resulting SQL: three `ADD COLUMN` statements, no constraint changes.
- [ ] Add `EngineTargetingSource`, `ENGINE_TARGETING_SOURCES`, `ENGINE_TARGETING_SOURCE_VALUES` to `libs/constants/src/study.ts`. Re-export from `libs/constants/src/index.ts`.
- [ ] Run `bun run check`. Expect 0 errors.
- [ ] Commit on its own PR or as Phase 0 of the WP PR -- column drop is structural and additive; safe to ship before code reads it.

### Phase 1: Backfill targeting fields from study_plan

- [ ] Author `scripts/db/backfill-goal-targeting.ts` (or equivalent location consistent with the existing scripts dir layout). For each `goal` row, look up the owning user's active `study_plan`, copy `focus_domains` / `skip_domains` / `skip_nodes` onto the goal. Idempotent: if the goal already has non-default values, skip.
- [ ] Add a CLI entry: `bun run db backfill goal-targeting`.
- [ ] Run against the dev DB with abby's seed data. Confirm her primary goal inherits her plan's targeting.
- [ ] Verify idempotency: run twice, second run reports 0 updates.
- [ ] Commit.

### Phase 2: BC -- `getEngineTargeting` helper

- [ ] Create `libs/bc/study/src/engine-targeting.ts` per Open Question (e).
- [ ] Define `EngineTargeting` interface per spec.md (source, certs, focusDomains, skipDomains, skipNodes, depthPreference, sessionLength).
- [ ] Implement `getEngineTargeting(userId, db)` per the read-order spec: primary goal first, plan fallback, empty default.
- [ ] Implement `getEngineTargetingSnapshot(userId, db)` returning the targeting plus a telemetry envelope (source, disagreementDetected: boolean, recordedAt).
- [ ] Add `goals.ts` write helpers: `setGoalFocusDomains`, `setGoalSkipDomains`, `setGoalSkipNodes`. Reuse the `getOwnedGoal` pattern.
- [ ] Add `goals.ts` read helpers: `getGoalFocusDomains`, `getGoalSkipDomains`, `getGoalSkipNodes`.
- [ ] Re-export from `libs/bc/study/src/index.ts`.
- [ ] Author `engine-targeting.test.ts` covering the read order + disagreement detection. Use the existing test-DB harness pattern from `goals.test.ts`.
- [ ] Run `bun run check`. Run the new tests via `bun test libs/bc/study/src/engine-targeting.test.ts`.
- [ ] Commit.

### Phase 3: Engine read site cutover

- [ ] In `libs/bc/study/src/sessions.ts:previewSession`, replace the `plan.certGoals` / `plan.focusDomains` / `plan.skipDomains` / `plan.skipNodes` reads with a single `getEngineTargeting(userId, db)` call. Thread the result into `EnginePoolFilters`.
- [ ] Update `planRowToEnginePlan` (rename to `targetingToEnginePlan` or similar) to accept the targeting shape rather than the plan row directly. The function shrinks: only `depthPreference` and `sessionLength` come from the plan now; the rest come from targeting.
- [ ] Run `grep -rn "plan.certGoals\|plan.focusDomains\|plan.skipDomains\|plan.skipNodes" libs/bc/study/src/`. Expect zero matches outside `engine-targeting.ts` and `*.test.ts`.
- [ ] Run `grep -rn "row.certGoals" libs/bc/study/src/`. Expect zero matches outside the targeting helper itself.
- [ ] Touch `libs/bc/study/src/engine.ts`: confirm `EnginePlan.certGoals` etc. fields stay (the in-memory shape passed to slice pickers); only the source of those values changed.
- [ ] Existing `engine.test.ts` tests should still pass with no fixture changes (the engine pickers see the same values, just from a different source).
- [ ] Run `bun run check` clean.
- [ ] Commit.

### Phase 4: New engine integration tests

- [ ] Add `previewSession` integration tests in `sessions.test.ts` (or co-locate in `engine-targeting.test.ts`):
	- [ ] User with primary goal + non-empty `goal_syllabus` rows -> `previewSession` builds filters from goal's certs.
	- [ ] User with `study_plan.cert_goals` non-empty + no primary goal -> filters fall back to plan.
	- [ ] User with both, disagreement (e.g., goal targets PPL only; plan targets PPL+IR) -> filters use goal; targeting snapshot reports disagreement.
	- [ ] User with neither -> empty cert filter; engine continues with all-cert pool.
	- [ ] Primary goal switched between two `previewSession` calls -> second call sees new targeting.
	- [ ] Manual `options.cert='ir'` override on `previewSession` -> overrides both goal and plan.
	- [ ] Manual `options.focus='weather'` override on `previewSession` -> overrides both goal and plan.
- [ ] Run `bun test libs/bc/study/src/sessions.test.ts`. Expect 0 failures.

### Phase 5: Plan-creation UX cutover (per Open Question (a))

The branch depends on the user's resolution. Both shapes are tasked here so the WP plan covers either decision.

#### If write-through (recommended):

- [ ] In `apps/study/src/routes/(app)/plans/new/+page.server.ts` page action: after creating the plan row, call `setPrimaryGoal()` + `addGoalSyllabus()` for each cert in the form input. Map cert slug -> credential -> primary syllabus id (use `getCredentialBySlug` + `getCredentialPrimarySyllabus` from cert-syllabus BC).
- [ ] `createPlan` BC fn: stop accepting `certGoals` input. Emit a `PlanCertGoalsDeprecatedError` if a non-empty array is passed. The schema column stays.
- [ ] `updatePlan`: same treatment.
- [ ] Audit the form input shape; the cert-chooser widget continues writing to the form, but the page action handler routes to goal writes.
- [ ] Add a test for the page action: submit cert-chooser form -> goal_syllabus rows appear, study_plan.cert_goals stays empty.

#### If redirect:

- [ ] `/plans/new` page strips the cert chooser. The form action creates only the plan row (no `certGoals`), then `redirect(303, ROUTES.GOALS_NEW)` if no primary goal exists, else `redirect(303, ROUTES.GOAL_EDIT(primaryGoalId))`.
- [ ] `/plans/[id]/edit` page same treatment.
- [ ] Update the page-tests and e2e to match the new flow.
- [ ] Add a deprecation note in `plans.ts` JSDoc: "cert_goals input no longer accepted; use the goal composer."

### Phase 6: Plan-edit + goal-edit consistency tests

- [ ] E2E (Playwright in `tests/e2e/`): create plan -> set primary goal via goal composer -> start session -> verify the items selected reflect the goal's certs, not whatever was in `cert_goals`.
- [ ] E2E: edit primary goal targeting (focus_domains) -> next session reflects the new focus.
- [ ] E2E: a user with a fresh `study_plan` (legacy fallback path) sees the same engine behavior as today (no regression).

### Phase 7: Telemetry + drift detector

- [ ] In `getEngineTargetingSnapshot`, emit a structured log line at `info` level. JSON shape: `{ event: 'engine-targeting', userId, source, disagreementDetected, certsCount, focusDomainsCount, skipDomainsCount, skipNodesCount }`.
- [ ] Author `scripts/db/check-plan-goal-drift.ts`: query for users whose `getDerivedCertGoals(userId)` (cert projection from primary goal) differs from `study_plan.cert_goals` (sorted, deduped). Print user id + both lists. Read-only.
- [ ] Add CLI: `bun run db check plan-goal-drift`.
- [ ] Run against dev seed data. Expect 0 drift after Phase 5 lands (write paths are unified).
- [ ] Author `scripts/db/check-engine-targeting-source.ts`: tail the structured log + a date range, parse the JSON lines, report counts by source. Surface a quick sanity counter for the trigger condition.
- [ ] Add CLI: `bun run db check engine-targeting-source`.

### Phase 8: Backfill sanity script

- [ ] Author `scripts/db/check-goal-targeting-backfill.ts`: walk every active `study_plan` with `cert_goals != []`, ask `getEngineTargeting(userId)`, count rows where `source='plan'`. Read-only.
- [ ] Add CLI: `bun run db check goal-targeting-backfill`.
- [ ] Run against dev seed data. Expect 0 plans without a primary goal post-Phase-1.
- [ ] If non-zero, document in this WP's `tasks.md` what to do: re-run the cert-syllabus migrator against affected users; do not merge until clean.

### Phase 9: Trigger condition + column drop migration

- [ ] Author the Drizzle migration `0NNN_drop_cert_goals.sql` removing `study_plan.cert_goals`. Ship in this WP's PR but DO NOT apply locally yet -- the migration sits as an unapplied artifact gated on the trigger.
- [ ] Author the trigger-checker script (uses Phase 7's source counter) -- reports "ready to drop" when N=14 consecutive days show zero `source='plan'` reads (per Open Question (d)).
- [ ] Document the runbook in design.md "Operations" section: "When the trigger fires, apply the migration via `bun run db:migrate` against staging then production; verify the engine still resolves targeting (it now hits `source='goal'` or `source='empty'` only)."
- [ ] After this WP merges, the column drop is a separate trivial PR consisting of the migration file already in the repo plus a status update in NOW.md and this tasks.md.

### Phase 10: Code cleanup

- [ ] Once `cert_goals` is dropped:
	- [ ] Remove `getDerivedCertGoals(userId)` from the BC -- it's now identical to `getEngineTargeting(userId).certs` for the goal path; the back-compat shim is no longer needed.
	- [ ] Remove the `EnginePlan.certGoals` field from `engine.ts` (if the engine no longer threads it through; the targeting helper now owns the projection).
	- [ ] Remove the `study_plan.cert_goals` reference from `planRowToEnginePlan` if anything still imports it.
	- [ ] Run `grep -rn "cert_goals\|certGoals" libs/ apps/`. Expect zero matches.
- [ ] Update [docs/work/NOW.md](../../work/NOW.md): mark Follow-on 3 closed; remove from suggested-next-up.
- [ ] Update this WP's `status` field to `done` once the user signs off.

### Phase 11: Documentation

- [ ] Update [docs/decisions/016-cert-syllabus-goal-model/decision.md](../../decisions/016-cert-syllabus-goal-model/decision.md) phase 6: mark cutover complete.
- [ ] Add a "Lessons learned" section to design.md if the cutover surfaced anything (e.g., disagreement counter found drift in a flow we missed).
- [ ] Cross-link this WP from [docs/work-packages/cert-syllabus-and-goal-composer/spec.md](../cert-syllabus-and-goal-composer/spec.md) Open Question 4 -- replace "follow-on WP" with the actual link.

## Verification

- [ ] `bun run check` passes with 0 errors, 0 warnings.
- [ ] `bun test libs/bc/study/` passes.
- [ ] `bun test apps/study/` passes.
- [ ] `bun run test:e2e tests/e2e/goal-composer.spec.ts` passes.
- [ ] All scenarios in `test-plan.md` exercised manually with abby's seed data.
- [ ] Backfill script reports 0 plans without a primary goal.
- [ ] Drift script reports 0 disagreements.
- [ ] Telemetry log emits one `engine-targeting` event per `previewSession`; source classification matches expected values.
- [ ] After 14 consecutive days of zero legacy reads, drop migration is applied and Phase 10 cleanup ships.
