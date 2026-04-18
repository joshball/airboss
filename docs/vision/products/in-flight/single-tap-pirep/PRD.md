---
name: Single-Tap PIREP
id: prd:fly:single-tap-pirep
tagline: "Light chop FL080 over BJC" -> structured PIREP submitted
status: idea
priority: 5
prd_depth: light
category: in-flight
platform_mode:
  - in-flight
audience:
  - private-pilot
  - instrument-pilot
  - commercial-pilot
complexity: medium
personal_need: 2
depends_on: []
surfaces:
  - mobile
content_reuse: []
last_worked: null
---

# Single-Tap PIREP

## What it does

Radically lower the friction of filing a PIREP. Speak or tap a few fields and the system builds a properly formatted pilot report and submits it. More PIREPs mean better weather data for everyone.

## Core features

- Voice or quick-tap input for turbulence, icing, ceiling, visibility
- Auto-fills position, altitude, and time from GPS
- Formats to standard PIREP structure automatically
- Submits to appropriate facility (or queues for later submission)
- History of your filed PIREPs with confirmation status

## Notes

Medium complexity due to integration with FAA PIREP submission systems. The friction reduction is the entire product -- if it's not dramatically faster than current methods, there's no point. Would need to verify submission pathway (direct to AFSS or via aggregator).
