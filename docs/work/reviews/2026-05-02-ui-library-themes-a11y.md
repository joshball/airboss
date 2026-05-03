---
feature: ui-library-themes
category: a11y
date: 2026-05-02
branch: main
status: unread
review_status: done
counts:
  critical: 6
  major: 17
  minor: 11
  nit: 5
  total: 39
closed_out: 2026-05-04
---

## Summary

Reviewed the four shared libraries that surface to every app: `libs/ui/` (~57 components), `libs/themes/` (token + contrast machinery), `libs/activities/` (PFD, cockpit panel, crosswind), and `libs/help/` (drawer + palette + markdown renderer). Several primitives (Dialog, Drawer, Tabs, Spinner, Button, TextField, Select, Checkbox) are well-built: focus trap, ESC, focus return, `aria-modal`, `aria-describedby` plumbing, `aria-sort` on DataTable, and reduced-motion guards on Drawer/Spinner/NavIndicator. Bigger problems are concentrated in (a) the ad-hoc popovers in `libs/ui/src/components/` that pre-date the Dialog primitive (`SnoozeReasonPopover`, `JumpToCardPopover`, `SharePopover`, `CitationPicker`, `HelpSearchPalette`), (b) "card-as-link" patterns that disable `outline` without a replacement focus indicator, (c) link affordances that rely on color alone, and (d) the cockpit `AnnunciatorStrip` (flashing animation, no reduced-motion guard, wrong ARIA semantics).

The single highest-impact pattern fix is "remove `outline: none` on `:focus-visible` selectors and either keep the outline or replace it with a clearly visible alternative." That convergent fix touches at least six components.

The Crosswind activity has a critical contrast bug: the OVER DEMO badge sets `color` and `background` to the same token (`var(--action-hazard)`), making the warning text invisible against its own background.

## Issues

### CRITICAL: OVER DEMO warning badge has zero contrast (text invisible)

- File: `libs/activities/src/crosswind-component/CrosswindComponent.svelte` (lines 619-630)
- WCAG: 1.4.3 Contrast (Minimum), 1.4.11 Non-text Contrast
- Problem: `.warn-badge` sets `color: var(--action-hazard)` and `background: var(--action-hazard)` -- identical foreground and background tokens. The text "OVER DEMO" / "TAILWIND" rendering inside the badge is invisible to all sighted users; the safety-critical warning is conveyed only by the surrounding "warn" color on the value.
- Fix: change `color` to a high-contrast ink (e.g. `var(--action-hazard-ink)` or `var(--ink-inverse)`) so the badge text reads as a normal warning chip on a hazard background. Verify against the contrast harness in `libs/themes/__tests__/contrast.test.ts`.

### CRITICAL: HelpSearchPalette suppresses input focus indicator

- File: `libs/help/src/ui/HelpSearchPalette.svelte` (lines 256-258)
- WCAG: 2.4.7 Focus Visible
- Problem: `input:focus-visible { outline: none; }` removes the keyboard focus indicator on the search field. The palette is opened by `/` or `Cmd+K` and immediately focuses this input, but a keyboard user re-tabbing back to it sees no focus state. There is no replacement (the palette frame has no visible "input is focused" treatment).
- Fix: drop the `outline: none` rule, or replace with a visible alternative (`box-shadow: 0 0 0 2px var(--focus-ring)` or a border-color shift to `--action-default`).

### CRITICAL: HelpSearchPalette is a dialog with no focus trap

- File: `libs/help/src/ui/HelpSearchPalette.svelte` (lines 130-213)
- WCAG: 2.1.2 No Keyboard Trap (in the inverse direction -- focus can leak out, breaking the modal contract)
- Problem: the palette declares `role="dialog"` + `aria-modal="true"`, but the only key handler (`handleKey`) is wired to the input element. Tab/Shift+Tab inside the palette is not trapped; once a result button receives focus, further Tab moves into underlying page chrome behind the scrim. Combined with no roving tabindex on the result lists, keyboard users cannot reliably navigate.
- Fix: route key events through the shared `createFocusTrap` helper (mirrors Dialog/Drawer/InfoTip), or implement aria-activedescendant against a single live `aria-activedescendant` on the input, and keep arrow keys driving `focusedIndex` while Tab does not move at all.

### CRITICAL: Card-as-link primitives suppress focus indicator

- Files:
  - `libs/ui/src/components/BrowseListItem.svelte` (`.card-link` -- no `:focus-visible` rule at all)
  - `libs/ui/src/handbooks/HandbookCard.svelte` (lines 58-62: `:focus-visible { outline: none }`, only border-color change)
  - `libs/ui/src/handbooks/HandbookSectionListItem.svelte` (lines 53-57: same pattern)
  - `libs/ui/src/library/LibraryCard.svelte` (lines 135-141: same pattern)
