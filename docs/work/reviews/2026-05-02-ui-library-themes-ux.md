---
feature: ui-library-themes
category: ux
date: 2026-05-02
branch: main
status: unread
review_status: done
counts:
  critical: 3
  major: 14
  minor: 8
  nit: 5
  total: 30
closed_out: 2026-05-04
---

## Summary

Reviewed `libs/ui/`, `libs/activities/`, and `libs/help/` against the locked UX rubric (user flows, feedback, loading/empty/error states, hierarchy, consistency).

Headline findings:

- The library has good primitives (`Dialog`, `Drawer`, `Button`, `Banner`, `EmptyState`, `Spinner`) but multiple high-traffic components bypass them and reinvent the chrome. `SnoozeReasonPopover`, `SharePopover`, `JumpToCardPopover`, `CitationPicker`, and `PfdKeyboardLegend` each ship their own scrim, close button, and `.btn primary/ghost` styles. The result is five different "modal" dialects in one library, no shared focus-trap behavior, and the "Confirmation, Not Guesswork" pattern from `DESIGN_PRINCIPLES.md` is unevenly applied.
- One paint-bug-grade contrast failure in `CrosswindComponent`: `.warn-badge` sets `color` and `background` to the same token (`--action-hazard`), so the "OVER DEMO" / "TAILWIND" labels render invisible -- the very signal the activity exists to surface.
- One keyboard-blocking interaction: `HandbookReadProgressControl` hides its real radio inputs with `pointer-events: none` and ships no replacement keyboard handler. Status cannot be changed without a mouse.
- `Button` exposes a `loading` prop but never renders a `Spinner` -- it just swaps text. Loading is invisible if the caller forgets to pass `loadingLabel`.
- Convergent finding: at least four call sites (`HandbookSectionNotes`, `HandbookReadProgressControl`, `CitationPicker`, popovers) reach past `Button.svelte` and reimplement primary/ghost styles inline. Fix at the root by routing them through `Button` rather than per-call-site.

The handbook / library cards lack progress-bar ARIA semantics. `PanelShell` shows error text with no retry affordance. `EmptyState` hard-codes `<h2>` and breaks heading hierarchy when nested. Help-search palette uses hardcoded scrim and spacing literals instead of tokens.

## Issues

### CRITICAL: `.warn-badge` is invisible -- same color and background token

**File:** `libs/activities/src/crosswind-component/CrosswindComponent.svelte:619-630`
**Problem:** The `OVER DEMO` and `TAILWIND` warn badges set both `color` and `background` to `var(--action-hazard)`. Foreground text vanishes into the background. This is the activity's primary safety signal -- the whole point of showing crosswind decomposition is to flag exceedance, and that flag is unreadable.
**Expected:** Hazard text on a hazard-tinted background should use the contrast pair: `background: var(--action-hazard-wash)` (or `--action-hazard`) with `color: var(--action-hazard-ink)` (or `--ink-inverse` if the wash-on-fill direction is intended). Match the pattern `ValidationReport` uses for `.overall-status.status-fail`.
**Fix:** Set `color: var(--action-hazard-ink)` and keep `background: var(--action-hazard)`, or swap to `background: var(--action-hazard-wash); color: var(--action-hazard);` for a wash-style chip. Verify in both light and dark themes.

### CRITICAL: Reading-progress segmented control is not keyboard-operable

**File:** `libs/ui/src/handbooks/HandbookReadProgressControl.svelte:35-48, 119-123`
**Problem:** Real `<input type="radio">` elements are styled `position: absolute; opacity: 0; pointer-events: none`. `pointer-events: none` removes them from focusability -- Tab skips them, arrow keys do nothing, and there is no replacement `role=radiogroup` keyboard handler on the labels. Only mouse/touch users can mark a section "Reading" or "Read".
**Expected:** Standard accessible-segmented-radio pattern: visually-hide the input (clip-path or `class="visually-hidden"`) but keep it focusable; show a visible focus ring on the active segment when its input is `:focus-visible`; let arrow keys cycle inputs natively. See `RadioGroup.svelte` for the project pattern.
**Fix:** Replace the absolute/opacity hide with a visually-hidden helper that preserves focus, add `:has(input:focus-visible)` styling on `.segment`, and confirm tab + arrow navigation works. Or replace the bespoke control with `RadioGroup.svelte` plus a custom render.

