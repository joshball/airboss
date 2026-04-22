---
title: 'Tasks: Reference System Core'
product: study
feature: reference-system-core
type: tasks
status: unread
---

# Tasks: Reference System Core

## Pre-flight

- [ ] Read the signed-off architecture doc end-to-end: `docs/work/todos/20260422-reference-system-architecture.md`.
- [ ] Read the tagging taxonomy doc: `docs/work/todos/20260422-tagging-architecture-research.md`.
- [ ] Read the glossary port plan: `docs/work/todos/20260422-glossary-port-plan.md`.
- [ ] Read `airboss-firc/libs/constants/src/glossary/{types,domains,registry,validation,index}.ts` so the port is mechanical.
- [ ] Read `airboss-firc/libs/ui/src/components/glossary/*.svelte` to confirm component boundaries.
- [ ] Read `airboss-firc/libs/constants/src/glossary/entries/*.ts` (9 files, 175 entries) to ground the retag pass.
- [ ] Read `scripts/check.ts` + `scripts/dev.ts` to plan the scanner wiring.

## Phase 1 - Schema + lib skeleton

- [ ] Create `libs/aviation/` workspace: `package.json` as `@ab/aviation`, `tsconfig.json`, `src/index.ts` barrel.
- [ ] Wire `@ab/aviation` into the root `tsconfig.json` paths + workspace manifest.
- [ ] Create `libs/aviation/src/schema/tags.ts` with the 5-axis `ReferenceTags` taxonomy + value enums per the tagging research.
- [ ] Create `libs/aviation/src/schema/source.ts` with `Source`, `SourceType`, `SourceCitation` types per the architecture doc.
- [ ] Create `libs/aviation/src/schema/reference.ts` with `Reference` + `VerbatimBlock` per the architecture doc.
- [ ] Create `libs/aviation/src/sources/registry.ts` with an empty `SOURCES: Source[]` array typed as `readonly Source[]`. Extraction pipeline package populates it; we only need the type in place so validation compiles.
- [ ] Create `libs/aviation/src/references/aviation.ts` as an empty typed `AVIATION_REFERENCES: readonly Reference[]` (populated in Phase 2).
- [ ] Create `libs/aviation/src/registry.ts` with merged lookup maps: `byId`, `byTerm` (displayName + aliases), `byTag` per axis.
- [ ] Export the surface from `libs/aviation/src/index.ts`.
- [ ] `bun run check` passes with 0 errors.

## Phase 2 - Port 175 entries + retag

- [ ] Copy the 9 `airboss-firc/libs/constants/src/glossary/entries/*.ts` files into a scratch location under `libs/aviation/src/references/_port-staging/` (gitignored during this phase).
- [ ] Write `scripts/references/retag-pass1.ts`: deterministic first-pass retagging per the tagging research's regex patterns (`-wx` -> `weather`, `-reg` + `14 CFR` -> `regulations` + `source-type: cfr`, etc.). Output: a TS file with proposed tags per entry, plus a report of entries that did not match any pattern.
- [ ] Run pass 1. Save output diff as `docs/work/todos/20260423-reference-port-pass1-diff.md` (or similar) for review.
- [ ] Agent-assisted pass 2: for entries not confidently tagged by pass 1 (~40%), batch through Claude 20 at a time using `term` + `brief` + `detail` + `source` as context. Agent proposes multi-valued `aviationTopic`, `knowledgeKind`, `phaseOfFlight`, `certApplicability`. Output: same TS shape as pass 1.
- [ ] Batch human review: user reads the combined diff, corrects in-place. Do not commit per-entry edits.
- [ ] Merge approved retags into the final `libs/aviation/src/references/aviation.ts`. Delete the `_port-staging/` folder.
- [ ] Drop the legacy `domain` field entirely. Drop the legacy freeform `tags: string[]` bag. Both replaced by `ReferenceTags`.
- [ ] Map old `source: string` -> new `sources: SourceCitation[]` with `sourceId` referencing the stub registry + `locator` extracted from the old string (`14 CFR 91.155` -> `{ title: 14, part: 91, section: '155' }`). Paraphrase content stays in `paraphrase`; no `verbatim` yet (extraction pipeline lands it later).
- [ ] `bun run check` passes. Tag validation gates active.
- [ ] Commit.

