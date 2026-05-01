---
title: 'Spec: handbooks-extras ingestion'
product: cross-cutting
feature: handbooks-extras-ingestion
type: spec
status: shipped
review_status: done
closed_at: '2026-04-30'
closed_by: 'feat(sources): handbooks-extras ingestion pipeline'
---

# Spec: handbooks-extras ingestion

Closes [library-broad-extraction-survey](../library-broad-extraction-survey/findings.md) gap 5: six FAA whole-doc-only Class C handbooks were downloadable but had no register pipeline. After this WP, all six are queryable in the runtime registry.

## Why this WP exists

The chapter-aware `handbooks` register pipeline (`bun run sources register handbooks --doc=<phak|afh|avwx>`) walks Python-extracted manifests with `sections[]`. Six FAA handbooks ship as whole-doc-only PDFs (no per-chapter PDFs from the publisher) and the Python pipeline never produced section trees for them. The `handbooks-extras.yaml` config has carried their URLs since 2026-04-29, the downloader fetches them when `--include-handbooks-extras` is set, and `verify-urls` keeps the URLs honest -- but `register handbooks` did not know how to ingest the cached bytes.

## In scope

| Doc                    | YAML `doc_id`   | YAML edition | Friendly slug         | Edition slug | Derivative dir      |
| ---------------------- | --------------- | ------------ | --------------------- | ------------ | ------------------- |
| Risk Management        | faa-h-8083-2    | 2A           | risk-management       | 8083-2A      | FAA-H-8083-2A       |
| Aviation Instructor's  | faa-h-8083-9    | null         | aviation-instructor   | 8083-9       | FAA-H-8083-9        |
| Instrument Flying      | faa-h-8083-15   | 15B          | ifh                   | 8083-15B     | FAA-H-8083-15B      |
| Instrument Procedures  | faa-h-8083-16   | 16B          | iph                   | 8083-16B     | FAA-H-8083-16B      |
| AMT -- General         | faa-h-8083-30   | 30B          | amt-general           | 8083-30B     | FAA-H-8083-30B      |
| AMT -- Powerplant      | faa-h-8083-32   | 32B          | amt-powerplant        | 8083-32B     | FAA-H-8083-32B      |

Locator scheme: `airboss-ref:handbooks/<friendly-slug>/<edition-slug>` -- piggy-backs on the existing `handbooks` corpus. No new corpus prefix; the new doc slugs join PHAK/AFH/AvWX in `HANDBOOK_DOC_SLUGS`.

Implementation:

- New `libs/sources/src/handbooks-extras/` lib module:
  - `ingest.ts` -- walks the YAML, reads cached PDFs, extracts text, writes per-doc manifest + `document.md` derivatives, registers `SourceEntry` + `Edition` per doc, atomic batch promotion to `accepted`.
  - `derivative-reader.ts` -- types + readers for the YAML inventory, the cache-side downloader manifest, and the corpus-level index.
  - `index.ts` -- public surface (no resolver registration; reuses `handbooks`).
  - `ingest.test.ts` -- unit tests against fake caches plus a smoke test against the live developer cache.
- `scripts/sources/register/handbooks-extras.ts` + 1-line wiring in `scripts/sources/register.ts` (`REGISTER_SUBCOMMANDS`).
- Extensions to the existing `handbooks` corpus (no behavioural change for PHAK/AFH/AvWX):
  - `HANDBOOK_DOC_SLUGS` (`handbooks/locator.ts`) gains the six friendly slugs.
  - `HANDBOOK_DOC_EDITIONS` (`handbooks/resolver.ts`) maps each new edition slug to its derivative dir.
  - `HANDBOOK_LIVE_URLS` (`handbooks/url.ts`) gains a landing-page URL per new slug.
  - `DOC_DISPLAY` (`handbooks/ingest.ts`) is now exported and gains `short`/`formal` strings per new slug.
  - `ManifestFile` (`handbooks/derivative-reader.ts`) gains optional `body_path` / `body_sha256` / `page_count` fields. Whole-doc references resolve via `body_path` when present; chapter-aware behaviour is unchanged.

## Out of scope

- Chapter-level extraction (these are Class C whole-doc-only per the YAML; the publisher does not ship per-chapter PDFs).
- LLM section trees for the new handbooks (PHAK/AFH/AvWX use those; extras don't yet).
- Errata application (no errata are presently catalogued for the six extras).
- Re-naming the on-disk derivative root from `handbooks/` to `library/handbooks/` (the route rename in PR #376 did not touch derivative paths; out of scope here).

## Acceptance criteria

- `bun run sources register handbooks-extras` reports `scanned=6 ingested=6 skipped=0` against a fully-cached developer machine, OR an explicit per-doc skip reason citing missing cache for any unfetched docs.
- Re-running the same command reports `ingested=0 alreadyAccepted=6` (idempotent).
- Each ingested handbook yields:
  - `handbooks/<friendly-slug>/<faa-dir>/document.md` -- whole-doc body markdown.
  - `handbooks/<friendly-slug>/<faa-dir>/manifest.json` -- carries `document_slug`, `edition`, `body_path`, `body_sha256`, `page_count`, `source_url`, `source_checksum`, `fetched_at`, `doc_id`, `faa_edition`, plus an empty `sections[]`.
- Corpus-level audit index at `handbooks/handbooks-extras-index.json` lists one entry per ingested handbook.
- Six new entries appear in the runtime `SOURCES` table under the `handbooks` corpus, IDs of the form `airboss-ref:handbooks/<friendly-slug>/<edition-slug>`.
- `bun run check` clean (0 errors, 0 warnings).
- All existing tests pass; AC + ACS + CFR + handbooks register subcommands continue to behave as before.

## Anchors

- [ADR 018 -- source-artifact storage policy](../../decisions/018-source-artifact-storage-policy/decision.md)
- [ADR 021 -- source-cache flat naming](../../decisions/021-source-cache-flat-naming/decision.md) (the flat `<cache>/handbooks/<doc_id>/<doc_id>.pdf` shape this WP reads)
- AC ingest as the implementation template: `libs/sources/src/ac/ingest.ts`
- Survey gap: [library-broad-extraction-survey/findings.md](../library-broad-extraction-survey/findings.md) -- "Handbooks-extras: ❌ NO PIPELINE"
- YAML inventory: `scripts/sources/config/handbooks-extras.yaml`
- Friendly-slug source-of-truth: `DOC_ID_TO_FRIENDLY` in `libs/sources/src/handbooks-extras/ingest.ts`
