---
feature: study-app-surfaces
category: perf
date: 2026-05-01
branch: main
issues_found: 11
critical: 0
major: 5
minor: 5
nit: 1
status: unread
review_status: pending
---

## Status as of 2026-05-04

Re-greped main against every finding. 6 of 11 closed; 5 still-open. All five MAJOR N+1 patterns closed via the wave-2 convergent fix (six new batched BC helpers + six route loader updates). Tracked in INDEX. The remaining MAJOR (eager help registry) is a separate concern; the four MINORs and one NIT will close opportunistically as their files are touched.

| Severity | Finding | Verdict | Evidence |
| -------- | ------- | ------- | -------- |
| MAJOR    | Triple-nested N+1 in syllabus area drill-down | CLOSED | `credentials/[slug]/areas/[areaCode]/+page.server.ts` now batches via `getCitationsForSyllabusNodes(elementIds)` + `getKnowledgeNodesForSyllabusLeaves(elementIds)`; tasks/elements assemble in JS off two Maps. Two BC reads instead of `2 * elementCount`. |
| MAJOR    | N+1 over handbook editions in lens index | CLOSED | `lens/handbook/+page.server.ts` now uses `getHandbookProgressMap(userId, refIds)` for one round trip across every handbook. |
| MAJOR    | Per-section N+1 inside chapter lens | CLOSED | `lens/handbook/[doc]/[chapter]/+page.server.ts` now uses `getNodesCitingSectionsBatch({ referenceId, chapter, sections[] })` -- one indexed JSONB-containment query for the whole chapter. |
| MAJOR    | N+1 over goal prereqs and credentials | CLOSED | `credentials/+page.server.ts` uses `getCredentialMasteryMap`; `credentials/[slug]/+page.server.ts` uses `getCredentialsByIds` for prereq titles; `goals/[id]/+page.server.ts` parallelizes the per-credential `getCredentialSyllabi` reads via `Promise.all`. |
| MAJOR    | Eager full help registry shipped to every signed-in page bundle | STILL OPEN | `(app)/+layout.svelte:19` still imports `'$lib/help/register'` for side effect. Next: lazy-load registration inside `/help/*` routes only, OR split metadata from body content for code-splitting |
| MINOR    | Library landing fans out three queries when two would do | STILL OPEN | `library/+page.server.ts:84-107` still does the three-query reduce. Tied to architecture-MAJOR `getLibraryLandingPayload` |
| MINOR    | `listReferences()` called four times across regulations route stack | STILL OPEN (improved) | regulations routes now go through `getRegulationsView`, but library landing + aircraft still do `listReferences()` + filter. Next: `listReferencesByKind(kind)` BC + use existing `getReferenceByDocument(slug)` for aircraft loader |
| MINOR    | Reference detail does sequential `getReferenceById` calls | STILL OPEN | `library/regulations/[kind]/[group]/[section]/+page.server.ts` still extra getReferenceById. Next: widen the BC view payload to include supersededById |
| MINOR    | Knowledge node detail also calls listReferences includeSuperseded | STILL OPEN | `knowledge/[slug]/+page.server.ts:115` still pulls full reference table. Next: `getReferencesByIds(ids, { includeSuperseded: true })` |
| MINOR    | parseMarkdown runs sequentially across help-page sections | STILL OPEN | `help/[id]/+page.ts:11-13` still sequential. One-line `Promise.all(...)` fix |
| NIT      | (dev)/references fixture loader does file IO on every request | STILL OPEN | dev-only; trivial. Trigger: someone adds a fourth fixture and feels the rebuild lag |

## Summary

Reviewed every route file under `apps/study/src/routes/`, `apps/study/src/lib/`, `apps/study/src/hooks.server.ts`, `apps/study/svelte.config.js`, and `apps/study/vite.config.ts`. Read libs only for context.

The dashboard, sessions runner, calibration, memory dashboard, memory browse, reps browse, and `/memory/[id]` loaders all use `Promise.all` correctly and are well-shaped. The session runner explicitly fixed a prior whole-session scan with an index-backed single-row fetch (`getSessionItemResult`) and documents it.

The high-leverage problems are five **major** N+1 patterns where a list query is followed by `.map(async ...)` of per-row fetches, plus four routes that pull every `study.reference` row only to client-side-filter / `.find()` a single row. Both shapes scale linearly with corpus growth -- the library-completeness work package explicitly ratifies expanding the corpus catalog (AIM 744 entries, CFR-14 ~11 parts, AC ~50 ACs, plus new corpora), and the 1.A vote is **substrate rename** which keeps these page paths hot. None of these are visible-lag problems today (60 reference rows, ~30 nodes, single-digit credentials), but every one of them gets worse linearly as content seeds expand.

