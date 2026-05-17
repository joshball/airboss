---
feature: study-app-surfaces
category: architecture
date: 2026-05-01
branch: main
issues_found: 17
critical: 0
major: 6
minor: 8
nit: 3
status: unread
review_status: done
---

## Status as of 2026-05-04

Re-greped main against every finding. 6 of 17 closed; 11 still-open. The biggest win: regulations bucket->slug rules, slug-shape parsers, and the regulations switches all moved into `libs/bc/study/src/regulations.ts` via `getRegulationsView`. Most remaining items are MINOR placement nits.

| Severity | Finding                                                              | Verdict                         | Evidence                                                                                                                                                                                                                                                                                                                    |
| -------- | -------------------------------------------------------------------- | ------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| MAJOR    | Regulations bucket->slug rule duplicated across five routes          | CLOSED                          | logic moved into `libs/bc/study/src/regulations.ts` (`getRegulationsView`); `apps/study/src/routes/(app)/library/regulations/+page.server.ts` is now a 5-line BC adapter. Library landing still has its own `regulationsBucketMatcher` (one place) -- partially closed, see next-action below                               |
| MAJOR    | Slug-shape parsing lives in routes                                   | CLOSED                          | `extractCfrPart`, `extractAcSeries` now live in `libs/bc/study/src/regulations.ts:271-296`. `parseRegulationKind` exposed via `libs/aviation/src/index.ts`                                                                                                                                                                  |
| MAJOR    | Library cert/topic view assembly runs in routes                      | STILL OPEN                      | `apps/study/src/routes/(app)/library/+page.server.ts:81-120` still does its own bucket reduce + cert/topic spine map + POH filter. Same shape on `library/cert/[cert]` and `library/topic/[topic]`. Next: add `getLibraryLandingPayload` / `getLibraryCertPayload` / `getLibraryTopicPayload` aggregators to `@ab/bc-study` |
| MAJOR    | Knowledge node detail load assembles graph + citation views in route | STILL OPEN                      | `apps/study/src/routes/(app)/knowledge/[slug]/+page.server.ts:55-155` still fans out 6 BC reads + `groupEdgesByType` helper + `node.references as unknown as Citation[]` cast. Next: add `getNodeDetailPayload(slug, userId)` to `@ab/bc-study/knowledge/`                                                                  |
| MAJOR    | Session runner orchestrates kind-dispatch + slot reads in route      | STILL OPEN                      | `apps/study/src/routes/(app)/sessions/[id]/+page.server.ts` (461 lines) still owns the SESSION_ITEM_KIND switch, `loadSlot`, `requireOpenSession`, `resolveSlotDomain`. Next: add `getSessionRunnerPayload` BC + push helpers into `bc-study/sessions/`                                                                     |
| MAJOR    | Heavy multi-screen page components living as route files             | CLOSED (partial -- memory/[id]) | `apps/study/src/routes/(app)/memory/[id]/+page.svelte` shrunk from 1172 to 49 lines via `_panels/` extraction. `session/start/+page.svelte` shrunk 883 -> 87 lines. The handbook section page is still ~423 lines but is an established read-state surface. Closed for the named files; remaining is incremental polish     |
| MINOR    | Group-by enums declared in route folders instead of `@ab/constants`  | STILL OPEN                      | `apps/study/src/routes/(app)/knowledge/group-by.ts` and `reps/browse/group-by.ts` still in routes. Next: move both arrays + types to `libs/constants/src/study.ts`                                                                                                                                                          |
| MINOR    | Magic literal `TOPIC_VISIBLE_THRESHOLD` in library landing           | CLOSED                          | `libs/constants/src/study.ts:1892` -- `LIBRARY_TOPIC_VISIBLE_THRESHOLD = 4`; library page imports it                                                                                                                                                                                                                        |
| MINOR    | ActivityHost component in route folder                               | CLOSED                          | now `libs/ui/src/components/ActivityHost.svelte`; route imports via `@ab/ui/components/ActivityHost.svelte`                                                                                                                                                                                                                 |
| MINOR    | handbook-asset streaming is generic but lives in study routes        | STILL OPEN                      | `apps/study/src/routes/handbook-asset/[...path]/+server.ts` still owns the stream + content-type + path-traversal logic. Next: extract `streamHandbookAsset({ requested, repoRoot })` into `@ab/sources/server`; route shrinks to a one-line shim                                                                           |
| MINOR    | `isSafeRedirect` is generic auth concern in study route              | CLOSED                          | `libs/auth` now exports `isSafeRedirect` (`apps/study/src/routes/login/+page.server.ts:1` -- `import { isSafeRedirect } from '@ab/auth'`)                                                                                                                                                                                   |
| MINOR    | Cross-BC import in references/[id] is intentional but fragile        | STILL OPEN                      | accepted -- documented as a single intentional cross-BC read. Trigger: a second cross-BC import landing in study routes flips this to "consolidate via cross-bc adapter"                                                                                                                                                    |
| MINOR    | Goal status bucketing + sorting in route loader                      | STILL OPEN                      | `goals/+page.server.ts` still buckets in route. Next: add `getGoalsByStatus(userId)` to `@ab/bc-study/goals/`                                                                                                                                                                                                               |
| MINOR    | Credentials index aggregation runs in route                          | STILL OPEN                      | tied to backend N+1 cluster -- root fix is `getCredentialIndexPayload(userId)` BC aggregator                                                                                                                                                                                                                                |
| NIT      | Heavy `MapPanel` embedded as route panel                             | STILL OPEN (deferred)           | preventive; trigger: second product needs a Domain x Cert mastery grid                                                                                                                                                                                                                                                      |
| NIT      | Dev-fixture priming reaches into `__sources_internal__`              | STILL OPEN (accepted)           | dev-only route group, now production-gated by the new `(dev)/+layout.server.ts`                                                                                                                                                                                                                                             |
| NIT      | Repo-root traversal via relative `..`                                | STILL OPEN                      | tied to "extract handbook-asset to lib" architecture MINOR                                                                                                                                                                                                                                                                  |

