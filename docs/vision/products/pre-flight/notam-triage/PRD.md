---
name: NOTAM Triage
id: prd:pre:notam-triage
tagline: Which 3 NOTAMs actually matter for your flight
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
complexity: medium
personal_need: 3
depends_on: []
surfaces:
  - web
  - mobile
content_reuse:
  - airports
  - regulations
last_worked: null
---

# NOTAM Triage

## What it does

Reads your route's NOTAMs and tells you which ones actually affect your flight. The rest are collapsed. Signal from noise -- because a 40-line NOTAM dump helps nobody.

## Core features

- Parses NOTAMs for departure, enroute, and destination airports
- Ranks by relevance: closed runways > TFRs > lighting > construction > everything else
- Plain-English translation of cryptic NOTAM format
- Highlights time-sensitive NOTAMs that expire during your flight window
- Collapsed "everything else" section for completeness

## Notes

NOTAM parsing is a known hard problem -- the format is inconsistent and full of abbreviations. An imperfect triage that's right 90% of the time is still better than a wall of unread text. Must never hide a safety-critical NOTAM.
