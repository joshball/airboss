---
name: Airport Cards
id: prd:pre:airport-cards
tagline: A local's guide to any airport you're flying into
status: idea
priority: 3
prd_depth: light
category: pre-flight
platform_mode:
  - pre-flight
audience:
  - private-pilot
  - instrument-pilot
  - cfi
  - returning-pilot
complexity: medium
personal_need: 3
depends_on: []
surfaces:
  - web
  - mobile
content_reuse:
  - airports
  - airspace-rules
last_worked: null
---

# Airport Cards

## What it does

Generates a personalized briefing card for any airport -- pattern quirks, common runway-in-use, taxi traps, hot spots, local frequencies, fuel, and landing fees. The stuff a local knows that the chart supplement doesn't tell you.

## Core features

- One-page card per airport with local knowledge layered on top of official data
- Hot spot diagrams and taxi gotchas highlighted visually
- Common runway assignments by wind direction
- Fuel, fees, FBO notes, and ground transport options
- User-contributed tips and corrections

## Notes

The hard part is sourcing reliable local knowledge at scale. Start with user-contributed data for popular airports, backfill with chart supplement + AF/D data for everything else. Quality control on user tips matters -- bad taxi advice is dangerous.
