# Now

Single entry point for "what should I work on?" in airboss.

## What I'm focused on right now

(Human-curated; the only hand-edited part of this file.)

Recently shipped:

- `command-palette` -- Phases 1, 2, 3, 3.5a, 3.5b, 3.5c, 4, 5 all shipped end-to-end (13 PRs: WP #822, Phase 2 #831, Phase 3 #857, hotfixes #921 + #925, 3.5 docs #929, Phase 3.5a #930, 3.5b #933, 3.5c #936, FTS-deviation track #937, Phase 4 #940, Phase 5 #942, punt-backlog tracking #957). Cmd+K live with intent classifier, composite ranker, per-intent panels, top-hits strip, vertical type-nav, book-level collapse, doc-code autocomplete and a generic `@ab/autocomplete` lib. Cmd+Shift+P live with per-app command registries (study, sim, hangar, flightbag). Cmd+P live with quickopen + recency-weighted recents. Walkthrough: [2026-05-13-command-palette](walkthroughs/2026-05-13-command-palette.md).
- `course-tree-arbitrary-depth` -- Phases A/B/C/D/E shipped (PRs #934, #935, #938, #943, #944). N-deep schema + recursive validators + lens helper + renderer prev/next nav + aggregate cert overlay with leaf-only study-plan selection. Walkthrough owed.
- `wx-charts` -- ADR 027 layout migration complete (PRs #915, #922, #923, #927), CONUS hunchback root-caused (PRs #924, #926), `/api/charts` route serving SVGs (#928), `:::chart` and `:::scenario` markdown directives wired (#932). Browser-hydration leaks in `@ab/sources` runtime barrel closed (PRs #921, #925).
- `wx-engine` -- Phases A-F shipped end-to-end (PRs #824, #825, #827, #830, #837, #839; final close #842). Six production scenarios, CLI dispatcher, round-trip check wired into `bun run check`, `:::scenario` directive contract. `agent_review_status: done`; walkthrough owed.
- `card-question-tier` -- Phase 1 schema + seeder + pilot shipped (#855), Phase 2 backfill across remaining course cards via inference rules (#949), `cardType=calculation -> basic` fix on 12 weather cards (#843), interactive `classify-card-tier` CLI for hand-classification (#954). Phase 3 UI surfaces (FAA-vs-CFI panel, tier filter, ACS lens, source-authority badge) deferred to dedicated WPs. Walkthrough owed.
- `weather-comprehensive` course -- 250 weather cards live across the course tree; weather products reference encyclopedia shipped at `/reference/wx/products` (PRs #956, #960, #964); WX Scenarios section landed in the course (#948); citation migrate now pins AvWx (FAA-H-8083-28B) chapters (#946, #955). Walkthrough owed.

In flight:

- `course-reader-and-editor` WP authored (PRs #760, #761) -- dual UI on top of course-primitive: study reader + hangar editor + Courses tab on `/program/goals/[id]`. Spec status `draft` pending walkthrough; `/ball-wp-build` dispatches once human review signs off.
- `xc-viewer-v1` -- all six phases A-F shipped end-to-end. New `apps/spatial/` surface, `libs/spatial-engine/` (server-only four-layer composition pipeline) + `libs/spatial-ui/` (browser-safe SVG renderer). The KMEM -> KMKL -> KOLV cross-country composes the Memphis sectional + the C172N + the `frontal-xc-march` wx-engine scenario into a `ScenarioBundle` rendered at `/spatial/xc/kmem-kmkl-kolv-frontal-march`: sectional + airspace + route + weather chips + AIRMET polygons + per-leg performance + W&B band. `bun run xc-scenario` + `bun run sectionals` CLI dispatchers; `xc-scenario validate --all` wired into `bun run check`. The `:::xc-viewer` directive contract is documented and mounted in the `s2-airmasses-fronts-stability` course step (the resolver itself is a course-reader-and-editor follow-on). `status: in-flight` -- **ready for human walk-through** (test plan XC-1 through XC-78).
- `hangar-review-queue-cluster-fix` -- 24 e2e failures triaged. Test suite green-up landed (#939, 558 -> 0 failures) and validator green-up landed (#941, TBD wiki-link + 5 orphan help pages). Underlying hydration leak / `hangar.docs_search_index` Postgres crash still need one focused investigation.
- `personal-minimums-as-typed-contract` -- all five phases A-E shipped end-to-end (PRs #1081, #1082, #1084, #1088, + Phase E close). New `study.personal_minimums` typed primitive with revision history, server-only BC API, a browser-safe `projectAgainstPersonalMinimums` lens, the `/personal-minimums` editor + history surface, an implications subpanel against wx-engine scenarios, and a course nudge from the `wx-personal-minimums` node. `agent_review_status: done` on every WP file; `status: in-flight` -- **ready for human walk-through** (test plan PMIN-1 through PMIN-61 in [test-plan.md](../work-packages/personal-minimums-as-typed-contract/test-plan.md)). Unblocks `xc-viewer-personal-minimums-overlay`, `decision-debrief-replay`, `logbook-ingestion`.

Walkthroughs owed: cert-dashboard (#321), lens-ui (#323), goal-composer (#324), wx-engine, course-tree-arbitrary-depth, card-question-tier, weather-comprehensive course, personal-minimums-as-typed-contract.

## Carried over (rollup 2026-05-17T21:02:21Z)

Consolidated from 19 wind-down sessions across 2026-05-15 and 2026-05-17. Full detail + per-session attribution in [ROLLUP-unfinished.md](./wind-down/ROLLUP-unfinished.md).

High-severity carried items:

- **~15 WP walkthroughs owed human sign-off** -- `human_review_status: pending` on cert-dashboard, lens-ui, goal-composer, wx-engine, course-tree-arbitrary-depth, course-reader-and-editor, xc-viewer-v1, hangar-content-census, and more. Walk each test plan, then `bun run wp set <slug> human-review signed-off`.
- **24 e2e failures** -- Buffer hydration leak + Postgres crash on `hangar.docs_search_index`. Two root causes, one focused investigation.
- **Real-browser hydration verification owed** -- rich-reader / reader-prefs surface + weather-comprehensive s11 flow never loaded in a real browser.
- **ADR 028 (content-intent frontmatter) awaits approval** -- blocks content-census Layer 2 authoring at scale.
- **Card question_tier hand-classification** -- ~786 cards lack `question_tier`; needs CFI judgement via `bun scripts/db/classify-card-tier.ts`.
- **Manual walkthrough of weather-comprehensive end-to-end** -- not yet hand-walked in the live app.

Medium / low items (16 medium, 19 low) -- see the rollup. Notable: build the personal-minimums / flightbag-citation-url-migration / xc-viewer-v1 WPs; `/ball-wp-drift`; wx-engine AIRMET text emitter; `legacy-citation-shape` warnings (200); `fix/contrast-skips-deep-ink` branch needs rebase.

## Carried over (rollup 2026-05-18T03:10Z)

Consolidated 5 further wind-down sessions (24 sessions total) into [ROLLUP-unfinished.md](./wind-down/ROLLUP-unfinished.md). New high-severity items surfaced by the integration-sweep / zod-4 work:

- **`integration --full` never verified green** -- the ~3484-URL prod-build sweep has not had a clean uninterrupted pass; attempts hit port conflicts / were killed. The default 209-URL sample sweep passes. Kill stale `build/index.js` + `playwright` procs, free port 9647, run `bun run test integration --full` to completion.
- **`@ab/sources/regs/ingest` subpath export missing** -- `scripts/sources/register.test.ts` fails; PR #1056 imports a subpath `libs/sources/package.json` never declared. Add the `./regs/ingest` exports entry.

Resolved since the previous roll: the zod 3->4 / better-auth prod-build boot crash (**PR #1064**), `integration list` exit code (**PR #1065**), and the `fix/contrast-skips-deep-ink` branch -- rebased, conflict-resolved, `check branch` clean, merged as **PR #1067**.

## Live views

- [Work package board](./BOARD.md) -- every WP grouped by status (generated)
- [Shipped log](./SHIPPED.md) -- per-PR + per-WP reverse-chrono (generated, last 90 days)
- [Punt backlog](./PUNT-BACKLOG.md) -- deferred items + revisit triggers
- [Bugs](../bugs/INDEX.md) -- open bugs grouped by product and severity (generated)
- Per-product roadmaps (generated):
  - [study](../products/study/ROADMAP.md)
  - [hangar](../products/hangar/ROADMAP.md)
  - [sim](../products/sim/ROADMAP.md)
  - [flightbag](../products/flightbag/ROADMAP.md)
  - [avionics](../products/avionics/ROADMAP.md)
- Hangar in-app `/roadmap` -- WP browser with filters, tabs, and detail (Phase 8 shipped)

## Open ideas

- [IDEAS.md](../platform/IDEAS.md) -- intake funnel; review every two weeks

## Active session

- [Today's todo](./todos/) -- per-session work files (`YYYYMMDD-NN-TODO.md`)

## Per-PR log

Every merged PR lands as one entry under [docs/log/](../log/) via `bun run track log <number>`. The shipped log aggregates these reverse-chronologically.

## Links

- [MULTI_PRODUCT_ARCHITECTURE.md](../platform/MULTI_PRODUCT_ARCHITECTURE.md) -- surface-typed app architecture
- [PIVOT.md](../platform/PIVOT.md) -- why airboss exists
- [DESIGN_PRINCIPLES.md](../platform/DESIGN_PRINCIPLES.md) -- how we evaluate features
- [VOCABULARY.md](../platform/VOCABULARY.md) -- naming standards
- [ADR 011](../decisions/011-knowledge-graph-learning-system/decision.md) -- knowledge graph learning system
- [ADR 016](../decisions/016-cert-syllabus-goal-model/decision.md) -- cert / syllabus / goal / lens model
- [ADR 018](../decisions/018-source-artifact-storage-policy/decision.md) -- source artifact storage policy
- [ADR 019](../decisions/019-reference-identifier-system/decision.md) -- reference identifier system
- [ADR 020](../decisions/020-handbook-edition-and-amendment-policy.md) -- handbook editions + errata
- [ADR 025](../decisions/025-wp-frontmatter-contract/decision.md) -- work package frontmatter contract
- [Product INDEX](../vision/INDEX.md) -- all 53 product ideas
- [Learning INDEX](../vision/learning/INDEX.md) -- the 14 aviation domains

## Relationship to airboss-firc

FIRC-specific code, content, and work stays in [airboss-firc](/Users/joshua/src/_me/aviation/airboss-firc) until the FIRC migration step. That repo has the 4 SvelteKit apps (sim, hangar, ops, runway), the FAA compliance pipeline, the 503 questions, and ongoing FIRC-specific work. Nothing new should be built in airboss-firc going forward.

Per [MULTI_PRODUCT_ARCHITECTURE.md](../platform/MULTI_PRODUCT_ARCHITECTURE.md), FIRC will migrate into airboss as `apps/firc/` after the study app MVP is proven.
