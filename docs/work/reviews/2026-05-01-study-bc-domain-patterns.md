---
feature: study-bc-domain
category: patterns
date: 2026-05-01
branch: main
counts:
  critical: 0
  major: 0
  minor: 1
  nit: 0
status: unread
review_status: done
---

## Status as of 2026-05-04

| Severity | Count | Closed | Open |
| -------- | ----: | -----: | ---: |
| critical |     0 |      0 |    0 |
| major    |     0 |      0 |    0 |
| minor    |     1 |      1 |    0 |
| nit      |     0 |      0 |    0 |

### MINOR: Weak-area score formula uses inline coefficient `2` -- CLOSED

PR #468. `libs/constants/src/study.ts:195,201` declares `WEAK_AREA_CARD_WEIGHT = 2` and `WEAK_AREA_REP_WEIGHT = 2`. `libs/bc/study/src/dashboard.ts:26-29,394-395,521` imports + uses both constants in the formula and the JSDoc-rendered formula. Closed.

### Final verdict

All findings closed. `review_status` stays `done`.

## Summary

Reviewed `libs/bc/study/src/` (28k LOC across ~50 modules) against the project's house-style rubric: ENGINE_SCORING centralisation per ADR 014, ID generation through `@ab/utils` helpers, TypeScript strictness, Drizzle namespace correctness, and `@ab/*` import rules.

Engine-scoring discipline is excellent: `engine.ts` and `engine-targeting.ts` have zero inline numeric literals in any scoring function -- every weight, threshold, and window routes through `ENGINE_SCORING`, `MS_PER_WEEK`, or related named constants imported from `@ab/constants`. Reason codes, slice ordering, card state, review ratings, and depth preferences all flow through the constants barrel.

ID generation is uniform: every persistence-side row id comes from a typed `generate*Id()` helper in `@ab/utils` (e.g., `generateGoalId`, `generateScenarioId`, `generateReviewSessionId`, `generateKnowledgeNodeProgressId`) or from `createId(REFERENCE_SECTION_ERRATA_ID_PREFIX)` for the errata table. No raw `nanoid()`, `ulid()`, `crypto.randomUUID()`, `Math.random`, or `Date.now()`-based ids appear anywhere in the BC source tree.

TypeScript strictness is clean: zero `any` types in non-test source (the four matches grep returned are the word "any" appearing in JSDoc prose). Zero `!` non-null assertions. Zero `@ts-ignore` / `@ts-expect-error` / `@ts-nocheck` suppressions. The `as unknown as readonly [T, ...T[]]` casts in `credentials.validation.ts` are the documented Zod-enum-with-readonly-string-array workaround and are widely used; they bypass TS structurally rather than evading the type system. Engine.ts uses `as unknown as Scored<{cardId?, scenarioId?, nodeId?}>` to widen a discriminated `Scored<T>` for the kind-narrowing helper -- defensible inside a single private function.

Drizzle patterns are correct: schema.ts declares `studySchema = pgSchema(SCHEMAS.STUDY)` and every table hangs off it. Cross-lib imports use `@ab/*` aliases without exception; intra-lib relative imports stay inside the lib boundary (e.g., `../schema` from `citations/`, `../manifest-validation` from `seeders/`). Drizzle's `sql` template tag for typed-fragment SELECTs (count aggregations, conditional sums, window queries) is the project's accepted raw-SQL escape hatch and is used for what it's for.

One minor finding: `dashboard.ts#getWeakAreas` builds a domain-weakness score with two inline `2 *` weights. ADR 014's letter is engine-specific, but the broader Critical Rule on magic numbers applies and the formula is documented in the doc comment as a tunable scoring formula.

## Issues

### MINOR: Weak-area score formula uses inline coefficient `2`

File: `libs/bc/study/src/dashboard.ts:517` (formula also documented at `:392`)

Problem: `getWeakAreas` computes `score = 2 * cardWeakness + 2 * repWeakness + overdueLoad` with bare `2` literals. The function's own JSDoc (lines 387-393) describes this as a tunable scoring formula -- the same kind of dial that ADR 014 pulled out of the engine. The threshold (`WEAK_AREA_ACCURACY_THRESHOLD`), window (`WEAK_AREA_WINDOW_DAYS`), min-data-point gate (`WEAK_AREA_MIN_DATA_POINTS`), and result limit (`WEAK_AREA_LIMIT`) are already extracted into `libs/constants/src/study.ts`; the two coefficients in front of `cardWeakness` and `repWeakness` were left inline.

Rule: CLAUDE.md "Critical Rules" -- "No magic strings. No implicit types. All literal values in `libs/constants/`." ADR 014 demonstrates the convention: scoring dials get named constants so tuning changes are reviewable.

Fix: Add `WEAK_AREA_CARD_WEIGHT = 2` and `WEAK_AREA_REP_WEIGHT = 2` (or a nested `WEAK_AREA_SCORING` shape mirroring `ENGINE_SCORING`) to `libs/constants/src/study.ts`, import alongside the existing `WEAK_AREA_*` constants, and substitute. Update the doc-comment formula on line 392 to reference the constant names. Tests in `dashboard.test.ts` should pass unchanged because the values are byte-identical -- mirror ADR 014's invariance approach.
