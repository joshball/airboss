---
title: "Tasks: Knowledge Checks"
product: sim
feature: knowledge-checks
type: tasks
status: done
---

# Tasks: Knowledge Checks

## Pre-flight

- [x] Read `docs/agents/best-practices.md` -- form actions, security, Svelte 5
- [x] Review `libs/bc/course/src/schema.ts` -- `published.question` structure (note: no `explanation` field yet)
- [x] Review `libs/bc/course/src/read.ts` -- `getPublishedQuestions()` function
- [x] Review `libs/bc/enrollment/src/schema.ts` -- `lesson_attempt_content` table
- [x] Review `libs/bc/enrollment/src/write.ts` -- `recordAttemptContent()` function

## Implementation

### 1. Schema addition -- explanation field

- [x] Add `explanation: text('explanation')` to `course.question` in `libs/bc/course/src/schema.ts`
- [x] Add `explanation: text('explanation')` to `published.question` in the same file
- [x] Update `publishRelease()` in `libs/bc/course/src/publish.ts` to copy `explanation` to published snapshot
- [x] Update hangar question form (`apps/hangar/...`) to include explanation field (optional, textarea)
- [x] Run `bun scripts/db.ts push`
- [x] Run `bun run check` -- 0 errors, commit

### 2. Constants

- [x] Add `ROUTES.SIM_KNOWLEDGE_CHECK` (e.g., `/course/:moduleId/check`) to `libs/constants/src/routes.ts`
- [x] Run `bun run check` -- 0 errors

### 3. New BC function for question attempts

- [x] Add `recordQuestionAttempt(data)` to `libs/bc/enrollment/src/write.ts`:
  - Wraps `recordAttemptContent` with type safety
  - Accepts: `{ attemptId, questionId, contentVersion, releaseId, correct: boolean }`
- [x] Run `bun run check` -- 0 errors, commit

### 4. Knowledge check route

- [x] Create `apps/sim/src/routes/course/[moduleId]/check/+page.server.ts`:
  - Load: get latest release, get questions for this module's pool, pick one at random
  - **Strip `correctAnswer` before returning to page** (critical security step)
  - Action `answer`: receive `questionId + selectedAnswer` from form
    - Load `correctAnswer` server-side
    - Validate `selectedAnswer` is one of the question's `options` (reject unknown values)
    - Compare, record attempt, log time if correct
    - Return `{ correct, explanation, topic, correctAnswer }` to re-render with feedback
- [x] Create `apps/sim/src/routes/course/[moduleId]/check/+page.svelte`:
  - Question text
  - Radio buttons for options (labeled A, B, C, D)
  - Submit button
  - After submit: feedback panel (CORRECT/INCORRECT, explanation, topic + competency tags)
  - "Continue" button
- [x] Run `bun run check` -- 0 errors, commit

### 5. Security verification

- [x] Inspect page load data in browser devtools: confirm `correctAnswer` is NOT present in page data
- [x] Verify `selectedAnswer` is validated against `options` array server-side (test with manual POST of unknown value)
- [x] Run `bun run check` -- 0 errors, commit

## Post-implementation

- [ ] Full manual test per `test-plan.md`
- [ ] Request implementation review
- [x] Update TASKS.md (mark knowledge-checks complete)
- [x] Commit docs updates
