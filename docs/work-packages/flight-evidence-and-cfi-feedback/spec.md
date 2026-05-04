---
title: 'Spec: Flight evidence and CFI feedback'
product: study
feature: flight-evidence-and-cfi-feedback
type: spec
status: draft
review_status: pending
created: 2026-05-04
---

Add real-flight evidence to airboss: a student logs a flight, records numbers + optional GPS track, and a CFI delivers feedback online. The flight tile on `/study` becomes real (not a stub). The Practiced pill counts in-the-plane attempts alongside sim scenarios. A CFI gets a teacher-side surface where they review attempts, leave structured feedback, and -- critically -- author their own teaching syllabus with drag-handle-reorderable lessons.

This is WP 2 of a three-WP arc. WP 1 is [study-home](../study-home/spec.md). WP 3 is [node-render-modes](../node-render-modes/spec.md).

## Why this WP exists

Today the system has zero in-plane evidence. The `ASSESSMENT_METHODS.DEMONSTRATION` slot is reserved in the schema for exactly this purpose but no surfaces, no storage, no roll-up exist. A returning CFI -- and any pilot training under one -- needs the in-the-plane data to live alongside the recall and scenario data. Without it:

- The Practiced pill on `/study` undercounts (only sim, no plane).
- The CFI has nowhere to leave structured feedback that ties back to ACS leaves.
- The student has no record of "I flew this maneuver, here are my numbers, here's what the CFI said." It lives in a paper logbook.

This WP closes those gaps:

1. **Flight maneuver attempts.** A student logs a flight with maneuvers attempted; per-maneuver they record numbers (altitude held, airspeed, touchdown distance, wind component) and optionally upload a GPS track. The attempt links to one or more knowledge nodes / ACS leaves.
2. **GPS track ingest, vendor-agnostic.** Accept GPX, CSV with `lat,lon,alt,time` columns, or ForeFlight / CloudAhoy / Sentry exports that boil down to one of those shapes. No vendor lock-in. Tracks are derivative artifacts (per ADR 018) -- stored in a developer-local cache for v1, with a clear path to S3 / R2 for cloud later.
3. **CFI as a second user role with a teacher / student edge.** A CFI invites a student via the existing hangar invite flow. Once linked, the CFI can: see the student's attempts, leave per-maneuver notes, mark a maneuver "satisfactory" / "needs work", roll signoff up to a leaf or a syllabus.
4. **CFI's teaching syllabus.** A CFI authors lessons in their own ordering -- drag handles, immediate persistence -- that link to ACS leaves the lessons cover. The Course projection on `/study` (from WP 1) gains a fourth seed source: the CFI's syllabus replaces or augments the FAR navigation course default for students of that CFI.

## Anchors

- [study-home](../study-home/spec.md) -- WP 1, the surface that consumes this WP's data.
- [hangar-invite-flow](../hangar-invite-flow/spec.md) -- the existing invite mechanism extended to support CFI / student edges.
- [hangar-users-editing](../hangar-users-editing/spec.md) -- the dual-gate write pattern (admin role + audit + ConfirmDialog) we extend to teacher-facing writes.
- [decision-016](../../decisions/016-cert-syllabus-goal-model/decision.md) -- syllabus / leaf model; this WP adds a new `syllabus.kind = 'teaching'`.
- [decision-018](../../decisions/018-source-artifact-storage-policy/decision.md) -- developer-local cache for source bytes; GPS tracks ride this convention as derivative bytes.
- `libs/constants/src/study.ts` -- `ASSESSMENT_METHODS.DEMONSTRATION` already defined; we just light it up.
- `libs/bc/study/src/mastery.ts` -- `getNodeEvidenceState` already partitions per `AssessmentMethod`; this WP adds a real query for the `demonstration` partition.
- `libs/auth/src/schema.ts` -- `bauth_user`; we add a sibling `cfi_student_link` table for the teacher / student edge.

## In scope

### Data model

#### `study.flight_attempt`

A single flight session with one or more maneuvers logged.

- `id` (text PK, prefix `fa_`)
- `user_id` (text, FK -> `bauth_user`, NOT NULL) -- the student.
- `flight_date` (date, NOT NULL) -- the day of the flight.
- `aircraft_ident` (text, NOT NULL) -- e.g. "N5293D".
- `aircraft_type` (text) -- e.g. "C172S". Optional in v1.
- `from_icao` (text) -- e.g. "KPAO". Optional.
- `to_icao` (text) -- optional.
- `total_time_minutes` (integer) -- optional.
- `notes` (text) -- free-form student notes.
- `gps_track_id` (text, FK -> `study.flight_track`, nullable) -- one optional track per attempt.
- `created_at`, `updated_at` (timestamps).

