---
title: "Test Plan: Knowledge Checks"
product: sim
feature: knowledge-checks
type: test-plan
status: done
---

# Test Plan: Knowledge Checks

## Setup

Requires published release with at least one question. Create a question in hangar and publish.

```bash
bun scripts/dev.ts hangar    # create a test question, publish
bun scripts/dev.ts sim
```

---

## QC-1: Navigate to knowledge check

1. Navigate to `/course/:moduleId/check` (use a module ID that has questions)
2. **Expected:** Question text visible
3. **Expected:** 3-4 answer option radio buttons visible
4. **Expected:** No "True/False" options (spec: true/false questions are not allowed)

## QC-2: Module with no questions

1. Navigate to `/course/:moduleId/check` for a module with no questions
2. **Expected:** "No assessment available yet" message (not an error)

## QC-3: Submit correct answer

1. Select the correct answer (need to know it from hangar)
2. Click "Lock in answer"
3. **Expected:** "CORRECT" indicator shown (green)
4. **Expected:** Explanation shown (if set)
5. **Expected:** FAA topic tag shown
6. **Expected:** "Continue" button visible

## QC-4: Submit incorrect answer

1. Select a wrong answer
2. Click "Lock in answer"
3. **Expected:** "INCORRECT" indicator shown (red)
4. **Expected:** Correct answer highlighted in the options
5. **Expected:** Explanation shown

## QC-5: Answer attempt recorded

1. Submit any answer
2. Check: `SELECT * FROM enrollment.lesson_attempt_content WHERE item_type = 'question' ORDER BY id DESC LIMIT 1`
3. **Expected:** Row exists with correct `question_id`, `release_id`

## QC-6: Time credited on correct answer

1. Submit a correct answer
2. Check: `SELECT * FROM enrollment.time_log ORDER BY started_at DESC LIMIT 1`
3. **Expected:** New row with `faa_qualified = true`, `topic` matching the question's FAA topic, `duration_seconds = 60`

## QC-7: No time credited on incorrect answer

1. Submit an incorrect answer
2. Check `time_log`
3. **Expected:** No new time log entry

---

## SECURITY-1: correctAnswer not in page data

1. Open browser dev tools -> Network tab
2. Navigate to `/course/:moduleId/check`
3. Inspect the `__data.json` or page source
4. Search for the actual correct answer string
5. **Expected:** The `correctAnswer` field value is NOT visible in any network response before submission

## SECURITY-2: Invalid answer rejected

1. Using curl or browser devtools, POST to `?/answer` with a `selectedAnswer` value that is not in the options list
2. **Expected:** Server returns a validation error (not a 500, not silently accepted)
