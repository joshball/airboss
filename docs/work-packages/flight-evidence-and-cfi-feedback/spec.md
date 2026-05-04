---
title: 'Spec: Flight evidence and teacher feedback'
product: study
feature: flight-evidence-and-cfi-feedback
type: spec
status: draft
review_status: pending
created: 2026-05-04
revised: 2026-05-04
---

Add real-flight evidence to airboss alongside a lightweight teacher-feedback layer. A user logs a flight + maneuvers + optional GPS track. Optionally a teacher (CFI, mentor, peer) reviews and comments. The system tracks data; it does not gate. The Practiced pill on `/study` aggregates objectively across self-assessed and teacher-reviewed maneuvers. Teachers can engage frictionlessly via a magic-link debrief flow (no formal "create account" prompt) and, if they want, author their own teaching syllabus with drag-handle reordering.

This is WP 2 of a three-WP arc. WP 1 is [study-home](../study-home/spec.md). WP 3 is [node-render-modes](../node-render-modes/spec.md).

## Why this WP exists

Today the system has zero in-plane evidence. The `ASSESSMENT_METHODS.DEMONSTRATION` slot exists in the schema for exactly this purpose but no surfaces, no storage, no rollups exist.

Three things this WP closes:

1. **Flight maneuver attempts.** A user logs a flight + per-maneuver numbers (rotate speed, obstacle clearance, touchdown distance, wind component) + optional GPS track. Each maneuver maps to one or more knowledge nodes / ACS leaves.
2. **GPS track ingest, vendor-agnostic.** GPX, CSV with `lat,lon,alt,time`, ForeFlight CSV, CloudAhoy CSV. The bytes live in the dev cache (per ADR 018); the row is metadata.
3. **Teacher feedback, no formal account required.** A teacher (CFI / mentor / peer) gets a magic-link to debrief a specific flight. They land on the flight, leave per-maneuver assessments + notes, save. The system creates a real account behind the scenes (better-auth magic link), but the teacher never sees a "sign up" prompt. Subsequent invites resolve to the same account; their history persists.

The Practiced pill **aggregates objectively** -- attempts logged, self-assessed satisfactory, teacher-signed satisfactory. Each is a number. There is no "credit rule" that gates "mastered" behind a teacher signoff. The user (and any teacher they engage) interprets the data; the system tracks it.

## Anchors

- [study-home](../study-home/spec.md) -- WP 1, the surface that consumes this WP's data.
- [hangar-invite-flow](../hangar-invite-flow/spec.md) -- the existing email-invite mechanism. The magic-link debrief flow extends it.
- [decision-016](../../decisions/016-cert-syllabus-goal-model/decision.md) -- syllabus / leaf model; this WP adds `syllabus.kind = 'teaching'`.
- [decision-018](../../decisions/018-source-artifact-storage-policy/decision.md) -- developer-local cache for derivative bytes; GPS tracks ride this convention.
- `libs/constants/src/study.ts` -- `ASSESSMENT_METHODS.DEMONSTRATION` already defined; this WP lights it up.
- `libs/bc/study/src/mastery.ts` -- `getNodeEvidenceStateMap` partitions per `AssessmentMethod`; we add a sixth fan-out for `flight_maneuver`.
- `libs/auth/src/schema.ts` -- `bauth_user`. better-auth provides magic-link email auth; we configure that capability.
- WP 1's `study.user_pref` table -- reused for any teacher-side preferences.

## Decisions (formerly open questions, ratified 2026-05-04)

| # | Question                              | Decision                                                                                                                                                                                                |
| - | ------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1 | Teacher surface location              | Under study at `/teach/...`. Not a new app; not under hangar. Promote to `apps/teach/` only when teacher features grow.                                                                                |
| 2 | Practiced credit rule                 | **No credit rule.** Self-assessed and teacher-signed are tracked as independent counts; mastery rolls up objectively (attempts + outcomes). The teacher is the gate; we are the tracker.                |
| 3 | GPS track production storage          | Dev-local cache for v1. Cloud-storage adapter follows when second user uploads.                                                                                                                          |
| 4 | Maneuver kinds scope                  | ASEL + IR (~50 kinds). Covers PPL refresh + IR refresh -- the user's near-term cert goals.                                                                                                              |
| 5 | Reorder transaction shape             | Single transaction `UPDATE ... FROM unnest(...)`. One audit row.                                                                                                                                         |
| 6 | Roles architecture                    | New `study.account_role` join table. Roles `student` and `teacher`. Auto-grant `student` on first sign-in. Per-role metadata in jsonb. Ready for future billing / certificate-verification without schema change. |
| 7 | Multi-teacher Course tab on `/study`  | Most-recently-active teacher's syllabus by default. Dropdown auto-appears when student has 2+ active teacher links. Stored in WP 1's `study.user_pref`.                                                  |

