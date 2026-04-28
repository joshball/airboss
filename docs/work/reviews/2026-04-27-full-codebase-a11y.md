---
feature: full-codebase
category: a11y
date: 2026-04-27
branch: main
issues_found: 22
critical: 1
major: 9
minor: 8
nit: 4
---

## Summary

The shared UI primitives in `libs/ui/` are largely solid: Dialog, Drawer, Tabs, RadioGroup, ConfirmAction, JumpToCardPopover, and the focus-trap helper all implement `aria-modal`, role, focus-restore, ESC, and Tab cycling correctly. Forms route through TextField/Select with associated labels, `aria-invalid`, `aria-describedby`, and `role="alert"` errors, and the theme system has a WCAG contrast matrix test in `libs/themes/__tests__/contrast-matrix.test.ts`. The major gaps live one tier up: route-level pages (especially `/memory/new`, `/reps/new`, `/sessions/[id]`, `/memory/[id]`, the dashboard MapPanel, and the handbook list components) duplicate the form/control plumbing manually and quietly drop `outline: none` on `:focus-visible` without an equivalent replacement, render the dashboard mastery grid as colour-only links, and use ARIA roles in places where simpler semantics would do better. The `ConfirmAction` `:focus-visible` rule is also broken by a `var(2px)` typo, silently disabling focus rings on every destructive trigger in the app.

## Issues

### CRITICAL: ConfirmAction focus-visible ring is broken by `var(2px)` typo

- **File**: libs/ui/src/components/ConfirmAction.svelte:217-219
- **WCAG**: 2.4.7 Focus Visible
- **Problem**: The selector reads `outline: var(2px) solid var(--focus-ring); outline-offset: var(2px);`. `var(2px)` is invalid CSS (var() requires a `--name`); both declarations are dropped by the parser, so the trigger and confirm buttons have **no visible focus ring** when keyboard-focused. Every destructive action in the app (archive, delete deck, snooze permanently) routes through this primitive, so this regresses focus-visibility for the whole app.
- **Fix**: Replace with `outline: 2px solid var(--focus-ring); outline-offset: 2px;` (drop the `var()` calls).

### MAJOR: MapPanel cells are colour-only links with no accessible name

- **File**: apps/study/src/routes/(app)/dashboard/_panels/MapPanel.svelte:90-96
- **WCAG**: 1.1.1 Non-text Content, 1.4.1 Use of Color, 2.4.4 Link Purpose
- **Problem**: Filled cells render as `<a class="cell filled p3" href={...} title={...} role="cell">` with no text content and no `aria-label`. Screen readers announce them as "link" with no destination clue (`title` is unreliable for SRs and invisible to keyboard users until hover). Sighted users get only the colour ramp -- no number, no percent, no keyboard tooltip -- so colour is the sole channel for the mastery value.
- **Fix**: Drop `role="cell"` (it overrides anchor semantics inside the synthetic table), add `aria-label={cellTitle(domain, cell)}` (or render a visually-hidden span with the same text inside the link), and surface the percent textually for sighted users (a small numeric overlay or a sr-only span with a non-colour visual indicator like dot density).

### MAJOR: Handbook list items strip `:focus-visible` outline without replacement

- **File**: libs/ui/src/handbooks/HandbookChapterListItem.svelte:53-56
- **File**: libs/ui/src/handbooks/HandbookSectionListItem.svelte:54-57
- **File**: libs/ui/src/handbooks/HandbookCard.svelte:59-62
- **File**: libs/ui/src/handbooks/HandbookCitingNodesPanel.svelte:65-68
- **WCAG**: 2.4.7 Focus Visible, 1.4.11 Non-text Contrast
- **Problem**: Each rule does `:focus-visible { outline: none; border-color: var(--action-default-edge); }` (or only changes background). A 1px tinted-border-only indicator does not meet WCAG 1.4.11's 3:1 contrast against the surrounding surface in light mode, and in some token combos it's barely visible even to a sighted user without colour-vision differences.
- **Fix**: Either keep the default outline (drop the override) or replace with `outline: 2px solid var(--focus-ring); outline-offset: 2px;` matching the rest of the system. The handbook tile/list components are visited often during reading, so the regression is high-traffic.

### MAJOR: SharePopover scrim has interactive handlers but no keyboard pathway

