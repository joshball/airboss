---
id: wp-notes-primitive
title: 'Spec: WP-NOTES-PRIMITIVE -- platform-wide note primitive (schema, BC, components, viewer)'
product: study
category: feature
status: draft
agent_review_status: pending
human_review_status: pending
created: 2026-05-11
owner: agent
depends_on: []
unblocks:
  - wp-flightbag-rich-reader
tags:
  - notes
  - primitive
  - cross-cutting
---

# WP-NOTES-PRIMITIVE: platform-wide note primitive

A note is a markdown thought attached to context. Books, sections, knowledge nodes, courses, goals, syllabus nodes, free-floating tags -- any combination. Notes survive "where did I write that" because every relevant FK is captured. Follow-ups capture intent without becoming a task manager.

This WP ships the primitive end-to-end: schema, BC, UI components, a `/notes` viewer surface, and one entry point (`/notes/new` standalone). Reader integration (inline composer, per-section panel) lands in `wp-flightbag-rich-reader`.

## Why this WP exists

The flightbag UX review (2026-05-11) surfaced that the user wants to capture thoughts while reading without losing context. The schema needs to support: a note on a passage, a note on a section without a passage, a note on a chapter, a note on a whole reference, a freestanding note on a topic / goal / knowledge area. Five context FKs cover all of these without schema migrations later.

Notes are a primitive. Once the table + BC + components exist, every surface in airboss can let the user capture and find a note: study, flightbag, hangar, sim debriefs, even bug repro logs. Building notes as a feature of the rich-reader would couple them to one surface and force re-extraction later. Building them as a primitive first means the rich-reader (and everything else) consumes them as a dependency.

## Anchors

- [docs/work/reviews/2026-05-11/flightbag-desktop-ux.md](../../work/reviews/2026-05-11/flightbag-desktop-ux.md) -- review that triggered this WP. The "Plan: notes + note viewer" section is the source spec for the schema and viewer.
- [wp-flightbag-rich-reader](../wp-flightbag-rich-reader/spec.md) -- depends on this WP. Adds the inline composer and the per-section notes panel that consume the components shipped here.
- [wp-flightbag-reader-ux](../wp-flightbag-reader-ux/spec.md) -- runs in parallel; no dependency either direction.
- [USER_PREF_KEYS in libs/constants/src/study-home.ts](../../../libs/constants/src/study-home.ts) -- pattern for namespaced study keys. Notes use `note_<ULID>` ids, no user-pref involvement.
- [study.reference_section_read_state.notes_md](../../../libs/bc/study/src/schema.ts) -- the existing per-section single-blob notes field. Will be deprecated by this WP (migration plan in §"Migration" below).

## In Scope

### 1. Schema: `study.note`

