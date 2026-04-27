---
title: 'Tasks: Reference CFR ingestion (bulk)'
product: cross-cutting
feature: reference-cfr-ingestion-bulk
type: tasks
status: unread
review_status: pending
---

# Tasks: Reference CFR ingestion (bulk)

## Pre-flight

- [ ] Read [ADR 019](../../decisions/019-reference-identifier-system/decision.md) end-to-end. Pay special attention to §1.1.1, §1.2 ("Regulations"), §1.3 (edition pinning), §1.5.1 (edge cases including reserved + newly-created sections), §2.1 (`SourceEntry`), §2.2 (`CorpusResolver`), §2.4 (lifecycle + atomic batch), §2.5 (indexed tier + JSON snapshot pattern), §6.1 (alias kinds).
- [ ] Read [ADR 018](../../decisions/018-source-artifact-storage-policy/decision.md) and [STORAGE.md](../../platform/STORAGE.md). The cache pattern is mandatory.
- [ ] Read this WP's [spec.md](spec.md) and [design.md](design.md).
- [ ] Read [reference-source-registry-core/](../reference-source-registry-core/) (Phase 2) -- the registry your work plugs into.
- [ ] Skim `libs/sources/src/registry/` -- in particular `corpus-resolver.ts` (registration map + default no-ops), `sources.ts` (entry table), `editions.ts` (edition map), `lifecycle.ts` (atomic batch promotion), `__test_helpers__.ts`.
- [ ] Skim `libs/sources/src/types.ts` -- `ParsedLocator`, `SourceEntry`, `Edition`, `IndexedContent`. The `regs` payload extends `ParsedLocator`.
- [ ] Skim `scripts/airboss-ref.ts` and `scripts/handbook-ingest.ts` for the CLI dispatcher pattern.

## Phase 1 - Type extension + dependency add

- [ ] Extend `libs/sources/src/types.ts` `ParsedLocator` discriminated union with the optional `regs` payload (per design.md). The added branch is structurally compatible with the Phase 2 branch; no Phase 2 import or test breaks.
- [ ] Add `fast-xml-parser` to `libs/sources/package.json` dependencies.
- [ ] `bun install`.
- [ ] `bun run check` passes.
- [ ] Commit: `feat(sources): phase-3 ParsedLocator regs payload + fast-xml-parser`.

## Phase 2 - Locator parser

- [ ] Create `libs/sources/src/regs/locator.ts`:
    - `parseRegsLocator(locator: string): ParsedLocator | LocatorError` -- accepts every shape from spec.md §Data Model, returns the `regs` payload.
    - Validates: `cfr-14` or `cfr-49`; part is digits; subpart matches `subpart-[a-z]+`; section matches `<part>.<digits>` or just `<digits>` after the part slug; paragraph segments are lowercase letters / digits / Roman.
    - Rejection messages cite the offending segment.
- [ ] Create `libs/sources/src/regs/locator.test.ts`:
    - Accepts: section, paragraph, multi-level paragraph, subpart, whole-Part, all under `cfr-14` and `cfr-49`.
    - Rejects: empty title, non-digit part, malformed subpart, malformed section, paragraph segments containing illegal chars.
    - Asserts the `regs` payload structure for each accepted shape.
- [ ] `bun run check` passes; `bun test libs/sources/` passes.
- [ ] Commit: `feat(sources): phase-3 regs locator parser`.

## Phase 3 - Citation + URL

- [ ] Create `libs/sources/src/regs/citation.ts`:
    - `formatRegsCitation(entry, style)` -- returns `entry.canonical_short`, `entry.canonical_formal`, or `entry.canonical_title` per `style`.
    - Defensive: throws on unknown style.
- [ ] Create `libs/sources/src/regs/citation.test.ts`:
    - All three styles for a section, a subpart, a Part-level entry.
