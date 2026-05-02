# Chunk 5 -- UI library + themes -- patterns review

---
feature: ui-library-themes
category: patterns
date: 2026-05-02
branch: main
status: unread
review_status: pending
counts:
  critical: 2
  major: 3
  minor: 4
  nit: 2
---

## Summary

Scope reviewed: `libs/ui/`, `libs/themes/`, `libs/activities/`, `libs/help/`.

Overall the four libs adhere to the project's house style very well. Token usage is broad and consistent: 293 distinct `var(--space-*)` references vs only 55 raw rem values, all colors flow through tokens (no `#hex`, no `rgb(...)` in component CSS except the two cases below), `transition:` rules consistently use `var(--motion-*)`, `z-index:` rules consistently use `var(--z-*)`, `ROUTES` is used everywhere a path appears in the UI lib, `@ab/constants` is used for HANDBOOK enums and labels, and Svelte 5 runes are used throughout. No `:any`, no `!.` non-null assertions, no `<slot>`, no `export let`, no `$:`, no Svelte 4 stores, no `@ts-ignore`. Cross-lib imports use `@ab/*` aliases; intra-lib relative paths stay intra-lib. `as` casts are confined to DOM target narrowing.

Two critical violations stand out -- a hardcoded `rgba()` scrim in `HelpSearchPalette.svelte` when `--overlay-scrim` is the contracted token, and a magic `z-index: 100` in `PfdKeyboardLegend.svelte` when `--z-modal` is the contracted token. Both violate "primitives MUST use tokens." Beyond those, three convergent style issues -- `libs/help/src/ui/*` and the crosswind activity bypass the space-token grid with raw `0.25rem`/`0.5rem`/`0.75rem` etc., the cockpit-panel instruments hardcode `width: 200px; height: 200px` instead of em/rem-scaled sizing tokens, and `BrowseListItem` uses an off-grid `720px` breakpoint without the `/* --ab-breakpoint-* */` comment that the rest of the chunk follows.

The `SHIKI_THEME` "legacy export" with no remaining consumers should be retired on sight per the no-legacy rule.

## Issues

### CRITICAL: Hardcoded `rgba()` scrim instead of `--overlay-scrim` token

**File:** `/Users/joshua/src/_me/aviation/airboss/libs/help/src/ui/HelpSearchPalette.svelte:221`

**Problem:** The command-palette backdrop uses `background: rgba(15, 23, 42, 0.4);`. The themes contract defines `--overlay-scrim` (emit.ts:177, vocab.ts:124, generated/tokens.css:83) and the rest of the codebase routes scrims through it (`PfdKeyboardLegend.svelte:79` uses `var(--overlay-scrim)`). This palette is a primitive surface in `libs/help/`, ships with every help-enabled app, and bypasses every theme's per-appearance scrim opacity (light themes use 0.5, dark themes use 0.7-0.75).

**Rule:** "primitives MUST use tokens", "all colors via tokens", "NO hex/rgb/px in components".

**Fix:** Replace `background: rgba(15, 23, 42, 0.4);` with `background: var(--overlay-scrim);`. Re-test theme switching to confirm the palette tracks light/dark/sectional/flightdeck scrim opacity.

---

### CRITICAL: Hardcoded `z-index: 100` instead of `--z-modal` token

**File:** `/Users/joshua/src/_me/aviation/airboss/libs/activities/src/pfd/PfdKeyboardLegend.svelte:80`

**Problem:** The legend overlay uses `z-index: 100;`. Every other modal/dialog/popover surface in the chunk routes through `var(--z-modal)` (`Dialog.svelte:116`, `Drawer.svelte:126`, `JumpToCardPopover.svelte:143`, `SnoozeReasonPopover.svelte:269`, `SharePopover.svelte:154`). The PFD keyboard legend is conceptually a modal -- it has a scrim, focus trap pattern, and Escape-to-close, so it should sit at the modal tier and be uniformly covered by future system-level overlays (toasts, command palette).

**Rule:** "No magic strings/numbers", "All literal values in `libs/constants/`", "primitives MUST use tokens".

**Fix:** Replace `z-index: 100;` with `z-index: var(--z-modal);`.

---

### MAJOR: Off-grid spacing values throughout `libs/help/src/ui/*` instead of `--space-*` tokens

