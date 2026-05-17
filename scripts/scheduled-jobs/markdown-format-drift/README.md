# markdown-format-drift

Monthly housekeeping for authored markdown. Runs the project formatter
across the whole repo and opens a PR if any doc has drifted from the
canonical md-format style.

## Why

Daily work runs `bun run check` in its default `dirty` scope -- fast,
only the files you touched. Nothing pays for a full-repo markdown pass.
Over time, a doc edited outside an agent's `check` path, or a table that
grew a wider cell, can drift unnoticed. This job is the low-cadence
safety net: it catches that drift once a month so the backlog never
silently accumulates.

## What it checks

Runs `bun tools/md-format/bin.ts --all`, which applies the md-format
rules (pipe-table alignment, blank-line-around headings/lists/fences,
fence language tags) to every markdown file **except**:

- the ingested FAA corpora (`handbooks/`, `ac/`, `aim/`, `safo/`,
  `info/`) -- machine-extracted source the ingest pipeline owns;
- `.claude/` -- other agents' worktree checkouts;
- git-ignored derived artifacts.

The formatter is idempotent, so on a clean repo it writes nothing.

## What it produces

Nothing on a clean run. When a doc has drifted, the worktree ends up
dirty and the wrapper branches + commits + opens a PR (`on_diff =
"open-pr"`). The diff is always pure formatting -- no content changes --
so it is safe to review and merge quickly.

## Schedule

Monthly, 09:00 local time on the 1st. See [`job.toml`](./job.toml).

## Files

- `job.toml` -- declarative config (cadence + behaviour)
- `run.sh` -- the actual work
- `README.md` -- this file
