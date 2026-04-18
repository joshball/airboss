---
name: Voice Debrief
id: prd:fly:voice-debrief
tagline: Speak your debrief after shutdown, auto-transcribed and tagged
status: idea
priority: 3
prd_depth: light
category: in-flight
platform_mode:
  - reflection
  - in-flight
audience:
  - private-pilot
  - instrument-pilot
  - cfi
  - returning-pilot
complexity: medium
personal_need: 3
depends_on:
  - prd:ref:per-flight-journal
surfaces:
  - mobile
content_reuse: []
last_worked: null
---

# Voice Debrief

## What it does

Hold a button, speak your debrief after engine shutdown. Auto-transcribed, timestamped, and attached to your Per-Flight Journal entry. Captures the hot take while it's fresh -- before you forget what surprised you.

## Core features

- Push-to-talk voice recording with automatic transcription
- Timestamped and linked to the flight date/route
- Auto-categorizes mentions of weather, decisions, mistakes, and wins
- Flows into Per-Flight Journal (prd:ref:per-flight-journal) as a structured entry
- Searchable transcript history

## Notes

Depends on Per-Flight Journal (prd:ref:per-flight-journal) as the destination for debrief data. Speech-to-text quality is the main technical risk -- aviation terminology and airport identifiers need good recognition. The core insight is that pilots will speak a debrief but won't type one.
