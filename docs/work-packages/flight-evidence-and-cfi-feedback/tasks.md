---
title: 'Tasks: Flight evidence and teacher feedback'
product: study
feature: flight-evidence-and-cfi-feedback
type: tasks
status: draft
review_status: pending
created: 2026-05-04
revised: 2026-05-04
---

## Pre-flight

- [ ] Read `spec.md` and `design.md` end-to-end.
- [ ] Confirm WP 1 (study-home) is shipped or at least merged. WP 2 depends on:
  - `study.user_pref` table (for the multi-teacher dropdown preference).
  - `getUserPrefs` / `setUserPref` BC.
  - The Practiced pill aggregation that will widen automatically once this WP lands the demonstration partition.
- [ ] Read `libs/bc/study/src/mastery.ts` -- `getNodeEvidenceStateMap` fan-outs; understand where the sixth fan-out lands.
- [ ] Read `libs/constants/src/study.ts` -- `ASSESSMENT_METHODS` enum + the `byEvidenceKind` partition shape.
- [ ] Read `libs/auth/src/auth.ts` and the better-auth plugin config -- understand how to enable the magic-link plugin.
- [ ] Read `libs/auth/src/email/transport.ts` and `templates.ts` -- the email transport this WP uses for debrief invites.
- [ ] Read `libs/bc/hangar/src/invitations.ts` -- existing invite create/accept patterns. The debrief-invite shape is similar but lives in study, not hangar.
- [ ] Read `libs/bc/hangar/src/user-writes.ts` -- existing dual-gate write pattern; teacher writes follow the same shape.
- [ ] Read `libs/db/src/schema/study/syllabus.ts` (or wherever `syllabus` + `syllabus_node` live) -- understand existing columns before adding `display_order` + `author_user_id`.
- [ ] Read `course/regulations/SYLLABUS.md` -- understand the FAR navigation course shape; the teaching syllabus is the same shape.
- [ ] Confirm decisions ratified -- spec.md "Decisions" table has 10 entries; all open questions are decided.
- [ ] Run `bun run check` -- baseline 0 errors before starting.

## Implementation

### 1. Constants

- [ ] Author `MANEUVER_KINDS` in `libs/constants/src/maneuvers.ts` -- closed enum, ~50 ASEL + IR maneuvers per Decision 4. Each entry: `{ label, leafCodes, targetSchema, actualSchema }` with Zod schemas.
- [ ] Add `MANEUVER_KIND_VALUES`, `ASSESSMENT_VALUES`, `TRACK_FORMATS`, `TEACHER_LINK_KINDS`, `TEACHER_LINK_STATUSES`, `ACCOUNT_ROLES`, `STUDENT_STUDYING_FOR_VALUES`.
- [ ] Add `SYLLABUS_KIND_TEACHING = 'teaching'` to existing `SYLLABUS_KINDS`.
- [ ] Add routes: `ROUTES.FLIGHT`, `FLIGHT_NEW`, `FLIGHT_DETAIL(id)`, `FLIGHT_INVITE(id)`, `TEACH`, `TEACH_STUDENTS`, `TEACH_STUDENT_DETAIL(id)`, `TEACH_ATTEMPT_REVIEW(studentId, attemptId)`, `TEACH_SYLLABUS`, `TEACH_DEBRIEF(token)`.
- [ ] Add `AUDIT_TARGETS.{ACCOUNT_ROLE, FLIGHT_ATTEMPT, FLIGHT_MANEUVER, FLIGHT_TRACK, TEACHER_STUDENT_LINK, TEACHING_SYLLABUS, DEBRIEF_INVITE}`.
- [ ] Update `NAV_LABELS` for any new nav surfaces (likely "Flight" and "Teach").
- [ ] `bun run check` -- 0 errors.

### 2. Schema + migration

- [ ] Add `study.account_role` table per design.md.
- [ ] Add `study.flight_attempt`, `study.flight_maneuver`, `study.flight_track` tables.
- [ ] Add `study.teacher_student_link` table (NOT `cfi_student_link`).
- [ ] Add `study.debrief_invite` table.
- [ ] Extend `study.syllabus.kind` CHECK to include `'teaching'`.
- [ ] Add `study.syllabus.author_user_id text references bauth_user.id` (nullable).
- [ ] Add `study.syllabus_node.display_order integer not null default 0`.
- [ ] Generate Drizzle migration; review the SQL for correctness (CHECKs, partial unique indexes, FKs, CASCADEs).
- [ ] Apply via `bun run db push`; verify all tables exist.
- [ ] Backfill `account_role` for existing users: one `(user_id, 'student', '{"studying_for": null}')` row per existing `bauth_user`. Single SQL `INSERT ... SELECT` is enough.
- [ ] `bun run check` -- 0 errors.

