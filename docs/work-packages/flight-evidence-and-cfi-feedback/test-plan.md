---
title: 'Test Plan: Flight evidence and teacher feedback'
product: study
feature: flight-evidence-and-cfi-feedback
type: test-plan
status: draft
review_status: pending
created: 2026-05-04
revised: 2026-05-04
---

## Setup

- Dev DB seeded (`bun run db reset --force`).
- Two test users: Abby (student, `abby@airboss.test`) and an empty test user `instructor@airboss.test` (no roles yet).
- A sample GPX file at `tests/fixtures/flight-tracks/sample.gpx` (~500 points, ~30 minutes).

---

## FE-1: Auto-grant student role on first sign-in

1. Sign in as a brand-new user (no `account_role` rows).
2. Navigate `/study`.
3. **Expected:** `account_role` table has one row: `(user_id, 'student', '{"studying_for": null}')`. `getUserRoles(userId)` returns `{ student: { studying_for: null } }`.

## FE-2: Set studying_for on existing student role

1. As Abby, navigate to a settings UI (or call `setRoleMetadata` directly).
2. Set `studying_for: 'ppl'`.
3. **Expected:** Metadata updated. `getUserRoles(abbyId).student.studying_for === 'ppl'`. Audit row written.

## FE-3: Student logs a flight (happy path)

1. Sign in as Abby.
2. Navigate to `/flight`.
3. Click "Log a flight".
4. Fill: date = today, aircraft = "N5293D", from = "KPAO", to = "KPAO", total time = 60.
5. Click Save.
6. **Expected:** Redirected to `/flight/[id]`; new attempt visible. Audit row written.

## FE-4: Student adds a maneuver (PPL)

1. From a flight detail page, click "Add maneuver".
2. Pick "Short-field takeoff".
3. Form renders fields per `MANEUVER_KINDS.SHORT_FIELD_TO.actualSchema`: rotate speed, obstacle clearance, optional wind.
4. Fill: rotate = 58, clearance = 75, wind = 8 kts at 280.
5. Self-assess "satisfactory", add notes.
6. Click Save.
7. **Expected:** Maneuver appears in the list. Server validates; saves successfully.

## FE-4a: Student adds an IR maneuver

1. From a flight detail page, click "Add maneuver".
2. Pick "ILS approach".
3. Form renders IR-specific fields per the actualSchema (e.g., `gs_tracking_within_dot: bool`, `mda_held_within_50ft: bool`, `partial_panel: bool`).
4. Fill in plausible values.
5. Self-assess + save.
6. **Expected:** Saves cleanly. Confirms ASEL + IR maneuvers both work.

## FE-5: Student adds a maneuver with invalid data

1. Add maneuver "Short-field takeoff".
2. Enter rotate speed = 200 (out of range per Zod min 40 max 80).
3. Submit.
4. **Expected:** Form shows a validation error; row not created.

## FE-6: Student uploads GPS track

1. From an attempt detail, click "Upload track".
2. Pick `sample.gpx`.
3. **Expected:** Upload succeeds. Track viewer renders the polyline on a Leaflet map. `flight_track` row created; `flight_attempt.gps_track_id` set. Bytes appear in the dev cache directory.

## FE-7: Student uploads corrupt file

1. Pick a non-GPS file (e.g., a JPG renamed to .gpx).
2. **Expected:** Upload rejected with a clear error: "Could not parse GPS track. Supported: GPX, CSV with lat,lon,alt,time."

## FE-8: Student edits a maneuver post-teacher-signoff

1. Maneuver has been teacher-signed-off.
2. Student updates the actual metric values.
3. **Expected:** Edit saves. Maneuver row's `updated_at` changes; teacher trio is **not** cleared. Teacher's review UI shows a "post-signoff edit" badge.

## FE-9: Student deletes an attempt

1. From `/flight/[id]`, click "Delete".
2. Confirm dialog; click confirm.
3. **Expected:** Attempt soft-deleted (`deleted_at` set). Maneuvers cascade. Audit row.

## FE-10: Student invites teacher via debrief link

1. From `/flight/[id]`, click "Invite a teacher to review."
2. Enter `instructor@airboss.test` + optional message.
3. Submit.
4. **Expected:** `debrief_invite` row created with token + 14-day expiry. Email sent (visible in dev console transport). Audit row written.

## FE-11: Teacher receives debrief link, never sees "create account"