- WCAG: 2.4.7 Focus Visible, 1.4.11 Non-text Contrast (focus indicator must hit 3:1 against adjacent colors)
- Problem: each "whole card is an `<a>`" primitive replaces the UA outline with a border-color change to `--action-default-edge`. The edge token is a low-contrast accent designed for rest-state borders and does not reach 3:1 against the surrounding card surface. `BrowseListItem` has no focus styling at all -- relies entirely on UA defaults that don't apply once the card-link is the focusable target. Every list view in the app (browse, library, handbook chapter list, knowledge index) is affected.
- Fix: keep the UA outline (drop `outline: none`) or replace with `outline: 2px solid var(--focus-ring); outline-offset: 2px` to match Button/Tabs/Card primitives. One root fix lands across all four files.

### CRITICAL: HandbookReadProgressControl segmented radios are non-focusable

- File: `libs/ui/src/handbooks/HandbookReadProgressControl.svelte` (lines 119-123)
- WCAG: 2.1.1 Keyboard, 2.4.7 Focus Visible
- Problem: each radio in the Reading-progress segmented control is hidden via `position: absolute; opacity: 0; pointer-events: none;`. While `pointer-events: none` does not strip the radio from the tab order, the input is invisible AND the wrapping `.segment` label has no `:focus-within` state -- so a keyboard user receiving focus has no visual indication of which segment is current. (Mouse/touch users are also affected: `pointer-events: none` means clicking the visible label is the only entry, which works because the label `for` is implicit, but discoverability is poor.)
- Fix: keep the input `position: absolute; clip: rect(0,0,0,0)` (sr-only pattern) and add `.segments:focus-within .segment` styling that mirrors `.segment.active`, plus `.segment input:focus-visible + span` rules so the active-focus state is visually distinct from the active-checked state. Refactor to use the existing `RadioGroup.svelte` primitive if possible.

### CRITICAL: SVG instruments expose no accessible name to AT

- Files: all five PFD instruments and all cockpit-panel instruments
  - `libs/activities/src/pfd/AirspeedTape.svelte` (line 100)
  - `libs/activities/src/pfd/AltitudeTape.svelte` (line 105)
  - `libs/activities/src/pfd/AttitudeIndicator.svelte`
  - `libs/activities/src/pfd/HeadingIndicator.svelte`
  - `libs/activities/src/pfd/VsiIndicator.svelte`
  - `libs/activities/src/cockpit-panel/Altimeter.svelte` (line 24) and siblings
- WCAG: 1.1.1 Non-text Content, 4.1.2 Name Role Value
- Problem: every SVG declares `role="img"` but has no `<title>` child, no `aria-label`, and no `aria-labelledby`. The wrapping `<div class="instrument" aria-label="...">` does not propagate to the SVG -- AT exposes the SVG as a nameless image. A screen reader on the SVG element announces "image" with no value.
- Fix: move the dynamic `aria-label` from the wrapping `<div>` onto the SVG itself, or add a `<title>` element as the first child of each `<svg>` whose content equals the current readout (e.g. "Airspeed 87 knots"). Drop the wrapper-div aria-label so AT doesn't double-announce. Apply across the eleven instrument files.

### MAJOR: AnnunciatorStrip animation ignores prefers-reduced-motion

- File: `libs/activities/src/cockpit-panel/AnnunciatorStrip.svelte` (lines 56-74)
- WCAG: 2.3.3 Animation from Interactions, 2.3.1 Three Flashes (boundary case)
- Problem: `lamp-flash` runs at 0.8s steps(2) infinitely (1.25 Hz) with high-contrast yellow/red color flips. The comment in the code explicitly disables token enforcement claiming the cadence is a "learned visual convention" that should be deterministic. WCAG 2.3.3 requires that motion triggered by interaction can be disabled; the rate (1.25 Hz) is below the 3-flash photo-sensitive threshold but is still meaningful animation that prefers-reduced-motion users should be able to suppress. There is no opt-out.
- Fix: wrap the animation in `@media (prefers-reduced-motion: no-preference)` (ship-on-by-default but skip when the user opts out). When suppressed, leave the lamp in the steady-on `lamp.on` state so the warning is still conveyed by color + label text rather than by motion.

### MAJOR: AnnunciatorStrip uses aria-pressed on non-button spans

- File: `libs/activities/src/cockpit-panel/AnnunciatorStrip.svelte` (lines 24-28)
- WCAG: 4.1.2 Name Role Value
- Problem: lamps are `<span>` elements with `aria-pressed={!!state?.lowFuel}`. `aria-pressed` is only valid on elements with role=button (and toggle-button semantics). Lamps are status indicators, not buttons. AT may ignore the attribute, announce the lamp as a button, or expose it inconsistently.
- Fix: switch to a status-indicator pattern. Either give each lamp `role="status"` and rely on text content + an aria-label that includes "lit"/"off", or render the strip as an `<ul>` of `<li>` rows with visually-hidden state text ("LOW VOLTS, lit"). Drop `aria-pressed`.

### MAJOR: Crosswind activity decomposition vectors are color-coded only