**Files:**
- `/Users/joshua/src/_me/aviation/airboss/libs/help/src/ui/HelpCard.svelte:44`
- `/Users/joshua/src/_me/aviation/airboss/libs/help/src/ui/HelpTOC.svelte:45,50`
- `/Users/joshua/src/_me/aviation/airboss/libs/help/src/ui/HelpLayout.svelte:102,134,141`
- `/Users/joshua/src/_me/aviation/airboss/libs/help/src/ui/HelpSection.svelte:81,86,95,98`
- `/Users/joshua/src/_me/aviation/airboss/libs/help/src/ui/HelpSearch.svelte:70,71`
- `/Users/joshua/src/_me/aviation/airboss/libs/help/src/ui/HelpSearchPalette.svelte:242,251,265,298,309,315,352,365`
- `/Users/joshua/src/_me/aviation/airboss/libs/help/src/ui/MarkdownBody.svelte:204,289,326,358`
- `/Users/joshua/src/_me/aviation/airboss/libs/help/src/ui/ExternalRefsFooter.svelte:62,102`

**Problem:** The help library bypasses the space-token grid with raw rem values. For example: `padding: 0.5rem 0 1rem;` (HelpSection), `gap: 0.25rem;` (HelpTOC), `padding: 0.75rem 1rem;` (HelpCard, MarkdownBody, HelpSearchPalette), `padding: 0.5rem 0.625rem;` (HelpSearchPalette). The themes lib defines a full ladder: `--space-2xs: 0.25rem`, `--space-xs: 0.375rem`, `--space-sm: 0.5rem`, `--space-md: 0.75rem`, `--space-lg: 1rem`, `--space-xl: 1.5rem`. The `libs/ui/src/components/*` peer set already uses these tokens consistently (Dialog, PanelShell, Drawer, etc.), so help is the one inconsistent subtree.

A few off-grid values like `0.0625rem`, `0.125rem`, `0.45rem`, `0.625rem`, `0.9rem` have no token equivalent and indicate either typos or values that need a new token. These should be reconciled, not preserved as-is.

**Rule:** "All literal values in `libs/constants/`. Enums, routes, ports, config." (extended to design tokens via "primitives MUST use tokens"); "NO hex/rgb/px in components, rem-based, all colors via tokens, no inline pixel values for spacing/font-size; primitives MUST use tokens."

**Fix:** Walk each file and substitute the matching `--space-*` token (`0.25rem` -> `--space-2xs`, `0.375rem` -> `--space-xs`, `0.5rem` -> `--space-sm`, `0.75rem` -> `--space-md`, `1rem` -> `--space-lg`, `1.5rem` -> `--space-xl`). For off-grid values, snap to the nearest token unless there's a documented design reason; if a real new step is needed (e.g. for a 2px-tall divider), add it to the contract rather than inlining. Same one-pass treatment applies to `libs/activities/src/crosswind-component/CrosswindComponent.svelte:594,622,642,648` (`0.15rem`, `0.1rem 0.45rem`, `0.9rem`, `0.4rem`).

---

### MAJOR: Cockpit-panel instruments hardcode `200px` sizing in primitives

**Files:**
- `/Users/joshua/src/_me/aviation/airboss/libs/activities/src/cockpit-panel/Tachometer.svelte:101-102`
- `/Users/joshua/src/_me/aviation/airboss/libs/activities/src/cockpit-panel/HeadingIndicator.svelte:106-107`
- `/Users/joshua/src/_me/aviation/airboss/libs/activities/src/cockpit-panel/Asi.svelte:122-123`
- `/Users/joshua/src/_me/aviation/airboss/libs/activities/src/cockpit-panel/Altimeter.svelte:88-89`
- `/Users/joshua/src/_me/aviation/airboss/libs/activities/src/cockpit-panel/TurnCoordinator.svelte:87,94-95`
- `/Users/joshua/src/_me/aviation/airboss/libs/activities/src/cockpit-panel/AttitudeIndicator.svelte:88-89`
- `/Users/joshua/src/_me/aviation/airboss/libs/activities/src/cockpit-panel/Vsi.svelte:91,98-99`
- `/Users/joshua/src/_me/aviation/airboss/libs/activities/src/cockpit-panel/cluster/FuelGauge.svelte:56-57,76`
- `/Users/joshua/src/_me/aviation/airboss/libs/activities/src/cockpit-panel/cluster/ClusterGauge.svelte:98-99`
- `/Users/joshua/src/_me/aviation/airboss/libs/activities/src/pfd/PfdKeyboardLegend.svelte:92` (`max-width: 560px`)

