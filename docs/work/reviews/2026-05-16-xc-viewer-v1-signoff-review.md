---
title: 'Sign-off Review: XC Viewer v1'
product: sim
feature: xc-viewer-v1
type: review
status: unread
review_status: done
created: 2026-05-16
---

# Sign-off Review: XC Viewer v1

A pre-sign-off review summary for the `xc-viewer-v1` WP, so Joshua can review and act on `human_review_status` quickly.

## WP name and current status

- WP: `xc-viewer-v1` -- "XC Viewer v1: Universal Pre-Flight Stage (First Slice)" (`docs/work-packages/xc-viewer-v1/`).
- Frontmatter: `status: draft`, `agent_review_status: pending`, `human_review_status: pending`.
- NOW.md lists it "In flight": WP authored (PR #829), awaiting human sign-off before Phase A starts.

## What `/ball-wp-build` would do next

Run Phase A: scaffold `apps/spatial/` (a new SvelteKit app), scaffold `libs/spatial-engine/` (server-only composition lib) and `libs/spatial-ui/` (browser-safe rendering lib), add `libs/constants/src/xc-viewer.ts` + spatial routes + `PORTS.SPATIAL`, author the layer-1/2/3/4 types and Zod schemas, build the Memphis sectional ingester, and commit the Memphis vector geometry under `course/sectionals/memphis/`. Phases B through F follow (sectional renderer, route renderer, weather overlay, performance projection, SvelteKit page + directive + check wire-in). Unlike course-reader-and-editor, nothing here is built yet -- this is a genuine green-field build.

## What the WP delivers

The first composable slice of the XC viewer surface: one sectional region (Memphis), three airports (KMEM / KOLV / KMKL), one hand-authored route, one hand-authored C172N aircraft spec, one reused wx-engine scenario (`frontal-xc-march`), and zero scenario-perturbation events. It proves the four-layer architecture (geography, flight, weather, scenario) composes into a `ScenarioBundle` the renderer consumes, renders at `/spatial/xc/<slug>` in a new `apps/spatial/` app, and mounts in one weather-course step via a `:::xc-viewer` markdown directive. The killer-feature thesis is layered truth-awareness: every number in a per-leg claim (distance, true course, fuel, ETE, reserve) traces back to a derivation layer.

## Readiness assessment

- Spec internally consistent: yes. spec, tasks (6-phase A-F plan, ~80 task lines), test-plan (XC-1..XC-50+ across all 6 phases), design, user-stories, and OUT-OF-SCOPE.md are present and coherent.
- Consistent with current code: the dependency substrate is real. `frontal-xc-march` exists at `data/wx-scenarios/frontal-xc-march/` and is registered in `WX_SCENARIOS` (`libs/constants/src/wx-engine.ts`, value `FRONTAL_XC_MARCH: 'frontal-xc-march'`). `libs/wx-charts/src/projection.ts` (the pattern source) exists. `@types/d3-geo` is already a dependency. None of `apps/spatial/`, `libs/spatial-engine/`, `libs/spatial-ui/`, or `libs/constants/src/xc-viewer.ts` exist yet, which is correct for an unbuilt WP.
- tasks.md and test-plan.md complete enough to build from: yes. tasks.md is unusually detailed (per-sub-phase task lists A.1-A.11, B.1-B.6, etc.) with explicit commit messages and PR titles. test-plan.md has a numbered XC-NN scenario per phase. A build agent has enough to execute.

## Drift found (spec vs code)

1. Port collision -- this is the one item that must be corrected before the build. The spec (`spec.md` "Ports" section, lines 440-441) declares `SPATIAL: 9610` with the comment "study is 9600; sim is 9620; flightbag is 9630". tasks.md A.1 repeats `PORTS.SPATIAL = 9610` with the same parenthetical. Both are wrong. The actual `libs/constants/src/ports.ts` is: `STUDY: 9600`, `SIM: 9610`, `HANGAR: 9620`, `AVIONICS: 9630`, `FLIGHTBAG: 9640`. So `9610` is already taken by SIM, and the spec's reference comment ("sim is 9620, flightbag is 9630") is stale -- it predates the avionics app and the port renumbering. A build agent that follows the spec literally would assign SPATIAL a port that collides with SIM. The next free dev port following the existing +10 cadence is 9650 (with E2E port 9653). tasks.md A.1 does hedge with "or the next free port" and "Verify no collision", so a careful agent would catch it, but the spec's hard-coded `9610` and stale comment should be corrected so the contract is unambiguous.

2. `CONSUMER-CONTRACT.md` does not exist yet. spec.md line 57 says the `:::xc-viewer` directive contract is "documented at `docs/work-packages/xc-viewer-v1/CONSUMER-CONTRACT.md`". The file is not in the WP directory. This is not a real drift -- tasks.md F.4 explicitly creates `CONSUMER-CONTRACT.md` in Phase F. The spec is forward-referencing a file the build produces. Worth knowing so the file's current absence is not mistaken for a gap.

3. `:::xc-viewer` directive is not yet known to `markdown-directives.ts`. The constants file at `libs/constants/src/markdown-directives.ts` documents `:::chart` and `:::scenario` but has no `:::xc-viewer` entry. This is expected: the spec is explicit that the directive resolver lives in the course-reader-and-editor consumer (a separate WP), and Phase F only files a follow-on backlog entry plus authors a no-op placeholder course step. No correction needed; flagged so the cross-WP dependency is visible.

No other drift. The wx-engine dependency is satisfied (`depends_on: wx-engine`, and the wx-engine WP shipped per NOW.md). The architecture overview, the constants block, and the routes block in the spec are all consistent with current repo conventions.

## OUT-OF-SCOPE.md

Already present and complete (`docs/work-packages/xc-viewer-v1/OUT-OF-SCOPE.md`). 17 structured entries with Status (Deferred / Rejected / Follow-on WP) and concrete revisit triggers, covering timed events, hangar authoring UI, raster sectional tiles, multi-region, POH ingest, IFR charts, live wx feed (Rejected), 3D terrain, EFB integration (Rejected), and more. No extraction needed. The spec and tasks already point to it. Discipline satisfied.

## Open questions the user must resolve before sign-off

1. Port assignment. The spec hard-codes `PORTS.SPATIAL = 9610`, which collides with `SIM`. Decide the port (recommendation: `9650`, E2E `9653`, following the existing +10 cadence and the FLIGHTBAG_E2E +3 pattern) so the build agent has an unambiguous constant. This needs a one-line spec correction or an explicit instruction to the build agent. It is the only blocker.

2. Scope confirmation. xc-viewer v1 is a large WP: a new SvelteKit app, two new libs, an FAA sectional ingester, hand-authored airport and aircraft data, and a 6-phase build. Confirm the v1 cap is right and that nothing in OUT-OF-SCOPE.md should be pulled forward before committing the build agent.

3. FAA dCS source bytes. Phase A.9 depends on the developer having downloaded the FAA digital sectional (dCS) source archive for the Memphis region into `~/Documents/airboss-handbook-cache/sectionals/memphis/`. The build cannot run the Memphis ingest without those bytes. Confirm the source archive is available locally (or that acquiring it is part of the build kickoff), since a worktree build agent cannot fetch it autonomously.

## Recommendation

Sign off after resolving the listed questions -- specifically, fix the port. The spec, tasks, test-plan, design, and user-stories are thorough and internally consistent, the wx-engine dependency is satisfied, and the WP is genuinely ready to build. The single hard blocker is the `PORTS.SPATIAL = 9610` collision with `SIM`; correct that to a free port (9650 recommended) in the spec, confirm the FAA dCS source bytes are available for the Memphis ingest, and the WP is ready for `/ball-wp-build` to start Phase A. No structural revision of the spec is needed -- only the port number and its stale comment.
