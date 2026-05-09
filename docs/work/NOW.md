# Now

Single entry point for "what should I work on?" in airboss.

## What I'm focused on right now

(Human-curated; the only hand-edited part of this file.)

- Closing out `tracking-system-overhaul` -- Phase 5 (NOW.md trim + log backfill) and Phase 7 (doc home consolidation) are the active fronts.
- After Phase 5 + 7 land, the `wp-hangar-roadmap-view` WP can pick up the in-app surface evolution.
- Manual test passes on the cert-syllabus surfaces (#321 / #323 / #324) still owed.
- `course-primitive` WP shipped (PRs #713, #721, #728, #730, #732, #734, #736, #737; doc fixes #731, #739). Course is a peer primitive to Syllabus; weather-course content authoring unblocked.

## Live views

- [Work package board](./BOARD.md) -- every WP grouped by status (generated)
- [Shipped log](./SHIPPED.md) -- per-PR + per-WP reverse-chrono (generated, last 90 days)
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