- **File**: libs/ui/src/components/SharePopover.svelte:106-108
- **File**: libs/ui/src/components/JumpToCardPopover.svelte:94-96
- **File**: libs/ui/src/components/SnoozeReasonPopover.svelte (analogous pattern)
- **WCAG**: 2.1.1 Keyboard
- **Problem**: The scrim `<div>` carries `onpointerdown` and `onkeydown` but lacks a `role` and is non-focusable. The `keydown` handler only fires when something inside the panel has focus, which is fine while the trap holds, but if the trap query returns no focusables (e.g., during a brief render gap or if the panel content is empty), keyboard users have no way to dismiss because the scrim itself can't be tabbed-to. Dialog.svelte and Drawer.svelte have the same shape but recover via the panel's `tabindex="-1"` and the `(first ?? panelEl)?.focus()` fallback. Confirm the popovers initialize focus to a real button on every open path and consider a global `keydown` listener while open so Escape works even if focus drifts outside the panel.
- **Fix**: Add `tabindex="-1"` to the panel and ensure the open-effect always lands focus inside. For SharePopover, the current `panelEl?.querySelector<HTMLElement>('button')?.focus()` is correct; for JumpToCardPopover the row-button query is also correct -- but lock down the no-rows case (`totalCards === 0` would make the panel empty). Adding a window-level `keydown` for Escape while open is the cleanest belt-and-braces.

### MAJOR: Skip link uses `top: -<value>` which keyboard-focus may not reveal across layouts

- **File**: apps/study/src/routes/(app)/+layout.svelte:332-351
- **File**: apps/hangar/src/routes/(app)/+layout.svelte:195-208
- **WCAG**: 2.4.1 Bypass Blocks
- **Problem**: The skip link is positioned absolutely off-screen (`top: calc(var(--space-2xl) * -1)`) and slides in on `:focus`. That's the correct pattern, but `position: absolute` plus the parent layout's `flex` with `min-height: 100dvh` means in some viewports/layouts the link's parent (the layout root) is the positioning context -- if the parent has `overflow: hidden` or transforms, the focused link gets clipped. The Hangar layout wraps `<a class="skip">` outside the `<ThemeProvider>` block; Study wraps it before `<nav>`. Both rely on the body being the positioning context. Add a check (or move the skip link inside `<header>`/`<nav>` with a logical position context) and verify with a real Tab key press that the focused state is visible above the nav. Consider also that the Hangar skip link uses `z-index: 100` while the Study one uses `z-index: var(--z-modal)`; the Hangar value may sit below sticky chrome.
- **Fix**: Standardise both layouts on `z-index: var(--z-modal)` (or a dedicated `--z-skip-link` token), confirm the parent of `.skip` establishes a positioning context that doesn't clip, and add an e2e test (`tests/e2e/`) that asserts the focused skip link is in the viewport.

### MAJOR: `/memory/new` form fields use `outline: none` on focus without a working replacement on the textareas

- **File**: apps/study/src/routes/(app)/memory/new/+page.svelte:331-337
- **WCAG**: 2.4.7 Focus Visible
- **Problem**: `textarea:focus, input:focus, select:focus { outline: none; border-color: var(--action-default); box-shadow: var(--focus-ring-shadow); }`. If the theme bundle does not emit `--focus-ring-shadow` for the active theme/appearance, the only focus indicator is a 1px coloured border (already on idle inputs at a similar tint). Grep shows the same pattern duplicated across `/sessions/[id]`, `/reps/new`, `/reps/[id]`, `/session/start`, `/knowledge/[slug]/learn`, `/memory/[id]`, `/memory/review/[sessionId]`, `/login`. This duplicates what `TextField.svelte` already provides correctly -- the route-level forms shouldn't be hand-rolling inputs.
- **Fix**: Replace the hand-rolled inputs with `TextField`/`Select` (the primitives already meet the contract). If a route truly needs a custom layout, keep `outline: 2px solid var(--input-default-ring); outline-offset: 2px;` on `:focus-visible`. Audit the token bundle to confirm `--focus-ring-shadow` resolves for every theme×appearance.

### MAJOR: `/memory/new`, `/reps/new`, and `/sessions/[id]` rebuild form scaffolding that already exists in `libs/ui`

