---
title: "Spec: Knowledge Checks"
product: sim
feature: knowledge-checks
type: spec
status: done
---

# Spec: Knowledge Checks

Multiple-choice question rendering with scoring, per-question feedback, FAA topic tagging, and time credit. The knowledge assessment layer of the course.

## What It Does

At designated points in the course (end of module or post-scenario), a learner answers a question drawn from the published question bank. The system shows:

- The question text
- 3-4 answer options (never true/false)
- On submission: correct/incorrect, explanation, FAA topic + competency tags

Answers are recorded against the lesson attempt. FAA topic time is credited on correct answers.

## Data Model

**Reads from:**

- `published.question` (server-side ONLY -- `correctAnswer` is never sent to client)

**Writes to:**

- `enrollment.lesson_attempt_content` (records question answer attempt)
- `enrollment.time_log` (credits topic time on correct answer)

**No new tables needed.**

**New BC function in `enrollment/write.ts`:**

- `recordQuestionAttempt(data)` -- wrapper around `recordAttemptContent` with question-specific fields
  - Records: `attemptId`, `itemType = 'question'`, `itemId = questionId`, `contentVersion`, `releaseId`
  - Also records whether correct (needs a separate field or separate table -- see design decision below)

## Question Format

From `published.question`:

- `text` -- the question text
- `options` -- array of 3-4 strings (answer choices)
- `correctAnswer` -- server-side only, NEVER sent to client
- `topic` -- FAA topic code (e.g., "LOC")
- `type` -- question type (currently: "multiple-choice")

No true/false questions. Enforced by hangar at content creation time.

## Behavior

### Question display

- Question text at top
- Answer options as radio buttons (labeled A, B, C, D)
- Submit button ("Lock in answer")
- No "I don't know" option -- force commitment

### Submission and feedback

On submit (form action):

1. Server looks up `correctAnswer` for the question (never trusts client-supplied answer)
2. Compare submitted answer to `correctAnswer`
3. Record attempt in `lesson_attempt_content`
4. If correct: log time to `time_log` (`faaQualified = true`, topic = question.topic, duration = 60 seconds)
5. Return result: `{ correct, explanation, topic, competency }` to re-render page with feedback

### Feedback display

After submission:

- Large indicator: CORRECT (green) or INCORRECT (red)
- The correct answer highlighted
- Explanation paragraph (from question metadata -- add to schema if needed)
- FAA topic tag + competency tag
- "Continue" button -> next question or course

### Randomization

Questions within a module pool are served in random order per attempt. Server generates the order and stores the sequence in the lesson attempt (or session). Same question is not shown twice in the same attempt.

### Scoring

No overall "score" shown to the learner immediately. The system tracks per-topic accuracy internally (for the progress dashboard's "assessments passed" check -- Phase 2 deferred).

## Missing Schema Field

`published.question` does not have an `explanation` field. The design requires it.

**Required schema addition to `published.question`:**

- Add `explanation: text('explanation')` (nullable -- not all questions need one for Phase 2)

This requires:

1. Adding `explanation` to `course.question` schema
2. Adding `explanation` to `published.question` schema
3. Updating the publish action to copy the field
4. Updating hangar question form to allow entering an explanation

This is a cross-app schema change. Coordinate with hangar. Flag as a task item.

## Route

Questions appear at `/course/:moduleId/check` or as part of a lesson flow. For Phase 2, a simple entry point:

- `/course/:moduleId/check` -- renders a question from the module's pool
- POST `?/answer` -- submits answer, returns feedback

## Edge Cases

- No questions in pool for this module -> show "No assessment available yet" (not an error)
- Module has no `releaseId` match -> 404
- User submits an answer not in the options array -> validation error (security: reject unknown options)
- `correctAnswer` leaked to client -> critical security bug, must verify in test plan
- Question already answered in this attempt -> show previous result (no retakes mid-session)

## Security

The most critical invariant: **`correctAnswer` must never reach the client.**

In `+page.server.ts`, only send `id`, `text`, `options`, `topic` to the page component. Strip `correctAnswer` before returning.

Verification: in test plan, inspect network requests to confirm `correctAnswer` is absent from page data.