#### `study.flight_maneuver`

A single maneuver attempt within a flight.

- `id` (text PK, prefix `fm_`)
- `flight_attempt_id` (text, FK -> `study.flight_attempt`, NOT NULL, ON DELETE CASCADE).
- `node_id` (text, FK -> `knowledge_node`, nullable) -- the knowledge node this maneuver maps to (e.g., `procedures/short-field-takeoff-and-landing`). Either `node_id` or `syllabus_node_id` must be set.
- `syllabus_node_id` (text, FK -> `syllabus_node`, nullable) -- the ACS leaf this maneuver maps to (e.g., `PA.IV.E`). Independent of `node_id`; both can be set.
- `kind` (text, NOT NULL, CHECK in `MANEUVER_KINDS`) -- `'short_field_to'`, `'short_field_ldg'`, `'soft_field_to'`, etc. Closed enum with ~30 values for v1 ASEL maneuvers; extensible.
- `attempts_made` (integer, NOT NULL, default 1) -- how many times the student tried it on this flight.
- `target_metric_json` (jsonb, default `{}`) -- maneuver-specific target shape (e.g., `{ "rotate_speed_kts": 55, "obstacle_clearance_ft": 50 }`).
- `actual_metric_json` (jsonb, default `{}`) -- what the student logged (e.g., `{ "rotate_speed_kts": 58, "obstacle_clearance_ft": 75, "wind_kts": 8, "wind_dir_deg": 280 }`).
- `self_assessment` (text, CHECK in `SELF_ASSESSMENTS`) -- `'satisfactory'`, `'needs_work'`, `'unable'`. Required.
- `student_notes` (text) -- per-maneuver notes from the student.
- `cfi_assessment` (text, CHECK in `CFI_ASSESSMENTS`, nullable) -- `'satisfactory'`, `'needs_work'`, `'unable'`. Set by the CFI; null until the CFI signs off.
- `cfi_notes` (text, nullable) -- per-maneuver feedback from the CFI.
- `cfi_signed_off_by` (text, FK -> `bauth_user`, nullable).
- `cfi_signed_off_at` (timestamp, nullable).
- `created_at`, `updated_at` (timestamps).

CHECK constraint: at least one of `node_id` or `syllabus_node_id` must be set.
CHECK constraint: `cfi_signed_off_by IS NULL` iff `cfi_assessment IS NULL` iff `cfi_signed_off_at IS NULL` (all-or-nothing trio).

Composite index on `(user_id, flight_date DESC)` for the student's attempt list.
Composite index on `(syllabus_node_id, user_id)` for the leaf rollup.
Composite index on `(node_id, user_id)` for the node rollup.

#### `study.flight_track`

A GPS track artifact.

- `id` (text PK, prefix `ft_`)
- `user_id` (text, FK -> `bauth_user`, NOT NULL).
- `format` (text, CHECK in `TRACK_FORMATS`) -- `'gpx'`, `'csv'`, `'foreflight_csv'`, `'cloudahoy_csv'`. Closed enum.
- `cache_path` (text, NOT NULL) -- relative path within the developer-local cache (per ADR 018), e.g. `~/Documents/airboss-cache/flight-tracks/<userId>/<id>.gpx`. The bytes do not live in the DB.
- `byte_size` (integer, NOT NULL).
- `point_count` (integer, NOT NULL) -- decoded once on upload, cached.
- `start_time`, `end_time` (timestamps) -- decoded.
- `bbox_json` (jsonb) -- `{ "n": 37.5, "s": 37.4, "e": -122.1, "w": -122.2 }` for fast spatial filtering.
- `created_at` (timestamp).

NOT a regular table for the bytes -- the bytes live in the cache, the row is metadata only. Aligns with ADR 018 storage policy.

#### `study.cfi_student_link`

Teacher / student edge.

- `id` (text PK, prefix `cs_`)
- `cfi_user_id` (text, FK -> `bauth_user`, NOT NULL).
- `student_user_id` (text, FK -> `bauth_user`, NOT NULL).
- `status` (text, CHECK in `CFI_STUDENT_LINK_STATUSES`) -- `'active'`, `'paused'`, `'ended'`.
- `started_at` (timestamp, NOT NULL).
- `ended_at` (timestamp, nullable).
- `cfi_notes` (text) -- private, CFI-only notes about the student.
- `created_at`, `updated_at` (timestamps).