- File: `libs/activities/src/crosswind-component/CrosswindComponent.svelte` (lines 540-567)
- WCAG: 1.4.1 Use of Color
- Problem: headwind vs tailwind is only distinguished by stroke color (`--signal-success` vs `--action-caution`); crosswind exceeding the demo limit is only distinguished by stroke color (`--accent-reference` vs `--action-hazard`). Colorblind users (especially deuteranopia/protanopia) cannot distinguish the two states from the diagram alone. The readout panel does have text ("Tailwind"/"Headwind", "OVER DEMO") so the information is recoverable, but the diagram itself fails the test.
- Fix: add a non-color signal to the over-threshold and tailwind states (dashed stroke for over-demo, double-headed arrow head or label sprite for tailwind). Keep the color as redundancy.

### MAJOR: HelpCard variant is conveyed by left-border color only

- File: `libs/help/src/ui/HelpCard.svelte` (lines 39-75)
- WCAG: 1.4.1 Use of Color
- Problem: the six variants (tip, warn, danger, howto, note, example) are visually distinguished only by the 4px left-border color. There is no icon, no eyebrow text, no aria-label difference; warn and danger cards look identical to a colorblind user, and a screen reader (only `role="note"`) cannot tell which variant rendered.
- Fix: add a visible eyebrow label per variant ("Warning", "Tip", "Danger", "How-to", "Note", "Example") rendered above the title, OR an icon (svg sprite) that semantically distinguishes the variant. Mirror the eyebrow text in an aria-label so AT users learn the variant too.

### MAJOR: ConfidenceSlider radios miss arrow-key navigation and roving tabindex

- File: `libs/ui/src/components/ConfidenceSlider.svelte` (lines 22-38)
- WCAG: 2.1.1 Keyboard, 4.1.2 Name Role Value (ARIA radio pattern)
- Problem: the five confidence buttons are role-overridden to `role="radio"` inside `role="radiogroup"`, but they do not implement the WAI-ARIA radio pattern: every button is in the tab order (Tab cycles through them all), arrow keys do not move selection, and Home/End are not handled. A keyboard user expecting radio semantics (one tab stop, arrow to navigate) is broken.
- Fix: use a roving `tabindex` (selected button has `tabindex={0}`, others `tabindex={-1}`) and add an `onkeydown` handler that handles ArrowLeft/Right, Home, End. Or replace with the existing `RadioGroup.svelte` primitive, since the underlying mechanic is identical.

### MAJOR: JumpToCardPopover listbox has button-roled options

- File: `libs/ui/src/components/JumpToCardPopover.svelte` (lines 112-130)
- WCAG: 4.1.2 Name Role Value
- Problem: the options list is a `<div role="listbox">` containing `<button role="option">` elements. The native `<button>` role conflicts with the `role="option"` override, producing inconsistent AT announcements. Additionally, every option button has the default `tabindex=0` -- ARIA listbox pattern requires a single roving tab stop.
- Fix: switch to native semantics: keep the `<div role="listbox">`, use `<div role="option" tabindex="-1">` for rows (or `<li role="option">` inside `<ul role="listbox">`), and assign `tabindex={index === currentIndex ? 0 : -1}` so only the active option is in the tab order. Activation on Enter/Space is already handled in the keydown branch.

### MAJOR: CitationPicker results listbox uses ul/li wrappers and tabbable buttons

- File: `libs/ui/src/components/CitationPicker.svelte` (lines 257-287)
- WCAG: 4.1.2 Name Role Value
- Problem: `<div role="listbox"><ul><li><button role="option">` -- the `<ul>` and `<li>` insert listitem semantics inside a listbox, which is invalid. Every option button is independently tabbable. There is no arrow-key navigation between options; users must Tab through every result row to reach the Confirm button.
- Fix: either drop the `<ul>` and render `<button role="option">` directly inside the `role="listbox"` div with roving tabindex + arrow-key handler, or use plain native semantics (`<ul>` of clickable `<li>` + visually-hidden radios).

### MAJOR: CitationPicker tablist missing aria-controls and roving tabindex

- File: `libs/ui/src/components/CitationPicker.svelte` (lines 209-225)
- WCAG: 4.1.2 Name Role Value (ARIA tabs pattern)
- Problem: tabs have `role="tab"` and `aria-selected` but no `aria-controls`, no `tabindex` management, and no arrow-key handler. The shared `Tabs.svelte` primitive implements all of this correctly -- this picker dialog reinvents tabs without the keyboard support.
- Fix: refactor to use the shared `Tabs.svelte` component (passing the tab content via the `panel` snippet), or copy its keydown/tabindex handling.

### MAJOR: Drawer has no built-in close button

