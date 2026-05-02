# `bun run sources`

Single dispatcher for every developer task that touches a source corpus (CFR, AIM, ACs, ACS, FAA handbooks). Replaces the three pre-2026-04-27 top-level scripts (`download-sources`, `ingest`, `handbook-ingest`).

See [ADR 018](../docs/decisions/018-source-artifact-storage-policy/decision.md), [ADR 021](../docs/decisions/021-source-cache-flat-naming/decision.md) (cache flat naming), [ADR 022](../docs/decisions/022-chapter-source-ingestion/decision.md) (chapter source ingestion), and [docs/platform/STORAGE.md](../docs/platform/STORAGE.md) for the storage policy this script implements.

## YAML config (single source of truth)

URL inventories live at `scripts/sources/config/`. When the FAA rotates a URL, edit the YAML; no code change required.

| File                          | What                                                              |
| ----------------------------- | ----------------------------------------------------------------- |
| `ac.yaml`                     | 12 Advisory Circulars                                             |
| `acs.yaml`                    | 5 Airman Certification Standards                                  |
| `aim.yaml`                    | Bundled PDF + section + appendix HTML (72 sections + 5 appendices)|
| `regs.yaml`                   | eCFR base + per-title list (14, 49)                               |
| `handbooks-extras.yaml`       | 8 whole-doc-only handbooks (Class C)                              |
| `handbooks/<slug>.yaml`       | Per-handbook config (whole_doc + chapter_pdfs + ancillaries)      |

The Python ingest tool (`tools/handbook-ingest/`) reads from the same `handbooks/<slug>.yaml` files.

## Commands

| Command                       | What                                                                                  |
| ----------------------------- | ------------------------------------------------------------------------------------- |
| `sources download`            | Fetch source bytes (CFR XML, AIM, ACs, ACS, handbooks) into the cache                 |
| `sources verify-urls`         | HEAD-check every configured URL (network); reports 404s with structured remediation   |
| `sources inventory`           | Regenerate `docs/ingestion-pipeline/inventory.md` from YAML config + cache manifests             |
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

| Corpus    | What                                                                        | Destination (per ADR 021 + ADR 022)                                                 |
| --------- | --------------------------------------------------------------------------- | ----------------------------------------------------------------------------------- |
| regs      | 14 CFR (full) + 49 CFR §830 + 49 CFR §1552 from eCFR XML                    | `<root>/regulations/cfr-<title>/<YYYY-MM-DD>.xml` (`-parts-<f>` if filtered)        |
| aim       | Bundled AIM PDF + 72 chapter section HTML + 5 appendix HTML                 | `<root>/aim/aim.pdf`, `chap<CC>_section_<SS>.html`, `appendix_<NN>.html`            |
| ac        | 12 frequently-cited Advisory Circulars (PDF)                                | `<root>/ac/<doc-id>.pdf` (flat, one per AC)                                         |
| acs       | 5 Airman Certification Standards (PDF)                                      | `<root>/acs/<doc-id>.pdf` (flat, one per ACS)                                       |
| handbooks | Per-handbook config: whole-doc + chapter PDFs + ancillaries (Class A1/A2/C) | `<root>/handbooks/<slug>/<edition>/<edition>{,-ch<NN>,-front,-glossary,-index}.pdf` |
| handbooks | (opt-in via `--include-handbooks-extras`) 8 whole-doc-only handbooks        | `<root>/handbooks/<slug>/<slug>.pdf`                                                |

A per-corpus `manifest.json` (or per-edition for handbooks, with `primary` + `chapters[]` + `ancillary[]` + `errata[]`) lives alongside the bytes.

Whole-doc PDFs are kept alongside chapter PDFs (additive, not replacement) -- the whole-doc is the cross-chapter reference + the only source of front matter when the publisher doesn't split it.

### eCFR edition dates auto-detected

The eCFR Versioner only serves snapshots for dates that exist in its amendment history. `download` calls `https://www.ecfr.gov/api/versioner/v1/titles.json` once per run and uses each title's `latest_amended_on` as the per-title default. Pass `--edition-date=YYYY-MM-DD` to override that for all titles.

### Filename convention

Per ADR 021, every corpus writes a self-describing filename echoing the doc id or edition. AC, ACS, and AIM are flat (one PDF per doc directly under the corpus dir). Handbooks keep a per-edition directory so errata can co-locate as `<edition>-errata-<id>.pdf`. Regs flatten the per-edition dir, distinguishing full vs. filtered title fetches via the `-parts-<filter>` filename infix. No `source.<ext>` shim, no symlinks.

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

Per ADR 021, AC, ACS, AIM, and regs use a per-corpus `<corpus>/manifest.json` (per-title for regs) with an `entries[]` array. Handbooks use a per-edition `manifest.json` with `primary` + `errata[]`. One entry per doc/edition records the audit trail:

```json
{
  "schema_version": 1,
  "corpus": "ac",
  "entries": [
    {
      "corpus": "ac",
      "doc": "ac-61-65-j",
      "edition": "J",
      "source_url": "https://www.faa.gov/.../AC_61-65J.pdf",
      "source_filename": "ac-61-65-j.pdf",
      "source_sha256": "abc123...",
      "size_bytes": 1872491,
      "fetched_at": "2026-04-27T17:42:00Z",
      "last_modified": "Wed, 22 Apr 2026 12:00:00 GMT",
      "etag": "\"deadbeef\"",
      "schema_version": 1
    }
  ]
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

The FAA periodically rotates PDF URLs. Per [ADR 022](../docs/decisions/022-chapter-source-ingestion/decision.md), the verified URL inventory lives in YAML under `scripts/sources/config/`:

| Corpus            | YAML file                               |
| ----------------- | --------------------------------------- |
| Advisory Circulars| `scripts/sources/config/ac.yaml`        |
| ACS               | `scripts/sources/config/acs.yaml`       |
| AIM               | `scripts/sources/config/aim.yaml`       |
| CFR               | `scripts/sources/config/regs.yaml`      |
| Handbooks (whole) | `scripts/sources/config/handbooks-extras.yaml` |
| Handbooks (chapter)| `scripts/sources/config/handbooks/<slug>.yaml` |

If `bun run sources verify-urls` (or `bun run sources download --verify`) flags a target as 404, edit the matching `entry.url` (or `whole_doc.url` / chapter-pdf URL for handbook YAMLs), re-run `bun run sources verify-urls` to confirm, and commit. No code change is needed; both the TS downloader and the Python ingest tool read the same YAMLs.

When the FAA rotates a URL alongside a revision bump, the YAML's `edition` field also needs to advance. Confirm against the [FAA Advisory Circular search](https://www.faa.gov/regulations_policies/advisory_circulars/) or the publisher's index page for the doc.

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

CFR live ingest hits the eCFR Versioner API and caches under `$AIRBOSS_HANDBOOK_CACHE/regulations/cfr-<title>/<edition>.xml` (per ADR 021). CI runs MUST pass `--fixture=` -- live network ingest is an operator action. Handbook + AIM register existing on-disk derivatives produced by the extraction pipeline.

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

See [docs/ingestion-pipeline/handbook-ingestion-strategies.md](../docs/ingestion-pipeline/handbook-ingestion-strategies.md) and [docs/work-packages/handbook-ingestion-and-reader/](../docs/work-packages/handbook-ingestion-and-reader/).