UNIQUE (`cfi_user_id`, `student_user_id`) WHERE `status = 'active'` -- one active link at a time per pair.

#### Extend `study.syllabus.kind`

Today: `'acs'`, `'pts'`, `'endorsement'`. Add `'teaching'` -- a CFI-authored teaching syllabus.

#### `study.syllabus.author_user_id`

New nullable FK column. NULL for FAA-published syllabi (ACS / PTS), set for `teaching` syllabi -- the CFI who authored it.

#### `study.syllabus_node` -- new column

Add `display_order` (integer, NOT NULL, default 0) -- the CFI-authored ordering for `teaching` syllabi. ACS syllabi keep `display_order = 0` (their order is defined by `code` / area / task structure). Drag-handle reorder in the CFI authoring UI updates this column.

#### Extend `card.assessment_methods` AND `scenario.assessment_methods` -- already exists

These are already `jsonb` arrays of `AssessmentMethod`. No schema change. We start writing `'demonstration'` into `flight_maneuver` rows; the existing `getNodeEvidenceStateMap` partition queries get a sixth fan-out for `flight_maneuver`-derived evidence.

### BC reads

`libs/bc/study/src/flight-attempts.ts`:

- `listFlightAttempts(userId, filters?, db?) -> FlightAttemptRow[]` -- paginated, sortable.
- `getFlightAttempt(id, userId, db?) -> FlightAttemptWithManeuvers | null` -- includes joined maneuvers.
- `listManeuversForLeaf(userId, syllabusNodeId, db?) -> FlightManeuverRow[]` -- for leaf detail rollup on `/study`.
- `listManeuversForNode(userId, nodeId, db?) -> FlightManeuverRow[]` -- for knowledge node detail rollup.
- `listAttemptsForCfi(cfiUserId, studentUserId?, filters?, db?) -> FlightAttemptRow[]` -- the CFI's review queue.

`libs/bc/study/src/flight-tracks.ts`:

- `getFlightTrack(id, userId, db?) -> FlightTrackRow | null`.
- `parseFlightTrack(bytes, format) -> { points, bbox, startTime, endTime, pointCount }` -- pure parser, lives in a sibling file. No DB.

`libs/bc/study/src/cfi-links.ts`:

- `listMyCfis(studentUserId, db?) -> CfiStudentLinkRow[]` -- a student's CFIs.
- `listMyStudents(cfiUserId, db?) -> CfiStudentLinkRow[]` -- a CFI's students.
- `getActiveCfiLink(cfiUserId, studentUserId, db?) -> CfiStudentLinkRow | null` -- gating helper for CFI write ops.

Extend `libs/bc/study/src/mastery.ts` -- `getNodeEvidenceStateMap` gains a sixth fan-out:

```typescript
db.select({
  nodeId: sql<string>`coalesce(${flightManeuver.nodeId}, sn.node_id)`,
  attempts: count(),
  satisfactory: sql<number>`sum(case when ${flightManeuver.cfiAssessment} = 'satisfactory' then 1 else 0 end)`,
})
.from(flightManeuver)
.leftJoin(...)  // syllabus_node -> resolved node_id
.where(and(eq(flightManeuver.userId, userId), inArray(...)))
.groupBy(...)
```

The `demonstration` gate now computes against real data instead of `not_applicable`.

### BC writes (with auth gates)

`libs/bc/study/src/flight-attempts.ts`:

- `createFlightAttempt(input, db?)` -- student creates their own attempt. Audits.
- `updateFlightAttempt(input, db?)` -- student updates their own. Audits.
- `deleteFlightAttempt(id, userId, db?)` -- student soft-deletes their own. Audits.
- `addManeuver(input, db?)` -- student adds a maneuver to their attempt. Audits.
- `updateManeuverSelfAssessment(input, db?)` -- student updates their self-assessment / notes. Audits.
- `attachFlightTrack(attemptId, trackId, userId, db?)` -- links an uploaded track to an attempt.

`libs/bc/study/src/cfi-writes.ts`:

- `setCfiAssessment(input, db?)` -- CFI signs off on a maneuver. Validates the CFI / student link is active; validates the CFI hasn't already signed off (or is updating). Audits.
- `setStudentLinkStatus(input, db?)` -- CFI pauses / ends a link.

`libs/bc/study/src/cfi-syllabus-writes.ts`:

- `createTeachingSyllabus(input, db?)` -- CFI creates a new teaching syllabus.
- `addLessonToSyllabus(input, db?)` -- adds a leaf reference (linked node or syllabus_node) at a `display_order`.
- `reorderLessons(syllabusId, orderedLeafIds, db?)` -- atomic reorder. Critical for the drag-handle UX. Single transaction. Audits once with the full `orderedLeafIds` array as `metadata.newOrder`.

All CFI writes are gated:

- Caller must be authenticated.
- `getActiveCfiLink(callerId, targetStudentId)` must return non-null.
- For writes on a `teaching` syllabus, caller must be `syllabus.author_user_id`.

### Surfaces

#### Student-side: `/flight`

- **List view** at `/flight` -- the user's flight attempts, sorted by `flight_date` descending. Empty-state explains how to log the first one.
- **Detail / edit** at `/flight/[id]` -- attempt summary, list of maneuvers (each editable inline), GPS track viewer (Leaflet map of the track with maneuver markers).
- **New attempt** at `/flight/new` -- form: date, aircraft, route, total time, notes, optional track upload, then add maneuvers.
- **Add maneuver** as a sub-form within the attempt detail -- pick a maneuver kind from a dropdown (which ones map to ACS leaves the user is targeting), enter target / actual metrics (the form fields are dynamic per maneuver kind), self-assess, notes.
- **Track upload** -- a file picker accepting `.gpx`, `.csv`, `.kml` (via converter). On upload, parse via `parseFlightTrack`, write bytes to the cache, create the `flight_track` row, link to the attempt.

#### CFI-side: `/teach` (under hangar or as a new study sub-app -- TBD)

- **My students** at `/teach/students` -- list of active links.
- **Student detail** at `/teach/students/[studentId]` -- the student's attempts, recent flight-evidence summary, link to ACS / leaf rollup for that student.
- **Attempt review** at `/teach/students/[studentId]/attempts/[attemptId]` -- the same detail page the student sees, plus a CFI-only feedback editor: per-maneuver assessment (`satisfactory` / `needs_work` / `unable`) + notes textarea + "Sign off" button.
- **My syllabus** at `/teach/syllabus` -- the CFI's teaching syllabus authoring page. Drag handles on lessons, immediate persistence via `reorderLessons`. Add lesson, remove lesson, link to ACS leaf.

#### Updated: `/study` (WP 1)

- Flight tile changes from "WP 2" placeholder to "Log a flight" / "N attempts pending CFI" badge. Click goes to `/flight`.
- The Practiced pill on the progress strip now sums sim scenarios + flight maneuvers (where `cfi_assessment = 'satisfactory'` for full credit; `self_assessment = 'satisfactory'` for partial credit -- exact rule TBD; see design.md).
- Per-leaf P pill in the map updates to reflect demonstration evidence too.
- Course projection grows a fourth seed source: if the active student has an active CFI link with a `teaching` syllabus, that syllabus is the default Course projection (FAR nav course remains as a fallback).

### Constants

- `MANEUVER_KINDS` -- closed enum, ~30 values. Each entry has a label, an ACS leaf code (or list), and a `target_metric_schema` (Zod schema for the target / actual JSON shape).
- `SELF_ASSESSMENTS` / `CFI_ASSESSMENTS` -- both `['satisfactory', 'needs_work', 'unable']`.
- `TRACK_FORMATS` -- `['gpx', 'csv', 'foreflight_csv', 'cloudahoy_csv']`.
- `CFI_STUDENT_LINK_STATUSES` -- `['active', 'paused', 'ended']`.
- `ROUTES.FLIGHT`, `ROUTES.FLIGHT_NEW`, `ROUTES.FLIGHT_DETAIL(id)`, `ROUTES.TEACH_*`.
- `AUDIT_TARGETS.FLIGHT_ATTEMPT`, `FLIGHT_MANEUVER`, `CFI_STUDENT_LINK`, `TEACHING_SYLLABUS`.

### Audit emission

Every mutation audits per the existing pattern:

- `flight_attempt` create / update / delete.
- `flight_maneuver` add / update / delete.
- `flight_track` upload / delete.
- `cfi_assessment` set.
- `cfi_student_link` create (via invite accept) / status change.
- `teaching_syllabus` create / lesson add / lesson remove / lesson reorder (single audit row per reorder, with the full new order in `metadata`).

