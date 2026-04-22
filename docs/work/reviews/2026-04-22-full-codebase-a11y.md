---
feature: full-codebase
category: a11y
date: 2026-04-22
branch: main
issues_found: 22
critical: 1
major: 8
minor: 9
nit: 4
---

## Summary

The codebase shows a solid accessibility baseline: skip link, landmarks, aria-current on nav, labeled form primitives (TextField/Select), role=status/alert on banners, progressbar semantics on session and mastery bars, and a working `prefers-reduced-motion` override in `libs/themes/tokens.css`. The primitives (`Button`, `ConfidenceSlider`, `TextField`, `Select`, `Banner`, `KbdHint`, `PanelShell`) are exemplary.

The weaknesses are concentrated in pages that predate the token/primitive migration. Several pages (session runner, review, calibration, knowledge/learn, session summary, memory/[id] edit, browse pages, dashboard) still hand-roll buttons, banners, and chips with hard-coded colors that bypass the focus-ring and reduced-motion tokens, hard-code transitions that don't honor reduced-motion, and omit visible focus styles on custom buttons. The calibration sparkline is correctly marked `role="img"` but communicates bucket state primarily through background-color class (`gap-over` / `gap-under` / `gap-good`) that mostly relies on color to differentiate; text labels are present but the "Expected" dashed bar fill also relies on pattern + contrast alone. The ConfirmAction primitive has a keyboard flow gap: first click reveals Confirm/Cancel but does not move focus to the Confirm button, so keyboard users must Tab past other interactive siblings to reach it. One critical issue: the memory/[id] edit "Front" textarea binds `value=` instead of `bind:value`, which is an editing bug but also degrades the a11y contract by sometimes desynchronizing what AT reads vs what's saved -- treated here only as correctness-adjacent.

## Issues

### critical: ConfirmAction does not move focus to the revealed Confirm button

- **File**: libs/ui/src/components/ConfirmAction.svelte:67-91
- **WCAG**: 2.4.3 Focus Order, 3.2.2 On Input
- **Problem**: When a keyboard user activates the trigger button, the trigger is replaced in-place by a Confirm + Cancel pair. The original trigger button unmounts, so focus falls back to `<body>` (or the nearest focusable ancestor). Sighted users see the new buttons; keyboard users have to reorient and Tab to find them. On pages with many ConfirmAction instances (plan detail, card detail), this is a material trap.
- **Fix**: After `confirming = true`, run `tick()` then focus the Confirm button.

  ```svelte
  import { tick } from 'svelte';
  let confirmBtn = $state<HTMLButtonElement | null>(null);
  async function openConfirm() {
    if (disabled) return;
    confirming = true;
    await tick();
    confirmBtn?.focus();
  }
  // ...
  <Button bind:el={confirmBtn} variant={confirmVariant} ...>{confirmLabel}</Button>
  ```

  Also add Escape handling on the confirm row to call `cancel()` and restore focus to the re-rendered trigger; and bind `el` on Button (which currently has no ref escape). If Button can't expose a ref, wrap the Confirm in a plain `<button>` and use tokens for styling.

### major: Session runner page uses hard-coded colors and bypasses focus-ring tokens

