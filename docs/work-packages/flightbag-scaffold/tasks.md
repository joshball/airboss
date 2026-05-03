# flightbag-scaffold tasks

## Phase 0 -- Spec docs

- [x] Author `docs/work-packages/flightbag-scaffold/spec.md`
- [x] Author `docs/work-packages/flightbag-scaffold/tasks.md`
- [x] Author `docs/work-packages/flightbag-scaffold/test-plan.md`

## Phase 1 -- ROUTES additions

- [ ] Add `ROUTES.FLIGHTBAG_HOME` to `libs/constants/src/routes.ts`
- [ ] Add `ROUTES.FLIGHTBAG_HANDBOOK(slug, edition)`
- [ ] Add `ROUTES.FLIGHTBAG_HANDBOOK_CHAPTER(slug, edition, chapter)`
- [ ] Add `ROUTES.FLIGHTBAG_HANDBOOK_SECTION(slug, edition, chapter, section)`
- [ ] Add `ROUTES.FLIGHTBAG_AIM_PARAGRAPH(chapter, section, paragraph)`
- [ ] Add `ROUTES.FLIGHTBAG_CFR_SECTION(title, part, section)`
- [ ] Add `ROUTES.FLIGHTBAG_AC(doc, rev)`
- [ ] Add `ROUTES.FLIGHTBAG_ACS_TASK(doc, area, task)`
- [ ] Author `libs/constants/src/routes.test.ts` covering each new constant

## Phase 2 -- urlForReference helper

- [ ] Add `libs/sources/src/url-for-reference.ts` with `urlForReference(uri)` exported
- [ ] Dispatch on corpus -> matching `ROUTES.FLIGHTBAG_*`
- [ ] Re-export from `libs/sources/src/index.ts`
- [ ] Add `libs/sources/src/url-for-reference.test.ts` with cases for handbooks (4 depths), aim, regs, ac, acs

## Phase 3 -- libs/library scaffold

- [ ] Create `libs/library/package.json` with `@ab/library`, deps on `@ab/sources`, `@ab/constants`, `@ab/ui`
- [ ] Create `libs/library/tsconfig.json`
- [ ] Create `libs/library/src/index.ts` barrel
- [ ] Create `libs/library/src/RenderedSection.svelte` (stub)
- [ ] Create `libs/library/src/CitationChip.svelte` (stub, links via `urlForReference`)
- [ ] Create `libs/library/src/index.test.ts` smoke test
- [ ] Add `@ab/library` to root tsconfig path aliases

## Phase 4 -- apps/flightbag scaffold

- [ ] Add `PORTS.FLIGHTBAG = 9640` to `libs/constants/src/ports.ts`
- [ ] Add `HOSTS.FLIGHTBAG`, `HOST_PREFIXES.FLIGHTBAG` to `libs/constants/src/hosts.ts`
- [ ] Create `apps/flightbag/package.json` with `dev` script bound to port 9640
- [ ] Create `apps/flightbag/tsconfig.json`
- [ ] Create `apps/flightbag/svelte.config.js` with alias map (incl. `@ab/library`)
- [ ] Create `apps/flightbag/vite.config.ts`
- [ ] Create `apps/flightbag/src/app.html`, `src/app.d.ts`, `src/hooks.server.ts` (no auth)
- [ ] Create `apps/flightbag/src/routes/+layout.svelte` minimal nav
- [ ] Create `apps/flightbag/src/routes/+page.svelte` corpus index
- [ ] Create handbook routes (3 levels) under `src/routes/handbook/[slug]/[edition]/...`
- [ ] Create `src/routes/aim/[chapter]/[section]/[paragraph]/+page.svelte`
- [ ] Create `src/routes/cfr/[title]/[part]/[section]/+page.svelte`
- [ ] Create `src/routes/ac/[doc]/[rev]/+page.svelte`
- [ ] Create `src/routes/acs/[doc]/area/[area]/task/[task]/+page.svelte`

## Phase 5 -- Tests

- [ ] `bun run check` clean
- [ ] `bun --cwd apps/flightbag run build` succeeds
- [ ] `libs/library` index test passes
- [ ] `libs/sources/src/url-for-reference.test.ts` passes
- [ ] `libs/constants/src/routes.test.ts` passes

## Phase 6 -- Docs

- [ ] Flip "Future architecture" -> "Current architecture (scaffolded 2026-05-03)" in `docs/platform/REFERENCES.md`
- [ ] Update `apps` inventory in `CLAUDE.md` if present
- [ ] Update `docs/platform/MULTI_PRODUCT_ARCHITECTURE.md` apps list
- [ ] Author `docs/products/flightbag/VISION.md` (minimal: reader app)

## Ship

- [ ] Push branch
- [ ] Open PR `feat(flightbag): scaffold apps/flightbag + libs/library + URL helpers`
- [ ] Merge with squash
