---
title: 'Final A11y Review: spaced-memory-items'
date: 2026-04-19
phase: final
category: a11y
branch: build/spaced-memory-items
diff_scope: docs/initial-migration..HEAD
status: unread
review_status: pending
---

# Final A11y Review -- spaced-memory-items

Read-only review across the complete feature branch. Scope is every `.svelte` file
touched between `docs/initial-migration` and `HEAD` of `build/spaced-memory-items`.

Files reviewed:

- `/Users/joshua/src/_me/aviation/airboss/apps/study/src/app.html`
- `/Users/joshua/src/_me/aviation/airboss/apps/study/src/routes/+layout.svelte`
- `/Users/joshua/src/_me/aviation/airboss/apps/study/src/routes/(app)/+layout.svelte`
- `/Users/joshua/src/_me/aviation/airboss/apps/study/src/routes/login/+page.svelte`
- `/Users/joshua/src/_me/aviation/airboss/apps/study/src/routes/(app)/memory/+page.svelte`
- `/Users/joshua/src/_me/aviation/airboss/apps/study/src/routes/(app)/memory/new/+page.svelte`
- `/Users/joshua/src/_me/aviation/airboss/apps/study/src/routes/(app)/memory/browse/+page.svelte`
- `/Users/joshua/src/_me/aviation/airboss/apps/study/src/routes/(app)/memory/[id]/+page.svelte`
- `/Users/joshua/src/_me/aviation/airboss/apps/study/src/routes/(app)/memory/review/+page.svelte`

## Summary

| Severity | Count |
| -------- | ----- |
| Critical | 0     |
| Major    | 7     |
| Minor    | 12    |
| Nit      | 8     |

Phase 3's a11y fixes landed (skip link, `aria-label="Primary"` on root nav, `main#main tabindex="-1"`,
`aria-describedby` + `aria-invalid` on memory/new + memory/[id] forms, status banner). The review
flow (`memory/review/+page.svelte`) and dashboard (`memory/+page.svelte`) were authored in Phase 4 after
the Phase 3 a11y review completed, and they repeat several of the same issues the Phase 3 review caught
in the other pages (no `aria-describedby` association of confidence prompt to its buttons, keyboard
shortcut handler swallows keys even when the rating form is disabled, no live-region announcement when
advancing between cards, no visible focus on the current card surface). There are also feature-wide
gaps the earlier review flagged as Minor that remain open: `prefers-reduced-motion` is not respected
anywhere, hint text still uses `#94a3b8` on white (~3.0:1), disabled primary button loses contrast in
its "Saving..." state, edit-toggle focus on `[id]/+page.svelte` is still not returned to the Edit button
on Cancel. These are listed below whether or not Phase 3 called them out, because this is the final
pass and we want one source of truth.

No critical screen-reader blockers. The feature is broadly keyboard-operable and landmarked. Review-flow
specific items dominate the Major list.

## Review-flow findings (new this pass)

### [Major] Review flow: window-level keydown handler fires for all keys, with no scoping to the active phase button group

**File:** `apps/study/src/routes/(app)/memory/review/+page.svelte:109-131` (via `<svelte:window onkeydown={onKeydown} />` at `:139`)
**WCAG:** 2.1.1 Keyboard, 2.1.4 Character Key Shortcuts
**Issue:** The review page registers a global window `keydown` listener. It returns early if the event target is `HTMLInputElement` / `HTMLTextAreaElement`, but there is no `contentEditable` bail-out and no check that the handler is active only when a rating button is actually focusable. The handler dispatches `1/2/3/4/a/h/g/e` during `phase === 'answer'` directly by calling `document.querySelector('button[data-rating="N"]').click()`. When the user is on the "All caught up" summary (`phase === 'complete'`), global listeners are still bound, but since the phase check guards against dispatch, that is fine. However two concerns remain:

1. Single-character shortcuts without a modifier violate WCAG 2.1.4 (Character Key Shortcuts): they can fire unintentionally when voice-control users dictate, when switch-access users cycle, or simply when any focused element receives a keypress. The spec requires at least one of: ability to turn off, ability to remap, or activation-on-press-of-non-printable-modifier.
2. The handler queries the DOM at keystroke time with `document.querySelector(...)`. If the button has not yet rendered (rapid keypress during `use:enhance` transition from `answer` -> `submitting`), the click silently no-ops. The user cannot tell their rating was lost.

