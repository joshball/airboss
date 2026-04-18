---
title: 'PRD: Calibration Tracker'
product: study
feature: calibration-tracker
type: prd
status: unread
product_id: prd:prof:calibration-tracker
---

# PRD: Calibration Tracker

> Do you know what you don't know? Before every answer, you rate how confident you are. The tracker shows where confidence matches reality and where it doesn't. Training metacognition is training the anti-overconfidence skill that aviation rewards most.

## The Problem

Aviation accident analysis has a recurring theme: **the pilot thought they knew what they were doing, and they didn't**. Not "the pilot didn't know" -- "the pilot was confident and wrong." This is the calibration gap. It's the pilot who says "I can handle this weather" when the accurate read is "I've flown in worse, but never this specific combination." It's the CFI who says "my student can solo" when the data says they still freeze on crosswinds.

Calibration isn't a personality trait. It's a trainable skill. You can measure it, you can improve it, and the improvement transfers to real decisions. But nobody measures it for pilots. Checkride orals test knowledge. ACS standards test performance. Neither tests whether the pilot's self-assessment matches their actual performance.

The insight is simple: **if you predict your performance before every answer, and you track predictions against outcomes, you can see exactly where your confidence misaligns with your knowledge.** That's calibration data.

## The Product

A quiet, passive tracker that runs underneath the Memory Items and Decision Reps products. Three components:

1. **The ConfidenceSlider.** Appears on ~50% of reviews and reps (deterministic, not random -- same card on the same day always shows/hides consistently). Five levels: Wild Guess, Uncertain, Maybe, Probably, Certain. Captured BEFORE the answer is revealed or options are shown. Skippable.

2. **The Calibration page.** A five-bucket bar chart showing, per confidence level, how often you were actually correct. Plus per-domain breakdown -- "You're overconfident on weather but calibrated on regs."

3. **The calibration score.** A single number 0.0-1.0 representing how well your confidence matches your accuracy. Tracked over time. Shown as a trend line.

No new data tables. The tracker reads confidence and correctness data that's already being captured by Memory Items (reviews) and Decision Reps (attempts).

## Who It's For

**Primary: Joshua (user zero).** Thirty-year-lapsed CFI returning to instructing. By his own admission, needs to know honestly where he's sharp and where he's fooling himself. Calibration data turns "I think I remember this" into "I'm consistently overconfident about weather" -- actionable self-knowledge.

**Secondary: any pilot studying.** Especially those preparing for high-stakes events (checkrides, BFRs, returning from layoff). Overconfidence is the expensive mistake; calibration is the cheap fix.

**Tertiary: CFIs teaching ADM.** The hazardous attitudes framework (macho, invulnerable, anti-authority, impulsivity, resignation) has always lacked a measurement. Calibration data is the measurement. A student pilot who's consistently overconfident has a training gap that's diagnosable from the data.

## Core Experience

### The confidence prompt (in Memory Items and Decision Reps)

```text
┌────────────────────────────────────────────────────────────┐
│  Before you answer -- how confident are you?               │
│                                                            │
│   Wild Guess    Uncertain    Maybe    Probably    Certain  │
│       1────────────2───────────3─────────4───────────5     │
│      ≈0%          ≈25%         ≈50%       ≈75%       ≈100% │
│                                                            │
│                 [ Skip ]                                   │
└────────────────────────────────────────────────────────────┘
```

Labels map to an implicit probability (1 = "I'd get this right about 0% of the time blind", 5 = "I'd get this right 100%"). The mapping is shown as a tooltip, not a primary label -- the intuitive labels ("Wild Guess" through "Certain") are what people actually use.

### The calibration page -- five-bucket chart

```text
┌────────────────────────────────────────────────────────────────┐
│  Calibration                                                   │
├────────────────────────────────────────────────────────────────┤
│                                                                │
│  Your calibration score: 0.78                                  │
│  (1.00 = perfect calibration, 0.00 = maximally miscalibrated)  │
│                                                                │
│  How often you were correct, by confidence level:              │
│                                                                │
│   Confidence            Actual accuracy              Gap       │
│  ──────────────────────────────────────────────────────────    │
│   5 Certain     ████████████████████░░  91%  (expected 100%)   │
│                 ↑ slight overconfidence                        │
│                                                                │
│   4 Probably    ██████████████░░░░░░░░  65%  (expected 75%)    │
│                 ↑ OVERCONFIDENT                                │
│                                                                │
│   3 Maybe       ████████████░░░░░░░░░░  58%  (expected 50%)    │
│                 ↑ slight underconfidence                       │
│                                                                │
│   2 Uncertain   ████████░░░░░░░░░░░░░░  38%  (expected 25%)    │
│                 ↑ underconfidence                              │
│                                                                │
│   1 Wild Guess  ██░░░░░░░░░░░░░░░░░░░░  12%  (expected 0%)     │
│                 ↑ well-calibrated guesses                      │
│                                                                │
│   (Bucket "4 Probably" has 47 data points -- reliable)         │
│                                                                │
└────────────────────────────────────────────────────────────────┘
```

