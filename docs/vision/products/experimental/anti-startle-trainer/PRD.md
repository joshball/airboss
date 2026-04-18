---
name: Anti-Startle Trainer
id: prd:exp:anti-startle-trainer
tagline: Train the first-3-seconds response to surprise failures
status: idea
priority: 5
prd_depth: light
category: experimental
platform_mode:
  - daily-desk
audience:
  - private-pilot
  - instrument-pilot
  - cfi
  - career-track
complexity: medium
personal_need: 3
depends_on:
  - prd:prof:decision-reps
surfaces:
  - web
  - mobile
  - audio
content_reuse:
  - scenarios
  - memory-items
last_worked: null
---

# Anti-Startle Trainer

## What it does

Surprise plus recovery drills. A sudden alarm, a unexpected failure, an abnormal indication -- what's the right scan? What's the first action? Trains the first-3-seconds response when the startle reflex wants to freeze you.

## Core features

- Random-timing surprise events during practice sessions
- Audio/visual startle stimulus followed by "What do you do first?"
- Trains the scan-identify-act sequence under time pressure
- Progressive difficulty: simple failures to compound emergencies
- Response time tracking: measures improvement in initial reaction speed

## Notes

Depends on Decision Reps (prd:prof:decision-reps) for scenario infrastructure. Medium complexity -- the startle effect is the key design challenge. On a screen, you know something is coming; real startle requires genuine surprise. Audio delivery might work better than visual. Research-backed approach needed (Startle Effect research from Delft/Leiden).
