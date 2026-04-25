---
title: "Code Review: Theme Editor"
product: hangar
feature: theme-editor
type: review
date: 2026-03-28
status: done
review_status: done
---

# Code Review: Theme Editor

## UX Review

### [MEDIUM] Scale stepper may disconnect on narrow screens

**File:** libs/ui/src/components/ThemeEditor.svelte:153-196
**Issue:** Stepper buttons and number input wrap on small screens (`flex-wrap: wrap` on line 640). The number field may separate from +/- buttons.
**Recommendation:** Use `flex-wrap: nowrap` on narrow breakpoint.

### [LOW] ThemeSelector focus styles missing for keyboard users

**File:** libs/ui/src/components/ThemeSelector.svelte:28,46
**Issue:** Radio inputs are `.sr-only`. No `:focus-within` on `.theme-card` or `.mode-option`.
**Recommendation:** Add `:focus-within` with `box-shadow: var(--t-focus-ring)`.

### [LOW] Duplicate `.sr-only` class in ThemeSelector and ThemeEditor

**File:** libs/ui/src/components/ThemeSelector.svelte:169-178, ThemeEditor.svelte:611-621
**Issue:** Same class defined in both files.
**Recommendation:** Extract to shared utility.

## Engineering Review

No new findings. Theme editor is well-implemented: props-based API, no legacy Svelte patterns, proper `$derived`, accessible ARIA attributes, responsive media queries.

## Fix Log (2026-03-28)

- [MEDIUM] Scale stepper may disconnect on narrow screens -- fixed in 561c619
- [LOW] ThemeSelector focus styles missing for keyboard users -- verified fixed (pre-existing)
- [LOW] Duplicate `.sr-only` class in ThemeSelector and ThemeEditor -- verified fixed (pre-existing)
