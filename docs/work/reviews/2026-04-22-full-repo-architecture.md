---
feature: full-repo
category: architecture
date: 2026-04-22
branch: main
issues_found: 18
critical: 0
major: 11
minor: 5
nit: 2
status: unread
review_status: done
---

## Summary

The overall layering (`constants -> types -> bc -> apps`) holds cleanly at the lib level: no cross-BC imports, no lib-to-app dependencies, `@ab/*` aliases used consistently across lib boundaries, and `bc-sim` is pure (safe for client bundles). The failures are concentrated at the app/routes layer: ~18 study routes each redefine the same visual primitives (`.btn`, `.banner`, `.error`, `.field`, `.card`) as inline CSS; formatter/narrowing helpers are duplicated 8-20 times across routes while the official versions sit in `@ab/utils` and `@ab/constants`; two browse routes import Drizzle table objects and hand-build queries in the route server, bypassing the BC; and the sim route carries ~280 lines of visual CSS with ~30 raw hex values. These are the exact patterns that will multiply when a second surface app (`spatial`, `avionics`, `reflect`, `hangar`) lands.

## Propagatable Patterns (top priority)

These are the boundary issues that will multiply across the next 50+ pages and 6+ surface apps if left uncaught.

1. **Every route redefines `.btn.primary` / `.btn.secondary` / `.btn.ghost` inline.** `Button.svelte` with all four variants exists in `libs/ui/src/components/Button.svelte:1`, yet 17 routes define the same three rules in their own `<style>` blocks (76 `class="btn"` instances). Whenever tokens shift, 17 files drift out of sync. Other primitives duplicated the same way: `.banner`, `.error`, `.field`, `.card`, `.badge`, `.empty`, `.chip`. Rule: visual primitives live in `libs/ui`; routes consume them. Anchors: `apps/study/src/routes/(app)/memory/+page.svelte:293`, `apps/study/src/routes/(app)/memory/review/+page.svelte:590`, `apps/study/src/routes/(app)/memory/new/+page.svelte:326`, `apps/study/src/routes/(app)/memory/browse/+page.svelte`, `apps/study/src/routes/(app)/memory/[id]/+page.svelte`, `apps/study/src/routes/(app)/calibration/+page.svelte:934`, `apps/study/src/routes/(app)/plans/+page.svelte`, `apps/study/src/routes/(app)/plans/new/+page.svelte`, `apps/study/src/routes/(app)/plans/[id]/+page.svelte`, `apps/study/src/routes/(app)/reps/+page.svelte`, `apps/study/src/routes/(app)/reps/new/+page.svelte`, `apps/study/src/routes/(app)/reps/browse/+page.svelte`, `apps/study/src/routes/(app)/sessions/[id]/+page.svelte`, `apps/study/src/routes/(app)/sessions/[id]/summary/+page.svelte`, `apps/study/src/routes/(app)/knowledge/+page.svelte`, `apps/study/src/routes/(app)/knowledge/[slug]/+page.svelte`, `apps/study/src/routes/login/+page.svelte`.

2. **Presentation helpers duplicated inline instead of imported.** `humanize(slug)` is re-declared as a local function in 10 route files (8 `.svelte`, 2 server) while being correctly imported from `@ab/utils` in 4 other files. `domainLabel(slug)` is duplicated 20 times with the same 3-line body (`return (DOMAIN_LABELS as Record<string,string>)[slug] ?? humanize(slug)`). Every new route that touches domains will copy this pattern. Rule: formatters / label resolvers live in `@ab/constants` (next to the enum) or `@ab/utils`. Fix by adding `domainLabel(slug)` to `libs/constants/src/study.ts` next to `DOMAIN_LABELS`, and replacing all 20 copies. Anchors: `apps/study/src/routes/(app)/memory/+page.svelte:11,18`, `apps/study/src/routes/(app)/memory/review/+page.svelte:62,69`, `apps/study/src/routes/(app)/calibration/+page.svelte:22,29`, `apps/study/src/routes/(app)/session/start/+page.svelte:70`, `apps/study/src/routes/(app)/sessions/[id]/+page.svelte:70`, `apps/study/src/routes/(app)/sessions/[id]/summary/+page.svelte:19`, `apps/study/src/routes/(app)/plans/new/+page.svelte:61`, `apps/study/src/routes/(app)/memory/new/+page.svelte:47,54`, `apps/study/src/routes/(app)/memory/[id]/+page.svelte:101,108`, `apps/study/src/routes/(app)/memory/browse/+page.svelte:70,77`, `apps/study/src/routes/(app)/dashboard/_panels/WeakAreasPanel.svelte:17`, `apps/study/src/routes/(app)/dashboard/_panels/ScheduledRepsPanel.svelte:22`, `apps/study/src/routes/(app)/dashboard/_panels/DueReviewsPanel.svelte:28`.

