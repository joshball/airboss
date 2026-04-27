# Now

Single entry point for "what should I work on?" in airboss. Refresh date: 2026-04-25.

## Just shipped (2026-04-25 sweep)

- **Browse pages refactor (memory + reps + knowledge)** — extracted seven shared `@ab/ui` components (`FilterCard`, `FilterChips`, `ResultSummary`, `Pager`, `BrowseList`, `BrowseListItem`, `BrowseViewControls`); brought reps and knowledge to feature parity with memory (search where applicable, page-size, group-by, facet `(N)` counts, active-filter chips). PRs #180, #182, plus the in-flight follow-up.
- **`/memory/review` 500 fix.** `getDueCards` and the snooze auto-suspend path interpolated a JS `Date` directly into raw `sql\`\`` templates; postgres-js sent `Date.toString()` and rejected. Both call sites now use `.toISOString()`. PR #180.
- **Dev-seed pipeline + Abby + content** — `seed_origin` markers on every seedable table, prod guard with vitest tests, `bun run db seed:remove` and `seed:check`, Abby (`abby@airboss.test`) as the canonical dev test learner, 18 personal cards + 16 scenarios + 1 active plan + 3 historical sessions across VFR weather, airspace, emergencies. Calibration deliberately uncalibrated. PRs #178, #179.
- **Sim phase 4-6 push** — debrief route shell + scrubber + truth/display panels + input tape + ideal-path overlay, EFATO + vacuum + pitot/static + partial-panel + unusual-attitudes + aft-CG + nose-low + VMC-into-IMC seed scenarios, departure-stall promotion, scenario grading evaluator, PA-28 aircraft profile, engine sound harmonic stack, annunciator strip, theme-token cluster. PRs #155, #157, #158, #160, #161, #163, #164, #166, #167, #168, #170, #171, #173, #181, #184.
- **Reviews / sessions URL layer (b) + (c)** — deck encoder + resolver + saved decks, share popover with Copy + Report. PRs #154, #159.
- **Sprint follow-ups** — sprint 1, 2, 4 post-merge review fix passes, citations wiring for rep + scenario detail, jump-to-card dropdown, "No idea" confidence label, archive SMI feedback, reps form + browse + session-start polish, rep submit fix on session_item_result insert, help-startup-warning closeouts. PRs #156, #162, #165, #169, #172, #174, #175, #177.
- **Walkthroughs doc** — 2026-04-25 audit plan + decision-reps capture. PR #176.
- **session-legibility-and-help-expansion** — rich Markdown help renderer, `<InfoTip>` + `<PageHelp>` primitives, ten concept pages (`/help/concepts`), `memory-review` + `session-start` rebuilt with callouts + `externalRefs`, `/session/start` made legible. Earlier in the cycle.

## Follow-on candidates

- Per-page help for remaining routes (`/dashboard`, `/reps/*`, `/knowledge/*`) — `<PageHelp>` is wired on memory-browse, reps-browse, knowledge-graph; dashboard and detail routes are still uncovered.
- Drawer overlay for `<PageHelp>` (currently navigates to `/help/<id>`; drawer is the listed follow-up).
- Dark-theme Shiki code-block tokens (single theme today).
- InfoTip `helpId` static validator (parked in Phase 5.2) — grep `.svelte` files, assert each id is registered.

## Shipped to main

| PR  | Feature                                                       | Surface  |
| --- | ------------------------------------------------------------- | -------- |
| #1  | Spaced Memory Items MVP + docs migration                      | study    |
| #2  | Knowledge Graph content canary (3 deep nodes + activity)      | content  |
| #3  | Knowledge Graph spec + design + tasks + test-plan             | docs     |
| #4  | Study Plan + Session Engine spec + design + tasks + test-plan | docs     |
| #5  | Learning Dashboard spec + design + tasks + test-plan          | docs     |
| #6  | Knowledge Graph schema + BC foundation                        | study    |
| #7  | Decision Reps MVP                                             | study    |
| #8  | NOW.md refresh post-PR7                                       | docs     |
| #9  | Calibration Tracker MVP (Step 3)                              | study    |
| #10 | Decision Reps 10x review follow-ups                           | study    |
| #11 | Learning Dashboard v1 with gated placeholders                 | study    |
| #12 | Scripts single-word dispatcher pattern                        | infra    |
| #13 | Knowledge Graph v1 UI + CLI + dual-gate mastery BC            | study    |
| #14 | Study Plan + Session Engine                                   | study    |
| #15 | 30-node skeleton + inline yaml-cards seeder                   | content  |
| #16 | Playwright e2e suite                                          | infra    |