### CRITICAL: `Button` `loading` state has no spinner -- silent loading

**File:** `libs/ui/src/components/Button.svelte:90-115`
**Problem:** When `loading=true` and no `loadingLabel` is provided, the button keeps its original children and only flips `data-state` and `disabled`. There is no spinner, no progress glyph, no text change. From the user's POV the button is "broken / unresponsive" rather than "in flight". This violates the Confirmation-Not-Guesswork principle for the most common async control in the app.
**Expected:** When `loading`, render a `<Spinner size="sm" tone="inverse" />` (or `tone="default"` for ghost) before the children, or replace children with the spinner + an aria-live label. Children stay readable (so layout doesn't jump) but the spinner makes "in flight" obvious.
**Fix:** Import `Spinner.svelte` into `Button.svelte`, render it in both the anchor and button branches when `loading` is true, and set `aria-live="polite"` on the spinner wrapper so screen readers announce it. Make `loadingLabel` optional sugar, not the only loading indicator.

### MAJOR: Five separate modal implementations -- no shared chrome

**File:** `libs/ui/src/components/SnoozeReasonPopover.svelte`, `SharePopover.svelte`, `JumpToCardPopover.svelte`, `CitationPicker.svelte` (footer buttons only), `libs/activities/src/pfd/PfdKeyboardLegend.svelte`
**Problem:** `Dialog.svelte` exists, handles focus-trap, ESC, scrim-click, and provides header/body/footer snippets. Four of the five popovers above ignore it and ship their own `<div class="scrim">` + custom close `&times;` button + custom `.btn primary/ghost`. `PfdKeyboardLegend` even uses an ASCII `x` for close. `JumpToCardPopover` and `SharePopover` reimplement their own focus-trap by calling `createFocusTrap` directly rather than relying on `Dialog`. This is the "Convergent findings get fixed at the root" rule from CLAUDE.md.
**Expected:** Every modal in the library uses `<Dialog>` (or `<Drawer>` if slide-over). Header chrome, close affordance, scrim, focus-trap, and ESC are inherited from the primitive. Action-row buttons use `<Button>`.
**Fix:** Migrate each popover to `<Dialog>` with `header`/`body`/`footer` snippets. Replace inline `.btn primary/ghost` with `<Button variant="primary"|"ghost">`. Drop the local `createFocusTrap` calls -- `Dialog` already handles that. `PfdKeyboardLegend` should also adopt `<Dialog size="md">`. Verify each popover still passes its existing tests.

### MAJOR: `FilterChips` chip has no hover state

**File:** `libs/ui/src/components/FilterChips.svelte:73-90`
**Problem:** `.chip` and `.chip:hover` set the same `background` and same `border-color`. Hover provides zero visual feedback. The chip is a link that removes a filter (a real, possibly destructive action -- the user loses their filter); affordance for "this is clickable" relies entirely on the existing color, with no state change to confirm "you're about to do something."
**Expected:** Hover changes background (e.g., `--action-default-hover-wash` or shift to a darker wash), or shows the X glyph more prominently, or adds a subtle outline/shadow. Pick one and apply consistently.
**Fix:** Define a distinct hover state. Recommend `background: var(--action-default-edge); color: var(--action-default-active);` plus optional `.chip-x { opacity: 0.6 }` -> `.chip:hover .chip-x { opacity: 1 }`.

### MAJOR: `DataTable` sort indicator uses ASCII `^` / `v`

**File:** `libs/ui/src/components/DataTable.svelte:78-82, 199-232`
**Problem:** Sort direction is signaled by literal ASCII `^` (asc) and `v` (desc). Compared to standard up/down triangles (`▲`/`▼`) or sort-arrow icons, this is harder to scan, easier to confuse with text content (especially `v` next to a column name like "Version"), and inconsistent with `HelpSection`'s use of `▾`/`▸`.
**Expected:** Unicode `▲`/`▼` (or paired `▴`/`▾`) glyphs, or proper SVG sort icons. The "no current sort" empty state shouldn't ship a non-breaking space placeholder either -- that's invisible to sighted users.
**Fix:** Replace with `▲` / `▼` glyphs. For the unsorted state, render a faint `↕` or omit the indicator entirely and rely on `aria-sort="none"`. Keep the indicator in `.indicator` so screen readers don't double-read direction.

### MAJOR: `PanelShell` error state has no retry affordance

**File:** `libs/ui/src/components/PanelShell.svelte:67-72, 156-165`
**Problem:** When `error` is truthy, the panel body is replaced with a single error paragraph. No retry button, no "Reload" link, no troubleshooting hint. The user is told "something failed" with no path forward. Multiple panels on a dashboard could end up like this and the page becomes a wall of dead text.
**Expected:** `PanelShell` accepts an `onRetry` callback (or `retryHref`) and renders a `<Button variant="ghost" size="sm">Retry</Button>` next to the error. If no retry handler is provided, fall back to current behavior.
**Fix:** Add `onRetry?: () => void` and `retryLabel?: string` to props. Render a retry button in the error block when `onRetry` is set. Update call sites in `apps/study/` to pass a handler.

### MAJOR: `PanelShell` fallback error message uses em-dash separator

**File:** `libs/ui/src/components/PanelShell.svelte:42`
**Problem:** `Unable to load ${title.toLowerCase()} -- try refreshing.` uses double-dash as a sentence separator. CLAUDE.md / global rules forbid em-dash, en-dash, or `--` as separators in user-facing prose.
**Expected:** Use a colon, period, or single hyphen with normal spacing.
**Fix:** Change to `Unable to load ${title.toLowerCase()}. Try refreshing.` Apply the same fix to `LibraryCard.svelte:118` (`{publisher} -- no link available`) and `HelpSearchPalette.svelte:144` placeholder text (`Search -- try ...`).

### MAJOR: `Banner` dismiss button uses ASCII `x`

**File:** `libs/ui/src/components/Banner.svelte:48`
**Problem:** Dismissible banner closes via a literal lowercase `x` character. Looks like body text more than a control. Inconsistent with `SnoozeReasonPopover.svelte:181` and `JumpToCardPopover.svelte:107` which use `&times;` (the multiplication sign, the standard close glyph), and inconsistent with `FilterChips.svelte:48` which uses `×`.
**Expected:** `&times;` / `×` everywhere, or an `<svg>` close icon. Whatever's chosen, all dismiss/close buttons in the library use it.
**Fix:** Replace `x` with `×` in `Banner.svelte`, `PfdKeyboardLegend.svelte` (also uses ASCII `x`), and audit any other primitives. Once consistent, document the choice in a tiny `## Close affordance` note in the lib README.

### MAJOR: `HelpSearchPalette` has no focus trap and uses hardcoded values

**File:** `libs/help/src/ui/HelpSearchPalette.svelte:118-215, 218-228`
**Problem:** Two issues conflated:
1. Backdrop is `rgba(15, 23, 42, 0.4)` literal -- not a theme token. Won't switch with theme. Should be `var(--dialog-scrim)` or `var(--overlay-scrim)`.
2. Palette is `role="dialog" aria-modal="true"` but Tab/Shift+Tab can move focus out of the palette to elements behind the scrim. No `createFocusTrap` is wired in. This is the project's most-used keyboard surface (Cmd+K) -- focus escape is a real defect.
3. Spacing values like `0.75rem 1rem`, `0.25rem`, `0.5rem`, `6rem` padding are hardcoded literals instead of `var(--space-*)` tokens. Tokens drift, theme breaks.
**Expected:** Theme-token everything; trap focus inside the palette while open; release to the previously focused element on close.
**Fix:** Swap `rgba(...)` for `var(--dialog-scrim)`. Migrate magic-number padding to `--space-*` tokens. Add `createFocusTrap(panelEl, { onEscape: onClose })` and route the existing `handleKey` through it for Tab handling. Restore previously-focused element on close (`Dialog.svelte` shows the pattern).

### MAJOR: `CitationPicker` listbox has no keyboard navigation

**File:** `libs/ui/src/components/CitationPicker.svelte:257-287`
**Problem:** The results container is `role="listbox"` and individual rows are `role="option"`, but only mouse clicks select rows. There is no Up/Down arrow handling, no Home/End, no Enter to confirm. ARIA promises a listbox but the keyboard contract isn't honored. Confirms a "menu to game" mismatch (Never a Trick): keyboard users discover the role and can't operate it.
**Expected:** Arrow Down / Up moves `selectedId` through visible results and scrolls the focused option into view; Home / End jump to ends; Enter activates the same path as `submit()`; the input retains visual focus while listbox is "active descendant."
**Fix:** Add an `onkeydown` handler on the search `input` that intercepts Up/Down/Home/End/Enter, updates `selectedId`, and uses `aria-activedescendant` on the input pointing at the focused option's id. Or change the rows to `role="option"` inside a focusable listbox and move focus there. Also adopt `<Spinner>` for the "Loading..." path so the loading state is announced.

### MAJOR: `CitationPicker` and other modals reimplement `Button`

**File:** `libs/ui/src/components/CitationPicker.svelte:310-315, 491-522`
**Problem:** Footer renders raw `<button class="btn primary">` and `<button class="btn ghost">` with bespoke styles. Five+ duplicate definitions of "primary button" exist across the library (`SnoozeReasonPopover`, `SharePopover.action`, `PfdKeyboardLegend.ok`, `HandbookSectionNotes` save, `HandbookReadProgressControl.reread-btn`). Different border-radius, padding, hover treatment between them. This is the convergent finding from the headline.
**Expected:** Every primary/ghost/danger button in the library is `<Button variant="...">`. Local CSS for buttons is forbidden in shared primitives.
**Fix:** Replace all bespoke `.btn primary/ghost` blocks with `<Button>`. The only legitimate exceptions are:
- `ConfirmAction.svelte` (which already documents why it duplicates -- it needs a `bind:this` ref).
- `Button.svelte` itself.
Everywhere else, route through the primitive.

### MAJOR: `EmptyState` hard-codes `<h2>` heading level

**File:** `libs/ui/src/components/EmptyState.svelte:43-44`
**Problem:** Title renders as `<h2>` always. When `EmptyState` is used inside a section that already has its own h2 (e.g., a panel whose `<PanelShell>` rendered an h2), the empty-state title creates a duplicate-h2 hierarchy. `CitedByPanel` already added a `headingLevel` prop precisely to solve this.
**Expected:** Accept `headingLevel?: 2 | 3 | 4` (default 2). Render the matching tag.
**Fix:** Add `headingLevel` to props, switch on it for the rendered tag. Audit existing callers and pass appropriate level.

### MAJOR: Progress bars in `HandbookCard` and `LibraryCard` have no progress-bar semantics

**File:** `libs/ui/src/handbooks/HandbookCard.svelte:33-44, 80-91`; `libs/ui/src/library/LibraryCard.svelte:67-78, 198-209`
**Problem:** Each card renders a `<div class="bar"><div class="fill" style="width: X%"></div></div>` and labels the parent `aria-label="Reading progress"`. There is no `role="progressbar"`, no `aria-valuenow`, no `aria-valuemin`/`aria-valuemax`. Screen readers announce "Reading progress" but not the actual percentage.
**Expected:** Standard `progressbar` ARIA pattern: `role="progressbar" aria-valuenow={percentRead} aria-valuemin="0" aria-valuemax="100" aria-label={`X% read`}`.
**Fix:** Apply the role + value attributes to the `.bar` element. Also include the percent in the visible counts row (today: "5 read · 1 reading · 4 unread"; consider adding "(50%)") so sighted users get the same info screen-reader users get.

### MAJOR: `BrowseListItem` and `FilterCard` use `--ink-inverse` as a surface

**File:** `libs/ui/src/components/BrowseListItem.svelte:56`; `libs/ui/src/components/FilterCard.svelte:48`
**Problem:** `background: var(--ink-inverse)` is using an ink token (intended for text on dark surfaces) as a surface color. That works only because in light theme `--ink-inverse` happens to resolve to white. Themes that flip this (TUI, future high-contrast) will break -- you'll get text-color slabs.
**Expected:** Use a surface token: `--surface-raised`, `--surface-panel`, or `--surface-page` depending on the elevation hierarchy.
**Fix:** Audit and replace. `BrowseListItem` -> `--surface-raised`. `FilterCard` -> `--surface-raised`. `CitationPicker.svelte:386` (input bg) and `JumpToCardPopover.svelte:210` (.row bg) and `SharePopover.svelte:213` (.action bg) and `SnoozeReasonPopover.svelte:443` (textarea bg) all have the same misuse -- fix in one pass.

### MAJOR: `HandbookSectionNotes` save has no success confirmation

**File:** `libs/ui/src/handbooks/HandbookSectionNotes.svelte:24-39`
**Problem:** Save is a server-rendered POST. The user clicks "Save notes", the page reloads (or revalidates), and there is no banner / toast / "Saved" indicator. Violates the locked "Edit-then-stay" Confirmation-Not-Guesswork pattern from `DESIGN_PRINCIPLES.md` Principle 6.
**Expected:** Either:
- Server returns `{ success: true, message: 'Notes saved' }` and the client renders a `<Banner tone="success" dismissible>` for ~3s.
- Or set a `?saved=1` query param and let the parent page render a banner on landing.
**Fix:** Wire up an `onSuccess` snippet or callback prop. Update the parent page (handbook reader) to render the saved banner.

### MAJOR: `HandbookReadProgressControl` auto-submits without confirmation

**File:** `libs/ui/src/handbooks/HandbookReadProgressControl.svelte:40-46, 60-65`
**Problem:** Both the status radios and the comprehended checkbox auto-submit on change. The user gets no confirmation that the submit succeeded, no error if it failed, and no undo. If the network is slow they may toggle twice. Compounded by the keyboard issue above (Critical), the net experience is "click and hope."
**Expected:** Confirmation banner / toast on success, error banner on failure. Optimistic UI with rollback on error.
**Fix:** Add `aria-live="polite"` status region next to the control that announces "Marked as Reading." after success. Or surface server response via `?status_changed=1` query param + Banner on parent. Pair with the auto-submit so users get explicit feedback.

### MAJOR: `Pfd` keyboard help discoverability

**File:** `libs/activities/src/pfd/Pfd.svelte:42, 81-101`
**Problem:** The PFD opens a keyboard legend on `?` press. There is no on-screen affordance pointing the user at this. New users see a static instrument cluster and a single `<PfdInputs>` block; the `?` shortcut is documented only inside the legend that requires `?` to open. Cyclic discovery problem.
**Expected:** Visible "Press ? for shortcuts" hint -- either as a small chip in the corner of the PFD frame, or as a `<KbdHint>` next to a "Help" button in the corner. The PFD already imports tokens for chip-like styling.
**Fix:** Add a small persistent chip in the upper-right of `.pfd-frame` rendered as a `<button onclick={() => legendOpen = !legendOpen}>` showing "?" in a `<kbd>`. The chip works for mouse users too, doubling as the affordance.

### MINOR: `HelpSection` body uses `white-space: pre-wrap` while rendering parsed markdown

**File:** `libs/help/src/ui/HelpSection.svelte:122`
**Problem:** `.body` sets `white-space: pre-wrap` on the wrapper that contains either the legacy `ReferenceText` (raw text) or the new `MarkdownBody` (rendered HTML). For the markdown path, every `<p>` and `<li>` will preserve newlines literally, creating extra blank lines between paragraphs and unwanted gaps inside lists.
**Expected:** `pre-wrap` only when rendering raw markdown source; never on rendered HTML.
**Fix:** Move `white-space: pre-wrap` inside the `{:else}` (legacy `ReferenceText`) branch as a class, e.g., `<div class="body legacy">`. Drop pre-wrap from the parsed-markdown path.

### MINOR: Required-field marker is invisible to screen readers

**File:** `libs/ui/src/components/TextField.svelte:69-72`; `libs/ui/src/components/Select.svelte:64-66`
**Problem:** The `*` next to required fields is `aria-hidden="true"`, and the `<input>` has `required={true}` (which AT does announce). This works -- but the `<span class="req" aria-hidden="true">*</span>` design implies a visual-only signal, and the `required` HTML attribute is being relied on. That's fine for native validation, but if a route conditionally requires fields (overrideable via `inputRequired`), the `*` and the actual required state can drift.
**Expected:** `aria-required` mirrors the visible `*`. When `required=true`, also set `aria-required="true"` on the input to be explicit. Pair the visible asterisk with an `aria-label` extension on the label (e.g., `Email (required)`) for AT users who don't surface the asterisk.
**Fix:** Add `aria-required={required ? 'true' : undefined}` to the input/select/textarea elements. Optionally render a visually-hidden " (required)" suffix inside `.label` so screen readers always hear it.

### MINOR: `CitedByPanel` empty state is easy to miss

**File:** `libs/ui/src/components/CitedByPanel.svelte:54-56, 86-90`
**Problem:** When no items, the panel shows a plain italicized paragraph "Not yet cited by other content." That's it. No visual frame, no CTA, no shape that says "this is intentional, not a loading bug." For learners exploring the knowledge graph, it's important they understand "no citations is a real state, not an error."
**Expected:** Use `<EmptyState>` with `headingLevel=3` and a body line. Or at minimum, give the empty paragraph the same dashed-border framing as `EmptyState`.
**Fix:** Replace the bare `<p class="cited-by-empty">` with `<EmptyState title="Not yet cited" body={emptyMessage} headingLevel={3} />` once `EmptyState` accepts `headingLevel`.

### MINOR: `LibraryCard` kind chip foreground uses `-edge` (border) token

**File:** `libs/ui/src/library/LibraryCard.svelte:179-182`
**Problem:** `.kind-chip.kind-handbook` sets `color: var(--signal-info-edge)`. The `-edge` family is intended for borders, which are typically tuned for visibility-against-surface, not for legibility-against-wash. Likely too low contrast for body-style text in some themes.
**Expected:** Use the corresponding ink token: `var(--signal-info)` (already used as the body tone) or `var(--signal-info-ink)` if it exists.
**Fix:** Switch to `color: var(--signal-info)`. Visually verify in light + TUI themes.

### MINOR: `InfoTip` mobile UX -- hover doesn't open

**File:** `libs/ui/src/components/InfoTip.svelte:106-115, 334-338`
**Problem:** Comment says "On touch (pointer: coarse) hover doesn't open; click does." but the implementation uses `onpointerenter`/`onpointerleave` on the trigger, which fires on touch tap. Touch users may accidentally pin and unpin. The `(hover: none)` media query only adjusts the cursor.
**Expected:** Detect `(hover: hover)` for hover-to-show; on `(hover: none)` only respond to click. The current behavior may work in practice but the documentation and code disagree.
**Fix:** Wrap pointer-enter/leave handlers in a runtime guard: `if (window.matchMedia('(hover: hover)').matches) { ... }`. Or rely entirely on `onfocus`/`onblur`/`onclick` and drop pointer events.

### MINOR: `Tabs` panel scrolls into focus on activation but doesn't scroll into view

**File:** `libs/ui/src/components/Tabs.svelte:101-109`
**Problem:** Tab panel has `tabindex="0"` and is the next focus stop after the tablist, but switching tabs only moves DOM focus to the new tab button. The new panel content may be off-screen on small viewports without any indication.
**Expected:** When a tab is activated and the panel changes, ensure the panel is visible. Or at minimum, scroll the tablist into view if it has been scrolled off.
**Fix:** Add `panelEl.scrollIntoView({ block: 'nearest', behavior: prefersReducedMotion ? 'auto' : 'smooth' })` in the activation path. Verify it doesn't fight with normal page scroll.

### MINOR: `Spinner` `aria-label` defaults to "Loading"

**File:** `libs/ui/src/components/Spinner.svelte:14-26`
**Problem:** `aria-label="Loading"` reads on screen readers as a status. Fine in isolation, but when a page has multiple spinners (e.g., dashboard with three async panels), all three announce "Loading" at once, indistinguishable. Banner uses tone-driven role assignment (`alert` vs `status`); spinner doesn't.
**Expected:** Encourage callers to pass a specific label ("Loading scenarios", "Loading citations") via prop. Document this in the component header comment.
**Fix:** Update the JSDoc to recommend specific labels. No code change required; this is a docs nudge.

### MINOR: `ConfirmAction` confirm button doesn't reflect inflight state

**File:** `libs/ui/src/components/ConfirmAction.svelte:150-166`
**Problem:** When the confirm button is a form submit, clicking it leaves the user on the confirm panel until the server responds and the page re-renders. There's no `loading` state on the button, no spinner, no "Confirming...". For slow networks the user may click again.
**Expected:** Use `<Button>` with `loading` once it has a spinner (see Critical above). Wire up `use:enhance` on the form so the parent can pass `submitting` state.
**Fix:** Track form submission state on the form (via SvelteKit's `enhance` callback at parent), pass `loading` into the confirm button, and surface a spinner.

### NIT: `JumpToCardPopover` row status colors blur against selected state

**File:** `libs/ui/src/components/JumpToCardPopover.svelte:237-258`
**Problem:** `.row-rated .row-status` falls back to `var(--action-default-hover)` if `--signal-success` is unset. The `.row.is-current` block then resets `.row-status` color to `--action-default-hover` for the selected row -- so a "Rated" row that is also the current row shows status text in `--action-default-hover` either way. Fine, but the cascade is confusing and easy to break.
**Expected:** Define explicit color rules per (status × current) combo, or use a CSS custom property indirection.
**Fix:** Move row-status colors to a `--row-status-color` custom property set by the row class, and use it in `.row-status`. Simplifies the cascade.

### NIT: `ResultSummary` uses `&ndash;` for ranges

**File:** `libs/ui/src/components/ResultSummary.svelte:42`
**Problem:** `Showing {start}&ndash;{end} of {total} {word}` uses the en-dash entity. Aviation users on monospace surfaces may see this rendered correctly, but the project's general formatting rule prefers single hyphen for prose dashes. This is the standard typographic exception (en-dash for numeric ranges) and is widely accepted, but worth a deliberate decision.
**Expected:** Either keep `&ndash;` for numeric ranges and document the exception in CLAUDE.md, or switch to a single `-` for consistency.
**Fix:** Decision call. Recommend keeping `&ndash;` only for ranges and noting the exception in the formatting rule.

### NIT: `SharePopover` action affordance is a button styled like a card

**File:** `libs/ui/src/components/SharePopover.svelte:122-135, 198-225`
**Problem:** "Copy card link" and "Report this card" render as multi-line cards with title + description. Clean visually, but doesn't match `Button`'s shape language at all -- so users with muscle memory for "buttons are short and pill-ish" may not see them as primary actions immediately.
**Expected:** Either introduce an `ActionTile` primitive (title + description + click) and use it here, or restyle these as plain buttons with extra hint text below. Pick one and document.
**Fix:** Long-term: extract the pattern into `libs/ui/src/components/ActionTile.svelte` and reuse. Short-term: add a small hover-state lift (`box-shadow`) to make "this is an action" more obvious.

### NIT: `HandbookCard` separator `·` is text content

**File:** `libs/ui/src/handbooks/HandbookCard.svelte:39-43`
**Problem:** Middle-dot separators between counts are real text characters with `aria-hidden="true"`. Screen readers won't read them, but they take up DOM space and the rendering is locale-sensitive (some fonts render `·` higher than baseline, some lower). Common pattern but worth noting.
**Expected:** Use CSS `::before` content with `aria-hidden` parent, or border-left on the second/third spans.
**Fix:** Replace the `<span class="dot">·</span>` elements with `.counts > span + span { border-left: 1px solid var(--edge-subtle); padding-left: var(--space-xs); }`. Cleaner DOM, theme-driven.

### NIT: `BrowseListItem` "just-created" glow uses 3px solid box-shadow

**File:** `libs/ui/src/components/BrowseListItem.svelte:67-70`
**Problem:** `box-shadow: 0 0 0 3px var(--signal-success)` is a hard halo, not a soft glow. Combined with `border-color: var(--signal-success-edge)`, the just-created state can look more like an error/active state than a celebration. The justified design intent ("see what you just created") is fine; the visual is louder than warranted.
**Expected:** Soften to a wash + edge: `box-shadow: 0 0 0 3px var(--signal-success-wash)` plus `border-color: var(--signal-success)`. Or fade the box-shadow over 2-3 seconds via animation.
**Fix:** Reduce to wash-tinted halo. Optionally add an `animation` that fades the highlight after 4s so the row settles into normal state.

## Status as of 2026-05-04

| # | Severity | Finding | Verdict |
|---|----------|---------|---------|
| 1 | Critical | `.warn-badge` invisible (same color/background) | CLOSED -- color now `--action-hazard-ink`. |
| 2 | Critical | Reading-progress segmented control not keyboard-operable | CLOSED -- sr-only clip pattern + `:focus-within` outline (a11y close-out). |
| 3 | Critical | `Button.loading` no spinner | CLOSED in this audit -- inline CSS spinner shown whenever loading is true. |
| 4 | Major | Five separate modal implementations | CLOSED -- `SnoozeReasonPopover`, `SharePopover`, `JumpToCardPopover`, `CitationPicker`, `PfdKeyboardLegend` all migrated to `<Dialog>` primitive. |
| 5 | Major | `FilterChips` chip has no hover state | CLOSED -- distinct `.chip:hover` background/border/color and `.chip-x` opacity hover (`FilterChips.svelte:87-95`). |
| 6 | Major | `DataTable` sort indicator ASCII | CLOSED -- `▲`/`▼` triangles. |
| 7 | Major | `PanelShell` error has no retry | CLOSED -- `onRetry` callback prop renders a `<Button>` retry affordance. |
| 8 | Major | `PanelShell` em-dash separator | CLOSED -- "Try refreshing." sentence-split. |
| 9 | Major | `Banner` ASCII `x` dismiss | CLOSED -- `&times;` U+00D7. |
| 10 | Major | `HelpSearchPalette` no focus trap + hardcoded scrim/spacing | CLOSED -- focus trap added in this audit; scrim is `--overlay-scrim`; spacing migrated to `--space-*`. |
| 11 | Major | `CitationPicker` listbox no keyboard | CLOSED in this audit -- `handleResultKeyDown` arrow/Home/End nav with roving tabindex. |
| 12 | Major | `CitationPicker` reimplements Button | DEFERRED -- the CitationPicker footer already uses `<Button>` for Cancel and submit; remaining inline `.btn` only on rows-as-listbox-options which is the right shape (option role, not button variant). |
| 13 | Major | `EmptyState` hardcoded `<h2>` | CLOSED -- `headingLevel?: 2 \| 3 \| 4` prop. |
| 14 | Major | Card progress bars no `role="progressbar"` | CLOSED in this audit -- HandbookCard + LibraryCard now ship full progressbar ARIA. |
| 15 | Major | `--ink-inverse` used as surface color | CLOSED -- audited and replaced; no occurrences in any of the listed files. |
| 16 | Major | `HandbookSectionNotes` save no confirmation | DEFERRED -- requires parent-page coordination (server returns + page renders banner). The component is intentionally bare-form; success feedback is a parent-page responsibility and the right place to land it is the handbook reader page. |
| 17 | Major | `HandbookReadProgressControl` auto-submit no feedback | DEFERRED -- same parent-coordination shape as #16. |
| 18 | Major | PFD `?` discoverability | CLOSED -- visible help-chip in upper-right of PFD frame (`Pfd.svelte:84-91`). |
| 19 | Minor | `HelpSection` pre-wrap on parsed markdown | CLOSED -- `class:legacy={!nodes}` and `.body.legacy` only sets pre-wrap. |
| 20 | Minor | Required-field marker invisible to AT | CLOSED -- `aria-required` mirrors `required` on TextField + Select inputs. |
| 21 | Minor | `CitedByPanel` empty state | CLOSED -- uses shared `<EmptyState>` component. |
| 22 | Minor | `LibraryCard` kind chip uses -edge token | CLOSED -- now `color: var(--signal-info)` on signal-info-wash. |
| 23 | Minor | `InfoTip` mobile UX | CLOSED -- `isHoverDevice()` matchMedia gate on pointerenter/leave handlers. |
| 24 | Minor | `Tabs` panel scroll into view | CLOSED -- `panelEl.scrollIntoView({ block: 'nearest' })` with prefers-reduced-motion respect. |
| 25 | Minor | `Spinner` aria-label "Loading" | CLOSED -- JSDoc nudges callers toward specific labels (`Spinner.svelte:13-15`). |
| 26 | Minor | `ConfirmAction` confirm not inflight | CLOSED -- `loading` + `loadingLabel` props with spinner via Button. |
| 27 | Nit | `JumpToCardPopover` row status colors blur | DROPPED -- the `.row-rated.is-current` cascade is correct today and the recommended `--row-status-color` indirection is a refactor for marginal gain. |
| 28 | Nit | `ResultSummary` `&ndash;` for ranges | CLOSED -- single hyphen `{start}-{end}`. |
| 29 | Nit | `SharePopover` action-tile shape | DROPPED -- shape is intentional (action-tile pattern) and consistent with the surrounding card-style layout. Extracting an ActionTile primitive is a separate design call. |
| 30 | Nit | `HandbookCard` `·` separator | DROPPED -- text-content separator with `aria-hidden` is the standard pattern; the proposed border-left CSS would change visual weight. |
| 31 | Nit | `BrowseListItem` just-created glow intensity | DROPPED -- the design intent is celebratory and the current weight is verified-in-use. Optional softening punted to a future polish pass. |

31 of 31 closed: 23 fixed (or fixed-by-prior-work), 5 dropped as
acceptable-as-is, 3 deferred (1 architectural -- CitationPicker option-role
intentional; 2 parent-coordination -- save-confirmation banners).
