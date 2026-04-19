---
name: Quiet Co-Pilot
id: prd:fly:quiet-co-pilot
tagline: Optional audio prompts at decision points during your flight
status: idea
priority: 5
prd_depth: light
category: in-flight
platform_mode:
  - in-flight
audience:
  - private-pilot
  - instrument-pilot
complexity: high
personal_need: 2
depends_on:
  - prd:pre:route-walkthrough
surfaces:
  - mobile
  - audio
content_reuse:
  - airports
  - approach-plates
last_worked: null
---

# Quiet Co-Pilot

## What it does

Optional in-flight audio prompts at key decision points along your route. "10 miles from top-of-descent, remember altitude restriction at SUSIE." Like having a calm, competent right-seater who speaks only when it matters.

## Core features

- GPS-triggered audio callouts at pre-planned decision points
- Route-aware: knows your waypoints, altitudes, and approach
- Configurable verbosity: minimal (emergencies only) to conversational
- Pre-programmed for your specific flight, not generic
- Works offline after initial route download

## Notes

High complexity due to GPS integration, audio timing, and the need to never be distracting or annoying in the cockpit. Safety-critical: a badly timed prompt could cause more harm than help. Needs extensive real-world testing. This is a long-horizon product.