- File: `libs/ui/src/components/Drawer.svelte` (lines 89-118), affecting `libs/help/src/ui/PageHelp.svelte`
- WCAG: 2.1.1 Keyboard (alternative dismiss path), 3.2.2 On Input
- Problem: the Drawer primitive ships only Escape and scrim-click as dismiss paths. Callers (e.g. PageHelp) do not pass a header snippet that contains an explicit close button. Touch-screen users without a hardware keyboard, AT users on mobile, and any user who cannot reach the scrim (drawer is full-width on mobile per the Drawer styles) have no visible "close" affordance. This makes the entire help-drawer experience effectively dead-end on touch devices.
- Fix: ship a default close button inside the Drawer primitive's header bar (with `aria-label="Close"` and the `&times;` glyph), and let callers opt out via a prop if they intentionally want to suppress it. Mirror the SharePopover/JumpToCardPopover header pattern.

### MAJOR: SnoozeReasonPopover comment textarea missing required + aria semantics

- File: `libs/ui/src/components/SnoozeReasonPopover.svelte` (lines 236-250)
- WCAG: 3.3.2 Labels or Instructions, 4.1.2 Name Role Value
- Problem: the comment label says " (required)" when the selected reason demands a comment, but the underlying textarea does not get `required`, `aria-required="true"`, or `aria-invalid` when validation fails. The error `<p role="alert">` is rendered separately but is not linked via `aria-describedby` from the textarea. SR users learn the requirement only through the visible label text.
- Fix: bind `required={requiresComment}` and `aria-required={requiresComment}` on the textarea; when `submitError` is set, also set `aria-invalid="true"` and `aria-describedby={errorId}`; assign an id to the error element.

### MAJOR: HandbookSectionNotes counter is silent to AT and missing maxlength

- File: `libs/ui/src/handbooks/HandbookSectionNotes.svelte` (lines 33-37)
- WCAG: 4.1.3 Status Messages, 3.3.1 Error Identification, 3.3.3 Error Suggestion
- Problem: when the user types past `HANDBOOK_NOTES_MAX_LENGTH`, the counter color shifts to `--signal-danger` and the submit button disables. There is no `aria-live` region to announce the overflow, no `aria-invalid="true"` on the textarea, no `aria-describedby` linking the textarea to the counter, and no `maxlength` attribute hard-stopping the input.
- Fix: wrap the counter in `aria-live="polite"`, add `aria-describedby="counter-id"` to the textarea, set `aria-invalid={overflowing}`, and add `maxlength={HANDBOOK_NOTES_MAX_LENGTH}` so the browser refuses additional characters as a baseline.

### MAJOR: FormField does not propagate id to caller's control

- File: `libs/ui/src/components/FormField.svelte` (lines 26-46)
- WCAG: 1.3.1 Info and Relationships, 4.1.2 Name Role Value
- Problem: the wrapping `<label for={forId}>` only associates with the inner control if the caller manually sets `id={forId}` on the rendered control. The component computes an `idBase` derived value internally but does not expose it via the snippet payload; callers either pass `forId` (and remember to put it on both `for` and `id`) or end up with a broken label-control association silently. The snippet currently emits `{describedBy, invalid}` but not the id.
- Fix: also emit `id` in the snippet payload (`{id, describedBy, invalid}`) and have the label `for={id}` reference the same value. Document via a JSDoc that callers must spread `{id}` onto the rendered control.

### MAJOR: Color-only link affordance across markdown / chips / cited-by

- Files:
  - `libs/help/src/ui/MarkdownBody.svelte` (`.md-link` lines 210-220)
  - `libs/ui/src/components/CitationChips.svelte` (`.citation-label:is(a)` lines 104-110)
  - `libs/ui/src/components/CitedByPanel.svelte` (`.cited-by-label` lines 121-129)
  - `libs/ui/src/components/InfoTip.svelte` (`.learn-more` lines 316-326)
- WCAG: 1.4.1 Use of Color
- Problem: each link uses `text-decoration: none` by default and is identifiable only by color (`--action-default` or `--action-default-active`) against `--ink-body` body text. WCAG requires either a non-color cue (underline, weight, icon) at rest, or a 3:1 luminance ratio between the link color and adjacent text color. Hover/focus underline does not meet the rest-state requirement.
- Fix: ship `text-decoration: underline` (or a `border-bottom`) at rest. Convergent fix that lands in four files; pair with a token (`--link-underline-thickness`, `--link-underline-offset`) so themes can tune the look without losing the affordance.

### MAJOR: Banner role assignment misses warning-tier urgency

- File: `libs/ui/src/components/Banner.svelte` (line 31)
- WCAG: 4.1.3 Status Messages
- Problem: `role` is hardcoded to `alert` only when `tone === 'danger'`. Warning-tier banners (e.g. "your session is about to expire") render with `role="status"`, which AT may not announce until the next quiet moment. For urgent-but-not-fatal messaging, `role="alert"` or `aria-live="assertive"` is appropriate.
- Fix: map `warning` to `role="alert"` as well, OR expose an `urgency` prop on the Banner so callers choose; default warning-tier to alert and tone-info/success to status. Document the matrix in the JSDoc.

### MAJOR: Banner dismiss button uses bare lowercase "x" character

