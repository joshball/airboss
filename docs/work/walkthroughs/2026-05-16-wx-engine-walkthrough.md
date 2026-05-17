---
title: wx-engine -- manual walkthrough (truth-aware weather scenario engine)
date: 2026-05-16
wp: wx-engine
status: ready-for-walk
machine: scaffold
branch: scaffold
prompt: scaffold the owed wx-engine manual-test walkthrough from spec + shipped code
---

# wx-engine -- manual walkthrough

Walk this end-to-end before flipping `human_review_status: signed-off` on the [wx-engine WP](../../work-packages/wx-engine/spec.md). This is a scaffold: the steps below are drafted from [spec.md](../../work-packages/wx-engine/spec.md) and [test-plan.md](../../work-packages/wx-engine/test-plan.md) and the shipped code. Joshua runs the test and signs off. The WP does not close until he does.

After each step, check one box:

- [ ] **PASS** -- behaves as the expected-result column says
- [ ] **ISSUE** -- file via `bun run bug new <slug>` and report
- [ ] **REJECT** -- the shape itself is wrong; re-discuss before sign-off

## What this verifies

The truth-aware weather scenario engine (`libs/wx-engine/`) generates a complete pre-flight briefing pack -- products, charts, Socratic commentary -- from a single canonical atmospheric truth state. This walk confirms the six production scenarios build deterministically, the `bun run wx-scenario` CLI works end-to-end, the round-trip check is wired into `bun run check`, and the `:::scenario` directive renders a scenario in a course step.

Scope note: PRs #824, #825, #827, #830, #837, #839 (close #842) shipped Phases A-F. The seventh scenario `frontal-pressure-march` (PR #1001, TruthModel v2 temporal evolution) is a later addition and is not part of this WP's six -- ignore it for sign-off purposes here.

## Setup

Run the dev server from the **parent repo** (the worktree this walkthrough was authored in does not carry `.env`).

```bash
cd /Users/joshua/src/_me/aviation/airboss
git checkout main && git pull --ff-only origin main
bun install
```

The CLI steps need no dev server. The directive-render step needs the study app:

```bash
bun scripts/dev.ts study
```

Wait for `Local: http://127.0.0.1:9600/`. Open the study app in a real browser, devtools open. Sign in as Abby (`abby@airboss.test`).

## Steps

### 1. CLI lists six scenarios

- **Command:** `bun run wx-scenario list`
- **Expected:** prints six lines, each `<slug> -- <human label>`, matching `WX_SCENARIO_VALUES`: `frontal-xc-march`, `summer-thunderstorms-tx`, `winter-icing-great-lakes`, `mountain-wave-rockies`, `marine-stratus-pacific-nw`, `dense-fog-radiation-central-valley`. Exits 0.
- [ ] PASS / ISSUE / REJECT

### 2. Build the spike scenario

- **Command:** `bun run wx-scenario build frontal-xc-march`
- **Expected:** exits 0. `data/wx-scenarios/frontal-xc-march/` carries `truth.json`, `products/` (metars / tafs / airmets / fb-bulletin / pireps), `charts/`, `commentary.md`, `commentary.json`. Chart specs mirrored under `data/charts/wx/wx-scenario-frontal-xc-march-*/`. Cache mirror under `~/Documents/airboss-handbook-cache/wx/scenarios/frontal-xc-march/`.
- [ ] PASS / ISSUE / REJECT

### 3. Build is idempotent

- **Command:** re-run `bun run wx-scenario build frontal-xc-march`, then `git status data/wx-scenarios/frontal-xc-march/`
- **Expected:** the second invocation produces no `git diff` change. Deterministic generation (test-plan WXENG-71).
- [ ] PASS / ISSUE / REJECT

### 4. Build every scenario

- **Command:** `bun run wx-scenario build --all`
- **Expected:** prints per-scenario status (built / unchanged) for all six. Exits 0. Every scenario directory under `data/wx-scenarios/` is populated.
- [ ] PASS / ISSUE / REJECT

### 5. Validate runs without writing

- **Command:** with a clean working tree, `bun run wx-scenario validate frontal-xc-march`
- **Expected:** exits 0. Prints round-trip parse counts (0 warnings), consistency-check counts (all green), knowledge-node resolution counts (all resolved). `git status` shows no files modified (test-plan WXENG-73).
- [ ] PASS / ISSUE / REJECT

### 6. Product counts match the fixture

- **Command:** inspect `data/wx-scenarios/frontal-xc-march/products/`
- **Expected:** `metars.txt` 5 lines, `tafs.txt` 5 TAFs, `pireps.txt` 3 PIREPs, `airmets.json` 3 advisories, `fb-bulletin.txt` a 45-row FB grid. (Fixture table in test-plan: `5 / 5 / 3 / 1 / 3`.)
- [ ] PASS / ISSUE / REJECT

