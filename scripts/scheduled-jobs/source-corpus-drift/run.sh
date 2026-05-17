#!/usr/bin/env bash
# source-corpus-drift -- run the monthly source-corpus drift check and write a
# markdown report when an upstream FAA / eCFR document has a newer revision
# than the local cache. Exit 0 on clean (no drift); exit 0 with a report file
# when drift is detected (the scheduler treats both as "log-only" per job.toml).

set -euo pipefail

# `--strict` exits non-zero when any catalogued document is non-fresh. Capture
# both the output and the exit code; `report` HEAD-checks live URLs, so a
# transient network failure surfaces as `HEAD failed` rows, not a crash.
report_output="$(bun run sources report --strict --no-color 2>&1)" && report_exit=0 || report_exit=$?

if [ "$report_exit" -eq 0 ]; then
	echo "source-corpus drift check clean -- every catalogued document is fresh" >&2
	exit 0
fi

# A non-zero exit from `report --strict` means drift (or a HEAD failure). Write
# a dated report so the operator can review which documents need attention.
date_stamp="$(date -u +%Y-%m-%d)"
report="docs/work/reviews/source-corpus-drift-$date_stamp.md"
mkdir -p "$(dirname "$report")"

{
	echo "---"
	echo "title: 'Source-corpus drift -- $date_stamp'"
	echo "date: $date_stamp"
	echo "generator: scheduled-jobs/source-corpus-drift"
	echo "---"
	echo
	echo "# Source-corpus drift -- $date_stamp"
	echo
	echo "One or more catalogued FAA / eCFR documents have a newer revision"
	echo "upstream than the local cache, or could not be HEAD-checked."
	echo
	echo "Review the verdict table below. To refresh, run \`bun run sources download\`,"
	echo "then re-verify any citations the new edition may have renumbered."
	echo
	echo "## Report"
	echo
	echo '```text'
	echo "$report_output"
	echo '```'
} > "$report"

echo "wrote $report" >&2
exit 0
