---
title: 'Design: Flight evidence and teacher feedback'
product: study
feature: flight-evidence-and-cfi-feedback
type: design
status: draft
review_status: pending
created: 2026-05-04
revised: 2026-05-04
---

## Key technical decisions

### Decision 1: Demonstration evidence flows through the same machinery as scenario evidence

`getNodeEvidenceStateMap` already partitions per `AssessmentMethod`. Today the `demonstration` partition returns `not_applicable` because nothing writes to that slot. This WP lights it up by adding a sixth fan-out query against `flight_maneuver`, mapping the result into the existing `NodeEvidenceState` shape. No new evidence-state machinery; we hook into the slot the schema already reserves.

This means the home page (WP 1), the credentials dashboard, the lens UI, and any future surface that consumes `getNodeEvidenceState` *automatically* gets in-plane evidence the day this WP ships. No surface code change required.

### Decision 2: GPS tracks are derivative bytes (ADR 018)

Tracks are not stored in the DB. Bytes live in the developer-local cache (`~/Documents/airboss-cache/flight-tracks/<userId>/<id>.<ext>`); the `flight_track` row is metadata only. This:

- Aligns with ADR 018's source / derivative split.
- Keeps the DB small even if the user logs hundreds of flights.
- Defers the cloud-storage decision to when a second user joins (open question 3).

