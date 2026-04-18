---
title: 'PRD: Decision Reps'
product: study
feature: decision-reps
type: prd
status: unread
product_id: prd:prof:decision-reps
---

# PRD: Decision Reps

> Judgment practice in 60-second doses. Read a situation, pick a response, see the outcome and teaching point. Build aviation decision-making the same way pilots actually develop it -- by making calls, seeing results, and debriefing.

## The Problem

Aviation training teaches two things that rarely travel together: **knowledge** (what the FAR says, what icing looks like, what a stalled wing feels like) and **judgment** (what to actually DO when you're at 800 AGL and the engine is rough). Knowledge accumulates in books. Judgment accumulates in cockpits.

The gap is: most pilots get plenty of knowledge practice (checkride orals, written tests, Sporty's) and almost no deliberate judgment practice between checkrides. Real-cockpit judgment practice is expensive ($250/hr) and rare (a BFR every 2 years). Simulator practice is better but still infrequent and heavy to set up.

What's missing is **low-friction, high-frequency judgment practice.** The 60-second scenario you can do on the couch with a cup of coffee. Not to replace simulator time, but to add ten reps a day between real training sessions.

## The Product

Single-decision micro-scenarios. Each rep takes 60-120 seconds:

1. **Read the situation.** 2-3 sentences. "You're climbing through 800 AGL after takeoff from a 5,000 ft runway. The engine develops a noticeable roughness. You have about 1,800 ft of runway remaining behind you, a 500 ft field straight ahead, and clear air above."

2. **Make the call.** Choose from 2-5 options. "Continue climbing", "Turn back to runway", "Land straight ahead in the field", etc.

3. **See the outcome + teaching point.** What happens if you made that call. Why the correct answer is correct. What the other options get you (consequence + "why not this one"). Regulation/AIM reference if applicable.

4. **Next rep.** Advance. 60 seconds later, you're on a different scenario.

Not multi-step simulations. Not tick-based engines with student models. Just **rep -> call -> debrief** at high volume.

## Who It's For

**Primary: Joshua (user zero).** Rebuilding judgment across the full spectrum -- VFR pattern work, instrument approaches, emergencies, teaching decisions, ADM. Needs lots of reps, varied scenarios, quick feedback loop.

**Secondary: pilots preparing for events.** Checkride prep, BFR prep, IPC prep. People who need to think through scenarios before they fly them.

**Secondary: CFIs maintaining decision-making sharpness.** An instructor who hasn't flown a particular emergency in six months gets stale. Decision reps keep the judgment patterns active.

**Long-term: student pilots learning ADM concepts.** Hazardous attitudes, PAVE, DECIDE -- these are abstract until you apply them to situations. Reps make them concrete.

## Core Experience

### Rep session flow

```text
┌──────────────────────────────────────────────────────────────┐
│                                                              │
│   Start session -> 10 reps queued                            │
│                                                              │
│   ┌─────────────────────────────────────────────────────┐    │
│   │  Rep 1 of 10                                        │    │
│   │                                                     │    │
│   │  Situation:                                         │    │
│   │  You're climbing through 800 AGL after takeoff      │    │
│   │  from a 5,000 ft runway. The engine develops a      │    │
│   │  noticeable roughness. You have about 1,800 ft      │    │
│   │  of runway behind you, a 500 ft field straight      │    │
│   │  ahead, and clear air above.                        │    │
│   │                                                     │    │
│   │  What do you do?                                    │    │
│   │                                                     │    │
│   │  ( ) Continue climbing, declare emergency           │    │
│   │  ( ) Turn back to runway (the "impossible turn")    │    │
│   │  (•) Land straight ahead in the field               │    │
│   │  ( ) Attempt a 180 to a crossing runway             │    │
│   │                                                     │    │
│   │              [ Submit ]                             │    │
│   └─────────────────────────────────────────────────────┘    │
│                            ↓                                 │
│   ┌─────────────────────────────────────────────────────┐    │
│   │  ✓ Correct                                          │    │
│   │                                                     │    │
│   │  Your choice: Land straight ahead                   │    │
│   │                                                     │    │
│   │  Why this is the right call:                        │    │
│   │  At 800 AGL with an engine problem, the energy      │    │
│   │  budget doesn't support a safe turnback...          │    │
│   │                                                     │    │
│   │  Why not "turn back":                               │    │
│   │  The "impossible turn" is a leading cause of fatal  │    │
│   │  LOC accidents on takeoff. The minimum altitude...  │    │
│   │                                                     │    │
│   │  Why not "continue":                                │    │
│   │  Rough engine doesn't guarantee flight. You're not  │    │
│   │  gaining meaningful options by climbing...          │    │
│   │                                                     │    │
│   │  Teaching point:                                    │    │
│   │  The engine-out decision is pre-brief work, not     │    │
│   │  in-the-moment work. Know your turnback altitude    │    │
│   │  BEFORE you take off.                               │    │
│   │                                                     │    │
│   │  Reference: AC 61-83K A.11 Loss of Control          │    │
│   │                                                     │    │
│   │              [ Next Rep ]                           │    │
│   └─────────────────────────────────────────────────────┘    │
│                                                              │
│   ... 9 more reps ...                                        │
│                                                              │
│   ┌─────────────────────────────────────────────────────┐    │
│   │  Session complete                                   │    │
│   │                                                     │    │
│   │  10 reps    8 correct    80% accuracy               │    │
│   │                                                     │    │
│   │  By domain:                                         │    │
│   │    Emergency Procedures:  3/3                       │    │
│   │    ADM/Judgment:          3/4                       │    │
│   │    Regulations:           2/3                       │    │
│   │                                                     │    │
│   │              [ Another Session ]   [ Back ]         │    │
│   └─────────────────────────────────────────────────────┘    │
│                                                              │
└──────────────────────────────────────────────────────────────┘
```

### Dashboard

```text
┌────────────────────────────────────────────────────────────┐
│  Decision Reps                                             │
├────────────────────────────────────────────────────────────┤
│                                                            │
│   Available scenarios: 47        Attempted: 34             │
│   Today: 8 reps, 75% accuracy                              │
│                                                            │
│   Accuracy by domain (last 30 days):                       │
│     Emergency Procs ........ 82% (ten reps)                │
│     ADM/Human Factors ...... 71% (fourteen reps)           │
│     Instrument Approaches .. 67% (six reps)                │
│     Weather Decisions ...... 85% (eight reps)              │
│     Teaching .............. 60% (five reps)                │
│                                                            │
│   [ Start Session ]    [ Browse Scenarios ]   [ New ]     │
│                                                            │
│   Recently missed (review recommended):                    │
│     • "VFR into IMC -- continue, descend, or 180?"         │
│     • "Student freezes on final with crosswind..."         │
│     • "ATC asks for speed you can't make. How to respond?" │
│                                                            │
└────────────────────────────────────────────────────────────┘
```

### Confidence prompt (pre-decision, ~50%)

```text
┌────────────────────────────────────────────────────────────┐
│  Rep 1 of 10                                               │
├────────────────────────────────────────────────────────────┤
│                                                            │
│  [Situation text...]                                       │
│                                                            │
│  ────────────────────────────────────────────────────────  │
│                                                            │
│  Before you choose -- how confident are you?               │
│                                                            │
│  Wild Guess    Uncertain    Maybe    Probably    Certain   │
│      1────────────2───────────3─────────4───────────5      │
│                                                            │
│                 [ Skip ]    [ Continue ]                   │
│                                                            │
└────────────────────────────────────────────────────────────┘
```

Same pattern as Memory Items. Confidence captured BEFORE options are shown, so the calibration signal is clean. Feeds Calibration Tracker.

### Scenario creation

```text
┌────────────────────────────────────────────────────────────┐
│  New Scenario                                              │
├────────────────────────────────────────────────────────────┤
│                                                            │
│   Title: [ Engine rough at 800 AGL ]                       │
│                                                            │
│   Situation (markdown):                                    │
│   ┌────────────────────────────────────────────────────┐   │
│   │ You're climbing through 800 AGL after takeoff      │   │
│   │ from a 5,000 ft runway...                          │   │
│   └────────────────────────────────────────────────────┘   │
│                                                            │
│   Options:                                                 │
│   ┌────────────────────────────────────────────────────┐   │
│   │ ( ) Option 1: [ Continue climbing ]                │   │
│   │     Outcome: [ You gain altitude but... ]          │   │
│   │     Why not: [ You're not improving your... ]      │   │
│   │                                                    │   │
│   │ (•) Option 2: [ Land straight ahead ]   CORRECT    │   │
│   │     Outcome: [ Controlled off-airport landing... ] │   │
│   │                                                    │   │
│   │ ( ) Option 3: [ Turn back to runway ]              │   │
│   │     Outcome: [ Stall-spin in the turnback... ]     │   │
│   │     Why not: [ The impossible turn has killed... ] │   │
│   │                                                    │   │
│   │ [ + Add Option ]                                   │   │
│   └────────────────────────────────────────────────────┘   │
│                                                            │
│   Teaching point (markdown):                               │
│   ┌────────────────────────────────────────────────────┐   │
│   │ The engine-out decision is pre-brief work, not     │   │
│   │ in-the-moment work...                              │   │
│   └────────────────────────────────────────────────────┘   │
│                                                            │
│   Domain:          [ Emergency Procedures ▼ ]              │
│   Difficulty:      [ Intermediate ▼ ]                      │
│   Phase of flight: [ Takeoff ▼ ]                           │
│   Reg references:  [ 14 CFR 91.3 ]  [ AC 61-83K A.11 ]     │
│                                                            │
│   [ Save ]                                                 │
│                                                            │
└────────────────────────────────────────────────────────────┘
```

Authoring takes 5-10 minutes per scenario. That's why we need ~50 scenarios to start -- enough variety to run 10-rep sessions without repeating for a week.

## Design Principles

### Judgment is the unit, not knowledge

Cards are for "what's the VFR minimum in Class C?" Reps are for "what do you do when you're 2 miles out and vis is dropping?" The question type should always require a decision under uncertainty. If the answer can be looked up, it's a card, not a rep.

### Every option is instructive

The incorrect options aren't filler. Each one represents a plausible wrong choice that real pilots make for real reasons. The "why not" explanation is the real teaching -- it addresses the reasoning that led to the wrong choice. A rep with three obvious-wrong options is just a quiz.

### No tick engine

This is not a flight simulator. It's not the FIRC scenario player with student behavior models and intervention ladders. That surface exists (or will exist) in the `firc/` surface app. Decision Reps stays simple: read, choose, debrief. If a scenario needs multiple decisions or progression, it belongs in a different product.

### Randomized option order

Options are shuffled on every display. Prevents position-based pattern-matching ("the answer is always B"). The correct answer must be earned, not guessed.

### Confidence before decision

Same as Memory Items. Calibration data requires confidence captured before outcomes are known. Sampled at ~50% to balance data collection with UX friction.

### The teaching point matters most

A rep without a teaching point is just a trivia question. The teaching point is why the learner came -- it's where the judgment framework lives. "The engine-out decision is pre-brief work" is more valuable than knowing this specific scenario's answer.

## Integration With Other Products

### Calibration Tracker (direct consumer)

Confidence + correctness on reps flows into calibration analysis alongside card review data. Overconfidence on "emergency procedures" is the kind of gap that matters clinically -- and reps are where it shows up.

### Memory Items (separate, related)

Frequently-missed reps become candidates for cards. If you keep choosing the wrong option on "engine rough at 800 AGL", the system (future feature) suggests creating a memory card for the turnback altitude math. Separate data models, shared domain.

### Knowledge Graph (future, post-MVP)

Reps get a `node_id` linking them to knowledge units. "Engine failure after takeoff" scenarios cluster under the `proc-engine-failure-after-takeoff` node. Mastery of that node factors in rep accuracy.

### Courses (FIRC, BFR Sprint)

Course-assigned scenarios behave like personal ones in the rep flow but are read-only. A BFR Sprint deck might include 30 scenarios across the key checkride areas. Source: `source_type: 'course'`, `source_ref: 'bfr-sprint:emergencies:rep-007'`.

### Future sim app

Decision Reps scenarios that prove valuable may graduate to full multi-step scenarios in the `firc/` surface app (using the scenario tick engine). That's a content promotion, not a product shift.

## Success Criteria

### MVP (first ship)

- [ ] Joshua can create a scenario in under 10 minutes
- [ ] Joshua can complete a 10-rep session in under 20 minutes
- [ ] ~50 seed scenarios across 4+ domains for meaningful rotation
- [ ] Option order randomized on every display
- [ ] Teaching point shown after every rep, regardless of correct/incorrect
- [ ] Confidence captured on ~50% of reps
- [ ] Dashboard shows accuracy by domain (last 30 days)
- [ ] Prioritizes unattempted -> least-recently-attempted in session load
- [ ] Multiple attempts on the same scenario tracked separately (improvement over time)

### Beyond MVP

- [ ] Aircraft-type variants (same scenario with different V-speeds / procedures)
- [ ] Missed-rep-to-card auto-suggestion
- [ ] Phase-of-flight filters
- [ ] Timed mode (adds pressure, flags time-to-decide)
- [ ] Scenario sharing / community pool (read-only, can be copied)
- [ ] NTSB case studies as rep format (promoted from [Situational Replay PRD](../../vision/products/proficiency/situational-replay/PRD.md))
- [ ] Integration with route-specific context (this diversion scenario uses YOUR next flight's route)

## What This Is NOT

- **Not a flight simulator.** No tick loop. No continuous state. No student behavior model.
- **Not a quiz game.** Scoring is a byproduct, not the point. A 60% accuracy rep that teaches you something valuable beats a 100% accuracy rep where you already knew the answer.
- **Not the FIRC scenario player.** That's a separate product in a separate surface (the `firc/` surface app, migrated from firc-boss).
- **Not a replacement for actual instruction.** Reps build patterns. Real cockpit work tests patterns. Both are necessary.

## Open Questions

1. **Scenario authoring cost.** Creating 50 quality scenarios is real work (5-10 hrs). How do we seed the initial library? Options: AI-drafted from NTSB reports with human review; ported from FIRC scenario library; manual first, automation later.
2. **Confidence sampling rate.** 50% default. Joshua personally may want 100% for his own calibration data. User setting?
3. **Scenario retirement.** If you've attempted a scenario 5+ times with 100% accuracy, is it done? Or do we still cycle it occasionally? Anki-style "if you know it, we'll still ask you in months" may apply.
4. **Multi-option grading.** Currently binary (correct/incorrect based on which option was marked correct). Could be more nuanced -- "this is 80% right, you got the right intent but missed the communication step." Adds authoring complexity. Deferred.
5. **Scenario versioning.** If I edit a scenario after people have attempted it, are prior attempts still valid? Content versioning story -- borrows from FIRC's [ADR 006](../../decisions/006-CONTENT_VERSIONING.md).

## References

- [spec.md](spec.md) -- implementation contract
- [design.md](design.md) -- schema, BC functions, no-tick-engine rationale
- [tasks.md](tasks.md) -- implementation plan
- [test-plan.md](test-plan.md) -- manual test scenarios
- [Spaced Memory Items PRD](../spaced-memory-items/PRD.md) -- the complementary retention product
- [Calibration Tracker PRD](../calibration-tracker/PRD.md) -- consumer of confidence/correctness data
- [ADR 011](../../decisions/011-knowledge-graph-learning-system/decision.md) -- how reps fit into the knowledge graph