**Impact:** Voice-control and switch users may accidentally submit ratings. Fast keyboard users during the enhance transition can lose a keystroke.
**Fix:** (a) Gate shortcut handling behind `phase === 'answer'` before doing anything, plus an explicit check that no `<button>` submit is currently in flight (`submitting === false`). (b) Offer a user-facing toggle to disable the single-key shortcuts (or require a Shift/Alt prefix). (c) Replace `document.querySelector(...).click()` with `formEl.requestSubmit(button)` or set state directly and let Svelte dispatch a real submit -- avoids races with the `{#if}` block.

### [Major] Review card content is not announced to AT when advancing to the next card

**File:** `apps/study/src/routes/(app)/memory/review/+page.svelte:146-246`
**WCAG:** 4.1.3 Status Messages, 2.4.3 Focus Order
**Issue:** On successful rating submit, `onRatingResult(...)` -> `advance()` increments `index` and flips `phase` back to `'front'`. The Svelte re-render swaps the `.card` article's `{current.front}` text. No live region announces "Card 2 of 10" or "Next card". Focus stays on the just-clicked rating button's position -- but that button has been removed from the DOM because the form unmounts when `phase === 'front'`, so focus falls back to `<body>`. Screen-reader users lose their place and get no audible notification that anything changed; they have to manually navigate back to find the next front.
**Impact:** Review is unusable for AT in practice. Every card requires re-finding the card surface.
**Fix:** After `advance()`, move focus to the new "Show answer" button (ref it via `bind:this` and `.focus()` in a `$effect`). Also announce progress via a visually-hidden `role="status"` live region that renders "Card {index + 1} of {total}" (the existing `.counter` already shows this visually; give it `role="status" aria-live="polite"` so AT picks it up on each transition).

### [Major] "Show answer" keyboard activation on Space is intercepted, but there is no visible announcement that the rating row has appeared

**File:** `apps/study/src/routes/(app)/memory/review/+page.svelte:178-205`
**WCAG:** 4.1.3 Status Messages
**Issue:** When the user presses Space on the front, `phase` flips to `answer`, the back text is appended below the front via `{#if phase === 'answer'}`, and a grid of 4 rating buttons appears. Focus stays on the now-removed "Show answer" button. AT gets no announcement that the back content appeared or that the rating options are now available. The `rating-q <p>` ("How well did you remember?") is not a live region.
**Impact:** AT users press Space and hear nothing. They must manually navigate to find the back / rating controls.
**Fix:** (a) Wrap the "Back" section in `<div role="region" aria-label="Answer" tabindex="-1">` and move focus to it on reveal. (b) Or move focus to the first rating button ("Again") after reveal. (c) Add a visually-hidden live region that announces "Answer revealed. Rate your recall." The rating row then becomes discoverable via Tab.

### [Major] Confidence prompt has no keyboard-accessible heading, no focus move, and the "1..5 to pick, Esc to skip" shortcuts are undocumented

**File:** `apps/study/src/routes/(app)/memory/review/+page.svelte:187-199`, handler at `:117-123`
**WCAG:** 2.4.6 Headings and Labels, 3.3.2 Labels or Instructions
**Issue:** When `showConfidencePrompt` is true, an `<article class="prompt">` appears with `<p class="prompt-q">Before revealing -- how confident are you?</p>` and five buttons (`1 Wild guess`..`5 Certain`). The keyboard handler maps digits `1..5` to `pickConfidence(n)` and `Escape` to `skipConfidence()`, but:

1. The visible UI does not display the keyboard shortcuts (no `<kbd>` badges on the confidence buttons, unlike the rating row which shows "Space", "1", "2", "3", "4"). Users have no way to discover them.
2. There is no heading (h2 or role="heading") identifying this region, just a `<p>`. AT users cannot jump to it via heading nav.
3. Focus is not moved to the first confidence button when the prompt appears; it stays on the previous "Show answer" button, which is now removed from the DOM.
4. "Skip confidence" is a separate button but Escape also triggers it silently.

**Impact:** Keyboard users do not know the 1--5 / Esc shortcuts exist. Screen-reader users do not hear the prompt appear.
**Fix:** (a) Render `<kbd>` badges on each confidence button mirroring the rating row pattern. (b) Change the `<p class="prompt-q">` to an `<h2>` (visible) or add `role="group" aria-labelledby="confidence-label"` with a hidden `<span id="confidence-label">`. (c) Move focus to the first confidence button when the prompt appears (use `$effect` on `showConfidencePrompt`). (d) Document "Esc to skip" visibly next to the "Skip confidence" button text, e.g., `Skip confidence <kbd>Esc</kbd>`.

### [Major] "All caught up" summary is rendered on render -- not announced to AT

