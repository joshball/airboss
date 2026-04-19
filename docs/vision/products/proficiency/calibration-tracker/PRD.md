---
name: Calibration Tracker
id: prd:prof:calibration-tracker
tagline: Make the gap between confidence and competence visible
status: idea
priority: 2
prd_depth: full
category: proficiency
platform_mode:
  - daily-desk
  - reflection
audience:
  - private-pilot
  - instrument-pilot
  - cfi
  - returning-pilot
  - career-track
complexity: low
personal_need: 4
depends_on:
  - prd:prof:decision-reps
  - prd:prof:spaced-memory-items
surfaces:
  - web
  - mobile
content_reuse: []
last_worked: null
---

# Calibration Tracker

## What it does

Before each scenario, quiz, or decision rep, you predict your confidence: "How sure are you that you'll get this right?" After, you see the actual result. Over time, the tracker builds a picture of the gap between what you think you know and what you actually know. This IS metacognition training -- the most important safety skill in aviation. Overconfidence kills pilots. Making that gap visible is the intervention.

## What it looks like

Lightweight and ambient -- not a standalone product you open, but a layer that lives inside other products. A confidence slider appears before you answer a prd:prof:spaced-memory-items card or a prd:prof:decision-reps scenario. After the result, a small calibration indicator shows whether you were right about your confidence. The standalone dashboard aggregates this data into calibration curves, domain-level overconfidence maps, and trend lines.

Key screens:

- **Confidence slider** -- inline widget before prd:prof:decision-reps and prd:prof:spaced-memory-items answer reveals (1-5 or percentage)
- **Calibration dashboard** -- calibration curve (predicted confidence vs. actual accuracy), overall and by domain
- **Overconfidence map** -- domains where you're most overconfident (danger zones) and underconfident (opportunity zones)
- **Trend view** -- calibration improvement over weeks and months
- **Insight cards** -- specific findings like "You rate 90% confidence on weather questions but get them right 60% of the time"

## Who it's for

- **All active platform users (primary)** -- anyone using prd:prof:decision-reps or prd:prof:spaced-memory-items generates calibration data. The tracker makes this data visible and actionable.
- **Returning pilots** -- often underestimate how much they've forgotten. Calibration data confronts this directly and motivates continued study.
- **Overconfident pilots** -- the most dangerous category. May not know they're overconfident until the data shows it. This product is literally a safety intervention.
- **CFIs** -- self-monitoring calibration across the topics they teach. Also a tool for discussing metacognition with students.
- **Career-track pilots** -- CRM and ADM frameworks emphasize self-assessment. Calibration data is concrete evidence of self-assessment skill.

## Core features

- Confidence slider widget that integrates into prd:prof:decision-reps (Decision Reps) and prd:prof:spaced-memory-items (Spaced Memory Items)
- Calibration curve visualization -- plot predicted confidence buckets against actual accuracy
- Domain-level calibration breakdown (weather, regulations, procedures, airspace, etc.)
- Overconfidence/underconfidence identification with clear labeling of risk implications
- Trend tracking over time -- is your calibration improving?
- Insight generation -- plain-language findings about systematic biases
- Comparison to well-calibrated baseline (what does good calibration look like?)
- Optional anonymized comparison to other pilots at similar experience levels
- Weekly calibration digest -- summary of where your confidence and competence diverged most

## Technical challenges

- Very low technical complexity. The data collection is a slider widget. The visualization is standard charting. The analysis is basic statistics (predicted vs. actual by bucket). This is one of the simplest products in the platform to build.
- The real challenge is statistical -- need enough data points per domain to make meaningful calibration claims. With 5-10 responses per domain, the curve is meaningless. Need to define minimum sample sizes before showing results.
- Integration architecture. The slider needs to be a shared component that prd:prof:decision-reps, prd:prof:spaced-memory-items, and eventually other products embed. Design it as a platform service, not a one-off widget.
- Privacy sensitivity. Calibration data reveals cognitive biases. Some users may not want this data stored or compared. Need clear data controls.

## Audience challenges

- Getting users to rate honestly is the primary behavioral challenge. If pilots game the slider (always pick the middle, always pick high), the data is useless. The framing must emphasize that accurate self-prediction is the skill being trained, not a score to optimize.
- Confronting overconfidence is uncomfortable. The dashboard will tell some users they're dangerously overconfident in specific areas. This needs to feel like useful information, not judgment. Framing from "Performance Pilot" book review: "well-calibrated confidence beats high confidence."
- Slider fatigue. If every single card and scenario has a confidence prompt, it becomes annoying. Consider sampling (ask on 30% of items) rather than asking every time, with an option to enable/disable.
- Some pilots will dismiss metacognition as soft skills. The product needs to connect calibration directly to safety outcomes -- specific accident cases where overconfidence was the causal factor.

## MVP

- Confidence slider integrated into prd:prof:decision-reps (Decision Reps) answer flow
- Confidence slider integrated into prd:prof:spaced-memory-items (Spaced Memory Items) review flow
- Calibration dashboard showing overall calibration curve
- Domain-level calibration breakdown (minimum 4 domains)
- Basic trend line showing calibration change over 30 days

## Ideal launch

- Insight cards with plain-language findings and safety framing
- Anonymized peer comparison at similar experience levels
- Weekly calibration digest via email or push notification
- Sampling mode to reduce slider fatigue (configurable frequency)
- Integration with additional products as they launch (prd:pre:approach-rehearsal, prd:prof:wx-calls, prd:evt:recency-recovery)
- Exportable calibration report for CFI discussions or BFR preparation
- Accident case studies linked to calibration patterns (overconfidence in weather, procedures, etc.)

## Content dependencies

- None for the core product -- calibration data comes from user interactions with prd:prof:decision-reps and prd:prof:spaced-memory-items
- Accident case studies linking overconfidence to outcomes (for insight cards and framing)
- Baseline calibration curves for reference (from aviation psychology literature)

## Builds on / feeds into

- **Depends on** [Decision Reps](../decision-reps/) (prd:prof:decision-reps) -- primary data source for decision confidence ratings
- **Depends on** [Spaced Memory Items](../spaced-memory-items/) (prd:prof:spaced-memory-items) -- primary data source for recall confidence ratings
- **Receives from** [WX Calls](../wx-calls/) (prd:prof:wx-calls) -- go/no-go confidence ratings from weather decisions
- **Receives from** [Approach Rehearsal](../../pre-flight/approach-rehearsal/) (prd:pre:approach-rehearsal) -- plate question confidence ratings
- **Feeds into** [Recency Recovery](../../event-prep/recency-recovery/) (prd:evt:recency-recovery) -- calibration data informs BFR-readiness assessment
- **Feeds into** [Ten-Minute Ticker](../ten-minute-ticker/) (prd:prof:ten-minute-ticker) -- calibration trends inform adaptive session weighting
