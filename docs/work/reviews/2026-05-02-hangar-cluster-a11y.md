---
feature: hangar-cluster
category: a11y
date: 2026-05-02
branch: main
reviewer: ball-review-a11y
counts:
  critical: 2
  major: 8
  minor: 9
  nit: 6
  total: 25
status: pending
review_status: done
---

## Summary

Reviewed all hangar app routes under `apps/hangar/src/routes/(app)/**/*.svelte`
and shared components under `apps/hangar/src/lib/**/*.svelte` against WCAG 2.1
AA. Hangar is admin-only, but a11y is non-negotiable: any operator (including
users with low-vision, motor, or screen-reader needs) must be able to drive
the source registry, glossary, jobs, and audit surfaces.

The shell (`+layout.svelte`) is in good shape: skip-link, `aria-label="Primary"`
nav, `<main id="main" tabindex="-1">`, fieldset+legend in the appearance
picker, summary `aria-label` on the identity menu. Most pages reach for
semantic table markup with `scope="col"`, breadcrumbs use `aria-label`, and
filter bars are wrapped in landmarks.

The recurring problems are concentrated in five places:

1. The audit-page combobox is missing the wiring SR users need (no `activedescendant`,
   list options carry `aria-selected="false"` even when none is selected, no
   keyboard navigation between option buttons).
2. The job-detail "tablist" is a tablist in name only - no roving tabindex,
   no arrow-key handling, no `tabpanel` association.
3. Pagination uses `aria-disabled` on `<a>` links to mean "disabled," which is
   not the same as omitting them from the tab order or removing them from
   click semantics. Combined with `pointer-events: none` it leaves a
   keyboard-only or NVDA user reading "previous, dimmed link" without an
   actionable target.
4. Several pages spam information-bearing color (`signal-warning`, `signal-danger`,
   `state-pending`/`state-extracted` pills, dirty/clean badges, log-line stderr
   tinting, diff `+`/`-` lines) with no non-color cue. WCAG 1.4.1.
5. The diff page emits raw lines into a `<pre>` with `aria-label="Diff output"`
   but no role or live-region semantics, and the live-polling job log fires
   updates into a non-live `<div>` with only a tiny `aria-live="polite"` on the
   "polling 1 Hz" indicator (which announces nothing useful).

There is also a structural issue: the hangar home page is the document's root
landing page but renders no `<h1>` - the `PageHeader` component is presumed to
emit one, but every other page reaches `<h1>` via either `PageHeader` or an
inline tag. Worth confirming `PageHeader` and `Banner` (under `@ab/ui`) emit a
real `<h1>` and `role="alert"`/`role="status"` respectively; that's out-of-scope
for this review but should be re-checked when the UI lib is touched.

## Issues

### CRITICAL: Audit actor combobox is incomplete - keyboard users cannot select an option

File: `apps/hangar/src/routes/(app)/admin/audit/+page.svelte:271-301`
WCAG: 4.1.2 Name/Role/Value (A), 2.1.1 Keyboard (A), 3.3.2 Labels or Instructions (A)

Problem: The actor input declares `role="combobox"`, `aria-expanded`, `aria-controls`,
`aria-autocomplete="list"`, but never sets `aria-activedescendant` and never
moves DOM focus into the listbox. The listbox children are `<button role="option">`
elements (which themselves break the listbox contract - listbox children should
be the elements with `role="option"`, not button-wrappers - see ARIA APG combobox
pattern). Each option statically reports `aria-selected="false"` even when one
is the active descendant. There is no ArrowDown/ArrowUp/Enter/Escape handling on
the input. A keyboard-only user can type, see results visually, but cannot select
anything without using the mouse or tabbing through every list item button (which
forces the input to lose focus). Screen readers will not announce result-count
changes (no `aria-live`), and they cannot identify the "active" option because
nothing is wired.

Fix: implement a proper combobox per WAI-ARIA 1.2 APG pattern:

- Keep `role="combobox"` on the `<input>`, set `aria-controls` to the listbox id, set `aria-activedescendant` to the currently-highlighted option's id.
- Drop `<button>` wrappers inside `<li role="option" id="...">`. Make the entire `<li>` the option (with `tabindex="-1"`, `id`, `role="option"`, `aria-selected="true"` only on the active one).
- Wire ArrowUp/ArrowDown to move the active descendant, Enter to commit `pickActor`, Escape to close the menu and restore focus to the input, Home/End to jump.
- Add `aria-live="polite"` (or `role="status"`) to a hidden span that announces "N actors found" when `actorOptions` changes.
- Move `actorMenuOpen = false` onto an outside-click handler so the menu doesn't strand a screen reader inside an "expanded" combobox after the user tabs out.

### CRITICAL: Job-detail "tablist" has no keyboard semantics or panel association

File: `apps/hangar/src/routes/(app)/jobs/[id]/+page.svelte:144-177`
WCAG: 4.1.2 Name/Role/Value (A), 2.1.1 Keyboard (A)

Problem: The four log-stream filters are wrapped in `<div role="tablist" aria-label="Log stream">` with `<button role="tab" aria-selected={...}>` children. This declares the ARIA tabs pattern, which is contractual: it requires roving `tabindex` (only the active tab is `tabindex="0"`, the rest are `tabindex="-1"`), arrow-key navigation between tabs, and `<div role="tabpanel" aria-labelledby="...">` for the content. None of this is present. The log body (`<div class="log-body">`) is just a div, not a tabpanel, and is not associated with the active tab. Every tab button has the default `tabindex` so Tab takes you through all four; arrow keys do nothing. This is worse than no ARIA - a screen-reader user is told "tab, 1 of 4" but the structure doesn't behave like one.

Fix: either implement the full ARIA tabs pattern (roving tabindex, ArrowLeft/ArrowRight handlers, give the log body `role="tabpanel"` + `aria-labelledby` referencing the active tab's id, give each tab an `aria-controls` referencing the panel) or downgrade to a simple toggle group: drop `role="tablist"`/`role="tab"`/`aria-selected` and use `aria-pressed` toggle buttons inside a `role="group"`. The existing audit-page chip group (`aria-pressed`) is the easier pattern; adopt it here unless we need true tabs.

### MAJOR: Pagination links use aria-disabled + pointer-events: none

File: `apps/hangar/src/routes/(app)/glossary/+page.svelte:233-253`,
      `apps/hangar/src/routes/(app)/glossary/sources/+page.svelte:189-209`
WCAG: 2.4.3 Focus Order (A), 4.1.2 Name/Role/Value (A)

Problem: When on page 1, the "Previous" link gets `aria-disabled="true"`, `tabindex="-1"`, and CSS `pointer-events: none` plus dimmed color. The element is still in the DOM as `<a href="...">` but inert. Screen readers may still announce it as a link; the focus-visible style is gone (so a focused-via-script state has no indicator); and the element retains its href so a "View source" or "open in new tab" right-click could still navigate. WCAG-wise the `aria-disabled` link is acceptable but the visual state has no non-color cue (just opacity/color).

Fix: render a `<span>` (not `<a>`) when disabled, or wrap in a `<button type="button" disabled>` styled the same. The simplest correct pattern: `{#if data.page > 1}<a href={prevPageHref()}>Previous</a>{:else}<span class="disabled" aria-hidden="true">Previous</span>{/if}`. Alternative: keep `<a>` but drop the href attribute when disabled and add a non-color cue (chevron icon dimmed + outline).

### MAJOR: Diff page emits color-only +/- distinction

File: `apps/hangar/src/routes/(app)/sources/[id]/diff/+page.svelte:90-95, 146-149`
WCAG: 1.4.1 Use of Color (A), 1.3.1 Info and Relationships (A)

Problem: Every diff line is a `<span class="line k-{kind}">` whose only kind cue is color: green for add, red for remove, blue for hunk header. The leading `+` / `-` / `@@` characters do exist in the text (because `classifyLine` retains them), so a sighted color-blind user can still tell, but a screen reader reading the `<pre>` linearly will miss the structural meaning. The `<pre>` carries `aria-label="Diff output"` which won't help; SRs will read the entire block as one string.

Fix: wrap each line with non-color signal. Options: (a) prefix each line with a visually-hidden span that says "added: " / "removed: " / "context: " before the line text; (b) give the `<pre>` `role="log"` and structure each line as `<span role="listitem">` with `aria-label`; (c) at minimum, add a `<dl>`/`<dt>` legend before the diff explaining the color coding so even color-blind sighted users have a key. Combine (a) with the existing color and the diff is universally readable.

### MAJOR: Job log lines stream into a non-live region; live indicator is misleading

File: `apps/hangar/src/routes/(app)/jobs/[id]/+page.svelte:174-191`
WCAG: 4.1.3 Status Messages (AA), 1.4.1 Use of Color (A)

Problem: The log body polls every second and appends new lines via reactivity, but the container `<div class="log-body">` has no `role="log"` or `aria-live`. The "polling 1 Hz" indicator span has `aria-live="polite"` but its text is static and only announces once. A screen-reader user has no way to know lines arrived. Also each log line's stream tag (`stdout`/`stderr`/`event`) is colored only - stderr is red, event is blue - with no leading marker for color-blind users (the `.log-stream` text itself is the cue, but it's tiny caption text and the row layout puts it in a 5rem column).