## Summary

Study app surfaces are mostly well-shaped: routes are auth-gated through `(app)/+layout.server.ts`, dependency direction flows app -> `@ab/auth | @ab/bc-study | @ab/constants | @ab/ui | @ab/themes | @ab/sources | @ab/help | @ab/utils`, and `svelte.config.js` configures `@ab/*` aliases for every cross-lib import. No relative `../../../libs/*` imports anywhere under `apps/study/src`. The single cross-BC import (`@ab/bc-hangar` from `references/[id]`) is documented and intentional.

The architectural drag concentrates on **business logic that has settled in routes instead of `@ab/bc-study`**. Three patterns recur: regulations bucket->slug mapping is duplicated across four routes (`library/+page.server.ts`, `library/regulations/+page.server.ts`, `library/regulations/[kind]/+page.server.ts`, `library/regulations/[kind]/[group]/+page.server.ts`, `library/regulations/[kind]/[group]/[section]/+page.server.ts`); slug-shape parsers (CFR Part, AC series, dotted section codes) live in routes despite being domain rules; and view-shape transforms (cert grouping, edge grouping, goal bucketing, prereq sorting, mastery rollup composition) run inside route loaders. A handful of route files have grown into multi-screen components with substantial feature logic and CSS (`memory/[id]/+page.svelte` 1172 lines, `session/start/+page.svelte` 883 lines) that ought to be extracted into `libs/ui` or app-local `lib/components/` per the "routes are assembly only" rule. One generic helper (`handbook-asset/[...path]/+server.ts`) is implemented at the route layer despite being app-agnostic file streaming.

No critical findings. No reverse dependencies, no app-to-app coupling, no circular imports.

## Issues

### MAJOR: Regulations bucket->slug rule duplicated across five routes

File: `apps/study/src/routes/(app)/library/+page.server.ts`, `apps/study/src/routes/(app)/library/regulations/+page.server.ts`, `apps/study/src/routes/(app)/library/regulations/[kind]/+page.server.ts`, `apps/study/src/routes/(app)/library/regulations/[kind]/[group]/+page.server.ts`, `apps/study/src/routes/(app)/library/regulations/[kind]/[group]/[section]/+page.server.ts`

