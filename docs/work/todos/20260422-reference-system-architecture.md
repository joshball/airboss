# Reference system architecture

Design doc. Covers the platform substrate for every piece of authoritative content the apps surface: aviation terms, CFR regulations, POH excerpts, AIM entries, NTSB accident summaries, AOPA articles, and the help pages of each individual app.

Research date: 2026-04-22. Status: draft, awaits user sign-off. Work packages to be authored after the architecture is agreed.

Companion documents:

- [20260422-glossary-port-plan.md](./20260422-glossary-port-plan.md) — what to lift from `airboss-firc`
- [20260422-tagging-architecture-research.md](./20260422-tagging-architecture-research.md) — tagging taxonomy (landed)

## TL;DR

Treat every authoritative chunk the app shows as a typed **Reference** stored in one of two library tiers: `libs/aviation/` (shared across all apps, cross-product aviation knowledge) and `libs/app-help/` (re-usable help primitives that each app composes into its own surface). Content authors write prose with `[[DISPLAY::id]]` wiki-links; a build-time parser collects every referenced id into an **extraction manifest**, and per-source parsers (CFR, POH, AIM, NTSB, PDF articles, …) materialize the cited chunks into the reference library from the downloaded source corpus. When next year's regs drop, re-run the extractors, diff the output, ship the review as a PR. Every Reference carries structured tags (taxonomy pending) that `bun run check` enforces on new entries, and the `/glossary` route renders category-faceted views off the same data apps can search inline.

## Goals

1. **One system, many sources.** CFR, POH, AIM, PCG, AC, NTSB, AOPA, hand-authored — same pipeline, pluggable parsers.
2. **Separation of concerns.** Aviation content is shared. App-specific help is not. Both are libraries apps mount.
3. **Verbatim and paraphrase.** CFR language is cryptic and hard; teaching requires both "what the reg literally says" and "what it means in plain English."
4. **Regs change every year.** Refresh must be mechanical: drop the new source file in, re-run parsers, review the diff, merge.
5. **Every mention is a link.** Authors never hard-code text referring to a term; they use `[[DISPLAY::id]]` so the rendered version becomes a tooltip / popover / link to the canonical definition.
6. **Tags that are not worthless.** Required axes, validated at commit. Better small and disciplined than large and speculative.
7. **Search finds across aviation + app help** from any app, with filters to separate or combine.

## Non-goals

- Replacing the knowledge-graph. Knowledge-graph nodes are composed FROM references. Nodes are teaching units; references are atomic authoritative chunks.
- Being a full-text search engine. References are keyed by id + tags; the lookup is deterministic, not semantic.
- Being a wiki. Wiki-links reference pre-defined ids, they do not auto-create pages.

## Library structure

Three tiers, each a separate `libs/*` workspace.

### `libs/aviation/` — aviation content, cross-app

Aviation knowledge that any surface app could want: glossary terms, CFR sections, AIM chapters, POH excerpts. The source of truth for aviation language on the platform.

```text
libs/aviation/
  src/
    schema/
      reference.ts              Typed Reference contract
      source.ts                 Typed SourceRegistry contract
      tags.ts                   Tag taxonomy constants (from tagging-research)
    sources/
      registry.ts               Known sources: cfr-14, aim-2026, poh-c172s-1981, ...
      cfr/
        parser.ts               Parser for 14 CFR XML / PDF
        extract.ts              extract(manifest, sourceFile) -> Reference[]
      aim/
        parser.ts
        extract.ts
      poh/
        parser.ts
        extract.ts
      pcg/                      Pilot-Controller Glossary
      ntsb/                     Accident reports
      aopa/                     Articles
      hand-authored/            References that don't come from an external source
    references/
      aviation.ts               175 aviation entries (ported from airboss-firc)
      cfr-generated.ts          machine-extracted CFR, rebuilt yearly
      aim-generated.ts          machine-extracted AIM
      poh-generated.ts          machine-extracted POH
    registry.ts                 Merged lookup: by-id, by-term, by-tag
    validation.ts               Build-time gates
    ui/
      ReferencePage.svelte      The /glossary index
      ReferenceCard.svelte
      ReferenceTerm.svelte      Inline tooltip component
      ReferenceText.svelte      Body-text wrapper that renders [[::id]]
      ReferenceSidebar.svelte
      ReferenceFilter.svelte
    index.ts                    Barrel
  package.json                  @ab/aviation
```

Every app that surfaces aviation content depends on `@ab/aviation`. `apps/study/` mounts `ReferencePage.svelte` at `/glossary`. Future `apps/firc/`, `apps/spatial/`, etc. do the same, or render inline on detail pages.