Three open questions remain (the magic-link debrief flow specifics) -- see "Open questions" at end of spec.

Two follow-on entries captured in `docs/platform/IDEAS.md`:

- **ADS-B / GPS auto-grading** -- automatic maneuver detection + envelope grading from GPS tracks. Future enhancement after WP 2 ships and the user has tracks ingested.
- **Flightbag render modes** -- Learn / Review / Memorize for handbook sections. Future, separate from WP 3's knowledge-node version.

## In scope

### Roles infrastructure

#### `study.account_role` table

```sql
CREATE TABLE study.account_role (
  user_id     text NOT NULL REFERENCES bauth_user(id) ON DELETE CASCADE,
  role        text NOT NULL,                       -- 'student' | 'teacher' (v1)
  metadata    jsonb NOT NULL DEFAULT '{}',         -- per-role data
  granted_at  timestamp NOT NULL DEFAULT now(),
  revoked_at  timestamp,                           -- soft-end; preserves history
  PRIMARY KEY (user_id, role)
);

CREATE INDEX account_role_role_idx ON study.account_role (role);
```

`metadata` v1:

- `student`: `{ "studying_for": "ppl" | "ir" | "cfi" | "atp" | null }`. Nullable -- user is a student but isn't actively pursuing a cert (just here to read).
- `teacher`: `{ "kind": "cfi" | "mentor" | "peer", "certificates_verified": false }`. Default kind on auto-create from a debrief invite is `'cfi'` (TBD -- see open questions).

A user can hold both roles simultaneously. Soft-end via `revoked_at IS NOT NULL` preserves history; "active" = `revoked_at IS NULL`.

#### Auto-grant `student` on first sign-in

In `apps/study/src/hooks.server.ts` (or first-sign-in detection elsewhere): on a sign-in where the user has no `account_role` rows, insert `(user_id, 'student', {studying_for: null})`. One row per first-time user.

#### Helpers in `libs/bc/study/src/account-roles.ts`

- `getUserRoles(userId, db?) -> { student?: StudentMeta; teacher?: TeacherMeta }`
- `hasRole(userId, role, db?) -> boolean`
- `requireStudent(userId, db?)` / `requireTeacher(userId, db?)` -- throw `NOT_AUTHORIZED` if missing.
- `grantRole(userId, role, metadata, db?)` -- audit-emitting upsert.
- `revokeRole(userId, role, db?)` -- soft-end via `revoked_at = now()`. Audit.
- `setRoleMetadata(userId, role, metadata, db?)` -- partial-merge into existing metadata. Audit.

### Data model -- flight evidence

#### `study.flight_attempt`

A single flight session.

- `id` text PK, prefix `fa_`
- `user_id` text NOT NULL FK -> `bauth_user`
- `flight_date` date NOT NULL
- `aircraft_ident` text NOT NULL -- e.g. "N5293D"
- `aircraft_type` text -- e.g. "C172S"; optional
- `from_icao` text -- optional
- `to_icao` text -- optional
- `total_time_minutes` integer -- optional
- `notes` text
- `gps_track_id` text FK -> `study.flight_track`, nullable
- `deleted_at` timestamp -- soft-delete
- `created_at`, `updated_at` timestamps

Index: `(user_id, flight_date DESC)`.

#### `study.flight_maneuver`

A single maneuver attempt within a flight.

- `id` text PK, prefix `fm_`
- `flight_attempt_id` text NOT NULL FK -> `study.flight_attempt` ON DELETE CASCADE
- `user_id` text NOT NULL FK -> `bauth_user` (denormalized for fast leaf-rollup queries)
- `node_id` text FK -> `knowledge_node`, nullable
- `syllabus_node_id` text FK -> `syllabus_node`, nullable
- `kind` text NOT NULL CHECK in `MANEUVER_KINDS`
- `attempts_made` integer NOT NULL default 1
- `target_metric_json` jsonb default `{}` -- maneuver-specific target shape (Zod schema lookup by `kind`)
- `actual_metric_json` jsonb default `{}` -- what the user logged
- `self_assessment` text NOT NULL CHECK in `ASSESSMENT_VALUES` -- `'satisfactory'` / `'needs_work'` / `'unable'`
- `student_notes` text -- per-maneuver notes from the user
- `teacher_assessment` text CHECK in `ASSESSMENT_VALUES`, nullable
- `teacher_notes` text, nullable
- `teacher_signed_off_by` text FK -> `bauth_user`, nullable
- `teacher_signed_off_at` timestamp, nullable
- `created_at`, `updated_at` timestamps

