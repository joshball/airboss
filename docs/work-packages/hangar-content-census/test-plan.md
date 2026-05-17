---
id: hangar-content-census
title: Hangar Content Census -- Test Plan
product: hangar
category: feature
status: draft
created: 2026-05-17
owner: agent
legacy_fields:
  feature: hangar-content-census
  type: test-plan
  review_status: pending
---

# Hangar Content Census -- Test Plan

Manual + automated coverage for Phase 1. Read [spec.md](spec.md) first.

## Automated

### Unit (Vitest)

- `libs/content-census` -- the wx-catalog adapter returns a schema-valid `CorpusCensus`.
- wx-catalog adapter's derived counts equal the known fixture numbers: 155 examples,
  20 matched, 87 token families, 43 covered, 7 scenarios, 6 contributing.
- **Explanatory-rule guard** -- iterate every `CensusMetric` and `CensusGap` from every
  registered adapter; assert `whatItMeasures` and `whyItMatters` are non-empty. This
  test FAILS the build if any metric ships without its explanation.
- The stub adapter returns the labelled "pending" state, never fabricated counts.

### e2e (Playwright)

- `tests/e2e/content-census-smoke.spec.ts`:
  - `/content` renders 14 corpus rows.
  - Each row shows a count and links to `/content/<id>`.
  - `/content/wx-catalog` renders the inventory, the gap view, and visible
    explanation text (assert the page contains the what/why strings for at least
    one metric).
  - A stub corpus page (`/content/knowledge-nodes` in Phase 1) shows the honest
    "drill-down pending (Phase 2)" placeholder, not fake data.

## Manual

Tester walks these by hand before sign-off.

### Census overview

- [ ] `/content` loads, shows all 14 corpora.
- [ ] The intro prose explains what the census is and the three layers.
- [ ] Each health indicator has a label + tooltip stating its rule -- no bare dots.

### wx-catalog reference drill-down

- [ ] `/content/wx-catalog` overview prose explains what the catalog is, links to
      ADR 018, the catalog plan, `catalog.json`, the matcher source.
- [ ] Inventory lists examples with derived state (matched / unmatched).
- [ ] Gap view shows: uncovered token families, the AIRMET structural gap, the
      `frontal-pressure-march` gap -- each with what-it-measures, why-it-matters,
      and a what-to-do link.
- [ ] **Explanatory-surface acceptance test:** a tester who has never seen the
      wx-catalog work reads the page and can correctly answer: "what does 20/155
      mean?", "why does it matter that 44 token families are uncovered?", "what
      would you do next?" If they can't, the page fails.

### Stub corpora

- [ ] Every non-wx-catalog corpus page shows an honest "pending" placeholder with a
      link to this WP. No fabricated numbers anywhere.

### Cross-linking

- [ ] `/content` links to `/platform` and vice versa; the boundary (content vs
      process) is clear from the link text.

## Regression

- [ ] `bun run check` clean.
- [ ] The new `libs/content-census/` runtime barrel is browser-safe (no `node:*`,
      no `Buffer`/`process` in the client-eligible files) -- `browser-globals`
      check passes.
