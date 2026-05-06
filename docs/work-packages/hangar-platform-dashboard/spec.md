---
id: hangar-platform-dashboard
title: Hangar Platform Dashboard -- Spec
product: hangar
category: feature
status: signed-off
agent_review_status: pending
human_review_status: pending
created: 2026-05-04
owner: agent
depends_on: []
unblocks: []
tags:
  - admin
  - dashboard
legacy_fields:
  feature: hangar-platform-dashboard
  type: spec
  review_status: pending
---

# Hangar Platform Dashboard -- Spec

A `/platform` command center inside the hangar that aggregates platform state -- WP statuses, roadmaps, NOW.md state, ADR index, IDEAS funnel, coverage gaps, recent activity, drift -- into one navigable surface. Plus the agent skills and discipline (drift tracking with don't-repeat-work checkpoints; 500-line doc size cap) needed to keep the underlying data honest.

## Problem

Today's "where does everything stand?" requires:

- Reading `NOW.md` (290+ lines of prose)
- `grep -E "^status:" docs/work-packages/*/spec.md`
- Opening 4 separate `ROADMAP.md` files
- Walking `docs/decisions/` to find ADR statuses
- Skimming `IDEAS.md` for stale items
- Running `/ball-wp-coverage` to find gaps
- Hoping the various sources agree

There's no one place to see "what's in flight, what just shipped, what's next, what's drifting." Multiple agents touching the repo make this worse: WP frontmatter flips to `shipped` but NOW.md isn't updated; roadmap items get implemented without a WP link; ADRs get written without a `status:` field. The drift compounds.

This WP delivers the dashboard **and** the discipline to keep its data trustworthy.

## Sequencing and dependencies

Depends on [hangar-review-queue](../hangar-review-queue/spec.md):

- Reuses the loader (extends with new discovery rules for roadmap items, ADRs, ideas)
- Reuses the markdown renderer (`/docs/...` deep links)
- Reuses the `review_item` table (roadmap items and ADRs become items of new kinds)
- Reuses the `docs_search_index`

Builds **after** `hangar-review-queue` Phases 1-3 land (substrate + loader + docs browser).

## Three pillars

This WP has three concurrent threads. They all ship together, but they're conceptually distinct.

1. **Structure** -- add machine-readable blocks to a few docs so the dashboard doesn't parse prose.
2. **Discipline** -- agent rules in CLAUDE.md and a `/wp-drift` skill that keeps the structured blocks honest, with checkpointing so we don't waste agents redoing work.
3. **Surface** -- the `/platform` dashboard that consumes the structured data.

## Pillar 1 -- Structured tracking blocks

The hybrid approach: structured for the load-bearing things, parse prose for the rest.

### NOW.md -- structured frontmatter sections

Today NOW.md is hand-curated prose. Add a YAML block as part of the frontmatter:

```yaml
---
in_flight:
  - wp: hangar-review-queue
    since: 2026-05-03
  - wp: hangar-platform-dashboard
    since: 2026-05-03
just_shipped:
  - wp: rename-generic-content-files
    pr: 490
    date: 2026-05-03
  - wp: wp-cfr
    pr: 491
    date: 2026-05-03
follow_ons:
  - id: cert-syllabus-followon-1-node-weakness
    parent_wp: cert-syllabus-and-goal-composer
    trigger: "real walkthrough where domain row points at weather but actionable gap is one specific node"
    status: open
---

# Now
[existing prose stays unchanged]
```

The prose narrative stays human-readable; the structured block drives the dashboard. **Both are authoritative.** A drift between them is a bug surfaced by `/wp-drift`.

The `just_shipped` array keeps only entries from the last 60 days. Older entries archive to `docs/work/now-archive/YYYY-MM.md` (see Pillar 4 -- Doc size discipline).

### ROADMAP.md (per app) -- structured items

Each `docs/products/{app}/ROADMAP.md` gains an `items:` block in frontmatter:

```yaml
---
title: "Hangar Roadmap"
app: hangar
items:
  - title: "Wave 1 -- foundations"
    status: shipped
    wp: hangar-scaffold
    shipped_at: 2026-04-15
  - title: "Wave 2 -- sources v1"
    status: shipped
    wp: hangar-sources-v1
    shipped_at: 2026-04-22
  - title: "Wave 3 -- review queue"
    status: in_flight
    wp: hangar-review-queue
  - title: "Wave 4 -- platform dashboard"
    status: in_flight
    wp: hangar-platform-dashboard
  - title: "Wave 5 -- TBD"
    status: planned
    wp: null
---
```

`status` values: `shipped` / `in_flight` / `planned` / `blocked` / `dropped`.

One-time backfill needed: 4 ROADMAPs (study, sim, hangar, runway) × ~10-30 items. ~30-90 minutes. Done in Phase 1.

### ADR frontmatter -- standardize `status:` field

Every `docs/decisions/NNN-*/decision.md` (and single-file `NNN-topic.md` ADRs) must have:

```yaml
---
adr: 011
title: "Knowledge graph learning system"
status: accepted   # proposed | accepted | superseded | deprecated
superseded_by: null
date: 2026-04-22
---
```

Many ADRs already have most of this; this is enforcement + backfill of the missing ones. The drift skill flags ADRs without a `status:` field.

### IDEAS.md -- light-touch frontmatter only

IDEAS.md keeps its prose-and-bullets shape. Add a single frontmatter block at the top:

```yaml
---
last_reviewed: 2026-04-30
sections:
  technical_approaches: { last_reviewed: 2026-04-30 }
  product_ideas:        { last_reviewed: 2026-04-30 }
  pedagogy:             { last_reviewed: 2026-04-15 }
---
```

The dashboard pane reads counts by walking `^- ` lines per H2 section. No item-level tracking. Section freshness comes from the per-section `last_reviewed` timestamp.

### WP frontmatter -- already structured

No change to WP frontmatter. We rely on existing `status` and `review_status` fields per the [hangar-review-queue spec](../hangar-review-queue/spec.md).

## Pillar 2 -- Discipline (agent rules + drift skill)

### CLAUDE.md updates

A new section in CLAUDE.md, "Platform tracking -- keeping the dashboard accurate," with:

- Rule: when flipping a WP `status:` to `shipped`, update **both** the WP spec frontmatter **and** the NOW.md structured block (`just_shipped:` add, `in_flight:` remove). Same diff.
- Rule: when shipping a roadmap item, update **both** the ROADMAP.md prose **and** the structured `items:` entry's `status:`. Same diff.
- Rule: every new ADR must have a frontmatter `status:` field with one of the four standard values.
- Rule: no single doc exceeds 500 lines. Approaching the limit (>400) flags for split. (Pillar 4 covers patterns.)
- Failure mode named explicitly: "If you flip a WP to shipped in spec.md but forget the NOW.md structured block, the platform dashboard will show it as in-flight forever. The `/wp-drift` skill catches this -- but it's better to not create the drift in the first place."

### `/wp-drift` skill

A new skill at `~/src/_me/ai/agent-skills/skills/wp-drift/` with a single entry point that:

1. **Scans** every authoritative source (WP frontmatter, NOW.md structured block, each ROADMAP.md `items:`, ADR frontmatter, IDEAS.md frontmatter freshness).
2. **Resumes from last run** via a checkpoint at `.claude/skills-state/wp-drift/last-run.json` (gitignored).
3. **Validates incrementally** -- skips files whose content fingerprint hasn't changed since last validated.
4. **Auto-fixes** safe drift (e.g. WP `status: shipped` but missing from NOW.md `just_shipped` -> add the entry; WP in NOW.md `in_flight:` but spec frontmatter is `done` -> remove from `in_flight:`).
5. **Triages** unsafe drift -- prints a list of items needing human judgement (e.g. ROADMAP item without a WP link, ADR without `status:`).
6. **Updates the checkpoint** with what was validated, what was fixed, what's still drifting.

CLI surface:

| Command                              | Behavior                                                                              |
| ------------------------------------ | ------------------------------------------------------------------------------------- |
| `/wp-drift`                          | Resume from checkpoint; only re-validate files whose fingerprint changed              |
| `/wp-drift --all`                    | Force full re-scan, ignore checkpoint                                                 |
| `/wp-drift --since=2026-05-01`       | Validate items modified since date                                                    |
| `/wp-drift --touched-since=origin/main` | Validate items in current branch's diff vs ref                                     |
| `/wp-drift --fix`                    | Auto-fix safe drift (default is dry-run with summary)                                  |
| `/wp-drift --triage`                 | Print only the human-judgement-needed list                                             |

### Checkpoint shape

```json
{
  "schema_version": 1,
  "last_full_scan": "2026-05-03T14:22:00Z",
  "validated": {
    "wp": {
      "hangar-review-queue": {
        "at": "2026-05-03T14:23:11Z",
        "fingerprint": "sha256:abc123...",
        "result": "ok"
      },
      "evidence-kind-data-layer": {
        "at": "2026-05-02T09:15:00Z",
        "fingerprint": "sha256:def456...",
        "result": "drift",
        "issue": "spec status=read but NOW.md not updated"
      }
    },
    "roadmap": {
      "hangar:wave-2-sources-v1": { "at": "...", "fingerprint": "...", "result": "ok" }
    },
    "adr": {
      "011": { "at": "...", "fingerprint": "...", "result": "ok" }
    }
  },
  "drift_remaining": [
    {
      "kind": "wp",
      "id": "evidence-kind-data-layer",
      "issue": "spec status=read but NOW.md not updated",
      "first_seen": "2026-05-02T09:15:00Z",
      "auto_fixable": true
    }
  ],
  "size_violations": [
    { "path": "docs/work/NOW.md", "lines": 542, "first_seen": "2026-05-03T14:22:00Z" }
  ]
}
```

**Fingerprint = SHA256 of file content.** Not mtime (unreliable across worktrees). Slightly slower than mtime on a 1000-file scan but predictable. Files with unchanged fingerprint skip validation entirely -- that's what makes "validate everything" cheap on the second run.

The checkpoint is **per-machine, gitignored**, since the validation work is per-machine and a teammate cloning fresh re-validates from scratch (acceptable for a single-user app).

### Auto-fix scope

Auto-fixable today:

- WP shipped + missing from `just_shipped:` -> add entry with WP name, PR (if findable in last 100 commits), date
- WP in `in_flight:` + spec frontmatter is `done`/`shipped` -> remove from `in_flight:`
- ROADMAP item with `wp: foo` and matching folder + spec status `shipped` -> set item `status: shipped`, `shipped_at:` from PR merge date
- ADR missing `status:` field where the body header says "Status: accepted" (or similar) -> backfill from body

Triage-only (human judgement):

- ROADMAP item without a `wp:` link
- ADR with body status that doesn't match frontmatter status (which wins?)
- WP `status: deferred` -- is that drift or intentional?
- IDEAS.md section last reviewed > 30 days ago

### Reusable pattern

The fingerprint-checkpoint pattern this skill establishes is a reusable shape for future "validate everything" skills (test-plan audits, ADR reference-staleness, etc.). Document the pattern inline in the skill source for future cargo-culting; do not generalize prematurely into a `_lib` shared util until we have a second concrete user.

## Pillar 3 -- Surface (`/platform` dashboard)

A single `/platform` route inside the hangar app, top-to-bottom panes. Pre-canned layout for v1 (no configurable widgets); panes are composable Svelte components so v2 "configurable layouts" is a shell change, not a rewrite.

### Panes

| Pane                | Source                                            | Action target                                  |
| ------------------- | ------------------------------------------------- | ---------------------------------------------- |
| **Now bar**         | NOW.md frontmatter `in_flight` + `just_shipped`   | Click WP -> `/review/wp_spec/[id]`             |
| **WP status board** | WP frontmatter (all 89+ rows)                     | Click row -> `/review/wp_spec/[id]`            |
| **Roadmap**         | Each `docs/products/{app}/ROADMAP.md` `items`     | Click item -> linked WP or `/docs/...` section |
| **ADR index**       | `docs/decisions/**/decision.md` frontmatter       | Click row -> `/docs/decisions/...`             |
| **Ideas funnel**    | `IDEAS.md` section counts + last-reviewed         | Click section -> `/docs/platform/IDEAS.md#...` |
| **Coverage gaps**   | Computed via `bun run wp:coverage`                | Button: "Run scan"; results render inline      |
| **Recent activity** | `git log --oneline -50` + WP-touched detection    | Click commit -> GitHub commit URL              |
| **Drift**           | `/wp-drift` checkpoint `drift_remaining`          | Per-row: "Auto-fix" or "Triage"                |
| **Doc health**      | `/wp-drift` checkpoint `size_violations`          | Per-row: suggested split pattern               |

### Roadmap pane shape

V1 = **per-app columns** matching ROADMAP.md source structure. Each column = one app (study, sim, hangar, runway, future surfaces). Each card = one `items[]` entry, color-coded by status (shipped/in_flight/planned/blocked).

Includes a **timeline toggle stub** (button: "Timeline view") that for v1 shows a "Coming soon" placeholder. The toggle is the affordance; the unified-timeline rendering is a follow-up WP. Stub gets a `disabled` attribute and a tooltip explaining why.

### Filters

Top of the dashboard:

- App selector (All / Study / Sim / Hangar / Runway / ...) -- filters every pane
- Status selector (All / Active / Shipped / Drafts) -- filters WP status board + roadmap
- Free-text search -- filters all pane content client-side

### WP status board

Table with columns: name / product / status / review_status / last-touched (from git) / linked PR (latest) / link.

Default sort: `status` (active first), then `last-touched` desc.

Filter chips above: by status, by product, "in NOW.md in_flight" toggle.

Click a row navigates to the per-kind review view (the `/review/wp_spec/[id]` page from `hangar-review-queue`).

### Coverage gaps pane

A single button: "Run coverage scan." Backend runs `bun run wp:coverage` (server-side wrapper around the existing `/ball-wp-coverage` skill output, or a re-implementation as a BC function -- TBD in Phase 5). Results render as a list of:

- Routes / features / BC functions without a matching WP
- WPs without a clear product mapping
- Suggested action per row (author WP / archive / link existing)

Persists last-run timestamp + summary; the button shows "Last run: X hours ago."

### Drift pane

Reads the `/wp-drift` checkpoint `drift_remaining`. Each row:

- Issue summary
- "Auto-fix" button (if `auto_fixable: true`) -- runs `/wp-drift --fix` for that single item
- "Triage" link to the source doc for human edit
- "Snooze 7 days" (if drift is intentional, hides until re-detected after fingerprint change)

If the checkpoint is missing or older than 24 hours, surface a warning + "Run /wp-drift now" button.

### Doc health pane

Reads `size_violations`. Each row:

- File path + line count
- Suggested split pattern (NOW.md -> archive; ROADMAP.md -> shipped-archive; ADR -> sub-docs; etc.)
- Link to open the file in `/docs`

## Pillar 4 -- Doc size discipline

Hard cap: **500 lines per markdown file**. Approaching the limit (>400) flags for split.

### Standard split patterns

| File                                  | Trigger                       | Split pattern                                                                  |
| ------------------------------------- | ----------------------------- | ------------------------------------------------------------------------------ |
| `docs/work/NOW.md`                    | >500 lines or `just_shipped:` entries older than 60 days | Move old entries to `docs/work/now-archive/YYYY-MM.md`             |
| `docs/products/{app}/ROADMAP.md`      | >500 lines or shipped items > 20 | Move shipped items to `docs/products/{app}/ROADMAP-shipped.md`              |
| `docs/decisions/NNN-topic.md`         | >500 lines                    | Promote to directory ADR: `NNN-topic/{decision,context,sub-docs}.md`            |
| `docs/work-packages/{name}/spec.md`   | >500 lines                    | Split into spec.md (overview + acceptance) + design.md sections; spec links to design |
| Other                                 | >500 lines                    | Index-and-linked-sub-docs pattern; case-by-case                                |

### Enforcement

Two layers:

1. `bun run docs:size-check` -- script that walks `docs/**` (and `course/**`, `handbooks/**`, `regulations/**` if useful), reports files over 500 lines. Wired into the same daily scheduled job that runs `/wp-drift`. Findings written to the drift checkpoint as `size_violations`.
2. Dashboard "Doc health" pane reads `size_violations` and surfaces them.

The check runs but does **not** auto-split. Splits are case-by-case decisions that need human judgement (which entries are stale enough to archive? Which sections to promote?).

### CLAUDE.md update

Add a "Doc size limits" section:

```text
## Doc size limits

- No single doc exceeds 500 lines. Hard cap.
- Files approaching the limit (>400) flag for split via `/wp-drift`.
- Standard split patterns (see hangar-platform-dashboard/spec.md for table):
  - NOW.md "Just shipped" entries older than 60 days -> docs/work/now-archive/YYYY-MM.md
  - ROADMAP.md shipped items -> docs/products/{app}/ROADMAP-shipped.md
  - Long ADRs -> directory ADRs with sub-docs
- The `/platform` Doc health pane surfaces violators with suggested splits.
```

## Out of scope (v1)

- **Configurable layouts.** Pre-canned only.
- **Cross-product timeline view.** Toggle stub but no implementation. Follow-up WP.
- **Auto-running coverage scans on a schedule.** Manual button only.
- **Auto-splitting docs.** The system flags; humans split.
- **Cross-machine checkpoint sharing.** Per-machine; teammates re-validate from scratch.
- **Notifications.** No "drift count" badge in the global header. The `/platform` route surfaces counts; that's it.
- **Rich graph views.** No DAG of WP dependencies, no Gantt charts, no graph DB.

## Acceptance

- `/platform` renders with all panes populated from real data, no parse failures.
- NOW.md, every ROADMAP.md, every ADR has the structured frontmatter blocks.
- CLAUDE.md has the platform-tracking + doc-size sections.
- `/wp-drift` runs in <30 seconds incrementally on a no-change repo (everything fingerprint-skipped).
- `/wp-drift --all` runs in <2 minutes from cold (89 WPs + 4 ROADMAPs + ~20 ADRs + IDEAS).
- `/wp-drift --fix` auto-resolves the obvious drift; the triage list is short and human-judgement-only.
- The dashboard's Drift pane and Doc health pane reflect checkpoint state and update on a fresh `/wp-drift` run.
- Coverage gaps button runs and surfaces actionable rows.
- All literal values (status enums, default columns, etc.) live in `libs/constants/src/platform.ts`. No magic strings in BC or pages.

## References

- [hangar-review-queue](../hangar-review-queue/spec.md) -- substrate dependency
- [docs/work/NOW.md](../../work/NOW.md) -- target file for structured blocks
- [docs/products/hangar/ROADMAP.md](../../products/hangar/ROADMAP.md) (and study/sim/runway) -- target ROADMAPs
- [docs/decisions/](../../decisions/) -- target ADRs
- [docs/platform/IDEAS.md](../../platform/IDEAS.md) -- light-touch frontmatter target
- Existing `now-md-drift` scheduled job ([scripts/scheduled-jobs/](../../../scripts/scheduled-jobs/)) -- folded into `/wp-drift`
- CLAUDE.md "No walls of text" rule -- this WP makes it concrete (500 lines)
