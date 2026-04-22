---
title: 'Design: Reference System Core'
product: study
feature: reference-system-core
type: design
status: unread
---

# Design: Reference System Core

## Library boundary: `libs/aviation/` is the substrate

**Question:** Where do reference types, registry, parser, and UI primitives live?

**Chosen:** A new `libs/aviation/` workspace at `@ab/aviation`. Not `libs/constants/`, not `libs/ui/`, not folded into an existing BC.

**Why:**

- Schema + data + UI for authoritative aviation content are one cohesive unit; splitting them across three libs forces a circular-dependency dance every time a component needs the registry.
- Symmetric with the planned `libs/help/` (per decision #5). Each tier is a workspace; apps depend on both.
- The knowledge graph and future surface apps (`spatial/`, `audio/`, `firc/`) all consume `@ab/aviation`. Isolating it from study-specific code keeps the reuse honest.
- Follows the architecture doc's [Library structure](../../work/todos/20260422-reference-system-architecture.md#libs-aviation--aviation-content-cross-app).

**Cost accepted:** One more workspace + one more `@ab/*` path alias. Cheap; the monorepo already does this pattern.

## Types live here, parsers land in the extraction-pipeline package

**Question:** The extraction pipeline needs `Source`, `SourceCitation`, `VerbatimBlock`. Where do those types live?

**Chosen:** All types land in `libs/aviation/src/schema/`. The pipeline package imports them; it does not redefine them.

**Why:**

- Types are cheap to depend on. Parsers are heavy and source-specific.
- The 175-entry port needs `SourceCitation` to cite CFR sections in `sources[]` even without a parser yet. We cannot defer the type to the pipeline package.
- Validation in this package (the stub `sources/registry.ts` check, symmetry gates) depends on `Source`. Splitting the type across packages would duplicate the definition.

`libs/aviation/src/sources/registry.ts` in this package holds only a typed, mostly-empty `SOURCES` array with the source entries the 175 ported references cite (CFR, AIM, PHAK, etc.). The pipeline package later populates the full registry with checksums, download metadata, and per-source parser registration.

## Drop the legacy `domain` field (locked decision #1)

**Question:** Do the ported entries keep their old `domain: GlossaryDomain` field alongside the new `aviationTopic`?

**Chosen:** Drop it. The port writes `ReferenceTags` only.

**Why:**

- Dual fields invite authors to disagree with themselves. `domain: weather` with `aviationTopic: [regulations]` is indistinguishable from a bug.
- The old 9-domain enum is a strict subset of the new 18-value `aviationTopic`; every old value maps cleanly (navigation -> `navigation`, atc -> `communications`, etc.).
- The `/glossary` sidebar rebuilds around `aviationTopic` primary-value groupings. The visual grouping the old `domain` provided still works, just through a facet rather than a field.

**Cost:** One-time migration work (absorbed in Phase 2 retag pass).

## Retag migration: deterministic first pass, agent-assisted second, batch human review

**Question:** How do the 175 entries get from the old single `domain` + freeform `tags[]` to the new 5-axis shape?

**Chosen:** Three-stage hybrid per the tagging research's [Migration plan](../../work/todos/20260422-tagging-architecture-research.md#migration-plan-for-the-existing-175-entries).

### Stage 1: deterministic regex patterns

Target: resolve ~60% of entries with high confidence, no human needed.

| Pattern                                                                   | Tags assigned                                                                       |
| ------------------------------------------------------------------------- | ----------------------------------------------------------------------------------- |
| `id` ends in `-wx`                                                        | `aviationTopic: ['weather']` (seed; may expand in stage 2)                          |
| `id` ends in `-nav`                                                       | `aviationTopic: ['navigation']`                                                     |
| `id` ends in `-ops`                                                       | `aviationTopic: ['procedures']` (seed)                                              |
| `id` ends in `-atc`                                                       | `aviationTopic: ['communications']`                                                 |
| `id` ends in `-aircraft`                                                  | `aviationTopic: ['aircraft-systems']` (refine in stage 2 for instruments)           |
| `id` ends in `-safety`                                                    | `knowledgeKind: 'safety-concept'`, `aviationTopic: ['human-factors']` (seed)        |
| `id` ends in `-training`                                                  | `aviationTopic: ['training-ops']`                                                   |
| `id` ends in `-org`                                                       | `knowledgeKind: 'reference'`, `flightRules: 'na'`                                   |
| `id` ends in `-reg`                                                       | `knowledgeKind: 'regulation'`                                                       |
| `id` ends in `-def`                                                       | `knowledgeKind: 'definition'`                                                       |
| `source` matches `/^14 CFR/`                                              | `sourceType: 'cfr'`; if `source == '14 CFR 1.1'` also `knowledgeKind: 'definition'` |
| `source` matches `/^AIM/`                                                 | `sourceType: 'aim'`                                                                 |
| `source` matches `/^PHAK/`                                                | `sourceType: 'phak'`                                                                |
| `source` matches `/^AFH/`                                                 | `sourceType: 'afh'`                                                                 |
| `source` matches `/^IFH/`                                                 | `sourceType: 'ifh'`                                                                 |
| `source` matches `/^AC /` or `/AC \d/`                                    | `sourceType: 'ac'`                                                                  |
| `domain == 'aircraft'` AND `group == 'performance'` AND `term` starts `V` | `knowledgeKind: 'limit'`, `aviationTopic: ['aerodynamics', 'performance']`          |
| `tags` contains `'instrument-flying'`                                     | `flightRules: 'ifr'`                                                                |
| `tags` contains `'vfr-operations'`                                        | `flightRules: 'vfr'`                                                                |
| No flight-rules signal                                                    | `flightRules: 'both'` (flagged for stage 2)                                         |
| `tags` contains `'cfi-knowledge'`                                         | Dropped (zombie tag; per research's ban list)                                       |
| `tags` contains `'checkride'` or `'faa-testing'`                          | `certApplicability` amended based on context                                        |

Output: `docs/work/todos/20260423-reference-port-pass1-diff.md` - a readable diff of every entry with its proposed tag set and flags for "needs review."

### Stage 2: agent-assisted

For entries with fewer than three confidently-tagged axes, batch 20 at a time through Claude with `term` + `brief` + `detail` + `source` + stage-1 proposal as context. Agent proposes:

- Full multi-valued `aviationTopic` (1-4 values).
- `knowledgeKind` if stage 1 did not land one.
- `phaseOfFlight[]` when conditionally required by `knowledgeKind` or `sourceType`.
- `certApplicability` only when clearly rating-specific.
- `keywords` from term + brief wording.

Output: same diff file, merged with stage-1 proposals.

### Stage 3: batch human review

User reads the full diff (not per-entry). Corrections applied in-place to the diff file. When the user signs off, the diff is compiled into `libs/aviation/src/references/aviation.ts`. No per-entry commit noise.

## Wiki-link parser: regex lexer + context-aware AST

**Question:** How to parse `[[DISPLAY::id]]` reliably without pulling in a full markdown parser?

**Chosen:** Regex lexer with code-block context tracking. ~150 lines of pure TypeScript.

**Why:**

- A full markdown parser is too heavy - we only care about the one bracket form.
- Content may live in `.md` files (knowledge nodes), `.ts` data files (reference paraphrase), and Svelte templates. A parser coupled to any one of those loses portability.
- The architecture doc's wiki-link spec is small enough to implement in a single pass: match `[[`, scan until `]]` or newline, split on `::`, validate, emit node. Track whether we are inside a fenced code block or inline code span and skip accordingly.

### State machine

```text
TEXT                   Default state. Scanning plain prose.
  "```"  ->            FENCED_CODE (until closing ```)
  "`"    ->            INLINE_CODE (until closing ` on same line)
  "[["   ->            WIKILINK_OPEN

FENCED_CODE            Emit text verbatim. Ignore wiki-link syntax.
  "```"  ->            TEXT

INLINE_CODE            Emit text verbatim.
  "`" or "\n" ->       TEXT

WIKILINK_OPEN          Collecting display part.
  "::"   ->            WIKILINK_ID
  "]]"   ->            error: missing ::
  "[["   ->            error: nested
  "\n"   ->            error: unterminated
  char   ->            append to display

WIKILINK_ID            Collecting id part.
  "]]"   ->            emit AST node, return to TEXT
  "::"   ->            error: double separator
  "[["   ->            error: nested
  "\n"   ->            error: unterminated
  char   ->            append to id
```

### AST node shape

```typescript
type WikilinkNode = {
  kind: 'wikilink';
  display: string | null;
  id: string | null;
  sourceSpan: [start: number, end: number];
};

type TextNode = {
  kind: 'text';
  value: string;
  sourceSpan: [start: number, end: number];
};

type ParseResult = {
  nodes: readonly (WikilinkNode | TextNode)[];
  errors: readonly { message: string; sourceSpan: [number, number] }[];
};
```

Empty display on a valid id -> `display: null, id: 'cfr-14-91-155'`. Renderer substitutes the reference's `displayName`.

Empty id on a valid display -> `display: 'term text', id: null`. Renderer emits the dev-mode highlighted span and the scanner collects it as a TBD.

Both empty -> the parser emits an error node, not an AST node.

## UI composition

```text
ReferencePage.svelte              The /glossary shell
  +-- ReferenceFilter.svelte      Search + power-user query + filter chips
  +-- ReferenceSidebar.svelte     Per-axis facet lists with counts
  +-- ReferenceCard.svelte * N    Grid of result cards

[id] detail page                  apps/study/src/routes/(app)/glossary/[id]/+page.svelte
  +-- tag chips + sources + related are app-level layout, not a library component
  +-- ReferenceText.svelte        Renders paraphrase with nested wiki-links
        +-- ReferenceTerm.svelte  Per-link popover + navigation
```

`ReferenceTerm` is the leaf the whole system funnels through. Any inline rendering of a reference anywhere in the platform goes through it. That is the enforcement point for a11y, tooltip behavior, and deep-link semantics.

## `/glossary` page structure

### Index (`/glossary`)

```text
 --------------------------------------------------------------------
 |  [Search / power-user query]                                     |
 |  [filter chips: source=cfr, tag=weather]                         |
 --------------------------------------------------------------------
 |            |                                                     |
 | Facets     |  [Card] [Card] [Card] [Card]                        |
 |            |  [Card] [Card] [Card] [Card]                        |
 | - source   |  [Card] [Card] [Card] [Card]                        |
 |   cfr (92) |                                                     |
 |   aim (24) |                                                     |
 |   phak(18) |                                                     |
 | - topic    |                                                     |
 |   wx (14)  |                                                     |
 | - rules    |                                                     |
 | - kind     |                                                     |
 | - phase    |                                                     |
 | - cert     |                                                     |
 |            |                                                     |
 --------------------------------------------------------------------
```

Facet counts reflect the current filter set (intersection across axes). Clicking a facet toggles it; filter chips at top show active filters. The URL mirrors filter state via query params.

### Detail (`/glossary/[id]`)

```text
 --------------------------------------------------------------------
 |  [displayName]   [source-type chip]  [all tags as chips]         |
 --------------------------------------------------------------------
 |                                                                  |
 |  [Paraphrase rendered through ReferenceText]                     |
 |                                                                  |
 |  [Verbatim block  |  OR  |  "verbatim pending extraction" badge] |
 |   source version  |      |  + deep link to source URL            |
 |   extracted at    |      |                                       |
 |                                                                  |
 |  Sources                                                         |
 |  - 14 CFR 91.155 (deep link)                                     |
 |  - AIM 7-1-1 (deep link)                                         |
 |                                                                  |
 |  Related                                                         |
 |  - [link] [link] [link]                                          |
 --------------------------------------------------------------------
```

## Search ranking within aviation

Single-library for this package. No cross-library ranking (that is the `libs/help/` search widget's problem).

Within aviation:

1. **Exact displayName match** - highest weight.
2. **Exact alias match** - next.
3. **Keyword match** - next.
4. **Paraphrase substring match** - last, and only when the above three produce fewer than N results.

Power-user query (`tag:weather rules:ifr`) is AND-filter, not ranked. Parse the query into `{ axis: value[] }` pairs plus a residual free-text string. Facets AND-intersect; the free-text string ranks using the ladder above within the filtered set.

Parser: a one-pass tokenizer splitting on whitespace, recognizing `<axis>:<value>` pairs where `<axis>` is one of `source`, `tag`, `rules`, `kind`, `phase`, `cert`, `keyword`. Everything else is plain text.

## Scanner performance budget

Per decision #3, sub-second. Today's content: ~30-50 markdown nodes under `course/knowledge/`, the 175 reference paraphrases, and future per-app help content (empty in this package). Regex scan over this corpus fits in a few tens of milliseconds.

Budget to defend: if the scanner ever approaches 500 ms on `bun run dev`, fall back to the async-with-banner mode from the architecture doc. Not expected in this package's scope.

## ROUTES + QUERY_PARAMS additions

```typescript
// libs/constants/src/routes.ts (additions)

GLOSSARY: '/glossary',
GLOSSARY_ID: (id: string) => `/glossary/${encodeURIComponent(id)}` as const,
```

Query-string keys reuse existing `QUERY_PARAMS` where possible (`SEARCH`, `SOURCE`). New axis-filter keys are added in the same file, collocated with the other filter keys. No new top-level concepts.

## Tag validation: fail-fast, error lists paths

`scripts/references/validate.ts` runs every gate from the spec's Validation section. Output shape on failure:

```text
Reference validation failed (4 errors, 2 warnings):

ERROR  Duplicate id 'cfr-14-91-155'
       libs/aviation/src/references/aviation.ts:482
       libs/aviation/src/references/aviation.ts:1204

ERROR  Missing required tag 'flightRules' on 'metar-wx'
       libs/aviation/src/references/aviation.ts:51

ERROR  Asymmetric 'related' edge: 'ifr-ops' -> 'alternate-airport-def' not reciprocated
       libs/aviation/src/references/aviation.ts:623, :891

ERROR  Unresolved wiki-link [[X::cfr-99-99-99]]
       course/knowledge/airspace/vfr-weather-minimums/node.md:14

WARN   5 TBD-id wiki-links found:
       course/knowledge/weather/reading-metars-tafs/node.md:22 (some metar term)
       ... 4 more

WARN   3 references unreviewed in > 12 months:
       - metar-wx (reviewedAt 2025-02-11)
       - ...
```

Paths are clickable in modern terminals (VS Code, iTerm) via the `path:line` convention.

## Non-decisions (deferred to later packages)

- `data/sources/` layout + gitignore strategy. Extraction pipeline owns it.
- Yearly refresh tooling. Extraction pipeline.
- Cross-library search widget (aviation + help). Help library.
- AIM / POH / PCG / AC / NTSB / AOPA parsers. Phase 6 + 8 packages.
- ACS task code axis. Flagged in tagging research; revisit when ACS mapping work begins.
- `governance` as an `aviationTopic` value. Hold until organization entries prove awkward under the current mapping.
