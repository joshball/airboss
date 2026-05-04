---
feature: study-app-surfaces
category: backend
date: 2026-05-01
branch: main
issues_found: 18
critical: 1
major: 6
minor: 9
nit: 2
status: unread
review_status: done
---

## Status as of 2026-05-04

Re-greped main against every finding. 10 of 18 closed; 8 still-open with the N+1 cluster the dominant remainder.

| Severity | Finding | Verdict | Evidence |
| -------- | ------- | ------- | -------- |
| CRITICAL | GET load creates `memory_review_session` rows -- prefetcher can mint sessions | CLOSED | `apps/study/src/routes/(app)/memory/review/+page.server.ts:86-142` -- `load()` is now strictly read-only with respect to session creation: it returns `{ prompt, start: null }` for resumable runs and `{ prompt: null, start }` otherwise. Session creation lives only in `actions.fresh` (POST) at `+page.server.ts:144-186`. The route-actions test suite asserts zero `memory_review_session` inserts on three GET paths (`route-actions.test.ts:348-433`). |
| MAJOR    | N+1 mastery fan-out on `/credentials` | STILL OPEN | `apps/study/src/routes/(app)/credentials/+page.server.ts:28-34` -- still per-row `getCredentialMastery`. Next: add `getCredentialMasteryMap(userId, credentialIds)` to `@ab/bc-study` |
| MAJOR    | N+1 syllabi fan-out on `/goals/[id]` (sequential `for...of await`) | STILL OPEN | `apps/study/src/routes/(app)/goals/[id]/+page.server.ts:76-88` still has `for (const cred of credentials) { ... await getCredentialSyllabi(...) }`. Next: at minimum wrap in `Promise.all`; better, add `listPrimarySyllabiByCredential(credIds)` |
| MAJOR    | N+1 prereq title resolution on `/goals/[id]` | STILL OPEN | per-row `getCredentialById` still in place. Next: add `getCredentialsByIds(ids)` BC helper |
| MAJOR    | N+1 progress fan-out on `/lens/handbook` | STILL OPEN | `apps/study/src/routes/(app)/lens/handbook/+page.server.ts:17-22` still has per-handbook `getHandbookProgress`. Next: add `getHandbookProgressMap(userId, refIds)` |
| MAJOR    | N+1 citation reverse-lookup on `/lens/handbook/[doc]/[chapter]` | STILL OPEN | `apps/study/src/routes/(app)/lens/handbook/[doc]/[chapter]/+page.server.ts:62-75` still per-section `getNodesCitingSection`. Next: add `getNodesCitingSectionsBatch({ referenceId, chapter, sections })` |
| MAJOR    | Redundant DB fetch on regulations leaf reader | STILL OPEN | `apps/study/src/routes/(app)/library/regulations/[kind]/[group]/[section]/+page.server.ts` still re-fetches `getReferenceById(ref.id)` after the BC view returns. Next: widen `getRegulationsView(view: 'section')` payload to include `supersededById`; drop the extra fetch |
| MINOR    | Magic-string `'active'` status filter in `/plans` load | CLOSED | `apps/study/src/routes/(app)/plans/+page.server.ts:9` -- `p.status !== PLAN_STATUSES.ACTIVE` |
| MINOR    | recentReviews limit `10` hardcoded | CLOSED | `apps/study/src/routes/(app)/memory/[id]/+page.server.ts:56` -- `MEMORY_CARD_RECENT_REVIEWS_LIMIT` constant |
| MINOR    | getRecentAttemptsForScenario limit `5` hardcoded | CLOSED | `apps/study/src/routes/(app)/reps/[id]/+page.server.ts:53` -- `REPS_DETAIL_RECENT_ATTEMPTS_LIMIT` constant |
| MINOR    | Sequential awaits in knowledge node loader | STILL OPEN | `apps/study/src/routes/(app)/knowledge/[slug]/+page.server.ts:69-115` -- still serial. Next: wrap independent reads in Promise.all (`getNodesByIds`, `getNodeMastery`, `getCitedBy + resolveCitationSources`, `listReferences`) |
| MINOR    | Sequential awaits in knowledge learn loader | STILL OPEN | `apps/study/src/routes/(app)/knowledge/[slug]/learn/+page.server.ts:41-55` -- `getNodeView` then `getNodeProgress` still serial. Next: parallelize the two reads |
| MINOR    | Sequential awaits in handbook chapter loader | STILL OPEN | `apps/study/src/routes/(app)/library/handbook/[slug]/[chapter]/+page.server.ts:43-51` still serial. Next: two-phase parallel after `getHandbookChapter` resolves |
| MINOR    | Per-action ref/chapter re-fetch on handbook chapter actions | STILL OPEN | each action still calls `getReferenceByDocument + getHandbookChapter`. Next: hidden form input with `chapterId`, or add `setReadStatusByCode(userId, refSlug, chapterCode, status)` BC helper |
| MINOR    | Full-table `listReferences()` scans on library landing pages | STILL OPEN | `apps/study/src/routes/(app)/library/+page.server.ts:84-87` and `aircraft/[slug]` still call `listReferences()` then filter. Next: add `listReferencesByKind(kind)` BC helper; update aircraft loader to use existing `getReferenceByDocument(slug)` |
| MINOR    | Memory-dashboard sequential awaits | STILL OPEN | `apps/study/src/routes/(app)/memory/+page.server.ts:22-29` keeps `await abandonStaleSessions` before the parallel reads. Next: parallelize and accept at-most-one-render staleness OR document the sequencing intent inline |
| NIT      | Logout redirects with 302 instead of 303 | STILL OPEN | `apps/study/src/routes/(app)/logout/+page.server.ts:11` still 302. One-line fix |
| NIT      | dev/references reads fixtures synchronously each request | STILL OPEN | `apps/study/src/routes/(dev)/references/+page.server.ts:154-156` still does `readFileSync` per-request; dev-only |

