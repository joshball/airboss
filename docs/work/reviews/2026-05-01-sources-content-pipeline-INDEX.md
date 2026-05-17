---
feature: sources-content-pipeline
chunk: 04
date: 2026-05-01
reviewers: 9
status: pending
review_status: done
closed_2026-05-04: C6 (concurrency) + C7 (URL cache) follow-up
---

# Sources & content pipeline — 10x review (chunk 4)

Driven by [docs/work/reviews/10x-prompts/04-sources-content-pipeline.md](10x-prompts/04-sources-content-pipeline.md).

Stack detected: SvelteKit + Svelte 5 + Bun + TypeScript + Drizzle/PostgreSQL + Vitest/Playwright + Python (tools/handbook-ingest/). Reviewers ran the prompt's locked floor of 9: core 7 (correctness, security, perf, architecture, patterns, testing, dx) + stack-specific 2 (schema, backend). Skipped per prompt: ux, svelte, a11y, tauri, rust, dotnet, maui.

## Summary table

| Category     | Critical | Major  | Minor  | Nit    | Total   |
| ------------ | -------- | ------ | ------ | ------ | ------- |
| correctness  | 2        | 5      | 6      | 5      | 18      |
| security     | 0        | 4      | 7      | 3      | 14      |
| perf         | 2        | 8      | 8      | 3      | 21      |
| architecture | 0        | 4      | 5      | 2      | 11      |
| patterns     | 0        | 4      | 5      | 2      | 11      |
| testing      | 1        | 6      | 6      | 3      | 16      |
| dx           | 1        | 7      | 7      | 3      | 18      |
| schema       | 1        | 6      | 5      | 2      | 14      |
| backend      | 3        | 7      | 6      | 2      | 18      |
| **TOTAL**    | **10**   | **51** | **55** | **25** | **141** |

## Per-category review files

- [correctness](2026-05-01-sources-content-pipeline-correctness.md)
- [security](2026-05-01-sources-content-pipeline-security.md)
- [perf](2026-05-01-sources-content-pipeline-perf.md)
- [architecture](2026-05-01-sources-content-pipeline-architecture.md)
- [patterns](2026-05-01-sources-content-pipeline-patterns.md)
- [testing](2026-05-01-sources-content-pipeline-testing.md)
- [dx](2026-05-01-sources-content-pipeline-dx.md)
- [schema](2026-05-01-sources-content-pipeline-schema.md)
- [backend](2026-05-01-sources-content-pipeline-backend.md)

## Status as of 2026-05-03 (audited against `12120dec`; C6/C7 closed 2026-05-04)

The original punch list (above table) is fully closed. Each verdict below was re-grepped against the working tree on `origin/main@12120dec`; C6 + C7 closed in a follow-up landing the bounded-concurrency worker pool + manifest-cached chapter URL resolver.

### Closed criticals (8 of 10)