Fix: put `role="log"` and `aria-live="polite"` on `.log-body` (or on a wrapping div with `aria-relevant="additions"`). Make each line's `.log-stream` tag a real visible badge (background fill, not just colored text) so non-color users see "STDERR" pop. Drop the misleading "polling 1 Hz" span or give it semantic meaning (e.g. announce status changes only when terminal flips).

### MAJOR: Source-detail action row uses an anchor styled as a disabled button

File: `apps/hangar/src/routes/(app)/sources/[id]/+page.svelte:65, 280-286`
WCAG: 4.1.2 Name/Role/Value (A), 2.1.1 Keyboard (A), 3.3.2 (A)

Problem: The "Upload" affordance is `<a class="btn-like" class:disabled-link={isBusy} aria-disabled={isBusy} href={...}>Upload</a>`. CSS sets `pointer-events: none` and dimmed opacity when disabled, but the anchor still has its href and is in the tab order. A screen reader will announce it as a regular link, the user activates it, the navigation goes through. No non-color cue ("disabled" is just opacity).

Fix: when busy, render `<span class="btn-like disabled" role="button" aria-disabled="true">Upload</span>` with no href, OR omit it entirely and surface the disabled-state copy in the busy banner. If the design must keep the slot, use `tabindex="-1"` AND remove the href when disabled (so keyboard activation is impossible), AND add a non-color cue (lock glyph, dashed border).

### MAJOR: Status pills/badges convey meaning by color only

Files: many
- `apps/hangar/src/routes/(app)/sources/+page.svelte:128-131, 283-306` (state pills pending/downloaded/extracted)
- `apps/hangar/src/routes/(app)/glossary/+page.svelte:220-227, 412-429` (dirty/clean badges)
- `apps/hangar/src/routes/(app)/glossary/sources/+page.svelte:175-183` (dirty/clean badges)
- `apps/hangar/src/routes/(app)/glossary/[id]/+page.svelte:33-45` (dirty/clean/deleted badges)
- `apps/hangar/src/routes/(app)/glossary/sources/[id]/+page.svelte:33-45`
- `apps/hangar/src/routes/(app)/users/+page.svelte:140-146` ("-" vs "Banned" badge)
- `apps/hangar/src/routes/(app)/jobs/+page.svelte:149-151, 280-303` (status chips)
- `apps/hangar/src/routes/(app)/jobs/[id]/+page.svelte:107` (status chips)
WCAG: 1.4.1 Use of Color (A)

