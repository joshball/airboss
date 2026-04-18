---
name: Ten-Minute Ticker
id: prd:prof:ten-minute-ticker
tagline: The daily workout for pilot proficiency -- 10 minutes, every day
status: idea
priority: 2
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
personal_need: 4
depends_on:
  - prd:prof:spaced-memory-items
  - prd:prof:decision-reps
  - prd:prof:calibration-tracker
surfaces:
  - web
  - mobile
content_reuse:
  - scenarios
  - regulations
  - memory-items
  - weather-data
  - ntsb-cases
last_worked: null
---

# Ten-Minute Ticker

## What it does

A daily 10-minute mixed session: some spaced rep cards, some micro-scenarios, some weather calls. Interleaved across topics. Adapts to your weak areas. This is the habit-forming daily touch -- the "Duolingo for flying." Individual products like prd:prof:spaced-memory-items (cards), prd:prof:decision-reps (decisions), and prd:prof:wx-calls (weather) are the drills; this product sequences them into a coherent daily practice that keeps all your knowledge domains alive.

## What it looks like

Open the app, tap "Today's Session," and you're in. Ten minutes of mixed content -- a spaced rep card on holding entries, then a weather METAR decode, then a 60-second engine failure scenario, then back to a regulation recall card. The mix changes daily based on which domains need attention and what's due for review. A session summary shows what got practiced, what's starving for attention, and your streak count.

Key screens:

- **Today's session** -- full-screen, one item at a time, progress bar showing time remaining
- **Session summary** -- domains practiced, accuracy, confidence calibration, streak
- **Domain heatmap** -- which areas are getting regular practice, which are going cold
- **Settings** -- session length (5/10/15 min), preferred mix ratios, time-of-day reminder

## Who it's for

- **Private pilots (primary)** -- fly 2-4 times a month, need to keep knowledge sharp between flights. Ten minutes at breakfast keeps the rust away.
- **Instrument pilots** -- more domains to maintain (approaches, weather, holds, lost-comm). Interleaving prevents the "I only study what I like" trap.
- **Returning pilots** -- daily sessions during recovery build the habit that sustains long-term proficiency.
- **CFIs** -- staying current across the full breadth of what they teach. Easy to get deep in one area and let others rot.
- **Career-track pilots** -- daily practice for written exams, checkrides, or currency maintenance.

## Core features

- Orchestrated daily sessions pulling content from prd:prof:spaced-memory-items (spaced rep), prd:prof:decision-reps (decision reps), and prd:prof:wx-calls (weather calls)
- Interleaving algorithm that mixes topics within a session (not blocked by domain)
- Adaptive weighting -- weak areas get more items, strong areas get maintenance doses
- Configurable session length: 5, 10, or 15 minutes
- Time-boxed items -- each piece of content has an expected duration, session planner fills to the target time
- Streak tracking with "don't break the chain" mechanics
- Domain attention heatmap -- visual display of which knowledge areas are getting practice and which are going cold
- Session history -- review past sessions, replay missed items
- Pre-flight mode variant -- session weighted toward today's planned flight conditions
- Difficulty progression -- new users get easier items, difficulty increases as performance improves

## Technical challenges

- Session orchestration is the core technical problem. Pulling content from multiple source products (prd:prof:spaced-memory-items, prd:prof:decision-reps, prd:prof:wx-calls), respecting each system's scheduling rules (spaced rep intervals, scenario rotation), and assembling a coherent 10-minute session that feels curated, not random.
- Time estimation per item. A spaced rep card takes 10 seconds. A weather decode takes 90 seconds. A decision scenario takes 120 seconds. Need accurate duration models to fill exactly 10 minutes.
- Interleaving vs. spaced repetition tension. The interleaving algorithm wants to mix topics. The spaced rep algorithm wants to show cards at specific intervals. These goals conflict -- the orchestrator needs to balance both.
- Difficulty calibration across content types. A "medium" card and a "medium" scenario should feel roughly equivalent in challenge. Calibrating across different content formats is hard.
- Cold start problem. New users have no performance data -- the first week of sessions will be generic until the system learns their profile.

## Audience challenges

- The "Duolingo problem" -- gamification (streaks, points, badges) can trivialize serious content. Pilots may feel patronized by game mechanics on safety-critical material. The framing needs to be "professional practice routine," not "fun learning game."
- Competing with doing nothing. The hardest part is building the daily habit. Most pilots don't practice between flights. The value proposition needs to be visceral -- "this is the 10 minutes that keeps you sharp."
- Session quality perception. If a session feels random or disconnected, users will stop. The interleaving needs to feel purposeful, not chaotic.
- Content freshness. Daily users will quickly notice repetition if the content pools are too small. Depends heavily on prd:prof:spaced-memory-items, prd:prof:decision-reps, and prd:prof:wx-calls having large content libraries.
- Power users who want longer or more focused sessions may feel constrained by the 10-minute format. The settings need to accommodate this without losing the core "quick daily" identity.

## MVP

- Orchestrated 10-minute sessions pulling from prd:prof:spaced-memory-items (spaced rep cards) and prd:prof:decision-reps (decision reps)
- Basic interleaving across 4+ domains per session
- Session summary with accuracy and domain breakdown
- Streak counter with daily reminder
- Domain heatmap showing practice distribution over time

## Ideal launch

- Full three-source orchestration (prd:prof:spaced-memory-items + prd:prof:decision-reps + prd:prof:wx-calls)
- Adaptive weighting based on performance history and knowledge decay models
- Pre-flight mode pulling conditions-specific content
- Configurable session length and mix preferences
- Social accountability -- opt-in leaderboards or study-buddy streak matching
- Weekly digest email: "Here's what you practiced, here's what's going cold"

## Content dependencies

- Spaced Memory Items (prd:prof:spaced-memory-items) card database with duration estimates per card type
- Decision Reps (prd:prof:decision-reps) scenario library with duration and difficulty metadata
- WX Calls (prd:prof:wx-calls) weather scenario library (for ideal launch, not MVP)
- NTSB case summaries for scenario generation
- Cross-product tagging system so the orchestrator can select by domain, difficulty, and duration

## Builds on / feeds into

- **Depends on** [Spaced Memory Items](../spaced-memory-items/) (prd:prof:spaced-memory-items) -- primary content source for recall items
- **Depends on** [Decision Reps](../decision-reps/) (prd:prof:decision-reps) -- primary content source for judgment drills
- **Depends on** [Calibration Tracker](../calibration-tracker/) (prd:prof:calibration-tracker) -- confidence ratings during sessions feed calibration data
- **Receives from** [WX Calls](../wx-calls/) (prd:prof:wx-calls) -- weather scenarios as a third content source (ideal launch)
- **Feeds into** [Recency Recovery](../../event-prep/recency-recovery/) (prd:evt:recency-recovery) -- daily ticker sessions can serve as the study delivery mechanism for recovery plans
