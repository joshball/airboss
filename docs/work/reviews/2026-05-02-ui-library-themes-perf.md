---
feature: ui-library-themes
category: perf
date: 2026-05-02
branch: main
counts:
  critical: 0
  major: 4
  minor: 6
  nit: 2
status: unread
review_status: done
closed_out: 2026-05-04
---

## Summary

Reviewed `libs/ui/`, `libs/themes/`, `libs/activities/`, and `libs/help/` for runtime performance, rendering efficiency, and event-handler hygiene. No "visible lag today" issues, but several scaling cliffs exist:

- The PFD rAF loop runs forever even when at quiescence (battery / GPU drain).
- Help search is sync-on-keystroke and walks every section body uncached; it scales linearly with both registry size and section length.
- Markdown code-block highlighting is awaited sequentially when it could parallelize.
- `HelpLayout` scroll listener does forced-layout reads on every scroll event, unthrottled.
- Several primitives create per-event allocations (focus-trap closure rebuilt per keydown).

The themes library's CSS emit pipeline runs at build time and is fine. `ThemeProvider`, `Tabs`, `Pager`, `DataTable`, and most popovers are clean.

## Issues

### MAJOR: PFD rAF loop runs forever; no quiescence detection

File: `/Users/joshua/src/_me/aviation/airboss/libs/activities/src/pfd/pfd-tick.svelte.ts:215-258` (`attachPfdTickLoop`) and `step()` at lines 192-204.

Problem: `onFrame` calls `state.step(dt)` and unconditionally schedules the next frame. `step()` always rewrites `this.rendered = { ... }` even when every channel is already at target (`target === rendered`). There is no idle-skip: once the loop attaches, it produces a new object reference and triggers downstream `$derived` recomputation on every tape / instrument 60 times per second, forever, even on a perfectly static PFD.

Impact: GPU + battery drain whenever a PFD is mounted. Mobile / laptop users will notice. With multiple instruments each consuming `tick.rendered.*`, every frame does a (small) re-layout pass on six SVG instruments for zero visible change. AltitudeTape additionally regenerates its `ticks` array (line 63-79, ~50 entries) per frame, so this also produces sustained allocation churn.

Fix: detect quiescence in `step()` -- when `|target - rendered| < EPSILON` for every channel, snap rendered = target and return early without writing. In `attachPfdTickLoop`, when the previous frame's step was a no-op, stop the rAF loop and re-arm it from `target` setters. Cheapest version: keep a `dirty` flag on `PfdTickState` flipped true by every `target` setter; the rAF callback bails (and stops scheduling) when not dirty, the input handlers re-arm the loop. Also short-circuit `AltitudeTape.ticks` (and the airspeed tape equivalent) when the visible window hasn't changed since last frame -- compare lo/hi to cached values and reuse the prior array.

### MAJOR: Help search runs synchronously on every keystroke with no debounce or memo

File: `/Users/joshua/src/_me/aviation/airboss/libs/help/src/ui/HelpSearchPalette.svelte:32` (`const results = $derived(search(rawQuery))`) and `/Users/joshua/src/_me/aviation/airboss/libs/help/src/registry.ts:68-85` (`helpRegistry.search`).

Problem: The palette wires the search through a plain `$derived`, so every keystroke synchronously calls `search()` -> `helpRegistry.search()` -> linear scan over every help page, calling `matchesFilters` and `rankBucket`. `rankHelpPage` (registry.ts:101) builds `[summary, ...sections.map((s) => s.body)]` for every page on every call, and `rankBucket` does `body.toLowerCase()` (search-core.ts:54) on every keyword/body for every page on every call. Nothing is precomputed at registration time. On the aviation side, `searchAviation` likewise allocates a fresh `Reference[]` (`hits.map((h) => h.reference)` at search.ts:89) per keystroke.

Impact: Today the corpus is small enough to hide this; once help pages grow into the dozens with multi-paragraph sections, the palette will visibly stall while typing. Each keystroke is `O(pages * sections * body_length)` of `String.prototype.toLowerCase` allocations.

Fix: Two changes.

1. Precompute lowercased haystacks at `registerPages` time. Store `searchBlob: string` and `lowerTitle / lowerAliases / lowerKeywords` on the indexed page (in a parallel map, not on the user-facing `HelpPage`). Same for aviation references in `@ab/aviation`'s registry.
2. Debounce the palette query. Mirror `CitationPicker.svelte`'s 200ms timer (it already does this for server-backed search) so an in-memory search still doesn't fire ten times during a fast type-burst. Cleanest version: a small `useDebouncedDerived` rune lib helper, applied at the palette boundary so individual call sites stay clean.

