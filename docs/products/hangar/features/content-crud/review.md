---
title: "Code Review: Content CRUD"
product: hangar
feature: content-crud
type: review
date: 2026-03-28
status: done
review_status: done
---

# Code Review: Content CRUD

## UX Review

### [HIGH] Edit scenario uses raw native inputs instead of UI lib components

**File:** apps/hangar/src/routes/(app)/scenarios/[id]/edit/+page.svelte:47-74
**Issue:** Edit form uses raw `<input type="number">` and `<input type="checkbox">`. Create form uses `NumberInput`, `CheckboxGroup`, `RangeSlider`. Visual inconsistency.
**Recommendation:** Replace raw inputs with UI lib components to match create form.

### [HIGH] Scenarios list "Edit" link is unstyled anchor, other lists use Button

**File:** apps/hangar/src/routes/(app)/scenarios/+page.svelte:43
**Issue:** Scenarios and questions use bare `<a>` for edit. Micro-lessons and student-models use `<Button variant="secondary" size="sm">`. Inconsistent.
**Recommendation:** Standardize on `<Button href={...} variant="secondary" size="sm">Edit</Button>`.

### [MEDIUM] "Back to list" uses three different patterns

**Issue:** Plain `<a>`, `<Button variant="ghost">`, and `<a><Button variant="secondary">Cancel</Button></a>` across different CRUD pages.
**Recommendation:** Standardize on `<Button variant="ghost">` for back links, `<Button href={...} variant="secondary">` for cancel.

### [MEDIUM] Cancel button wrapped in anchor is invalid HTML

**File:** apps/hangar/src/routes/(app)/scenarios/new/+page.svelte:105-107, and 3 other files
**Issue:** `<a href><Button variant="secondary">Cancel</Button></a>` -- interactive inside interactive.
**Recommendation:** Use `<Button href={...} variant="secondary">Cancel</Button>`.

### [MEDIUM] Questions form hardcodes exactly 4 options

**File:** apps/hangar/src/routes/(app)/questions/new/+page.svelte:43
**Issue:** `{#each [0, 1, 2, 3] as i}` with no add/remove. Hint says "Minimum 4" implying more possible.
**Recommendation:** Add dynamic option management with "Add option" button.

### [MEDIUM] Dashboard shows hardcoded zeros

**File:** apps/hangar/src/routes/(app)/+page.svelte:5-11
**Issue:** All StatCards show `count: 0`. No actual data loaded.
**Recommendation:** Load real counts from database.

### [MEDIUM] Scenario edit form missing Panel wrapper class

**File:** apps/hangar/src/routes/(app)/scenarios/[id]/edit/+page.svelte:28
**Issue:** Form lacks `class="form"` for consistent spacing, unlike the create page.
**Recommendation:** Add `class="form"` to match create page structure.

### [LOW] Question text truncation uses JS slicing

**File:** apps/hangar/src/routes/(app)/questions/+page.svelte:38
**Issue:** `question.text.slice(0, 80)` -- JS truncation instead of CSS. Can cut mid-word.
**Recommendation:** Use CSS `text-overflow: ellipsis` with max-width.

### [LOW] Competencies page has no page-header wrapper

**File:** apps/hangar/src/routes/(app)/competencies/+page.svelte:19
**Issue:** PageTitle not wrapped in `.page-header` div. Inconsistent with all other pages.
**Recommendation:** Add `.page-header` wrapper for consistency.

### [LOW] Modules page has no create action

**File:** apps/hangar/src/routes/(app)/modules/+page.svelte
**Issue:** Empty state says "Modules are seeded" but doesn't explain there's no create path.
**Recommendation:** Clarify copy or add create flow.

## Engineering Review

### [HIGH] Audit log writes are fire-and-forget

**File:** All CRUD form actions (e.g., apps/hangar/src/routes/(app)/scenarios/+page.server.ts:20)
**Issue:** `logAction()` is not awaited. If audit insert fails, the record is silently lost. FAA compliance requires reliable audit trail.
**Recommendation:** `await logAction(...)`. Wrap in try/catch that logs failures.

