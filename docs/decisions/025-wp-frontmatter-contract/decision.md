---
title: 'ADR 025: Work-package frontmatter contract'
date: 2026-05-06
status: accepted
participants: Joshua Ball, Claude
context: ./context.md
supersedes: null
---

# ADR 025: Work-package frontmatter contract

Every `docs/work-packages/<slug>/spec.md` carries a YAML frontmatter block whose schema is enforced by lint. The frontmatter is the source of truth for tracking; aggregator views (BOARD, SHIPPED, per-product roadmap, hangar `/roadmap`) are derived. Phase 1 of the [tracking-system-overhaul WP](../../work-packages/tracking-system-overhaul/spec.md) ships the contract, the lint, the loader, and the read-only CLI; Phase 2 backfills the 99 existing WPs.

## Decision

### Five categories, no more

`category` is a single closed-vocab enum. Five values, intentionally small:

| Category   | Covers                                                                        |
| ---------- | ----------------------------------------------------------------------------- |
| `product`  | A whole product or major surface (study, hangar, sim, flightbag, avionics).   |
| `feature`  | A feature inside a product (cert dashboard, lens picker, review queue).       |
| `content`  | Authored content corpora. Course material is `content` with `tags: [course]`. |
| `docs`     | Documentation, ADRs, agent skills, tracking infrastructure.                   |
| `platform` | Build, monorepo, dev infra, scheduled jobs, cross-cutting tooling.            |

Course content uses `category: content` plus `tags: [course]`. There is no `course` category; the tag carries the cross-cut. Cross-cutting slices like "all references work" are surfaced via `tags`, never via a category proliferation.

### No `tier` field

Earlier drafts proposed `tier: foundation | feature | polish | bug | infra | docs`. Dropped: `category` already partitions the corpus, and tier was redundant with `status`. Bugs do not live in `docs/work-packages/`; they live in `docs/bugs/` (Phase 6) with their own frontmatter that carries a `severity: blocking | major | minor | nit` field.

### Schema

```yaml
---
id: <slug>                            # required, matches dir name (kebab-case)
title: <human title>                  # required
product: study | hangar | sim | flightbag | avionics | platform | course | none
                                      # required
category: product | feature | content | docs | platform
                                      # required, single value (NOT an array)
status: draft | signed-off | in-flight | shipped | abandoned | superseded
                                      # required
agent_review_status: pending | done   # required, agent-controlled
human_review_status: pending | walked | signed-off
                                      # required, USER ONLY (lint enforced)
created: 2026-05-04                   # required, YYYY-MM-DD
shipped_date: 2026-05-08              # optional, MUST be set when status=shipped
shipped_prs: [617, 622]               # optional, default []
depends_on: [wp-sub, wp-cfr]          # optional, default []
unblocks: [wp-hangar-refs]            # optional, default []
owner: agent | user                   # optional
tags: [extraction, citations]         # optional, free-form, default []
---
```

| Field                 | Required | Owner  | Notes                                                         |
| --------------------- | -------- | ------ | ------------------------------------------------------------- |
| `id`                  | yes      | author | Must match parent dir name. Lint compares.                    |
| `title`               | yes      | author | Human-readable.                                               |
| `product`             | yes      | author | One of the surface apps, `platform`, `course`, or `none`.     |
| `category`            | yes      | author | Single value from the closed vocab above.                     |
| `status`              | yes      | author | Lifecycle. Lint enforces transitions.                         |
| `agent_review_status` | yes      | agent  | Flips to `done` after a clean self-review pass.               |
| `human_review_status` | yes      | user   | **Lint rejects any agent commit that changes this field.**    |
| `created`             | yes      | author | ISO date (YYYY-MM-DD).                                        |
| `shipped_date`        | no       | author | Required when status=shipped.                                 |
| `shipped_prs`         | no       | agent  | PR numbers that closed the WP.                                |
| `depends_on`          | no       | author | Other WP ids that must ship first.                            |
| `unblocks`            | no       | author | Other WP ids this one unblocks (informational, not enforced). |
| `owner`               | no       | author | Who drives the next step.                                     |
| `tags`                | no       | author | Free-form. Use for cross-cutting slices like `references`.    |

### Two review-status fields, two owners

This is the load-bearing fix for the "agents flip review_status on their own work" pathology:

- `agent_review_status: pending | done` -- agent-controlled. Flips to `done` after the agent self-review pass (e.g. `/ball-review-full` returns clean, lint passes, tests green).
- `human_review_status: pending | walked | signed-off` -- **user-controlled, agents may not write this field.** Lint rule rejects any agent commit that changes this value. States:
  - `pending` (default, all WPs start here)
  - `walked` (user has actually walked the test-plan.md)
  - `signed-off` (user has walked it AND is satisfied; closes the WP)

Agent detection is by `git config user.email`: any value not equal to `joshua.g.s.ball@gmail.com` is treated as an agent. The constant lives at `WP_HUMAN_REVIEWER_EMAIL` in `libs/constants/src/work-package.ts`.

### Status transition rule

`status: shipped` REQUIRES `human_review_status: signed-off` AND `shipped_date` set. The schema rejects the transition otherwise. There is no override.

### Lint enforcement

`scripts/lint/wp-frontmatter.ts`, run by `bun run check`. Two responsibilities:

1. Validate every spec.md against the Zod schema in `libs/types/src/work-package.ts`. Per-field error reporting.
2. Detect agent writes to `human_review_status` by comparing the staged diff against HEAD; any change to that field by a non-user committer is rejected with a clear error.

### Migration note

The pre-ADR field `review_status` is replaced by `agent_review_status` + `human_review_status`. Phase 2 of the tracking-system-overhaul WP backfills all 99 existing WPs unconditionally with `human_review_status: pending`, regardless of any prior `review_status: done`. The user has not actually walked any test plan; the prior values are wrong.

Until Phase 2 lands, the lint applies a Phase 1 grace rule: a WP whose frontmatter carries none of the ADR-025-specific fields (`agent_review_status`, `human_review_status`, `category`) is treated as "legacy unmigrated" and reported as a count rather than a per-failure error. (`created` was already a common field on pre-ADR WPs, so it does not signal migration on its own.) Phase 1 surfaces the legacy count so the backfill scope is visible; `bun run check` does not block on it.

Any WP that adopts even one of the new fields opts into full schema validation. Partial migrations cannot regress silently. Phase 2 finishes when the legacy count reaches zero; at that point the grace rule is removed in a follow-up PR.

## Consequences

- **Single source of truth.** WP frontmatter is canonical; NOW.md, ROADMAP.md, BOARD.md, SHIPPED.md become derived views (Phase 4).
- **Agents cannot lie about user review.** The lint enforces the ownership boundary.
- **The CLI (`bun run wp`) is the canonical query surface.** Agents stop grepping frontmatter; they run `bun run wp list --category content --status '!shipped'`. Mutations come in Phase 3.
- **Cross-cutting slices live in `tags`, not category proliferation.** "References work" is `--tag references`, not a category.

## Links

- [tracking-system-overhaul WP](../../work-packages/tracking-system-overhaul/spec.md) -- the parent plan
- `libs/constants/src/work-package.ts` -- vocabulary constants
- `libs/types/src/work-package.ts` -- Zod schema + `WorkPackage` type
- `scripts/lib/wp-loader.ts` -- read-only loader
- `scripts/lint/wp-frontmatter.ts` -- lint, wired into `bun run check`
- `scripts/wp.ts` -- read-only CLI (`bun run wp`)