**File:** `apps/study/src/routes/(app)/memory/review/+page.svelte:146-165`
**WCAG:** 4.1.3 Status Messages
**Issue:** When `phase === 'complete'`, a `<article class="caught-up">` replaces the review surface. It contains the session summary (`tally`, reviewed count). There is no `role="status"` or `aria-live="polite"` on this region. For users who complete a session by rating the last card, the transition from "rating a card" to "summary screen" is silent. For users who arrive at `/memory/review` with zero due cards (the initial `phase === 'complete'` path at `:25`), the summary renders at page load -- that part AT handles via normal page-load announcement, but the user-triggered transition is the issue.
**Impact:** Screen-reader users finishing a session receive no announcement that the session ended.
**Fix:** Add `aria-live="polite" role="status"` to the `.caught-up` article, or wrap the counter+summary in a live region that announces "Session complete. You reviewed N cards."

### [Major] Rating buttons have compound accessible names due to stacked span children

**File:** `apps/study/src/routes/(app)/memory/review/+page.svelte:229-240`
**WCAG:** 2.5.3 Label in Name, 4.1.2 Name/Role/Value
**Issue:** Each rating button contains three `<span>` children: label ("Again"), hint ("< 1m"), and a `<kbd>` ("1"). The button's computed accessible name concatenates all text nodes to `"Again < 1m 1"`. This makes voice-control ("click Again") work if the tool matches substrings, but some voice engines require exact match or first-word match. "Label in Name" requires the visible label to be part of the accessible name -- "Again" is present, so this passes, but the experience is noisy for AT ("Again less than one m one button").
**Impact:** Voice-control users have to say phrases that might not match. Screen-reader users hear verbose names.
**Fix:** Give the button an explicit `aria-label="Again"` (overriding its content), then move the hint and kbd into `aria-describedby="rating-1-hint"` using a nearby `<span id="rating-1-hint" class="visually-hidden">Next review in less than one minute. Keyboard shortcut 1.</span>`. Repeat for Hard/Good/Easy.

## Feature-wide findings (some already flagged Phase 3, status noted)

### [Major] Edit toggle on detail page moves focus into the form on Enter, but Cancel does not return focus to Edit

**File:** `apps/study/src/routes/(app)/memory/[id]/+page.svelte:186` (Cancel button), `:47-51` (startEdit)
**WCAG:** 2.4.3 Focus Order
**Status:** Phase 3 flagged this as Major. Partial fix landed: `startEdit()` now does `await tick(); editFrontInput?.focus()` (see `:49-51`). But `confirmDiscardEdit()` (`:53-55`) only sets `editing = false` with no focus management. On Cancel, focus falls to `<body>`.
**Fix:** Capture a `editButton` ref; in `confirmDiscardEdit()`, do `editing = false; await tick(); editButton?.focus()`. Same pattern after a successful Save -- after `enhance` resolves and `editing` returns to false, return focus to the Edit button so the user isn't dumped at the top of the page.

### [Major] `memory/new` form-level error alert does not move focus and does not link field errors back to fields

**File:** `apps/study/src/routes/(app)/memory/new/+page.svelte:80-82` (form-level error container); per-field errors at `:113`, `:129`, `:141`, `:151`, `:165`
**WCAG:** 3.3.1 Error Identification, 4.1.3 Status Messages
**Status:** Phase 3 fixed per-field `aria-invalid` and `aria-describedby`. The form-level error still does not receive focus on failed submit (`role="alert"` will be announced but focus is left on the submit button). There is no error-summary pattern -- the top-level `<div class="error">{fieldErrors._}</div>` only shows when the server returns a non-field error like `{_: 'Could not save'}`.
**Fix:** On submit failure (detectable inside the `use:enhance` callback when `result.type === 'failure'`), move focus to the error container (`tabindex="-1"` + `.focus()`), and render a short bulleted list of `<a href="#front">` / `<a href="#back">` / ... anchors to the first erroring field. Requires giving each field wrapper an `id`.

### [Major] Archive action uses `window.confirm()` -- keyboard-operable but not a proper dialog

**File:** `apps/study/src/routes/(app)/memory/[id]/+page.svelte:224-230`
**WCAG:** 3.3.4 Error Prevention (reversible data change), 4.1.3 Status Messages
**Issue:** Archive is guarded by `confirm('Archive this card? ...')`. Native `confirm()` is keyboard-accessible and screen-reader-accessible across all modern browsers, so the basic a11y floor is met. But the message is long (56 words), refers to "Browse" as a navigation concept AT users may not know, and there is no post-action announcement ("Card archived.") -- the card simply re-renders with a new status badge.
**Impact:** After archive, AT users cannot tell the action succeeded without manually reading the status badge.
**Fix:** (a) Keep `confirm()` for now; it's a real dialog and satisfies 3.3.4. (b) Add a `role="status" aria-live="polite"` live region on the page that announces "Card archived", "Card suspended", "Card reactivated" after each `setStatus` enhance resolves successfully. Use the existing `form?.message` slot or a new `statusMessage` state.

