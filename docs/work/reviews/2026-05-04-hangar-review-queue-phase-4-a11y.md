---
title: 'Phase 4 A11y Review: Hangar Review Queue'
reviewer: a11y
date: 2026-05-04
diff: d0dea9b9...0d5c3428
---

# Phase 4 A11y Review: Hangar Review Queue

## Summary

- Files reviewed: 7 UI files (BoardColumn, BucketCard, ItemCard, review/+layout.svelte, review/+page.svelte, review/buckets/[id]/+page.svelte, hangar/Nav.svelte)
- Critical: 3
- Major: 7
- Minor: 6
- Nit: 4

The kanban surface ships HTML5 drag-drop with a "Move to..." button-menu as the keyboard alternate. The alternate is functional but incomplete: there is no screen-reader announcement when a card moves, no focus management after a move, and the menu is not a real ARIA menu (no arrow keys, no Esc, no outside-click close, no focus return). The board markup also misses the obvious landmark structure (no `<main>`, no `<nav>` for filters, no list semantics for the column body). Filter chips use a `radiogroup` pattern but the chips never receive arrow-key roving tab focus -- the role is half-implemented. None of these block use, but several of them block screen-reader users from understanding the result of an action, which on a board UI is the whole game.

## Findings

### Critical

#### CRITICAL: Card move has no screen-reader announcement (mouse OR keyboard path)

- **File**: `apps/hangar/src/routes/(app)/review/+page.svelte:140-161`
- **WCAG**: 4.1.3 Status Messages
- **Problem**: `performMove()` POSTs to `?/move`, awaits the result, calls `invalidateAll()`, and either sets `lastError` or clears it. Success has no announcement at all. The visual feedback is "the card disappears and reappears under a new column header" -- a screen reader user gets nothing. They invoked an action through the "Move to..." menu (the keyboard-only path the rubric requires), the action succeeded, and the AT is silent. The user does not know whether the move worked, where the card landed, or whether to look for it.
- **Why it matters**: Drag-drop is inaccessible without a kbd alternate. The rubric says "the keyboard alternate must be a complete, equivalent path" -- a path with no completion feedback is not equivalent. Affects any screen-reader user (NVDA, JAWS, VoiceOver). The drag-drop case is even worse: a sighted keyboard user using the menu also gets no aria-live update.
- **Fix**: Add a polite live region in the board page (e.g. `<div role="status" aria-live="polite" class="visually-hidden">{liveMessage}</div>`) and set `liveMessage = \`Moved "${title}" to ${columnName}.\`` (or `Move failed: ${reason}`) in `performMove()`'s success/failure branches. Clear it after a tick or on next move. The message must include both the item title and the destination column name; "Move complete" alone is not enough on a board with many cards. Also add `aria-busy="true"` on the column section while the POST is in flight so AT can pause.

#### CRITICAL: Focus is lost after a "Move to..." action

