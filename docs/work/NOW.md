# Now

Single entry point for "what should I work on?" in airboss.

## Current State

**Repo scaffolding:** complete. Monorepo with `apps/study/`, `libs/` (auth, bc/study, constants, db, themes, types, ui, utils). Bun workspaces, `@ab/*` path aliases.

**Migration from airboss-firc:** complete. Platform docs, vision, decisions, agent patterns, business docs, and course material all copied over.

**Work packages written:** 6 PRDs + 3 specs in `docs/work-packages/`:

- `spaced-memory-items/` -- spec, tasks, test-plan, design, user-stories, PRD
- `decision-reps/` -- spec, tasks, test-plan, design, PRD
- `calibration-tracker/` -- spec, tasks, test-plan, PRD
- `knowledge-graph/` -- PRD only (specs deferred until after tool MVPs)
- `study-plan-and-session-engine/` -- PRD only (specs deferred)
- `learning-dashboard/` -- PRD only (specs deferred)

## Build Order

Per [MULTI_PRODUCT_ARCHITECTURE.md](../platform/MULTI_PRODUCT_ARCHITECTURE.md) and [ADR 011](../decisions/011-knowledge-graph-learning-system/decision.md):

| Step | Work | Status |
| ---- | ---- | ------ |
| 1 | Spaced Memory Items MVP | Next -- has spec, tasks, test-plan |
| 2 | Decision Reps MVP | After step 1 -- has spec, tasks, test-plan |
| 3 | Calibration Tracker MVP | After step 2 -- has spec, tasks, test-plan |
| 4 | Knowledge Graph skeleton (30 nodes) | After tool MVP proven |
| 5 | Study Plan + Session Engine | After graph |
| 6 | Learning Dashboard | After graph |
| 7 | Scale graph to ~500 nodes | Gradual |
| -- | FIRC migration as `apps/firc/` | After study MVP -- separate track |

## Next

**Start with Spaced Memory Items.** Read the PRD first (product context), then the spec (implementation contract), then tasks (concrete plan).

- [PRD](../work-packages/spaced-memory-items/PRD.md) -- what this product is and why
- [spec](../work-packages/spaced-memory-items/spec.md) -- data model, behavior, validation
- [design](../work-packages/spaced-memory-items/design.md) -- FSRS rationale, Drizzle schema, API surface
- [tasks](../work-packages/spaced-memory-items/tasks.md) -- ordered implementation plan
- [test-plan](../work-packages/spaced-memory-items/test-plan.md) -- 17 manual test scenarios

When ready to build: `/ball-wp-build spaced-memory-items` runs the phased implementation skill.

## Links

- [MULTI_PRODUCT_ARCHITECTURE.md](../platform/MULTI_PRODUCT_ARCHITECTURE.md) -- surface-typed app architecture
- [PIVOT.md](../platform/PIVOT.md) -- why airboss exists
- [DESIGN_PRINCIPLES.md](../platform/DESIGN_PRINCIPLES.md) -- how we evaluate features
- [IDEAS.md](../platform/IDEAS.md) -- idea intake (last review: 2026-04-07)
- [VOCABULARY.md](../platform/VOCABULARY.md) -- naming standards
- [Product INDEX](../vision/INDEX.md) -- all 53 product ideas
- [Learning INDEX](../vision/learning/INDEX.md) -- the 14 aviation domains
- [Study app plan](plans/20260415-study-app-plan.md) -- Phase 1-5 implementation plan (pre-ADR-011)

## Relationship to airboss-firc

FIRC-specific code, content, and work stays in [airboss-firc](/Users/joshua/src/_me/aviation/airboss-firc) until the FIRC migration step. That repo has the 4 SvelteKit apps (sim, hangar, ops, runway), the FAA compliance pipeline, the 503 questions, and ongoing FIRC-specific work. Nothing new should be built in airboss-firc going forward.
