# flightbag-scaffold tasks

## Phase 0 -- Spec docs

- [x] Author `docs/work-packages/flightbag-scaffold/spec.md`
- [x] Author `docs/work-packages/flightbag-scaffold/tasks.md`
- [x] Author `docs/work-packages/flightbag-scaffold/test-plan.md`

## Phase 1 -- ROUTES additions

- [x] Add `ROUTES.FLIGHTBAG_HOME` to `libs/constants/src/routes.ts`
- [x] Add `ROUTES.FLIGHTBAG_HANDBOOK(slug, edition)`
- [x] Add `ROUTES.FLIGHTBAG_HANDBOOK_CHAPTER(slug, edition, chapter)`
- [x] Add `ROUTES.FLIGHTBAG_HANDBOOK_SECTION(slug, edition, chapter, section)`
- [x] Add `ROUTES.FLIGHTBAG_AIM_PARAGRAPH(chapter, section, paragraph)`
- [x] Add `ROUTES.FLIGHTBAG_CFR_SECTION(title, part, section)`
- [x] Add `ROUTES.FLIGHTBAG_AC(doc, rev)`
- [x] Add `ROUTES.FLIGHTBAG_ACS_TASK(doc, area, task)`
- [x] Author `libs/constants/src/routes.test.ts` covering each new constant

## Phase 2 -- urlForReference helper

- [x] Add `libs/sources/src/url-for-reference.ts` with `urlForReference(uri)` exported
- [x] Dispatch on corpus -> matching `ROUTES.FLIGHTBAG_*`
- [x] Re-export from `libs/sources/src/index.ts`
- [x] Add `libs/sources/src/url-for-reference.test.ts` with cases for handbooks (4 depths), aim, regs, ac, acs

## Phase 3 -- libs/library scaffold

- [x] Create `libs/library/package.json` with `@ab/library`, deps on `@ab/sources`, `@ab/constants`, `@ab/ui`
- [x] Create `libs/library/src/index.ts` barrel
- [x] Create `libs/library/src/RenderedSection.svelte` (stub)
- [x] Create `libs/library/src/CitationChip.svelte` (stub, links via `urlForReference`)
- [x] Create smoke tests under `libs/library/__tests__/`
- [x] Add `@ab/library` to root tsconfig path aliases + vitest aliases + biome lib list

## Phase 4 -- apps/flightbag scaffold

- [x] Add `PORTS.FLIGHTBAG = 9640` to `libs/constants/src/ports.ts`
- [x] Add `HOSTS.FLIGHTBAG`, `HOST_PREFIXES.FLIGHTBAG` to `libs/constants/src/hosts.ts`
- [x] Create `apps/flightbag/package.json` with `dev` script bound to port 9640
- [x] Create `apps/flightbag/tsconfig.json`
- [x] Create `apps/flightbag/svelte.config.js` with alias map (incl. `@ab/library`)
- [x] Create `apps/flightbag/vite.config.ts`
- [x] Create `apps/flightbag/src/app.html`, `src/app.d.ts`, `src/hooks.server.ts` (no auth)
- [x] Create `apps/flightbag/src/routes/+layout.svelte` minimal nav
- [x] Create `apps/flightbag/src/routes/+page.svelte` corpus index
- [x] Create handbook routes (3 levels) under `src/routes/handbook/[slug]/[edition]/...`
- [x] Create `src/routes/aim/[chapter]/[section]/[paragraph]/+page.svelte`
- [x] Create `src/routes/cfr/[title]/[part]/[section]/+page.svelte`
- [x] Create `src/routes/ac/[doc]/[rev]/+page.svelte`
- [x] Create `src/routes/acs/[doc]/area/[area]/task/[task]/+page.svelte`
- [x] Add flightbag to `scripts/check.ts` SVELTE_APPS + svelte-check chain

## Phase 5 -- Tests

- [x] `bun run check` clean for newly added code (svelte-check + biome)
- [x] `bun --cwd apps/flightbag run build` succeeds (with `DATABASE_URL` env var, same as study/sim/hangar)
- [x] `libs/library` smoke tests pass
- [x] `libs/sources/src/url-for-reference.test.ts` passes
- [x] `libs/constants/src/routes.test.ts` passes
- [x] grep `apps/flightbag/src` for raw `/handbook/` etc returns zero matches

## Phase 6 -- Docs

- [x] Flip "Future architecture" -> "Current architecture (scaffolded 2026-05-03)" in `docs/platform/REFERENCES.md`
- [x] CLAUDE.md `apps` + `libs` inventory updates already landed via PR #516
- [x] Update `docs/platform/MULTI_PRODUCT_ARCHITECTURE.md` apps + libs lists
- [x] `docs/products/flightbag/VISION.md` already authored via PR #515

## Ship

- [ ] Push branch
- [ ] Open PR `feat(flightbag): scaffold apps/flightbag + libs/library + URL helpers`
- [ ] Merge with squash