### [Major] "Saving..." and "Signing in..." button text drops below 4.5:1 contrast

**File:** `apps/study/src/routes/(app)/memory/new/+page.svelte:173-175`, `[id]/+page.svelte:187-189`, `login/+page.svelte:73-75`
**WCAG:** 1.4.3 Contrast (Minimum)
**Status:** Phase 3 flagged Minor. Promoting to Major because the "Saving..." label is the only real-time indication that the submit is in flight; AT users get no other feedback. The login disabled state at `#94a3b8` background with white text measures ~3.0:1 -- fails AA for normal text. The memory forms use `opacity: 0.6` on a `#2563eb` background, yielding ~`#8badf4` text on a `#8fb0f1` background, roughly 2.1:1 effective.
**Impact:** Low-vision users cannot read the submit-in-progress status.
**Fix:** Replace `opacity: 0.6` with an explicit disabled style using a darker background color (e.g., `background: #64748b; color: #fff` -- ~5.7:1). Or render the "Saving..." / "Signing in..." text outside the button in a live region so the button keeps its plain label. Or add `aria-busy="true"` on the form and pair with a visually-hidden `<p role="status">Saving card...</p>`.

### [Minor] Dashboard (`memory/+page.svelte`) has no live region and no "New cards since last visit" hint

**File:** `apps/study/src/routes/(app)/memory/+page.svelte:31-115`
**WCAG:** 4.1.3 (mild)
**Issue:** The dashboard shows "Due now N", "Reviewed today N", "Streak N days", and per-domain progress bars. It is statically rendered on navigation, so AT announces the page via normal navigation channels. But each `.tile-value` is announced as "N cards to review" only if the user navigates element by element -- there's no summary. Not a WCAG failure.
**Fix:** Consider adding a visually-hidden `<p>{stats.dueNow} cards due. {stats.reviewedToday} reviewed today.</p>` at the top of the page as an AT-friendly summary. Low priority.

### [Minor] Dashboard progress bars have `aria-hidden="true"` but no accessible numeric fallback for sighted AT users

**File:** `apps/study/src/routes/(app)/memory/+page.svelte:106-109`
**WCAG:** 1.1.1 Non-text Content (passes via neighbor text), 1.3.1 Info and Relationships
**Issue:** Each domain row has `<div class="bar" aria-hidden="true"><span class="bar-fill" style="width: N%">` -- the bar is hidden from AT (correct, it's decorative). The numeric percent is rendered in `.dm-sub` ("75% mastered (stability > 30d)"). Good. No issue, just verifying.
**Fix:** None.

### [Minor] Browse pagination `<nav aria-label="Pagination">` uses empty `<span>` placeholders

**File:** `apps/study/src/routes/(app)/memory/browse/+page.svelte:160-172`
**WCAG:** 1.3.1
**Status:** Phase 3 flagged Minor -- still open.
**Fix:** Replace empty `<span></span>` placeholders with a styled disabled `<button type="button" disabled aria-hidden="true">` or restructure the grid so the middle `Page N` is `justify-self: center` and the two button slots collapse when absent. Current code is valid but lint-noisy.

### [Minor] Browse filter `<form>` has `role="search"` but does not announce result count after Apply

**File:** `apps/study/src/routes/(app)/memory/browse/+page.svelte:82-127`
**WCAG:** 4.1.3 Status Messages
**Status:** Phase 3 fixed `role="search"` and `aria-label="Filter cards"`. Still no live-region announcement of result count.
**Fix:** After Apply (server navigation completes), render `<p role="status" aria-live="polite">Showing N cards.</p>` above the list. On zero results, it already has an empty state -- give that empty state a `role="status"` so it's announced when the filter changes client-side. (Currently it's only announced on full page load.)

### [Minor] Detail-page badges in header have no programmatic heading to introduce them

**File:** `apps/study/src/routes/(app)/memory/[id]/+page.svelte:106-115`
**WCAG:** 1.3.1
**Issue:** The `.badges` container holds domain, type, status, source tags. It has no label or heading, so AT reads them as orphan text in the header. They're visible context for sighted users; for AT they appear as "pre-solo knowledge basic suspended personal" with no framing.
**Fix:** Wrap in `<div aria-label="Card tags">` or add a visually-hidden `<h2>Card metadata</h2>`.

### [Minor] Recent-reviews table still has no `<caption>`