3. **Query-param narrowing re-invented per route.** `narrow<T>(value, allowed)`, `narrowDomain`, `narrowCardType`, `narrowSourceType`, `narrowStatus`, `coerceEnum<T>`, `parseDomain`, `parseCert`, `parseMode`, `parseFocus`, `parseTags` -- 12+ variants of the same idea across the study app, with identical bodies. Any new route filtering by domain will add another copy. Rule: a single `narrowEnum<T>(raw, values)` in `@ab/utils` (plus `parseTags` since it's a form-data pattern). Anchors: `apps/study/src/routes/(app)/memory/browse/+page.server.ts:20-38`, `apps/study/src/routes/(app)/memory/review/+page.server.ts:30`, `apps/study/src/routes/(app)/reps/browse/+page.server.ts:29`, `apps/study/src/routes/(app)/knowledge/+page.server.ts:16`, `apps/study/src/routes/(app)/session/start/+page.server.ts:29-41`, `apps/study/src/routes/(app)/plans/new/+page.server.ts:22`, `apps/study/src/routes/(app)/plans/[id]/+page.server.ts:34`, `apps/study/src/routes/(app)/memory/new/+page.server.ts:13` (`parseTags`), `apps/study/src/routes/(app)/memory/[id]/+page.server.ts:25` (`parseTags`), `apps/study/src/routes/(app)/reps/new/+page.server.ts:56` (`parseTags`).

4. **Route servers hand-build Drizzle count queries, bypassing the BC.** `memory/browse/+page.server.ts` and `reps/browse/+page.server.ts` both import the raw table objects (`card`, `scenario`) and `db` directly, assemble `SQL[]` clauses, and run a `count(*)` query inline -- even though the BC `index.ts:122-124` comment explicitly says "route handlers should prefer BC functions and never issue raw db.insert/select on these tables." Both files mirror the filter shape of `getCards`/`getScenarios` in drift-prone parallel. The next browse page (knowledge, glossary, sessions, plans) will copy this pattern and the BC becomes untrustworthy as the source of truth. Rule: the BC owns every query touching its tables. Fix by adding `countCards(filters)` / `countScenarios(filters)` (or combined `getCardsPage` returning `{ rows, total, hasMore }`) to `libs/bc/study`. Anchors: `apps/study/src/routes/(app)/memory/browse/+page.server.ts:17,72-85`, `apps/study/src/routes/(app)/reps/browse/+page.server.ts:20,84-93`.

5. **Sim route ships ~280 lines of visual CSS with raw hex.** `apps/sim/src/routes/[scenarioId]/+page.svelte:401-681` contains 30 raw `#xxxxxx` values (`#6b7280`, `#2563eb`, `#059669`, `#d97706`, `#dc2626`, `#e0443e`, `#c23530`, ...) on primitives that should not exist in a route: `.status-badge`, `.readout`, `.reset-button`, `.boot-error`, `.kb-toggle`, `.mute-button`, `.help-button`, `.auto-coord-toggle`. The inline status-banner component is the most expensive: 5 status variants each with 3-color combinations hard-coded. Rule: route-only CSS is layout (grid/flex), not visuals; hex-with-var-fallback (`var(--x, #666)`) is a token migration marker that still carries drift risk. Phase 0.5 comment at line 580-586 admits the residual is intentional, but before `avionics/` spins up the cockpit theme, this needs to resolve. Anchors: `apps/sim/src/routes/[scenarioId]/+page.svelte:521,572,588-615,624-634`; supporting cockpit components in `apps/sim/src/lib/instruments/*.svelte` and `apps/sim/src/lib/panels/*.svelte` all carry hex too -- 40+ instances.

6. **Cockpit instruments + panels live in `apps/sim/src/lib`, not a shared lib.** `Altimeter.svelte`, `AttitudeIndicator.svelte`, `Asi.svelte`, `HeadingIndicator.svelte`, `TurnCoordinator.svelte`, `Vsi.svelte`, `Tachometer.svelte`, `VSpeeds.svelte`, `ControlInputs.svelte`, `ScenarioStepBanner.svelte`, `WxPanel.svelte`, `KeybindingsHelp.svelte`, `ResetConfirm.svelte` are all generic cockpit widgets reusable by any future `avionics/` or `firc/` app. Per MULTI_PRODUCT_ARCHITECTURE, `avionics/` is already on the build order (order #6). Rule: anything visual and reusable lives in `libs/ui` or a sibling `libs/sim-ui`; app-local `lib/` holds only app-specific glue (e.g., `fdm-worker.ts`, `worker-protocol.ts`, `control-handler.ts` are correct here). Anchors: all files under `apps/sim/src/lib/instruments/` and `apps/sim/src/lib/panels/`.

7. **Session-runner skip-action orchestrates BC calls with branching logic in the route.** `apps/study/src/routes/(app)/sessions/[id]/+page.server.ts:385-457` implements the three-way skip (`today` / `topic` / `permanent`) as procedural code: fetch active plan, branch on `slot.nodeId` vs `resolveSlotDomain`, call `addSkipNode`/`addSkipDomain`, then on `permanent` additionally call `setCardStatus`/`setScenarioStatus`. The docstring at line 370-384 reads like a BC contract. Rule: multi-step workflows that coordinate BC calls belong in the BC as a named transaction (`skipSlot(sessionId, userId, slotIndex, skipKind)`); the route just calls one function. This matters because when another surface runs sessions (future proficiency mode, avionics drills) the same logic gets re-implemented. Anchors: `apps/study/src/routes/(app)/sessions/[id]/+page.server.ts:195-207,385-457`.

## Issues

### MAJOR: Route files redefine `.btn` / `.card` / `.field` / `.banner` / `.error` primitives inline

- **File**: see Propagatable Pattern #1 for the full 17-file list; representative anchor `apps/study/src/routes/(app)/memory/+page.svelte:293-333`
- **Problem**: Visual primitives are duplicated as route-local `<style>` rules while `libs/ui/src/components/Button.svelte` already exports a tokenized, variant-driven implementation. Tokens change -> 17 files drift out of sync. Every new page copies the nearest route's CSS and compounds.
- **Rule**: CLAUDE.md "Critical Rules" -> route CSS is layout-only; visual components live in `libs/ui`. Also DESIGN_SYSTEM ADR 003.
- **Fix**: Audit every `.btn` / `.btn.primary` / `.btn.secondary` / `.btn.ghost` declaration across routes; replace with `<Button variant="...">`. Same pass for `.banner`, `.error`, `.field`, `.card`, `.badge`, `.empty`, `.chip`, `.actions` -- extract the ones not already in `libs/ui` (`Banner`, `FormField`, `EmptyState`, `Chip`, `ActionBar`) and retire the inline versions. A single token-migration pass across all 17 route files, not one-at-a-time.

### MAJOR: `humanize` and `domainLabel` re-declared inline in 10+ and 20+ files

- **File**: see Propagatable Pattern #2 anchors
- **Problem**: `humanize` exists in `libs/utils/src/strings.ts` and is imported correctly in 4 files; 8 other files duplicate the body inline. `domainLabel` has 20 independent copies. The duplication is recent and spreading -- every new page that references a domain copies the pattern.
- **Rule**: constants/domain helpers live in `@ab/constants`; generic string utils in `@ab/utils`.
- **Fix**: (1) Add `domainLabel(slug: string): string` to `libs/constants/src/study.ts` adjacent to `DOMAIN_LABELS` (or to a new `labels.ts` if study.ts grows). (2) Replace all 20 inline definitions with `import { domainLabel } from '@ab/constants'`. (3) Replace all 8 inline `humanize` copies with `import { humanize } from '@ab/utils'`.

### MAJOR: Query-param narrowing helper duplicated 12+ times instead of one `libs/utils` primitive

- **File**: see Propagatable Pattern #3 anchors
- **Problem**: Every route that reads `?domain=` / `?cert=` / `?mode=` etc. defines its own `narrow<T>`, `narrowDomain`, `narrowCardType`, `narrowSourceType`, `parseDomain`, `parseMode`, `parseFocus`, `parseCert`, `coerceEnum<T>`. `parseTags` is duplicated 3 times. Bodies are identical.
- **Rule**: Generic helpers in `@ab/utils`. Route-specific parsing is the route's job, but the membership-check primitive isn't route-specific.
- **Fix**: Add `narrowEnum<T extends string>(raw: string | null, values: readonly T[]): T | undefined` and `parseTagList(raw: string): string[]` to `libs/utils`. Replace all call sites. Keep per-route `parseDomain` wrappers only where the narrowing signature has additional guards.

### MAJOR: Browse routes hand-build Drizzle count queries, bypassing BC

- **File**: `apps/study/src/routes/(app)/memory/browse/+page.server.ts:17,72-85`, `apps/study/src/routes/(app)/reps/browse/+page.server.ts:20,84-93`
- **Problem**: Route imports `card` / `scenario` table objects and `db` directly, reimplements the same filter logic that `getCards`/`getScenarios` already runs, and issues `count(*)` inline. The filter shape is now authored twice per feature and must be kept in sync by hand. BC `index.ts:122-124` explicitly warns against this pattern.
- **Rule**: BCs own every query against their tables. Routes consume BC functions.
- **Fix**: Replace with a single BC function per resource: either `getCardsPage(userId, filters, page): { rows, total, hasMore }` (richer API, single round-trip) or separate `countCards(userId, filters)` / `countScenarios(userId, filters)` helpers. Remove the `card` / `scenario` table exports from `libs/bc/study/src/index.ts` line 149-161 after migration (the seed scripts can import from `schema.ts` directly with a comment). Verify with `grep -rn "from ['\"]@ab/bc-study['\"]" apps` that no route imports tables.

### MAJOR: Calibration page defines ~560 lines of visual CSS with inline primitives

- **File**: `apps/study/src/routes/(app)/calibration/+page.svelte:413-978`
- **Problem**: The page defines `.score-card`, `.interpretation-card`, `.chart-card`, `.domains-card`, `.trend-card`, `.bucket`, `.bar-fill`, `.bar-track`, `.gap-pill`, `.domain-table`, `.sparkline` and the full `.btn` family inline. This is three or four reusable components (`BucketRow`, `GapPill`, `Sparkline`, `DomainTable`) masquerading as page CSS. `Card.svelte` already exists in `libs/ui` but isn't used.
- **Rule**: Visual primitives in `libs/ui`. Route `<style>` is layout/flow only.
- **Fix**: Extract `BucketRow.svelte`, `GapPill.svelte`, `Sparkline.svelte`, `StatCard.svelte` (or reuse `StatTile`) into `libs/ui`. Use existing `Button`. Leave only page-grid layout CSS (~60 lines) in the route.

### MAJOR: Sim cockpit scene renders ~280 lines of visual CSS with 30 raw hex values in a route

- **File**: `apps/sim/src/routes/[scenarioId]/+page.svelte:401-681`
- **Problem**: Page-local CSS defines `.status`, `.status-badge`, `.readout`, `.reset-button`, `.boot-error`, `.kb-toggle`, `.mute-button`, `.help-button`, `.auto-coord-toggle`, `.objective-banner` as full-fidelity visuals with 30 hex literals. The inline comment at line 580-586 acknowledges the residual but it still ships. Before `avionics/` exists, this is the reference implementation future cockpit apps will copy.
- **Rule**: No raw hex in components; no visual primitives in routes.
- **Fix**: Token-migration pass: eliminate every `var(--x, #abc)` fallback (the tokens are defined; the fallback is safety that no longer triggers). Extract `StatusBanner.svelte` (5-state badge + label), `Readout.svelte` (label/value with warning state), `BootError.svelte` into `libs/ui`. Re-theme with `--ab-cockpit-*` tokens if the sim needs a dark/instrument palette distinct from `web`/`tui`.

### MAJOR: Cockpit instruments and panels live in `apps/sim/src/lib` but are reusable across surface apps

- **File**: `apps/sim/src/lib/instruments/*.svelte` (7 files), `apps/sim/src/lib/panels/*.svelte` (6 files)
- **Problem**: `Altimeter`, `AttitudeIndicator`, `Asi`, `HeadingIndicator`, `TurnCoordinator`, `Vsi`, `Tachometer`, `ControlInputs`, `VSpeeds`, `WxPanel`, `ScenarioStepBanner`, `KeybindingsHelp`, `ResetConfirm` are all cockpit widgets. Per MULTI_PRODUCT_ARCHITECTURE, `avionics/` is surface app #6 in the build order. When it lands, these get re-imported or re-copied.
- **Rule**: Anything visual and reusable belongs in `libs/ui` or a sibling (e.g., `libs/cockpit/` or `libs/sim-ui/`). `apps/*/src/lib` holds only app-specific glue (workers, bindings, app storage, scene composition).
- **Fix**: Create `libs/cockpit/` with `instruments/` + `panels/` subtrees; move all 13 components; re-import via `@ab/cockpit/instruments/Altimeter.svelte`. Keep `fdm-worker.ts`, `worker-protocol.ts`, `control-handler.ts`, `stall-horn.svelte.ts` in `apps/sim/src/lib` -- these are app-specific. Decide as part of the move whether `libs/cockpit` is a standalone lib or a `libs/ui/cockpit/` subfolder of UI.

### MAJOR: Session-runner skip orchestration lives in the route server, not the BC

- **File**: `apps/study/src/routes/(app)/sessions/[id]/+page.server.ts:195-207,385-457`
- **Problem**: The `skip` action implements a BC-level workflow as route-side procedural code: fetch active plan, resolve slot domain, branch on `skipKind`, mutate plan via `addSkipNode`/`addSkipDomain`, then conditionally mutate content via `setCardStatus`/`setScenarioStatus`. `resolveSlotDomain` (lines 195-207) is a BC concern leaking up. The docstring at line 370-384 reads like a BC contract.
- **Rule**: Transactions and workflows live in BCs. Routes are thin shells.
- **Fix**: Add `skipSlot({ sessionId, userId, slotIndex, skipKind })` to `libs/bc/study/src/sessions.ts` (or a new `session-skip.ts`). The route reduces to validating input and calling the BC. Pull `resolveSlotDomain` into the BC. When the proficiency mode or `avionics` app runs sessions, they call one function instead of re-implementing the branching.

### MAJOR: Types exported from routes that should live in BCs

- **File**: `apps/study/src/routes/(app)/memory/new/+page.server.ts:101` (`export type NewCardInput`), `apps/study/src/routes/(app)/reps/new/+page.server.ts:132` (`export type NewScenarioInput`)
- **Problem**: Route files aren't import targets. A BC consumer that needs `NewCardInput` can't reach it from `@ab/bc-study`. `newCardSchema` already exists in BC; its `z.infer` should be exported next to it.
- **Rule**: Types live in `libs/types` or the BC that owns the schema, never in routes.
- **Fix**: Move both exports to `libs/bc/study/src/validation.ts` next to `newCardSchema` / `newScenarioSchema`, add to the BC barrel, import from `@ab/bc-study` in the routes.

### MAJOR: `libs/types` is an empty placeholder while types scatter across BCs and routes

- **File**: `libs/types/src/index.ts:1` (contents: `// Shared types -- populated as features are built`)
- **Problem**: CLAUDE.md declares `libs/types` as the home of shared types and Zod schemas, but the file is empty and all Zod schemas live in `libs/bc/study/src/validation.ts`. The direction described in the doc (`constants -> types -> bc -> apps`) is not enforced.
- **Rule**: Either use `libs/types` or delete it. An empty placeholder lib drifts.
- **Fix**: Decide: (a) keep `libs/types` and migrate cross-BC shared types there once the second BC is real; until then, remove it to avoid confusion; or (b) keep it, document explicitly that Zod schemas for BC-internal validation stay in the BC (current behavior) and only cross-BC types land here. Document the decision in ADR 002 or an amendment.

### MAJOR: `vite.config.ts` in apps uses deep relative paths to constants

- **File**: `apps/study/vite.config.ts:3`, `apps/sim/vite.config.ts:3`
- **Problem**: Both configs use `import { HOSTS } from '../../libs/constants/src/hosts'` -- a deep relative cross-lib import that explicitly violates the monorepo rule. This works because it runs in the Vite build (which resolves before alias setup), but it's the single leakage of the import-rule across the repo and sets a bad precedent for any future `vite.config.ts` that needs auth/ports/hosts.
- **Rule**: `@ab/*` aliases for cross-lib imports, always.
- **Fix**: Resolve the `@ab/constants` alias inside the Vite config (Vite is aware of its own aliases at resolve time for `defineConfig` imports too via `vite-node`) or import through the resolved path: check that `bun` workspace linking already exports `@ab/constants` at `libs/constants/src/index.ts`. If it truly must be a file import, keep it but pin with a sibling `tsconfig path` and a comment; preferred is to move `HOSTS` to a build-time constants file imported via alias.

### MINOR: Knowledge node view assembly runs in the route instead of a BC view function

- **File**: `apps/study/src/routes/(app)/knowledge/[slug]/+page.server.ts:23-72`
- **Problem**: `groupEdgesByType`, `outboundOfType` / `inboundOfType`, and the edge-title resolution loop compose a `NodeViewWithEdges` shape in the route. Next time the knowledge node view renders elsewhere (print surface, hangar authoring preview, a different app), this assembly is re-implemented.
- **Rule**: View-model assembly is a BC responsibility when non-trivial.
- **Fix**: Add `getNodeViewFull(slug, userId): { node, phases, edges: { requires, deepens, appliedBy, taughtBy, related }, mastery, lifecycle }` to `libs/bc/study/src/knowledge.ts`. Route becomes a call-and-return.

### MINOR: Knowledge index server runs `groupByDomain` projection inline

- **File**: `apps/study/src/routes/(app)/knowledge/+page.server.ts:56-64`
- **Problem**: Same pattern as above but lighter. If the knowledge list is ever rendered elsewhere (hangar browse, a cert-progress card), the grouping repeats.
- **Rule**: Move BC view-shape projections to the BC.
- **Fix**: Return a `groups: Array<{ domain, nodes }>` shape from `listNodesForBrowse` directly, or add `listNodesForBrowseGrouped`. Routes still free to re-sort/flatten as needed.

### MINOR: `libs/aviation` uses a single relative import in one source extractor

- **File**: `libs/aviation/src/sources/cfr/extract.ts:13`
- **Problem**: `import type { SourceExtractor } from '../../schema/source'` is intra-lib so the relative path is technically allowed by the CLAUDE.md rule ("intra-lib relative imports are fine"). But the 2-hop `../../` pattern signals that the file outgrew its directory; other files in this lib use the alias barrel.
- **Rule**: Intra-lib relative imports fine; prefer one-hop.
- **Fix**: Either add a local `index.ts` at `libs/aviation/src/schema/` that re-exports `SourceExtractor`, or leave as-is. Non-urgent.

### MINOR: Dashboard panels live under `apps/study/src/routes/(app)/dashboard/_panels/`

- **File**: `apps/study/src/routes/(app)/dashboard/_panels/*.svelte` (9 files)
- **Problem**: These are well-structured (thin, use `PanelShell` from `libs/ui`, use tokens, use typed BC data). They're dashboard-specific today, but by the time `reflect/` or `hangar/` wants a dashboard, any reusable panels will either be copied or retrofit-extracted. `CalibrationPanel`, `ScheduledRepsPanel`, `DueReviewsPanel`, `ActivityPanel`, `CtaPanel` are generic enough to be reusable across surfaces.
- **Rule**: Visual components reusable across surfaces belong in `libs/ui`. Panels that genuinely are study-dashboard-only stay here.
- **Fix**: Audit each panel against "will `reflect/` or `hangar/` want this?". Lift reusable ones into `libs/ui/panels/`; leave truly study-bound ones (`WeakAreasPanel`, `CertProgressPanel`, `MapPanel`, `StudyPlanPanel`) in place. Non-urgent until the second dashboard is real.

### MINOR: Route-file size suggests missing component extraction

- **File**: `apps/study/src/routes/(app)/memory/[id]/+page.svelte` (748 lines), `apps/study/src/routes/(app)/session/start/+page.svelte` (749 lines), `apps/study/src/routes/(app)/memory/review/+page.svelte` (729 lines), `apps/study/src/routes/(app)/reps/browse/+page.svelte` (653 lines), `apps/study/src/routes/(app)/reps/new/+page.svelte` (602 lines), `apps/study/src/routes/(app)/knowledge/[slug]/+page.svelte` (650 lines)
- **Problem**: Routes above 500 lines almost always hide extractable components. These six routes total 4000+ lines in `<template>` + `<style>`. Once Propagatable #1 and #5 are fixed (primitives extracted), these will shrink, but expect 2-3 per file to still warrant their own component.
- **Rule**: Thin route shells. Rule of thumb: if a route has > 300 lines, audit for extractable components.
- **Fix**: Re-measure after fixing Propagatable Patterns #1, #2, #5. Re-review anything still over 400 lines.

### NIT: `NewScenarioInput` type defined as inline object in route

- **File**: `apps/study/src/routes/(app)/reps/new/+page.server.ts:132`
- **Problem**: `export type NewScenarioInput = { ... }` is hand-authored as an object type instead of `z.infer<typeof newScenarioSchema>` (like `NewCardInput`). If the schema drifts, the type won't catch it.
- **Rule**: Types derived from Zod use `z.infer`.
- **Fix**: Move to BC (covered by major item above); while there, rewrite as `z.infer<typeof newScenarioSchema>`.

### NIT: Comment in review-page.server.ts says "keeping the two flows in lockstep"

- **File**: `apps/study/src/routes/(app)/memory/review/+page.server.ts:44-46`
- **Problem**: The comment admits two review flows (standalone `/memory/review` and in-session runner) duplicate the "prompt confidence on every card" rule. Both routes set `promptConfidence: true`; if one drifts, calibration buckets bias.
- **Rule**: Rules duplicated across routes become a BC constant.
- **Fix**: Export `REVIEW_PROMPT_CONFIDENCE = true` from `libs/constants/src/study.ts` (or a BC config export) and import both places. Trivial but prevents the documented drift risk.

## What's working (don't regress)

- `libs/bc/study` and `libs/bc/sim` have no cross-BC imports.
- Leaf libs (`constants`, `utils`, `db`, `auth`, `themes`) import correctly: constants depends on nothing; utils on constants only; db on constants+utils+auth-schema; auth on constants+db+utils.
- `@ab/*` aliases used consistently across every cross-lib import in source code (the one violation is in vite configs, above).
- `@ab/activities` and `@ab/aviation` both use "barrel for utilities, path-import for components" correctly to avoid pulling Svelte runtime into non-UI consumers.
- `apps/sim/src/lib/fdm-worker.ts`, `worker-protocol.ts`, `control-handler.ts`, `stall-horn.svelte.ts` -- these are correctly placed as app-local glue; they bind browser/worker APIs to the pure `bc-sim` engine.
- `bc-sim` is pure (no `@ab/db`, no `@ab/auth`), safe for client bundles -- the `+page.ts` client loader importing `listScenarios` proves the boundary.
- Dashboard panels (`_panels/*.svelte`) are the model for future panel composition: thin, token-driven, use `PanelShell` from `libs/ui`, take typed BC data as props.
- Server loads that are pure delegation (`memory/+page.server.ts:12 lines`, `plans/+page.server.ts:10 lines`, `dashboard/+page.server.ts:12 lines`, `reps/+page.server.ts:14 lines`, `calibration/+page.server.ts:20 lines`) show the target shape.
