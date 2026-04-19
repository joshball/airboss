---
name: Recency Recovery
id: prd:evt:recency-recovery
tagline: The ground-up knowledge rebuild that gets you BFR-ready
status: idea
priority: 2
prd_depth: full
category: event-prep
platform_mode:
  - daily-desk
  - event-cram
audience:
  - returning-pilot
  - private-pilot
  - instrument-pilot
  - cfi
complexity: medium
personal_need: 5
depends_on:
  - prd:prof:spaced-memory-items
  - prd:prof:decision-reps
surfaces:
  - web
  - mobile
content_reuse:
  - regulations
  - memory-items
  - scenarios
  - weather-data
  - airspace-rules
  - approach-plates
last_worked: null
---

# Recency Recovery

## What it does

Structured re-entry program for pilots who haven't flown in months or years. Not a BFR -- that's a checkride with a CFI. This is the ground knowledge rebuild that prepares you FOR the BFR. Assess what you've forgotten, build a personalized study plan, fill gaps through spaced repetition and decision scenarios, track readiness per domain, and tell you when you're ready to book the flight review.

## What it looks like

Starts with an intake assessment: what certificates do you hold, how long have you been away, what has changed in aviation since you left. The system generates a personalized study plan across knowledge domains -- airspace, weather, regulations, procedures, avionics, aerodynamics. Daily study sessions pull from Spaced Memory Items (prd:prof:spaced-memory-items) for recall and Decision Reps (prd:prof:decision-reps) for judgment. A progress dashboard shows readiness per domain with a composite "BFR-ready" confidence score.

Key screens:

- **Intake assessment** -- certificate history, lapse duration, experience level, goals (VFR only? instrument? teaching again?)
- **Study plan** -- domain map showing gap severity, recommended daily load, estimated time to ready
- **Daily session** -- curated mix of cards and scenarios weighted toward weakest domains
- **Progress dashboard** -- per-domain readiness bars, trend over time, BFR-ready composite score
- **What's changed** -- era-aware briefing on regulatory, technology, and procedural changes since you last flew

## Who it's for

- **Returning pilots (primary)** -- this IS the product owner's use case. 30 years lapsed, CFI cert maintained via FIRC, needs to rebuild everything from airspace to glass cockpits to teaching methodology. This product is literally his personal learning journey packaged.
- **Lapsed instrument pilots** -- instrument skills and knowledge atrophy faster than VFR. Approach procedures, weather minimums, lost-comm, holds -- all need rebuilding before an IPC.
- **CFIs returning to teach** -- teaching currency requires not just knowing the material but knowing it well enough to explain and evaluate. Higher bar than personal proficiency.
- **Private pilots after a break** -- even a 6-month gap creates surprising knowledge decay. Airspace dimensions, weather minimums, right-of-way rules.

## Core features

- Intake assessment that maps certificate history, lapse duration, and goals to a gap profile
- Era-aware "what's changed" content -- someone lapsed 5 years has different gaps than someone lapsed 30 years (ADS-B, BasicMed, GPS approaches, TFRs, drone rules, glass cockpits)
- Personalized study plan with domain prioritization and daily session targets
- Daily sessions pull from prd:prof:spaced-memory-items (spaced memory) and prd:prof:decision-reps (decision reps), weighted to weak areas
- Per-domain readiness tracking with explicit criteria (not just "did you review the cards")
- BFR-ready confidence score based on assessment results, not just time spent
- Phase progression: assess -> study -> consolidate -> ready (not a linear march through chapters)
- Regulation change tracker -- highlights FARs that changed during your lapse period
- CFI-specific track: adds teaching methodology, endorsement requirements, student evaluation skills
- Exportable readiness report to share with BFR examiner ("here's what I've been studying")

## Technical challenges

- Assessment quality is the hardest problem. How do you measure what someone has forgotten? Multiple-choice tests are too coarse. Need a mix of recall, application, and decision questions that expose specific gaps without being a 3-hour exam.
- Personalization requires mapping lapse duration and certificate type to expected knowledge decay curves. There's limited research on this -- mostly intuition and CFI experience.
- Era-aware content is a content management challenge. "What changed between 2005 and 2025" is a different document than "what changed between 2020 and 2025." Need date-tagged change records, not static articles.
- The BFR-ready score needs to mean something. If it says "ready" and you fail the BFR, trust is destroyed. Conservative scoring is better than optimistic, but too conservative and nobody ever reaches "ready."
- Depends heavily on prd:prof:spaced-memory-items and prd:prof:decision-reps having sufficient content volume. Recovery sessions need hundreds of cards and dozens of scenarios per domain.

## Audience challenges

- Returning pilots may feel embarrassed about how much they've forgotten. The UX must normalize knowledge decay -- it's biology, not failure.
- Competing with "just go fly with a CFI" advice. Many pilots skip ground review and go straight to a BFR attempt. Need to demonstrate that structured ground prep makes the BFR cheaper, faster, and less painful.
- Long-lapsed pilots (10+ years) face a months-long recovery. Sustaining motivation over weeks of daily study without ever flying requires strong progress visibility and milestone design.
- CFI-track users need different content depth than personal-proficiency users. Same domain, different bar.

## MVP

- Intake assessment covering 6 core domains (regulations, airspace, weather, procedures, navigation, aerodynamics)
- Gap profile generation with domain-level severity ratings
- Study plan that sequences prd:prof:spaced-memory-items card decks and prd:prof:decision-reps scenario sets by priority
- Progress dashboard showing domain readiness and overall composite
- Basic "what's changed" content for 3 eras: 0-2 years, 2-10 years, 10+ years

## Ideal launch

- Adaptive assessment that adjusts question difficulty based on responses (shorter, more accurate)
- Era-specific change briefings with exact date ranges and regulation citations
- CFI-specific recovery track with teaching methodology and endorsement content
- IPC-ready track for instrument pilots (separate from VFR BFR readiness)
- Readiness report generation with domain scores, time invested, and areas of remaining weakness
- Integration with scheduling -- "you're ready, here are CFIs near you who do BFRs" (future)

## Content dependencies

- Domain assessment question banks (regulations, airspace, weather, procedures, navigation, aerodynamics)
- Era-tagged regulatory and procedural change records (what changed, when, citation)
- Spaced Memory Items (prd:prof:spaced-memory-items) decks organized by recovery domain
- Decision Reps (prd:prof:decision-reps) scenarios tagged by domain and difficulty
- CFI-specific content: teaching methodology, endorsement requirements, evaluation standards

## Builds on / feeds into

- **Depends on** [Spaced Memory Items](../../proficiency/spaced-memory-items/) (prd:prof:spaced-memory-items) -- daily sessions pull review cards from this system
- **Depends on** [Decision Reps](../../proficiency/decision-reps/) (prd:prof:decision-reps) -- daily sessions pull judgment scenarios from this system
- **Feeds into** [Calibration Tracker](../../proficiency/calibration-tracker/) (prd:prof:calibration-tracker) -- confidence data from assessments and sessions builds calibration profile
- **Receives from** [Approach Rehearsal](../../pre-flight/approach-rehearsal/) (prd:pre:approach-rehearsal) -- plate-reading exercises feed the procedures/navigation domain
- **Receives from** [WX Calls](../../proficiency/wx-calls/) (prd:prof:wx-calls) -- weather decision exercises feed the weather domain