### Hangar invite flow extension

The existing invite flow already invites users with a `proposed_role`. Add a new `relationship: { kind: 'cfi_student_link', cfiUserId: string }` field to the invite -- when the recipient accepts, an active `cfi_student_link` row is created in the same transaction as the user. v1: only CFIs can invite as `cfi_student_link`; the role check happens in `createInvitation`.

## Behavior

### Student logs a flight

1. Student navigates to `/flight/new`.
2. Fills date, aircraft ident, route, optional total time, optional notes.
3. Optionally uploads a GPS track.
4. Clicks "Save" -> `flight_attempt` row created, redirects to `/flight/[id]`.
5. Adds maneuvers one at a time: pick from `MANEUVER_KINDS` dropdown (suggestions filtered by user's active goals), fill target / actual metrics, self-assess, save.
6. Each maneuver appears on the detail page; the leaf rollup on `/study` updates.

### CFI signs off on a maneuver

1. CFI navigates to `/teach/students/[studentId]/attempts/[attemptId]`.
2. Per maneuver: picks an assessment, writes notes, clicks "Sign off".
3. `setCfiAssessment` updates the row + audits. Student sees the CFI's assessment on their next visit.

### CFI authors a teaching syllabus

1. CFI navigates to `/teach/syllabus`.
2. Empty state -> "Create teaching syllabus" -> form: title, description -> creates row with `kind: 'teaching'`, `author_user_id = cfi.id`.
3. Adds lessons: click "Add lesson", search ACS leaves, pick one or more, set lesson title, click save -> `syllabus_node` row(s) created, linked.
4. Reorders: drags a lesson by its handle, drops in new position, `reorderLessons` fires immediately. Optimistic UI; rollback on error.

### Track upload + parse

1. User picks a `.gpx` / `.csv` / `.kml` file.
2. Server-side: read bytes, dispatch to `parseFlightTrack(bytes, format)`.
3. Parser returns `{ points, bbox, startTime, endTime, pointCount }`.
4. Bytes written to cache at `~/Documents/airboss-cache/flight-tracks/<userId>/<trackId>.<ext>`.
5. `flight_track` row inserted with metadata.
6. If linked to an attempt: `attempt.gps_track_id` set.

## Validation

| Field                                  | Rule                                                                                            |
| -------------------------------------- | ----------------------------------------------------------------------------------------------- |
| `flight_attempt.flight_date`           | Must be <= today; not more than 5 years past.                                                  |
| `flight_attempt.aircraft_ident`        | Required; trimmed; uppercased; matches `^[A-Z0-9-]{2,10}$`.                                     |
| `flight_attempt.total_time_minutes`    | If set: positive integer, <= 1440 (24h sanity).                                                 |
| `flight_maneuver.kind`                 | Must be in `MANEUVER_KINDS`.                                                                    |
| `flight_maneuver.attempts_made`        | Positive integer, <= 50.                                                                        |
| `flight_maneuver.actual_metric_json`   | Must validate against the Zod schema for `MANEUVER_KINDS[kind].target_metric_schema`.           |
| `flight_maneuver.self_assessment`      | Required, in `SELF_ASSESSMENTS`.                                                                |
| `flight_maneuver.cfi_assessment`       | If set, in `CFI_ASSESSMENTS`. All-or-nothing trio enforced by CHECK.                            |
| `flight_track` upload                  | <= 25 MB. Format must be in `TRACK_FORMATS`. Parser must succeed; reject unparseable files.     |
| `cfi_student_link` (CFI write gate)    | Caller must have an active link to the target student.                                          |
| `teaching_syllabus` write              | Caller must be the `author_user_id`.                                                            |

## Edge cases

| Trigger                                                                          | What happens                                                                                                                                              |
| -------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Student uploads a corrupt GPS file                                               | Parser throws; the upload is rejected with a clear error ("Could not parse GPS track. Supported: GPX, CSV with lat,lon,alt,time"). No row created.        |
| Student logs a flight, CFI signs off, then student edits the maneuver            | Edit allowed. Sign-off is **not** invalidated automatically. CFI sees the edit timestamp + a "post-signoff edit" badge in the review UI; can re-sign-off. |
| CFI ends the link, then student tries to view CFI feedback on past maneuvers     | Past feedback persists (the row's `cfi_assessment` is durable). New writes blocked. Read access for the student persists.                                  |
| Two CFIs both link to the same student                                           | Allowed. UNIQUE constraint is per `(cfi, student)` pair, not per student. Each CFI sees their own attempts review queue.                                  |
| CFI tries to reorder lessons in a syllabus authored by a different CFI           | `reorderLessons` rejects with `NOT_AUTHORIZED`. Audit captures the attempt.                                                                                |
| Student deletes an attempt                                                       | Soft-delete; cascades to maneuvers via `ON DELETE CASCADE`. Audits the delete.                                                                            |
| Maneuver kind has no `target_metric_schema`                                      | `actual_metric_json` defaults to `{}`; form renders only `student_notes` and `self_assessment`.                                                            |
| Two students share a tail number                                                 | Aircraft ident is free-form text per row; no normalization across users.                                                                                  |
| GPS track file is private to one user                                            | `flight_track.user_id` enforces row-level ownership. CFI can view tracks attached to their student's attempts via the link gate.                          |

## Open questions

1. **Where does CFI surface live?** Under hangar (`hangar/teach/...`)? Or a new study sub-app (`apps/teach/`)? Or under study (`apps/study/teach/...`)? Recommendation: under study at `/teach/...` for v1; promote to its own surface app (`apps/teach/`) when CFI features grow.
2. **Practiced pill credit rule.** Does a `cfi_assessment = 'satisfactory'` count for full credit, while `self_assessment = 'satisfactory'` counts partial? Or only CFI-signed counts? Recommendation: CFI-signed = full credit; self-assessed counts as "covered, not mastered" (the existing `covered` vs `mastered` partition handles this).
3. **GPS track storage in production.** Local cache is dev-only. Production needs S3 / R2 or similar. Recommendation: dev-only for v1 (Joshua is user zero); cloud-storage adapter is a follow-up WP when a second user joins.
4. **Maneuver kinds enum scope.** ASEL-only for v1? Or include AMEL / IR / commercial? Recommendation: ASEL-only for v1; extend additively as new certs come into focus.
5. **Reorder transaction shape.** `reorderLessons` is a single transaction over N rows. For very large syllabi (50+ lessons) this may lock briefly. Acceptable? Recommendation: yes, even 100 rows is sub-millisecond; revisit only if a real CFI authors > 200 lessons.
6. **CFI invite role mapping.** When a CFI invites a student, what role does the student get? Recommendation: same role as a regular study user; the CFI / student edge is independent of the role enum.
7. **Multi-CFI displays.** If a student has two CFIs, whose `teaching` syllabus seeds the Course projection? Recommendation: the most-recently-active link's CFI; user can switch via a dropdown.

## Out of scope

- **No FAA logbook integration.** Logbook ingest is a separate corpus / ingestion pipeline.
- **No automatic maneuver detection from GPS tracks** (CloudAhoy-style). The student declares which maneuvers they flew. Auto-detection is a future enhancement.
- **No video / audio upload.** Tracks only.
- **No real-time CFI/student chat.** Notes are async.
- **No grading rubrics beyond the three-state assessment.** A 1-5 star rubric per maneuver is post-MVP.
- **No payment / billing.** CFI invites their student; no transaction.
- **No CFI directory.** Students can't browse / search CFIs; CFI must invite by email.
- **No multi-user editing of one teaching syllabus.** Single-author v1.
- **No track diff / comparison across attempts.** Each track stands alone.
- **No checkride scheduling, endorsement signing, or 8710 generation.** Out of scope; would be its own large WP.

## What "done" looks like

- Joshua (as student) logs a flight from `/flight/new`, adds three short-field landing maneuvers with target / actual metrics, optionally uploads a GPX track, sees the attempt at `/flight/[id]`.
- Joshua (as CFI) reviews a different student's attempt at `/teach/students/[id]/attempts/[id]`, signs off on each maneuver with notes, sees them propagate.
- Joshua (as CFI) authors a 5-lesson teaching syllabus at `/teach/syllabus`, drags lesson #5 to position #2, sees the new order persist on reload.
- The student's `/study` page reflects the in-plane evidence: Practiced pill counts the maneuvers, ACS map leaf rows show `P:●` where the CFI has signed off, the Course projection seeds from the CFI's teaching syllabus.
- All BC writes audit. `bun run check` clean. Vitest + Playwright green.