- **File**: `libs/ui/src/components/ItemCard.svelte:97-118`, `apps/hangar/src/routes/(app)/review/+page.svelte:140-161`
- **WCAG**: 2.4.3 Focus Order, 3.2.2 On Input
- **Problem**: When the user picks a column from the menu, `menuOpen = false` runs, `onMove(target.id)` fires `performMove()`, which calls `invalidateAll()`. After invalidation the entire columns section re-renders -- the original `ItemCard` instance is unmounted (it now lives in a different `BoardColumn`'s children) and the focus that was on a `menu-item` button collapses to `<body>`. The user has no anchor in the new state. On a long board this means tab-from-the-top to find the moved item again.
- **Why it matters**: 2.4.3 requires focus to move "in an order that preserves meaning and operability." Dropping focus to body after a successful action mid-list is the canonical failure case for keyboard-only users. Affects every keyboard user, not just AT users.
- **Fix**: After `await invalidateAll()`, restore focus to the moved card's new location. Easiest: give each `ItemCard`'s outer `<article>` `tabindex="-1"` and an `id={\`item-card-${itemId}\`}`, and in `performMove()`'s success branch (after `invalidateAll()` resolves) call `document.getElementById(\`item-card-${itemId}\`)?.focus()`. Pair this with the live-region announcement so AT users hear the move *and* land focus on the card. If the card is filtered out of view by the move (e.g., filter chips hide it), fall back to focusing the destination column header.

#### CRITICAL: "Move to..." menu is not a real menu pattern

- **File**: `libs/ui/src/components/ItemCard.svelte:91-119`
- **WCAG**: 2.1.1 Keyboard, 4.1.2 Name, Role, Value
- **Problem**: The trigger declares `aria-haspopup="menu"` and the popup uses `role="menu"` + `role="menuitem"`, but only the role attributes are present. There is no arrow-key navigation between menu items, no Home/End, no Esc to close, no outside-click close, no Tab-to-close, and no focus management when the menu opens (focus stays on the trigger -- ARIA menu pattern requires focus to move to the first menu item or for arrow keys to land on it). The menu also has no focus trap, so Tab walks past it into the next card. It looks like a menu to AT (because of the roles) but behaves like a stack of buttons.
- **Why it matters**: WAI-ARIA Authoring Practices 1.2 -- Menu pattern. Declaring `role="menu"` invokes screen-reader behavior that promises arrow-key navigation; users will press Down expecting to traverse menu items and nothing happens. Worse, the menu doesn't close on Esc, so a keyboard user cannot back out. They must Tab forward past every menu item.
- **Fix**: Either implement the full menu pattern or downgrade the markup to a plain button list. The simplest correct fix is to drop the menu roles (use `role="group"` on the `<ul>` or no role and just keep `<ul><li><button></button></li></ul>`), keep `aria-haspopup="true"` on the trigger, add an Esc handler that closes the popup and returns focus to the trigger, and add a click-outside handler. The popup is then a button-list disclosure, which AT will narrate correctly and which doesn't promise arrow-key behavior the code doesn't deliver. If a real menu is wanted, follow APG: roving tabindex within `role="menu"`, ArrowDown/Up/Home/End handlers, focus moves to first item on open, Esc returns focus to trigger.

### Major

#### MAJOR: Filter chip group declares `role="radiogroup"` but is not navigable like one

- **File**: `apps/hangar/src/routes/(app)/review/+page.svelte:188-202`
- **WCAG**: 4.1.2 Name, Role, Value, 2.1.1 Keyboard
- **Problem**: The chip row uses `role="radiogroup"` and each chip uses `role="radio"` + `aria-checked`. Per the radio pattern, all radios in a group share a single tab stop and arrow keys move between them (roving tabindex). Here, every chip is a regular `<button>` with no `tabindex` management and no arrow-key handlers -- Tab walks through every chip individually, ArrowLeft/Right do nothing. This is a partial-pattern bug: AT will announce "radio button, all" / "radio button, reviews only" / etc. and users will reach for arrow keys that don't work.
- **Why it matters**: Radio semantics promise specific keyboard behavior. Either honor it or drop the role. Affects keyboard and AT users.
- **Fix**: Two acceptable paths. (1) Drop the radio roles entirely; the chips are toggles and `aria-pressed={topFilter === value}` on `<button>` is the right pattern for a single-select toggle group. Add an `aria-label` to the wrapping `<div>` ("Card type filter") so AT can group them. (2) Keep `role="radiogroup"` and implement roving tabindex + ArrowLeft/ArrowRight handlers + Home/End. Path (1) is much less code for the same UX.

#### MAJOR: Drop-target column has no kbd-equivalent for landing a card *into* it

- **File**: `libs/ui/src/components/BoardColumn.svelte:37-71`
- **WCAG**: 2.1.1 Keyboard
- **Problem**: The column is a drop target for mouse drag. The keyboard alternative lives entirely on the *card* (the "Move to..." button), which is fine *if* the card's menu lists every column. It does (`moveTargets.filter(t => t.id !== currentColumnId)` in ItemCard). But the column has no kbd affordance of its own. That's an acceptable design; what's missing is that the drop target's visual highlight (`drop-active`) and the count-update are mouse-only feedback. A kbd user moving a card via the menu has no "I am hovering Review" preview, only the post-move state.
- **Why it matters**: Not a blocker (the menu lists destinations by name) but the lack of any preview or "this is where it'll go" makes the keyboard path strictly less informative than the drag path. WCAG-wise this is borderline -- the function works, but the operability is uneven.
- **Fix**: Optional but high-value: add an `aria-describedby` on the menu items pointing to a hidden span like "Will move to In Progress (4 items)" so the menu choice carries context the drag preview gives sighted users. Lower priority than the announcement / focus-management fixes.

#### MAJOR: Filter result count is never announced

- **File**: `apps/hangar/src/routes/(app)/review/+page.svelte:43, 234`
- **WCAG**: 4.1.3 Status Messages
- **Problem**: When the user types in `text-search`, picks a kind, or clicks a chip, `filteredItems` recomputes and the columns re-render. The board's only count surface is the per-column `count` prop on `<BoardColumn>`, which gets folded into `aria-label={\`${name} (${count} items)\`}` -- but that label is on a `<section>` and is not a live region, so AT does not re-read it. There is no aggregate "showing 12 of 89" announcement. Sighted users see the cards thin out; AT users hear nothing until they manually re-traverse columns.
- **Why it matters**: Search/filter without a result-count announcement is one of the most common WCAG 4.1.3 failures. Users with screen readers cannot tell whether their query matched anything until they walk the columns. This is a board with potentially zero visible items after a typo and the user has no signal.
- **Fix**: Add a polite live region near the filter bar: `<p role="status" aria-live="polite" class="visually-hidden">Showing {filteredItems.length} of {data.items.length} items.</p>`. Debounce the announcement (the live region should not fire for every keystroke -- 300-500ms after the last change is enough). The same live region can host the move announcement from the previous finding (or use two separate regions if you want to keep "filter result" and "action result" distinct).

#### MAJOR: No `<main>` landmark on the review board

- **File**: `apps/hangar/src/routes/(app)/review/+layout.svelte:7-9`
- **WCAG**: 1.3.1 Info and Relationships, 2.4.1 Bypass Blocks
- **Problem**: The review layout wraps everything in `<section class="review-shell">` with no role/landmark. There is no `<main>` here, and the page title `<h1>Hangar Review</h1>` lives inside `<header class="board-head">` which is also a generic header (would auto-promote to `role="banner"` only at top-level, not nested). For AT users, "skip to main content" lands them nowhere meaningful. The `<header>`-then-`<section class="columns">` structure has no landmarks at all.
- **Why it matters**: Landmark navigation is one of the primary nav strategies for screen-reader users. A board with hundreds of cards needs a `<main>` so users can jump back to the start of content from anywhere.
- **Fix**: In `apps/hangar/src/routes/(app)/+layout.svelte` (the parent layout) confirm `<main>` exists; if it does, this finding moves to "verify clean." If it does not, change the review-layout `<section>` to `<main>` (or add `<main>` around `{@render children()}`). Also consider wrapping `<header class="board-head">` semantics: it's already a `<header>` element which is fine, but the filter row uses `role="toolbar"` which is correct -- keep that.

#### MAJOR: Live error region uses `role="alert"` for routine errors -- too aggressive

- **File**: `apps/hangar/src/routes/(app)/review/+page.svelte:226, 230`
- **WCAG**: 4.1.3 Status Messages
- **Problem**: Both the loader-failure line and the move-failure line use `role="alert"` (which is `aria-live="assertive"`). `assertive` interrupts whatever the user is doing -- correct for crash-level errors but heavy-handed for "Move failed -- frontmatter could not be written" and for the Refresh-button error. The pattern interrupts the user mid-keystroke.
- **Why it matters**: 4.1.3 says assertive should be used "only sparingly, for important, time-sensitive messages." Form-action failures are usually `polite`. Overuse of `alert` causes users to disable live-region announcements entirely, which then masks the critical ones.
- **Fix**: Change `role="alert"` to `role="status"` (or `aria-live="polite"`) on both `.status-line.error` instances. Reserve `assertive` for genuinely interrupt-worthy events (data loss, session expired). Pair the polite error with focus management: on `lastError !== null`, optionally focus the error paragraph (`tabindex="-1"`, `bind:this`) to bring kbd users to it. Don't combine focus + assertive; pick one.

#### MAJOR: Status pills convey state via color + text but not via accessible name

- **File**: `libs/ui/src/components/ItemCard.svelte:80-87, 56-63`
- **WCAG**: 1.3.1 Info and Relationships, 1.4.1 Use of Color
- **Problem**: The two pill spans render the raw frontmatter value ("done", "reading", "pending", "unread") as plain text inside a `<span>` with `title="status"` / `title="review_status"`. The pill's *purpose* (which axis the value belongs to) is encoded only in `title`, which is unreliable on touch and inconsistent across AT. A screen reader will read "done done" for an item with both `status: done` and `review_status: done` and the user cannot tell which axis is which.
- **Why it matters**: `title` is not an accessible name fallback for content (it's an accessible *description* for some elements and ignored elsewhere). The pill is content, not a control, so AT may skip the title entirely.
- **Fix**: Replace the two spans with an actual labelled construction. Option A (simplest): inline the axis label in visible text -- "status: done" / "review: pending" -- and drop `title`. Option B: wrap each pill in `<span aria-label="status: done">done</span>` so AT reads the full phrase. Option C: render two definition-list items (`<dl><dt>status</dt><dd>done</dd>...</dl>`). Option A is the lowest-friction fix and matches existing visual density.

#### MAJOR: Bucket card heading hierarchy skips levels

- **File**: `apps/hangar/src/routes/(app)/review/+page.svelte:166`, `libs/ui/src/components/BoardColumn.svelte:64-67`, `libs/ui/src/components/BucketCard.svelte:38-52`
- **WCAG**: 1.3.1 Info and Relationships, 2.4.6 Headings and Labels
- **Problem**: The board page has `<h1>Hangar Review</h1>` (line 166) and `<BoardColumn>` renders `<h2>{name}</h2>` (BoardColumn.svelte:65). Inside the column, `BucketCard` renders the bucket title in a `<button class="head"><span class="title">` with no heading element -- it's a button containing text. `ItemCard`'s title is also a `<span class="title">` inside an `<a>`, no heading. From an AT outline view: h1 -> h2 (column) -> nothing. There's no h3 for buckets or h4 for items. A user navigating by headings can find columns but cannot find a specific bucket without traversing every card linearly.
- **Why it matters**: Heading navigation is the second-most-used AT shortcut after landmark navigation. A kanban with 4 columns and dozens of buckets/items collapsed under each column is exactly the case where h3/h4 help. Items don't necessarily need headings (they're more list-item-shaped), but buckets are clearly section-shaped.
- **Fix**: In `BucketCard.svelte`, wrap the title in an `<h3>` (the column is `<h2>`, so `<h3>` is correct). The `<button>` can be inside the `<h3>`, or use `<h3><button>...</button></h3>`. For ItemCard, leave the title as-is (it's a list-item link) but consider grouping items within each column as `<ul role="list"><li>` so list-navigation shortcuts work -- see next finding.

#### MAJOR: BoardColumn body is not a list

- **File**: `libs/ui/src/components/BoardColumn.svelte:68-70`
- **WCAG**: 1.3.1 Info and Relationships
- **Problem**: The column body is a `<div class="body">` rendering children flat. Each child (BucketCard or ItemCard) is an `<article>`. There is no list semantics anywhere -- AT cannot say "list with 12 items" or use list-navigation shortcuts. A column of cards is by definition a list of cards.
- **Why it matters**: Same as above -- list semantics give AT a counted, traversable structure. The kanban literature consistently uses `role="list"` for column contents.
- **Fix**: Change `<div class="body">` to `<ul class="body" role="list">` and have callers wrap each card in `<li>`, OR (less invasive) keep the `<div>` and add `role="list"` and have the children be wrapped in `<li>`s. Cleanest: change BoardColumn to take a list snippet, render `<ul role="list">{@render children()}</ul>`, and at the call site in `+page.svelte:242` wrap each `<BucketCard>` and `<ItemCard>` in `<li>`. Cards already use `<article>`, which is fine inside `<li>`.

### Minor

#### MINOR: Refresh button loading state has no AT signal beyond label change

- **File**: `apps/hangar/src/routes/(app)/review/+page.svelte:182-185`
- **WCAG**: 4.1.3 Status Messages
- **Problem**: `<Button loading={runningLoader} loadingLabel="Refreshing...">Refresh</Button>` flips the visible label and presumably sets some loading visual on the button. Without seeing the Button component internals (out of scope) we cannot verify whether it sets `aria-busy` or `aria-disabled`. The form result toast announces success/failure via `role="status"` (line 219) which is good. Verify the Button component itself sets `aria-disabled="true"` while `loading` so AT users don't double-submit.
- **Why it matters**: Double-submission is a common AT footgun. If the button does not communicate "I am busy" to AT, users may activate it twice.
- **Fix**: Audit `Button.svelte` (not in this diff) and confirm `loading` propagates to `aria-disabled` and ideally `aria-busy`. If it doesn't, add it there (root-cause fix per CLAUDE.md "convergent findings"). If you cannot edit Button in this phase, add `aria-busy={runningLoader}` on the wrapping `<form>` as a stop-gap.

#### MINOR: Search input has no debounced result announcement and no clear button

- **File**: `apps/hangar/src/routes/(app)/review/+page.svelte:211-214`
- **WCAG**: 3.3.2 Labels or Instructions, 4.1.3 Status Messages
- **Problem**: The input is `<input type="search" placeholder="Filter by title or ref...">` with a visually-hidden label "Search". `type="search"` does give a native clear (X) button in some browsers, which is good. But there's no programmatic way to clear filters all at once -- a user with three filters set has no "Reset all" affordance. The placeholder is the only hint of behavior.
- **Why it matters**: 3.3.2 requires labels and instructions when needed. The placeholder explains *what* you're searching but not *how* (substring? case-sensitive? title-only?). For users who expect search to span more fields, the silent narrow scope is confusing.
- **Fix**: (a) Add a "Clear filters" button when `topFilter !== 'all' || kindFilter !== 'all' || textFilter !== ''`, with `aria-label="Clear all filters"`. (b) Use `aria-describedby` to attach a hidden "Searches title and ref" hint to the input. (c) Tie this to the result-count live region from MAJOR-3 so users know what their filter produced.

#### MINOR: BucketCard chevron is text glyph; could be clearer

- **File**: `libs/ui/src/components/BucketCard.svelte:50`
- **WCAG**: 1.4.5 Images of Text (borderline)
- **Problem**: The chevron is `▾` / `▸` (Unicode triangles) inside a `<span aria-hidden="true">`. Hidden from AT correctly. Visible to sighted users but the glyphs are tiny and don't always render consistently across fonts. Not a blocker; a flag.
- **Why it matters**: Visual clarity of disclosure widgets matters for low-vision users. A `<svg>` chevron sized to control inherits theme colors better and scales cleanly. The current `aria-hidden` on the span is correct for AT.
- **Fix**: Replace with an inline SVG icon (`role="img"` + `aria-hidden="true"` since `aria-expanded` already conveys state). Optional polish; not a violation.

#### MINOR: Bucket detail page items list has no per-row accessible context

- **File**: `apps/hangar/src/routes/(app)/review/buckets/[id]/+page.svelte:30-36`
- **WCAG**: 2.4.4 Link Purpose (In Context)
- **Problem**: Each list item is `<a><span class="title">{title}</span><span class="ref">{ref}</span></a>`. The link's accessible name is the concatenation of both spans, which is fine. The bucket name is in `<h1>` above (line 20) and the breadcrumb gives context. But the link itself is silent about which bucket it's in -- if a user lands on it via a per-link AT navigation jump (e.g., screen-reader "links list"), the link text alone may not disambiguate two items with the same title.
- **Why it matters**: Mostly mitigated by context. Marginal improvement.
- **Fix**: Optional: add `aria-label={\`${title} (${ref})\`}` only if titles repeat across the bucket. Otherwise leave as-is.

#### MINOR: Move button menu has no "outside click closes" and no Esc

- **File**: `libs/ui/src/components/ItemCard.svelte:91-119`
- **WCAG**: 2.1.1 Keyboard
- **Problem**: Once `menuOpen = true`, the only way to close is to click the trigger again or pick a menu item. Esc does nothing. Clicking outside the card does nothing. Tabbing out leaves the menu open.
- **Why it matters**: Keyboard-only and AT users have no reliable Esc-to-cancel pattern.
- **Fix**: Add a keydown handler at the `move-row` (or a global one bound while open) that closes on Esc and returns focus to the trigger. Add a click-outside listener (or use `popovertarget` / `<dialog>` if you want the platform to do this for you). This finding is bundled with the CRITICAL menu-pattern fix above; closing this one closes that one too if you go the disclosure-button route.

#### MINOR: Move button label includes the full title -- can become very long

- **File**: `libs/ui/src/components/ItemCard.svelte:96`
- **WCAG**: 2.4.6 Headings and Labels (borderline)
- **Problem**: `aria-label={\`Move "${title}" to another column\`}` -- if the title is 80 characters, the AT will read the full title every time the user tabs to the button. Visually the button is just "Move to..." so the label becomes verbose-by-default.
- **Why it matters**: AT verbosity. Not incorrect, just noisy.
- **Fix**: Use `aria-describedby` pointing to the title element (the `<a class="title-row">` already exists) and keep the button text "Move to...". The AT will then announce "Move to..., button, [described by title]". Or shorten the label to `\`Move card to another column\`` and let position-in-list provide context.

### Nit

#### NIT: BoardColumn count badge has `aria-hidden="true"` but the label includes it

- **File**: `libs/ui/src/components/BoardColumn.svelte:59, 66`
- **WCAG**: best-practice (no specific criterion violated)
- **Problem**: `.count` span has `aria-hidden="true"` (good -- it's a duplicate of the label). The `aria-label` on the section already says "Backlog (5 items)". This is correct. Mentioned only because at a glance it looks like a contradiction; the implementation is right.
- **Why it matters**: No user impact. Listed for completeness so a future reviewer doesn't try to "fix" it.
- **Fix**: None. (Verified clean -- moved here only because the structure was worth flagging.)

#### NIT: `cursor: grab` on `.card` always present, even when no drag is possible

- **File**: `libs/ui/src/components/ItemCard.svelte:133-138`
- **WCAG**: best-practice
- **Problem**: The grab cursor implies "this is draggable." Cards are draggable, so accurate -- but on touch devices and with `:hover` states this can be confusing. Minor.
- **Why it matters**: Not a violation; cosmetic.
- **Fix**: None required.

#### NIT: Touch-target size on chevron and "Move to..." button is small

- **File**: `libs/ui/src/components/BucketCard.svelte:50`, `libs/ui/src/components/ItemCard.svelte:220-228`
- **WCAG**: 2.5.5 Target Size (Enhanced) -- AAA
- **Problem**: WCAG 2.1 AA does not require 44x44px (that's 2.5.5 AAA). The "Move to..." button uses caption-size font + space-3xs/2xs padding -- visually tiny. The whole BucketCard `<button class="head">` is large (good), but the inner chevron is only a glyph. The "Move to..." button on its own is a small hit target even with mouse.
- **Why it matters**: Below AAA target size; touch users on tablets or motor-impaired users on a desktop with a trackpad will struggle. Not an AA blocker.
- **Fix**: Bump `.move-btn` padding to at least `var(--space-2xs) var(--space-sm)` and consider `min-height: 32px`. Optional.

#### NIT: Visually-hidden class is duplicated per route instead of shared

- **File**: `apps/hangar/src/routes/(app)/review/+page.svelte:347-357`
- **WCAG**: n/a
- **Problem**: The standard `.visually-hidden` recipe is reimplemented inline. Likely already exists in `libs/ui` or `libs/themes`.
- **Why it matters**: DX, consistency. No user impact.
- **Fix**: If a shared utility exists in `libs/ui`, use it; otherwise add one and migrate this and any siblings. Out-of-scope-style finding -- park or fold into a separate tidy.

## Areas verified clean

- **Nav landmark + active-route highlighting** in `apps/hangar/src/lib/components/Nav.svelte`: links are real `<a>` elements (not div+onclick), `aria-current="page"` is computed correctly per route, focus-visible outline is set, admin link is gated by role (not visually disabled with a 403 trap).
- **Bucket-detail breadcrumbs** in `apps/hangar/src/routes/(app)/review/buckets/[id]/+page.svelte`: uses `<Breadcrumbs>` component, `<h1>` is present and unique on the page, no heading-level skip from breadcrumb to h1.
- **Drag-and-drop fallback exists**: the rubric's biggest landmine -- "HTML5 drag-drop with no kbd alternate" -- is avoided. The "Move to..." menu is a complete-coverage alternate (every column is a target). The findings above are about the *quality* of that alternate (announcements, focus, menu pattern), not its existence.
- **`aria-expanded` on disclosure widgets** is correct: BucketCard uses `aria-expanded={open}` + `aria-controls={drawerId}` on its head button; ItemCard's "Move to..." trigger uses `aria-expanded={menuOpen}` + `aria-haspopup="menu"`. The wiring is right; only the menu's keyboard behavior is incomplete (CRITICAL above).
- **Drop-target visual feedback** uses both `border-color` and `background` change on `drop-active`, so it's not color-only.
- **Empty-state message** ("No items.") in the column is plain text, AT-readable, not hidden behind a graphic.
- **Status pill *colors*** (`pill-done`, `pill-progress`, `pill-pending`) use signal-success/info/warning token pairs (`-wash` background + `-ink` foreground), which the theme system is designed to keep above 4.5:1 -- no obvious hex-on-hex contrast bug introduced. (Tokens themselves are out of scope for a branch-diff review.)
- **No `<div onclick>` patterns** -- every actionable element is a real `<button>` or `<a>`. The drag-source `<article ondragstart>` is the legitimate exception (drag is not a keyboard action; the menu covers kbd).
- **Dispatcher redirect** at `apps/hangar/src/routes/(app)/review/items/[itemId]/+page.server.ts` is a server-side `throw redirect(303, ...)` -- no client-side flash of "loading" stuck in AT output. Clean.
- **Form action `?/move`** is a POST with `itemId` + `toColumnId` named fields; no unlabelled form controls in the visible UI (the form is constructed in JS via `FormData`, which is fine -- no input elements to label).
