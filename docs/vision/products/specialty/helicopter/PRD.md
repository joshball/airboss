---
name: Helicopter Mode
id: prd:spec:helicopter
tagline: Same engine, rotary-wing scenarios and memory items
status: idea
priority: 5
prd_depth: light
category: specialty
platform_mode:
  - daily-desk
  - pre-flight
audience:
  - private-pilot
complexity: high
personal_need: 1
depends_on:
  - prd:prof:spaced-memory-items
  - prd:prof:decision-reps
surfaces:
  - web
  - mobile
content_reuse:
  - scenarios
  - memory-items
  - regulations
last_worked: null
---

# Helicopter Mode

## What it does

The same decision rep and memory item engine adapted for helicopter pilots. Autorotation drills, settling-with-power scenarios, LTE recognition, and rotary-wing-specific emergency procedures.

## Core features

- Helicopter-specific memory item sets (R22, R44, Bell 206, etc.)
- Autorotation decision scenarios at various altitudes and airspeeds
- Settling-with-power and LTE recognition drills
- Helicopter-specific weather and performance scenarios
- Regulatory differences highlighted where applicable

## Notes

High complexity because helicopter operations are fundamentally different from fixed-wing -- can't just reskin airplane scenarios. Requires subject matter expertise from experienced helicopter pilots/CFIs. Low personal need but opens a new market segment.
