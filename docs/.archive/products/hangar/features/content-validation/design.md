---
title: "Design: Content Validation Engine"
product: hangar
feature: content-validation
type: design
status: done
---

# Design: Content Validation Engine

## Stateless Computation, Not Stored State

The validation engine is a pure function: read content tables, run checks, return report. No `validation_result` table, no caching, no staleness problem.

Why: validation results are derived data. Storing them creates a cache invalidation problem -- every content edit would need to update the validation state. Since the queries are simple (count scenarios per topic, sum durations), running them on-demand is fast and always correct.

Trade-off: if query performance becomes an issue with large content sets, we can add a materialized cache later. For the expected content volume (13 topics, ~50 scenarios, ~100 questions), this is not a concern.

## Question Purpose: `faa` vs `lesson`

Two buckets:

| Aspect                | `faa`                  | `lesson`        |
| --------------------- | ---------------------- | --------------- |
| True/false allowed    | No (AC 61-83K)         | Yes             |
| Minimum count         | 60 total, 5 per module | No minimum      |
| Pool depth required   | >= 3 per pool          | No requirement  |
| Randomization         | Required at runtime    | Optional        |
| Counted in validation | Yes                    | No              |
| Graded vs practice    | Sim decides at runtime | Always ungraded |

The `faa` bucket holds all questions eligible for FAA assessment. The sim decides which are graded (real test) vs practice (drill). This keeps the validation engine simple -- it doesn't need to know about test administration -- while giving the sim full flexibility.

Default is `'lesson'` so existing questions don't appear in FAA counts. Authors explicitly mark questions as `faa`.

## Declarative Rule Configuration

All validation rules live in a single config array. This is the most important design decision -- it makes the business rules visible, testable, and tweakable without touching engine logic.

```typescript
interface RuleConfig {
  id: ValidationRule;
  name: string; // human-readable: "FAA Question Count"
  description: string; // what it checks: "Minimum FAA-eligible questions in the bank"
  check: (data: ValidationData) => ValidationCheckResult;
  scope: "all" | "faa"; // 'faa' = only faa questions, 'all' = all content
}

// All thresholds are named constants, not inline numbers
const RULES: RuleConfig[] = [
  {
    id: VALIDATION_RULE.TOPIC_COVERAGE,
    name: "FAA Topic Coverage",
    description: "Every FAA topic (A.1-A.13) must have at least one scenario",
    check: checkTopicCoverage,
    scope: "all",
  },
  {
    id: VALIDATION_RULE.TOPIC_TIME,
    name: "Topic Time Coverage",
    description: `Each FAA topic needs >= ${FAA_TIME.TOPIC_THRESHOLD_SECONDS / 60} min of scenario time`,
    check: checkTopicTime,
    scope: "all",
  },
  {
    id: VALIDATION_RULE.TOTAL_TIME,
    name: "Total Course Time",
    description: `Total module time >= ${FAA_TIME.TOTAL_REQUIREMENT_SECONDS / 3600} hours`,
    check: checkTotalTime,
    scope: "all",
  },
  {
    id: VALIDATION_RULE.QUESTION_COUNT,
    name: "FAA Question Count",
    description: `>= ${MIN_FAA_QUESTIONS} FAA questions in the bank`,
    check: checkQuestionCount,
    scope: "faa",
  },
  {
    id: VALIDATION_RULE.QUESTIONS_PER_MODULE,
    name: "Questions Per Module",
    description: `Each module needs >= ${MIN_FAA_QUESTIONS_PER_MODULE} FAA questions`,
    check: checkQuestionsPerModule,
    scope: "faa",
  },
  {
    id: VALIDATION_RULE.NO_TRUE_FALSE,
    name: "No True/False Questions",
    description: "FAA questions cannot be de facto true/false (2 boolean options)",
    check: checkNoTrueFalse,
    scope: "faa",
  },
  {
    id: VALIDATION_RULE.SCENARIO_COMPETENCY,
    name: "Scenario-Competency Link",
    description: "Every scenario must link to at least one competency",
    check: checkScenarioCompetency,
    scope: "all",
  },
  {
    id: VALIDATION_RULE.COMPETENCY_COVERAGE,
    name: "Competency Coverage",
    description: "Every competency must have at least one scenario",
    check: checkCompetencyCoverage,
    scope: "all",
  },
  {
    id: VALIDATION_RULE.MATRIX_COMPLETENESS,
    name: "Traceability Matrix",
    description: "Every FAA topic must have a complete traceability entry",
    check: checkMatrixCompleteness,
    scope: "all",
  },
  {
    id: VALIDATION_RULE.POOL_DEPTH,
    name: "Question Pool Depth",
    description: `Each FAA question pool needs >= ${MIN_POOL_DEPTH} questions for randomization`,
    check: checkPoolDepth,
    scope: "faa",
  },
];
```