CHECK constraints:

- At least one of `node_id` or `syllabus_node_id` must be set.
- Teacher trio is all-or-nothing: `teacher_assessment IS NULL <=> teacher_signed_off_by IS NULL <=> teacher_signed_off_at IS NULL`.

Indexes:

- `(flight_attempt_id)`
- `(syllabus_node_id, user_id)` -- leaf rollup
- `(node_id, user_id)` -- node rollup

**Field naming note:** "teacher" not "cfi" because the teacher might be a mentor or peer, not a certificated instructor. The `kind` lives on the role row, not on every assessment. A maneuver row records "a teacher reviewed this," not "a CFI signed off"; whether that teacher is a CFI is metadata of their role.

#### `study.flight_track`

GPS track artifact. Bytes live in the dev cache; row is metadata.

- `id` text PK, prefix `ft_`
- `user_id` text NOT NULL FK -> `bauth_user`
- `format` text NOT NULL CHECK in `TRACK_FORMATS`
- `cache_path` text NOT NULL -- relative to cache root (`AIRBOSS_HANDBOOK_CACHE` env var; default `~/Documents/airboss-handbook-cache/flight-tracks/<userId>/<id>.<ext>`)
- `byte_size` integer NOT NULL
- `point_count` integer NOT NULL
- `start_time`, `end_time` timestamps
- `bbox_json` jsonb -- `{ "n": ..., "s": ..., "e": ..., "w": ... }`
- `created_at` timestamp

#### `study.teacher_student_link`

Teacher / student edge. Replaces what was originally called `cfi_student_link`.

- `id` text PK, prefix `tsl_`
- `teacher_user_id` text NOT NULL FK -> `bauth_user`
- `student_user_id` text NOT NULL FK -> `bauth_user`
- `kind` text NOT NULL CHECK in `TEACHER_LINK_KINDS` -- `'cfi'` / `'mentor'` / `'peer'`
- `status` text NOT NULL CHECK in `TEACHER_LINK_STATUSES` -- `'active'` / `'paused'` / `'ended'`
- `started_at` timestamp NOT NULL DEFAULT now()
- `ended_at` timestamp
- `teacher_notes` text -- private to the teacher
- `created_at`, `updated_at` timestamps

UNIQUE partial index on `(teacher_user_id, student_user_id)` WHERE `status = 'active'`.

A student can have multiple active teachers (e.g., one CFI + one peer-study-partner). Each link is independent.

#### `study.debrief_invite`

Single-flight magic-link grant. Lets a teacher engage with one flight without setting up a relationship.

> **TODO Q-DEBRIEF-1 (pending user answer): magic-link account creation shape.**
> User has confirmed: "we will create an account, just don't want them to have to say 'create account' we will have an email from the link." Implementation choice: better-auth magic-link creates a real `bauth_user` row on first link click; the teacher never sees a sign-up form. The phrase "create your account" never appears; the email says "Joshua wants your feedback on his short-field landing today" and the page says "Welcome -- leave feedback below."
>
> What's still open: does accepting a debrief invite **also** auto-create a `teacher_student_link` (i.e., implicitly start an ongoing relationship), or does the debrief stand alone and the relationship is opt-in?
>
> Recommended (subject to user confirmation): **stand alone in v1.** A debrief invite gives access to **one specific flight**; subsequent flights need new invites. The teacher upgrades to "ongoing teacher" via an explicit "Make this regular" action (either side initiates). Magic links stay genuinely lightweight.

```sql
CREATE TABLE study.debrief_invite (
  id                     text PRIMARY KEY,                       -- prefix 'dbi_'
  flight_attempt_id      text NOT NULL REFERENCES study.flight_attempt(id) ON DELETE CASCADE,
  inviter_user_id        text NOT NULL REFERENCES bauth_user(id), -- the student
  invited_email          text NOT NULL,                           -- lowercased
  token                  text NOT NULL UNIQUE,                    -- opaque random
  expires_at             timestamp NOT NULL,                      -- default invited_at + 14 days
  invited_at             timestamp NOT NULL DEFAULT now(),
  accepted_at            timestamp,                               -- set on first click
  accepted_user_id       text REFERENCES bauth_user(id),          -- the teacher's account (created via magic link if new)
  revoked_at             timestamp
);

CREATE UNIQUE INDEX debrief_invite_active_idx
  ON study.debrief_invite (flight_attempt_id, invited_email)
  WHERE accepted_at IS NULL AND revoked_at IS NULL;
```

