---
title: 'Design: Reference Extraction Pipeline'
product: platform
feature: reference-extraction-pipeline
type: design
status: unread
---

# Design: Reference Extraction Pipeline

## Data flow

```text
              data/sources/cfr/14cfr-2026-01.xml
                             |
                             v
              libs/aviation/src/sources/cfr/parser.ts
                 parseCfrXml() -> indexed section tree
                             |
                             v
              libs/aviation/src/sources/cfr/extract.ts
                 extract({title, part, section}) -> VerbatimBlock
                             |
                             v
              scripts/references/extract.ts
                 dispatch per-id -> map<id, VerbatimBlock>
                             |
                             v
              libs/aviation/src/references/cfr-generated.ts   (committed)
                             |
                             v
              libs/aviation/src/registry.ts (core WP)
                 join(Reference.paraphrase, cfrVerbatim[id]) -> full Reference
                             |
                             v
              /glossary UI + inline wiki-link tooltip
```

Scanner and wiki-link parser are upstream (wp-reference-system-core). Everything right of the `libs/aviation/src/references/` file is also upstream. This WP owns the source side and the materialization step.

## CFR source format: eCFR XML

The federal eCFR offers [bulk XML downloads](https://www.ecfr.gov/reader-aids/ecfr-developer-resources/bulk-data-downloads) for each CFR title, revised annually with mid-year amendments as published. Title 14 (Aeronautics and Space) is our target.

Why XML over PDF:

- Deterministic structure. `<SECTION>` elements have explicit `SECTNO` and `SUBJECT` children; we navigate to the right section without heuristics.
- Text is already semantic. Paragraphs are `<P>`, tables are `<GPOTABLE>`, notes are `<NOTE>`. Extraction is a tree walk, not OCR and whitespace-normalization.
- eCFR versions the XML at the bulk-download level - `version` in our meta.json is the revision date printed in the file header.

PDF fallback: only if the eCFR bulk download path ever stops working. In that case, we shift to `pdf-parse` or `pdfjs-dist` against the printed CFR PDF and rebuild `parser.ts` against PDF text extraction. The `SourceExtractor` contract is unchanged; only the parser internals move.

## Section heuristics and known edge cases

The CFR XML has enough shape that most of the extractor is a direct walk:

```text
<DIV5 N="14" TYPE="TITLE">
  <DIV6 N="91" TYPE="PART">
    <DIV8 N="Sec. 91.155" TYPE="SECTION">
      <SECTNO>Sec. 91.155</SECTNO>
      <SUBJECT>Basic VFR weather minimums.</SUBJECT>
      <P>(a) Except as provided in paragraph (b) of this section...</P>
      <GPOTABLE>...</GPOTABLE>
    </DIV8>
  </DIV6>
</DIV5>
```

The `locator` `{title: 14, part: 91, section: '155'}` maps to `DIV5[N=14] -> DIV6[N=91] -> DIV8[N='Sec. 91.155']`.

Known edge cases from spot-sampling the 10 target sections:

- **91.155 has tables.** VFR minimums by airspace class is rendered as `<GPOTABLE>` with `<ROW>` and `<ENT>` children. See "CFR tables to markdown" below.
- **91.107 references child-restraint requirements through a list.** Paragraphs nest several levels (`(a)(1)(i)(A)`); the walker emits indented prose, not nested markdown lists, to preserve the CFR's own paragraph labels.
- **91.185 has conditional rules (IFR lost-comm routing).** The text branches on clearance type; we keep it verbatim rather than trying to restructure.
- **91.211 has an oxygen-altitude table similar to 91.155.** Same `GPOTABLE` shape.
- **Section numbering with letter suffixes** (e.g. some parts have `91.215a`) - our locator accepts `section: string` for this reason.

## CFR tables to markdown

Decision: render `<GPOTABLE>` as a GFM markdown table inside the verbatim `text`. Rationale:

- Verbatim is a string. Plain-text tables with column alignment drift quickly; markdown tables render cleanly everywhere verbatim is shown (`/glossary/[id]`, hover tooltip, PR diff review).
- The eCFR HTML-rendered view uses a table; preserving tabular structure is closer to verbatim than a paragraphic squashing.
- Downstream rendering (the reference detail page) already knows how to render markdown in the `paraphrase` field; it gets markdown in `verbatim` for free.

Cost: GFM tables do not support merged cells; a handful of CFR tables use column spans. For those, the parser emits a fallback plain-text table inside a fenced code block with a `text` language tag, preserving alignment but losing semantic structure. Acceptable - those tables are rare enough that the fallback is not the common path.

## `data/sources/` storage tradeoffs

Per architecture decision #2, storage is resolved at the end of phase 6 with the size report. The matrix:

| Size           | Recommendation             | Why                                                                       |
| -------------- | -------------------------- | ------------------------------------------------------------------------- |
| < 5 MB         | Commit to the repo         | Small enough to live with; fresh clones work immediately.                 |
| 5-100 MB       | Git LFS                    | Keeps the repo history small; LFS handles it transparently.               |
| > 100 MB       | External storage (S3 etc.) | Too big for LFS comfort; fetched on demand via a download script.         |
| Re-downloadable|                            | Meta.json always committed so any machine can re-fetch with checksum.     |

The 14 CFR 2026 XML is approximately 12 MB per spot check, which puts it in LFS territory. Confirmed by the actual size-report run at end of phase 6. The decision is captured as an ADR if it affects more than one source type.

## meta.json integrity model

The `SourceMeta` shape is the source of truth for three things: where the file came from (url), what it is (version, format), and whether it is intact (checksum + sizeBytes).

Validation layers:

1. **On disk present + checksum match:** the strictest gate. Fails `bun run check`.
2. **On disk absent:** a warning. Dev machines are not required to have every source downloaded.
3. **downloadedAt > 13 months old:** a warning, not a failure. Regs are annual; 13 months means we missed a refresh cycle.
4. **URL reachable:** not checked in `bun run check` (network flakiness). Checked only during explicit refresh flow.

The "warn on absent, fail on mismatch" split is the key design decision: it lets a developer clone the repo, run `bun run check`, see the warnings, and decide whether to download (for local extraction work) or skip (if they are only editing paraphrase text).

## Yearly-refresh UX

Target experience: dropping in next January's CFR should be a five-minute job, most of which is waiting on `build`.

Flow:

1. User downloads `14cfr-2027-01.xml`, drops it in `data/sources/cfr/`.
2. User runs `bun run references:size-report` to confirm size category is unchanged (size shifts trigger a new storage decision).
3. User writes `14cfr-2027-01.meta.json` with new checksum. A `bun run references:meta-init <file>` helper computes the checksum so this is one command, not a manual sha256sum.
4. User edits `sources/registry.ts` to point at the new file + bump version + updated downloadedAt.
5. User runs `bun run references:build --diff`.
6. Output:

```text
  References updated: 3
  References unchanged: 7
  Source-version transitions: cfr-14 revised-2026-01-01 -> revised-2027-01-01

  --- cfr-14-91-155 ---
  -  (a) Except as provided in paragraph (b)...
  +  (a) Except as provided in paragraphs (b) and (e)...
```

7. User opens `cfr-generated.ts` in git diff view; hand-reviews each changed entry; updates paraphrase if meaning shifted; opens a PR.

The diff output is the review artifact. The PR diff on `cfr-generated.ts` is the audit trail.

## Error handling

**One-id failure during build:** collect errors into a `FailedExtraction[]` list; write the successes; exit non-zero with a summary. Rationale: nine good extractions should not be blocked by one bad one, and a PR that ships nine green entries plus a known-failure line is a valid intermediate state.

**Missing source binary at extract time:** fail that id with a clear error; do not crash. Include the path that was looked up and the `downloadedAt` from meta.json to help the user figure out whether they deleted the file or never downloaded it.

**Parser crash on a specific section:** catch and report per id; include the fixture path and the locator. Dev writes a minimal fixture for the offending section and ships a parser fix as its own commit.

**Checksum mismatch during validate:** hard fail. This usually means the user edited the XML (why?) or the file is corrupt. Either way, the generated file downstream is suspect.

## Idempotency of `build.ts`

Two runs in a row on the same inputs must produce byte-identical `*-generated.ts` files, except for `extractedAt`. To get there:

- Sort entries by id before writing.
- Stable whitespace normalization in the parser (collapse multiple whitespace, trim paragraphs, keep newlines between paragraphs). Done in `parser.ts`, not `extract.ts`, so the parse step is also deterministic.
- `extractedAt` is recorded per entry but excluded from `--diff` comparisons (only `text` and `sourceVersion` deltas count).

The `--diff` code path explicitly filters `extractedAt` out of its comparison so noise-diffs do not show up in PR review.

## Extensibility - adding a new source type

To add AIM (phase 6, separate WP):

1. Drop `aim-2026-01.pdf` and its meta.json into `data/sources/aim/`.
2. Add the source to `registry.ts`.
3. Create `libs/aviation/src/sources/aim/parser.ts` and `extract.ts`. Implement `SourceExtractor`.
4. Register in `libs/aviation/src/sources/extractors.ts`.
5. Author some `Reference` entries with `sources: [{ sourceId: 'aim-2026-01', locator: { chapter, section, paragraph } }]`.
6. Run `bun run references:build`. A new `aim-generated.ts` appears next to `cfr-generated.ts`.

Nothing in `build.ts`, `extract.ts`, `validate.ts`, or `diff.ts` changes. The pattern scales by cloning the `cfr/` folder and swapping the parser internals.

## What is not built here

- **No auto-download.** The user drops files into `data/sources/` and updates the registry. A future WP may automate: `bun run references:refresh cfr-14` that fetches from the URL, computes checksum, updates meta.json, re-runs build. For now, the five-minute manual flow is fine.
- **No full-text search over verbatim.** Search lives in wp-reference-system-core and wp-help-library. Extraction produces data; search consumes it.
- **No verbatim annotation layer.** Verbatim is the reg's exact text; annotations ("note this applies only to...") live in `paraphrase`, not alongside `verbatim`. This keeps the diff clean and the source-of-truth boundary sharp.
