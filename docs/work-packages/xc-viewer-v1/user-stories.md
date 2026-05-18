---
id: xc-viewer-v1
title: 'User Stories: XC Viewer v1 -- Universal Pre-Flight Stage (First Slice)'
product: sim
category: feature
status: draft
agent_review_status: done
human_review_status: pending
created: 2026-05-11
owner: agent
depends_on:
  - wx-engine
unblocks: []
tags:
  - xc-viewer
  - spatial
  - user-stories
legacy_fields:
  feature: xc-viewer-v1
  type: user-stories
---

# User Stories: XC Viewer v1 -- Universal Pre-Flight Stage (First Slice)

User-perspective narratives covering the four roles this v1 serves: scenario authors (composing route + aircraft + wx into a `ScenarioSpec`), region authors (running the sectional ingest), course authors (referencing scenario slugs from course steps), and learners (working through the rendered viewer). The library does not ship a learner-side editor in v1; learner stories are about the experience of the read-only viewer + the pedagogical effect of composition.

## Composing a scenario (scenario author = the person tying route + aircraft + wx into a ScenarioSpec)

- As a scenario author, I want one canonical place per scenario (`libs/spatial-engine/src/scenario/scenarios/<slug>.ts`) holding the `ScenarioSpec` literal, so I never have to hunt across files to understand which route + aircraft + wx the scenario composes.
- As a scenario author, I want the scenario to reference route, aircraft, and wx by slug (not by inlining the full literals) so composition is small and changes to a route or aircraft propagate to every scenario that uses them.
- As a scenario author, I want the `ScenarioSpec` Zod schema to reject malformed compositions at load time (`routeId` doesn't resolve, `wxScenarioSlug` not in the wx-engine registry, `validAt` outside the wx scenario's truth window) so I fix the typo from a clear error instead of debugging a rendered viewer.
- As a scenario author, I want `bun run xc-scenario build <slug>` to be deterministic so I trust that re-running on an unchanged literal produces zero writes.
- As a scenario author, I want the validate step to fail loud on any inconsistency (route waypoints outside the region, declared alternate not in the airport table, fuel reserve < 0) so the engine cannot ship a broken bundle.
- As a scenario author, I want one CLI dispatcher (`bun run xc-scenario ...`) covering build / validate / list so I have a single noun to remember.
- As a scenario author, I want adding a new scenario to require only: (a) one new TS file under `scenarios/<slug>.ts`, (b) one new enum entry in `XC_SCENARIOS`, (c) one `bun run xc-scenario build <slug>` run, (d) commit the literal + the generated bundle. No other places to edit.
- As a scenario author, I want every layer to be independently swappable -- pick a different route for the same wx, pick a different aircraft for the same route, pick a different wx scenario for the same route -- without re-deriving anything in the engine.

## Authoring failures (scenario author -- error paths)

- As a scenario author who picked a `wxScenarioSlug` that doesn't exist in `WX_SCENARIO_VALUES`, I want the loader to surface the mismatch with the offending slug + the list of registered slugs.
- As a scenario author who set `validAt` to a time outside the wx scenario's truth window, I want validation to reject with the wx truth window's start + end times so I shift the scenario's clock to fit.
- As a scenario author who picked an aircraft with insufficient fuel for the route, I want the validator to surface the per-leg fuel breakdown + the negative reserve so I can either shorten the route, raise cruise altitude (better TAS at the same gph), or pick a different aircraft.
- As a scenario author who put a waypoint outside the region bounds, I want a clear "waypoint <id> at <lon>/<lat> sits outside region <slug> bounds" message rather than a confusing render-time failure.
- As a scenario author who set a cruise altitude above the aircraft's service ceiling, I want a warning + a soft-fail (the scenario validates but the validator emits a warning about clamped TAS), so I notice the authoring smell.

## Authoring a region (region author -- ingesting a sectional)

- As a region author, I want one CLI command (`bun run sectionals ingest <region>`) to ingest the FAA dCS source bytes into committed vector geometry under `course/sectionals/<region>/`.
- As a region author, I want the ingester to read the source archive from a documented cache path (`~/Documents/airboss-handbook-cache/sectionals/<region>/`) so source bytes never enter the repo per ADR 018.
- As a region author, I want the FAA dCS cycle to be recorded in `course/sectionals/<region>/manifest.yaml` so a future maintainer knows which cycle the vector data came from and when to re-ingest.
- As a region author who hit a malformed FAA dCS feature (self-intersecting polygon, open ring), I want the ingester to drop the feature with a warning in the manifest rather than refuse to write the rest.
- As a region author writing the per-airport `airport.json`, I want the FAA NASR record to be the source-of-truth + a `CITATION.md` per airport documenting which NASR cycle + which sectional cycle each field came from.
- As a region author adding KMEM Class B + KOLV Class D + KMKL Class D to the airspace.geojson, I want the airspace schema to reject the wrong color/class combination at validate time (a `class: 'B'` polygon must produce blue stroke; a `class: 'D'` must produce dashed blue stroke).

