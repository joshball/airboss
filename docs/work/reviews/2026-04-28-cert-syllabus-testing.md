---
title: 'Review: cert-syllabus-and-goal-composer (testing)'
feature: cert-syllabus-and-goal-composer
date: 2026-04-28
reviewer: testing
status: unread
review_status: done
scope: PRs #248, #254, #264, #270 (cumulative WP)
issues_found: 2
---

# Review: cert-syllabus testing

## Major (1)

### T1 -- 3 test failures from suite-order pollution

Reproducible in `bun test libs/sources libs/bc/study scripts/db`: 3 failing tests, all caused by `__corpus_resolver_internal__.resetToDefaults()` wiping real resolver registrations between test files. See correctness review C1 for the root cause.

Failing in suite, passing in isolation:

- `libs/bc/study/src/handbooks.test.ts` -- `resolveCitationUrl > routes through @ab/sources getLiveUrl when airboss_ref is set on a non-handbook citation`.
- `libs/bc/study/src/syllabi.test.ts` -- `validateAirbossRefForLeaf > rejects acs identifier whose locator does not parse`.
- `libs/sources/src/ac/resolver.test.ts` -- `AC_RESOLVER > is registered under the ac corpus`.

**Fix:** see correctness review C1. Tracking here so the testing axis is closed once that fix lands.

## Minor (1)

### t1 -- `migrate-study-plans-to-goals.test.ts` and other DB-touching tests need a `.env` file

The worktree does not have a `.env` by default. The first run of `bun test libs/sources libs/bc/study scripts/db` failed with `Cannot access 'db' before initialization` traced to `libs/constants/src/env.ts:61 requireEnv` because `DATABASE_URL` wasn't set.

**Fix:** copy `.env` from the parent worktree (or set up a CI / dev convention so tests find a default). Already done locally for this review session. Document in test plan or a worktree-bootstrap script. Out of WP scope.

## Notes

- Coverage of new BC modules is strong:
  - `credentials.test.ts` -- `validateCredentialDag` cycle detection covered, walker visited-set defended.
  - `syllabi.test.ts` -- 37 tests; `validateSyllabusTree` parent-level / cycle / leaf consistency / triad rules; `validateAirbossRefForLeaf` happy + reject paths.
  - `goals.test.ts` -- 17 tests; create / update / archive / setPrimary / addGoalSyllabus / addGoalNode / getGoalNodeUnion / getDerivedCertGoals.
  - `lenses.test.ts` -- 25 tests covering ACS lens (multiple syllabi, class filter, area/task filter) and Domain lens (filter, mastery rollup).
- ACS / PTS resolver coverage in `libs/sources/src/acs/{locator,resolver,smoke}.test.ts` and `libs/sources/src/pts/{locator,resolver}.test.ts` -- 5 files, ~700 lines of tests, exercising parser / formatter / URL / derivative content / round-trip.
- `migrate-study-plans-to-goals.test.ts` -- 7 tests covering happy-path migration, idempotency, no-cert-goal skip, primary-goal preservation, cert-not-found logging, dry-run.
- `strip-authored-relevance.test.ts` -- 4 tests covering replace-equivalent / replace-different / unchanged-on-other-fields / dry-run.
- The `replaceSyllabusNodeLinks` transaction (syllabi.ts:548) is tested in `syllabi.test.ts` for the half-linked-state case via `replace [] -> [a, b]` and `replace [a, b] -> [c]`.

The shape of test coverage matches the WP spec's Test Plan §4 "Phase tests" section.
