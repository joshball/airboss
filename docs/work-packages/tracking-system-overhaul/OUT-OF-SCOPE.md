---
title: 'Out of Scope: Tracking system overhaul'
product: platform
feature: tracking-system-overhaul
type: out-of-scope
status: unread
---

# Out of Scope: Tracking system overhaul

Deferred items, why they're deferred, and the trigger that should make
us revisit each. Future agents and humans: do not build these without
the documented trigger. If you think the trigger is hit, surface it
for a decision rather than building silently.

## Summary

| Item                                      | Status       | Trigger to revisit                                                          |
| ----------------------------------------- | ------------ | --------------------------------------------------------------------------- |
| Replacing IDEAS.md                        | Rejected     | Never -- IDEAS.md is the correct shape for unevaluated ideas                |
| Replacing session todos                   | Rejected     | Never -- `docs/work/todos/` is the correct shape for ephemeral session work |
| Migrate to external tracker               | Rejected     | Never -- frontmatter + git remain canonical                                 |
| Database-backed task system               | Rejected     | Never -- frontmatter + git remain canonical                                 |
| Renaming `hangar-review-queue`            | Rejected     | Never -- it stays in flight; this WP feeds it richer data                   |
| `wp-hangar-roadmap-view` (in-app surface) | Follow-on WP | Phase 7 of this WP hands off to it; build it as a separate WP               |
| `wp-frontmatter-migration-tool`           | Deferred     | If Phase 2 backfill stalls past wave 3                                      |
| WP dependency graph visualizer            | Deferred     | When someone asks for it after the board ships                              |

## Replacing IDEAS.md

Status: Rejected

What was rejected:
Folding `docs/platform/IDEAS.md` into the frontmatter-driven tracking system.

Why:
IDEAS.md is the correct shape for unevaluated ideas: free-form intake, no commitment, periodic batch review every 2 weeks. The tracking system handles evaluated, committed work (WPs, bugs, shipped PRs). Stacking ideas into the same system would force premature classification and inflate the schema.

References:

- [spec.md](./spec.md) -- "Out of scope" listed IDEAS.md replacement
- [docs/platform/IDEAS.md](../../platform/IDEAS.md) -- the idea intake funnel

## Replacing session todos

Status: Rejected

What was rejected:
Replacing `docs/work/todos/YYYYMMDD-NN-TODO.md` files with a frontmatter-tracked equivalent.

Why:
Session todos are ephemeral and scoped to one session. They are the correct shape for "what I'm doing right now," whereas WPs are the correct shape for "what needs building." Two different lifecycles, two different ownership models.

References:

- [spec.md](./spec.md) -- "Out of scope" listed session todos replacement
- airboss/CLAUDE.md -- three-level tracking table (session todos / product tasks / feature tasks)

## Migrate to external tracker (GitHub Issues, Linear, etc.)

Status: Rejected

What was rejected:
Migrating WP tracking to GitHub Issues, Linear, Jira, or any external tracker.

Why:
Frontmatter on disk plus git history is the canonical store. External trackers fragment the source of truth, require sync infrastructure, and break the "agents read the same data the hangar reads" principle. The hangar is the in-app view; an external tracker would compete with the hangar for ownership of WP state.

References:

- [spec.md](./spec.md) -- "Out of scope" forbade external trackers
- [spec.md](./spec.md) Principle 5 ("The hangar reads the same data the static generator emits")

## Database-backed task system

Status: Rejected

What was rejected:
A DB-backed task system where WP state lives in a Postgres table rather than in frontmatter.

Why:
Frontmatter + git are canonical for the same reasons external trackers are out: one home per concept, no sync drift, version-controlled history of every status flip, agents and the hangar read the same loader. Moving to a DB would create a second source of truth.

References:

- [spec.md](./spec.md) -- "Out of scope" stated frontmatter + git remain canonical
- [spec.md](./spec.md) Principle 5 ("No second source of truth in the database. Frontmatter on disk is canonical")

## Renaming `hangar-review-queue`

Status: Rejected