Problem: Every "pill" or "badge" uses tone color tokens (`signal-success-wash`, `signal-warning-wash`, `signal-danger-wash`) plus a label. The label by itself ("Dirty"/"Clean"/"pending"/"downloaded") is the carried semantic, which is fine - but in scanned tables a sighted user visually relies on the tone color, and a non-color user has only the small caption-sized uppercase text. WCAG 1.4.1 requires color not be the *only* cue. The text label is technically present, so this passes the strict letter, but the visual hierarchy makes it brittle: dirty vs clean depends on green vs amber and an identical glyph-free pill shape. A monochrome user has to read the caption text on every row.

Fix (group): introduce a non-color glyph cue. Standard pattern:

- Dirty: yellow fill + leading "*" or warning-triangle glyph
- Clean: green fill + leading checkmark glyph
- Pending: dotted outline (no fill) + clock glyph
- Downloaded: solid fill + down-arrow glyph
- Extracted: solid fill + checkmark glyph
- Banned: red fill + leading lock glyph

This is one shared pill component update under `@ab/ui` and would clear seven sites in one go. Convergent fix.

### MAJOR: TBD wiki-link "warn" status tile is color-only

File: `apps/hangar/src/routes/(app)/sources/+page.svelte:86-89`,
      `apps/hangar/src/lib/components/FlowDiagram.svelte:194-197, 230-237`
WCAG: 1.4.1 Use of Color (A)

Problem: When `tbdCount > 0` or `validation.errors > 0` or `validation.warnings > 0`, the tile gains a class (`.warn` / `.error`) that swaps the border + background to amber/red. The numeric value also gets the danger color. There is no leading icon, no `(needs attention)` text, no `aria-label` describing the elevated state. A non-color user sees "5" exactly the same as a non-warn "5".

Fix: when the count is non-zero, prepend a warning glyph (visible) and add `aria-label="5 TBD wiki-links - needs attention"` to the value `<dd>`. Also consider adding `role="status"` so the count change is announced when the page polls.

### MAJOR: FlowDiagram tile titles use h2 inside row groups with no overarching heading

File: `apps/hangar/src/lib/components/FlowDiagram.svelte:182-272`
WCAG: 1.3.1 Info and Relationships (A), 2.4.6 Headings and Labels (AA)

Problem: The diagram is a `<section aria-label="Reference-system flow">` containing five `<article>` tiles, each with its own `<h2>` (Content, Manifest, Validation, Registry merge, Glossary render). The page-level `/sources` route already has its own `<h2 id="status-h">Status</h2>` and `<h2 id="registry-h">Source registry</h2>`. The diagram's five `<h2>`s land at the same heading level and break the document outline (Status/Source registry/Content/Manifest/Validation/Registry merge/Glossary render at h2). A screen reader navigating headings sees a flat list with no hierarchy. The arrows are SVG `<path>` with `aria-hidden="true"` (correct for decoration), but there's no programmatic relationship between adjacent tiles - "after this comes Manifest" isn't in the SR experience.

Fix: demote diagram tile titles to `<h3>` (or use `<h3>` alongside `aria-labelledby`); add a single `<h2>` to the diagram section ("Pipeline"). The arrows are correctly hidden but the tiles themselves should expose the flow in a non-visual way - either a leading paragraph "Pipeline: Content -> Manifest+Validation -> Registry merge -> Glossary render" or `aria-describedby` on each tile pointing at the next.

### MAJOR: Files page expander loses content order with chevron text

File: `apps/hangar/src/routes/(app)/sources/[id]/files/+page.svelte:91-95`
WCAG: 4.1.2 Name/Role/Value (A), 1.3.1 Info and Relationships (A)

Problem: The expander button correctly carries `aria-expanded`, but the chevron is plain text (`v` / `>`) with `aria-hidden="true"` and no associated `aria-controls` pointing at the preview region. A screen-reader user activating the button knows it expands but doesn't know what; they then have to step forward through the DOM to find the appearing region. Also the expander is keyboard-focusable but the file row is a grid with several siblings (size, ts, kind, archive tag, delete button) that aren't part of the expander - a keyboard user can hit the expander, then has to step through five separate cells before reaching the now-expanded preview. Tab-order awkward but not broken.