**Problem:** Every cockpit-panel instrument fixes its outer container to `width: 200px; height: 200px`. SVG `viewBox="0 0 200 200"` interior coordinates are correct (those are unitless geometry, not styling), but the outer wrapper imposes a hard pixel size. `libs/ui/src/components/Spinner.svelte` solves the same problem with `1rem`/`1.5rem`/`2rem` size tokens; the activity instruments should follow that pattern so a low-vision user setting larger root font size gets larger instruments, and so the sim app can compose a denser or roomier panel layout without overriding from outside the lib.

**Rule:** "NO hex/rgb/px in components, rem-based, ... no inline pixel values for spacing/font-size; primitives MUST use tokens."

**Fix:** Convert the wrapper sizing to rem (e.g. `width: 12.5rem; height: 12.5rem;`) or, better, expose a sizing token (`--instrument-size-md`) and let consumers override on the parent. Same treatment for `PfdKeyboardLegend.svelte:92`'s `max-width: 560px`.

---

### MAJOR: Retire `SHIKI_THEME` legacy export

**Files:**
- `/Users/joshua/src/_me/aviation/airboss/libs/help/src/markdown/highlight.ts:33-37`
- `/Users/joshua/src/_me/aviation/airboss/libs/help/src/markdown/index.ts:16`
- `/Users/joshua/src/_me/aviation/airboss/libs/help/src/index.ts:17`

**Problem:** `SHIKI_THEME` is documented in-file as "Legacy export: ... Retained for code that read the single-theme constant before dual-theme support landed." A grep for `SHIKI_THEME\b` (excluding `SHIKI_THEME_LIGHT` / `SHIKI_THEME_DARK`) finds zero consumers outside the re-exports themselves. Per the project memory rule "No legacy in airboss -- retire on sight. No `TODO(retire)`, no scheduled-cleanup cron jobs. If it's dead today, drop it today."

**Rule:** "No legacy in airboss -- retire on sight."

**Fix:** Delete the `SHIKI_THEME` constant and both re-exports. Update `markdown/index.ts:16` and `src/index.ts:17` to drop the symbol. Run `bun run check` and the help-lib tests to confirm no callers depend on it.

---

### MINOR: Hardcoded breakpoint `720px` without doc comment in `BrowseListItem`

**File:** `/Users/joshua/src/_me/aviation/airboss/libs/ui/src/components/BrowseListItem.svelte:108`

**Problem:** The component declares `@media (max-width: 720px)` -- a unique breakpoint not used elsewhere in the chunk. Every other media query in scope follows the convention `@media (max-width: 640px) { /* --ab-breakpoint-md */ }` (CrosswindComponent:450, HelpLayout:147, HelpSearch:106, HelpSearchPalette:380), referencing the named breakpoint scale even though CSS custom properties cannot be used directly inside `@media`.

**Rule:** "No magic strings/numbers", consistency convention.

**Fix:** Either snap to the nearest scale breakpoint (640px or whatever the next step up is) and add the `/* --ab-breakpoint-* */` reference comment, or, if 720px is intentional, justify it inline (e.g. `/* row-pair collapses below this width */`). Leaving it bare invites drift.

---

### MINOR: `as unknown as ShikiHighlighter` double cast without justification

**File:** `/Users/joshua/src/_me/aviation/airboss/libs/help/src/markdown/highlight.ts:69`

**Problem:** `return h as unknown as ShikiHighlighter;` is a type-safety escape hatch with no inline comment explaining why the local interface diverges from Shiki's `Highlighter`. CLAUDE.md says "no `as` without comment." This one needs an explanation -- e.g. "Shiki's Highlighter exposes ~20 methods; we model only the subset we use to keep the import surface narrow."

**Rule:** "No `as` without comment."

**Fix:** Add a single-line explanatory comment on line 69, or restructure so the return type is `Awaited<ReturnType<typeof shiki.createHighlighter>>` and the local `ShikiHighlighter` interface is dropped.

---

### MINOR: Sub-rem hardcoded sizes in primitives

**Files:**
- `/Users/joshua/src/_me/aviation/airboss/libs/ui/src/components/InfoTip.svelte:244-245` (`width: 1.125rem; height: 1.125rem;`)
- `/Users/joshua/src/_me/aviation/airboss/libs/ui/src/components/Checkbox.svelte:88-90` (`0.875rem`, `1rem`, `1.25rem`)
- `/Users/joshua/src/_me/aviation/airboss/libs/ui/src/components/FilterCard.svelte:79` (`min-height: 1.25rem;`)
- `/Users/joshua/src/_me/aviation/airboss/libs/ui/src/components/ConfidenceSlider.svelte` (visual scale)

