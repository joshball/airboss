---
title: "Code Review: Progress Tracking"
product: sim
feature: progress-tracking
type: review
date: 2026-03-28
status: done
review_status: done
---

# Code Review: Progress Tracking

## UX Review

### [MEDIUM] Topic table header has no visual differentiation

**File:** apps/sim/src/routes/(app)/progress/+page.svelte:57-60
**Issue:** `.topic-header` with `display: contents` makes header cells identical to data rows. No font weight, no color change, no visual header row.
**Recommendation:** Add font-weight bold and text-transform uppercase to `.topic-header > span`, or use proper `<table>` / `<thead>` markup.

### [MEDIUM] Completion checklist uses disabled checkboxes -- misleading interaction affordance

**File:** apps/sim/src/routes/(app)/progress/+page.svelte:88-104
**Issue:** `<input type="checkbox" disabled>` for read-only status display. Disabled checkboxes suggest interactivity. User may wonder why they can't check them.
**Recommendation:** Replace with visual indicators (checkmark icon for complete, empty circle for incomplete).

### [LOW] `<dt>` / `<dd>` without `<dl>` wrapper

**File:** apps/sim/src/routes/(app)/progress/+page.svelte:34-36
**Issue:** `<dt>` and `<dd>` used inside `<div>` without a `<dl>` parent. Invalid HTML. Same pattern on lines 77-83.
**Recommendation:** Wrap in `<dl>` or replace with `<span>` elements.

## Engineering Review

### [HIGH] FAA time thresholds hardcoded, not in constants

**File:** apps/sim/src/routes/(app)/progress/+page.server.ts:7-8
**Issue:** `TOPIC_THRESHOLD_SECONDS = 2700` (45 min) and `FAA_TOTAL_REQUIREMENT_SECONDS = 57600` (16 hours) are local constants. These FAA regulatory values should be in `libs/constants/` for use by ops, tests, and compliance checks.
**Recommendation:** Move to `libs/constants/src/faa.ts`.

### [MEDIUM] Status strings used inline instead of constants

**File:** apps/sim/src/routes/(app)/progress/+page.svelte:32,45-46
**Issue:** Raw string comparisons: `data.enrollmentStatus === 'completed'`, `mod.status === 'completed'`, etc. Constants exist but aren't used on the client side.
**Recommendation:** Import and use constants for all status comparisons.

### [MEDIUM] Enrollment scoping relies on single function chain

**File:** apps/sim/src/routes/(app)/progress/+page.server.ts:18-22
**Issue:** After `getOwnEnrollment(user.id)`, the `enrollment.id` is passed to child queries without re-verifying ownership. Currently correct but fragile if `getOwnEnrollment` signature ever changes.
**Recommendation:** Acceptable. Document the scoping dependency.

## Fix Log (2026-03-28)

- [MEDIUM] Topic table header has no visual differentiation -- verified fixed (pre-existing)
- [MEDIUM] Completion checklist uses disabled checkboxes -- verified fixed (pre-existing)
- [LOW] `<dt>`/`<dd>` without `<dl>` wrapper -- fixed in 57dfe47
- [HIGH] FAA time thresholds hardcoded, not in constants -- verified fixed (pre-existing)
- [MEDIUM] Status strings used inline instead of constants -- verified fixed (pre-existing)
- [MEDIUM] Enrollment scoping relies on single function chain -- fixed in f306eee (doc comment added)
