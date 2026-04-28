---
title: 'Review: cert-syllabus-and-goal-composer (security)'
feature: cert-syllabus-and-goal-composer
date: 2026-04-28
reviewer: security
status: unread
review_status: done
scope: PRs #248, #254, #264, #270 (cumulative WP)
issues_found: 0
---

# Review: cert-syllabus security

## Critical (0)

(none)

## Major (0)

(none)

## Minor (0)

(none)

## Notes

- This WP ships data-layer + BC code only; no new HTTP route handlers, no new auth surface. The follow-on cert-dashboard / goal-composer WPs will own user-input validation and CSRF / session integrity.
- BC write paths gate ownership: `getOwnedGoal` in `goals.ts:139` throws `GoalNotOwnedError` when `userId` doesn't match. Every mutating BC function (`updateGoal`, `setPrimaryGoal`, `addGoalSyllabus`, `removeGoalSyllabus`, `setGoalSyllabusWeight`, `addGoalNode`, `removeGoalNode`) routes through this check.
- The `airboss_ref` column accepts user-arbitrary strings at the DB layer (CHECK is shape-only: `LIKE 'airboss-ref:%'`). Full validation runs in the BC via `validateAirbossRefForLeaf`. Authored YAML pipeline is system-content (in-repo); learner-input goals do not yet write `airboss_ref`. When goal composition shifts to authoring leaves with airboss_ref values (follow-on WP), the BC validator must be on every write path.
- `course/credentials/*.yaml` and `course/syllabi/*.yaml` are author-trusted; no CSP / sanitisation concerns.
- No new SQL injection surfaces -- every raw-SQL fragment in `schema.ts` is composed from constants in `libs/constants/`, not from runtime values.
- The migration script (`migrate-study-plans-to-goals.ts`) reads `study_plan.cert_goals` (text array) and inserts derived rows; it does NOT execute any user-controlled SQL.