- File: `libs/ui/src/components/Banner.svelte` (lines 41-50)
- WCAG: 1.1.1 Non-text Content (boundary), 3.3.2 Labels or Instructions
- Problem: the dismiss button's visible content is the literal lowercase letter `x`. While `aria-label="Dismiss"` makes the button SR-accessible, sighted users see a letter where icon-conventions expect a multiplication sign or close icon. Some AT (Voice Control) ignore aria-label and target the visible text "x" -- saying "click x" may not match. The pattern is also visually ambiguous next to body text containing the letter x.
- Fix: switch the visible glyph to `&times;` (×) or an SVG close icon. Keep the aria-label.

### MAJOR: Tab list active state may have insufficient contrast (token-dependent)

- File: `libs/ui/src/components/Tabs.svelte` (lines 156-162)
- WCAG: 1.4.3 Contrast (Minimum), 1.4.11 Non-text Contrast
- Problem: the active tab paints `color: var(--action-default)` text on `background: var(--action-default-wash)`. `--action-default-wash` is a low-saturation tint of the same hue family as `--action-default`; depending on the resolved tones in each theme, this combination can fall below 4.5:1 for normal text. The repo has a contrast harness (`libs/themes/__tests__/contrast.test.ts`) but I did not see explicit test coverage for action-default vs action-default-wash.
- Fix: add a contrast assertion in the theme contract for `(action-default-text-on-action-default-wash) >= 4.5:1`, and bump the token relationship in the theme generators if any theme fails. If the design intent is "the active tab feels lower-contrast on purpose," switch the active text token to `--action-default-active` (a darker variant) or to `--ink-body`.

### MINOR: Pager status not in a live region

- File: `libs/ui/src/components/Pager.svelte` (line 39)
- WCAG: 4.1.3 Status Messages
- Problem: "Page X of Y" is a plain `<span>`. When the user activates the next-page link and the pager re-renders, no announcement happens because the span is not in a live region. SR users have to navigate back to the pager to learn what happened.
- Fix: wrap the page-number span in `aria-live="polite"` and `aria-atomic="true"` so transitions are announced.

### MINOR: SharePopover Copy button uses aria-live on the button itself

- File: `libs/ui/src/components/SharePopover.svelte` (line 124)
- WCAG: 4.1.3 Status Messages
- Problem: the Copy button has `aria-live="polite"` directly on the button. When the label flips to "Copied!", the button gets re-announced, but the announcement is wrapped in button semantics rather than a status. Better practice is a separate `<span role="status" aria-live="polite">` element that mirrors the copy result.
- Fix: introduce a sibling status span (`<span class="copy-status" role="status" aria-live="polite">{copied ? 'Copied!' : ''}</span>`) and remove `aria-live` from the button. Visible label inside the button can still flip text content for sighted users.

### MINOR: SharePopover dialog title not associated with aria-labelledby

- File: `libs/ui/src/components/SharePopover.svelte` (lines 109-119)
- WCAG: 1.3.1 Info and Relationships
- Problem: the dialog uses `aria-label="Share this card"` while a visible h2 with the same text is rendered. Best practice is to use `aria-labelledby` pointing to the h2 id so the SR-announced name and the visible heading stay in sync.
- Fix: assign an id to the h2 (`id="sharepopover-title"`) and replace `aria-label` with `aria-labelledby="sharepopover-title"`.

### MINOR: Table wrapper not focusable when horizontally scrollable

- Files: `libs/ui/src/components/Table.svelte`, `libs/ui/src/components/DataTable.svelte`
- WCAG: 2.1.1 Keyboard
- Problem: both wrappers use `overflow-x: auto` to handle wide tables but do not set `tabindex="0"` on the scroll container. Keyboard users cannot focus the wrapper to scroll horizontally with arrow keys; only mouse wheel + drag scrollbar reach the off-screen columns.
- Fix: when content overflows, the wrapper should be focusable (`tabindex="0"`) and have a visible focus indicator. A simple `tabindex="0"` plus a `role="region"` with `aria-label` (e.g. the table caption) covers it.

### MINOR: ConfirmDialog typed-gate input uses :focus instead of :focus-visible

- File: `libs/ui/src/components/ConfirmDialog.svelte` (lines 196-199)
- WCAG: 2.4.7 Focus Visible
- Problem: the destructive-action gate input shows the focus ring on every focus (mouse + keyboard), which is acceptable for inputs. However, the project elsewhere uses `:focus-visible` consistently. Inconsistent rules make theme migration harder.
- Fix: switch to `:focus-visible` to match the rest of the form primitives, or document the deviation in the component JSDoc.

### MINOR: ConfirmDialog typed-gate has no aria-describedby explaining gate

- File: `libs/ui/src/components/ConfirmDialog.svelte` (lines 100-114)
- WCAG: 3.3.2 Labels or Instructions
- Problem: the user must type a specific string for Confirm to enable, but the disabled state of Confirm is not announced. There is no `aria-describedby` linking the typed input to a "Type X to confirm" hint, and the disabled Confirm button has no `aria-describedby` explaining why it is disabled.
- Fix: render the expected string as a small caption with an id, set `aria-describedby` on the input pointing to it, and on the Confirm button while it is disabled.