### MAJOR: Markdown code-block highlighting awaits sequentially

File: `/Users/joshua/src/_me/aviation/airboss/libs/help/src/markdown/index.ts:29-45` (`highlightAll`) and `/Users/joshua/src/_me/aviation/airboss/libs/help/src/ui/PageHelp.svelte:70-85` (`loadContent`).

Problem: `highlightAll` walks the AST with `for..of` + `await highlight(...)` per code node. Same code blocks could highlight in parallel: each Shiki call is independent once the highlighter is warm. `PageHelp.loadContent` repeats the pattern at the section level: `for (const section of helpPage.sections) { next[section.id] = await parseMarkdown(section.body); }`, so every section's parse + highlight is serialized.

Impact: Drawer open latency on a help page with multiple sections and code blocks is `sum(per-section-parse-time) + sum(per-block-highlight-time)` instead of `max(...)`. With Shiki's first-call warmup baked in, even a cold open of a 4-section page with one code block per section pays the full serial cost.

Fix: `Promise.all` both layers. In `highlightAll`, walk the tree synchronously to collect all `code` nodes plus a setter, then `await Promise.all(codeNodes.map((n) => highlight(...).then((h) => { n.highlighted = h; })))`. In `PageHelp.loadContent`, replace the for-loop with `await Promise.all(helpPage.sections.map(async (s) => [s.id, await parseMarkdown(s.body)]))` and build `next` from the resolved tuples.

### MAJOR: HelpLayout scroll handler reads layout on every scroll event

File: `/Users/joshua/src/_me/aviation/airboss/libs/help/src/ui/HelpLayout.svelte:41-60`.

Problem: `handleScroll` is wired to `window.scroll` (passive, good) but it iterates every section, calls `document.getElementById(section.id)`, and reads `el.offsetTop` per call. `offsetTop` is a layout-forcing property; called inside a scroll handler on a long help page with N sections, every scroll event triggers N forced layouts. There is no rAF throttle and no IntersectionObserver alternative.

Impact: On a help page with many sections, scrolling can jank, especially on lower-end laptops or when the page also has expensive content (code blocks, images). Today the help corpus is small; this is a scaling cliff, not a current bug.

Fix: Replace the manual offsetTop scan with an `IntersectionObserver` that watches every section heading and updates `scrolledActiveId` on intersection change. As a lighter interim fix, rAF-throttle the existing handler: keep a `pending = false` flag, only run the scan inside `requestAnimationFrame` when not pending, set `pending = true` until the rAF fires.

### MINOR: InfoTip resize/scroll listeners call getBoundingClientRect unthrottled

File: `/Users/joshua/src/_me/aviation/airboss/libs/ui/src/components/InfoTip.svelte:158-168`.

Problem: While a tooltip is pinned, `measureFlip` is wired to both `resize` and `scroll` (passive). Each invocation calls `getBoundingClientRect()` plus reads `window.innerHeight / innerWidth`. No rAF throttle.

Impact: A pinned tooltip during fast scroll can layout-thrash, and if multiple `InfoTip`s exist and one ends up pinned (or several across a session start screen), each contributes its own measure on every scroll event.

Fix: rAF-throttle `measureFlip`. Same shape as the HelpLayout fix; a single `pending` flag inside the effect closure, with the actual measurement deferred to the next frame.

### MINOR: BrowseList keys items by object reference, not stable id

File: `/Users/joshua/src/_me/aviation/airboss/libs/ui/src/components/BrowseList.svelte:33` (`{#each group.items as it (it)}`).

Problem: The component is generic over `T` and uses the item value itself as the `{#each}` key. If callers pass freshly-constructed objects on every render (a common pattern when results come from a load function and are mapped), Svelte sees a brand-new reference every render and unmounts/remounts every row. For lists of any size this defeats the purpose of keyed each.

Impact: Every parent re-render destroys and recreates the entire list of `BrowseListItem`s, including any local DOM state (focus, expanded state, scroll position within `extra` snippet content). Looks fine today because callers happen to memoize, but the API silently punishes anyone who doesn't.

Fix: Either (a) require `T extends { id: string | number }` on the component generic and key by `it.id`, mirroring `DataTable.svelte`'s `T extends { id: string }` constraint at line 32, or (b) take an explicit `keyOf?: (it: T) => string | number` prop with a fallback. (a) matches the rest of the design system.

### MINOR: Focus-trap closure rebuilt per keydown event

