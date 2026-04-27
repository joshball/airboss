# `bun run download-sources`

One-shot operator script that downloads every source corpus the project needs
into the local cache (`$AIRBOSS_HANDBOOK_CACHE`, default
`~/Documents/airboss-handbook-cache/`). See [ADR 018](../docs/decisions/018-source-artifact-storage-policy/decision.md)
and [docs/platform/STORAGE.md](../docs/platform/STORAGE.md) for the storage
policy this script implements.

## What it fetches

| Corpus     | What                                                      | Destination                                              |
| ---------- | --------------------------------------------------------- | -------------------------------------------------------- |
| regs       | 14 CFR (full) + 49 CFR §830 + 49 CFR §1552 from eCFR XML  | `<root>/regulations/cfr-<title>/<YYYY-MM-DD>/<slug>.xml` |
| aim        | Aeronautical Information Manual PDF                       | `<root>/aim/<YYYY-MM>/source.pdf`                        |
| ac         | 12 frequently-cited Advisory Circulars (PDF)              | `<root>/ac/<ac-id>/<edition>/source.pdf`                 |
| acs        | 5 Airman Certification Standards (PDF)                    | `<root>/acs/<acs-id>/<edition>/source.pdf`               |
| handbooks  | (opt-in) 8 additional FAA handbooks (8083-2/9/15/16/...)  | `<root>/handbooks/<doc>/<edition>/source.pdf`            |

PHAK / AFH / AvWX are already cached by the handbook ingestion pipeline (PR
#242); they are intentionally NOT re-fetched by this script.

## Usage

```bash
bun run download-sources                                # everything except handbook extras
bun run download-sources --corpus=regs                  # only CFR
bun run download-sources --corpus=regs,aim,ac           # subset
bun run download-sources --dry-run                      # preview, no network
bun run download-sources --include-handbooks-extras     # add 8083-2/9/15/16/27/30/32/34
bun run download-sources --force-refresh                # ignore manifest, re-fetch
bun run download-sources --edition-date=2026-04-15      # eCFR snapshot date
bun run download-sources --verbose                      # log every URL + redirect
```

## Idempotence

Per-doc `manifest.json` is written next to each `source.<ext>`:

```json
{
	"corpus": "regs",
	"doc": "cfr-14-full",
	"edition": "2026-04-27",
	"source_url": "https://www.ecfr.gov/api/versioner/v1/full/2026-04-27/title-14.xml",
	"source_sha256": "abc123...",
	"size_bytes": 31872491,
	"fetched_at": "2026-04-27T17:42:00Z",
	"schema_version": 1
}
```

Re-running the script skips files where the manifest's `size_bytes` matches the
existing `source.<ext>` byte count. Pass `--force-refresh` to override.

## When a URL is wrong

The FAA periodically rotates PDF URLs. If a download fails, the script logs the
error and continues. For each AC / ACS / handbook target, `download-sources.ts`
declares an array of candidate URLs; if the first 404s, the next is tried.

To add a candidate URL, edit the corresponding entry in
`scripts/download-sources.ts` (`AC_TARGETS`, `ACS_TARGETS`,
`HANDBOOKS_EXTRAS_TARGETS`). One change per failing corpus, then re-run with
`--force-refresh`.

## Not in CI

The actual downloads are NOT exercised in CI -- the live FAA / eCFR endpoints
are too flaky for that. CI runs the parser tests in `scripts/download-sources.test.ts`,
which use `--dry-run` and assert the URL plan. A live one-file smoke test is
opt-in:

```bash
AIRBOSS_E2E_DOWNLOAD=1 bun run download-sources --corpus=ac
```

Cached files are gitignored per ADR 018.