```typescript
export const note = studySchema.table(
  'note',
  {
    id: text('id').primaryKey(),                    // note_<ULID>
    userId: text('user_id').notNull().references(() => bauthUser.id, { onDelete: 'cascade' }),

    /** Markdown body. Required (an empty note is a bug, not a feature). */
    bodyMd: text('body_md').notNull(),

    /** Optional title. When empty, the viewer derives one from the first line. */
    title: text('title').notNull().default(''),

    /**
     * Quoted excerpt -- the passage the note responds to, snapshotted at note
     * creation. Survives source re-extraction. Empty when the note isn't
     * about a specific passage.
     */
    quotedExcerpt: text('quoted_excerpt').notNull().default(''),

    // -- Context FKs. Any combination may be set. None is set for a freestanding note. --

    referenceId: text('reference_id').references(() => reference.id, { onDelete: 'set null' }),
    referenceSectionId: text('reference_section_id').references(() => referenceSection.id, { onDelete: 'set null' }),

    /**
     * Knowledge-graph node FK. Wired when the knowledge schema lands; for
     * now this is a free-form text id with no FK constraint (the column
     * gets the FK in a follow-up when knowledge nodes ship).
     */
    knowledgeNodeId: text('knowledge_node_id'),

    courseId: text('course_id').references(() => course.id, { onDelete: 'set null' }),
    goalId: text('goal_id').references(() => goal.id, { onDelete: 'set null' }),
    syllabusNodeId: text('syllabus_node_id').references(() => syllabusNode.id, { onDelete: 'set null' }),

    /** Free-form tags. */
    tags: text('tags').array().notNull().default(sql`ARRAY[]::text[]`),

    /** Optional follow-up. Empty = no follow-up. */
    followUpMd: text('follow_up_md').notNull().default(''),
    followUpDoneAt: timestamp('follow_up_done_at', { withTimezone: true }),

    /** Soft-archive. Notes are never hard-deleted by the UI. */
    archivedAt: timestamp('archived_at', { withTimezone: true }),

    ...timestamps(),
  },
  (t) => ({
    userIdx: index('note_user_idx').on(t.userId, t.createdAt),
    refIdx: index('note_reference_idx').on(t.referenceId).where(sql`reference_id IS NOT NULL`),
    sectionIdx: index('note_section_idx').on(t.referenceSectionId).where(sql`reference_section_id IS NOT NULL`),
    goalIdx: index('note_goal_idx').on(t.goalId).where(sql`goal_id IS NOT NULL`),
    courseIdx: index('note_course_idx').on(t.courseId).where(sql`course_id IS NOT NULL`),
    knowledgeIdx: index('note_knowledge_idx').on(t.knowledgeNodeId).where(sql`knowledge_node_id IS NOT NULL`),
    syllabusIdx: index('note_syllabus_idx').on(t.syllabusNodeId).where(sql`syllabus_node_id IS NOT NULL`),
    tagsGin: index('note_tags_gin_idx').using('gin', t.tags),
    followUpOpenIdx: index('note_follow_up_open_idx')
      .on(t.userId, t.createdAt)
      .where(sql`follow_up_md != '' AND follow_up_done_at IS NULL AND archived_at IS NULL`),
    archivedOpenIdx: index('note_user_open_idx').on(t.userId, t.createdAt).where(sql`archived_at IS NULL`),
  }),
);
```

Schema is greenfield (no migrations -- per CLAUDE.md, edit `schema.ts`, regenerate `0000_initial.sql`, reseed). Types exported alongside the table: `NoteRow`, `NewNoteRow`.

### 2. BC: `libs/bc/study/src/notes.ts`

Server module (re-exported via `@ab/bc-study/server`). Functions:

```typescript
// Create + edit
createNote(userId, input: CreateNoteInput): Promise<NoteRow>
updateNote(noteId, userId, patch: UpdateNoteInput): Promise<NoteRow>
archiveNote(noteId, userId): Promise<void>
restoreNote(noteId, userId): Promise<void>
deleteNote(noteId, userId): Promise<void>     // hard delete; UI never calls this -- exposed for tests + manual cleanup

// Lookups
getNote(noteId, userId): Promise<NoteRow | null>
listNotesForUser(userId, opts: ListOpts): Promise<{ notes: NoteRow[]; total: number }>
listNotesForSection(userId, sectionId): Promise<NoteRow[]>
listNotesForReference(userId, referenceId): Promise<NoteRow[]>     // includes section-scoped
listNotesForGoal(userId, goalId): Promise<NoteRow[]>
listNotesForCourse(userId, courseId): Promise<NoteRow[]>
listNotesForKnowledgeNode(userId, knowledgeNodeId): Promise<NoteRow[]>
listOpenFollowUps(userId): Promise<NoteRow[]>

// Follow-up
markFollowUpDone(noteId, userId): Promise<void>
clearFollowUp(noteId, userId): Promise<void>      // wipes follow_up_md, clears done timestamp

// Search
searchNotes(userId, query: string, opts: ListOpts): Promise<NoteRow[]>   // body + title + quoted_excerpt + tags
```

`ListOpts` covers `{ archived: 'include' | 'exclude' | 'only', limit, cursor, sort: 'newest' | 'oldest' | 'updated' }`.

Validation via Zod schemas in `libs/bc/study/src/notes.ts`. `bodyMd` length cap (configurable constant `NOTE_BODY_MAX_LENGTH = 64_000` in `libs/constants/src/notes.ts`); `tags` cap (`NOTE_TAGS_MAX = 16`); `quotedExcerpt` cap (`NOTE_EXCERPT_MAX_LENGTH = 4_000`).

