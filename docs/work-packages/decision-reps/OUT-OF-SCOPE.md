---
title: 'Out of Scope: Decision Reps'
product: study
feature: decision-reps
type: out-of-scope
status: unread
---

# Out of Scope: Decision Reps

Deferred items, why they're deferred, and the trigger that should make us
revisit each. Future agents and humans: do not build these without the
documented trigger. If you think the trigger is hit, surface it for a
decision rather than building silently.

## Summary

| Item                                           | Status       | Trigger to revisit                                                              |
| ---------------------------------------------- | ------------ | ------------------------------------------------------------------------------- |
| Adaptive difficulty                            | Deferred     | When attempt data shows performance-aware scenario selection would improve reps |
| Aircraft-type variants                         | Deferred     | When learners with multi-aircraft profiles need V-speed / procedure deltas      |
| Missed-reps-to-cards integration               | Deferred     | When missed-rep data accumulates and learners want auto-promoted study cards    |
| Tick engine integration (multi-step scenarios) | Follow-on WP | Owned by the `firc/` (sim) surface app; promotion, not feature growth here      |
| Scenario sharing / community pool              | Deferred     | When a community / multi-user share story earns its keep                        |
| Timed mode (countdown pressure)                | Deferred     | When learners ask for time-pressure practice as a distinct mode                 |
| Phase-of-flight filters in session             | Deferred     | When scenario volume per phase grows enough to need filtering                   |
| NTSB case studies as rep format                | Follow-on WP | Promotion from the Situational Replay PRD                                       |
| Route-specific scenario context                | Deferred     | When in-flight / pre-flight surfaces can supply route context                   |
| Multi-option / partial-credit grading          | Deferred     | When binary grading proves insufficient and authoring cost is acceptable        |

## Adaptive difficulty

Status: Deferred

What was deferred:
A scheduler that adjusts which scenarios surface based on past performance
(e.g. surface harder scenarios after several correct, repeat missed scenarios
sooner). The shipped scheduler is fixed: unattempted first, then
least-recently attempted.

Why:
Adaptive scheduling is a model-decision that requires a meaningful attempt
volume per scenario to be useful. At v1, the scenario library is small and
the simple priority order ("unattempted -> least recent") matches the
deliberate-practice framing in [PRD.md](./PRD.md).

Trigger to revisit:
Attempt data shows learners are seeing the same correctly-answered scenarios
too often, or that missed scenarios are not surfacing soon enough to drive
practice. Concretely: when per-scenario attempt counts cross a threshold
where a difficulty signal becomes statistically usable.

Implementation pattern when triggered:
Extend `getNextScenarios` in `libs/bc/study/src/scenarios.ts` with a
performance-aware ranker. Mirror the SRS scheduling pattern in
`libs/bc/study/src/srs.ts` (already shipped for cards). Persist any new
per-scenario state in a `scenario_state` table only if the ranker needs
materialized values.

References:

- [spec.md "Out of Scope"](./spec.md)
- [PRD.md "Beyond MVP"](./PRD.md)
- [design.md "No scenario_state table (unlike card_state)"](./design.md)

## Aircraft-type variants

Status: Deferred

What was deferred:
Variant scenarios that share the same situation / teaching point but differ
in aircraft-specific values (V-speeds, procedures, system layout). For
example, the same engine-failure scenario tuned for a C172 vs a PA-28.

Why:
The learner profile at v1 is single-aircraft. Adding variant tracking now
would over-design for a use case nobody is hitting. The shipped
`source_type` / `source_ref` model is enough to organise variants when they
arrive.

Trigger to revisit:
A learner with multi-aircraft prep (e.g. multi-class CFI, multi-engine
add-on, type-rating prep) needs V-speed / procedure deltas reflected in
their reps.

Implementation pattern when triggered:
Add a `variant_of` column on `study.scenario` (nullable, self-referencing
FK), plus an aircraft tag. The session loader filters by the learner's
active aircraft tag and falls back to the canonical (parent) scenario.

References:

- [spec.md "Out of Scope"](./spec.md)
- [PRD.md "Beyond MVP"](./PRD.md)

## Missed-reps-to-cards integration

Status: Deferred

What was deferred:
Auto-suggest (or auto-create) Spaced Memory Items cards from scenarios the
learner consistently misses. The intent: failure on a scenario surfaces an
underlying knowledge gap that a card can drill.