- **File**: apps/study/src/routes/(app)/sessions/[id]/+page.svelte:291-560
- **WCAG**: 2.4.7 Focus Visible, 1.4.3 Contrast
- **Problem**: Every button (`.btn`, `.rating`, `.option`, `.link-btn`) defines only `:hover` and `:disabled`, never `:focus-visible`. Under the global `:focus-visible` from `app.html`, buttons do get a 2px outline, but the rating buttons have colored backgrounds (`#fee2e2`, `#fef3c7`, etc.) that the generic blue outline at 2px with 2px offset can't reliably contrast against on every theme. The `.rating.again` foreground is `#991b1b` on `#fee2e2` -- 4.5:1, fine -- but the ratings and skip links don't honor the token-based focus ring, and `.link-btn.danger` (#b91c1c) on white is OK while the underline-only hover state removes the only persistent affordance for keyboard focus.
- **Fix**: Replace the page's inline button styles with the `Button` primitive (which has `:focus-visible { box-shadow: 0 0 0 3px var(--ab-color-focus-ring) }`). For the rating buttons specifically, extend Button with a color-coded variant or keep bespoke styling but add an explicit `:focus-visible` rule using `var(--ab-color-focus-ring)`.

### major: Review page rating buttons lack :focus-visible indicator

- **File**: apps/study/src/routes/(app)/memory/review/+page.svelte:337-384
- **WCAG**: 2.4.7 Focus Visible
- **Problem**: `.rating`, `.btn.primary`, `.btn.secondary`, `.btn.ghost` define only `:hover` and `:active`. Keyboard users rely entirely on the global `:focus-visible { outline: 2px solid var(--ab-color-primary) }` from `app.html`. On rating buttons that set their own background color, the 2px outline is still visible but low-contrast against the colored chip; more importantly there's no elevation/shadow cue, so the focus ring fights the `:hover` state visually.
- **Fix**: Add an explicit `.rating:focus-visible { outline: none; box-shadow: 0 0 0 3px var(--ab-color-focus-ring); }` and migrate the rating grid to use the `Button` primitive with a new `rating` variant (or keep bespoke but reuse the token).

### major: Knowledge learn phase-stepper buttons miss :focus-visible

- **File**: apps/study/src/routes/(app)/knowledge/[slug]/learn/+page.svelte:218-259, 335-376
- **WCAG**: 2.4.7 Focus Visible
- **Problem**: The 7 phase-selector `.step` buttons and the Previous/Next `.btn` pair have no `:focus-visible` state. They inherit the 2px global outline, but on hover they add `background: #f1f5f9` which masks the outline. Keyboard users tabbing across 7 phase steps cannot tell which is focused.
- **Fix**: Add `.step:focus-visible { outline: none; box-shadow: 0 0 0 3px var(--ab-color-focus-ring); }` (or migrate to tokens entirely). Same for `.btn`.

### major: Calibration page conveys bucket state primarily via background color

- **File**: apps/study/src/routes/(app)/calibration/+page.svelte:558-575, 733-743
- **WCAG**: 1.4.1 Use of Color
- **Problem**: The bucket card has four visual classes (`gap-good`, `gap-over`, `gap-under`, `gap-unknown`) that differ almost entirely by background + border tint (`#f0fdf4` vs `#fef2f2` vs `#fefce8` vs `#f8fafc`). The text label ("Well calibrated" / "Overconfident by X%" / "Underconfident by X%" / "Need more data") carries the meaning, which is good -- but the `.bucket-gap` text color also changes by class (green / red / amber / slate), and the CTA link color shifts too. Under high-contrast forced-colors, the tint differentiation collapses; the label is the only signal, which is acceptable, but verify by testing in Windows High Contrast / `forced-colors: active`. The bigger issue is the "Actual" vs "Expected" bars: `.bar-fill.actual` is solid blue, `.bar-fill.expected` is a 45deg diagonal stripe. This is the right approach (pattern instead of color) but the stripe palette is `#94a3b8` on `#cbd5e1` -- under 3:1 luminance contrast, so the stripe pattern is nearly invisible to anyone with reduced color perception.
- **Fix**: Add an icon or word prefix ("✓ Well calibrated", "↑ Over", "↓ Under", "..." for unknown) in addition to color; keep color as a secondary cue. For the Expected bar, raise the stripe contrast (e.g. `#64748b` on `#e2e8f0`) or render an outline instead of a fill. Add an explicit `@media (forced-colors: active)` rule that sets `border: 1px solid CanvasText` on the bar container so the bar remains visible.

### major: Calibration sparkline path has no accessible fallback for a trendless state

- **File**: apps/study/src/routes/(app)/calibration/+page.svelte:364-368
- **WCAG**: 1.1.1 Non-text Content
- **Problem**: The SVG is `role="img"` with `aria-label="Calibration trend sparkline"`, which names the image but doesn't describe the trend. A screen reader user gets "Calibration trend sparkline" with no sense of direction or magnitude -- yet sighted users get a path + a trend-legend with Start, Now, and Δ. The legend below the SVG does carry the information, so the SVG itself should ideally be marked decorative (or carry a computed `aria-label` with the delta).
- **Fix**: Either set `aria-hidden="true"` on the SVG (since the legend below communicates all the same data textually) OR dynamically compute the label: `aria-label={`Calibration trend over ${CALIBRATION_TREND_WINDOW_DAYS} days: ${firstScore.score.toFixed(2)} to ${lastScore.score.toFixed(2)}, ${trendDelta !== null ? signedPct(trendDelta) : 'no change'}`}`.

### major: Session runner rating buttons don't announce state to screen readers

- **File**: apps/study/src/routes/(app)/sessions/[id]/+page.svelte:157-175
- **WCAG**: 4.1.2 Name, Role, Value; 4.1.3 Status Messages
- **Problem**: The rating row is a `<form>` containing four submit buttons named "Again", "Hard", "Good", "Easy". There is no semantic grouping or hint that these are mutually exclusive outcomes, and no aria-live region to announce the submission result. When a submit fails (`form.error`), the error appears in `.error[role=alert]` above the card, but when it succeeds the next item is loaded via server navigation and the user gets no audible confirmation. The `phase` transitions (read -> confidence -> answer) also happen silently for screen readers.
- **Fix**: Wrap the rating row in `<fieldset><legend class="visually-hidden">Rate this card</legend>...</fieldset>` so assistive tech groups the options. Add an `aria-live="polite"` region that announces "Loaded card 3 of 10" when `current.slotIndex` changes. Announce phase transitions with `aria-live="polite"` on a hidden region ("Answer revealed", "Confidence prompt shown").

### major: Session runner hard-coded colors bypass theme and reduced-motion

- **File**: apps/study/src/routes/(app)/sessions/[id]/+page.svelte:317-329
- **WCAG**: 1.4.3 Contrast (context), 2.3.3 Animation from Interactions
- **Problem**: The `.progress-fill` transitions `width: 200ms` with no reduced-motion override. Users who set `prefers-reduced-motion: reduce` still see the progress bar animate. The tokens file handles `--ab-transition-fast/normal`, but this page uses raw `200ms` and is not inside the ThemeProvider-token flow.
- **Fix**: Replace `transition: width 200ms` with `transition: width var(--ab-transition-normal)` so the reduced-motion media query override applies. Same for `.rating` `transition: background 120ms, border-color 120ms, transform 80ms` in the review page.

### major: Review page keyboard handler fires inside form inputs for ratings

- **File**: apps/study/src/routes/(app)/memory/review/+page.svelte:110-132
- **WCAG**: 2.1.2 No Keyboard Trap (adjacent), 3.2.2 On Input
- **Problem**: The `onKeydown` guard only returns early for `HTMLInputElement` and `HTMLTextAreaElement`. If a user focuses a rating button and presses `1`, the handler intercepts and simulates a click on the same button -- this is harmless here, but if the user ever has `contenteditable` (e.g. a future inline-edit affordance) the keyboard would shadow typing. Also, the handler does not scope to "only when a review is active" -- if the phase is `submitting` or `complete`, key `1`..`4` still probe for buttons that don't exist (the `document.querySelector` returns null). Benign but indicates shortcuts are attached without a guard.
- **Fix**: Broaden the "don't shortcut inside editable content" check: `if ((e.target as HTMLElement)?.isContentEditable) return;`. Also early-return when `phase !== 'answer'` for the rating keys. Add a visible keyboard-hints legend (the `<span class="kbd">` markers are good, keep them) plus an aria-describedby on the Show Answer button that names the shortcut.

### major: Dashboard TUI status footer hides itself from screen readers

- **File**: apps/study/src/routes/(app)/dashboard/+page.svelte:56-62
- **WCAG**: 1.3.1 Info and Relationships (acceptable) / 4.1.2 Name, Role (risk)
- **Problem**: `<footer class="status" aria-hidden="true">` hides the status line ("airboss // dashboard // 2026-04-22 14:30") from AT. That's intended (ornament) and fine. However, this pattern is the only footer on the page and a screen reader user has no "end of dashboard" anchor -- every panel is an `<article>` but the page has no `<footer>` landmark accessible to AT.
- **Fix**: Either accept this as ornament (documented), or replace `aria-hidden="true"` with `role="presentation"` and add a visually-hidden "End of dashboard" label, or simply remove the status line (it has no informational value per the comment). Lowest-effort fix: keep as-is (already documented as ornament) and confirm that's the call.

### minor: Skip link only appears when focused; no persistent affordance on touch

- **File**: apps/study/src/routes/(app)/+layout.svelte:69, 104-118
- **WCAG**: 2.4.1 Bypass Blocks
- **Problem**: The skip link is correctly hidden off-screen and revealed on `:focus`. Works for keyboard, invisible to touch users with large navs. The nav has 7 items which is at the edge of "needs skipping"; this is an acceptable tradeoff. Noted for completeness.
- **Fix**: None required. If the nav grows, add a `role="region"` + `aria-label="Navigation"` wrapper and consider `tabindex="0"` on main landmark (already present: `<main id="main" tabindex="-1">`).

### minor: Identity `<details>` uses role="menu" but menuitem semantics are incomplete

- **File**: apps/study/src/routes/(app)/+layout.svelte:82-96
- **WCAG**: 4.1.2 Name, Role, Value
- **Problem**: `<details>` + `<summary aria-haspopup="menu">` + `<div role="menu">` + `<button role="menuitem">` almost implements ARIA menu semantics, but not completely. ARIA menus expect arrow-key navigation between menuitems; there's only one menuitem ("Sign out"), so the arrow-nav gap is moot, but the identity-email `<div role="none">` followed by the signout button means a screen reader announces the email (because it's text content) without hearing it as part of the menu structure. Escape-to-close is handled correctly.
- **Fix**: Drop `role="menu"` / `role="menuitem"` / `role="none"` since there's only one real action. Let the native `<details>` + `<summary>` + `<button>` semantics speak for themselves. If you later add a second action, adopt either a full menubar pattern (with arrow keys) or stick with plain disclosure semantics.