1. Teacher receives the email.
2. **Expected (email content):** Subject mentions Abby's name and the flight. Body says "[inviter] would like your feedback on a flight" + a CTA. **No mention of "create your account."**
3. Click the link -> magic-link verifies token, signs in (or creates) the teacher's account, lands on `/teach/debrief/[token]`.
4. **Expected (page content):** Header reads "Welcome -- leave feedback below" or similar. **No "create your account," "set a password," "pick a username" text.** The teacher's email is visible top-right (they're authenticated).

## FE-12: Teacher leaves feedback

1. From the debrief page, per maneuver: pick assessment (`satisfactory`, `needs_work`, `unable`), write notes.
2. Click "Save."
3. **Expected:** `setTeacherAssessment` writes the trio (`teacher_assessment`, `teacher_notes`, `teacher_signed_off_by`, `teacher_signed_off_at`) atomically. Audit row.
4. Page shows "Thanks. Your feedback has been sent to Abby."

## FE-13: Teacher account auto-created with teacher role

1. After accepting a debrief invite (FE-11), check `bauth_user` and `account_role`.
2. **Expected:** `bauth_user` row exists for `instructor@airboss.test`. `account_role` has both `student` (auto-granted on first sign-in) and `teacher` (auto-granted on debrief acceptance) rows. Teacher metadata: `{ kind: 'cfi', certificates_verified: false }` (Decision 10). NO `teacher_student_link` row created (Decision 9 -- debrief is one-flight only).

## FE-14: Teacher revisits debrief link after acceptance

1. Same teacher clicks the same `/teach/debrief/[token]` URL again (not via magic link, just direct URL).
2. **Expected:** If signed in: page renders normally (read-only or editable per their existing assessment). If signed out: redirect to a "request a new link" page (token is single-use post-acceptance).

## FE-14a: "Make this regular" promotion (student-side)

1. Abby logs flight, invites teacher, teacher accepts + leaves feedback (FE-10..12).
2. Abby visits `/flight/[id]` after the teacher signoff.
3. **Expected:** "Make [teacher] a regular teacher" CTA visible. Click opens a Dialog with a kind dropdown (default `'cfi'`, options `'cfi' | 'mentor' | 'peer'`).
4. Confirm with kind `'mentor'`.
5. **Expected:** `teacher_student_link` row created with `kind: 'mentor'`, `status: 'active'`. Subsequent flights from Abby appear in this teacher's `/teach/students/[abbyId]` queue without needing new debrief invites.

## FE-14b: "Make this regular" promotion (teacher-side)

1. Teacher leaves feedback on a debrief.
2. Footer on `/teach/debrief/[token]` shows "Want to keep tracking [student] going forward? [Make this a regular relationship]."
3. Click; confirm with default kind `'cfi'`.
4. **Expected:** Same `teacher_student_link` row creation. Either side initiating produces the same outcome.

## FE-14c: Without promotion, teacher can't see other flights

1. Teacher accepts a debrief invite for Flight A; leaves feedback.
2. Abby logs Flight B; teacher tries to navigate to `/teach/students/[abbyId]/attempts/[flightB-id]` directly.
3. **Expected:** 404 / NOT_AUTHORIZED. The accepted debrief grants access to Flight A only. Flight B requires a new debrief invite OR the "Make this regular" promotion to have happened.

## FE-15: Practiced pill counts both self and teacher signoffs

1. As Abby, with one self-assessed-satisfactory maneuver and one teacher-signed-satisfactory maneuver on different leaves.
2. Navigate `/study`.
3. **Expected:** Progress strip "Practiced" pill counts both leaves as covered (`attempts >= 1`) AND mastered (`selfSatisfactory >= 1 OR teacherSatisfactory >= 1`). No credit rule privileges one over the other.

## FE-16: Per-leaf P pill reflects demonstration evidence objectively

1. Leaf A: maneuver with `self_assessment = 'satisfactory'`, no teacher input.
2. Leaf B: maneuver with `teacher_assessment = 'satisfactory'`, no self assessment yet (edge case).
3. Leaf C: maneuver with `self_assessment = 'needs_work'`, no teacher input.
4. **Expected:** Leaf A and Leaf B both render `P:●` (mastered, objective rule). Leaf C renders `P:○` (covered but not mastered).

## FE-17: Teacher revokes / pauses / ends a link

1. Teacher (with active `teacher_student_link` to Abby) ends the link via `/teach/students/[abbyId]`.
2. **Expected:** Link `status` -> `'ended'`, `ended_at` set. Subsequent teacher write attempts on Abby's data: `assertTeacherLink` rejects with NOT_AUTHORIZED. Past assessments persist. Audit row.

