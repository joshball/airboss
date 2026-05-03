---
feature: review-tail-2026-05
date: 2026-05-04
---

# Tasks — review-tail-2026-05

## Wave 1: 7 open criticals (parallel)

### A. Chunk-1 a11y criticals (3 items, single agent)

- [ ] **MapPanel labels** — `apps/study/src/lib/components/MapPanel.svelte`. Drop `role="cell"`; add `aria-label` describing the map's current state. Add a vitest harness that asserts the `aria-label` updates when the underlying state changes.
- [ ] **Radiogroup keyboard nav** — find the radiogroup component flagged in `docs/work/reviews/2026-05-01-study-app-surfaces-a11y.md`. Either roving-tabindex or convert to native `<fieldset>`+`<input type="radio">`. Add a harness test that exercises ArrowUp/ArrowDown.
- [ ] **Read-suggestion preamble** — wrap the suggestion list in `role="group"` with `aria-labelledby` pointing at a descriptor. Add an sr-only descriptor if no visible heading is appropriate.

### B. Chunk-1 testing critical (1 item)

- [ ] **`apps/study/src/lib/server/references.test.ts`** — historical-lens tests assert only `kind === 'historical'`. Add a positive test that the default annotation is `'current'` and a separate explicit-default test pinning it. Verify that flipping the BC default would break exactly these new tests.

### C. Chunk-1 backend critical (1 item)

- [ ] **`apps/study/src/routes/(app)/memory/review/+page.server.ts`** — `load()` mints `memory_review_session` rows. Move the no-resumable case to a redirect; the `actions.fresh` form action handles real session creation. Cover with route-actions test asserting that GET never inserts.

### D. Chunk-2 criticals (2 items, single agent)

- [ ] **Package-boundary hardening**:
  - Declare `@ab/bc-hangar` dep on `bc-study` in `libs/bc/study/package.json`.
  - Add curated re-export so consumers aren't pulling internals.
  - Add `exports` field to `libs/db/package.json` and `libs/auth/package.json`.
  - Replace `@ab/bc-sim/persistence` wildcard subpath with explicit listed subpaths in `libs/bc/sim/package.json`.
- [ ] **Transaction-wrap pass**:
  - `updateCard` — wrap multi-write path in `db.transaction(...)`.
  - `renameSavedDeck` and `deleteSavedDeck` — wrap `onConflictDoUpdate` paths in `db.transaction(...)`.
  - Add real-DB test that asserts atomicity (mid-tx failure rolls back).

## Wave 2: convergent clusters (queued)

After Wave 1 lands, dispatch the convergent clusters in their own work-package. Tracked in `spec.md` Tier 2.

## Wave 3: drift

Opportunistic, no scheduled dispatch.
