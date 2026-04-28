# ADR 019 rollout tracker

Tracks the implementation of [ADR 019 -- Reference Identifier System](../../decisions/019-reference-identifier-system/decision.md) across all 10 phases. One row per phase. Updated as each phase ships.

Companion to:

- [ADR 019 §8](../../decisions/019-reference-identifier-system/decision.md) -- the phase plan itself
- [revisit.md](../../decisions/019-reference-identifier-system/revisit.md) -- deferred items with concrete triggers
- [docs/work/NOW.md](../NOW.md) -- "what's active right now" (this doc is "what's left across all phases")

## Status legend

- ⬜ Not started
- 🟨 Work package authored, awaiting implementation
- 🟧 Implementation in progress
- ✅ Shipped (PR merged)
- ⚪ Deferred / dropped (see revisit.md)

## Phases

| # | Phase | WP | PR | Status |
| - | --- | --- | --- | --- |
| 1 | reference-identifier-scheme-validator | [WP](../../work-packages/reference-identifier-scheme-validator/) | #240 (WP), #241 (impl) | ✅ |
| 2 | reference-source-registry-core | [WP](../../work-packages/reference-source-registry-core/) | #246 | ✅ |
| 3 | reference-cfr-ingestion-bulk | [WP](../../work-packages/reference-cfr-ingestion-bulk/) | #247 | ✅ |
| 4 | reference-renderer-runtime | [WP](../../work-packages/reference-renderer-runtime/) | #249 | 🟧 |
| 5 | reference-versioning-tooling | [WP](../../work-packages/reference-versioning-tooling/) | -- | 🟨 |
| 6 | reference-handbook-ingestion | [WP](../../work-packages/reference-handbook-ingestion/) | #251 | ✅ |
| 7 | reference-aim-ingestion | [WP](../../work-packages/reference-aim-ingestion/) | #251 (WP), #261 (this PR -- Lane B end-to-end) | 🟧 |
| 8 | reference-ac-ingestion | -- | #261 | ✅ |
| 9 | reference-lesson-migration | -- | (this PR) | 🟧 |
| 10 | reference-irregular-corpora | -- | -- | ⬜ |

## Per-phase notes

### Phase 1 -- reference-identifier-scheme-validator ✅

Shipped. New `@ab/sources` lib at `libs/sources/` with parser, validator, lesson-parser, registry-stub. Integrated into `bun run check`. 77 tests pass. The publish gate is real.

### Phase 2 -- reference-source-registry-core

Replaces the `NULL_REGISTRY` stub with the real registry implementation in `@ab/sources`. Ships:

- The typed `SOURCES` constants table (initially empty; corpora populate via Phases 3, 6, 7, 8, 10)
- Per-corpus `CorpusResolver` registration mechanism (parseLocator, formatCitation, getCurrentEdition, etc.)
- The query API surface (resolveIdentifier, hasEntry, getChildren, walkSupersessionChain, findLessonsCitingEntry, etc.)
- The `--fix` mode for `bun run check` that auto-stamps `?at=<currentAccepted>` on unpinned identifiers (per ADR 019 §1.3)
- The lifecycle state machine implementation (`draft` / `pending` / `accepted` / `retired` / `superseded` per §2.4)
- The `promotion_batches` audit trail (per §2.4 atomic batch promotion)
- The JSON snapshot generator for non-TypeScript consumers (per §2.5)

Phase 1 swap: one-line change in `scripts/check.ts` from `NULL_REGISTRY` to `productionRegistry`.

### Phase 3 -- reference-cfr-ingestion-bulk

Full eCFR ingestion pipeline. Walks the eCFR XML for:

- Title 14 -- whole Title (every Part the Versioner ships)
- 49 CFR Part 830 (NTSB)
- 49 CFR Part 1552 (TSA)

Ingestion writes section-level `SourceEntry` records (plus subpart + Part overview entries), records the edition into `EDITIONS`, writes derivatives to `regulations/cfr-<title>/<YYYY-MM-DD>/`, and atomic-batch-promotes the entries to `accepted` under reviewer `phase-3-bulk-ingestion`. Source XML lives in `$AIRBOSS_HANDBOOK_CACHE/regulations/cfr-<title>/<YYYY-MM-DD>/` per ADR 018 (gitignored + dormant LFS plumbing).

After Phase 3 lands, lessons can write `[@cite](airboss-ref:regs/cfr-14/91/103?at=2026)` and the validator resolves it without ERROR.

### Phase 4 -- reference-renderer-runtime 🟧