Public-route policy: `/teach/debrief/[token]` is the **only** non-auth-gated mutation surface in study (post-magic-link sign-in). The route layer explicitly allows it past the layout-level auth gate.

#### Extend `study.syllabus.kind`

Today: `'acs'`, `'pts'`, `'endorsement'`. Add `'teaching'` -- a user-authored teaching syllabus.

#### `study.syllabus.author_user_id`

New nullable FK column. NULL for FAA-published syllabi. Set for `'teaching'` syllabi -- the teacher who authored it.

#### `study.syllabus_node.display_order`

New `integer NOT NULL DEFAULT 0`. CFI-authored ordering for `'teaching'` syllabi. ACS rows keep `display_order = 0` (their order is defined by `code` / area / task structure).

### BC reads

#### `libs/bc/study/src/flight-attempts.ts`

- `listFlightAttempts(userId, filters?, db?) -> FlightAttemptRow[]`
- `getFlightAttempt(id, userId, db?) -> FlightAttemptWithManeuvers | null`
- `listManeuversForLeaf(userId, syllabusNodeId, db?) -> FlightManeuverRow[]`
- `listManeuversForNode(userId, nodeId, db?) -> FlightManeuverRow[]`
- `listAttemptsForTeacher(teacherUserId, studentUserId?, filters?, db?) -> FlightAttemptRow[]` -- a teacher's review queue across all their student links.

#### `libs/bc/study/src/flight-tracks.ts`

- `getFlightTrack(id, userId, db?) -> FlightTrackRow | null` (with row-level ownership check)
- `parseFlightTrack(bytes, format) -> ParsedTrack` -- pure parser; no DB

#### `libs/bc/study/src/teacher-links.ts`

- `listMyTeachers(studentUserId, db?) -> TeacherStudentLinkRow[]`
- `listMyStudents(teacherUserId, db?) -> TeacherStudentLinkRow[]`
- `getActiveTeacherLink(teacherUserId, studentUserId, db?) -> TeacherStudentLinkRow | null`
- `assertTeacherLink(teacherUserId, studentUserId, db?)` -- throws NOT_AUTHORIZED if no active link

#### Extend `libs/bc/study/src/mastery.ts`

`getNodeEvidenceStateMap` gains a sixth fan-out for `flight_maneuver`:

```typescript
db.select({
  nodeId: sql<string>`coalesce(${flightManeuver.nodeId}, sn.node_id)`,
  attempts: count(),
  selfSatisfactory: sql<number>`sum(case when ${flightManeuver.selfAssessment} = 'satisfactory' then 1 else 0 end)`,
  teacherSatisfactory: sql<number>`sum(case when ${flightManeuver.teacherAssessment} = 'satisfactory' then 1 else 0 end)`,
})
.from(flightManeuver)
.leftJoin(syllabusNode, eq(syllabusNode.id, flightManeuver.syllabusNodeId))
.where(and(eq(flightManeuver.userId, userId), inArray(...)))
.groupBy(...)
```

The `demonstration` partition in `NodeEvidenceState` now exposes both counts (self + teacher) without privileging either. The `passing` count is `attempts >= 1 AND (selfSatisfactory + teacherSatisfactory >= 1)` -- "at least one assessment is satisfactory, no matter who made it." That's the simplest objective rule; surfaces can render a richer breakdown if they want.

### BC writes

#### Student-side -- `libs/bc/study/src/flight-attempts.ts`

- `createFlightAttempt(input, db?)` -- audit
- `updateFlightAttempt(input, db?)` -- audit
- `softDeleteFlightAttempt(id, userId, db?)` -- audit
- `addManeuver(input, db?)` -- audit; validates `actualMetricJson` against `MANEUVER_KINDS[kind].actualSchema`
- `updateManeuverSelfAssessment(input, db?)` -- audit
- `deleteManeuver(id, userId, db?)` -- audit
- `attachFlightTrack(attemptId, trackId, userId, db?)` -- ownership-gated; audit

#### Teacher-side -- `libs/bc/study/src/teacher-writes.ts`

All writes gate on `assertTeacherLink(callerUserId, studentUserId)`:

- `setTeacherAssessment(input, db?)` -- update teacher trio atomically
- `setTeacherStudentLinkStatus(input, db?)` -- pause / end a link