**Problem:** Icon-tier sizes (1rem, 1.125rem, 1.25rem) are inlined per-component rather than reading from a sizing token (`--icon-size-sm`, `--icon-size-md`, `--icon-size-lg`). Spinner.svelte has the same shape but for spinners specifically. Without a shared token, two icons that should match visually can drift.

**Rule:** Convergence -- "primitives MUST use tokens."

**Fix:** Add icon-size tokens to the themes contract (`--icon-size-sm: 0.875rem`, `--icon-size-md: 1rem`, `--icon-size-lg: 1.25rem`) and route Spinner / Checkbox / InfoTip's icon dimensions through them. Keep this as one focused pass rather than inlining per-component.

---

### MINOR: Off-grid sizing constraints (28rem, 32rem, 36rem, 18rem, 20rem) inlined per component

**Files:**
- `/Users/joshua/src/_me/aviation/airboss/libs/ui/src/components/Dialog.svelte:132-134` (`24rem`, `36rem`, `54rem`)
- `/Users/joshua/src/_me/aviation/airboss/libs/ui/src/components/Drawer.svelte:163-165` (`20rem`, `32rem`, `48rem`)
- `/Users/joshua/src/_me/aviation/airboss/libs/ui/src/components/InfoTip.svelte:278-280` (`14rem`, `18rem`, `20rem`)
- `/Users/joshua/src/_me/aviation/airboss/libs/ui/src/components/JumpToCardPopover.svelte:151-152` (`24rem`, `28rem`)
- `/Users/joshua/src/_me/aviation/airboss/libs/ui/src/components/SharePopover.svelte:162-163` (`28rem`, `32rem`)
- `/Users/joshua/src/_me/aviation/airboss/libs/ui/src/components/SnoozeReasonPopover.svelte:277-278` (`32rem`, `36rem`)

**Problem:** Each overlay-style component picks its own sizes. Dialog `sz-md = 36rem` while Drawer `sz-md = 32rem`. These should either be shared tokens (`--overlay-size-sm`, `--overlay-size-md`, `--overlay-size-lg`) or explicitly justified per component with a comment. Right now there's no contract.

**Rule:** Convergence -- shared visual sizes belong in tokens.

**Fix:** Either introduce overlay-size tokens or document why each surface has a different scale. Recommend tokenization since `Dialog.sz-*` and `Drawer.sz-*` clearly intend the same thing.

---

### NIT: SVG inline `font-size="10"` / `font-size="11"` etc. on instrument labels

**File:** `/Users/joshua/src/_me/aviation/airboss/libs/activities/src/cockpit-panel/Tachometer.svelte:79,90,93` (representative -- same pattern in every cockpit-panel instrument)

**Problem:** Tick labels and digital readouts use SVG-attribute `font-size="10"` / `"11"` / `"15"` -- unitless SVG user-coordinate values, not CSS px. They scale correctly with the SVG viewBox, so they're not "px in components" violations. But they're repeated across instruments without a shared `INSTRUMENT_LABEL_SIZE` constant in `libs/bc-sim` or `libs/activities`. If the panel ever needs a denser variant, every instrument gets edited.

**Rule:** "All literal values in `libs/constants/`."

**Fix:** Extract `INSTRUMENT_TICK_FONT_SIZE = 10`, `INSTRUMENT_UNIT_FONT_SIZE = 11`, `INSTRUMENT_READOUT_FONT_SIZE = 15` (or similar named family) into a constants module that all instruments share.

---

### NIT: `box-shadow: 0 0 0 3px var(--focus-ring)` repeated instead of a shared focus token

**Files:**
- `/Users/joshua/src/_me/aviation/airboss/libs/ui/src/components/SharePopover.svelte:194,224`
- `/Users/joshua/src/_me/aviation/airboss/libs/ui/src/components/SnoozeReasonPopover.svelte:309,488`
- `/Users/joshua/src/_me/aviation/airboss/libs/ui/src/components/BrowseListItem.svelte:69`

**Problem:** Same focus-ring shadow recipe written by hand in five places. The `3px` offset is the only literal; everything else is tokenized. A single `--focus-ring-shadow` (or `box-shadow: var(--focus-ring-shadow);`) would close the gap.

**Rule:** Convergence -- "primitives MUST use tokens."

**Fix:** Add `--focus-ring-shadow: 0 0 0 3px var(--focus-ring);` to the themes contract and substitute. Keep this in the same pass as the icon-size token work.
