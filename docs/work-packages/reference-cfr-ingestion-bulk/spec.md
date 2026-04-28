---
title: 'Spec: Reference CFR ingestion (bulk)'
product: cross-cutting
feature: reference-cfr-ingestion-bulk
type: spec
status: unread
review_status: pending
---

# Spec: Reference CFR ingestion (bulk)

Phase 3 of the 10-phase ADR 019 rollout. Lands the first **real** corpus into the registry built in [Phase 2](../reference-source-registry-core/). After Phase 3 ships, lessons can write `[@cite](airboss-ref:regs/cfr-14/91/103?at=2026)` and the validator resolves it without touching `unknown:` -- the publish gate is meaningful for the regulations corpus.

The corpus covered is the slice of US federal aviation regulation that pilot-training and FIRC content actually cites:

- **14 CFR** -- the entire Title (every Part the eCFR Versioner publishes for Title 14).
- **49 CFR Part 830** -- NTSB notification + reporting rules (cited heavily in private/instrument lessons).
- **49 CFR Part 1552** -- TSA flight-school security rules (cited in FIRC).

Whole-Title-14 ingest beats the listed-Parts approach: the eCFR Versioner ships the full Title in one XML payload, and ingesting all of it is the same loop as ingesting twelve Parts. Down the road, lessons that cite a Part 67 medical or a Part 142 training-center rule resolve without re-running the pipeline.

Phase 3 is **section-level**. Sub-section / paragraph / item identifiers parse correctly via `parseLocator` (the validator already accepts `airboss-ref:regs/cfr-14/91/103/b/1/i?at=2026`), but the registry stores one `SourceEntry` per section (and per subpart, per Part). Paragraph-level content lookup is the renderer's problem (Phase 4); the resolver descends into the section's text at substitution time.

## Why this matters

Phase 2 left the registry empty by design. Phase 1's validator has no real entries to resolve against. As long as that's the state of the world:

1. **Lesson authors can't cite anything.** Every `airboss-ref:regs/...` URL the validator sees is row-2 ERROR (entry not in registry). Authors fall back to plain eCFR URLs or `unknown:` placeholders -- both block merge or generate prose-only references.
2. **The `--fix` mode has no edition to stamp.** `getCurrentAcceptedEdition('regs')` returns null, so unpinned URLs stay unpinned and ERROR with row 1.
3. **The renderer (Phase 4) has nothing to render.** Without entries + editions + derivative content, token substitution (`@cite`, `@title`, `@text`) produces empty strings.
4. **The annual diff job (Phase 5) has nothing to diff.** No two-edition registry means no hash-compare can run.

Phase 3 closes all four. After it lands, the regs corpus is a working example of the full ADR 019 contract: ingestion -> registry -> validator -> (Phase 4) renderer -> (Phase 5) diff. Every later corpus (handbooks Phase 6, AIM Phase 7, AC Phase 8) uses Phase 3 as the reference implementation for its own ingestion shape.

The corpus chosen first is regulations because:

- The text is normative -- the regulation IS what the lesson cites; misquoting is a correctness bug.
- The publication channel is open and structured (eCFR XML, no licensing friction).
- Edition cadence is annual (Title 14 republishes Jan 1 each year), which gives Phase 5 a real signal to test against.
- The corpus's volume (~2,500 sections across Title 14) is small enough to ingest in seconds and big enough to find the rough edges.

## Success Criteria

