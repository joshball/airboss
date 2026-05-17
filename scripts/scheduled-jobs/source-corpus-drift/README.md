# source-corpus-drift

Monthly drift check for the FAA / eCFR source corpus. Runs
`bun run sources report --strict` and writes a report to `docs/work/reviews/`
when an upstream document has a newer revision than the local cache.

## What it checks

For every catalogued document the downloader knows about (AC, ACS, AIM,
handbooks, CFR), runs the existing freshness check (HEAD only -- no body
fetch) and classifies each:

- **fresh** -- the cached bytes still match upstream.
- **newer revision available** -- upstream has changed; the cache is stale.
- **not cached** -- the document was never downloaded on this machine.
- **HEAD failed** -- the publisher URL could not be reached.

## What it produces

Nothing on a clean run. When any document is non-fresh, writes
`docs/work/reviews/source-corpus-drift-<date>.md` with the full verdict
table. The scheduler is configured `on_diff = "log-only"` so no PR is
opened -- corpus drift wants human review, never an auto-download. A new
FAA edition can renumber sections, so updating the cache is a reviewed
change: the operator runs `bun run sources download` and re-verifies the
affected citations.

## Schedule

Monthly, 09:00 local time on the 1st. See [`job.toml`](./job.toml).

## Files

- `job.toml` -- declarative config (cadence + behaviour)
- `run.sh`   -- the actual work
- `README.md` -- this file
