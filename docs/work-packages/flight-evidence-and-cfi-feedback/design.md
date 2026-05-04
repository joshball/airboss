---
title: 'Design: Flight evidence and CFI feedback'
product: study
feature: flight-evidence-and-cfi-feedback
type: design
status: draft
review_status: pending
created: 2026-05-04
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

### Decision 5: CFI / student edge is independent of role

A user is a CFI not because of their `role` value, but because they have a row in `cfi_student_link.cfi_user_id`. This:

- Lets any user become a CFI without an admin promotion.
- Avoids tangling the role enum (which is about app-level permissions: study user / hangar admin / etc.) with the teaching relationship (which is per-student).
- Supports a single user being a student of one CFI and a CFI of another simultaneously.

The "teaching" surfaces (`/teach/...`) check `listMyStudents(callerId).length > 0` to gate visibility. Per-route `requireCfi` helper.

### Decision 6: Evidence credit rule

A maneuver counts toward the Practiced pill if and only if `cfi_assessment = 'satisfactory'`. A self-assessed maneuver counts as `covered` but not `mastered`. This means:

- The `coveredLeaves` count includes leaves with self-assessed maneuvers.
- The `masteredLeaves` count includes only leaves with CFI-signed maneuvers.
- The `getNodeEvidenceState` `demonstration` gate computes `passing` from CFI-signed only; `attempts` includes self-assessed too.

