---
title: 'Spec: Reference Extraction Pipeline'
product: platform
feature: reference-extraction-pipeline
type: spec
status: unread
---

# Spec: Reference Extraction Pipeline

The machinery that turns downloaded source corpora (14 CFR XML, AIM PDFs, POH excerpts, etc.) into committed, reviewable `VerbatimBlock` entries inside `libs/aviation/src/references/*-generated.ts`. Phases 5 and 9 of the reference system architecture. Core deliverables: a source registry, a `data/sources/` on-disk layout, the build/extract/validate/diff scripts, the first concrete parser (CFR), 10 highest-value CFR extractions, and the yearly-refresh tooling that makes next January's reg update a one-command diff instead of a rewrite.

Reference: [20260422-reference-system-architecture.md](../../work/todos/20260422-reference-system-architecture.md) - especially the **"The extraction pipeline"** and **"Source registry"** sections.

## In scope

### Source registry and `data/sources/` layout

- `libs/aviation/src/sources/registry.ts` - the catalog of every downloaded source (`Source[]`). Types live in wp-reference-system-core; this WP populates the data and establishes conventions.
- On-disk tree rooted at `data/sources/`, one folder per `SourceType`. Each downloaded binary is paired with a `<name>.meta.json`.

```text
data/sources/
  cfr/
    14cfr-2026-01.xml              (gitignored)
    14cfr-2026-01.meta.json        (committed)
  aim/
    aim-2026-01.pdf                (gitignored)
    aim-2026-01.meta.json          (committed)
  ...
```

- `*.meta.json` shape: `{ sourceId, url, format, version, downloadedAt, checksum, sizeBytes }`. Small, committed, enough for a fresh clone to re-download and verify.
- `.gitignore` rule added for `data/sources/**` with an allowlist exception for `*.meta.json`.

### Pipeline scripts

Per the architecture doc's "The extraction pipeline" section:

- `scripts/references/extract.ts` - iterate the manifest, dispatch each id to the right `SourceExtractor`, produce `VerbatimBlock` per id. Supports `--id <ref-id>` for single-reference re-runs. Never runs on `bun run dev` (decision #3).
- `scripts/references/build.ts` - orchestrates scan -> extract -> materialize. Writes one `*-generated.ts` per source type into `libs/aviation/src/references/`. Supports `--diff` to show which verbatim text changed.
- `scripts/references/validate.ts` - extends the validator authored in wp-reference-system-core with the registry, meta.json, and freshness checks listed in Validation below.
- `scripts/references/diff.ts` (or folded into `build.ts --diff`) - renders a human-readable summary of what verbatim text changed between the current generated files and a fresh extraction run. Drives yearly-refresh review.
- `scripts/references/size-report.ts` - tallies `data/sources/` binary sizes + meta.json contents, prints a table, flags LFS / external-storage candidates per decision #2.
- `bun run references:extract`, `bun run references:build`, `bun run references:diff`, `bun run references:size-report` - package.json scripts.

**Scanner ownership:** the basic scanner (`scripts/references/scan.ts`) is authored in wp-reference-system-core. This WP does **not** touch it. A future extension to scan `@ab/help`-registered content will land in wp-help-library, not here.

### CFR parser and first 10 extractions

Primary implementation deliverable. `libs/aviation/src/sources/cfr/{parser.ts,extract.ts}`:

- Input format: federal eCFR bulk-download XML for Title 14 (`14cfr-YYYY-MM.xml`). PDF fallback documented in design.md but not implemented unless the XML route turns out to be blocked.
- Implements the `SourceExtractor` contract (authored in wp-reference-system-core):

```typescript
export interface SourceExtractor {
  canHandle(sourceId: string): boolean;
  extract(locator: Record<string, string | number>, sourceFile: string): Promise<VerbatimBlock>;
}
```

- `canHandle` returns true when `sourceId` starts with `cfr-`.
- `extract` takes `{ title, part, section }` locator, navigates the XML tree, returns `{ text, sourceVersion, extractedAt }`.

The 10 CFR sections materialized in this WP (highest-value aviation fundamentals):

1. 14 CFR 91.3 - Responsibility and authority of the pilot in command
2. 14 CFR 91.13 - Careless or reckless operation
3. 14 CFR 91.103 - Preflight action
4. 14 CFR 91.107 - Use of safety belts, shoulder harnesses, and child restraint systems
5. 14 CFR 91.151 - Fuel requirements for flight in VFR conditions
6. 14 CFR 91.155 - Basic VFR weather minimums
7. 14 CFR 91.167 - Fuel requirements for flight in IFR conditions
8. 14 CFR 91.169 - IFR flight plan: Information required
9. 14 CFR 91.185 - IFR operations: Two-way radio communications failure
10. 14 CFR 91.211 - Supplemental oxygen

(14 CFR 61.56 - flight review was a candidate but is displaced by 91.151 for symmetry with 91.167 and because VFR fuel minimums are cited from more aviation-fundamentals content than the flight-review rule.)

### Yearly-refresh tooling

The reason this system exists. Flow:

1. Download new source (e.g. `14cfr-2027-01.xml`), drop in `data/sources/cfr/`.
2. Update `sources/registry.ts` with the new version + checksum + `downloadedAt`.
3. Run `bun run references:build --diff`. Output: a human-readable list of which reference ids had text changes, grouped by source.
4. Reviewer eyeballs the diff, updates each affected reference's `paraphrase` where the reg's meaning shifted.
5. Commit both the generated file and any paraphrase updates. PR diff is the review artifact.

`scripts/references/diff.ts` (or `build.ts --diff`) renders side-by-side verbatim-text deltas with a leading summary count.

## Out of scope

- **Schema types** (`Reference`, `SourceCitation`, `VerbatimBlock`, `ReferenceTags`, `Source`). Authored in wp-reference-system-core. This WP imports and uses them.
- **Wiki-link parser and basic scanner.** Authored in wp-reference-system-core.
- **AIM, POH, PCG, AC, NTSB, AOPA, hand-authored parsers.** Phases 6 and 8, each its own WP. This WP establishes the extensibility contract; sibling parsers follow the same `SourceExtractor` shape.
- **Help library (`@ab/help`) and help-content scanning.** wp-help-library.
- **`/glossary` route and UI components.** wp-reference-system-core.
- **Downloading source files.** Out of band. The user drops the file into `data/sources/<type>/` and updates `registry.ts`. A future WP may automate downloads.

## Data model

Types are defined in wp-reference-system-core. This WP is responsible for:

- **Populated `Source[]` data** in `libs/aviation/src/sources/registry.ts`. Initial content: one `cfr-14` entry pointing at the 2026-01 revision. Other source types added when their parsers land.
- **`.meta.json` shape** (committed per downloaded source):

```typescript
export interface SourceMeta {
  sourceId: string;               // 'cfr-14'
  url: string;                    // canonical download URL
  format: 'xml' | 'pdf' | 'html' | 'txt' | 'json';
  version: string;                // 'revised-2026-01-01'
  downloadedAt: string;           // ISO
  checksum: string;               // sha256 of the binary
  sizeBytes: number;              // for size-report and storage decisions
}
```

- **`*-generated.ts` file shape** - one file per source type under `libs/aviation/src/references/`:

```typescript
// libs/aviation/src/references/cfr-generated.ts
// Generated by scripts/references/build.ts. Do not edit by hand.
import type { VerbatimBlock } from '../schema/reference';

export const cfrVerbatim: Record<string, VerbatimBlock> = {
  'cfr-14-91-155': {
    text: '...',
    sourceVersion: 'revised-2026-01-01',
    extractedAt: '2026-04-22T...',
  },
  // ...
};
```

These files are committed. The registry merge in `libs/aviation/src/registry.ts` (authored in wp-reference-system-core) joins the `paraphrase` side of a `Reference` with the `verbatim` side looked up here by id.

## Behavior

### `scripts/references/extract.ts`

- Read `data/references/manifest.json` (produced by the scanner).
- For each manifest id, load the corresponding `Reference` from the registry to find its `sources[]` citation. If no reference exists yet, skip with a warning (the scanner already flagged it).
- For each citation, find a `SourceExtractor` where `canHandle(sourceId) === true`. Error if none matches.
- Call `extract(locator, sourcePath)`. Collect results into an in-memory map keyed by id.
- Write one `*-generated.ts` per source type to `libs/aviation/src/references/`.
- `--id <ref-id>` mode: extract that single id, merge into the existing generated file, leave other entries untouched.
- `--dry-run` mode: do not write files; print what would change.

### `scripts/references/build.ts`

- Run the scanner (re-entering `scripts/references/scan.ts` as a function call, not a subprocess).
- Run `extract.ts` logic inline.
- Write `*-generated.ts` files.
- `--diff` mode: before writing, compute a textual diff between current generated files and new output, print a summary `n references changed, m added, k removed` plus per-id hunks.

Idempotent: running twice in a row with the same source file produces zero diff. `extractedAt` updates but that alone does not count as a change for `--diff` output (only `text` or `sourceVersion` deltas trigger a hunk).

### `scripts/references/validate.ts` (extensions)

Extends the validator from wp-reference-system-core with:

- **Registry coherence** (fails check): every `sourceId` in any `Reference.sources[]` exists in `registry.ts` with matching `type`.
- **meta.json integrity** (fails when binary present, warns when absent): for each registry entry, if the file at `path` exists, verify sha256 matches `checksum`. If the file does not exist on this machine, emit a warning (dev machines do not all need every binary).
- **Generated-file freshness** (warns): for each id in the manifest whose reference has a `sources[]` citation but no entry in the appropriate `*-generated.ts`, warn "extractor has not been run for <id>". Does not fail the build because the extractor is manual.

### `scripts/references/diff.ts`

Runs `build.ts` logic with `--dry-run`, captures the would-be output, diffs against the committed `*-generated.ts`. Prints:

- Summary counts (changed / added / removed).
- Per-id hunks for changed entries, showing old vs new verbatim text.
- `sourceVersion` transitions when they cross a boundary (e.g. `revised-2026-01-01` -> `revised-2027-01-01`).

### `scripts/references/size-report.ts`

- Walk `data/sources/`. For each file, record path + sizeBytes + sourceType.
- Tally total per source type.
- Print a table. Flag entries > 5 MB as LFS candidates, > 100 MB as external-storage candidates, < 5 MB as commit candidates.
- Output is advisory only. The user makes the per-source storage decision and captures it in the architecture doc or a follow-up ADR.

## Validation

Fails `bun run check`:

- Every `SourceCitation.sourceId` resolves to a registered `Source` with matching `type`.
- No duplicate `Source.id` values.
- Every `Source.path` points under `data/sources/` (no absolute paths, no escapes).
- Every `*-generated.ts` file that exists parses cleanly as an object literal matching `Record<string, VerbatimBlock>`.
- When the source binary exists, its sha256 matches `Source.checksum`.

Warns (reports, does not fail):

- Source binary absent at `Source.path` (dev machine does not have that source downloaded).
- Reference id in the manifest whose `sources[]` citation has no `VerbatimBlock` in the generated file for that source type (extractor has not been run).
- `Source.downloadedAt` older than 13 months (regulatory sources age out yearly).

## Dependencies

- **wp-reference-system-core must land first.** This WP imports `Reference`, `SourceCitation`, `VerbatimBlock`, `Source`, `SourceType`, and `SourceExtractor` from it, and extends its validator. No commits here merge before core.
- Decision #2 (storage) resolves at the end of Phase 6 of this WP using the size report.
- Decision #3 (manual extractor) locks the `references:extract` script out of the `dev` script-chain.

## Open items

- Should `build.ts` also rewrite `*.meta.json` `downloadedAt` when the binary checksum changes mid-flight, or should that require a manual registry edit? Leaning manual - surprise registry edits are worse than an explicit step.
- CFR XML has tables (91.155 VFR minimums is the canonical example). Render verbatim as GFM markdown tables, or preserve as-is and let the rendering layer decide? Decision deferred to design.md.
- If an extractor fails for one id mid-run, does `build.ts` abort the whole run or continue and report at the end? Recommended: continue, collect errors, exit non-zero with a summary. Prevents one bad entry from blocking nine good ones.
- `references:extract --id` merging into an existing generated file: keep entries sorted by id alphabetically to minimize diff churn. Document in design.md.