### `libs/app-help/` — help primitives, cross-app

Generic primitives for an app's own help content. Not aviation. Not app-specific content either. The **substrate** for an app's help pages.

```text
libs/app-help/
  src/
    schema/
      help-section.ts           Typed HelpSection (id, title, body, tags, related)
      help-page.ts              Typed HelpPage (id, title, sections[], route)
    ui/
      HelpLayout.svelte         Page shell
      HelpSection.svelte        Collapsible section
      HelpTOC.svelte            Table of contents
      HelpSearch.svelte         In-app help search
      HelpCard.svelte           Pull-out card for how-to snippets
    validation.ts               Tag gates for app-specific help
    index.ts
  package.json                  @ab/app-help
```

Apps import `@ab/app-help` and author their own content against these primitives. The components don't know whether they're rendering "how FSRS works" or "what the calibration page is for" — that's the app's content.

### `apps/<app>/help/` — per-app content

Study app's content lives here. Future apps get their own folders.

```text
apps/study/
  src/
    routes/(app)/
      help/
        +page.ts                Load data -> pass to HelpLayout
        +page.svelte            Renders @ab/app-help components over study content
    lib/help/
      content/                  Authored help pages + sections
        dashboard.ts
        memory-review.ts
        reps-session.ts
        calibration.ts
        knowledge-graph.ts
        getting-started.ts
      index.ts                  Aggregated registry
```

The content in `apps/study/src/lib/help/content/` is study-app-specific. When `apps/spatial/` lands, it gets its own `apps/spatial/src/lib/help/` without touching study's content.

### How an app searches across both

The `/glossary` route in study renders `@ab/aviation`. The `/help` route renders `@ab/app-help` with study's content. A top-nav search box can query both simultaneously by importing both registries and running a faceted search — results clearly labeled "aviation" or "help" and filterable. One search UX, separated data.

## The Reference schema

The core type, typed in `libs/aviation/src/schema/reference.ts`:

```typescript
export interface Reference {
  /** Stable id. Convention: <source-prefix>-<slug>. Examples:
   *    cfr-14-91-155        (14 CFR 91.155)
   *    aim-7-1-1            (AIM 7-1-1)
   *    poh-c172s-4-5        (POH Cessna 172S section 4.5)
   *    term-metar           (hand-authored: METAR)
   *    term-ifr-minimums    (hand-authored, spans multiple regs)
   */
  id: string;

  /** Human-facing display label. "14 CFR 91.155", "METAR", "Class B airspace". */
  displayName: string;

  /** Alternate ways a user might refer to this term. Drives search + the
   * wiki-link fuzzy-match when the author writes [[Something::]]. */
  aliases: string[];

  /** Tag axes from the tagging taxonomy. Required axes gate commits. */
  tags: ReferenceTags;

  /** Plain-English explanation authored by the team. This is where the
   * teaching voice lives. Always present. Markdown allowed. May embed
   * wiki-links to other references. */
  paraphrase: string;

  /** Source-verbatim text. Present when the reference has an authoritative
   * primary source (CFR, AIM, POH, etc.); absent for hand-authored terms. */
  verbatim?: VerbatimBlock;

  /** Pointers to the original source(s). At least one when verbatim is
   * present. May have multiple when a concept spans sections (e.g.
   * "IFR fuel minimums" cites both 91.167 and 91.169). */
  sources: SourceCitation[];

  /** Related reference ids for "see also" rendering. Bidirectional
   * (both ends add the other). */
  related: string[];

  /** When hand-authored, who authored. Optional for machine-extracted. */
  author?: string;

  /** ISO date of last review by a human. Drives a "stale reference"
   * report when old. */
  reviewedAt?: string;
}

export interface VerbatimBlock {
  /** The exact text from the source. */
  text: string;

  /** Version of the source this text came from. Drives the yearly diff. */
  sourceVersion: string;

  /** ISO date the extraction ran. */
  extractedAt: string;
}

export interface SourceCitation {
  /** Source id in the registry. "cfr-14", "aim-2026-01", "poh-c172s-1981". */
  sourceId: string;

  /** Locator within the source. Shape is source-specific:
   *   CFR:  { title: 14, part: 91, section: '155' }
   *   AIM:  { chapter: 7, section: 1, paragraph: 1 }
   *   POH:  { section: '4.5', page: 42 }
   *   NTSB: { reportId: 'CEN20LA123' }
   */
  locator: Record<string, string | number>;

  /** Deep-link URL to the source if available online. */
  url?: string;
}
```

Reasons for each field:

- **`id`** gates wiki-link resolution. Source-prefixed so humans can guess the id when they know the source. Slugified so it survives filesystem + URL use.
- **`displayName` + `aliases`** separate the canonical rendering from the search surface. Wiki-links can be written `[[IFR fuel::cfr-14-91-167]]` even though the entry's displayName is "14 CFR 91.167."
- **`paraphrase` always present.** Even for a machine-extracted CFR, a human must write the plain-English layer. This is the teaching voice; the CFR verbatim is the authority.
- **`verbatim` optional, versioned.** Non-CFR references may have no verbatim. CFR ones always do. The version + extractedAt fields make the yearly diff tractable.
- **Multiple `sources`** handle the "IFR fuel minimums" case — one concept, two CFR sections.
- **`related`** is bidirectional and enforced symmetric by the validator.

## Source registry

`libs/aviation/src/sources/registry.ts` is the table of what's been downloaded:

```typescript
export interface Source {
  id: string;                   // 'cfr-14', 'aim-2026-01'
  type: SourceType;             // 'cfr' | 'aim' | 'poh' | 'pcg' | 'ntsb' | 'aopa' | 'ac' | 'hand-authored'
  title: string;                // '14 CFR - Aeronautics and Space'
  version: string;              // 'revised-2026-01-01'
  downloadedAt: string;         // ISO
  format: 'xml' | 'pdf' | 'html' | 'txt' | 'json';
  /** Relative path from repo root to the downloaded source file. */
  path: string;
  /** Canonical URL where the user can cross-check. */
  url: string;
}
```

Downloaded source files live in a structured tree:

```text
data/sources/
  cfr/
    14cfr-2026-01.xml                 The full corpus
    14cfr-2026-01.meta.json           Download metadata, checksums
  aim/
    aim-2026-01.pdf
    aim-2026-01.meta.json
  poh/
    c172s-1981.pdf
    c172s-1981.meta.json
  pcg/
    pcg-2026.pdf
  ntsb/
    ntsb-2025-annual.csv
  aopa/
    articles-2026/
  ac/
    ac-61-83k.pdf
```

`data/sources/` may be gitignored (multi-GB files), with checksums + download URLs committed so the user can re-download. The parsers operate on the local files; parsed output is committed.

## The extraction pipeline

```text
                                     extraction manifest
(authored content w/ wiki-links)   ->   (data/references/manifest.json)
         |                                         |
         v                                         v
scanner: bun run references:scan         per-source parsers
         |                                         |
         v                                         v
  builds manifest                      each id -> parser(source, locator) -> VerbatimBlock
                                                   |
                                                   v
                                        materialized references
                                        (libs/aviation/src/references/*-generated.ts)
                                                   |
                                                   v
                                        validated + committed to repo
                                                   |
                                                   v
                                        render in /glossary + inline
```

### Step 1: scan

`scripts/references/scan.ts` walks every content location (`course/knowledge/**/*.md`, `apps/*/src/lib/help/content/**/*.ts`, hand-authored references' `paraphrase` fields) and extracts every id from every wiki-link. Deduped. Output: `data/references/manifest.json`.

Shape:

```json
{
  "generatedAt": "2026-04-22T…",
  "references": [
    { "id": "cfr-14-91-155", "firstSeenIn": "course/knowledge/airspace/vfr-weather-minimums/node.md", "useCount": 12 },
    { "id": "aim-7-1-1", "firstSeenIn": "apps/study/src/lib/help/content/dashboard.ts", "useCount": 3 }
  ],
  "unresolvedText": [
    { "display": "some metar term", "firstSeenIn": "course/knowledge/weather/reading-metars-tafs/node.md" }
  ]
}
```

"Unresolved text" = authored as `[[some metar term::]]` with no id yet. A report we act on when we want to stop treating it as a TODO.

### Step 2: extract per source

For each id in the manifest, look up its source from the id prefix + the in-reference `sources[]` field. Route to the right parser.

Per-parser contract in `libs/aviation/src/sources/<type>/extract.ts`:

```typescript
export interface SourceExtractor {
  canHandle(sourceId: string): boolean;
  extract(locator: Record<string, string | number>, sourceFile: string): Promise<VerbatimBlock>;
}
```

Parsers are black boxes: CFR parser reads XML, AIM parser reads PDF with pdf.js + section-heuristic, POH parser is manual hint-driven. Output is normalized to `VerbatimBlock`.

### Step 3: materialize

`scripts/references/build.ts` reads the manifest, calls the right extractor per reference, and writes the machine-generated reference files:

```text
libs/aviation/src/references/cfr-generated.ts
libs/aviation/src/references/aim-generated.ts
libs/aviation/src/references/poh-generated.ts
```

These files are committed. Regenerable, but committed so the data is reviewable + diff-able in PRs.

### Step 4: yearly refresh

1. Download new source file (e.g. `14cfr-2027-01.xml`).
2. Update `sources/registry.ts` with the new version + path.
3. Re-run `bun run references:build`.
4. `git diff libs/aviation/src/references/cfr-generated.ts` shows exactly which CFR sections changed their text.
5. Hand-review the diff. Update `paraphrase` text where the reg's meaning shifted. Ship as a PR.

This is the whole point. A reg changing isn't a surprise; it's a diff. A reg's paraphrase changing requires human review, which the PR enforces.

## Wiki-link syntax

Canonical form: `[[DISPLAY::id]]`.

Three valid modes:

| Form                                 | When                                                                             | Renders as                                                      |
| ------------------------------------ | -------------------------------------------------------------------------------- | --------------------------------------------------------------- |
| `[[VFR minimums::cfr-14-91-155]]`    | Both known                                                                       | "VFR minimums" as a link/tooltip to the 91.155 reference        |
| `[[VFR minimums::]]`                 | Text known, id not yet decided                                                   | "VFR minimums" with a yellow "needs link" underline in dev      |
| `[[::cfr-14-91-155]]`                | Id known, want the reference's `displayName` as the text                         | Renders as "14 CFR 91.155" (the reference's displayName)        |