The engine just iterates:

```typescript
export async function runValidation(): Promise<ValidationReport> {
  const data = await loadValidationData();
  const checks = RULES.map((rule) => rule.check(data));
  const worstStatus = deriveWorstStatus(checks);
  return { status: worstStatus, checks, checkedAt: new Date().toISOString() };
}
```

Adding a new rule = add an entry to `RULES` + write a pure check function. No other changes needed.

## Schema

### `course.question` addition

```typescript
purpose: text('purpose').notNull().default(QUESTION_PURPOSE.LESSON),
// + CHECK constraint: purpose IN ('faa', 'lesson')
```

### `published.question` addition

```typescript
purpose: text('purpose').notNull(),
```

### Constants: `libs/constants/src/compliance.ts`

```typescript
export const QUESTION_PURPOSE = {
  FAA: "faa",
  LESSON: "lesson",
} as const;
export type QuestionPurpose = (typeof QUESTION_PURPOSE)[keyof typeof QUESTION_PURPOSE];

export const VALIDATION_RULE = {
  /* 10 rules */
} as const;
export const VALIDATION_SEVERITY = { ERROR: "error", WARNING: "warning" } as const;
export const VALIDATION_STATUS = { PASS: "pass", FAIL: "fail", WARNING: "warning" } as const;

// -- Tunable thresholds --
// Warning fires when value is within this multiplier of the minimum.
// 1.2 means warning at < 120% of minimum (e.g., < 54 min on a 45 min requirement).
// Lower = more aggressive warnings, higher = more buffer before warnings appear.
export const VALIDATION_WARNING_MULTIPLIER = 1.2 as const;

// Minimum FAA questions per pool for meaningful test randomization.
export const MIN_POOL_DEPTH = 3 as const;

// Minimum FAA questions total.
export const MIN_FAA_QUESTIONS = 60 as const;

// Minimum FAA questions per module.
export const MIN_FAA_QUESTIONS_PER_MODULE = 5 as const;
```

## True/False Detection

The `checkNoTrueFalse` function detects de facto true/false among FAA questions. A question is flagged if it has exactly 2 options and both match a boolean pattern (case-insensitive, trimmed):

```typescript
const BOOLEAN_PAIRS: [string, string][] = [
  ["true", "false"],
  ["yes", "no"],
  ["correct", "incorrect"],
  ["right", "wrong"],
];
```

Only applies to `faa` questions. `lesson` questions can use any format.

## API Surface

### BC: `libs/bc/compliance/src/validate.ts`

```typescript
export async function runValidation(): Promise<ValidationReport>;
```

Each check function is pure -- takes `ValidationData`, returns `ValidationCheckResult`. Only `runValidation()` touches the database.

### Route: `/compliance/validation`

Load runs validation on page load. Form action re-runs on demand.

### Publish gate: `libs/bc/course/src/publish.ts`

Calls `runValidation()` before the transaction. Blocks on `FAIL`, allows `WARNING`.

## Key Decisions

### `faa` + `lesson`, not three buckets

We considered a third bucket (`faa-practice`) for practice questions that still follow FAA rules. But the validation rules are the same for `faa-test` and `faa-practice` -- the only difference is runtime grading. Keeping two buckets means the validation engine stays simple. The sim handles the graded-vs-practice distinction at administration time.

### Default `'lesson'`, not `'faa'`

Existing questions were created before this field. Defaulting to `'lesson'` means they won't suddenly fail validation. Safer than `'faa'` which would create noise. Authors explicitly opt questions into the FAA pool.

### Declarative rules over procedural checks

All rules in one config array with names, descriptions, and thresholds. An author looking at a validation failure can see the rule name and description. A developer adding a rule adds one config entry. No scattered if-statements.

### Pool depth >= 3

With pools of 3+ interchangeable questions and random selection, identical tests become statistically improbable. The FAA doesn't specify a number -- they just require randomization. We verify the bank supports it; the sim handles runtime selection.

### Warning multiplier as a named constant

`VALIDATION_WARNING_MULTIPLIER = 1.2` -- single constant, documented inline with what it does and how to tune it.
