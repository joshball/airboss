# Reference system flow

How authoritative aviation content moves through airboss: from an author citing a term in prose, to a committed verbatim CFR quote in the glossary page the learner reads.

This is platform reference material. For the architecture decisions behind this flow, see [20260422-reference-system-architecture.md](../work/todos/20260422-reference-system-architecture.md). For tag taxonomy, see [20260422-tagging-architecture-research.md](../work/todos/20260422-tagging-architecture-research.md).

## TL;DR

Two definition points meet at the registry: **demand** (authors cite wiki-links in content) and **supply** (reference entries in `libs/aviation/src/references/`). A scanner walks the content side, a validator gates both sides, and per-source parsers materialize verbatim text from downloaded source corpora (14 CFR XML, AIM PDF, etc.) into committed generated files that the glossary and inline tooltips render.

## The two sides

### Demand: "we need this term"

An author writes a **wiki-link** in any prose — knowledge-graph node, help page, reference paraphrase body:

```markdown
The [[VFR weather minimums::cfr-14-91-155]] define cloud clearance for Class E.
```

Three valid shapes:

| Form                                       | When                                 | Renders as                                       |
| ------------------------------------------ | ------------------------------------ | ------------------------------------------------ |
| `[[display::id]]`                          | Both known                           | "display" as a link / tooltip to the id          |
| `[[display::]]`                            | Text known, id TBD                   | "display" with a yellow "needs link" underline   |
| `[[::id]]`                                 | Id known, want the registry's displayName | The registry's `displayName` as the link text    |

Content locations the scanner walks:

- `course/knowledge/**/node.md` (knowledge-graph phases)
- `apps/*/src/lib/help/content/**/*.ts` (app help pages)
- `libs/aviation/src/references/*.ts` (the `paraphrase` field of every reference)

### Supply: "here is what this term is"

A typed `Reference` with `id`, `displayName`, `aliases`, `tags` (5-axis), `paraphrase` (authored teaching voice), `sources` (typed citations), `related` (bidirectional see-also), and optional `verbatim` (machine-extracted source text).

Two locations:

1. **Hand-authored** -- `libs/aviation/src/references/aviation.ts`. 175 entries ported from airboss-firc. `paraphrase` filled, `verbatim` absent.
2. **Machine-extracted** -- `libs/aviation/src/references/<source>-generated.ts` (one file per source type). Rebuilt by the extraction pipeline. `verbatim` filled, `paraphrase` inherited from the hand-authored entry with the same id.

The registry in `libs/aviation/src/registry.ts` merges these two at load time into one lookup (by-id, by-term, by-tag, by-source-type).

## The pipeline

```text
┌──────────────┐   author writes   ┌─────────────────────────┐
│   content    │─[[VFR::cfr-...]]─▶│  manifest.json          │
│  (nodes,     │     scanner       │  (all cited ids +       │
│  help pages, │                   │   where each is cited)  │
│  paraphrases)│                   └──────────┬──────────────┘
└──────────────┘                              │
                                              ▼
                                  ┌────────────────────────┐
                                  │   validator gates      │
                                  │  - id resolves?        │
                                  │  - required tags?      │
                                  │  - related symmetric?  │
                                  │  - source registered?  │
                                  │  - meta.json integrity?│
                                  │  - files fresh?        │
                                  └───────────┬────────────┘
                                              │
         ┌────────────────────────────────────┘
         │ id in registry?
         │
         ├── hand-authored only (aviation.ts)
         │    ▶ render paraphrase + sources (verbatim "pending")
         │
         └── has a source citation (cfr-14, aim-current, ...)
              ▼
    ┌─────────────────────────────┐
    │  per-source parser          │
    │  libs/aviation/sources/     │
    │    cfr/extract.ts           │   reads data/sources/cfr/cfr-14.xml
    │    aim/extract.ts           │   at locator {title, part, section}
    │    poh/extract.ts           │   emits GFM markdown VerbatimBlock
    │    pcg/extract.ts           │
    │    ntsb/extract.ts          │
    │    aopa/extract.ts          │
    │    ...                      │
    └──────────┬──────────────────┘
               │
               ▼
    libs/aviation/src/references/<source>-generated.ts
    (committed to repo, version-stamped, diffable)
               │
               ▼
    registry load: aviation.ts + *-generated.ts = one merged registry
               │
               ▼
    /glossary/cfr-14-91-155 renders:
    - displayName
    - tag filter chips
    - paraphrase (teaching voice, markdown, wiki-links resolved to tooltips)
    - verbatim block (authoritative, styled as quote/code)
    - sources (external link to ecfr.gov)
    - related (internal links to sibling references)
```

## Touchpoints (human-in-the-loop)

Every box below is a decision or artifact a human produces. The scripts move data between them; they don't decide what content exists.