Files (all do the same thing):

- `/Users/joshua/src/_me/aviation/airboss/libs/ui/src/components/Drawer.svelte:62-66`
- `/Users/joshua/src/_me/aviation/airboss/libs/ui/src/components/Dialog.svelte:49-53`
- `/Users/joshua/src/_me/aviation/airboss/libs/ui/src/components/ConfirmAction.svelte:81-88`
- `/Users/joshua/src/_me/aviation/airboss/libs/ui/src/components/InfoTip.svelte:138-147`
- `/Users/joshua/src/_me/aviation/airboss/libs/ui/src/components/SnoozeReasonPopover.svelte:96-100`
- `/Users/joshua/src/_me/aviation/airboss/libs/ui/src/components/SharePopover.svelte:55-59`
- `/Users/joshua/src/_me/aviation/airboss/libs/ui/src/components/JumpToCardPopover.svelte:57-73`

Problem: Every keydown handler calls `createFocusTrap(panelEl, { onEscape: ... })`, allocating a new closure plus the inner `getFocusables` / `handleKeyDown` / `release` functions, then immediately invokes `handleKeyDown(event)`. The trap holds no state between calls, so the rebuild is throwaway.

Impact: Per-keystroke allocation pressure. Negligible today; piles up during fast typing inside a focus-trapped dialog and is wasted work the GC has to clean up.

Fix: Two options. (a) Make `createFocusTrap` memoize on `(container, onEscape)` -- but that adds a registry. (b) Cleaner: rework `focus-trap.ts` to export a pure `handleFocusTrapKeyDown(event, container, onEscape)` since the trap is stateless today. The `release` placeholder on the interface is unused; drop it. Each call site then calls `handleFocusTrapKeyDown(event, panelEl, close)` directly with no allocation.

### MINOR: Markdown img tags lack loading=lazy and dimensions

Files:

- `/Users/joshua/src/_me/aviation/airboss/libs/help/src/ui/MarkdownBody.svelte:142` (figure `<img>`)

Problem: Markdown figures render `<img src={node.src} alt={node.alt} />` with no `loading="lazy"`, no `decoding="async"`, and no width/height. Browsers can't reserve space, and every figure on a long help page loads eagerly even when offscreen.

Impact: CLS (cumulative layout shift) when help pages contain figures, and wasted bytes when the user never scrolls to them. Not a problem yet because help pages don't have many figures, but the current shape will hurt as soon as authors start writing image-heavy content.

Fix: Add `loading="lazy" decoding="async"` to the figure `<img>`. For dimensions, extend `figure` AST nodes to carry optional `width` / `height` (parsed from `![alt](src "caption" 800x600)` or a separate sidecar), or accept that markdown can't supply them and emit `aspect-ratio` via CSS based on a sensible default container.

### MINOR: Tape ticks recomputed every frame regardless of altitude band change

File: `/Users/joshua/src/_me/aviation/airboss/libs/activities/src/pfd/AltitudeTape.svelte:63-79` (and the same shape in AirspeedTape, HeadingIndicator).

Problem: `ticks` is `$derived.by(...)` reading `alt`. Every frame the rendered altitude moves (even sub-foot), and a fresh ~50-entry array of `{ ft, major, labeled }` objects is allocated, even though `lo`/`hi` only actually change when `alt` crosses a 100ft boundary.

Impact: Sustained allocation churn on every PFD frame. Compounds with the rAF-runs-forever issue above.

Fix: Snap to the band boundaries first. Compute a `band = $derived({ lo: Math.floor((alt - HALF) / 100) * 100, hi: ... })` and let `ticks = $derived.by(...)` read from `band`. Svelte's equality check on the band object (use a primitive key or Object.is on `band.lo + band.hi`) will skip the array rebuild between band crossings. Cheaper still: precompute the full ladder of ticks across the entire `[MIN_TAPE_FT, MAX_TAPE_FT]` range once at module init and slice it by `(lo, hi)` indices each render -- the slice is `O(visible)` integer math with no per-tick allocation.

### MINOR: CitationPicker reset effect re-fires search effect via state writes

File: `/Users/joshua/src/_me/aviation/airboss/libs/ui/src/components/CitationPicker.svelte:83-114`.

Problem: The `open` reset effect (lines 83-93) writes `query`, `results`, `selectedId`, etc. The search effect at lines 99-114 tracks `open`, `activeType`, and (via `query`) the cleared query. Opening the dialog therefore: (1) opens, (2) reset effect fires and zeros state, (3) search effect re-fires from the writes and re-arms the timer. Same pattern in `SnoozeReasonPopover.svelte`.

