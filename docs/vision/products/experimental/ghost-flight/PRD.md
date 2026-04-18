---
name: Ghost Flight
id: prd:exp:ghost-flight
tagline: An experienced pilot's debrief of the same route, side-by-side
status: idea
priority: 5
prd_depth: light
category: experimental
platform_mode:
  - reflection
audience:
  - private-pilot
  - instrument-pilot
  - returning-pilot
complexity: high
personal_need: 2
depends_on:
  - prd:exp:replay-your-flight
surfaces:
  - web
content_reuse:
  - scenarios
last_worked: null
---

# Ghost Flight

## What it does

After you replay your flight, see an experienced pilot's debrief of the same route side-by-side. "Here's what they noticed that you didn't." A virtual mentor flying the same trip and showing you their thought process.

## Core features

- Pairs your flight replay with an expert debrief of the same route/conditions
- Expert annotations at key decision points: "I would have started descent here because..."
- Comparison view: your scan pattern vs. theirs (what were you looking at?)
- Highlights blind spots: things the expert noticed that you didn't mention
- Curated expert debriefs or AI-generated based on flight parameters

## Notes

Depends on Replay Your Flight (prd:exp:replay-your-flight). High complexity and deeply experimental -- sourcing expert debriefs at scale is the hard problem. Could start with AI-generated "expert perspective" and validate with real CFI reviews. The concept is powerful but execution risk is high.
