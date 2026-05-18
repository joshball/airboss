---
id: flightbag-citation-url-migration
title: 'Test Plan: Flightbag citation URL migration'
product: study
category: platform
status: in-flight
agent_review_status: done
human_review_status: pending
created: 2026-05-14
owner: agent
depends_on: []
unblocks: []
tags:
  - citations
  - urls
  - flightbag
  - test-plan
legacy_fields:
  feature: flightbag-citation-url-migration
  type: test-plan
---

# Test Plan: Flightbag citation URL migration

Manual acceptance tests for [spec.md](./spec.md) plus automated regressions. Scenarios prefixed `FCUM-`. Grouped by phase (helper -> BC + projection -> help loaders -> svelte components -> constant deletion).

## Setup

- `bun install` clean.
- `bun run check` passes on the branch.
- Dev DB reset + seeded: `bun run db reset && bun run db seed`.
- Abby is the seeded test user (`abby@airboss.test`); log in as Abby for every browser walk unless stated.
- The dev environment runs both the study app and the flightbag app on adjacent ports (the cross-origin wrap via `siblingOrigin()` only resolves when both are running). Confirm both are up: `bun scripts/dev.ts study` in one shell, `bun scripts/dev.ts flightbag` in another.
- The seeded reference corpus includes at least one of each migrated kind (handbook, CFR, AIM, AC). Verify with `bun run db query "select kind, count(*) from study.reference group by kind"`.
- Chromium devtools (or Firefox / Safari equivalents) -- the network tab is the load-bearing instrument for this WP. The 301-redirect assertion lives there.

---

## Phase A -- `urlForReferenceRow()` helper

### FCUM-1: Helper exports + signature

1. Open `libs/sources/src/url-for-reference.ts`.
2. **Expected:** `export function urlForReferenceRow(row: ReferenceRow): string` is present with a JSDoc citing this WP and the citations pattern doc.
3. Open `libs/sources/src/index.ts`. **Expected:** `urlForReferenceRow` is re-exported.

### FCUM-2: Helper handles every corpus shape

1. Run `bun test libs/sources/src/url-for-reference`.
2. **Expected:** tests pass for handbook / CFR / AIM / AC / ACS rows.
3. **Expected:** the POH / SAFO / INFO / NTSB rows return `ROUTES.FLIGHTBAG_HOME` (no flightbag route today; the helper falls back gracefully).

### FCUM-3: Helper handles missing edition gracefully

1. Construct a handbook `ReferenceRow` with `edition: ''`.
2. Call `urlForReferenceRow(row)`. **Expected:** the result is `ROUTES.FLIGHTBAG_HOME` (matches `urlForReference()` behaviour when the edition is empty).
3. **Expected:** no thrown exception.

---

## Phase B -- BC citation + library card paths

### FCUM-4: Handbook citation chip emits flightbag URL

