---
title: 'Spec: Reference System Core'
product: study
feature: reference-system-core
type: spec
status: unread
---

# Spec: Reference System Core

The platform substrate for every piece of authoritative aviation content the apps cite. A new `libs/aviation/` workspace that owns the `Reference` type, the 5-axis `ReferenceTags` taxonomy, the merged lookup registry, the `[[DISPLAY::id]]` wiki-link parser, and the Svelte UI primitives that render references inline and on the `/glossary` route. The 175 aviation entries previously authored in `airboss-firc` are ported and retagged under the new 5-axis system. A build-time scanner walks all content, fails fast on broken wiki-links, and is wired into `bun run dev` and `bun run check`. The source extraction pipeline (CFR / AIM / POH parsers, `data/sources/` layout, yearly refresh) belongs to a separate work package; this package owns only the types that pipeline will consume.

This is the first package in the reference-system chain. It has no upstream dependency; downstream packages (`wp-reference-extraction-pipeline`, `wp-help-library`, knowledge-graph phase content) all compose on top of what lands here.

Signed-off architecture: [docs/work/todos/20260422-reference-system-architecture.md](../../work/todos/20260422-reference-system-architecture.md). Companion research: [glossary port plan](../../work/todos/20260422-glossary-port-plan.md), [tagging taxonomy](../../work/todos/20260422-tagging-architecture-research.md).

## In Scope

- `libs/aviation/` workspace at `@ab/aviation` with barrel exports.
- Schema modules: `schema/reference.ts` (Reference, VerbatimBlock, SourceCitation), `schema/source.ts` (Source, SourceType), `schema/tags.ts` (the 5-axis ReferenceTags taxonomy).
- `registry.ts` merged lookup: by-id, by-term (displayName + aliases), by-tag axis.
- `validation.ts` build-time gates for schema integrity, tag completeness, and `related[]` symmetry.
- `wikilink/parser.ts` lexer + AST covering the three valid `[[DISPLAY::id]]` modes.
- UI primitives: `ReferenceText.svelte`, `ReferenceTerm.svelte`, `ReferencePage.svelte`, `ReferenceCard.svelte`, `ReferenceSidebar.svelte`, `ReferenceFilter.svelte`.
- `references/aviation.ts`: the 175 ported entries, retagged under the 5-axis system.
- `scripts/references/scan.ts`: walks content, builds manifest, fast-fails on broken wiki-links.
- Integration into `scripts/check.ts` (tag + wikilink validation) and `scripts/dev.ts` (sync scan pre-vite).
- `/glossary` route in `apps/study/`: index page, `[id]` detail page, facet filters per axis, power-user query syntax, aviation-only search.
- `ROUTES.GLOSSARY` and `ROUTES.GLOSSARY_ID(id)` constants.
- Nav entry for Glossary in `apps/study/src/routes/(app)/+layout.svelte`.

## Out of Scope

- Source extraction pipeline: CFR XML parser, AIM PDF parser, POH parser, `data/sources/` corpus layout, `scripts/references/build.ts`, `scripts/references/extract.ts`, yearly refresh tooling. Owned by `wp-reference-extraction-pipeline`. The `Source` / `SourceCitation` / `VerbatimBlock` types live here; the parsers that produce `VerbatimBlock` instances land there.
- `libs/help/` workspace, `/help` route, per-app help content registration, cross-library faceted search widget. Owned by `wp-help-library`. `/glossary` search in this package is aviation-only; the cross-library widget is a separate primitive.
- Materialized `cfr-generated.ts` / `aim-generated.ts` / `poh-generated.ts` reference files. Those are outputs of the extraction pipeline.
- NTSB, AOPA, PCG, AC, FAA-Safety parsers. Phase 6 + 8 of the architecture roadmap, later packages.
- Knowledge-graph phase content authoring. Phase content consumes `@ab/aviation`; authoring workflow is its own package.
- Carrier-metaphor feature names and FIRC-specific vocabulary (Trap, Bolter, Greenie Board, etc.) from the old `VOCABULARY.md`. Per the glossary port plan, these do not port. They belong to the future `apps/firc/` surface if they return at all.

## Data Model

All types in the `@ab/aviation` package. No database tables. References are TypeScript data objects authored in `libs/aviation/src/references/*.ts`.