### 7. Chart count is 17

- **Command:** count entries under `data/charts/wx/wx-scenario-frontal-xc-march-*/`
- **Expected:** 17 chart spec directories. Slugs follow `wx-scenario-<scenario-id>-<chart-kind>[-<station>]`; no slug collisions (test-plan WXENG-21).
- [ ] PASS / ISSUE / REJECT

### 8. Surface-analysis chart renders

- **Command:** `bun run charts build wx-scenario-frontal-xc-march-surface-analysis`, then open the produced `chart.svg` in a browser
- **Expected:** exits 0 (`built` first run, `unchanged` on re-run). The SVG shows a CONUS basemap with isobars, H/L markers, the cold front with triangle pips on the correct side; title carries the scenario narrative subtitle (test-plan WXENG-22).
- [ ] PASS / ISSUE / REJECT

### 9. Commentary is discovery-first and truth-anchored

- **Command:** open `data/wx-scenarios/frontal-xc-march/commentary.json`
- **Expected:** 8-15 callouts. Each carries a non-empty `question`, `observation`, `reason`, and a `knowledgeNodeIds` array. Socratic-mode questions are open-ended (start with What / Why / How) and the `reason` cites a specific named truth element (a named pressure system, air mass, hazard zone, convective cell) -- no placeholders like "the front" (test-plan WXENG-30, WXENG-34).
- [ ] PASS / ISSUE / REJECT

### 10. Every commentary knowledge-node id resolves

- **Command:** for each `knowledgeNodeIds` entry across the commentary files, confirm `course/knowledge/weather/<id>/` exists
- **Expected:** every id resolves to a real node directory; no missing nodes (test-plan WXENG-32).
- [ ] PASS / ISSUE / REJECT

### 11. Round-trip check is wired into `bun run check`

- **Command:** `bun run check all`, then inspect `.cache/check/`
- **Expected:** a `wx-scenario-round-trip` step appears with output at `.cache/check/wx-scenario-round-trip.{stdout,stderr,exit}`. Exit code 0. The step ran across all six scenarios (test-plan WXENG-74).
- [ ] PASS / ISSUE / REJECT

### 12. Round-trip check fails loud on a regression

- **Command:** temporarily comment out the wind-format step in `libs/wx-engine/src/products/metar.ts`, run `bun run check all`, then revert and re-run
- **Expected:** with the break in place, the `wx-scenario-round-trip` step fails and names the offending scenario plus station; `bun run check` exits non-zero. After revert, clean (test-plan WXENG-75).
- [ ] PASS / ISSUE / REJECT

### 13. `:::scenario` directive renders in a course step

- **Route:** `/courses/weather-comprehensive/s11` then into the WX Scenarios section -- the `frontal-xc-march` sub-page (the s11 section body embeds `:::scenario slug="frontal-xc-march"` at line 126 of `course/courses/weather-comprehensive/sections/s11-wx-scenarios.yaml`)
- **Action:** open the step in the study reader as Abby
- **Expected:** a `ScenarioPanel` renders. The bundle JSON streams from `/api/scenarios/frontal-xc-march/bundle.json`. The panel shows the scenario narrative as a header, the METAR comparison grid, charts, and the commentary callouts beside the relevant chart. Devtools console clean.
- [ ] PASS / ISSUE / REJECT

### 14. Directive rejects an unknown slug

- **Route:** `/api/scenarios/not-a-real-scenario/bundle.json`
- **Action:** request the URL directly
- **Expected:** 400 before any filesystem work (the route validates against `WX_SCENARIO_VALUES`).
- [ ] PASS / ISSUE / REJECT

## Sign-off

Only flip when every step above is PASS:

```bash
bun run wp set wx-engine human-review signed-off
```

(Per the ADR-025 lint, only Joshua's email can flip `human_review_status`. The `status: shipped` move is gated on `human_review_status: signed-off`.)

## Related

- [spec.md](../../work-packages/wx-engine/spec.md) -- scope, killer-feature framing, architecture
- [test-plan.md](../../work-packages/wx-engine/test-plan.md) -- full WXENG- case matrix
- [design.md](../../work-packages/wx-engine/design.md) -- truth-model schema, per-layer derivation contracts
- [CONSUMER-CONTRACT.md](../../work-packages/wx-engine/CONSUMER-CONTRACT.md) -- the `:::scenario` directive data contract
- [OUT-OF-SCOPE.md](../../work-packages/wx-engine/OUT-OF-SCOPE.md) -- deferred S2/S3 stages, four deferred chart types