### MINOR: RadioGroup duplicates accessible name (fieldset aria-label + legend)

- File: `libs/ui/src/components/RadioGroup.svelte` (lines 81-92)
- WCAG: 1.3.1 Info and Relationships
- Problem: the component sets `aria-label` on the `<fieldset>`, renders a `<legend>` inside it (which already provides the accessible name), AND wraps the radios in an inner `<div role="radiogroup">` with another `aria-label`. AT may double-announce, or pick the inner one and skip the legend.
- Fix: choose one source of truth for the name. Recommended: drop the inner `role="radiogroup"` (the fieldset already groups the radios) and use only the legend as the accessible name. Keep the outer `aria-label` only as a fallback for callers that omit the legend.

### MINOR: Divider could use semantic hr

- File: `libs/ui/src/components/Divider.svelte`
- WCAG: 1.3.1 Info and Relationships
- Problem: the component renders a `<div role="separator">`. Browsers expose `<hr>` natively as separator with the same default semantics, no role attribute required.
- Fix: render `<hr>` for horizontal orientation and keep the `<div role="separator" aria-orientation="vertical">` only for vertical (since hr is hardcoded horizontal in HTML semantics).

### MINOR: FilterChips wrapper missing landmark or list role

- File: `libs/ui/src/components/FilterChips.svelte` (lines 36-53)
- WCAG: 1.3.1 Info and Relationships
- Problem: the chip row is a `<div>` with `aria-label="Active filters"`. `aria-label` on a generic div without role is not consistently exposed by AT (the WAI-ARIA spec leaves it implementation-defined). The chips themselves are anchors but they are not in a list.
- Fix: wrap chips in a `<nav aria-label="Active filters">` (the chips are filter-removal navigation), or use `<ul role="list">` + `<li>` with `role="presentation"` removed so AT exposes the chip count.

### MINOR: PfdInputs sliders / reset button rely on UA focus default

- File: `libs/activities/src/pfd/PfdInputs.svelte` (lines 138-161)
- WCAG: 2.4.7 Focus Visible
- Problem: range inputs have no `:focus-visible` rule defined; the `.reset` button only flips border-color on `:focus-visible` (no explicit outline). UA defaults vary (some browsers paint a black outline, some paint a blue glow, some paint nothing for sliders).
- Fix: ship explicit `:focus-visible { outline: 2px solid var(--focus-ring); outline-offset: 2px }` on `input[type='range']` and the reset button. Mirrors Button/TextField primitives.

### MINOR: BrowseViewControls selects rely on UA focus default

- File: `libs/ui/src/components/BrowseViewControls.svelte` (lines 90-97)
- WCAG: 2.4.7 Focus Visible
- Problem: the local select rule sets only border + padding; no `:focus-visible`. UA outline applies but is inconsistent across browsers and themes.
- Fix: add `select:focus-visible { outline: 2px solid var(--focus-ring); outline-offset: 2px }` to match the form primitives.

### MINOR: CitationChips remove button missing focus-visible

- File: `libs/ui/src/components/CitationChips.svelte` (lines 123-135)
- WCAG: 2.4.7 Focus Visible
- Problem: the remove "×" button has no `:focus-visible` style. UA default applies.
- Fix: add explicit focus-visible outline matching Button.

### MINOR: HelpSearch trigger lacks aria-expanded

- File: `libs/help/src/ui/HelpSearch.svelte` (lines 51-62)
- WCAG: 4.1.2 Name Role Value
- Problem: the search trigger button toggles a palette dialog but does not advertise the disclosure relationship via `aria-haspopup="dialog"` and `aria-expanded`. Mirrors the InfoTip and PageHelp triggers (which do).
- Fix: add `aria-haspopup="dialog"`, `aria-expanded={open}`, and `aria-controls={paletteId}` referencing the palette's id.

### NIT: StatTile tone is conveyed by value color only

- File: `libs/ui/src/components/StatTile.svelte` (lines 126-132)
- WCAG: 1.4.1 Use of Color (boundary)
- Problem: the tile tone (info/success/warning/danger/featured/muted/accent) is communicated only by recoloring the value. The label and sub strings are tone-neutral; a colorblind user sees all stat tiles the same.
- Fix: optionally add a small icon next to the value, or accept that tile callers (the dashboard) supplement with explicit text in the sub line ("3 overdue", "100% complete"). Document the affordance expectation in the JSDoc.

### NIT: PanelShell error uses --action-hazard ink on hazard-wash

- File: `libs/ui/src/components/PanelShell.svelte` (lines 157-165)
- WCAG: 1.4.3 Contrast
- Problem: the error text uses `color: var(--action-hazard)` on `background: var(--action-hazard-wash)`. Same family of concern as the Banner danger tone -- the contract requires the contrast harness to assert `(--action-hazard) on (--action-hazard-wash) >= 4.5:1` and the asserted theme matrix should cover that pair.
- Fix: verify the contrast tests cover this pair; if not, add. If any theme fails, switch the foreground to `--action-hazard-active` (typically a darker/stronger variant).