Problem: The mapping from `LibraryRegulationsKind` to a `study.reference` predicate is reimplemented five times. `regulationsBucketMatcher` in `library/+page.server.ts:60-79`, `bucketMatches` in `library/regulations/+page.server.ts:26-39`, the inline switches in `library/regulations/[kind]/+page.server.ts` (lines 84-150 - "ac series", "aim umbrella", "ntsb"), `expectedSlugForGroup` + `groupRefs` resolution in `library/regulations/[kind]/[group]/+page.server.ts:60-102`, and `resolveReferenceForGroup` in `library/regulations/[kind]/[group]/[section]/+page.server.ts:40-65` all encode the same domain rules: 14 CFR -> slug starts with `14cfr`, AIM bucket includes PCG, AC series follows the `ac-<series>-` slug shape, etc. A schema or naming change to any of the five publishers requires touching five files and risks divergence.

Rule: Business logic placement (logic in libs not apps; apps are thin shells). BC boundaries (regulations-bucket taxonomy is study domain knowledge that belongs in `libs/bc/study/src/library/`).

Fix: Lift the `(kind, group?) -> Predicate<ReferenceRow>` and `(kind, group) -> documentSlug | null` mapping into `@ab/bc-study` (e.g. a new `library/regulations.ts` module) and have the routes call the BC for both counts and resolution. The `AC_SERIES_BUCKETS` constant should also move (currently inlined as a route-local literal in `library/regulations/[kind]/+page.server.ts:65`).

### MAJOR: Slug-shape parsing lives in routes

File: `apps/study/src/routes/(app)/library/regulations/[kind]/+page.server.ts`, `apps/study/src/routes/(app)/lens/handbook/[doc]/[chapter]/+page.server.ts`, `apps/study/src/routes/(app)/library/regulations/[kind]/[group]/[section]/+page.server.ts`

Problem: `extractCfrPart` (`library/regulations/[kind]/+page.server.ts:54-57`), `extractAcSeries` (`library/regulations/[kind]/+page.server.ts:66-69`), and `parseSectionCode` (`lens/handbook/[doc]/[chapter]/+page.server.ts:33-42`) parse identifier shapes that are unambiguously domain artifacts: CFR Part numbers, AC series numbers, dotted-decimal handbook section codes. The library section reader at `library/regulations/[kind]/[group]/[section]/+page.server.ts:82-84` has another ad-hoc dotted-section parser. These rules belong in `libs/aviation` or `libs/bc/study` so the parsing semantics have a single source of truth.

Rule: Business logic placement. Pure-computation lib isolation -- these are exactly the kind of pure functions that should sit beside the constants they parse.

Fix: Add slug-parsing helpers (e.g. `parseCfrSlug`, `parseAcSlug`, `parseDottedSectionCode`) to `@ab/aviation` or `@ab/bc-study` next to the related constants. Have routes call the helpers.

### MAJOR: Library cert/topic view assembly runs in routes

File: `apps/study/src/routes/(app)/library/topic/[topic]/+page.server.ts`, `apps/study/src/routes/(app)/library/cert/[cert]/+page.server.ts`, `apps/study/src/routes/(app)/library/+page.server.ts`

Problem: `library/topic/[topic]/+page.server.ts` builds a `Map<CertApplicability | null, CardView[]>`, applies the static `CERT_GROUP_ORDER` (lines 48-59 -- a domain-significant ordering), groups cards, and demotes orphans -- all inside the route loader. `library/cert/[cert]/+page.server.ts:53-77` has a mirror image: bundle the BC's primary + carryover, fan out `getReadableReferenceIds`, build a `toCard` projection, and split into primary/carryover view shapes. `library/+page.server.ts:81-119` reduces over `listReferences()` to count regulations buckets, then maps cert and topic spines and filters POH aircraft entries -- four domain reductions in a single load. None of this is route assembly; it is study-domain view shaping that should be a single BC call returning the page payload (mirroring the `getDashboardPayload` / `getCalibrationPageData` aggregator pattern already used elsewhere in the same app).