- **File**: apps/study/src/routes/(app)/memory/new/+page.svelte:113-204
- **File**: apps/study/src/routes/(app)/reps/new/+page.svelte:131-204
- **File**: apps/study/src/routes/(app)/sessions/[id]/+page.svelte:179-188
- **WCAG**: 3.3.2 Labels or Instructions, 4.1.3 Status Messages
- **Problem**: These pages re-implement label / hint / `aria-describedby` association by hand. The `aria-describedby` only points at the error span (`'front-err'`), but the hint span (`#tags-hint`) is referenced on the input but the hint span is rendered inside `<span class="label">` which lives in the same label element -- meaning the input is associated with the label's text already, but the hint is inside the label so SR users hear it twice (once as part of the label and once as describedby). Errors are surfaced with `role="alert"` but focus is not moved to them, so a SR user who submits and fails sees no announcement until they tab back up.
- **Fix**: Replace these forms with `TextField`/`Select`/`FormField` from `libs/ui/`. They already encode the correct label-input-hint-error association. Add a `$effect` that scrolls to and focuses the first invalid field (or the form-level error banner) when the action returns errors.

### MAJOR: Native `<details>` based nav menus lack `aria-controls` -> panel id and the panel `role="menu"` does not match its non-`menuitem` children

- **File**: apps/study/src/routes/(app)/+layout.svelte:218-274
- **WCAG**: 4.1.2 Name, Role, Value
- **Problem**: The Memory and Help dropdowns use `<details><summary aria-haspopup="menu">…</summary><div role="menu">…<a role="menuitem">…</a></div></details>`. The summary doesn't expose `aria-expanded` (browsers don't reflect `<details open>` to ATs as `aria-expanded`), and the menu container isn't connected to the trigger via `aria-controls`. The menu also lacks arrow-key navigation between menuitems (Tab works, but `role="menu"` semantics imply arrow-key navigation per WAI-ARIA Authoring Practices). Either:
  - Drop the menu/menuitem roles entirely and let the dropdown be a plain disclosure (links inside a focusable region).
  - Or, build a real menu: bind `aria-expanded` to `details.open`, add `aria-controls`, and implement arrow-key navigation across menuitems.
- **Fix**: The simpler fix is option 1 -- remove `role="menu"` and `role="menuitem"`, keep `aria-haspopup="menu"`, and the existing `onfocusout` blur handler. Discoverability is unchanged and you avoid promising menu semantics you don't deliver.

### MAJOR: `/memory/review/[sessionId]` confidence chiclets emulate radios but suppress the native keyboard model

- **File**: apps/study/src/routes/(app)/memory/review/[sessionId]/+page.svelte:530-545, 572-586, 603-615
- **WCAG**: 2.1.1 Keyboard, 4.1.2 Name, Role, Value
- **Problem**: The buttons carry `role="radio"` and `aria-checked` inside a `role="radiogroup"`, but they're rendered as `<button>` elements without arrow-key navigation -- only Tab moves between them, and Tab leaves the group entirely once it reaches the last chiclet. ARIA radio semantics promise arrow-key cycling within the group; users of WAI-ARIA-aware AT will try Arrow keys and get nothing. The parallel `feedback-row` (line 603-615) has the same issue.
- **Fix**: Either use `RadioGroup` from `libs/ui/components/RadioGroup.svelte` (which implements ArrowUp/Down/Left/Right + Home/End correctly) styled as chiclets via `role="presentation"` on the wrapping label, or keep the custom presentation but add a key handler that cycles focus within the group on arrows and applies roving `tabindex` so only the selected (or first) chiclet is in the tab order.

### MAJOR: `aria-haspopup="dialog"` triggers do not all bind `aria-expanded`

- **File**: apps/study/src/routes/(app)/memory/review/[sessionId]/+page.svelte:494-500
- **WCAG**: 4.1.2 Name, Role, Value
- **Problem**: The Share and Snooze trigger buttons declare `aria-haspopup="dialog"` but do not set `aria-expanded={shareOpen}` / `aria-expanded={snoozeOpen}`. SR users hear "Share, button, has popup" but never learn whether the popup is currently open. The Counter button on line 472 does it correctly (`aria-expanded={jumpOpen}`); replicate that here.
- **Fix**: Add `aria-expanded={shareOpen}` and `aria-expanded={snoozeOpen}` to the two buttons; also add `aria-controls="…"` pointing at the dialog panel id.

### MINOR: Sim instrument SVGs put `aria-label` on the wrapper `<div>` instead of the SVG itself