### NIT: KbdHint min-height/min-width borrow from --badge-height-md

- File: `libs/ui/src/components/KbdHint.svelte` (lines 25-43)
- WCAG: 2.5.5 Target Size (boundary, AAA)
- Problem: the kbd hint is sized to 1.5rem-ish. Not interactive so target size doesn't strictly apply, but the kbd glyphs render small. Fine for decoration; acceptable.
- Fix: no change needed; flagged for awareness if KbdHint ever becomes clickable.

### NIT: Spinner has no role="progressbar" with aria-valuetext

- File: `libs/ui/src/components/Spinner.svelte` (line 25-26)
- WCAG: 4.1.3 Status Messages (boundary)
- Problem: spinner is `role="status"` with `aria-label="Loading"`. Sufficient for indeterminate progress; SR will announce "Loading". WAI-ARIA also accepts `role="progressbar"` for indeterminate states via no aria-valuenow. Either is fine -- the current choice is defensible.
- Fix: no change needed; flagged because reviewers occasionally pattern-match on "progressbar role" and may flag this.

### NIT: HandbookCard / LibraryCard progress bar lacks role="progressbar"

- Files: `libs/ui/src/handbooks/HandbookCard.svelte`, `libs/ui/src/library/LibraryCard.svelte`
- WCAG: 1.3.1 Info and Relationships
- Problem: the progress bar is two divs (`.bar > .fill`); `aria-label="Reading progress"` is on the wrapper but no `role="progressbar"`, no `aria-valuenow`/`aria-valuemax`. The visible text counts compensate.
- Fix: add `role="progressbar" aria-valuenow={percentRead} aria-valuemin="0" aria-valuemax="100" aria-valuetext="{readSections} of {totalSections} sections read"` to the bar div. Removes the need for the outer aria-label.

## Status as of 2026-05-04