Rule: Apps are thin shells; no query builders / transformations / domain rules in `+page.server.ts`. The same surface already follows the pattern correctly for `dashboard/+page.server.ts:5-12` and `calibration/+page.server.ts:6-15` (single BC aggregator call).

Fix: Add `getLibraryLandingPayload`, `getLibraryCertPayload(cert)`, and `getLibraryTopicPayload(topic)` to `@ab/bc-study/library/`. Routes shrink to `requireAuth + await get*Payload + return`.

### MAJOR: Knowledge node detail load assembles graph + citation views in route

File: `apps/study/src/routes/(app)/knowledge/[slug]/+page.server.ts`

Problem: The load function at lines 52-155 fans out node + edges + linked-titles + mastery + lifecycle + cited-by + reference-resolution + content-phase splitting + edge-by-type bucketing + outbound/inbound projection, with a private `groupEdgesByType` helper (lines 42-50) that's a graph-domain primitive. The route is the only consumer, but the assembly (six BC calls plus a synthesized title-lookup `Map`) is BC-shaped logic. Also: `node.references as unknown as Citation[]` cast at line 116 leaks the column shape decision into the route.

Rule: Business logic placement; BC boundaries (graph traversal + cited-by composition is `bc-study/knowledge` work, not route work).

Fix: Add `getNodeDetailPayload(slug, userId)` to `@ab/bc-study/knowledge/`. Move `groupEdgesByType` + the references-typing into the BC.

### MAJOR: Session runner orchestrates kind-dispatch + slot reads in route

File: `apps/study/src/routes/(app)/sessions/[id]/+page.server.ts`

Problem: The `load` function (lines 48-137) and the action handlers contain orchestration logic that should sit inside the BC: (a) the per-`SESSION_ITEM_KIND` hydration switch (lines 95-127) reads the underlying card / scenario / node and shapes the hydrated payload; (b) `loadSlot`, `requireOpenSession`, `resolveSlotDomain` (lines 150-205) are session-engine primitives -- the doc comment on `resolveSlotDomain` even says "reads from the BC so the route doesn't need to poke at the schema directly," which is the right instinct, but the helper itself is still in the route. The `SlotRefs` interface is essentially a re-shape of a BC row pulled into the app boundary.

Rule: Business logic placement. The session runner has an unusual amount of "fan out + project" logic versus its sibling routes.

Fix: Hand `getSessionRunnerPayload(sessionId, userId, urlParams)` to the BC. Push `loadSlot`, `resolveSlotDomain`, and the kind-dispatch into `bc-study/sessions/`. The route's actions become thin: parse form, call `submitReview` / `submitRep` / `completeNode` / `skipSessionSlot` / `completeSession`, return.

### MAJOR: Heavy multi-screen page components living as route files

File: `apps/study/src/routes/(app)/memory/[id]/+page.svelte` (1172 lines, 432 of CSS), `apps/study/src/routes/(app)/session/start/+page.svelte` (883 lines, 438 of CSS), `apps/study/src/routes/(app)/library/handbook/[slug]/[chapter]/[section]/+page.svelte` (359 lines)

Problem: These route files are the canonical "route as assembly only, route CSS minimal layout-only" violation. `memory/[id]/+page.svelte` carries an inline edit-mode view, share-link toaster, citations + cross-refs section, recent-reviews table, and a status-control surface, plus 432 lines of styles that fully theme each block. `session/start/+page.svelte` ships the entire preset-gallery flow + plan-aware session preview + start UI inline. The dashboard pattern (assembly + extracted `_panels/*.svelte`) is the right shape and is followed cleanly there; these surfaces have not yet been factored.

Rule: Apps are thin shells; component placement (visual components in `libs/ui`, route files are assembly only, route CSS minimal layout-only).