Fix: add `aria-controls="preview-{file.name}"` to the expander button and `id="preview-{file.name}"` to the `<div class="preview">`. Also add a visible non-color expansion cue beyond the rotated chevron text.

### MAJOR: Audit-page chip-group uses chips as toggles with no name

File: `apps/hangar/src/routes/(app)/admin/audit/+page.svelte:336-350`
WCAG: 4.1.2 Name/Role/Value (A), 1.3.1 (A)

Problem: The window-preset chips are rendered as `<button class="chip" aria-pressed={...}>`. Good - that's the right pattern. But the wrapping `.field` div uses `role="group" aria-labelledby="audit-window-label"` where `audit-window-label` is a `<span class="field-label">`. The span is not a label element; that's allowed for `aria-labelledby` but the group label is also visually small caption text (uppercase, mute color). For a screen-reader user this is OK (the group has an accessible name), but the chips are listed with a "Pressed" / "Not pressed" state and no readable role context other than "group, Window". Acceptable but borderline.

Fix: actually fine, document for posterity. If you want it tighter, use `<fieldset><legend>Window</legend>` instead of `role="group"` + span - that's the platform-native equivalent and avoids any ARIA surprises.

### MINOR: Form errors use class="form-error" with role="alert" but only on initial mount

File: `apps/hangar/src/lib/components/ReferenceForm.svelte:52-54`,
      `apps/hangar/src/lib/components/SourceForm.svelte:45-47`
WCAG: 4.1.3 Status Messages (AA)

Problem: `<p class="form-error" role="alert">{formError}</p>` is good when the form action returns an error and the page re-renders - the `role="alert"` will fire. But field-level errors below each field (`<p class="err">{fieldError(...)}</p>`) have no role and aren't associated with their input via `aria-describedby` or `aria-errormessage`. A screen reader hears the error text only when it traverses the DOM, not when the field is focused.

Fix: wire field errors to inputs:

- Add `id="ref-id-err"` to each `<p class="err">`
- Add `aria-describedby="ref-id-err"` (or `aria-errormessage` per ARIA 1.2) on the corresponding input/select/textarea, conditionally when an error exists
- Add `aria-invalid="true"` on the input when the error exists

### MINOR: Identity menu chevron uses plain "v" text glyph

File: `apps/hangar/src/routes/(app)/+layout.svelte:155, 287-308`
WCAG: 1.1.1 Non-text Content (A)

Problem: The chevron is a literal lowercase letter `v` inside a `<span class="chevron" aria-hidden="true">`. It rotates 180deg when open. Visually it works as a chevron, but it's a glyph stand-in. For sighted low-vision users at large zoom it reads as the letter "v". The `aria-hidden` is correct (it's decorative once the menu state is conveyed via `<details open>`), so SR is fine.

Fix: replace with an actual chevron character (U+2304 down, U+2303 up) or an inline SVG glyph. Same pattern in:

- `+layout.svelte:155` (identity)
- `sources/[id]/files/+page.svelte:92` (file expander - "v" / ">")
- `home stat tiles "Open ->"` decorative text in `+page.svelte:28, 37, 70, 78`

### MINOR: Toolbar/action chips on /sources and elsewhere don't share a button look

File: `apps/hangar/src/routes/(app)/sources/+page.svelte:142-146` (.chip rendered as `<a>`)
WCAG: 4.1.2 (A)

Problem: The "Open / Files / Diff" chips are anchor links styled as buttons. They have proper href, focus-visible isn't defined on them (the rule only applies to general `:focus-visible` from elsewhere). Search the file: `.chip:focus-visible` is missing. A keyboard user tabbing through the table will land on these links with no visible outline.

Fix: add `.chip:focus-visible { outline: 2px solid var(--focus-ring); outline-offset: 2px; }`.

### MINOR: Pagination disabled link missing focus-visible style

File: `apps/hangar/src/routes/(app)/glossary/+page.svelte:430-457`,
      `apps/hangar/src/routes/(app)/glossary/sources/+page.svelte:376-403`
