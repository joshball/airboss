---
title: 'Phase 3 A11y Review: spaced-memory-items'
date: 2026-04-19
phase: 3
category: a11y
---

# Phase 3 A11y Review

Scope: Phase 3 memory UI routes (`new/+page.svelte`, `browse/+page.svelte`, `[id]/+page.svelte`), the `(app)` group layout, and supporting files (`app.html`, `login/+page.svelte`). Read-only review.

## Summary

| Severity | Count |
| -------- | ----- |
| Critical | 0     |
| Major    | 5     |
| Minor    | 9     |
| Nit      | 6     |

No screen-reader blockers. Core flows (create / browse / edit / status) are operable with keyboard and have semantic form structure, labels, and reasonable ARIA. The main gaps are around the app-level landmark structure (no skip link, nav has no accessible name, main is missing on login), error handling (`role="alert"` used for success and summary that isn't necessarily an alert; field errors not associated via `aria-describedby`), focus management on the detail page (entering/leaving edit mode drops focus to the top), and a handful of WCAG 1.4.3 contrast issues on badge variants, placeholder text, and disabled button text.

## Findings

### [Major] `(app)` layout `<nav>` has no accessible name and no `<h1>` landmark

**File:** `apps/study/src/routes/(app)/+layout.svelte:8-16`
**WCAG:** 1.3.1 Info and Relationships, 2.4.1 Bypass Blocks, 2.4.6 Headings and Labels
**Issue:** Every `(app)` page renders a bare `<nav>` with three links and a `<main>`. The `<nav>` has no `aria-label`, so a screen-reader user hearing multiple nav landmarks (root nav, pagination nav, etc.) cannot distinguish them. There is no skip link bypassing the nav to `<main>`. The layout does not add an app-shell heading, and inside `(app)/memory/*` each page supplies its own `<h1>`, which is correct, but the landmark structure itself is unlabeled.
**Impact:** Screen-reader users relying on landmark navigation (VoiceOver rotor, NVDA D key) have to guess which `nav` is which. Keyboard users cannot skip repeated nav links to reach the main region.
**Fix:** Add `aria-label="Primary"` (or similar) to the root `<nav>`. Add a visually-hidden "Skip to main content" link as the first focusable element that targets `#main`, and give `<main id="main" tabindex="-1">` a matching id.

### [Major] Detail-page edit toggle does not move focus

**File:** `apps/study/src/routes/(app)/memory/[id]/+page.svelte:167` (Edit), `:138` (Cancel)
**WCAG:** 2.4.3 Focus Order, 3.2.2 On Input
**Issue:** Clicking **Edit** sets `editing = true`; the read-only `<article>` is swapped for a `<form>`. Focus stays on the now-unmounted Edit button (browsers typically fall back to `<body>`). Pressing **Cancel** likewise flips back; focus does not return to the Edit button.
**Impact:** Keyboard / screen-reader users lose their place. They must tab from the top of the page to find the newly-revealed Front textarea, and after Cancel they have to find the Edit button again. This is a common AT pain point.
**Fix:** When `editing` flips to `true`, move focus to the first Front textarea (use `$effect` with a bind:ref and `.focus()` on mount). When `editing` flips to `false` via Cancel, move focus back to the Edit button. Suggested pattern: keep refs to both elements, and call `.focus()` inside a `tick()` after the state flip.

### [Major] Success banner uses `role="status"` but the visually similar "form error" uses `role="alert"` inconsistently

**File:** `apps/study/src/routes/(app)/memory/new/+page.svelte:47` (banner), `:53` (form-level error); `[id]/+page.svelte:90`
**WCAG:** 4.1.3 Status Messages
**Issue:** The review prompt asks whether `role="status"` is "correct (assertive)". It is **not** assertive; `role="status"` maps to `aria-live="polite"` and is the correct choice for non-urgent confirmations like "Card saved." Good. However the form-level validation summary uses `role="alert"` (assertive), which fires at page load even when a user simply landed here for the first time after a redirect with `?created=...` (it is guarded by `if (fieldErrors._)` so in practice only fires post-failed-submit, which is fine). The problem is **the banner's success message only announces on initial render if already present**; because the page is a server redirect target (`?created=ID`), the banner exists when the DOM is first parsed, so many screen readers won't announce it as a live-region update (live regions only fire on subsequent mutations). Field-level errors (`<span class="err">`) are plain text with no live-region behavior and no `aria-describedby` association to their inputs, so screen readers won't read them when focus is on the input.
**Impact:** Success confirmation after create is silent for AT. Field-level errors are silent when the user tabs to the offending field.
**Fix:**

- Keep `role="status"` on the banner but render it into the DOM slightly after mount so AT picks it up, or use `sveltekit` flash messages client-side. Minimum fix: add `aria-live="polite"` explicitly alongside `role="status"` and ensure the banner renders client-side after navigation completes, not as initial SSR content.
- Give each input `aria-invalid={!!fieldErrors.front}` and `aria-describedby="err-front"`, and give the `<span class="err">` `id="err-front"`. Repeat for back/domain/cardType/tags on both `new/+page.svelte` and `[id]/+page.svelte`.

### [Major] Form-level error container uses `role="alert"` but is rendered via SSR on failed-submit, which means AT may not announce it

**File:** `apps/study/src/routes/(app)/memory/new/+page.svelte:52-54`, `[id]/+page.svelte:89-91`
**WCAG:** 4.1.3 Status Messages
**Issue:** `use:enhance` is used, so the failed-submit re-render happens client-side -- and in that case `role="alert"` will fire. However because the container only exists conditionally (`{#if fieldErrors._}`), inserting it into the DOM with `role="alert"` is the correct trigger. The issue is that focus does not move to the error summary after a failed submit, so screen-reader users who navigate by focus may hear the alert once and then be stranded at the submit button. Also, the error summary is not linked to the offending fields.
**Impact:** Medium friction for AT users after a failed submit.
**Fix:** On failed submit, move focus to the error summary container (`tabindex="-1"` + `.focus()`), and/or make the summary contain a short list of anchor links to each erroring field.

### [Major] Status-action form submits are silent and have no confirmation

**File:** `apps/study/src/routes/(app)/memory/[id]/+page.svelte:171-181`
**WCAG:** 4.1.3 Status Messages, 3.3.4 Error Prevention (non-critical; status changes are reversible but still a data-modifying action)
**Issue:** The Suspend / Archive / Reactivate buttons post via `use:enhance`. There is no success toast, no live-region announcement, and no confirmation dialog. After submit, the page re-renders with an updated status badge -- but AT users get no spoken confirmation that anything happened; they have to navigate back up to the badge area to check.
**Impact:** Screen-reader users cannot tell whether Archive actually fired. Archive is destructive-ish (the card leaves the active pool); even if the backend logic is reversible, the UX should acknowledge it.
**Fix:** Add a polite live region (reuse the `role="status"` banner pattern) that announces "Card archived" / "Card suspended" / "Card reactivated" after a successful status change. Consider a browser-native `confirm()` or a lightweight AlertDialog pattern before Archive.

### [Minor] Badge status color contrast is borderline

**File:** `apps/study/src/routes/(app)/memory/browse/+page.svelte:280-316`, `[id]/+page.svelte:269-305`
**WCAG:** 1.4.3 Contrast (Minimum) -- 4.5:1 for normal text; badges are 11px which is below the "large text" cutoff
**Issue:** Badge font is 0.6875rem = 11px, which is normal-size for WCAG (large = 18pt/24px or 14pt/19px bold). Contrast spot checks:

- `.badge` default `#475569 on #f8fafc` -- passes (7.78:1)
- `.badge.domain` `#1d4ed8 on #eff6ff` -- passes (7.6:1)
- `.badge.status-suspended` `#92400e on #fffbeb` -- passes (7.2:1)
- `.badge.status-archived` `#4b5563 on #f3f4f6` -- passes (7.1:1)
- `.badge.source` `#6b21a8 on #faf5ff` -- passes (8.5:1)

All pass, but the badges are uppercase 11px with 0.04em letter-spacing -- readable for sighted users with normal vision, hard for low-vision users even though contrast is technically fine. Consider bumping to 0.75rem or removing uppercase.
**Impact:** Low-vision users struggle with small all-caps.
**Fix:** Bump to `0.75rem` or reduce uppercase / letter-spacing.

### [Minor] Disabled submit button text contrast fails

**File:** `apps/study/src/routes/(app)/memory/new/+page.svelte:321-324`, `[id]/+page.svelte:559-562`, `login/+page.svelte:197-200`
**WCAG:** 1.4.3 Contrast (Minimum) -- though disabled controls are exempt per 1.4.3, the "Saving..." state uses disabled styling while communicating important status
**Issue:** `.btn:disabled { opacity: 0.6 }` on a primary `#2563eb` background makes white text roughly `#8badf4` on `#8fb0f1` during "Saving...", which is low-contrast. On login, the disabled state is `#94a3b8` -- "Signing in..." is white on `#94a3b8`, contrast ~3.0:1, fails AA for normal text.
**Impact:** Low-vision users cannot read the "Saving..." / "Signing in..." label, which is the only indication the form is submitting.
**Fix:** Use a darker disabled background (e.g. `#64748b` for ~5.7:1 white text contrast), or render the "Saving..." label outside the button (or alongside a visible spinner), or keep the button readable while using `aria-busy="true"` on the form/button.

### [Minor] Form has no `aria-busy` during submission

**File:** `apps/study/src/routes/(app)/memory/new/+page.svelte:56-65`, `[id]/+page.svelte:94-104`
**WCAG:** 4.1.3 Status Messages
**Issue:** While `loading`/`saving` is true, fields are `disabled` (so AT will announce "unavailable" on focus), but there is no `aria-busy="true"` on the form or a live-region update saying "Saving card...". Screen-reader users cannot tell the submit is in progress; they only discover this if they happen to focus the submit button and hear "Saving... button".
**Fix:** Add `aria-busy={loading}` (or `{saving}`) on the `<form>` element. Optionally add a visually-hidden `<p role="status">Saving...</p>` that renders while loading.

### [Minor] "Tags" hint inside `<label>` is visible text but not semantically distinct

**File:** `apps/study/src/routes/(app)/memory/new/+page.svelte:117-118`, `[id]/+page.svelte:134`
**WCAG:** 1.3.1, 3.3.2 Labels or Instructions
**Issue:** The label reads `Tags (comma-separated, optional)` with the hint nested as a `<span class="hint">`. This is fine for sighted users, but screen readers will concatenate and read "Tags comma separated optional" as the accessible name for the input -- usable but wordy, and the word "optional" is ambiguous (is it part of the name or an instruction?). Better to split hint into `aria-describedby`.
**Fix:** Move the hint out of the `<label>` into a sibling element with an id, and add `aria-describedby="tags-hint"` to the input. Keeps the label name short ("Tags") and makes the hint a proper description.

### [Minor] Search filter `<input type="search">` has no `role="search"` landmark and no submit-on-enter hint

**File:** `apps/study/src/routes/(app)/memory/browse/+page.svelte:63-108`
**WCAG:** 1.3.1 Info and Relationships
**Issue:** The `<form method="GET">` that drives filters is not labeled as a search. The visible Apply button submits, and Enter also submits (native form behavior) -- good. But the form has no accessible name ("Filter cards" would help) and is not wrapped in `role="search"` which is how AT users find filter regions.
**Fix:** Add `aria-label="Filter cards"` and `role="search"` on the filters `<form>`.

### [Minor] Pagination placeholder `<span></span>` is not ideal

**File:** `apps/study/src/routes/(app)/memory/browse/+page.svelte:139-147`
**WCAG:** 1.3.1
**Issue:** When there is no Previous (page 1) or no Next (last page), a bare empty `<span>` is rendered as a grid placeholder. AT will mostly skip empty spans, but it's a code smell and at least one screen-reader/browser combo will announce "blank" on some traversal modes.
**Fix:** Either render the button disabled (`<a aria-disabled="true">` is invalid; instead use `<button type="button" disabled>` styled to look like a link) or omit the grid placeholder and use `justify-content: space-between` on the flex row with `<span>Page N</span>` as the sole middle child.

### [Minor] Detail page `<a class="back">← Browse</a>` uses a raw `←` character without a text alternative

**File:** `apps/study/src/routes/(app)/memory/[id]/+page.svelte:74`
**WCAG:** 1.1.1 Non-text Content (mild -- the arrow is a character, not an image)
**Issue:** The `←` is a left-arrow U+2190. Screen readers usually announce it as "leftwards arrow" before the word "Browse", which is acceptable but verbose.
**Fix:** Wrap the arrow in `<span aria-hidden="true">←</span>` so it's visual-only, leaving the link's accessible name as "Browse".

### [Minor] `<table class="reviews">` has no `<caption>`

**File:** `apps/study/src/routes/(app)/memory/[id]/+page.svelte:203-226`
**WCAG:** 1.3.1 Info and Relationships, 2.4.6 Headings and Labels
**Issue:** The table has column headers with `scope="col"` (good) but no `<caption>`. The surrounding `<h2>Recent reviews</h2>` partially compensates but is not programmatically associated with the table.
**Fix:** Add `<caption class="visually-hidden">Recent reviews (up to 5)</caption>` inside `<table>`. Or use `aria-labelledby` on the `<table>` pointing to the existing `h2`.

### [Minor] Root layout has no language declaration override path; login page does not wrap content in `<main>` via app-level layout

**File:** `apps/study/src/app.html:2` (OK -- `<html lang="en">` set), `apps/study/src/routes/+layout.svelte:7` (just `{@render children()}`), `apps/study/src/routes/login/+page.svelte:27-93`
**WCAG:** 1.3.1, 2.4.1 Bypass Blocks, 3.1.1 Language of Page (passes via `app.html`)
**Issue:** Root layout is empty. Login wraps itself in `<main>` (good), but the `(app)` group layout also wraps in `<main>` -- so both are fine for themselves. `lang="en"` at the document level is set in `app.html`, passes 3.1.1. However the root `+layout.svelte` has no shell, so any route outside `(app)` that forgets to include `<main>` would be non-landmarked.
**Fix:** Low-priority. Consider moving `<main>` to root layout or documenting the convention so new routes don't accidentally skip a landmark.

### [Nit] `.actions` button order: Cancel first, then destructive-ish variants, then primary

**File:** `apps/study/src/routes/(app)/memory/new/+page.svelte:129-137`
**WCAG:** 3.2.4 Consistent Identification (not violated; just convention)
**Issue:** Cancel link -> Save and add another -> Save. On mobile, `flex-direction: column-reverse` puts Save first, Save-and-add second, Cancel last -- good. On desktop Tab order is Cancel, Save and add another, Save -- matches visual order. No issue, just noting that the two submit buttons share the same form and only `intent` differs, which is fine. Nit: consider `autocomplete="off"` on the primary submit or explicit `formaction` handling if you ever add multiple `<form action>`s.

### [Nit] Inline form for status actions has no accessible grouping

**File:** `apps/study/src/routes/(app)/memory/[id]/+page.svelte:171-181`
**WCAG:** 1.3.1
**Issue:** The `<form method="POST" action="?/setStatus">` has no label describing what the group of buttons does. Buttons read "Suspend" / "Archive" / "Reactivate" which are clear individually.
**Fix:** Add `aria-label="Change card status"` on the inline form, or wrap in `<fieldset><legend class="visually-hidden">Status</legend>`.

### [Nit] Placeholder color `#94a3b8` on white may be below 4.5:1

**File:** multiple; e.g. `.hint { color: #94a3b8 }` in `new/+page.svelte:226-229` and `[id]/+page.svelte:408-411`
**WCAG:** 1.4.3
**Issue:** `#94a3b8` on `#ffffff` measures ~3.0:1. As hint text inside a label this fails AA 4.5:1.
**Fix:** Use `#64748b` (5.4:1) or darker for hint and placeholder text.

### [Nit] Disabled-field background `#f1f5f9` -- ensure placeholder remains readable

**File:** `apps/study/src/routes/(app)/memory/new/+page.svelte:256-259`, `[id]/+page.svelte:437-440`
**WCAG:** 1.4.11 Non-text Contrast (disabled fields exempt, but placeholders inside should still be scannable)
**Issue:** Disabled inputs get `background: #f1f5f9`. The placeholder color (browser default, typically `#757575`) should be checked against this background. Likely passes.
**Fix:** None required; spot-check visually.

### [Nit] `prefers-reduced-motion` not respected for 120ms transitions

**File:** all three Phase 3 pages use `transition: border-color 120ms, box-shadow 120ms` and `transition: background 120ms`
**WCAG:** 2.3.3 Animation from Interactions (AAA, not AA)
**Issue:** 120ms color / background transitions are subtle and unlikely to bother anyone, but a global `@media (prefers-reduced-motion: reduce) { * { transition: none !important } }` rule is still best practice.
**Fix:** Add a reduced-motion stylesheet in the root layout or `app.html`.

### [Nit] Badge `.status-active` style missing

**File:** `apps/study/src/routes/(app)/memory/browse/+page.svelte:124-126` and `[id]/+page.svelte:80-82`
**WCAG:** n/a (unused path)
**Issue:** The browse list only shows a status badge when `c.status !== CARD_STATUSES.ACTIVE`. Detail page matches. Fine. Just noting that `.badge.status-active` has no styles -- correct, it's never rendered.
**Fix:** None.

### [Nit] Empty-state heading hierarchy

**File:** `apps/study/src/routes/(app)/memory/browse/+page.svelte:110-114`
**WCAG:** 1.3.1
**Issue:** The empty state is a `<div class="empty">` with a `<p>No cards match...</p>` -- no heading. Fine but a discoverable `<h2>No results</h2>` would help AT users navigating by heading after a filter submit returns nothing.
**Fix:** Add a visually hidden or visible `<h2>` inside `.empty`.

## Clean

- `<html lang="en">` present in `app.html:2`. (3.1.1 pass)
- `:focus-visible` global outline defined in `app.html:29-32` -- all interactive elements get a 2px blue outline with 2px offset. Meets 2.4.7.
- Semantic structure on the three Phase 3 pages is correct: `<section class="page">` holds the content, `<header class="hd">` holds title + actions, `<h1>` appears exactly once per page, `<article>` and `<table>` are used for their correct roles.
- All form inputs on the three Phase 3 pages have labels. The create/edit forms use `<label class="field"><span class="label">Front</span><textarea...></textarea></label>` (implicit wrapping label, valid). The filter form uses `<label for="f-q">` + `<input id="f-q">` (explicit for/id, valid).
- Required fields use HTML `required` attribute on all necessary inputs (front, back, domain, cardType both pages). This implies `aria-required="true"` to AT. Pass.
- Button vs link semantics are correct throughout: `<a>` for navigation (Back, Browse, New card, Cancel on create, View it), `<button type="submit">` for actions that hit the server, `<button type="button">` for pure client-side toggles (Edit, Cancel-edit). No `<a>` with `onclick` anti-patterns. No `<div onclick>`.
- Pagination `<nav aria-label="Pagination">` is present and correctly labels the landmark (browse.svelte:136).
- Recent-reviews table has `<th scope="col">` on all six columns. (browse.svelte n/a; [id].svelte:205-212)
- All buttons have visible, plain-language text -- no icon-only controls. "Suspend", "Archive", "Reactivate", "Edit", "Save changes", "Cancel", "Apply", "Reset", "Previous", "Next", "New card", "Save", "Save and add another".
- Forms submit on Enter (default browser behavior; no `preventDefault` interfering). Verified by inspection.
- No focus traps. Edit toggle is one-way (button-driven), not modal.
- Dev-account panel on login is only rendered under `{#if dev}`, so in production it does not leak into tab order at all (login/+page.svelte:78-91). In dev it is a series of real `<button type="button">` elements, fully keyboard-accessible with plain text names ("John Doe student", etc.). No a11y concern.
- Touch targets: all `.btn` paddings yield ~36-40px height -- slightly under the 44x44 WCAG AAA recommendation (2.5.5) but within AA "Target Size Minimum" 2.5.8 (24x24). Pass AA.
- `CARD_STATUS_VALUES`, `DOMAIN_VALUES`, etc. are used via `libs/constants` per project rules; no magic strings. Not an a11y item but confirms the review reflects shipped behavior.
