---
id: tracking-system-overhaul
title: Tracking system overhaul
product: platform
category: docs
status: signed-off
agent_review_status: pending
human_review_status: pending
created: 2026-05-04
owner: agent
depends_on: []
unblocks: [hangar-roadmap-view, hangar-review-queue]
tags: [tracking, agent-workflow]
---

# Tracking system overhaul

Replace the current ad-hoc mix of NOW.md, per-product ROADMAP.md, agent handoffs, and 99 unstructured work packages with a single frontmatter-driven system. The hangar surfaces the live state. Agents maintain frontmatter; aggregator views are derived, never hand-edited.

## Problem

Current state, observed 2026-05-04:

- **NOW.md is a 319-line god-doc** mixing "just shipped" history, in-flight work, follow-ons, build order, deferred items, and a links section. Append-only. Drifts from reality the moment an agent forgets to update it.
- **99 work packages in one flat directory.** No grouping by product, no grouping by thematic category, no completion view, no dependency graph. Frontmatter exists (`status`, `review_status`) but is inconsistent across packages and agents do not always update it.
- **No way to slice work by theme.** "Get all references work done" cuts across study, hangar, flightbag, platform, and course. The current frontmatter only has `product`, so the cross-cutting slice is invisible. Same problem for "all auth work", "all ingestion work", etc.
- **`review_status` has the wrong owner.** Agents flip it on their own work. The user has never actually walked any WP test plan, so every `review_status: done` field on disk is a lie.
- **Per-product ROADMAP.md is human-shaped prose.** No agent can read it as state. It drifts from the WP frontmatter.
- **Bugs have no home.** Real bugs surfaced in agent handoffs (AC URL drift, ACS slug mismatch, flightbag SSR crash, worker test flake) sit in `docs/work/handoffs/` markdown and are never tracked.
- **Shipped work has no log.** "Just shipped" sections in NOW.md are the only record beyond `git log`. Cross-referencing a WP to its shipping PRs requires reading prose.
- **Doc directories overlap and duplicate.** `docs/loose-ends/` vs `docs/work/`, `docs/walkthroughs/` vs `docs/work/walkthroughs/`, `docs/features/` vs `docs/work-packages/`.
- **No archive discipline.** `docs/work/handoffs/` accumulates session-scoped notes indefinitely. Old reviews and walkthroughs sit alongside live ones.
- **Agent handoffs become dumping grounds.** When sessions end, agents write narrative paragraphs about bugs, deferred decisions, and "worth knowing" items. Nothing structured, nothing actionable.

## Principles

1. **Frontmatter is the source of truth.** Prose can drift; frontmatter is lint-checked.
2. **Aggregator views are generated, not authored.** Roadmaps, boards, shipped logs all derive from frontmatter. Agents are forbidden from hand-editing them.
3. **One home per concept.** A WP lives in one place. A bug lives in one place. A shipped PR lives in one place.
4. **Agents maintain the frontmatter as part of the work.** Like updating tests, like updating CLAUDE.md. Failure to update is a lint failure.
5. **The hangar reads the same data the static generator emits.** No second source of truth in the database. Frontmatter on disk is canonical; the hangar is a view.
6. **Old docs archive, never delete.** Existing project rule. This WP enforces it.

## Out of scope

- Replacing IDEAS.md (correct shape for unevaluated ideas).
- Replacing session todos in `docs/work/todos/` (correct shape for ephemeral session work).
- Migrating to GitHub Issues, Linear, or any external tracker.
- A database-backed task system. Frontmatter + git remain canonical.
- Renaming `hangar-review-queue` (stays in flight; this WP feeds it richer data).

## Solution shape

### 1. WP frontmatter contract (ADR 025)

Every `docs/work-packages/<slug>/spec.md` carries a required frontmatter block:

```yaml
---
id: <slug>                           # matches dir name
title: <human title>
product: study | hangar | sim | flightbag | avionics | platform | course
category: [references, ingestion]    # one or more thematic tags (closed vocab)
tier: foundation | feature | polish | bug | infra | docs
status: draft | signed-off | in-flight | shipped | abandoned | superseded
agent_review_status: pending | done   # agent flips after self-review
human_review_status: pending | walked | signed-off  # USER ONLY; agents fail lint if they touch it
created: 2026-05-04
shipped_date: 2026-05-08              # nullable until shipped
shipped_prs: [617, 622]               # PRs that closed the WP
depends_on: [wp-sub, wp-cfr]          # other WP ids
unblocks: [wp-hangar-refs]            # other WP ids
owner: agent | user                   # who drives the next step
tags: [extraction, citations]         # free-form, optional
---
```

The contract is enforced by `scripts/lint/wp-frontmatter.ts`, run as part of `bun run check`. Schema lives in `libs/types/src/work-package.ts` (shared with the hangar reader and CLI).

#### Category vocabulary (closed)

The `category` field is a closed vocab, validated by lint. Initial set (extensible by ADR amendment):

| Category          | Covers                                                                |
| ----------------- | --------------------------------------------------------------------- |
| `references`      | Reference corpus end-to-end: handbook, AC, ACS, CFR, AIM, NTSB, etc.  |
| `ingestion`       | Source extraction pipelines (PDF, HTML, XML), warnings, normalization |
| `citations`       | Cross-linking, citation chips, deep-linking between corpora           |
| `flightbag`       | Reading surface, deep-link contracts, reader UX                       |
| `learning-engine` | Spaced rep, scenarios, scoring, calibration, evidence kinds           |
| `cert-syllabus`   | Cert dashboard, ACS triad, syllabus/goal/lens model                   |
| `auth`            | Identity, sessions, entitlements, cross-app SSO                       |
| `hangar-admin`    | Admin surfaces: users, audit, review queue, jobs, ingest UI           |
| `ui-primitives`   | Shared `libs/ui` components, theme tokens, design system              |
| `platform`        | Build, monorepo, dev infra, scheduled jobs                            |
| `tracking`        | Doc systems, work packages, roadmap, this WP                          |
| `agent-workflow`  | Agent skills, prompts, conventions                                    |
| `course-content`  | Aviation course material, FAR navigation, FIRC                        |

A WP can have multiple categories. The "references end-to-end" slice = `category: references` filter, which surfaces ingestion, citations, flightbag, and hangar-admin work that touches references.

#### Two review-status fields, two owners

This is the load-bearing fix for the "agents flip review_status on their own work" pathology:

- `agent_review_status` - agent-controlled. Flips to `done` after the agent self-review pass (e.g. `/ball-review-full` returns clean, lint passes, tests green).
- `human_review_status` - **user-controlled, agents may not write this field**. Lint rule rejects any agent commit that changes this value. Three states:
  - `pending` (default, all WPs start here)
  - `walked` (user has actually walked the test-plan.md)
  - `signed-off` (user has walked it AND is satisfied; closes the WP)

A WP cannot reach `status: shipped` semantically until both review fields are `done` / `signed-off`. This contract was already documented in CLAUDE.md but not enforced; lint enforces it now.

**Phase 2 reset:** every existing WP gets `human_review_status: pending` unconditionally during backfill, regardless of any prior `review_status: done` value. The user has not actually walked any test plan; the prior values are wrong.

### 2. Bug tracker

New: `docs/bugs/`. One file per bug. Frontmatter:

```yaml
---
id: bug-ac-url-helper-drift
title: AC URL helper produces stray dot in path
product: study
severity: blocking | major | minor | nit
status: open | wontfix | duplicate | fixed
discovered_pr: 636
discovered_date: 2026-05-04
fix_pr: null                          # nullable until fixed
fix_wp: null                          # nullable; set if promoted to a WP
repro: |
  urlForReference('airboss-ref:ac/91-21-1/d/section-1') -> /ac/91-21.1/d/1
---
```

Bugs are lighter than WPs. Promote to a WP only when the fix needs design.

### 3. Shipped PR log

