---
title: 'Test Plan: Flight evidence and CFI feedback'
product: study
feature: flight-evidence-and-cfi-feedback
type: test-plan
status: draft
review_status: pending
created: 2026-05-04
---

## Setup

- Dev DB seeded (`bun run db reset --force`).
- Two test users: Abby (student, `abby@airboss.test`) and a new CFI user `instructor@airboss.test`.
- Active `cfi_student_link` between instructor and Abby (seed via fixture).
- A teaching syllabus authored by instructor, linked to Abby via the CFI link.
- Sample GPX file in `tests/fixtures/flight-tracks/sample.gpx` (~500 points, ~30 minutes).

---

## FE-1: Student logs a flight (happy path)

1. Sign in as Abby.
2. Navigate to `/flight`.
3. Click "Log a flight".
4. Fill: date = today, aircraft = "N5293D", from = "KPAO", to = "KPAO", total time = 60.
5. Click Save.
6. **Expected:** Redirected to `/flight/[id]`; new attempt visible with the entered details. Audit row written.

## FE-2: Student adds a maneuver

1. From an existing attempt detail page, click "Add maneuver".
2. Pick "Short-field takeoff" from the dropdown.
3. Form renders fields per `MANEUVER_KINDS.SHORT_FIELD_TO.actualSchema`: rotate speed, obstacle clearance, optional wind.
4. Fill: rotate = 58, clearance = 75, wind = 8 kts at 280.
5. Self-assess "satisfactory", add notes.
6. Click Save.
7. **Expected:** Maneuver appears in the list. Server validates against the Zod schema; saves successfully.

## FE-3: Student adds a maneuver with invalid data

1. Add maneuver "Short-field takeoff".
2. Enter rotate speed = 200 (out of range per Zod min 40 max 80).
3. Submit.
4. **Expected:** Form shows a validation error; row not created.

## FE-4: Student uploads GPS track

1. From an attempt detail, click "Upload track".
2. Pick `sample.gpx`.
3. **Expected:** Upload succeeds. Track viewer renders the polyline on a Leaflet map. `flight_track` row created; `flight_attempt.gps_track_id` set. Bytes appear in the dev cache directory.

## FE-5: Student uploads corrupt file

1. Pick a non-GPS file (e.g., a JPG renamed to .gpx).
2. **Expected:** Upload rejected with a clear error: "Could not parse GPS track. Supported: GPX, CSV with lat,lon,alt,time."

## FE-6: Student edits a maneuver post-CFI-signoff

1. Maneuver has been CFI-signed-off.
2. Student updates the actual metric values.
3. **Expected:** Edit saves. Maneuver row's `updated_at` changes; CFI assessment is **not** cleared. CFI's review UI shows a "post-signoff edit" badge.

## FE-7: Student deletes an attempt

1. From `/flight/[id]`, click "Delete".
2. Confirm dialog; click confirm.
3. **Expected:** Attempt soft-deleted (`deleted_at` set). Maneuvers cascade (or also soft-delete; per design.md they cascade-delete on the FK). Audit row written.

## FE-8: CFI sees student attempts

1. Sign in as instructor.
2. Navigate to `/teach/students`.
3. **Expected:** Abby appears as an active student.
4. Click into Abby; see her attempts list.

## FE-9: CFI signs off on a maneuver

1. From `/teach/students/[abbyId]/attempts/[attemptId]`.
2. For each maneuver, pick assessment ("satisfactory" / "needs work" / "unable") + add notes.
3. Click "Sign off".
4. **Expected:** Maneuver's `cfi_assessment`, `cfi_signed_off_by`, `cfi_signed_off_at` set atomically. Audit row.
5. Sign in as Abby; visit `/flight/[id]`. CFI's assessment + notes appear on the maneuver.

## FE-10: CFI without active link cannot sign off

1. Set the link status to `'paused'`.
2. As instructor, attempt to navigate to Abby's attempt review.
3. **Expected:** 403 / redirect; no write surface visible.
4. Direct POST to `setCfiAssessment` with the paused link returns `NOT_AUTHORIZED`.

## FE-11: Practiced pill includes CFI-signed maneuvers

