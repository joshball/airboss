---
name: Canonical wx events
status: skeleton
parent: ../README.md
---

# Canonical wx events

Hand-curated famous historical wx situations referenced by the weather course. Each event has a hand-tuned truth model that the [Weather Scenario Engine](../../../docs/vision/products/pre-flight/weather-scenario-engine/) generates products and charts from.

The authoritative event registry lives in `libs/wx-canonical/` (when that lib is created). This directory holds the **course-side** lesson framing for each event: what the lesson teaches, what to walk through, what questions to ask the learner.

## Why canonical events

Three purposes (per [DESIGN.md](../DESIGN.md)):

1. **Compelling content.** Real named events have gravity that synthetic situations don't.
2. **Validation harness.** Engine output for a synthetic-but-similar situation gets compared to the canonical event's truth model. Does it look like a dryline day to a meteorologist?
3. **Bridge.** Pure-synthetic is fast but unanchored; pure-replay is anchored but rigid. Canonical events are hand-tuned truth models in between.

## Planned events (placeholder list)

Authoring will fill these in. The list itself is sized to give the course representative coverage across hazard types and seasons:

- Textbook radiation fog morning (autumn, central plains)
- Classic dryline severe-weather day (spring, southern plains)
- Lake-effect snow event (winter, Great Lakes)
- Named hurricane approach (tropical, gulf or east coast)
- Derecho event (summer, midwest)
- Mountain wave / rotor day (winter, lee of the Rockies)
- Marine layer / coastal stratus morning (summer, west coast)
- Freezing rain event (winter, mid-Atlantic)
- Convective squall line (spring or summer, midwest)
- High-pressure CAVU day (any season, used as the "boring" baseline)

Each entry will get its own subdirectory with: lesson framing, what the truth model captures, what the engine should generate, what the learner should notice, and a Socratic walkthrough.

## Status

Skeleton. Authoring waits on the Weather Scenario Engine landing, since the events are operational against the engine -- a canonical event is a parameterized truth-model fixture, not just a description.