#### Teaching syllabus -- `libs/bc/study/src/teaching-syllabus-writes.ts`

All writes gate on `assertSyllabusAuthor(syllabusId, callerUserId)`:

- `createTeachingSyllabus(input, db?)`
- `addLessonToSyllabus(input, db?)` -- inserts at end (max `display_order` + 1)
- `removeLessonFromSyllabus(syllabusNodeId, db?)`
- `reorderLessons(syllabusId, orderedLeafIds, db?)` -- single-transaction `UPDATE ... FROM unnest(...)` per Decision 5. Audit emits one row with full `metadata.newOrder`.

#### Debrief invite flow -- `libs/bc/study/src/debrief-invites.ts`

- `createDebriefInvite(input, db?)` -- student creates an invite for a specific `flight_attempt_id`. Sends email via existing transport. Audit.
- `getDebriefInviteByToken(token, db?) -> DebriefInviteRow | null` -- public route's loader.
- `acceptDebriefInvite(input, db?)` -- the magic-link accept handler. Either signs in an existing teacher account or creates one + auto-grants `teacher` role. Marks `accepted_at` + `accepted_user_id`. Audit.
- `revokeDebriefInvite(input, db?)` -- student revokes. Audit.

> **TODO Q-DEBRIEF-2 (pending user answer): does accepting an invite create a teacher_student_link?**
>
> If yes (relationship-on-first-debrief): `acceptDebriefInvite` also creates `teacher_student_link` with `kind = 'cfi'` (TBD see Q-DEBRIEF-3) and `status = 'active'`. Future debriefs from this student to this teacher don't need new invites.
>
> If no (debrief-only): the invite grants access to one flight only. The teacher_student_link is opt-in via a separate "Make this a regular teacher" action by either side.
>
> Recommendation: **no** in v1 (debrief-only). Magic links stay lightweight; relationships compound deliberately. The "make this regular" action is a one-line BC call (`grantRole` + `createTeacherLink`) and a button on either side's UI.

### Surfaces

#### Student -- `/flight`

- `/flight` -- list of attempts, sorted `flight_date DESC`. Empty state explains how to log the first.
- `/flight/new` -- create form: date, aircraft, route, total time, notes, optional track upload.
- `/flight/[id]` -- detail view + maneuver list + GPS track viewer (Leaflet). Add / edit / delete maneuvers inline.
- `/flight/[id]/invite` -- form to send a debrief invite (or this is a button on the detail page that opens a Dialog -- design.md decides).

#### Teacher -- `/teach`

- `/teach` -- entry. If user has no `teacher` role, shows "you don't have any students yet" + an explainer.
- `/teach/students` -- list of active teacher_student_links.
- `/teach/students/[studentId]` -- per-student summary (recent attempts + leaf rollup).
- `/teach/students/[studentId]/attempts/[attemptId]` -- attempt review with sign-off form.
- `/teach/syllabus` -- create / edit teaching syllabus. Drag-handle reorder. ACS-leaf picker.
- `/teach/debrief/[token]` -- the magic-link landing. Public route gated only by token. Renders the flight + maneuvers; teacher leaves assessments + notes; on save, the magic-link sign-in completes (if not already) and the teacher's identity is attached to the assessment rows.

#### Updated -- `/study` (WP 1)

- Flight tile changes from "WP 2" placeholder to live: badge shows `"N flights logged"` or `"log a flight"` per state. Click -> `/flight`.
- Practiced pill on progress strip aggregates `flight_maneuver` evidence per Decision 2 (no credit rule -- just objective counts).
- Per-leaf P pill in the map reflects demonstration evidence.
- Course projection grows a fourth seed source: if the active student has an active teacher link with a `kind = 'teaching'` syllabus, that syllabus seeds the Course tab. Multi-teacher behavior per Decision 7 (most-recently-active by default; dropdown when 2+ active).

### Constants