PRs #17-#184 (everything since the original "Steps 1-6 shipped" snapshot) are catalogued in `git log` and the "Just shipped" section above. The roadmap below tracks the original MVP build order; ongoing feature work happens in work-packages and the per-app TASKS.md files.

## In flight

- **sim-card-mapping** -- closes the loop between sim grading and the spaced-rep scheduler. `SIM_SCENARIO_NODE_MAPPINGS` (typed `Record<SimScenarioIdGraded, ...>`) + `simWeaknessByNode` BC bridge + strengthen-slice scoring lift via `ENGINE_SCORING.STRENGTHEN.SIM_PRESSURE_FACTOR`. Spec: [docs/work-packages/sim-card-mapping/](../work-packages/sim-card-mapping/spec.md).

## Build Order

| Step | Work                                             | Status            |
| ---- | ------------------------------------------------ | ----------------- |
| 1    | Spaced Memory Items MVP                          | Shipped           |
| 2    | Decision Reps MVP                                | Shipped           |
| 3    | Calibration Tracker MVP                          | Shipped           |
| 4a   | Knowledge Graph 3-node canary                    | Shipped           |
| 4b   | Knowledge Graph schema + BC foundation           | Shipped           |
| 4c   | KG UI + CLI scaffolder + dual-gate mastery BC    | Shipped           |
| 4d   | 30-node skeleton + yaml-cards seeder             | Shipped           |
| 5    | Study Plan + Session Engine                      | Shipped           |
| 6    | Learning Dashboard v1                            | Shipped           |
| 7    | Scale graph to ~500 nodes                        | Ongoing           |
| 8    | Manual test passes (user zero)                   | **All pending**   |
| --   | FIRC migration as `apps/firc/`                   | Deferred          |

## Next

The code side of the original MVP roadmap is done. What remains is the human side:

1. **Manual test passes on every shipped feature.** CLAUDE.md's "nothing merges without a manual test plan" rule got overridden in the parallel-build velocity push. Six features are on main without a user-zero walkthrough. Test plans live in each work package:

   - [spaced-memory-items/test-plan.md](../work-packages/spaced-memory-items/test-plan.md)
   - [decision-reps/test-plan.md](../work-packages/decision-reps/test-plan.md)
   - [calibration-tracker/test-plan.md](../work-packages/calibration-tracker/test-plan.md)
   - [knowledge-graph/test-plan.md](../work-packages/knowledge-graph/test-plan.md)
   - [study-plan-and-session-engine/test-plan.md](../work-packages/study-plan-and-session-engine/test-plan.md)
   - [learning-dashboard/test-plan.md](../work-packages/learning-dashboard/test-plan.md)

2. **Seed the 12 vfr-weather-minimums cards into your local DB.** PR #15 shipped the authoring pipeline; cards don't flow through `/memory/review` until the cards seed runs once. Run `bun run db seed cards` (or `bun run db seed` for the full users + knowledge + cards pass).

3. **CFI-review the 27 skeleton nodes.** PR #15 flagged `references` and `mastery_criteria` defaults as needing CFI accuracy before they're trusted. Skim-pass your own content.

4. **Scale the graph.** Step 7 is gradual: author one node at a time as you study. The authoring loop is `bun run db new <domain> <slug>` → fill in phases → `bun run db build --dry-run` (or `bun run check`, which invokes it) validates.

## Pending infra cleanup

- **review_status flips** on each work package's `review.md` — agent-controlled field that hasn't been flipped to `done` on some of the newer packages.

## Links

- [MULTI_PRODUCT_ARCHITECTURE.md](../platform/MULTI_PRODUCT_ARCHITECTURE.md) — surface-typed app architecture
- [PIVOT.md](../platform/PIVOT.md) — why airboss exists
- [DESIGN_PRINCIPLES.md](../platform/DESIGN_PRINCIPLES.md) — how we evaluate features
- [ADR 011](../decisions/011-knowledge-graph-learning-system/decision.md) — knowledge graph learning system
- [IDEAS.md](../platform/IDEAS.md) — idea intake (last review: 2026-04-07)
- [VOCABULARY.md](../platform/VOCABULARY.md) — naming standards
- [Product INDEX](../vision/INDEX.md) — all 53 product ideas
- [Learning INDEX](../vision/learning/INDEX.md) — the 14 aviation domains

## Relationship to airboss-firc

FIRC-specific code, content, and work stays in [airboss-firc](/Users/joshua/src/_me/aviation/airboss-firc) until the FIRC migration step. That repo has the 4 SvelteKit apps (sim, hangar, ops, runway), the FAA compliance pipeline, the 503 questions, and ongoing FIRC-specific work. Nothing new should be built in airboss-firc going forward.