Why:
Two design choices stand in the way today. First, the gap from "scenario
miss" to "card-shape question" is content authoring, not data transformation
-- the card body needs to be written. Second, missing a scenario can mean
many things (wrong judgment, wrong recall, wrong situational read); the
card would only address the recall case.

Trigger to revisit:
Missed-rep data accumulates and learners ask for cards on the underlying
content, or the authoring cost is offset by an AI-draft path (PRD open
question 1).

Implementation pattern when triggered:
A new authoring affordance on the rep-attempt summary: "create a card from
this miss." The action opens the card editor pre-populated with the
scenario's teaching point and reg references. Card creation routes through
the existing card BC. Auto-suggestion (vs author-triggered) is a later
step.

References:

- [spec.md "Out of Scope"](./spec.md)
- [PRD.md "Beyond MVP"](./PRD.md)
- [PRD.md "Open Questions" (authoring cost)](./PRD.md)

## Tick engine integration (multi-step scenarios)

Status: Follow-on WP

What was deferred:
Multi-step scenarios with tick-loop progression, student behavior models,
and intervention ladders. Decision Reps are single-decision micro-scenarios
by design.

Why:
Per [design.md](./design.md): the tick engine targets a different product
shape. The study app stays simple; multi-step scenarios graduate to the sim
app (the `firc/` surface app, migrated from airboss-firc) which already
owns the tick engine and the student model.

Trigger to revisit:
A specific Decision Reps scenario proves valuable enough to warrant
multi-step expansion. That is a content promotion, not a feature shift
inside this WP.

Implementation pattern when triggered:
Promote the scenario into the sim app's content set. The sim app's tick
engine, scenario player, and grading pipeline already exist in
airboss-firc and migrate per
[docs/platform/MULTI_PRODUCT_ARCHITECTURE.md](../../platform/MULTI_PRODUCT_ARCHITECTURE.md).
Decision Reps stays single-decision; the promoted scenario lives in a
different app entirely.

References:

- [spec.md "Out of Scope"](./spec.md)
- [design.md "Decision Reps don't use the tick engine"](./design.md)
- [PRD.md "Future sim app"](./PRD.md)
- [docs/platform/MULTI_PRODUCT_ARCHITECTURE.md](../../platform/MULTI_PRODUCT_ARCHITECTURE.md)

## Scenario sharing / community pool

Status: Deferred

What was deferred:
A shared scenario library where authors can publish scenarios, learners can
import / copy / fork them, and the community pool drives content discovery.

Why:
The product is single-user at v1 (per
[license + hosting](../../platform/MULTI_PRODUCT_ARCHITECTURE.md)). A
community pool requires a multi-user model, moderation flow, and a
discovery surface -- none of which are in scope for the study app today.

Trigger to revisit:
A community / multi-user story earns its keep -- either the product opens
to multi-user, or a content-authoring partnership requires a shared pool.

Implementation pattern when triggered:
Add `visibility` to `study.scenario` (private / shared) and a copy path
that clones a shared scenario into a learner's personal set. Mirror the
`source_type` / `source_ref` model already in place.

References:

- [spec.md "Out of Scope"](./spec.md)
- [PRD.md "Beyond MVP"](./PRD.md)

## Timed mode (countdown pressure)

Status: Deferred

What was deferred:
A session mode that imposes a countdown timer on each scenario, forcing
the learner to decide under time pressure and flagging the time-to-decide
as part of the attempt record.

Why:
The shipped flow records `answer_ms` passively but never imposes a clock.
Time pressure is a different practice modality (closer to checkride
simulation than to deliberate practice). Mixing it into the default flow
would change the teaching shape; making it an optional mode adds UI
without a clear demand signal.

Trigger to revisit:
Learners ask for time-pressure practice -- e.g. checkride prep wants a
"realistic pace" mode, or attempt data shows learners are slowing down to
optimize accuracy in a way that hides poor recall.

Implementation pattern when triggered:
Add a session-mode toggle on `/reps/session` ("deliberate" vs "timed").
The countdown overlay reads from a new `time_limit_seconds` field on
`study.scenario` (or a session-level default). `submitAttempt` records
the time-out as a distinct outcome.

References:

- [spec.md "Out of Scope"](./spec.md)
- [PRD.md "Beyond MVP"](./PRD.md)

