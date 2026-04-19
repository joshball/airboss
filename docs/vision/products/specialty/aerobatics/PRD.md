---
name: Aerobatics
id: prd:spec:aerobatics
tagline: Sequence visualization, recovery drills, competition prep
status: idea
priority: 5
prd_depth: light
category: specialty
platform_mode:
  - daily-desk
  - pre-flight
audience:
  - private-pilot
  - cfi
complexity: medium
personal_need: 2
depends_on:
  - prd:prof:spaced-memory-items
surfaces:
  - web
  - mobile
content_reuse:
  - scenarios
  - memory-items
last_worked: null
---

# Aerobatics

## What it does

Mental rehearsal tools for aerobatic pilots. Sequence visualization, unusual attitude recovery drills, G-awareness scenarios, and IAC competition prep. Ties back to energy management principles from the Performance Pilot framework.

## Core features

- Aresti sequence visualization and mental walkthrough
- Unusual attitude recognition and recovery decision drills
- G-loading awareness and physiological limit scenarios
- IAC competition known and unknown sequence practice
- Energy management scenarios specific to aerobatic flight

## Notes

Medium complexity -- the Aresti notation system is well-defined and parseable, but building good mental rehearsal tools for 3D maneuvers is non-trivial. Small but dedicated audience. Natural fit with the platform's emphasis on decision-making under pressure.
