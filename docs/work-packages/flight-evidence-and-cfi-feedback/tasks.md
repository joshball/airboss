---
title: 'Tasks: Flight evidence and CFI feedback'
product: study
feature: flight-evidence-and-cfi-feedback
type: tasks
status: draft
review_status: pending
created: 2026-05-04
---

## Pre-flight

- [ ] Read `spec.md` and `design.md` end-to-end.
- [ ] Confirm WP 1 (study-home) is shipped or at least merged -- this WP fills the Flight tile WP 1 stubs.
- [ ] Read `libs/bc/study/src/mastery.ts` -- `getNodeEvidenceStateMap` fan-outs; understand where the sixth fan-out lands.
- [ ] Read `libs/constants/src/study.ts` -- `ASSESSMENT_METHODS` enum + the `byEvidenceKind` partition shape.
- [ ] Read `libs/bc/hangar/src/invitations.ts` -- existing invite create / accept; understand the extension point for `relationship_kind`.
- [ ] Read `libs/bc/hangar/src/user-writes.ts` -- existing dual-gate write pattern; `setCfiAssessment` mirrors it.
- [ ] Read `libs/db/src/schema/study/syllabus.ts` (or wherever `syllabus` + `syllabus_node` live) -- understand existing columns, before adding `display_order` + `author_user_id`.
- [ ] Read `course/regulations/SYLLABUS.md` -- understand the FAR navigation course shape; the CFI's teaching syllabus is the same shape.
- [ ] Confirm open questions answered: CFI surface location, credit rule, GPS track storage path for v1.
- [ ] Run `bun run check` -- baseline 0 errors before starting.

## Implementation

### 1. Constants

- [ ] Add `MANEUVER_KINDS` to `libs/constants/src/study.ts` -- closed enum with metadata per kind: `label`, `leafCodes`, `targetSchema`, `actualSchema`. Start with ~30 ASEL maneuvers (short field, soft field, slow flight, stalls, steep turns, ground reference, emergency descent, etc.).
- [ ] Add `MANEUVER_KIND_VALUES` (string array of keys).
- [ ] Add `SELF_ASSESSMENTS` and `CFI_ASSESSMENTS` (both `['satisfactory', 'needs_work', 'unable']` -- consider one shared enum if they truly never diverge).
- [ ] Add `TRACK_FORMATS = ['gpx', 'csv', 'foreflight_csv', 'cloudahoy_csv']`.
- [ ] Add `CFI_STUDENT_LINK_STATUSES = ['active', 'paused', 'ended']`.
- [ ] Add `SYLLABUS_KIND_TEACHING = 'teaching'` and add it to the existing `SYLLABUS_KINDS`.
- [ ] Add routes: `ROUTES.FLIGHT`, `FLIGHT_NEW`, `FLIGHT_DETAIL(id)`, `TEACH_STUDENTS`, `TEACH_STUDENT_DETAIL(id)`, `TEACH_ATTEMPT_REVIEW(studentId, attemptId)`, `TEACH_SYLLABUS`.
- [ ] Add `AUDIT_TARGETS.{FLIGHT_ATTEMPT, FLIGHT_MANEUVER, FLIGHT_TRACK, CFI_STUDENT_LINK, TEACHING_SYLLABUS}`.
- [ ] `bun run check` -- 0 errors.

### 2. Schema + migration

- [ ] Add `flight_attempt`, `flight_maneuver`, `flight_track`, `cfi_student_link` tables in `libs/db/src/schema/study/flight.ts` per design.md.
- [ ] Extend `syllabus.kind` CHECK to include `'teaching'`.
- [ ] Add `syllabus.author_user_id text references bauth_user.id` (nullable).
- [ ] Add `syllabus_node.display_order integer not null default 0`.
- [ ] Extend `hangar.invitation` with `relationship_kind text` and `relationship_payload_json jsonb`.
- [ ] Generate Drizzle migration (`bun run db generate`); review the SQL for correctness (CHECKs, partial unique indexes, FKs).
- [ ] Apply via `bun run db push`; verify tables exist.
- [ ] `bun run check` -- 0 errors.

### 3. Maneuver kinds + zod schemas

