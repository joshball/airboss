---
feature: sources-content-pipeline
chunk: 04
date: 2026-05-01
reviewers: 9
status: pending
review_status: done
---

# Sources & content pipeline — 10x review (chunk 4)

Driven by [docs/work/reviews/10x-prompts/04-sources-content-pipeline.md](10x-prompts/04-sources-content-pipeline.md).

Stack detected: SvelteKit + Svelte 5 + Bun + TypeScript + Drizzle/PostgreSQL + Vitest/Playwright + Python (tools/handbook-ingest/). Reviewers ran the prompt's locked floor of 9: core 7 (correctness, security, perf, architecture, patterns, testing, dx) + stack-specific 2 (schema, backend). Skipped per prompt: ux, svelte, a11y, tauri, rust, dotnet, maui.

## Summary table

| Category     | Critical | Major | Minor | Nit | Total |
| ------------ | -------- | ----- | ----- | --- | ----- |
| correctness  | 2        | 5     | 6     | 5   | 18    |
| security     | 0        | 4     | 7     | 3   | 14    |
| perf         | 2        | 8     | 8     | 3   | 21    |
| architecture | 0        | 4     | 5     | 2   | 11    |
| patterns     | 0        | 4     | 5     | 2   | 11    |
| testing      | 1        | 6     | 6     | 3   | 16    |
| dx           | 1        | 7     | 7     | 3   | 18    |
| schema       | 1        | 6     | 5     | 2   | 14    |
| backend      | 3        | 7     | 6     | 2   | 18    |
| **TOTAL**    | **10**   | **51**| **55**| **25**| **141** |

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

## Highest-priority findings (cross-reviewer convergence)

These are issues that more than one reviewer flagged independently, or single-reviewer findings that block correctness today.

### Critical — silent partial-success / data integrity

1. **AIM source-PDF ingest path is silently broken.** correctness#1: `libs/sources/src/aim/source-ingest.ts` reads `entries[]` from `aim/manifest.json`, but ADR 021/022 + the downloader use `primary` + `sections[]` + `appendices[]` — no `entries[]`. `bun run sources register aim` emits "missing entries[] array" and skips everything.
2. **AC live-URL builder produces wrong URL for dot-style doc numbers.** correctness#2: `91-21.1D` → `AC_91-21.1D.pdf` while FAA serves `AC_91.21-1D.pdf`. Confirmed against `scripts/sources/config/ac.yaml:62`.
3. **AC/ACS/AIM `runIngestCli` always return 0 even when extraction errors land in `skipReasons`.** backend#1: silent partial advance.
4. **No SHA verification in register paths against the downloader-recorded checksum.** backend#2: cache poisoning advances state silently.
5. **Lifecycle promotion is non-atomic with SOURCES/EDITIONS table mutations.** backend#3: ADR 019 §2.4 atomicity violated when `recordPromotion` rejects mid-batch.
6. **Chapter PDFs download serially, not in parallel.** perf#1: ADR 022's wall-clock-parity claim is unrealized — `for (const plan of corpusPlans) { await executePlan(...) }` in `scripts/sources/download/run.ts:88-91` and `execute.ts:24`.
7. **Two-hop scrape resolves chapter URLs serially and pays the cost on every plan-build.** perf#2: 1+chapterCount sequential GETs per handbook, not cached in the manifest.
8. **Partial-download state recovery has no operator-facing log.** dx#1: a chapter PDF failing mid-run leaves no failed-plan list and no resume hint.
9. **`handbookManifestSchema` Zod silently strips `schema_version` and `errata[]`.** schema#1: every shipped manifest carries those fields; malformed errata entries pass the gate.
10. **3 Python tests in `tools/handbook-ingest/tests/test_config_loader_chapters.py` write `bogus*.yaml` into the production canonical config dir.** testing#1: an interrupted run, `pytest -x --pdb` quit, or `pytest -n auto` race poisons the real downloader.

### Major — convergent cross-reviewer themes

These are root-cause clusters where multiple reviewers landed on the same architectural seam. Per CLAUDE.md, fix the root once, not N times.

**A. Pre-ADR-018 parallel pipeline still alive at `data/sources/` + `libs/aviation/src/sources/registry.ts` + `scripts/references/extract.ts`.**

- architecture#1 (major): direct ADR 018 violation; hangar BC actively writes there.
- architecture#4 (major): 15 inline `data/sources/` string literals violate no-magic-strings.
- patterns#4 (major): `scripts/README.sources.md:155` still tells operators to edit retired `AC_TARGETS`/`ACS_TARGETS`/`HANDBOOKS_EXTRAS_TARGETS`/`AIM_PDF_URL` constants in `plans.ts`.
- schema partial: legacy `SOURCES` export from `@ab/aviation/sources` overlaps with ADR 019 `@ab/sources/registry`.
- Decision needed: retirement WP, or ADR amendment carving out the binary-visual tier. **No undecided-future-work allowed** (CLAUDE.md).

**B. `defaultCacheRoot()` / `AIRBOSS_HANDBOOK_CACHE` resolution duplicated 5+ ways.**

- patterns#1 (major): cache-root path duplicated across 5 ingest modules + `scripts/lib/cache.ts`.
- patterns#2 (major): `AIRBOSS_HANDBOOK_CACHE`, `AIRBOSS_QUIET`, `GH_TOKEN` missing from central `ENV_VARS` registry.
- architecture minor: 5-way duplication of `defaultCacheRoot()` across regs/ac/acs/handbooks-extras/aim.
- correctness minor: 4 of those helpers don't expand `~` in `AIRBOSS_HANDBOOK_CACHE`.
- Fix once: one `SOURCE_CACHE` const block + one `resolveCacheRoot()` helper + register the env vars.

