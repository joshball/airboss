---
name: Daily Decision
id: prd:aud:daily-decision
tagline: 5-minute scenario podcast for the drive in
status: idea
priority: 3
prd_depth: light
category: audio
platform_mode:
  - audio-passive
audience:
  - private-pilot
  - instrument-pilot
  - cfi
  - returning-pilot
  - aviation-curious
complexity: medium
personal_need: 4
depends_on:
  - prd:prof:decision-reps
surfaces:
  - audio
  - web
  - mobile
content_reuse:
  - scenarios
  - ntsb-cases
last_worked: null
---

# Daily Decision

## What it does

A 5-minute podcast-format scenario you listen to on the drive to work. "You're at 5,500 over the Sierras, alternator light flickers. What do you do?" Pause, think, then hear the analysis. Daily ADM reps without opening an app.

## Core features

- Daily 5-minute audio scenario with decision pause point
- Progressive disclosure: setup -> decision -> analysis -> outcome
- Draws from NTSB cases and original scenarios
- Subscribe via podcast feed or in-app audio player
- Back catalog organized by topic (weather, mechanical, human factors, ATC)

## Notes

Depends on Decision Reps (prd:prof:decision-reps) for scenario content. Medium complexity due to audio production pipeline -- even with TTS, scenarios need good scripting and pacing. The opportunity is reaching pilots during dead time (commute, gym, walk) when they'd never open a training app.
