---
name: Per-Flight Journal
id: prd:ref:per-flight-journal
tagline: Structured post-flight reflection that's actually searchable
status: idea
priority: 3
prd_depth: light
category: reflection
platform_mode:
  - reflection
audience:
  - private-pilot
  - instrument-pilot
  - cfi
  - returning-pilot
complexity: low
personal_need: 4
depends_on: []
surfaces:
  - web
  - mobile
content_reuse: []
last_worked: null
---

# Per-Flight Journal

## What it does

Structured post-flight reflection: what went well, what surprised you, what to work on next. Tagged, searchable, and timestamped. A logbook for your head, not just your hours.

## Core features

- Guided reflection prompts: highlights, surprises, mistakes, and next-flight focus
- Tagging system for themes (weather decisions, landings, navigation, comms, CRM)
- Searchable history: "Show me all flights where I noted crosswind difficulty"
- Optional voice input via Voice Debrief (prd:fly:voice-debrief)
- Trend analysis: recurring themes surface automatically

## Notes

Low complexity -- this is fundamentally a structured note-taking tool with good search. The value is in the prompts (asking the right questions) and the trend analysis (showing patterns you wouldn't notice). Foundation product that many others feed into.