`flight_track.cache_path` stores the relative path within the cache root; the cache root is configurable via `AIRBOSS_HANDBOOK_CACHE` (the existing env var, repurposed -- it's already the canonical local-cache anchor for any derivative bytes).

### Decision 3: Reorder is a single atomic transaction

`reorderLessons` accepts the full new ordering as `orderedLeafIds: string[]` and writes all `display_order` values in one transaction. Rationale:

- Prevents inconsistent intermediate states (no "lesson 3 has order 7 while lesson 7 has order 3").
- One audit row per reorder, not N.
- The drag-handle UI sends one PATCH on drop, not N PATCHes during drag.

Implementation: `UPDATE syllabus_node SET display_order = data.idx FROM unnest(...) AS data(id, idx) WHERE syllabus_node.id = data.id`. Postgres-native, single round-trip.

### Decision 4: Maneuver kinds are a closed enum with per-kind metric schemas

Each maneuver kind has a Zod schema for its `target_metric_json` and `actual_metric_json`:

```typescript
export const MANEUVER_KINDS = {
  SHORT_FIELD_TO: {
    label: 'Short-field takeoff',
    leafCodes: ['PA.IV.E.S1', 'PA.IV.E.S2'],
    targetSchema: z.object({
      rotate_speed_kts: z.number().int().min(40).max(80),
      obstacle_clearance_ft: z.number().int().min(0).max(100),
    }),
    actualSchema: z.object({
      rotate_speed_kts: z.number().int(),
      obstacle_clearance_ft: z.number().int(),
      wind_kts: z.number().int().min(0).max(60).optional(),
      wind_dir_deg: z.number().int().min(0).max(360).optional(),
    }),
  },
  // ...
} as const;
```

The form for "log a maneuver" reads the schema for the picked kind and renders inputs accordingly. Validation happens both client-side (form-time) and server-side (in `addManeuver`).

### Decision 5: Roles live on a join table; relationships are independent of roles

Per spec Decision 6 (roles architecture): a user's roles live in `study.account_role` (one row per role per user). v1 roles: `student`, `teacher`. Multi-role accounts are first-class.

The teacher / student relationship is a *separate* axis -- `study.teacher_student_link` rows. A user has the `teacher` role independently of which students they teach; the link table tracks the relationships.

Why both:

- Roles describe **what the user can do as a class** ("teachers see /teach surfaces"). Single fact per user-role pair.
- Links describe **specific relationships** ("teacher A teaches student B"). Many per teacher.

The "teaching" surfaces (`/teach/...`) check `requireTeacher(callerId)` to gate the route. Per-relationship writes (assess this maneuver, reorder this syllabus) gate on `assertTeacherLink(callerId, studentId)` AND `assertSyllabusAuthor(syllabusId, callerId)` respectively.

Why this matters for the magic-link flow: a teacher accepting a debrief invite gets the `teacher` role auto-granted (per Decision 8). NO `teacher_student_link` is auto-created (per Decision 9 -- the debrief is one-flight only; relationships are opt-in via the explicit "Make this regular" action). If the teacher already has the `teacher` role, that row is left alone.

Future-compat: when a `subscription` table arrives, it FKs into `account_role(user_id, role)` cleanly. A teacher subscription, a student subscription, or both can attach to the same user without surgery.

### Decision 6: No credit rule -- track data, don't gate

Per spec Decision 2: airboss is a tracker, not a gate. The teacher (when present) is the gate; we record what they say. We don't synthesize a "mastered" judgment that privileges one kind of evidence over another.

Concretely, the `demonstration` partition in `NodeEvidenceState`:

- `attempts` = total `flight_maneuver` rows for the user on this node.
- `passing` = rows where **either** `self_assessment = 'satisfactory'` **or** `teacher_assessment = 'satisfactory'`. The simplest objective rule: "at least one assessment is satisfactory, no matter who made it."
- Surfaces (the WP 1 home page, the credentials dashboard, the lens UI) can render a richer breakdown if they want -- "9 self-satisfactory, 6 teacher-signed satisfactory" -- by reading the partition's underlying counts.

Rationale:

- Self-practice is legitimate; ignoring it punishes solo learners (the user's near-term mode) and the system is wrong by default for anyone without a teacher.
- A teacher's assessment is more authoritative *to that teacher's judgment*, not because the schema says so. The schema is neutral.
- "Satisfactory" is what gets recorded; it doesn't get re-weighted.

This is a meaningful simplification from the prior credit-rule design. The schema for `flight_maneuver.teacher_*` columns stays the same (we still want a teacher's identity + timestamp on their assessment); the partition query is simpler (one OR instead of an IF).

### Decision 7: Track viewer is Leaflet, not Mapbox

Leaflet is open, free, and adequate for "render a polyline on a base map." Mapbox would be richer but adds cost / vendor dependency. The track viewer:

- Uses OpenStreetMap tiles by default.
- Allows pan / zoom / overlay maneuver markers (one per maneuver, positioned at its midpoint timestamp on the track).
- Click on a marker -> scroll to that maneuver in the list.

Future: a sectional / IFR-chart overlay would be nice but is out of scope.

### Decision 8: Track parsing is pure and testable

`parseFlightTrack(bytes: Uint8Array, format: TrackFormat) -> ParsedTrack` is a pure function in `libs/bc/study/src/flight-tracks/parser.ts`. No DB, no FS. Returns the decoded structure or throws a typed error. Vitest unit tests cover each format with sample fixtures.

The DB write happens in `uploadTrack(input, db)` which calls the parser, writes bytes to cache, inserts the row. Pure-vs-impure separation keeps the parser testable in isolation.

## Schema

```typescript
// libs/db/schema/study/account-roles.ts
export const accountRole = study.table('account_role', {
  userId: text('user_id').notNull().references(() => bauthUser.id, { onDelete: 'cascade' }),
  role: text('role').notNull(),                                  // 'student' | 'teacher'
  metadata: jsonb('metadata').notNull().default({}),
  grantedAt: timestamp('granted_at').notNull().defaultNow(),
  revokedAt: timestamp('revoked_at'),                            // soft-end
}, (t) => ({
  pk: primaryKey({ columns: [t.userId, t.role] }),
  roleIdx: index('account_role_role_idx').on(t.role),
  roleCheck: check('account_role_role_check', sql`${t.role} IN ('student','teacher')`),
}));

// libs/db/schema/study/flight.ts
export const flightAttempt = study.table('flight_attempt', {
  id: text('id').primaryKey(),
  userId: text('user_id').notNull().references(() => bauthUser.id),
  flightDate: date('flight_date').notNull(),
  aircraftIdent: text('aircraft_ident').notNull(),
  aircraftType: text('aircraft_type'),
  fromIcao: text('from_icao'),
  toIcao: text('to_icao'),
  totalTimeMinutes: integer('total_time_minutes'),
  notes: text('notes'),
  gpsTrackId: text('gps_track_id').references(() => flightTrack.id),
  deletedAt: timestamp('deleted_at'),
  createdAt: timestamp('created_at').notNull().defaultNow(),
  updatedAt: timestamp('updated_at').notNull().defaultNow(),
}, (t) => ({
  userDateIdx: index('flight_attempt_user_date_idx').on(t.userId, t.flightDate),
}));

export const flightManeuver = study.table('flight_maneuver', {
  id: text('id').primaryKey(),
  flightAttemptId: text('flight_attempt_id').notNull().references(() => flightAttempt.id, { onDelete: 'cascade' }),
  userId: text('user_id').notNull().references(() => bauthUser.id), // denormalized for fast filtering
  nodeId: text('node_id').references(() => knowledgeNode.id),
  syllabusNodeId: text('syllabus_node_id').references(() => syllabusNode.id),
  kind: text('kind').notNull(),
  attemptsMade: integer('attempts_made').notNull().default(1),
  targetMetricJson: jsonb('target_metric_json').notNull().default({}),
  actualMetricJson: jsonb('actual_metric_json').notNull().default({}),
  selfAssessment: text('self_assessment').notNull(),
  studentNotes: text('student_notes'),
  teacherAssessment: text('teacher_assessment'),
  teacherNotes: text('teacher_notes'),
  teacherSignedOffBy: text('teacher_signed_off_by').references(() => bauthUser.id),
  teacherSignedOffAt: timestamp('teacher_signed_off_at'),
  createdAt: timestamp('created_at').notNull().defaultNow(),
  updatedAt: timestamp('updated_at').notNull().defaultNow(),
}, (t) => ({
  attemptIdx: index('flight_maneuver_attempt_idx').on(t.flightAttemptId),
  leafUserIdx: index('flight_maneuver_leaf_user_idx').on(t.syllabusNodeId, t.userId),
  nodeUserIdx: index('flight_maneuver_node_user_idx').on(t.nodeId, t.userId),
  kindCheck: check('flight_maneuver_kind_check', sql`${t.kind} IN (${sql.raw(MANEUVER_KIND_VALUES.map(v => `'${v}'`).join(','))})`),
  selfAssessmentCheck: check('flight_maneuver_self_check', sql`${t.selfAssessment} IN ('satisfactory','needs_work','unable')`),
  teacherAssessmentCheck: check('flight_maneuver_teacher_check', sql`${t.teacherAssessment} IS NULL OR ${t.teacherAssessment} IN ('satisfactory','needs_work','unable')`),
  teacherTrioCheck: check('flight_maneuver_teacher_trio_check', sql`(${t.teacherAssessment} IS NULL) = (${t.teacherSignedOffBy} IS NULL) AND (${t.teacherAssessment} IS NULL) = (${t.teacherSignedOffAt} IS NULL)`),
  evidenceTargetCheck: check('flight_maneuver_evidence_target_check', sql`${t.nodeId} IS NOT NULL OR ${t.syllabusNodeId} IS NOT NULL`),
}));

export const flightTrack = study.table('flight_track', {
  id: text('id').primaryKey(),
  userId: text('user_id').notNull().references(() => bauthUser.id),
  format: text('format').notNull(),
  cachePath: text('cache_path').notNull(),
  byteSize: integer('byte_size').notNull(),
  pointCount: integer('point_count').notNull(),
  startTime: timestamp('start_time'),
  endTime: timestamp('end_time'),
  bboxJson: jsonb('bbox_json'),
  createdAt: timestamp('created_at').notNull().defaultNow(),
});

export const teacherStudentLink = study.table('teacher_student_link', {
  id: text('id').primaryKey(),                                  // prefix 'tsl_'
  teacherUserId: text('teacher_user_id').notNull().references(() => bauthUser.id),
  studentUserId: text('student_user_id').notNull().references(() => bauthUser.id),
  kind: text('kind').notNull(),                                 // 'cfi' | 'mentor' | 'peer'
  status: text('status').notNull(),                             // 'active' | 'paused' | 'ended'
  startedAt: timestamp('started_at').notNull().defaultNow(),
  endedAt: timestamp('ended_at'),
  teacherNotes: text('teacher_notes'),                          // private to the teacher
  createdAt: timestamp('created_at').notNull().defaultNow(),
  updatedAt: timestamp('updated_at').notNull().defaultNow(),
}, (t) => ({
  uniqueActive: uniqueIndex('teacher_student_link_active_idx')
    .on(t.teacherUserId, t.studentUserId)
    .where(sql`${t.status} = 'active'`),
  teacherIdx: index('teacher_student_link_teacher_idx').on(t.teacherUserId),
  studentIdx: index('teacher_student_link_student_idx').on(t.studentUserId),
  kindCheck: check('teacher_student_link_kind_check', sql`${t.kind} IN ('cfi','mentor','peer')`),
  statusCheck: check('teacher_student_link_status_check', sql`${t.status} IN ('active','paused','ended')`),
}));

export const debriefInvite = study.table('debrief_invite', {
  id: text('id').primaryKey(),                                  // prefix 'dbi_'
  flightAttemptId: text('flight_attempt_id').notNull().references(() => flightAttempt.id, { onDelete: 'cascade' }),
  inviterUserId: text('inviter_user_id').notNull().references(() => bauthUser.id),
  invitedEmail: text('invited_email').notNull(),                // lowercased
  token: text('token').notNull().unique(),
  expiresAt: timestamp('expires_at').notNull(),
  invitedAt: timestamp('invited_at').notNull().defaultNow(),
  acceptedAt: timestamp('accepted_at'),
  acceptedUserId: text('accepted_user_id').references(() => bauthUser.id),
  revokedAt: timestamp('revoked_at'),
}, (t) => ({
  activeIdx: uniqueIndex('debrief_invite_active_idx')
    .on(t.flightAttemptId, t.invitedEmail)
    .where(sql`${t.acceptedAt} IS NULL AND ${t.revokedAt} IS NULL`),
  tokenIdx: index('debrief_invite_token_idx').on(t.token),
}));
```

Plus `display_order INTEGER NOT NULL DEFAULT 0` added to existing `syllabusNode`, and `author_user_id TEXT REFERENCES bauth_user.id` added to existing `syllabus`. Existing rows backfill `display_order = 0` (ACS rows are ordered by `code`).

## API surface

### Account roles

```typescript
// libs/bc/study/src/account-roles.ts
export async function getUserRoles(userId: string, db?: Db): Promise<UserRoles>;
export async function hasRole(userId: string, role: AccountRole, db?: Db): Promise<boolean>;
export async function requireStudent(userId: string, db?: Db): Promise<void>;
export async function requireTeacher(userId: string, db?: Db): Promise<void>;
export async function grantRole(input: GrantRoleInput, db?: Db): Promise<void>;
export async function revokeRole(userId: string, role: AccountRole, db?: Db): Promise<void>;
export async function setRoleMetadata(input: SetRoleMetadataInput, db?: Db): Promise<void>;
```

### Student-side flight evidence

```typescript
// libs/bc/study/src/flight-attempts.ts
export async function createFlightAttempt(input: CreateFlightAttemptInput, db?: Db): Promise<FlightAttemptRow>;
export async function getFlightAttempt(id: string, userId: string, db?: Db): Promise<FlightAttemptWithManeuvers | null>;
export async function listFlightAttempts(userId: string, filters?: ListFilters, db?: Db): Promise<FlightAttemptRow[]>;
export async function updateFlightAttempt(input: UpdateFlightAttemptInput, db?: Db): Promise<FlightAttemptRow>;
export async function softDeleteFlightAttempt(id: string, userId: string, db?: Db): Promise<void>;
export async function addManeuver(input: AddManeuverInput, db?: Db): Promise<FlightManeuverRow>;
export async function updateManeuverSelfAssessment(input: UpdateManeuverInput, db?: Db): Promise<FlightManeuverRow>;
export async function deleteManeuver(id: string, userId: string, db?: Db): Promise<void>;
```

### Teacher-side

```typescript
// libs/bc/study/src/teacher-writes.ts
export async function setTeacherAssessment(input: SetTeacherAssessmentInput, db?: Db): Promise<FlightManeuverRow>;
export async function setTeacherStudentLinkStatus(input: SetTeacherStudentLinkStatusInput, db?: Db): Promise<TeacherStudentLinkRow>;

// libs/bc/study/src/teaching-syllabus-writes.ts
export async function createTeachingSyllabus(input: CreateTeachingSyllabusInput, db?: Db): Promise<SyllabusRow>;
export async function addLessonToSyllabus(input: AddLessonInput, db?: Db): Promise<SyllabusNodeRow>;
export async function removeLessonFromSyllabus(syllabusNodeId: string, teacherUserId: string, db?: Db): Promise<void>;
export async function reorderLessons(syllabusId: string, orderedLeafIds: readonly string[], teacherUserId: string, db?: Db): Promise<void>;

// libs/bc/study/src/teacher-links.ts
export async function listMyTeachers(studentUserId: string, db?: Db): Promise<TeacherStudentLinkRow[]>;
export async function listMyStudents(teacherUserId: string, db?: Db): Promise<TeacherStudentLinkRow[]>;
export async function getActiveTeacherLink(teacherUserId: string, studentUserId: string, db?: Db): Promise<TeacherStudentLinkRow | null>;
export async function assertTeacherLink(teacherUserId: string, studentUserId: string, db?: Db): Promise<void>;
```

All teacher writes call `assertTeacherLink(teacherUserId, studentUserId, db)` or `assertSyllabusAuthor(syllabusId, teacherUserId, db)` first.

### Debrief invite + magic link

```typescript
// libs/bc/study/src/debrief-invites.ts
export async function createDebriefInvite(input: CreateDebriefInviteInput, db?: Db): Promise<DebriefInviteRow>;
export async function getDebriefInviteByToken(token: string, db?: Db): Promise<DebriefInviteRow | null>;
export async function acceptDebriefInvite(input: AcceptDebriefInviteInput, db?: Db): Promise<{ user: BauthUser; invite: DebriefInviteRow }>;
export async function revokeDebriefInvite(input: RevokeDebriefInviteInput, db?: Db): Promise<void>;
```

`acceptDebriefInvite` is the integration point with better-auth's magic-link plugin:

1. Validate the token exists, hasn't been accepted/revoked, hasn't expired.
2. Use better-auth `auth.api.signInEmail` (magic-link verify variant) to either sign in an existing `bauth_user` matched on email OR create a new one.
3. If new user: insert into `bauth_user`. (No password required; magic-link is the auth. Per Decision 8: the UX never says "create your account.")
4. Auto-grant `teacher` role via `grantRole(userId, 'teacher', { kind: 'cfi', certificates_verified: false })` (Decision 10 -- default kind = `'cfi'`; teacher can edit later via settings).
5. Mark invite `accepted_at` + `accepted_user_id`. **Do NOT create a `teacher_student_link`** (Decision 9 -- the debrief is one-flight only; durable relationships are opt-in).
6. Audit each step.

### Track parsing

```typescript
// libs/bc/study/src/flight-tracks/parser.ts
export function parseFlightTrack(bytes: Uint8Array, format: TrackFormat): ParsedTrack;
// libs/bc/study/src/flight-tracks/upload.ts
export async function uploadTrack(input: UploadTrackInput, db?: Db): Promise<FlightTrackRow>;
```

## Component structure

```text
apps/study/src/routes/(app)/flight/
  +page.server.ts                      # list of attempts
  +page.svelte
  new/+page.server.ts +page.svelte     # create form
  [id]/+page.server.ts +page.svelte    # detail / edit
  [id]/_components/
    AttemptHeader.svelte
    ManeuverList.svelte
    ManeuverForm.svelte                # dynamic per maneuver kind
    TrackUpload.svelte
    TrackViewer.svelte                 # Leaflet map
    InviteTeacherDialog.svelte         # creates debrief_invite

apps/study/src/routes/(app)/teach/
  +page.server.ts +page.svelte         # entry / fallback for users without teacher role
  students/+page.server.ts             # teacher's student list
  students/[studentId]/...
  syllabus/+page.server.ts             # teaching syllabus authoring
  syllabus/_components/
    LessonList.svelte                  # drag-handle reorder
    LessonRow.svelte
  debrief/[token]/+page.server.ts      # PUBLIC route gated only by token
  debrief/[token]/+page.svelte         # magic-link debrief surface; no "create account" wording
```

## Drag-handle reorder pattern

`LessonList.svelte` uses native HTML5 drag and drop:

- On `dragstart`: capture the dragged lesson id.
- On `dragover`: visually indicate insertion point.
- On `drop`: compute new ordering, optimistically update local state, fire `reorderLessons` form action.
- On error: revert to last-known-good ordering, show a toast.

A `<button class="drag-handle">` is the visible affordance per row. Keyboard alternative: `↑`/`↓` on a focused lesson moves it up/down; same `reorderLessons` call. Per WAI-ARIA this is the correct pattern for keyboard reorder accessibility.

## Magic-link UX guarantee

The phrase **"create your account"** must not appear anywhere in the debrief flow. Specifically:

- The email body says: "[inviter] would like your feedback on a flight." Never "you've been invited to create an account."
- The debrief landing page (`/teach/debrief/[token]`) says "Welcome -- leave feedback below." If the user doesn't have an account yet, the magic-link plugin creates one server-side; the page never asks the teacher to set a password or pick a username.
- After saving feedback, the page says "Thanks. Your feedback has been sent to Joshua." Optional: "If you'd like to track this student going forward, [link to make-this-regular page]." That link is the optional upgrade to `teacher_student_link`.

This is a UX guarantee, not a backend guarantee. The backend has a real `bauth_user` row + `teacher` role + audit trail.

## Hangar invite extension (existing) -- minor change

The `hangar.invitation` table from the existing hangar-invite-flow WP keeps its shape. **No new fields added by this WP** (the previous design proposed `relationship_kind` + `relationship_payload_json`, but the magic-link debrief flow handles teacher invites end-to-end via `study.debrief_invite` and doesn't need to extend `hangar.invitation`).

The two flows now coexist:

- `hangar.invitation` -- admin-controlled invites granting study access (existing).
- `study.debrief_invite` -- student-controlled invites granting one-flight teacher access (new).

## Audit shape

Per existing pattern. New `AUDIT_TARGETS`:

- `'study.account_role'`
- `'study.flight_attempt'`
- `'study.flight_maneuver'`
- `'study.flight_track'`
- `'study.teacher_student_link'`
- `'study.teaching_syllabus'`
- `'study.debrief_invite'`

Reorder audit captures full `orderedLeafIds` in `metadata.newOrder`. Magic-link account creation emits two audit rows: one for `bauth_user` creation (from better-auth), one for `account_role` grant.

## Performance

- `getNodeEvidenceStateMap` gains one fan-out query. Indexed on `(syllabus_node_id, user_id)` and `(node_id, user_id)`. Adds < 10 ms on a seeded user.
- `account_role` lookups are PK lookups. Sub-millisecond.
- Track upload parses synchronously on the server. Reasonable file (1 MB GPX) parses in < 100 ms. > 25 MB rejected at the upload layer.
- Track viewer renders client-side; large tracks (10k+ points) downsample to ~500 points for rendering. Full data preserved in cache file.
- `acceptDebriefInvite` does ~5 INSERTs in one transaction. Sub-100 ms.

## Security

- All BC writes audit.
- All teacher writes gate on `assertTeacherLink` or `assertSyllabusAuthor`.
- All role grants/revokes audit.
- GPS track files stored under per-user paths; `getFlightTrack` BC checks ownership before returning the cache path.
- Track download via server route that checks ownership and streams bytes -- no direct client access to cache directory.
- `teacher_notes` on `teacher_student_link` is private to the teacher; student does not see it.
- `debrief_invite.token` is opaque random (32 bytes base64url); single-use after acceptance.
- Magic-link follows better-auth's standard security: tokens expire, are single-use, rate-limited.
- The debrief route is the **only** non-auth-gated mutation surface in study; the route layer explicitly allows `/teach/debrief/[token]` past the auth gate.

## Migration plan

Single forward migration that:

1. Adds `study.account_role` table + checks.
2. Adds `study.flight_attempt`, `study.flight_maneuver`, `study.flight_track` tables + indexes + checks.
3. Adds `study.teacher_student_link` table + indexes + checks.
4. Adds `study.debrief_invite` table + indexes.
5. Adds `display_order INTEGER NOT NULL DEFAULT 0` to `syllabus_node`.
6. Adds `author_user_id TEXT REFERENCES bauth_user.id` to `syllabus`.
7. Widens `study.syllabus.kind` CHECK to include `'teaching'`.
8. Widens `audit.audit_log.target_type` enum to include the new targets.
9. **Backfill `account_role` for existing users:** insert `(user_id, 'student', '{"studying_for": null}')` for every existing `bauth_user` -- preserves existing behavior (everyone is a student by default).

Per project convention: `db push` is the runtime apply path. Migration is generated for diff-accuracy.

## Forward compatibility

- **Multi-teacher dashboards** (Decision 7) ship with this WP; the dropdown auto-appears when the data demands it. No future schema change needed.
- **Auto-maneuver-detection from GPS tracks** (out of scope) ships as an additional service that writes proposed `flight_maneuver` rows for student review. No schema change.
- **Cloud-storage adapter** (out of scope) is a single function swap behind `flight_track.cache_path` resolution.
- **Endorsement / 8710 / FAA logbook integration** would extend on top of `flight_attempt` + a new `endorsement` table. Future WP.
- **Billing.** A future `subscription` table FKs into `account_role(user_id, role)`. Per-role subscriptions (student-only, teacher-only, both) work without schema surgery. The `account_role.metadata` jsonb can grow per-role billing-related fields (`stripe_customer_id`, `plan`) as part of that future WP.
- **Certificate verification.** When CFI legitimacy matters (monetization, marketplace, etc.), verification flips `account_role.metadata.certificates_verified` to `true` after document upload + admin review. No schema change.
- **Mentor / peer roles.** The `kind` field on `teacher_student_link` already supports `'mentor'` and `'peer'`. UX for non-CFI teachers can ship as content / copy changes, not schema.
