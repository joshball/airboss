---
title: 'Tasks: Reference handbook ingestion'
product: cross-cutting
feature: reference-handbook-ingestion
type: tasks
status: unread
review_status: pending
---

# Tasks: Reference handbook ingestion

## Pre-flight

- [ ] Read [ADR 019 §1.2 Handbooks](../../decisions/019-reference-identifier-system/decision.md) and §2.4 (atomic batch).
- [ ] Read [ADR 018](../../decisions/018-source-artifact-storage-policy/decision.md). Source PDFs cached out-of-repo; derivatives in `handbooks/`.
- [ ] Skim `libs/sources/src/regs/` -- the structural template Phase 6 mirrors.
- [ ] Skim `handbooks/phak/FAA-H-8083-25C/manifest.json` -- the per-handbook manifest schema.

## Phase 1 - Type extension

- [ ] Extend `libs/sources/src/types.ts` `ParsedLocator` with optional `handbooks: ParsedHandbooksLocator` field, plus the new interface (per design.md). The added field is optional; no Phase 1-5 import or test breaks.
- [ ] `bun run check` passes.
- [ ] Commit: `feat(sources): phase-6 ParsedLocator handbooks payload`.

## Phase 2 - Locator parser

- [ ] Create `libs/sources/src/handbooks/locator.ts`:
    - `parseHandbooksLocator(locator: string): ParsedLocator | LocatorError` -- accepts every shape from spec.md §Data Model, returns the `handbooks` payload.
    - Validates: `<doc>` is one of `phak`, `afh`, `avwx`; `<edition>` matches `8083-<digits><letter>`; `<chapter>` is digits; `<section>` is digits or `intro`; `<subsection>` is digits; `<paragraph>` matches `para-<digits>`; figure matches `fig-<digits>-<digits>`; table matches `tbl-<digits>-<digits>`.
    - Rejection messages cite the offending segment.
- [ ] Create `libs/sources/src/handbooks/locator.test.ts`:
    - Accepts: chapter, section, subsection, paragraph, intro, figure, table -- all under each of `phak`, `afh`, `avwx`.
    - Rejects: empty doc, unknown doc, malformed edition, non-digit chapter, malformed section, malformed paragraph, malformed figure / table.
    - Asserts the `handbooks` payload structure for each accepted shape.
- [ ] `bun run check` passes; `bun test libs/sources/` passes.
- [ ] Commit: `feat(sources): phase-6 handbooks locator parser`.

## Phase 3 - Citation + URL

- [ ] Create `libs/sources/src/handbooks/citation.ts`:
    - `formatHandbooksCitation(entry, style)` -- returns `entry.canonical_short`, `entry.canonical_formal`, or `entry.canonical_title` per `style`.
- [ ] Create `libs/sources/src/handbooks/citation.test.ts`:
    - All three styles for a section, a chapter, and an intro entry.
- [ ] Create `libs/sources/src/handbooks/url.ts`:
    - `getHandbooksLiveUrl(id, edition)` -- builds the FAA URL.
    - Returns `https://www.faa.gov/regulations_policies/handbooks_manuals/aviation/<doc>/` (FAA does not deep-link individual chapters).
    - Per-doc landing pages live in a `DOC_LIVE_URLS` constant (mirrors `DOC_EDITIONS`).
- [ ] Create `libs/sources/src/handbooks/url.test.ts`:
    - Section, chapter, intro URLs for each doc.
- [ ] `bun run check` passes; `bun test libs/sources/` passes.
- [ ] Commit: `feat(sources): phase-6 handbooks citation + live URL helpers`.

## Phase 4 - Derivative reader