Rationale: a CFI's signoff is the actual ACS standard. Self-assessment matters for "you did the thing" but not for "you can do the thing to standard."

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
  cfiAssessment: text('cfi_assessment'),
  cfiNotes: text('cfi_notes'),
  cfiSignedOffBy: text('cfi_signed_off_by').references(() => bauthUser.id),
  cfiSignedOffAt: timestamp('cfi_signed_off_at'),
  createdAt: timestamp('created_at').notNull().defaultNow(),
  updatedAt: timestamp('updated_at').notNull().defaultNow(),
}, (t) => ({
  attemptIdx: index('flight_maneuver_attempt_idx').on(t.flightAttemptId),
  leafUserIdx: index('flight_maneuver_leaf_user_idx').on(t.syllabusNodeId, t.userId),
  nodeUserIdx: index('flight_maneuver_node_user_idx').on(t.nodeId, t.userId),
  kindCheck: check('flight_maneuver_kind_check', sql`${t.kind} IN (${sql.raw(MANEUVER_KIND_VALUES.map(v => `'${v}'`).join(','))})`),
  selfAssessmentCheck: check('flight_maneuver_self_check', sql`${t.selfAssessment} IN ('satisfactory','needs_work','unable')`),
  cfiAssessmentCheck: check('flight_maneuver_cfi_check', sql`${t.cfiAssessment} IS NULL OR ${t.cfiAssessment} IN ('satisfactory','needs_work','unable')`),
  cfiTrioCheck: check('flight_maneuver_cfi_trio_check', sql`(${t.cfiAssessment} IS NULL) = (${t.cfiSignedOffBy} IS NULL) AND (${t.cfiAssessment} IS NULL) = (${t.cfiSignedOffAt} IS NULL)`),
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

export const cfiStudentLink = study.table('cfi_student_link', {
  id: text('id').primaryKey(),
  cfiUserId: text('cfi_user_id').notNull().references(() => bauthUser.id),
  studentUserId: text('student_user_id').notNull().references(() => bauthUser.id),
  status: text('status').notNull(),
  startedAt: timestamp('started_at').notNull().defaultNow(),
  endedAt: timestamp('ended_at'),
  cfiNotes: text('cfi_notes'),
  createdAt: timestamp('created_at').notNull().defaultNow(),
  updatedAt: timestamp('updated_at').notNull().defaultNow(),
}, (t) => ({
  uniqueActive: uniqueIndex('cfi_student_link_active_idx').on(t.cfiUserId, t.studentUserId).where(sql`${t.status} = 'active'`),
  cfiIdx: index('cfi_student_link_cfi_idx').on(t.cfiUserId),
  studentIdx: index('cfi_student_link_student_idx').on(t.studentUserId),
}));
```

Plus a `display_order INTEGER NOT NULL DEFAULT 0` added to existing `syllabusNode`, and an `author_user_id TEXT REFERENCES bauth_user.id` added to existing `syllabus`. Existing rows backfill `display_order = 0` (acceptable; ACS rows are ordered by `code`).

## API surface

### Student-side

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

### CFI-side

```typescript
// libs/bc/study/src/cfi-writes.ts
export async function setCfiAssessment(input: SetCfiAssessmentInput, db?: Db): Promise<FlightManeuverRow>;
export async function setStudentLinkStatus(input: SetStudentLinkStatusInput, db?: Db): Promise<CfiStudentLinkRow>;

// libs/bc/study/src/cfi-syllabus-writes.ts
export async function createTeachingSyllabus(input: CreateTeachingSyllabusInput, db?: Db): Promise<SyllabusRow>;
export async function addLessonToSyllabus(input: AddLessonInput, db?: Db): Promise<SyllabusNodeRow>;
export async function removeLessonFromSyllabus(syllabusNodeId: string, cfiUserId: string, db?: Db): Promise<void>;
export async function reorderLessons(syllabusId: string, orderedLeafIds: readonly string[], cfiUserId: string, db?: Db): Promise<void>;
```

All CFI writes call `assertCfiLink(cfiUserId, studentUserId, db)` or `assertSyllabusAuthor(syllabusId, cfiUserId, db)` as the first action.

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

apps/study/src/routes/(app)/teach/
  students/+page.server.ts              # CFI's student list
  students/[studentId]/...
  syllabus/+page.server.ts             # CFI syllabus authoring
  syllabus/_components/
    LessonList.svelte                   # drag-handle reorder
    LessonRow.svelte
```

## Drag-handle reorder pattern

`LessonList.svelte` uses native HTML5 drag and drop (`draggable="true"`, `dragstart`, `dragover`, `drop`):

- On `dragstart`: capture the dragged lesson id.
- On `dragover`: visually indicate insertion point.
- On `drop`: compute new ordering, optimistically update local state, fire `reorderLessons` form action.
- On error: revert to last-known-good ordering, show a toast.

A `<button class="drag-handle">` is the visible affordance per row; the entire row is draggable but only when the handle is the drag source (HTML5 quirk: set `draggable` on the row, but check `event.target` matches `.drag-handle` in `dragstart` to allow the drag).

Keyboard alternative: `↑` / `↓` on a focused lesson moves it up / down; same `reorderLessons` call.

## Hangar invite extension

The existing `hangar.invitation` table gains:

- `relationship_kind` (text, nullable) -- `'cfi_student_link'` or NULL.
- `relationship_payload_json` (jsonb, nullable) -- `{ "cfiUserId": "..." }` for the CFI link case.

`acceptInvitation` checks the `relationship_*` fields and, if present, creates the corresponding row in the same transaction. Single-author for now -- the inviter is the future CFI.

## Audit shape

Per existing pattern. New `AUDIT_TARGETS`:

- `'study.flight_attempt'`
- `'study.flight_maneuver'`
- `'study.flight_track'`
- `'study.cfi_student_link'`
- `'study.teaching_syllabus'`

Reorder audit captures the full `orderedLeafIds` in `metadata.newOrder`. Diffs are computed by readers of the audit log; we don't store deltas.

## Performance

- `getNodeEvidenceStateMap` gains one fan-out query. The query is indexed on `(syllabus_node_id, user_id)` and `(node_id, user_id)`. Adds < 10 ms on a seeded user.
- Track upload parses synchronously on the server. Reasonable file (1 MB GPX) parses in < 100 ms. > 25 MB rejected at the upload layer.
- Track viewer renders client-side; large tracks (10k+ points) get downsampled to ~500 points for rendering. Full data preserved in the cache file.

## Security

- All BC writes audit.
- All CFI writes gate on `assertCfiLink` or `assertSyllabusAuthor`.
- GPS track files are stored under per-user paths; the `getFlightTrack` BC checks ownership before returning the cache path.
- Track download is via a signed URL or via a server route that checks ownership and streams the bytes -- no direct client access to the cache directory.
- The `cfi_notes` field on `cfi_student_link` is private to the CFI; the student does not see it.

## Migration plan

Single forward migration that:

1. Adds `flight_attempt`, `flight_maneuver`, `flight_track`, `cfi_student_link` tables + indexes + checks.
2. Adds `display_order INTEGER NOT NULL DEFAULT 0` to `syllabus_node`.
3. Adds `author_user_id TEXT REFERENCES bauth_user.id` to `syllabus`.
4. Widens `audit.audit_log.target_type` enum to include the new targets.
5. Extends `hangar.invitation` with `relationship_kind` + `relationship_payload_json`.

Per project convention: `db push` is the runtime apply path. The migration is generated for diff-accuracy.

## Forward compatibility

- Multi-CFI dashboards (open question 7) can ship later without schema change.
- Auto-maneuver-detection from GPS tracks (out of scope for v1) can ship as an additional service that writes proposed `flight_maneuver` rows for student review.
- Cloud-storage adapter (open question 3) is a single function swap behind `flight_track.cache_path` resolution.
- Endorsement / 8710 / FAA logbook integration would extend on top of the `flight_attempt` row but is its own large WP.