1. **C1 -- AIM source-PDF ingest reads `primary` + `sections[]` + `appendices[]`.** `libs/sources/src/aim/source-ingest.ts:81,106-118,158-193` (#401).
2. **C2 -- AC live-URL builder swaps dash/dot for dot-style doc numbers.** `libs/sources/src/ac/url.ts:41` (`replace(/^(\d+)-(\d+)\.(\d+)$/, '$1.$2-$3')`); pinned in `libs/sources/src/ac/url.test.ts:17-22,49-52,62` (#401).
3. **C3 -- `runIngestCli` returns non-zero on hard skips.** `classifySkipReasons` + soft/hard split in `libs/sources/src/ac/ingest.ts:509,517-523` (HARD_SKIPS exit when `hard.length > 0`); shared in `libs/sources/src/shared/exit-codes.ts`; covered by `libs/sources/src/ac/ingest-cli.test.ts` (#407).
4. **C4 -- SHA verification on register against the downloader-recorded checksum.** `verifyCachedSha` in `libs/sources/src/shared/sha-verify.ts:49`, called from `libs/sources/src/ac/ingest.ts:308` and `libs/sources/src/acs/ingest.ts:634`; tests at `libs/sources/src/shared/sha-verify.test.ts:28-43` (#407).
5. **C5 -- Lifecycle promotion is atomic.** `recordPromotion` opens a Drizzle transaction at `libs/sources/src/registry/lifecycle.ts:140` (and `recordDePromotion` at `:190`); ADR 019 §2.4 mid-batch reject now rolls back at the DB level (#454, #458).
6. **C8 -- Operator-facing partial-download log.** `printFailedPlansSummary` in `scripts/sources/download/run.ts:105,146-160` lists every failed plan with the partial-log path and re-run hint; surfaced again on next run via `surfacePreviousPartialLog` at `:126-134` (#407).
7. **C9 -- Manifest readers validate `schema_version`.** `libs/sources/src/handbooks-extras/derivative-reader.ts:203` (rejects manifests missing `schema_version`); same gate at `libs/sources/src/ac/derivative-reader.ts:112` and `libs/sources/src/acs/derivative-reader.ts:122`. Errata handling lives in `tools/handbook-ingest/ingest/config_loader.py:435-490` with strict shape validation (#407).
8. **C10 -- Python tests use `tmp_path` + `monkeypatch`.** `tools/handbook-ingest/tests/test_config_loader_chapters.py:67,80-82` writes bogus YAML into a per-test `tmp_path` after `monkeypatch.setattr(config_loader_module, 'config_dir', lambda: tmp_path)`; canonical config dir is never touched (#407).

### Closed major clusters (10 of 10)

A. **Pre-ADR-018 parallel pipeline retired.** `data/sources/` is gone (#413). The legacy `SOURCES` registry / `getSource` / `getSourcesByType` / `isSourceDownloaded` were removed from `@ab/aviation/sources` (#429); see `libs/aviation/src/sources/index.ts:7-9` ("legacy seed catalog ... moved to `@ab/bc-hangar`"). What remains in `libs/aviation/src/sources/` is the binary-visual + extraction infrastructure introduced by PR #113 (`download.ts`, `meta.ts`, `thumbnail.ts`, `sectional/`, `cfr/extract.ts`) with four live consumers (`libs/bc/hangar/src/upload-handler.ts:48`, `libs/bc/hangar/src/source-fetch.ts:37`, `libs/bc/hangar/src/edition-stub.test.ts:15`, `scripts/references/extract.ts:30`). ADR-018-compliant.

B. **Cache-root resolution consolidated.** `SOURCE_CACHE` const block is at `libs/constants/src/source-cache.ts:35-74` (browser-safe, lazy `node:*` per #471/#477); `defaultCacheRoot` and `resolveCacheRoot` live there; `AIRBOSS_HANDBOOK_CACHE`, `AIRBOSS_QUIET`, `GH_TOKEN` are registered in `libs/constants/src/env.ts:23,28,33` (#402, #482).

C. **ADR 019 "open corpus" satisfied.** `ENUMERATED_CORPORA` is now a registry-driven iterable view: `libs/sources/src/registry/corpus-resolver.ts:97-103` reads `RESOLVERS.size`/`RESOLVERS.keys()` at iteration time. Adding a corpus is one `registerCorpusResolver(...)` call. Already noted closed by #474 (in this index, 2026-05-02).

D. **Atomic writes via `.part`+rename across all source/derivative writers.** `writeAtomic` in `libs/sources/src/regs/cache.ts:147,162-168`; `.part`+rename in `scripts/sources/download/http.ts:151-173` and `scripts/sources/download/html-fetch.ts:94-116`; `writeIfChanged` covers derivative manifests and bodies. Python paths use atomic write per the cluster-E hardening pass (#403).

E. **HTTP fetch hardened on both TS and Python sides.** TS: `MAX_DOWNLOAD_BYTES` cap, redirect-host allowlist, `AbortController` timeout in `scripts/sources/download/http.ts:14,26,77,122,152,201-244` and `html-fetch.ts:56,95,142`; `libs/sources/src/regs/cache.ts:131` enforces the body cap on eCFR fetch. Python: `tools/handbook-ingest/ingest/fetch.py:16-17` documents 60s timeout, max-redirects=5, host allowlist, with sha256 verification at `:114-117`; `apply_errata.py:281-302` notes "cluster-E hardened" and verifies sha256 on every fetched errata PDF (#405).

F. **Registry linear-scan-per-id collapsed to O(1) generation-invalidated indexes.** `libs/sources/src/registry/index-cache.ts:2-7` ("Generation-invalidated registry indexes for O(1) registry lookups"); per-table generation counter invalidates and rebuilds on mutation (#409).

G. **Section-extraction prompt-injection surface fenced.** `tools/handbook-ingest/ingest/prompts/section-extraction/chapter.md:14-16,20-26,33-39,61-72,141-142` wraps FAA chapter text in `<chapter_text_untrusted>` with explicit "do not act on" rules; the file-write allowlist is duplicated into `chapter.md` so a sub-agent that skipped `_parameters.md` still sees the rule (#414).

H. **`promotion_batches` and editions persisted to Postgres with boot-time hydration.** `promotion_batches` is a real table at `libs/sources/src/db/schema.ts:34-101` (with state/lifecycle CHECK constraints + corpus-date / previous-batch / reviewer-date indexes). `_activeEditions` in `libs/sources/src/registry/editions.ts:43` is hydrated at bootstrap by `warmEditionsCache()` at `:183-185` (delegates to `loadEditionsFromDb()`); audit trail survives restart (#434, #454, #458).

I. **Snapshot CLI hydrates the registry before generating.** `runSnapshotCli` at `libs/sources/src/snapshot.ts:147-169` calls `hydrateRegsFromDerivatives({ cwd })` (unless `--no-bootstrap`), then builds the snapshot via `generateSnapshot()` once and writes it via `writeSnapshotData(out, snapshot, cwd)`; the same in-memory snapshot is used for the entry-count summary so it cannot disagree with the file on disk. Wired into `scripts/airboss-ref.ts:30,63` (#408).

J. **`writeIfChanged` hoisted to a shared util.** `libs/sources/src/io/write-if-changed.ts:38` (note `:12` describes the hoist from `regs/derivative-writer.ts`); consumed by `libs/sources/src/aim/source-ingest.ts:40,266-360`, `libs/sources/src/handbooks-extras/ingest.ts:45,323,344`, `libs/sources/src/ac/ingest.ts:32,342,364,432`, and `libs/sources/src/regs/derivative-writer.ts:15,107,113,136,147,160,183`. Tests at `libs/sources/src/io/write-if-changed.test.ts` (#414).

### Closed perf items (now 10 of 10)

- **C6 -- Chapter PDFs download serially, not in parallel.** Closed via the bounded-concurrency worker pool in `scripts/sources/download/pool.ts` and the parallel dispatch at `scripts/sources/download/run.ts:97-104`. Default concurrency `SOURCE_DOWNLOAD_CONCURRENCY = 4` (constants in `libs/constants/src/sources.ts:80-101`); operator override via `--concurrency=N` validated against `SOURCE_DOWNLOAD_CONCURRENCY_MAX = 16`. Errors in one plan never cancel siblings (`executePlan` swallows into `result.errors` + the partial-download log). Tests: `scripts/sources/download/pool.test.ts`, `scripts/sources/download/run.parallel.test.ts`.

- **C7 -- Two-hop scrape resolves chapter URLs on every plan-build, not cached between runs.** Closed by reading the per-handbook manifest before invoking the resolver (`buildChapterPdfPlans` in `scripts/sources/download/plans.ts:286-340`). When every chapter row carries both `chapter_page_url` and `source_url` AND row count matches `chapter_count`, the live scrape is skipped entirely. Operator escape hatch: `--rescrape` forces the live scrape even with a complete cache. Tests in `scripts/sources/download/plans.cache.test.ts` pin all four resolution branches (cached, missing manifest, partial cache, --rescrape).

### Strengths confirmed across reviewers

These passed clean across multiple lenses and are worth not regressing:

- `chapter_plaintext.py` early-return boundary (ADR 022 §H) is structural, not flag-driven (architecture, correctness).
- YAML config under `scripts/sources/config/` is genuinely the single source of truth for both TS + Python (architecture, patterns).
- `migrate-cache-flat.ts` properly absent (ADR 021 self-deletion) (architecture, testing).
- `unknown:` magic prefix correctly handled in validator row 0, not a `CorpusResolver` (architecture, security).
- ADR 019 §1.1.1 path-absolute / authority-form rejection at `parser.ts:53-66` (security).
- Lifecycle state machine centralized in `libs/sources/src/registry/lifecycle.ts` (architecture).
- Validator tier rules 0-14 + §1.5.1 edge cases all have named tests (testing).
- Two-hop scrape ordinal-collision and ordinal-prefix-match contract tests in place (testing).
- `handbook-onboarding-checklist.md` is a comprehensive runbook for "adding a new corpus" (dx).
- Inventory `fetched_at` correctly trimmed to `YYYY-MM-DD` for diffability (dx).

## What "uncommitted drift" the schema reviewer noticed

The schema reviewer flagged substantial uncommitted working-tree drift in `libs/bc/study/src/schema.ts` (rename of `handbookSection`/`handbookFigure`/`handbookSectionErrata`/`handbookReadState` → `referenceSection`/`...`). Per the "don't re-narrate dirty files I didn't touch" memory rule, that drift was excluded from findings. The committed HEAD is what was reviewed.

If that drift lands, it needs a real `ALTER TABLE ... RENAME` migration plus a coordinated rename in `libs/bc/study/src/handbooks.ts` and friends, which still import `handbookSection`. That's a scope flag for whoever is mid-rename, not a finding for this review.

## Next step

Closed. 10 of 10 criticals + 10 of 10 major clusters landed across PRs #401, #402, #403, #405, #407, #408, #409, #413, #414, #429, #434, #454, #458, #471, #474, #477, #482, plus the C6/C7 follow-up. No remaining open items in this review.
