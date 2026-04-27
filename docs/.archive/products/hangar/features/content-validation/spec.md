---
title: "Spec: Content Validation Engine"
product: hangar
feature: content-validation
type: spec
status: done
---

# Spec: Content Validation Engine

Automated compliance checking engine that evaluates course content against FAA AC 61-83K requirements. Runs on-demand or automatically on content changes. Returns structured results consumed by the compliance dashboard, publish gate, and FAA package generator.

## Data Model

### Schema change: question purpose

Add a `purpose` column to `course.question`:

| Column    | Type   | Default    | Constraint                            |
| --------- | ------ | ---------- | ------------------------------------- |
| `purpose` | `text` | `'lesson'` | CHECK: `purpose IN ('faa', 'lesson')` |

Two buckets:

| Value    | FAA rules apply?                                                | What it's for                                                                                                                                               |
| -------- | --------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `faa`    | Yes -- count minimums, no true/false, pool depth, randomization | Questions that could appear on the FAA graded assessment. The sim decides at runtime which are graded vs practice drill -- the bank is the same either way. |
| `lesson` | No rules                                                        | In-scenario knowledge checks, engagement questions, learning reinforcement. Any format including true/false.                                                |

Default is `'lesson'` so existing questions don't suddenly appear in FAA validation counts. Authors must explicitly mark questions as `faa`.

Also add `purpose` to `published.question` so the sim knows which questions are FAA-eligible.

### No validation result tables

Validation is computed on-demand from existing data -- results are ephemeral, not persisted. Avoids stale state and cache invalidation.

The engine reads from:

- `course.scenario` -- FAA topics, competencies, duration, status
- `course.module` -- scenario assignments, time allocation
- `course.question` -- type, status, module assignment, pool ID, **purpose**
- `course.competency` -- domains, FAA topic mapping
- `compliance.traceability_entry` -- matrix completeness

### New constants in `libs/constants/src/compliance.ts`

| Constant                        | Type        | Values                            |
| ------------------------------- | ----------- | --------------------------------- |
| `QUESTION_PURPOSE`              | enum object | `FAA`, `LESSON`                   |
| `VALIDATION_RULE`               | enum object | 10 rule IDs (see checks below)    |
| `VALIDATION_SEVERITY`           | enum object | `ERROR`, `WARNING`                |
| `VALIDATION_STATUS`             | enum object | `PASS`, `FAIL`, `WARNING`         |
| `VALIDATION_WARNING_MULTIPLIER` | number      | `1.2` (configurable -- tune this) |
| `MIN_POOL_DEPTH`                | number      | `3`                               |
| `MIN_FAA_QUESTIONS`             | number      | `60`                              |
| `MIN_FAA_QUESTIONS_PER_MODULE`  | number      | `5`                               |

### Declarative rule configuration

All validation rules are defined as a single config array. Each rule has an ID, human-readable name, description, threshold, and scope. The engine iterates this config -- no hardcoded per-rule logic. Easy to read, test, and tweak.

```typescript
const VALIDATION_RULES: RuleConfig[] = [
  {
    id: VALIDATION_RULE.QUESTION_COUNT,
    name: "FAA Question Count",
    description: "Minimum FAA-eligible questions in the bank",
    threshold: MIN_FAA_QUESTIONS,
    warningMultiplier: VALIDATION_WARNING_MULTIPLIER,
    scope: "faa",
    severity: "error",
  },
  // ... 9 more rules
];
```

### New types in `libs/types/src/validation.ts`

```typescript
interface ValidationViolation {
  rule: ValidationRule;
  severity: ValidationSeverity;
  message: string;
  entityType?: string;
  entityId?: string;
  actual?: number;
  threshold?: number;
}

interface ValidationCheckResult {
  rule: ValidationRule;
  status: ValidationStatus;
  name: string; // human-readable
  description: string; // what this rule checks
  message: string; // result summary
  violations: ValidationViolation[];
}

interface ValidationReport {
  status: ValidationStatus; // worst status across all checks
  checks: ValidationCheckResult[];
  checkedAt: string; // ISO timestamp
}
```

## Behavior

### Running Validation

The engine exposes a single entry point: `runValidation()` in `libs/bc/compliance/src/validate.ts`. It:

1. Queries all relevant content tables (scenarios, modules, questions, competencies, traceability entries)
2. Filters questions to `purpose = 'faa'` for FAA-specific checks
3. Runs all 10 checks against the data
4. Returns a `ValidationReport`

No side effects. Pure read operation (plus timestamp generation).

### Validation Checks

