---
title: 'Out of Scope: Hangar Platform Dashboard'
product: hangar
feature: hangar-platform-dashboard
type: out-of-scope
status: unread
---

# Out of Scope: Hangar Platform Dashboard

Deferred items, why they're deferred, and the trigger that should make
us revisit each. Future agents and humans: do not build these without
the documented trigger. If you think the trigger is hit, surface it
for a decision rather than building silently.

## Summary

| Item                                      | Status       | Trigger to revisit                                                   |
| ----------------------------------------- | ------------ | -------------------------------------------------------------------- |
| Configurable layouts                      | Follow-on WP | When v1 pre-canned panes prove too rigid for actual usage            |
| Cross-product timeline view               | Follow-on WP | After v1 ships; planned WP `hangar-platform-timeline`                |
| Auto-running coverage scans on a schedule | Follow-on WP | When manual coverage runs feel painful in normal use                 |
| Auto-splitting docs                       | Rejected     | Never -- splits are case-by-case human judgement                     |
| Cross-machine checkpoint sharing          | Deferred     | Only if airboss goes multi-developer                                 |
| Notifications / drift-count header badges | Rejected     | Never -- `/platform` is the surface; no global-header attention pull |
| Rich graph views (DAG / Gantt / graph DB) | Rejected     | Never -- panes are the right shape, not graphs                       |

## Configurable layouts

Status: Follow-on WP

What was deferred:
User-configurable pane order, pane visibility, per-user saved layouts. v1 is a pre-canned top-to-bottom pane order with no user controls.

Why:
v1 doesn't know which panes matter most yet; user-zero hasn't lived with the dashboard long enough to know. Configurable layouts mean configuration UI, persistence schema, default-vs-custom resolution, and reset behavior -- speculative scope until v1 reveals which panes are load-bearing. The panes themselves are composable Svelte components, so v2 layout configurability is a shell change, not a rewrite.

Trigger to revisit:
When v1 pre-canned panes prove too rigid for actual usage (e.g. user-zero consistently scrolls past pane N to reach pane M; or asks for a pane to be hidden).

Implementation pattern when triggered:
Spec a follow-on WP `hangar-platform-layouts`. Build over the existing pane components; add a per-user layout table in `hangar.` schema; default falls back to the v1 pre-canned order. Reuse the substrate from this WP.

References:

- [spec.md "Out of scope (v1)"](./spec.md) -- "Configurable layouts" bullet
- [spec.md "Pillar 3 -- Surface"](./spec.md#pillar-3----surface-platform-dashboard) -- v1 pane shape
- [tasks.md "Out of phase / follow-up WPs"](./tasks.md) -- `hangar-platform-layouts` follow-on

## Cross-product timeline view

Status: Follow-on WP

What was deferred:
A unified Gantt/timeline view that renders every ROADMAP item from every app on one time axis. v1 ships a "Timeline view" button as a disabled stub.

Why:
The roadmap pane shape is per-app columns matching ROADMAP.md source structure. A cross-product timeline is a different rendering model (time-axis layout, item-duration metadata, dependency arrows) and needs richer metadata than the v1 `items:` block carries. Building it speculatively would force ROADMAP.md schema decisions before the per-app pane has revealed which dates are tracked and which are guesses.

Trigger to revisit:
After v1 ships and the per-app pane is in regular use. The toggle stub is already in the UI; the follow-on WP fills it in.

Implementation pattern when triggered:
Spec follow-on WP `hangar-platform-timeline`. Extend ROADMAP.md `items[]` with `started_at` / `target_at` fields. Replace the stub button's disabled handler with the rendered timeline.

References:

- [spec.md "Out of scope (v1)"](./spec.md) -- "Cross-product timeline view" bullet
- [spec.md "Roadmap pane shape"](./spec.md#roadmap-pane-shape) -- timeline toggle stub
- [tasks.md "Out of phase / follow-up WPs"](./tasks.md) -- `hangar-platform-timeline`

## Auto-running coverage scans on a schedule

Status: Follow-on WP

What was deferred:
A scheduled job that runs `bun run wp:coverage` periodically and updates the dashboard automatically. v1 ships a manual "Run scan" button only.

Why:
Coverage scans are non-trivial to compute; running them on a cron without a clear pain point is speculative. The button surface already exists; if running it manually feels painful, the follow-on is small (a `scripts/scheduled-jobs/` entry + the same BC function the button already calls).

Trigger to revisit:
When manual coverage runs feel painful (e.g. user-zero forgets to scan and ships with undocumented coverage gaps; or wants the gap count fresh every morning).

Implementation pattern when triggered:
Reuse `scripts/scheduled-jobs/` infrastructure. The job calls `runCoverageScan()` from `libs/bc/hangar/src/platform.ts` (the same function the button calls). Persist results to `hangar.coverage_scan_result`; the dashboard reads the latest row.

References:

- [spec.md "Out of scope (v1)"](./spec.md) -- "Auto-running coverage scans" bullet
- [spec.md "Coverage gaps pane"](./spec.md#coverage-gaps-pane) -- manual button shape
- [tasks.md "Out of phase / follow-up WPs"](./tasks.md) -- "Auto-running coverage scans" small follow-up

## Auto-splitting docs

Status: Rejected

What was rejected:
A mechanism that detects a doc exceeding 500 lines and automatically splits it via the documented split patterns.

Why:
Splits are case-by-case decisions that need human judgement: which entries are stale enough to archive, which sections to promote into sub-docs, which links need updating, which sections belong in the parent vs the child. An auto-split would either pick wrong (silently degrading docs) or hedge so heavily that the human still has to do the work. The system flags violations; humans split. This is a permanent design boundary, not a deferral.

Trigger to revisit:
Never -- see Why above.

References:

- [spec.md "Out of scope (v1)"](./spec.md) -- "Auto-splitting docs" bullet
- [spec.md "Pillar 4 -- Doc size discipline"](./spec.md#pillar-4----doc-size-discipline) -- explains flag-not-auto-split

## Cross-machine checkpoint sharing

Status: Deferred

What was deferred:
Sharing the `/wp-drift` checkpoint across multiple developer machines (e.g. via committed state, or a shared cache).

Why:
Airboss is a single-developer app today. The checkpoint is per-machine and gitignored because validation work is per-machine; a teammate cloning fresh re-validates from scratch. Building cross-machine sync would be speculative infrastructure with no consumer.

Trigger to revisit:
Only if airboss goes multi-developer.

Implementation pattern when triggered:
Move the checkpoint location from `.claude/skills-state/` to a project-relative checked-in path with conflict-merge rules, or to a shared backend (object storage with per-developer namespaces). Defer the storage decision to the time it's needed.

References:

- [spec.md "Out of scope (v1)"](./spec.md) -- "Cross-machine checkpoint sharing" bullet
- [spec.md "Checkpoint shape"](./spec.md#checkpoint-shape) -- per-machine, gitignored
- [tasks.md "Out of phase / follow-up WPs"](./tasks.md) -- "Cross-machine checkpoint sharing"

## Notifications / drift-count header badges

Status: Rejected

What was rejected:
A global-header badge showing the count of in-flight items, open drift, doc-size violations, etc., visible from any page.

Why:
The `/platform` route is the surface for platform state. Pulling that attention into the global header from every other page would create constant low-grade pressure without an action context. Counts are visible when you visit `/platform`; that's the design. Reopening this would require a clear pain signal ("I missed X drift for Y days because I never looked at `/platform`"), not just "we could."

Trigger to revisit:
Never -- see Why above.

References:

- [spec.md "Out of scope (v1)"](./spec.md) -- "Notifications" bullet

## Rich graph views (DAG / Gantt / graph DB)

Status: Rejected

What was rejected:
DAG of WP dependencies, Gantt charts, a graph database backing the dashboard.

Why:
The dashboard is a set of panes over tabular and list data. WP dependencies (`depends_on`, `unblocks` in frontmatter) are already first-class but render as link chips in WP rows, not as a graph. A DAG view would either expose the link structure that already exists (low information gain over what the WP status board shows) or imply richer semantics than the frontmatter captures (speculative). Reopening requires a concrete pane the rest of the design can't deliver, not "graphs look cool."

Trigger to revisit:
Never -- see Why above.

References:

- [spec.md "Out of scope (v1)"](./spec.md) -- "Rich graph views" bullet