Impact: An extra effect cycle per dialog open. Not user-visible today but adds wasted work on every dialog open / close.

Fix: Combine into a single open-handler effect that does both the reset and timer arming, gated by a `wasOpen` flag like the snooze popover already uses (lines 132-163).

### NIT: JumpToCardPopover allocates an index array per render

File: `/Users/joshua/src/_me/aviation/airboss/libs/ui/src/components/JumpToCardPopover.svelte:113`.

Problem: `Array.from({ length: totalCards }, (_, i) => i)` is rebuilt on every render (including parent re-renders that pass identical props).

Impact: Tiny allocation per render. Negligible.

Fix: `const indices = $derived(Array.from({ length: totalCards }, (_, i) => i));` so it only rebuilds when `totalCards` actually changes. Or skip the array entirely with `{#each statuses as _, index (index)}` since `statuses.length === totalCards`.

### NIT: helpRegistry.search builds a body array per page per call

File: `/Users/joshua/src/_me/aviation/airboss/libs/help/src/registry.ts:101`.

Problem: `bodies: [page.summary, ...page.sections.map((s) => s.body)]` rebuilds the array for every page on every call to `rankBucket`. Same shape in `search.ts:204` for aviation references.

Impact: Tiny allocation per page per keystroke. Folds into the major search-perf issue above.

Fix: When fixing the major search issue, precompute `searchBodies` per page at registration time and store on the indexed-page record.

## Status as of 2026-05-04

| #   | Severity | Finding                                                  | Verdict                                                                                                                                                                                                                   |
| --- | -------- | -------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1   | Major    | PFD rAF loop runs forever; no quiescence                 | CLOSED -- `step()` returns `false` when every channel is inside its `QUIESCENCE_EPSILON`; rAF loop bails when not dirty and re-arms via reactive heartbeat (`pfd-tick.svelte.ts:156-310`).                                |
| 2   | Major    | Help search sync-on-keystroke + no precomputed haystacks | CLOSED -- `IndexedPage.searchHaystack` precomputed at register; palette uses `HELP_SEARCH_DEBOUNCE_MS` debounce; `rankBucketIndexed` reads pre-lowercased fields (`registry.ts:41-78`, `HelpSearchPalette.svelte:40-56`). |
| 3   | Major    | Markdown highlight + section parse serialized            | CLOSED -- both `highlightAll` and `PageHelp.loadContent` use `Promise.all` (`markdown/index.ts:29-58`, `PageHelp.svelte:73-87`).                                                                                          |
| 4   | Major    | HelpLayout offsetTop scan per scroll event               | CLOSED -- `IntersectionObserver` watches headings; falls back to scroll listener only when IO is unavailable (`HelpLayout.svelte:42-77`).                                                                                 |
| 5   | Minor    | InfoTip resize/scroll measureFlip unthrottled            | CLOSED in this audit -- new `scheduleMeasureFlip` rAF gate; resize/scroll listeners attach the throttled wrapper.                                                                                                         |
| 6   | Minor    | BrowseList key-by-reference                              | CLOSED -- `keyOf` prop with id fallback on `BrowseList.svelte:26-39`.                                                                                                                                                     |
| 7   | Minor    | Focus-trap closure rebuilt per keydown                   | CLOSED -- modal traps allocated once per open and `release()`d in cleanup; popovers delegate to Dialog (see correctness #7).                                                                                              |
| 8   | Minor    | Markdown img missing loading=lazy                        | CLOSED -- `MarkdownBody.svelte:147` ships `loading="lazy" decoding="async"`.                                                                                                                                              |
| 9   | Minor    | Tape ticks recomputed every frame                        | CLOSED -- `AltitudeTape.svelte` precomputes the full ladder at module init and slices by band-snapped indices (`AltitudeTape.svelte:34-95`).                                                                              |
| 10  | Minor    | CitationPicker reset-effect re-fires search              | CLOSED -- reset and search effects collapsed; reset clears state once on open transition; search effect uses token tracking (`CitationPicker.svelte:97-133`).                                                             |
| 11  | Nit      | JumpToCardPopover indices array per render               | CLOSED in this audit -- `indices = $derived(...)` so the array only rebuilds when `totalCards` changes.                                                                                                                   |
| 12  | Nit      | helpRegistry.search builds body array per call           | CLOSED -- folded into #2 (precomputed `searchHaystack` removes the per-call allocation).                                                                                                                                  |

All 12 findings closed.