Fix: Extract per-section components into `apps/study/src/lib/components/memory/` (CardEditor, CardStatusControls, ShareToast, RecentReviewsTable, CitationsSection, CrossRefsSection) and `apps/study/src/lib/components/session/` (PresetGallery, SessionPreview). If any are shareable across surface apps later, promote to `libs/ui`. Route files keep the orchestration + layout shell only.

### MINOR: Group-by enums declared in route folders instead of `@ab/constants`

File: `apps/study/src/routes/(app)/knowledge/group-by.ts`, `apps/study/src/routes/(app)/reps/browse/group-by.ts`

Problem: `KNOWLEDGE_GROUP_BY_VALUES` and `REPS_GROUP_BY_VALUES` are typed string-literal enums kept beside `+page.server.ts` because SvelteKit forbids non-`load`/`actions` exports from page-server modules. The doc comments cite that constraint accurately, but the right home for an enum is `@ab/constants` (per CLAUDE.md "All literal values in `libs/constants/`. Enums, routes, ports, config"), not the route folder. The page-server constraint argues for a sibling module; CLAUDE.md argues for `libs/constants/`. The latter wins.

Rule: All literal values in `libs/constants/`.

Fix: Move both arrays + types to `libs/constants/src/study.ts` (or a per-feature file). Routes import them like every other constant.

### MINOR: Magic literal in library landing page

File: `apps/study/src/routes/(app)/library/+page.svelte:18`

Problem: `const TOPIC_VISIBLE_THRESHOLD = 4;` is a tunable threshold (the spec quote in the comment says "Topics with <4 entries collapse"), so it is exactly the kind of value that belongs in `@ab/constants`. Inline literals tend to drift when adjacent components want the same threshold.

Rule: No magic strings/numbers. Use `libs/constants/`.

Fix: Move to `libs/constants/src/library.ts` as `LIBRARY_TOPIC_VISIBLE_THRESHOLD`.

### MINOR: ActivityHost component in route folder

File: `apps/study/src/routes/(app)/knowledge/[slug]/learn/ActivityHost.svelte`

Problem: This is a generic "activity id -> mounted activity component" registry/dispatcher. Its placement directly under a route prevents reuse if `firc` or `sim` ever needs the same dispatch (which both are likely to, given `libs/activities` exists as a shared lib). Today it only knows the `crosswind-component` activity, but the registry pattern is generic.

Rule: Component placement (visual components in `libs/ui`); shared vs app-specific.

Fix: Move to `libs/activities/src/ActivityHost.svelte` and register activities in a single map there. Routes import it.

### MINOR: handbook-asset streaming is generic but lives in study routes

File: `apps/study/src/routes/handbook-asset/[...path]/+server.ts`

Problem: The handler streams files from the monorepo's `handbooks/` directory to the browser. Every surface app that renders handbook content (study today, firc and any future reader app tomorrow) needs the same endpoint. The path-traversal guard, content-type table, and streaming logic are generic. The route file is fine; the file-resolution + content-type implementation should live in a lib (`@ab/sources`) so each app's `+server.ts` is a one-line shim.

Rule: Shared vs app-specific. Apps thin shell.

Fix: Extract `streamHandbookAsset({ requested, repoRoot }): Response` into `@ab/sources/server` (or `@ab/sources/handbook-assets`). Route handler reduces to `return streamHandbookAsset(...)`.

### MINOR: `isSafeRedirect` is generic auth concern in study route

File: `apps/study/src/routes/login/+page.server.ts:11-19`

Problem: Open-redirect prevention belongs to the auth library (`@ab/auth`) -- every app's login flow needs the same check. Defining it inline in the study app means firc/hangar/runway will copy-paste it.

Rule: Shared vs app-specific. Apps thin shell.

Fix: Move to `libs/auth/src/redirect.ts` (or co-locate with `forwardAuthCookies`). Route imports.

### MINOR: Cross-BC import in `references/[id]` is intentional but fragile

File: `apps/study/src/routes/(app)/references/[id]/+page.server.ts:16`