WCAG: 2.4.7 Focus Visible (AA)

Problem: `.pagination a:hover` is defined; `.pagination a:focus-visible` is not. The active link gets default browser focus, which may or may not be visible depending on theme.

Fix: add `.pagination a:focus-visible { outline: 2px solid var(--focus-ring); outline-offset: 2px; }`.

### MINOR: Audit chip-clear "x" button label uses lowercase letter as glyph

File: `apps/hangar/src/routes/(app)/admin/audit/+page.svelte:287`
WCAG: 1.1.1 Non-text Content (A)

Problem: `<button type="button" class="chip-clear" aria-label="Clear actor filter" onclick={clearActor}>x</button>` - the `aria-label` is correct, but the visible character is a lowercase letter `x`. At small caption-text size and when the field is focused, low-vision users may not immediately read this as a close-button glyph.

Fix: use `&times;` (multiplication sign U+00D7) or U+2715 (cross), or an inline SVG icon. Keep the `aria-label`.

### MINOR: Sources-detail "soft-delete" submit button has no confirmation

File: `apps/hangar/src/routes/(app)/glossary/[id]/+page.svelte:65-67`,
      `apps/hangar/src/routes/(app)/glossary/sources/[id]/+page.svelte:65-67`
WCAG: 3.3.4 Error Prevention (AA)

Problem: A bare `<form method="POST" action="?/delete"><button>Soft-delete...</button></form>` deletes on click with no confirmation step. WCAG 3.3.4 applies to "legal, financial, data" transactions; a deletion that removes content from the registry is data, so reversibility or a confirm step is required. The hint says it's reversible, but that's downstream - the user has no in-flow confirmation.

Fix: wire through `<ConfirmDialog>` (already used on the user detail page). Same pattern there: open a confirm modal with the entity name typed for confirmation.

### MINOR: Diff page diff-body uses a `<pre>` with `aria-label` but no role

File: `apps/hangar/src/routes/(app)/sources/[id]/diff/+page.svelte:91-92`
WCAG: 4.1.2 (A)

Problem: `aria-label="Diff output"` on a `<pre>` is informational but doesn't make the block navigable. For long diffs a screen-reader user reads it as one continuous string.

Fix: add `role="region"` + `tabindex="0"` (so the region is focusable for keyboard scrolling - the body has `max-height: 60vh; overflow: auto;`). Currently the scrollable region has no programmatic tab stop.

### MINOR: Audit "Show more" button is a positive-action button styled as primary CTA

File: `apps/hangar/src/routes/(app)/admin/audit/+page.svelte:417-421, 688-706`
WCAG: 1.4.11 Non-text Contrast (AA)

Problem: `.show-more` uses `background: var(--action-default); color: var(--action-default-ink);`. Without seeing the resolved tokens we can't confirm the 4.5:1 ratio for text or 3:1 for the boundary, but this is a load-bearing CTA in the audit flow; theme-edit drift is a real risk. Same applies to `.cancel-btn` (uses `var(--action-hazard-wash)` text on `var(--action-hazard)` bg).

Fix: add a check (or a unit test in the theme tests) that confirms `--action-default-ink` on `--action-default` clears 4.5:1 and `--action-hazard` on `--action-hazard-wash` clears 4.5:1 in both light and dark appearances.

### MINOR: Job-detail log line uses grid columns that may overflow on narrow viewports

File: `apps/hangar/src/routes/(app)/jobs/[id]/+page.svelte:405-413`
WCAG: 1.4.10 Reflow (AA)

Problem: `.log-line` is `grid-template-columns: 3rem 7rem 5rem 1fr;` with a horizontal min-width that can exceed 320 CSS px. The `.log-body` has `overflow-y: auto` but no horizontal handling. At 320px width users will horizontal-scroll inside the log body for every line.

Fix: at narrow viewports collapse the meta columns into a single line above the text (`@media (max-width: 600px)` + `grid-template-columns: 1fr; grid-template-rows: auto auto;`).

### MINOR: Files-page file row is a 6-column grid that wraps oddly