**C. ADR 019 "open corpus" promise broken.** **Closed (verified 2026-05-02).**

- architecture#2 (major): `ENUMERATED_CORPORA` was a closed array. **Closed**: `libs/sources/src/registry/corpus-resolver.ts:97` is now a live iterable view that reads `RESOLVERS.size` / `RESOLVERS.keys()` at iteration time. `BOOTSTRAP_CORPORA` is a pre-registration convenience for the validator's row-1 check; the real source of truth is `registerCorpusResolver`. Test `corpus-resolver.test.ts` CR-08 pins this: a fake corpus registered mid-test shows up in `ENUMERATED_CORPORA` without further edits.
- correctness minor: `ENUMERATED_CORPORA` omits `pts`. **Closed**: `pts` is in the `BOOTSTRAP_CORPORA` list (`corpus-resolver.ts:80`) and registered like the rest.
- Adding a corpus is now one `registerCorpusResolver(...)` call; the side-effect import list in `index.ts` is the only "second edit" and exists to ensure module init runs (a deferred-init alternative would require structural changes elsewhere). Verdict: ADR 019 §2.1 satisfied.

**D. Atomicity violations in writers.**

- correctness major: `regs/cache.ts:loadEcfrXml`, `regs/derivative-writer.ts:writeIfChanged`, `download/http.ts:downloadOnce`, `download/html-fetch.ts:downloadHtmlOnce`, plus both Python `urlopen` writers — all write directly to destination without tmp+rename. ADR 021 violated.
- security#3 (major): same Python paths lack tmp+rename.
- testing major: `manifest.ts` tmp+rename has the code but no test exercises atomicity, partial-failure rollback, or backward-read of pre-WP manifests (test plan required).
- Fix: port `libs/aviation/src/sources/download.ts` `.part`+rename pattern across all writers; add the missing tests.

**E. HTTP fetch hardening missing on Python side and partial on TS side.**

- security#2 (major): Python `urllib.request.urlopen` paths in `tools/handbook-ingest/ingest/fetch.py:62-69` and `apply_errata.py:272-280` lack timeout, redirect cap, body-size cap, content-type check, SHA-against-YAML-pin verification.
- security#3 (major): TS `followRedirectsHead` doesn't enforce same-host/scheme on redirect hops (MITM cache rewrite).
- security#4 (major): no body-size cap on any download path; `regs/cache.ts:110` buffers via `await response.text()`.
- backend major: Python `fetch_pdf` no timeout/retry/cap/SHA; TS `downloadFile` (libs/aviation) loads full body to memory, no streaming, no `MAX_UPLOAD_BYTES`.
- backend major: `fetchEcfrTitles` no timeout/retry, hangs entire run.
- correctness major: Python `urlopen` paths don't validate HTTPS scheme.
- Fix: port the TS hardening pattern to Python; add a 250 MB body ceiling and a hostname allowlist (derived from YAML).

**F. Registry linear-scan-per-id + N+1 at render time.**

- perf major: `getCurrentEdition` (regs + handbooks resolvers), `getChildren`, `findEntriesByCanonicalShort` all `Object.keys(getSources())` per call. `batchResolve` invokes `getCurrentEdition` per-id.
- schema major: `findEntriesByCanonicalShort` is O(n) without a real index.
- Fix once: generation-counter-invalidated index map at module-load, rebuilt on registry mutation.

**G. Section-extraction prompt-injection surface unfenced.**

- security#1 (major): `tools/handbook-ingest/ingest/prompts/section-extraction/chapter.md` feeds FAA-served chapter text to a sub-agent without untrusted-data fencing. PDF-borne instruction injection is the threat. Also: file-write allowlist lives only in `parameters.md`; duplicate it into `chapter.md` so a sub-agent that ignores parameters still sees the rule.

**H. Promotion batches and editions in-memory only.**

- schema#3 (major): `promotion_batches` (ADR 019 §2.4) and `EDITIONS` (ADR 019 §2.1) are in-memory `Map`s with no Postgres persistence and no scheduled migration WP. Audit trail wiped on every restart.

**I. Snapshot CLI ships empty data.**

- backend major: `runSnapshotCli` never hydrates — non-TS consumers get an empty snapshot. Fix: have `writeSnapshotSync` return the built snapshot, or call `generateSnapshot()` once and pass to a new `writeSnapshotData(path, data)` helper.

**J. Unconditional file rewrites break "byte-equal idempotent regen" claim.**

- perf major: `writeAimDerivatives` and handbooks-extras `runHandbooksExtrasIngest` rewrite every `.md` and `manifest.json` on every run.
- Fix: hoist `writeIfChanged` from `regs/derivative-writer.ts:187` into a shared util.

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

Per CLAUDE.md "ALWAYS FIX EVERYTHING from a review unless explicitly told not to" + the prompt's instruction "do NOT auto-fix — present the punch list and await my call on `/ball-review-fix`": this review is paused at the punch-list stage by explicit request.

When you're ready: `/ball-review-fix` (or `/rfix`) reads these 9 review files, consolidates convergent findings (the A-J clusters above are the natural groupings), executes every fix, and verifies `bun run check` + relevant tests pass.
