#!/usr/bin/env bash
# markdown-format-drift -- re-format every authored markdown file and let the
# wrapper open a PR when anything drifted.
#
# `md-format --all` excludes the ingested FAA corpora (handbooks/, ac/, aim/,
# safo/, info/), `.claude/`, and git-ignored derived artifacts -- so it only
# ever touches genuinely authored docs. The formatter is idempotent, so on a
# clean repo this writes nothing and the wrapper opens no PR. When a doc has
# drifted, the worktree ends up dirty and the wrapper branches + commits +
# PRs the pure-formatting diff.
#
# Run from the repo root (the wrapper cd's there). Exit 0 on success.

set -euo pipefail

echo "markdown-format-drift: running md-format --all" >&2
bun tools/md-format/bin.ts --all >&2

if git diff --quiet; then
	echo "markdown-format-drift: no drift -- all authored markdown is canonical" >&2
	exit 0
fi

# Drift found. Leave the working tree dirty; the wrapper commits + opens the
# PR per `on_diff = "open-pr"` in job.toml. Report which files moved so the
# PR is reviewable at a glance.
echo "markdown-format-drift: reformatted the following file(s):" >&2
git diff --name-only >&2
exit 0