### 3. Account roles BC

- [ ] Create `libs/bc/study/src/account-roles.ts`:
  - `getUserRoles`, `hasRole`, `requireStudent`, `requireTeacher`, `grantRole`, `revokeRole`, `setRoleMetadata`.
  - Per-role metadata Zod schemas: `STUDENT_METADATA_SCHEMA = z.object({ studying_for: z.enum(STUDYING_FOR_VALUES).nullable() })`; `TEACHER_METADATA_SCHEMA = z.object({ kind: z.enum(TEACHER_LINK_KINDS), certificates_verified: z.boolean() })`.
  - All writes audit.
- [ ] Vitest unit tests: 8+ cases (no roles, single role, both roles, grant/revoke, soft-end via revoked_at, metadata validation rejection, audit emission, cascade on user delete).
- [ ] `bun run check` -- 0 errors. Run tests.

### 4. Auto-grant student on first sign-in

- [ ] In `apps/study/src/hooks.server.ts` (or first-sign-in detection): on a sign-in where the user has no `account_role` rows, insert `(user_id, 'student', {studying_for: null})`.
- [ ] Idempotent: subsequent sign-ins are no-ops.
- [ ] Vitest test: simulate sign-in, assert role row created.
- [ ] `bun run check` -- 0 errors.

### 5. Maneuver kinds + Zod schemas

- [ ] Populate ~50 entries in `MANEUVER_KINDS` covering ASEL + IR per Decision 4. Reference ACS PA (Private Pilot ASEL) + IR (Instrument Rating) tasks.
- [ ] Add `validateManeuverActuals(kind, actualMetricJson)` helper that picks the schema and validates.
- [ ] Vitest unit: each kind round-trips a sample valid input; rejects invalid; covers PPL + IR maneuvers.
- [ ] `bun run check` -- 0 errors.

### 6. BC reads -- flight evidence

- [ ] Create `libs/bc/study/src/flight-attempts.ts`:
  - `listFlightAttempts`, `getFlightAttempt`, `listManeuversForLeaf`, `listManeuversForNode`, `listAttemptsForTeacher`.
- [ ] Vitest unit per function.
- [ ] `bun run check` -- 0 errors.

### 7. BC reads -- flight tracks + teacher links

- [ ] Create `libs/bc/study/src/flight-tracks/parser.ts` -- pure parser. GPX (XML), CSV (RFC 4180 with `lat,lon,alt,time` columns), ForeFlight CSV, CloudAhoy CSV.
- [ ] Vitest unit per format with fixture files. Reject corrupt input.
- [ ] Create `libs/bc/study/src/flight-tracks/upload.ts` -- impure, writes bytes to cache, inserts row. Tests use a tmp cache root.
- [ ] Create `libs/bc/study/src/flight-tracks.ts` (re-export public surface).
- [ ] Create `libs/bc/study/src/teacher-links.ts`:
  - `listMyTeachers`, `listMyStudents`, `getActiveTeacherLink`, `assertTeacherLink`.
- [ ] Vitest per function.
- [ ] `bun run check` -- 0 errors.

### 8. Extend `getNodeEvidenceStateMap` for demonstration evidence (objective rule)

- [ ] Add the sixth fan-out query in `libs/bc/study/src/mastery.ts` per design.md "No credit rule":
  - Group `flight_maneuver` by `(coalesce(node_id, syllabus_node.node_id), user_id)`.
  - Counts: `attempts`, `selfSatisfactory`, `teacherSatisfactory`.
- [ ] Update `computeDemonstrationGate(state)`:
  - `passing` = rows where `selfSatisfactory >= 1 OR teacherSatisfactory >= 1`. Objective: at least one satisfactory assessment, no matter who made it.
  - `attempts` = total maneuver rows.
- [ ] If a node has no maneuvers AND no scenarios with `'demonstration'` method authored, the gate stays `not_applicable`.
- [ ] Vitest extension: cases for "self only," "teacher only," "both," "neither," "needs_work only."
- [ ] `bun run check` -- 0 errors. Run mastery tests; expect existing tests still pass and new cases pass.

### 9. BC writes -- student-side flight evidence

