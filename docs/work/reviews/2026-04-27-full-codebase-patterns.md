---
feature: full-codebase
category: patterns
date: 2026-04-27
branch: main
issues_found: 12
critical: 1
major: 6
minor: 4
nit: 1
---

## Summary

Strong overall compliance with CLAUDE.md house rules. The Svelte 4 surface is fully retired (no `export let`, `<slot>`, `$:`, `$app/stores`, `createEventDispatcher`), `ulidx` is correctly centralized in `libs/utils/src/ids.ts`, `ROUTES` carries every server redirect, Drizzle's `sql\`` template is used for typed fragments (no raw `db.execute('...')` strings), and the engine scoring file is free of inline numeric literals. The `as any` escape hatch is confined to test files, and PDFs/source binaries are correctly gitignored.

The remaining gaps cluster in three areas: (1) the `libs/help/` UI ships rem-literal `font-size` rules instead of `--ab-font-size-*` tokens across 7 files (largest single-area drift), (2) inline query-param string literals in `searchParams.get()` calls bypass `QUERY_PARAMS` in 14 server-load sites, and (3) a small set of one-off cosmetic violations (one inline `/glossary` href, hardcoded hex fallback in dev route, `#0366d6` and `0.875em` in the references dev page).

## Issues

### CRITICAL: Help UI ships rem-literal font sizes instead of `--ab-font-size-*` tokens

- **File**: `libs/help/src/ui/MarkdownBody.svelte:159,171,177,182,207,231,240,284,328,377`, `libs/help/src/ui/HelpSearchPalette.svelte:250,277,289,331,339,343,353,366,375`, `libs/help/src/ui/HelpSearch.svelte:77,92,97`, `libs/help/src/ui/HelpTOC.svelte:54`, `libs/help/src/ui/HelpLayout.svelte:122,129,135,144`, `libs/help/src/ui/HelpSection.svelte:87,113,119`, `libs/help/src/ui/ExternalRefsFooter.svelte:43,87,103,109`, `libs/help/src/ui/HelpCard.svelte:80,84`, `libs/aviation/src/ui/ReferenceFilter.svelte`, `libs/aviation/src/ui/ReferenceSidebar.svelte`, `libs/aviation/src/ui/ReferencePage.svelte`, `libs/aviation/src/ui/ReferenceTerm.svelte`
- **Problem**: 59 `font-size: <number>rem|em|px` declarations across the help/aviation UI. CLAUDE.md / `common-pitfalls.md` require all font sizes to flow through `var(--ab-font-size-*)` so the entire UI scales from a single base. Two `em`-relative declarations (`MarkdownBody.svelte:207,231`, `apps/study/src/routes/(dev)/references/+page.svelte:100,107`) and two `px` declarations (`libs/activities/src/crosswind-component/CrosswindComponent.svelte:494,512`) are even worse: `em` is parent-relative (breaks root scale), `px` doesn't honor user zoom.
- **Rule**: CLAUDE.md "All font sizes via `--ab-font-size-*`. `rem` for font sizes and spacing." `common-pitfalls.md` quick-checklist #2.
- **Fix**: Replace each literal with the appropriate token. Audit `libs/themes/tokens.css` for available `--ab-font-size-{xs,sm,md,lg,xl,2xl}` and add new ones at the right step if a needed size is missing. Convert the 4 `em`/`px` declarations to `rem` tokens explicitly. The help library is a leaf -- one file pass closes the bulk.

### MAJOR: Inline query-param string literals bypass `QUERY_PARAMS` constant

- **File**:
  - `apps/study/src/routes/(dev)/references/+page.server.ts:198` (`'mode'`)
  - `apps/study/src/routes/login/+page.server.ts:66` (`'redirectTo'`)
  - `apps/study/src/routes/api/citations/search/+server.ts:25,26` (`'target'`, `'q'`)
  - `apps/hangar/src/routes/login/+page.server.ts:63` (`'redirectTo'`)
  - `apps/hangar/src/routes/(app)/jobs/[id]/log/+server.ts:24` (`'sinceSeq'`)
  - `apps/hangar/src/routes/(app)/jobs/+page.server.ts:12,13` (`'kind'`, `'status'`)
  - `apps/hangar/src/routes/(app)/glossary/sources/+page.server.ts:17,18` (`'format'`, `'dirty'`)
  - `apps/hangar/src/routes/(app)/glossary/+page.server.ts:31,32,33` (`'kind'`, `'rules'`, `'dirty'`)
  - `apps/hangar/src/routes/(app)/sources/[id]/files/raw/+server.ts:47` (`'name'`)
