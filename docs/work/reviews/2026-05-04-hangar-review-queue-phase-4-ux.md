---
title: 'Phase 4 UX Review: Hangar Review Queue'
reviewer: ux
date: 2026-05-04
diff: d0dea9b9...0d5c3428
---

# Phase 4 UX Review: Hangar Review Queue

## Summary

- Files reviewed: 14
- Critical: 1
- Major: 8
- Minor: 9
- Nit: 6

The board renders, drags work, and the keyboard alternate exists, but Phase 4 ships several user-facing dead ends: the item dispatcher 404s today for every kind because no per-kind pages have shipped, drop targets are invisible until the user starts dragging, error toasts have no dismiss and no auto-clear, and filtered empty results show a per-column "No items." with no top-level "no matches / clear filters" affordance. The "Move to..." menu has no Escape-to-close, no outside-click-to-close, no roving focus, and no announcement on success. The Refresh status line never goes away. Several spec items (status selector, bucket detail back-affordance from the board, "results count visible") are missing.

## Findings

### Critical

#### 1. Item dispatcher route is a guaranteed dead-end for every click today

- **Location**: `apps/hangar/src/routes/(app)/review/items/[itemId]/+page.server.ts:17-22`, board `+page.svelte:117` (drawer items use `ROUTES.HANGAR_REVIEW_ITEM`), `+page.svelte:259` (item card `href`), `buckets/[id]/+page.svelte:32` (bucket detail item links)
- **Problem**: Every clickable item title on the board, every bucket-drawer link, and every link on the bucket detail page routes through `/review/items/[itemId]`, which 303-redirects to `/review/[kind]/[itemId]`. No `/review/[kind]/...` page exists in this branch (only `buckets/` and `items/` subroutes). Every click lands on a SvelteKit 404. The dispatcher's own header comment acknowledges this: "a direct hit on a kind that hasn't shipped its page yet 404s."
- **Why it matters**: The board is the user's entry point to actually doing review work. Phase 4 ships the navigation chrome but every navigation produces a hard 404 with no in-app context, no back button, no "this view isn't built yet" message. The whole board reads as "broken" until per-kind pages ship in a later phase. A reviewer who opens `/review` for the first time will conclude the feature doesn't work.
- **Fix**: Either (a) gate the item-card click and bucket-drawer link rendering when no per-kind page exists -- show the title as plain text with a "kind view not yet implemented" tooltip instead of a link, or (b) ship a stub `/review/[kind]/[itemId]/+page.svelte` placeholder that renders item title, ref, and "Per-kind view ships in Phase N" with a back-link to `/review`. Option (b) is preferable -- the spec explicitly lists the dispatcher as the right pattern, but Phase 4 has to deliver a non-broken click target. Prime directive applies: do not ship a feature whose every link is a 404.

### Major

#### 2. Move action error has no recovery path and no dismiss