New: `docs/log/`. One file per merged PR: `docs/log/2026-05-04-PR-639-clear-svelte-a11y.md`. Frontmatter:

```yaml
---
pr: 639
date: 2026-05-04
title: clear svelte a11y + biome formatter regressions
wp_id: null                           # nullable; set if PR closes a WP phase
bugs_fixed: []                        # bug ids
summary: |
  One-paragraph human summary.
---
```

Auto-emitted by a post-merge hook (or `bun scripts/log-pr.ts <number>`). Backfilled from `gh pr list` for historical PRs.

### 4. Query surface: CLI, app, agents (one data source)

Three callers, one loader. `libs/utils/src/wp-loader.ts` reads all `docs/work-packages/*/spec.md` files, parses frontmatter against the schema in `libs/types/src/work-package.ts`, returns typed `WorkPackage[]`. Filters compose.

#### CLI: `bun run wp <subcommand>`

The load-bearing surface. If this is good, agents will use it instead of grep, and the hangar view becomes obvious.

```bash
# List with filters (all flags compose)
bun run wp list                                       # everything
bun run wp list --product hangar                      # one app
bun run wp list --category references                 # one theme
bun run wp list --category references,ingestion       # multiple themes (OR)
bun run wp list --status in-flight                    # one status
bun run wp list --status '!shipped'                   # negation
bun run wp list --tier bug                            # only bugs (or use docs/bugs/)
bun run wp list --human-review pending                # what needs walking
bun run wp list --depends-on wp-sub                   # downstream of a WP

# Output formats
bun run wp list --json                                # pipe to jq
bun run wp list --md                                  # embeddable markdown
bun run wp list                                       # human table (default)

# Detail
bun run wp show <wp-id>                               # render full WP (spec + tasks + test-plan + linked PRs + bugs)
bun run wp show <wp-id> --section tasks               # one sub-doc only

# Heuristics
bun run wp next                                       # what should I work on (signed-off + unblocked + no deps pending)
bun run wp blocked                                    # WPs whose depends_on isn't shipped
bun run wp orphans                                    # WPs nothing depends on (terminal nodes)
bun run wp graph <wp-id>                              # ASCII dep tree

# Mutations (lint-checked, agents allowed except human_review_status)
bun run wp set <wp-id> status in-flight
bun run wp set <wp-id> shipped_prs '[617, 622]'
bun run wp set <wp-id> human-review walked            # FAILS for agents; user-only
```

The "references end-to-end punch list" becomes one command:

```bash
bun run wp list --category references --status '!shipped' --md
```

#### Hangar app: `/roadmap`

Same filters as the CLI, URL-shareable: `/roadmap?category=references&status=in-flight`. Server-load reads via the same `wp-loader.ts`. Detail page at `/roadmap/[wp_id]` renders spec + tasks + test-plan + linked PRs (via `shipped_prs`) + bugs (via reverse lookup on `fix_wp`).

This is built by the separate `wp-hangar-roadmap-view` WP (Phase 7 hand-off). The data layer ships in this WP.

#### Agents

Add to `docs/agents/best-practices.md`:

> When asked about WP state, dependencies, or "what should I work on", run `bun run wp list` with appropriate filters (or `bun run wp next` / `bun run wp blocked`). Do NOT grep frontmatter manually; the CLI handles schema validation, dependency resolution, and human-review gates correctly.

The CLI's `--json` output is the agent-friendly form. Agents that read multiple WPs should pipe through jq, not Read 99 files.

### 5. Generated aggregator views

`scripts/tracking/generate.ts` reads frontmatter and emits:

- `docs/products/{app}/ROADMAP.md` - WPs grouped by status, filtered by `product`. Replaces the hand-authored ROADMAP.md.
- `docs/work/BOARD.md` - global WP board across all products.
- `docs/work/SHIPPED.md` - reverse-chrono PR log, last 90 days.
- `docs/bugs/INDEX.md` - open bugs grouped by product and severity.

All four files carry a `# DO NOT EDIT - generated` header. Hand-edits fail lint.

### 6. NOW.md becomes a thin index

