---
title: 'Tasks: Reference AIM ingestion'
product: cross-cutting
feature: reference-aim-ingestion
type: tasks
status: unread
review_status: pending
---

# Tasks: Reference AIM ingestion

## Pre-flight

- [ ] Read [ADR 019 §1.2 AIM](../../decisions/019-reference-identifier-system/decision.md) and §2.4 (atomic batch).
- [ ] Read [ADR 018](../../decisions/018-source-artifact-storage-policy/decision.md). AIM source PDFs cached out-of-repo; derivatives in `aim/<edition>/`.
- [ ] Skim `libs/sources/src/handbooks/` -- the closer structural template Phase 7 mirrors (Phase 6 chose this template; Phase 7 follows it).

## Phase 1 - Type extension

- [ ] Extend `libs/sources/src/types.ts` `ParsedLocator` with optional `aim: ParsedAimLocator` field, plus the new interface (per design.md). The added field is optional; no Phase 1-6 import or test breaks.
- [ ] `bun run check` passes.

## Phase 2 - Locator parser

- [ ] Create `libs/sources/src/aim/locator.ts`:
    - `parseAimLocator(locator: string): ParsedLocator | LocatorError` -- accepts every shape from spec.md §Data Model, returns the `aim` payload.
    - Validates: `<chapter>` is digits 1-99; `<section>` is digits 1-99 (when present); `<paragraph>` is digits 1-999 (when present); `glossary/<slug>` is `glossary/` followed by a kebab-case lowercase slug; `appendix-<N>` is `appendix-` followed by digits 1-99.
    - Rejection messages cite the offending segment.
- [ ] Create `libs/sources/src/aim/locator.test.ts`:
    - Accepts: chapter, section, paragraph, glossary entry, appendix.
    - Rejects: empty locator, malformed chapter / section / paragraph, malformed glossary slug, malformed appendix, extra trailing segments.

## Phase 3 - Citation + URL

- [ ] Create `libs/sources/src/aim/citation.ts`:
    - `formatAimCitation(entry, style)` -- returns `entry.canonical_short`, `entry.canonical_formal`, or `entry.canonical_title` per `style`.
- [ ] Create `libs/sources/src/aim/citation.test.ts`:
    - All three styles for paragraph, section, chapter, glossary entry, appendix.
- [ ] Create `libs/sources/src/aim/url.ts`:
    - `getAimLiveUrl(id, edition)` -- builds the FAA URL.
    - Returns `https://www.faa.gov/air_traffic/publications/atpubs/` (FAA does not deep-link individual paragraphs).
- [ ] Create `libs/sources/src/aim/url.test.ts`:
    - URL for paragraph, chapter, glossary, appendix; null for malformed SourceId; pin stripping.

## Phase 4 - Derivative reader

- [ ] Create `libs/sources/src/aim/derivative-reader.ts`:
    - `readManifest(edition, root): ManifestFile` -- reads `<root>/<edition>/manifest.json` and returns the typed object.
    - `manifestEntryForLocator(manifest, parsed): ManifestEntry | null` -- finds the entry record matching the parsed locator.
    - `bodyPathForEntry(entry, root): string` -- repo-relative path of the entry's markdown body.
- [ ] Create `libs/sources/src/aim/derivative-reader.test.ts`:
    - Reads a fixture manifest, finds an entry by parsed locator, returns the body path.

## Phase 5 - Resolver

- [ ] Create `libs/sources/src/aim/resolver.ts`:
    - `AIM_RESOLVER: CorpusResolver` -- implements every method.
    - `parseLocator(locator)` delegates to `parseAimLocator`.
    - `formatCitation(entry, style)` delegates to `formatAimCitation`.
    - `getCurrentEdition()` returns the most recent edition slug across all `aim` entries (lexically max year-month slug).
    - `getEditions(id)` reads from the editions map.
    - `getLiveUrl(id, edition)` delegates to `getAimLiveUrl`.
    - `getDerivativeContent(id, edition)` reads the entry markdown.
    - `getIndexedContent(id, edition)` reads structured content from the manifest plus body markdown.
    - Test override: `setAimDerivativeRoot(root)` for tests; production reads from `<cwd>/aim`.
- [ ] Create `libs/sources/src/aim/resolver.test.ts`:
    - All resolver methods exercised against a fixture manifest + body files.
    - `getCurrentEdition()` returns the right slug when multiple editions are populated.

## Phase 6 - Ingest CLI

- [ ] Create `libs/sources/src/aim/ingest.ts`:
    - `runAimIngest({ edition, derivativeRoot }): IngestReport` -- walks the manifest, builds `SourceEntry` per entry, populates `__sources_internal__` + `__editions_internal__`, records atomic batch promotion to `accepted` under reviewer `phase-7-aim-ingestion`.
    - Idempotent: skip entries already in registry as `accepted`; skip promotion if scope is empty.
    - `parseCliArgs(argv)` + `runIngestCli(argv)` -- command-line surface.
- [ ] Create `libs/sources/src/aim/ingest.test.ts`:
    - Fixture-driven ingest produces the expected SourceEntries + edition.
    - Re-running is a no-op (0 ingested, all already accepted).
    - Atomic batch failure surfaces as an error.
- [ ] Create `scripts/aim-corpus-ingest.ts` -- thin dispatcher delegating to `runIngestCli`.
- [ ] Wire `package.json` `"aim-corpus-ingest"` script.

## Phase 7 - Side-effect registration + smoke test

- [ ] Create `libs/sources/src/aim/index.ts`:
    - Side-effect: `registerCorpusResolver(AIM_RESOLVER)`.
    - Re-exports the public surface (`parseAimLocator`, `formatAimCitation`, `getAimLiveUrl`, `runAimIngest`, etc.).
- [ ] Add `import './aim/index.ts';` to `libs/sources/src/index.ts` (after the `handbooks` import).
- [ ] Create `libs/sources/src/aim/smoke.test.ts`:
    - Ingests fixture manifest, then validates a temp lesson containing `[@cite](airboss-ref:aim/5-1-7?at=2026-09)`. Expects zero ERRORs.
- [ ] `bun run check` passes; `bun test libs/sources/` passes.

## Phase 8 - Rollout doc

- [ ] Update `docs/work/plans/adr-019-rollout.md` Phase 6 row to ✅ (PR #251 already shipped) and Phase 7 row to ✅ with this PR's link.
- [ ] `bun run check` passes; `bun test libs/sources/` passes.

## Phase 9 - PR

- [ ] Push branch.
- [ ] Open PR: `feat(sources): ADR 019 phase 7 -- AIM corpus`.
- [ ] PR body links: ADR 019 §1.2 AIM, prior phase PRs (#241, #246, #247, #249, #250, #251), this WP.
- [ ] Note pre-existing failures (if any) explicitly in the PR body.
