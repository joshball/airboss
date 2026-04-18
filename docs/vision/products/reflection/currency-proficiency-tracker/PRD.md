---
name: Currency & Proficiency Tracker
id: prd:ref:currency-proficiency-tracker
tagline: Currency is legal. Proficiency is real. Track both.
status: idea
priority: 4
prd_depth: light
category: reflection
platform_mode:
  - reflection
audience:
  - private-pilot
  - instrument-pilot
  - cfi
complexity: low
personal_need: 3
depends_on: []
surfaces:
  - web
  - mobile
content_reuse:
  - regulations
last_worked: null
---

# Currency & Proficiency Tracker

## What it does

Tracks both currency (legal status per 61.56, 61.57, 61.58) and proficiency (your actual readiness to fly). Two separate signals, two different colors. Currency says you're allowed. Proficiency says you're ready. They're not the same thing.

## Core features

- Currency countdown timers for flight review, instrument, night, tailwheel, type
- Proficiency self-assessment based on recency, practice, and scenario performance
- Side-by-side display: green/yellow/red for each
- Notifications before currency expires with prep recommendations
- "Legal but rusty" warnings when currency is green but proficiency is yellow

## Notes

Low complexity for the currency tracking (it's just date math against regulatory requirements). The proficiency signal is harder -- it needs data from other products or honest self-assessment. The core insight is separating the legal question from the safety question.
