---
title: 'Out of Scope: Study Plan + Session Engine'
product: study
feature: study-plan-and-session-engine
type: out-of-scope
status: unread
---

# Out of Scope: Study Plan + Session Engine

Deferred items, why they're deferred, and the trigger that should make
us revisit each. Future agents and humans: do not build these without
the documented trigger. If you think the trigger is hit, surface it
for a decision rather than building silently.

## Summary

| Item                                                           | Status       | Trigger to revisit                                                                     |
| -------------------------------------------------------------- | ------------ | -------------------------------------------------------------------------------------- |
| Multiple active plans per user                                 | Deferred     | When a user needs to pursue two cert paths simultaneously with distinct configurations |
| Plan sharing or templates across users                         | Rejected     | Never -- see detail below                                                              |
| ML-based weight tuning or learned models                       | Deferred     | When enough completed-session data exists to fit a learned scoring model               |
| Custom mode weight tuples exposed as user settings             | Deferred     | When the four built-in modes provably fail a class of user goals                       |
| Cross-surface session items (audio drill, spatial walkthrough) | Follow-on WP | When a new session-item kind needs to live alongside cards / reps / nodes              |
| Calendar-like projected load views                             | Deferred     | When users repeatedly ask "how much do I have to do this week"                         |
| Goal deadlines (BFR Sprint / IPC Sprint countdowns)            | Follow-on WP | When the cert / goal model supports deadline-bearing goals end-to-end                  |
| Natural-language focus parsing                                 | Rejected     | Never -- see detail below                                                              |
| Paired-session suggestions (card session -> rep session)       | Deferred     | When session summaries surface a pattern where pairing improves retention              |
| Activity items (interactive visualizations as session items)   | Follow-on WP | When the `activities` lib produces visualizations that fit into a graded session slot  |
| Mid-session replace of an already-committed item               | Deferred     | When user research shows commit-then-skip is friction the engine should solve          |
| Session resume window beyond 2 hours                           | Deferred     | When observed abandonment patterns show 2h is too short                                |
| Mood-aware mode suggestions                                    | Deferred     | When a reliable mood signal exists and aligns with mode efficacy data                  |
| Anki-style scheduler replacement (move SRS into the engine)    | Rejected     | Never -- see detail below                                                              |

## Multiple active plans per user

Status: Deferred

What was deferred:
Support for two or more plans with `status = 'active'` for the same user at the same time. v1 enforces single-active-plan via a partial UNIQUE index on `study.study_plan`: `CREATE UNIQUE INDEX plan_user_active_uniq ON study.study_plan (user_id) WHERE status = 'active';`. Activating a plan archives any other active plan in the same transaction.

