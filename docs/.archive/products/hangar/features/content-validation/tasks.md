---
title: "Tasks: Content Validation Engine"
product: hangar
feature: content-validation
type: tasks
status: done
---

# Tasks: Content Validation Engine

## Pre-flight

- [ ] Read `libs/bc/compliance/src/` -- existing schema, manage, read functions
- [ ] Read `libs/bc/course/src/schema.ts` -- scenario, module, question, competency table shapes
- [ ] Read `libs/bc/course/src/publish.ts` -- publish flow for gate integration
- [ ] Read `libs/constants/src/compliance.ts`, `faa.ts`, `audit.ts` -- existing constants
- [ ] Read `apps/hangar/src/routes/(app)/questions/new/+page.server.ts` -- question create pattern

## Implementation

### 1. Constants and Types

- [ ] Add `QUESTION_PURPOSE` (`FAA`, `LESSON`) to `libs/constants/src/compliance.ts`
- [ ] Add `VALIDATION_RULE` (10 rule IDs) to `libs/constants/src/compliance.ts`
- [ ] Add `VALIDATION_SEVERITY`, `VALIDATION_STATUS` to `libs/constants/src/compliance.ts`
- [ ] Add tunable threshold constants: `VALIDATION_WARNING_MULTIPLIER`, `MIN_POOL_DEPTH`, `MIN_FAA_QUESTIONS`, `MIN_FAA_QUESTIONS_PER_MODULE`
- [ ] Export all types from `libs/constants/src/compliance.ts`
- [ ] Add `COMPLIANCE_ACTIONS.RUN_VALIDATION` to `libs/constants/src/audit.ts`
- [ ] Add `ENTITY_TYPES.VALIDATION_REPORT` to `libs/constants/src/audit.ts`
- [ ] Create `libs/types/src/validation.ts` with `ValidationViolation`, `ValidationCheckResult`, `ValidationReport`, `RuleConfig`, `ValidationData`
- [ ] Export from `libs/types/src/index.ts`
- [ ] Run `bun run check` -- 0 errors

### 2. Schema Changes

- [ ] Add `purpose` column to `course.question` in `libs/bc/course/src/schema.ts` (text, not null, default `'lesson'`, CHECK constraint)
- [ ] Add `purpose` column to `published.question` in `libs/bc/course/src/schema.ts` (text, not null)
- [ ] Update `publishRelease()` in `libs/bc/course/src/publish.ts` to copy `purpose` to published questions
- [ ] Update question create/edit form actions to accept `purpose` field
- [ ] Update question create/edit Svelte pages to show purpose selector (FAA / Lesson)
- [ ] Regenerate initial migration and reset DB
- [ ] Run `bun run check` -- 0 errors, commit

### 3. Validation Engine (BC)

- [ ] Create `libs/bc/compliance/src/validate.ts`
- [ ] Define `RULES` config array -- all 10 rules as declarative config with id, name, description, check function, scope
- [ ] Implement `runValidation()` -- load data, iterate RULES, aggregate results
- [ ] Implement `loadValidationData()` -- 5 queries, pre-filter FAA questions
- [ ] Implement `checkTopicCoverage()` -- every FAA topic A.1-A.13 has a non-deleted scenario
- [ ] Implement `checkTopicTime()` -- sum duration per topic >= 2700s, warning at < 3240s
- [ ] Implement `checkTotalTime()` -- sum module time allocations >= 57600s
- [ ] Implement `checkQuestionCount()` -- FAA questions >= 60, warning at < 72
- [ ] Implement `checkQuestionsPerModule()` -- each module has >= 5 FAA questions
- [ ] Implement `checkNoTrueFalse()` -- detect boolean-pair patterns (4 pairs, case-insensitive)
- [ ] Implement `checkScenarioCompetency()` -- every non-deleted scenario has competencies
- [ ] Implement `checkCompetencyCoverage()` -- every competency has a non-deleted scenario
- [ ] Implement `checkMatrixCompleteness()` -- every FAA topic has a traceability entry with non-empty fields
- [ ] Implement `checkPoolDepth()` -- each FAA question pool has >= 3 questions
- [ ] Implement `deriveWorstStatus()` -- FAIL > WARNING > PASS
- [ ] Export `runValidation` from `libs/bc/compliance/src/index.ts`
- [ ] Run `bun run check` -- 0 errors, commit

### 4. Unit Tests

- [ ] Create `libs/bc/compliance/src/validate.test.ts`
- [ ] Test each check function with passing data
- [ ] Test each check function with failing data
- [ ] Test warning thresholds (just above minimum, just below warning threshold)
- [ ] Test edge cases: empty arrays, soft-deleted excluded, empty faaTopics, questions without poolId
- [ ] Test question purpose filtering: lesson questions ignored, FAA questions counted
- [ ] Test true/false detection: all 4 boolean pairs, case-insensitive, 3+ options not flagged
- [ ] Test `deriveWorstStatus()`: FAIL wins over WARNING wins over PASS
- [ ] Test `runValidation()` integration (mock DB or use test data)
- [ ] Run `bun run test` -- all pass, commit

### 5. Publish Gate

- [ ] Modify `libs/bc/course/src/publish.ts` -- call `runValidation()` before transaction
- [ ] If `report.status === 'fail'`, throw with violations
- [ ] Update `apps/hangar/src/routes/(app)/publish/+page.server.ts` to catch validation errors and return violations
- [ ] Run `bun run check` -- 0 errors, commit

### 6. Hangar Route

- [ ] Create `apps/hangar/src/routes/(app)/compliance/validation/+page.server.ts` -- load runs validation, action re-runs
- [ ] Create `apps/hangar/src/routes/(app)/compliance/validation/+page.svelte` -- displays validation report (rule name, description, status, violations)
- [ ] Add audit logging to the validate action
- [ ] Enable the Compliance nav group in `apps/hangar/src/routes/(app)/+layout.svelte` (remove `disabled: true`)
- [ ] Run `bun run check` -- 0 errors, commit

## Post-implementation

- [ ] Full manual test per test-plan.md
- [ ] Request implementation review
- [ ] Commit docs updates
