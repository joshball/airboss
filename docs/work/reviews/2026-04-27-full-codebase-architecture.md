---
feature: full-codebase
category: architecture
date: 2026-04-27
branch: main
scope: whole-repo
issues_found: 18
critical: 0
major: 8
minor: 7
nit: 3
---

## Summary

Foundational layering (constants -> utils/types -> auth/db -> bc -> apps) is mostly intact and dependency direction is honored: no app -> app imports, no BC -> app imports, no foundational lib pulling from a higher tier. The big drift is on the hangar side: there is no `libs/bc/hangar/`, and ~2,400 lines of BC-shaped logic plus a wad of direct `db.select().from(hangarSource)` Drizzle queries live in `apps/hangar/src/lib/server/` and route load functions, which is exactly the smear the architecture forbids. Other recurring issues are BC-owned schemas mounted under `libs/db/src/` instead of their owning BC, the study app reaching across BCs into `hangarReference` directly, very heavy route .svelte files (688/566/493 line `<style>` blocks) defining visual styling that belongs to `libs/ui`, and several documentation/import-alias bookkeeping drifts. Cross-BC coupling exists (bc-citations -> bc-study, bc-study -> bc-sim/persistence) and is moderately leaky -- citations imports raw Drizzle table objects from bc-study rather than going through a public read API.

## Issues

### MAJOR: Hangar BC is missing -- BC-shaped logic lives in `apps/hangar/src/lib/server/`

