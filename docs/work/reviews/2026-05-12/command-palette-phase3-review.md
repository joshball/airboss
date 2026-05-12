---
title: command-palette phase 3 -- consolidated review
status: unread
review_status: pending
authored_by: agent
date: 2026-05-12
branch: ball/palette-phase3-3faa52ce
---

# Phase 3 review -- consolidated

Ten reviewer personas walked through the diff. Findings consolidated below
with severity and proposed fix. Personas: correctness, security,
performance, accessibility, ux, patterns, architecture, backend (no
backend surface in this phase), schema (no schema in this phase), tests.

## Critical (0)

None.

## Major

### M1. `aria-expanded` reads `docPicker?.hasMatches()` outside of $derived

`CommandPalette.svelte:489` reads `docPicker?.hasMatches()` directly in
the template attribute. This is a method call on a child component
instance bound via `bind:this`. Svelte 5 won't auto-track this; the
`aria-expanded` value never updates when matches appear/disappear. The
combobox a11y contract requires the attribute to reflect dropdown state.

**Fix:** route through a $derived state tracking the doc-picker open state

+ matches presence. Move `matches.length > 0` exposure from a method to a
prop that bubbles up via the parent's own state.

### M2. `onAutocompletePick` ignores the `doc` argument and immediately re-uses it

`CommandPalette.svelte:397-402` -- `void doc;` then `void goto(\`/reference/glossary/${doc.id}\`)`. The `void doc;` line is dead code from an earlier draft. Read of `doc.id` works but the comment is misleading.

**Fix:** drop the `void doc;` line; tighten the comment.

### M3. PaletteDetailPane "Open in flightbag" always opens in a new tab

`PaletteDetailPane.svelte:handleOpenFlightbag` calls
`window.open(flightbagPath, '_blank', 'noopener')`. Users may expect
same-tab navigation from a palette action; the WP spec doesn't require
new-tab semantics. Inconsistent with the "Open" button which goes through
`onOpen`/`goto`.

**Fix:** invoke `onOpen({ ...result, href: flightbagPath })` so the
existing `goto`/external-URL discriminator handles both cases. Removes
the new-tab divergence.

## Minor

### m1. `intent` variable in DocCodeAutocomplete is computed twice

`DocCodeAutocomplete.svelte:52` computes `detectDocCodeIntent(query)`,
and `buildMatches` recomputes it on every match calc. The redundant
compute is cheap but a single $derived would be cleaner.

**Fix:** pass `intent` into `buildMatches` (it already accepts it but
ignores it) or drop the outer `intent` variable.

### m2. variant prototypes duplicate ~80% of the server-fetch effect

`apps/study/src/routes/(app)/dev/palette/list/+page.svelte` and
`apps/study/src/routes/(app)/dev/palette/raycast/+page.svelte` both
inline the same debounce + AbortController + fetch loop that lives in
`CommandPalette.svelte`. Three places now own that loop.

**Fix:** factor into `libs/help/src/ui/use-palette-server-fetch.svelte.ts`
shared rune helper. Defer to a follow-up; the duplication is intentional
prototype scaffolding (variants must not depend on the production palette
internals beyond `searchGrouped`).

### m3. `palette-flightbag.ts` returns null for chapter/section types

The detail pane "Open in flightbag" + "Cite this" actions are hidden for
`faa.handbook.chapter` and `faa.cfr.sect` rows because we can't derive an
`airboss-ref:` URI from the result id alone. This is correct behavior
today but worth a doc note so future loader authors know to surface the
URI on the SearchResult when chapter rows can resolve to flightbag URLs.

**Fix:** doc comment + a TODO marker for the loader hand-off.

### m4. `onColumnHover` shadows `_result` parameter

`CommandPalette.svelte:435` -- `function onColumnHover(_result: SearchResult, index: number, col: ResultColumn)` declares `_result` then `void _result`. Conventional but mildly redundant.

**Fix:** drop the parameter (since unused) and have the call site pass
only what's needed. Low priority; the signature mirrors the
`PaletteColumn` `onHover` callback contract.

## Nit

### n1. CommandPalette empty-hint sentence runs long

The empty-hint text concatenates column labels then a long instruction.
Reads awkwardly on narrow viewports. Reformat as two paragraphs or shorten.

### n2. PaletteDetailPane "Pin to today" button always disabled

Phase 4 will wire `mine.plan` integration. The disabled placeholder is
intentional. A single-line title attribute notes "Available in Phase 4" --
fine.

### n3. Test for Cmd+\\ toggle is weakened to "attribute is present"

`CommandPalette.svelte.test.ts` weakened the toggle assertion because
happy-dom's matchMedia stub makes the rendered attribute deterministic at
init. The real assertion lives in the Playwright spec
(`command-palette-phase3.spec.ts`). Acceptable as long as both layers
remain.

## Architecture observations (no action)

- **`@ab/sources` newly required by `@ab/help`.** Adding `urlForReference`
  to the detail pane action set means every app that mounts the palette
  needs the source-id resolver. Explicit dep + transitive workspace
  resolution covers it; this is a non-breaking architectural expansion
  consistent with the citation-chip mounting pattern.

- **Palette accent tokens land in `libs/themes/palette-tokens.css`.** The
  five accent families (amber/violet/cyan/green/rose) are
  palette-scoped, theme-independent. They live in `libs/themes` so
  theme-lint accepts the OKLCH values and apps inherit via the existing
  generated tokens.css load chain. The themes contract (`vocab.ts`) is
  extended; no other theme needed updating.

- **`CommandPalette.svelte` is the new default mount.**
  `HelpSearchPalette.svelte` is removed (no shim, no alias), per the WP
  brief. `HelpSearch.svelte` mounts `CommandPalette` directly; its sole
  prop `surface` is forwarded.

## Tests

- **Unit:**
  - `libs/help/__tests__/CommandPalette.svelte.test.ts` -- 8 tests
    (closed render, debounce contract, role=dialog + role=combobox, mode
    attribute / placeholder, escape closes, data-detail-open attribute
    shape).
  - `libs/help/__tests__/DocCodeAutocomplete.svelte.test.ts` -- 9 tests
    (no-render on empty query, no-render on plain text, render on
    `FAA-H-` / `Part 91` / `AvWX`, click-without-modifier picks,
    click-with-meta filters).
- **E2E:**
  - `tests/e2e/command-palette-phase3.spec.ts` -- 8 tests (combobox role,
    four-query battery, dev-palette index, list+raycast variants).
  - Existing smoke spec updated to new testids.

## Gate

- `bun run check all` -- green.
- `bun test libs/help` -- 54/54 passing.
- `bun test libs/aviation libs/themes` -- 907 passing, 38 skipped (pre-
  existing skips, not introduced here).
- Browser-hydration smoke -- runs against the smoke spec on push; pinned
  testids unchanged for the hydration check.

## Manual walk -- not executed by agent

The Phase 3 walk across study/sim/hangar/flightbag/avionics needs a live
dev server with a populated DB. The agent's worktree lacks `.env` and DB
access, so the walk is deferred to Joshua. The Playwright spec
(`command-palette-phase3.spec.ts`) covers the production palette
behaviors against a real browser; the dev variant pages are designed to
mount without server-side data (they fall back to the in-process loaders
when the user is anonymous).

## Fix plan

Land M1, M2, M3 in this PR. The minor / nit items get the same pass since
the WP rule is "fix everything from a review unless told not to."