1. `bun scripts/dev.ts study`. Log in as Abby.
2. Open `/memory/<a card with handbook citation>` (use any of Abby's seeded cards that carries a structured handbook citation; the seed includes at least one).
3. Open the network tab. Click the citation chip.
4. **Expected:** the chip's `href` attribute (read from devtools elements panel) starts with the flightbag origin and a `/handbook/<slug>/<edition>/...` path.
5. **Expected:** the network request that fires is a direct GET to the flightbag URL. No 301 status anywhere in the request chain.

### FCUM-5: CFR citation chip emits flightbag URL

1. Same setup. Open `/memory/<a card with CFR citation>` (the seed includes at least one).
2. Inspect the chip `href`. **Expected:** starts with the flightbag origin and a `/cfr/<title>/<part>/<section>` path.
3. Click. **Expected:** direct GET, no 301.

### FCUM-6: AIM citation chip emits flightbag URL

1. Same setup. Find an AIM-citation card. Inspect + click the chip.
2. **Expected:** `/aim/<chapter>/<section>` path; direct GET, no 301.

### FCUM-7: AC citation chip emits flightbag URL

1. Same setup. Find an AC-citation card. Inspect + click the chip.
2. **Expected:** `/ac/<doc>/<rev>/<chapter>` path; direct GET, no 301.

### FCUM-8: Library handbook card emits flightbag URL

1. Open `/library` (study app -- redirects to flightbag landing or shows the per-card grid depending on the surface).
2. Find a handbook card (Airplane Flying Handbook, Pilot's Handbook, etc.).
3. Inspect the card's main `href`. **Expected:** flightbag origin + `/handbook/<slug>/<edition>` path.
4. Click. **Expected:** direct GET, no 301.

### FCUM-9: POH card is chrome-only

1. On the same library surface, find a POH card (Cessna 172N, etc.).
2. Inspect the card body. **Expected:** the card body root is a `<div>` (or non-`<a>` element); no `href` is present.
3. **Expected:** the manufacturer-labelled `external` link (the "Cessna" link in the card's external slot) is preserved and clickable. It points to the manufacturer's site, not to the study or flightbag origin.
4. Try to click the card body. **Expected:** nothing happens; the card body is not interactive.

### FCUM-10: Handbook citation chip resolver unit tests

1. Run `bun test libs/bc/study/src/references` (or the equivalent test path).
2. **Expected:** new tests for `resolveHandbookCitationUrl` cover (a) chapter only, (b) chapter + section shapes.
3. **Expected:** new tests for `buildHandbookUrlFallback` cover both `editionConsumed=true` and `editionConsumed=false`.
4. All assertions check the result starts with `/handbook/`.

### FCUM-11: Browser-hydration smoke (Phase B regression)

1. Run `bun playwright test tests/e2e/browser-hydration-smoke.spec.ts`.
2. **Expected:** all surfaces in the smoke pass (`/memory`, `/study/learn`, `/reps`, `/library`).
3. **Expected:** no `Buffer is not defined` or `process is not defined` error in the console for any surface.

---

## Phase C -- help loaders

### FCUM-12: Help search CFR result emits flightbag URL

1. `bun scripts/dev.ts study`. Log in as Abby.
2. Open the help search affordance (the global search palette or the help drawer; depends on surface). Search for "91.103" or a known CFR section reference.
3. Inspect the result item's `href`. **Expected:** flightbag origin + `/cfr/14/91/103` path. No `/library/`.
4. Click. **Expected:** direct GET, no 301.

### FCUM-13: Help search AIM result emits flightbag URL

1. Same setup. Search for "AIM 4-1-1" or an AIM section reference.
2. **Expected:** flightbag origin + `/aim/4/1` path. No `/library/`. Direct GET, no 301.

### FCUM-14: Help search handbook result emits flightbag URL

1. Same setup. Search for a handbook section title (e.g., "Crosswind landing").
2. **Expected:** flightbag origin + `/handbook/<slug>/<edition>/chapter/<n>/section/<m>` path. No `/library/`. Direct GET, no 301.

### FCUM-15: Help search AC result emits flightbag URL

1. Same setup. Search for an AC reference (e.g., "AC 00-6B").
2. **Expected:** flightbag origin + `/ac/<doc>/<rev>/...` path. No `/library/`. Direct GET, no 301.

### FCUM-16: FTS passages search

1. Same setup. Open the full-text search surface. Search for a phrase that matches across multiple kinds (e.g., "wake turbulence").
2. **Expected:** result items group correctly by kind; every `href` is flightbag-direct. No `/library/`. No 301.

---

## Phase D -- handbook svelte components + tree builder

### FCUM-17: Handbook tree builder emits flightbag URLs

1. `bun scripts/dev.ts study`. Log in as Abby. Open whichever surface consumes the handbook tree (`/study/library/handbooks` or equivalent).
2. Inspect the tree's root handbook items + the chapter / section descendants. **Expected:** every `href` is flightbag-direct.
3. Click one of each level (handbook root, chapter, section). **Expected:** direct GET, no 301.

### FCUM-18: `HandbookCard` renders flightbag URL

1. Find any rendered `HandbookCard` (the library landing, the handbook search results, etc.). Inspect the root `href`.
2. **Expected:** flightbag origin + `/handbook/<slug>/<edition>` path. No `/library/`.

### FCUM-19: `HandbookChapterListItem` / `HandbookSectionListItem`

1. Find a rendered handbook chapter list (e.g., the handbook detail page's chapter outline).
2. Inspect chapter list item `href`. **Expected:** flightbag-direct `/handbook/<slug>/<edition>/chapter/<n>` path.
3. Drill into a chapter detail; inspect section list item `href`. **Expected:** flightbag-direct `/handbook/<slug>/<edition>/chapter/<n>/section/<m>` path.

### FCUM-20: Cross-origin wrap is correct

1. With both study and flightbag dev servers running on adjacent ports, inspect a chip rendered in the study app. **Expected:** the `href` carries the flightbag origin (different from the current page origin).
2. Open the flightbag app at `/handbook/<slug>`. Inspect any internal handbook chip / list-item. **Expected:** the `href` carries no origin prefix (same-origin path). No double-origin URL.

---

## Phase E -- constant deletion + close

### FCUM-21: Constants are deleted

1. Open `libs/constants/src/routes.ts`. **Expected:** no `LIBRARY` (line ~395), no `LIBRARY_REGULATIONS_SECTION`, no `LIBRARY_HANDBOOK`, no `LIBRARY_HANDBOOK_CHAPTER`, no `LIBRARY_HANDBOOK_SECTION`, no `LIBRARY_AIRCRAFT`.
2. **Expected:** `LIBRARY_STATE` (a non-route enum) is untouched.
3. Run `grep -rn "LIBRARY_HANDBOOK\|LIBRARY_HANDBOOK_CHAPTER\|LIBRARY_HANDBOOK_SECTION\|LIBRARY_REGULATIONS_SECTION\|LIBRARY_AIRCRAFT" libs/ apps/`. **Expected:** zero hits.

### FCUM-22: `bun run check` is clean

1. Run `bun run check all` (the full pipeline including svelte-check).
2. **Expected:** 0 errors, 0 warnings. Every gate passes.

### FCUM-23: No 301s anywhere in the migrated surfaces

1. Open the study app's home, library, memory, reps, and search surfaces in turn. For each: open the network tab; click every visible citation chip / library card / handbook navigator.
2. **Expected:** zero 301 status responses across the entire walk. The only redirects in the network tab should be unrelated (auth flow, login, etc.).

### FCUM-24: Citation rendering is unchanged

1. Open any card with a structured handbook citation. **Expected:** the chip renders with the same visible text, badge, and locator label as before this WP. The only change is the `href`.
2. Open any knowledge-node detail with citations. Same check.
3. Open a session detail page with rep citations. Same check.

### FCUM-25: External-link behaviour preserved

1. POH card external link (manufacturer). **Expected:** clicking opens the manufacturer site in a new tab; same as before.
2. CFR card external link (eCFR). **Expected:** clicking opens eCFR; same as before.
3. AC card external link. **Expected:** clicking opens the FAA AC index; same as before.

### FCUM-26: Help drawer + search palette behave correctly

1. Open the help drawer on any study page. **Expected:** result items render normally; no console warnings.
2. Open the global search palette. **Expected:** search works; flightbag-direct URLs in every result.

---

## Automated regression suite

### FCUM-A1: URL-for-reference test coverage

- `bun test libs/sources/src/url-for-reference` -- the helper test file. Every corpus has at least one positive test (returns the expected flightbag path) and one negative test (malformed locator -> `FLIGHTBAG_HOME`).
- New row-shape coverage from Phase A: handbook / CFR / AIM / AC / ACS / POH (fallback) / SAFO (fallback) / INFO (fallback) / NTSB (fallback).

### FCUM-A2: BC citation resolver test coverage

- `bun test libs/bc/study/src/references` -- coverage for `resolveHandbookCitationUrl` and `buildHandbookUrlFallback`. Each function has a chapter-only and a chapter+section variant test; each asserts the flightbag path shape.

### FCUM-A3: Browser-hydration smoke

- `bun playwright test tests/e2e/browser-hydration-smoke.spec.ts` -- the canonical smoke. Confirms `/memory`, `/study/learn`, `/reps`, `/library` hydrate cleanly post-migration. The smoke does NOT cover the `/dev/*` surfaces; the dispatcher walks those manually (FCUM-23).

### FCUM-A4: Route lint

- `bun run check` step that walks every `ROUTES.LIBRARY_*` reference and fails on any remaining call site. Phase E is the close-out; this lint replaces the grep step from FCUM-21 going forward.

---

## Close-out checklist

The WP is closable when, in order:

1. Every FCUM scenario above is `**Expected**` -> green. Items 1-3, 21-26 require browser walk; the rest are automated.
2. `bun run check all` is clean.
3. The six `LIBRARY_*` constants are deleted from `libs/constants/src/routes.ts`.
4. The user walks the test plan (`human_review_status: walked`). The user, not the agent, flips this field.
5. The user signs off (`human_review_status: signed-off`). Status flips to `shipped` only after this; only the user can flip.

Until the user walks FCUM-4 through FCUM-25 (or a representative subset) in a real browser and confirms zero 301s, the WP is not closable. Agent self-review (`agent_review_status: done`) is necessary but not sufficient.