### [HIGH] `audit.content_version` table never written to

**File:** libs/audit/src/schema.ts:16-26
**Issue:** `contentVersion` table exists with `diff`, `before`/`after` JSON columns but nothing writes to it. "What changed?" is unanswerable.
**Recommendation:** Add `logContentVersion()` for every publishable content mutation.

### [MEDIUM] Question edit drops `explanation` field

**File:** apps/hangar/src/routes/(app)/questions/[id]/edit/+page.server.ts:27-34
**Issue:** Edit form omits `explanation`. Editing a question silently strips its explanation.
**Recommendation:** Add `explanation` to both server extraction and form UI.

### [MEDIUM] Module edit has no audit log call

**File:** apps/hangar/src/routes/(app)/modules/[id]/edit/+page.server.ts:20-45
**Issue:** Only content edit action without `logAction()`.
**Recommendation:** Add audit log call.

### [MEDIUM] Competencies have no CRUD actions

**File:** apps/hangar/src/routes/(app)/competencies/+page.server.ts
**Issue:** Read-only route. No create/edit/delete. Competencies can only be managed via seed scripts.
**Recommendation:** Add CRUD operations to course BC and UI.

### [MEDIUM] Delete actions return plain objects instead of `fail()`

**File:** apps/hangar/src/routes/(app)/scenarios/+page.server.ts:18
**Issue:** `return { error: 'Missing ID' }` returns 200. Should use `fail(400, ...)`.
**Recommendation:** Change to `fail(400, { error: '...' })`.

### [LOW] Non-null assertion in delete confirm

**File:** apps/hangar/src/routes/(app)/scenarios/+page.svelte:51
**Issue:** `.closest('form')!` violates no-non-null-assertions rule.
**Recommendation:** Add null guard.

### [LOW] Scenario edit uses native inputs instead of NumberInput

**File:** apps/hangar/src/routes/(app)/scenarios/[id]/edit/+page.svelte:49-71
**Issue:** Inconsistent with create page which uses `<NumberInput>`.
**Recommendation:** Use `<NumberInput>` consistently.

## Fix Log (2026-03-28)

### UX

- [HIGH] Edit scenario uses raw native inputs instead of UI lib components -- fixed in 55830ce
- [HIGH] Scenarios list "Edit" link is unstyled anchor -- fixed in 42ea829 (scenarios/questions), fixed in 8f30029 (modules)
- [MEDIUM] "Back to list" uses three different patterns -- fixed in 42ea829
- [MEDIUM] Cancel button wrapped in anchor is invalid HTML -- verified fixed (pre-existing)
- [MEDIUM] Questions form hardcodes exactly 4 options -- deferred to feature backlog
- [MEDIUM] Dashboard shows hardcoded zeros -- verified fixed (pre-existing)
- [MEDIUM] Scenario edit form missing Panel wrapper class -- fixed in 55830ce
- [LOW] Question text truncation uses JS slicing -- fixed in 362c596
- [LOW] Competencies page has no page-header wrapper -- fixed in dfe493e
- [LOW] Modules page has no create action -- deferred to feature backlog

### Engineering

- [HIGH] Audit log writes are fire-and-forget -- verified fixed (pre-existing)
- [HIGH] `audit.content_version` table never written to -- verified fixed (pre-existing)
- [MEDIUM] Question edit drops `explanation` field -- verified fixed (pre-existing)
- [MEDIUM] Module edit has no audit log call -- verified fixed (pre-existing)
- [MEDIUM] Competencies have no CRUD actions -- deferred to feature backlog
- [MEDIUM] Delete actions return plain objects instead of `fail()` -- verified fixed (pre-existing)
- [LOW] Non-null assertion in delete confirm -- verified fixed (pre-existing)
- [LOW] Scenario edit uses native inputs instead of NumberInput -- fixed in 55830ce
