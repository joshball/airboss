---
title: 'Design: Course Primitive'
product: study
feature: course-primitive
type: design
status: unread
---

# Design: Course Primitive

Technical decisions and architecture for [spec.md](./spec.md). The spec carries the WHAT; this doc carries the HOW and the WHY.

## Two tables, not one

The single most important decision: keep `study.syllabus` (FAA-shaped) and `study.course` (instructor-shaped) as two distinct tables joined only by `goal_*` rows, rather than widening `syllabus` to absorb courses.

Considered:

1. **Widen `syllabus`**: add `track`, `node_kind`, `mutable`, etc. fields; let `kind='course'` be a new value.
2. **Two tables, joined by goal**: course as a peer entity; goal references both.
3. **Course as a view over syllabus**: implement course shape on top of `syllabus_node` with naming conventions.

Picked: 2.

Reasoning: syllabi are FAA-shaped (`area / task / element` levels, K/R/S triad column, edition-locked semantics, ACS code conventions, `airboss-ref:` identifier required at BC layer). Courses are instructor-shaped (`section / step` levels, mutable, no triad, no edition). The shared shape is genuinely just "tree of nodes that point at knowledge_node ids." Sharing a column-named-after-FAA-structure to model "step body markdown" warps the syllabus semantics for every consumer that legitimately needs ACS shape (cert dashboard, ACS lens, evidence-kind gates).

The two-table cost is small: two parallel join tables on `goal` (`goal_syllabus` exists; `goal_course` is new and identical in shape). The lens layer adds two new lenses but does not modify the existing two. The overlay computation is a render-time read across both tables -- exactly the kind of thing the lens layer was designed for.

## Two-level course tree (section + step), not arbitrary depth

The course tree is exactly two levels: top-level `section` rows (no parent) and child `step` rows (parent points at a section). No sub-sections, no sub-steps.

Considered:

1. **Arbitrary depth** (mirror `syllabus_node` which allows 4 levels)
2. **Two-level only** (section -> step)
3. **Flat list** (no hierarchy; ordinal sorts everything globally)

Picked: 2.