File: `apps/hangar/src/routes/(app)/sources/[id]/files/+page.svelte:215-221`
WCAG: 1.4.10 Reflow (AA)

Problem: `.file-head { grid-template-columns: 1fr auto auto auto auto auto; }` - five auto columns next to a flex-1 column. On tablet widths the meta tags will compress and may overlap or push the delete form to a second row with no responsive intent.

Fix: add a media query that collapses `.file-head` to two rows under 700px (name + chevron on row 1; meta+actions on row 2).

### NIT: Source detail breadcrumb separator is plain text "/"

File: `apps/hangar/src/routes/(app)/sources/[id]/+page.svelte:50-54`,
      every breadcrumb across the app
WCAG: 1.1.1 (A)

Problem: `<span aria-hidden="true">/</span>` is correct (decorative separator). The pattern is fine; this is just a visual nit - consider an actual chevron `›` U+203A for visual polish.

### NIT: Multiple `<dl>` blocks lack a heading association

File: `apps/hangar/src/routes/(app)/+page.svelte:22-41` (stats),
      `apps/hangar/src/routes/(app)/sources/[id]/+page.svelte:157-172` (meta),
      `apps/hangar/src/routes/(app)/admin/audit/[id]/+page.svelte:107-133` (meta)
WCAG: 1.3.1 (A) - acceptable but could be tighter

Problem: A `<dl>` is a semantic list of definitions but if it's not associated with a heading, screen-reader users hear "definition list, term, X, definition, Y" without knowing the list's purpose. Most blocks here are inside a section with an `aria-labelledby` already - those are fine. The home page tiles work via `aria-labelledby="tile-content-h"` which is correct.

Fix: pass-through audit; not actionable.

### NIT: Hangar home stats use `<a class="stat-link">` wrapping value+affordance

File: `apps/hangar/src/routes/(app)/+page.svelte:24-31`
WCAG: 2.4.4 Link Purpose (A) - acceptable

Problem: `<a class="stat-link" href={ROUTES.HANGAR_SOURCES}><span>...</span><span aria-hidden>Open -></span></a>`. SR users hear "23, link" - the link text is just the number. The visual "Open ->" is `aria-hidden`. The link's accessible name comes from the visible "23" plus the surrounding `<dt>Sources</dt>` only by visual proximity, not programmatic association.

Fix: add `aria-label="Open sources (23)"` to the link, or include the dt term in the link text via visually-hidden span.

### NIT: Banner / EmptyState components used widely but not reviewed here (out-of-scope)

File: `apps/hangar/src/lib/...` references `@ab/ui/components/Banner.svelte` and `@ab/ui/components/EmptyState.svelte`
WCAG: 4.1.3 (AA), 1.3.1 (A)

Problem: This review is scoped to the hangar app; the `Banner`, `EmptyState`, `Button`, `PageHeader`, and `ConfirmDialog` components live in `@ab/ui` and are out-of-scope here. Worth raising for the next round: confirm `Banner` emits `role="alert"` for `tone="danger"` and `role="status"` for info/warning; confirm `PageHeader` emits a real `<h1>` (not a styled div); confirm `ConfirmDialog` traps focus and restores it on close.

Fix: schedule a `@ab/ui` a11y pass.

### NIT: `<select>` lacks an `aria-describedby` for hint text

File: `apps/hangar/src/lib/components/SourceForm.svelte:69-83`
WCAG: 3.3.2 (A) - borderline

Problem: The "Source type" select has a hint paragraph below it explaining the binary-visual kind chip. The hint isn't programmatically associated; a screen reader will read it after the select but the user has to traverse to find it.

Fix: give the hint an id and add `aria-describedby` on the `<select>`. Same pattern applies to every form field that has a `<p class="hint">` sibling (form ids: `src-id`, `src-version`, `src-url`, `src-path`, `src-checksum`, `src-downloaded`, `src-locator`, `ref-aliases`, `ref-paraphrase`, `ref-citations`).

### NIT: ConfirmDialog usage on user-detail does not preview the destructive scope

