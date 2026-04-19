---
name: Memory Items Audio
id: prd:aud:memory-items-audio
tagline: Recite memory items out loud while driving, get graded
status: idea
priority: 4
prd_depth: light
category: audio
platform_mode:
  - audio-passive
audience:
  - private-pilot
  - instrument-pilot
  - cfi
  - returning-pilot
complexity: low
personal_need: 3
depends_on:
  - prd:prof:spaced-memory-items
surfaces:
  - audio
  - mobile
content_reuse:
  - memory-items
last_worked: null
---

# Memory Items Audio

## What it does

Audio prompts you to recite memory items out loud -- engine fire, electrical failure, engine-out -- and grades your response for completeness and order. Practice emergency procedures while driving, walking, or doing dishes.

## Core features

- Audio prompt: "Engine fire on the ground in a C172. Go."
- Speech recognition checks steps against the correct procedure
- Tracks speed and completeness over time
- Aircraft-specific item sets from Spaced Memory Items (prd:prof:spaced-memory-items) database
- Spaced repetition scheduling for items that need reinforcement

## Notes

Depends on Spaced Memory Items (prd:prof:spaced-memory-items) for content. Lower complexity than ATC Comms Drill because memory items have fixed correct answers (checklist steps) rather than variable clearance readbacks. Speech recognition still needs to handle aviation terms but the vocabulary is smaller and more predictable.