- [ ] In `libs/constants/src/study.ts`, populate ~30 `MANEUVER_KINDS` entries with their `targetSchema` and `actualSchema` (Zod). Reference ACS PA.IV (Takeoffs, Landings, Go-Arounds), PA.V (Performance Maneuvers), PA.VII (Slow Flight & Stalls), PA.VIII (Basic Instruments), PA.IX (Emergency Operations).
- [ ] Add `validateManeuverActuals(kind, actualMetricJson)` helper that picks the schema and validates.
- [ ] Vitest unit: each kind round-trips a sample valid input; rejects invalid.
- [ ] `bun run check` -- 0 errors. Run the new tests.

### 4. BC reads -- flight attempts

- [ ] Create `libs/bc/study/src/flight-attempts.ts`.
- [ ] Implement `listFlightAttempts`, `getFlightAttempt`, `listManeuversForLeaf`, `listManeuversForNode`, `listAttemptsForCfi`.
- [ ] Vitest unit per function: empty / single / multi-row / authorization.
- [ ] `bun run check` -- 0 errors. Run tests.

### 5. BC reads -- flight tracks + CFI links

- [ ] Create `libs/bc/study/src/flight-tracks/parser.ts` -- pure parser. GPX (XML), CSV (RFC 4180 with `lat,lon,alt,time` columns), ForeFlight CSV (named columns), CloudAhoy CSV (named columns). Each format dispatches to a specific decoder.
- [ ] Vitest unit: fixture file per format, parse round-trip. Test corruption rejection.
- [ ] Create `libs/bc/study/src/flight-tracks/upload.ts` -- impure, writes bytes to cache, inserts row. Unit tests use a tmp cache root.
- [ ] Create `libs/bc/study/src/flight-tracks.ts` (re-export the public surface).
- [ ] Create `libs/bc/study/src/cfi-links.ts` with `listMyCfis`, `listMyStudents`, `getActiveCfiLink`, `assertCfiLink`.
- [ ] Vitest unit per function.
- [ ] `bun run check` -- 0 errors. Run tests.

### 6. Extend `getNodeEvidenceStateMap` for demonstration evidence

- [ ] Add the sixth fan-out query in `libs/bc/study/src/mastery.ts`: group `flight_maneuver` by `(node_id ?? syllabus_node.node_id, user_id)`, count attempts and signed-off-satisfactory.
- [ ] Update `computeDemonstrationGate(state)` to consume the new partition: `passing` = sign-off-satisfactory count, `attempts` = total maneuver count for that node.
- [ ] If a node has no maneuvers logged AND no scenarios with `'demonstration'` method authored, the gate stays `not_applicable`.
- [ ] Vitest extension to existing `mastery.test.ts`: cases for "demonstration evidence present", "self-assessed only", "CFI-signed satisfactory", "CFI-signed needs-work".
- [ ] `bun run check` -- 0 errors. Run mastery tests; expect existing tests still pass and new cases pass.

### 7. BC writes -- student-side

- [ ] Implement `createFlightAttempt`, `updateFlightAttempt`, `softDeleteFlightAttempt`, `addManeuver`, `updateManeuverSelfAssessment`, `deleteManeuver`. All audit.
- [ ] Each write validates input via Zod (use the schemas from step 3 for maneuver actuals).
- [ ] Vitest per write: happy path, validation rejection, authorization (a user can't write to another user's attempt).
- [ ] `bun run check` -- 0 errors. Run tests.

### 8. BC writes -- CFI-side

- [ ] Implement `setCfiAssessment` -- gates on `assertCfiLink`, validates assessment value, updates the row + the `cfiSignedOff*` trio atomically.
- [ ] Implement `setStudentLinkStatus` (CFI ends / pauses link).
- [ ] Implement `createTeachingSyllabus`, `addLessonToSyllabus`, `removeLessonFromSyllabus`, `reorderLessons`. Each gates on `assertSyllabusAuthor`.
- [ ] `reorderLessons` uses the `UPDATE ... FROM unnest(...)` pattern from design.md for atomic single-statement reorder.
- [ ] Vitest per write: gating, audit emission, idempotency (re-applying same order is a no-op).
- [ ] `bun run check` -- 0 errors. Run tests.

