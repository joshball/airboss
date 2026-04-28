---
title: 'Spec: Reference handbook ingestion'
product: cross-cutting
feature: reference-handbook-ingestion
type: spec
status: unread
review_status: pending
---

# Spec: Reference handbook ingestion

Phase 6 of the 10-phase ADR 019 rollout. Lands the second real corpus (`handbooks`) into the registry, after Phase 3's `regs`. Mechanically smaller than Phase 3: ADR 016 phase 0 (PR #242) already shipped a handbook ingestion pipeline that walks FAA handbook PDFs and writes derivatives at `handbooks/<doc-slug>/<edition-slug>/`. This phase **reuses** that derivative tree -- it does not re-author the ingestion machinery. Phase 6 is a thin adapter that registers a `handbooks` `CorpusResolver`, walks the existing `manifest.json` files, and populates the registry with chapter/section/subsection entries.

The corpus covered is the slice of FAA handbooks that pilot-training and FIRC content actually cites:

- **PHAK** -- Pilot's Handbook of Aeronautical Knowledge, FAA-H-8083-25C (doc slug `phak`, edition `8083-25C`).
- **AFH** -- Airplane Flying Handbook, FAA-H-8083-3C (doc slug `afh`, edition `8083-3C`).
- **AvWX** -- Aviation Weather Handbook, FAA-H-8083-28B (doc slug `avwx`, edition `8083-28B`).

These three handbooks are already on disk under `handbooks/<slug>/<full-faa-name>/` with `manifest.json` + per-section markdown + per-figure PNG + per-table HTML. Phase 6 walks those manifests and emits one `SourceEntry` per chapter, section, and subsection.

Phase 6 is **chapter / section / subsection level**. Paragraph identifiers (`.../para-2`) parse correctly via `parseLocator` and resolve to their containing section. Figure and table identifiers (`fig-12-7`, `tbl-12-3`) parse correctly but do NOT get registry entries -- they're addressable derivative files; the renderer (Phase 4) descends to them when bound.

## Why this matters

After Phase 3, the registry has `regs` entries; lessons can cite `airboss-ref:regs/cfr-14/91/103?at=2026` and the validator resolves it. Without `handbooks`, the dominant non-regulatory source in private/instrument lesson plans (PHAK / AFH / AvWX chapters) still has to live as `unknown:` placeholders or plain FAA URLs. Both block merge or fall back to prose-only references.

Phase 6 closes the gap. After it lands:

1. Lesson authors can write `[@cite](airboss-ref:handbooks/phak/8083-25C/12/3)` and the validator resolves it to "PHAK Ch.12.3 -- Coriolis Force" without ERROR.
2. The renderer's `@title`, `@chapter`, `@text` tokens substitute correctly for handbook references.
3. Phase 5's diff job has a second corpus to test the cross-edition workflow against (when 8083-25D ships, the diff produces a new doc slug entirely).
4. The publish gate is meaningful for the largest body of pilot-training reference text the platform consumes.

The corpus is chosen second (after `regs`) because:

- ADR 016 phase 0 already produced the derivative tree. Phase 6 is **registry-population only**; no new fetcher / parser / writer.
- Edition cadence is irregular (handbooks revise every 3-7 years) so Phase 5's annual diff doesn't apply -- new editions ship as new doc slugs entirely.
- Volume is moderate (~700 sections across the three handbooks combined). Small enough to ingest in milliseconds, big enough to find rough edges in the resolver.

## Success Criteria