File: `apps/hangar/src/routes/(app)/users/[id]/+page.svelte:300-311`
WCAG: 3.3.4 (AA) - acceptable

Problem: "Revoke ALL sessions for {displayName}?" with confirm-by-email-typing is a strong pattern. Good. No issue, just calling it out as the gold-standard for the soft-delete fixes recommended in MINOR above.

Fix: none.

## Status as of 2026-05-04

| Finding | Verdict | Closure |
| ------- | ------- | ------- |
| CRITICAL: Audit actor combobox incomplete | CLOSED | PR #455 -- full ARIA combobox with `aria-activedescendant`, arrow-key + Enter/Escape handling, role="option" on listbox children |
| CRITICAL: Job-detail tablist contract broken | CLOSED | PR #455 -- downgraded to `role="group"` + `aria-pressed` toggle group |
| MAJOR: Pagination uses aria-disabled on `<a>` | CLOSED | PR #548 -- disabled state renders as `<span>` not anchor; non-color outline cue |
| MAJOR: Diff page color-only +/- | CLOSED | PR #548 -- visually-hidden "added/removed/context:" prefix per line |
| MAJOR: Job log non-live region | CLOSED | PR #453 -- `role="log" aria-live="polite" aria-relevant="additions"` on `.log-body` |
| MAJOR: source-detail action row anchor-as-disabled | CLOSED | PR #548 -- conditional render with no href when busy |
| MAJOR: status pills color-only | CLOSED | PR #440 -- Badge glyph cue (`@ab/ui/components/Badge.svelte`); convergent fix across 7 sites |
| MAJOR: TBD warn tile color-only | CLOSED | PR #548 -- prepended warning glyph + aria-label on the value |
| MAJOR: FlowDiagram h2 outline | CLOSED | PR #548 -- demoted tile titles to h3 + section-level h2 |
| MAJOR: Files expander missing aria-controls | CLOSED | PR #548 -- aria-controls / id pairing on expander button + preview region |
| MAJOR: Audit chip-group label | CLOSED | PR #548 -- adopted `<fieldset><legend>` |
| MINOR: form errors not associated with inputs | CLOSED | PR #548 -- aria-describedby + aria-invalid wired |
| MINOR: identity menu chevron literal "v" | CLOSED | PR #548 -- replaced with U+2304 / U+2303 chevron |
| MINOR: chip focus-visible missing | CLOSED | PR #548 -- focus-visible outlines added on chip and pagination |
| MINOR: pagination focus-visible missing | CLOSED | PR #548 -- as above |
| MINOR: Audit chip-clear "x" lowercase | CLOSED | PR #548 -- replaced with U+00D7 |
| MINOR: soft-delete no confirmation | CLOSED | PR #433 -- ConfirmDialog wired (closes both a11y MINOR and ux CRITICAL #9) |
| MINOR: Diff page `<pre>` no role | CLOSED | PR #548 -- `role="region"` + `tabindex="0"` |
| MINOR: Show-more contrast | CLOSED | PR #548 -- token contrast verified in theme test pass |
| MINOR: log line grid overflow on narrow viewports | CLOSED | PR #548 -- `@media (max-width: 600px)` collapses meta cols |
| MINOR: file-row 6-column grid wraps oddly | CLOSED | PR #548 -- responsive collapse under 700px |
| NIT: breadcrumb separator "/" | CLOSED | PR #548 -- replaced with U+203A |
| NIT: `<dl>` heading association | CLOSED | Pass-through audit; existing `aria-labelledby` adequate |
| NIT: home stats link a11y | CLOSED | PR #548 -- aria-label on each stat-link |
| NIT: Banner / EmptyState scope-out | CLOSED | Tracked under chunk-5 UI a11y pass (#469) |
| NIT: select aria-describedby | CLOSED | PR #548 -- form hint ids + aria-describedby threaded |
| NIT: ConfirmDialog scope-out | CLOSED | Documented gold-standard; nothing to fix |

Total: 25 closed / 0 open. `review_status` flipped to `done`.
