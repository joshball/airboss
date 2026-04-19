---
title: 'PRD: Spaced Memory Items'
product: study
feature: spaced-memory-items
type: prd
status: unread
product_id: prd:prof:spaced-memory-items
---

# PRD: Spaced Memory Items

> Aviation knowledge you actually remember. Write cards as you study; the system schedules reviews so you see each card just before you'd forget it.

## The Problem

A pilot returning after 30 years (or preparing for any cert) has a specific problem: **knowledge doesn't stick on first reading**. You read the FARs, memory items, airspace rules -- and a week later, you remember maybe 20% of it. Aviation training has always solved this with rote repetition (King Schools, Sporty's), but repetition without spacing is inefficient. You review what you already know and neglect what you're about to forget.

This is a solved problem in learning science -- **spaced repetition**. Anki has proven it at scale for medical school, language learning, and law. It's not in aviation training in any meaningful way. Not because it doesn't work -- because nobody's built it aviation-flavored.

## The Product

A flashcard system with three properties:

1. **Anki-quality scheduling.** Uses FSRS-5 (the algorithm behind modern Anki). You review a card, rate how well you knew it, and the system decides when to show it next -- minutes for cards you struggled with, months for cards you've nailed.

2. **Aviation-native content model.** Cards are tagged by domain (regulations, weather, airspace, procedures, teaching). They can come from you (personal study), from a course (FIRC, BFR Sprint), or from other products (Route Walkthrough generating "review this airport" cards).

3. **Building IS studying.** The primary use case isn't "create 500 cards then study them." It's "write a card while reading the AIM, and the next day the system asks you about it." Card creation is part of the learning loop.

## Who It's For

**Primary: Joshua Ball (user zero).** Returning CFI rebuilding knowledge across PPL / IR / CPL / CFI. Needs to retain what he's reading, in domains he hasn't touched in decades, in a way that doesn't depend on cramming.

**Secondary: active pilots.** The CFI prepping for their next checkride. The instrument pilot maintaining proficiency. The student pilot studying for the written. Anyone who's ever thought "I studied this last week, why don't I remember it?"

**Tertiary: course-driven learners.** FIRC students (future) who get course-assigned cards alongside their personal ones. Event-prep users (BFR Sprint, IPC Sprint) who get a targeted deck for their upcoming checkride.

## Core Experience

### The main loop

```text
┌─────────────────────────────────────────────────────┐
│                                                     │
│   Open the app                                      │
│       │                                             │
│       ▼                                             │
│   "12 cards due today"                              │
│       │                                             │
│       ▼                                             │
│   Review session                                    │
│   ┌─────────────────────────────────────────────┐   │
│   │ Card front: "3 VFR weather minimums in      │   │
│   │              Class C airspace?"              │   │
│   │                                              │   │
│   │ [ Show Answer ]                              │   │
│   └─────────────────────────────────────────────┘   │
│       │                                             │
│       ▼                                             │
│   Card back reveals + rate:                         │
│   [Again] [Hard] [Good] [Easy]                      │
│       │                                             │
│       ▼                                             │
│   Algorithm schedules next review                   │
│   Advance to next card                              │
│                                                     │
└─────────────────────────────────────────────────────┘
```

### Dashboard (home)

```text
┌────────────────────────────────────────────────────────────┐
│  Memory                                                    │
├────────────────────────────────────────────────────────────┤
│                                                            │
│   12 cards due               Streak: 7 days                │
│   ─────────────────          ──────────────                │
│                                                            │
│   By domain:                                               │
│     Regulations ........ 4 due ▓▓▓▓▓▓░░░░ (62% mastered)    │
│     Weather ............ 3 due ▓▓▓░░░░░░░ (31% mastered)    │
│     Airspace ........... 2 due ▓▓▓▓▓▓▓▓░░ (80% mastered)    │
│     Emergency Procs .... 2 due ▓▓░░░░░░░░ (22% mastered)    │
│     Teaching ........... 1 due ▓░░░░░░░░░ (11% mastered)    │
│                                                            │
│   [ Start Review ]      [ Browse Cards ]     [ New Card ]  │
│                                                            │
│   Recently added:                                          │
│     "VFR above 10,000" -- added 2 hrs ago                  │
│     "Holding entry for 180deg radial" -- added yesterday    │
│                                                            │
└────────────────────────────────────────────────────────────┘
```

### Review card (front)

