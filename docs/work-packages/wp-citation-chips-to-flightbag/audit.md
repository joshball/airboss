# Citation surface audit

Inventory of every site that generates a study `/library/...` URL or imports a `ROUTES.LIBRARY_*` constant. Generated 2026-05-03 to scope WP-CITATION-CHIPS-TO-FLIGHTBAG.

## Files referencing `ROUTES.LIBRARY_*` or `LIBRARY_<TYPE>`

20+ files. Categorized by what they do.

### Category A: Route definitions (KEEP, study owns these routes during transition)

These are the actual `+page.svelte` and `+page.server.ts` files that define study's `/library/...` routes:

| File | Notes |
|------|-------|
| `apps/study/src/routes/(app)/library/handbook/[slug]/+page.svelte` | Handbook landing |
| `apps/study/src/routes/(app)/library/handbook/[slug]/[chapter]/+page.svelte` | Chapter |
| `apps/study/src/routes/(app)/library/handbook/[slug]/[chapter]/[section]/+page.svelte` | Section |
| `apps/study/src/routes/(app)/library/regulations/+page.svelte` | Regs index |
| `apps/study/src/routes/(app)/library/regulations/[kind]/+page.svelte` | Per-kind |
| `apps/study/src/routes/(app)/library/regulations/[kind]/[group]/+page.svelte` | Per-group |
| `apps/study/src/routes/(app)/library/regulations/[kind]/[group]/[section]/+page.svelte` | Section |

These routes stay alive during the migration. Eventually deprecate after flightbag has feature parity.

### Category B: Citation chip / link components (REWIRE to flightbag URLs)

| File | Notes |
|------|-------|
| `libs/aviation/src/ui/handbooks/HandbookCard.svelte` | Card component used in /library; rewire its target URL |
| `libs/aviation/src/ui/handbooks/HandbookChapterListItem.svelte` | Chapter row |
| `libs/aviation/src/ui/handbooks/HandbookSectionListItem.svelte` | Section row |
| `libs/aviation/src/ui/LibraryCard.svelte` | Generic library card |

These get the highest-leverage rewire: change them to call `urlForReference(uri)` from `@ab/sources`.

### Category C: BC + helpers (UPDATE if they construct URLs)

| File | Notes |
|------|-------|
| `libs/bc/study/src/regulations.ts` | Regs view aggregator -- inspect for URL construction |
| `libs/bc/study/src/references.ts` | Reference loader -- may emit URL data |
| `libs/aviation/src/slugs.ts` | Slug helpers, possibly URL-related |

Inspect each. If they construct URLs, route through `urlForReference`. If they just emit slugs/codes for the URL builder, leave as-is.

### Category D: Constants definitions (UPDATE: ADD flightbag, KEEP library for transition)

| File | Notes |
|------|-------|
| `libs/constants/src/routes.ts` | `ROUTES.LIBRARY_*` lives here. Already has `ROUTES.FLIGHTBAG_*` (#524). |
| `libs/constants/src/index.ts` | Re-exports |
| `libs/constants/src/study.ts` | Study-specific constants |

### Category E: Tests (UPDATE in lockstep)

| File | Notes |
|------|-------|
| `libs/aviation/__tests__/slugs.test.ts` | URL/slug tests; may have `/library/` literals |
| `libs/bc/study/src/regulations.test.ts` | Regs tests; same |
| `libs/bc/study/src/references.test.ts` | Same |

Update assertions when their corresponding source is rewired.

## Migration sequence

1. **Add `urlForReference()` consumers in citation components first.** Category B files. They start producing flightbag URLs immediately. Study's `/library/...` routes stay alive but stop being the click target.
2. **Update tests.** Category E.
3. **Verify in dev.** Manual smoke: every chip from a study card lands at a flightbag URL.
4. **Soak.** A week of usage with both sets of routes alive.
5. **Deprecate study `/library/...`.** Add audit logging on the study routes; track usage; once it's near-zero, delete.

## Out of scope of this audit

- `ROUTES.LIBRARY_*` URL templates themselves stay alive during the transition; only their CALL SITES change to `urlForReference()`.
- Markdown content with hardcoded `/library/...` URLs: separate grep needed (`rg '\(/library/' course/`).
- Cross-app contexts (sim, FIRC) not surveyed; they don't currently link to /library/ but will start linking to flightbag when WP-CITATION-CHIPS-TO-FLIGHTBAG ships.

## Anchors

- [WP-CITATION-CHIPS-TO-FLIGHTBAG spec](spec.md)
- [PR #524 flightbag scaffold](https://github.com/joshball/airboss/pull/524) (`urlForReference` lives in `libs/sources/src/url-for-reference.ts`)