Why:
Joshua is the only user, and his current need is a single PPL-focused plan. Multi-active complicates the engine (which plan's filters apply to a given session?), the UI (which plan is the user editing?), and the skip-list semantics. None of that complexity has a customer yet.

Trigger to revisit:
When a user actively pursues two cert paths simultaneously (e.g. PPL ground school + IFR rebuild) and the single-plan model produces visible friction (skip lists conflict, focus domains conflict, session content gets diluted).

Implementation pattern when triggered:
Drop the partial UNIQUE index; add a `session.plan_id` already records which plan a session was generated against (already in the schema). Add a "primary plan" pointer on the user (or use the most-recently-active plan) for session start. Mirror the route shape -- `/plans/:id` already supports per-plan edit.

References:

- [spec.md "Out of Scope for v1"](./spec.md)
- [spec.md "Plan lifecycle"](./spec.md)
- [spec.md "Validation -- one-active-plan invariant"](./spec.md)

## Plan sharing or templates across users

Status: Rejected

What was rejected:
Mechanisms to publish a plan as a template, copy another user's plan, or subscribe to a shared plan.

Why:
airboss is private / all-rights-reserved hosted by Joshua (see global memory: "License + hosting"). There is no public user base to share plans with. Plans are user-specific configurations of cert goals, focus, and skip lists -- the things most coupled to a single learner's needs. A re-decision would require the product reopening multi-user / community as a goal.

References:

- [spec.md "Out of Scope for v1"](./spec.md)
- Global memory: License + hosting (private / all-rights-reserved)

## ML-based weight tuning or learned models

Status: Deferred

What was deferred:
Replacing or tuning the fixed mode weights and slice-scoring rules with a learned model that personalizes from completed-session data. v1's engine is a deterministic function of `plan + history + graph + mode + overrides + seed`, with explicit weighted slices and hand-authored score formulas.

Why:
Explicit rules are testable, auditable, and shuffle-able by varying the seed. A learned model trades transparency for personalization gains that are unproven without data. We are collecting the data needed (every `study.session_item_result` row records `slice`, `reason_code`, and outcome) so tuning can run later without backfill.

Trigger to revisit:
When enough completed-session data exists to fit a model that demonstrably improves a measurable outcome (retention, accuracy, completion rate), AND when explicit rule tuning has been tried and found insufficient.

Implementation pattern when triggered:
Per-user weight personalization first -- a tiny per-user `study.engine_weights` table keyed by `user_id` overriding `modeWeights` when present. The engine reads from the override if present, else from the built-in `MODE_WEIGHTS` constant. Model-fitting lives in a separate offline job; the engine consumes its output, not training data.

References:

- [spec.md "Out of Scope for v1"](./spec.md)
- [spec.md "Mode weights"](./spec.md)

## Custom mode weight tuples exposed as user settings

Status: Deferred

What was deferred:
A user setting that lets the user author their own mode (e.g. "60% strengthen, 40% diversify") beyond the four built-in modes (`continue`, `strengthen`, `mixed`, `expand`).

Why:
The four built-in modes cover the obvious axes (continue what I was doing, fix what's slipping, mix, push into new). Exposing the weight tuples as a UI before any user has hit the wall of the built-in set is a complexity trap (sliders, validation, persistence, recovery from misconfiguration).

Trigger to revisit:
When the four built-in modes provably fail a class of user goals (e.g. a user repeatedly asks for a mode the system doesn't offer), OR when ML-based weight tuning lands and exposing the underlying tuples becomes a natural side-effect.

Implementation pattern when triggered:
Add a `mode` value of `'custom'` in `SESSION_MODES`. Store the user's tuple on `study.study_plan` as a new `custom_mode_weights` jsonb column. `modeWeights(mode)` reads the plan's column when `mode === 'custom'`. UI lives on `/plans/:id` as a discreet panel below the existing mode selector.

References:

- [spec.md "Out of Scope for v1"](./spec.md)
- [spec.md "Mode weights"](./spec.md)

## Cross-surface session items (audio drill, spatial walkthrough)

Status: Follow-on WP

What was deferred:
Session items beyond the v1 set of `card`, `rep`, `node_start`. Examples: an audio-drill item, a spatial route-walkthrough item, an in-flight maneuver-prep item.

Why:
v1 keeps the item-kind enum closed (`SESSION_ITEM_KINDS = { CARD, REP, NODE_START }`) so the engine, presentation loop, and `session_item_result` schema stay tractable. Adding kinds requires a producer surface (audio, spatial, flight) and a presentation contract for each.

Trigger to revisit:
When a new producer surface (audio app, spatial app, flight surface) is ready and would benefit from being grade-able inside a session rather than as a separate entry point.

Implementation pattern when triggered:
Spawn a follow-on WP per kind. Each new kind extends `SESSION_ITEM_KINDS`, adds a discriminator branch to `SessionItem`, adds a nullable FK column on `session_item_result` (mirror `card_id` / `scenario_id` / `node_id`), and registers a presentation handler in the session route. The engine's pool-assembly logic gets a new candidate-query callback (mirror `getCandidateCards` / `getCandidateReps`).

References:

- [spec.md "Out of Scope for v1"](./spec.md)
- [spec.md "SessionItem shape"](./spec.md)

## Calendar-like projected load views

Status: Deferred

What was deferred:
A calendar view showing projected per-day load (due cards, scheduled reps) for the coming days / weeks.

Why:
The session model is the unit of work, not the day. Showing projections risks shifting the user's mental model away from "do today's session" toward "manage tomorrow's queue," which is the failure mode of language-learning apps. The Memory dashboard's "N cards due tomorrow" hint (see [spaced-memory-items spec.md](../spaced-memory-items/spec.md)) is sufficient short-horizon visibility.

Trigger to revisit:
When users repeatedly ask "how much do I have to do this week," OR when planning ahead becomes a stated workflow need.

Implementation pattern when triggered:
Read-only view at `/sessions/upcoming` that runs the engine's pool-assembly logic for the next N days against current state, without committing sessions. Visualize as a per-day count grouped by slice.

References:

- [spec.md "Out of Scope for v1"](./spec.md)

## Goal deadlines (BFR Sprint / IPC Sprint countdowns)

Status: Follow-on WP

What was deferred:
Plan-level deadlines (e.g. "BFR by 2026-06-15") that drive session prioritization, urgency indicators, and "sprint" mode behavior.

Why:
Deadlines require a goal model that captures targets and the engine modifications to prioritize against them. The cert / syllabus / goal model (ADR 016) is the right home for deadline-bearing goals; the session engine consumes that model rather than re-implementing deadlines.

Trigger to revisit:
When the cert / syllabus / goal model supports deadline-bearing goals end-to-end (deadline as a first-class field on a goal row, queryable from the BC layer), AND when a user has an active deadline-bearing goal.

Implementation pattern when triggered:
Spawn a follow-on WP. The engine reads `goal.deadline` from the cert / goal BC and adds a deadline-urgency multiplier to slice scoring. UI surfaces the deadline countdown on `/study` (already the home surface per study-home WP) and on the session preview.

References:

- [spec.md "Out of Scope for v1"](./spec.md)
- [ADR 016 -- cert / syllabus / goal model](../../decisions/016-cert-syllabus-goal-model/decision.md)

## Natural-language focus parsing

Status: Rejected

What was rejected:
An NL-style focus selector ("study holding patterns") that an LLM or rules engine maps to domains / nodes for the session.

Why:
Adds an LLM dependency to a deterministic engine. Focus is already specifiable structurally (`focus_filter`, `cert_filter`, `skip_filter`) and the wizard / plan-edit UI makes those choices explicit. NL parsing introduces ambiguity (which domain does "holding patterns" map to?), validation surface, and a failure mode the rest of the engine doesn't have. A re-decision would require evidence that structural focus selection produces user friction NL would solve.

References:

- [spec.md "Out of Scope for v1"](./spec.md)

## Paired-session suggestions (card session -> rep session)

Status: Deferred

What was deferred:
After a completed session, suggest a complementary follow-up (e.g. "you just did 10 weather cards -- run a weather scenario rep next"). The "Suggested next" hints in v1 are coarse-grained (cards-due-tomorrow, finish-node, try-strengthen) and do not include pairing logic.

Why:
Pairing is a hypothesis -- does running a card session then a rep session in the same domain measurably improve outcomes? -- not a known win. v1 surfaces the three hints already specified and stays simple.

Trigger to revisit:
When session-summary data shows a pattern (e.g. users who pair voluntarily retain better), OR when the user explicitly asks for pairing.

Implementation pattern when triggered:
Add a fourth hint kind to "Suggested next" in [spec.md "Suggested next"](./spec.md). The hint reads recent session domains + outcomes and produces a paired-mode launcher link to `/session/start?focus=<domain>&mode=<paired-mode>`.

References:

- [spec.md "Out of Scope for v1"](./spec.md)
- [spec.md "Suggested next"](./spec.md)

## Activity items (interactive visualizations as session items)

Status: Follow-on WP

What was deferred:
Items whose presentation is an interactive visualization from `libs/activities/` (e.g. Crosswind solver, performance-chart drill). v1 ships with `card`, `rep`, `node_start` only.

Why:
Activities are a distinct presentation contract: stateful, partially-graded, often timed. Adding them inside the v1 schema would force premature decisions about how attempts are recorded and graded. Better to ship cards / reps / nodes first, then design the activity slot once the activity library has a few production-ready visualizations.

Trigger to revisit:
When the `activities` lib has at least one visualization that fits the "produce a graded attempt within a session slot" contract.

Implementation pattern when triggered:
Spawn a follow-on WP. Mirror the rep pattern: a new `study.activity_attempt` row keyed by `activity_id` + `user_id` + attempt timestamp, with `is_correct` and `accuracy_score` columns. Extend `SESSION_ITEM_KINDS` with `ACTIVITY`. The engine gets a new `getCandidateActivities` callback in `EngineInputs`.

References:

- [spec.md "Out of Scope for v1"](./spec.md)
- [spec.md "SessionItem shape"](./spec.md)

## Mid-session replace of an already-committed item

Status: Deferred

What was deferred:
After a session is committed (the user clicked Start), the ability to swap one of the remaining items for a different one. v1: items are fixed at commit; only Skip mutates the experience mid-session.

Why:
Commit-snapshots the experience; the user's options mid-session are "do it" or "skip it" with three skip kinds. Adding replace makes the engine re-run state mid-session, complicates `session_item_result` semantics (was the replaced item skipped? unattempted? both?), and makes summary analytics harder to reason about.

Trigger to revisit:
When user research shows commit-then-skip is friction the engine should solve (e.g. users abandon sessions because they can't swap one bad item).

Implementation pattern when triggered:
Mirror the pre-commit replace flow ([spec.md "Adjust (optional) -- Replace an item"](./spec.md)) but write the result through `session.items` jsonb in place. Record a `session_item_result` row with `skip_kind = 'replaced'` for the dropped item, and append the replacement as a new slot.

References:

- [spec.md "Out of Scope for v1"](./spec.md)
- [spec.md "Edge Cases -- Replace-an-item after commit"](./spec.md)

## Session resume window beyond 2 hours

Status: Deferred

What was deferred:
Extending `RESUME_WINDOW_MS` (currently 2 hours) so the user can return to an abandoned session further into the future.

Why:
2 hours is an open-question guess (open question 2 in spec.md). Longer windows risk presenting stale items (the underlying card_state may have changed); shorter windows lose data. v1 ships the 2-hour guess and observes.

Trigger to revisit:
When observed abandonment patterns show 2 hours is too short (e.g. users frequently return at 3-6 hours and have to start fresh), OR when the resume experience becomes a friction the data clearly attributes to the window length.

Implementation pattern when triggered:
Adjust `RESUME_WINDOW_MS` in `libs/constants/src/study.ts`. If the change is larger than a tweak, add per-user override on `study.study_plan` and read from there with the constant as fallback.

References:

- [spec.md "Out of Scope for v1"](./spec.md)
- [spec.md "Open Questions -- Session resume window"](./spec.md)

## Mood-aware mode suggestions

Status: Deferred

What was deferred:
Adjusting suggested mode based on a self-reported mood / energy signal at session start ("low energy -- maybe Continue mode," "high energy -- try Expand").

Why:
Mood signals are unreliable, hard to capture without friction, and the relationship between mood and learning is not well-characterized. Adding the input surface and the modulation logic before having any evidence the signal helps is speculative.

Trigger to revisit:
When a reliable mood / energy signal exists (e.g. via biometric integration, or a frictionless lightweight self-report) AND aligns with mode efficacy data.

Implementation pattern when triggered:
Spawn a follow-on WP. Likely a small per-session `mood` column on `study.session` populated optionally at start. The mode recommender reads recent (session, mood, outcome) triples and suggests a mode. The user always picks; the system never auto-overrides.

References:

- [spec.md "Out of Scope for v1"](./spec.md)

## Anki-style scheduler replacement

Status: Rejected

What was rejected:
Moving spaced-repetition scheduling (the FSRS-5 algorithm) into the session engine, replacing the per-card scheduling that lives in the spaced-memory-items WP.

Why:
The session engine schedules sessions (batches of items); FSRS-5 schedules individual cards. The two operate at different layers and should stay separated -- the session engine consumes "due cards" via `getDueCards` from the cards BC, and is agnostic to how due-ness was computed. Merging them would couple two algorithms with very different evolution paths (rule-based vs FSRS-tunable) and lose the separation that makes each testable in isolation.

References:

- [spec.md "Out of Scope for v1"](./spec.md)
- [spaced-memory-items spec.md "FSRS-5 algorithm"](../spaced-memory-items/spec.md)
