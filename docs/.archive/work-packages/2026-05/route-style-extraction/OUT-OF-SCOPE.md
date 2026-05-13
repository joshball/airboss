---
title: 'Out of Scope: Route Style Extraction'
product: platform
feature: route-style-extraction
type: out-of-scope
status: unread
---

# Out of Scope: Route Style Extraction

Deferred items, why they're deferred, and the trigger that should make
us revisit each. Future agents and humans: do not build these without
the documented trigger. If you think the trigger is hit, surface it
for a decision rather than building silently.

Note: the parent WP frontmatter is `status: abandoned` (the Button-adoption
half shipped under PR #307 / #330; the residual extraction half was reframed
into the dashboard refresh). The deferred item below survives the WP's
abandonment and remains live until the dashboard-refresh carrier fires.

## Summary

| Item                                           | Status   | Trigger to revisit                                     |
| ---------------------------------------------- | -------- | ------------------------------------------------------ |
| PageHeader / EmptyState / ScoreCard extraction | Deferred | When the dashboard refresh authors its own page chrome |

## PageHeader / EmptyState / ScoreCard extraction

Status: Deferred

What was deferred:
Promoting three recurring page-chrome shapes out of per-route
`+page.svelte` into shared `libs/ui/src/components/` primitives:

- `PageHeader.svelte` -- eyebrow / title / subtitle / actions slots
- `EmptyState.svelte` -- icon / title / body / action shape used on
  empty-list routes
- `ScoreCard.svelte` -- numeric-stat card (the dashboard / calibration /
  history shape)

The mechanical adoption of these primitives across 27 routes shipped
under PR #330 (refactor/ui-adopt-pageheader-emptystate-scorecard), but
the residual sites listed in
[INVENTORY.md](./INVENTORY.md) (memory/[id], knowledge/[slug],
hangar users/[id], glossary/[id], jobs/[id], sources/[id], dev/references,
sim cockpit + horizon + window + dual + debrief, memory review
session-runner) need either (a) a primitive that hosts structured
badges below a title, (b) tab-strip support inside a header, or
(c) a runner-chrome primitive distinct from PageHeader. None of those
are cosmetic gaps; they are structural mismatches between the current
primitive API and the page's shape.

Why:
Per the spec's "Scope (revised)" section: the residual primitives ride
along with the dashboard refresh. The refresh will reshape both the
routes and the primitives together. Extracting now would lock the
primitive API to today's shape and constrain the refresh; extracting
during the refresh allows the API to be designed for both the new
dashboard surfaces and the residual routes at once.

Trigger to revisit:
When the dashboard refresh starts authoring its own page chrome. The
signal is a WP scoped to the dashboard refresh (or a PR that begins
re-authoring `apps/study/src/routes/(app)/dashboard/+page.svelte` with
new chrome). At that point, decide what primitive shapes the refresh
needs and extract for both the refresh and the INVENTORY.md residuals
in one pass.

Implementation pattern when triggered:
Mirror the existing `PageHeader.svelte` extraction landed under PR #330,
extended to host the structural slots the residual sites need
(under-subtitle structured badges, tab-strip, runner chrome). Use
[INVENTORY.md](./INVENTORY.md) as the residual checklist; every "Skip"
row names the structural reason and becomes a primitive-API requirement.

References:

- [spec.md](./spec.md) §"Scope (revised)" item 2 (status: deferred)
- [spec.md](./spec.md) §"Trigger" (dashboard-refresh carrier)
- [spec.md](./spec.md) §"Status" (PageHeader / EmptyState / ScoreCard checkbox unchecked)
- [INVENTORY.md](./INVENTORY.md) -- per-route residual inventory with structural reasons
- PR refactor/ui-adopt-pageheader-emptystate-scorecard (#330) -- mechanical adoption
- PR refactor/adopt-button-component-top-routes (#307) -- Button adoption (shipped half)
