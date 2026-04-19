---
name: Skill Heatmap
id: prd:ref:skill-heatmap
tagline: See where your skills are sharp and where they're drifting
status: idea
priority: 3
prd_depth: light
category: reflection
platform_mode:
  - reflection
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
  - prd:prof:spaced-memory-items
  - prd:prof:decision-reps
  - prd:prof:calibration-tracker
surfaces:
  - web
content_reuse: []
last_worked: null
---

# Skill Heatmap

## What it does

Tracks self-ratings and scenario performance across skill axes -- energy management, automation, communications, ADM, navigation, weather. Shows where you're sharp, where you're drifting, and where you've never been tested.

## Core features

- Skill axes mapped to real piloting competencies, not arbitrary categories
- Data from self-assessments, scenario scores, and memory item performance
- Visual heatmap showing current proficiency level per axis
- Drift detection: "Your weather decision-making has declined over the last 3 months"
- Recommended drills targeting weak or decaying areas

## Notes

Depends on data from Spaced Memory Items (prd:prof:spaced-memory-items), Decision Reps (prd:prof:decision-reps), and Calibration Tracker (prd:prof:calibration-tracker). Medium complexity because the skill model needs to be meaningful -- bad axes or bad scoring produces noise, not insight. The heatmap is only as good as the data feeding it.