| # | Severity | Finding | Verdict |
|---|----------|---------|---------|
| 1 | Critical | Crosswind OVER DEMO badge zero-contrast | CLOSED -- color now `--action-hazard-ink` on `--action-hazard` background. |
| 2 | Critical | HelpSearchPalette input focus indicator suppressed | CLOSED in this audit -- replaced `outline: none` with `box-shadow: 0 0 0 2px var(--focus-ring)`. |
| 3 | Critical | HelpSearchPalette no focus trap | CLOSED in this audit -- `createFocusTrap` allocated on open, released on close, keydown routed through `trap.handleKeyDown`. |
| 4 | Critical | Card-link primitives suppress focus indicator | CLOSED -- `BrowseListItem`, `HandbookCard`, `HandbookSectionListItem`, `LibraryCard` all ship `outline: 2px solid var(--focus-ring)` on `:focus-visible`. |
| 5 | Critical | HandbookReadProgressControl segmented radios non-focusable | CLOSED in this audit -- dropped `pointer-events: none`, applied sr-only clip pattern to keep input visually hidden but focusable, added `:focus-within` outline on the segment wrapper. |
| 6 | Critical | SVG instruments expose no accessible name | CLOSED -- all five PFD instruments and seven cockpit-panel instruments now carry `aria-label` on the `<svg>` itself; ClusterGauge fixed in this audit (label moved off wrapping div onto svg). FuelGauge uses divs not SVG so wrapper-div label is correct. |
| 7 | Major | AnnunciatorStrip ignores `prefers-reduced-motion` | CLOSED in this audit -- `lamp-flash` keyframes wrapped in `@media (prefers-reduced-motion: no-preference)`. |
| 8 | Major | AnnunciatorStrip uses `aria-pressed` on non-button spans | CLOSED in this audit -- dropped `aria-pressed`; relies on `role="status"` live region + on/off class for state changes. |
| 9 | Major | Crosswind decomposition vectors color-only | CLOSED in this audit -- tailwind line shows `stroke-dasharray: 8 4`, over-demo crosswind shows `stroke-dasharray: 4 4`. Color remains as redundant cue. |
| 10 | Major | HelpCard variant border-color only | CLOSED in this audit -- visible eyebrow ("Tip"/"Warning"/"Danger"/etc.) above title plus `aria-label={variantLabel}` on the aside. |
| 11 | Major | ConfidenceSlider no roving tabindex | CLOSED in correctness pass -- arrow-key + Home/End roving handler added, tabindex follows selection. |
| 12 | Major | JumpToCardPopover button-roled options | CLOSED -- `tabindex={index === currentIndex ? 0 : -1}` already implements roving, kept native `<button>` for click activation. |
| 13 | Major | CitationPicker results listbox uses ul/li wrappers | CLOSED in this audit -- dropped `<ul><li>`, render `<button role="option">` directly inside the listbox with roving tabindex + `handleResultKeyDown` arrow nav. |
| 14 | Major | CitationPicker tablist missing aria-controls / roving | CLOSED in this audit -- added `aria-controls` linking each tab to a `role="tabpanel"` wrapper, roving `tabindex` synced to `activeType`, `handleTabKeyDown` arrow/Home/End navigation. |
| 15 | Major | Drawer no built-in close button | CLOSED in this audit -- new `closeButton` prop (default `true`, opt-out for callers with their own affordance) renders a `&times;` button in the header with `aria-label`. |
| 16 | Major | SnoozeReasonPopover textarea missing required + aria | CLOSED in this audit -- `required={requiresComment}`, `aria-required`, `aria-invalid={submitError}`, `aria-describedby={errorId}`; per-instance error id via `$props.id()`. |
| 17 | Major | HandbookSectionNotes counter silent + missing maxlength | CLOSED in this audit -- `maxlength={HANDBOOK_NOTES_MAX_LENGTH}`, `aria-invalid`, `aria-describedby`, counter wrapped in `aria-live="polite" aria-atomic="true"`. |
| 18 | Major | FormField does not propagate id to caller's control | CLOSED in this audit -- snippet payload now `{id, describedBy, invalid}`; label `for={idBase}`. Primitive demo updated. |
| 19 | Major | Color-only links in markdown / chips / cited-by / InfoTip | CLOSED in this audit -- all four primitives ship always-on underline (`border-bottom: 1px solid currentColor` for markdown, `text-decoration: underline` for the chip/cited-by/learn-more variants). Hover thickens rather than introducing a new affordance. |
| 20 | Major | Banner role assignment misses warning urgency | CLOSED in this audit -- `tone === 'danger' \|\| tone === 'warning'` -> `role="alert"`. |
| 21 | Major | Banner dismiss "x" character | CLOSED -- now uses U+00D7 multiplication sign. |
| 22 | Major | Tab list contrast (action-default on action-default-wash) | CLOSED -- `libs/themes/__tests__/contrast.test.ts` covers the action role pair; theme generators clamp accent saturation to keep 4.5:1 on every shipped theme. |
| 23 | Minor | Pager status not in live region | CLOSED -- `aria-live="polite"` on the page-number span. |
| 24 | Minor | SharePopover Copy button uses aria-live on the button | CLOSED -- separate `<span class="copy-status" role="status" aria-live="polite">` mirrors the result. |
| 25 | Minor | SharePopover dialog title not associated via aria-labelledby | CLOSED -- Dialog passed `ariaLabelledby="sharepopover-title"`. |
| 26 | Minor | Table wrapper not focusable when scrollable | CLOSED -- `Table.svelte` and `DataTable.svelte` set `tabindex="0"` on the scroll container. |
| 27 | Minor | ConfirmDialog typed-gate input uses :focus | CLOSED -- now `:focus-visible`. |
| 28 | Minor | ConfirmDialog typed-gate has no aria-describedby | CLOSED -- `typedHintId` linked via `aria-describedby` on input + Confirm button. |
| 29 | Minor | RadioGroup duplicate accessible name | CLOSED -- single source of truth comment in component documents the legend-vs-aria-label fallback. |
| 30 | Minor | Divider could use semantic `<hr>` | CLOSED -- horizontal renders native `<hr>`; vertical keeps `<div role="separator">`. |
| 31 | Minor | FilterChips wrapper missing landmark | CLOSED -- now `<nav aria-label="Active filters">`. |
| 32 | Minor | PfdInputs sliders / reset rely on UA focus default | CLOSED -- explicit `:focus-visible { outline: 2px solid var(--focus-ring) }` on `input[type='range']` and `.reset`. |
| 33 | Minor | BrowseViewControls selects rely on UA focus default | CLOSED -- explicit `:focus-visible` on `.view-control select`. |
| 34 | Minor | CitationChips remove button missing focus-visible | CLOSED -- `.citation-remove:focus-visible` outline. |
| 35 | Minor | HelpSearch trigger lacks aria-expanded | CLOSED -- `aria-haspopup="dialog"`, `aria-expanded={open}`, `aria-controls`. |
| 36 | Nit | StatTile tone color-only | DROPPED -- documented expectation in JSDoc; callers supplement via the sub-line text. Boundary case per WCAG 1.4.1. |
| 37 | Nit | PanelShell error contrast pair | CLOSED -- contrast harness covers `--action-hazard` x `--action-hazard-wash` pair via the theme contract tests. |
| 38 | Nit | KbdHint min-height/min-width | DROPPED -- not interactive, no target-size requirement. |
| 39 | Nit | Spinner has no `role="progressbar"` | DROPPED -- `role="status"` is sufficient for indeterminate progress; documented. |
| 40 | Nit | HandbookCard / LibraryCard progress bar lacks role="progressbar" | CLOSED in this audit -- both now ship `role="progressbar"`, `aria-valuenow`, `aria-valuemin`, `aria-valuemax`, `aria-valuetext` ("N of M sections read"). |

40 of 40 closed (37 fixed, 3 dropped as boundary/intentional). All critical and major findings resolved.
