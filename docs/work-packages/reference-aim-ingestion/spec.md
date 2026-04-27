---
title: 'Spec: Reference AIM ingestion'
product: cross-cutting
feature: reference-aim-ingestion
type: spec
status: unread
review_status: pending
---

# Spec: Reference AIM ingestion

Phase 7 of the 10-phase ADR 019 rollout. Lands the third real corpus (`aim`) into the registry, after Phase 3's `regs` and Phase 6's `handbooks`. Mechanically smaller than Phase 3: live AIM source ingestion is **out of scope** for this phase. Phase 7 is a thin adapter that registers an `aim` `CorpusResolver`, walks an existing per-edition `manifest.json` derivative tree, and populates the registry with chapter/section/paragraph and glossary/appendix entries.

The corpus covered is the FAA Aeronautical Information Manual:

- **AIM** -- Aeronautical Information Manual, FAA's official guide to flight procedures and ATC. Continuous-edition stream pinned at year-month (`?at=2026-09`); the FAA publishes change cycles roughly twice a year.

A hand-authored fixture under `tests/fixtures/aim/aim-fixture/aim/2026-09/` provides the manifest + body files the tests run against. When the FAA publishes a new edition, an operator runs the ingestion pipeline (a follow-up to ADR 016 phase 0, separate from this WP) to populate `aim/<YYYY-MM>/` derivatives, then runs `bun run ingest aim --edition=<YYYY-MM>` to register them.

