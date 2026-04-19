---
title: 'Test Plan: Calibration Tracker'
product: study
feature: calibration-tracker
type: test-plan
status: unread
---

# Test Plan: Calibration Tracker

## Setup

- Study app running at `localhost:9600`
- Logged in as test user
- Spaced Memory Items and Decision Reps features complete
- Seed data: 20+ card reviews and 10+ rep attempts with confidence values spanning levels 1-5 across 3+ domains

---

## CT-1: ConfidenceSlider renders in card review

1. Start a card review session (`/memory/review`).
2. Review several cards.
3. **Expected:** On roughly half the cards, the ConfidenceSlider appears before the answer is revealed. Labels visible: Wild Guess (1) through Certain (5).

## CT-2: ConfidenceSlider renders in rep session

1. Start a rep session (`/reps/session`).
2. Go through several scenarios.
3. **Expected:** On roughly half the scenarios, the ConfidenceSlider appears before options are shown.

## CT-3: ConfidenceSlider skip works

1. When slider appears, click skip/dismiss without selecting a value.
2. Proceed with the review/rep.
3. **Expected:** Review/attempt saved with confidence = NULL. No error. Slider disappears.

## CT-4: ConfidenceSlider value saved

1. When slider appears, select confidence level 4 (Probably).
2. Complete the review/rep.
3. **Expected:** Check review/attempt record -- confidence = 4.

## CT-5: Calibration page -- five-bucket chart

1. Ensure seed data exists with confidence values across all 5 levels.
2. Navigate to `/calibration`.
3. **Expected:** Five-bucket bar chart visible. Each bucket shows: count, actual accuracy %, and gap from expected.

## CT-6: Calibration page -- overconfidence visible

1. Seed data: several reviews where confidence = 5 (Certain) but rating = 1 (Again) or is_correct = false.
2. Navigate to `/calibration`.
3. **Expected:** Bucket 5 (Certain) shows accuracy well below 100%. Gap is negative (overconfident). Visual indicator of overconfidence.

## CT-7: Calibration page -- underconfidence visible

1. Seed data: several reviews where confidence = 1 (Wild Guess) but rating >= 3 (Good/Easy) or is_correct = true.
2. Navigate to `/calibration`.
3. **Expected:** Bucket 1 (Wild Guess) shows accuracy above 0%. Positive gap. Visual indicator of underconfidence.

## CT-8: Calibration page -- insufficient data bucket

1. Ensure one confidence level has < 5 data points.
2. Navigate to `/calibration`.
3. **Expected:** That bucket shows "Need more data" instead of a percentage.

## CT-9: Calibration page -- per-domain breakdown

1. Ensure seed data spans 3+ domains.
2. Navigate to `/calibration`.
3. **Expected:** Per-domain section shows calibration breakdown for each domain with data.

## CT-10: Calibration page -- no data

1. Delete all reviews/attempts with confidence values (or use a fresh user).
2. Navigate to `/calibration`.
3. **Expected:** Empty state message: "Complete some reviews with confidence ratings to see your calibration." Link to start a review.

## CT-11: Calibration score calculation

1. With seed data, navigate to `/calibration`.
2. **Expected:** Calibration score displayed (0.0 - 1.0). Only buckets with >= 5 data points included.

## CT-12: 30-day trend

1. Ensure seed data spans multiple days (or mock dates).
2. Navigate to `/calibration`.
3. **Expected:** Trend line/sparkline showing calibration score over time.

## CT-13: Combined data from cards and reps

1. Create reviews with confidence on cards AND confidence on rep attempts, both at level 3.
2. Navigate to `/calibration`.
3. **Expected:** Bucket 3 (Maybe) count includes both card reviews and rep attempts. Accuracy calculation uses both sources.
