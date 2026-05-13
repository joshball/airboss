---
id: route-style-extraction
title: 'Promote oversized route style blocks into libs/ui/'
product: platform
category: platform
status: abandoned
agent_review_status: pending
human_review_status: pending
created: 2026-04-28
owner: agent
depends_on: []
unblocks: []
tags: [theme, ui, deferred]
legacy_fields:
  trigger: 'dashboard refresh -- the residual sites need either (a) a primitive that hosts structured badges below a title (memory/[id], knowledge/[slug], hangar users/[id], glossary/[id], jobs/[id], sources/[id]), (b) tab-strip support inside a header (dev/references), or (c) a runner-chrome primitive distinct from PageHeader (sim cockpit + horizon + window + dual + debrief, memory review session-runner)'
  source: '2026-04-27 architecture + svelte reviews; refined by 2026-04-28 audit + Button-adoption pass; mechanical adoption pass landed 2026-04-29'
  note: 'Mechanical adoption of PageHeader / EmptyState / ScoreCard across 27 routes shipped in the route-style-extraction follow-on PR. Inventory at INVENTORY.md documents every mechanical migration and every Skip residual with reason. Remaining residuals are structural (primitive does not express the page''s shape), not cosmetic; they wait on the dashboard refresh which will reshape both the routes and the primitives together.'
---

# Promote oversized route `<style>` blocks into `libs/ui/`

## Problem

The original framing -- "27 route `+page.svelte` files carry 100+ line `<style>` blocks; extract everything" -- is partially stale. A 2026-04-28 survey of all 27 routes named in the original spec found:

- **Token migration is complete.** Zero hex codes remain in any route style block. Routes already consume `--space-*`, `--ink-*`, `--action-*`, `--surface-*`, `--font-size-*`, `--radius-*`. The "promote-to-token-driven" premise that motivated this WP no longer holds.
- **Most "shells" already exist** in `libs/ui/`: PanelShell, Card, StatTile, BrowseList, BrowseListItem, Banner, FormStack, FormField, ResultSummary, Pager, Tabs, Drawer, Dialog. Routes that haven't adopted them are not blocked on lib work; they're un-migrated.
- **The real convergent issue is `<Button>` non-adoption.** Across the top 5 routes (~688 / 566 / 493 / 490 / 445 lines of style each), ~26 inline `.btn` / `<a class="btn primary">` redefinitions duplicate functionality already in `libs/ui/src/components/Button.svelte` (which supports `href`, all four variants, three sizes, loading state). This is the only finding from the audit that justifies an immediate pass.
- **Three genuinely missing primitives recur** but are small: `PageHeader`, `EmptyState`, `ScoreCard`. These do warrant extraction, but they're naturally carried by the dashboard refresh -- the refresh will need fresh primitives anyway.

## Scope (revised)

1. **Button adoption** -- replace inline `.btn` / `.btn.primary` / `.btn.secondary` / `.btn.ghost` / `.btn.danger` redefinitions across the top 5 routes with `<Button>` from `libs/ui`. Drop the dead style rules. **Status: shipped in PR refactor/adopt-button-component-top-routes (2026-04-28).**
2. **Extract three missing primitives** to `libs/ui/src/components/`: `PageHeader.svelte`, `EmptyState.svelte`, `ScoreCard.svelte`. Token-driven; replace the per-route inline versions. **Status: deferred -- rides along with the dashboard refresh.**

The original "extract every recurring shell" framing is dropped. The shells we needed already exist; the ones we don't are small and gated on a concrete carrier.

## Top 5 routes (Button adoption -- shipped)

| Route                                   | Inline `.btn` instances replaced |
| --------------------------------------- | -------------------------------- |
| /memory/review/[sessionId]/+page.svelte | 6                                |
| /calibration/+page.svelte               | 3                                |
| /session/start/+page.svelte             | 0 (already migrated)             |
| /memory/[id]/+page.svelte               | 7                                |
| /memory/+page.svelte                    | 6                                |

See the PR for the full file-by-file breakdown.

## Trigger

Dashboard refresh -- the primitive-extraction part (PageHeader / EmptyState / ScoreCard) lands when the refresh starts authoring its own page chrome. Until then, this WP stays `deferred`. Flip to `done` only when those three primitives ship.

## Status

- [x] Button adoption across top 5 routes (PR refactor/adopt-button-component-top-routes, 2026-04-28)
- [ ] PageHeader / EmptyState / ScoreCard extraction (gated on dashboard refresh)

## Out of scope

See [OUT-OF-SCOPE.md](./OUT-OF-SCOPE.md).
