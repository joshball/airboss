---
title: 'Design: Reference AIM ingestion'
product: cross-cutting
feature: reference-aim-ingestion
type: design
status: unread
review_status: pending
---

# Design: Reference AIM ingestion

## The corpus lives in `libs/sources/src/aim/`

**Question:** Where does the AIM resolver + ingest code live? Same answer as Phase 6.

**Chosen:** Inside `@ab/sources`, under a new `aim/` subdirectory. Mirrors `libs/sources/src/handbooks/` from Phase 6.

**Why:**

- ADR 019 §2 names `@ab/sources` as the lib that owns the registry plus per-corpus resolvers. Splitting the contract is not an option.
- Each corpus in its own subdirectory keeps cross-corpus drift visible. The substrate (`registry/`) stays cross-corpus; corpora (`regs/`, `handbooks/`, `aim/`) stay narrow.
- Phase 6 proved the pattern for handbooks. Phase 7 follows it.

**Cost accepted:** Eight or so new files under `aim/`, each with a focused responsibility and its own test file.

## We consume an existing derivative tree -- we do not re-fetch

**Question:** Should Phase 7 fetch live AIM source documents, run an extraction pipeline, or just register existing derivatives?

**Chosen:** Register existing derivatives. The CLI walks the on-disk `aim/<edition>/manifest.json` + body files. Live source ingestion (PDF / HTML -> markdown) is a separate operator concern outside this WP.

**Why:**

- The TS resolver's job is "derivatives -> registry entries + render-time content". Source-document extraction is a separate concern (fetcher quality, vendor format drift, encoding edge cases) that doesn't belong in the registration path.
- Phase 6 made the same call -- it consumed PR #242's derivatives rather than re-running the Python pipeline. Phase 7 follows the same shape, with the AIM source-ingestion pipeline being a follow-up rather than a prerequisite.
- The fixture is hand-authored so tests exercise the full registry round-trip without depending on live extraction quality.

**Cost accepted:** No live AIM derivatives ship in this PR. The fixture proves the registration path; real-tree ingestion happens once the source pipeline lands and an operator runs it.

## Locator parser returns a richer shape with `aim` payload

**Question:** Phase 3 + 6 extended `ParsedLocator` with optional `regs` / `handbooks` payloads. Phase 7 needs the same for `aim`. Same approach?

**Chosen:** Yes. Extend the `ParsedLocator` discriminated union with an optional `aim` payload, parallel to `regs` and `handbooks`.

```typescript
export type ParsedLocator = {
  readonly kind: 'ok';
  readonly segments: readonly string[];
  readonly regs?: ParsedRegsLocator;
  readonly handbooks?: ParsedHandbooksLocator;
  readonly aim?: ParsedAimLocator;
};

export interface ParsedAimLocator {
  readonly chapter?: string;     // '5'
  readonly section?: string;     // '1'
  readonly paragraph?: string;   // '7'
  readonly glossarySlug?: string; // 'pilot-in-command'
  readonly appendix?: string;    // '1'
}
```

**Why:**

- Re-parsing on every resolver call is wasteful and brittle. Phase 3 + 6 made the same call.
- The discriminated union pattern accepts arbitrary corpus payloads. Phase 8 (`ac`) and Phase 10 (irregulars) will each add their own.
- The Phase 1-6 validator code reads only `kind: 'ok'` and `segments`. The new `aim` field is optional, so no existing test breaks.

**Cost accepted:** One change to `libs/sources/src/types.ts`. Phase 1-6 import paths unchanged.

## Locator path uses dashes between numerics, slashes between kinds

**Question:** ADR 019 §1.2 shows `aim/5-1-7` (dashes between chapter / section / paragraph) but `aim/glossary/pilot-in-command` (slash between the kind and the slug, dashes within the slug). How does the parser distinguish?

**Chosen:** The first segment after `aim/` decides the shape:

- `glossary` -> next segment is the kebab-slug (one segment).
- `appendix-<N>` -> single segment matching `appendix-` prefix.
- Anything else -> the dash-separated numeric form (chapter / chapter-section / chapter-section-paragraph).