## FE-18: Multiple active teacher links

1. Set up Abby with two active `teacher_student_link` rows (two different teachers).
2. Navigate `/study?tab=course`.
3. **Expected:** Course tab shows a dropdown at the top: "Showing: [Teacher A's syllabus] ▾". Choice persists in `study.user_pref` key `study.home.course_teacher_id`.

## FE-19: Teacher reorders lessons via drag

1. Teacher with a teaching syllabus (5 lessons).
2. Drag lesson #5 to position #2.
3. Drop.
4. **Expected:** `reorderLessons` fires with the new order. UI updates immediately. Reload the page; new order persists. One audit row with the full new order array.

## FE-20: Teacher reorders via keyboard

1. Focus a lesson row.
2. Press ↑ to move up.
3. **Expected:** Same as drag; row moves, `reorderLessons` fires.

## FE-21: Course projection seeds from teaching syllabus

1. As Abby with an active teacher link to a teaching syllabus (5 lessons).
2. Navigate to `/study`.
3. Switch map to Course tab.
4. **Expected:** Course tab renders the teacher's syllabus (5 lessons), not the FAR nav course default.

## FE-22: Course projection falls back to FAR nav course

1. As a student with no active teacher link.
2. Navigate to `/study?tab=course`.
3. **Expected:** Course tab renders the FAR navigation course (10 weeks).

## FE-23: GPS track viewer renders maneuver markers

1. From an attempt detail with an uploaded track and 3 maneuvers.
2. **Expected:** Leaflet map renders the polyline. Three markers overlaid at maneuver midpoints. Click a marker -> scrolls to the corresponding maneuver in the list.

## FE-24: Track download is gated on ownership

1. As a different user, attempt to fetch `/api/tracks/[someoneElsesTrackId]`.
2. **Expected:** 403 / 404. Bytes not accessible.

## FE-25: Debrief invite expired

1. Set `expires_at` to a past time on a `debrief_invite` row.
2. Click the magic link.
3. **Expected:** Page renders "This invite has expired. Ask Abby for a new one." No account creation. No assessment write.

## FE-26: Debrief invite revoked before click

1. Student creates a debrief invite.
2. Student clicks "Revoke" before the teacher opens it.
3. Teacher clicks the link.
4. **Expected:** Page renders "This invite has been revoked." No account creation.

## FE-27: Magic link clicked twice

1. Teacher clicks link the first time, accepts.
2. Teacher clicks the same link again from the email.
3. **Expected:** Token is consumed; second click either redirects to the debrief page (if same session) or shows "This link has already been used. Sign in or request a new one."

## FE-28: Existing user + teacher invite

1. User already exists (existing `bauth_user` row, has `student` role).
2. They're invited via debrief link.
3. **Expected:** Magic link signs them in to the existing account. `teacher` role is added. No duplicate user row created.

## FE-29: bun run check

1. From repo root: `bun run check`.
2. **Expected:** 0 errors, 0 warnings.

## FE-30: Vitest suite

1. From repo root: `bun test`.
2. **Expected:** All tests pass, including new tests under `libs/bc/study/src/account-roles.test.ts`, `flight-attempts.test.ts`, `teacher-writes.test.ts`, `debrief-invites.test.ts`, `flight-tracks/parser.test.ts`.

## FE-31: Playwright e2e

1. `bunx playwright test tests/e2e/flight.spec.ts tests/e2e/teach.spec.ts tests/e2e/debrief.spec.ts`.
2. **Expected:** All e2e cases pass. The debrief spec specifically asserts the absence of "create your account" / "set a password" text in the magic-link flow.

## FE-32: Migration applies cleanly

1. From a fresh DB: `bun run db reset --force` then `bun run db push`.
2. **Expected:** All new tables created; all CHECK constraints in place; partial unique indexes enforced. Existing users (if any) get backfilled `account_role` rows.

## FE-33: Audit log integration

1. Perform: flight attempt creation, maneuver add, teacher signoff, syllabus reorder, role grant, debrief invite create + accept.
2. Navigate to `/admin/audit` (hangar).
3. **Expected:** All events appear with correct `target_type`, `op`, `actor`, `metadata` shape. Reorder shows full new order in metadata. Magic-link flow shows two audit rows (user creation + role grant).

## FE-34: Mobile -- /flight list renders

1. Resize browser to 600x900.
2. Land on `/flight`.
3. **Expected:** Attempt list renders readably. New-attempt button accessible. Drill into an attempt; detail page renders with maneuver list stacked vertically.
