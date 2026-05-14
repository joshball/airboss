---
id: bug-palette-pin-to-today
title: "Palette Pin-to-today action stays disabled until mine.plan pin API exists"
product: study
severity: minor
status: fixed
discovered_pr: 857
discovered_date: 2026-05-12
fix_pr: 985
fix_wp: command-palette
tags:
  - palette
  - mine.plan
  - phase-3
  - api-gap
---

# Palette Pin-to-today action stays disabled until `mine.plan` pin API exists

## Context

The Phase 3 detail-pane component `libs/help/src/ui/PaletteDetailPane.svelte` ships a "Pin to today" action button as one of 5 action affordances (Open in flightbag / Open / Search inside / Cite this / Pin to today). The button has been **disabled as a placeholder** since Phase 3 with a tooltip clarifying its status.

## Why disabled

Pin-to-today requires a server-side API on `study.studyPlan` (or related plan-state surface) to atomically:

1. Find the active plan for the current user
2. Append a referenced doc / section to today's bucket
3. Surface a confirmation toast

No such API exists in `@ab/bc-study/server` today. Per Phase 4 brief ("be honest about what's wired"), the agent left the button disabled rather than invent the API surface.

## Impact

Users see the button greyed out with a tooltip. Functionality is otherwise complete -- every other detail-pane action works.

Low severity because:

- The feature is discoverable but not promised
- Users can still "Open" + manually pin via the plan editor
- No regression -- this was placeholder from day one

## Fix

When `mine.plan` gains a pin-to-today API:

1. Add `pinToToday(planId: string, ref: SourceId | KnowledgeNodeId | CardId)` to `libs/bc/study/src/plans.ts` (server barrel)
2. Wire a new `cmd.action` command via Phase 4's `paletteCommands` registry, OR call directly from the detail-pane action handler (cleaner)
3. Remove the `disabled` prop + tooltip from `PaletteDetailPane.svelte`
4. Sibling test in `db-loaders.test.ts` (or `plans.test.ts`) seeds a plan + ref + asserts atomic append
5. Manual walk: open palette, select a handbook chapter, click "Pin to today", confirm chapter appears in `/program/plans/today`

## Trigger to revisit

When a user request or PRD names "I want to pin this for today's session" as a goal, OR when `@ab/bc-study/plans.ts` adds any `pin*` API (signaling the team's ready to expose the primitive).

## Related

- PR #857 -- Phase 3 introduced the placeholder
- PR #940 -- Phase 4 considered wiring this via the command registry; left it as-is
- Work package: [command-palette](../work-packages/command-palette/spec.md)

## Resolution

This bug was stale documentation, not real broken behavior. The pin-to-today
flow was wired end-to-end before the bug was filed:

- API exists: `pinToToday(...)` is a real exported function at
  [libs/bc/study/src/plan-items.ts:170](../../libs/bc/study/src/plan-items.ts).
  It wraps the lower-level `pinPlanItem` and is exposed via the
  `@ab/bc-study/server` barrel.
- Button is wired (not disabled): the "Pin to today" action in
  [libs/help/src/ui/PaletteDetailPane.svelte:266](../../libs/help/src/ui/PaletteDetailPane.svelte)
  is rendered inside an `{#if pinPayload}` guard and only disabled while a
  request is pending or after a successful pin, not as a permanent
  placeholder.
- Route handler exists and calls the BC: `POST /api/plan-items` at
  [apps/study/src/routes/api/plan-items/+server.ts](../../apps/study/src/routes/api/plan-items/+server.ts)
  imports `pinToToday` from `@ab/bc-study/server` (line 17) and invokes it
  in its POST handler (line 50).

The "Why disabled" / "Fix" / "Trigger to revisit" sections above describe
state that no longer matches the codebase. Closing as fixed; no further work
needed.
