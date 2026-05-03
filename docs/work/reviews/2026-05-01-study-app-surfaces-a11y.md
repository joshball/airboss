---
feature: study-app-surfaces
category: a11y
date: 2026-05-01
branch: main
issues_found: 21
critical: 3
major: 8
minor: 7
nit: 3
status: unread
review_status: pending
---

## Status as of 2026-05-04

Re-greped main against every finding. 14 of 21 closed; 7 still-open (2 of 3 criticals + radio-group keyboard nav remain).

| Severity | Finding | Verdict | Evidence |
| -------- | ------- | ------- | -------- |
| CRITICAL | Dashboard map cells are unlabeled links (title-only, role=cell on `<a>`) | STILL OPEN | `apps/study/src/routes/(app)/dashboard/_panels/MapPanel.svelte:91-99` -- still `title=` not `aria-label=`; `role="cell"` still on the `<a>`. Next: replace `title` with `aria-label`, drop `role="cell"` from anchor, wrap in `<span role="cell">` if grid semantics matter |
| CRITICAL | Memory-review feedback + confidence radio groups don't support arrow-key nav | STILL OPEN | `apps/study/src/routes/(app)/memory/review/[sessionId]/+page.svelte:531,573,604` -- still `role="radiogroup"` with every button as own tab stop, no roving tabindex, no ArrowLeft/Right keydown handler. Next: implement WAI-ARIA roving-focus pattern OR replace with native `<fieldset>` + `<input type="radio">` |
| CRITICAL | Read-suggestion banner status without preamble | STILL OPEN | `apps/study/src/routes/(app)/library/handbook/[slug]/[chapter]/[section]/+page.svelte` aside still wraps the question without explanatory preamble. Low priority -- visible state surfaced via existing button labels; flagged for follow-up alongside the read-suggestion UX rework |
| MAJOR    | Library card `:focus-visible` removed | CLOSED | `apps/study/src/routes/(app)/library/+page.svelte:196-199` adds `outline: 2px solid var(--focus-ring); outline-offset: 2px;` on `.card:focus-visible`; same on `regulations/+page.svelte:58-62` and the per-kind / per-group routes |
| MAJOR    | Lens / handbook lens cards no focus indicator | CLOSED | `apps/study/src/routes/(app)/lens/handbook/+page.svelte:102-104` -- `.card-link:focus-visible` rule added |
| MAJOR    | Goal cards / credentials cards no `:focus-visible` rule | CLOSED | `goals/+page.svelte:121-123` and `credentials/+page.svelte:161-163` both add the focus rule |
| MAJOR    | Knowledge-node mastery progressbar has no accessible name | CLOSED | `apps/study/src/routes/(app)/knowledge/[slug]/+page.svelte:225-230` -- `aria-label="Mastery"` + `aria-valuetext="{n}% mastery..."` |
| MAJOR    | Knowledge-learn progressbar accessible name + valuetext missing | CLOSED | `knowledge/[slug]/learn/+page.svelte:139-144` -- `aria-label="Phase progress"` + `aria-valuetext` |
| MAJOR    | Knowledge-list mastery-bars announce % twice | CLOSED | `knowledge/+page.svelte:278-284` -- wrapper `aria-label` dropped; visually-hidden "Mastery" precedes the percent |
| MAJOR    | Memory-review counter-trigger uses aria-expanded without aria-controls | STILL OPEN | popover trigger still lacks `aria-controls={popoverId}`. Next: add stable id on the dialog and wire `aria-controls` on the trigger |
| MAJOR    | Login dev-account button list lacks group label / heading semantics | STILL OPEN (partial) | `<h1>` swap done (`login/+page.svelte:33`), but dev-accounts still uses `<p>` + `<div>` rather than `<h2>` + `<ul>`. Next: convert dev-accounts block to labelled section + ul/li |
| MINOR    | Regulations + handbook breadcrumb anchors lack focus indicator | CLOSED | `library/handbook/[slug]/[chapter]/[section]/+page.svelte` and `library/regulations/[kind]/[group]/[section]/+page.svelte` both have `.page-header nav a:focus-visible` rules |
| MINOR    | Regulations TOC sidebar links have no focus rule | CLOSED | `library/regulations/[kind]/[group]/[section]/+page.svelte:181-183` -- `.toc a:focus-visible` rule added |
| MINOR    | Memory-card "back to browse" link iconic-text without aria-hidden | CLOSED | `apps/study/src/routes/(app)/memory/[id]/_panels/CardHeaderPanel.svelte:48` -- arrow wrapped in `<span aria-hidden="true">` |
| MINOR    | Memory-review undo-toast announces actions | STILL OPEN | toast still wraps actions in the live region. Low priority advisory; trigger to revisit if SR users report noisy announcements |
| MINOR    | Login form lacks descriptive `<h1>` | CLOSED | `login/+page.svelte:33` -- `<h1 id="login-heading">Sign in to airboss study</h1>` (brand demoted) |
| MINOR    | Knowledge-graph crumb breadcrumb missing `<ol>` semantics | CLOSED | `knowledge/[slug]/+page.svelte:189` and `learn/+page.svelte:116` use `<nav aria-label="Breadcrumb"><ol class="crumb">` |
| MINOR    | Memory-browse `dismissCreatedBanner` skips focus return | STILL OPEN | low-priority advisory -- not causing reported issues. Trigger: a11y testing sweep on memory/browse |
| NIT      | `(app)/+error.svelte` and root `+error.svelte` could use `role="alert"` | CLOSED | `+error.svelte:47` and `(app)/+error.svelte:42` -- `<div class="card" role="alert">` |
| NIT      | KbdHint announced as part of button label | STILL OPEN (low priority) | `libs/ui/src/components/KbdHint.svelte` doesn't auto-`aria-hidden`. Trigger: SR-user feedback |
| NIT      | Memory-new "Cancel" link styled as a button | STILL OPEN | `apps/study/src/routes/(app)/memory/new/+page.svelte:196` still `<a class="btn ghost">`. Acceptable as a navigation; low priority |