## Phase-of-flight filters in session

Status: Deferred

What was deferred:
A session-level filter that scopes the batch to a specific phase of flight
(e.g. "approach" only). The `phase_of_flight` column already exists on
`study.scenario`; the browse page filters on it; the session loader does
not.

Why:
At v1 the scenario library is small enough that filtering by phase would
empty the batch on most phases. The browse page already exposes the
filter for ad-hoc exploration; the session flow keeps the default of
"all phases, prioritized by recency."

Trigger to revisit:
Scenario volume per phase grows enough that a phased session has a
meaningful batch (e.g. 20+ scenarios per phase), and learners ask for
phase-scoped practice.

Implementation pattern when triggered:
Extend `getNextScenarios` to accept a `phaseOfFlight` filter. Add the
filter to the `/reps/session` route as a query param. Mirror the
browse-page filter UI on the session lobby.

References:

- [PRD.md "Beyond MVP"](./PRD.md)
- [spec.md "Behavior" -- rep session flow](./spec.md)

## NTSB case studies as rep format

Status: Follow-on WP

What was deferred:
NTSB case studies adapted into the rep format. Each case becomes a scenario
with the actual outcome, the contributing factors, and the decision points.

Why:
NTSB-format reps are a distinct authoring discipline (case selection,
fact-finding fidelity, teaching-point framing) and live in the
[Situational Replay PRD](../../vision/products/proficiency/situational-replay/PRD.md).
Promoting the format here would entangle a different content discipline
with the existing Decision Reps authoring path.

Trigger to revisit:
The Situational Replay PRD launches and decides whether NTSB-format reps
ship under Decision Reps or as their own surface.

Implementation pattern when triggered:
Promote per the Situational Replay PRD. If the format shares the existing
`study.scenario` shape, add an `ntsb_case_id` (or `source_ref` with an
NTSB prefix) and an authoring tool. If it diverges, ship as a sibling
surface and reuse the rep-session UI patterns.

References:

- [PRD.md "Beyond MVP"](./PRD.md)
- [docs/vision/products/proficiency/situational-replay/PRD.md](../../vision/products/proficiency/situational-replay/PRD.md)

## Route-specific scenario context

Status: Deferred

What was deferred:
Scenarios that substitute the learner's actual upcoming route / airports /
weather into the situation text. For example: "a diversion scenario uses
YOUR next flight's route."

Why:
Route context lives in the in-flight / pre-flight surfaces, which are
separate apps in the airboss surface taxonomy. Decision Reps does not own
a route model and adding one would entangle two product shapes.

Trigger to revisit:
The in-flight or pre-flight surface ships a route model that Decision Reps
can consume read-only -- e.g. a planned-route API or a saved-route table.

Implementation pattern when triggered:
A new authoring path where the scenario's situation text contains
templated placeholders (e.g. `{route.destination}`). The session loader
resolves placeholders against the learner's active route before render.
Falls back to the canonical situation when no route is active.

References:

- [PRD.md "Beyond MVP"](./PRD.md)
- [docs/platform/MULTI_PRODUCT_ARCHITECTURE.md](../../platform/MULTI_PRODUCT_ARCHITECTURE.md)

## Multi-option / partial-credit grading

Status: Deferred

What was deferred:
A grading model that goes beyond binary correct / incorrect -- e.g.
"this option is 80% right; you got the intent but missed the
communication step." `rep_attempt.is_correct` is boolean today.

Why:
Per [PRD.md](./PRD.md) Open Question 4: nuanced grading adds authoring
complexity (per-option weight, per-step rubric) without a clear teaching
gain at v1. Binary grading plus per-option `outcome` + `whyNot` text
already gives the learner the full reveal.

Trigger to revisit:
Binary grading proves insufficient -- e.g. learners ask "I picked the
mostly-right answer, why did it count as wrong?" or content authors push
back on having to flatten an option to correct / incorrect.

Implementation pattern when triggered:
Extend `study.scenario.options` schema with a `weight` or `partialCredit`
field. Extend `study.rep_attempt` with a score column. Update
`submitAttempt` and `getRepAccuracy` to compute weighted accuracy.
Authoring UI gets a per-option weight control.

References:

- [PRD.md "Open Questions" (multi-option grading)](./PRD.md)
- [spec.md "Behavior" -- rep session flow](./spec.md)
