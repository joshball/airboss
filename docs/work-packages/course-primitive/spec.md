---
title: 'Spec: Course Primitive'
product: study
feature: course-primitive
type: spec
status: unread
---

# Spec: Course Primitive

Establishes Course as a first-class primitive peer to Syllabus, both consumed by Goal. Operationalizes the 2026-05-08 refinement to [ADR 016](../../decisions/016-cert-syllabus-goal-model/decision.md) and principle 11 of [LEARNING_PHILOSOPHY.md](../../platform/LEARNING_PHILOSOPHY.md): the FAA authors syllabi, instructors author courses, learners author goals; cert-vs-course overlay is a render-time lens computation, not authored data.

## Why this WP exists

The cert-syllabus WP shipped `syllabus`, `syllabus_node`, `syllabus_node_link`, `goal`, `goal_syllabus`, and `goal_node` tables. `syllabus.kind` includes `school` and `personal` placeholders, but the `syllabus_node` shape is rigorously ACS/PTS-shaped (area / task / element / section levels, K/R/S triad, edition-locked, immutable per FAA edition). Authoring an instructor course in that table fights every constraint:

- Course hierarchy uses pedagogical levels (section, step), not regulatory ones
- Course nodes need optional structural metadata (transition framing, narrative body) that ACS rows do not carry
- Courses are mutable; ACS rows are edition-locked
- Course author intent is pedagogical, not regulatory citation

A Course primitive lets each side stay clean: syllabi keep their FAA-shape; courses get a shape designed for instructor pedagogy; goals compose them as peers; the lens computes the overlay (cert gap detection on a course tree) at render time.

## Scope

In:

- Three new tables: `study.course`, `study.course_step`, `study.goal_course`
- One existing-table extension: `knowledge_node.kind` text column with constants enum
- Two new lenses: `courseLens` (single-course tree) and `courseWithCertOverlayLens` (course tree with cert gap overlay)
- Lens type extension: optional `sources` field on `LensTreeNode` and `LensLeaf` for overlay tagging (additive; existing acsLens / domainLens consumers unaffected)
- YAML authoring pipeline: `course/courses/<slug>/manifest.yaml` + `course/courses/<slug>/sections/*.yaml` (one file per section; steps inline)
- Seed handler: `bun run db seed courses` (idempotent, content-hashed)
- Validator: dangling knowledge_node refs, parent-child cycles, duplicate ordinals, dangling syllabus FKs in overlay test scenarios
- Constants: `COURSE_KINDS`, `COURSE_STATUSES`, `COURSE_STEP_LEVELS`, `KNOWLEDGE_NODE_KINDS`, plus value arrays and labels
- Routes: `ROUTES.COURSES`, `ROUTES.COURSE(slug)`, `ROUTES.COURSE_STEP(slug, stepCode)` (definitions only; pages land in a follow-on UI WP)
- One BC helper: `getCourseGaps(goalId, courseId, syllabusId)` returning under-covered cert leaves
- Migration guard: any pre-existing `syllabus.kind IN ('school', 'personal')` row gets surfaced via a one-shot diagnostic; no automatic data migration (research confirmed zero rows; the guard is defensive)

Out (explicitly deferred until real authoring use surfaces the need):