- `MANEUVER_KINDS` -- closed enum, ~50 values covering ASEL + IR. Each entry: `{ label, leafCodes, targetSchema, actualSchema }`. Authored in `libs/constants/src/maneuvers.ts`.
- `MANEUVER_KIND_VALUES` -- string array of keys.
- `ASSESSMENT_VALUES = ['satisfactory', 'needs_work', 'unable']`.
- `TRACK_FORMATS = ['gpx', 'csv', 'foreflight_csv', 'cloudahoy_csv']`.
- `TEACHER_LINK_KINDS = ['cfi', 'mentor', 'peer']`.
- `TEACHER_LINK_STATUSES = ['active', 'paused', 'ended']`.
- `ACCOUNT_ROLES = ['student', 'teacher']`.
- `STUDENT_STUDYING_FOR_VALUES = ['ppl', 'ir', 'cfi', 'atp', null]`.
- `ROUTES.FLIGHT`, `FLIGHT_NEW`, `FLIGHT_DETAIL(id)`, `FLIGHT_INVITE(id)`, `TEACH`, `TEACH_STUDENTS`, `TEACH_STUDENT_DETAIL(id)`, `TEACH_ATTEMPT_REVIEW(studentId, attemptId)`, `TEACH_SYLLABUS`, `TEACH_DEBRIEF(token)`.
- `AUDIT_TARGETS.{ACCOUNT_ROLE, FLIGHT_ATTEMPT, FLIGHT_MANEUVER, FLIGHT_TRACK, TEACHER_STUDENT_LINK, TEACHING_SYLLABUS, DEBRIEF_INVITE}`.

### Better-auth magic-link configuration

Better-auth (already in the stack) supports magic-link plugins. Configure in `libs/auth/src/auth.ts`:

- Enable magic-link plugin.
- Magic-link email template named `debrief-invite`: subject "[inviter] would like your feedback on a flight"; body explains the flight + a "Open feedback link" CTA.
- Magic-link tokens are single-use; subsequent visits to the same `/teach/debrief/[token]` URL after acceptance redirect to a "Request a new link" page (the original token is consumed).
- The teacher's session, once established via the magic link, is a regular better-auth session. They can navigate to other `/teach/...` routes (their own students list, syllabus, etc.) without re-authenticating.

### Audit emission

Every mutation audits per the existing pattern. New `AUDIT_TARGETS` entries listed above. One audit row per write (reorder collapses to one row with full `newOrder` array per Decision 5).

## Behavior

### Student logs a flight

