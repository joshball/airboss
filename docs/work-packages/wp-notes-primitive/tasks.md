# wp-notes-primitive -- tasks

Phase-by-phase build order. Each task is one PR-sized chunk unless noted. Mark `[x]` when shipped (PR linked).

## Phase 1: schema + BC + components + standalone routes

- [ ] **Schema**: add `study.note` table + indexes to `libs/bc/study/src/schema.ts`. Regenerate `drizzle/0000_initial.sql`. Migrate existing `notes_md` blob in `referenceSectionReadState` (drop column + check constraint, write a one-shot migrator under `scripts/migrations/migrate-notes-blobs.ts` for any populated DBs). Reseed dev DB. Ship as PR-1.
- [ ] **Constants**: add `NOTE_BODY_MAX_LENGTH`, `NOTE_TAGS_MAX`, `NOTE_EXCERPT_MAX_LENGTH` to `libs/constants/src/notes.ts`. Add audit-target constant. Ship in PR-1.
- [ ] **Routes constants**: add `NOTES`, `NOTES_NEW`, `NOTE_DETAIL`, `NOTE_DETAIL_PATTERN`, `NOTE_EDIT`, `NOTES_FILTER` to `libs/constants/src/routes.ts`. Ship in PR-1.
- [ ] **BC**: implement `libs/bc/study/src/notes.ts` (server) with all CRUD + lookup + search + follow-up functions. Full Vitest coverage. Audit-log integration. Ship as PR-2.
- [ ] **BC tests**: re-anchor edge cases (multiple-FK queries, archived filter, follow-up partial index hits, search relevance). Ship in PR-2.
- [ ] **Browser barrel**: re-export note row types from `libs/bc/study/src/index.ts` (type-only); server functions stay in `@ab/bc-study/server`. Ship in PR-2.
- [ ] **UI primitives**: ship `<NoteComposer>`, `<NoteCard>`, `<NotesList>`, `<NoteContextPicker>`, `<NoteContextChips>`, `<FollowUpBadge>`, `<NoteDetail>` in `libs/ui/components/notes/`. Vitest browser tests for `<NoteComposer>` interaction (markdown input, tag chip add/remove, context picker dropdowns, follow-up toggle). Ship as PR-3.
- [ ] **Routes**: `apps/study/src/routes/(app)/notes/+page.svelte` (index with tabs + filters + search), `+page.server.ts` (loader), `/notes/new/+page.svelte` + `+page.server.ts` (creator with form action), `/notes/[id]/+page.svelte` + `+page.server.ts` (detail with multi-action form). Ship as PR-4.
- [ ] **Entry points**: add "Notes" item to study app left nav, "+ Note" link in study app header. Ship in PR-4.
- [ ] **e2e smoke**: create freestanding note, create context-attached note, archive + restore, follow-up done, delete. Ship in PR-4.
- [ ] **Help library page**: add a `<PageHelp>` body for `/notes` explaining what notes are vs cards vs highlights (for the future). Ship in PR-4.

## Phase 2: surface entry points (goal / course / knowledge node detail pages)

- [ ] **Goal page integration**: mount `<NotesList notes={...} showContextChips={false} />` panel on `apps/study/src/routes/(app)/program/goals/[id]/+page.svelte`. "+ Note" button pre-fills `goalId`. Ship as PR-5.
- [ ] **Course page integration**: same pattern on `apps/study/src/routes/(app)/courses/[id]/+page.svelte`. Ship as PR-5.
- [ ] **Knowledge node integration**: same pattern on `apps/study/src/routes/(app)/study/learn/...` (knowledge node detail surface). Ship as PR-5.
- [ ] **Server loaders**: each surface adds one `listNotesForX` query to its `+page.server.ts`. Ship in PR-5.

## Phase 3: search + tag-cloud + follow-ups inbox polish

- [ ] **Tag autocomplete**: pull distinct tags from `note.tags` for the current user; offer in the chip input. Ship as PR-6.
- [ ] **Tag cloud on `/notes`**: collapsed by default; click a tag -> filter. Ship in PR-6.
- [ ] **Follow-ups inbox**: dedicated `/notes?view=follow-ups` view with grouping by created-month + bulk-mark-done action. Ship as PR-7.
- [ ] **Saved searches**: URL-driven (already free); add a "Saved searches" sidebar showing the user's named queries via a small `study.user_pref` JSON map. Optional polish.

## Verification gates per PR

- `bun run check all` clean.
- New tests pass (Vitest unit + Playwright e2e).
- `bun run track format` clean on touched markdown.
- Browser smoke: load `/notes`, create one of each note kind (freestanding, context-attached), edit, archive, follow-up.
- Memory check: confirm WP frontmatter contract (`agent_review_status: pending` until self-review pass; never touch `human_review_status`).