**Reading the chart:** You rated "Probably" on 47 questions. You expected to get those right about 75% of the time. You actually got 65% of them right. That's a 10-point overconfidence gap in your "Probably" bucket. That's where the work is.

### Per-domain breakdown

```text
┌────────────────────────────────────────────────────────────────┐
│  By Domain                                                     │
├────────────────────────────────────────────────────────────────┤
│                                                                │
│   Domain            Score   Overconfidence   Weakest bucket    │
│  ──────────────────────────────────────────────────────────    │
│   Weather            0.62         +18%        "Probably" -22%  │
│   Regulations        0.89          +2%        well-calibrated  │
│   Airspace           0.81          +6%        "Certain" -9%    │
│   Emergency Procs    0.73         +12%        "Probably" -15%  │
│   Teaching           0.55         +24%        "Certain" -28%   │
│                                                                │
│   Most work needed: Teaching (overconfidence pattern)          │
│                                                                │
└────────────────────────────────────────────────────────────────┘
```

### 30-day trend

```text
┌────────────────────────────────────────────────────────────────┐
│  Calibration Trend (30 days)                                   │
├────────────────────────────────────────────────────────────────┤
│                                                                │
│   1.0 ┤                                                        │
│       │                                                        │
│   0.9 ┤                              ╭─╮         ╭─            │
│       │                             ╭╯ ╰─╮    ╭─╮│              │
│   0.8 ┤                   ╭──╮ ╭──╮╭╯    ╰─╮ ╭╯ ╰╯              │
│       │              ╭──╮╭╯  ╰╮╯  ╰╯       ╰─╯                 │
│   0.7 ┤        ╭──╮ ╭╯  ╰╯                                     │
│       │    ╭──╮╯  ╰─╯                                          │
│   0.6 ┤ ╭──╯                                                   │
│       │ ╯                                                      │
│   0.5 ┤                                                        │
│       └─┬────────┬────────┬────────┬────────┬────────          │
│      Day 1      7        14       21       28                  │
│                                                                │
│   You've improved from 0.61 to 0.78 over 30 days.              │
│   Most of the improvement came from Weather domain work.       │
│                                                                │
└────────────────────────────────────────────────────────────────┘
```

### Empty state (first visit, no data yet)

```text
┌────────────────────────────────────────────────────────────────┐
│  Calibration                                                   │
├────────────────────────────────────────────────────────────────┤
│                                                                │
│   Not enough data yet.                                         │
│                                                                │
│   Calibration shows you where your confidence matches your     │
│   actual accuracy -- and where it doesn't. It's built from     │
│   the confidence ratings you give during card reviews and      │
│   rep sessions.                                                │
│                                                                │
│   Keep reviewing cards and doing reps. Rate your confidence    │
│   when prompted. The page will fill in as you go.              │
│                                                                │
│   Minimum for useful data: ~25 confidence-rated answers        │
│   spanning at least 3 of the 5 confidence buckets.             │
│                                                                │
│         [ Start a review session ]                             │
│                                                                │
└────────────────────────────────────────────────────────────────┘
```

## Design Principles

### Confidence before the answer

Hard constraint. Every piece of calibration data must have confidence captured BEFORE the answer is revealed, options are shown, or any hint is given. After-the-fact confidence is useless -- it measures recognition, not retrieval. This is the single most important design choice in the product.

### Silent running

Most of the time, Calibration Tracker is invisible. The confidence slider appears occasionally during reviews/reps and disappears after a choice. The calibration page is a destination the user visits, not a notification stream. This product doesn't nag or interrupt. It accumulates data quietly and shows patterns when the user looks.

### The five-bucket model

Discrete 1-5 scale, not continuous. Five buckets are:

- Enough granularity to show calibration shape (overconfidence, underconfidence, or both)
- Few enough that statistical significance is reachable with modest data
- Simple enough that users rate quickly without deliberating
- Intuitively mapped to familiar probability intervals (0%, 25%, 50%, 75%, 100%)

Seven buckets would be more granular but require more data to populate. Three buckets would collapse the interesting middle.

### Deterministic sampling (not random)

The slider appearance is determined by `hash(card_id + review_date)`, not random. Result: the same card on the same day always shows or hides consistently for the same user. This prevents "I got asked my confidence on the same card twice" UX weirdness and makes the sampling rate predictable.

### Non-judgmental framing

"You're overconfident" sounds like criticism. The UI uses neutral language: "expected 75%, actual 65%, gap 10%." Shows the gap, doesn't moralize. Pilots respond to data; they tune out lectures.