- **File**: `apps/hangar/src/lib/server/registry.ts:1-493`, `apps/hangar/src/lib/server/source-fetch.ts:1-534`, `apps/hangar/src/lib/server/source-jobs.ts:1-414`, `apps/hangar/src/lib/server/upload-handler.ts:1-187`, `apps/hangar/src/lib/server/users.ts:1-248`, `apps/hangar/src/lib/server/jobs.ts`, `apps/hangar/src/lib/server/edition-stub.ts`, `apps/hangar/src/lib/server/source-form.ts`, `apps/hangar/src/lib/server/reference-form.ts`
- **Problem**: ~2,400 lines of registry CRUD, optimistic-locking, audit writes, source-fetching, job-orchestration, and user-admin live under the hangar app shell. `registry.ts` imports `auditWrite`, declares `RevConflictError`, owns the entire `hangar.reference`/`hangar.source` write fabric, and is the primary writer to those tables. This is a bounded context in everything but name. The app shell pattern (per `MULTI_PRODUCT_ARCHITECTURE.md` and CLAUDE.md "Apps are thin SvelteKit shells") is to call BC functions, not host them.
- **Rule**: CLAUDE.md "Business logic in libs. Apps are thin SvelteKit shells." `MULTI_PRODUCT_ARCHITECTURE.md` (full build-out) lists `libs/bc/course/`, `libs/bc/enrollment/` etc., implying hangar's mirror should be `libs/bc/hangar/`.
- **Fix**: Create `libs/bc/hangar/` and move `registry.ts`, `source-fetch.ts`, `source-jobs.ts`, `upload-handler.ts` (the parts that aren't request-specific), `users.ts`, `jobs.ts`, `edition-stub.ts`, the form schemas, and the `RevConflictError` class. Routes call BC functions. Move the `hangar.*` Drizzle tables (currently in `libs/db/src/hangar.ts`) under the new BC's `schema.ts`. `libs/hangar-jobs/` and `libs/hangar-sync/` are reasonable peer libs around the BC, but the BC itself should not live in the app.

### MAJOR: BC schemas mounted in `libs/db/src/` instead of their owning BC

- **File**: `libs/db/src/hangar.ts:1-251`, `libs/db/src/sim.ts:1-92`, `libs/db/src/index.ts:4-31`
- **Problem**: `@ab/db` re-exports `hangarReference`, `hangarSource`, `hangarJob`, `hangarJobLog`, `hangarSyncLog`, `simAttempt`, plus all their row types and the `hangarSchema`/`simSchema` builders. Compare to `libs/audit/src/schema.ts` (audit owns its own schema) and `libs/bc/study/src/schema.ts` (study BC owns its own schema). `@ab/db` should be the connection + cross-cutting helpers (timestamps, escapeLikePattern), not a BC-table dumping ground. A new BC adding tables should not need to land in `@ab/db`.
- **Rule**: Bounded contexts own their schemas. ADR 004 schema namespacing was intended per-BC, and CLAUDE.md "Schema namespaces: `identity`, `audit`, `study` (more added as BCs grow)" implies each BC ships its own.
- **Fix**: Move `libs/db/src/hangar.ts` -> `libs/bc/hangar/src/schema.ts` (when the BC is created -- see issue above). Move `libs/db/src/sim.ts` -> `libs/bc/sim/src/schema.ts` and re-export `simAttempt` / `simSchema` / row types from `@ab/bc-sim`. Update `libs/db/src/index.ts` to drop those re-exports. Update consumers in apps/hangar and the citations BC. Keep `@ab/db` to: connection, columns helpers, escape helpers.

### MAJOR: `apps/study` queries `hangarReference` directly via `@ab/db`, crossing BC boundaries

- **File**: `apps/study/src/routes/(app)/references/[id]/+page.server.ts:18-37`
- **Problem**: A route in the study app does `db.select().from(hangarReference).where(eq(hangarReference.id, …))`. This hits another BC's table directly, bypasses any application-level invariants the hangar BC enforces, and produces a tight coupling that breaks the moment hangar's read shape changes.
- **Rule**: BC integrity. Apps consume BC public APIs. Cross-BC reads should go through a BC function (e.g., `getReferenceById(id)` from a hangar BC, or via `@ab/bc-citations.resolveCitationTargets` which is already used elsewhere on this very page).
- **Fix**: Once the hangar BC exists, expose `getReferenceById` from `@ab/bc-hangar` and call it here. Until then, lift the read into `@ab/bc-citations` (it already imports `hangarReference` for resolveCitationTargets) so this page does not need direct DB access.

### MAJOR: bc-citations imports raw Drizzle tables from bc-study instead of a public BC read API

- **File**: `libs/bc/citations/src/citations.ts:18` (`import { card, knowledgeNode, scenario } from '@ab/bc-study'`), `libs/bc/citations/src/search.ts:10` (`import { knowledgeNode } from '@ab/bc-study'`), `libs/bc/citations/src/schema.ts:25` (`pgSchema(SCHEMAS.STUDY)` -- duplicates `studySchema` declaration from `@ab/bc-study`)
- **Problem**: bc-citations reaches into bc-study's Drizzle table objects to verify ownership (e.g., "does this card belong to this user"). It also redeclares `pgSchema(SCHEMAS.STUDY)` rather than importing `studySchema` from bc-study. This is a cross-BC tight coupling: if bc-study reshapes a column, bc-citations breaks even though the contract was supposed to be the study BC's public functions.
- **Rule**: BCs should expose narrow read/write functions to their tables. Cross-BC lookups go through those functions, not through the table object.
- **Fix**: Either (a) bc-study exposes ownership predicates -- `cardExistsForUser(id, userId)`, `knowledgeNodeExists(id)`, `scenarioExistsForUser(id, userId)` -- and bc-citations calls those; or (b) accept that "study + citations" are one BC and move citations into bc-study (that's plausible: `content_citations` already lives in the `study` Postgres schema). Pick one. Today's middle ground (separate BC, leaky imports) is the worst of both worlds. Replace the `pgSchema(SCHEMAS.STUDY)` redeclaration with `import { studySchema } from '@ab/bc-study'`.

### MAJOR: Heavy visual CSS and component definitions in app route .svelte files

- **File**: `apps/study/src/routes/(app)/memory/review/[sessionId]/+page.svelte` (1435 lines, 688-line `<style>` block), `apps/study/src/routes/(app)/memory/[id]/+page.svelte` (1233 lines, 490-line style), `apps/study/src/routes/(app)/calibration/+page.svelte` (973 lines, 566-line style), `apps/study/src/routes/(app)/session/start/+page.svelte` (936 lines, 493-line style), `apps/study/src/routes/(app)/memory/+page.svelte` (862 lines, 445-line style), and ~15 more route files with 100+ line style blocks.
- **Problem**: The skill-defined rule is route CSS = layout/flow only (grid, flex, gap), and ALL visual components live in `libs/ui/`. These route files are defining whole visual systems inline -- card layouts, panel chrome, pill styles, progress strips. Per CLAUDE.md the design system is supposed to live in `libs/themes/` (tokens) + `libs/ui/` (components driven by those tokens). A 688-line `<style>` block in a route is, by definition, visual styling outside the design system.
- **Rule**: Skill rule "Route files (`+page.svelte`) are assembly only -- they compose components from libs/ui/, they don't define new visual elements. Page CSS must be MINIMAL: layout/flow only."
- **Fix**: For each oversized route, extract the recurring visual fragments to `libs/ui/src/components/` (review-shell, review-feedback-panel, review-citation-strip, calibration-bucket, etc.), and reduce the route's `<style>` to grid/flex layout only. Convert any `padding`/`color`/`border`/`box-shadow` literals to design tokens via `libs/themes/`. This is one of the convergent findings the review docs likely flag elsewhere -- fix it once at the root by extracting the components, not by re-tweaking each route.

### MAJOR: Three apps duplicate the better-auth factory verbatim

- **File**: `apps/study/src/lib/server/auth.ts:1-21`, `apps/sim/src/lib/server/auth.ts:14-25`, `apps/hangar/src/lib/server/auth.ts:1-21`
- **Problem**: Each app implements an identical `getAuth()` factory: read `BETTER_AUTH_SECRET`, throw if missing, read `BETTER_AUTH_URL`, return `createAuth(...)`, and lazy-init guarded by `building`. This is the kind of cross-app boilerplate `@ab/auth` exists to absorb.
- **Rule**: CLAUDE.md "Cross-lib imports use `@ab/*` aliases" + "Apps are thin SvelteKit shells". The auth lib already exposes `createAuth`; it should also expose the app-level wiring.
- **Fix**: Add `getAppAuth({ building, dev })` or `createLazyAuth(...)` in `@ab/auth/server` and have each app's `$lib/server/auth.ts` reduce to one re-export line. Removes 60 lines of duplication and one place to forget to update.

### MAJOR: Apps use Drizzle operators (`eq`, `and`, `desc`, etc.) directly in route files

- **File**: `apps/hangar/src/routes/(app)/sources/+page.server.ts:23` (`import { and, desc, eq, isNull } from 'drizzle-orm'`), `apps/hangar/src/routes/(app)/sources/[id]/+page.server.ts`, `apps/hangar/src/routes/(app)/sources/[id]/diff/+page.server.ts`, `apps/hangar/src/routes/(app)/sources/[id]/files/+page.server.ts`, `apps/hangar/src/routes/(app)/+page.server.ts`, `apps/study/src/routes/(app)/references/[id]/+page.server.ts:20`
- **Problem**: 10+ route files build queries inline, which means the route is doing data-access. The architecture rule is data-access lives in BCs, routes call BC functions, and the only thing routes know about Drizzle is what they get from the BC.
- **Rule**: "Apps should be thin shells: routes, form actions, data loading, layout assembly ONLY." `drizzle-orm` should not be in any route's import set.
- **Fix**: Every route that imports from `drizzle-orm` is a candidate to move to a BC function. Most of the hangar ones go away when the hangar BC lands (issue 1). For the study reference page, route through the citations BC.

### MAJOR: Route load functions read filesystem paths inside the repo

- **File**: `apps/hangar/src/routes/(app)/sources/+page.server.ts:35-72` (reads `data/references/manifest.json` and `libs/aviation/src/references/aviation.ts` via `readFile` + ad-hoc regex parsing in the route load)
- **Problem**: The route load (a) reads a generated artifact path inside the repo, (b) does string-regex extraction from a generated TypeScript source, (c) has no abstraction over either. This is an implementation detail of the manifest pipeline that should live in `@ab/sources` (or the new hangar BC), not in a SvelteKit page load.
- **Rule**: Routes are assembly. Filesystem + parsing belongs in libs.
- **Fix**: Move `loadManifestSummary` and `loadAviationCounts` into `@ab/sources` (or the hangar BC) as named functions. Replace the regex with an actual import / parsed registry call. The `referenceCount` heuristic that matches `^\\s*\\{\\s*$\\s*id:\\s*['"]` is fragile -- rewrite it as an actual count off `getRegistry()`.

### MINOR: `libs/types/package.json` does not declare its `@ab/constants` dependency

- **File**: `libs/types/package.json:1-5`, `libs/types/src/index.ts:3`, `libs/types/src/citation.ts:36`
- **Problem**: `libs/types/src/index.ts` re-exports `CitationFraming` from `@ab/constants` and `citation.ts` does an `import type` from `@ab/constants`. The `package.json` lists no dependencies. With strict workspace hoisting this works because the root resolves `@ab/constants`, but in a stricter workspace setup or if someone enables strict peer-dep enforcement, this breaks.
- **Rule**: package.json declares the lib's actual cross-lib deps.
- **Fix**: Add `"dependencies": { "@ab/constants": "workspace:*" }` to `libs/types/package.json`.

### MINOR: `libs/activities/package.json` declares zero deps but the lib uses `@ab/...` imports

- **File**: `libs/activities/package.json:1-5`, `libs/activities/src/crosswind-component/CrosswindComponent.svelte`
- **Problem**: Same shape as the types issue. `@ab/activities` exports a Svelte component that almost certainly imports from `@ab/themes`/`@ab/ui`/`@ab/constants`, but its package.json claims no deps. Verify and add.
- **Rule**: package.json declares the lib's actual cross-lib deps.
- **Fix**: Audit the imports inside `libs/activities/src/` and align package.json. Same for any other lib whose package.json says "no deps".

### MINOR: CLAUDE.md "Monorepo" tree is out-of-date with reality

- **File**: `CLAUDE.md:188-219`
- **Problem**: The doc lists `apps/study/` only, plus libs auth, bc/study, constants, db, themes, types, ui, utils. Reality: `apps/sim/` and `apps/hangar/` exist and are wired through Vite + svelte.config.js + tsconfig. Libs include `audit`, `aviation`, `activities`, `help`, `sources`, `hangar-jobs`, `hangar-sync`, `bc/sim`, `bc/citations` -- none mentioned. The "Path aliases" list omits `@ab/audit`, `@ab/sources`, `@ab/bc-citations`, `@ab/hangar-jobs`, `@ab/hangar-sync`. Newcomers grepping CLAUDE.md will write code against a fictional tree.
- **Rule**: Doc Style "Update docs as part of the work, not as a separate task." CLAUDE.md "Critical Rules" says cross-lib aliases must be the documented set.
- **Fix**: Update the Monorepo block to enumerate every app + lib that exists. Update the "Path aliases" line in the Import Rules section (the tsconfig.json paths is the source of truth). Add `@ab/audit`, `@ab/sources`, `@ab/bc-citations`, `@ab/hangar-jobs`, `@ab/hangar-sync`. Either remove the "Future surface apps" framing for sim/hangar (they exist now) or explicitly call them "scaffolded but pre-pivot".

### MINOR: CLAUDE.md "Doc Structure" omits top-level `data/`, `handbooks/`, `regulations/`, `tools/`, `tests/`, `drizzle/`, `scripts/`

- **File**: `CLAUDE.md:49-101`
- **Problem**: The repo has six top-level directories the doc tree doesn't mention. `regulations/cfr-14`, `regulations/cfr-49`, `handbooks/{afh,avwx,phak}`, `data/sources/...`, `tools/handbook-ingest/` (Python!), `tests/`, `drizzle/`, `scripts/`. ADR 018 says source bytes go to a developer cache, but committed structural indexes do live in `regulations/` per the .gitignore comment, and `tools/handbook-ingest/` is a real Python tool. The doc structure block is the project's table of contents and it's missing six entries.
- **Rule**: Doc Style "Headers are the outline. A reader should understand the doc from headers alone."
- **Fix**: Add these top-level directories to CLAUDE.md's tree, with one-line purposes each. Resolve the overlap between `data/sources/` and `handbooks/` and `regulations/` -- there appear to be three places source content can land and that should be one decision documented in one place.

### MINOR: `libs/constants/src/schemas.ts` references stale paths in its own JSDoc

- **File**: `libs/constants/src/schemas.ts:12,18`
- **Problem**: Comment says `AUDIT: home of the audit_log table declared in libs/db/src/audit.ts` but that file no longer exists -- audit moved to `libs/audit/src/schema.ts` (per the `hangar-scaffold` work package note). Same paragraph references `libs/db/src/hangar.ts` which is also slated to move per issue 2.
- **Rule**: "Update docs as part of the work, not as a separate task."
- **Fix**: Rewrite the JSDoc paragraphs to point at the actual current files (`libs/audit/src/schema.ts`, `libs/bc/study/src/schema.ts`, `libs/db/src/hangar.ts` for now). When hangar/sim BCs absorb their schemas, update again.

### MINOR: `bc-citations` redeclares `studySchema` instead of importing it from `@ab/bc-study`

- **File**: `libs/bc/citations/src/schema.ts:25`
- **Problem**: `export const studySchema = pgSchema(SCHEMAS.STUDY);` is also declared in `libs/bc/study/src/schema.ts:107`. At runtime Drizzle's `pgSchema` is essentially a builder over a name string so the SQL output is the same, but having two `studySchema` constants reachable from `@ab/bc-citations` and `@ab/bc-study` creates a foot-gun where `studySchema.table('foo', ...)` may produce two distinct Table objects in different contexts.
- **Rule**: Single source of truth.
- **Fix**: `import { studySchema } from '@ab/bc-study'` in `libs/bc/citations/src/schema.ts` and drop the local redeclaration. (This is a half-step until issue 4 resolves the deeper question of whether citations should be its own BC.)

### MINOR: bc-study reaches into bc-sim's `/persistence` subpath rather than the BC public API

- **File**: `libs/bc/study/src/sim-bias.ts:16` (`import { ... } from '@ab/bc-sim/persistence'`), `libs/bc/study/src/sim-bias.test.ts:8`
- **Problem**: bc-study deep-imports `@ab/bc-sim/persistence`. The bc-sim public barrel (`libs/bc/sim/src/index.ts`) exports physics, scenarios, replay, and grading -- but not the persistence functions. So bc-study has to reach past the public surface to use `getRecentSimWeakness`. Either persistence belongs in the public surface (and `index.ts` should re-export it) or it's intentionally private and bc-study shouldn't be calling it.
- **Rule**: BCs expose a single public barrel; consumers don't reach into subpaths.
- **Fix**: Either (a) re-export `getRecentSimWeakness` and `SimWeaknessSignal` from `libs/bc/sim/src/index.ts` and switch bc-study to `import { ... } from '@ab/bc-sim'`; or (b) make persistence internal and have bc-sim expose a higher-level `getRecentSimWeaknessForScheduler()` that bc-study uses.

### MINOR: `libs/db` depends on `@ab/auth` (foundational tier coupled to identity)

- **File**: `libs/db/package.json` (`"@ab/auth": "workspace:*"`), `libs/db/src/columns.ts:31`, `libs/db/src/hangar.ts:23`, `libs/db/src/sim.ts:20`
- **Problem**: `@ab/db` is the connection + helpers tier. It depends on `@ab/auth` only because `auditColumns`/`hangar.ts`/`sim.ts` need a reference to `bauthUser.id` for FKs. Once the hangar/sim schemas move to their owning BCs (issue 2), `libs/db/src/columns.ts` is the only remaining consumer -- and that's only `auditColumns`, which is itself BC-shaped (it's about who created/updated a row).
- **Rule**: Foundational layer dependencies should be minimal. `@ab/db` should be auth-agnostic if possible.
- **Fix**: After issue 2 lands: keep `timestamps()` in `@ab/db/columns`, move `auditColumns` (which references `bauthUser`) to `@ab/audit` (it already owns the audit story) or to a new `@ab/db-helpers` consumer side. Then `@ab/db` drops the `@ab/auth` dep.

### NIT: UI components scattered across multiple libs without a clear convention

- **File**: `libs/ui/src/components/`, `libs/ui/src/handbooks/`, `libs/aviation/src/ui/` (6 components), `libs/help/src/ui/` (10 components), `libs/activities/src/crosswind-component/`, `libs/themes/ThemeProvider.svelte`
- **Problem**: The skill rule reads "ALL visual/UI components live in libs/ui/". Reality has UI in five places: `libs/ui`, `libs/aviation/src/ui`, `libs/help/src/ui`, `libs/activities/...`, `libs/themes/ThemeProvider.svelte`. Some splits make sense (help is a self-contained help-overlay subsystem; aviation reference cards are domain-coupled to the aviation registry; ThemeProvider is part of theming infra), but the convention isn't documented anywhere.
- **Rule**: Either tighten the rule (force everything into `libs/ui`) or document the exception ("a domain lib may co-locate UI when the components are pure consumers of that domain's registry").
- **Fix**: Decide. If consolidation: move the 6 aviation-ui components into `libs/ui/src/aviation/` and the 10 help components into `libs/ui/src/help/`. If exception: write one paragraph in CLAUDE.md "Component Placement" describing the rule and call out the four/five exceptions.

### NIT: `libs/sources` exists at top level but is conceptually part of citations + handbook resolution

- **File**: `libs/sources/`, `libs/aviation/`
- **Problem**: `@ab/sources` (registry, render, parsers, lesson resolver) and `@ab/aviation` (references, registry, sources) overlap heavily by name and by intent. Both have a `registry`, both have something called `sources`, and they're the substrate the citation system uses. A first-time reader has to grep both to figure out which is canonical.
- **Rule**: "Name things first. Propose names and boundaries before writing code."
- **Fix**: Either rename `libs/sources/` to make its scope obvious (`@ab/source-render`? `@ab/citations-resolver`?), or absorb it into `libs/aviation/` if the boundary is artificial. ADR 019 likely already sketches the boundary -- enforce it in the file tree.

### NIT: `apps/sim` has 16+ inline visual components (instruments, horizon, panels) that are reusable across surfaces

- **File**: `apps/sim/src/lib/instruments/Altimeter.svelte`, `Asi.svelte`, `AttitudeIndicator.svelte`, `HeadingIndicator.svelte`, `Tachometer.svelte`, `TurnCoordinator.svelte`, `Vsi.svelte`, `apps/sim/src/lib/horizon/Horizon3D.svelte`, `apps/sim/src/lib/panels/AnnunciatorStrip.svelte`, etc.
- **Problem**: A future avionics app (`avionics/` per `MULTI_PRODUCT_ARCHITECTURE.md`) will want exactly these components. They are visual + reusable + driven by the FDM truth state. Today they're sim-app-private.
- **Rule**: "Is code that's used by multiple apps in a shared lib?" -- not yet, but the architecture explicitly calls out `avionics/` as a coming surface that will need them.
- **Fix**: When `avionics/` is created, extract `instruments/`, `horizon/`, key panels to `libs/ui/src/instruments/` (or a new `libs/avionics-ui/`). Don't pre-extract -- the rule is "create when needed, not before". But mark this in the sim app's README so it's not a surprise on day one of avionics work.
