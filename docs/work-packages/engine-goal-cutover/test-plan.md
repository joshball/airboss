---
title: 'Test Plan: Engine Goal Cutover'
product: study
feature: engine-goal-cutover
type: test-plan
status: unread
review_status: pending
---

# Test Plan: Engine Goal Cutover

Manual acceptance tests for [spec.md](./spec.md). Prefix `EGC-`.

## Implementation status (2026-04-29)

Automated coverage delivered with the cutover PR:

- `libs/bc/study/src/engine-targeting.test.ts` (10 specs / 29 expects, all passing) covers EGC-10..15 + EGC-13 disagreement detection + EGC-14 primary-goal switch.
- `libs/bc/study/src/goals.test.ts` + `sessions.test.ts` regression suites continue to pass after the cutover (45 specs across the three files).
- Grep gate documented in spec.md verified post-cutover: only `engine-targeting.ts` references `plan.certGoals` / `plan.focusDomains` / `plan.skipDomains` / `plan.skipNodes` directly; `sessions.ts` references the same names only inside a comment.

Tests still left for the human verifier (UI / e2e / production-log scenarios):

- EGC-1..3 (psql column-shape inspection -- run after `bun run db push`).
- EGC-20..25 (`previewSession` integration via the running app for abby's seed user).
- EGC-30..31 (plan-creation UX redirect; the agent could not exercise the SvelteKit form action manually).
- EGC-40..43 (telemetry log-line + drift-script + backfill-check + source-counter live runs).
- EGC-50..52 (drop-trigger checker + drop migration application; gated on the 14-day window).
- EGC-60 (rollback dry-run via `git revert`).
- EGC-71..73 (cert dashboard / goal composer / audit-log cross-checks).

## Setup

- Study app running at `localhost:9600`.
- Logged in as `abby@airboss.test` (the canonical dev test learner).
- PostgreSQL on port 5435, `study` schema migrated through this WP's `0NNN_engine_goal_cutover.sql` (adds the targeting columns; does NOT yet drop `cert_goals`).
- Phase 1 backfill script run: `bun run db backfill goal-targeting`.
- abby has at least one active goal with `is_primary=true` and at least one `goal_syllabus` row.
- abby has at least one active `study_plan` with non-empty `focus_domains`.
- `bun run check` passes on the branch.

---

## Schema

### EGC-1: Goal targeting columns exist with correct shape

1. `psql -h localhost -p 5435 -d airboss -c '\d study.goal'`
2. **Expected:** `focus_domains`, `skip_domains`, `skip_nodes` columns present, all `jsonb NOT NULL DEFAULT '[]'`. No CHECK constraints required at the column level.
3. `SELECT id, focus_domains, skip_domains, skip_nodes FROM study.goal LIMIT 5;` -- every row's columns are arrays (possibly empty); none are NULL.

### EGC-2: `study_plan.cert_goals` column survives during dual-read

1. `psql -c '\d study.study_plan' | grep cert_goals`
2. **Expected:** column still present, `jsonb NOT NULL DEFAULT '[]'`.
3. **Expected:** the deprecation comment in `libs/bc/study/src/schema.ts` matches "scheduled for drop after engine cutover trigger fires."

### EGC-3: Backfill copied plan targeting onto goals

1. Pick abby's user_id. Run `SELECT id, title, is_primary, focus_domains, skip_domains, skip_nodes FROM study.goal WHERE user_id='<abby_id>';`.
2. Run `SELECT id, focus_domains, skip_domains, skip_nodes FROM study.study_plan WHERE user_id='<abby_id>' AND status='active';`.
3. **Expected:** each goal's `focus_domains`/`skip_domains`/`skip_nodes` lists equal the active plan's lists (Phase 1 backfill).
4. Re-run `bun run db backfill goal-targeting`.
5. **Expected:** stdout reports `0 goals updated` (idempotent).

---

## BC -- `getEngineTargeting`

### EGC-10: User with primary goal -> source='goal'

1. Confirm abby has `is_primary=true` on at least one goal with at least one `goal_syllabus`.
2. Open a vitest harness or `bun run repl`. Call `getEngineTargeting(abbyId, db)`.
3. **Expected:** `source='goal'`, `certs` is non-empty, `focusDomains`/`skipDomains`/`skipNodes` reflect the goal's columns.

### EGC-11: User with plan only -> source='plan'

1. Create a test user `legacy@airboss.test` with an active `study_plan` (`cert_goals=['private']`) and zero `goal` rows.
2. Call `getEngineTargeting(legacyId, db)`.
3. **Expected:** `source='plan'`, `certs=['private']`, lists match plan's columns.

### EGC-12: User with neither -> source='empty'

1. Create a test user `empty@airboss.test` with no plan and no goal.
2. Call `getEngineTargeting(emptyId, db)`.
3. **Expected:** `source='empty'`, every list is empty.

### EGC-13: Disagreement -> goal wins

1. For abby, edit primary goal so `goal_syllabus` projects to `['private']` only. Edit `study_plan.cert_goals = ['private', 'instrument']`.
2. Call `getEngineTargetingSnapshot(abbyId, db)`.
3. **Expected:** `source='goal'`, `certs=['private']`, `disagreementDetected=true`.

### EGC-14: Primary goal switch reflected next call

1. Confirm `getEngineTargeting()` returns goal A's certs.
2. Call `setPrimaryGoal(goalBId, abbyId, db)`.
3. Re-call `getEngineTargeting(abbyId, db)`.
4. **Expected:** new call returns goal B's certs; no caching across calls.

### EGC-15: depthPreference + sessionLength always come from plan

1. Goal A has whatever; abby's plan has `sessionLength=20`, `depthPreference='balanced'`.
2. Call `getEngineTargeting(abbyId, db)`.
3. **Expected:** `sessionLength=20`, `depthPreference='balanced'` regardless of which source path was taken.

---

## Engine integration

### EGC-20: previewSession reads from goal

1. abby's primary goal is set to a goal whose syllabi include PPL.
2. Trigger `previewSession(abbyId, { mode: 'mixed' }, now, db)`.
3. **Expected:** the returned items respect the PPL filter -- the same items the engine would have produced if `study_plan.cert_goals=['private']`.

### EGC-21: previewSession honors per-call cert override

1. abby's goal targets PPL. Call `previewSession(abbyId, { mode: 'mixed', cert: 'instrument' }, now, db)`.
2. **Expected:** items reflect IR filter, not PPL. The override wins over both goal and plan.

### EGC-22: previewSession honors per-call focus override

1. abby's goal focus_domains=['weather']. Call `previewSession(abbyId, { mode: 'mixed', focus: 'aerodynamics' }, now, db)`.
2. **Expected:** items reflect aerodynamics, not weather.

### EGC-23: Engine sees the same items pre/post-cutover for a stable user

1. Snapshot `previewSession()` items for abby on main (pre-cutover branch).
2. On the cutover branch, with primary goal matching old plan, snapshot again.
3. **Expected:** the two item lists are equivalent (allowing for engine seed nondeterminism if the seed differs).

### EGC-24: Legacy-fallback user (`source='plan'`) sees same items as today

1. legacy@airboss.test has plan only.
2. Snapshot `previewSession(legacyId, ...)` on main.
3. Snapshot on cutover branch.
4. **Expected:** equivalent items. The fallback path preserves engine behavior for not-yet-migrated users.

### EGC-25: Empty-source user falls through to all-cert pool

1. empty@airboss.test has neither plan nor goal.
2. `previewSession(emptyId, ...)` should not crash.
3. **Expected:** items pulled from any cert (consistent with today's behavior for `cert_goals=[]`).

---

## Plan-creation UX (Open Question (a))

The branch depends on resolution. Run the appropriate sub-section.

### EGC-30 (write-through): /plans/new submits the cert chooser; goal_syllabus rows appear

1. Sign in as a fresh user with no goal and no plan.
2. Navigate to `/plans/new`. Use the cert chooser to pick PPL + IR. Submit.
3. **Expected:** a new `study_plan` row appears with `cert_goals=[]`. A primary `goal` row appears with two `goal_syllabus` entries (PPL primary syllabus + IR primary syllabus).
4. **Expected:** `getEngineTargeting()` for this user returns `source='goal'`, `certs=['private','instrument']`.

### EGC-31 (write-through): updatePlan rejects non-empty certGoals

1. Programmatically call `updatePlan(planId, userId, { certGoals: ['private'] })`.
2. **Expected:** throws `PlanCertGoalsDeprecatedError`.

### EGC-30 (redirect): /plans/new redirects to /goals after plan create

1. Sign in as a fresh user.
2. Navigate to `/plans/new`. Submit minimal form (sessionLength, defaultMode -- no cert chooser surfaced).
3. **Expected:** the page action creates the plan with empty `cert_goals`, then redirects to `/goals/new`.
4. Complete the goal composer flow.
5. **Expected:** `getEngineTargeting()` returns `source='goal'`.

### EGC-31 (redirect): /plans/[id]/edit redirects similarly when no primary goal

1. As a user with a plan but no primary goal, visit `/plans/[id]/edit`.
2. **Expected:** redirected to `/goals/new`.

---

## Telemetry + drift

### EGC-40: Structured log line emits per previewSession

1. Run `previewSession()` for abby with the dev logger at `info` level.
2. Inspect stdout / log file.
3. **Expected:** a single line of JSON tagged `event: 'engine-targeting'` with the user id, source, disagreementDetected, and the four counts.

### EGC-41: Drift script reports 0 after Phase 5

1. Run `bun run db check plan-goal-drift`.
2. **Expected:** stdout reports `0 users with drift between primary goal and study_plan.cert_goals`.

### EGC-42: Backfill check reports 0 plans without primary goal

1. Run `bun run db check goal-targeting-backfill`.
2. **Expected:** `0 active study_plans with non-empty cert_goals and no primary goal`.

### EGC-43: Source counter reflects predominantly 'goal' reads

1. After abby has run a few sessions, run `bun run db check engine-targeting-source --since=1h`.
2. **Expected:** `source: goal=N, plan=0 or low, empty=0`.

---

## Drop-column trigger

### EGC-50: Trigger condition checker runs cleanly

1. Run `bun run db check engine-targeting-source --window=14d`.
2. **Expected:** if 14 consecutive days have zero `source='plan'` reads, output `READY TO DROP cert_goals`. Otherwise output `NOT READY: <count> legacy reads in last 14 days`.

### EGC-51: Drop migration applies cleanly

1. Once trigger fires, apply `0NNN_drop_cert_goals.sql` against a staging DB.
2. **Expected:** migration succeeds; `\d study.study_plan` no longer shows `cert_goals`.
3. Re-run `previewSession()` for abby.
4. **Expected:** no error; targeting source remains `goal`.

### EGC-52: Code cleanup grep is clean post-drop

1. After the drop migration applies and Phase 10 cleanup ships:
2. `grep -rn "cert_goals\|certGoals" libs/ apps/`.
3. **Expected:** zero matches outside test fixtures explicitly testing the legacy path.

---

## Rollback

### EGC-60: Single-PR revert restores legacy read path

1. After cutover lands, revert the engine-cutover PR (`git revert <sha>`).
2. Run `bun run check`. Expect 0 errors.
3. Run `previewSession()` for abby.
4. **Expected:** engine reads from `plan.certGoals` again. abby's session reflects the plan's cert_goals (which still equal her goal's projection because nothing was overwritten).
5. **Expected:** the goal_syllabus rows + targeting columns are unaffected (they're additive).

---

## Regression -- existing flows

### EGC-70: Existing engine tests still pass

- `bun test libs/bc/study/src/engine.test.ts` -- 0 failures.
- `bun test libs/bc/study/src/sessions.test.ts` -- 0 failures (with the new EGC-tests added).

### EGC-71: Cert dashboard unchanged

1. Visit `/credentials/private` (PR #321).
2. **Expected:** dashboard renders the same totals as on main. Reads `getDerivedCertGoals()`; this WP doesn't change that contract.

### EGC-72: Goal composer unchanged

1. Visit `/goals/[id]/edit` (PR #324).
2. **Expected:** goal composer renders + edits as before. The new targeting columns (focus_domains / skip_domains / skip_nodes) are not surfaced in the UI here -- they get a follow-on UI pass; the data layer is what this WP delivers.

### EGC-73: Audit log entries match the chosen plan-creation UX

- If write-through: editing a plan creates one audit_log entry per goal-write (no new event types; existing goal-write entries).
- If redirect: editing a plan creates one audit_log entry per plan-write only (no goal-write side-effects in the plan flow).
