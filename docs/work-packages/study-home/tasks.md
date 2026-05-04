---
title: 'Tasks: Study home'
product: study
feature: study-home
type: tasks
status: draft
review_status: pending
created: 2026-05-04
---

## Pre-flight

- [ ] Read `spec.md` and `design.md` end-to-end.
- [ ] Read `docs/decisions/016-cert-syllabus-goal-model/decision.md` -- understand the syllabus / leaf / mastery rollup shape.
- [ ] Read `apps/study/src/routes/(app)/credentials/[slug]/+page.svelte` -- existing area-tree pattern.
- [ ] Read `apps/study/src/routes/(app)/dashboard/+page.svelte` and its panels -- what we displace and what panels we may lift from.
- [ ] Read `libs/bc/study/src/credentials.ts` -- `getCredentialMastery`, `getCredentialPrimarySyllabus` signatures.
- [ ] Read `libs/bc/study/src/mastery.ts` -- `getNodeEvidenceState`, `getNodeEvidenceStateMap`, `aggregateLeafKindStates`.
- [ ] Read `libs/bc/study/src/dashboard.ts` -- `getWeakAreas`, `getRepBacklog`, `WeaknessReason` shape.
- [ ] Read `libs/bc/study/src/references.ts` -- `getNodesCitingSection`, `getNodesCitingSectionsBatch`.
- [ ] Read `libs/bc/study/src/lenses.ts` -- `acsLens`, `domainLens`, `nodeAssessmentMethodsToRequiredKinds`.
- [ ] Read `libs/constants/src/routes.ts` lines around `MEMORY_REVIEW_FOR_NODE`, `LIBRARY`, `REPS`.
- [ ] Read `course/regulations/SYLLABUS.md` and 2-3 lesson files -- understand current frontmatter shape.
- [ ] Re-read spec.md "Decisions" table -- all 7 questions are decided. Cross-check that nothing in tasks contradicts a decision.
- [ ] Run `bun run check` baseline -- 0 errors before starting.

## Implementation

### 1. Constants and routes

- [ ] Add `ROUTES.STUDY = '/study'` in `libs/constants/src/routes.ts`.
- [ ] Add `ROUTES.FLIGHT = '/flight'` in `libs/constants/src/routes.ts` with a comment noting WP 2 is the real owner.
- [ ] Add `STUDY_MAP_TABS = { ACS: 'acs', HANDBOOK: 'handbook', COURSE: 'course' } as const` in a new `libs/constants/src/study-home.ts` (or extend `study.ts`).
- [ ] Add `USER_PREF_KEYS = { CITATION_ORDER: 'study.home.citation_order', MAP_TAB: 'study.home.map_tab' } as const` -- shared infra; WP 3 reuses this constant for its mode key.
- [ ] Add `CITATION_ORDER_VALUES = ['hb', 'reg'] as const`.
- [ ] Add `AUDIT_TARGETS.USER_PREF = 'study.user_pref'`.
- [ ] Update `NAV_LABELS`: rename existing `DASHBOARD` label to `'Stats'`. Add `STUDY: 'Study'`. Brand link in study app -> `ROUTES.STUDY`.
- [ ] `bun run check` -- 0 errors.

### 1.5. user_pref table + BC

- [ ] Add `study.user_pref` table to `libs/db/src/schema/study/user-pref.ts` per design.md "Schema". Composite PK on `(user_id, key)`, `value jsonb`, `updated_at` timestamp. ON DELETE CASCADE from `bauth_user`.
- [ ] Generate Drizzle migration; verify SQL.
- [ ] Apply via `bun run db push`.
- [ ] Create `libs/bc/study/src/user-prefs.ts`:
  - `getUserPrefs(userId, keys: readonly string[], db?): Promise<Record<string, JsonValue>>` -- batched read returning a map. Missing keys absent from the result (no default-injection at this layer).
  - `setUserPref(userId, key, value, db?): Promise<void>` -- upsert with audit. Key must be in a closed set; value validated by a per-key Zod schema lookup.
  - `USER_PREF_SCHEMAS: Record<UserPrefKey, ZodType>` -- per-key validation. `study.home.citation_order` = `z.enum(['hb', 'reg'])`; `study.home.map_tab` = `z.enum(['acs', 'handbook', 'course'])`.