## Summary

Reviewed all 50+ server files in scope under `apps/study/src/routes/**` and `apps/study/src/lib/**`. The hooks layer, auth integration, and BC delegation are uniformly strong: every protected route runs `requireAuth(event)`, mutations route through BC functions (no raw DB in routes), validation lives in Zod schemas exported from `@ab/bc-study`, error mapping is consistent (typed BC errors -> 400/404/409, unknown -> log + 500), and form actions follow the PRG pattern with `redirect(303, ...)`. Logging is structured with `requestId` + `userId` and the better-auth integration in `hooks.server.ts` correctly degrades to `null` user on DB failure so unauthenticated routes still load.

The serious finding is `/memory/review/+page.server.ts`: the `load` function creates `memory_review_session` rows as a side effect of a GET request. A link prefetch, social-card crawler, or browser preview can mint sessions and clutter Saved Decks. The summary route at `sessions/[id]/summary/+page.server.ts` explicitly documents this hazard ("load functions do not participate in CSRF and prefetchers / link previews would otherwise end sessions invisibly") and forces an explicit POST -- but `/memory/review` itself violates the rule it cites.

The other recurring pattern is N+1 fan-out in load functions where a list query is followed by per-row BC reads inside `Promise.all([...rows.map(async ...)])`. Each one of those produces N round-trips that a single batched BC helper would collapse to one. Concentrated in `/credentials`, `/goals/[id]`, `/lens/handbook`, `/lens/handbook/[doc]/[chapter]`. Cheap today (small graphs, small credential count) but linear in catalog size; right shape to fix once before the catalog grows.

Magic strings and a couple of non-parallelized loads round out the minor findings. None of the form actions are missing CSRF protection (SvelteKit handles that), Zod validation is applied consistently before BC calls, and ownership is enforced by the BC functions that receive `userId`.

## Issues