The bundle/loading side has one concrete major finding: every `(app)` page eagerly imports the full study help registry (~2,300 lines of help content + concept docs) via `$lib/help/register`, because the layout side-effects on it. That ships into every signed-in page bundle. None of the routes trigger code-split or dynamic-import for help content even though `/help/*` is the only surface that needs the registry text bodies.

Severity tally:

- 0 critical (no visible-lag at expected scale today)
- 5 major (will not scale or already costs round trips per row)
- 5 minor (suboptimal -- redundant scans, sequential DB calls that could parallelize)
- 1 nit

## Issues

### MAJOR: Triple-nested N+1 in syllabus area drill-down

File: `/Users/joshua/src/_me/aviation/airboss/apps/study/src/routes/(app)/credentials/[slug]/areas/[areaCode]/+page.server.ts`

Problem: The loader does `tasks.map(async task => { elements.map(async element => { Promise.all([getCitationsForSyllabusNode(element.id), getKnowledgeNodesForSyllabusLeaf(element.id)]) }) })`. For an Area with N tasks averaging M elements each, that's `2 * N * M` DB round trips just for citations and linked-node fetches, in addition to `getSyllabusArea`. ACS Areas can hold tens of elements (Private ACS has Areas with 6-10 tasks, each with 4-12 elements -- 50-100 elements total), so a single page load fans out 100-200 sequential round-trip-bounded queries.

Impact: At today's scale (single ACS edition seeded) this still costs hundreds of round trips per area-drill page load. Not user-visible because round trips run inside the Promise.all batches, but each parent-batch waits on its slowest child, so worst-case latency grows with the deepest element-set. As the credentials BC seeds more PTS/ACS editions and tasks per area, this is the page that stalls first. Won't scale.

Fix: Pull citations + linked nodes in two batched queries: `getCitationsForSyllabusNodes(elementIds)` and `getKnowledgeNodesForSyllabusLeaves(elementIds)`, both keyed `WHERE syllabus_node_id IN (...)`, and group in JS. Two BC reads instead of `2 * elementCount`. Same data, O(1) round trips.

### MAJOR: N+1 over handbook editions in lens index

File: `/Users/joshua/src/_me/aviation/airboss/apps/study/src/routes/(app)/lens/handbook/+page.server.ts`

