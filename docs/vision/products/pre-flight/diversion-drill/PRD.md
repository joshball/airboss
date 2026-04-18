---
name: Diversion Drill
id: prd:pre:diversion-drill
tagline: Pre-rehearse where you'd divert so it's recall, not discovery
status: idea
priority: 4
prd_depth: light
category: pre-flight
platform_mode:
  - pre-flight
  - daily-desk
audience:
  - private-pilot
  - instrument-pilot
  - cfi
  - returning-pilot
complexity: medium
personal_need: 3
depends_on:
  - prd:pre:route-walkthrough
surfaces:
  - web
  - mobile
content_reuse:
  - airports
  - weather-data
  - airspace-rules
last_worked: null
---

# Diversion Drill

## What it does

Given your route and current weather, pre-rehearse where you'd divert and why at each phase of flight. So when you need a diversion, it's a recall task -- not a problem-solving task under stress.

## Core features

- Auto-generates diversion candidates along your route based on weather, distance, and runway suitability
- "What if" prompts at key waypoints: engine out here, weather closes in there
- Compare your diversion picks against the system's suggestions
- Saves diversion plan as a printable card for the flight
- Pulls live weather to flag airports that are actually below minimums right now

## Notes

Depends on Route Walkthrough (prd:pre:route-walkthrough) for route data. The value is making diversion planning a habit, not a panic response. Could become the most-used pre-flight feature for cross-country pilots.