- **Problem**: 14 `url.searchParams.get('<literal>')` callsites use string literals that don't appear in `QUERY_PARAMS` in `libs/constants/src/routes.ts`. Note: `'q'` is bound by `QUERY_PARAMS.SEARCH = 'q'`, so the citations search endpoint should reuse it; the others (`redirectTo`, `sinceSeq`, `target`, `kind`, `status`, `format`, `dirty`, `rules`, `name`, `mode`) need new entries.
- **Rule**: CLAUDE.md "All literal values in `libs/constants/`." -- query-string keys are exactly the kind of magic string this rule covers, and the `QUERY_PARAMS` constant exists precisely for this.
- **Fix**: Add the missing keys to `QUERY_PARAMS` (`REDIRECT_TO`, `SINCE_SEQ`, `TARGET`, `KIND`, `STATUS`, `FORMAT`, `DIRTY`, `RULES`, `NAME`, `MODE`), then update each `searchParams.get(...)` callsite to use the constant. Reuse `QUERY_PARAMS.SEARCH` for the citations search endpoint rather than introducing a parallel `'q'`.

### MAJOR: Inline `/glossary` href bypasses `ROUTES.HANGAR_GLOSSARY`

- **File**: `apps/hangar/src/lib/components/FlowDiagram.svelte:261`
- **Problem**: `<a href="/glossary">/glossary</a>` is the only inline route string in production code. `ROUTES.HANGAR_GLOSSARY = '/glossary'` already exists in `libs/constants/src/routes.ts:259`.
- **Rule**: CLAUDE.md "All routes go through `ROUTES` in `libs/constants/src/routes.ts`. Never write a path string inline."
- **Fix**: `<a href={ROUTES.HANGAR_GLOSSARY}>/glossary</a>` (or render the route string from the constant in the link text too). Import `ROUTES` from `@ab/constants`.

### MAJOR: Three.js horizon scene colors hardcoded as hex

- **File**: `apps/sim/src/lib/horizon/Horizon3D.svelte:72-77,118-119,144-147`
- **Problem**: `new Color('#a8c4d6')`, `new Color('#3a5d80')`, etc., plus `rgba(255, 255, 255, ...)` gradient stops. Six discrete sky/ground/grid/runway colors plus four sun-glow rgba stops are hardcoded. These are visual values that bypass the theme system, so a glass/sectional reskin can't reach them.
- **Rule**: CLAUDE.md "All colors via `--ab-color-*`. ... If a needed token doesn't exist, add it to the project's themes/tokens directory -- don't inline the value."
- **Fix**: Add `--ab-color-horizon-sky-top`, `--ab-color-horizon-sky-horizon`, `--ab-color-horizon-ground`, `--ab-color-horizon-grid`, `--ab-color-horizon-runway`, `--ab-color-horizon-runway-stripe`, plus a sun-glow gradient set, in `libs/themes/`. Read them at runtime via `getComputedStyle(canvas).getPropertyValue(...)` when constructing the Three.js Colors so theme switches reflow the scene. If realtime theme reactivity is out of scope, at minimum load the values from the theme registry once at scene init.

### MAJOR: rgba shadow values inline in popover and reference primitives