## Phase 3 - Wiki-link parser + UI primitives

- [ ] Create `libs/aviation/src/wikilink/parser.ts`: regex lexer producing the AST shape from the spec. Skips fenced code and inline code. Handles all three valid modes + errors on invalid forms.
- [ ] Create `libs/aviation/src/wikilink/parser.test.ts`: vitest covering each mode, malformed input, code-block skip, whitespace trimming, nested-bracket rejection.
- [ ] Create `libs/aviation/src/ui/ReferenceTerm.svelte`: inline link + popover. Desktop hover, touch tap, keyboard focus per spec. Popover contains `displayName`, truncated paraphrase, tags, link to `/glossary/[id]`.
- [ ] Create `libs/aviation/src/ui/ReferenceText.svelte`: wrapper that runs the parser over a prose string and emits `<ReferenceTerm>` + plain text.
- [ ] Create `libs/aviation/src/ui/ReferenceCard.svelte`: per-entry card for the glossary index (displayName, tags, truncated paraphrase, link).
- [ ] Create `libs/aviation/src/ui/ReferenceSidebar.svelte`: axis facet list + counts.
- [ ] Create `libs/aviation/src/ui/ReferenceFilter.svelte`: search input + power-user query parser.
- [ ] Create `libs/aviation/src/ui/ReferencePage.svelte`: layout for the index, composing sidebar + filter + card grid.
- [ ] Export components from `libs/aviation/src/index.ts`.
- [ ] `bun run check` passes. Vitest tests pass.
- [ ] Commit.

## Phase 4 - Scanner + gates + check.ts + dev.ts wiring

- [ ] Create `scripts/references/scan.ts`: walks content paths, parses wiki-links, emits manifest JSON to stdout (and optionally to `data/references/manifest.json`).
- [ ] Create `scripts/references/validate.ts`: runs all schema + tag + wiki-link gates from the spec. Exit code non-zero on failure; non-blocking warnings printed separately.
- [ ] Extend `scripts/check.ts` to invoke `scripts/references/validate.ts` after the knowledge dry-run. Fast-fail if any gate fails.
- [ ] Extend `scripts/dev.ts` to invoke the scanner synchronously before vite starts. On broken wiki-links, print the offenders and exit non-zero. Sub-second.
- [ ] Add a `references:scan` script to the root `package.json` for manual invocation.
- [ ] `bun run check` and `bun run dev` both execute cleanly with the ported content.
- [ ] Commit.

## Phase 5 - `/glossary` route + nav + ROUTES

- [ ] Add to `libs/constants/src/routes.ts`: `GLOSSARY: '/glossary'` and `GLOSSARY_ID: (id: string) => '/glossary/${encodeURIComponent(id)}'`.
- [ ] Create `apps/study/src/routes/(app)/glossary/+page.server.ts`: load function returning the references list + facet counts.
- [ ] Create `apps/study/src/routes/(app)/glossary/+page.svelte`: renders `<ReferencePage>` with sidebar, filter, and card grid.
- [ ] Create `apps/study/src/routes/(app)/glossary/[id]/+page.server.ts`: load function returning the single reference + its resolved `related[]` entries. 404 when id unknown.
- [ ] Create `apps/study/src/routes/(app)/glossary/[id]/+page.svelte`: renders displayName, tag chips, paraphrase (through `ReferenceText` for nested links), verbatim block when present or the "verbatim pending extraction" badge when not, sources with deep links, related list.
- [ ] Wire filter state to query-string params: `source`, `tag`, plus per-axis keys. Use existing `QUERY_PARAMS` constants where applicable; add new ones when needed.
- [ ] Add Glossary nav entry to `apps/study/src/routes/(app)/+layout.svelte` using `ROUTES.GLOSSARY`.
- [ ] `bun run check` passes. Manual test per test-plan.md.
- [ ] Commit.

## Post-implementation

- [ ] Full manual test per `test-plan.md`.
- [ ] Request implementation review (`/ball-review-full`).
- [ ] Update `docs/products/study/TASKS.md` with the completed feature.
- [ ] Update `docs/work/NOW.md` to move the feature to "shipped."
