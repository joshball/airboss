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
| 3 | reference-cfr-ingestion-bulk | [WP](../../work-packages/reference-cfr-ingestion-bulk/) | #247 | 🟧 |
| 4 | reference-renderer-runtime | -- | -- | ⬜ |
| 5 | reference-versioning-tooling | -- | -- | ⬜ |
| 6 | reference-handbook-ingestion | -- | -- | ⬜ |
| 7 | reference-aim-ingestion | -- | -- | ⬜ |
| 8 | reference-ac-ingestion | -- | -- | ⬜ |
| 9 | reference-lesson-migration | -- | -- | ⬜ |
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

### Phase 4 -- reference-renderer-runtime

Renderer in `apps/study/`. Resolves identifiers at render time via `@ab/sources/render`. Performs token substitution (`@cite`, `@short`, `@formal`, `@title`, `@list`, `@as-of`, `@text`, `@quote`, `@last-amended`, `@deeplink`, `@chapter`, `@subpart`, `@part`). Applies render-mode rules per §3.1 (web, print, audio TTS, screen reader, plain-text export, RSS, share-card, RAG, Slack unfurl, transclusion, tooltip).

### Phase 5 -- reference-versioning-tooling

The annual rollover diff job. Compares editions in the registry, hash-compares normalized text, auto-advances lesson pins for unchanged sections, emits "needs human review" reports for changed sections.

### Phase 6 -- reference-handbook-ingestion

PHAK + AFH ingestion (handbooks corpus). Per ADR 018 cache pattern. Distinct from the ADR 016 handbook *reader* (which has its own ingestion landed in PR #242); Phase 6 here is about populating the `airboss-ref:` registry with handbook entries, reusing the ADR 016 ingestion's derivative output where possible.

### Phase 7 -- reference-aim-ingestion

AIM ingestion. After this, lessons can cite `airboss-ref:aim/5-1-7?at=2026-09`.

### Phase 8 -- reference-ac-ingestion

AC catalog ingestion. Full text where licensing permits. After this, lessons can cite `airboss-ref:ac/61-65/j`.

### Phase 9 -- reference-lesson-migration

One-pass migration of pre-ADR-019 lessons (Week 1 + 2 capstones currently use plain eCFR URLs / prose citations). Per ADR 019 §9 rules: parse existing eCFR URLs, generate identifiers, pin to the year of the lesson's last meaningful edit (read from git log), interactive review for ambiguous cases.

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