Audit log integration: every create / update / archive / delete writes a `study.note` audit row (target_type per `AUDIT_TARGETS`).

### 3. UI components in `libs/ui/components/notes/`

Browser-safe primitives. No DB imports.

- **`<NoteComposer>`** -- markdown textarea + title input + tag chip input + follow-up toggle + context picker. Emits `oncreate`, `onsave`, `oncancel`. Pure component; the parent wires it to a form action.
- **`<NoteCard>`** -- one-note row. Props: `note: NoteRow`, `showContextChips: boolean`. Renders title, body preview (3 lines), context badges, follow-up badge, archived state. Click-through prop.
- **`<NotesList>`** -- list of `<NoteCard>`s with empty state + "load more" affordance.
- **`<NoteContextPicker>`** -- collapsible panel with 5 dropdowns (reference / section / knowledge node / course / goal / syllabus_node) + tag input. Used by `<NoteComposer>` and the search filter. Emits `onchange(context: NoteContext)`.
- **`<NoteContextChips>`** -- read-only chip strip showing which context FKs a note has. Color-coded: orange (reference/section), blue (goal), green (course), purple (knowledge node), grey (syllabus node). Click-through to the source.
- **`<FollowUpBadge>`** -- the "↻ follow-up" pill, with done/open variant.
- **`<NoteDetail>`** -- full note view: title (edit-in-place), body (edit-in-place markdown editor), quoted excerpt block (jump-to-source button when `referenceSectionId` set), context picker (edit), follow-up section (edit + done toggle), edit / archive / delete actions, "promote to card draft" button (creates a `study.card_draft` row -- wired in WP 3, no-ops in this WP with a "coming soon" tooltip).

### 4. Routes in `apps/study/src/routes/(app)/notes/`

- `/notes` -- index. Default tab "All" + tabs for "By context" + "Follow-ups." Filter chips at the top: `archived`, `has-followup`, `tag:*`, `reference:*`, `goal:*`, `course:*`, `knowledge:*`. Search box (full-text against body + title + quoted_excerpt + tags). Cursor pagination.
- `/notes/new` -- standalone note creator. Context picker defaults empty (user picks). Submit -> redirect to `/notes/[id]`.
- `/notes/[id]` -- detail view (`<NoteDetail>` mounted with the row).
- `/notes/[id]/edit` -- not a separate route; edit-in-place inside `/notes/[id]` toggled by `?edit=1`.

Server actions: `default` on `/notes/new` calls `createNote`; `default` on `/notes/[id]` handles `update` / `archive` / `restore` / `mark-done` / `clear-followup` form actions (multi-action form pattern).

### 5. Entry points

- **Study app header** -- "+ Note" button next to the existing "+" affordances (study app header has a primary nav already; thread the link). Goes to `/notes/new`.
- **Study app left nav** -- new "Notes" item in the primary nav. Goes to `/notes`.
- **From a goal page** -- "Notes for this goal (N)" panel on `/program/goals/[id]` showing `listNotesForGoal()`. Phase-2 of this WP.
- **From a course page** -- same pattern: "Notes for this course (N)" on the course detail page. Phase-2.
- **From a knowledge node page** -- "Notes on this topic (N)" on the node detail. Phase-2.

Reader integration (per-section panel + inline composer) is **explicitly NOT in this WP** -- it's `wp-flightbag-rich-reader`. The components ship here so the dependent WP can mount them without writing any new note-handling code.

### 6. Routes constants

`libs/constants/src/routes.ts`:

```typescript
NOTES: '/notes',
NOTES_NEW: '/notes/new',
NOTE_DETAIL: (id: string) => `/notes/${encodeURIComponent(id)}` as const,
NOTE_DETAIL_PATTERN: '/notes/[id]',
NOTE_EDIT: (id: string) => `/notes/${encodeURIComponent(id)}?${QUERY_PARAMS.EDIT}=1` as const,
NOTES_FILTER: (filter: 'all' | 'follow-ups' | 'archived' | 'by-context') => `/notes?view=${filter}` as const,
```

### 7. Migration: existing `notes_md` blob field