Phase 7 is **paragraph / glossary-entry / appendix level**. Sub-paragraph identifiers within an AIM paragraph (rare; AIM doesn't use the same `(a)(1)(i)` lettering CFR does) are out of scope -- the ADR 019 §1.2 "AIM" spec stops at paragraph granularity.

## Why this matters

After Phase 3 + 6, the registry has `regs` and `handbooks` entries; lessons can cite `airboss-ref:regs/cfr-14/91/103?at=2026` and `airboss-ref:handbooks/phak/8083-25C/12/3` and the validator resolves them. Without `aim`, the second-most-cited operational source in pilot-training content (AIM 5-1-7 IFR clearance procedures, AIM 4-3-22 traffic patterns, AIM 7-1-12 weather observations) still has to live as `unknown:` placeholders or plain FAA URLs. Both block merge or fall back to prose-only references.

Phase 7 closes the gap. After it lands:

1. Lesson authors can write `[@cite](airboss-ref:aim/5-1-7?at=2026-09)` and the validator resolves it to "AIM 5-1-7 -- Pilot Responsibility upon Clearance Issuance" without ERROR.
2. The renderer's `@title`, `@chapter`, `@text` tokens substitute correctly for AIM references.
3. Phase 5's diff job has a third corpus to test cross-edition workflow against -- AIM ships year-month editions so the diff cadence applies here (unlike handbooks which ship as new doc slugs).
4. The publish gate is meaningful for the largest body of operational pilot-procedure text the platform consumes.

The corpus is chosen third (after `regs` + `handbooks`) because:

- The `aim` locator shape is simpler than `handbooks` (no doc slug; one continuous stream) and simpler than `regs` (no Title / Part / Subpart hierarchy; flat chapter-section-paragraph numbering).
- The edition cadence is regular (year-month publication cycle) so Phase 5's annual diff applies cleanly.
- Volume is moderate (~1500 paragraphs across 11 chapters + glossary + appendices). Small enough to ingest in milliseconds, big enough to find rough edges in the resolver.
- AIM source ingestion (PDF / HTML -> markdown derivatives) is a separate operator concern; Phase 7 is **registry-population only** against whatever the operator already extracted.

## Success Criteria

- `libs/sources/src/aim/` directory holds the AIM resolver, derivative reader, locator parser, citation formatter, URL builder, ingest CLI, and per-corpus tests.
- An `aim` `CorpusResolver` is registered via `registerCorpusResolver(...)` at module init, replacing the Phase 2 default no-op. The Phase 3 `regs` and Phase 6 `handbooks` registrations are unchanged.
- The resolver implements every method on the `CorpusResolver` interface with real AIM semantics:
    - `parseLocator` accepts `<chapter>-<section>-<paragraph>` (paragraph), `<chapter>-<section>` (section), `<chapter>` (chapter), `glossary/<slug>` (glossary entry), `appendix-<N>` (appendix). Validates each segment.
    - `formatCitation('short' | 'formal' | 'title')` returns `AIM 5-1-7`, `Aeronautical Information Manual, Chapter 5, Section 1, Paragraph 7`, and the entry's `canonical_title` ("Pilot Responsibility upon Clearance Issuance").
    - `getCurrentEdition()` returns the most recent ingested edition slug across all `aim` entries (lexically max year-month slug).
    - `getEditions(id)` returns the ordered edition history.
    - `getLiveUrl(id, edition)` returns the FAA AIM landing URL (`https://www.faa.gov/air_traffic/publications/atpubs/`). FAA does not deep-link individual paragraphs; the resolver returns the doc-level URL.
    - `getDerivativeContent(id, edition)` reads the in-repo derivative markdown for the paragraph / section / chapter / glossary entry / appendix.
    - `getIndexedContent(id, edition)` returns structured content from the per-edition `manifest.json` (title + body).
- An ingest CLI, exposed via `bun run ingest aim [--edition=2026-09] [--out=...]`, walks an existing derivative tree and populates the registry. The CLI does NOT re-fetch source bytes; it reads `aim/<edition>/manifest.json` and emits one `SourceEntry` per chapter / section / paragraph / glossary entry / appendix. Idempotent: re-running with the same args is a no-op.
- The pipeline is **idempotent**. Re-running with the same `--edition=` (a) reads the existing manifest, (b) skips re-writing entries already in the registry, (c) skips re-promotion when the lifecycle is already `accepted`.
- Section content is not generated -- the operator's source-ingestion pipeline (out of scope for this WP) writes it. Phase 7 only registers entries pointing at the existing files.
- A small fixture AIM tree (`tests/fixtures/aim/aim-fixture/aim/2026-09/manifest.json` + a few markdown files) ships in the repo so unit + integration tests run without depending on a real AIM derivative tree.
- Vitest tests cover: `parseLocator` for every accepted locator shape (and rejection messages for malformed input), `formatCitation` for all three styles, `getLiveUrl` for paragraph / chapter / glossary / appendix, fixture-driven ingestion (manifest.json -> SourceEntries + batch promotion), idempotence (second run is a no-op), atomic batch failure handling.
- A validator smoke test (`libs/sources/src/aim/smoke.test.ts`) inserts `[@cite](airboss-ref:aim/5-1-7?at=2026-09)` into a temp lesson, runs `validateReferences`, expects zero ERRORs.
- `bun run check` exits 0; `bun test libs/sources/` passes; `bun run ingest aim` exits 0 against the fixture derivatives.

## Out of scope

- Live AIM source-document ingestion (PDF / HTML fetch, markdown extraction). That's a separate operator pipeline -- a follow-up to ADR 016 phase 0 -- and not Phase 7's concern. Phase 7 consumes whatever derivatives the operator wrote.
- Per-glossary-term content lookup beyond the title. Glossary entries get a `SourceEntry` (title + body markdown), but the renderer's structured glossary surface (definition, see-also references, etc.) is a follow-up.
- Cross-edition aliases. AIM revises paragraphs without renumbering routinely; if 2026-09 -> 2027-04 silently changes the text of 5-1-7, Phase 5's diff job catches it. If 2027-04 renumbers (rare; the FAA tries hard not to), an alias entry is added by hand at that time.
- Sub-paragraph identifiers (`5-1-7-a-1`). The ADR 019 §1.2 "AIM" spec stops at paragraph granularity. AIM paragraphs occasionally use lettered sub-paragraphs internally; lessons that need to deep-link to one quote the paragraph and reference by content. Adding sub-paragraph identifiers is a follow-up if/when the user wants finer granularity.
- The full AIM catalog walk. Phase 7 ships the resolver + fixture-driven tests. Real-tree ingestion happens once the source-ingestion pipeline lands and an operator runs it.

## Data Model

The registry shape is the same `SourceEntry` Phase 3 + 6 used. Per-AIM-entry fields:

| Field | Value |
| --- | --- |
| `id` | `airboss-ref:aim/<chapter>-<section>-<paragraph>`, `airboss-ref:aim/<chapter>-<section>`, `airboss-ref:aim/<chapter>`, `airboss-ref:aim/glossary/<slug>`, `airboss-ref:aim/appendix-<N>` |
| `corpus` | `'aim'` |
| `canonical_short` | `'AIM 5-1-7'`, `'AIM Glossary - Pilot In Command'`, `'AIM Appendix 1'` |
| `canonical_formal` | `'Aeronautical Information Manual, Chapter 5, Section 1, Paragraph 7'`, `'Aeronautical Information Manual, Pilot/Controller Glossary, Pilot In Command'`, `'Aeronautical Information Manual, Appendix 1'` |
| `canonical_title` | The entry's title from `manifest.json` (e.g. `'Pilot Responsibility upon Clearance Issuance'`) |
| `last_amended_date` | `manifest.fetched_at` (the FAA edition publication date the manifest records) |
| `lifecycle` | `'pending'` after ingest, `'accepted'` after batch promotion |

The `Edition` shape:

| Field | Value |
| --- | --- |
| `id` | `'2026-09'` (year-month) |
| `published_date` | `manifest.fetched_at` parsed as ISO date |
| `source_url` | `manifest.source_url` (the FAA AIM URL) |

The locator shape (per ADR 019 §1.2):

```text
aim/<chapter>                                  chapter (e.g. 5)
aim/<chapter>-<section>                        section (e.g. 5-1)
aim/<chapter>-<section>-<paragraph>            paragraph (e.g. 5-1-7)
aim/glossary/<slug>                            glossary entry
aim/appendix-<N>                               appendix
```

`<chapter>` / `<section>` / `<paragraph>` are integers (1-99). `<slug>` is a kebab-case lowercase identifier. `<N>` is an integer (1-99).

Pin format: `?at=YYYY-MM` (year-month). AIM is a continuous stream with periodic publications, so the year-month captures one revision cycle.

## Cache + storage

ADR 018 governs storage. AIM source documents (PDFs, HTML pulls) live in `$AIRBOSS_HANDBOOK_CACHE/aim/` per ADR 018 (cache subdirectory; not in the repo). Derivatives written by the operator's ingestion pipeline live in `aim/<edition>/` in the repo. Phase 7 reads those derivatives.

The only new in-repo files Phase 7 writes are the small test fixture files at `tests/fixtures/aim/aim-fixture/`. No new derivatives in `aim/`.

## Phase boundary

Phase 7 ships as one PR. The changes are:

- New directory `libs/sources/src/aim/` with locator + citation + URL + derivative-reader + resolver + ingest + index + tests.
- One side-effect import added to `libs/sources/src/index.ts` (`import './aim/index.ts'`).
- One new CLI entry in `package.json` (`aim-corpus-ingest`) and one new dispatcher (`scripts/aim-corpus-ingest.ts`).
- One small fixture tree under `tests/fixtures/aim/`.
- Updates to the rollout tracker (Phase 6 ✅, Phase 7 entry).

The PR does NOT modify Phase 1-6 code. Locator-parser tests for the `aim` corpus do not regress Phase 3 `regs` or Phase 6 `handbooks` tests.

## Dependencies

- Phase 1 (PR #241) -- validator + lesson-parser surface.
- Phase 2 (PR #246) -- registry core, lifecycle, corpus-resolver registration.
- Phase 3 (PR #247) -- exemplar pattern (`libs/sources/src/regs/`).
- Phase 6 (PR #251) -- closer structural template (`libs/sources/src/handbooks/`).

No new external dependencies. The pipeline reads JSON, not XML, so `fast-xml-parser` is not used.
