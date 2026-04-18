---
name: Scenario of the Week
id: prd:com:scenario-of-the-week
tagline: Everyone runs the same scenario, ranked by calibration accuracy
status: idea
priority: 4
prd_depth: light
category: community
platform_mode:
  - community
  - daily-desk
audience:
  - private-pilot
  - instrument-pilot
  - cfi
  - returning-pilot
complexity: low
personal_need: 3
depends_on:
  - prd:prof:decision-reps
  - prd:prof:calibration-tracker
surfaces:
  - web
content_reuse:
  - scenarios
last_worked: null
---

# Scenario of the Week

## What it does

Every week, everyone runs the same decision scenario. Leaderboard ranks by calibration accuracy (how well your confidence matched your actual performance), not raw score. Rewards self-awareness, not overconfidence.

## Core features

- Weekly curated scenario released on the same day
- Everyone sees the same setup and decision points
- Leaderboard ranked by calibration accuracy, not just correctness
- Discussion thread unlocked after you complete the scenario (no spoilers)
- Archive of past weeks with aggregate statistics

## Notes

Depends on Decision Reps (prd:prof:decision-reps) for the scenario engine and Calibration Tracker (prd:prof:calibration-tracker) for scoring methodology. Low complexity -- it's a scheduling and leaderboard wrapper around existing scenario infrastructure. The social pressure to participate weekly is the retention mechanism.
