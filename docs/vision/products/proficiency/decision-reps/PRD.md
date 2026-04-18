---
name: Decision Reps
id: prd:prof:decision-reps
tagline: 60-second ADM drills -- free throws, not full games
status: idea
priority: 1
prd_depth: full
category: proficiency
platform_mode:
  - daily-desk
  - pre-flight
audience:
  - private-pilot
  - instrument-pilot
  - cfi
  - returning-pilot
  - career-track
complexity: medium
personal_need: 5
depends_on:
  - engine
surfaces:
  - web
  - mobile
content_reuse:
  - ntsb-cases
  - scenarios
  - weather-data
  - airspace-rules
  - regulations
last_worked: null
---

# Decision Reps

## What it does

Single-decision micro-scenarios that take 60-120 seconds each. You get a situation -- "engine rough at 800 AGL, runway behind you" -- choose an action, see the consequences, read a brief teaching point. Not a course. Reps. Like doing free-throw drills instead of playing a full game. The goal is programming correct responses so they're available under pressure.

## What it looks like

One scenario per screen. A situation description sets the scene -- aircraft type, phase of flight, conditions, the problem. Three to five response options. Pick one. Immediately see the outcome for your choice and the teaching point explaining the best response. Before revealing the answer, rate your confidence (1-5) -- this data feeds calibration tracking.

Key screens:

- **Rep screen** -- situation text, options, confidence slider, outcome reveal
- **Session summary** -- reps completed, accuracy, average confidence vs. actual, categories practiced
- **Rep browser** -- filter by category (engine, weather, terrain, ATC, systems), difficulty, phase of flight
- **Bookmarks** -- save reps you got wrong for targeted review

## Who it's for

- **Returning pilots (primary)** -- ADM skills atrophy faster than stick skills. Reps rebuild the decision-making patterns that rust during a lapse.
- **Instrument pilots** -- weather decisions, approach minimums, alternates, lost-comm. The stakes are higher and the decisions are more nuanced.
- **CFIs** -- scenario library for teaching. Use reps as lesson starters or pre-flight discussion prompts with students.
- **Career-track pilots** -- CRM scenarios, Part 135 decision-making, multi-crew coordination problems.

## Core features

- Micro-scenarios with situation, options, outcome, and teaching point
- Confidence rating before answer reveal (1-5 scale)
- Category system: engine failure, weather decisions, terrain, ATC communication, systems failure, aeronautical decision-making, CRM
- Difficulty progression within categories (introduce complexity gradually)
- Phase-of-flight tagging: preflight, takeoff, climb, cruise, descent, approach, landing, ground
- Aircraft-type variants (same scenario, different aircraft -> different best answer)
- "Why not?" annotations on non-best options explaining the tradeoff, not just "wrong"
- Session tracking: reps per day, accuracy trend, weak categories
- Scenario authoring tools for CFIs to create and share reps
- Pre-flight mode: filter reps relevant to today's planned flight (weather conditions, route, aircraft)

## Technical challenges

- Writing defensible "best answers" for ADM scenarios. Real decisions have tradeoffs -- need to acknowledge that the best answer depends on context while still teaching a clear principle. Avoid multiple-choice-test feel.
- Scenario engine needs to support branching outcomes without becoming a full simulation. Keep it simple: situation -> choice -> outcome. Not a decision tree.
- Content volume. Need hundreds of quality scenarios to avoid repetition. Writing good ones takes aviation expertise and instructional design skill.
- Difficulty calibration. What's "easy" for a 5000-hour pilot is impossible for a student. Need adaptive difficulty or clear category/level filtering.
- Avoiding the "trick question" trap. Scenarios should test judgment, not reading comprehension or gotcha details.

## Audience challenges

- Pilots may see this as "just a quiz app." The framing matters -- reps, not tests. No grades, no pass/fail. Building muscle memory.
- Content quality is the entire product. Bad scenarios with debatable answers will destroy trust fast. Need CFI review pipeline.
- Competition from scenario-based training products (King Schools, Sporty's, etc.). Differentiation is the micro-format and the focus on isolated decisions rather than courses.
- Getting pilots to do reps daily requires habit-building UX -- streaks, reminders, but without gamification that feels patronizing.

## MVP

- 50 curated scenarios across 4 categories (engine, weather, terrain, ADM)
- Web-based rep interface with confidence rating
- Session summary with accuracy and category breakdown
- Bookmark wrong answers for review
- Teaching points with regulation/AIM references where applicable

## Ideal launch

- 500+ scenarios across all categories with difficulty levels
- Pre-flight mode: reps matched to today's conditions and route
- CFI authoring tools with peer review workflow
- Aircraft-type variants for common GA types (C172, PA-28, SR22, C182)
- Integration with Spaced Memory Items -- missed reps generate review cards
- Adaptive difficulty based on performance history

## Content dependencies

- NTSB accident case database (public, needs extraction and transformation into scenario format)
- Real-world weather scenarios (historical METARs/TAFs for realism)
- Regulation references for teaching points (FAR/AIM citations)
- Aircraft performance data for plausible scenario parameters

## Builds on / feeds into

- **Feeds into** [Spaced Memory Items](../spaced-memory-items/) (prd:prof:spaced-memory-items) -- missed decisions generate memory cards for the underlying knowledge gap
- **Receives from** [NTSB Story](../../audio/ntsb-story/) (prd:aud:ntsb-story) -- accident narratives become decision rep scenarios at their key decision points
- **Feeds into** [Calibration Tracker](../../proficiency/calibration-tracker/) (prd:prof:calibration-tracker) -- confidence ratings build calibration profile
- **Receives from** [Route Walkthrough](../../pre-flight/route-walkthrough/) (prd:pre:route-walkthrough) -- route-specific scenarios for pre-flight prep