- [ ] Create `libs/sources/src/regs/url.ts`:
    - `getRegsLiveUrl(id, edition)` -- builds eCFR URL.
    - Current edition: `https://www.ecfr.gov/current/title-<title>/...`.
    - Past edition: `https://www.ecfr.gov/on/<YYYY-MM-DD>/title-<title>/...`.
    - Section URLs end at `section-<section>`. Subpart URLs end at `subpart-<letter>`. Part URLs end at `part-<part>`. The current/past distinction is determined by comparing the edition slug (calendar year) to the resolver's `getCurrentEdition()`.
- [ ] Create `libs/sources/src/regs/url.test.ts`:
    - Section, subpart, Part-level URLs for current edition.
    - Same shapes for a past edition (gets `/on/<date>/` prefix).
- [ ] `bun run check` passes; `bun test libs/sources/` passes.
- [ ] Commit: `feat(sources): phase-3 regs citation + live URL helpers`.

## Phase 4 - XML walker

- [ ] Create `libs/sources/src/regs/xml-walker.ts`:
    - Wraps `fast-xml-parser` with options `{ ignoreAttributes: false, attributeNamePrefix: '@_', parseTagValue: false, alwaysCreateTextNode: true, preserveOrder: true }`.
    - `walkRegsXml(xmlSource: string, opts: { titleHint: '14' | '49' }): RawCfrRoot` -- returns a typed object: `RawTitle -> RawPart[] -> RawSubpart[] -> RawSection[]` (and Section text bodies as a string).
    - Recursion respects `TYPE` attribute on `DIVx` elements rather than depth.
    - Extracts `<HEAD>`, `<P>`, `<CITA>` text. Concatenates `<P>` content into a single newline-separated body string per section.
    - Extracts `last_amended_date` from `<CITA>` via the regex documented in design.md; falls back to the publication date passed by the caller.
- [ ] Create `libs/sources/src/regs/xml-walker.test.ts`:
    - Against `tests/fixtures/cfr/title-14-2026-fixture.xml`, asserts: 2 Parts, expected subparts per Part, expected section count per subpart.
    - Section text concatenation is correct (newlines between paragraphs).
    - `last_amended_date` extracted correctly when `<CITA>` contains a date; falls back to publication date when missing.
    - Reserved sections produce a section entry with `canonical_title: '[Reserved]'` (raw shape; normalizer applies the constant).
- [ ] `bun run check` passes; `bun test libs/sources/` passes.
- [ ] Commit: `feat(sources): phase-3 regs eCFR XML walker`.

## Phase 5 - Normalizer

- [ ] Create `libs/sources/src/regs/normalizer.ts`:
    - `normalizeRawSection(raw: RawSection, opts): { entry: SourceEntry; bodyMarkdown: string }` -- builds the `SourceEntry` and the section's body markdown. Strips whitespace, normalizes line endings to LF, applies Unicode NFC, collapses runs of blank lines.
    - `normalizeRawSubpart(raw, opts)`, `normalizeRawPart(raw, opts)` -- same idea for subpart + Part entries.
    - All produce `lifecycle: 'pending'`. Body markdown for non-section entries is a short title-only stub (the renderer treats subpart/Part entries as overview pages).
    - `last_amended_date` defaults to the edition's `published_date` when raw doesn't carry one.
- [ ] Create `libs/sources/src/regs/normalizer.test.ts`:
    - NFC normalization (input has NFD; output is NFC).
    - Blank-line collapse.
    - `canonical_short`, `canonical_formal`, `canonical_title` for section, subpart, Part.
    - `last_amended_date` from raw vs fallback.
    - Reserved-section: `canonical_title: '[Reserved]'`.
- [ ] `bun run check` passes; `bun test libs/sources/` passes.
- [ ] Commit: `feat(sources): phase-3 regs normalizer`.

## Phase 6 - Cache + manifest

