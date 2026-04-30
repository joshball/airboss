---
title: 'Design: Engine Goal Cutover'
product: study
feature: engine-goal-cutover
type: design
status: unread
review_status: pending
---

# Design: Engine Goal Cutover

Rationale, alternatives, and key decisions for [spec.md](./spec.md). Read the spec first; this document explains why the spec is shaped the way it is.

## Problem in one paragraph

The cert-syllabus WP shipped a goal model that was meant to be the engine's targeting source. The goal composer (PR #324) lets a learner pick a primary goal. The cert dashboard (PR #321) reads from goals. But the session engine still reads `study_plan.cert_goals`. The result is a UI that looks like it controls study but doesn't, and a column that holds duplicated state. This WP closes the loop and retires the column.

## Design tensions

### Session shape vs learner intent

`study_plan` carries two unrelated concerns today:

- **Session shape:** `session_length`, `default_mode`, `depth_preference`, `focus_domains`, `skip_domains`, `skip_nodes`. How a session looks once we know what to put in it.
- **Learner intent:** `cert_goals`. What the learner is studying for.

These age differently. Session length is a per-feature preference -- you might run 10-card sessions one week, 25-card sessions the next, and that has nothing to do with whether you're studying PPL or IR. Cert goals are a long-term target that drives content selection -- changing them is closer to "I'm pivoting from refresher to checkride prep" than "I want shorter sessions today."

The original `study_plan` model conflated them because the goal model didn't exist. Now that it does, the split is clean: **goal owns intent (certs, domains-of-interest, exclusions); plan owns session shape (length, mode, depth)**.

This WP makes that split explicit: only intent migrates off the plan. Session length stays. Default mode stays. Depth preference stays. The plan stops being "what I'm studying" and becomes "how I want my sessions to feel" -- a smaller, tighter scope for the table.

### Where do focus_domains and skip_lists live?

They could go on either:

- **On the goal,** because a learner with multiple goals (e.g., "PPL push" + "BFR currency") likely wants different focus per goal. A BFR-focused goal naturally deprioritizes "examiner-level depth on aerodynamics" while a PPL push wants the opposite.
- **On the plan,** because skip lists feel like ergonomic preferences ("I just don't want to see CFR questions on a Thursday").

Spec.md puts them on the goal because:

- Per-goal targeting is the more useful long-term shape. Multi-goal future work needs per-goal exclusions to mean anything.
- Today's plan-level lists are seeded onto the goal during backfill, so users keep their existing exclusions without re-curation.
- The plan keeps its `focus_domains` / `skip_domains` / `skip_nodes` columns alive for the dual-read window so legacy fallback works; once the trigger fires and `cert_goals` drops, those columns drop too in a follow-on cleanup. This WP doesn't touch them yet because they don't disagree across the dual-read.

If the user resolves Open Question (e) by saying "actually those should stay on plan even post-cutover," the spec adjusts: the targeting helper reads cert from goal but focus/skip from plan. That's a small change, captured in tasks.md Phase 2.

### Dual-read or hard cutover?

Hard cutover (no fallback to plan) is simpler -- one read path, one source -- but punishes any user the migrator missed. Dual-read costs almost nothing (one extra `getActivePlan` call when no primary goal is found) and protects against migrator bugs. Spec.md picks dual-read.

### Telemetry mechanism

Three options were weighed in Open Question (c):

- Structured logger output (recommended). Cheapest. Disposable post-trigger.
- New metrics row. Permanent. Schema bloat for transient need.
- Audit log entry per preview. Reuses infrastructure but inflates the log with read-side noise.

Logger wins because the trigger window is short (14 days) and the data is observable, not state. After the column drops, the telemetry is no longer needed; the logger output naturally rolls off without needing a cleanup migration.

### Disagreement: goal wins, no merge

Why not merge?

- The dual-read window is meant to be transitional. Merging would create a third semantic that has to be specced, tested, and explained to a future reader who finds it years from now.
- The user already resolved Open Question (a) -- the plan UI no longer writes `cert_goals` after this WP. Disagreement only happens during the cutover window itself, when the migrator's snapshot is older than the user's most recent edit. Goal wins is the right rule because the goal is the live edit surface.

### When does the column drop?

A fixed time window is calendar-driven and dumb -- a returning learner could still hit the legacy path on day 31 and have a strange session.

The N-consecutive-days-zero-legacy-reads rule directly verifies what we care about: nobody's still reading from the column. If a stale user logs in and the helper falls back to plan, the counter resets and the trigger waits.

14 days is a working number. It survives:

- A user who logs in once a week (two opportunities to trip the counter).
- A weekend gap during which the dev team's sessions don't count toward the trigger.
- A staging-vs-production discrepancy (the trigger checks production logs only).

It's adjustable: spec.md says 14 because it's the round defensible number; tasks.md Phase 9 lets the user revise before merge.

## Alternatives considered

### Hard cutover with no fallback

Rejected. See "Dual-read or hard cutover?" above. The cost of dual-read is one extra DB read per preview when no goal is set; the upside is robustness against migrator gaps. Worth it.

### Keep `cert_goals` permanently as a derived view

Rejected. Two paths to "what is this user studying for" indefinitely is exactly the problem this WP exists to solve. Derived-view-forever is the dual-read window stuck open.

### Skip telemetry; just drop on a fixed date

Rejected. We need evidence the legacy path is unused. A fixed date is a guess.

