# Now

Single entry point for "what should I work on?" in airboss. Refresh date: 2026-04-22.

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

The entire Steps 1-6 roadmap is on main. Feature code, specs, tests, docs — all shipped.

## In flight

Nothing. All parallel-build worktrees drained; PRs merged; stale branches pruned.

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

2. **Seed the 12 vfr-weather-minimums cards into your local DB.** PR #15 shipped the authoring pipeline; cards don't flow through `/memory/review` until `bun run knowledge:seed --user <email>` runs once. Gated on the script-consolidation TODO below.

3. **CFI-review the 27 skeleton nodes.** PR #15 flagged `references` and `mastery_criteria` defaults as needing CFI accuracy before they're trusted. Skim-pass your own content.

4. **Scale the graph.** Steps 7 is gradual: author one node at a time as you study. The authoring loop is `bun scripts/knowledge-new.ts <domain> <slug>` → fill in phases → `bun run check` validates.

## Pending infra cleanup

- **Script consolidation:** proposal pending — collapse `knowledge:new`, `knowledge:seed`, `build-knowledge` into the `db` dispatcher and auto-run build on `dev`. One `bun run db seed` seeds everything; `bun run db reset --force` resets + seeds. See chat for the design.
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