Renderer at `libs/sources/src/render/` (the `@ab/sources/render` API), plus a SvelteKit server-load helper and Svelte 5 component in `apps/study/`. Resolves identifiers at render time, performs token substitution, applies adjacency-merge per §1.4, attaches acknowledgment annotations per §3.4 + §6.3, and emits the §3.1 render-mode surface.

Shipped surface:

- Public API: `extractIdentifiers`, `batchResolve`, `substituteTokens` -- plus `registerToken` / `getToken` / `listTokens` (open token set per §3.1) and `toSerializable` / `fromSerializable` (SvelteKit transport).
- 12 default tokens registered eagerly: `@short`, `@formal`, `@title`, `@cite`, `@list`, `@as-of`, `@text`, `@quote`, `@last-amended`, `@deeplink`, `@chapter`, `@subpart`, `@part`.
- 4 production-quality modes: `web`, `plain-text`, `print`, `tts`.
- 7 forward-compatible modes (documented surfaces): `screen-reader`, `rss`, `share-card`, `rag`, `slack-unfurl`, `transclusion`, `tooltip`.
- Adjacency-merge: contiguous numeric runs render as `§91.167-91.169`; non-contiguous render as `§91.167, §91.169, §91.171`; mixed corpus or pin -> no merge.
- Acknowledgment cascade: `historical_lens`, per-target ack with `historical: true`, ack with `superseder` matching chain end (`covered`), ack with chain advanced past `superseder` (`chain-advanced`), cross-corpus chain (`cross-corpus`).
- SvelteKit `loadLessonReferences` server helper + `<RenderedLesson>` component (Svelte 5 runes, `{@html}`).
- Demo route at `/references` under `apps/study/(dev)/` with three fixture lessons + mode-toggle UI.

Coverage: 366 tests (libs/sources) + 6 tests (apps/study/lib/server/references); all 2393 project tests pass.

### Phase 5 -- reference-versioning-tooling 🟨

The annual rollover diff job. Compares editions in the registry, hash-compares normalized text, auto-advances lesson pins for unchanged sections, emits "needs human review" reports for changed sections.

Shipped surface (per [WP](../../work-packages/reference-versioning-tooling/)):

- `libs/sources/src/diff/` -- pair walker, body hasher, alias resolver, diff orchestrator, lesson rewriter, CLI runners, unified-diff helper.
- Two new subcommands on `bun run airboss-ref`:
  - `diff [--corpus=<c>] [--edition-pair=<old>,<new>] [--out=<path>] [--fixture-pair=<a>,<b>]` -- walks edition pairs, partitions into nine `DiffOutcomeKind` values (auto-advance, needs-review, alias-silent / -content / -cross / -split / -merge, missing-old, missing-new), writes JSON report to `data/sources-diff/`, prints stdout summary.
  - `advance --report=<path>` -- consumes a JSON report, rewrites lesson `?at=` pins for auto-advance candidates. Refuses to run on a dirty git tree. Idempotent.
- `tests/fixtures/cfr/title-14-2027-fixture.xml` -- a 5-section sibling of the 2026 fixture covering byte-identical (auto-advance) and amended (needs-review) cases.
- Validator row-6 round-trip: a synthetic two-edition-stale lesson produces row-6 WARNING; after `advance` rewrites the pin, the warning clears.
- 50 new tests in `libs/sources/src/diff/`; 416 total tests in `libs/sources/` pass.

### Phase 6 -- reference-handbook-ingestion 🟧