- [ ] Create `libs/sources/src/handbooks/derivative-reader.ts`:
    - `readManifest(doc, edition, root): ManifestFile` -- reads the on-disk `<root>/<doc>/<faa-dir>/manifest.json` and returns the typed object (sections list + metadata).
    - `derivativePathFor(id, edition, root): string | null` -- maps a handbook SourceId to the on-disk markdown body path (via the manifest's `body_path`).
    - `manifestSectionForId(manifest, parsed): ManifestSection | null` -- finds the section record matching the parsed locator (chapter / section / subsection -> dotted code).
- [ ] Create `libs/sources/src/handbooks/derivative-reader.test.ts`:
    - Reads a fixture manifest, finds a section by parsed locator, returns the body path.
    - Returns null for paragraph / figure / table identifiers (they don't have manifest entries).
- [ ] `bun run check` passes; `bun test libs/sources/` passes.
- [ ] Commit: `feat(sources): phase-6 handbooks derivative reader`.

## Phase 5 - Resolver

- [ ] Create `libs/sources/src/handbooks/resolver.ts`:
    - `HANDBOOKS_RESOLVER: CorpusResolver` -- implements every method.
    - `parseLocator(locator)` delegates to `parseHandbooksLocator`.
    - `formatCitation(entry, style)` delegates to `formatHandbooksCitation`.
    - `getCurrentEdition()` returns the most recent edition slug across all `handbooks` entries (lexically max edition slug, since they end with letters in publication order).
    - `getEditions(id)` reads from the editions map.
    - `getLiveUrl(id, edition)` delegates to `getHandbooksLiveUrl`.
    - `getDerivativeContent(id, edition)` reads the section markdown.
    - `getIndexedContent(id, edition)` reads structured content from the manifest plus body markdown.
    - Test override: `setHandbooksDerivativeRoot(root)` for tests; production reads from `<cwd>/handbooks`.
- [ ] Create `libs/sources/src/handbooks/resolver.test.ts`:
    - All resolver methods exercised against a fixture manifest + body files.
    - `getCurrentEdition()` returns the right slug when multiple editions are populated.
- [ ] `bun run check` passes; `bun test libs/sources/` passes.
- [ ] Commit: `feat(sources): phase-6 handbooks resolver`.

## Phase 6 - Ingest CLI

- [ ] Create `libs/sources/src/handbooks/ingest.ts`:
    - `runHandbookIngest({ doc, edition, derivativeRoot, manifestPathOverride? }): IngestReport` -- walks the manifest, builds `SourceEntry` per chapter / section / subsection, populates `__sources_internal__` + `__editions_internal__`, records atomic batch promotion to `accepted` under reviewer `phase-6-handbook-ingestion`.
    - Idempotent: skip entries already in registry as `accepted`; skip promotion if scope is empty.
    - `parseCliArgs(argv)` + `runIngestCli(argv)` -- command-line surface.
- [ ] Create `libs/sources/src/handbooks/ingest.test.ts`:
    - Fixture-driven ingest produces the expected SourceEntries + edition.
    - Re-running is a no-op (0 ingested, all already accepted).
    - Atomic batch failure surfaces as an error.
- [ ] Create `scripts/handbook-corpus-ingest.ts` -- thin dispatcher delegating to `runIngestCli`.
- [ ] Wire `package.json` `"handbook-corpus-ingest"` script.
- [ ] `bun run check` passes; `bun test libs/sources/` passes.
- [ ] Commit: `feat(sources): phase-6 handbooks ingest CLI`.

## Phase 7 - Side-effect registration + smoke test

- [ ] Create `libs/sources/src/handbooks/index.ts`:
    - Side-effect: `registerCorpusResolver(HANDBOOKS_RESOLVER)`.
    - Re-exports the public surface (`parseHandbooksLocator`, `formatHandbooksCitation`, `getHandbooksLiveUrl`, `runHandbookIngest`, etc.).
- [ ] Add `import './handbooks/index.ts';` to `libs/sources/src/index.ts` (after the `regs` import).
- [ ] Create `libs/sources/src/handbooks/smoke.test.ts`:
    - Ingests fixture manifest, then validates a temp lesson containing `[@cite](airboss-ref:handbooks/phak/8083-25C/12/3)`. Expects zero ERRORs.
- [ ] `bun run check` passes; `bun test libs/sources/` passes.
- [ ] Commit: `feat(sources): phase-6 handbooks corpus registration + smoke test`.

## Phase 8 - Real-tree ingestion + rollout doc

- [ ] Run `bun run ingest handbooks --doc=phak --edition=8083-25C` against the on-disk derivatives. Verify exit 0 and the report shows expected entry count.
- [ ] Same for `afh/8083-3C` and `avwx/8083-28B`.
- [ ] Update `docs/work/plans/adr-019-rollout.md` Phase 6 row to ✅ with PR link.
- [ ] `bun run check` passes; `bun test libs/sources/` passes.
- [ ] Commit: `docs(adr-019): mark phase 6 shipped`.

## Phase 9 - PR

- [ ] Push branch.
- [ ] Open PR: `feat(sources): ADR 019 phase 6 -- handbook corpus`.
- [ ] PR body links: ADR 019 §1.2 handbooks, ADR 016 phase 0 PR #242, prior phase PRs (#241, #246, #247, #249, #250), this WP.
- [ ] Note pre-existing failures (if any) explicitly in the PR body.