Reasoning: the only courses we need to author in the foreseeable future (weather-comprehensive, advanced-noreasters, etc.) decompose naturally into "weeks" or "modules" containing "lessons" or "steps." Two levels is enough. Arbitrary depth invites authoring complexity (when do you nest? what's the rollup math at each level?) without a use case to justify it. Flat is too sparse: a 60-step course with no grouping has no navigable structure.

When a real course shows up that genuinely needs three levels, this becomes a follow-on WP (add a `subsection` level or change the constraint). Easier to widen than to narrow.

## `knowledge_node.kind` extension lives on the node, not the step

Course steps inherit their semantic kind (concept, transition, case_study, etc.) from the linked `knowledge_node.kind`. The `course_step` table does NOT carry its own `kind` column.

Considered:

1. **Kind on the node** (single source of truth)
2. **Kind on the step** (per-course override possible)
3. **Kind on both** (denormalized; step overrides node when present)

Picked: 1.

Reasoning: a "transition" node is conceptually a transition regardless of which course references it. If two courses both link `wx-airmass-frontal-transition`, both surfaces should render it as a transition. Putting the kind on the step would let course A label it "transition" and course B label it "concept" -- that's authoring drift, not flexibility. The single-source-of-truth on the node also makes the reverse query ("show me all transition nodes I haven't seen") trivially indexable.

The trade-off: course authors lose the ability to "frame" a normally-concept node as a transition just for their course. If real authoring surfaces a need for that, a step-level `framing` text field can be added later (free-form, not enum) without touching the node table.

## Lens type extension is additive, not breaking

`LensLeaf.sources` and `LensResult.certGaps` are optional fields. Existing acsLens / domainLens consumers see no shape change.

Considered:

1. **New `OverlayLensResult` type** (separate from `LensResult`)
2. **Optional fields on existing types** (additive)
3. **Discriminated union** (`LensResult | OverlayLensResult`)

Picked: 2.

Reasoning: the cert dashboard and goal composer already consume `LensResult` from acsLens / domainLens. Forcing them to handle a discriminated union or a new type is breaking churn for zero benefit -- they'd just ignore the overlay fields. Optional fields let new consumers (the future course UI + gap-detection surface) opt in without touching old code paths.

The type extension also future-proofs other overlay scenarios: a "weakness × cert" lens, a "handbook × course" lens, etc. all benefit from `sources` being a generic union of provenance flags.

## Goal composes course + syllabus + ad-hoc as peers

`goal_course` mirrors `goal_syllabus` in shape (composite PK on goal_id + ref_id, weight, seed_origin). The session engine's `getGoalNodeUnion` aggregates all three sources (syllabus, course, ad-hoc node) into a single deduped node set with summed weights.

Considered:

1. **Course as a kind of syllabus** (one join table, syllabus.kind discriminator)
2. **Course as a peer to syllabus** (parallel join tables)
3. **Course wraps syllabi** (course is the spine; syllabus appears as a child / aux)

Picked: 2.

Reasoning: same as the schema decision. Goal sees both as "things I'm consuming"; the lens layer cares about which is which (overlay computation), the engine doesn't (just wants the union of nodes to schedule). Three sources -> one union with summed weights matches the existing pattern; no new aggregation logic is needed.

## Schema

### `study.course`

```typescript
export const course = studySchema.table(
  'course',
  {
    id: text('id').primaryKey(),
    slug: text('slug').notNull(),
    kind: text('kind').notNull(),
    title: text('title').notNull(),
    description: text('description').notNull().default(''),
    status: text('status').notNull().default(COURSE_STATUSES.ACTIVE),
    seedOrigin: text('seed_origin'),
    ...timestamps(),
  },
  (t) => ({
    courseSlugUnique: uniqueIndex('course_slug_unique').on(t.slug),
    courseKindStatusIdx: index('course_kind_status_idx').on(t.kind, t.status),
    kindCheck: check('course_kind_check', sql.raw(`"kind" IN (${inList(COURSE_KIND_VALUES)})`)),
    statusCheck: check('course_status_check', sql.raw(`"status" IN (${inList(COURSE_STATUS_VALUES)})`)),
    slugShapeCheck: check('course_slug_shape_check', sql.raw(`"slug" ~ '^[a-z0-9][a-z0-9-]{1,62}[a-z0-9]$'`)),
  }),
);
```

### `study.course_step`

```typescript
export const courseStep = studySchema.table(
  'course_step',
  {
    id: text('id').primaryKey(),
    courseId: text('course_id')
      .notNull()
      .references(() => course.id, { onDelete: 'cascade' }),
    parentId: text('parent_id').references((): AnyPgColumn => courseStep.id, { onDelete: 'cascade' }),
    level: text('level').notNull(),
    ordinal: integer('ordinal').notNull(),
    code: text('code').notNull(),
    title: text('title').notNull(),
    bodyMd: text('body_md').notNull().default(''),
    knowledgeNodeId: text('knowledge_node_id').references(() => knowledgeNode.id, { onDelete: 'restrict' }),
    isLeaf: boolean('is_leaf').notNull().default(false),
    contentHash: text('content_hash'),
    seedOrigin: text('seed_origin'),
    ...timestamps(),
  },
  (t) => ({
    courseStepCourseCodeUnique: uniqueIndex('course_step_course_code_unique').on(t.courseId, t.code),
    courseStepTreeIdx: index('course_step_tree_idx').on(t.courseId, t.parentId, t.ordinal),
    courseStepNodeIdx: index('course_step_node_idx').on(t.knowledgeNodeId),
    levelCheck: check('course_step_level_check', sql.raw(`"level" IN (${inList(COURSE_STEP_LEVEL_VALUES)})`)),
    consistencyCheck: check(
      'course_step_consistency_check',
      sql.raw(`
        (("level" = 'section'
          AND "parent_id" IS NULL
          AND "knowledge_node_id" IS NULL
          AND "is_leaf" = false)
         OR
         ("level" = 'step'
          AND "parent_id" IS NOT NULL
          AND "knowledge_node_id" IS NOT NULL
          AND "is_leaf" = true))
      `),
    ),
    ordinalCheck: check('course_step_ordinal_check', sql.raw(`"ordinal" >= 0`)),
  }),
);
```

### `study.goal_course`

```typescript
export const goalCourse = studySchema.table(
  'goal_course',
  {
    goalId: text('goal_id')
      .notNull()
      .references(() => goal.id, { onDelete: 'cascade' }),
    courseId: text('course_id')
      .notNull()
      .references(() => course.id, { onDelete: 'restrict' }),
    weight: real('weight').notNull().default(1.0),
    seedOrigin: text('seed_origin'),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => ({
    pk: primaryKey({ columns: [t.goalId, t.courseId] }),
    goalCourseByCourseIdx: index('goal_course_by_course_idx').on(t.courseId),
    weightRangeCheck: check(
      'goal_course_weight_check',
      sql.raw(`"weight" >= ${GOAL_SYLLABUS_WEIGHT_MIN} AND "weight" <= ${GOAL_SYLLABUS_WEIGHT_MAX}`),
    ),
  }),
);
```

### `knowledge_node.kind` extension

```typescript
// In existing knowledgeNode table definition, add:
kind: text('kind').notNull().default(KNOWLEDGE_NODE_KINDS.CONCEPT),

// Add to the table's CHECK list:
kindCheck: check(
  'knowledge_node_kind_check',
  sql.raw(`"kind" IN (${inList(KNOWLEDGE_NODE_KIND_VALUES)})`),
),
```

The migration backfills `kind='concept'` on every existing row via the column default. No data loss, no row-by-row script.

## API surface

### Course BC (`libs/bc/study/src/courses.ts`)

```typescript
export interface UpsertCourseInput {
  slug: string;
  kind: CourseKind;
  title: string;
  description?: string;
  status?: CourseStatus;
  seedOrigin?: string;
}

export async function upsertCourse(input: UpsertCourseInput, db: Db): Promise<CourseRow>;

export interface UpsertCourseStepInput {
  courseId: string;
  parentId: string | null;
  level: CourseStepLevel;
  ordinal: number;
  code: string;
  title: string;
  bodyMd: string;
  knowledgeNodeId: string | null;
  contentHash: string;
  seedOrigin?: string;
}

export async function upsertCourseStep(input: UpsertCourseStepInput, db: Db): Promise<CourseStepRow>;

export async function getCourseBySlug(slug: string, db: Db): Promise<CourseRow | null>;

export async function getCourseStepsByCourse(courseId: string, db: Db): Promise<CourseStepRow[]>;

export async function getCoursesByGoal(goalId: string, db: Db): Promise<CourseRow[]>;

export async function getCourseGaps(
  goalId: string,
  courseId: string,
  syllabusId: string,
  db: Db,
): Promise<CertGap[]>;
```

### Lens extensions (`libs/bc/study/src/lenses.ts` + new `lenses-course.ts`)

```typescript
// Additive type extensions in lenses.ts
export interface LensLeafSources {
  inCourse: boolean;
  inCert: boolean;
  certCode?: string;
}

export interface CertGap {
  syllabusNodeId: string;
  code: string;
  title: string;
  requiredBloom: BloomLevel | null;
  knowledgeNodeIds: string[];
}

// LensLeaf gains:
sources?: LensLeafSources;

// LensResult gains:
certGaps?: CertGap[];

// LensTreeNode['level'] adds:
| 'course' | 'section'
```

```typescript
// New lenses-course.ts
export interface CourseLensFilters {
  courseId: string;
}

export interface CourseOverlayLensFilters {
  courseId: string;
  syllabusId: string;
}

export const courseLens: Lens<CourseLensFilters>;

export const courseWithCertOverlayLens: Lens<CourseOverlayLensFilters>;
```

### Goal node union extension (`libs/bc/study/src/goals.ts`)

The existing `getGoalNodeUnion(goalId, db)` walks `goal_syllabus -> syllabus_node_link` and `goal_node`. Extend to ALSO walk `goal_course -> course_step (level='step') -> knowledge_node_id`. Dedup by node id; sum weights when a node is reached via multiple sources. The session engine consumes the existing function unchanged.

## YAML authoring shape

Mirror the syllabus authoring layout exactly:

```text
course/courses/<slug>/
  manifest.yaml       (course metadata)
  sections/
    s1-<title>.yaml   (section metadata + child steps inline)
    s2-<title>.yaml
    ...
```

Inline steps under sections (not separate step files): a section averages 5-10 steps; one file per step would explode the directory; one file per section keeps things browsable. Authoring tool support reads YAML files; the structure is for humans, not the seed.

The seed pipeline:

1. Walk `course/courses/<slug>/manifest.yaml` -> `upsertCourse`
2. Walk `course/courses/<slug>/sections/*.yaml` (sorted by ordinal) -> for each:
   1. `upsertCourseStep` for the section row (level='section', parent_id=null)
   2. For each child step in `steps[]` -> `upsertCourseStep` (level='step', parent_id=section row)
3. Validator runs after parse, before any DB writes (fail-fast on bad YAML)
4. Content hash on each step; idempotent rerun

## Key decisions

| Decision                                                                              | Why                                                                                                                                                              |
| ------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Two tables (course / syllabus) instead of widening syllabus                           | Syllabus is FAA-shaped; warping it to fit course pedagogy damages every consumer that needs the FAA shape. Two clean tables + overlay lens > one muddy table.    |
| Two-level course tree (section + step) instead of arbitrary depth                     | All foreseeable courses decompose naturally into modules + lessons. Arbitrary depth invites authoring complexity without a use case.                             |
| `knowledge_node.kind` lives on the node, not the step                                 | A node's semantic kind is global (a transition is a transition). Step-level kind would let courses disagree about the same node.                                 |
| Lens types extend additively (optional `sources`, `certGaps` fields)                  | Existing consumers (cert dashboard, ACS lens) see no shape change. New consumers opt in.                                                                         |
| Course YAML has NO `cert_alignment` field                                             | Per principle 11: alignment is the learner's goal, not the course author's declaration. Overlay is computed from `goal_course` + `goal_syllabus` at render time. |
| `course_step.knowledge_node_id` FK is RESTRICT, not CASCADE                           | Knowledge nodes are referenced from many places (cards, syllabi). RESTRICT prevents accidental loss; the author must explicitly remove the course step first.    |
| Section file structure with inline steps (one YAML per section, not per step)         | Sections average 5-10 steps; one file per step explodes the directory. One per section is the navigation sweet spot for authors.                                 |
| `syllabus.kind='school'/'personal'` rows are diagnosed defensively, not auto-migrated | Research confirmed zero such rows exist. The diagnostic surfaces any planted rows; the human decides per-row. No silent data movement.                           |
| `getGoalNodeUnion` extension dedups by node id and sums weights                       | Mirrors the existing goal_syllabus + goal_node aggregation. The session engine sees one union; doesn't care which source contributed each node.                  |
