---
title: airboss Platform Vision
type: vision
status: current
date: 2026-04-26
supersedes: ../.archive/platform/VISION.md
---

# airboss

Pilot performance and rehearsal. A platform for pilots to learn, rehearse, and reflect across every certificate and rating, from PPL through CFI -- with airframe-specific drills, route-specific rehearsal, and decision-pattern practice that compounds over a flying career.

This is **not** a course. **Not** a sim. **Not** a logbook. It's a rehearsal and proficiency tool that fits between planning and flying, and between flying and reflection. See [PIVOT.md](PIVOT.md) for why we're here.

## Core loops

```text
Before flight    →  Load route → rehearse scenario → load decisions into working memory
Between flights  →  Daily 10-min spaced practice on weak areas
After flight     →  Debrief with timeline, self-rating, note which decisions held up
Over time        →  Track calibration, proficiency trends, where the pilot is drifting
```

## Audience

- **User zero (today):** Joshua -- returning CFI rebuilding PPL/IR/CPL/CFI knowledge. The platform is shaped around his relearning workflow.
- **Pilots in training:** PPL/IR/CPL/CFI students who want rehearsal between lessons.
- **Returning pilots:** anyone re-currenting after a gap.
- **Active CFIs:** judgment + intervention practice; FIRC content if/when a partner adopts it.
- **Future:** type-rating prep, airline interview prep, recurrent training.

## Surface architecture

Apps are organized by **rendering surface**, not content theme. A weather quiz and a regulation quiz both live in `study/` because they share card UI and spaced-rep infrastructure. A route map and an airport card both live in `spatial/`. See [MULTI_PRODUCT_ARCHITECTURE.md](MULTI_PRODUCT_ARCHITECTURE.md) for the full taxonomy and build order.

Built today:

| App      | Surface                                                              | Status |
| -------- | -------------------------------------------------------------------- | ------ |
| `study`  | Cards, quizzes, spaced rep, calibration, knowledge graph             | Active |
| `sim`    | Flight-dynamics simulator (hand-rolled C172 FDM, scenarios, debrief) | Active |
| `hangar` | Operator app -- content authoring, users, system ops                 | Active |

Future surfaces (created when product demands them):

| App        | Surface                                         |
| ---------- | ----------------------------------------------- |
| `spatial`  | Route, airport, airspace, map-based products    |
| `audio`    | NTSB stories, drills, ATC comms, TTS narrative  |
| `reflect`  | Journals, heatmaps, currency, decision diary    |
| `avionics` | Glass cockpit trainer (G1000 / G3000 / Garmin)  |
| `firc`     | FIRC course (migrated from airboss-firc)        |
| `runway`   | Public site (open-source landing, free content) |

## What's worth building

Per [PIVOT.md](PIVOT.md), the wedges that earn shipping priority:

| Layer                       | What it is                                                                                 | Priority |
| --------------------------- | ------------------------------------------------------------------------------------------ | -------- |
| **Proficiency maintenance** | Short daily scenarios; spaced + interleaved; targets the pilot's weak areas                | v1 core  |
| **Route rehearsal**         | Import a route; tailored pre-brief: terrain/airspace/WX gotchas, ATC, go/no-go, diversions | v1 hook  |
| **Event prep modules**      | IPC, flight review, BFR, checkride prep, type rating, airline interview                    | v2       |
| **Transition support**      | New type, new avionics, new environment (mountain, IFR, international)                     | v2       |
| **FIRC content module**     | The 503 questions + AC 61-83K scenarios; not FAA-approved unless a partner adopts it       | v3+      |

## Learning philosophy

Discovery-first. Lead with WHY, let the pilot derive the answer, reveal regulations as confirmation of reasoning. Mastery framed as cert/syllabus/goal/lens (any pilot has a current syllabus, an active goal, and a lens through which they view the syllabus). See [LEARNING_PHILOSOPHY.md](LEARNING_PHILOSOPHY.md) and [ADR 011 -- Knowledge graph](../decisions/011-knowledge-graph-learning-system/decision.md), [ADR 016 -- Cert/syllabus/goal/lens model](../decisions/016-cert-syllabus-goal-model/decision.md).

## Business posture

- **Cover costs / potentially open-source.** No FAA approval needed for v1; no chief instructor required.
- **No business pressure.** No deadline besides self-imposed launch milestones.
- **Open-core leaning** (engine + scenario format + content schemas open; hosted instance covers costs; community + curated scenario/route packs). Final license decision deferred to its own ADR.
- **Regulatory moat:** explicitly not load-bearing. The contribution is the point.

## Engineering posture

- **Audit everything.** Every authoring action and every admin action is tracked.
- **Validate continuously.** Citation drift, broken wiki-links, stale references caught on every change.
- **Compliance schema stays.** Audit, content versioning, and the compliance bounded context are preserved even though FIRC submission is dormant ([ADR 017](../decisions/017-firc-compliance-dormant.md)). The rigor makes the platform trustworthy regardless of regulatory posture.
- **Surface apps are independently deployable.** Fix spaced rep without redeploying the map app.

## What stays from FIRC-era

The 90%+ of work that transferred:

- **`libs/engine/`** (in airboss-firc, migrating later) -- scenario tick engine, scoring, student model. Core IP.
- **Scenario content model** -- ticks, decisions, branches.
- **Pre-brief / debrief architecture.**
- **Bounded-context structure** -- most BCs survive (course, enrollment, evidence; compliance dormant).
- **Two-tier ID strategy.**
- **Stack** -- Bun / SvelteKit / Svelte 5 / Drizzle / Postgres.

What changed:

- **Audience** -- every pilot, daily, not CFIs every 24 months.
- **FAA submission** -- dormant unless a partner adopts.
- **Naming** -- "FIRC Boss" → airboss; the FIRC course becomes one possible content pack, not the product.
- **Apps** -- four monolithic FIRC apps (sim/hangar/ops/runway) → 5-7 surface-typed apps (study, spatial, audio, reflect, etc.).

## What's NOT airboss

- **Not a flight simulator** in the Microsoft sense -- the FDM in `apps/sim/` is built for *learning the airplane*, not for entertainment.
- **Not a logbook** -- ForeFlight/Garmin Pilot/MyFlightbook do that.
- **Not a planning tool** -- ForeFlight does that.
- **Not a course platform** -- though a FIRC course or any cert syllabus can run on top.
- **Not a marketing funnel** -- runway is dormant until v1 launches; this is craft, not commerce.

## References

- [PIVOT.md](PIVOT.md) -- why we left FIRC framing
- [MULTI_PRODUCT_ARCHITECTURE.md](MULTI_PRODUCT_ARCHITECTURE.md) -- surface-typed apps and build order
- [DESIGN_PRINCIPLES.md](DESIGN_PRINCIPLES.md) -- core beliefs
- [LEARNING_PHILOSOPHY.md](LEARNING_PHILOSOPHY.md) -- discovery-first pedagogy
- [ROADMAP.md](ROADMAP.md) -- per-area phasing
- [VOCABULARY.md](VOCABULARY.md) -- naming bank
- [.archive/platform/VISION.md](../.archive/platform/VISION.md) -- prior FIRC Boss vision