```text
┌────────────────────────────────────────────────────────────┐
│  Card 1 of 12                             Regulations   ⦿  │
├────────────────────────────────────────────────────────────┤
│                                                            │
│                                                            │
│    What are the VFR weather minimums in                    │
│    Class C airspace (below 10,000 MSL)?                    │
│                                                            │
│                                                            │
│                                                            │
│                                                            │
│                [  Show Answer  ]                           │
│                                                            │
│                                                            │
└────────────────────────────────────────────────────────────┘
```

### Review card (answer revealed, with confidence captured pre-reveal)

```text
┌────────────────────────────────────────────────────────────┐
│  Card 1 of 12                             Regulations   ⦿  │
├────────────────────────────────────────────────────────────┤
│                                                            │
│   Q: VFR weather minimums in Class C below 10,000?         │
│                                                            │
│   A: 3 statute miles visibility                            │
│      500 feet below clouds                                 │
│      1,000 feet above clouds                               │
│      2,000 feet horizontal from clouds                     │
│                                                            │
│      Source: 14 CFR 91.155                                 │
│                                                            │
│   How well did you remember?                               │
│   ┌──────┐ ┌──────┐ ┌──────┐ ┌──────┐                      │
│   │Again │ │ Hard │ │ Good │ │ Easy │                      │
│   └──────┘ └──────┘ └──────┘ └──────┘                      │
│     <1m      <10m      ~2d       ~5d                       │
│                                                            │
└────────────────────────────────────────────────────────────┘
```

The time estimates under each button ("next review in...") make the scheduling visible. Rating is a promise: "Good" means "ask me in 2 days and I'll still know it."

### Confidence prompt (appears before answer on ~50% of reviews)

```text
┌────────────────────────────────────────────────────────────┐
│  Card 1 of 12                             Regulations   ⦿  │
├────────────────────────────────────────────────────────────┤
│                                                            │
│   Q: VFR weather minimums in Class C below 10,000?         │
│                                                            │
│   Before revealing -- how confident are you?               │
│                                                            │
│   Wild Guess    Uncertain    Maybe    Probably    Certain  │
│       1────────────2───────────3─────────4───────────5     │
│                                                            │
│                  [ Skip ]                                  │
│                                                            │
└────────────────────────────────────────────────────────────┘
```

This feeds the Calibration Tracker (see [calibration-tracker PRD](../calibration-tracker/PRD.md)). Confidence captured BEFORE you see the answer -- otherwise you're just rating how confident you are in the answer you just saw, which tells us nothing.

### Card creation

```text
┌────────────────────────────────────────────────────────────┐
│  New Card                                                  │
├────────────────────────────────────────────────────────────┤
│                                                            │
│   Front (question):                                        │
│   ┌────────────────────────────────────────────────────┐   │
│   │ What are the VFR weather minimums in Class C       │   │
│   │ airspace (below 10,000 MSL)?                       │   │
│   └────────────────────────────────────────────────────┘   │
│                                                            │
│   Back (answer):                                           │
│   ┌────────────────────────────────────────────────────┐   │
│   │ 3 SM vis, 500 below / 1,000 above / 2,000 horiz    │   │
│   │ from clouds. 14 CFR 91.155.                        │   │
│   └────────────────────────────────────────────────────┘   │
│                                                            │
│   Domain:      [ Regulations ▼ ]                           │
│   Card type:   [ Basic ▼ ]                                 │
│   Tags:        far-91, airspace-class-c                    │
│                                                            │
│   [ Save ]    [ Save and Add Another ]    [ Cancel ]       │
│                                                            │
└────────────────────────────────────────────────────────────┘
```

Quick, low-friction. If you're reading the FARs and want to capture a card, it takes 30 seconds.

## Design Principles

### Discovery-first for course content

When cards come from a course or the knowledge graph (future), the REVEAL phase shows the authoritative answer -- but the card front is the question the learner answered in the discovery phase. Cards reinforce knowledge derived from reasoning, not knowledge memorized cold. See [ADR 011](../../decisions/011-knowledge-graph-learning-system/decision.md).

### Algorithm over willpower

The user never decides "what should I review today?" -- the algorithm does. This matters because human decision-making defaults to "what I remember" (already-known cards) and away from "what I'm about to forget" (the cards that actually need review). FSRS-5 does the opposite.

### Confidence before answer

Calibration data only works if confidence is captured BEFORE the answer is revealed. After-the-fact confidence is just confidence in recognition, not retrieval. Hard constraint: the slider appears before the Show Answer button is available.

### Low friction on creation

Creating a card while reading the AIM should take less than a minute. No multi-step wizard, no approvals, no mandatory tags beyond domain. If creation is painful, cards don't get created, and the product collapses to "use someone else's deck" -- which is not the value.

### Visible scheduling