### Reference

Source of truth: the architecture doc's `Reference` / `VerbatimBlock` / `SourceCitation` shapes in [20260422-reference-system-architecture.md](../../work/todos/20260422-reference-system-architecture.md#the-reference-schema). Ported verbatim into `libs/aviation/src/schema/reference.ts`. Not re-specified here.

Reasons-for-each-field are covered inline in that doc. This package adds no new fields.

### ReferenceTags (5-axis + optional)

Source of truth: the tagging research's axis table in [20260422-tagging-architecture-research.md](../../work/todos/20260422-tagging-architecture-research.md#axes). Ported verbatim into `libs/aviation/src/schema/tags.ts`.

Required axes: `sourceType`, `aviationTopic` (1-4 values), `flightRules`, `knowledgeKind`. Conditionally required: `phaseOfFlight` (1-3 values when `sourceType in { poh, aim, ac, sop }` or `knowledgeKind = procedure`). Optional: `certApplicability`, `keywords` (capped at 10 entries, each ≤ 40 chars).

Per decision #1, the legacy `domain` field does not exist. The 175-entry port maps the old `domain` values onto `aviationTopic[0]` and drops the field.

### Source + SourceCitation

Source of truth: architecture doc's [Source registry section](../../work/todos/20260422-reference-system-architecture.md#source-registry). The types land here; the `sources/registry.ts` file with its populated `Source[]` table is owned by the extraction-pipeline package. A stub registry with the hand-authored entries' source references (CFR, AIM, PHAK, etc.) lives here only to satisfy type-checking and validation.

## Behavior

### Wiki-link parser

Canonical syntax `[[DISPLAY::id]]`. Three valid modes per the architecture doc's [wiki-link syntax table](../../work/todos/20260422-reference-system-architecture.md#wiki-link-syntax):

| Form                              | Resolution                                                        | Render                                                  |
| --------------------------------- | ----------------------------------------------------------------- | ------------------------------------------------------- |
| `[[VFR minimums::cfr-14-91-155]]` | Both known. Validator confirms `cfr-14-91-155` exists in registry | "VFR minimums" as link/tooltip to the reference         |
| `[[VFR minimums::]]`              | Display known, id TBD. Scanner collects for TODO report           | "VFR minimums" with dev-only yellow underline           |
| `[[::cfr-14-91-155]]`             | Id known, use reference's `displayName`                           | "14 CFR 91.155" (the reference's displayName)           |

Invalid forms (parser errors): `[[::]]`, nested `[[…[[…]]…]]`. Non-wiki-link bracket syntax (`[[text]]` without `::`) is ignored and passes through as plain text. Whitespace around `::` is trimmed.

Parser skips fenced code blocks and inline code spans. Parser output is an AST of `{ kind: 'wikilink', display: string | null, id: string | null, sourceSpan: [start, end] }` nodes interleaved with plain-text segments.

### Scanner

`scripts/references/scan.ts` walks:

- `course/knowledge/**/*.md`
- `apps/*/src/lib/help/content/**/*.ts` (empty in this package; future-proofed)
- Every `Reference.paraphrase` field in `libs/aviation/src/references/*.ts`

