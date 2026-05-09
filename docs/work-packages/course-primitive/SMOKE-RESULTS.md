---
title: 'Smoke Results: Course Primitive'
product: study
feature: course-primitive
type: smoke-results
status: unread
---

# Smoke Results: Course Primitive

Acceptance run for [test-plan.md](./test-plan.md) against the Phase 6 smoke fixture (`course/courses/_fixtures/seed-smoke/`) plus the Phase 7 diagnostic.

Date: 2026-05-08
Git SHA (parent): ee858246085aa8e04982583d8a12ea7c2aac7c0f (feat(course-primitive): Phase 6)
Branch: worktree-agent-a483a4d851a3fce8b
DB: airboss_wt_worktree_agent_a483a4d851a3fce8b (per-worktree dev seed)

Scenarios run: CRS-10 through CRS-18, CRS-20, CRS-21. CRS-30+ depend on Phase 5 lens code (in flight in parallel) and are deferred to a follow-on smoke pass.

## Summary

| Result  | Count | Scenarios                                      |
| ------- | ----- | ---------------------------------------------- |
| PASS    | 11    | CRS-10, 11, 12, 13, 14, 15, 16, 17, 18, 20, 21 |
| GAP     | 0     | -                                              |
| BLOCKER | 0     | -                                              |

CRS-16 and CRS-17 originally surfaced as GAP rows in the Phase 7 acceptance pass: both bad inputs were correctly rejected with no DB writes, but the rejection string came from Zod (`steps.0.knowledge_node_id: Required` / `Unrecognized key(s) in object: 'knowledge_node_id'`) instead of the spec's verbatim seed-handler messages. Resolved in the follow-up commit by loosening the Zod step + section schemas so the seed handler in `scripts/db/seed-courses.ts` owns the `knowledge_node_id` placement semantic. Both scenarios now emit the spec-verbatim strings -- see CRS-16 and CRS-17 below.

## Seed pipeline

### CRS-10: seed against smoke fixture creates expected rows

- Result: PASS
- Command: `bun run db seed courses --dir course/courses/_fixtures`
- Output: `seed-courses: 1 scanned (1 written, 0 unchanged), 3 step rows scanned (3 written, 0 unchanged)`
- DB verification:

  ```text
  -- study.course
       slug    |    kind    | status |           title
  ------------+------------+--------+---------------------------
   seed-smoke | instructor | active | Seed-Smoke Course Fixture

  -- study.course_step
    level  | code |                        title                         | has_no_node
  ---------+------+------------------------------------------------------+-------------
   section | s1   | Airmass Character (smoke fixture)                    | t
   step    | s1.1 | Thunderstorm hazards                                 | f
   step    | s1.2 | Transition - thunderstorm hazards to icing avoidance | f
  ```

- Matches expected: one section row (`has_no_node=true`), two step rows (`has_no_node=false`), one course row with `kind='instructor'`, `status='active'`, manifest title.

### CRS-11: idempotent seed (no writes on unchanged YAML)

- Result: PASS
- Procedure: ran `bun run db seed courses --dir course/courses/_fixtures` immediately after CRS-10.
- Output: `seed-courses: 1 scanned (0 written, 1 unchanged), 3 step rows scanned (0 written, 3 unchanged)`
- Zero `course` writes, zero `course_step` writes on the second run.

### CRS-12: content_hash drives single-row update

- Result: PASS
- Procedure:
  1. Captured baseline `updated_at` for all three step rows.
  2. Edited `s1.1`'s `body_md` (appended ` (CRS-12 hash-bump)`).
  3. Re-ran `bun run db seed courses --dir course/courses/_fixtures`.
  4. Output: `seed-courses: 1 scanned (0 written, 1 unchanged), 3 step rows scanned (1 written, 2 unchanged)`.
  5. `updated_at`: `s1.1` advanced to `2026-05-09 01:40:39.193+00`; `s1` and `s1.2` unchanged at their original timestamps.
  6. Reverted YAML; re-seeded; observed exactly one row updated again (back to original content).

### CRS-13: validator rejects dangling knowledge_node reference