PHAK + AFH + AvWX corpus registration. Reuses ADR 016 phase 0 (PR #242) derivative output: that pipeline writes per-handbook `manifest.json` + per-section markdown to `handbooks/<doc>/<faa-dir>/`; Phase 6 reads those manifests and populates the `airboss-ref:` registry with chapter / section / subsection entries.

Shipped surface:

- `libs/sources/src/handbooks/` -- locator parser, citation formatter, FAA URL builder, derivative reader, resolver, ingest CLI.
- `handbooks` `CorpusResolver` registered via side-effect import in `libs/sources/src/index.ts`.
- New CLI `bun run sources register handbooks --doc=<phak|afh|avwx> --edition=<...>` that walks the existing manifest and emits one `SourceEntry` per chapter / section / subsection. Idempotent; re-run is a no-op.
- 78 new tests in `libs/sources/src/handbooks/`; 494 total tests in `libs/sources/` pass.
- Real-tree ingest counts: PHAK 850 entries, AFH 531 entries, AvWX 480 entries.
- Smoke test proves `[@cite](airboss-ref:handbooks/phak/8083-25C/12/3)` resolves with zero ERROR after ingest.

Out of scope and deferred:

- Re-authoring the PDF -> derivative pipeline (PR #242 owns that; Phase 6 is registration-only).
- Per-paragraph registry entries (paragraph identifiers parse correctly via `parseLocator` and resolve to the containing section, mirroring Phase 3's CFR paragraph treatment).
- Per-figure / per-table registry entries (figures and tables parse correctly via `parseLocator` but have no `SourceEntry`; the renderer descends to the derivative file when `@text` / `@quote` is bound).
- Cross-edition aliases (handbooks rarely renumber within a letter revision; new editions ship as new doc slugs entirely, e.g. 8083-25D).

### Phase 7 -- reference-aim-ingestion 🟧

AIM ingestion. After this, lessons can cite `airboss-ref:aim/5-1-7?at=2026-04`.

Lane B (this PR) extends the original Phase 7 scaffolding (resolver + locator + manifest-walk ingest, originally landed against a hand-authored fixture) with the **live PDF -> derivatives -> registry** pipeline. The cached AIM PDF at `$AIRBOSS_HANDBOOK_CACHE/aim/<edition>/source.pdf` is now the input; running `bun run sources register aim --cache=...` extracts the structured tree and registers entries in one command.

Shipped surface:

- `libs/sources/src/aim/extract.ts` -- PDF -> structured `ExtractedAim` tree. TOC-driven parser: locates the AIM Table of Contents, parses `Chapter N. Title` / `Section M. Title` / `N-M-K. Title` entries (handling multi-line title wrap), then walks the body to capture paragraph text between headings. Glossary entries (uppercase term followed by U+2212) and appendices come from the body walk.
- `libs/sources/src/aim/source-ingest.ts` -- orchestrator. Discovers cached PDFs, calls `extractAim`, writes the manifest + per-entry markdown files in the layout `derivative-reader.ts` expects (`aim/<edition>/chapter-N/section-M/paragraph-K.md`, `glossary/<slug>.md`, `appendix-N.md`), then calls `runAimIngest` to register entries.
- Existing `runAimIngest` (manifest-walk) is unchanged; it continues to work against fixture trees and is the registration step the new orchestrator delegates to.
- `bun run sources register aim --cache=<path>` triggers the source-ingest path; `--edition=<YYYY-MM>` alone keeps the legacy manifest-walk path.
- Smoke tests cover AIM-alone (section-level), AIM-paragraph (full hierarchy), and cross-corpus (AIM + regs in one lesson, both validate clean).

First real-tree run: AIM 2026-04 (FAA aim.pdf, 732 pages) -> 10 chapters, 37 sections, 396 paragraphs, 3 appendices, 298 glossary entries = **744 SourceEntries** registered, 2 glossary entries skipped (`CLASS E AIRSPACE` and `VISUAL APPROACH SLOPE INDICATOR` - column-wrap layouts that emptied their bodies). Derivative tree (~4.2 MB) committed inline per ADR 018.

Locator shapes covered (per ADR 019 §1.2):

```text
airboss-ref:aim/<chapter>?at=YYYY-MM
airboss-ref:aim/<chapter>-<section>?at=YYYY-MM
airboss-ref:aim/<chapter>-<section>-<paragraph>?at=YYYY-MM
airboss-ref:aim/glossary/<slug>?at=YYYY-MM
airboss-ref:aim/appendix-<N>?at=YYYY-MM
```

Out of scope and deferred:

- Per-glossary-term structured content beyond the title and body markdown.
- Sub-paragraph identifiers (the ADR 019 §1.2 "AIM" spec stops at paragraph granularity).
- Cross-edition aliases (Phase 5's diff job catches silent paragraph rewrites).
- Chapter / section overview prose in the body (the heading line is captured but the body extractor does not yet bucket the inter-paragraph chapter intro into the chapter's `index.md`; the existing files are placeholder titles).

### Phase 8 -- reference-ac-ingestion

AC catalog ingestion. Full text where licensing permits. After this, lessons can cite `airboss-ref:ac/61-65/j`.

### Phase 9 -- reference-lesson-migration 🟧

One-pass migration of pre-ADR-019 lessons (Week 1 + 2 capstones use plain eCFR URLs / prose citations). Per ADR 019 §9 rules: parse existing eCFR URLs, generate identifiers, pin to the year of the lesson's last meaningful edit (read from git log), interactive review for ambiguous cases.

Shipped surface (this PR):

- `scripts/migrate-lessons.ts` -- per-lesson eCFR URL discovery + rewrite. Walks the configured lesson roots, finds Markdown links whose URL matches `https://www.ecfr.gov/current/...`, maps each to the corresponding `airboss-ref:regs/...` identifier, and rewrites the link's URL in place. Pin = the year of the lesson's most recent commit (from `git log --follow --pretty=%aI`); fallback = the corpus's current accepted edition (`2026`).
- `libs/sources/src/bootstrap.ts` -- runtime registry hydration from on-disk derivatives. Reads `regulations/cfr-<title>/<edition>/manifest.json` + `sections.json`, synthesizes per-Part + per-Section `SourceEntry` records, registers editions, atomic-batch promotes to `accepted` under reviewer `phase-9-bootstrap`. Idempotent. Wired into `validateReferences` so `bun run airboss-ref` resolves migrated identifiers in the validator without requiring a fresh ingest pass at every check. Bootstrap is opt-out via `bootstrap: false` for tests passing an explicit registry.
- `libs/sources/src/bootstrap.test.ts` -- five unit tests covering empty-tree, single-edition, idempotence, multi-edition (Title 14 + Title 49), and partial-fixture skip.
- ADR 019 §9 scope choices: catalog-index URLs (Title 14 root, AIM html catalog, AC index, Chief Counsel index) have no `airboss-ref:` mapping (§1.2 requires at least a Part for `regs`); the migrator surfaces them in the skipped list and leaves them as plain links. Bare-prose section citations (`§91.103`, `61.51(b)(1)`) stay as prose per ADR 019 §9 ("the migration tool offers a 'leave as prose' option") -- promoting prose mentions to identifiers is per-lesson editorial work that a future pass can handle one lesson at a time.

Migration inventory:

| Status          | Count | Notes                                                                                                                                    |
| --------------- | ----- | ---------------------------------------------------------------------------------------------------------------------------------------- |
| Migrated        |     3 | `https://www.ecfr.gov/.../part-91` x2 -> `airboss-ref:regs/cfr-14/91?at=2026`; `.../part-830` x1 -> `airboss-ref:regs/cfr-49/830?at=2026` |
| Skipped         |     4 | `https://www.ecfr.gov/current/title-14` (Title-only; no Part/Section to pin to)                                                          |
| Lessons touched |     3 | `01-title-14-shape.md`, `02-how-to-read-a-citation.md`, `03-companion-documents.md`                                                      |
| Lessons scanned |    25 | All `course/regulations/**/*.md`                                                                                                         |

Bare-prose citation handling: hundreds of `§91.103`-style mentions across all 25 lessons stay as prose. They're typically explanatory or categorical ("the §91.103 family of rules", "Subpart B", "91.155 - 91.159"). Mechanical rewrites would mis-pin or over-link these; promotion to identifiers is editorial.

### Phase 10 -- reference-irregular-corpora

Per-corpus WPs for everything that doesn't have a clean bulk-ingestion target: NTSB Board orders, Chief Counsel letters, FAA Orders, sectionals, plates, ACS/PTS, FAA forms, InFOs, SAFOs, TCDS, ASRS reports. Each ships its own resolver + bulk-fetch or hand-curated catalog.

## Critical-path observations

The load-bearing chain is **1 → 2 → 3 → 4 → 9** (validator → registry → CFR ingestion → renderer → migration). Each unlocks the next.

Phases 5, 6, 7, 8, 10 can run in parallel after Phase 2 lands -- they each unlock a different corpus or capability but don't compete on shared files.

## Update log

| Date | Phase | Action |
| ---- | ----- | ------ |
| 2026-04-27 | 1 | Validator + WP shipped (PRs #240, #241). |
| 2026-04-27 | -- | Rollout tracker created. |
| 2026-04-27 | 2 | Registry core + --fix mode shipped (PR #246). |
| 2026-04-27 | 3 | CFR bulk ingestion WP authored + implementation (PR #247). |
| 2026-04-27 | 6 | Handbook corpus shipped (PR #251). |
| 2026-04-27 | 7 | AIM corpus WP authored + implementation (this PR). |
| 2026-04-27 | -- | Downloader fix: corrected URLs (AC 120-71B, AC 91.21-1D, ACS path), browser User-Agent, eCFR per-title `latest_amended_on` auto-detect, descriptive cached filenames + `source.<ext>` symlink, HEAD-then-skip cache check, `--verify` audit mode (follow-up to PR #253). |
| 2026-04-27 | -- | Unified ingest dispatcher: `scripts/sources/register.ts` replaces `cfr-ingest.ts` / `handbook-corpus-ingest.ts` / `aim-corpus-ingest.ts`. Single entry point `bun run sources register <corpus>` with `--all`, `--help`, and per-corpus `--help`; per-corpus runner code in `libs/sources/src/<corpus>/ingest.ts` is unchanged. |
| 2026-04-28 | 3 | Lane A landed: CFR Title 14 (226 parts, 6,328 sections at edition `2026-04-22`) + Title 49 aviation slice (parts 1552 + 830, 22 sections at `2026-04-20`). Structural index (`manifest.json` + `sections.json`) committed; per-section body markdown gitignored per ADR 018 scale-tier exception. PR #260. |
| 2026-04-28 | 8 | Lane C landed: AC corpus module (`libs/sources/src/ac/`) -- locator, resolver, citation, URL, derivative-reader, ingest. URI shape `airboss-ref:ac/<doc>/<rev>` with `?at=YYYY-MM-DD`; unrevisioned ACs rejected per §1.2. Live ingest produced 9 ACs (00-6B, 120-71B, 25-7D, 61-65J, 61-83J, 61-98D, 90-66C, 91-21.1D, 91-79A); 3 skipped with explicit reasons (60-22 + 91-92 unrevisioned, 150/5210-7D slash-style not yet supported). Wired through `bun run sources register ac`. Smoke tests cover AC alone + cross-corpus (ac + regs in one lesson). |
| 2026-04-28 | 7 | Lane B landed: AIM source-PDF ingestion end-to-end. New `libs/sources/src/aim/extract.ts` (TOC-driven PDF parser) + `source-ingest.ts` (orchestrator: discover -> extract -> write derivatives -> register). `bun run sources register aim --cache=<path>` now drives the full pipeline; existing `runAimIngest` manifest-walk path unchanged. Live ingest of AIM 2026-04 (732 pages): 744 SourceEntries (10 chapters / 37 sections / 396 paragraphs / 3 appendices / 298 glossary entries); 2 glossary entries skipped (CLASS E AIRSPACE, VISUAL APPROACH SLOPE INDICATOR -- column-wrap layouts emptied bodies). Derivative tree (~4.2 MB) committed inline per ADR 018. Smoke tests cover AIM alone (section), AIM paragraph, and cross-corpus (aim + regs). |
| 2026-04-28 | 10 | Lane D landed: ACS corpus PPL-ASEL slice (`libs/sources/src/acs/` adds `derivative-reader.ts`, `ingest.ts`, `smoke.test.ts`). URI shape `airboss-ref:acs/<cert>/<edition>/area-<roman>/task-<letter>/element-<triad><ord>` per ADR 019 §1.2; ingest writes per-task body markdown to `<repo>/acs/<cert>/<edition>/area-<roman>/task-<letter>.md` with element bodies sliced out by code (`PA.I.A.K1`) on resolve. Live ingest produced 1 publication (`ppl-asel/faa-s-acs-6c`) + 12 areas + 61 tasks + 529 elements = 603 entries; promoted under `phase-9-acs-ingestion`. Other ACS cert families (FAA-S-ACS-7/8/11/25) parse and skip with explicit reasons until Open Question 7 (final ACS locator convention) resolves or a sibling lane wires them in. Wired through `bun run sources register acs`. Smoke tests cover ACS task + ACS element + cross-corpus (acs + regs in one lesson). |
| 2026-04-28 | 9 | Phase 9 lesson migration shipped (this PR). New `scripts/migrate-lessons.ts` rewrites eCFR-URL Markdown links to `airboss-ref:regs/...` URIs pinned to the lesson's most recent commit year; bare-prose section citations stay as prose per ADR 019 §9. New `libs/sources/src/bootstrap.ts` hydrates the runtime `regs` registry from on-disk `manifest.json` + `sections.json` (synthesizes Part-level entries, registers editions, atomic-batch promotes to `accepted` under `phase-9-bootstrap`); wired into `validateReferences` so migrated identifiers resolve cleanly without an explicit ingest step at every check. Inventory: 3 identifiers migrated across 3 lessons (Week 1: title-14-shape, citation, companion-documents); 4 catalog-index URLs (Title 14 root) skipped with explicit reasons; 25 lessons scanned. `bun run airboss-ref` post-migration: 25 lessons / 3 identifiers / 0 findings. |
