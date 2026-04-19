---
name: Decision Diary
id: prd:ref:decision-diary
tagline: Capture every notable in-flight decision, spot your own patterns
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
  - returning-pilot
complexity: low
personal_need: 3
depends_on:
  - prd:ref:per-flight-journal
surfaces:
  - web
  - mobile
content_reuse: []
last_worked: null
---

# Decision Diary

## What it does

Capture every notable in-flight decision -- go/no-go, diversion, altitude change, route deviation. Review at month-end and spot patterns in your own aeronautical decision-making. Your personal ADM case study.

## Core features

- Quick-capture for decisions: what happened, what you decided, why, what the outcome was
- Decision type tags: go/no-go, diversion, weather, mechanical, ATC, passenger
- Monthly review prompt with pattern analysis
- "Would you decide the same way again?" retrospective question
- Links to Per-Flight Journal (prd:ref:per-flight-journal) entries for context

## Notes

Depends on Per-Flight Journal (prd:ref:per-flight-journal) as the broader reflection framework. The value is in the monthly review -- individual entries are just data collection. Pattern recognition across 20+ decisions is where the insight lives. Low complexity, high long-term value.