- [ ] Create `libs/sources/src/regs/cache.ts`:
    - `resolveCacheRoot(): string` -- reads `process.env.AIRBOSS_HANDBOOK_CACHE` or defaults to `path.join(homedir(), 'Documents/airboss-handbook-cache')`. Creates the directory tree on demand.
    - `cacheXmlPath(title, editionDate): string` -- builds `<cacheRoot>/regulations/cfr-<title>/<editionDate>/source.xml`.
    - `fetchEcfrXml(title, editionDate, opts): Promise<{ xml: string; sourceUrl: string; sourceSha256: string }>` -- if the cache file exists, read it; otherwise fetch from the eCFR Versioner endpoint, write to cache, compute SHA-256, return.
    - `loadFixtureXml(fixturePath): { xml: string; sourceUrl: string; sourceSha256: string }` -- reads a fixture from disk; `sourceUrl` is `file://<absolute-path>`.
- [ ] Create `libs/sources/src/regs/cache.test.ts`:
    - `resolveCacheRoot` honors env var.
    - `cacheXmlPath` builds the right shape.
    - `loadFixtureXml` reads + hashes a known fixture.
    - (Network fetch covered indirectly by the integration test against fixture mode; the live network path is documented but not exercised in CI.)
- [ ] `bun run check` passes; `bun test libs/sources/` passes.
- [ ] Commit: `feat(sources): phase-3 regs cache + eCFR fetch`.

## Phase 7 - Derivative writer

- [ ] Create `libs/sources/src/regs/derivative-writer.ts`:
    - `writeDerivativeTree({ entries, bodies, title, editionDate, manifest, indexedSections, outRoot }): WriteReport` -- writes per-section `<part>/<section>.md` plus `<section>.meta.json`, subpart overview `<part>/subpart-<letter>.md`, Part overview `<part>/index.md` (per design.md: title-only stub bodies for non-section entries), per-edition `manifest.json`, per-edition `sections.json`. Hash-compares each file; skips writes when hashes match. Returns a report of files written + files unchanged.
    - Computes SHA-256 per file body. The `body_sha256` recorded in `sections.json` matches the SHA of the file's contents (LF-only, NFC).
- [ ] Create `libs/sources/src/regs/derivative-writer.test.ts`:
    - First write: every file is created.
    - Second write with identical input: zero files modified.
    - Third write after one body changes: exactly that one file is rewritten plus `sections.json` (the index changed).
    - `sections.json` shape matches spec.
    - `manifest.json` records `source_url`, `source_sha256`, `fetched_at`, `edition_slug`, `section_count`, `subpart_count`, `part_count`.
- [ ] `bun run check` passes; `bun test libs/sources/` passes.
- [ ] Commit: `feat(sources): phase-3 regs derivative writer`.

## Phase 8 - Resolver

- [ ] Create `libs/sources/src/regs/resolver.ts`:
    - `REGS_RESOLVER: CorpusResolver` -- composes the parser/citation/url helpers + reads from the registry's `EDITIONS` map and the on-disk derivative tree.
    - `parseLocator` -> `parseRegsLocator`.
    - `formatCitation` -> `formatRegsCitation`.
    - `getCurrentEdition()` -> walks `EDITIONS` for any `regs`-corpus entry and returns the most recent edition slug; returns null when no entries are loaded.
    - `getEditions(id)` -> reads `EDITIONS.get(stripPin(id))`.
    - `getLiveUrl(id, edition)` -> `getRegsLiveUrl`.
    - `getDerivativeContent(id, edition)` -> reads the per-section markdown via `body_path` from `sections.json` for the edition. Returns null if file missing.
    - `getIndexedContent(id, edition)` -> reads `sections.json` for the edition; returns the matching section's `IndexedContent`.
- [ ] Create `libs/sources/src/regs/resolver.test.ts`:
    - With test entries + editions primed via `withTestEntries` + `withTestEditions`: every method returns the expected shape.
    - `getCurrentEdition` returns the most recent year.
    - `getLiveUrl` shapes match.
    - `getDerivativeContent` reads from a temp directory.
    - `getIndexedContent` returns the matching section's record.
- [ ] `bun run check` passes; `bun test libs/sources/` passes.
- [ ] Commit: `feat(sources): phase-3 regs CorpusResolver implementation`.

## Phase 9 - Ingest orchestration