### minor: session/start preset gallery tile-disabled behavior blocks keyboard via tabindex=-1

- **File**: apps/study/src/routes/(app)/session/start/+page.svelte:142-153
- **WCAG**: 2.1.1 Keyboard; 4.1.2 Name, Role, Value
- **Problem**: The custom tile is an `<a>` with `aria-disabled="true"` when another preset is submitting, plus `tabindex="-1"`. Setting `tabindex="-1"` on an `<a>` while another is loading removes it from the tab order entirely. Combined with `aria-disabled`, this is inconsistent -- aria-disabled should mean "reachable but inoperative." The cleaner pattern is to keep the anchor tabbable but make activation a no-op via onclick preventDefault, or swap the anchor for a `<button disabled>` during submission.
- **Fix**: Either drop the `tabindex=-1` (aria-disabled alone is sufficient) and gate the click with `onclick={(e) => { if (submittingPresetId) e.preventDefault(); }}`, or change the tile to a `<button type="button" disabled>` and wrap an `<a>` around it with display:contents. The former is simpler.

### minor: Session runner link-buttons for Skip today/permanently lack destructive confirmation

- **File**: apps/study/src/routes/(app)/sessions/[id]/+page.svelte:261-272
- **WCAG**: 3.3.4 Error Prevention (best-practice)
- **Problem**: "Skip permanently" is a destructive action (marks the card suspended across sessions) that fires on a single click with no confirmation. The `ConfirmAction` primitive exists exactly for this; the session runner predates it.
- **Fix**: Replace the two raw forms with `<ConfirmAction formAction="?/skip" hiddenFields={{ slotIndex: String(current.slotIndex), skipKind: SESSION_SKIP_KINDS.PERMANENT }} label="Skip permanently" confirmVariant="danger" />`. Once ConfirmAction's focus-management issue (above) is fixed, this is a net a11y win.