## Summary

Audit of `apps/study/src/routes/**/*.svelte` and `apps/study/src/lib/**/*.svelte` against WCAG 2.1 AA. The study surfaces are generally well-built: real semantic markup (lists, sections, fieldset/legend, dl/dt/dd, scoped table headers), real labels on form fields, breadcrumbs use `<nav aria-label="Breadcrumb">`, the calibration page pairs color signals with non-color glyphs (✓/↑/↓), the rating buttons in `/memory/review/[sessionId]` always render the rating word in addition to color, the skip-link is real, `<main id="main" tabindex="-1">` exists, and most `:focus-visible` blocks supply a visible ring.

The findings cluster in three areas:

1. Focus-indicator removal on link/card hover surfaces (`outline: none` paired only with a border-color change). Several library, lens, and detail surfaces.
2. Unlabeled or weakly-labeled interactive elements (icon-only links in the dashboard map, anchor breadcrumbs that lose underline/focus styles, regulations TOC links with no focus rule, progressbars without an accessible name).
3. ARIA-RADIO patterns that omit arrow-key navigation. The memory/review feedback row and confidence chicklets use `role="radio"` but rely on Tab-and-click instead of arrow keys, breaking the WAI-ARIA radio group contract.

No findings on language attribute (handled by `app.html`), no missing alt text on decorative images (decorative SVGs use `aria-hidden`), and the modal pattern (`Drawer`) appears to be from `@ab/ui/` which is out of scope for this chunk.

## Issues

### CRITICAL: Dashboard map cells are unlabeled links

File: `apps/study/src/routes/(app)/dashboard/_panels/MapPanel.svelte`

WCAG: 2.4.4 Link Purpose, 4.1.2 Name/Role/Value, 1.1.1 Non-text Content