- Course-to-course prerequisites (no `course_prereq` table)
- Parallel-ladder schema as table-level (no `track` column on `course_step`; tracks remain an authoring convention only)
- Aux course attachment points (no `course_aux_link` table)
- Per-node opt-out (`goal_node_exclusion`)
- Mutability/versioning semantics for courses (every course edit is in-place; goals do not pin to a course version)
- Personal/learner-authored courses through the UI (`COURSE_KINDS.PERSONAL` reserved as a value but only `INSTRUCTOR` is authored in this WP)
- Author-declared `cert_alignment` on courses (overlay is goal-driven, not course-declared, per principle 11)
- Course-step UI surfaces (read-only lens output is sufficient for content authoring + the next WP that authors weather content)
- Custom course-step `kind` beyond what `knowledge_node.kind` already carries (no `course_step.step_kind`; the linked node's kind is the source of truth)

## Anchor docs

- [ADR 016 -- decision.md](../../decisions/016-cert-syllabus-goal-model/decision.md), especially "Refinement: Course as a peer primitive (2026-05-08)"
- [LEARNING_PHILOSOPHY.md](../../platform/LEARNING_PHILOSOPHY.md), principle 11
- [cert-syllabus-and-goal-composer/spec.md](../cert-syllabus-and-goal-composer/spec.md) -- the syllabus side this parallels
- [libs/bc/study/src/schema.ts](../../../libs/bc/study/src/schema.ts) lines 1816+ -- shipped syllabus/goal schema
- [libs/bc/study/src/lenses.ts](../../../libs/bc/study/src/lenses.ts) -- existing lens framework

## Architecture overview

```text
┌──────────────────────────────────────────────────────────────────┐
│  Goal (learner-owned)                                            │
│  references: syllabi (existing) + courses (new) + ad-hoc nodes   │
├──────────────────────────────────────────────────────────────────┤
│  Course                  Syllabus                                │
│  instructor-authored     FAA-authored (existing)                 │
│  mutable                 edition-locked                          │
│  course_step tree        syllabus_node tree                      │
├──────────────────────────────────────────────────────────────────┤
│  Knowledge graph (existing)                                      │
│  knowledge_node.kind: concept | procedure | case_study |         │
│                       transition | reference_anchor              │
└──────────────────────────────────────────────────────────────────┘

Lens layer:
  acsLens                       (existing) syllabus tree
  domainLens                    (existing) domain tree
  courseLens                    (new) course tree
  courseWithCertOverlayLens     (new) course tree + per-step cert flag + gap list
```

## Data model

### `study.course`

Instructor-authored pedagogy artifact. Mutable. Not edition-versioned.

| Column        | Type        | Constraints                                                 | Notes                                                    |
| ------------- | ----------- | ----------------------------------------------------------- | -------------------------------------------------------- |
| `id`          | text        | PK                                                          | `crs_` prefix.                                           |
| `slug`        | text        | NOT NULL, UNIQUE, CHECK kebab-case shape                    | `weather-comprehensive`, `advanced-wx-noreasters`.       |
| `kind`        | text        | NOT NULL, CHECK in `COURSE_KIND_VALUES`                     | `instructor` (only authored value); `personal` reserved. |
| `title`       | text        | NOT NULL                                                    | Display name.                                            |
| `description` | text        | NOT NULL, DEFAULT ''                                        | Authoring summary. Markdown allowed.                     |
| `status`      | text        | NOT NULL, DEFAULT 'active', CHECK in `COURSE_STATUS_VALUES` | `draft` / `active` / `archived`.                         |
| `seed_origin` | text        | NULL                                                        | Dev-seed marker.                                         |
| `created_at`  | timestamptz | NOT NULL, DEFAULT now()                                     |                                                          |
| `updated_at`  | timestamptz | NOT NULL, DEFAULT now()                                     |                                                          |

Indexes: `(kind, status)`, partial `(status)` where `status='active'`.

### `study.course_step`

The tree. Two structural levels: `section` (top-level grouping) and `step` (leaf).

| Column              | Type        | Constraints                                           | Notes                                                                    |
| ------------------- | ----------- | ----------------------------------------------------- | ------------------------------------------------------------------------ |
| `id`                | text        | PK                                                    | `cst_` prefix.                                                           |
| `course_id`         | text        | NOT NULL, FK `study.course.id` ON DELETE CASCADE      |                                                                          |
| `parent_id`         | text        | NULL, FK `study.course_step.id` ON DELETE CASCADE     | NULL for sections; the section for steps. Two-level tree only.           |
| `level`             | text        | NOT NULL, CHECK in `COURSE_STEP_LEVEL_VALUES`         | `section` / `step`.                                                      |
| `ordinal`           | integer     | NOT NULL, CHECK >= 0                                  | Stable within-parent sort order.                                         |
| `code`              | text        | NOT NULL                                              | Free-form authoring code (`s1`, `s1.3`). Unique within a course.         |
| `title`             | text        | NOT NULL                                              |                                                                          |
| `body_md`           | text        | NOT NULL, DEFAULT ''                                  | Step-level framing prose. Markdown. Renders before the linked node body. |
| `knowledge_node_id` | text        | NULL, FK `study.knowledge_node.id` ON DELETE RESTRICT | Required on `level='step'` rows; NULL on `level='section'`.              |
| `is_leaf`           | boolean     | NOT NULL, DEFAULT false                               | Maintained by seed (steps are leaves; sections aren't).                  |
| `content_hash`      | text        | NULL                                                  | SHA-256 of canonicalized YAML for idempotent seed.                       |
| `seed_origin`       | text        | NULL                                                  |                                                                          |
| `created_at`        | timestamptz | NOT NULL, DEFAULT now()                               |                                                                          |
| `updated_at`        | timestamptz | NOT NULL, DEFAULT now()                               |                                                                          |

CHECK consistency:

- `level='section'` requires `parent_id IS NULL` AND `knowledge_node_id IS NULL` AND `is_leaf=false`
- `level='step'` requires `parent_id IS NOT NULL` AND `knowledge_node_id IS NOT NULL` AND `is_leaf=true`

Expressed as a single CHECK using `sql.raw()`:

```sql
(("level" = 'section'
  AND "parent_id" IS NULL
  AND "knowledge_node_id" IS NULL
  AND "is_leaf" = false)
 OR
 ("level" = 'step'
  AND "parent_id" IS NOT NULL
  AND "knowledge_node_id" IS NOT NULL
  AND "is_leaf" = true))
```

Unique: `(course_id, code)`. Indexes: `(course_id, parent_id, ordinal)` for tree walks; `(knowledge_node_id)` for reverse lookup ("which courses reference this node?").

### `study.goal_course`

Many-to-many between goals and courses. Mirrors `goal_syllabus` shape.

| Column        | Type        | Constraints                                                       | Notes                              |
| ------------- | ----------- | ----------------------------------------------------------------- | ---------------------------------- |
| `goal_id`     | text        | NOT NULL, FK `study.goal.id` ON DELETE CASCADE                    |                                    |
| `course_id`   | text        | NOT NULL, FK `study.course.id` ON DELETE RESTRICT                 |                                    |
| `weight`      | real        | NOT NULL, DEFAULT 1.0, CHECK weight range matches `goal_syllabus` | Per-link emphasis for rollup math. |
| `seed_origin` | text        | NULL                                                              |                                    |
| `created_at`  | timestamptz | NOT NULL, DEFAULT now()                                           |                                    |

Composite PK on `(goal_id, course_id)`. Reverse index on `(course_id)` for "what goals reference this course?".

### `knowledge_node.kind` (column extension)

| Column | Type | Constraints                                                        | Notes                                                              |
| ------ | ---- | ------------------------------------------------------------------ | ------------------------------------------------------------------ |
| `kind` | text | NOT NULL, DEFAULT 'concept', CHECK in `KNOWLEDGE_NODE_KIND_VALUES` | Backfilled to `'concept'` on every existing row at migration time. |

Values: `concept` / `procedure` / `case_study` / `transition` / `reference_anchor`.

The lens layer reads this column to render transition steps with different framing (the UI presentation is a follow-on WP; this WP only ships the data shape). The seed validator does NOT require nodes referenced by a course step to be a particular kind; the kind is informational, not gating.

### Existing `syllabus.kind='school'` and `'personal'` rows

Research confirmed zero such rows exist in the shipped data (every seeded syllabus is `kind='acs'` or `kind='pts'`). Defensively, this WP ships a one-shot diagnostic script (`bun run db diagnose:school-personal-syllabi`) that lists any such rows. If non-zero rows surface, the human (Joshua) decides per-row whether to leave them, archive them, or hand-migrate to `study.course`. No automatic data migration runs as part of the seed pipeline.

## Behavior

### Course YAML authoring

Mirrors the syllabus authoring layout. One directory per course under `course/courses/<slug>/`, with a top-level `manifest.yaml` and one YAML file per section under `sections/`:

```text
course/courses/weather-comprehensive/
  manifest.yaml
  sections/
    s1-airmass-character.yaml
    s2-pressure-systems.yaml
    s3-fronts-and-occlusions.yaml
    ...
```

`manifest.yaml`:

```yaml
slug: weather-comprehensive
kind: instructor
title: Weather, Comprehensive
status: active
description: |
  Instructor-authored course covering weather concepts from PPL fundamentals
  through CFII teaching depth. Sequenced for discovery-first learning.
```

`sections/s1-airmass-character.yaml`:

```yaml
code: s1
title: Airmass Character
ordinal: 1
body_md: |
  We start with airmass thinking because every other weather concept is a
  story about how airmasses move and interact. ...
steps:
  - code: s1.1
    ordinal: 1
    title: Continental polar in winter
    body_md: |
      Cold, dry, stable. The reason your runup tells the truth in
      January Minneapolis. ...
    knowledge_node_id: wx-airmass-continental-polar
  - code: s1.2
    ordinal: 2
    title: Maritime tropical in summer
    body_md: |
      Warm, moist, unstable. ...
    knowledge_node_id: wx-airmass-maritime-tropical
  - code: s1.3
    ordinal: 3
    title: Transition - airmass to frontal thinking
    body_md: |
      Bridge from the four basic airmasses to how they collide. ...
    knowledge_node_id: wx-airmass-frontal-transition
```

The seed pipeline reads each `course/courses/<slug>/`, upserts the `course` row, walks `sections/*.yaml`, upserts `course_step` rows (sections first, then their child steps), and validates. Idempotent and content-hashed: an unchanged YAML file produces zero writes.

### Seed validator rejections

| Condition                                                                   | Reject reason                                                     |
| --------------------------------------------------------------------------- | ----------------------------------------------------------------- |
| `course.slug` doesn't match `^[a-z0-9][a-z0-9-]{1,62}[a-z0-9]$`             | `course slug 'X' fails kebab-case shape`                          |
| Two sections in the same course share an `ordinal`                          | `duplicate ordinal in course 'X' sections`                        |
| Two steps in the same section share an `ordinal`                            | `duplicate ordinal in section 'X.s1' steps`                       |
| Two `course_step` rows in the same course share a `code`                    | `duplicate code 'X' in course 'Y'`                                |
| A step's `knowledge_node_id` does not exist                                 | `course step 'X.s1.3' references missing knowledge_node 'wx-foo'` |
| A section row carries `knowledge_node_id`                                   | `section 'X.s1' must not carry knowledge_node_id`                 |
| A step row omits `knowledge_node_id`                                        | `step 'X.s1.3' must carry knowledge_node_id`                      |
| `course.kind` is not in `COURSE_KIND_VALUES`                                | `course kind 'X' is not allowed`                                  |
| `course.kind = 'personal'` (reserved but not authorable in this WP)         | `course kind 'personal' is reserved; authoring deferred`          |
| Parent-child cycle (impossible with two-level tree but checked defensively) | `cycle in course 'X' tree`                                        |

### Goal composition

A learner can hold any combination of:

- `goal_syllabus` rows (cert ACS/PTS) -- existing
- `goal_course` rows (instructor courses) -- new
- `goal_node` rows (ad-hoc nodes) -- existing

The session engine's `getGoalNodeUnion(goalId)` walks all three sources to produce the reachable node set + per-node weights. This WP extends `getGoalNodeUnion` to include course-linked nodes via `goal_course -> course_step -> knowledge_node_id` (steps only; sections contribute no node).

### Lens behavior

#### `courseLens`

- Input: `goalId`, `courseId`
- Output: `LensResult` with `tree` containing one root `LensTreeNode` (level: `'course'`) per course, with section children, with leaf steps under each section
- Each step's `LensLeaf.knowledgeNodeId` is the linked node; mastery flows through `getNodeEvidenceStateMap` (same machinery the domain lens uses for non-syllabus leaves)
- Section rollup aggregates child step mastery via `computeMasteryRollup`
- Goal-weight applied: each step's effective weight is `goal_course.weight * 1.0` (no per-step weight in this WP)
- When `goalId` is null (anonymous browse), returns the tree with empty mastery

#### `courseWithCertOverlayLens`

- Input: `goalId`, `courseId`, `syllabusId`
- Output: same tree shape as `courseLens` PLUS each step's `LensLeaf.sources` field is set to `{ inCourse: true, inCert: <bool>, certCode: <syllabus_node.code | undefined> }`
- The `inCert` flag: true when the step's `knowledge_node_id` appears in any `syllabus_node_link.knowledge_node_id` rooted under `syllabusId`; false otherwise
- The result also carries a separate `certGaps` array on `LensResult` (additive field): every `syllabus_node` (level `element`, `is_leaf=true`) under `syllabusId` whose `knowledge_node_id` does NOT appear in any course step. Each gap entry: `{ syllabusNodeId, code, title, requiredBloom, knowledgeNodeIds }`
- Used to render the gap surface: "this course covers X and Y of PPL ACS; PPL still requires Z"

#### Type extension

```typescript
// libs/bc/study/src/lenses.ts (additive)
export interface LensLeafSources {
  inCourse: boolean;
  inCert: boolean;
  certCode?: string;
}

export interface LensLeaf {
  // existing fields unchanged
  sources?: LensLeafSources;
}

export interface LensResult {
  // existing fields unchanged
  certGaps?: CertGap[];
}

export interface CertGap {
  syllabusNodeId: string;
  code: string;
  title: string;
  requiredBloom: BloomLevel | null;
  knowledgeNodeIds: string[];
}
```

`LensTreeNode.level` enum extended to include `'course'` and `'section'` (additive).

Existing `acsLens` / `domainLens` consumers see no behavior change: the `sources` and `certGaps` fields are optional, and `acsLens` / `domainLens` do not populate them.

## Validation

| Field                           | Rule                                                                                             |
| ------------------------------- | ------------------------------------------------------------------------------------------------ |
| `course.slug`                   | `^[a-z0-9][a-z0-9-]{1,62}[a-z0-9]$`, unique across all courses                                   |
| `course.kind`                   | One of `COURSE_KIND_VALUES`; only `instructor` authorable in this WP                             |
| `course.title`                  | Non-empty                                                                                        |
| `course.status`                 | One of `COURSE_STATUS_VALUES`                                                                    |
| `course_step.code`              | Non-empty; unique within `course_id`                                                             |
| `course_step.ordinal`           | Integer >= 0; unique within `(course_id, parent_id)`                                             |
| `course_step.level`             | One of `COURSE_STEP_LEVEL_VALUES`; consistency with `parent_id` and `knowledge_node_id` enforced |
| `course_step.knowledge_node_id` | Required iff `level='step'`; must FK to existing `knowledge_node.id`                             |
| `course_step.title`             | Non-empty                                                                                        |
| `goal_course.weight`            | Real in `[GOAL_SYLLABUS_WEIGHT_MIN, GOAL_SYLLABUS_WEIGHT_MAX]` (reuses existing range)           |
| `knowledge_node.kind`           | One of `KNOWLEDGE_NODE_KIND_VALUES`; default `concept` on backfill                               |

## Edge cases

- **Empty course**: a course row with zero `course_step` rows is allowed (draft authoring state). `courseLens` returns the course root with empty children and zero rollup.
- **Section with zero steps**: allowed (draft state). The section's rollup is zero coverage.
- **Step references an archived knowledge_node**: FK is `RESTRICT` on delete, so the node can't be deleted while a step references it. If the node is renamed (id change), the seed pipeline's content_hash check surfaces it as a changed step; the validator errors if the new id doesn't exist.
- **Two courses link the same `knowledge_node_id`**: legal. A node can appear in any number of courses. The reverse-lookup index supports "what courses teach this node?" cheaply.
- **Goal references a course AND a syllabus that both link the same node**: `getGoalNodeUnion` deduplicates by `knowledge_node_id` and keeps the **maximum** weight across reachable paths ("most-prominent context wins"). Matches the existing `goal_syllabus + goal_node` aggregation semantic and the relevance-cache rebuild rule. Course-source paths participate identically.
- **Course in `status='archived'`**: a learner can still hold an `goal_course` row pointing at it (the archive is for authoring, not for runtime gating). The lens renders the course unchanged. Status-aware filtering is the UI's job.
- **Overlay lens on a goal without the requested syllabus**: `courseWithCertOverlayLens(goalId, courseId, syllabusId)` accepts a `syllabusId` that the goal does not reference. The lens computes the overlay against that syllabus regardless. Useful for "what would this course look like if I were pursuing PPL?" exploration.
- **Course step references a node, syllabus also references that node**: `inCert: true` on the step. Mastery is one number per node (not split by source); the existing rollup math applies.
- **Step's linked node has zero authored content (lifecycle='skeleton')**: legal; the lens emits the step with `mastery.covered=false`. UI may show "content authoring in progress." Same semantic as the existing skeleton handling.

## Out of scope

See the "Out" subsection of [Scope](#scope) above. The deferred list is explicitly enumerated so future agents do not accidentally rebuild deferred features:

- Course-to-course prerequisites
- Parallel-ladder schema
- Aux course attachment points
- Per-node opt-out
- Course versioning
- Personal course UI
- Course `cert_alignment` field
- Course step UI surfaces (the read path is the lens; UI is a follow-on WP)

When real authoring use of this WP surfaces a need from this list, it lands as a follow-on WP, not a silent extension here.