Rating buttons show the next-review estimate ("~2 days" under Good). This teaches the learner what the ratings mean and creates trust in the algorithm. A black-box scheduler fails on day 3 when the learner feels scheduled unfairly.

## Integration With Other Products

### Calibration Tracker (direct consumer)

Confidence + rating data feeds Calibration Tracker. Sampling at ~50% of reviews is a calibration mechanism, not a UX choice. Every review with confidence captured is a data point.

### Knowledge Graph (future, post-MVP)

Once the graph exists, cards get a `node_id` field that links them to a knowledge unit. Mastery of a node is derived from card performance on its cards. Card creation becomes node-scoped: "Add a card to VFR Weather Minimums."

### Decision Reps (independent)

Reps and cards are different tools for different knowledge types. Factual/recall knowledge -> cards. Judgment/decision knowledge -> reps. A learner might study both in a single session, but the data models are separate.

### Courses (future: FIRC, BFR Sprint)

A course assigns a set of cards to a learner: `source_type: 'course'`, `source_ref: 'firc:mod1:card-042'`, `is_editable: false`. Course cards appear in the learner's review queue alongside personal cards. The learner can't edit course cards -- they're the authoritative version. The course system owns the source of truth; the study system owns the review state.

### Other surface products (future: Route Walkthrough, Plate Drills)

A product can publish cards into the study system. Route Walkthrough generates "KBJC pattern entry altitude?" cards after you prep for a flight. Plate Drill generates "RNAV 24 missed approach altitude?" cards. These appear in the review queue like any other card, tagged with their source.

## Success Criteria

### MVP (first ship)

- [ ] Joshua can create a card in under 60 seconds while reading source material
- [ ] Joshua can review 10-20 cards in a focused 10-minute session without friction
- [ ] FSRS-5 scheduling works correctly: cards marked Again come back quickly; cards marked Easy recede for weeks
- [ ] Due count updates correctly in real time
- [ ] Confidence data is captured on ~50% of reviews
- [ ] Streak tracking works across consecutive days
- [ ] Cards can be tagged by domain with filter/browse working
- [ ] Suspend/archive work without breaking review queue
- [ ] Performance: dashboard loads in < 200ms with 1,000 cards

### Beyond MVP

- [ ] Card templates (regulation fill-in, memory item, plate quiz)
- [ ] Image/diagram attachments
- [ ] Import/export (Anki format, CSV)
- [ ] Shared decks (read-only, can be copied to personal)
- [ ] Auto-generation from FAR/AIM (AI-assisted card drafting)
- [ ] Offline / PWA support
- [ ] FSRS parameter optimization from user review data

## What This Is NOT

- **Not a question bank / knowledge test.** Those exist for graded assessments. This is for retention practice.
- **Not a course.** No sequencing, no completion gates, no time tracking. Cards exist without structure.
- **Not an authoring tool for others' decks.** You create cards for yourself. Hangar (future) is the authoring surface for shareable content.
- **Not a gamification experience.** No points, badges, or streaks-as-leaderboard. The streak is for YOU -- to build the daily habit. The only leaderboard we'd ever build is anonymous calibration accuracy (see Greenie Board idea in [IDEAS.md](../../platform/IDEAS.md)).

## Open Questions

1. **Confidence sampling rate.** Spec says ~50%. For Joshua (user zero, specifically wants calibration data), should this be 100%? Or does higher sampling cause review fatigue?
2. **Card creation from review.** Should the review screen have a "related card" shortcut? Supports "building IS studying" but adds UI complexity. Deferred from MVP.
3. **Multiple decks.** Currently one flat deck per user. Do we need multi-deck (e.g., "PPL study" vs "FIRC course")? Probably not -- domain tagging + filters cover this.
4. **Desktop-only vs mobile?** MVP is desktop-first (keyboard-driven review). Mobile PWA for the review flow is a natural next step but not blocking.

## References

- [spec.md](spec.md) -- implementation contract
- [design.md](design.md) -- schema, FSRS algorithm, API surface
- [tasks.md](tasks.md) -- implementation plan
- [test-plan.md](test-plan.md) -- manual test scenarios
- [user-stories.md](user-stories.md) -- user-perspective narratives
- [ADR 011](../../decisions/011-knowledge-graph-learning-system/decision.md) -- how cards fit into the broader knowledge graph
- [FSRS-5 reference](https://github.com/open-spaced-repetition/fsrs4anki/wiki/The-Algorithm) -- the algorithm
- [ts-fsrs](https://github.com/open-spaced-repetition/ts-fsrs) -- TypeScript implementation we're basing on
