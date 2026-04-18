---
name: Local Pilot Map
id: prd:com:local-pilot-map
tagline: Find pilots at your home field who use the platform
status: idea
priority: 5
prd_depth: light
category: community
platform_mode:
  - community
audience:
  - private-pilot
  - instrument-pilot
  - returning-pilot
complexity: medium
personal_need: 2
depends_on: []
surfaces:
  - web
  - mobile
content_reuse:
  - airports
last_worked: null
---

# Local Pilot Map

## What it does

Find other platform users at your home airport. Optional, opt-in, privacy-first. The seed of local community -- someone to grab coffee with, split fuel costs, or just know you're not the only one taking proficiency seriously.

## Core features

- Opt-in map showing home airports of participating users
- No personal details shared until both users agree to connect
- Filter by certificate level, aircraft type, and flying interests
- Direct messaging after mutual opt-in
- Airport-level community boards for local discussions

## Notes

Medium complexity due to privacy requirements and the need to prevent misuse. The cold-start problem applies here too -- useless with 5 users, valuable with 500. Should be one of the last community features built, after the platform has enough users to make local density meaningful.