### CRITICAL: GET load creates DB rows -- prefetcher / preview can mint sessions

File: `/Users/joshua/src/_me/aviation/airboss/apps/study/src/routes/(app)/memory/review/+page.server.ts`

Problem: The `load` function calls `startReviewSession({ userId, deckSpec })` (lines 119, 124) as a side effect of a GET request. Both the `?deck=` no-resumable branch and the bare `/memory/review` branch unconditionally create a new `memory_review_session` row and `redirect(303, ...)`. Browser link prefetch (Chrome's predictive prefetching, Firefox's `<link rel="prefetch">`, Safari preview), social-card crawlers, RSS-style preview engines, accessibility tools, and the SvelteKit client-side preloader can all hit this URL without user intent. Each hit clutters Saved Decks with phantom entries and `abandonStaleSessions` only catches them after 14 days. The companion file `apps/study/src/routes/(app)/sessions/[id]/summary/+page.server.ts` calls out exactly this hazard in its docstring -- "load functions do not participate in CSRF and prefetchers / link previews would otherwise end sessions invisibly" -- but `/memory/review` violates the rule it cites.

Fix: Move session creation into a form action and have the entry-point `load` either (a) redirect to a "Start" page with a single form button when there is no `?deck`, or (b) when `?deck=` is present and not resumable, render a "No prior run for this deck -- start fresh?" prompt with `Start fresh` / `Cancel` buttons rather than minting the session in `load`. The existing `actions.fresh` is already wired correctly (creates inside an action, redirects after). Drop the `startReviewSession(...)` calls from `load` entirely; have `load` always return either the `prompt` payload or a "ready to start" payload that the page submits to `actions.fresh` on user click.

### MAJOR: N+1 mastery fan-out on `/credentials`

File: `/Users/joshua/src/_me/aviation/airboss/apps/study/src/routes/(app)/credentials/+page.server.ts`

Problem: Lines 28-34. After `listCredentials({ status: ACTIVE })`, the loader does `await Promise.all(credentials.map(async (cred) => ({ ..., mastery: await getCredentialMastery(user.id, cred.id) })))`. That's one DB round-trip per credential to compute mastery. With ~10 credentials this is fine today; it grows linearly and the work overlaps a `getDerivedCertGoals` + `getPrimaryGoal` already issued in parallel.

Fix: Add a batched BC helper `getCredentialMasteryMap(userId, credentialIds)` that returns a `Map<credentialId, CredentialMasteryRollup>` in a single query (or a single per-credential aggregate over a UNION ALL). Replace the per-row await with a single map lookup. Mirror the pattern already used by `getNodeMasteryMap` in `/knowledge/+page.server.ts`.

### MAJOR: N+1 syllabi fan-out on `/goals/[id]`

File: `/Users/joshua/src/_me/aviation/airboss/apps/study/src/routes/(app)/goals/[id]/+page.server.ts`

Problem: Lines 70-86. `for (const cred of credentials) { const credSyl = await getCredentialSyllabi(cred.id, { primacy: PRIMARY }) }` -- this is a sequential `await` inside a `for` loop, not even parallelized. One DB round-trip per credential to build the syllabus dropdown. With ~10 credentials this is 10 sequential queries before the page renders.

Fix: Either (a) add a `listPrimarySyllabiByCredential(credIds)` BC helper that returns `{credId, syllabus}[]` in one query, or (b) at minimum wrap in `Promise.all(credentials.map((cred) => getCredentialSyllabi(cred.id, ...)))` so the round-trips overlap. Option (a) is the right shape; option (b) is a one-line stopgap.

### MAJOR: N+1 prereq title resolution on `/goals/[id]`

File: `/Users/joshua/src/_me/aviation/airboss/apps/study/src/routes/(app)/goals/[id]/+page.server.ts`