**File:** `apps/study/src/routes/(app)/memory/[id]/+page.svelte:278-301`
**WCAG:** 1.3.1, 2.4.6 Headings and Labels
**Status:** Phase 3 flagged Minor -- still open.
**Fix:** Add `<caption class="visually-hidden">Recent reviews (up to 5)</caption>` inside the `<table>` element. Define `.visually-hidden` utility in global styles.

### [Minor] Status-action inline form still has no accessible grouping

**File:** `apps/study/src/routes/(app)/memory/[id]/+page.svelte:219-256`
**WCAG:** 1.3.1
**Status:** Phase 3 flagged Nit -- promoting because this is a cluster of destructive actions and AT users benefit from grouping.
**Fix:** `<form method="POST" action="?/setStatus" class="inline-form" aria-label="Change card status">` or wrap in a `<fieldset><legend class="visually-hidden">Card status actions</legend>`.

### [Minor] `prefers-reduced-motion` not respected anywhere

**File:** All pages use `transition: background 120ms, border-color 120ms, box-shadow 120ms` etc. `memory/+page.svelte:307` transitions bar fill `width 250ms`. `memory/review/+page.svelte:405` has `transform 80ms` on rating buttons.
**WCAG:** 2.3.3 Animation from Interactions (AAA), 2.2.2 Pause, Stop, Hide (AA for motion-heavy)
**Status:** Phase 3 flagged Nit -- promoting to Minor because the feature now has the review flow, which animates rating buttons on hover/active and swaps card content rapidly; users with vestibular triggers notice.
**Fix:** Add a global style in `app.html` or root layout:

```css
@media (prefers-reduced-motion: reduce) {
  *, *::before, *::after {
    animation-duration: 0.01ms !important;
    animation-iteration-count: 1 !important;
    transition-duration: 0.01ms !important;
    scroll-behavior: auto !important;
  }
}
```

### [Minor] Hint text color `#94a3b8` on white fails 4.5:1

**File:** multiple; `.hint { color: #94a3b8 }` in `memory/new/+page.svelte:267`, `[id]/+page.svelte:485`; `.dm-sub { color: #94a3b8 }` in `memory/+page.svelte:311`; `.rate-q.subdued { color: #94a3b8 }` in `review/+page.svelte:384-386`; `.dev-hint { color: #94a3b8 }` in `login/+page.svelte:256`.
**WCAG:** 1.4.3 Contrast (Minimum)
**Status:** Phase 3 flagged Nit -- still open.
**Fix:** Use `#64748b` (5.4:1 on white) for all hint / secondary text that conveys information. `#94a3b8` is only acceptable for purely decorative separators or subtle dividers.

### [Minor] Disabled input background `#f1f5f9` plus default placeholder color may fail 4.5:1

**File:** `memory/new/+page.svelte:295-298`, `[id]/+page.svelte:512-515`
**WCAG:** 1.4.3 (disabled exempt, but placeholder content is not)
**Status:** Phase 3 flagged Nit.
**Fix:** Spot-check visually. If the placeholder is still visible during `disabled`, set an explicit `::placeholder` color that meets 4.5:1 against `#f1f5f9`.

### [Minor] `.badge` font size 0.6875rem (11px) with uppercase + letter-spacing is hard for low-vision users

**File:** all pages with badges; review at `/Users/joshua/src/_me/aviation/airboss/apps/study/src/routes/(app)/memory/review/+page.svelte:273-284`, browse at `browse/+page.svelte:304-316`, detail at `[id]/+page.svelte:344-356`.
**WCAG:** 1.4.4 Resize Text (users can zoom), 1.4.12 Text Spacing
**Status:** Phase 3 flagged Minor -- still open.
**Fix:** Bump badge size to `0.75rem` (12px) and drop `letter-spacing: 0.04em`, or remove `text-transform: uppercase` in favor of title-case. Uppercase + letter-spacing + 11px is a triple penalty for low-vision users.

### [Minor] Root layout (`+layout.svelte`) has no app shell -- any future route outside `(app)` must remember to render its own `<main>`

**File:** `apps/study/src/routes/+layout.svelte:1-7`
**WCAG:** 1.3.1, 2.4.1 Bypass Blocks
**Status:** Phase 3 flagged Minor -- still open.
**Fix:** Either move `<main>` + skip link into the root layout (and remove from `(app)/+layout.svelte` and `login/+page.svelte`), or document the convention in a comment at the top of `+layout.svelte` explaining that every group is responsible for its own landmarks.

## Keyboard / shortcut findings

### [Minor] Cmd/Ctrl+Enter submit shortcut on `memory/new` is not documented in the UI