- **File**: apps/sim/src/lib/instruments/Asi.svelte:60-61
- **File**: apps/sim/src/lib/instruments/Altimeter.svelte:23-24 (and Tachometer, AttitudeIndicator, HeadingIndicator, Vsi, TurnCoordinator)
- **WCAG**: 1.1.1 Non-text Content
- **Problem**: The pattern is `<div aria-label="..."><svg role="img">...</svg></div>`. Because the wrapping `<div>` has no `role`, the `aria-label` doesn't make it an accessible region; meanwhile the SVG declares `role="img"` but has no accessible name. Some SRs (NVDA) will read the SVG without a label; others (VoiceOver) will look up the parent. The reliable form is to put `aria-label` on the SVG itself (or use a `<title>` child of the SVG).
- **Fix**: Move `aria-label` onto `<svg role="img" aria-label={...}>`. Keep the wrapping div for layout only.

### MINOR: Dialog primitive does not move focus when the panel has no focusable descendants

- **File**: libs/ui/src/components/Dialog.svelte:64-69
- **File**: libs/ui/src/components/Drawer.svelte:77-82
- **WCAG**: 2.4.3 Focus Order
- **Problem**: The open effect picks the first focusable descendant, falling back to `panelEl` when none exists. `panelEl` has `tabindex="-1"` so this works, but the effect also doesn't honour `aria-labelledby` for the focus target. If a caller passes a long header and no inner buttons (rare, but the pattern is documented), focus lands on the panel but the screen reader may read only the panel role; the header text is read by the labelledby relationship at announcement time. This is fine in current usage but document the requirement that callers provide either `ariaLabel` or `ariaLabelledby` -- there's no runtime check. Add a `dev`-only `console.warn` when neither is set.
- **Fix**: Add `if (import.meta.env.DEV && !ariaLabel && !ariaLabelledby) console.warn('Dialog: provide ariaLabel or ariaLabelledby for SR announcement');` at the top of the script.

### MINOR: TextField required marker is decorative-only, leaving SR users without the "required" cue when the input is the textarea path

- **File**: libs/ui/src/components/TextField.svelte:70-72, 76-88
- **WCAG**: 3.3.2 Labels or Instructions
- **Problem**: When `required={true}`, the visible `*` is `aria-hidden="true"` (correct), and the underlying input/textarea carries the native `required` attribute (correct). SRs will announce "required" because the form control is `required`. However, the `<textarea>` branch lacks `aria-required="true"` -- not strictly necessary since `required` is honored, but inconsistent if a future caller flips `inputRequired` to false while leaving `required` true (the visual marker would diverge from the attribute).
- **Fix**: Add `aria-required={required ? 'true' : undefined}` to both branches for parity, or normalise the visual marker on `aria-required`/native `required` together.

### MINOR: `ConfidenceSlider` skip button uses `aria-describedby` to point at a sibling `<span>` not in the same accessible-name graph

- **File**: libs/ui/src/components/ConfidenceSlider.svelte:39-47
- **WCAG**: 1.3.1 Info and Relationships
- **Problem**: The button uses `aria-describedby="skip-hint"` and the hint span has `id="skip-hint"`. If two ConfidenceSliders ever render on the same page (e.g., a debug primitives page), the id collides and the second describedby resolves to the wrong target. Use a derived/uniquified id pattern.
- **Fix**: Generate the id with `$props.id()`-equivalent or `$derived(\`skip-hint-\${someUniqueKey}\`)`, or scope it via a `crypto.randomUUID()` once-per-mount.

### MINOR: `/handbooks/[doc]/[chapter]/[section]` uses h1 -> h3 (skipping h2) inside the reader column