Problem: `import { getReferenceSummary } from '@ab/bc-hangar';` is the single cross-BC import in the study app. The doc comment justifies it (citation picker writes hangar.reference ids; study needs to read them) and the import is read-only, so it does not violate write-side BC separation. But the route then mixes hangar BC reads (`getReferenceSummary`) with study BC reads (`getCitedBy`, `resolveCitationSources`) and study BC constants (`CITATION_TARGET_TYPES`). This pattern, repeated, will turn study routes into informal cross-BC integration points.

Rule: BC boundaries (no cross-BC imports without scrutiny).

Fix: Either expose a `getStudyReferenceDetailPayload(id)` from `@ab/bc-study` that wraps the hangar read, or make the cross-BC contract explicit by routing all cross-BC reads through a thin `@ab/bc-study/cross-bc/` adapter so the hangar dependency is concentrated.

### MINOR: Goal status bucketing + sorting in route loader

File: `apps/study/src/routes/(app)/goals/+page.server.ts:13-30`

Problem: Bucketing goals by status into a typed `GoalsByStatus` record and sorting active goals "primary first, then by `updatedAt` desc" is goal-domain logic. Not large, but it duplicates the pattern that gets centralized in BC aggregators elsewhere.

Rule: Business logic placement.

Fix: Add `getGoalsByStatus(userId)` to `@ab/bc-study/goals/`.

### MINOR: Credentials index aggregation runs in route

File: `apps/study/src/routes/(app)/credentials/+page.server.ts:19-50`

Problem: The load fans out `listCredentials + getPrimaryGoal + getDerivedCertGoals`, then per-credential calls `getCredentialMastery` (n+1 fan-out), then sorts by `primaryGoalCredential` -> `kind` -> `slug`. The "primary goal credential first" ordering is a product rule. Like the dashboard, this should be a single payload call.

Rule: Business logic placement.

Fix: `getCredentialIndexPayload(userId)` in `@ab/bc-study/credentials/`.

### NIT: Heavy `MapPanel` embedded as route panel

File: `apps/study/src/routes/(app)/dashboard/_panels/MapPanel.svelte` (209 lines, ~104 of CSS)

Problem: The dashboard panels are app-specific visualizations and the `_panels/` folder is the right place. `MapPanel.svelte` carries the most logic of the bunch -- intensity bucketing (`intensityClass` lines 49-57), per-cell href construction, and a custom CSS grid theme. None of this is wrong, but the same Domain x Cert visualization is a candidate for cross-product reuse (firc, avionics, future surfaces). Worth flagging for promotion to `libs/ui` if/when a second consumer appears.

Rule: Shared vs app-specific (preventive, not actionable today).

Fix: Leave for now. When the second product needs a Domain x Cert mastery grid, lift to `libs/ui/components/MasteryMatrix.svelte`.

### NIT: Dev-fixture priming reaches into `__sources_internal__`

File: `apps/study/src/routes/(dev)/references/+page.server.ts:19,99-119`

Problem: The dev-only fixture page primes the source registry by importing `__sources_internal__.getActiveTable` / `setActiveTable`. The double-underscore prefix signals "library-internal," yet a downstream app reaches in for fixture priming. The `(dev)/` group makes this acceptable (no production exposure), but it is exactly the kind of internal coupling that surfaces when a lib needs a public seam for tests/fixtures and doesn't have one yet.

Rule: Module organization.

Fix: When `@ab/sources` exposes a stable test/fixture API (`registerFixtureEntries`?), swap the dev page to it.

### NIT: Repo-root traversal via relative `..`

File: `apps/study/src/routes/handbook-asset/[...path]/+server.ts:23-25`

Problem: `const REPO_ROOT = resolve(HERE, '..', '..', '..', '..', '..', '..');` -- six `..` segments to climb from the route file to the monorepo root. Functional, but brittle: refactoring the route depth (e.g. nesting it under `(app)/`) silently changes what `REPO_ROOT` resolves to and the path-traversal guard could break in surprising ways.

Rule: Module organization (defensiveness).

Fix: Tied to the previous "extract to lib" recommendation. When the helper moves into `@ab/sources`, resolve the repo root via `@ab/constants` (`resolveCacheRoot` / a sibling helper) or a `find-up` over `package.json` with a workspace marker.