1. As Abby with at least one CFI-signed-satisfactory maneuver.
2. Navigate to `/study`.
3. **Expected:** Progress strip's "Practiced" pill is non-zero (was zero before this maneuver). Per-leaf P pill on the corresponding leaf shows `●`.

## FE-12: Practiced pill ignores self-only maneuvers for "mastered"

1. Maneuver self-assessed satisfactory but not CFI-signed.
2. **Expected:** `coveredLeaves` includes this leaf; `masteredLeaves` does not. Pill on the leaf shows `○` (covered, not mastered) for P.

## FE-13: CFI authors teaching syllabus

1. Sign in as instructor.
2. Navigate to `/teach/syllabus`.
3. Create new syllabus "PPL refresh" with description.
4. Add 5 lessons, each linked to an ACS leaf.
5. **Expected:** Syllabus + 5 `syllabus_node` rows created. `display_order` = 0, 1, 2, 3, 4.

## FE-14: CFI reorders lessons via drag

1. From the teaching syllabus page with 5 lessons.
2. Drag lesson #5 to position #2.
3. Drop.
4. **Expected:** `reorderLessons` fires with the new order. UI updates immediately. Reload the page; new order persists. One audit row with the full new order array.

## FE-15: CFI reorders via keyboard

1. Focus a lesson row.
2. Press ↑ to move up.
3. **Expected:** Same as drag; row moves, `reorderLessons` fires.

## FE-16: Course projection seeds from teaching syllabus

1. As Abby with an active CFI link to instructor's teaching syllabus.
2. Navigate to `/study`.
3. Switch map to Course tab.
4. **Expected:** Course tab renders the instructor's syllabus (5 lessons), not the FAR nav course default.

## FE-17: Course projection falls back to FAR nav course

1. As a student with no active CFI link.
2. Navigate to `/study?tab=course`.
3. **Expected:** Course tab renders the FAR navigation course (10 weeks).

## FE-18: GPS track viewer renders maneuver markers

1. From an attempt detail with an uploaded track and 3 maneuvers.
2. **Expected:** Leaflet map renders the polyline. Three markers overlaid at maneuver midpoints. Click a marker -> scrolls to the corresponding maneuver in the list.

## FE-19: Track download is gated on ownership

1. As a different user, attempt to fetch `/api/tracks/[someoneElsesTrackId]`.
2. **Expected:** 403 / 404. Bytes not accessible.

## FE-20: CFI invite via hangar

1. As instructor, send a hangar invite with `relationship_kind: 'cfi_student_link'`.
2. New user accepts the invite.
3. **Expected:** New user account created, `cfi_student_link` row created in the same transaction with `cfi_user_id = instructor`. Both audit rows written.

## FE-21: Student has multiple CFIs

1. Two CFI users both create a link to Abby.
2. **Expected:** Both links exist. Each CFI sees Abby in their `/teach/students` list. Course projection picks the most-recent active CFI's syllabus (with a switch dropdown for Abby).

## FE-22: bun run check

1. From repo root: `bun run check`.
2. **Expected:** 0 errors, 0 warnings.

## FE-23: Vitest suite

1. From repo root: `bun test`.
2. **Expected:** All tests pass, including new tests under `libs/bc/study/src/flight-attempts.test.ts`, `cfi-writes.test.ts`, `flight-tracks/parser.test.ts`, etc.

## FE-24: Playwright e2e

1. `bunx playwright test tests/e2e/flight.spec.ts tests/e2e/teach.spec.ts`.
2. **Expected:** All e2e cases pass.

## FE-25: Migration applies cleanly

1. From a fresh DB: `bun run db reset --force` then `bun run db push`.
2. **Expected:** All new tables created, all CHECK constraints in place, partial unique index on `cfi_student_link` enforced.

## FE-26: Audit log integration

1. Perform a flight attempt creation, a maneuver add, a CFI signoff, a syllabus reorder.
2. Navigate to `/admin/audit` (hangar).
3. **Expected:** All four events appear with correct `target_type`, `op`, `actor`, and `metadata` shape. Reorder shows the full new order in metadata.