## Authoring an aircraft spec (aircraft author -- transcribing a POH)

- As an aircraft author, I want the `AircraftSpec` shape to be expressive enough to capture the POH (perf polar by pressure altitude, fuel burn by power setting, W&B envelope as a polygon, equipment list) without me having to invent extra fields.
- As an aircraft author, I want one `course/aircraft/<slug>/CITATION.md` per aircraft mapping every `AircraftSpec` field to a POH section + page number so the transcription is auditable and a future maintainer can compare to the source.
- As an aircraft author for the C172N, I want the v1 to ship as a literal TS file (not a PDF ingest) so the discipline is "write code with citations" rather than "wrestle a PDF parser".
- As an aircraft author who realized the W&B envelope vertices are wrong, I want the schema to catch the inversion (fwd > aft, or non-closed envelope) at load time.
- As an aircraft author hand-coding the perf polar, I want the schema to reject non-monotonic TAS across pressure altitude (a C172 climbing slower with altitude is expected; a C172 with TAS dropping then rising is an authoring bug).

## Pedagogical authoring (scenario author -- "I want this scenario to teach")

- As a scenario author building a frontal-passage lesson, I want the v1 scenario's per-leg performance numbers to come out cleanly so the learner sees the layered composition (geometry from the route, performance from the aircraft, wind from the wx) in one consistent view.
- As a scenario author writing the next scenario after v1, I want the substrate to be stable enough that I only have to write the new `ScenarioSpec` literal -- not extend the engine or the renderer.
- As a scenario author working toward the v2+ scenario-events layer, I want the v1 type union for `TimedEvent` to be declared (even if v1 ships `events: []`) so I can read the type signature and understand the wider shape.

## Authoring a region's airspace (airspace author -- detail discipline)

- As an airspace author for KMEM, I want the Class B polygon to render in the correct color (blue solid stroke) without me having to wire the color anywhere -- the renderer reads `polygon.class` and styles per spec.
- As an airspace author who realizes the FAA dCS data dropped a Class D sector, I want to hand-edit `course/sectionals/memphis/airspace.geojson` (with provenance recorded in the manifest) and have the ingester preserve the edit on next re-ingest (or treat the manual edit as a follow-on PR rather than a re-ingest).

## Referencing a scenario from a course step (course author)

- As a course author writing a weather lesson, I want to embed the v1 viewer by slug (`:::xc-viewer slug="kmem-kmkl-kolv-frontal-march"`) so the embedding contract is decoupled from the scenario's individual layers.
- As a course author, I want scenario slugs to read like content (`kmem-kmkl-kolv-frontal-march`) rather than opaque ids so I can read a step's markdown and know which scenario it points at.
- As a course author who picked a slug that doesn't exist, I want the consumer to render a clear "scenario not found: <slug>" placeholder rather than silently rendering nothing.
- As a course author teaching frontal passage, I want to reference the same scenario from multiple steps without duplicating its bundle -- the cited-by view in `data/xc-scenarios/<slug>/cited-by.json` shows me which steps depend on the scenario.
- As a course author iterating on a step, I want the viewer panel to render the same way every time I navigate to the step (deterministic) so I focus on the prose, not the bundle state.
- As a course author building the frontal-passage lesson, I want the viewer's waypoint chips + AIRMET overlays to surface as discovery affordances -- not as walls of explanatory text -- so the lesson preserves the discovery-first pedagogy ([ADR 011](../../decisions/011-knowledge-graph-learning-system/decision.md)).

## Browsing the viewer (learner)

- As a learner working through a frontal-passage lesson, I want to see the route, the airports, the airspace, and the weather all in one view so I can build a single mental model of "what does this flight look like today?"
- As a learner viewing the sectional, I want to pan + zoom smoothly so I can examine the route at different scales without lag.
- As a learner clicking a waypoint, I want a side panel showing the airport's metadata + the current METAR + the latest TAF + the AIRMETs in effect at that point -- everything the pre-flight briefing would surface, in one click.
- As a learner clicking a leg, I want a side panel showing the leg's distance + course + altitude + wind + TAS + ground speed + ETE + fuel -- the full performance derivation visible.
- As a learner viewing the performance band, I want to see total fuel + reserve + total ETE + W&B / CG indicator so I can sanity-check the flight at a glance.
- As a learner who saw the IFR AIRMET overlay cross the route, I want to click it and see the AIRMET text + the hazard kind + the altitude band so I learn what the AIRMET is telling me.
- As a learner working through the discovery prompt "what does the wind aloft do to your ground speed at 4500 ft on leg 2?", I want the answer to be a derived value the viewer shows, not text I have to guess from -- the killer-feature thesis lands when I see "TAS 110 - wind component 7 -> GS 103 kt" displayed.
- As a learner switching to dark mode, I want the viewer to remain legible -- no light-on-light or dark-on-dark text.