Problem: After `listReferences()` returns every `study.reference` row, the loader filters to `kind === 'handbook'` and does `Promise.all(handbooks.map(async ref => ({ reference: ref, progress: await getHandbookProgress(user.id, ref.id) })))`. Each `getHandbookProgress` is an independent DB query. With 9 handbooks ingested today this is 9 round trips; per the library-completeness spec the handbook count grows (post-#384 added 6 whole-doc extras + future Mountain Flying pamphlet).

Impact: Lens index page load latency = N * single-query cost, where N is the handbook count. Bounded but linear. Won't scale.

Fix: Add `getHandbookProgressForUser(userId, referenceIds)` to the BC, returning `Map<referenceId, Progress>` from a single grouped query (`WHERE user_id = ? AND reference_id IN (?)`). One round trip.

### MAJOR: Per-section N+1 inside chapter lens

File: `/Users/joshua/src/_me/aviation/airboss/apps/study/src/routes/(app)/lens/handbook/[doc]/[chapter]/+page.server.ts`

Problem: `listChapterSections(chapter.id)` returns every section, then `sections.map(async section => getNodesCitingSection({ referenceId, chapter, section }))` fires one DB query per section. PHAK chapters can hold ~15-20 sections; AFH similar.

Impact: 15-20 round trips per chapter-lens page load, all on the cited-by lookup that is itself an indexed `WHERE reference_id = ? AND chapter = ? AND section = ?`. Won't scale linearly with section depth as the BC adopts CFR/AIM (CFR Part 91 alone has 100+ sections) per the library-completeness spec §3.

Fix: Add `getNodesCitingSections(referenceId, chapter, sections[])` that does one query (`WHERE reference_id = ? AND chapter = ? AND section IN (?)`) and group on the client. Or restructure as `WHERE reference_id = ? AND chapter = ?` and bucket per section in memory, since chapters have bounded section count. One round trip per chapter page.

### MAJOR: N+1 over goal prereqs and credentials

File: `/Users/joshua/src/_me/aviation/airboss/apps/study/src/routes/(app)/credentials/+page.server.ts` (lines 28-34) and `/Users/joshua/src/_me/aviation/airboss/apps/study/src/routes/(app)/credentials/[slug]/+page.server.ts` (lines 74-79) and `/Users/joshua/src/_me/aviation/airboss/apps/study/src/routes/(app)/goals/[id]/+page.server.ts` (lines 70-91).

Problems:

1. Credentials index: `credentials.map(async cred => ({ ..., mastery: await getCredentialMastery(user.id, cred.id) }))`. One round trip per credential to compute mastery rollup. Today ~10 credentials seeded -> 10 round trips.
2. Credential detail: `prereqRows.map(async row => ({ credential: await getCredentialById(row.prereqId), kind: row.kind }))`. One round trip per prereq.
3. Goal detail: `for (const cred of credentials) { const credSyl = await getCredentialSyllabi(cred.id, ...) }` -- a sequential `for...of await` (worse than `Promise.all`-N+1 because each round trip is ordered). One per credential.

Impact: Each page load fans out N round trips proportional to credential count. The credentials BC explicitly anticipates more credentials (CFI, CFII, MEI, ATP, plus endorsements). Won't scale.

Fix:

1. `getCredentialMasteryMap(userId, credentialIds)` returning `Map<id, rollup>` from one aggregate query. The mastery rollup is already JS-side aggregation per-row; lift the keying to a single grouped query.
2. `getCredentialsByIds(prereqIds)` (one round trip; map prereq rows in JS).
3. Goal detail's sequential loop: at minimum wrap in `Promise.all(credentials.map(...))`. Better, add `getPrimaryCredentialSyllabi(credentialIds)` that returns syllabi for every credential in one query, group in JS.

### MAJOR: Eager full help registry shipped to every signed-in page bundle

File: `/Users/joshua/src/_me/aviation/airboss/apps/study/src/routes/(app)/+layout.svelte` (line 19) and `/Users/joshua/src/_me/aviation/airboss/apps/study/src/lib/help/register.ts` and `/Users/joshua/src/_me/aviation/airboss/apps/study/src/lib/help/pages.ts`.

Problem: `(app)/+layout.svelte` imports `'$lib/help/register'` for the side-effect (registers help pages with the global registry). `register.ts` imports `studyHelpPages` from `pages.ts`, which static-imports every concept (~10 files) and every page (~17 files) under `lib/help/content/`. Total payload: 2,280 lines per `wc -l` of content modules, all string literals, all shipped to the client because the layout module references the registry. Every route under `(app)` -- dashboard, library, knowledge, reps, memory, calibration -- pulls this into its first hydration bundle even though the help registry text bodies are only consumed by `/help` pages and the `HelpSearch` palette.

Impact: Inflates the shared chunk Vite emits for `(app)/+layout`. Not a cliff at today's content size, but the registry grows linearly with new help pages and concept docs (each one is a static import added to `pages.ts`).

Fix: Two options, pick one.

- Option A (smaller diff): keep registration server-side (where it's needed for SSR of `/help` pages) and do the client registration only inside the help routes' `+page.ts` or a `HelpRoot` component, not in `(app)/+layout.svelte`.
- Option B (cleaner): split `pages.ts` into shallow page-metadata (id/title/group) used by `HelpSearch` and lazy-loaded body content fetched per-page via dynamic `import()` keyed by `pageId`. Bundle the metadata, code-split the bodies.

The other surfaces (`HelpSearch`, `PageHelp`, the help index) only need the metadata for navigation; the markdown bodies should code-split.

### MINOR: Library landing fans out three queries when two would do

File: `/Users/joshua/src/_me/aviation/airboss/apps/study/src/routes/(app)/library/+page.server.ts` (lines 84-107).

Problem: Loader does `Promise.all([getReferenceCountsByCert(), getReferenceCountsByTopic(), listReferences()])` and then iterates `allRefs` twice -- once to compute `regulationBuckets` via N matchers per kind, once to filter POH for the aircraft list. The reference table is small today (~60 rows), but every page load pulls every row even though only the `kind` + `documentSlug` columns are needed for bucket counts and only POH rows are needed for the aircraft list.

Impact: Wastes the JSON serialization cost of dragging full reference rows over the wire for a counts page that could be served from two SQL aggregates.

Fix: Add a single BC call `getLibraryLandingFacets()` returning `{ regulationBuckets: { kind, count }[], aircraft: { id, documentSlug, title }[], certCounts, topicCounts }` from grouped SQL queries (`COUNT(*) ... GROUP BY` for the regulations buckets, `WHERE kind = 'poh'` projection for aircraft). Single aggregation, no full-row scan, no client-side reduce.

### MINOR: `listReferences()` called four times across the regulations route stack

Files: `/Users/joshua/src/_me/aviation/airboss/apps/study/src/routes/(app)/library/regulations/+page.server.ts`, `/Users/joshua/src/_me/aviation/airboss/apps/study/src/routes/(app)/library/regulations/[kind]/+page.server.ts`, `/Users/joshua/src/_me/aviation/airboss/apps/study/src/routes/(app)/library/regulations/[kind]/[group]/+page.server.ts`, `/Users/joshua/src/_me/aviation/airboss/apps/study/src/routes/(app)/library/regulations/[kind]/[group]/[section]/+page.server.ts`, plus `/Users/joshua/src/_me/aviation/airboss/apps/study/src/routes/(app)/library/aircraft/[slug]/+page.server.ts`.

Problem: Each route in the regulations tree pulls `listReferences()` (every reference row) and then `.filter()` / `.find()` to locate the row matching `documentSlug` or `kind`. When a learner walks `regulations -> [kind] -> [group] -> [section]`, four loaders each scan the full reference set just to resolve a single row. Aircraft detail does the same.

Impact: Bounded by reference row count (~60 today, ~100 post-substrate per spec §3). Wastes a SELECT * round trip plus serialization on every navigation, and forces every page through a JS `.find()` lookup that could be a single indexed SELECT.

Fix: Replace the `listReferences().filter(documentSlug === X)` / `listReferences().find(...)` calls with `getReferenceByDocument(documentSlug)` (already exists -- the handbook routes use it) or add `getReferencesByKind(kind)` for the bucket pages. The regulations [kind]/[group]/[section] route already calls `resolveReferenceForGroup` which scans all refs; rewrite as a single keyed query.

### MINOR: Reference detail does sequential `getReferenceById` calls

File: `/Users/joshua/src/_me/aviation/airboss/apps/study/src/routes/(app)/library/regulations/[kind]/[group]/[section]/+page.server.ts` (lines 99-102).

Problem: `await getReferenceById(ref.id)` followed by `await getReferenceById(latestRow.supersededById)` runs sequentially when the second call is conditional on the first. The first call is also redundant -- `resolveReferenceForGroup` already returned the same row.

Impact: One extra round trip per regulations-section load. Bounded but pure waste.

Fix: Drop the redundant `getReferenceById(ref.id)` -- the row was already loaded. The supersededById lookup remains conditional and stays as one round trip.

### MINOR: Knowledge node detail also calls `listReferences({ includeSuperseded: true })`

File: `/Users/joshua/src/_me/aviation/airboss/apps/study/src/routes/(app)/knowledge/[slug]/+page.server.ts` (line 115).

Problem: To resolve citation URLs the loader pulls every reference row including superseded editions. Today ~60 rows; post-substrate the superseded flag matters more (every re-ingestion produces a new row keeping the previous edition with `superseded_by_id` set). The resolver only needs the rows referenced by `node.references`, not the entire table.

Impact: Linear in total reference count (active + superseded), even though most are unused per page load. Not user-visible at today's scale.

Fix: Pre-extract the reference IDs from `node.references`, then call `getReferencesByIds(ids, { includeSuperseded: true })`. One indexed `WHERE id IN (?)` query.

### MINOR: `parseMarkdown` runs sequentially across help-page sections

File: `/Users/joshua/src/_me/aviation/airboss/apps/study/src/routes/(app)/help/[id]/+page.ts` (lines 11-13).

Problem: `for (const section of page.sections) { sectionNodes[section.id] = await parseMarkdown(section.body) }` parses each section sequentially. Not a server-side hot path (this loader runs client-side per the `+page.ts` extension), but the markdown parser is async-CPU work that could parallelize across sections.

Impact: Per-page hydration latency grows with section count. Help pages have 5-15 sections each.

Fix: `Promise.all(page.sections.map(async section => [section.id, await parseMarkdown(section.body)]))` and assemble the record. Same total work, hydrates ~N times faster on multi-core.

### NIT: `(dev)/references` fixture loader does file I/O on every request

File: `/Users/joshua/src/_me/aviation/airboss/apps/study/src/routes/(dev)/references/+page.server.ts` (lines 154-168, 196-205).

Problem: `loadFixture` runs `readFileSync` on every request, even though the three fixture files (`happy-path.md`, `adjacency.md`, `acknowledgment.md`) are immutable on disk and the rest of the loader is deterministic. Dev surface only, but it's wasted work.

Impact: Three sync file reads per page hit. Trivial on local dev; mentioning it because it's dead-simple to fix and lets dev hot-reload feel snappier when iterating on the renderer.

Fix: Cache the parsed fixtures in module scope keyed by `(slug, mode)`, or read once at module load. Dev-only route; either is fine.
