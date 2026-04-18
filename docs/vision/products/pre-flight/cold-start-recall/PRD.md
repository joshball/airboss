---
name: Cold-Start Recall
id: prd:pre:cold-start-recall
tagline: 2-minute memory item rehearsal before you crank the engine
status: idea
priority: 4
prd_depth: light
category: pre-flight
platform_mode:
  - pre-flight
audience:
  - private-pilot
  - instrument-pilot
  - cfi
  - returning-pilot
complexity: low
personal_need: 4
depends_on:
  - prd:prof:spaced-memory-items
surfaces:
  - web
  - mobile
content_reuse:
  - memory-items
last_worked: null
---

# Cold-Start Recall

## What it does

A 2-minute rehearsal of critical memory items for the specific aircraft you're about to fly -- engine fire on start, electrical failure, engine-out after takeoff. Done in the parking lot before you walk to the plane.

## Core features

- Aircraft-specific memory item sets (C172, PA-28, SR22, etc.)
- Quick-fire recall: prompt -> recite -> reveal correct answer
- Focuses on the 3-5 most critical items, not the full emergency checklist
- Tracks recall speed and accuracy over time
- "Last practiced" indicator so you know how stale your memory is

## Notes

Depends on Spaced Memory Items (prd:prof:spaced-memory-items) for the item database. The key insight is that memory items decay fast when you fly infrequently -- this product targets the moment when recall matters most. Must be fast enough to actually use at the airport.
