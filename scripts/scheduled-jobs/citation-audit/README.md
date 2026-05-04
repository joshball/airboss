# citation-audit

Weekly stage-5 cross-link audit. Runs `bun run sources audit-citations --json`
against the dev database and writes a report to `docs/loose-ends/` when there
are findings.

## What it checks

For every row in `study.content_citations`:

- **Dead targets** -- the target row no longer exists in its target table
  (`hangar.reference` for regulation / AC, `study.knowledge_node` for
  knowledge nodes).
- **Dead sources** -- the citation's owning card / scenario / node was
  hard-deleted.
- **Resolver coverage gaps** -- the target's corpus has no resolver
  registered, so the citation chip cannot deep-link.
- **Invalid external_ref URLs** -- the user-supplied target_id is not a
  valid http(s) URL.

## What it produces

Nothing on a clean run. When findings exist, writes
`docs/loose-ends/citation-audit-<date>.md` with the full JSON report. The
scheduler is configured `on_diff = "log-only"` so no PR is opened; the
report sits in `loose-ends/` for human review.

## Schedule

Weekly, Mondays at 09:30 local time. Disabled by default
(`enabled = false` in [`job.toml`](./job.toml)) -- enable per machine when
the dev DB is the right thing to audit on a cadence.

## Files

- `job.toml` -- declarative config (cadence + behaviour)
- `run.sh`   -- the actual work
- `README.md` -- this file
