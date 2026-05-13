# Now

Single entry point for "what should I work on?" in airboss.

## What I'm focused on right now

(Human-curated; the only hand-edited part of this file.)

Recently shipped:

- `command-palette` -- Phases 3 -> 3.5a/3.5b/3.5c -> 4 shipped (PRs #857, #930, #933, #936, #940). Cmd+Shift+P live with intent classifier, composite ranker, per-intent panels, phrase-FTS passage search, and per-app command registries. Walkthrough owed.
- `course-tree-arbitrary-depth` -- Phases A/B/C/D/E shipped (PRs #934, #935, #938, #943, #944). N-deep schema + recursive validators + lens helper + renderer prev/next nav + aggregate cert overlay with leaf-only study-plan selection. Walkthrough owed.
- `wx-charts` -- ADR 027 layout migration complete (PRs #915, #922, #923, #927), CONUS hunchback root-caused (PRs #924, #926), `/api/charts` route serving SVGs (#928), `:::chart` and `:::scenario` markdown directives wired (#932). Browser-hydration leaks in `@ab/sources` runtime barrel closed (PRs #921, #925).
- `wx-engine` -- shipped end-to-end (six production scenarios, CLI, `:::scenario` contract). Walkthrough owed; run `/ball-review-full` over libs/wx-engine + scripts/wx-scenario + data/wx-scenarios per tasks.md "Final close", fix findings, then flip status.

In flight:

- `course-reader-and-editor` WP authored (PRs #760, #761) -- dual UI on top of course-primitive: study reader + hangar editor + Courses tab on `/program/goals/[id]`. Spec status `draft` pending walkthrough; `/ball-wp-build` dispatches once human review signs off.
- `hangar-review-queue-cluster-fix` -- 24 e2e failures triaged. Test suite green-up landed (#939, 558 -> 0 failures) and validator green-up landed (#941, TBD wiki-link + 5 orphan help pages). Underlying hydration leak / `hangar.docs_search_index` Postgres crash still need one focused investigation.

Walkthroughs owed: cert-dashboard (#321), lens-ui (#323), goal-composer (#324), wx-engine, command-palette, course-tree-arbitrary-depth.

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
