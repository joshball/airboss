---
title: 'Spec: Calibration Tracker'
product: study
feature: calibration-tracker
type: spec
status: unread
---

# Spec: Calibration Tracker

Tracks predicted confidence vs. actual accuracy across card reviews and decision reps. Shows the pilot where they're overconfident ("I thought I knew weather, but I'm only 60% accurate") and underconfident ("I'm better at regs than I think"). Trains metacognition -- the anti-overconfidence skill that matters most in aviation.

Depends on: Spaced Memory Items and Decision Reps (reads their confidence + accuracy data).

## Data Model

**No new tables.** Calibration data is derived from existing columns:

- `study.review.confidence` + `study.review.rating` (rating >= 3 = correct)
- `study.rep_attempt.confidence` + `study.rep_attempt.is_correct`

All calibration logic is aggregation queries on existing data.

## Behavior

### ConfidenceSlider component

A shared `libs/ui/` component used in both the card review flow and the rep session flow. Discrete 1-5 scale:

| Value | Label | Meaning |
| --- | --- | --- |
| 1 | Wild Guess | No idea, flipping a coin |
| 2 | Uncertain | Leaning toward an answer but not sure |
| 3 | Maybe | Think I know but could be wrong |
| 4 | Probably | Fairly confident |
| 5 | Certain | Would bet on it |

The slider appears on ~50% of reviews/reps (deterministic hash). When it appears, it shows BEFORE the answer/options are revealed. User can skip (stores NULL).

### Calibration page

`/calibration` shows:

**Five-bucket bar chart.** For each confidence level (1-5), show:

- How many times the user rated that confidence level
- What percentage were actually correct
- The gap: `predicted confidence % - actual accuracy %`

Expected for a well-calibrated person: confidence 1 -> ~20% correct, confidence 2 -> ~40%, confidence 3 -> ~60%, confidence 4 -> ~80%, confidence 5 -> ~100%. Deviation from this diagonal reveals over/under-confidence.

**Per-domain breakdown.** Same five-bucket analysis but filtered per domain. "I'm overconfident about weather (predict 80%, actual 55%) but calibrated on regulations (predict 70%, actual 68%)."

**30-day trend.** Overall calibration score over time. The calibration score is the mean absolute difference between predicted confidence (mapped to %) and actual accuracy, per bucket. Lower = better calibrated. Show as a simple line or sparkline.

**Data sources combined.** Calibration aggregates across both card reviews AND rep attempts. A confidence=4 on a card review and a confidence=4 on a rep attempt both go in the "Probably" bucket.

### Calibration score

A single number summarizing calibration quality:

```text
For each confidence bucket (1-5):
  expected_accuracy = (bucket_value - 1) / 4  -- maps 1->0%, 2->25%, 3->50%, 4->75%, 5->100%
  actual_accuracy = correct_count / total_count
  bucket_error = |expected_accuracy - actual_accuracy|

calibration_score = 1 - mean(bucket_errors)  -- 1.0 = perfect calibration, 0.0 = maximally miscalibrated
```

Only include buckets with >= 5 data points. Buckets with fewer are shown as "insufficient data."

### Read interfaces

The study BC exports:

- `getCalibration(userId, domain?)` -> `{ buckets: [{ level, count, accuracy, expectedAccuracy, gap }], score, trend }`
- `getCalibrationTrend(userId, days: 30)` -> `{ date, score }[]`

## Validation

No user input beyond what's already validated by the card review and rep attempt flows. The confidence slider validates 1-5 integer at the point of submission in those features.

## Edge Cases

- **Insufficient data:** A bucket with < 5 data points shows "Need more data" instead of a misleading percentage. The calibration score excludes it.
- **No confidence data at all:** Empty state: "Complete some reviews with confidence ratings to see your calibration." Link to `/memory/review`.
- **All reviews at one confidence level:** Only one bucket has data. Show it, but note "Try rating your confidence across the full range for a complete picture."
- **Confidence slider skipped on all reviews:** Same as no data. The ~50% sampling rate and optional skip means some users may have sparse data.
- **Perfect calibration:** Score = 1.0. Show a positive message. This is rare and worth celebrating.
- **Domain with no data:** Domain doesn't appear in per-domain breakdown.

## Out of Scope

- Adjusting the confidence sampling rate (hardcoded ~50%)
- Charting library (CSS-only chart initially -- bars are just styled divs with percentage widths)
- Historical comparison ("you were more overconfident 3 months ago")
- Calibration-based recommendations ("study more weather because you're overconfident there")
- Calibration leaderboard / social comparison
