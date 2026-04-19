---
name: CFI Pairing
id: prd:com:cfi-pairing
tagline: A real CFI reviews your journal and asks 2 questions a month
status: idea
priority: 5
prd_depth: light
category: community
platform_mode:
  - community
audience:
  - private-pilot
  - returning-pilot
complexity: medium
personal_need: 2
depends_on:
  - prd:ref:per-flight-journal
surfaces:
  - web
content_reuse: []
last_worked: null
---

# CFI Pairing

## What it does

A real CFI -- volunteer or paid -- reviews your Per-Flight Journal monthly, asks 2 targeted questions, and offers one suggestion. Lightweight mentorship that doesn't require scheduling a flight lesson.

## Core features

- Monthly CFI review of your journal entries and decision diary
- 2 targeted questions from the CFI based on patterns they notice
- One actionable suggestion for your next month of flying
- Asynchronous: no scheduling required, no video calls
- CFI matching by geography, experience level, and flying style

## Notes

Depends on Per-Flight Journal (prd:ref:per-flight-journal) as the data source. Medium complexity due to the two-sided marketplace problem -- need CFIs willing to participate and a fair compensation model. Could start with volunteer CFIs and add paid tiers later. The value proposition for CFIs is staying connected to GA pilots.
