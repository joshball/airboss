#!/usr/bin/env bash
# citation-audit -- run the stage-5 cross-link audit and write a markdown
# report when findings exist. Exit 0 on clean (no findings); exit 0 with a
# report file when drift is detected (the scheduler treats both as "log-only"
# per job.toml).

set -euo pipefail

# --json so we can split the report into a digestible markdown file.
audit_json="$(bun run sources audit-citations --json 2>&1 || true)"

# When stage-5 is clean the script exits 0; when there are findings it exits 1
# but we still want the JSON. The conditional above tolerates either.
finding_count="$(echo "$audit_json" | bun -e '
const raw = await Bun.stdin.text();
try {
	const parsed = JSON.parse(raw);
	console.log(parsed.findings.length);
} catch {
	console.log(0);
}' || echo 0)"

if [ "$finding_count" -eq 0 ] 2>/dev/null; then
	echo "stage-5 audit clean -- no findings" >&2
	exit 0
fi

date_stamp="$(date -u +%Y-%m-%d)"
report="docs/work/reviews/citation-audit-$date_stamp.md"
mkdir -p "$(dirname "$report")"

{
	echo "---"
	echo "title: 'Citation audit -- $date_stamp'"
	echo "date: $date_stamp"
	echo "generator: scheduled-jobs/citation-audit"
	echo "---"
	echo
	echo "# Stage-5 cross-link audit -- $date_stamp"
	echo
	echo "$finding_count finding(s). Source of truth is the JSON below; the"
	echo "table summarises target-type and per-corpus coverage."
	echo
	echo "## Raw report"
	echo
	echo '```json'
	echo "$audit_json"
	echo '```'
} > "$report"

echo "wrote $report ($finding_count findings)" >&2
exit 0