1. Navigate `/flight/new`. Fill date / aircraft / route. Save.
2. Land on `/flight/[id]`. Add maneuvers one at a time -- pick from `MANEUVER_KINDS` dropdown (filtered by user's primary goal cert), enter target / actual metrics, self-assess, save.
3. Optionally upload GPX. Track viewer renders below the maneuver list.

### Student invites a teacher to debrief

1. From `/flight/[id]`, click "Invite a teacher to review."
2. Modal: enter email + optional message.
3. Submit -> `createDebriefInvite` runs; magic-link email sent to the teacher.

### Teacher receives + responds (magic link, no account creation prompt)

1. Email: "Joshua wants your feedback on his short-field landing today. [Open feedback]".
2. Click link -> better-auth magic-link verifies the token -> creates `bauth_user` row if new + auto-grants `teacher` role -> session established.
3. Land on `/teach/debrief/[token]`. See the flight summary, maneuver list, GPS track.
4. Per maneuver: pick assessment, write notes, click "Save."
5. `setTeacherAssessment` writes the trio atomically. Audit row.
6. Done. Page shows "Thanks. Your feedback has been sent to Joshua."

The teacher never sees "create your account" or "set a password." The phrase doesn't appear anywhere in the flow.

### Teacher signs off on subsequent flights

> Per pending Q-DEBRIEF-2: this depends on whether accepting a debrief creates a teacher_student_link.

If link auto-created on first debrief:

- Future debriefs from the same student appear in the teacher's `/teach/students` queue automatically. No new magic link required.

If debrief-only (recommended v1):

- Future flights need new debrief invites. Each invite grants access to one flight.
- Either side can "promote" to a teacher_student_link via an explicit action (`/teach/students/[studentId]/promote` or `/flight/[id]/make-regular-teacher`).

### Teacher authors a teaching syllabus

1. Navigate `/teach/syllabus`.
2. Empty state: "Create a teaching syllabus."
3. Form: title + description -> `createTeachingSyllabus` writes a `syllabus` row with `kind = 'teaching'` + `author_user_id = caller`.
4. Add lessons via "Add lesson" -> ACS-leaf picker (search syllabus_node rows where `kind = 'acs'`) -> select one or more leaves -> set lesson title -> save. New `syllabus_node` rows linked to the teaching syllabus, `display_order` = current max + 1.
5. Reorder via drag handle -> drop event triggers `reorderLessons(syllabusId, orderedLeafIds)` -> single transaction updates all `display_order` values atomically. Optimistic UI; rollback on error.
6. The teaching syllabus seeds the Course tab on `/study` for all students of this teacher (via active `teacher_student_link`).

### Track upload + parse

1. Pick `.gpx` / `.csv` / `.kml` (kml via converter in v1; gpx + csv native).
2. Server: read bytes, dispatch to `parseFlightTrack(bytes, format)`.
3. Parser returns `{ points, bbox, startTime, endTime, pointCount }` -- pure function.
4. Bytes written to cache: `<AIRBOSS_HANDBOOK_CACHE>/flight-tracks/<userId>/<trackId>.<ext>`.
5. `flight_track` row inserted.
6. `flight_attempt.gps_track_id` linked.

## Validation

| Field                                     | Rule                                                                                                     |
| ----------------------------------------- | -------------------------------------------------------------------------------------------------------- |
| `account_role.role`                       | In `ACCOUNT_ROLES`.                                                                                       |
| `account_role.metadata` (student)         | Zod: `{ studying_for: STUDENT_STUDYING_FOR_VALUES \| null }`.                                             |
| `account_role.metadata` (teacher)         | Zod: `{ kind: TEACHER_LINK_KINDS, certificates_verified: boolean }`.                                      |
| `flight_attempt.flight_date`              | <= today; not more than 5 years past.                                                                     |
| `flight_attempt.aircraft_ident`           | Required; trimmed; uppercased; matches `^[A-Z0-9-]{2,10}$`.                                               |
| `flight_attempt.total_time_minutes`       | If set: positive integer, <= 1440.                                                                        |
| `flight_maneuver.kind`                    | In `MANEUVER_KINDS`.                                                                                      |
| `flight_maneuver.attempts_made`           | Positive integer, <= 50.                                                                                  |
| `flight_maneuver.actual_metric_json`      | Validates against `MANEUVER_KINDS[kind].actualSchema`.                                                    |
| `flight_maneuver.self_assessment`         | Required, in `ASSESSMENT_VALUES`.                                                                          |
| `flight_maneuver.teacher_assessment`      | If set, in `ASSESSMENT_VALUES`. Trio CHECK enforces all-or-nothing.                                       |
| `flight_track` upload                     | <= 25 MB. Format in `TRACK_FORMATS`. Parser must succeed.                                                 |
| Teacher writes (gating)                   | Caller must have an active `teacher_student_link` to the target student. (Or the matching debrief invite.) |
| Teaching syllabus writes (gating)         | Caller must equal `syllabus.author_user_id`.                                                              |
| `debrief_invite.invited_email`            | Lowercased; valid email format.                                                                            |
| `debrief_invite.expires_at`               | Default `invited_at + 14 days`; configurable via constant.                                                |

## Edge cases

| Trigger                                                                                          | What happens                                                                                                                                                |
| ------------------------------------------------------------------------------------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Student uploads corrupt GPS file                                                                 | Parser throws; upload rejected with clear error. No row created.                                                                                            |
| Student edits a maneuver after teacher sign-off                                                  | Edit allowed. Teacher trio not invalidated automatically. Teacher sees a "post-signoff edit" badge with the diff; can re-sign-off if desired.                |
| Teacher's link goes `'ended'`; student tries to view past assessments                            | Past assessments persist (durable row state). Read access for the student persists. New writes blocked by gating.                                            |
| Student has multiple active teachers                                                             | Allowed. Each link is independent. Course projection picks most-recently-active by default; dropdown surfaces when 2+ exist (Decision 7).                    |
| Teacher reorders lessons in a syllabus authored by a different teacher                           | `assertSyllabusAuthor` rejects. Audit captures the attempt.                                                                                                  |
| Student deletes a flight                                                                         | Soft-delete; cascades to maneuvers via FK. Audit.                                                                                                            |
| Maneuver kind has no `actualSchema` defined                                                      | Form renders only `student_notes` + `self_assessment`; `actual_metric_json = {}`.                                                                            |
| Two students share a tail number                                                                 | Aircraft ident is free-form text per row; no normalization across users.                                                                                    |
| GPS track file private to one user                                                               | `flight_track.user_id` enforces row-level ownership. Teacher can view tracks attached to their student's attempts via the link gate.                          |
| Teacher receives a debrief invite for an account that already exists                             | Magic-link signs them into the existing account (matched by email). No duplicate accounts.                                                                  |
| Teacher's existing account doesn't have `teacher` role                                           | `acceptDebriefInvite` auto-grants the role.                                                                                                                  |
| Student revokes a pending debrief invite before the teacher clicks                               | `revokeDebriefInvite` sets `revoked_at`. Subsequent click on the link returns "This invite has been revoked." No account creation.                          |
| Debrief invite expires before click                                                              | `expires_at < now()` -> "This invite has expired. Ask Joshua for a new one."                                                                                |
| Magic link clicked twice                                                                         | First click marks `accepted_at`. Subsequent clicks: if same email/session -> redirect to `/teach/debrief/[token]` and show the existing feedback page. If different -> magic-link rejects (token consumed). |
| Teacher hasn't filled `studying_for` (their `student` role is bare)                              | Their `/study` page works; progress strip shows "no goal" banner per WP 1.                                                                                  |
| First-time sign-in with no `account_role` rows                                                   | Hooks layer auto-grants `student` with `studying_for: null`.                                                                                                |

## Open questions (TODO)

These three remain pending user answer (flagged inline in the spec as `TODO Q-DEBRIEF-1/2/3`):

1. **Q-DEBRIEF-1: Magic-link flow shape (final confirmation).** The user has confirmed: real account, but no formal "create your account" prompt. Implementation uses better-auth magic-link plugin; teacher never sees signup UI. **Confirm there are no remaining concerns before locking.**
2. **Q-DEBRIEF-2: Single-flight grant vs ongoing relationship.** Does accepting a debrief invite auto-create a `teacher_student_link`, or does the relationship stay opt-in? Recommended: opt-in (debrief grants access to one flight only). User to confirm.
3. **Q-DEBRIEF-3: Default `teacher_student_link.kind` on auto-creation.** When a magic-link debrief turns into an ongoing relationship, what's the default kind? `'cfi'` (assumes the inviter wanted a CFI), `'mentor'` (lower assumption), or "ask the teacher when they accept"? Recommended: `'cfi'` (matches the most common case; teacher can edit their kind in role metadata anytime).

Until these three answers ratify, the magic-link debrief sections (BC + surface + Behavior) are the spec's least-frozen content. Everything else is final.

## Out of scope

- **No FAA logbook integration.** Logbook ingest is a separate corpus / ingestion pipeline.
- **No automatic maneuver detection from GPS tracks** (CloudAhoy-style auto-grading). Captured as IDEA `ADS-B / GPS auto-grading` for post-WP-2.
- **No video / audio upload.** Tracks only.
- **No real-time chat between teacher and student.** Notes are async.
- **No grading rubrics beyond the three-state assessment.** A 1-5 star rubric per maneuver is post-MVP.
- **No payment / billing.** Schema is built so a future `subscription` table can FK into `account_role` cleanly; no billing surfaces in this WP.
- **No teacher / mentor directory.** Teachers must be invited; not browsable.
- **No multi-author editing of one teaching syllabus.** Single-author v1.
- **No track diff / comparison across attempts.** Each track stands alone.
- **No checkride scheduling, endorsement signing, or 8710 generation.**
- **No automatic role promotion** beyond `student` (auto-granted on first sign-in) and `teacher` (auto-granted on first debrief acceptance). All other role transitions are explicit.
- **No certificate verification.** `teacher.metadata.certificates_verified` always defaults to `false`. Verification (FAA airman cert lookup, document upload, etc.) is a future WP if/when the platform monetizes around CFI legitimacy.
- **No cloud GPS-track storage.** Dev-local cache only; cloud adapter is a follow-up WP triggered by second uploader.

## What "done" looks like

- Joshua (as student) logs a flight from `/flight/new`, adds three short-field landing maneuvers with target/actual metrics, optionally uploads a GPX track, sees the attempt at `/flight/[id]`.
- Joshua sends a debrief invite to a teacher's email. Teacher clicks the magic link, lands on `/teach/debrief/[token]`, leaves per-maneuver feedback. Never sees a sign-up form. Teacher's account exists; they didn't notice.
- Joshua (with `teacher` role auto-granted somehow -- either through inviting himself for testing, or another path) reviews a different student's attempt at `/teach/students/[id]/attempts/[id]`, signs off on each maneuver with notes, sees them propagate.
- Joshua (as teacher) authors a 5-lesson teaching syllabus at `/teach/syllabus`, drags lesson #5 to position #2, sees the new order persist on reload.
- Student's `/study` page reflects the in-plane evidence: Practiced pill counts maneuvers (objectively, no credit gate), ACS map leaf rows show evidence on relevant leaves, Course projection seeds from the teacher's syllabus when present.
- All BC writes audit. `bun run check` clean. Vitest + Playwright green.
- Three open questions (Q-DEBRIEF-1/2/3) resolved before final ship; the spec's TODO blocks updated to "decided."
