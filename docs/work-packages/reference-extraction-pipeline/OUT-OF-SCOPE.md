---
title: 'Out of Scope: Reference Extraction Pipeline'
product: platform
feature: reference-extraction-pipeline
type: out-of-scope
status: unread
---

# Out of Scope: Reference Extraction Pipeline

Deferred items, why they're deferred, and the trigger that should make
us revisit each. Future agents and humans: do not build these without
the documented trigger. If you think the trigger is hit, surface it
for a decision rather than building silently.

## Summary

| Item                                                 | Status       | Trigger to revisit                                        |
| ---------------------------------------------------- | ------------ | --------------------------------------------------------- |
| Schema types (Reference / SourceCitation / etc.)     | Rejected     | Never -- owned by wp-reference-system-core                |
| Wiki-link parser and basic scanner                   | Rejected     | Never -- owned by wp-reference-system-core                |
| AIM, POH, PCG, AC, NTSB, AOPA, hand-authored parsers | Follow-on WP | When that source type is ready to ingest (Phases 6 and 8) |
| Help library and help-content scanning               | Rejected     | Never -- owned by wp-help-library                         |
| `/glossary` route and UI components                  | Rejected     | Never -- owned by wp-reference-system-core                |
| Automated source file downloading                    | Deferred     | When the manual five-minute refresh flow becomes painful  |
| Auto-download `refresh` command                      | Deferred     | When manual refresh stops meeting authoring needs         |
| Full-text search over verbatim text                  | Rejected     | Never here -- search lives in core / help-library WPs     |
| Verbatim annotation layer                            | Rejected     | Never -- annotations belong in `paraphrase`               |

## Schema types (Reference / SourceCitation / VerbatimBlock / ReferenceTags / Source)

Status: Rejected

What was rejected:
Authoring the core reference / citation / verbatim / tags / source
type definitions inside this WP.

Why:
These types are the contract this WP imports and uses; they are owned
by `wp-reference-system-core` so that every parser-side WP (this one,
AIM, POH, etc.) shares the same shape. Defining them here would fork
the contract.

References:

- [spec.md](./spec.md) "Out of scope" -> Schema types line
- [spec.md](./spec.md) "Dependencies" section: "wp-reference-system-core must land first"

## Wiki-link parser and basic scanner

Status: Rejected

What was rejected:
The in-prose `[[id]]` wiki-link parser and `scripts/references/scan.ts`
(the manifest scanner).

Why:
Same contract-ownership reasoning as the schema types: the scanner is
authored in `wp-reference-system-core` and re-entered by this WP's
`build.ts` as a function call. This WP explicitly does not touch the
scanner. A future extension to scan `@ab/help`-registered content
lands in `wp-help-library`, not here.

References:

- [spec.md](./spec.md) "Out of scope" -> Wiki-link parser and basic scanner
- [spec.md](./spec.md) "Pipeline scripts" -> Scanner ownership paragraph

## Other parsers (AIM, POH, PCG, AC, NTSB, AOPA, hand-authored)

Status: Follow-on WP

What was deferred:
Concrete `SourceExtractor` implementations for AIM, POH, PCG, AC,
NTSB, AOPA, and hand-authored corpora. This WP establishes the
extensibility contract (the `SourceExtractor` interface, the
`extractors.ts` registry, the per-folder `parser.ts` + `extract.ts`
shape) using CFR as the first concrete instance.

Why:
Scope discipline. CFR is the highest-value source and the cleanest
ingestion target (eCFR XML is deterministic). Each additional source
type has its own parser quirks (PDFs vs HTML vs hand-authored
markdown), each merits its own size-report decision, and each ships
its own ten-extraction smoke set. Bundling them dilutes review and
forces all of them to gate on one another.

Trigger to revisit:
When the next source corpus is ready to ingest (Phases 6 and 8 of the
reference system architecture). Per-source-type WPs.

Implementation pattern when triggered:
Mirror the CFR folder: drop `<type>-YYYY-MM.<ext>` + meta.json into
`data/sources/<type>/`, add the source to `registry.ts`, create
`libs/aviation/src/sources/<type>/{parser.ts,extract.ts}` implementing
`SourceExtractor`, register in `libs/aviation/src/sources/extractors.ts`,
author per-id `Reference` entries, run `bun run references:build`.
Pattern is captured at [design.md](./design.md) "Extensibility -
adding a new source type".