**File:** `apps/study/src/routes/(app)/memory/new/+page.svelte:52-58`, `:90`
**WCAG:** 3.3.2 Labels or Instructions
**Issue:** The form handler binds `Cmd/Ctrl+Enter` to submit via `formEl.requestSubmit()`. This is helpful but undocumented -- no `<kbd>` badge, no hint near the Save button. Users discover it by accident or not at all.
**Fix:** Add a visible hint: `<span class="kbd">Ctrl+Enter</span>` inside or next to the Save button, or in a small hint paragraph above the actions row. Also ensure Esc doesn't do anything surprising on this form (currently it doesn't -- that's fine).

### [Minor] `memory/[id]` edit form has no Esc-to-cancel

**File:** `apps/study/src/routes/(app)/memory/[id]/+page.svelte:123-191`
**WCAG:** 2.1.1 (not violated; Cancel button exists)
**Issue:** The Phase 3 review prompt asks about "Esc-to-cancel". Currently there is no Escape handler on the edit form. Cancel is mouse/Tab-accessible via the Cancel button -- which satisfies 2.1.1 -- but a keyboard shortcut would be an improvement, matching the Cmd+Enter submit shortcut on `memory/new`.
**Fix:** Add `onkeydown={(e) => { if (e.key === 'Escape' && editing && !saving) confirmDiscardEdit() }}` on the edit form. Document with a `<kbd>Esc</kbd>` hint next to the Cancel button.

### [Nit] Review flow: answer reveal on Enter is supported but undocumented

