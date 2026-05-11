# wp-notes-primitive -- tasks

Phase-by-phase build order. Each task is one PR-sized chunk unless noted. Mark `[x]` when shipped (PR linked).

## Phase 1: schema + BC + components + standalone routes

- [x] **Schema**: add `study.note` table + indexes to `libs/bc/study/src/schema.ts`. Regenerate `drizzle/0000_initial.sql`. Migrate existing `notes_md` blob in `referenceSectionReadState` (drop column + check constraint, write a one-shot migrator under `scripts/migrations/migrate-notes-blobs.ts` for any populated DBs). Reseed dev DB. (PR #838)
- [x] **Constants**: add `NOTE_BODY_MAX_LENGTH`, `NOTE_TAGS_MAX`, `NOTE_EXCERPT_MAX_LENGTH` to `libs/constants/src/notes.ts`. Add audit-target constant. (PR #838)
- [x] **Routes constants**: add `NOTES`, `NOTES_NEW`, `NOTE_DETAIL`, `NOTE_DETAIL_PATTERN`, `NOTE_EDIT`, `NOTES_FILTER` to `libs/constants/src/routes.ts`. (PR #838)
- [x] **BC**: implement `libs/bc/study/src/notes.ts` (server) with all CRUD + lookup + search + follow-up functions. Full Vitest coverage. Audit-log integration. (PR #838)
- [x] **BC tests**: re-anchor edge cases (multiple-FK queries, archived filter, follow-up partial index hits, search relevance). (PR #838)
- [x] **Browser barrel**: re-export note row types from `libs/bc/study/src/index.ts` (type-only); server functions stay in `@ab/bc-study/server`. (PR #838)
- [x] **UI primitives**: ship `<NoteComposer>`, `<NoteCard>`, `<NotesList>`, `<NoteContextPicker>`, `<NoteContextChips>`, `<FollowUpBadge>`, `<NoteDetail>` in `libs/ui/components/notes/`. (PR #838)
- [x] **Routes**: `apps/study/src/routes/(app)/notes/+page.svelte` (index with tabs + filters + search), `+page.server.ts` (loader), `/notes/new/+page.svelte` + `+page.server.ts` (creator with form action), `/notes/[id]/+page.svelte` + `+page.server.ts` (detail with multi-action form). (this PR -- the routes were referenced in PR #838 but not actually committed)
- [ ] **Entry points**: add "Notes" item to study app left nav, "+ Note" link in study app header. *Deferred -- not blocking surfaces; the per-surface "+ Note" panels in Phase 2 cover the practical capture path.*
- [ ] **e2e smoke**: create freestanding note, create context-attached note, archive + restore, follow-up done, delete. *Manual test plan covered; Playwright spec deferred.*
- [x] **Help library page**: add a `<PageHelp>` body for `/notes?view=follow-ups` explaining the follow-ups inbox.

## Phase 2: surface entry points (goal / course / knowledge node detail pages)

- [x] **Goal page integration**: mount `<NotesList notes={...} showContextChips={false} />` panel on `apps/study/src/routes/(app)/program/goals/[id]/+page.svelte`. "+ Note" button pre-fills `goalId`.
- [x] **Course page integration**: same pattern on `apps/study/src/routes/(app)/courses/[slug]/+page.svelte` (route param is `[slug]`, not `[id]`).
- [x] **Knowledge node integration**: same pattern on `apps/study/src/routes/(app)/reference/knowledge/[slug]/+page.svelte` (the canonical knowledge-node detail surface; `/study/learn/` is the section index, not a detail page).
- [x] **Server loaders**: each surface adds one `listNotesForX` query to its `+page.server.ts`.

## Phase 3: search + tag-cloud + follow-ups inbox polish

- [x] **Tag autocomplete**: pull distinct tags from `note.tags` for the current user; offer in the chip input. Endpoint: `/notes/tags` -> `{ tags: string[] }`. `<TagChipInput>` fetches on first focus.
- [x] **Tag cloud on `/notes`**: collapsed by default; click a tag -> filter via `?tag=`. Sized linearly by use count.
- [x] **Follow-ups inbox**: dedicated `/notes?view=follow-ups` view with grouping by created-month + per-month "Mark all done" action.
- [x] **Saved searches**: sidebar on `/notes`, backed by `study.user_pref` row keyed `study.notes.saved_searches`. "Save current view" form + per-entry remove action. Capped at 24 per user.

## Verification gates per PR

- `bun run check all` clean.
- New tests pass (Vitest unit + Playwright e2e).
- `bun run track format` clean on touched markdown.
- Browser smoke: load `/notes`, create one of each note kind (freestanding, context-attached), edit, archive, follow-up.
- Memory check: confirm WP frontmatter contract (`agent_review_status: pending` until self-review pass; never touch `human_review_status`).
