---
title: Hangar Platform Dashboard -- User Stories
product: hangar
feature: hangar-platform-dashboard
type: user-stories
status: ready-for-review
review_status: pending
---

# Hangar Platform Dashboard -- User Stories

User = Joshua (single-user MVP). Stories anchor what each phase has to deliver.

## Seeing where everything stands

**As Joshua, I want one screen that shows me what's in flight, what just shipped, what's planned, what's drifting, and what's broken -- so I don't have to grep frontmatter and read 5 docs to understand the platform's state.**

- I open `/platform` and see all the panes at once.
- The Now bar surfaces what I'm actively working on (from NOW.md).
- The WP status board shows all 89+ work packages with status filtering.
- The Roadmap pane shows planned/in-flight/shipped per app.
- The Drift pane tells me where the data has gone out of sync.

## Trusting that the data is current

**As Joshua, I want to know that what I see on the dashboard reflects reality -- so I don't make decisions on stale data.**

- The Drift pane lists every mismatch detected by `/wp-drift`.
- Auto-fixable drift has a [Auto-fix] button I can click on the dashboard.
- Triage items name the human judgement needed.
- The pane shows the last `/wp-drift` run timestamp; >24 hours old surfaces a warning.

## Validating without wasting time

**As Joshua, I want `/wp-drift` to remember what it already validated -- so when I run it twice in a row, the second run is fast.**

- First run: scans everything, hashes file content, builds the checkpoint.
- Second run: skips files whose hash is unchanged.
- Forced full re-scan: `/wp-drift --all`.
- Validating a recent change: `/wp-drift --touched-since=origin/main`.
- The agent doesn't redo work I've already validated, even across sessions.

## Keeping docs short

**As Joshua, I want to know when a doc is getting too long -- so I split it before it becomes unreadable.**

- The Doc health pane lists files over 500 lines and files in the 400-499 warning band.
- Each row shows a suggested split pattern (NOW.md -> archive; ROADMAP.md -> shipped-archive; ADR -> sub-docs).
- I can click into the file in `/docs` to start the split.
- The check runs daily; new violators show up automatically.

## Authoring with the right rules

**As Joshua's collaborating agents, I want CLAUDE.md to spell out exactly what to update when shipping a WP -- so I don't create drift.**

- CLAUDE.md "Platform tracking" section names every required update on a ship: WP frontmatter, NOW.md structured block, ROADMAP item if linked.
- CLAUDE.md "Doc size limits" section names the 500-line cap and the standard split patterns.
- The failure mode is named explicitly: "if you flip the WP but forget NOW.md, the dashboard shows it as in-flight forever."

## Finding gaps

**As Joshua, I want to know what features in the codebase don't have a work package -- so I can author one or archive the feature.**

- I click "Run scan" on the Coverage gaps pane.
- The pane shows uncovered routes / BC functions / features.
- Each row suggests an action (author WP / archive / link existing).
- The result persists, so I don't have to re-run unless I want fresh data.

## Navigating from the dashboard

**As Joshua, I want every dashboard cell to be a link to the underlying source -- so the dashboard is navigation, not a third source of truth.**

- Click a WP row -> `/review/wp_spec/<id>`.
- Click an ADR row -> `/docs/decisions/...`.
- Click a roadmap item -> linked WP or `/docs/.../ROADMAP.md` section.
- Click an Ideas section -> `/docs/platform/IDEAS.md#<section>`.
- Click a commit -> GitHub commit URL.
- Nothing on the dashboard is a final-rendered fact; it's all a pointer to the source.

## Adding a new tracking source later

**As Joshua, I want to add a new tracking dimension (e.g. "manual test sessions per WP" or "external dependency status") without redesigning the dashboard.**

- Add a new pane component in `libs/ui/src/platform/`.
- Add a new BC function in `libs/bc/hangar/src/platform.ts`.
- Wire it into the `/platform/+page.svelte` composition.
- Pre-canned layout means no widget framework to fight; configurable comes later as a v2 shell.