## Cross-cutting: integrity and trust

- As a scenario author, I want every scenario to embed its `scenarioId`, the engine's `library_version`, and the wx scenario's slug + truth.validAt in `bundle.json` so I can trace any rendered viewer back to the exact code + literals + wx state that produced it.
- As a scenario author, I want bumping the engine library version to invalidate every scenario's bundle so substrate improvements propagate on the next `--all` rebuild without manual intervention.
- As a scenario author, I want every derivation function (`derivePerformance`, `interpolateWind`, `composeBundle`) to be a pure function so I unit-test derivations deterministically with synthetic literals.
- As a course author or learner, I want the viewer's bundle to be a static set of files (not a server-render-on-demand) so the page loads with no network round trip beyond the asset fetches.
- As a course author, I want the engine's killer-feature framing -- "the engine knows the route geometry + the aircraft performance + the wx truth, so every claim is derivable" -- to be visible in the consumer surface (the per-leg drawer with the full performance breakdown) so the pedagogy advantage is not invisible plumbing.

## Cross-cutting: discipline

- As any agent on this project, I want server-only code (filesystem writes, sectional ingesters, large vector literals) to live in the `/server` barrel and never leak to the runtime barrel, so I cannot accidentally ship the engine into the browser bundle.
- As any agent on this project, I want the `libs/spatial-ui/` runtime barrel to be browser-safe (components + types only; no `node:*` imports) so the renderer can ship in the browser bundle without hydration errors.
- As any agent on this project, I want the scenario registry closed at the declared scenarios so adding a new scenario goes through one PR (add the literal + register + commit the bundle) rather than accumulating undeclared scenarios.
- As any agent on this project, I want every `ScenarioSpec` to validate at `bun run check` time so a broken composition surfaces as a check failure rather than a silent broken viewer page.
- As any agent on this project, I want `composeBundle` to be pure (no side effects, no globals, no filesystem) so I can unit-test it against synthetic inputs.

## Negative stories (out of scope, captured for reference)

These belong in [OUT-OF-SCOPE.md](./OUT-OF-SCOPE.md), included here so the reader can see the full shape:

- As a scenario author, I want timed events (wx perturbations, a/c failures, ATC reroutes) so I can teach decision-under-pressure -- deferred per OUT-OF-SCOPE (`xc-scenario-events` follow-on WP).
- As a scenario author, I want a map-based polygon / route editor in the hangar app so I don't hand-edit TS literals -- deferred per OUT-OF-SCOPE (`xc-editor-v1` follow-on WP).
- As a scenario author, I want to ingest a real POH PDF for a new aircraft -- deferred per OUT-OF-SCOPE (`xc-poh-ingest` follow-on WP).
- As a scenario author, I want raster sectional tiles overlaid for photographic accuracy -- deferred per OUT-OF-SCOPE (`xc-viewer-raster-tiles` follow-on WP).
- As a learner, I want to view the IFR enroute charts at high altitude -- deferred per OUT-OF-SCOPE (`xc-viewer-ifr-enroute` follow-on WP).
- As a learner, I want approach plates for each airport -- deferred per OUT-OF-SCOPE (`xc-viewer-plates` follow-on WP gated on FAA AeroNav plate ingest).
- As a learner, I want to step time forward minute-by-minute and watch the wx + AIRMETs evolve -- deferred per OUT-OF-SCOPE (depends on the `xc-scenario-events` follow-on + the wx-engine's S2/S3 historical / replay infrastructure).
- As a learner, I want to compare two scenarios side-by-side (same route, different wx) -- deferred per OUT-OF-SCOPE (gated on user-zero asking in real use).
- As a learner, I want live wx feed integration so I can rehearse my actual flight today -- rejected per OUT-OF-SCOPE (out of pedagogical scope; the viewer's value is curation, not live data).
- As a learner, I want 3D terrain visualization for mountain routes -- deferred per OUT-OF-SCOPE (`spatial-3d` follow-on if ever requested).
- As a learner on mobile, I want touch-friendly pan / zoom + tap-to-open detail -- deferred per OUT-OF-SCOPE (desktop pre-flight surface first; mobile is a separate UX problem).
- As a learner, I want the viewer to integrate with my ForeFlight account -- rejected per OUT-OF-SCOPE (no third-party API integration; airboss is a closed pedagogical platform).
