---
title: "Code Review: Task Board"
product: hangar
feature: task-board
type: review
date: 2026-03-28
status: done
review_status: done
---

# Code Review: Task Board

## UX Review

### ~~[HIGH] Drag-and-drop uses direct fetch() with no error feedback~~ FIXED

**File:** apps/hangar/src/routes/(app)/tasks/board/+page.svelte:53-54
**Issue:** `await fetch('?/move', ...)` bypasses `use:enhance`. No loading state, no error display, no feedback on failure. Card snaps back silently if move fails.
**Resolution:** Added try/catch with response status check. Displays Alert component on failure.

### [MEDIUM] Board filter selects are unstyled native elements

**File:** apps/hangar/src/routes/(app)/tasks/board/+page.svelte:68-83
**Issue:** `.filter-select` and `.filter-label` have no CSS. Render as browser-default selects.
**Recommendation:** Style with `--t-control-*` tokens or use Select component.

### [MEDIUM] "Clear filters" button unstyled

**File:** apps/hangar/src/routes/(app)/tasks/board/+page.svelte:85
**Issue:** `.filter-clear` has no CSS. Browser-default button.
**Recommendation:** Use `<Button variant="ghost" size="sm">`.

### [MEDIUM] Task cards show delete button at all times

**File:** apps/hangar/src/routes/(app)/tasks/board/+page.svelte:133-143
**Issue:** Edit and Delete visible on every card always. Visual noise on a kanban board.
**Recommendation:** Show actions on hover/focus only.

### [LOW] Drag-over visual indicator missing

**File:** apps/hangar/src/routes/(app)/tasks/board/+page.svelte:97
**Issue:** `class:drag-over` applied but `.drag-over` has no CSS. No visual drop target feedback.
**Recommendation:** Add dashed outline and subtle background on `.drag-over`.

### [LOW] Keyboard users cannot move tasks between columns

**File:** apps/hangar/src/routes/(app)/tasks/board/+page.svelte:28-56
**Issue:** Drag-and-drop is pointer-only. No keyboard alternative.
**Recommendation:** Add keyboard move actions (buttons or shortcuts).

## Engineering Review

### ~~[MEDIUM] Drag-and-drop move bypasses `use:enhance` -- no CSRF protection~~ PARTIALLY FIXED

**File:** apps/hangar/src/routes/(app)/tasks/board/+page.svelte:53
**Issue:** Raw `fetch('?/move', ...)` bypasses SvelteKit form action mechanism. Response not checked for errors.
**Resolution:** Response status check and error display added. Still uses raw fetch (not `use:enhance`) but errors are now handled.

### [MEDIUM] `createTaskSchema` accepts any string for `type` and `productArea`

**File:** libs/types/src/schemas.ts:63-64
**Issue:** `z.string().optional()` instead of `z.enum(TASK_TYPES)`. Previously identified (L-CONST-2), still open.
**Recommendation:** Use `z.enum()` with constants.

### ~~[LOW] Delete ownership check always fails for non-admin users~~ FIXED

**File:** apps/hangar/src/routes/(app)/tasks/board/+page.server.ts:69-73
**Issue:** Checks `task.assigneeId !== user.id` but `assigneeId` is always null (never set on creation). Non-admin users can never delete any task.
**Resolution:** Added `createdBy` column to task schema, set on creation, delete action now checks `task.createdBy !== user.id`.

## Fix Log (2026-03-28)

### UX

- [HIGH] Drag-and-drop uses direct fetch() with no error feedback -- verified fixed (pre-existing)
- [MEDIUM] Board filter selects are unstyled native elements -- fixed in f56a5f2 (FilterSelect component)
- [MEDIUM] "Clear filters" button unstyled -- fixed in f56a5f2
- [MEDIUM] Task cards show delete button at all times -- fixed in f56a5f2 (hover actions via CardActions component)
- [LOW] Drag-over visual indicator missing -- verified fixed (pre-existing)
- [LOW] Keyboard users cannot move tasks between columns -- verified fixed (pre-existing)

### Engineering

- [MEDIUM] Drag-and-drop move bypasses `use:enhance` -- no CSRF protection -- fixed in f56a5f2
- [MEDIUM] `createTaskSchema` accepts any string for `type` and `productArea` -- fixed in 58958f8
- [LOW] Delete ownership check always fails for non-admin users -- verified fixed (pre-existing)