**Why:**

- The ADR shape is what authors will type. The parser must accept it as written.
- Dashes inside the numeric form are how the AIM itself numbers its content (Chapter 5, Section 1, Paragraph 7 is rendered as "5-1-7" in FAA prose). Slashes for kinds keep the URL hierarchical.
- Single-pass parser; no ambiguity once the first segment is examined.

**Cost accepted:** A small dispatch table in the parser. The complexity is contained to one file.

## `manifest.json` is the single source of truth for derivative metadata

**Question:** Should Phase 7 read a manifest, or walk the file tree directly?

**Chosen:** Read the manifest. It enumerates every entry's kind + locator + title + body_path.

**Why:**

- The manifest is structured data. Walking the tree is unstructured (filename parsing). The operator's source-ingestion pipeline owns the extraction-to-manifest contract; Phase 7 is its consumer.
- The manifest's `source_url` + `fetched_at` are the only places that record provenance. Phase 7 needs both for `Edition.source_url` and `Edition.published_date`.

**Cost accepted:** None. Reading the manifest is two lines (`readFileSync` + `JSON.parse`).

## Atomic batch promotion uses `phase-7-aim-ingestion` reviewer

**Question:** Phase 3 used `phase-3-bulk-ingestion`; Phase 6 used `phase-6-handbook-ingestion`. What does Phase 7 use?

**Chosen:** `phase-7-aim-ingestion`. Per-edition: each `--edition=` run gets its own batch, so a re-ingest of one edition doesn't promote others.

**Why:**

- Per-phase reviewer IDs are the established convention.
- Per-edition batching is cleaner: re-running with `--edition=2026-09` only promotes that edition's entries.
- The batch's `inputSource` field records the manifest path for traceability.

**Cost accepted:** None. The `recordPromotion` API already supports per-batch scope.

## CLI exposed as `aim-corpus-ingest`

**Question:** Phase 6 named its CLI `handbook-corpus-ingest`. What does Phase 7's CLI name?

**Chosen:** `aim-corpus-ingest`. The "corpus" qualifier signals "register into the @ab/sources corpus" rather than "fetch + extract". Pairs with a future `aim-ingest` (operator's source-ingestion pipeline) the same way `handbook-ingest` pairs with `handbook-corpus-ingest`.

**Why:**

- The naming pattern is set by Phase 6.
- Authors and operators read the corpus-ingest commands as a uniform set; deviating would be a UX wart.

**Cost accepted:** None. The script is a one-liner dispatching to `runIngestCli`.

## Idempotence by registry overlay, not file hash

**Question:** What's idempotent on re-run?

**Chosen:** Lifecycle overlay. On re-run, walk the manifest, check each entry's lifecycle via `getEntryLifecycle`. Skip the entry if already `accepted`. Skip the batch promotion entirely if every entry in scope is already `accepted`.

**Why:**

- Without regeneration there's nothing to hash-compare. The only side effect is registry mutation.
- The lifecycle overlay (Phase 2) already provides the data. No new state needed.
- Re-running a no-op CLI is a common operator pattern (smoke-test the pipeline). The CLI prints "0 entries ingested, N already accepted" so the operator sees what happened.

**Cost accepted:** None. The lifecycle check is one function call per entry.

## Pin format is `?at=YYYY-MM`

**Question:** ADR 019 §1.3 lists three pin formats: `YYYY`, `YYYY-MM`, `YYYY-MM-DD`. Which does AIM use?

**Chosen:** `YYYY-MM`. AIM publishes change cycles roughly twice a year; year-month captures one revision cycle.

**Why:**

- `YYYY` would conflate two cycles per year and lose precision.
- `YYYY-MM-DD` would imply per-day granularity that doesn't match how the FAA publishes (cycles cover a span of dates, named by the publication month).
- `YYYY-MM` matches the ADR's example (`?at=2026-09`).

**Cost accepted:** None. The pin parser handles all three formats; the resolver just chooses one.
