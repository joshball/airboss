# `bun run download-sources`

One-shot operator script that downloads every source corpus the project needs
into the local cache (`$AIRBOSS_HANDBOOK_CACHE`, default
`~/Documents/airboss-handbook-cache/`). See [ADR 018](../docs/decisions/018-source-artifact-storage-policy/decision.md)
and [docs/platform/STORAGE.md](../docs/platform/STORAGE.md) for the storage
policy this script implements.

## What it fetches

| Corpus     | What                                                      | Destination                                                              |
| ---------- | --------------------------------------------------------- | ------------------------------------------------------------------------ |
| regs       | 14 CFR (full) + 49 CFR §830 + 49 CFR §1552 from eCFR XML  | `<root>/regulations/cfr-<title>/<YYYY-MM-DD>/<slug>.xml`                 |
| aim        | Aeronautical Information Manual PDF                       | `<root>/aim/<YYYY-MM>/aim-<YYYY-MM>.pdf` (+ `source.pdf` symlink)        |
| ac         | 12 frequently-cited Advisory Circulars (PDF)              | `<root>/ac/<ac-id>/<edition>/AC_<id>.pdf` (+ `source.pdf` symlink)       |
| acs        | 5 Airman Certification Standards (PDF)                    | `<root>/acs/<acs-id>/<edition>/<original_name>.pdf` (+ symlink)          |
| handbooks  | (opt-in) 8 additional FAA handbooks (8083-2/9/15/16/...)  | `<root>/handbooks/<doc>/<edition>/source.pdf`                            |

PHAK / AFH / AvWX are already cached by the handbook ingestion pipeline
(PR #242); they are intentionally NOT re-fetched by this script.

### eCFR edition dates auto-detected

The eCFR Versioner only serves snapshots for dates that exist in its amendment
history. `download-sources` calls
`https://www.ecfr.gov/api/versioner/v1/titles.json` once per run and uses each
title's `latest_amended_on` as the per-title default (Title 14 and Title 49
typically advance on different days). Pass `--edition-date=YYYY-MM-DD` to
override that for all titles.

### Filename convention

New corpora (`aim`, `ac`, `acs`) write a descriptive filename echoing the doc
slug, e.g. `<root>/ac/ac-61-65-j/J/AC_61-65J.pdf`. A `source.pdf` symlink in
the same directory points at the descriptive file so existing readers that
look for `source.<ext>` continue to work.

`regs` and `handbooks` keep `source.<ext>` as the primary filename for
compatibility with the existing readers in
`libs/sources/src/regs/cache.ts` and
`libs/sources/src/handbooks/derivative-reader.ts`. The manifest still records
`source_filename` so a later migration is mechanical.

## Usage

```bash
bun run download-sources                                # everything except handbook extras
bun run download-sources --corpus=regs                  # only CFR
bun run download-sources --corpus=regs,aim,ac           # subset
bun run download-sources --dry-run                      # preview, no network
bun run download-sources --verify                       # HEAD-only audit (no downloads)
bun run download-sources --include-handbooks-extras     # add 8083-2/9/15/16/27/30/32/34
bun run download-sources --force-refresh                # ignore manifest, re-fetch
bun run download-sources --edition-date=2026-04-22      # eCFR snapshot date override
bun run download-sources --verbose                      # log every URL + redirect
```

### Browser User-Agent

FAA servers return 403 for requests without a recognizable User-Agent. The
script sends `airboss-source-downloader/1.0 (+https://github.com/joshball/airboss)`
on every request (HEAD, redirect-follow, body fetch).

## Idempotence -- HEAD before download

Per-doc `manifest.json` is written next to each cached source file:

```json
{
  "corpus": "regs",
  "doc": "cfr-14-full",
  "edition": "2026-04-22",
  "source_url": "https://www.ecfr.gov/api/versioner/v1/full/2026-04-22/title-14.xml",
  "source_filename": "full.xml",
  "source_sha256": "abc123...",
  "size_bytes": 31872491,
  "fetched_at": "2026-04-27T17:42:00Z",
  "last_modified": "Wed, 22 Apr 2026 12:00:00 GMT",
  "etag": "\"deadbeef\"",
  "schema_version": 1
}
```

Before each download, the script issues a `HEAD` request and compares:

- `Content-Length` header vs cached file size
- `ETag` header vs manifest `etag` (if both present)
- `Last-Modified` header vs manifest `last_modified` (if both present)

A plan is treated as fresh and skipped when content-length matches the cached
size AND (etag matches OR last-modified has not advanced). Pass
`--force-refresh` to override.

## `--verify` mode -- audit URLs without downloading

```bash
bun run download-sources --verify
```

Issues `HEAD` against every planned URL and prints a table:

```text
URL verification (HEAD only):
regs/cfr-14-full              200  31.2 MB   2026-04-22  miss
regs/cfr-49-parts-830         200   4.1 MB   2026-04-20  miss
ac/ac-00-6-b                  200  11.7 MB   2016-08-25  hit
...

12/12 URLs OK. 5 cache hits, 7 misses.
```

Exits 0 when every URL returns 2xx, 1 when any URL is non-2xx or unreachable.
Use this to audit the URL list before committing to a multi-megabyte download.

## When a URL is wrong

The FAA periodically rotates PDF URLs. The current verified list lives in
`scripts/download-sources.ts` (`AC_TARGETS`, `ACS_TARGETS`,
`HANDBOOKS_EXTRAS_TARGETS`, `AIM_PDF_URL`). Each target has a single URL --
no fallbacks. If `--verify` flags a target as 404, edit the URL in the script
and re-run. Operator commits the change.

## Not in CI

The actual downloads are NOT exercised in CI -- the live FAA / eCFR endpoints
are too flaky for that. CI runs the parser tests in `scripts/download-sources.test.ts`,
which use `--dry-run` and assert the URL plan. A live one-file smoke test is
opt-in:

```bash
AIRBOSS_E2E_DOWNLOAD=1 bun run download-sources --corpus=ac
```

Cached files are gitignored per ADR 018.