- [ ] Implement `createFlightAttempt`, `updateFlightAttempt`, `softDeleteFlightAttempt`, `addManeuver`, `updateManeuverSelfAssessment`, `deleteManeuver`. All audit.
- [ ] Each write validates input via Zod.
- [ ] Vitest per write: happy path, validation rejection, authorization (a user can't write to another user's attempt).
- [ ] `bun run check` -- 0 errors. Run tests.

### 10. BC writes -- teacher-side

- [ ] Implement `setTeacherAssessment` -- gates on `assertTeacherLink` (or matching active debrief invite acceptance), validates assessment value, updates the teacher trio atomically.
- [ ] Implement `setTeacherStudentLinkStatus` (teacher pauses / ends a link).
- [ ] Implement `createTeachingSyllabus`, `addLessonToSyllabus`, `removeLessonFromSyllabus`, `reorderLessons`. Each gates on `assertSyllabusAuthor`.
- [ ] `reorderLessons` uses the `UPDATE ... FROM unnest(...)` single-statement pattern from design.md decision 3.
- [ ] Vitest per write: gating, audit emission, idempotency.
- [ ] `bun run check` -- 0 errors. Run tests.

### 11. Better-auth magic-link configuration

- [ ] Enable better-auth magic-link plugin in `libs/auth/src/auth.ts`.
- [ ] Configure: token expiry 14 days, single-use tokens, rate limit per email.
- [ ] Add a `debrief-invite` email template in `libs/auth/src/email/templates.ts`:
  - Subject: `[inviter name] would like your feedback on a flight`.
  - Body: explains the flight (date, aircraft, route) + a "Open feedback" CTA pointing at `/teach/debrief/[token]`.
  - **No mention of "create your account."**
- [ ] Vitest unit: template renders with sample inputs; subject + body shape verified.
- [ ] `bun run check` -- 0 errors.

### 12. Debrief invite BC

- [ ] Create `libs/bc/study/src/debrief-invites.ts`:
  - `createDebriefInvite`: generates token, writes row, sends email via existing transport. Audits. Email-send failure rolls back the row insert (matches hangar invite pattern).
  - `getDebriefInviteByToken`.
  - `acceptDebriefInvite`: per design.md "Debrief invite + magic link" flow. Validates token, signs in or creates user via better-auth magic link, auto-grants `teacher` role with metadata `{ kind: 'cfi', certificates_verified: false }` (Decision 10). Marks invite accepted. Does NOT create a `teacher_student_link` (Decision 9 -- debrief is one-flight only; relationship is opt-in via separate "Make this regular" action).
  - `revokeDebriefInvite`: soft-revoke. Audits.
- [ ] Vitest unit: 10+ cases (create, get, accept-new-user, accept-existing-user, revoke, expired, double-click idempotency, email already revoked, role auto-grant verified).
- [ ] `bun run check` -- 0 errors. Run tests.

### 13. Student surfaces -- /flight

- [ ] Create `apps/study/src/routes/(app)/flight/+page.server.ts` (list) and `+page.svelte`.
- [ ] Create `flight/new/+page.server.ts` and `+page.svelte` (create form).
- [ ] Create `flight/[id]/+page.server.ts` and `+page.svelte` (detail / edit).
- [ ] Per-component files in `flight/[id]/_components/`: `AttemptHeader.svelte`, `ManeuverList.svelte`, `ManeuverForm.svelte` (dynamic by kind), `TrackUpload.svelte`, `TrackViewer.svelte`, `InviteTeacherDialog.svelte`.
- [ ] Track upload form action: read multipart, dispatch to `uploadTrack`.
- [ ] Track viewer: Leaflet (`leaflet` package, MIT). Add as a dep. Server-side renders an empty container; client-side hydrates the map.
- [ ] InviteTeacherDialog: form posts to `?/inviteTeacher` -> `createDebriefInvite`. Confirm dialog shows the email preview before sending.
- [ ] `bun run check` -- 0 errors.

### 14. Teacher surfaces -- /teach

- [ ] Create `apps/study/src/routes/(app)/teach/+page.server.ts` and `+page.svelte` (entry / fallback for non-teachers).
- [ ] Create `teach/students/+page.server.ts` and `+page.svelte` (student list).
- [ ] Create `teach/students/[studentId]/+page.server.ts` and `+page.svelte` (student detail).
- [ ] Create `teach/students/[studentId]/attempts/[attemptId]/+page.server.ts` and `+page.svelte` (attempt review with sign-off form).
- [ ] Create `teach/syllabus/+page.server.ts` and `+page.svelte` (syllabus authoring).
- [ ] `teach/syllabus/_components/LessonList.svelte` -- drag-handle reorder. HTML5 native DnD. Optimistic UI; rollback on error. Keyboard ↑/↓ alternate.
- [ ] Add `requireTeacher` helper guarded route boundary; gate `/teach/students/...` and `/teach/syllabus` on it. `/teach/debrief/[token]` is the public exception.
- [ ] `bun run check` -- 0 errors.

