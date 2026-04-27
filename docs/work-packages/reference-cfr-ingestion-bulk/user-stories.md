---
title: 'User stories: Reference CFR ingestion (bulk)'
product: cross-cutting
feature: reference-cfr-ingestion-bulk
type: user-stories
status: unread
review_status: pending
---

# User stories: Reference CFR ingestion (bulk)

## US-1 -- Lesson author cites a CFR section that resolves

**As** a lesson author
**I want** `[@cite](airboss-ref:regs/cfr-14/91/103?at=2026)` to validate cleanly
**So that** I can write regulation citations once, in canonical form, and have the validator confirm I named a real section at a real edition.

**Acceptance:**

- After Phase 3 ingestion runs, `bun run check` on a lesson containing the above link emits no ERRORs.
- The pin `2026` matches the most recent ingested edition; the corpus is enumerated; the entry is `accepted`.

## US-2 -- Author writes a paragraph-level reference and it parses

**As** a lesson author
**I want** `airboss-ref:regs/cfr-14/91/103/b/1?at=2026` to parse and resolve to §91.103
**So that** I can carry the paragraph hint in the URL even though the registry stores section-level entries (the renderer descends into the section text in Phase 4; the validator + resolver stop at the section level).

**Acceptance:**

- `parseLocator` returns the structured `regs` payload with `paragraph: ['b', '1']`.
- The validator does not ERROR on the paragraph form; it resolves to the section's entry.
- The resolver's `getDerivativeContent` returns the section's body markdown (paragraph-level descent is Phase 4's job; Phase 3 returns the full section text).

## US-3 -- Author cites a whole subpart

**As** a lesson author
**I want** `airboss-ref:regs/cfr-14/91/subpart-b?at=2026` to resolve to a real subpart entry
**So that** lessons that introduce "Subpart B - Flight Rules" as a category work without falling back to prose.

**Acceptance:**

- The registry contains a `SourceEntry` with `id: 'airboss-ref:regs/cfr-14/91/subpart-b'`, `canonical_short: 'Subpart B'`, `canonical_formal: '14 CFR Part 91, Subpart B'`, `canonical_title: 'Flight Rules'`.
- `getLiveUrl` produces an eCFR URL ending at `subpart-B`.

## US-4 -- Operator runs the ingestion pipeline once

**As** an operator (Joshua, or any future maintainer)
**I want** one command that fetches the eCFR XML, walks it, writes derivatives, and promotes entries to `accepted`
**So that** ingesting an edition is a single operation, not a multi-step ceremony.

**Acceptance:**

- `bun run cfr-ingest --edition=2026-01-01` (with network) or `--fixture=<path>` (without network) runs end-to-end.
- The pipeline reports per-step progress and a summary.
- Re-running with the same edition is a no-op.

## US-5 -- Operator re-runs the ingestion safely

**As** an operator
**I want** re-running ingestion on the same edition to be a no-op
**So that** I don't fear "did I corrupt something" after an interrupted run, and CI can run fixture-driven ingestion unconditionally.

**Acceptance:**

- Second consecutive `runIngest` call against the same edition reports 0 entries written, 0 files modified, no new promotion batch.
- Hash-compare on per-section bodies skips writes when content is unchanged.

## US-6 -- Author resolves a stale pin

**As** a lesson author with a `?at=2024` pin and the registry now at `?at=2026`
**I want** the validator to emit a WARNING (per ADR 019 §1.5 row 6) until I rerun `--fix` or the diff job advances me
**So that** stale pins don't silently slip through; the workflow is "fix locally, commit, merge."

**Acceptance:**

- With Phase 3 ingestion having run for `2026`, an existing `?at=2024` reference produces a WARNING from the validator (Phase 5 is what mechanically advances; Phase 3 just makes the warning meaningful by populating the registry's edition history).
- WARNING is non-blocking; the lesson still merges.

## US-7 -- Phase 4 (renderer) consumes structured content

**As** the Phase 4 renderer
**I want** `getIndexedContent(id, edition)` to return the section's normalized text + its body path
**So that** I can substitute `@text` / `@quote` tokens against real section content without re-parsing the eCFR XML at render time.

**Acceptance:**

- `IndexedContent` payload includes `id`, `edition`, `normalizedText` (full section body), `body_sha256`.
- Looking up an unknown section returns null cleanly.

## US-8 -- Phase 5 (annual diff) compares editions

**As** Phase 5's annual diff job
**I want** every edition's section bodies to be hash-comparable and reachable via `getEditions(id)`
**So that** I can mechanically advance lessons whose sections didn't change and surface only sections that did.

**Acceptance:**

- `getEditions(id)` returns the chronological edition history.
- Per-section `body_sha256` is recorded in `sections.json` and re-derivable from the markdown file.
- The cache + manifest pattern lets the diff job re-fetch a past edition's source XML when needed (cache miss is recoverable while the eCFR Versioner serves historical dates).

## US-9 -- Operator audits a promotion batch

**As** an operator
**I want** every batch promotion to be recorded with `corpus`, `reviewerId`, `promotionDate`, `scope` (entry ids), `inputSource` (the edition slug or fixture path)
**So that** I can audit what was promoted, when, by whom, and roll back via `recordDePromotion` if I disagree with a Phase-3 placeholder promotion.

**Acceptance:**

- `listBatches()` returns Phase 3's batches with the documented `reviewerId: 'phase-3-bulk-ingestion'`.
- The PR body documents the placeholder so the operator knows to re-promote (or de-promote) under his own reviewer ID later.

## US-10 -- Author cites a 49 CFR rule

**As** a lesson author writing about NTSB notification requirements
**I want** `airboss-ref:regs/cfr-49/830/5?at=2026` to resolve
**So that** 49 CFR Part 830 + 49 CFR Part 1552 are first-class citations, not corpus-mismatched fallbacks.

**Acceptance:**

- The registry contains entries for every section in 49 CFR Part 830 and 49 CFR Part 1552 (and the Parts themselves, plus their subparts).
- `parseLocator` accepts the `cfr-49/...` path under the same rules as `cfr-14`.
- `getLiveUrl` produces an eCFR URL under `title-49`.