- [ ] Vitest unit: getUserPrefs (empty / partial / full), setUserPref (happy / invalid value rejected / audit emitted / cascade on user delete).
- [ ] `bun run check` -- 0 errors. Run new tests.

### 2. The placeholder Flight route (WP 2 stub)

- [ ] Create `apps/study/src/routes/(app)/flight/+page.svelte` -- one-screen banner: "Logging flights is coming in WP 2 (flight-evidence-and-cfi-feedback)." Link back to `/study` and a link to the WP 2 spec at `docs/work-packages/flight-evidence-and-cfi-feedback/spec.md`.
- [ ] Create `apps/study/src/routes/(app)/flight/+page.server.ts` -- requires auth (uses `requireUser`), no other load.
- [ ] `bun run check` -- 0 errors. Boot the dev server, visit `/flight`, verify the banner.

### 3. Today prose helper (pure)

- [ ] Create `apps/study/src/routes/(app)/study/_lib/map-types.ts` with the `MapNode` type and `MapTab` type.
- [ ] Create `apps/study/src/routes/(app)/study/_lib/today-types.ts` with the `TodayBriefing` discriminated union (variants: `'no-goal'`, `'caught_up'`, `'focus'`).
- [ ] Create `apps/study/src/routes/(app)/study/_lib/today-prose.ts` -- pure function `renderTodayProse(briefing: TodayBriefing): { headline: string; body: string; cta: { label: string; href: string } | null }`.
  - Implement the 6 cases from design.md "Today prose template -- worked examples".
  - Plain text only; the page wraps in markup.
- [ ] Create `apps/study/src/routes/(app)/study/_lib/today-prose.test.ts` -- vitest cases asserting the exact strings from the worked-examples table. One `describe` per `kind`.
- [ ] `bun run check` -- 0 errors. Run the new test file: `bun test apps/study/src/routes/(app)/study/_lib/today-prose.test.ts`.

### 4. Today briefing builder + day-count helper