### Make the targeting helper return the legacy `EnginePlan` shape directly

Rejected. The targeting helper has a different job from the plan: it composes from goal + plan, doesn't represent either alone. A separate `EngineTargeting` type captures that role. The engine's `EnginePlan` stays as the in-memory shape passed to slice pickers; the helper builds it from targeting + plan-shape fields.

### Multi-goal weighted union as part of this WP

Rejected. Multi-goal is a separate design problem (how do two goals share session time? what do disagreement rules look like across goals?). This WP cuts over the existing single-primary-goal model without extending it. Multi-goal becomes a future WP that swaps the helper's `getEngineTargeting` shape for a multi-goal variant -- clean extension point, not a foundational change.

### Drop `study_plan` entirely

Rejected. Session length, mode, depth_preference, focus_domains, skip_domains, skip_nodes still need a home. The plan keeps those; only `cert_goals` retires.

## Key decisions

| Decision                                                          | Rationale                                                                                                                         |
| ----------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------- |
| Targeting helper in a new file (`engine-targeting.ts`)            | Goal-cross-plan logic with telemetry doesn't belong in `goals.ts` (single-responsibility) or `sessions.ts` (inverted dependency). |
| Goal targeting columns added (`focus_domains`, `skip_*`)          | Per-goal targeting is the long-term shape. Backfilling from plan preserves user setup.                                            |
| Dual-read window with telemetry                                   | Cheap, robust, evidence-driven trigger.                                                                                           |
| Goal wins on disagreement                                         | Plan's `cert_goals` is on its way out; merging creates a third semantic.                                                          |
| Trigger: 14 days zero legacy reads                                | Direct evidence trumps calendar; 14 days survives weekly users.                                                                   |
| Plan UI cutover via write-through (Open Question (a) recommended) | Smaller user-visible change. Existing test suite continues to pass. Mid-flight safe.                                              |
| `depthPreference` + `sessionLength` stay on plan                  | Session-shape settings, not learner intent. Plan keeps these post-drop; only `cert_goals` retires.                                |
| New telemetry: structured log line, not a DB row                  | Disposable post-trigger; reuses existing logger infrastructure.                                                                   |
| Rollback is one-line code revert                                  | Goal data + targeting columns persist; only the engine read path reverts.                                                         |

## Operations

### Runbook -- triggering the column drop

1. Run `bun run db check engine-targeting-source --window=14d` against production logs.
2. If `READY TO DROP`, open a small PR that:
	- Applies the migration `0NNN_drop_cert_goals.sql` (already in the repo from this WP).
	- Removes the deprecation comment from `study_plan` schema.
	- Removes `getDerivedCertGoals` if no remaining caller.
	- Updates this WP's `tasks.md` Phase 9-10 checkmarks.
3. Apply against staging first; verify `previewSession()` still resolves (now hitting `source='goal'` or `source='empty'` only).
4. Apply against production during a maintenance window.
5. Update [docs/work/NOW.md](../../work/NOW.md) -- mark Follow-on 3 closed.

### Runbook -- rollback

1. `git revert <sha>` against the engine-cutover PR.
2. `bun run check` clean.
3. Deploy.
4. Engine reads from `plan.certGoals` again; goal data + targeting columns are untouched.

This is reversible because the cutover is read-only on the goal side. We never delete plan data during the cutover -- only stop writing to it. So a revert restores the prior read path against intact plan rows.

### Runbook -- post-revert recovery

If a revert is needed, the targeting columns on `goal` and the plan's `cert_goals` value can drift while the revert is in place. Re-applying the cutover PR at a later date requires re-running the backfill script first to bring the goal targeting back into sync with whatever the plan now holds. Document this in the revert PR's body so the next cutover attempt knows.

## Follow-on opportunities

These are flagged in spec.md as out of scope; resolution captured here so nothing is left dangling.

| Item                                          | Status                                                                                                                |
| --------------------------------------------- | --------------------------------------------------------------------------------------------------------------------- |
| Multi-goal weighted targeting                 | Future WP, triggered when a learner asks for it. The targeting helper's return shape is the natural extension point.  |
| Goal-edit UI for focus / skip lists           | Follow-on UI WP, triggered when the data flow lands. Goal composer (PR #324) gets the new fields surfaced.            |
| `study_plan.focus_domains` / `skip_*` cleanup | Optional follow-on. Once goal owns these end-to-end, the plan's columns become dead state. Drop in a small migration. |
| Audit-log entries for goal-targeting writes   | Existing audit_log conventions cover goal writes already; no new event types. Confirmed in test plan EGC-73.          |
| Engine-side caching of targeting helper       | If profiling shows the extra DB read matters, request-scoped cache lands in a follow-on perf WP. Not pre-optimized.   |
| Drop `getDerivedCertGoals` shim               | Phase 10 of tasks.md. Safe to drop once `cert_goals` is gone and no remaining caller exists.                          |

## References

- [spec.md](./spec.md)
- [tasks.md](./tasks.md)
- [test-plan.md](./test-plan.md)
- [user-stories.md](./user-stories.md)
- [Cert, Syllabus, and Goal Composer design](../cert-syllabus-and-goal-composer/design.md)
- [ADR 016 phase 6](../../decisions/016-cert-syllabus-goal-model/decision.md)
- [Learning Philosophy principle 4](../../platform/LEARNING_PHILOSOPHY.md)