- `libs/sources/src/handbooks/` directory holds the handbook resolver, derivative reader, locator parser, citation formatter, URL builder, ingest CLI, and per-corpus tests.
- A `handbooks` `CorpusResolver` is registered via `registerCorpusResolver(...)` at module init, replacing the Phase 2 default no-op. The Phase 3 `regs` registration is unchanged.
- The resolver implements every method on the `CorpusResolver` interface with real handbook semantics:
    - `parseLocator` accepts `<doc>/<edition>/<chapter>` (whole chapter), `<doc>/<edition>/<chapter>/<section>` (section), `<doc>/<edition>/<chapter>/<section>/<subsection>` (subsection), `<doc>/<edition>/<chapter>/<section>/para-<N>` (paragraph -- resolves to section), `<doc>/<edition>/fig-<N>-<M>` (figure -- parses but no registry entry), `<doc>/<edition>/tbl-<N>-<M>` (table -- parses but no registry entry), `<doc>/<edition>/<chapter>/intro` (chapter intro). Validates each segment.
    - `formatCitation('short' | 'formal' | 'title')` returns `PHAK Ch.12.3`, `Pilot's Handbook of Aeronautical Knowledge (FAA-H-8083-25C), Chapter 12, Section 3`, and the section's `canonical_title` ("Coriolis Force").
    - `getCurrentEdition()` returns the most recent ingested edition slug per doc (empty string when the question is corpus-wide -- handbooks are doc-pinned, not corpus-pinned).
    - `getEditions(id)` returns the ordered edition history (typically one entry per doc since editions are baked into the doc slug).
    - `getLiveUrl(id, edition)` returns the FAA handbook URL (`https://www.faa.gov/regulations_policies/handbooks_manuals/aviation/<doc-slug>/`). FAA does not deep-link individual chapters, so the resolver returns the doc-level URL with a chapter anchor where the `manifest.json` records one. Source-PDF URL falls back from `manifest.source_url` when present.
    - `getDerivativeContent(id, edition)` reads the in-repo derivative markdown for the chapter / section / subsection.
    - `getIndexedContent(id, edition)` returns structured content from the per-edition `manifest.json` (title + body + figure list + table list).
- An ingest CLI, exposed via `bun run sources register handbooks [--doc=phak] [--edition=8083-25C] [--out=...]`, walks the existing derivative tree and populates the registry. The CLI does NOT re-fetch source bytes; it reads `handbooks/<slug>/<edition>/manifest.json` and emits one `SourceEntry` per chapter / section / subsection. Idempotent: re-running with the same args is a no-op.
- The pipeline is **idempotent**. Re-running with the same `--doc=` + `--edition=` (a) reads the existing manifest, (b) skips re-writing entries already in the registry, (c) skips re-promotion when the lifecycle is already `accepted`.
- Section content is not re-written -- ADR 016 phase 0 already wrote it. Phase 6 only registers entries pointing at the existing files.
- A small fixture handbook tree (`tests/fixtures/handbooks/phak-fixture/manifest.json` + 1-2 markdown files) ships in the repo so unit + integration tests run without depending on the full PHAK derivative tree.
- Vitest tests cover: `parseLocator` for every accepted locator shape (and rejection messages for malformed input), `formatCitation` for all three styles, `getLiveUrl` for chapter / section, fixture-driven ingestion (manifest.json -> SourceEntries + batch promotion), idempotence (second run is a no-op), atomic batch failure handling.
- A validator smoke test (`libs/sources/src/handbooks/smoke.test.ts`) inserts `[@cite](airboss-ref:handbooks/phak/8083-25C/12/3)` into a temp lesson, runs `validateReferences`, expects zero ERRORs.
- `bun run check` exits 0; `bun test libs/sources/` passes; `bun run sources register handbooks` exits 0 against the on-disk derivatives for all three handbooks.

## Out of scope

- Re-authoring the handbook ingestion pipeline. PR #242 (ADR 016 phase 0) already shipped a Python pipeline at `tools/handbook-ingest/` that fetches PDFs, extracts markdown / figures / tables, and writes the manifest. Phase 6 consumes that output.
- Per-paragraph registry entries. Paragraph identifiers (`.../para-2`) parse via `parseLocator` and resolve to the containing section. Same approach as Phase 3's paragraph descent.
- Figure / table content lookups. Figures and tables are addressable derivative files (`figures/fig-12-7-...png`, `tables/tbl-12-3-...html`); the renderer descends to them when a `@text` / `@quote` token binds. Phase 6 ingests metadata only.
- Cross-edition aliases. Handbooks rarely renumber within an edition letter; if 8083-25D introduces structural changes, that's a new doc slug entirely (no aliases, just a new ingest run). The cross-edition diff is Phase 5's job and only applies to corpora with calendar-year editions.
- The full FAA handbook catalog. Phase 6 covers PHAK + AFH + AvWX -- the three on disk today. Adding IFH, AIH, etc. is a follow-up that re-runs the same code path against new derivatives.

## Data Model

The registry shape is the same `SourceEntry` Phase 3 used. Per-handbook fields:

| Field | Value |
| --- | --- |
| `id` | `airboss-ref:handbooks/<doc>/<edition>/<chapter>(/<section>(/<subsection>)?)?` |
| `corpus` | `'handbooks'` |
| `canonical_short` | `'PHAK Ch.12.3'`, `'AFH Ch.5'`, `'AvWX Ch.3.2'` |
| `canonical_formal` | `'Pilot\'s Handbook of Aeronautical Knowledge (FAA-H-8083-25C), Chapter 12, Section 3'` |
| `canonical_title` | The section's title from `manifest.json` (e.g. `'Coriolis Force'`) |
| `last_amended_date` | `manifest.fetched_at` (the date the FAA published the PDF; we don't have section-level amendment dates for handbooks) |
| `lifecycle` | `'pending'` after ingest, `'accepted'` after batch promotion |

The `Edition` shape:

| Field | Value |
| --- | --- |
| `id` | `'8083-25C'` (edition slug, drops the `FAA-H-` prefix) |
| `published_date` | `manifest.fetched_at` parsed as ISO date |
| `source_url` | `manifest.source_url` (the FAA PDF URL) |

The locator shape (per ADR 019 §1.2):

```text
handbooks/<doc>/<edition>/<chapter>                              chapter
handbooks/<doc>/<edition>/<chapter>/<section>                    section
handbooks/<doc>/<edition>/<chapter>/<section>/<subsection>       subsection
handbooks/<doc>/<edition>/<chapter>/<section>/para-<N>           paragraph (resolves to section)
handbooks/<doc>/<edition>/<chapter>/intro                        chapter intro section
handbooks/<doc>/<edition>/fig-<N>-<M>                            figure (parses, no entry)
handbooks/<doc>/<edition>/tbl-<N>-<M>                            table (parses, no entry)
```

`<doc>` is one of `phak`, `afh`, `avwx` (extensible). `<edition>` is the FAA short-form (`8083-25C`, `8083-3C`, `8083-28B`); the on-disk directory uses the full FAA filename (`FAA-H-8083-25C/`), so the resolver maps short -> long with a constant.

`<chapter>` / `<section>` / `<subsection>` are integers. The locator path `phak/8083-25C/12/3` maps to manifest code `12.3` (dotted form). The body path comes from `manifest.body_path`.

## Cache + storage

ADR 018 governs storage. The handbook ingestion pipeline (PR #242) already wrote derivatives to the repo at `handbooks/<doc>/<edition>/`. Phase 6 reads those derivatives. Source PDFs live in `$AIRBOSS_HANDBOOK_CACHE/handbooks/` per ADR 018; Phase 6 does not touch them.

The only new in-repo file Phase 6 writes is the `manifest.json` it already reads -- no new derivatives.

## Phase boundary

Phase 6 ships as one PR. The changes are:

- New directory `libs/sources/src/handbooks/` with locator + citation + URL + derivative-reader + resolver + ingest + index + tests.
- One side-effect import added to `libs/sources/src/index.ts` (`import './handbooks/index.ts'`).
- One new CLI entry in `package.json` (`handbook-corpus-ingest`) and one new dispatcher (`scripts/handbook-corpus-ingest.ts`).
- One small fixture tree under `tests/fixtures/handbooks/`.
- Updates to the rollout tracker.

The PR does NOT modify Phase 1-5 code. Locator-parser tests for the `handbooks` corpus do not regress Phase 3 `regs` tests.

## Dependencies

- ADR 016 phase 0 (PR #242) -- handbook ingestion pipeline. **Required**: derivatives must exist at `handbooks/<doc>/<edition>/manifest.json`.
- Phase 1 (PR #241) -- validator + lesson-parser surface.
- Phase 2 (PR #246) -- registry core, lifecycle, corpus-resolver registration.
- Phase 3 (PR #247) -- exemplar pattern (`libs/sources/src/regs/` is the structural template).
- Phase 5 (PR #250) -- versioning + diff job is unaffected; handbooks editions are baked into the doc slug, so the diff job's calendar-year cadence does not apply.

No new external dependencies. `fast-xml-parser` is already in `libs/sources/package.json` (Phase 3); Phase 6 doesn't need it because the pipeline reads JSON, not XML.
