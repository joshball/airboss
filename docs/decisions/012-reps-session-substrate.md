# ADR 012: Unify reps and sessions onto one substrate

Status: **Accepted**.

Date proposed: 2026-04-22. Date accepted: 2026-04-22.

Supersedes: nothing. Informs: rep flow, session engine, dashboard aggregators, calibration.

## Decision

Unify `/reps/session` and `/sessions/[id]` onto the `session` + `session_item_result` substrate. Delete `repAttempt`. Replace the "create-a-plan-first" gate on rep entry points with a **preset gallery** that lets a user spin up a session in one click.

One runner. One audit trail. One mental model.

## What changed since the proposal

The original draft (Option C) argued that two runners were the low-risk path because "plan-gating UX is worse than today's one-click reps." The user reframed: the gate isn't the problem -- the empty-state is. A preset gallery with a small set of ready-to-go plans lets a user go from dashboard to first scenario in one click, regardless of whether they've ever authored a plan.

That collapses the main objection to Option B. The secondary objection (schema migration cost) is exactly the kind of thing the PRIME DIRECTIVE ("do the right thing, always; no stubs; no 'for now'") tells us not to defer. Split audit trails get more expensive every week: every new dashboard query, every aggregator, every cross-surface metric has to branch on "rep vs session" until the migration happens.

Do the hard stuff early. Accepting Option B.

## The preset gallery

When a user hits an entry point that needs a session and has no active plan, the `/session/start` page renders a gallery of presets instead of an empty-state wall. Each preset creates a plan with sensible defaults and immediately starts a session.

Initial preset set (authored content, not enum values):

1. **Reps only -- all domains** -- zero cert goals, no focus restrictions, session length default, mode = `mixed`. The direct replacement for today's `/reps/session` one-click experience.
2. **Private Pilot overview** -- cert goal = PPL, focus domains span the PPL knowledge areas, session length default.
3. **Safety procedures overview** -- focus on `safety-ops` and `emergency-procedures` domains (names tbd from the domain taxonomy).
4. **BFR prep** -- mixed PPL review, emphasis on flight review topics (airspace, regs, maneuvers, emergency ops).
5. **FIRC** -- instructor refresher, focus on CFI-relevant regs, learning theory, checkride-instructor topics.
6. **Create your own study plan** -- links to `/plans/new` for full control.

Each preset is a typed record with label, description, cert goals, focus domains, skip domains, depth preference, default mode, and session length. Presets live in `libs/constants/src/presets.ts` (or similar) so they're version-controlled content, not config-table rows. Users don't edit them; they pick one.

A user who picks preset (1) "Reps only -- all domains" creates a plan record of the same shape as any other plan, with all cert goals empty. There's no separate "rep-only plan" type -- it's just a plan that happens to have no cert goals, which the engine already handles.

## Why presets and not a rep-only session mode

Adding `SESSION_MODES.REPS_ONLY` to the engine would push "reps are different" into the core. The engine already has slices (`CONTINUE`, `STRENGTHEN`, `EXPAND`, `DIVERSIFY`) that compose modes. A plan with no cert goals + no focus domains naturally produces a session full of reps; no new mode needed.

The preset captures the product shape ("give me reps to practice") without forcing the engine to know about rep-only sessions. Presets are the product layer; the engine stays abstract.

## What happens to `repAttempt`

**Delete it.** Pre-alpha data is disposable -- there's one user (user zero / dev), no real history worth preserving. The migration drops the `rep_attempt` table, drops `session_item_result.repAttemptId`, and removes every `repAttempt` import from the BC.

Rejected alternatives:

- **Backfill to `session_item_result`**: would create synthetic session rows for historical attempts. Correct for a production system with real users, but the cost is real and the benefit is zero for pre-alpha data.
- **Keep `repAttempt` read-only**: would split audit trail forever. Every aggregator would read both tables. Explicitly the problem this ADR exists to solve.

## Impact on existing code

The following currently read `repAttempt` and will need to move onto `session_item_result`:

- `libs/bc/study/src/calibration.ts` -- reads `repAttempt.confidence` / `repAttempt.isCorrect` for calibration-by-rep-attempt buckets.
- `libs/bc/study/src/dashboard.ts` -- reads `repAttempt` for scheduled-reps panel and activity panel aggregates.
- `libs/bc/study/src/scenarios.ts` -- `getRepAttemptsForSession` (added in PR #24 for the resume fix) will be deleted.
- `libs/bc/study/src/knowledge.ts` -- uses `repAttempt` for knowledge-node mastery aggregation.
- `libs/bc/study/src/sessions.ts` -- `submitAttempt` writes to `repAttempt`.
- `apps/study/src/routes/(app)/reps/session/+page.server.ts` + `+page.svelte` -- entire runner replaced by a redirect.
- `apps/study/src/routes/(app)/sessions/[id]/+page.server.ts` -- already writes `repAttempt`-linked rows via `repAttemptId` foreign key; simplifies once the FK is gone.

## Execution plan

The work splits into phases with hard dependencies. Do them in order; later phases cannot run in parallel with earlier ones.

### Phase 1 -- Content and contracts

- Author the preset catalogue (`libs/constants/src/presets.ts` or similar). Typed records, one per preset. Initial set above.
- Define the `Preset` type + `PRESET_VALUES` const.

### Phase 2 -- Preset gallery UI

- `/session/start` empty-state (no active plan) renders the preset gallery instead of redirecting to `/plans/new`.
- Picking a preset posts to a new action that creates a plan from the preset and starts a session. Lands on `/sessions/[id]`.
- "Create your own study plan" preset is a link to `/plans/new`.
- First-time experience from any rep entry point is one click to first scenario.

### Phase 3 -- Redirect the rep runner

- `/reps/session` page stays as a redirect to `/session/start`.
- `ROUTES.REPS_SESSION` either points to `/session/start` directly (cleaner) or the redirect page handles it.
- All callers of `ROUTES.REPS_SESSION` keep working because the redirect is transparent.

### Phase 4 -- Schema migration: drop repAttempt

- Drizzle migration: drop `rep_attempt` table.
- Drizzle migration: drop `session_item_result.rep_attempt_id` column.
- Update `libs/bc/study/src/schema.ts` to remove the table + type exports.

### Phase 5 -- BC refactor: callers move off repAttempt

Six files listed above. Each one's queries re-target `session_item_result` (joined to `session` for user-scoping, joined to `scenario` for metadata). Confidence / correctness / timing live on `session_item_result` now.

### Phase 6 -- Delete the legacy runner

- Delete `apps/study/src/routes/(app)/reps/session/+page.svelte` and `+page.server.ts`.
- Delete `getRepAttemptsForSession` and `getScenariosByIds` from `libs/bc/study/src/scenarios.ts` (the functions added in PR #24 specifically for the legacy runner's resume).

### Phase 7 -- Verify

- E2E tests run through the preset-gallery flow.
- Dashboard renders correctly (scheduled reps panel, activity panel, calibration panel all read from `session_item_result`).
- Calibration page renders correctly.
- `bun run check` + `bun run test` clean.

## Rollback plan

None. Pre-alpha data is disposable, and the substrate unification is a terminal decision -- rolling back would require re-introducing `repAttempt` and every caller branching on two tables, which is the problem this ADR exists to solve.

If execution goes wrong, the remedy is to fix forward, not to revert.

## Followups captured elsewhere

- Tokens the new preset UI will want: `--ab-color-fg-strong`, a body font-size token. Flagged in earlier agent reports.
- Preset content is version-controlled; future presets (IFR prep, commercial prep, CFI prep, etc.) land as PRs that add preset records.
