---
name: What-Could-Go-Wrong
id: prd:pre:what-could-go-wrong
tagline: 60-second mental rehearsals for plausible failures on THIS flight
status: idea
priority: 3
prd_depth: light
category: pre-flight
platform_mode:
  - pre-flight
audience:
  - private-pilot
  - instrument-pilot
  - cfi
  - returning-pilot
complexity: low
personal_need: 4
depends_on: []
surfaces:
  - web
  - mobile
content_reuse:
  - scenarios
  - weather-data
last_worked: null
---

# What-Could-Go-Wrong

## What it does

Generates 3 plausible failure scenarios tailored to THIS specific flight -- icing on the mountain pass, alternator failure at night, nervous passenger grabbing the yoke. Each takes 60 seconds to mentally rehearse.

## Core features

- Context-aware scenario generation based on route, weather, time of day, and aircraft
- 3 scenarios per flight, each with a 60-second mental rehearsal prompt
- Covers mechanical, weather, human factors, and terrain categories
- "What would you do?" with expandable suggested response
- History tracks which failure types you've rehearsed vs. which are blind spots

## Notes

Low complexity because it's content generation, not simulation. The challenge is making scenarios plausible enough to take seriously without being alarming. This is mental rehearsal, not fear generation.
