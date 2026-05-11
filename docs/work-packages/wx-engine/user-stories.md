---
id: wx-engine
title: 'User Stories: Truth-Aware Weather Scenario Engine'
product: platform
category: feature
status: draft
agent_review_status: pending
human_review_status: pending
created: 2026-05-10
owner: agent
depends_on:
  - wx-chart-symbology-library
unblocks: []
tags:
  - weather
  - engine
  - library
  - user-stories
legacy_fields:
  feature: wx-engine
  type: user-stories
---

# User Stories: Truth-Aware Weather Scenario Engine

User-perspective narratives covering the three roles this library serves: scenario authors (writing TruthModel literals), course authors (referencing scenario slugs from course steps), and learners (working through the rendered briefing pack with truth-aware commentary). The library does not ship a UI; learner stories are about the pedagogical effect, not about clicking around the library itself.

## Authoring a scenario (scenario author = the person hand-coding a TruthModel literal)

- As a scenario author, I want one canonical place per scenario (`libs/wx-engine/src/truth/scenarios/<slug>.ts`) holding the TruthModel literal, so I never have to hunt across files to understand the scenario's atmospheric state.
- As a scenario author, I want every scenario to share the same `TruthModel` shape so I can copy a working scenario as my starting point and tune the parameters rather than re-deriving the structure.
- As a scenario author, I want the TruthModel Zod schema to reject malformed literals at load time with a per-field path so I can fix typos without reading source code.
- As a scenario author, I want `bun run wx-scenario build <slug>` to be deterministic so I can trust that re-running on an unchanged literal produces zero writes.
- As a scenario author, I want the round-trip parse check to fail loud on any product the wx-charts library cannot parse cleanly, so the engine cannot ship broken outputs.
- As a scenario author, I want one CLI dispatcher (`bun run wx-scenario ...`) covering build / validate / list / check-round-trip so I have a single noun to remember.
- As a scenario author tuning a frontal scenario, I want the geometry helpers (`findAirMass`, `samplePressureMb`, `sideOfFront`) to be importable in a one-shot script so I can debug "which mass contains this station" before re-running the full bundle build.
- As a scenario author who realized two stations are on the wrong side of a front, I want the commentary callout for that front-passage to surface that immediately (the question is wrong because the station classification is wrong) so the bug surfaces at the highest-leverage layer.
- As a scenario author, I want every chart spec the engine emits to validate against the wx-charts library's per-type Zod schema so I cannot accidentally produce a spec the renderer rejects.
- As a scenario author, I want the cross-product consistency checks (winds vs isobars, FM time vs front motion, AIRMET ring vs hazard polygon) to run on every build so I learn early when my literal is internally inconsistent.

## Authoring failures (scenario author -- error paths)

- As a scenario author who fat-fingered a slug to not match the registry entry, I want the loader to surface the mismatch with a specific message rather than silently picking the wrong scenario.
- As a scenario author who put a station outside CONUS bounds, I want the schema to reject with the offending station id.
- As a scenario author who authored a polygon with 2 points, I want the schema to reject with the offending polygon path.
- As a scenario author whose front polyline doubles back on itself, I want the validator to reject with a clear message naming the front id rather than producing a confusing per-station classification at render time.
- As a scenario author whose convective cell sits inside two stations' 5-nm radii, I want both stations to receive a `+TSRA` METAR rather than an arbitrary one of them, so the truth state is consistently propagated.
- As a scenario author who referenced a non-existent knowledge-node id in a commentary callout, I want the round-trip check to fail loud with the unresolved id and the originating callout, so I can either fix the id or add the missing node.
- As a scenario author tuning the diurnal cycle, I want the radiation-fog scenario to produce a TAF FM transition at the projected solar-warming hour rather than at validAt, so the time logic propagates through the layer 2 derivations.

## Pedagogical authoring (scenario author -- "I want this scenario to teach")

- As a scenario author thinking about teaching, I want every commentary callout to pin to a real chart slug + a real product field + a real knowledge-node id so a learner can navigate from the prompt to the source data and the underlying concept in one click.
- As a scenario author building a frontal-passage lesson, I want one callout per station that crossed the front (METAR comparison) so the learner sees the warm-vs-cold contrast as a discovery rather than as a definition.
- As a scenario author writing a Socratic question, I want the question to start with "What" / "Why" / "How" and the reason to cite a specific named truth-model element (named pressure system, specific air mass, named hazard zone) rather than templated placeholders, so the prompt has authority and is not derivable from the chart alone.
- As a scenario author authoring a thunderstorm scenario, I want the convective-outlook tier to derive from `truth.convection.cells.length` + per-station CAPE thresholds rather than being hand-set so changing the cell count automatically updates the outlook.

## Referencing a scenario from a course step (course author)

- As a course author writing a weather lesson, I want to embed a complete briefing pack by slug (`:::scenario slug="frontal-xc-march"`) so the embedding contract is decoupled from the scenario's individual products.
- As a course author, I want scenario slugs to read like content (`frontal-xc-march`, `mountain-wave-rockies`) rather than opaque ids so I can read a step's markdown and know which scenario it points at.
- As a course author who picked a slug that doesn't exist, I want the consumer to render a clear "scenario not found: <slug>" placeholder rather than silently rendering nothing.
- As a course author teaching METAR comparison, I want to reference the same scenario from multiple steps without duplicating its bundle.
- As a course author iterating on a step, I want the scenario panel to render the same way every time I navigate to the step (deterministic) so I can focus on the prose, not the bundle state.
- As a course author building the frontal-passage lesson, I want the scenario's commentary panel to surface as Socratic prompts beside the relevant chart -- not as a wall of explanatory text -- so the lesson preserves the discovery-first pedagogy ([ADR 011](../../decisions/011-knowledge-graph-learning-system/decision.md)).

