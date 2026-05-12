---
title: Command palette Phase 2 -- accessibility review
date: 2026-05-11
branch: ball/palette-phase2-f191fb12
pr: 831
reviewer: agent (close-pass synthesis)
category: a11y
status: pending
review_status: done
issues_found: 4
---

# Accessibility review

Semantic HTML, ARIA, keyboard navigation, focus management, color contrast.

## Findings

### A1. (Major) Tab key is hijacked for column jumping -- breaks the standard escape route from the input

**File:** `libs/help/src/ui/HelpSearchPalette.svelte` (lines 178-219, focus-trap interaction lines 178-180)

The keydown handler intercepts every Tab and Shift+Tab in the dialog to "jump column". This is the design intent (`[` / `]` are the WP-spec'd bindings, with Tab as a fallback). But:

1. Tab is the universal "move focus" key. A screen-reader user reaching the dialog with Tab expects Tab to walk through every focusable element (input -> result buttons -> next result button -> banner button -> footer). Hijacking Tab to a non-standard "jump column" behavior is a non-trivial deviation.
2. The focus trap also handles Tab (cycles focus first <-> last). Today the call order is `trap?.handleKeyDown(event)` first, then "if `defaultPrevented` return" -- but the trap only `preventDefault`s at the focusable list boundaries, so for mid-list Tabs, both handlers see the event. The trap doesn't preventDefault, so `defaultPrevented` is false, then the palette's Tab handler fires `preventDefault` and jumps column. Net: standard Tab moves never reach a result button.

This compounds with U1 (no loading state): a screen-reader user opens the palette, types, hears nothing announce, presses Tab to walk through results -- and lands in the next column instead of the next result.

**Fix:**

1. Drop the Tab override. Keep `[` / `]` as the bucket-jump bindings (they are documented in the footer; spec-locked).
2. Keep Tab as the standard "move focus across focusables" handled by the focus trap alone.
3. The current footer reads `Tab / [ ] jump column` -- update to `[ ] jump column · Tab move focus`.

If the WP authors decided Tab-as-column-jump deliberately, the right move is a screen-reader-aware variant: when the active element is the search input, Tab jumps column; when it's a result button, Tab moves to the next focusable. That's a minor branch on `event.target` in `handleKey`.

### A2. (Major) Backdrop has `role="presentation"` + onkeydown handler -- not reachable, dead code, confuses ATs

**File:** `libs/help/src/ui/HelpSearchPalette.svelte` (lines 320-328)

```svelte
<div
  class="backdrop"
  onclick={backdropClick}
  onkeydown={backdropKeydown}
  role="presentation"
  data-testid="helpsearchpalette-backdrop"
>
```

Three problems:

1. `role="presentation"` strips semantic meaning, then `onkeydown` is attached -- the element is unreachable by keyboard (no `tabindex`), so the handler can never fire. The unit test comment acknowledges this: "Palette has both an input keydown handler and a backdrop 'Escape-from-anywhere' handler" -- but in the browser, the backdrop is not in the tab order and never receives focus, so its keydown is dead.
2. The `svelte-ignore a11y_click_events_have_key_events` and `a11y_no_static_element_interactions` suppressions document the smell rather than fix it.
3. The escape-on-input is the actual close path; the backdrop adds nothing.

**Fix:** drop the onkeydown handler and the `a11y_*` suppressions. Keep the `onclick` for backdrop-click-to-close (standard modal pattern, accepted to violate `a11y_click_events_have_key_events` for dismissal). The dialog body already handles Escape via `handleKey` on the input + focus trap onEscape.

### A3. (Minor) Banner button has no descriptive accessible name beyond title

**File:** `libs/help/src/ui/HelpSearchPalette.svelte` (lines 361-373)

```svelte
<button type="button" class="banner" onclick={activateBanner} data-testid="palette-banner">
  <span class="banner-kind">Open</span>
  <span class="banner-title">{grouped.bannerHit.title}</span>
  ...
```

The button name concatenates `Open` + title + subtitle + `→` arrow (aria-hidden). For a screen reader user this reads as "Open Density Altitude PHAK · FAA-H-8083-25C button" -- adequate but verbose. The `→` is correctly hidden. The "Open" prefix is helpful framing.

Two improvements:

1. Add `aria-keyshortcuts="Enter"` so the screen reader announces the keyboard shortcut.
2. Add `aria-describedby` pointing at the subtitle span (currently it's read as part of the name; using `describedby` separates "this is the action target" from "this is metadata").

Not blocking; the current shape passes axe-core.

### A4. (Nit) Column section labels are uppercase via CSS `text-transform`

**File:** `libs/help/src/ui/HelpSearchPalette.svelte` (line 555-558 + 554)

```css
.column header {
  ...
  text-transform: uppercase;
  letter-spacing: var(--letter-spacing-caps);
  ...
}
```

`text-transform: uppercase` is presentational. Screen readers read each letter individually for ALL-CAPS content (some), or use the underlying text (others); behavior is inconsistent. Project convention from `aviation/ui/LibraryReferenceCard.svelte` uses lowercase in source + uppercase via CSS, which is the same pattern.

The underlying `COLUMN_LABELS` source values are "FAA Resources", "Airboss Content", etc. (proper case). CSS transforms to uppercase. So screen readers read the proper case names -- good.

No fix needed. Note here so the reviewer-after-this-one doesn't flag again.