`study.reference_section_read_state.notes_md` is a single markdown blob per `(user, section)`. With this WP, that's superseded by 1+ `study.note` rows referencing the same `referenceSectionId`.

Migration plan (one-shot, executed in the seed script alongside the schema regen):

1. For every `(user_id, reference_section_id)` row with `notes_md != ''`, create a `note` row: `bodyMd = notes_md`, `referenceSectionId = section_id`, `userId = user_id`, `quotedExcerpt = ''`, `tags = ['migrated-from-blob']`. Done at seed time on dev; for any non-dev environment that already has data, ship a `scripts/migrations/migrate-notes-blobs.ts` one-shot.
2. Drop the `notes_md` column and the `notesLengthCheck` constraint from `referenceSectionReadState`.
3. Remove `HANDBOOK_NOTES_MAX_LENGTH` from the codebase (replaced by `NOTE_BODY_MAX_LENGTH`).

Per CLAUDE.md schema rule: greenfield, single `0000_initial.sql`. The migration is just code + reseed.

## Out of Scope (explicit)

See [OUT-OF-SCOPE.md](./OUT-OF-SCOPE.md). One-line summary of major exclusions:

- Annotations (highlights, card-draft anchors). `wp-flightbag-rich-reader`.
- Inline composer in the reader. `wp-flightbag-rich-reader`.
- Per-section notes panel in the reader. `wp-flightbag-rich-reader`.
- Card drafts and "promote note to card." Schema landed in `wp-flightbag-rich-reader`; the button is here but it no-ops until the dependent WP ships.
- Public / shared / collaborative notes. Future.
- Notes attached to sim debriefs / bug repros. Schema supports it via knowledgeNodeId / courseId / goalId; surfaces wire later.
- Note export / import. Future.
- Cross-user note merging or instructor comments on student notes. Future (different access model).

## Phases

### Phase 1: schema + BC + components + standalone routes

Schema regen + reseed. BC functions with full test coverage. UI components with Vitest browser tests for `<NoteComposer>` interaction. `/notes`, `/notes/new`, `/notes/[id]` routes. Migration of existing `notes_md` blobs. Header link + nav entry.

**Done when**: I can create a freestanding note from `/notes/new`, create a context-attached note, find it via filters and search, edit it in place, mark a follow-up done, archive + restore. `bun run check` clean. Existing per-section notes blobs are migrated.

### Phase 2: surface entry points (goal / course / knowledge node detail pages)

"Notes on this X (N)" panel on each detail page. Same `<NotesList>` component, scoped query, "+ Note pre-filled with this context" button.

**Done when**: from `/program/goals/[id]`, `/courses/[id]`, and `/study/knowledge/[slug]`, the user can see their notes and create a new one with the context pre-filled.

### Phase 3: search + tag-cloud + follow-ups inbox polish

Tag autocomplete from the user's existing tags. Tag cloud on the index. Saved searches (URL-driven). Follow-ups inbox with grouping by created-month + bulk-mark-done.

**Done when**: a power user with 100+ notes can find anything in under 10 seconds.

## Risks

- **`notes_md` migration on a populated DB.** Dev-only today, but spec the migration script so it's not a surprise when the platform has real users. Test on a seeded DB with fixtures that include populated `notes_md` rows.
- **FKs to tables that don't exist yet** (knowledge_node). Solved by leaving `knowledgeNodeId` as a free-form `text` column with no FK constraint; the FK lands when knowledge schema does.
- **Schema fan-out.** Six FKs on one table is a lot. Justified because notes are a primitive that needs to find anything. Indexes use partial `WHERE col IS NOT NULL` to keep them small; full-table index avoided.
- **Search performance at scale.** Phase-1 uses Postgres ILIKE; Phase-3 adds `pg_trgm` GIN index on `body_md` if the data demands it. No premature optimization.

## Success criteria

- Notes are creatable, editable, archivable, searchable, and findable by any of 5 context dimensions.
- The `wp-flightbag-rich-reader` WP can mount `<NoteComposer>` and `<NotesList>` without writing any new note logic.
- The existing per-section single-blob notes are migrated cleanly with no data loss.
- The pattern is reusable: when the next surface (sim debrief, hangar bug log) needs notes, it's a wiring exercise, not a re-implementation.
