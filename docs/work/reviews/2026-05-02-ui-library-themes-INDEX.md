---
feature: ui-library-themes
date: 2026-05-02
branch: main
reviewers_run: 9
total_issues: 192
critical: 14
major: 58
minor: 64
nit: 30
---

# 10x Review -- Chunk 5: UI library + themes

9 reviewers, all complete. Scope: `libs/ui/`, `libs/themes/`, `libs/activities/`, `libs/help/`.

## Summary table

| Category     | Critical | Major | Minor | Nit | Total | File |
|--------------|---------:|------:|------:|----:|------:|------|
| correctness  |        0 |     4 |     9 |   3 |    16 | [link](2026-05-02-ui-library-themes-correctness.md) |
| perf         |        0 |     4 |     6 |   2 |    12 | [link](2026-05-02-ui-library-themes-perf.md) |
| architecture |        2 |     4 |     3 |   2 |    11 | [link](2026-05-02-ui-library-themes-architecture.md) |
| a11y         |        6 |    17 |    11 |   5 |    39 | [link](2026-05-02-ui-library-themes-a11y.md) |
| patterns     |        2 |     3 |     4 |   2 |    11 | [link](2026-05-02-ui-library-themes-patterns.md) |
| testing      |        1 |     7 |    11 |   4 |    23 | [link](2026-05-02-ui-library-themes-testing.md) |
| dx           |        0 |     4 |     7 |   5 |    16 | [link](2026-05-02-ui-library-themes-dx.md) |
| ux           |        3 |    14 |     8 |   5 |    30 | [link](2026-05-02-ui-library-themes-ux.md) |
| svelte       |        0 |     1 |     4 |   4 |     9 | [link](2026-05-02-ui-library-themes-svelte.md) |
| **TOTAL**    |   **14** |**58** |**63** |**32**|**167**| |

## Critical findings (14)

### Architecture (2)

1. Circular dependency between `@ab/ui` and `@ab/help`. `libs/ui/src/components/InfoTip.svelte` imports `helpRegistry` from `@ab/help`, while `libs/help/src/ui/PageHelp.svelte` imports `Drawer` from `@ab/ui/components/Drawer.svelte`. Real runtime cycle (both used on the same routes). Fix: invert InfoTip side -- pass help-page resolution in as a prop so `@ab/ui` stays a leaf.
2. `libs/help/package.json` does not declare its `@ab/ui` dependency despite importing it. Manifest out of sync with imports.

### Patterns (2)

3. `libs/help/src/ui/HelpSearchPalette.svelte:221` uses raw `rgba(15, 23, 42, 0.4)` for the backdrop scrim despite `--overlay-scrim` being the contracted token (defined in `libs/themes/emit.ts:177`, used by every other scrim).
4. `libs/activities/src/pfd/PfdKeyboardLegend.svelte:80` uses magic `z-index: 100` instead of `var(--z-modal)`.

### a11y (6)

5. **Crosswind activity OVER DEMO badge invisible**: `color` and `background` set to the same `--action-hazard` token. Safety-critical warning text is invisible to all sighted users.
6. Card-as-link primitives (`BrowseListItem`, `HandbookCard`, `HandbookSectionListItem`, `LibraryCard`) suppress focus indicator with `outline: none` and only flip border color -- one root fix touches all four.
7. `HelpSearchPalette` declares `role="dialog"` + `aria-modal` but has no focus trap, plus its input has `outline:none` on focus-visible.
8. 11 SVG instruments (PFD + cockpit panel) declare `role="img"` with no accessible name (aria-label sits on a wrapper div, not the SVG itself).
9. `HandbookReadProgressControl` segmented radios are visually hidden with no focus-within indicator on the segment labels.
10. `lamp-flash` keyframes ignore `prefers-reduced-motion` -- 1.25 Hz flash with no opt-out (WCAG 2.3.3).

### Testing (1)

11. `AmendmentPanel.svelte.test.ts:67` collapses to `expect(textContent).toContain('')` whenever `HANDBOOK_AMENDMENT_BADGE_LABEL !== 'Amended'` -- a tautology that silently disables the entire ErrataEntry content verification.

### UX (3)

