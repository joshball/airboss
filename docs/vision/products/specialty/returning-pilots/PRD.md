---
name: Returning Pilots
id: prd:spec:returning-pilots
tagline: "We know. Here's the path back."
status: idea
priority: 4
prd_depth: light
category: specialty
platform_mode:
  - daily-desk
  - event-cram
audience:
  - returning-pilot
complexity: low
personal_need: 5
depends_on:
  - prd:evt:recency-recovery
surfaces:
  - web
  - mobile
content_reuse:
  - regulations
  - scenarios
  - memory-items
last_worked: null
---

# Returning Pilots

## What it does

An empathy-driven landing page and onboarding flow for lapsed pilots. Acknowledges the gap, assesses where they are, and builds a personalized path back to flying. Points to Recency Recovery (prd:evt:recency-recovery) as the structured program.

## Core features

- "How long has it been?" assessment with no judgment
- Gap analysis: what's changed in regulations, airspace, and technology since you last flew
- Personalized recovery plan based on certificate level and time away
- Confidence-building content: "You still know more than you think"
- Direct funnel to Recency Recovery (prd:evt:recency-recovery) and BFR Sprint (prd:evt:bfr-sprint)

## Notes

Depends on Recency Recovery (prd:evt:recency-recovery) for the structured program. This is as much a marketing product as a training product -- the audience needs emotional reassurance before they need drills. Highest personal need rating because this is exactly the user Joshua is building for.
