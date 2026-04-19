---
name: Replay Your Flight
id: prd:exp:replay-your-flight
tagline: Re-fly your actual flight and make different decisions
status: idea
priority: 5
prd_depth: light
category: experimental
platform_mode:
  - reflection
audience:
  - private-pilot
  - instrument-pilot
  - cfi
complexity: high
personal_need: 3
depends_on:
  - prd:prof:decision-reps
surfaces:
  - web
content_reuse:
  - scenarios
last_worked: null
---

# Replay Your Flight

## What it does

Import your track log from ForeFlight, Garmin Pilot, or CloudAhoy. The system regenerates a decision scenario from your actual flight. You re-fly it mentally, making different decisions at key points. What if you'd diverted earlier? What if the weather had been worse?

## Core features

- Track log import from major EFB platforms (ForeFlight, Garmin, CloudAhoy)
- Auto-identifies decision points: altitude changes, course deviations, go-arounds
- Generates "what if" branches at each decision point
- Historical weather overlay: what was the weather actually doing?
- Compare your actual decisions against alternatives

## Notes

High complexity due to track log parsing, weather data correlation, and scenario generation from real flight data. This is the holy grail of reflective training -- turning your own flights into learning scenarios. Depends on Decision Reps (prd:prof:decision-reps) for the scenario engine.
