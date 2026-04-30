---
name: Weather Scenario Engine
id: vision:pre:weather-scenario-engine
tagline: Generate complete preflight briefings -- with truth-aware commentary -- from a narrative
status: vision (not greenlit)
priority: tbd
prd_depth: vision
category: pre-flight / infrastructure
captured: 2026-04-30
audience:
  - private-pilot
  - instrument-pilot
  - cfi
complexity: large
personal_need: 4
depends_on:
  - course/weather/
related:
  - vision:pre:notam-triage (reuses the same engine pattern for NOTAMs)
  - DESIGN_PRINCIPLES.md §7 (Three-Stage Skill Ladder)
  - ADR 011 (knowledge graph)
content_reuse:
  - course/weather/
  - libs/wx-canonical/
  - apps/study/ (drill consumer)
  - apps/sim/ (scenario weather consumer, future)
last_worked: null
---

# Weather Scenario Engine

A synthetic preflight briefing engine. Given a flight plan, time of day, and a narrative ("clear and smooth," "gusty crosswind at the destination," "embedded TS mid-route," "icing layer 6-9k", "morning radiation fog at the departure that lifts by 1500Z"), the engine produces the **complete briefing pack** a pilot would actually see -- METARs, TAFs, AIRMETs, SIGMETs, winds aloft, surface analysis, prog charts, radar mosaic, satellite, icing forecasts, turbulence forecasts, freezing levels, PIREPs -- plus authored Socratic commentary.

The killer feature: **because the engine generated it, the engine knows the truth.** Every isobar, every front, every TAF group has a known reason. The engine can author "what to look at and why" with perfect ground truth -- something no real-world briefing tool will ever offer a learner.

## Status

**Vision, not greenlit.** Captured for [course/weather/](../../../../course/weather/README.md), which is the first consumer. Promote to a work package when course/weather is ready to author lesson content against generated packs.

## What it does

A pilot or course author specifies:

- **Flight plan**: departure / enroute / destination / alternates, route, altitudes
- **Time**: date, departure time, length of flight
- **Narrative**: a tagged scenario shape ("clear and smooth," "gusty winds at Z," "embedded TS mid-route," etc.) -- a controlled vocabulary, not free text

The engine produces:

- **Surface obs**: METARs and SPECIs at every airport in the plan plus reporting points along the route
- **Forecasts**: TAFs at applicable airports, area forecast / GFA, winds & temps aloft (FB)
- **Hazards**: AIRMET (Sierra / Tango / Zulu), G-AIRMET, SIGMET, Convective SIGMET, CWA as applicable
- **Charts**: surface analysis, prog (12/24/48), radar mosaic, satellite (visible + IR), icing (FIP/CIP), turbulence (GTG), freezing level
- **PIREPs**: along the route, consistent with the truth model (forecaster-blind to recent surface developments where appropriate)
- **Commentary**: per-product Socratic walkthroughs ("notice this TEMPO line -- why is it load-bearing?") plus glance-callouts for first-read cues

All products are **mutually consistent** -- a TAF that doesn't match the surface pressure pattern, or winds aloft that contradict the surface analysis, fail validation and don't ship.

## Why this matters

Pilots fail weather more than any other knowledge area in the FAA syllabus. The failure mode is consistent: training stops at decode and never reaches understanding-of-the-snapshot or triage-of-the-pack. Real preflight briefings can't teach the upper stages well because **the instructor doesn't know the truth** -- they know what the briefing says, not why each line was written.

A synthetic engine inverts this. We author the truth. The engine derives products from truth. Commentary is authored from truth. Every line on every chart has a known reason, and the engine (the instructor) can explain *why* every reading is what it is.

This is the load-bearing pedagogical bet. **Truth-aware commentary is the killer feature.** Everything else is plumbing.

## Architecture

See [architecture.md](architecture.md) for the full breakdown. Summary:

**Four architecture layers, all required from v0:**

1. Truth model (atmosphere as a system: pressure systems, fronts, air masses, lapse rates, terrain effects, diurnal cycles)
2. Products (METAR, TAF, AIRMET, SIGMET, winds aloft, PIREPs derived from truth)
3. Charts (surface analysis, prog, radar, satellite, icing, turbulence rendered from truth)
4. Commentary (Socratic walkthroughs and glance-callouts authored from truth)

**Three data-anchoring stages, shipped progressively:**

- **S1**: parameterized physics. Internally consistent, hand-coded distributions. Ships first.
- **S2**: real-world distribution calibration. Truth-model parameters sampled from historical archives (region × season × time × narrative). Ships second.
- **S3**: replay-with-perturbation. Seed from a real day, modify a variable, regenerate consistently. Ships third or on demand.

**Three libs, separate consumers:**

- `libs/wx-engine/` -- pure: truth → products + charts + commentary. Importable everywhere.
- `libs/wx-data/` -- DB-backed: historical ingest, calibration distributions. Owns infra.
- `libs/wx-canonical/` -- curated event corpus. Code-consumed (validation harness, drill engine).

## Consumers

- **course/weather/** -- lessons, drills, capstone author against generated packs
- **apps/study/** -- spaced-rep drills (decode, understand, triage) pull from the engine
- **apps/sim/** -- scenario weather (when sim ships) is engine-generated, so debriefs can reference truth
- **apps/hangar/** -- authoring UI for instructors to specify narratives and preview packs
- **future libs/notam-engine/** -- mirrors the architecture for NOTAMs

## What this is not

- **Not a real weather tool.** Pilots must never use this for actual flight planning. Only for training.
- **Not a forecast model.** The engine doesn't predict the future. It generates internally consistent synthetic situations from authored narratives.
- **Not a replacement for AWC.** Course content explicitly teaches pilots to use AWC.gov for real flights; the engine teaches them how to read what AWC produces.

## Looks-pro chart rendering

Charts render as SVG with a token-based stylesheet, using real AWC/NWS visual conventions: front symbols (filled triangles for cold, half-circles for warm, alternating for stationary, the iconic blue/red palette), isobar conventions (4mb spacing, labeled values, dashed for forecast), station model layout, NWS radar color ramp.

We stop short of "indistinguishable from real" for v1 -- no real terrain or coastlines, simplified state-outline geographic backdrop. The marginal cost over ugly-correct is small; the reuse value across every course is high.

See [architecture.md](architecture.md) for the full rendering decisions.

## Promotion criteria

Move from vision to greenlit work package when:

- [course/weather/](../../../../course/weather/README.md) is ready to author lesson content against generated packs (current blocker)
- A canonical event corpus has at least 5 hand-tuned events ready as validation harness
- A clear first consumer (likely apps/study/ for decode-rep cards from generated METARs) is committed

Until then: vision doc captures the design space, course/weather/ skeleton references it, no implementation work.

## Related

- [architecture.md](architecture.md) -- 4-layer × 3-stage breakdown, data flow, lib boundaries
- [research/canonical-events-corpus.md](research/canonical-events-corpus.md) -- planned famous events
- [course/weather/](../../../../course/weather/README.md) -- first consumer
- [DESIGN_PRINCIPLES.md §7](../../../../docs/platform/DESIGN_PRINCIPLES.md) -- the skill ladder this engine serves
- [ADR 011](../../../../docs/decisions/011-knowledge-graph-learning-system/decision.md) -- triage drills as knowledge-graph synthesis
- [vision:pre:notam-triage](../notam-triage/PRD.md) -- consumer of the eventual `libs/notam-engine/` (same architecture pattern)
