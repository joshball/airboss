---
name: Situational Replay
id: prd:prof:situational-replay
tagline: Make the call before you read what the pilot actually did
status: idea
priority: 3
prd_depth: light
category: proficiency
platform_mode:
  - daily-desk
audience:
  - private-pilot
  - instrument-pilot
  - cfi
  - returning-pilot
  - career-track
complexity: medium
personal_need: 4
depends_on:
  - prd:prof:decision-reps
surfaces:
  - web
  - mobile
content_reuse:
  - ntsb-cases
  - scenarios
last_worked: null
---

# Situational Replay

## What it does

Real NTSB cases reframed as decision points. You read the setup, make your call, then see what the pilot actually did -- and what happened next. Builds judgment by comparing your ADM against real outcomes.

## Core features

- NTSB cases structured as progressive-disclosure scenarios with decision gates
- You commit to a decision before seeing the outcome
- Side-by-side comparison: your call vs. the pilot's call vs. the "textbook" call
- Calibration scoring: how often does your confidence match your accuracy?
- Curated library tagged by decision type (go/no-go, diversion, emergency, ATC)

## Notes

Depends on Decision Reps (prd:prof:decision-reps) for the scenario engine. The NTSB database is public but the cases need significant editorial work to become good decision scenarios. Quality of case selection and framing is everything -- bad cases teach nothing.
