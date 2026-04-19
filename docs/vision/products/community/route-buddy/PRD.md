---
name: Route Buddy
id: prd:com:route-buddy
tagline: Pair with another pilot flying the same route
status: idea
priority: 5
prd_depth: light
category: community
platform_mode:
  - community
  - pre-flight
audience:
  - private-pilot
  - instrument-pilot
complexity: medium
personal_need: 2
depends_on:
  - prd:pre:route-walkthrough
surfaces:
  - web
  - mobile
content_reuse:
  - airports
last_worked: null
---

# Route Buddy

## What it does

Pair with another pilot who's flying the same or similar route. Share your pre-brief, swap diversion ideas, and debrief together afterward. Flying alone doesn't mean preparing alone.

## Core features

- Route matching: find pilots flying similar routes in the same timeframe
- Shared pre-brief workspace for comparing notes
- Post-flight debrief exchange: "Here's what I noticed"
- Optional real-time check-in during flight (text-based, not voice)
- Privacy controls: opt-in, anonymous until both agree to connect

## Notes

Medium complexity due to the matching algorithm and privacy considerations. The cold-start problem is real -- needs a critical mass of users before matching works reliably. Could start with manual pairing in a community forum and automate later.