| #   | Rule                   | What it checks                                                   | Threshold     | Severity                 | Scope |
| --- | ---------------------- | ---------------------------------------------------------------- | ------------- | ------------------------ | ----- |
| 1   | `TOPIC_COVERAGE`       | Every FAA topic (A.1-A.13) has at least one non-deleted scenario | 1 per topic   | ERROR                    | all   |
| 2   | `TOPIC_TIME`           | Sum of scenario durations per FAA topic >= 45 min                | 2700s         | ERROR <45m, WARNING <54m | all   |
| 3   | `TOTAL_TIME`           | Sum of all module time allocations >= 16 hours                   | 57600s        | ERROR                    | all   |
| 4   | `QUESTION_COUNT`       | Total active FAA questions >= 60                                 | 60            | ERROR <60, WARNING <72   | faa   |
| 5   | `QUESTIONS_PER_MODULE` | Each module has >= 5 active FAA questions                        | 5             | ERROR                    | faa   |
| 6   | `NO_TRUE_FALSE`        | No FAA questions are de facto true/false                         | 0             | ERROR                    | faa   |
| 7   | `SCENARIO_COMPETENCY`  | Every non-deleted scenario links to at least one competency      | 1             | ERROR                    | all   |
| 8   | `COMPETENCY_COVERAGE`  | Every competency has at least one non-deleted scenario           | 1             | ERROR                    | all   |
| 9   | `MATRIX_COMPLETENESS`  | Every FAA topic has a traceability entry with non-empty fields   | all populated | ERROR                    | all   |
| 10  | `POOL_DEPTH`           | Each FAA question pool has >= 3 questions                        | 3             | ERROR                    | faa   |

### True/False Detection (Check 6)

Detects de facto true/false among FAA questions: any question with exactly 2 options where both match a boolean pattern (case-insensitive, trimmed):

- True / False
- Yes / No
- Correct / Incorrect
- Right / Wrong

Only applies to `faa` questions. `lesson` questions can use any format.

### Pool Depth (Check 10)

AC 61-83K requires randomized tests that are never identical between attendees or across retakes. The engine verifies each question pool (grouped by `poolId`) has >= 3 questions. Questions without a `poolId` are each treated as a pool of 1 and will fail this check.

Runtime randomization and test administration (single test vs split across modules) is the sim's responsibility. The validation engine just verifies the bank supports it.

### Warning Thresholds

Checks 2 and 4 produce warnings when values are within the warning multiplier of the minimum (default 120%). The multiplier is `VALIDATION_WARNING_MULTIPLIER` -- a single named constant, documented, easy to tune.

### Publish Gate Integration

`publishRelease()` in `libs/bc/course/src/publish.ts` calls `runValidation()` before proceeding. If the report status is `FAIL` (any ERROR-level violation), publish is blocked and the violations are returned.

### On-Demand API

A form action at `/compliance/validation` triggers `runValidation()` and returns the report.

## Validation

| Field              | Rule                                                               |
| ------------------ | ------------------------------------------------------------------ |
| `question.purpose` | Must be `'faa'` or `'lesson'`. Default `'lesson'`.                 |
| (engine inputs)    | No other user-editable inputs. All thresholds come from constants. |

## Edge Cases

| Case                           | Behavior                                                     |
| ------------------------------ | ------------------------------------------------------------ |
| No scenarios exist             | All topic checks fail. Report status: FAIL.                  |
| No FAA questions exist         | Question count, per-module, true/false, pool depth all fail. |
| Lesson-only questions exist    | Same -- lesson questions don't count toward FAA checks.      |
| No traceability entries        | Matrix completeness fails for all 13 topics.                 |
| Soft-deleted content           | Excluded from all checks. Only non-deleted items count.      |
| Scenario with empty faaTopics  | Does not contribute to any topic coverage.                   |
| Module with no FAA questions   | QUESTIONS_PER_MODULE fails for that module.                  |
| Questions without poolId       | Each is a pool of 1 -- POOL_DEPTH fails.                     |
| Concurrent validation requests | No issue -- pure read, no side effects.                      |

## Out of Scope

- Persisting validation results (computed on-demand)
- Validation history / trend tracking (future analytics)
- Per-item validation (engine validates the whole course, not individual items)
- Custom validation rules (all rules per AC 61-83K, but config is declarative and easy to extend)
- UI for validation results (compliance dashboard feature)
- Blocking content saves based on validation (only publish is gated)
- Runtime test randomization / test splitting (sim engine concern -- see IDEAS.md)
- Adaptive question count for struggling learners (sim engine concern -- see IDEAS.md)
- Structured question pools / pool metadata (future question bank management feature -- see IDEAS.md)
