# Now

Single entry point for "what should I work on?" in airboss. Refresh date: 2026-04-20.

## Shipped to main

| PR  | Feature                                                       | Surface     |
| --- | ------------------------------------------------------------- | ----------- |
| #1  | Spaced Memory Items MVP + docs migration                      | study       |
| #2  | Knowledge Graph content canary (3 deep nodes + activity)      | content     |
| #3  | Knowledge Graph spec + design + tasks + test-plan             | docs        |
| #4  | Study Plan + Session Engine spec + design + tasks + test-plan | docs        |
| #5  | Learning Dashboard spec + design + tasks + test-plan          | docs        |
| #6  | Knowledge Graph schema + BC foundation (v1 step 1)            | study       |
| #7  | Decision Reps MVP                                             | study       |

Every work package now has full spec + design + tasks + test-plan on main. No more "PRD only" placeholders.

## In flight

Two background agents currently building against main:

- **Decision Reps 10x review follow-ups** — 4 High + 11 Medium + 11 actionable Low fixes, plus the `review-10x.md` artifact. Will land as one PR.
- **Calibration Tracker MVP (Step 3)** — `libs/ui/ConfidenceSlider.svelte`, `libs/bc/study/calibration.ts`, `/calibration` route, refactor of the two inline confidence slider sites. Will land as one PR.

Both run in isolated worktrees, PR-bound. Neither will auto-merge.

## Build Order (Updated)

Original roadmap from [MULTI_PRODUCT_ARCHITECTURE.md](../platform/MULTI_PRODUCT_ARCHITECTURE.md) and [ADR 011](../decisions/011-knowledge-graph-learning-system/decision.md), updated to reflect shipped state and current strategy shift to **parallel feature builds** (user override of "one at a time" for velocity).

| Step | Work                                                         | Status                                                     |
| ---- | ------------------------------------------------------------ | ---------------------------------------------------------- |
| 1    | Spaced Memory Items MVP                                      | Shipped (PR #1)                                            |
| 2    | Decision Reps MVP                                            | Shipped (PR #7); review follow-ups in flight               |
| 3    | Calibration Tracker MVP                                      | In flight                                                  |
| 4a   | Knowledge Graph content canary                               | 3 of 30 deep-built (PR #2); 27 skeletons deferred          |
| 4b   | Knowledge Graph schema + BC foundation                       | Shipped (PR #6)                                            |
| 4c   | KG UI (`/knowledge`, `/knowledge/[slug]`, `[slug]/learn`)    | **Next -- parallel queue**                                 |
| 4d   | KG CLI scaffolder + build script                             | Bundled with 4c                                            |
| 4e   | KG mastery BC (`isNodeMastered`, `getNodeMastery`)           | Not on main; Study Plan agent implements as step 1         |
| 5    | Study Plan + Session Engine                                  | **Next -- parallel queue** (includes 4e as prereq)         |
| 6    | Learning Dashboard                                           | **Next -- parallel queue** (v1 ships gated panels stubbed) |
| 7    | Scale graph to ~500 nodes                                    | Gradual; happens alongside other work as Joshua studies    |
| --   | FIRC migration as `apps/firc/`                               | Deferred until study MVP proven                            |

### Parallel-build strategy (4c + 5 + 6)

All three next-features will be built in parallel by background agents, each in its own worktree, each producing its own PR. This is a deliberate override of CLAUDE.md's "one feature at a time" rule for velocity reasons. Merge order at the end is bottlenecked by Joshua's manual-test pass per CLAUDE.md, not by agent throughput.

**Known merge conflicts to expect:**

- `apps/study/src/routes/(app)/+layout.svelte` (nav bar) — three PRs will each add a nav entry
- `libs/bc/study/src/index.ts` (exports) — three PRs will each add BC exports
- `libs/constants/src/study.ts` — additive; small risk
- `libs/bc/study/src/knowledge.ts` — Study Plan PR adds mastery functions here; touched by 4c if it needs UI-side helpers

Resolve in the order Joshua tests + approves. Each successive rebase is trivial since all changes are additive or small.

## Next

**After Calibration Tracker lands + you manually test it**, queue up three parallel builds:

1. **Knowledge Graph UI + CLI** — spec at [docs/work-packages/knowledge-graph/spec.md](../work-packages/knowledge-graph/spec.md). `/ball-wp-build knowledge-graph` executes the task plan.
2. **Study Plan + Session Engine** — spec at [docs/work-packages/study-plan-and-session-engine/spec.md](../work-packages/study-plan-and-session-engine/spec.md). First task: implement `isNodeMastered` + `getNodeMastery` in `libs/bc/study/src/knowledge.ts` per the dual-gate definition in the KG spec. Then the engine + plan + session code.
3. **Learning Dashboard (v1)** — spec at [docs/work-packages/learning-dashboard/spec.md](../work-packages/learning-dashboard/spec.md). Panels 2-6 work with shipped data; panels 1, 7, 8, 9 ship as gated placeholders until their dependencies land.

**Outstanding user-zero tests:** [decision-reps/test-plan.md](../work-packages/decision-reps/test-plan.md) (17 scenarios). Should happen before its review-follow-up PR merges.

## Links

- [MULTI_PRODUCT_ARCHITECTURE.md](../platform/MULTI_PRODUCT_ARCHITECTURE.md) — surface-typed app architecture
- [PIVOT.md](../platform/PIVOT.md) — why airboss exists
- [DESIGN_PRINCIPLES.md](../platform/DESIGN_PRINCIPLES.md) — how we evaluate features
- [ADR 011](../decisions/011-knowledge-graph-learning-system/decision.md) — knowledge graph learning system
- [IDEAS.md](../platform/IDEAS.md) — idea intake (last review: 2026-04-07)
- [VOCABULARY.md](../platform/VOCABULARY.md) — naming standards
- [Product INDEX](../vision/INDEX.md) — all 53 product ideas
- [Learning INDEX](../vision/learning/INDEX.md) — the 14 aviation domains
- [Study app plan](plans/20260415-study-app-plan.md) — Phase 1-5 implementation plan (pre-ADR-011)

## Relationship to airboss-firc

FIRC-specific code, content, and work stays in [airboss-firc](/Users/joshua/src/_me/aviation/airboss-firc) until the FIRC migration step. That repo has the 4 SvelteKit apps (sim, hangar, ops, runway), the FAA compliance pipeline, the 503 questions, and ongoing FIRC-specific work. Nothing new should be built in airboss-firc going forward.