### Insufficient data is its own state

A bucket with < 5 data points shows "Need more data" rather than a misleading percentage. Users who see "100% accuracy on 1 data point!" get falsely confident. The product refuses to over-interpret small samples.

## Integration With Other Products

### Memory Items (data source)

Every card review with a confidence value is a calibration data point. The confidence + rating (>= 3 is correct) flows into bucket aggregation. No coupling beyond reading the data.

### Decision Reps (data source)

Every rep attempt with a confidence value is a calibration data point. The confidence + is_correct flows into the same bucket aggregation as card data. Combined view -- one calibration score across both products.

### The ConfidenceSlider component

Shared Svelte component in `libs/ui/src/components/ConfidenceSlider.svelte`. Used identically in Memory Items review and Decision Reps session flows. Same labels, same five buckets, same skip behavior.

### Knowledge Graph (future, post-MVP)

Per-node calibration becomes possible once cards and reps are linked to nodes. "You're overconfident specifically about holding pattern entries" is more actionable than "you're overconfident about navigation." The node-level data requires the graph work to ship first.

### Future products (Greenie Board, social)

If we ever build anonymous calibration leaderboards (the "Greenie Board" idea from APP_NAMING research, noted in [IDEAS.md](../../platform/IDEAS.md)), this is the data source. Calibration score is a fair metric -- nobody can game it by memorizing answers; you can only win by being honest with yourself.

## Success Criteria

### MVP (first ship)

- [ ] ConfidenceSlider component exists, used in both Memory Items review and Decision Reps session
- [ ] Confidence captured BEFORE answer/options visible (verified by manual test)
- [ ] Sampling at ~50% of reviews/reps (deterministic hash)
- [ ] Skip works without error, stores NULL, doesn't affect future sampling
- [ ] Calibration page renders five-bucket chart with accurate data
- [ ] Per-domain breakdown shows at least 3 domains with data
- [ ] Insufficient-data buckets show placeholder, not misleading %
- [ ] Calibration score is a single, reasonable number 0.0-1.0
- [ ] 30-day trend line renders (even if sparse)
- [ ] Empty state works for brand-new users

### Beyond MVP

- [ ] Per-node calibration (requires knowledge graph)
- [ ] Calibration-based study recommendations ("Focus on Weather -- you're most miscalibrated there")
- [ ] Historical comparison ("You were at 0.61 a month ago -- here's what moved")
- [ ] Confidence sampling rate as user preference (50% default, option for 100%)
- [ ] Export calibration data (CSV, for personal analysis)
- [ ] Anonymous calibration Greenie Board (requires social/privacy design)
- [ ] Per-phase-of-flight calibration (for reps)

## What This Is NOT

- **Not a grading system.** Calibration score is self-knowledge, not performance measurement. Low calibration isn't a failure; it's a diagnosis.
- **Not a study gate.** No "you can't advance until your calibration is 0.85." This isn't a test.
- **Not a social comparison tool.** Your calibration is yours. If we ever build a leaderboard (Greenie Board), it's anonymous and opt-in.
- **Not a separate product in the architecture sense.** It has no data model of its own. Every column it reads already exists in Memory Items and Decision Reps tables. This is aggregation and UI, not a new system.

## Open Questions

1. **Is 50% sampling right?** For Joshua, more data = faster learning about his own calibration. Should he opt into 100% sampling for at least the first month?
2. **Should the slider have a skip button?** Skip stores NULL, losing the data point. Some argue forcing the rating is better for data quality. Counter-argument: forced ratings teach the user to guess a number to get through. Skip preserves data honesty.
3. **Five buckets vs. seven?** Seven is more granular but needs more data. Worth A/B testing later, not a launch blocker.
4. **When do we show calibration-based recommendations?** "You're overconfident on Weather -- spend more time there" is valuable but crosses into prescriptive territory. Might fit better in the session engine than in the calibration page itself.
5. **Privacy.** If we ever surface calibration data to other users (CFI seeing student's calibration, for example), consent and privacy design is non-trivial. Defer past MVP.

## References

- [spec.md](spec.md) -- implementation contract
- [tasks.md](tasks.md) -- implementation plan
- [test-plan.md](test-plan.md) -- manual test scenarios
- [Spaced Memory Items PRD](../spaced-memory-items/PRD.md) -- data source
- [Decision Reps PRD](../decision-reps/PRD.md) -- data source
- [ADR 011](../../decisions/011-knowledge-graph-learning-system/decision.md) -- how calibration fits into the broader knowledge graph
- [Hazardous Attitudes research](https://www.faa.gov/sites/faa.gov/files/2022-04/faa_h_8083-9.pdf) -- the FAA's ADM framework that calibration data directly measures