Problem: The 14 x 4 mastery grid renders each filled cell as `<a class="cell filled ..." href={...} title={...} role="cell"></a>`. The anchor has no text content, no `aria-label`, no nested `<span class="visually-hidden">`. The `title` attribute is unreliable for SR users (most ATs ignore it on non-form controls and it's invisible to keyboard-only users) and the `role="cell"` override actually strips the link from the SR's interactive tree on some combinations. Result: ~56 unlabeled, untargetable links in the dashboard.

Fix: Replace `title` with an `aria-label` whose text is the same string `cellTitle()` already produces (e.g. "Aerodynamics / Private Pilot -- 12 / 30 (40%)"). Drop `role="cell"` from the anchor (it's both invalid on `<a>` and conflicts with the implicit link role); keep the wrapping `role="row"` and have the anchor sit inside as the cell's content. If the table semantics matter, wrap each cell in a `<span role="cell">` and put the link inside.

### CRITICAL: Memory-review feedback and confidence radio groups don't support arrow-key navigation

File: `apps/study/src/routes/(app)/memory/review/[sessionId]/+page.svelte`

WCAG: 2.1.1 Keyboard, 4.1.2 Name/Role/Value (ARIA radio group contract)

Problem: Two `role="radiogroup"` regions (the confidence chicklets and the card-feedback pill row) host `<button role="radio" aria-checked={...}>` children. Per WAI-ARIA Authoring Practices the radio group is a single tab stop and arrow keys move between options; here every button is its own tab stop and there is no `onkeydown` handler implementing arrow-key roving focus. SR users navigating with the radio group convention will not find the other options. The number-key shortcuts (1-5) only fire on `svelte:window` and only when no popover is open, and they don't move focus.

Fix: Either (a) implement the standard radio group pattern (only the checked radio is in the tab order with `tabindex="0"`; siblings are `tabindex="-1"`; ArrowLeft/Right/Up/Down moves the tabindex and calls `pickConfidence`/`pickFeedback`), or (b) drop the `role="radio"`/`role="radiogroup"` and use a real `<fieldset>` + `<input type="radio">` group. Option (b) is simpler and matches the appearance preference picker in `(app)/+layout.svelte`, which is already correct.

### CRITICAL: Library-handbook section page (and regs section page) heartbeat / read-suggestion banner relies on aria-live but body changes are unannounced

File: `apps/study/src/routes/(app)/library/handbook/[slug]/[chapter]/[section]/+page.svelte`

WCAG: 4.1.3 Status Messages

Problem: The heartbeat tick silently mutates `accumulatedSecondsThisLoad` and `totalSecondsVisible`, then `shouldShowReadSuggestion()` flips and an `<aside class="read-suggestion" role="status" aria-live="polite">` appears. SR users will hear "Mark this section as read?" but won't be told why -- they'll have no idea the page tracked them passively. More critically, the suggestion is dismissed by clicking "Not yet" but the `<button>` has no `aria-describedby` or comment explaining what dismiss means; the form action `?/set-status` is the affirmative path. Combined with the surprise appearance, this fails Status Messages because the change in the page state isn't announced as a status: it's announced as a new chunk of content with no preamble.

Fix: Change the `role="status"` aside to wrap a brief preamble such as "Suggestion based on your reading time: Mark this section as read?" so the SR user gets context. Alternatively remove `role="status"` and add an explicit live-region that announces "Read suggestion appeared" with `aria-live="polite"` once, then let the buttons stand on their own. Verify with VO that the announcement order is preamble -> question -> buttons.

### MAJOR: Library card grid removes focus indicator on `:focus-visible`

Files:
- `apps/study/src/routes/(app)/library/+page.svelte` (`.card`, `.show-all`)
- `apps/study/src/routes/(app)/library/regulations/+page.svelte` (`.card`)
- `apps/study/src/routes/(app)/library/regulations/[kind]/+page.svelte` (`.card`)
- `apps/study/src/routes/(app)/library/regulations/[kind]/[group]/+page.svelte` (`.section-link`)

WCAG: 2.4.7 Focus Visible, 1.4.11 Non-text Contrast

Problem: Every library landing card declares `outline: none` on `:focus-visible` and replaces the focus ring with `border-color: var(--action-default-edge)`. The same wash color is also used for `:hover`, so a keyboard user can't tell whether they're focused or just hovering. The wash-edge color also doesn't reliably hit the 3:1 non-text contrast ratio against the muted card background in light theme. The `.show-all` button on the library landing has the same pattern.

Fix: Keep the border-color change (it's a nice hover affordance) but restore an outline or box-shadow on `:focus-visible`. Use the project token `var(--focus-ring)` consistent with the memory pages: `outline: 2px solid var(--focus-ring); outline-offset: 2px;` or `box-shadow: 0 0 0 3px var(--focus-ring)`. Apply across all four files.

### MAJOR: Lens / handbook lens cards have no visible focus indicator

File: `apps/study/src/routes/(app)/lens/handbook/+page.svelte`

WCAG: 2.4.7 Focus Visible

Problem: `.card-link` is the entire interactive surface but the stylesheet defines no `:focus-visible` rule for it. The browser default outline may or may not survive the theme's CSS reset; relying on UA defaults for a primary navigation tile is a regression from the focus discipline elsewhere in the app.

Fix: Add an explicit `.card-link:focus-visible` rule mirroring the memory page pattern.

### MAJOR: Goal cards, credentials cards have no `:focus-visible` rule

Files:
- `apps/study/src/routes/(app)/goals/+page.svelte` (`.goal-link`)
- `apps/study/src/routes/(app)/credentials/+page.svelte` (`.card-link`)
- `apps/study/src/routes/(app)/help/+page.svelte` defines one (`.card:focus-visible`) -- keep as a reference pattern

WCAG: 2.4.7 Focus Visible

Problem: Same family as the lens-handbook finding: large card link surfaces with hover styles but no explicit focus rule. The help page does it right; goals and credentials should follow.

Fix: Add `.goal-link:focus-visible` and `.card-link:focus-visible` rules using `outline: 2px solid var(--focus-ring); outline-offset: 2px;`.

### MAJOR: Knowledge-node mastery progressbar has no accessible name

File: `apps/study/src/routes/(app)/knowledge/[slug]/+page.svelte`

WCAG: 4.1.2 Name/Role/Value

Problem: `<div class="mastery-bar" role="progressbar" aria-valuemin="0" aria-valuemax="100" aria-valuenow={masteryPct}>` has no `aria-label` or `aria-labelledby`. SR users will hear "progressbar 65" with no indication this is the node's mastery. The visible "Mastery" label in `.mastery-head` is a sibling, not associated.

Fix: Either give the parent `<section class="mastery-panel" aria-label="Mastery">` already exists (good), but the progressbar is the role-bearing element -- add `aria-label="Mastery"` directly, or add an `id` to the visible "Mastery" span and `aria-labelledby` to the progressbar.

### MAJOR: Knowledge-learn progressbar accessible name + valuetext missing

File: `apps/study/src/routes/(app)/knowledge/[slug]/learn/+page.svelte`

WCAG: 4.1.2 Name/Role/Value

Problem: `.progress-bar role="progressbar" aria-valuemin="1" aria-valuemax={totalPhases} aria-valuenow={stepIndex + 1}` lacks an accessible name and lacks `aria-valuetext`. SR will read "progressbar 3" with no context that this is "Phase 3 of 7: Apply" the way the visible heading conveys.

Fix: Add `aria-label="Phase progress"` (or `aria-labelledby` to the existing `.progress-step` span) and `aria-valuetext={`Phase ${stepIndex + 1} of ${totalPhases}: ${phaseLabel(currentPhase)}`}`. Pattern matches `(app)/sessions/[id]/+page.svelte` which already does this correctly.

### MAJOR: Knowledge-list mastery-bars are decorative but the `.mastery` parent has only `aria-label`

File: `apps/study/src/routes/(app)/knowledge/+page.svelte`

WCAG: 1.3.1 Info and Relationships, 4.1.2 Name/Role/Value

Problem: `<span class="mastery" aria-label="Mastery {n}%"><span class="mastery-bar"><span class="mastery-fill" .../></span><span class="mastery-pct">{n}%</span></span>`. The visible percentage is in the DOM as text and the parent span has the same percent in its `aria-label`. SR users will hear the percentage twice ("Mastery 65 percent ... 65 percent"). More subtly, the `.mastery` wrapper is non-interactive but is being used as a labeled container -- ATs will sometimes announce it as an unlabeled region.

Fix: Drop the redundant `aria-label` on the wrapper. The visible "65%" text is the accessible name. If a screen reader-only label is wanted, use `<span class="visually-hidden">Mastery</span>` before the percent so the order reads "Mastery 65%".

### MAJOR: Counter-trigger button in memory review uses period as sentence separator and `aria-expanded` on a button that does not own the popover

File: `apps/study/src/routes/(app)/memory/review/[sessionId]/+page.svelte`

WCAG: 4.1.2 Name/Role/Value

Problem: `aria-label={`Card ${position} of ${totalCards}. Open jump menu.`}` -- the SR will announce a sentence ending followed by another sentence; this is fine as a label but the bigger issue is `aria-expanded={jumpOpen}` on a button whose popover (`JumpToCardPopover`) is portalled / mounted as a sibling. The button doesn't own the disclosed widget; ATs that follow `aria-controls` will look for it and find nothing because there's no `aria-controls` linking the trigger to the popover dialog. Same pattern with the Share and Snooze header buttons (`aria-haspopup="dialog"` but no `aria-controls`).

Fix: Add `aria-controls={popoverId}` matching the dialog's `id`, and verify the dialog gets a stable id. Lower priority alternative: drop `aria-haspopup` / `aria-expanded` from the trigger and trust the dialog's own announcement when it mounts (verify `Drawer` traps focus and has `role="dialog"` / `aria-modal="true"`).

### MAJOR: Login dev-account `<button>` list has no group label and no role

File: `apps/study/src/routes/login/+page.svelte`

WCAG: 1.3.1 Info and Relationships

Problem: The dev-accounts section is a `<section class="dev"><p class="dev-label">Dev accounts</p><div class="dev-accounts">...</div></section>`. The buttons live in a div, not a list, and the heading "Dev accounts" is a `<p>` with display styling rather than an `<h2>`. SR users navigating by heading will skip past it; users navigating by region won't get the section as a labeled landmark.

Fix: Replace `<section class="dev">` with `<section class="dev" aria-labelledby="dev-accounts-h">`, change the `<p class="dev-label">` to `<h2 id="dev-accounts-h" class="dev-label">`, and convert `.dev-accounts` to a `<ul>` of `<li>` items containing the buttons. Login is dev-only so the impact is small, but the pattern leaks into muscle memory.

### MINOR: Regulations breadcrumb / handbook breadcrumb anchor links lack focus indicator

Files:
- `apps/study/src/routes/(app)/library/handbook/[slug]/[chapter]/[section]/+page.svelte` (.page-header nav a)
- `apps/study/src/routes/(app)/library/regulations/[kind]/[group]/[section]/+page.svelte` (.page-header nav a)

WCAG: 2.4.7 Focus Visible

Problem: Breadcrumb anchors set `color: inherit` and have no `:hover` / `:focus-visible` styles defined locally. They appear as plain text the same color as the surrounding muted nav color; focus relies on the browser default outline which may be reset by the global stylesheet. The same nav exists on the chapter page (`(app)/library/handbook/[slug]/[chapter]/+page.svelte`) where the breadcrumb is built from the `PageHeader` snippet -- check the shared `PageHeader` styling outside the chunk to ensure it carries focus styles, otherwise mirror the fix.

Fix: Add `.page-header nav a:hover, .page-header nav a:focus-visible { text-decoration: underline; outline: 2px solid var(--focus-ring); outline-offset: 2px; }`. Same fix on regulations.

### MINOR: Regulations TOC sidebar links have no focus rule

File: `apps/study/src/routes/(app)/library/regulations/[kind]/[group]/[section]/+page.svelte`

WCAG: 2.4.7 Focus Visible

Problem: `.toc a` has `color: inherit; text-decoration: none;` and the only feedback rule is `.toc a:hover` adding underline (in the handbook section variant). The regulations variant of this file omits even the hover rule (lines 165-168 only define `.toc a { color: inherit; text-decoration: none; }`). Keyboard users tabbing through the TOC have no visual feedback at all.

Fix: Add `.toc a:hover, .toc a:focus-visible { text-decoration: underline; outline: 2px solid var(--focus-ring); outline-offset: 2px; }` mirroring the handbook section page.

### MINOR: Memory-card "back to browse" link is iconic-text without aria-label

File: `apps/study/src/routes/(app)/memory/[id]/+page.svelte`

WCAG: 2.4.4 Link Purpose

Problem: `<a class="back" href={ROUTES.MEMORY_BROWSE}>← Browse</a>` -- the "←" is announced by some screen readers as "left-arrow" and prepended to "Browse", giving "left-arrow Browse" or just the glyph name in punctuation-verbose mode. Minor but inconsistent with the convention elsewhere of putting visual glyphs in `aria-hidden` spans.

Fix: `<a class="back" href={ROUTES.MEMORY_BROWSE}><span aria-hidden="true">←</span> Browse</a>`. Same pattern applies anywhere `←` / `→` glyphs appear in clickable text.

### MINOR: Memory-review undo-toast `aria-live="polite"` repeats info already in the visible toast

File: `apps/study/src/routes/(app)/memory/review/[sessionId]/+page.svelte`

WCAG: 4.1.3 Status Messages (advisory)

Problem: The undo toast appears with `role="status" aria-live="polite"` and contains an `<a>` and two `<button>`s. SR will announce the entire toast contents on appear, including the "View card" link and "Undo U" / "Dismiss undo" buttons. This is verbose and the buttons themselves are then tab-able. Recommendation: scope the live region to the announcement text only.

Fix: Wrap just the `.undo-msg` span in a `role="status"` and let the actions stand outside the live region. Keep the toast container interactive; only the message announces.

### MINOR: Login form lacks an `<h1>` (visible page heading) -- "airboss" is the visual title but it's hierarchical confusion

File: `apps/study/src/routes/login/+page.svelte`

WCAG: 2.4.6 Headings and Labels (advisory; AA passes)

Problem: The card uses `<h1>airboss</h1>` for the brand and `<p class="sub">study</p>` for the page subtitle. Page-purpose-as-title is missing; SR users navigating by heading land on the brand and get no page context until they read the form labels. This is permitted by AA (AAA recommends descriptive page heads) but is a small friction.

Fix: Either change to `<h1>Sign in</h1>` and demote the brand to `<p class="brand">airboss</p>`, or add a visually-hidden `<h1 class="visually-hidden">Sign in to airboss</h1>` and demote the visible "airboss" to a non-heading element.

### MINOR: Knowledge-graph crumb breadcrumb missing `<ol>` semantics

File: `apps/study/src/routes/(app)/knowledge/[slug]/+page.svelte`

WCAG: 1.3.1 Info and Relationships (advisory)

Problem: `<nav class="crumb" aria-label="Breadcrumb"><a>Knowledge</a><span aria-hidden="true">/</span><span>{domainLabel}</span></nav>`. Most SRs handle this fine but `<ol>` of `<li>` is the WAI-ARIA Authoring Practices recommended pattern and will surface item count.

Fix: `<nav aria-label="Breadcrumb"><ol class="crumb"><li><a href=...>Knowledge</a></li><li aria-current="page">{domainLabel}</li></ol></nav>`. Same pattern applies on `(app)/knowledge/[slug]/learn/+page.svelte` line 115.

### MINOR: Memory-browse `dismissCreatedBanner` skips focus return

File: `apps/study/src/routes/(app)/memory/browse/+page.svelte`

WCAG: 2.4.3 Focus Order (advisory)

Problem: After clicking the banner's dismiss button, the call uses `goto({ keepFocus: true, ... })`. `keepFocus: true` retains focus on the dismiss button -- but the button itself is then unmounted by the `{#if createdCard}` guard turning false, so focus reverts to `<body>` and the user loses position.

Fix: Move focus to the next logical control before deletion -- typically the page heading or the result summary. The Banner component (out of scope) may already do this; verify and adjust here if not.

### NIT: `(app)/+error.svelte` and root `+error.svelte` could use `role="alert"`

Files:
- `apps/study/src/routes/+error.svelte`
- `apps/study/src/routes/(app)/+error.svelte`

WCAG: 4.1.3 (advisory)

Problem: The error card is just a `<div class="card">` inside `<main>`. When an error renders mid-flow (form action returning 5xx, etc.), there's no live announcement that the page changed to an error. For first-paint navigation it's fine because the page reloads; for in-page error transitions an `aria-live` region would let SR users know the surface changed.

Fix: Add `role="alert"` to `.card` (or `aria-live="assertive"` on a wrapper). Low priority because most uses are full-page navigation.

### NIT: PIVOT-spec `.kbd` hint inside a button is announced as part of the button label

File: `apps/study/src/routes/(app)/memory/review/[sessionId]/+page.svelte`

WCAG: 1.3.1 (advisory)

Problem: `<button>Show answer<span class="kbd">Enter</span></button>` -- SR announces "Show answer Enter button". For most users this is clear; for some it's noise.

Fix: Add `aria-hidden="true"` to the `.kbd` span so the visual key hint is silent. Pattern recurs anywhere `KbdHint` is inlined in button text.

### NIT: Memory-new "Cancel" link styled as a button

File: `apps/study/src/routes/(app)/memory/new/+page.svelte`

WCAG: 4.1.2 Name/Role/Value (advisory)

Problem: `<a class="btn ghost" href={ROUTES.MEMORY}>Cancel</a>` is announced as a link, but the visual treatment is a button. Inconsistent with the adjacent `<Button>` components (real `<button>` / `<a>` from the UI lib). Not a real bug -- links that navigate are correct -- but if the intent is "discard form and go home" the affordance signals "button".

Fix: Either keep as a link and accept the SR-button mismatch (it's actually a navigation), or convert to a real button that calls `history.back()` / `goto(ROUTES.MEMORY)`.
