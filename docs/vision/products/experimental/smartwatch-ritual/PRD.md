---
name: Smartwatch Ritual
id: prd:exp:smartwatch-ritual
tagline: 5-tap pre-takeoff ritual on your wrist
status: idea
priority: 5
prd_depth: light
category: experimental
platform_mode:
  - pre-flight
audience:
  - private-pilot
  - instrument-pilot
complexity: medium
personal_need: 2
depends_on: []
surfaces:
  - watch
  - mobile
content_reuse:
  - weather-data
last_worked: null
---

# Smartwatch Ritual

## What it does

A 5-tap pre-takeoff ritual on your watch: weather check, W&B confirmation, fuel status, IMSAFE green, brief complete. Ritualizes preflight discipline into a physical gesture you do every time before the engine starts.

## Core features

- 5 sequential taps, each confirming one pre-takeoff item
- Weather summary pulled from current METAR/TAF
- Haptic feedback on completion -- a physical "you're ready" signal
- Logs every ritual completion with timestamp
- Skipped-step tracking: "You skipped IMSAFE 3 of your last 5 flights"

## Notes

Medium complexity due to watch platform development (WatchOS/Wear OS). The bet is that a physical ritual creates better discipline than an app you might skip. Small surface area makes it fast to complete but hard to test -- watch development is finicky.