For each occurrence, extracts the id + displayName and emits the manifest shape defined in the architecture doc ([Step 1 scan](../../work/todos/20260422-reference-system-architecture.md#step-1-scan)).

Per decision #3, the scanner runs synchronously before `bun run dev` and during `bun run check`. Regex-based, sub-second on today's content. Fails fast on broken wiki-links.

### Reference rendering

`ReferenceText.svelte` accepts a prose string with wiki-links, runs the parser, and emits `<ReferenceTerm>` for each resolved link and a debug-mode highlighted `<span>` for unresolved ones.

`ReferenceTerm.svelte` renders the inline link. Per open-question #1, resolved during this spec:

- Desktop: hover opens a popover with `displayName`, first 280 chars of `paraphrase`, tags, and "open full reference" link to `/glossary/[id]`.
- Touch: tap opens the same popover; second tap navigates.
- Keyboard: focus (tab) shows the popover; Enter navigates.
- A11y: popover has role `tooltip`, linked via `aria-describedby`.

Per open-question #2, resolved: when a reference exists with `paraphrase` but no `verbatim` yet, the detail page shows the paraphrase in full, a "verbatim pending extraction" badge, and a deep link to the source URL (from `sources[].url`).

### `/glossary` route

`/glossary` (index):

- Server load returns the full references list plus axis-facet counts.
- Facet sidebar per axis: source-type, aviation-topic, flight-rules, knowledge-kind, phase-of-flight, cert-applicability.
- Multi-select within an axis; intersection across axes.
- Search box supports plain text (matches `displayName` + `aliases` + `keywords`) and power-user syntax: `tag:weather rules:ifr` AND-filters.
- Filter state lives in query-string parameters so URLs are shareable.

`/glossary/[id]` (detail):

- Renders `displayName`, tags (as chips), `paraphrase` (through `ReferenceText` so nested wiki-links resolve), `verbatim` block (when present) with source version + extracted-at, `sources[]` with locators and deep links, `related[]` as links to siblings.
- 404 when id is not in the registry.

### `ROUTES` constants

Added to `libs/constants/src/routes.ts`:

- `GLOSSARY: '/glossary'`
- `GLOSSARY_ID: (id: string) => '/glossary/${encodeURIComponent(id)}'`

Any existing filter query-string usage reuses the `QUERY_PARAMS` keys already in place (`SEARCH`, `SOURCE`) and adds axis-specific ones where needed.

## Validation

`bun run check` runs `scripts/references/validate.ts` after svelte-check, biome, and the existing knowledge dry-run. Source-of-truth list in the architecture doc's [Quality gates](../../work/todos/20260422-reference-system-architecture.md#quality-gates) and [Tagging research validation](../../work/todos/20260422-tagging-architecture-research.md#required-gates).

Fails the build on any of:

- Unresolved `[[*::id]]` - id not in registry.
- Malformed wiki-links: `[[::]]`, nested brackets, `[[::]]` with whitespace-only sides.
- Duplicate reference ids across all `references/*.ts` files.
- Missing required tag axis (`sourceType`, `aviationTopic`, `flightRules`, `knowledgeKind`).
- `aviationTopic` outside the 1-4 range, duplicates, or value not in enum.
- `phaseOfFlight` missing when `sourceType in { poh, aim, ac, sop }` or `knowledgeKind = procedure`.
- `phaseOfFlight` outside the 0-3 range (when present), duplicates, or value not in enum.
- `keywords` entries over 40 chars, empty, or the entry list over 10.
- `verbatim` present with zero `sources[]`.
- `sources[]` citing a `sourceId` not present in the source registry.
- `related[]` not symmetric: every `a.related` entry `b` requires `b.related` to contain `a`.
- Banned zombie tag: entries re-emitting `cfi-knowledge` anywhere (legacy tag, per the tagging research's migration guidance).

Warns but does not fail on:

- `[[text::]]` TBD-id wiki-links. Prints count + first-seen locations.
- Orphan references - exist in library, no content cites them.
- References whose `reviewedAt` is > 12 months old (stale-review report).

## Dependencies

None from outside this workspace. This is the first package in the reference-system chain. Downstream:

- `wp-reference-extraction-pipeline` imports `Source`, `SourceCitation`, `VerbatimBlock`, `Reference` from `@ab/aviation`.
- `wp-help-library` imports the tag taxonomy + faceted-search primitives it will mirror.
- Knowledge-graph phase content consumes `ReferenceText` and the wiki-link syntax.

## Open Items

Ratified during this spec, not deferred:

- Tooltip behavior: hover-popover on desktop, tap-to-open on touch, focus-shows for keyboard/a11y (architecture recommendation).
- Paraphrase-only references (verbatim pending): show paraphrase + pending-badge + deep link to source URL (architecture recommendation).

Still open, not blocking this package (belong to follow-on packages):

- ACS task codes: separate axis vs freeform keywords. Will be revisited when ACS mapping work begins.
- `governance` as an `aviationTopic` value for organization entries (FAA, ICAO, EASA). Current entries use `knowledgeKind: reference` + `sourceType: authored`; revisit if that's awkward in practice.
- `data/sources/` size-by-source decision. Owned by extraction-pipeline package.