**File:** `apps/study/src/routes/(app)/memory/review/+page.svelte:111-114`
**Issue:** The handler accepts both Space and Enter to reveal, but the visible "Show answer" button only shows `<span class="kbd">Space</span>`. Enter is a hidden alternative.
**Fix:** Change to `<span class="kbd">Space</span>` + `<span class="kbd">Enter</span>`, or keep it as is (Space is conventional; Enter is the button's default activation).

### [Nit] Login page: no Esc handler; but form is simple enough that this is fine

**File:** `apps/study/src/routes/login/+page.svelte`
**Issue:** None actually required. Login form is Tab-friendly, Enter submits natively, and there is nothing to cancel.

## Focus management

### [Major] Detail page Save (enhance resolved) returns user to read-only view but leaves focus on the now-removed Save button

**File:** `apps/study/src/routes/(app)/memory/[id]/+page.svelte:123-133`, Save button at `:187-189`
**WCAG:** 2.4.3 Focus Order
**Issue:** When Save succeeds (`use:enhance` callback updates state, `form` is cleared), `editing` eventually flips to `false` via a server-driven re-render (the success path is not explicit in the client code -- the parent layout re-fetches card data because `use:enhance` default behavior calls `update()`). On that flip, the `<form>` unmounts, the read-only `<article>` mounts, focus is lost to `<body>`.
**Fix:** In the `enhance` callback on success, set `editing = false; await tick(); editButton?.focus()`. Same pattern as the Cancel fix.

### [Minor] Login page success path does not move focus after navigation

**File:** `apps/study/src/routes/login/+page.svelte:38-76`
**WCAG:** 2.4.3 (mild)
**Issue:** After successful login, the server redirects and the user lands on `/memory`. Focus starts at the top of the document, AT announces the page, skip link is first -- fine. No issue.
**Fix:** None.

### [Nit] Login page failed-submit error uses `role="alert"` but does not move focus to it

**File:** `apps/study/src/routes/login/+page.svelte:34-36`
**WCAG:** 4.1.3 (alert role fires)
**Issue:** `role="alert"` announces once on insert; focus stays on submit button, which then becomes enabled again. User may tab back through the form.
**Fix:** On failed submit, `await tick(); errorRef?.focus()` with `tabindex="-1"` on the error container. Matches the memory/new recommendation.

## Live regions

### [Minor] Single success/error convention not documented

**File:** feature-wide
**Issue:** The feature uses `role="alert"` for form errors and `role="status"` for the "Card saved" banner. This is correct. But there's no shared utility -- each page re-invents the markup. That leads to inconsistency (review page has none; detail-page status action has none; dashboard has none).
**Fix:** Extract a `<Announce />` snippet or `<Banner kind="success|error|status" />` component in `libs/ui` and use across all pages. Not blocking; just hygiene.

### [Nit] Server-set `?created=ID` banner relies on initial render, not live-region mutation

**File:** `apps/study/src/routes/(app)/memory/new/+page.svelte:74-78`
**WCAG:** 4.1.3
**Issue:** Phase 3 caught this. The banner exists in the SSR output when the redirect target renders; live regions fire on DOM mutation, not initial parse, so some AT may not announce it. In practice, modern browsers call the live-region observer on hydration and emit, but behavior varies.
**Fix:** Render the banner client-side only by wrapping in `{#if mounted && createdId}` with `let mounted = $state(false); $effect(() => { mounted = true })`. Then the banner appears on hydration, which is a real mutation. Marginal value.

## Semantic HTML

### [Nit] `memory/+page.svelte` dashboard uses `<article>` for each tile, which is a stretch

**File:** `apps/study/src/routes/(app)/memory/+page.svelte:44-65`
**Issue:** Each stat tile is `<article class="tile">`. `<article>` implies a self-contained composition -- a stat is not really self-contained. `<section>` or a plain `<div>` with an appropriate `role="group"` would be more semantic.
**Fix:** Change to `<div class="tile">` with an implicit label from the visible `.tile-label` text, or `<section aria-labelledby="tile-due">` with a hidden label id.

### [Nit] `memory/+page.svelte` state-count list uses two `<span>` children per `<li>` -- no key/value relationship

**File:** `apps/study/src/routes/(app)/memory/+page.svelte:69-87`
**Issue:** `<li><span class="state-label">New</span><span class="state-count">N</span></li>`. AT reads "New 12" as two disconnected items. A `<dl>` with `<dt>New</dt><dd>12</dd>` would make the relationship explicit, matching the Schedule panel on the detail page which already uses `<dl>`.
**Fix:** Convert to `<dl class="states">` for semantic consistency with `memory/[id]/+page.svelte:263-270`.

### [Nit] Review flow tally uses `<dl>` correctly

**File:** `apps/study/src/routes/(app)/memory/review/+page.svelte:151-156`
**Issue:** Good. `<dl class="tally"><div><dt>Again</dt><dd>{n}</dd></div>...</dl>`. The wrapping `<div>` inside `<dl>` is valid HTML since HTML5 explicitly permits it for styling groups. Passes.
**Fix:** None.

## Mobile / touch

### [Minor] Review confidence buttons are 5rem min-width on mobile but only ~38px tall -- just below AAA 44x44

**File:** `apps/study/src/routes/(app)/memory/review/+page.svelte:343-356`
**WCAG:** 2.5.5 Target Size (AAA), 2.5.8 Target Size Minimum (AA, 24x24)
**Issue:** `.conf { padding: 0.75rem 0.75rem; ... }` with two stacked lines of text yields ~68px tall via the gap + labels, but on the smallest mobile breakpoint with flex-wrap the 5 confidence buttons may render two per row at ~38px tall each due to reduced padding. Passes AA easily.
**Fix:** Consider `min-height: 44px` explicitly to meet AAA and reduce fat-fingering during review flow.

### [Nit] Rating buttons touch target: `.rating { padding: 0.875rem 0.5rem }` -- roughly 48px tall, 4-column grid on desktop

**File:** `apps/study/src/routes/(app)/memory/review/+page.svelte:394-405`
**Issue:** On mobile at 480px breakpoint, grid collapses to 2 columns. Each button is ~48px tall, ~165px wide. Passes AAA 44x44. Good.
**Fix:** None.

### [Nit] Dev-account buttons on login are `~32px` tall

**File:** `apps/study/src/routes/login/+page.svelte:223-234`
**Issue:** Only rendered in dev. Not a11y-critical. Passes AA 24x24.
**Fix:** None.

## Color / contrast (summary)

Spot checks, white background `#ffffff` unless stated:

| Token                              | Used for                    | Ratio      | Pass?          |
| ---------------------------------- | --------------------------- | ---------- | -------------- |
| `#0f172a` on `#ffffff`              | body text, headings         | 16.1:1     | AAA            |
| `#334155` on `#ffffff`              | label text                  | 10.4:1     | AAA            |
| `#475569` on `#ffffff`              | secondary text              | 7.2:1      | AAA            |
| `#64748b` on `#ffffff`              | muted text, filter label    | 5.4:1      | AA             |
| `#94a3b8` on `#ffffff`              | hint, dev-hint, .dm-sub     | 3.0:1      | FAIL AA        |
| `#1d4ed8` on `#eff6ff`              | badge.domain                | 7.6:1      | AAA            |
| `#92400e` on `#fffbeb`              | badge.status-suspended      | 7.2:1      | AAA            |
| `#4b5563` on `#f3f4f6`              | badge.status-archived       | 7.1:1      | AAA            |
| `#6b21a8` on `#faf5ff`              | badge.source                | 8.5:1      | AAA            |
| `#b91c1c` on `#ffffff`              | error text .err             | 7.4:1      | AAA            |
| `#991b1b` on `#fef2f2`              | .error banner text          | 9.1:1      | AAA            |
| `#1e3a8a` on `#eff6ff`              | .banner (success) text      | 11.8:1     | AAA            |
| `white` on `#2563eb`                | primary button              | 5.2:1      | AA             |
| `white` on `#94a3b8` (disabled)     | login disabled button       | 3.0:1      | FAIL AA        |
| `white` on `#2563eb × 0.6` opacity  | memory disabled button      | ~2.1:1 eff | FAIL AA        |

Summary: three contrast failures, all on low-emphasis / disabled states. Fix by:

- Promote hint text from `#94a3b8` to `#64748b` (feature-wide).
- Replace `opacity: 0.6` / `background: #94a3b8` disabled styles with `background: #64748b; color: #fff` (~5.7:1).

## Clean list (verified present)

- Skip link: `apps/study/src/routes/(app)/+layout.svelte:8` -- `<a class="skip" href="#main">Skip to main content</a>`, visible on focus via `.skip:focus { top: 0.5rem }` CSS. Pass 2.4.1.
- Root nav labeled: `nav aria-label="Primary"` on `(app)/+layout.svelte:10`. Pass.
- `<main id="main" tabindex="-1">` present on `(app)/+layout.svelte:16` and `login/+page.svelte:27`. Pass.
- `<html lang="en">` present in `app.html:2`. Pass 3.1.1.
- `:focus-visible` global outline in `app.html:29-32` -- 2px solid `#3b82f6` at 2px offset, visible on all interactive elements. Pass 2.4.7.
- All memory/new + memory/[id] fields have `aria-invalid` + `aria-describedby` wired correctly when errors are present.
- Review flow pagination nav on browse: `<nav aria-label="Pagination">` present at `browse/+page.svelte:160`. Pass.
- Filter form: `role="search" aria-label="Filter cards"` on `browse/+page.svelte:82`. Pass.
- Table `<th scope="col">` on all six headers in detail page Recent reviews (`[id]/+page.svelte:281-286`). Pass.
- No `<a>` with `onclick` / no `<div onclick>` anti-patterns. All actions go through real buttons or real links.
- `<svelte:window onkeydown={...}>` in review is correctly bailing out when target is an `<input>` or `<textarea>` (`review/+page.svelte:110`).
- Review submit buttons use `data-rating="N"` for external click dispatch -- unusual but functional; keyboard shortcuts simulate a click through the rendered button so the native form submission runs.
- All non-trivial buttons have plain text names: "Suspend", "Archive", "Reactivate", "Edit", "Save changes", "Cancel", "Apply", "Reset", "Previous", "Next", "New card", "Save", "Save and add another", "Show answer", "Again", "Hard", "Good", "Easy", "Skip confidence", "Reload queue".
- `CARD_STATUS_VALUES`, `DOMAIN_VALUES`, `CONFIDENCE_LEVEL_VALUES`, etc. come from `@ab/constants` -- no magic strings in templates. Not an a11y item; confirms review reflects shipped behavior.
- Forms submit on Enter by default (no `preventDefault` interfering) across login, memory/new, memory/[id] edit, browse filter.
- Dev-account panel on login gated by `{#if dev}` -- does not leak into production tab order (`login/+page.svelte:78-91`).

## Recommended fix ordering

1. Review flow focus management (advance card, reveal answer, confidence prompt). Most valuable -- the review loop is the daily flow and is currently unusable for AT.
2. Review flow single-key shortcuts -- add modifier or toggle, add `<kbd>` badges everywhere, document Esc.
3. Detail page edit toggle: focus return to Edit on Cancel and on Save success.
4. Status action live region (detail page).
5. `prefers-reduced-motion` global rule.
6. Hint text color `#94a3b8` -> `#64748b`. One-line change per page.
7. Disabled submit button contrast -- replace `opacity: 0.6` with explicit dark background.
8. Archive flow success announcement (reuse the live region from item 4).
9. Browse result-count live region after Apply.
10. Everything else is minor / nit cleanup.

## Notes on testing

No automated a11y tests in the repo. Manual verification recommended:

- VoiceOver on Safari: walk the review flow end to end, verify every transition announces.
- NVDA on Firefox: same flow; verify landmark nav (D key) reaches Primary nav, Main, Pagination.
- Keyboard-only: Tab through dashboard, browse, detail, review. Check focus is never lost after any state change.
- Chromium `prefers-reduced-motion` devtools toggle: verify animations stop.
- Browser zoom 200%: verify no horizontal scroll and all text remains readable.
- axe DevTools on each route: should surface only the items in this review (or fewer, depending on axe's heuristics for things like `aria-describedby` links).