### 9. Extend hangar invite flow

- [ ] Update `hangar.invitation` create flow to accept optional `relationship_kind` + `relationship_payload_json`.
- [ ] Update `acceptInvitation` to handle `relationship_kind = 'cfi_student_link'`: create the link in the same transaction.
- [ ] Vitest unit: invite flow with cfi link creates link on accept.
- [ ] `bun run check` -- 0 errors.

### 10. Student surfaces

- [ ] Create `apps/study/src/routes/(app)/flight/+page.server.ts` (list) and `+page.svelte`.
- [ ] Create `flight/new/+page.server.ts` and `+page.svelte`.
- [ ] Create `flight/[id]/+page.server.ts` and `+page.svelte` (detail / edit).
- [ ] Create per-component files in `flight/[id]/_components/`: `AttemptHeader.svelte`, `ManeuverList.svelte`, `ManeuverForm.svelte` (dynamic by kind), `TrackUpload.svelte`, `TrackViewer.svelte`.
- [ ] Track upload form action: read multipart, dispatch to `uploadTrack`.
- [ ] Track viewer: Leaflet (`leaflet` package, MIT). Add as a dep. Server-side render an empty container; client-side hydrate the map.
- [ ] `bun run check` -- 0 errors.

### 11. CFI surfaces

- [ ] Create `apps/study/src/routes/(app)/teach/students/+page.server.ts` and `+page.svelte`.
- [ ] Create `teach/students/[studentId]/+page.server.ts` and `+page.svelte` (student detail).
- [ ] Create `teach/students/[studentId]/attempts/[attemptId]/+page.server.ts` and `+page.svelte` (attempt review with sign-off form).
- [ ] Create `teach/syllabus/+page.server.ts` and `+page.svelte` (syllabus authoring).
- [ ] `teach/syllabus/_components/LessonList.svelte` -- drag-handle reorder. HTML5 native DnD. Optimistic UI; rollback on error.
- [ ] Add `requireCfi` helper in `apps/study/src/lib/server/auth.ts` (or wherever `requireUser` lives) and gate `/teach/...` routes on it.
- [ ] `bun run check` -- 0 errors.

### 12. WP 1 surface updates (consume new evidence)

- [ ] Update Flight tile in `apps/study/src/routes/(app)/study/_panels/TilesPanel.svelte`: badge becomes "N attempts pending CFI" or "log a flight" depending on state.
- [ ] Verify Practiced pill on the `/study` progress strip now reflects demonstration evidence (no code change expected, just verify -- the pill reads from `mastery.byEvidenceKind` which now includes the new partition).
- [ ] Update Course projection in WP 1's `build-course-tree.ts`: if active student has an active CFI link with a teaching syllabus, that becomes the seed source. Falls back to FAR nav course otherwise.
- [ ] Replace `/flight` placeholder banner from WP 1 with the real list page (the placeholder file is deleted as part of step 10).
- [ ] `bun run check` -- 0 errors.

### 13. Constants + audit polish

- [ ] Verify all writes audit per the existing pattern.
- [ ] `bun run db check audit-targets` (or equivalent) -- new targets registered.
- [ ] `bunx biome format --write` over all touched files.

### 14. Tests

- [ ] Run all vitest: `bun test`. Expect green.
- [ ] Add Playwright e2e: `tests/e2e/flight.spec.ts` (student logs flight + adds maneuver), `tests/e2e/teach.spec.ts` (CFI signs off + reorders syllabus).
- [ ] Run Playwright: `bunx playwright test`.

### 15. Polish + docs

- [ ] Update `docs/work/NOW.md` -- move WP 2 from "In flight" to "Just shipped" stub.
- [ ] Add a section to the maneuver-kinds documentation listing all ~30 supported kinds with their leaf codes.
- [ ] Manual smoke pass per `test-plan.md`.

## Post-implementation

- [ ] Full manual test per `test-plan.md`.
- [ ] Request review (`/ball-review-full`).
- [ ] Apply review fixes.
- [ ] Re-run `bun run check`, all tests.
- [ ] PR per project workflow (`/qs` or `/ship`).