- **File**: `libs/ui/src/components/JumpToCardPopover.svelte:157`, `libs/ui/src/components/SnoozeReasonPopover.svelte:282`, `libs/ui/src/components/SharePopover.svelte:167`, `libs/aviation/src/ui/ReferenceTerm.svelte:144`, `libs/aviation/src/ui/ReferenceFilter.svelte:62`, `libs/help/src/ui/HelpSearchPalette.svelte:221`
- **Problem**: `box-shadow: var(--shadow-lg, 0 10px 30px rgba(0, 0, 0, 0.2))` -- the fallback IS a hardcoded shadow, not a token. If `--shadow-lg` is missing, the fallback paints a non-token rgba; even if not missing, the fallback drifts from the token. Similar pattern: `box-shadow: 0 8px 24px rgba(15, 23, 42, 0.12)` (ReferenceTerm), `box-shadow: 0 0 0 3px rgba(37, 99, 235, 0.15)` (ReferenceFilter focus ring), `background: rgba(15, 23, 42, 0.4)` (HelpSearchPalette overlay).
- **Rule**: CLAUDE.md "All shadows via `--ab-shadow-*`." `common-pitfalls.md`: "Never hardcode a color, radius, shadow, or transition."
- **Fix**: Drop the rgba fallback in the popover primitives (the token always exists; defensive fallback hides bugs). Replace the ReferenceTerm / ReferenceFilter / HelpSearchPalette inline rgba with `var(--ab-shadow-md)`, `var(--ab-color-focus-ring)`, and `var(--ab-color-overlay-scrim)` respectively (add tokens for any that don't exist).

### MAJOR: Hardcoded transition timing in CrosswindComponent

- **File**: `libs/activities/src/crosswind-component/CrosswindComponent.svelte:532`
- **Problem**: `transition: r 0.15s ease;` -- literal `150ms` instead of `var(--ab-transition-fast|normal|slow)`. The token zeros out under `prefers-reduced-motion`; the literal does not.
- **Rule**: CLAUDE.md "All transitions via `--ab-transition-*`." `common-pitfalls.md` UI-primitives section: "Transitions: `var(--ab-transition-fast|normal|slow)`, never literal `120ms`/`200ms`."
- **Fix**: `transition: r var(--ab-transition-fast) ease;`. Verify `--ab-transition-fast` exists; add if not.

### MAJOR: CrosswindComponent uses px font sizes

- **File**: `libs/activities/src/crosswind-component/CrosswindComponent.svelte:494,512`
- **Problem**: `font-size: 14px;` and `font-size: 11px;` -- px font sizes break user zoom and don't respect the root scale.
- **Rule**: CLAUDE.md / `common-pitfalls.md`: "Font sizes and spacing MUST be `rem`-based ... no `px` for font sizes."
- **Fix**: Convert to `rem` tokens (`var(--ab-font-size-sm)` and `var(--ab-font-size-xs)` or whichever maps closest) and add tokens at the right step if missing.

### MINOR: Auth email templates use hardcoded hex + px font sizes

- **File**: `libs/auth/src/email/templates.ts:20,22,23,29,41,55,67`
- **Problem**: `color: #1a1a2e`, `border-top: 1px solid #e2e8f0`, `font-size: 12px`, `background: #2563eb`, etc. Visual values inlined in email HTML.
- **Rule**: CLAUDE.md design-token rule. HTML email is the documented exception -- mail clients have spotty CSS-variable support -- but the values still drift from the brand tokens.
- **Fix**: Hold an `EMAIL_BRAND` constant map in `libs/constants/src/auth.ts` (or a new `email.ts`) keyed off the same source-of-truth values that produce the `--ab-color-*` tokens, and import from there. The email keeps inline styles (required by mail clients) but the values trace back to one place. Document the "email is the exception" rationale next to the constant.

### MINOR: References dev page hardcodes link color and uses em-relative font sizes

- **File**: `apps/study/src/routes/(dev)/references/+page.svelte:97,100,107`
- **Problem**: `color: var(--ink-link, #0366d6);` -- `#0366d6` fallback is a non-token hex. `font-size: 0.875em;` (lines 100 and 107) is em-relative.
- **Rule**: Token compliance + rem-not-em rule.
- **Fix**: Drop the hex fallback; if `--ink-link` is theme-required, fail loudly when it's missing rather than ship a wrong color. Convert `0.875em` to `var(--ab-font-size-sm)`.

### MINOR: `libs/ui/__tests__/component-tokens.test.ts` uses relative cross-lib import

- **File**: `libs/ui/__tests__/component-tokens.test.ts:9`
- **Problem**: `import { getTheme } from '../../themes/registry';` -- crosses from `libs/ui/` into `libs/themes/` via relative path instead of the `@ab/themes` alias.
- **Rule**: CLAUDE.md "Cross-lib imports use `@ab/*` aliases, never relative paths."
- **Fix**: `import { getTheme } from '@ab/themes/registry';` (or `@ab/themes` if the registry is re-exported from the package root).

### MINOR: `as any` casts in test files

- **File**: `libs/aviation/src/validation.test.ts:42,74`, `apps/hangar/src/lib/server/source-fetch.test.ts:55,57,59`, `apps/hangar/src/lib/server/source-jobs.test.ts:58,60,62`, `libs/sources/src/registry/lifecycle.test.ts:179`, `libs/bc/citations/src/citations.test.ts:78,97,112,124,147`, `libs/bc/study/src/scenarios.test.ts:174`
- **Problem**: 16 `as any` casts in test files. The standing rule (`common-pitfalls.md` patterns section) says: "Test-only `as any` is still a violation -- cast `as unknown as Foo` so the escape hatch is explicit."
- **Rule**: CLAUDE.md "No `any`." `common-pitfalls.md`: "cast `as unknown as Foo`."
- **Fix**: Replace each `as any` with `as unknown as <ConcreteType>`. For the validation tests, the intent is "wrong shape" -- the explicit cast documents that. For the source-fetch / source-jobs / citations / lifecycle test mocks, declare a `Mock<Job>` (or matching) type and cast to it.

### NIT: Long sql template fragments in `libs/bc/study/src/lenses.ts`

- **File**: `libs/bc/study/src/lenses.ts:217-219, 236-238, 490-492`
- **Problem**: Drizzle's `sql\`...\`` template is the right primitive for typed SQL fragments, and these `sql\`${id} IN (...)\`` joins are syntactically Drizzle. But three near-identical `sql.join(ids.map((id) => sql\`${id}\`), sql\`, \`)` blocks could be a small helper -- `inIds(t.column, ids)` -- so the BC reads at the intent level rather than the SQL level. Not a CLAUDE.md violation; just drift-prone duplication.
- **Rule**: Convention: BC reads as domain logic; SQL fragments are an implementation detail.
- **Fix**: Extract `inIdList(column: AnyPgColumn, ids: string[]): SQL` into `libs/bc/study/src/sql-helpers.ts` and call it from the three sites.