### minor: Browse chips can be removed via keyboard but use anchor, not button semantics

- **File**: apps/study/src/routes/(app)/memory/browse/+page.svelte:197-204, apps/study/src/routes/(app)/reps/browse/+page.svelte:189-196
- **WCAG**: 4.1.2 Name, Role, Value
- **Problem**: Each chip is an `<a href="...">` with `aria-label="Remove Domain filter"`. The anchor performs navigation (back to a URL without this filter), which is semantically correct -- the chip *is* a link. Good. However, the "✕" character is inside `<span aria-hidden="true">`, which also drops its width from the accessible name calculation: the label is only "Remove Domain filter" with no redundant ✕. This is correct. Flag is that the anchor has no visible focus ring override; relies on global 2px outline, which on a `background: #eff6ff` border-radius: 999px produces a jagged focus ring.
- **Fix**: Add `.chip:focus-visible { outline: none; box-shadow: 0 0 0 3px var(--ab-color-focus-ring); }` to both browse pages.

### minor: memory/[id] Cancel button calls `confirmDiscardEdit` which uses window.confirm

- **File**: apps/study/src/routes/(app)/memory/[id]/+page.svelte:233
- **WCAG**: 3.3.4 Error Prevention (best-practice)
- **Problem**: Cancelling an edit with unsaved changes triggers a native `window.confirm()` dialog. Native confirms are accessible but their content/button labels aren't localizable and their focus behavior is unpredictable across browsers. Replacing with ConfirmAction (once its focus fix lands) would be more consistent; this is a minor ergonomic issue, not an a11y blocker.
- **Fix**: Swap for `<ConfirmAction onConfirm={discardEdit} label="Cancel" confirmLabel="Discard changes" triggerVariant="ghost" />`.