Problem: Lines 74-79. `await Promise.all(prereqRows.map(async (row) => ({ credential: await getCredentialById(row.prereqId), kind: row.kind })))` -- N parallel single-row fetches when `getCredentialsByIds(ids)` would return all in one query. Same pattern repeats anywhere we have a list of foreign-key ids and resolve them one at a time.

Fix: Add `getCredentialsByIds(ids: string[]): Promise<CredentialRow[]>` to bc-study (mirrors `getNodesByIds` in `/knowledge/[slug]/+page.server.ts`). Replace the per-row Promise.all with a single batch fetch + in-memory map.

### MAJOR: N+1 progress fan-out on `/lens/handbook`

File: `/Users/joshua/src/_me/aviation/airboss/apps/study/src/routes/(app)/lens/handbook/+page.server.ts`

Problem: Lines 17-22. After filtering references to handbook kind, the loader awaits `getHandbookProgress(user.id, ref.id)` per handbook in `Promise.all(...)`. One round-trip per handbook reference; the lens index will hit this on every visit.

Fix: Add `getHandbookProgressMap(userId, referenceIds): Map<refId, progress>` that aggregates per-reference read-state in one query. Replace per-row await with `Map.get`.

### MAJOR: N+1 citation reverse-lookup on `/lens/handbook/[doc]/[chapter]`

File: `/Users/joshua/src/_me/aviation/airboss/apps/study/src/routes/(app)/lens/handbook/[doc]/[chapter]/+page.server.ts`

Problem: Lines 62-75. For every section in the chapter, the loader awaits `getNodesCitingSection(...)` -- one query per section. A chapter with 12 sections = 12 round-trips just to populate the "knowledge nodes that cite this section" panels.

Fix: Add `getNodesCitingSectionsBatch({ referenceId, chapter, sections: number[] }): Map<sectionNum, KnowledgeNodeRow[]>` so the page resolves the citing-nodes panel for an entire chapter in a single query. Replace the per-section await with the batch call + map.

### MAJOR: Redundant DB fetch on regulations leaf reader

File: `/Users/joshua/src/_me/aviation/airboss/apps/study/src/routes/(app)/library/regulations/[kind]/[group]/[section]/+page.server.ts`

Problem: Lines 99-102. `resolveReferenceForGroup` already loads every reference via `listReferences()` and returns a projection (`{ id, documentSlug, edition, title }`). The loader then re-fetches the same reference: `const latestRow = await getReferenceById(ref.id)`, just to read `supersededById`, then if set, fetches the successor with another `getReferenceById`. Two extra round-trips per leaf-page render, one of which is for data that was already in the row `resolveReferenceForGroup` discarded.

Fix: Widen `resolveReferenceForGroup`'s return type to include `supersededById`, drop the `getReferenceById(ref.id)` call, and only fetch the successor when `ref.supersededById !== null`. Mirrors the cleaner shape already in `/library/handbook/[slug]/[chapter]/+page.server.ts` line 51.

### MINOR: Magic-string status filter in `/plans` load

File: `/Users/joshua/src/_me/aviation/airboss/apps/study/src/routes/(app)/plans/+page.server.ts`

Problem: Line 8. `archived = allPlans.filter((p) => p.status !== 'active')` uses a raw `'active'` string. Project rule: "All literal values in `libs/constants/`. Enums, routes, ports, config." `PLAN_STATUSES.ACTIVE` exists in `@ab/constants` and is used throughout other loaders.

Fix: Import `PLAN_STATUSES` and use `p.status !== PLAN_STATUSES.ACTIVE`.

### MINOR: `recentReviews` limit hardcoded inline

File: `/Users/joshua/src/_me/aviation/airboss/apps/study/src/routes/(app)/memory/[id]/+page.server.ts`

Problem: Line 55. `getRecentReviewsForCard(params.id, user.id, 10)` -- the `10` is a magic number for "recent reviews to show on card detail". Same number appears nowhere else, so a UI tweak (show 15 recent reviews) requires editing the route.