12. Crosswind `OVER DEMO` badge invisible (same as a11y #5 -- listed in both reviews).
13. `HandbookReadProgressControl` keyboard-blocked segmented radios -- real inputs have `pointer-events: none` with no replacement.
14. `Button.loading` ships no spinner -- loading is silent unless caller passes `loadingLabel`.

## Convergent / root-cause findings

### Misplaced aviation-specific UI in @ab/ui (3 reviewers, 1 critical-adjacent)
- **architecture (major)**: `libs/ui/src/handbooks/*` (9 components) is FAA-handbook-specific chrome consumed only by study/library routes. Belongs in `libs/aviation/src/ui/`.
- **architecture (major)**: `libs/ui/src/library/LibraryCard.svelte` is the same shape -- aviation-taxonomy card consumed only by study library routes.
- **architecture (major)**: `libs/help/src/ui/HelpSection.svelte` deep-imports `@ab/aviation/ui/ReferenceText.svelte` but `libs/aviation/package.json` has no `exports` field declaring the subpath.
- **Root cause**: aviation-domain UI has accumulated in the generic UI lib. Move to `libs/aviation/src/ui/` (already houses `ReferenceCard`/`ReferenceText`); add `exports` to aviation `package.json`.

### Custom popovers reinvent Dialog/Button (2 reviewers)
- **ux (convergent)**: 5 separate modal implementations (`SnoozeReasonPopover`, `SharePopover`, `JumpToCardPopover`, `CitationPicker`, `PfdKeyboardLegend`) each reinvent scrim + close button + `.btn primary/ghost` despite `Dialog.svelte` and `Button.svelte` existing. Same root cause behind inconsistent close glyph (`x` ASCII / `&times;` / `×`).
- **a11y (major)**: same 5 popovers have inconsistent keyboard support -- no listbox/tabs/dialog roving-tabindex.
- **Root cause**: refactor the 5 popovers onto `Dialog` + roving-tabindex helpers. Closes ~6 a11y findings + the UX inconsistency.

### Token bypass clusters (3 reviewers)
- **patterns (critical)**: `HelpSearchPalette` raw `rgba()` scrim; `PfdKeyboardLegend` magic `z-index: 100`.
- **patterns (major)**: `libs/help/src/ui/*` subtree bypasses `--space-*` token grid (8 files, ~25 raw rem values that map to existing tokens).
- **patterns (major)**: 9 cockpit-panel instruments hardcode `width: 200px; height: 200px` on outer wrappers (should be rem or token-sized like Spinner).
- **svelte (minor)**: same -- raw rem in `MarkdownBody.svelte`.
- **ux (multiple)**: `--ink-inverse` used as surface color in `BrowseListItem`/`FilterCard`/4 popovers; `LibraryCard` uses `-edge` token for foreground text.
- **Root cause**: one finishing-pass token migration once UX/Svelte fixes land.

### `:focus-visible { outline: none }` cluster
- **a11y (critical)**: `BrowseListItem`, `HandbookCard`, `HandbookSectionListItem`, `LibraryCard` all suppress outline and only flip border color.
- **Root cause**: same fix in 4 files -- restore visible focus ring meeting 3:1 contrast.

### Color-only link affordance
- **a11y (multiple)**: `MarkdownBody`, `CitationChips`, `CitedByPanel`, `InfoTip` rely on color alone to mark links.
- **Root cause**: add underline / explicit affordance to each link primitive once.

### Missing exports field on libs that have shipped subpath imports
- **architecture (minor)**: `@ab/themes`, `@ab/help`, `@ab/activities`, `@ab/aviation` all ship documented subpath imports without an `exports` field in `package.json`. Only `@ab/ui` has the contract written.
- **dx (major)**: `pre-hydration.ts:22-31` documents a real shipped outage caused by this exact resolution-order ambiguity, yet the fix wasn't generalized.
- **Root cause**: add `exports` map to all 4 libs at once. Same shape as `@ab/ui`'s.

### Eager full-bundle imports
- **perf (major)**: `(app)/+layout.svelte` static-imports `$lib/help/register` -- ~2,300 lines of help/concept content into every signed-in page bundle, even though only `/help/*` consumes the bodies.
- **dx (minor)**: `ThemePicker` snapshots `listThemes()` at module-init.
- **Root cause**: split the help registry into "navigation/index" (always loaded) + "content bodies" (lazy). Same trick applies to themes.

### Focus-trap allocation per keystroke
- **perf (minor)**: `Dialog`, `Drawer`, `SnoozeReasonPopover`, `JumpToCardPopover`, `ConfirmAction`, `InfoTip` allocate fresh `createFocusTrap` per keystroke instead of once per modal-open.
- **dx (major)**: same -- functionally correct today (because `release()` is a no-op), but a future change adding a real document listener would silently leak across 6 call sites.
- **Root cause**: hoist `createFocusTrap()` to module-mount level inside each modal component (or share via a snippet helper).

### `libs/activities/` ships zero tests
- **testing (major)**: cockpit-panel, crosswind-component, pfd source -- no tests at all.
- **Root cause**: add per-component DOM-contract tests matching the `libs/ui/__tests__/` pattern. PFD and crosswind have rotation/mapping helpers ripe for unit tests if extracted.

### PFD/altitude tape rAF allocation
- **perf (major)**: rAF loop runs at 60fps forever even at quiescence. AltitudeTape rebuilds tick array every frame even when bands haven't crossed boundaries.
- **Root cause**: precompute tick ladder once; snap to band boundaries in `$derived`.

### Help search perf
- **perf (major)**: sync-on-every-keystroke search with no precomputed lowercased haystacks and no debounce -- O(pages × sections × body_length) per keystroke.
- **perf (major)**: markdown highlighting + section parsing run sequentially with await -- drawer-open latency is `sum(...)` instead of `max(...)`.
- **perf (major)**: `HelpLayout` scroll handler reads `offsetTop` per section per scroll event with no rAF throttle and no IntersectionObserver -- forced layout × N sections per scroll.

### CitationPicker bugs
- **correctness (major)**: stuck `loading` flag in CitationPicker race when switching to External-Ref mid-fetch.
- **a11y (major)**: listbox has no keyboard navigation despite ARIA roles.
- **Root cause**: refactor as part of the popover-to-Dialog migration.

### Markdown parser inconsistencies
- **correctness (major)**: `findUnescaped` disagrees with `parseInlineUntil` on which `\<c>` sequences are escapes -- drops emphasis under literal backslashes.
- **correctness (major)**: query-parser tokenizer doesn't break on `"` inside bare tokens; silently swallows unterminated quotes.

### `ConfirmDialog` reactivity bug
- **svelte (major)**: passes `{open}` to child `Dialog` without `bind:`. Dialog writes `open = false` on close; non-reactive write because prop is not bindable from this caller. (Other Dialog caller, `CitationPicker`, uses `bind:open` correctly.)

## What's clean (preserve)

- **patterns/svelte**: 293 `var(--space-*)` references vs 55 raw rem; no `:any`, no `!.`, no Svelte 4 patterns; `ROUTES` and `@ab/constants` consistently used; transitions and z-indexes routed through motion/z tokens almost everywhere; zero `$:`, zero `export let`, zero `<slot>`, zero `$app/stores`, zero legacy stores or lifecycle hooks; all `{#each}` keyed.
- **architecture**: themes' single dependency is `@ab/constants`; surface-specific theme bundles correctly co-located inside the themes registry.
- **a11y**: shared `Dialog`/`Drawer`/`Tabs`/`Spinner`/`Button` primitives are well-built -- focus trap, ESC, focus-return, `aria-modal` correct. The problems are concentrated in older components that haven't migrated onto the primitives.
- **dx**: error messages from `getTheme` and the help validator are particularly good; consistent `data-testid` / `data-state` / `data-variant` triplet across primitives makes Playwright failures readable.
- **correctness**: themes derivation, contrast math, focus-trap helper, data-table-sort helpers, pre-hydration script generator are all correct. No data-loss/corruption hazards.
- **testing**: pure-function suites tight; no `vi.mock`; no `it.skip`/`it.todo`; no commented-out tests.

## Recommended fix order

1. **Critical-first** (in order):
   - Crosswind OVER DEMO badge same-token foreground/background (a11y + ux)
   - InfoTip ↔ PageHelp circular dep (architecture)
   - `libs/help/package.json` declare `@ab/ui` dep
   - `AmendmentPanel.svelte.test.ts` tautology fix
   - `HandbookReadProgressControl` keyboard-blocked radios
   - `Button.loading` ship a spinner
   - 4 card-link `outline: none` -> visible focus ring
   - PfdKeyboardLegend `z-index: 100` -> `--z-modal`
   - HelpSearchPalette raw rgba scrim -> `--overlay-scrim` + add focus trap
   - 11 SVG `role="img"` -> add `aria-label` to the SVG element
2. **Convergent root-causes**:
   - Migrate aviation UI from `libs/ui` to `libs/aviation/src/ui/` + add `exports` to all 4 libs (one structural pass)
   - Refactor 5 custom popovers onto `Dialog` (closes ~6 a11y, ~3 ux, ~1 correctness, ~1 perf finding)
   - Hoist `createFocusTrap` to module-mount in all 6 modal components
   - Lazy-load help content bodies (closes the 2.3k-line bundle finding)
   - Add tests to `libs/activities/`
3. **Targeted majors**: PFD rAF/AltitudeTape, help search perf cluster, ConfirmDialog `bind:open`, citation-picker stuck-loading, markdown parser inconsistencies.
4. **Token migration LAST**: token-bypass clusters in help/activities/MarkdownBody -- finishing pass per project convention (token migration runs after UX/a11y/style edits, not in parallel).

## Severity guide

- **critical**: shared primitives ship invisible content / break a11y access / circular dep / false-confidence test
- **major**: convergent pattern issue affecting many call sites / reactivity bug / won't-scale rendering
- **minor**: localized DiD gap, naming, missing test
- **nit**: polish, style preference
