# `bun run sources`

Single dispatcher for every developer task that touches a source corpus (CFR, AIM, ACs, ACS, FAA handbooks). Replaces the three pre-2026-04-27 top-level scripts (`download-sources`, `ingest`, `handbook-ingest`).

See [ADR 018](../docs/decisions/018-source-artifact-storage-policy/decision.md) and [docs/platform/STORAGE.md](../docs/platform/STORAGE.md) for the storage policy this script implements.

## Commands

| Command                       | What                                                                                  |
| ----------------------------- | ------------------------------------------------------------------------------------- |
| `sources download`            | Fetch source bytes (CFR XML, AIM, ACs, ACS, optional handbook extras) into the cache  |
| `sources register <corpus>`   | Walk a derivative tree and register entries in the `@ab/sources` registry             |
| `sources extract <pipeline>`  | Run a source-extraction pipeline (currently: `handbooks` Python TOC + LLM strategies) |

```bash
bun run sources                                    # prints index
bun run sources help
bun run sources <command> --help

bun run sources download [flags]
bun run sources register cfr [...]
bun run sources register handbooks [...]
bun run sources register aim [...]
bun run sources register --all
bun run sources extract handbooks [args passthrough to python]
```

## `sources download`

```bash
bun run sources download                                # everything except handbook extras
bun run sources download --corpus=regs                  # only CFR
bun run sources download --corpus=regs,aim,ac           # subset
bun run sources download --dry-run                      # preview, no network
bun run sources download --verify                       # HEAD-only audit (no downloads)
bun run sources download --include-handbooks-extras     # add 8083-2/9/15/16/27/30/32/34
bun run sources download --force-refresh                # ignore manifest, re-fetch
bun run sources download --edition-date=2026-04-22      # eCFR snapshot date override
bun run sources download --verbose                      # log every URL + redirect
bun run sources download --no-color                     # disable ANSI color in output
```

### What it fetches

| Corpus     | What                                                      | Destination                                                              |
| ---------- | --------------------------------------------------------- | ------------------------------------------------------------------------ |
| regs       | 14 CFR (full) + 49 CFR §830 + 49 CFR §1552 from eCFR XML  | `<root>/regulations/cfr-<title>/<YYYY-MM-DD>/<slug>.xml`                 |
| aim        | Aeronautical Information Manual PDF                       | `<root>/aim/<YYYY-MM>/aim-<YYYY-MM>.pdf` (+ `source.pdf` symlink)        |
| ac         | 12 frequently-cited Advisory Circulars (PDF)              | `<root>/ac/<ac-id>/<edition>/AC_<id>.pdf` (+ `source.pdf` symlink)       |
| acs        | 5 Airman Certification Standards (PDF)                    | `<root>/acs/<acs-id>/<edition>/<original_name>.pdf` (+ symlink)          |
| handbooks  | (opt-in) 8 additional FAA handbooks (8083-2/9/15/16/...)  | `<root>/handbooks/<doc>/<edition>/source.pdf`                            |

PHAK / AFH / AvWX are already cached by the handbook ingestion pipeline; they are intentionally NOT re-fetched by this command.

### eCFR edition dates auto-detected

The eCFR Versioner only serves snapshots for dates that exist in its amendment history. `download` calls `https://www.ecfr.gov/api/versioner/v1/titles.json` once per run and uses each title's `latest_amended_on` as the per-title default. Pass `--edition-date=YYYY-MM-DD` to override that for all titles.

### Filename convention

New corpora (`aim`, `ac`, `acs`) write a descriptive filename echoing the doc slug, e.g. `<root>/ac/ac-61-65-j/J/AC_61-65J.pdf`. A `source.pdf` symlink in the same directory points at the descriptive file so existing readers that look for `source.<ext>` continue to work.

`regs` and `handbooks` keep `source.<ext>` as the primary filename for compatibility with the existing readers in `libs/sources/src/regs/cache.ts` and `libs/sources/src/handbooks/derivative-reader.ts`. The manifest still records `source_filename` so a later migration is mechanical.

### Output coloring

The download output is colored so a long run is scannable:

- Skipped (cached fresh) -> yellow
- Downloaded ok -> green
- Errors -> red
- Per-corpus summary line: counts colored when non-zero, dim when zero
- Verify table: HTTP status colored (2xx green, 4xx yellow, 5xx/ERR red)