- `libs/sources/src/regs/` directory holds the CFR resolver, the eCFR XML walker, the section-level normalizer, and per-corpus tests.
- A `regs` `CorpusResolver` is registered via `registerCorpusResolver(...)` at module init, replacing the Phase 2 default no-op.
- The resolver implements every method on the `CorpusResolver` interface with real CFR semantics:
    - `parseLocator` accepts `cfr-14/<part>/<section>`, `cfr-14/<part>/<section>/<paragraph>(...)`, `cfr-14/<part>/subpart-<letter>`, `cfr-14/<part>`, and the same shapes under `cfr-49`. Validates each segment.
    - `formatCitation('short' | 'formal' | 'title')` returns `§91.103`, `14 CFR § 91.103`, and the section's `canonical_title`.
    - `getCurrentEdition()` returns the most recent ingested edition slug (the calendar year, e.g. `'2026'`).
    - `getEditions(id)` returns the ordered edition history.
    - `getLiveUrl(id, edition)` returns the eCFR URL (`https://www.ecfr.gov/current/title-14/...` for the current edition; `https://www.ecfr.gov/on/<YYYY-MM-DD>/title-14/...` for past).
    - `getDerivativeContent(id, edition)` reads the in-repo derivative markdown.
    - `getIndexedContent(id, edition)` returns structured section content from the per-edition `sections.json` derivative.
- An ingestion CLI, exposed via `bun run sources register cfr [--edition=YYYY-MM-DD] [--fixture=PATH]`, fetches eCFR XML for Title 14 + 49 CFR 830 + 49 CFR 1552 (or reads from a fixture file), caches it under `$AIRBOSS_HANDBOOK_CACHE/regulations/cfr-<title>/<YYYY-MM-DD>/source.xml` per ADR 018, walks the XML, writes derivative markdown + sections.json + manifest.json into `regulations/cfr-<title>/<YYYY-MM-DD>/`, populates the registry to `pending`, and records an atomic batch promotion to `accepted` under reviewer `phase-3-bulk-ingestion`.
- The pipeline is **idempotent**. Re-running with the same `--edition=` (a) reuses cached XML, (b) hash-compares regenerated derivatives against on-disk versions and skips writes when content is unchanged, (c) skips re-promotion when the lifecycle is already `accepted`.
- Section content is committed as derivatives per ADR 018: one `<part>/<section>.md` per section, one per-edition `manifest.json`, one per-edition `sections.json` for the indexed-tier surface.
- A small Title 14 fixture (`tests/fixtures/cfr/title-14-2026-fixture.xml` -- a few Parts, ~10 sections) ships in the repo so unit + integration tests run without hitting the live eCFR API.
- Vitest tests cover: `parseLocator` for every accepted locator shape (and rejection messages for malformed input), `formatCitation` for all three styles, `getLiveUrl` for current vs past editions, fixture-driven ingestion (XML in -> SourceEntries + derivatives + batch promotion), idempotence (second run is a no-op), per-section hash compare on regeneration, atomic batch failure handling.
- A validator smoke test (`libs/sources/src/regs/smoke.test.ts`) inserts `[@cite](airboss-ref:regs/cfr-14/91/103?at=2026)` into a temp lesson, runs `validateReferences`, expects zero ERRORs.
- `bun run check` exits 0; `bun test libs/sources/` passes; `bun run sources register cfr --fixture=tests/fixtures/cfr/title-14-2026-fixture.xml` exits 0.

## Scope

### In