- **Location**: `apps/hangar/src/routes/(app)/review/+page.svelte:33,146-160,229-231`
- **Problem**: `lastError` is set on move failure and rendered inline as `<p class="status-line error" role="alert">{lastError}</p>`, but: (a) there is no dismiss button, (b) it does not auto-clear after a timeout, (c) it persists across subsequent successful drags (only a successful move resets it on `result.type !== 'failure'` -- but if the user then refreshes, runs the loader, etc., the error stays put), (d) a successful drag clears it silently -- there's no positive confirmation for the success case. Combined with `invalidateAll()` redrawing the board, the user can be left staring at "Move failed -- frontmatter could not be written." with no way to know whether the second drag they just did succeeded.
- **Why it matters**: Persistent error banner with no dismiss is a known UX anti-pattern. The user can't tell if the last action succeeded.
- **Fix**: Replace inline `<p>` with a toast component (or reuse the project's existing toast pattern), with a close affordance and an auto-dismiss after ~5 s for non-blocking errors. Show a brief positive confirmation on success ("Moved to In Progress").

#### 3. Drag has no visible drop targets until the user is already dragging

- **Location**: `libs/ui/src/components/BoardColumn.svelte:55-62, 88-91`; `libs/ui/src/components/ItemCard.svelte:68-73`
- **Problem**: Cards are `cursor: grab` but columns do not look like drop zones. The `.drop-active` style only fires once the user has started a drag and moved over a column. There is no visible cue that columns *accept drops* before the user attempts a drag, no dashed border, no "drop here" placeholder. A user who has not used a kanban before, or who is unsure whether the new column is a drop target, gets no encouragement.
- **Why it matters**: Drag-and-drop is the primary affordance per the component header comment ("Drag-and-drop is the primary affordance"). If the affordance is invisible, users default to the alt menu (which is the slower path) or skip the action entirely.
- **Fix**: When *any* drag is in progress, give every column a faint dashed outline + label ("Drop to mark Reading") rather than only highlighting the currently-hovered one. A document-level `dragstart` listener can flip a board-wide `data-drag-active` attribute that columns use for the static "I'm a target" affordance.

#### 4. "Move to..." menu has no Escape, no outside-click-to-close, no focus trap, no success announcement

- **Location**: `libs/ui/src/components/ItemCard.svelte:48,89-119`
- **Problem**: `menuOpen` toggles via the button click but the menu has no keyboard escape, no `onkeydown` for Escape, no focus management (focus does not move to the first menu item on open), no outside-click-to-close, no `aria-live` announcement on selection. A keyboard user opens the menu, can Tab to the items, but cannot Escape it. Selecting an item closes the menu and fires the move silently -- no spoken or visual confirmation that the action ran.
- **Why it matters**: This is the *keyboard-accessible alternative path* required by the a11y rubric. The component comment explicitly calls this out ("a11y rubric: drag-drop must always have a kbd alt"). Shipping the alt without keyboard hygiene defeats the purpose. A second user issue: clicking another part of the page leaves the menu open.
- **Fix**: Add `onkeydown` handler for Escape that closes the menu and returns focus to the trigger button. Add a document-level `mousedown` listener (or `<svelte:window>`) to close on outside click. Move focus to the first menu item on open (`role="menu"` convention). Wire selection success into `lastError`'s positive-confirmation counterpart from #2. Trap Tab within the menu while open, or close on Tab-out.

#### 5. Filter changes can hide all content with no top-level "no matches" affordance

- **Location**: `apps/hangar/src/routes/(app)/review/+page.svelte:43-62, 234-272`; per-column empty: `+page.svelte:267-269`
- **Problem**: When a filter combination produces zero matches, every column renders its own "No items." line. There is no toolbar-level "0 results -- clear filters" message, no count of "showing X of Y," and no one-click reset. The user can lose track of why nothing is on the board (did the loader fail? did all my work disappear? or am I filtering?). The chip group's only signal is the active chip state -- subtle, easy to miss after a few clicks.
- **Why it matters**: Spec rubric explicitly calls out "Empty filter result has 'no matches' with reset" and "Results count visible." Both are missing.
- **Fix**: Below the toolbar, when `filteredItems.length === 0 && data.items.length > 0`, render a banner: "No items match these filters. [Clear filters]" -- where Clear resets `topFilter='all'`, `kindFilter='all'`, `textFilter=''`. Always render a "Showing N of M" line near the toolbar so the filter effect is observable.

#### 6. Filter state does not persist in the URL

- **Location**: `+page.svelte:29-31`
- **Problem**: `topFilter`, `kindFilter`, `textFilter` are pure `$state`. Reload, share-link, or back-button after navigating into a bucket detail loses the filter set. The user must reapply on every visit.
- **Why it matters**: Reviewers iterate ("Reviews / wp_spec / unread") repeatedly. Re-typing every time burns time. Spec rubric calls "Filter persistence in URL" out explicitly.
- **Fix**: Bind each filter to URL searchParams via `$page.url`/`goto(...)`. Use `replaceState: true` for low-friction typing. Read defaults from `event.url.searchParams` in the page load.

#### 7. Refresh status line is permanent

- **Location**: `+page.svelte:217-228`
- **Problem**: After `?/runLoader` returns, `form.ranLoader` becomes truthy and the green "Loader: 12 added, 4 updated, 0 removed in 1.2 s" banner sticks until the user navigates away or runs the loader again. There is no dismiss, no auto-fade. After a couple of refreshes the page is dominated by stale loader output rather than the board.
- **Why it matters**: Status that shouts long after the action is done becomes noise.
- **Fix**: Auto-dismiss after ~6 s for the success case, or move it into the same toast surface as #2. Allow manual dismiss.

#### 8. Bucket header is not visually distinct from item cards

- **Location**: `libs/ui/src/components/BucketCard.svelte:78-83`; `libs/ui/src/components/ItemCard.svelte:124-134`
- **Problem**: Both `.card` selectors use `surface-panel` background, the same `edge-default` border, and the same `radius-sm`. The bucket card differs only by having a `<button>` head + chevron; the item card differs only by having a draggable `<a>` row. On a column populated with mixed buckets and items, the visual hierarchy is flat -- the user cannot scan the column and tell at a glance which entries are aggregations and which are leaf items.
- **Why it matters**: Spec rubric calls out "Bucket header visually distinct from items?" -- they are not. Buckets aggregate (no drag) while items move; the visual signal must telegraph that distinction.
- **Fix**: Differentiate the bucket card -- inset background, slightly heavier border, an icon (folder or stack), or a header band. Items keep the plain card. The chevron alone is not enough.

#### 9. The bucket count badge is ambiguous when filters are active

- **Location**: `+page.svelte:96-121`
- **Problem**: Bucket card `count={entry.count}` is the count *after* filters apply. The user sees "WP Specs: 4" today and "WP Specs: 34" yesterday and has no way to tell whether 30 items disappeared or whether the filter is hiding them. The column count badge in `BoardColumn` (`col.items.length + col.buckets.reduce(s + b.count)`) likewise reflects only filtered totals.
- **Why it matters**: Counts are the primary scan affordance on a kanban. Counts that silently mean different things under different filter states are misleading.
- **Fix**: When any filter is active, show the count as `4 of 34` or `4 / 34` so the unfiltered total is preserved. Same treatment for column total badges.

### Minor

#### 10. Status selector from spec is missing

- **Location**: `+page.svelte:188-215` filter bar
- **Problem**: Spec line 97 lists "filter chips for 'Reviews only / Tasks only / All,' kind selector, **status selector**, free-text search." The implementation ships chip + kind + text; the status selector (e.g. "show only unread / reading / done") is absent.
- **Why it matters**: Without it, the only way to filter by status is to type into the text search, which doesn't search status.
- **Fix**: Add a status `<select>` next to the kind select; thread `frontmatterStatus`/`reviewStatus` into `applyFilters`.

#### 11. Done column always shows done items -- no toggle to hide them

- **Location**: `+page.svelte:234-271`
- **Problem**: The four columns always render. A reviewer who has worked through 80 items has 80 cards in Done permanently dragging the page width and visually overwhelming the active columns. There is no "hide Done" toggle, no auto-collapse-when-large, no "show last N" cap.
- **Why it matters**: Done is the column whose contents *should* fade once the work is closed. Permanently visible Done means the active work is buried.
- **Fix**: Either auto-collapse Done to a "Done (87) [show]" row or add a board-level "Hide Done" toggle near the filter bar. Pin behavior should still allow inspection on demand.

#### 12. Drag does not announce the drop result to assistive tech

- **Location**: `BoardColumn.svelte:47-53`; `+page.svelte:140-161`
- **Problem**: After a successful drag, `invalidateAll()` redraws the board but no `aria-live` region announces "Moved 'Foo Bar' to In Progress." A screen-reader user has no way to confirm where the card landed.
- **Why it matters**: WCAG 2.1 1.3.1 + 4.1.3 -- programmatic announcement of state changes.
- **Fix**: Add an `aria-live="polite"` region to the page that updates with "Moved <title> to <column>." on success and the analogous error on failure.

#### 13. Trying to drop on the source column has no visual signal

- **Location**: `BoardColumn.svelte:37-52`
- **Problem**: Dragging an item over its current column flips the column to drop-active and then triggers a no-op move. The server-side `?/move` happily writes the same column id back, the board re-fetches, and the user sees nothing changed. No "no-op -- already here" cue.
- **Why it matters**: Wasted server round-trip, and the user is left wondering whether the drop took.
- **Fix**: Pass `currentColumnId` of the dragging card into the column component (via a board-level `dragStartColumn` `$state`) and refuse the drop active state on the source column. Skip the fetch entirely on the source.

#### 14. "Move to..." menu position can clip on the rightmost columns

- **Location**: `ItemCard.svelte:240-252`
- **Problem**: The menu is positioned `left: 0; top: 100%` from the move-row. On the rightmost board column, with a narrow viewport, this can flow past the column right edge and clip against the page edge. There is no mirror-to-the-left fallback.
- **Why it matters**: Items on the Done column become harder to interact with.
- **Fix**: Use a CSS anchor positioning fallback (`right: 0` when overflowing) or run a tiny JS measurement to flip on open.

#### 15. Card title `<a>` has no descriptive label for the drag interaction

- **Location**: `ItemCard.svelte:74-77`
- **Problem**: The card title is an `<a href>`, but the article wrapping it is `draggable="true"`. A screen-reader user activating the link navigates; they have no announcement of the draggable role. There's no `aria-describedby` linking the card to "drag to a column to move, or use the Move to button."
- **Why it matters**: Discoverability of the drag affordance is invisible to AT users.
- **Fix**: Add a visually-hidden helper `<span>` describing the move options, referenced by `aria-describedby` on the article.

#### 16. Bucket drawer "Show full list" copy duplicates two near-identical paths

- **Location**: `BucketCard.svelte:62-71`
- **Problem**: Two branches: `overflow` -> "Show all 34 in full list"; non-overflow + drawerLimit < count -> "Show full list". The condition `overflow` is `count > drawerItems.length` and the second branch is `drawerLimit < count`, which when items aren't truncated below the drawer limit is structurally never true given how `drawerItems` is sliced upstream. The dead branch is never hit, but the code reads confusingly.
- **Why it matters**: The "Show full list" branch is dead code that suggests a different code path than the live one.
- **Fix**: Remove the `:else if` branch; the first condition covers all cases where a "show all" link is meaningful.

#### 17. Bucket detail page has no back link to the board

- **Location**: `apps/hangar/src/routes/(app)/review/buckets/[id]/+page.svelte:8-12`
- **Problem**: Breadcrumbs render `Review` -> `Buckets` -> `<bucket name>`. The "Buckets" crumb has no `href`, only `Review` does. There is no `/review/buckets` index. There is also no explicit "Back to board" affordance, which is the primary place the user came from.
- **Why it matters**: Bucket detail is a dead-leaf -- the only return path is the Review crumb. If the page is shared via deep link, the user must guess that "Review" is the board.
- **Fix**: Either give the bucket-detail page an explicit "Back to board" link, or rename the first breadcrumb to "Review board" so the affordance is obvious.

#### 18. Bucket detail item rows show only title + ref, no kind / status pills

- **Location**: `buckets/[id]/+page.svelte:30-38`
- **Problem**: The board item card shows kind + frontmatter pills. Bucket detail strips them. A reviewer scanning a 34-item WP-spec bucket on the detail page can't see status at a glance to prioritise.
- **Why it matters**: Loss of information density on the surface where density is most useful.
- **Fix**: Reuse `ItemCard` (or a list-density variant) on the bucket detail.

### Nit

#### 19. Refresh button is right-aligned and cramped against H1

- **Location**: `+page.svelte:165-186`
- **Problem**: `.title-row` puts H1 and the loader form on the same row with `justify-content: space-between`. On a narrow viewport the form crowds the title.
- **Why it matters**: Polish.
- **Fix**: Wrap to a second row below 720 px, or move the Refresh button into the filter toolbar (it's a board action, not a title action).

#### 20. Filter chip count is fixed at 3 with no visual hierarchy

- **Location**: `+page.svelte:189-202`
- **Problem**: All three chips look identical in weight. "All" and "Reviews" and "Tasks" are equally prominent. The default ("All") could be subtler, or the active chip could carry a stronger visual to telegraph the filter is on.
- **Why it matters**: Polish.
- **Fix**: Slightly mute the inactive chips (smaller font, dimmer text) so the active one pops more.

#### 21. Search input has no clear / reset button

- **Location**: `+page.svelte:211-214`
- **Problem**: The text-search input is `type="search"` (browsers do show a native clear "x" in some engines), but Safari + Firefox treat that inconsistently. There's no fallback control to clear the field.
- **Why it matters**: Polish.
- **Fix**: Add a small "x" button that clears `textFilter` when the field is non-empty.

#### 22. Item card title hover only colours the title, not the whole card

- **Location**: `ItemCard.svelte:149-151`
- **Problem**: The card itself is the conceptual click target (the draggable surface), but only the inner `.title` text changes colour on hover. The kind label, ref, and pills do not signal "this whole thing is interactive."
- **Why it matters**: Polish; reduces hit-target obviousness.
- **Fix**: Move the hover treatment up to the card surface (`.card:hover { background: var(--surface-sunken); }`) and keep the title underline as a nested cue.

#### 23. Pill colour mapping conflates `pending` and `unread`

- **Location**: `ItemCard.svelte:60-63`
- **Problem**: `pending` (a `review_status` value) and `unread` (a `frontmatterStatus` value) both render as `pill-pending` (warning colour). On a card showing both pills they look identical despite meaning different things.
- **Why it matters**: Subtle, but potentially misleading.
- **Fix**: Either give `pending` and `unread` different palettes, or prefix the pill text ("status: unread", "review: pending") so the meaning is unambiguous regardless of colour.

#### 24. The filter `<select>` is mono-styled and visually inconsistent with the chips

- **Location**: `+page.svelte:203-210, 327-345`
- **Problem**: Native browser `<select>` styling collides with the chip group aesthetic. The chips are in a sunken pill container; the select is a plain bordered box; the search is another plain bordered box.
- **Why it matters**: Polish; toolbar visually fragments.
- **Fix**: Wrap the select + search inside the same chip-group sunken container, or restyle them to match.

## Areas verified clean

- Layout shell (`+layout.svelte`) is appropriately minimal -- no spurious chrome, just a flex column.
- `requireRole` enforced consistently on all four server entry points (board layout/page, bucket detail, dispatcher).
- Loader form uses `use:enhance`, sets a `runningLoader` flag, the Button auto-disables on `loading=true` so double-submit is prevented.
- Bucket card `bucketHref` correctly routes to bucket detail when overflow exists; deep-link flow works.
- Bucket detail uses parent layout data for `board` but re-queries items + passing-set freshly, so it remains deep-linkable independent of board state.
- Pin-revert on frontmatter write failure is correctly implemented in the move action -- board reflects the actual on-disk state after error, not a phantom successful move.
- Sidebar "Review" entry uses correct `aria-current="page"` semantics and matches the existing Nav patterns for sources/glossary/docs.
- Drag dataTransfer key (`application/x-airboss-card-id`) is namespaced and prevents accidental "any string drop" hits.
- Buckets correctly omit `draggable="true"` per spec ("Bucket cards do not drag").