- [ ] Add `getFirstTouchDate(userId, nodeId, db?): Promise<Date | null>` to `libs/bc/study/src/dashboard.ts`. Returns `min(card_state.last_reviewed_at, session_item_result.started_at, flight_maneuver.created_at)` for any evidence joined to the node (via card.node_id, scenario.node_id, flight_maneuver.node_id). Null if no evidence.
- [ ] Vitest unit for `getFirstTouchDate`: no evidence (null), card-only, scenario-only, mixed, with flight_maneuver (forward-compatible with WP 2 -- the join is harmless if the table doesn't yet have rows).
- [ ] Create `apps/study/src/routes/(app)/study/_lib/build-today-briefing.ts` -- `async function buildTodayBriefing(userId, db, now): Promise<TodayBriefing>`.
  - Calls `getWeakAreas(userId, 1, db, now)`.
  - If empty -> return `{ kind: 'caught_up' }`.
  - Else: take top weak area, fetch its leaves' evidence-state via `getNodeEvidenceStateMap`, pick the leaf with deepest gap (most `missingKinds`, then lowest accuracy among required kinds).
  - Call `getFirstTouchDate(userId, focusNodeId)` -> compute `dayCount = ceil((now - firstTouch) / 86400)` if non-null.
  - For the focus leaf: resolve title, area title, evidence-state, weakness reasons, primary citation (handbook citation if present, otherwise regulation, otherwise null).
  - Return `{ kind: 'focus', focusNodeId, focusAreaId, leafTitle, areaTitle, pillState, reasons, primaryCitation, dayCount }`.
- [ ] `bun run check` -- 0 errors.

### 5. ACS map tree builder

- [ ] Create `apps/study/src/routes/(app)/study/_lib/build-acs-tree.ts` -- `async function buildAcsTree(userId, mastery, focusAreaId, db): Promise<MapNode[]>`.
  - Top-level nodes: areas from `mastery.areas`, with `rollup` populated, `defaultOpen` set when `area.id === focusAreaId`.
  - For each open area: fetch the area's leaves (via syllabus tree walk -- borrow the pattern from `credentials/[slug]/areas/[areaCode]/+page.server.ts`).
  - Per-leaf: call `getNodeEvidenceStateMap` once for all leaves of all open areas, then map.
  - Citations per leaf: fetch via the existing citation BC (`composePublicCardCitations` shape, or a direct query against `content_citations` keyed by syllabus_node_id -- match what `credentials/[slug]/areas/[areaCode]` does).
- [ ] Closed areas don't fetch leaves -- lazy. The user expanding an area is a full page nav with `?expand={areaId}` (or all-server -- consider a small `expanded` URL param array; design.md is silent so pick the simpler one).
- [ ] `bun run check` -- 0 errors.

### 6. Handbook map tree builder

- [ ] Create `apps/study/src/routes/(app)/study/_lib/build-handbook-tree.ts` -- `async function buildHandbookTree(userId, focusHandbookCitation, db): Promise<MapNode[]>`.
  - Top-level: handbooks (`reference` rows where `kind IN ('handbook', 'whole-doc')` and have at least one citing knowledge node -- a join on `content_citations`).
  - Per-handbook: list its chapters (from `reference_section` rows where `level = 'chapter'` or equivalent depth).
  - Per-chapter rollup: `getNodesCitingSectionsBatch({ referenceId, sections: [...chapter sections] })` to get the union of citing nodes; then `getNodeEvidenceStateMap` over that union to compute `masteredLeaves / totalLeaves`.
  - Drill-down on a chapter: link to the existing flightbag chapter route (`ROUTES.LIBRARY_HANDBOOK_CHAPTER` or equivalent -- check `routes.ts`).
- [ ] Auto-expand the handbook + chapter that holds the focus leaf's primary citation.
- [ ] `bun run check` -- 0 errors.

### 7. Course frontmatter backfill -- all 10 weeks (content task)

- [ ] Author `tools/course-frontmatter-backfill.ts` -- one-shot script that:
  - Walks `course/regulations/**/*.md`.
  - For each lesson, parses `airboss-ref:` citations from the body -> proposes `handbook_sections` list.
  - Emits a per-lesson proposal (no auto-write): `{ path, proposed_handbook_sections, current_acs_leaves, current_knowledge_nodes }`.
- [ ] Run the script in dry-run mode; review output.
- [ ] **Per-lesson hand-pass (the substantive work).** For each of ~70 lessons across 10 weeks:
  1. Read the lesson body.
  2. Confirm or correct the `handbook_sections` proposal.
  3. Author the `acs_leaves` list -- which ACS task(s) does this lesson teach? Match against the seeded ACS PA syllabus.
  4. Author the `knowledge_nodes` list -- which `course/knowledge/...` slugs does this lesson reference or cover?
  5. If the right citation is ambiguous OR no clear ACS leaf applies (e.g., lesson genuinely covers a non-ACS regulatory topic), set `pending_review: <one-line reason>` instead of `cites:`. Do NOT silently write `cites: []`.
- [ ] Author `tools/check-course-frontmatter.ts` validator:
  - Walks lesson files; asserts each has either `cites:` or `pending_review:`.
  - For `cites:`: every `acs_leaves` code resolves to a syllabus_node row; every `knowledge_nodes` slug resolves to a knowledge_node row; every `handbook_sections` resolves via the citation registry.
  - Wire into `bun run check` via a new `check:course-frontmatter` script.
- [ ] Run validator; fix any errors.
- [ ] Spot-check 5 lessons across 5 different weeks in the rendered Course projection: assert mastery rolls up correctly.
- [ ] Commit the backfill as a coherent unit.

### 8. Course map tree builder

- [ ] Create `apps/study/src/routes/(app)/study/_lib/build-course-tree.ts` -- `async function buildCourseTree(userId, db): Promise<MapNode[]>`.
  - Walk `course/regulations/` lesson files at module load (cache the parse).
  - Group by week (top level) -> lesson (second level).
  - Per-lesson rollup:
    - Resolve `cites.knowledge_nodes` -> node ids -> `getNodeEvidenceStateMap` -> count.
    - Resolve `cites.acs_leaves` -> syllabus_node ids -> already covered by mastery rollup -> count.
    - `cites.handbook_sections` -> link only, don't count.
  - Lessons with `pending_review:` render as "(pending review)" badge; not counted in week rollup.
  - **No `reading-only` fallback.** A lesson without `cites:` AND without `pending_review:` is a CI failure (validator from step 7 catches it).
- [ ] On dev: invalidate the lesson-tree cache when course/regulations files change. Production: cache persists for the deploy.
- [ ] `bun run check` -- 0 errors.

### 9. The page itself

- [ ] Create `apps/study/src/routes/(app)/study/+page.server.ts`:
  - Loader:
    - Resolve user prefs via `getUserPrefs(userId, [USER_PREF_KEYS.CITATION_ORDER, USER_PREF_KEYS.MAP_TAB])`.
    - Resolve `tab`: URL `?tab=` if present and valid, else stored `map_tab` pref, else `'acs'`. (URL wins for a navigation; pref is the default.)
    - Resolve `citationOrder`: stored pref or default `'hb'`.
    - Resolve user's primary goal credential. If none, return `{ kind: 'no-goal', userPrefs }`.
    - Parallel `Promise.all`: mastery, weak areas, rep backlog, today briefing.
    - Call the appropriate map-tree builder based on `tab`.
    - Return `{ kind: 'home', userPrefs, ...payload }`.
  - Form action `setPref`:
    - Accept `{ key: USER_PREF_KEYS, value: string }`.
    - Validate via `USER_PREF_SCHEMAS[key]`.
    - Call `setUserPref(userId, key, value)`.
    - Return success / error for the optimistic UI.
- [ ] Create `apps/study/src/routes/(app)/study/+page.svelte`:
  - Reads `data` from `$props`.
  - If `data.kind === 'no-goal'`: render the "Set a primary goal" banner + cert-agnostic tiles.
  - Else: render `<ProgressPanel>` + `<TodayPanel>` + `<TilesPanel>` + `<MapPanel>` in a single column.
  - Page header uses `PageHeader` with title "Study" and the credential dropdown in the top-right.
- [ ] `bun run check` -- 0 errors.

### 10. Panel components

- [ ] `apps/study/src/routes/(app)/study/_panels/ProgressPanel.svelte` -- 3 progress bars + percentages + counts.
- [ ] `apps/study/src/routes/(app)/study/_panels/TodayPanel.svelte` -- calls `renderTodayProse(briefing)`, renders the headline + body + CTA link.
- [ ] `apps/study/src/routes/(app)/study/_panels/TilesPanel.svelte` -- 5 tiles with badges. Props: `repBacklog`, `dueCardsCount` (from mastery aggregate), `focusNodeId` (for `MEMORY_REVIEW_FOR_NODE`), `simBadge` (static "Available" v1), `flightBadge` ("WP 2").
- [ ] `apps/study/src/routes/(app)/study/_panels/MapPanel.svelte` -- tab strip + `<MapTree>`.
- [ ] `apps/study/src/routes/(app)/study/_panels/MapTree.svelte` -- recursive tree renderer. Takes `MapNode[]`, recurses. Uses `<details>`/`<summary>`.
- [ ] `apps/study/src/routes/(app)/study/_panels/LeafRow.svelte` -- one leaf row with status glyph, title, three pills, citation panel.
- [ ] `apps/study/src/routes/(app)/study/_panels/CitationStacks.svelte` -- two-stack handbook / regulation panel with the hb/reg toggle. Toggle reads from `data.userPrefs.citation_order` (loader output); writes via SvelteKit form action `?/setPref` POST. Optimistic UI; rollback on error.
- [ ] `bun run check` -- 0 errors. `bunx biome format --write apps/study/src/routes/\(app\)/study/`.

### 11. Navigation + landing redirect

- [ ] Update study app primary navigation: add "Study" (-> `ROUTES.STUDY`) as the first item; rename "Dashboard" to "Stats" (-> `ROUTES.DASHBOARD`).
- [ ] Brand link in study app layout -> `ROUTES.STUDY`.
- [ ] Update the post-login redirect: in `apps/study/src/hooks.server.ts` (or root `+layout.server.ts`), redirect `/` to `/study` for authenticated users.
- [ ] Leave `/dashboard` route content unchanged (still renders the 9-panel view); only the nav label changes.
- [ ] `bun run check` -- 0 errors.

### 12. Tests

- [ ] Vitest: `today-prose.test.ts` (already in step 3).
- [ ] Vitest: `build-acs-tree.test.ts` -- assert tree shape for a seeded user (Abby's seed). 5+ cases: empty mastery, all-mastered area, mixed area, leaf with `--` pills, focus leaf auto-open.
- [ ] Vitest: `build-handbook-tree.test.ts` -- 3+ cases: handbook with citing nodes, handbook without, focus chapter auto-open.
- [ ] Vitest: `build-course-tree.test.ts` -- 4+ cases: lesson with full cites + rollup, lesson with only handbook_sections (reading badge), lesson with `pending_review` marker, week with mixed lessons.
- [ ] Playwright e2e: `tests/e2e/study-home.spec.ts`:
  - Land on `/study` as Abby.
  - Assert three progress numbers visible.
  - Assert Today prose contains expected substring (use the focus leaf's title from the seed).
  - Click each tile, assert correct route navigation, navigate back.
  - Switch map tab to Handbook, assert handbook list visible.
  - Switch to Course, assert week list visible.
  - Expand a leaf row, assert citation stacks visible, click `[reg]` toggle, assert reg stack opens.
- [ ] `bun run check` -- 0 errors. Run all tests: `bun test`. Run Playwright: `bunx playwright test tests/e2e/study-home.spec.ts`.

### 13. Polish + QA

- [ ] `bunx biome format --write` over all touched files.
- [ ] Manual smoke: dev server up, navigate /study, verify each decision (Q1-Q7) is honored as built.
- [ ] Mobile pass: resize to 600px, verify the layout from design.md "Mobile" section.
- [ ] Accessibility pass: keyboard tab through page, verify focus rings, verify screen-reader announcements on the progress strip and the map tree.
- [ ] `bun run check` -- 0 errors, 0 warnings.
- [ ] Read every test plan scenario in `test-plan.md`; manually walk through each.

## Post-implementation

- [ ] Full manual test per `test-plan.md`. Mark each scenario pass / fail.
- [ ] Request implementation review (`/ball-review-full` or `/ball-review-fullstack-dev`).
- [ ] Apply review fixes (per CLAUDE.md "ALWAYS FIX EVERYTHING from a review").
- [ ] Re-run `bun run check`, re-run all tests.
- [ ] Update `docs/work/NOW.md` -- move this WP from "In flight" to "Just shipped".
- [ ] Flip `status: shipped` on each doc once user confirms manual test passes.
- [ ] Commit and PR per `/qs` or `/ship` per project workflow.