- `libs/sources/src/regs/resolver.ts` -- the `regs` `CorpusResolver`. Implements every method against the registered editions + the on-disk derivative tree.
- `libs/sources/src/regs/locator.ts` -- the `parseLocator` machinery. Returns a typed shape extending the Phase 2 `ParsedLocator` discriminated union with an optional richer record. Falls back to opaque segments only on inputs the validator rejects.
- `libs/sources/src/regs/citation.ts` -- the `formatCitation` machinery. Per-style formatting: `'short'` (`§91.103`), `'formal'` (`14 CFR § 91.103`), `'title'` (the section's `canonical_title`).
- `libs/sources/src/regs/url.ts` -- live URL generator. `getLiveUrl(id, edition)` constructs eCFR Versioner URLs for current vs historical editions.
- `libs/sources/src/regs/xml-walker.ts` -- streams the eCFR XML, emits one `RawSection` per `<DIV8 TYPE="SECTION">`, one `RawSubpart` per `<DIV6 TYPE="SUBPART">`, one `RawPart` per `<DIV5 TYPE="PART">`. Uses `fast-xml-parser` (added to `libs/sources/package.json`).
- `libs/sources/src/regs/normalizer.ts` -- normalizes raw XML data into `SourceEntry` records: strip whitespace, LF line endings, Unicode NFC, build `canonical_short` / `canonical_formal` / `canonical_title`, build the `SourceId` per ADR 019 §1.2, populate `last_amended_date` from `AMDDATE` (or the publication date when absent -- never null per ADR 019 §1.5.1).
- `libs/sources/src/regs/derivative-writer.ts` -- writes `regulations/cfr-<title>/<YYYY-MM-DD>/<part>/<section>.md`, `manifest.json`, and `sections.json` (the indexed-tier per-edition file). Hash-compares content; skips writes when unchanged.
- `libs/sources/src/regs/cache.ts` -- resolves `$AIRBOSS_HANDBOOK_CACHE` (default `~/Documents/airboss-handbook-cache/`), constructs cache paths, downloads the eCFR Versioner XML when the cache file is missing, computes SHA-256 for the manifest. Per ADR 018.
- `libs/sources/src/regs/ingest.ts` -- the orchestration entry. Runs cache -> walk -> normalize -> derivative-write -> registry-populate -> batch-promote, in that order. Idempotent. Exposes `runIngestCli(args)` for the script wrapper.
- `libs/sources/src/regs/index.ts` -- assembles the resolver, registers it via `registerCorpusResolver(...)`, exports the public surface.
- `scripts/cfr-ingest.ts` -- bun dispatcher. Parses `--edition=`, `--fixture=`, `--out=`, `--help`, calls `runIngestCli`.
- Root `package.json` script: `"cfr-ingest": "bun scripts/cfr-ingest.ts"`.
- `tests/fixtures/cfr/title-14-2026-fixture.xml` -- a small but real-shaped slice of Title 14 (Parts 61, 91, with two-three sections each, plus subparts and one Part-level entry). Fetched from the live eCFR API once and trimmed for fixture use.
- `regulations/.gitkeep` -- placeholder so the derivative directory exists before any real ingestion.
- `.gitignore` line per ADR 018 (`regulations/cfr-*/**/*.xml` blocking any accidental staging of cached XML even though the cache lives outside repo by default).
- `.gitattributes` line per ADR 018 (`regulations/cfr-*/**/*.xml filter=lfs diff=lfs merge=lfs -text` -- dormant LFS plumbing).
- Vitest tests:
    - `libs/sources/src/regs/locator.test.ts` -- accepted shapes, rejected shapes, structured ParsedLocator output.
    - `libs/sources/src/regs/citation.test.ts` -- all three styles.
    - `libs/sources/src/regs/url.test.ts` -- current vs past edition URL shapes.
    - `libs/sources/src/regs/normalizer.test.ts` -- whitespace / NFC / `last_amended_date` defaults.
    - `libs/sources/src/regs/xml-walker.test.ts` -- against the Title 14 fixture, asserts expected counts of Parts / subparts / sections.
    - `libs/sources/src/regs/derivative-writer.test.ts` -- writes to a temp dir, asserts file shapes, hash-compare skip-on-unchanged.
    - `libs/sources/src/regs/ingest.test.ts` -- end-to-end fixture ingestion, asserts SOURCES population + EDITIONS population + batch promotion.
    - `libs/sources/src/regs/idempotence.test.ts` -- runs ingestion twice; asserts second run mutates nothing.
    - `libs/sources/src/regs/smoke.test.ts` -- validator smoke (real `airboss-ref:regs/cfr-14/91/103?at=2026` in a temp lesson; zero ERRORs).
- `docs/work/plans/adr-019-rollout.md` updated to mark Phase 3 done with the PR number after merge.

### Out

- **Phase 4 (renderer).** Token substitution at render time. Phase 3's `getDerivativeContent` and `getIndexedContent` are the substrate; the renderer is the consumer.
- **Phase 5 (annual diff job).** Phase 3 ingests one edition at a time. Phase 5 runs the next edition through Phase 3, then hash-compares editions and rewrites lesson pins. Phase 3 leaves the annual rollover machinery to Phase 5.
- **Per-paragraph SourceEntries.** Phase 3 stores one entry per section (and per subpart, per Part). Paragraph-level identifiers (`91.103/b/1/i`) parse via `parseLocator` and resolve to the section's entry; the renderer (Phase 4) descends into the section text.
- **49 USC (statutes corpus).** ADR 019 §1.2 lists `statutes` as its own corpus. Out of scope here; covered later if a lesson cites a statute that isn't already in 14 CFR.
- **Cross-corpus supersession of CFR sections.** Some CFR sections are replaced by ICAO-aligned standards in different corpora; that's Phase 10 territory under the ADR 016 reorganization scenario.
- **Postgres-backed indexed tier.** ADR 019 §2.5 names Postgres for the indexed tier. Phase 3 ships an in-repo JSON file (`sections.json`) at the indexed tier slot. The resolver's `getIndexedContent` reads from JSON; future phases swap the read path to Postgres without touching the resolver's contract.
- **A real `phase-3` reviewer identity.** ADR 019 §2.4 requires a reviewer ID for batch promotion; in this automated context the agent records the promotion under the placeholder reviewer `'phase-3-bulk-ingestion'`. The PR body documents this so the user can re-promote (or de-promote) under his own reviewer ID if he chooses.
- **Hangar-driven editing UI** for non-engineer registry curation. revisit.md R5; deferred until `apps/hangar/` revives.

## Data Model

### `regs` corpus locator (ADR 019 §1.2)

```text
airboss-ref:regs/cfr-14/91/103?at=2026                  # section
airboss-ref:regs/cfr-14/91/103/b?at=2026                # paragraph (parses; resolves to §91.103)
airboss-ref:regs/cfr-14/91/103/b/1/i?at=2026            # item (parses; resolves to §91.103)
airboss-ref:regs/cfr-14/91/subpart-b?at=2026            # subpart (separate SourceEntry)
airboss-ref:regs/cfr-14/91?at=2026                      # whole part (separate SourceEntry)
airboss-ref:regs/cfr-49/830/5?at=2026                   # 49 CFR 830 §5
airboss-ref:regs/cfr-49/1552/subpart-a?at=2026          # TSA subpart
```

`parseLocator` returns a richer shape than the Phase 2 default segments-array. The Phase 2 `ParsedLocator` type is a discriminated union; Phase 3 extends it inline:

```typescript
export type ParsedLocator =
  | { readonly kind: 'ok'; readonly segments: readonly string[] }
  | {
      readonly kind: 'ok';
      readonly segments: readonly string[];
      readonly regs: {
        readonly title: '14' | '49';
        readonly part: string;
        readonly subpart?: string;
        readonly section?: string;
        readonly paragraph?: readonly string[];
      };
    };
```

(Implementation detail per design.md: the second branch is the first branch with the optional `regs` payload; `types.ts` gets one extension, no breaking change to Phase 2.)

### `SourceEntry` per CFR section

```typescript
{
  id: 'airboss-ref:regs/cfr-14/91/103' as SourceId,
  corpus: 'regs',
  canonical_short: '§91.103',
  canonical_formal: '14 CFR § 91.103',
  canonical_title: 'Preflight action',
  last_amended_date: new Date('2009-08-21'),  // from XML <AMDDATE> or publication date fallback
  lifecycle: 'pending',                        // ingestion writes this; batch promotion advances to 'accepted'
}
```

A subpart entry has `id: 'airboss-ref:regs/cfr-14/91/subpart-b'`, `canonical_short: 'Subpart B'`, `canonical_formal: '14 CFR Part 91, Subpart B'`, `canonical_title: 'Flight Rules'`. A whole-Part entry has `id: 'airboss-ref:regs/cfr-14/91'`, `canonical_short: '14 CFR Part 91'`, `canonical_formal: '14 CFR Part 91'`, `canonical_title: 'General Operating and Flight Rules'`.

### Edition record per (entry, edition)

```typescript
{
  id: '2026',                                    // the calendar year of the eCFR snapshot
  published_date: new Date('2026-01-01'),        // the eCFR Versioner snapshot date
  source_url: 'https://www.ecfr.gov/current/title-14/chapter-I/subchapter-F/part-91/subpart-B/section-91.103',
  // aliases?: undefined for the initial ingestion; future ingestions populate when a section renumbers
}
```

### Derivative tree per ADR 018

```text
regulations/
  cfr-14/
    2026-01-01/
      manifest.json                              # source_url, source_sha256, fetched_at, edition_slug, section_count
      sections.json                              # indexed-tier dump: SectionId -> { id, title, last_amended_date, body_path, body_hash }
      91/
        91-103.md                                # one file per section
        91-103.meta.json                         # last_amended_date, AMDDATE source, normalization notes
        subpart-b.md                             # subpart overview (XML <DIV6> body if any, else just title + child list)
      ...
  cfr-49/
    2026-01-01/
      830/...
      1552/...
```

(Cache shape per STORAGE.md is the mirror, sans derivative files: `$AIRBOSS_HANDBOOK_CACHE/regulations/cfr-14/2026-01-01/source.xml`.)

### Indexed-tier `sections.json` shape

```typescript
{
  edition: '2026',
  sectionsByPart: {
    '91': [
      {
        id: 'airboss-ref:regs/cfr-14/91/103',
        canonical_title: 'Preflight action',
        last_amended_date: '2009-08-21',
        body_path: '91/91-103.md',     // relative to the per-edition directory
        body_sha256: '<hex>',
      },
      ...
    ],
  },
}
```

The renderer (Phase 4) reads this to drive `@text` / `@quote` token substitution. Phase 3 generates it; the resolver's `getIndexedContent` reads it; no Postgres involvement at this phase.

## Behavior

### eCFR Versioner endpoint shape

- Title 14 current: `https://www.ecfr.gov/api/versioner/v1/full/<YYYY-MM-DD>/title-14.xml`
- 49 CFR Part 830: `https://www.ecfr.gov/api/versioner/v1/full/<YYYY-MM-DD>/title-49.xml?part=830` (the Versioner accepts a `part=` query)
- 49 CFR Part 1552: same pattern, `part=1552`
- Past editions use the same `<YYYY-MM-DD>` slot pre-filled with the historical date.

The eCFR API is public; no auth needed. Rate limits are documented as "be reasonable"; ingestion runs once per edition per year, well under any conceivable threshold.

The pipeline's resilience posture: if the live eCFR is unavailable AND no cached XML exists for the requested edition, the pipeline exits non-zero with a clear "cache miss + network failure; provide --fixture or wait" message. It does NOT silently fall back to a previous edition.

### Idempotence

The pipeline computes content hashes at three layers:

1. **Source XML hash.** Cached file's SHA-256 is recorded in `manifest.json`. Re-running with the same edition reuses the cached file when present.
2. **Per-section content hash.** Each section's normalized body is hashed (SHA-256). The derivative-writer compares the hash to `<section>.meta.json`'s `body_sha256`; if equal, the file is not rewritten.
3. **Lifecycle.** `recordPromotion` is skipped when every entry in scope is already `accepted`. The pipeline logs "already promoted" and exits 0.

Re-running on the same edition is therefore safe: it re-reads cached XML, re-walks the structure, no-ops on identical content, no-ops on already-promoted entries.

### Atomic batch failure handling

If `recordPromotion` returns `{ ok: false, error }`, the pipeline:

1. Reports the error to stderr with the offending entry id.
2. Leaves SOURCES + EDITIONS in their pre-promotion state (those are mutated only after `recordPromotion` succeeds).
3. Exits non-zero.

Per ADR 019 §2.4, half-promoted batches are forbidden. The two-phase mutation in `lifecycle.ts` already enforces this; Phase 3's job is to surface the failure clearly and not paper over it.

### Validator integration smoke

After `runIngestCli` against the Title 14 fixture:

```typescript
const lesson = `[@cite](airboss-ref:regs/cfr-14/91/103?at=2026)`;
const findings = await validateReferences({ contentPaths: [tempLessonDir] });
expect(findings.filter((f) => f.severity === 'error')).toEqual([]);
```

This is the test that proves the publish gate works for `regs`.

## Dependencies

- **Upstream:** ADR 019 (accepted v3), Phase 1 (PR #241), Phase 2 (PR #246).
- **Downstream:** Phase 4 (renderer) consumes `getIndexedContent` for token substitution; Phase 5 (annual diff) consumes `getEditions` and the per-section hash; Phase 9 (lesson migration) walks pre-ADR-019 lessons and rewrites their eCFR URLs to `airboss-ref:regs/...?at=<year>` using the registry as ground truth.
- **External:** `fast-xml-parser` npm package (added to `libs/sources/package.json`). Bun-compatible, no native deps.

## Validation

| Concern | Where it runs |
| --- | --- |
| `parseLocator` accepts every shape from §1.2 | Vitest unit (`locator.test.ts`) |
| `parseLocator` rejects malformed input with clear messages | Vitest unit |
| `formatCitation` produces `§91.103`, `14 CFR § 91.103`, title | Vitest unit (`citation.test.ts`) |
| `getLiveUrl` builds correct eCFR Versioner URLs | Vitest unit (`url.test.ts`) |
| `getCurrentEdition()` returns the most recent `accepted` edition | Vitest unit (`resolver.test.ts`) |
| XML walker emits expected count of Parts / subparts / sections | Vitest unit (`xml-walker.test.ts`) against fixture |
| Normalizer NFC-normalizes section text + sets `last_amended_date` | Vitest unit (`normalizer.test.ts`) |
| Derivative writer hash-compares + skips unchanged | Vitest unit (`derivative-writer.test.ts`) |
| Ingestion populates SOURCES + EDITIONS + records batch promotion | Vitest integration (`ingest.test.ts`) |
| Re-running ingestion is a no-op | Vitest integration (`idempotence.test.ts`) |
| Atomic batch failure rolls back nothing (no half-write) | Vitest unit |
| Validator zero-ERROR for a real `airboss-ref:regs/...?at=2026` | Vitest integration (`smoke.test.ts`) |
| Cache miss + network failure exits non-zero | Manual smoke (with network disabled) |
| `bun run sources register cfr --fixture=...` exits 0 | Manual smoke |
| `bun run check` exits 0 | Manual gate |
| `bun test libs/sources/` passes | Manual gate |

## Edge Cases

- **eCFR XML element naming.** The eCFR uses `<DIV5 TYPE="PART">`, `<DIV6 TYPE="SUBPART">`, `<DIV8 TYPE="SECTION">` (and `<DIV1>` for the Title). The walker assumes this schema, which has been stable for years. If the schema changes, tests against the fixture catch it before production.
- **Reserved sections.** A section marked `[Reserved]` in the XML still gets a `SourceEntry` per ADR 019 §1.5.1: `canonical_title: '[Reserved]'`. `last_amended_date` defaults to the publication date when no `AMDDATE` is present.
- **Newly-created sections.** `last_amended_date` defaults to the section's first-appearance publication date. Per ADR 019 §1.5.1; never null.
- **Whole-Part vs whole-subpart entries.** The pipeline writes one `SourceEntry` for the Part itself and one per Subpart in addition to one per Section. This satisfies `airboss-ref:regs/cfr-14/91?at=2026` (whole-Part references) and `airboss-ref:regs/cfr-14/91/subpart-b?at=2026` (whole-subpart references).
- **Sections that span multiple subparts.** Doesn't happen in practice. If the XML produces it (defensive case), the walker emits one section entry, parented under the subpart that contains the section's `<DIV8>` opening tag.
- **`AMDDATE` malformed or missing.** Ingestion uses publication date (the `--edition=YYYY-MM-DD` value). Logged at INFO; not an error.
- **eCFR Versioner returns 404 for a Part.** Reported as an error (`part 1552 not found in title 49 at edition 2026-01-01`); pipeline exits non-zero. Does not silently skip the part.
- **Unicode normalization.** All section text is NFC-normalized. NFD vs NFC differs visually for some Greek letters / accented characters in regulation citations; NFC is the canonical form per ADR 019 §5.
- **Trailing whitespace / line endings.** Section bodies are stripped of leading/trailing whitespace; line endings are LF; consecutive blank lines collapse to two.
- **Re-promotion of already-accepted entry.** `lifecycle.ts` allows `accepted -> pending` (de-promotion); ingestion never calls that. A second ingest run on identical content sees `accepted` lifecycle; skips `recordPromotion` cleanly.
- **Resolver methods called before ingestion has run.** `getCurrentEdition` returns null; `getEditions` returns empty; `getDerivativeContent` returns null. Same as Phase 2's no-op default. The validator behaves identically (the corpus is enumerated; entries don't exist; row 2 ERROR fires) to today's pre-Phase-3 state. Lessons authored before ingestion runs cannot resolve, which is the correct gate.

## Out of Scope (resolved, not deferred)

| Surfaced consideration | Resolution |
| --- | --- |
| Per-paragraph SourceEntries | Drop. Phase 3 ships section-level entries; paragraph-level identifiers parse and resolve to the section. Phase 4 (renderer) handles paragraph-text descent. |
| 49 USC ingestion | Drop from Phase 3. Separate corpus (`statutes`); separate WP if needed. |
| Postgres indexed tier | Drop. Phase 3 ships JSON-file indexed tier; future phase swaps backend without touching the resolver contract. |
| Cross-corpus supersession of CFR | Drop. Phase 10 + ADR 016 reorganization scenarios. |
| Annual rollover diff | Drop. Phase 5. |
| Reviewer auth integration | Drop. Phase 3 records batch promotion under placeholder `'phase-3-bulk-ingestion'`. Real auth integration is a separate WP; the audit-trail shape is final. |
| Hangar UI for entry curation | Drop. revisit.md R5; hangar revival ADR. |

## Open Items

Ratified during this spec; not deferred:

- The `regs` resolver registers itself by side effect when `libs/sources/src/regs/index.ts` is imported. The Phase 2 lib's `index.ts` adds an import line so the resolver is wired by default for any consumer importing `@ab/sources`. The Phase 2 test helper `resetRegistry()` calls `__corpus_resolver_internal__.resetToDefaults()` which restores the no-op default; tests that need the real resolver re-import `@ab/sources/regs` in their `beforeEach`.
- The cache file lives at `$AIRBOSS_HANDBOOK_CACHE/regulations/cfr-<title>/<YYYY-MM-DD>/source.xml` regardless of whether the user provides `--fixture=` (the fixture path bypasses cache entirely; the manifest's `source_url` records the fixture path in that branch).
- The `cfr-ingest` script refuses to run when `process.env.CI === 'true'` AND `--fixture=` is not provided. Live ingestion is an operator action, not a CI action; CI may run fixture-driven ingestion for tests.
- Per-edition `manifest.json` and `sections.json` are committed inline in the repo (per ADR 018). The cached `source.xml` is NOT committed (per ADR 018 + .gitignore + dormant LFS plumbing).
- The placeholder reviewer ID `'phase-3-bulk-ingestion'` is a string constant defined in `libs/sources/src/regs/ingest.ts`. The PR body documents this so the user can re-promote under his own reviewer ID later by running `recordDePromotion` + `recordPromotion`.
- Edition slugs are calendar years (`'2026'`). The `published_date` on the `Edition` record is the eCFR snapshot date (`new Date('2026-01-01')`). Both are populated by ingestion; the calendar year is what authors write in `?at=`.