## Browsing the briefing pack (learner)

- As a learner working through a frontal-passage lesson, I want to see the 5 METARs side-by-side so I can compare warm-sector vs post-frontal stations directly without paging between products.
- As a learner reading the surface-analysis chart, I want the front to appear in the same place across the chart, the METARs, the TAFs, and the AIRMETs so I trust that the lesson is internally consistent.
- As a learner reading a commentary callout, I want the question to lead and the answer to be revealable on click rather than always-visible, so I can attempt the discovery before reading the answer.
- As a learner who clicked "show me the truth" on a callout, I want to see the named truth-model element (the specific pressure system + central pressure + motion vector) so the abstract "front" becomes a concrete object I can reason about.
- As a learner reading the prog chart, I want it to show the same front advanced 12 hours so the comparison "what happens in 12 hours" lands as one read rather than as two charts I have to mentally align.
- As a learner reading a TAF with an FM transition, I want the callout to show me the projected front-arrival time computed from the truth-model motion vector so the FM group is grounded in physics rather than appearing arbitrary.
- As a learner working through the icing scenario, I want the freezing-level chart, the Zulu AIRMET, and the per-station METAR ceiling to tell the same story so I learn to triangulate hazards across products.
- As a learner working through the mountain-wave scenario, I want the PIREP cluster, the Tango AIRMET, and the jet axis on the surface analysis to coincide so the pedagogy "lee-side wave is a real thing" lands visually.
- As a learner reading the dense-fog scenario, I want the TAF's LIFR -> VFR transition to align with the diurnal-cycle commentary callout so I learn that fog timing is not a guess but a function of solar warming.

## Cross-cutting: integrity and trust

- As a scenario author, I want every scenario to embed its `scenarioId`, the engine's `library_version`, and the round-trip warning count in `truth.json` so I can trace any rendered briefing pack back to the exact code + literal that produced it.
- As a scenario author, I want bumping the engine library version to invalidate every scenario's round-trip baseline so derivation improvements propagate to every scenario on the next `--all` rebuild without manual intervention.
- As a scenario author, I want every derivation function to be a pure function (truth in, product out) so I can unit-test derivations deterministically with synthetic truth literals.
- As a course author or learner, I want the briefing pack to be a static set of files (not a server-render-on-demand) so the page loads with no network round trip beyond the asset fetches.
- As a course author, I want the engine's killer-feature framing -- "the engine knows the truth, so the commentary cites the truth, not a templated explanation" -- to be visible in the consumer surface (the "show me the truth" affordance on each callout) so the pedagogy advantage is not invisible plumbing.

## Cross-cutting: discipline

- As any agent on this project, I want server-only code (filesystem writes, scenario literals) to live in the `/server` barrel and never leak to the runtime barrel, so I cannot accidentally ship the engine into the browser bundle.
- As any agent on this project, I want the scenario registry closed at the six declared scenarios so adding a new scenario goes through one PR (add the literal + register + commit the bundle) rather than accumulating undeclared scenarios.
- As any agent on this project, I want every commentary callout's knowledge-node id to resolve at `bun run check` time so a knowledge-node rename surfaces as a check failure rather than a silent broken link in the consumer.
- As any agent on this project, I want the truth-state evolution to go through `advanceTruth(truth, hours)` exclusively so layer 1 cannot diverge from the layer-2/3/4 derivations.

## Negative stories (out of scope, captured for reference)

These belong in [OUT-OF-SCOPE.md](./OUT-OF-SCOPE.md), included here so the reader can see the full shape:

- As a scenario author, I want to seed the truth state from a real archived day (S2 calibration) -- deferred per OUT-OF-SCOPE (gated on real METAR archive ingest).
- As a scenario author, I want to take a real day and perturb one variable to teach "what if" (S3 replay-with-perturbation) -- deferred per OUT-OF-SCOPE (gated on real archive + scenario-overlay UX).
- As a scenario author, I want the engine to fetch live IEM / NCEI / NOAA data at build time so the briefing pack reflects current conditions -- rejected per OUT-OF-SCOPE (out of pedagogical scope; the engine's value is curation, not live data).
- As a course author, I want a hangar-app UI to author scenario literals without writing TS by hand -- deferred per OUT-OF-SCOPE (gated on documented TS-authoring friction; map-based polygon editor is the eventual UX).
- As a learner, I want to compare two scenarios side-by-side (frontal-xc-march vs winter-icing-great-lakes) -- deferred per OUT-OF-SCOPE (multi-scenario diff/compare UI; gated on user-zero use).
- As a course author, I want satellite chart derivations (GOES IR / VIS / WV) so the briefing pack includes synoptic context layers -- deferred per OUT-OF-SCOPE (defer until satellite chart pedagogy is exercised).
- As a course author, I want a per-altitude turbulence/icing severity grid rather than just AIRMET polygons -- deferred per OUT-OF-SCOPE (current AIRMET polygon coverage is sufficient for v1; FIP/CIP gridded scalar derivation is a future enrichment).
- As a course author, I want a synthetic NEXRAD radar PNG so the radar-mosaic chart family lights up -- deferred per OUT-OF-SCOPE (chart library extension to accept polygon-radar specs is the recommended path; tracked separately).
- As a scenario author, I want LLM-generated commentary so I can author 100 scenarios without hand-tuning each callout -- rejected per OUT-OF-SCOPE (rule-based commentary is what makes the truth-binding load-bearing; LLM-generated commentary loses the pedagogical guarantee).
