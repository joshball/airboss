---
name: Augmented Checklist
id: prd:exp:augmented-checklist
tagline: Speak the checklist, the system follows along
status: idea
priority: 5
prd_depth: light
category: experimental
platform_mode:
  - in-flight
audience:
  - private-pilot
  - instrument-pilot
  - cfi
complexity: high
personal_need: 2
depends_on: []
surfaces:
  - mobile
  - audio
content_reuse: []
last_worked: null
---

# Augmented Checklist

## What it does

Speak your checklist out loud. The system listens, tracks where you are, and prompts if you skip a step. Aviation Alexa -- a voice-activated checklist companion that keeps you honest.

## Core features

- Voice recognition that follows your checklist progress in real time
- Prompts for skipped or out-of-order items
- Aircraft-specific checklists (C172, PA-28, SR22, etc.)
- Works in noisy cockpit environments
- Configurable: silent monitoring vs. active prompting

## Notes

High complexity due to cockpit noise, checklist variation between aircraft, and the need for extremely reliable speech recognition. A false positive (prompting when you didn't skip) would be worse than no system at all. Long-horizon experimental product that needs significant cockpit testing.