- [ ] Create `libs/sources/src/regs/ingest.ts`:
    - `interface IngestArgs { editionDate: string; fixturePath?: string; outRoot?: string }`.
    - `interface IngestReport { entriesWritten: number; entriesUnchanged: number; promotionBatchId: string | null; manifestPath: string }`.
    - `runIngest(args: IngestArgs): Promise<IngestReport>` -- the orchestration. Steps:
        1. Resolve cache or load fixture (`cache.ts`).
        2. Walk XML for each requested Part set (Title 14 = whole Title; Title 49 = filtered to Parts 830 + 1552). The XML walker emits raw structures.
        3. Normalize raw structures into `SourceEntry` + body markdown (`normalizer.ts`).
        4. Insert entries into `SOURCES` (via `__sources_internal__.setActiveTable` -- ingestion mutates the active table directly per Phase 2 contract). Insert editions into `EDITIONS` map.
        5. Write derivatives via `derivative-writer.ts`.
        6. Call `recordPromotion({ corpus: 'regs', reviewerId: PHASE_3_REVIEWER_ID, scope, inputSource, targetLifecycle: 'pending' })`. If the entries are already `pending`, this fails atomically (the state machine doesn't allow `pending -> pending`); the orchestration handles the already-promoted case before calling.
        7. Atomic batch promotion: `recordPromotion` again with `targetLifecycle: 'accepted'`.
        8. Returns the report.
    - `runIngestCli(args: readonly string[]): Promise<number>` -- parses argv, refuses CI without fixture, invokes `runIngest`, prints report, returns exit code.
    - `PHASE_3_REVIEWER_ID = 'phase-3-bulk-ingestion'` exported as a constant.
- [ ] Create `libs/sources/src/regs/ingest.test.ts`:
    - Run `runIngest` against the Title 14 fixture in a temp `outRoot`.
    - Asserts: SOURCES contains the expected entries; EDITIONS map populated; batch promotion recorded with `lifecycle: 'accepted'`; derivative tree exists; manifest.json + sections.json present.
- [ ] Create `libs/sources/src/regs/idempotence.test.ts`:
    - Run `runIngest` twice; second run reports 0 new entries, 0 files modified, no new promotion batch.
- [ ] `bun run check` passes; `bun test libs/sources/` passes.
- [ ] Commit: `feat(sources): phase-3 regs ingest orchestration + idempotence`.

## Phase 10 - Resolver registration

- [ ] Create `libs/sources/src/regs/index.ts`:
    - Exports `REGS_RESOLVER`, `runIngest`, `runIngestCli`, `PHASE_3_REVIEWER_ID`, `parseRegsLocator`.
    - Side-effect: `registerCorpusResolver(REGS_RESOLVER)`.
- [ ] Update `libs/sources/src/index.ts` to import `./regs/index.ts` for the side-effect registration. Re-export `REGS_RESOLVER` (so consumers can reference it explicitly, e.g. tests) but the validator path doesn't need to know.
- [ ] Update tests that depend on the default no-op `regs` resolver: `corpus-resolver.test.ts` keeps the default-resolver assertion via the `__corpus_resolver_internal__.resetToDefaults()` helper. Phase 3 tests that need the real resolver call the `@ab/sources/regs` entry directly.
- [ ] `bun run check` passes; `bun test libs/sources/` passes.
- [ ] Commit: `feat(sources): phase-3 regs resolver registration`.

## Phase 11 - Validator smoke

- [ ] Create `libs/sources/src/regs/smoke.test.ts`:
    - Set up: prime the registry with the fixture's entries via `runIngest`. Write a temp lesson file containing `[@cite](airboss-ref:regs/cfr-14/91/103?at=2026)`.
    - Run `validateReferences({ contentPaths: [tempLessonDir] })` against the production registry.
    - Assert: zero ERROR-tier findings; the entry resolves; the edition is current.
    - Tear down: restore registry state.
- [ ] `bun run check` passes; `bun test libs/sources/` passes.
- [ ] Commit: `feat(sources): phase-3 regs validator smoke (publish gate green)`.

## Phase 12 - Fixture + repo plumbing

- [ ] Fetch a small slice of Title 14 from the live eCFR (Parts 61 + 91, two-three sections each with subpart + Part-level data). Trim by hand to the minimum that exercises the walker.
- [ ] Write the trimmed XML to `tests/fixtures/cfr/title-14-2026-fixture.xml`. Document its provenance in `tests/fixtures/cfr/README.md` (source date, what was kept, what was stripped).
- [ ] Add `regulations/.gitkeep` (placeholder so the derivative tree exists).
- [ ] Add `.gitignore` line: `regulations/cfr-*/**/*.xml` (block any accidental staging of cached XML).
- [ ] Add `.gitattributes` line: `regulations/cfr-*/**/*.xml filter=lfs diff=lfs merge=lfs -text` (dormant LFS plumbing per ADR 018).
- [ ] `bun run check` passes; `bun test libs/sources/` passes (the fixture-driven tests now have their fixture).
- [ ] Commit: `feat(sources): phase-3 CFR fixture + repo plumbing for derivative tree`.

## Phase 13 - CLI dispatcher

- [ ] Create `scripts/cfr-ingest.ts`:
    - Parses argv: `--edition=`, `--fixture=`, `--out=`, `--help`.
    - Imports `runIngestCli` from `@ab/sources/regs`.
    - Refuses to run in CI without `--fixture=` (per spec).
    - Returns the CLI exit code.
- [ ] Add to root `package.json` scripts: `"cfr-ingest": "bun scripts/cfr-ingest.ts"`.
- [ ] Smoke: `bun run cfr-ingest --fixture=tests/fixtures/cfr/title-14-2026-fixture.xml --out=/tmp/cfr-smoke` exits 0.
- [ ] Smoke: `bun run cfr-ingest --help` prints usage.
- [ ] Smoke: `CI=true bun run cfr-ingest --edition=2026-01-01` exits 2 with "CI guard" message.
- [ ] Commit: `feat(sources): phase-3 cfr-ingest dispatcher script`.

## Phase 14 - Verification + smoke gates

- [ ] `bun run check` exits 0.
- [ ] `bun test libs/sources/` -- all tests pass.
- [ ] svelte-check unaffected.
- [ ] Smoke 1 (fixture ingest): `bun run cfr-ingest --fixture=tests/fixtures/cfr/title-14-2026-fixture.xml --out=/tmp/cfr-smoke`. Verify the temp tree has the expected structure (Parts, sections, manifest, sections.json).
- [ ] Smoke 2 (validator publish gate): manually create a temp lesson under `course/regulations/` containing `[@cite](airboss-ref:regs/cfr-14/91/103?at=2026)`, run `bun run check`. Expect zero ERRORs (assuming Phase 3's smoke ingestion has run; if not, run the fixture ingest first to prime the active table). Revert the temp lesson.
- [ ] Smoke 3 (idempotence): run `cfr-ingest` twice; second run reports zero modifications.
- [ ] Commit any tweaks discovered along the way.

## Phase 15 - Update rollout tracker + ship PR

- [ ] Update `docs/work/plans/adr-019-rollout.md`:
    - Phase 3 row: WP link, PR link, status done.
    - Update log: "Phase 3 -- CFR ingestion bulk shipped (PR #XXX)."
- [ ] Stage files individually by name (no `git add -A`).
- [ ] Commit message: `feat(sources): ADR 019 phase 3 -- CFR bulk ingestion`.
- [ ] Push branch.
- [ ] Open PR via `gh pr create` with title `feat(sources): ADR 019 phase 3 -- CFR bulk ingestion`.
- [ ] PR body: link ADR 019, link Phase 1 + 2 PRs (#241, #246), link this WP, summary of phases shipped, smoke results, document the `phase-3-bulk-ingestion` placeholder reviewer.
- [ ] Write PR URL to `.ball-coord/to-dispatcher.md`.