Fix: Move to `MEMORY_CARD_RECENT_REVIEWS_LIMIT` (or similar) in `libs/constants/src/study.ts` so the policy lives next to other study-surface limits.

### MINOR: `getRecentAttemptsForScenario` limit hardcoded inline

File: `/Users/joshua/src/_me/aviation/airboss/apps/study/src/routes/(app)/reps/[id]/+page.server.ts`

Problem: Line 47. `getRecentAttemptsForScenario(params.id, user.id, 5)` -- same as above, magic `5` for "recent attempts on rep detail".

Fix: Constant `REPS_DETAIL_RECENT_ATTEMPTS_LIMIT` (or similar) in `libs/constants/`.

### MINOR: Sequential awaits in knowledge node loader

File: `/Users/joshua/src/_me/aviation/airboss/apps/study/src/routes/(app)/knowledge/[slug]/+page.server.ts`

Problem: Lines 57-115. The loader awaits `getNodeView` (correct -- everything depends on it), then `getNodesByIds(linkedIds)`, then `getNodeMastery(user.id, node.id)`, then `getCitedBy(...)`, then `resolveCitationSources(citedByRows)`, then `listReferences({ includeSuperseded: true })`. Of those, `getNodeMastery`, `getCitedBy` (followed by `resolveCitationSources`), `listReferences`, and `getNodesByIds` only depend on `node.id` / the edge sets -- they can fire in parallel after `getNodeView` returns.

Fix: Wrap the four independent reads in `Promise.all([getNodesByIds(...), getNodeMastery(...), getCitedBy(...).then(resolveCitationSources), listReferences(...)])`. Cuts page-load latency by ~3 round-trips on the most-hit detail page.

### MINOR: Sequential awaits in knowledge learn loader

File: `/Users/joshua/src/_me/aviation/airboss/apps/study/src/routes/(app)/knowledge/[slug]/learn/+page.server.ts`

Problem: Lines 36-50. `getNodeView` and `getNodeProgress` are awaited sequentially; `getNodeProgress` only needs `userId` + `slug`, which are known at function entry. The two reads can run in parallel.

Fix: `const [view, progress] = await Promise.all([getNodeView(slug, user.id), getNodeProgress(user.id, slug)])` and reorder the 404 check after the destructure.

### MINOR: Sequential awaits in handbook chapter loader

File: `/Users/joshua/src/_me/aviation/airboss/apps/study/src/routes/(app)/library/handbook/[slug]/[chapter]/+page.server.ts`

Problem: Lines 43-51. After `getReferenceByDocument` and `getHandbookChapter`, the loader awaits `listChapterSections`, `listFiguresForSection`, `getReadState`, `getNodesCitingSection`, and `getReferenceById` sequentially. Only `listFiguresForSection` depends on `sections.length`; the rest can run in parallel.

Fix: Two-phase parallel: first phase is `getHandbookChapter` (resolves `chapter.id`); second phase is `Promise.all([listChapterSections, getReadState, getNodesCitingSection, ref.supersededById ? getReferenceById(...) : null])`. Run `listFiguresForSection` only if `sections.length === 0` (current behavior).

### MINOR: Per-action ref/chapter re-fetch on handbook chapter actions

File: `/Users/joshua/src/_me/aviation/airboss/apps/study/src/routes/(app)/library/handbook/[slug]/[chapter]/+page.server.ts`

Problem: Lines 107-174. Every action (`set-status`, `set-comprehended`, `mark-reread`, `set-notes`) re-runs `getReferenceByDocument` + `getHandbookChapter` to resolve the chapter id. Two queries per mutation when the chapter id is what each BC call ultimately needs. The same pattern recurs in `regulations/[kind]/[group]/[section]/+page.server.ts` (`resolveSectionId` on every action) and `library/handbook/[slug]/[chapter]/[section]/+page.server.ts`.