### minor: Login page dev-account buttons lack keyboard hint and use inline styles

- **File**: apps/study/src/routes/login/+page.svelte:88-99
- **WCAG**: 2.4.7 Focus Visible (covered), 3.3.2 Labels or Instructions (minor)
- **Problem**: Each dev account button shows name + role but doesn't indicate what pressing it does ("fills the form fields"). The `:focus-visible` is defined inline on `.dev-btn` -- good. The accessible name is just "Josh Ball Instructor" which implies clicking signs in as them. A brief aria-label clarifying "Pre-fill login form as Josh Ball (instructor)" would help.
- **Fix**: Add `aria-label={`Pre-fill form as ${account.name} (${account.role})`}` to the button.

### minor: Sim app +page.svelte (scenarios list) has no skip link and raw font fallback

- **File**: apps/sim/src/routes/+page.svelte:1-106
- **WCAG**: 2.4.1 Bypass Blocks, 1.4.3 Contrast
- **Problem**: The sim app's scenarios list is a small page without a nav, so a skip link isn't strictly required. Color values use `var(--ab-color-fg-muted, #666)` with a fallback -- `#666` on `#fff` is 5.74:1 which passes AA for normal text but fails for large text over certain backgrounds, and the `#ccc` border fallback is 1.6:1 against white (fails 3:1 UI contrast). Under the token system these values come from tokens.css (`#475569` / `#e2e8f0`); the fallbacks are only used if the token file fails to load. Low risk.
- **Fix**: Drop the fallback hexes -- they're strictly less accessible than the token values and the token file is always loaded from `apps/sim/src/routes/+layout.svelte`. Same pattern in `apps/sim/src/routes/[scenarioId]/+page.svelte`.

### minor: Sim scenario page uses native `<dl>` for controls help but heading is h3 without h2

- **File**: apps/sim/src/routes/[scenarioId]/+page.svelte:265-281, 189-193
- **WCAG**: 1.3.1 Info and Relationships, 2.4.6 Headings and Labels
- **Problem**: The page's heading hierarchy is `h1` ("scenario.title") -> `h2` ("Briefing") -> `h3` ("Controls"). Between the h2 Briefing and the h3 Controls there are several unlabeled `<section>`s (.panel, .readouts, .controls, .status) that carry meaningful data but no heading. A screen reader user navigating by heading skips from Briefing directly to Controls, missing the instrument readouts, control indicators, and status entirely.
- **Fix**: Add h2s: "Instruments", "Readouts", "Flight Controls", "Status". Even if visually hidden (`visually-hidden` utility), they give screen readers anchors. Alternatively, add `aria-label` to each `<section>`.

### minor: Sim scenario keyboard shortcuts hijack Shift and Ctrl

- **File**: apps/sim/src/routes/[scenarioId]/+page.svelte:124-129
- **WCAG**: 2.1.4 Character Key Shortcuts
- **Problem**: Shift and Ctrl are bound as throttle up/down via `window.addEventListener('keydown', ...)`. These are modifier keys that assistive tech uses heavily (NVDA/JAWS + Shift, VoiceOver + Ctrl for pass-through). Binding them unconditionally breaks AT.
- **Fix**: Require a non-modifier key (e.g. `PageUp/PageDown` for throttle, `+/-`, or scope the shortcuts to only when the sim viewport has focus). At minimum, add an a11y escape: "Press T to toggle keyboard control" and only capture modifier keys when active. WCAG 2.1.4 specifically permits character-key shortcuts if a mechanism to turn them off exists.

### nit: Dashboard CtaPanel dueCount label punctuation

- **File**: apps/study/src/routes/(app)/dashboard/_panels/CtaPanel.svelte:50
- **WCAG**: N/A (quality)
- **Problem**: `{ href: ROUTES.MEMORY_REVIEW, label: `Review (${dueCount})` }` -- a screen reader reads "Review left paren 12 right paren" on some voices. Works but inelegant.
- **Fix**: Use `aria-label={`Review ${dueCount} due cards`}` on the Button (Button primitive supports `ariaLabel`).

### nit: Calibration page interpretation-card uses aria-label duplicating heading