Color is suppressed when `NO_COLOR` is set, when stdout is not a TTY, or when `--no-color` is passed.

### Browser User-Agent

FAA servers return 403 for requests without a recognizable User-Agent. The script sends `airboss-source-downloader/1.0 (+https://github.com/joshball/airboss)` on every request (HEAD, redirect-follow, body fetch).

### Idempotence -- HEAD before download

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

A plan is treated as fresh and skipped when content-length matches the cached size AND (etag matches OR last-modified has not advanced). Pass `--force-refresh` to override.

### `--verify` mode -- audit URLs without downloading

```bash
bun run sources download --verify
```

Issues `HEAD` against every planned URL and prints a colored table:

```text
URL verification (HEAD only):
regs/cfr-14-full              200  31.2 MB   2026-04-22  miss
regs/cfr-49-parts-830         200   4.1 MB   2026-04-20  miss
ac/ac-00-6-b                  200  11.7 MB   2016-08-25  hit
...

12/12 URLs OK. 5 cache hits, 7 misses.
```

Exits 0 when every URL returns 2xx, 1 when any URL is non-2xx or unreachable. Use this to audit the URL list before committing to a multi-megabyte download.

### When a URL is wrong

The FAA periodically rotates PDF URLs. The verified list lives in `scripts/sources/download/plans.ts` (`AC_TARGETS`, `ACS_TARGETS`, `HANDBOOKS_EXTRAS_TARGETS`, `AIM_PDF_URL`). Each target has a single URL -- no fallbacks. If `--verify` flags a target as 404, edit the URL in the file and re-run. Operator commits the change.

### Not in CI

The actual downloads are NOT exercised in CI -- the live FAA / eCFR endpoints are too flaky for that. CI runs the parser tests in `scripts/sources/download.test.ts`, which use `--dry-run` and assert the URL plan. A live one-file smoke test is opt-in:

```bash
AIRBOSS_E2E_DOWNLOAD=1 bun run sources download --corpus=ac
```

Cached files are gitignored per ADR 018.

## `sources register`

```bash
bun run sources register cfr [--title=14|49] [--edition=YYYY-MM-DD] [--fixture=<path>] [--out=<path>]
bun run sources register handbooks [--doc=phak|afh|avwx] [--edition=<...>] [--out=<path>]
bun run sources register aim [--edition=YYYY-MM] [--out=<path>]
bun run sources register --all
bun run sources register --help
bun run sources register <corpus> --help
```

Routes to the per-corpus `runIngestCli` exported from `@ab/sources/<corpus>`. Each corpus owns its arg parsing, validation, and execution. Adding a new corpus is a single import + one entry in the dispatcher map.

CFR live ingest hits the eCFR Versioner API and caches under `$AIRBOSS_HANDBOOK_CACHE/regulations/cfr-<title>/<edition>/`. CI runs MUST pass `--fixture=` -- live network ingest is an operator action. Handbook + AIM register existing on-disk derivatives produced by the extraction pipeline.

See:

- [docs/work-packages/reference-cfr-ingestion-bulk/](../docs/work-packages/reference-cfr-ingestion-bulk/)
- [docs/work-packages/reference-handbook-ingestion/](../docs/work-packages/reference-handbook-ingestion/)
- [docs/work-packages/reference-aim-ingestion/](../docs/work-packages/reference-aim-ingestion/)

## `sources extract`

```bash
bun run sources extract handbooks --help                                     # python-side flags
bun run sources extract handbooks phak --edition FAA-H-8083-25C
bun run sources extract handbooks phak --edition FAA-H-8083-25C --dry-run
bun run sources extract handbooks phak --edition FAA-H-8083-25C --strategy compare
```

Currently routes to a single sub-pipeline: `handbooks`, which dispatches to `python -m ingest` from `tools/handbook-ingest/`. Uses `tools/handbook-ingest/.venv/bin/python` if present, otherwise falls back to `python3` on PATH. All flags after `handbooks` pass through to argparse on the Python side.

See [docs/platform/HANDBOOK_INGESTION_STRATEGIES.md](../docs/platform/HANDBOOK_INGESTION_STRATEGIES.md) and [docs/work-packages/handbook-ingestion-and-reader/](../docs/work-packages/handbook-ingestion-and-reader/).