Invalid / disallowed:

- `[[::]]` — empty both. Parser errors.
- `[[text]]` without the `::` — not a wiki-link; parser ignores (plain bracketed text survives).
- Nested `[[…[[…]]…]]` — parser errors.
- Whitespace around `::` OK (`[[ x :: y ]]` trimmed).

### Parsing

`libs/aviation/src/wikilink/parser.ts`. Regex-lexer pair, tolerant of markdown context (skips fenced code blocks, skips inline code, yes to prose and link text). Output: AST with `{ kind: 'wikilink', display: string | null, id: string | null, sourceSpan: [start, end] }` nodes.

### Rendering

`libs/aviation/src/ui/ReferenceText.svelte` accepts a string with wiki-links, runs the parser, and emits `<ReferenceTerm>` for each resolved link and a debug-mode highlighted `<span>` for unresolved ones. Used by any component that wants link-resolution over prose.

### Validation

`bun run check` runs `scripts/references/validate.ts`:

- Every `[[::id]]` and `[[text::id]]` id must exist in the registry.
- Every `[[text::]]` is collected into a TODO report (count printed, not an error).
- `[[::]]` and malformed links fail the check.
- Orphan references (exist in the library, no content uses them) is a warning.

## Tagging

The tagging research landed at [20260422-tagging-architecture-research.md](./20260422-tagging-architecture-research.md). Five required axes plus one optional axis plus freeform keywords, faceted (each axis independent). Summary:

| Axis                  | Required | Multi | Values                                                                                                        |
| --------------------- | -------- | ----- | ------------------------------------------------------------------------------------------------------------- |
| `source-type`         | yes      | no    | `cfr` / `aim` / `pcg` / `ac` / `acs` / `phak` / `afh` / `ifh` / `poh` / `ntsb` / `gajsc` / `aopa` / `faa-safety` / `sop` / `authored` / `derived` |
| `aviation-topic`      | yes      | yes (1-4) | `regulations` / `weather` / `navigation` / `communications` / `airspace` / `aerodynamics` / `performance` / `weight-balance` / `aircraft-systems` / `flight-instruments` / `procedures` / `human-factors` / `medical` / `certification` / `maintenance` / `airports` / `emergencies` / `training-ops` |
| `flight-rules`        | yes      | no    | `vfr` / `ifr` / `both` / `na`                                                                                 |
| `knowledge-kind`      | yes      | no    | `definition` / `regulation` / `concept` / `procedure` / `limit` / `system` / `safety-concept` / `reference`   |
| `phase-of-flight`     | cond.    | yes (0-3) | `preflight` / `ground-ops` / `takeoff` / `climb` / `cruise` / `descent` / `approach` / `landing` / `missed` / `emergency` (required when `source-type in { poh, aim, ac, sop }` or `knowledge-kind = procedure`) |
| `cert-applicability`  | no       | yes   | `student` / `sport` / `recreational` / `private` / `instrument` / `commercial` / `cfi` / `cfii` / `atp` / `all` |
| `keywords`            | no       | yes   | Freeform, validated only for length                                                                           |

Reasons for the shape:

- **Axis separation kills the firc "cfi-knowledge on 91% of entries" problem.** Each axis answers one question; a filter on `flight-rules: ifr` is meaningful because the axis exists.
- **`aviation-topic` multi-valued** handles the "IFR fuel reserves" case (`regulations` + `procedures` + maybe `aircraft-systems`) without forcing a single arbitrary domain.
- **`weight-balance` and `performance` are separate topics on purpose.** CFIs teach them apart; conflating is a red flag.
- **`flight-instruments` is not `aircraft-systems`.** AHRS is a system; the PFD is an instrument. Different study approaches.
- **`knowledge-kind` distinguishes `regulation` / `procedure` / `limit` / `concept`** so "show me all the V-speeds" and "show me all the procedures" work without a keyword dance.
- **`phase-of-flight` is expensive to populate accurately** for concept/reg content; mandatory only where it earns its keep.

The TypeScript shape in `libs/aviation/src/schema/tags.ts`:

```typescript
export interface ReferenceTags {
  sourceType: SourceType;
  aviationTopic: readonly [AviationTopic, ...AviationTopic[]];   // 1-4
  flightRules: FlightRules;
  knowledgeKind: KnowledgeKind;
  phaseOfFlight?: readonly PhaseOfFlight[];                       // 0-3, gated conditional
  certApplicability?: readonly CertApplicability[];
  keywords?: readonly string[];
}
```

Validation (build-time) enforces:

- Every required axis present with a valid enum value.
- `aviationTopic` has 1-4 entries, no duplicates.
- `phaseOfFlight` required (with 1+ entries) when `sourceType in { poh, aim, ac, sop }` or `knowledgeKind == procedure`.
- `phaseOfFlight` has 0-3 entries when present, no duplicates.
- `keywords` each non-empty, ≤ 40 chars, ≤ 12 per entry.

Migration of the existing 175 entries:

- Deterministic first pass from id suffix + source string: `-wx` → topic includes `weather`, `-reg` → topic includes `regulations`, etc. Catches ~60% of entries cleanly.
- Agent-assisted second pass on remaining + aviation-accuracy review of the first pass.
- Batch human review, not per-entry — present the full retagged set; the user corrects categories in place before the first commit.
- Sub-agent estimate: ~6 hours of agent time + human review time.

Open questions specific to tagging, per the research doc:

- Drop the original `domain` field entirely vs keep alongside as `aviationTopic[0]`?
- Add `governance` to `aviationTopic` for organization entries (FAA, ICAO), or tag them `knowledgeKind: reference` with `sourceType: authored`?
- Single vs multi-valued `knowledgeKind`? (Research recommends single; flags the "definition + regulation" dual-case as an edge.)
- Where do ACS task codes live? Separate axis, or freeform keywords?

## Routes

Two routes per app that surfaces these.

### `/glossary` (shared via `@ab/aviation`)

```text
/glossary                      Index. All references. Search + filter by tag axes.
/glossary/[id]                 Per-reference detail. Verbatim + paraphrase + sources + related.
/glossary?source=cfr           Filtered view.
/glossary?tag=weather,ifr      Combined tag filter.
/glossary#needs-link           The "TBD id" TODO list (dev/author affordance).
```

Category views (e.g. "all weather" or "all CFR") are tag-filter permalinks, not separate routes.

### `/help` (per-app, via `@ab/app-help` components)

```text
/help                          App help index. Study has its own content; other apps have theirs.
/help/[slug]                   A specific help section (getting-started, calibration, …).
```

Cross-surface search at the app top-nav queries both registries, segments results by source.

## Quality gates

`bun run check` runs `scripts/references/validate.ts` after svelte-check + biome + knowledge dry-run. Fails the build on:

- Unresolved `[[*::id]]` (id not in registry).
- Malformed wiki-links.
- Missing required tags on any reference.
- Reference `verbatim` present without any `sources[]`.
- Duplicate ids.
- Bidirectional `related` not symmetric.
- `sources[]` citing an unregistered `sourceId`.

Warns (reports but doesn't fail) on:

- `[[text::]]` TBD-id links (count + locations).
- Orphan references (in library, no content cites).
- References whose `reviewedAt` is > 12 months old.

## Authoring workflow

1. Write prose with `[[VFR minimums::cfr-14-91-155]]` wiki-links as you mention terms.
2. If you don't know the id yet, write `[[VFR minimums::]]` and keep going.
3. Commit.
4. Gate reports: "3 TBD-id wiki-links, 0 broken links, all tag axes present."
5. Resolve TBDs when convenient: author the reference if new, or look up an existing id.
6. For machine-extracted content: add the id to a reference with the right `sources[]` citation, then run `bun run references:build` to materialize the `verbatim`.

## Migration phases

Numbered to match the glossary port plan's step numbers where possible.

| Phase                                                                  