- **File**: apps/study/src/routes/(app)/calibration/+page.svelte:262
- **WCAG**: 2.4.6 Headings and Labels
- **Problem**: `<article aria-label="Calibration interpretation">` but the article has no heading; the `aria-label` is fine. There's a `role="status"` equivalent nearby (empty state) that also uses role correctly. Minor inconsistency: other cards use `<h2>` headings and no aria-label; this one uses aria-label and no heading.
- **Fix**: Optional -- either add `<h2 class="visually-hidden">Interpretation</h2>` for consistency or leave as-is.

### nit: Banner primitive's dismiss button has no focus-ring

- **File**: libs/ui/src/components/Banner.svelte:40-49, 80-95
- **WCAG**: 2.4.7 Focus Visible
- **Problem**: `.dismiss` button has only `:hover`, no `:focus-visible`. Relies on the app.html global outline (2px solid primary). On banner backgrounds (e.g. `.v-success` = `#f0fdf4`) the blue outline is OK but the global outline doesn't use the `focus-ring` token.
- **Fix**: Add `.dismiss:focus-visible { outline: none; box-shadow: 0 0 0 3px var(--ab-color-focus-ring); border-radius: var(--ab-radius-sm); }`.

### nit: ConfidenceSlider skip button hint is a span but could be a `<small>` or not styled as a separate line

- **File**: libs/ui/src/components/ConfidenceSlider.svelte:47, 148-153
- **WCAG**: 1.3.1 Info and Relationships (passing)
- **Problem**: `<span id="skip-hint">` is referenced by `aria-describedby` on the skip button -- good. It's visually rendered below as explanatory text. Works. Minor: the hint is always read after every focus of the skip button; may feel chatty on a keyboard replay. Low priority.
- **Fix**: Optional -- leave as-is; the behavior is correct per spec.

## Cross-cutting observations

- **Contrast audit (tokens.css):** spot-check of the critical pairs using the hex values at lines 46-106 (web) and 193-254 (tui):
    - `--ab-color-fg` (#0f172a) on `--ab-color-bg` (#f8fafc): 17.3:1 (AAA normal)
    - `--ab-color-fg-muted` (#475569) on bg: 8.6:1 (AAA)
    - `--ab-color-fg-subtle` (#64748b) on bg: 5.1:1 (AA)
    - `--ab-color-fg-faint` (#94a3b8) on bg: 3.2:1 (AA large only) -- flag for body text usage. Used on `.sub` subtitles, `.fine` helper text -- at 0.8125rem those are below the "large text" threshold (18pt / 14pt bold). **Minor issue:** `.sub` + `.fine` text in `calibration`, `session/start`, `sessions/[id]` uses `#64748b` (OK) but several hardcoded `#94a3b8` instances (session/[id]/+page.svelte:513, knowledge/[slug]/learn:230, calibration:870) fail AA for normal text.
    - `--ab-color-primary` (#2563eb) on primary-fg (#fff): 5.9:1 (AA)
    - `--ab-color-danger` (#dc2626) on white: 4.4:1 (AA large only, fails normal!) -- verify danger foreground text isn't placed on white. Check sites: Banner v-danger uses `color: var(--ab-color-danger-active)` (#991b1b) on `--ab-color-danger-subtle` (#fef2f2) = 7.9:1 OK.

- **prefers-reduced-motion:** The tokens at tokens.css:335-342 zero out `--ab-transition-fast` and `--ab-transition-normal` but **not the hardcoded transitions** on legacy pages (session runner, review, calibration, memory browse, reps browse, knowledge learn). Grep shows at least 18 literal `transition:` declarations with `ms` values that won't honor reduced-motion. Pair this audit with a pass that replaces `transition: ... 120ms` / `200ms` / `80ms` with the corresponding token var.

- **Keyboard shortcuts inventory:** session runner implies Space/Enter/1-5/Esc from the spec but only the review page (memory/review) actually implements them. The session runner at sessions/[id] has no keyboard shortcuts for Reveal or rating. Not an a11y violation but a discoverability gap and inconsistency between the two review surfaces.

- **Heading hierarchy audit:** Main layout sets no h1, each page provides its own. Layout has `<nav>` + `<main>`; no `<header>` landmark at app level. That's fine. Sessions/[id] uses h1 "Session in progress" then h2 "All items resolved" or h3 "rep-title" / "node-title". Missing h2 between h1 and h3 for the card case -- minor.

- **Touch targets:** Not checked exhaustively. The `.link-btn` in session runner (padding 0, font-size 0.8125rem) is below the WCAG 2.5.5 AAA 44x44 target. AA doesn't require this.