- **File**: apps/study/src/routes/(app)/handbooks/[doc]/[chapter]/[section]/+page.svelte:149-171
- **WCAG**: 1.3.1 Info and Relationships
- **Problem**: The page renders `<h1>{section.title}</h1>` then `<h3>In this chapter</h3>` for the side TOC, skipping `<h2>`. The injected body markdown may itself start at any heading level (it's `@html bodyHtml`), but the side aside should match the surrounding hierarchy.
- **Fix**: Change the TOC heading to `<h2>`, or wrap the section body and aside in regions that re-base their heading levels.

### MINOR: `/knowledge/[slug]/learn` step buttons rely on colour to indicate completion vs visited vs active

- **File**: apps/study/src/routes/(app)/knowledge/[slug]/learn/+page.svelte:159-184, 351-370
- **WCAG**: 1.4.1 Use of Color
- **Problem**: The phase stepper distinguishes `completed` (success-tinted background) vs `visited` (muted background) vs `active` (primary background) entirely through colour washes. The `aria-label` does append "(completed)" / "(visited)" so SR users get the state, but sighted users with low colour discrimination cannot tell visited from completed. The visible check-mark `&#10003;` only appears for the active path; visited-but-not-completed has no glyph.
- **Fix**: Add a textual / glyph cue for each state (`✓` for completed, `·` for visited but not completed, blank for unvisited), independent of background colour. Keep the colour as a reinforcement.

### MINOR: `/calibration` empty-state article and `/reps` empty-state article use `role="status"` on a static block

- **File**: apps/study/src/routes/(app)/calibration/+page.svelte:234
- **File**: apps/study/src/routes/(app)/reps/+page.svelte:60
- **WCAG**: 4.1.3 Status Messages
- **Problem**: `role="status"` is for live regions that update; on a server-rendered empty state it's harmless but creates an unnecessary live-region announcement on initial load (SRs may re-announce when re-focused). Use a plain `<section>`/`<article>` with a heading instead.
- **Fix**: Drop `role="status"` from the empty-state wrappers; let the heading carry semantics.

### MINOR: Banner dismiss button label is always "Dismiss", so multiple banners on a page sound identical

- **File**: libs/ui/src/components/Banner.svelte:42-50
- **WCAG**: 2.4.6 Headings and Labels
- **Problem**: When two Banners are visible (e.g., a flash success and a form-level danger), both dismiss buttons read "Dismiss". Add a `aria-label` prop or compose the label from the banner's `title` so they're distinguishable.
- **Fix**: `aria-label={dismissLabel ?? (title ? \`Dismiss \${title}\` : 'Dismiss')}` and expose `dismissLabel` as an optional prop.

### NIT: NavIndicator aria-live region for route navigations is fine; verify it doesn't fire on hash-only changes

- **File**: libs/ui/src/components/NavIndicator.svelte:19-20
- **WCAG**: 4.1.3 Status Messages
- **Problem**: Cosmetic check, not blocking. Confirm that the live-region message debounces hash-only navigations (e.g., InfoTip flicker that updates `?step=`) so it doesn't spam SR users.
- **Fix**: Inspect the trigger; debounce or filter pure-hash updates if needed.

### NIT: `<details class="identity"><summary aria-label="Account menu for {identityLabel}">` clobbers the visible name

- **File**: apps/study/src/routes/(app)/+layout.svelte:284
- **WCAG**: 2.5.3 Label in Name
- **Problem**: When the visible label says "Joshua Ball" (or initials), but `aria-label` overrides it to "Account menu for Joshua Ball", voice-control software ("click Joshua Ball") may not match. Prefer a visually-hidden suffix span instead.
- **Fix**: Render `{identityLabel}<span class="visually-hidden"> account menu</span>` in the summary; drop `aria-label`.

### NIT: SharePopover URL preview paragraph uses `aria-label` but is also visually labelled by the displayed URL

- **File**: libs/ui/src/components/SharePopover.svelte:141
- **WCAG**: 2.5.3 Label in Name
- **Problem**: `<p class="url" aria-label="Card link preview">{cardPublicUrl}</p>` -- the visible content is the URL, but the accessible name is "Card link preview". A SR user hears "Card link preview" and never the URL value. Use `aria-describedby` (or just drop the aria-label and add a separate visually-hidden heading).
- **Fix**: Wrap the URL with `<span class="visually-hidden">Card link preview:</span> {cardPublicUrl}` and remove `aria-label`.

### NIT: `prefers-reduced-motion` honoured by Drawer and Spinner; missing on a few decorative transitions in `/memory` deck rows and the `/knowledge/[slug]/learn` progress bar

- **File**: apps/study/src/routes/(app)/memory/+page.svelte:543, 802 (.deck-row, .bar-fill transitions)
- **File**: apps/study/src/routes/(app)/knowledge/[slug]/learn/+page.svelte:307-311 (.progress-fill -- no transition wrapper)
- **WCAG**: 2.3.3 Animation from Interactions
- **Problem**: Decorative width/background transitions don't honour `prefers-reduced-motion`. Most of the system uses the `--motion-*` token which already encodes reduced-motion, but a few hand-rolled transitions don't go through the token.
- **Fix**: Either route every transition through `var(--motion-fast)` / `var(--motion-normal)` (the tokens already handle reduced-motion) or wrap rules in `@media (prefers-reduced-motion: reduce) { ...transition: none; }`.