Fix: Stash the chapter id in a hidden form input on the page and have actions read it directly, falling back to URL-resolution only when the hidden field is missing. Or, expose `setReadStatusByCode(userId, refSlug, chapterCode, status)` BC helpers that do the resolution in a single transactional read.

### MINOR: Full-table `listReferences()` scans on the library landing pages

Files:
- `/Users/joshua/src/_me/aviation/airboss/apps/study/src/routes/(app)/library/+page.server.ts`
- `/Users/joshua/src/_me/aviation/airboss/apps/study/src/routes/(app)/library/aircraft/[slug]/+page.server.ts`
- `/Users/joshua/src/_me/aviation/airboss/apps/study/src/routes/(app)/library/regulations/+page.server.ts`
- `/Users/joshua/src/_me/aviation/airboss/apps/study/src/routes/(app)/library/regulations/[kind]/+page.server.ts`
- `/Users/joshua/src/_me/aviation/airboss/apps/study/src/routes/(app)/library/regulations/[kind]/[group]/+page.server.ts`

Problem: Each loader calls `listReferences()` and then filters/groups in JS. With ~50 references today this is fast; as the catalog grows to handbook + regs + ACs + POHs, every library landing page is shipping every reference row to memory on every page load. The aircraft detail loader specifically does `listReferences().find(ref => ref.kind === POH && ref.documentSlug === slug)` when a single indexed `getReferenceByDocument(slug)` would suffice.

Fix: Add per-bucket BC helpers (`listReferencesByKind(kind: ReferenceKind)`, `getReferenceByDocument(slug)` -- already exists) so the routes pull only what they render. The landing-page count cards can use the existing `getReferenceCountsByKind` style aggregates instead of streaming every row.

### MINOR: Memory-dashboard sequential awaits

File: `/Users/joshua/src/_me/aviation/airboss/apps/study/src/routes/(app)/memory/+page.server.ts`

Problem: Lines 22-29. `await abandonStaleSessions(user.id)` runs before the parallel `Promise.all` of `getDashboardStats`, `getLatestResumableSession`, `listSavedDecks`. The abandon pass mutates `memory_review_session` rows that the resumable + saved-decks queries then read, so the sequencing is intentional -- but the abandon pass writes a small, bounded number of rows that the read queries don't actually need to see committed (a stale resumable session showing up briefly is harmless and gets corrected on the next load). Putting the abandon in parallel with the reads adds a round-trip's worth of latency back to the dashboard.

Fix: Either accept the minor staleness and parallelize all four (treating abandon as fire-and-forget for the page render, with `void` on the result), or document the sequencing intent inline so the next reader doesn't "fix" it. Recommendation: parallelize and accept the at-most-one-render latency on the data correction.

### NIT: Logout `load` redirects with 302 instead of 303

File: `/Users/joshua/src/_me/aviation/airboss/apps/study/src/routes/(app)/logout/+page.server.ts`

Problem: Line 11. `redirect(302, ROUTES.LOGIN)` -- everywhere else in the app, redirects after auth state changes use `303 See Other` (matches the action-side `redirect(303, ROUTES.LOGIN)` two lines below). The 302 is harmless (browsers handle both correctly for GET), just inconsistent with the rest of the file and the rest of the app.

Fix: `redirect(303, ROUTES.LOGIN)` for consistency.

### NIT: `dev/references` reads fixtures synchronously on every request

File: `/Users/joshua/src/_me/aviation/airboss/apps/study/src/routes/(dev)/references/+page.server.ts`

Problem: Lines 154-156. `loadFixture` calls `readFileSync(path, 'utf-8')` on every page load. This is a dev-only route (lives under `(dev)/` group) so it only runs in `bun dev`, but the fixtures don't change between requests; they could be primed once at module load like `FIXTURE_ENTRIES`.

Fix: Hoist the three fixture reads into a module-level memoized `Map<slug, { frontmatter, body }>` so the file system isn't touched on every request. Or convert to async `readFile`. Low priority since it's dev-only.