NOW.md collapses from 319 lines to ~50:

```markdown
# Now

Single entry point for "what should I work on?"

## What I'm focused on right now

(human-curated, 5-10 lines, the only hand-edited part of this file)

## Live views

- [WP board](./BOARD.md) - all work packages by status
- [Shipped log](./SHIPPED.md) - recent PRs (last 90 days)
- [Bugs](../bugs/INDEX.md) - open bugs by product
- [Per-product roadmaps](../products/) - study, hangar, sim, flightbag, avionics

## Open ideas

[IDEAS.md](../platform/IDEAS.md) - last review: <auto-filled>

## Active session

[Today's todo](./todos/) - per-session work
```

Historical "just shipped" content gets backfilled into `docs/log/` entries (one per PR).

### 7. Doc home consolidation

Merge or archive overlapping directories:

| Current                  | Target                              | Reason                                                 |
| ------------------------ | ----------------------------------- | ------------------------------------------------------ |
| `docs/loose-ends/`       | `.archive/loose-ends/`              | Snapshot of one moment in time; superseded by BOARD.md |
| `docs/walkthroughs/`     | `docs/work/walkthroughs/`           | Already a subdir there; consolidate                    |
| `docs/features/`         | `docs/work-packages/`               | Same shape, different name; merge                      |
| `docs/work/build-reports`| `.archive/build-reports/` (rolling) | Auto-archive > 60 days                                 |
| `docs/work/handoffs/`    | `.archive/handoffs/` (rolling)      | Auto-archive > 60 days                                 |
| `docs/work/reviews/`     | `.archive/reviews/` (rolling)       | Auto-archive > 60 days                                 |

`scripts/tracking/archive.ts` runs the rolling archive. Scheduled job, or manual.

### 8. Hangar live view

New WP, depends on this one: `wp-hangar-roadmap-view`. Routes:

- `/roadmap` - WP board, filterable by product / status / tier.
- `/roadmap/[wp_id]` - WP detail page. Renders spec.md + tasks.md + test-plan.md + linked PRs + bugs.
- `/bugs` - bug board.
- `/log` - shipped log.

Phase 1: read-only. Server-loads frontmatter from disk on each request, caches by manifest_sha.

Phase 2: writeback. Flip `status: in-flight -> shipped` from the UI. Hangar writes frontmatter back to disk via the TOML-mirror pattern from `libs/hangar-sync/`.

Phase 3: cross-link to `docs/log/` and `docs/bugs/`.

This is `hangar-review-queue` shaped, but for WPs, bugs, and PRs instead of just review buckets. They share the bucket primitive.

## Phases

| Phase | Scope                                                                                         | Gate                                                       |
| ----- | --------------------------------------------------------------------------------------------- | ---------------------------------------------------------- |
| 1     | ADR 025 frontmatter contract + lint rule + WP loader (`libs/utils/src/wp-loader.ts`)          | User ratifies ADR                                          |
| 2     | Backfill frontmatter on 99 existing WPs (agent batch, in waves). Reset `human_review_status: pending` on every WP without exception. Categorize each WP. | All WPs pass lint; user ratifies each wave |
| 3     | `bun run wp` CLI dispatcher (`list`, `show`, `next`, `blocked`, `set`)                        | CLI installed; doc page in `docs/agents/best-practices.md` |
| 4     | Generator script + first generated views (per-product ROADMAP, BOARD, SHIPPED)                | Generated files match prior hand-authored intent           |
| 5     | Trim NOW.md + backfill `docs/log/` from `gh pr list`                                          | NOW.md < 60 lines; log has entries for last 90 days of PRs |
| 6     | Bug tracker bootstrap + seed from agent handoff backlog                                       | All bugs from 20260504 aggregate filed in `docs/bugs/`     |
| 7     | Doc home consolidation + rolling archive script                                               | No overlap dirs; archive script in scheduled jobs          |
| 8     | Hand off to `wp-hangar-roadmap-view` (separate WP)                                            | This WP closes; hangar view becomes its own work           |

