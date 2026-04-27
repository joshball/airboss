---
title: "Code Review: Knowledge Checks"
product: sim
feature: knowledge-checks
type: review
date: 2026-03-28
status: done
review_status: done
---

# Code Review: Knowledge Checks

## UX Review

### [MEDIUM] Answer option letter badge has no visual styling

**File:** apps/sim/src/routes/(app)/course/[moduleId]/check/+page.svelte:72
**Issue:** `.option-letter` class has no CSS rules. Letter prefix ("A", "B", "C", "D") renders as plain text with no badge treatment.
**Recommendation:** Style as a small badge with `font-weight: bold`, `color: var(--t-text-muted)`, `min-width: 1.5rem`.

### [MEDIUM] No visual feedback on answer selection before submit

**File:** apps/sim/src/routes/(app)/course/[moduleId]/check/+page.svelte:63-75
**Issue:** Native radio buttons only. No selection highlighting on `.option-label`. For a quiz, clear selection feedback matters.
**Recommendation:** Add `:has(input:checked)` selector with `--t-primary` border/background change.

### [LOW] "Continue" button wraps `<Button>` inside `<a>` tag

**File:** apps/sim/src/routes/(app)/course/[moduleId]/check/+page.svelte:39-41
**Issue:** `<a href><Button>Continue</Button></a>` -- invalid HTML nesting (interactive inside interactive).
**Recommendation:** Use `<Button href={ROUTES.SIM_COURSE}>Continue</Button>`.

## Engineering Review

### [CRITICAL] Knowledge check does not record lesson attempt

**File:** apps/sim/src/routes/(app)/course/[moduleId]/check/+page.server.ts
**Issue:** Spec requires "Record attempt in `lesson_attempt_content`". Implementation skips this. No write to `lesson_attempt` or `lesson_attempt_content`. "What questions did this user answer?" is unanswerable. Progress page hardcodes `assessments: false`. FAA evidence for knowledge check completion is not recorded.
**Recommendation:** Call `write.createLessonAttempt()` and `write.recordAttemptContent()` on each answer submission.

### [HIGH] No question deduplication -- same question can repeat

**File:** apps/sim/src/routes/(app)/course/[moduleId]/check/+page.server.ts:24
**Issue:** `Math.floor(Math.random() * moduleQuestions.length)` picks randomly with no deduplication. Same question can appear twice in one attempt. Spec says "Same question is not shown twice in the same attempt."
**Recommendation:** Track shown question IDs in lesson attempt record and exclude from pool.

### [HIGH] FAA time credit of 60 seconds per correct answer is arbitrary

**File:** apps/sim/src/routes/(app)/course/[moduleId]/check/+page.server.ts:78
**Issue:** `durationSeconds: 60` hardcoded. Every correct answer credits exactly 60s regardless of actual time spent. Defensible as policy but must be documented and moved to constants.
**Recommendation:** Move to `libs/constants/src/faa.ts` with documenting comment, or track actual time.

### [MEDIUM] Question selection loads entire bank then filters

**File:** apps/sim/src/routes/(app)/course/[moduleId]/check/+page.server.ts:17-18
**Issue:** `getPublishedQuestions(enrollment.releaseId)` loads ALL questions, then filters by `moduleId`. Done twice per question (load + answer action).
**Recommendation:** Add `getPublishedQuestionsByModule(releaseId, moduleId)` to course BC read layer.

## Fix Log (2026-03-28)

- [MEDIUM] Answer option letter badge has no visual styling -- verified fixed (pre-existing)
- [MEDIUM] No visual feedback on answer selection before submit -- verified fixed (pre-existing)
- [LOW] "Continue" button wraps `<Button>` inside `<a>` tag -- verified fixed (pre-existing)
- [CRITICAL] Knowledge check does not record lesson attempt -- verified fixed (pre-existing)
- [HIGH] No question deduplication -- same question can repeat -- verified fixed (pre-existing)
- [HIGH] FAA time credit of 60 seconds per correct answer is arbitrary -- verified fixed (pre-existing)
- [MEDIUM] Question selection loads entire bank then filters -- fixed in 9295500 (targeted query functions added to course BC)