### 15. Public debrief route -- /teach/debrief/[token]

- [ ] Create `apps/study/src/routes/(app)/teach/debrief/[token]/+page.server.ts`:
  - Public-route policy: bypass the auth gate. Document the exception clearly.
  - Loader: `getDebriefInviteByToken(token)`. 404 if not found / accepted by another user / revoked / expired.
  - Magic-link sign-in flow: if the request has an unverified magic-link token, run `auth.api.verifyMagicLink` (or equivalent better-auth call); on success, the request now has a session.
  - Once authenticated: `acceptDebriefInvite({ token, userId })` -> creates user (if new), auto-grants teacher role, optionally creates teacher_student_link, marks invite accepted.
  - Returns: flight data, maneuver list, current teacher feedback (if any).
  - Form action `?/setAssessment`: validates, calls `setTeacherAssessment`.
- [ ] `+page.svelte`:
  - Shows the flight summary, maneuver list with assessment forms, GPS track viewer.
  - **No "create your account" text anywhere.** Header says "Welcome -- leave feedback below."
  - Save button: writes assessments, audits, shows "Thanks. Your feedback has been sent to [inviter]."
  - Footer: "Want to keep tracking [student] going forward? [Make this a regular relationship]." Always renders (per Decision 9, the debrief never auto-creates a link). Click opens a Dialog with a kind dropdown (defaults to `'cfi'` per Decision 10, options `'cfi' | 'mentor' | 'peer'`); submit creates the `teacher_student_link`.
- [ ] `bun run check` -- 0 errors.

### 16. WP 1 surface updates (consume new evidence)

- [ ] Update Flight tile in `apps/study/src/routes/(app)/study/_panels/TilesPanel.svelte`: badge becomes "N flights logged" or "log a flight" depending on state.
- [ ] Verify Practiced pill on the `/study` progress strip now reflects demonstration evidence (no code change expected, just verify -- the pill reads from `mastery.byEvidenceKind` which now includes the new partition).
- [ ] Update Course projection in WP 1's `build-course-tree.ts`: if active student has an active teacher link with a `kind = 'teaching'` syllabus, that becomes the seed source. Multi-teacher behavior: show a dropdown when 2+ active links exist, persist choice in `study.user_pref` key `study.home.course_teacher_id`.
- [ ] Replace `/flight` placeholder banner from WP 1 with the real list page (the placeholder file is deleted as part of step 13).
- [ ] `bun run check` -- 0 errors.

### 17. Constants + audit polish

- [ ] Verify all writes audit per the existing pattern.
- [ ] `bun run db check audit-targets` (or equivalent) -- new targets registered.
- [ ] `bunx biome format --write` over all touched files.

### 18. Tests

- [ ] Run all vitest: `bun test`. Expect green.
- [ ] Add Playwright e2e:
  - `tests/e2e/flight.spec.ts` (student logs flight + adds maneuver + invites teacher)
  - `tests/e2e/teach.spec.ts` (teacher signs off + reorders syllabus)
  - `tests/e2e/debrief.spec.ts` (magic-link flow end-to-end: receive email, click link, leave feedback, never see "create account" prompt)
- [ ] Run Playwright: `bunx playwright test`.

### 19. Polish + docs

- [ ] Update `docs/work/NOW.md` -- move WP 2 from "In flight" to "Just shipped" stub.
- [ ] Add maneuver-kinds doc listing all ~50 supported kinds with their leaf codes.
- [ ] Update `docs/decisions/016-cert-syllabus-goal-model/decision.md` with a note that `kind = 'teaching'` is now a recognized syllabus kind.
- [ ] Manual smoke pass per `test-plan.md`.

## Post-implementation

- [ ] Full manual test per `test-plan.md`.
- [ ] All decisions ratified upfront; no open-question resolution needed at ship time.
- [ ] Request review (`/ball-review-full`).
- [ ] Apply review fixes.
- [ ] Re-run `bun run check`, all tests.
- [ ] PR per project workflow.
