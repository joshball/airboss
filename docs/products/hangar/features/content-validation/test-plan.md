---
title: "Test Plan: Content Validation Engine"
product: hangar
feature: content-validation
type: test-plan
status: done
---

# Test Plan: Content Validation Engine

## Setup

- Hangar app running (`bun dev` from `apps/hangar/`)
- Database seeded with competencies and modules (`bun run db seed`)
- Logged in as admin or author role

---

## CV-1: Empty course fails all checks

1. Ensure no scenarios, questions, or traceability entries exist (fresh DB with only seed data)
2. Navigate to `/compliance/validation`
3. **Expected:** Report shows FAIL. Each check shows its name and description. TOPIC_COVERAGE, TOPIC_TIME, QUESTION_COUNT, QUESTIONS_PER_MODULE, COMPETENCY_COVERAGE, MATRIX_COMPLETENESS all show ERROR. NO_TRUE_FALSE, SCENARIO_COMPETENCY, POOL_DEPTH pass vacuously.

## CV-2: On-demand re-validation

1. Navigate to `/compliance/validation`
2. Note the "checked at" timestamp
3. Click "Run Validation"
4. **Expected:** Report refreshes with a new timestamp.

## CV-3: Topic coverage check

1. Create a scenario with `faaTopics: ['A.1']` and at least one competency
2. Run validation
3. **Expected:** TOPIC_COVERAGE fails (1 of 13). Violations list the 12 uncovered topics.

## CV-4: Question count thresholds

1. Create 55 questions with `purpose: faa` across various modules
2. Run validation
3. **Expected:** QUESTION_COUNT shows ERROR (55 < 60)
4. Create 5 more FAA questions (total 60)
5. Run validation
6. **Expected:** QUESTION_COUNT shows WARNING (60 < 72)
7. Create 12 more FAA questions (total 72)
8. Run validation
9. **Expected:** QUESTION_COUNT shows PASS

## CV-5: Questions per module

1. Ensure one module has 3 FAA questions, another has 7
2. Run validation
3. **Expected:** QUESTIONS_PER_MODULE shows ERROR. Violation identifies the module with 3.

## CV-6: True/false detection -- literal pair

1. Create a FAA question with options `["True", "False"]`
2. Run validation
3. **Expected:** NO_TRUE_FALSE shows ERROR. Violation identifies the question.

## CV-7: True/false detection -- other boolean pairs

1. Create FAA questions with: `["Yes", "No"]`, `["Correct", "Incorrect"]`, `["RIGHT", "wrong"]`
2. Run validation
3. **Expected:** All three flagged. NO_TRUE_FALSE shows ERROR with 3 violations.

## CV-8: True/false not flagged for lesson questions

1. Create a lesson question with options `["True", "False"]`
2. Run validation
3. **Expected:** NO_TRUE_FALSE shows PASS. Lesson questions are not checked.

## CV-9: True/false not flagged for 3+ options

1. Create a FAA question with options `["True", "False", "Not enough information"]`
2. Run validation
3. **Expected:** This question is NOT flagged (3 options, not a binary pair).

## CV-10: Scenario-competency linkage

1. Create a scenario with `competencies: []`
2. Run validation
3. **Expected:** SCENARIO_COMPETENCY shows ERROR. Violation identifies the scenario.

## CV-11: Competency coverage

1. Ensure at least one competency (from seed data) has no matching scenarios
2. Run validation
3. **Expected:** COMPETENCY_COVERAGE shows ERROR. Violation identifies the uncovered competency.

## CV-12: Matrix completeness

1. Ensure no traceability entries exist
2. Run validation
3. **Expected:** MATRIX_COMPLETENESS shows ERROR. Lists all 13 missing topics.

## CV-13: Pool depth -- shallow pool

1. Create 2 FAA questions in pool "pool-A" and 4 in pool "pool-B"
2. Run validation
3. **Expected:** POOL_DEPTH shows ERROR. Violation identifies pool-A (depth 2, minimum 3). Pool-B passes.

## CV-14: Pool depth -- unpooled questions

1. Create a FAA question with no `poolId` (null)
2. Run validation
3. **Expected:** POOL_DEPTH shows ERROR. Unpooled questions are each a pool of 1.

## CV-15: Publish gate blocks on failure

1. Ensure validation has at least one ERROR
2. Navigate to `/publish` and attempt to create a new release
3. **Expected:** Publish fails. Error shows validation violations.

## CV-16: Publish gate allows with warnings

1. Set up data so all checks pass or only produce warnings
2. Attempt to publish
3. **Expected:** Publish succeeds. Warnings do not block.

## CV-17: Soft-deleted content excluded

1. Create a scenario, then soft-delete it
2. Run validation
3. **Expected:** Deleted scenario not counted toward coverage checks.

## CV-18: Auth guard

1. Log out or use a user without author/admin role
2. Navigate to `/compliance/validation`
3. **Expected:** Redirected to login or shown authorization error.

## CV-19: Question purpose selector in UI

1. Navigate to `/questions/new`
2. **Expected:** Purpose selector visible with "Lesson" (default) and "FAA"
3. Create a question with purpose "FAA"
4. Navigate to `/questions/{id}/edit`
5. **Expected:** Purpose shows "FAA", can be changed

## CV-20: Rule names and descriptions visible

1. Navigate to `/compliance/validation`
2. **Expected:** Each check shows its human-readable name (e.g., "FAA Question Count") and description (e.g., ">= 60 FAA questions in the bank"). Not just a pass/fail icon.