Each phase is one PR. Phase 1 must land before any other; phases 2-7 can run in parallel after that. Phase 3 (CLI) is gated only on Phase 1, not Phase 2 - the CLI works against partial frontmatter and helps drive the Phase 2 backfill.

## Anchors back to user pain

- "I have 89 work packages and have reviewed none" -> Phase 2 resets every `human_review_status` to `pending`; lint forbids agents from flipping it; Phase 4 BOARD surfaces "what needs walking" at a glance; Phase 8 makes it interactive in the hangar. Pairs with `hangar-review-queue` already in flight.
- "Get all references work done" -> Phase 1 adds `category` field; Phase 3 CLI exposes `bun run wp list --category references --status '!shipped'` as the single command that shows the cross-cutting punch list.
- "How do I find work by category from CLI / app / agents" -> Phase 3 CLI is the canonical surface; Phase 8 hangar reads the same loader; agent best-practices doc points at the CLI.
- "NOW.md is lying" -> Phase 5 makes NOW.md derived; it can't lie about anything except the human-curated "what I'm focused on" block.
- "Bugs disappear into agent handoffs" -> Phase 6 gives them a home with frontmatter.
- "I can't find what shipped last week" -> Phase 4 SHIPPED.md is auto-generated and reverse-chrono.
- "Per-product roadmaps drift" -> Phase 4 generates them from WP frontmatter.

## Risks

- **Frontmatter rot.** If agents skip the lint, the system rots in a month. Mitigation: lint runs in `bun run check`, fail-loud, no skip-allowed.
- **Backfill is a slog.** 99 WPs is a lot. Mitigation: agent batch job in waves of 10-20; user ratifies each wave; non-shipped WPs can ship `status: draft` without all fields populated.
- **Generator output churn.** Generated files commit to git, so each generator run produces a diff. Mitigation: stable sort + idempotent output; generator runs as a pre-commit step or scheduled job, not on every save.
- **Hangar live view scope creep.** Phase 7 is its own WP; explicitly out of scope here.

## Out of scope (named follow-ons)

- **wp-hangar-roadmap-view** - the in-app surface. Spawned by Phase 7.
- **wp-frontmatter-migration-tool** - if the backfill in Phase 2 needs more than ad-hoc agent passes, formalize a migration tool. Trigger: Phase 2 stalls past wave 3.
- **WP dependency graph visualizer** - read `depends_on` / `unblocks` and render a DAG. Trigger: someone asks for it after the board ships.

## Disposition of the 20260504 multi-agent aggregate

The handoff at `docs/work/handoffs/20260504-multi-agent-cleanup-aggregate.md` is the seed corpus for several phases of this WP. It is not the deliverable; it is the input.

Mapping:

| Aggregate section                            | Lands in                                                      |
| -------------------------------------------- | ------------------------------------------------------------- |
| §1 WP-HANDBOOK-RE-EXTRACTION-V2 follow-ups   | 4 new WP dirs (Phase 2 backfill plus 4 new spec drafts)       |
| §2 Other deferred WP work                    | Frontmatter `status: draft` on existing WP dirs               |
| §3 Deferred design decisions                 | IDEAS.md (out of scope here) or new WPs as warranted          |
| §4 Real bugs                                 | `docs/bugs/` files (Phase 5 seed)                             |
| §5 Manual smoke tests                        | Stays in WP test-plan.md; every affected WP's `human_review_status` set to `pending` in Phase 2 |
| §6 Header WP deferred-with-trigger           | Existing WPs' frontmatter; trigger captured in spec body      |
| §7 IDEAS funnel                              | Already in IDEAS.md; no migration                             |
| §8 Housekeeping                              | One-off cleanup tasks; not tracked long-term                  |
| §9 Tooling quirks                            | `docs/agents/common-pitfalls.md` (or skill notes)             |

After this WP closes, the aggregate doc archives to `.archive/handoffs/20260504-multi-agent-cleanup-aggregate.md` with a note pointing at the WPs and bugs it seeded.