- Result: PASS
- Fixture: `/tmp/crs-scratch/crs13/dangling-fk/` with one step pointing at `wx-does-not-exist`.
- Output: `seed-courses: course step 'dangling-fk.s1.1' references missing knowledge_node 'wx-does-not-exist'`
- Exit code: non-zero. No partial writes (`SELECT slug FROM study.course WHERE slug='dangling-fk'` returns 0 rows).
- Matches spec rejection message verbatim.

### CRS-14: validator rejects duplicate ordinal

- Result: PASS
- Fixture: two steps under section `s1` both with `ordinal: 1`.
- Output: `seed-courses: duplicate ordinal in section 'dup-ordinal.s1' steps`
- Matches spec rejection message verbatim.

### CRS-15: validator rejects duplicate code

- Result: PASS
- Fixture: two steps both with `code: s1.1`.
- Output: `seed-courses: duplicate code 's1.1' in course 'dup-code'`
- Matches spec rejection message verbatim.

### CRS-16: validator rejects step missing knowledge_node_id

- Result: PASS (resolved in follow-up commit)
- Fixture: smoke fixture's `s1.1` step with the `knowledge_node_id` field removed.
- Output: `seed-courses: step 'seed-smoke.s1.1' must carry knowledge_node_id`
- Exit code: non-zero. No partial writes (idempotent re-run on the unmodified fixture afterwards reports 0 written, 1/3 unchanged).
- Matches spec rejection message verbatim. The fix loosened `courseStepSchema.knowledge_node_id` to `.optional()` so the seed handler's friendlier check (`scripts/db/seed-courses.ts`, in `validateCourseTree` and at the upsert call site) fires instead of Zod's generic "Required" message.

### CRS-17: validator rejects section carrying knowledge_node_id

- Result: PASS (resolved in follow-up commit)
- Fixture: smoke fixture's `s1` section with a `knowledge_node_id: wx-thunderstorm-hazards` field added.
- Output: `seed-courses: section 'seed-smoke.s1' must not carry knowledge_node_id`
- Exit code: non-zero. No partial writes.
- Matches spec rejection message verbatim. The fix added `knowledge_node_id: z.string().min(1).optional()` to `courseSectionSchema` (preserving `.strict()` so genuinely unknown keys still reject early) so the seed handler's friendlier `validateCourseTree` check at `scripts/db/seed-courses.ts` fires instead of Zod's generic "Unrecognized key" message.

### CRS-18: kind='personal' rejected as reserved

- Result: PASS
- Fixture: course manifest with `kind: personal`.
- Output: `seed-courses: course kind 'personal' is reserved; authoring deferred`
- Matches spec rejection message verbatim. (Note: the Zod manifest schema accepts `personal` because it lives in `COURSE_KIND_VALUES`; the reserved-message check fires from the seed handler as the spec expects.)

## Diagnostic

### CRS-20: school/personal syllabi diagnostic reports zero rows

- Result: PASS
- Command: `bun run db diagnose:school-personal-syllabi`
- Output: `0 row(s) found with kind IN ('school','personal').`
- Exit code: 0.

### CRS-21: diagnostic surfaces planted school row

- Result: PASS
- Procedure:
  1. `INSERT INTO study.syllabus (id, slug, kind, title, edition) VALUES ('syl_diag_test', 'diag-test', 'school', 'Diag Test', '2026-01');`
  2. `bun run db diagnose:school-personal-syllabi`
  3. Output:

     ```text
     1 row(s) found with kind IN ('school','personal'):
     syl_diag_test | diag-test | school | Diag Test | 2026-01 | 2026-05-09T01:38:34.801Z
     ```

  4. Exit code: 0.
  5. Cleanup: `DELETE FROM study.syllabus WHERE id='syl_diag_test';`. Re-ran diagnostic; back to `0 row(s) found...`.

## Not run in this pass

CRS-1..CRS-6 (schema), CRS-30..CRS-32 (`getGoalNodeUnion`), CRS-40..CRS-43 (`courseLens`), CRS-50..CRS-53 (`courseWithCertOverlayLens`), CRS-60..CRS-61 (`knowledge_node.kind`), CRS-70..CRS-75 (edge cases) were not part of the Phase 7 acceptance scope -- they cover Phases 2-5 and the post-implementation manual sweep. CRS-30+ specifically depend on the Phase 5 lens code (in flight in parallel).
