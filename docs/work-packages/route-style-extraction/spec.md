---
status: deferred
trigger: next major UI overhaul
source: 2026-04-27 architecture + svelte reviews
---

# Promote oversized route `<style>` blocks into `libs/ui/`

## Problem

27 route `+page.svelte` files carry 100+ line `<style>` blocks. The largest:

| Route                                          | Style lines |
| ---------------------------------------------- | ----------- |
| /memory/review/[sessionId]/+page.svelte        |         688 |
| /calibration/+page.svelte                      |         566 |
| /session/start/+page.svelte                    |         493 |
| /memory/[id]/+page.svelte                      |         490 |
| /memory/+page.svelte                           |         445 |
| /knowledge/[slug]/+page.svelte                 |         414 |
| /(app)/+layout.svelte                          |         346 |
| /sessions/[id]/+page.svelte                    |         306 |
| /knowledge/[slug]/learn/+page.svelte           |         299 |
| ... (18 more)                                  |             |

Per the project rule, route CSS should be layout/flow only. Visual styling belongs in `libs/ui/` token-driven primitives.

## Scope

1. Inventory the recurring shells across these routes: empty-state panel, score card, panel-with-eyebrow, list-with-actions, summary tile, deck row, calibration bucket, review feedback panel, etc.
2. Extract each recurring shell to `libs/ui/src/components/` as a token-driven component.
3. Replace per-route inline CSS with the new components.
4. Routes shrink to grid/flex layout.

## Trigger

Next major UI overhaul (the dashboard refresh would be a natural carrier). Not a blocker for shipping individual feature PRs.