References:

- [spec.md](./spec.md) "Out of scope" -> Other parsers line
- [design.md](./design.md) "Extensibility - adding a new source type"
- [docs/work/todos/20260422-reference-system-architecture.md](../../work/todos/20260422-reference-system-architecture.md)

## Help library (`@ab/help`) and help-content scanning

Status: Rejected

What was rejected:
The `@ab/help` library and any scanning of help-registered content
for reference identifiers.

Why:
Owned by `wp-help-library`. This WP is the source-ingestion pipeline
for canonical corpora (CFR, AIM, etc.); help content is a different
kind of authored material with a different mounting story.

References:

- [spec.md](./spec.md) "Out of scope" -> Help library line

## `/glossary` route and UI components

Status: Rejected

What was rejected:
The `/glossary` reader UI and its supporting components.

Why:
Owned by `wp-reference-system-core`. This WP produces the verbatim
data the renderer consumes; rendering is upstream of this WP's
boundary in the data flow diagram in [design.md](./design.md).

References:

- [spec.md](./spec.md) "Out of scope" -> /glossary route line
- [design.md](./design.md) "Data flow" diagram

## Automated source file downloading

Status: Deferred

What was deferred:
A `bun run references:refresh <source-id>` command (or similar) that
fetches the source binary from `SourceMeta.url`, recomputes checksum,
updates `meta.json`, and re-runs build.

Why:
The five-minute manual flow described in [design.md](./design.md)
"Yearly-refresh UX" is fine for the initial cadence. Authoring the
auto-download path now would over-build before the workflow's pain
points are visible (and many federal sources require browser-driven
download UX that's awkward to scriptify).

Trigger to revisit:
When the manual refresh becomes a regular friction point, or when
more than one source type's annual revision lands within a short
window and manual repetition is no longer acceptable.

Implementation pattern when triggered:
Add a `scripts/references/refresh.ts` dispatcher that takes a
`SourceId`, fetches `SourceMeta.url`, writes to the file at
`Source.path`, recomputes checksum + sizeBytes, rewrites meta.json,
then re-runs `build.ts`. Mirror the existing `scripts/references/*.ts`
shape; expose as `bun run references:refresh`.

References:

- [spec.md](./spec.md) "Out of scope" -> Downloading source files line
- [design.md](./design.md) "What is not built here" -> No auto-download
- [design.md](./design.md) "Yearly-refresh UX"

## Auto-download `refresh` command (design.md "What is not built here")

Status: Deferred

What was deferred:
This is the same scope item as "Automated source file downloading"
above but called out separately in `design.md` to be explicit that
even the architecture-doc-level mention is intentionally not built
yet. Kept as a distinct entry so a future agent doesn't have to
reconcile the two phrasings.

Why:
Same as above: manual refresh is acceptable today; auto-download
ships only when the manual flow is provably painful.

Trigger to revisit:
Same as above.

Implementation pattern when triggered:
Same as above.

References:

- [design.md](./design.md) "What is not built here" -> No auto-download

## Full-text search over verbatim text

Status: Rejected

What was rejected:
Search across the materialized verbatim text inside this WP.

Why:
Search lives in `wp-reference-system-core` and `wp-help-library`.
Extraction produces data; search consumes it. Splitting search across
multiple per-source WPs would force every parser WP to ship a search
adapter; the upstream WP that already owns the registry is the right
home.

References:

- [design.md](./design.md) "What is not built here" -> No full-text search

## Verbatim annotation layer

Status: Rejected

What was rejected:
A side-channel for editorial annotations ("note this applies only
to...") attached to the verbatim text alongside the reg's exact
language.

Why:
Verbatim is the reg's exact text; annotations belong in `paraphrase`,
not alongside `verbatim`. Mixing them breaks the source-of-truth
boundary that lets yearly-refresh diffs be meaningful (a paraphrase
edit shouldn't show up as a verbatim change, and vice versa).

References:

- [design.md](./design.md) "What is not built here" -> No verbatim annotation layer