| Stage                        | Human action                                                                 | Output                                          |
| ---------------------------- | ---------------------------------------------------------------------------- | ----------------------------------------------- |
| Want to cite a term in prose | Write `[[display::id]]` in markdown / TS template                            | A content file with a wiki-link                 |
| Id doesn't exist yet         | Add a Reference entry to `aviation.ts` (or let extractor produce it)         | Registry has a new entry                        |
| Source not downloaded yet    | Download XML/PDF/CSV, place under `data/sources/<type>/`, write `.meta.json` | Binary + meta sidecar on disk                   |
| Registry entry out of date   | Update `libs/aviation/src/sources/registry.ts` with new version + checksum   | Registry tracks the new source version          |
| Want the verbatim             | `bun run references extract --id <id>` or `--source <source-id>`             | Generated file carries the `VerbatimBlock`      |
| Yearly refresh                | Download new annual bulk, update registry, run `build`, review `diff`        | PR with the diff, hand-curated paraphrase edits |
| Tag CFI-review needed         | Triage the ambiguity report, pick correct tag values                         | Updated reference tags                          |
| Orphan references             | Decide: cite in content or delete                                            | Either new wiki-link or removed reference       |

## Commands

All under the single dispatcher `bun run references <command>` (symmetric with `bun run db <command>`).

| Command       | Purpose                                                                          |
| ------------- | -------------------------------------------------------------------------------- |
| `scan`        | Walk content, build `data/references/manifest.json` of every cited id            |
| `validate`    | Gate: unresolved ids, required tags, related symmetry, meta integrity, freshness |
| `extract`     | Run parsers against the manifest and downloaded sources, produce VerbatimBlocks  |
| `build`       | End-to-end: scan + extract + write `*-generated.ts` files                        |
| `diff`        | Show verbatim text changes vs committed generated files (yearly-refresh review)  |
| `size-report` | Tally `data/sources/` sizes, classify commit / LFS / external storage            |
| `help`        | Command index; per-command `--help` prints What/Why/How/Links                    |

## Automatic vs manual

| Happens automatically                               | Happens manually                         |
| --------------------------------------------------- | ---------------------------------------- |
| `scan` + `validate` on every `bun run dev`          | Author a new reference entry             |
| `scan` + `validate` on every `bun run check`        | Download a source binary                 |
| Registry merge at app boot                          | `bun run references extract` / `build`   |
| `/glossary` + `/help` renders on route load         | `diff` review during yearly refresh      |
| Wiki-link resolution in `ReferenceText.svelte`      | Decide commit / LFS / external per source|

Architecture decision #3 keeps extraction out of the dev loop on purpose -- parsers can be slow (large PDFs, XML) and shouldn't block the author's edit-save-reload cycle. The scan + validate path is sub-second.

## File layout

```text
data/
  sources/                                ← gitignored binaries + committed meta
    cfr/
      cfr-14.xml                          ← gitignored
      cfr-14.meta.json                    ← committed (sha256, URL, version)
    aim/
    phak/
    ...
  references/
    manifest.json                         ← scanner output, gitignored

libs/aviation/
  src/
    schema/
      reference.ts                        ← Reference, VerbatimBlock, SourceCitation
      source.ts                           ← Source, SourceType, SourceExtractor, SourceMeta
      tags.ts                             ← 5-axis ReferenceTags
    sources/
      registry.ts                         ← SOURCES[] catalog
      cfr/
        parser.ts                         ← CFR XML parsing
        extract.ts                        ← SourceExtractor implementation
      aim/
      poh/
      ...
    references/
      aviation.ts                         ← 175 hand-authored entries
      cfr-generated.ts                    ← machine-extracted CFR verbatims
      aim-generated.ts                    ← machine-extracted AIM verbatims
      ...
    registry.ts                           ← merged lookup
    validation.ts                         ← schema + gate implementations
    wikilink/
      parser.ts                           ← [[DISPLAY::id]] lexer
    ui/
      ReferencePage.svelte                ← /glossary index
      ReferenceCard.svelte
      ReferenceText.svelte                ← body-text wrapper, resolves wiki-links
      ReferenceTerm.svelte                ← inline tooltip
      ReferenceSidebar.svelte             ← filter facets
      ReferenceFilter.svelte

scripts/
  references.ts                           ← single dispatcher
  references/
    scan.ts
    extract.ts
    build.ts
    diff.ts
    validate.ts
    size-report.ts
```

## Extensibility

New source type = three files:

1. `libs/aviation/src/sources/<type>/parser.ts` + `extract.ts` (implements `SourceExtractor`)
2. Entry in `SOURCES[]` at `libs/aviation/src/sources/registry.ts`
3. Add the type string to the `SourceType` enum in `libs/constants/src/reference-tags.ts`

No changes to `scan`, `validate`, `build`, `diff`. Dispatch is by `source-type`; new types plug in at the parser layer.

## Related work

Content that is NOT text-extractable (VFR sectionals, IFR enroute charts, approach plates, airport diagrams) doesn't fit this pipeline as-is. The Reference schema supports binary/visual content in principle (`verbatim` is typed to allow Markdown/GFM, so an embedded image reference works), but the extraction step would need a different parser family -- OCR, embedded-metadata parsing, or hand-transcription. Proposed as a follow-up in the data-management app's scope.

## Related docs

- [Reference system architecture](../work/todos/20260422-reference-system-architecture.md)
- [Tagging research](../work/todos/20260422-tagging-architecture-research.md)
- [Glossary port plan](../work/todos/20260422-glossary-port-plan.md)
- [ADR 011 - Knowledge Graph Learning System](../decisions/011-knowledge-graph-learning-system/decision.md)
- [MULTI_PRODUCT_ARCHITECTURE.md](MULTI_PRODUCT_ARCHITECTURE.md)