What was rejected:
Renaming or re-scoping the in-flight `hangar-review-queue` WP as part of this overhaul.

Why:
`hangar-review-queue` is in flight and stays in flight. This WP feeds it richer data (WP frontmatter, bugs, shipped PRs) but does not change its identity or scope. Touching its name would create coordination churn for no value.

References:

- [spec.md](./spec.md) -- "Out of scope" explicitly preserved `hangar-review-queue` in flight

## `wp-hangar-roadmap-view` (in-app surface)

Status: Follow-on WP

What was deferred:
The in-app hangar surface that renders WP boards, detail pages, bug boards, and the shipped log. Routes `/roadmap`, `/roadmap/[wp_id]`, `/bugs`, `/log`.

Why:
Phase 7 of this WP is the hand-off boundary. The data layer (frontmatter contract, loader, CLI, generated views) ships here; the in-app rendering surface is a separate user-facing effort with its own UX surface area.

Trigger to revisit:
Phase 7 of this WP. Once the data layer is live and Phase 2 backfill is complete, spawn `wp-hangar-roadmap-view` as a separate WP.

Implementation pattern when triggered:
Mirror the data-loading patterns in [libs/utils/src/wp-loader.ts](../../../libs/utils/src/wp-loader.ts) (ships in Phase 1 of this WP). Reuse the bucket primitive from `hangar-review-queue`. Phase 1 of the follow-on WP is read-only; Phase 2 introduces writeback via the TOML-mirror pattern in [libs/hangar-sync/](../../../libs/hangar-sync/).

References:

- [spec.md](./spec.md) -- "Out of scope (named follow-ons)" introduced `wp-hangar-roadmap-view`
- [spec.md](./spec.md) §8 "Hangar live view" -- the surface description

## `wp-frontmatter-migration-tool`

Status: Deferred

What was deferred:
A formalized migration tool that backfills WP frontmatter at scale, rather than relying on ad-hoc agent passes.

Why:
Phase 2 of this WP is the backfill effort. The expectation is that agent batches in waves of 10-20 can complete the backfill against 99 existing WPs. Building a migration tool speculatively (when ad-hoc passes might do) would over-invest before the actual bottleneck is identified.

Trigger to revisit:
If Phase 2 stalls past wave 3 (i.e. ad-hoc backfill is too slow, too inconsistent, or too error-prone), formalize the migration tool.

Implementation pattern when triggered:
A TS script under `scripts/tracking/` that reads each `docs/work-packages/<slug>/spec.md`, infers fields from spec body content, and writes back complete frontmatter. Mirror the lint rule semantics in [scripts/lint/wp-frontmatter.ts](../../../scripts/lint/wp-frontmatter.ts) for shape validation.

References:

- [spec.md](./spec.md) -- "Out of scope (named follow-ons)" introduced the migration tool option
- [spec.md](./spec.md) Phase 2 -- the backfill that triggers it

## WP dependency graph visualizer

Status: Deferred

What was deferred:
A dependency-graph visualizer that reads `depends_on` / `unblocks` fields and renders an interactive DAG.

Why:
The CLI already exposes `bun run wp graph <wp-id>` for ASCII trees and `bun run wp blocked` for downstream queries. A visual DAG is nice-to-have but only earns its keep if someone is asking for it after the board ships. Building it speculatively would be premature visualization investment.

Trigger to revisit:
When someone asks for it after Phase 4 ships the BOARD.md generator and the patterns of cross-WP dependency become real working data.

Implementation pattern when triggered:
Read `depends_on` / `unblocks` from `WorkPackage[]` (via [libs/utils/src/wp-loader.ts](../../../libs/utils/src/wp-loader.ts)), feed into a graph layout library (mermaid, d3-dag, or similar), render either as a markdown-embeddable diagram or an in-app hangar page (companion to `wp-hangar-roadmap-view`).

References:

- [spec.md](./spec.md) -- "Out of scope (named follow-ons)" introduced the visualizer
- [spec.md](./spec.md) §4 CLI -- `bun run wp graph` is the ASCII fallback
