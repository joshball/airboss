#!/usr/bin/env bash
# List jobs in this repo + their installed status, schedule, last run.

set -euo pipefail

# shellcheck disable=SC1091
. "$(dirname "${BASH_SOURCE[0]}")/lib/common.sh"

require_yq

if ! ls "$JOBS_FULL_DIR"/*/job.toml >/dev/null 2>&1; then
	echo "No jobs in $JOBS_DIR/. Author one with:" >&2
	echo "  $MANAGER_DIR/new-job.sh <job-name>" >&2
	exit 0
fi

printf '%-36s %-9s %-22s %-22s %-9s\n' "JOB" "INSTALLED" "SCHEDULE" "LAST RUN" "STATUS"
printf '%-36s %-9s %-22s %-22s %-9s\n' \
	"------------------------------------" \
	"---------" \
	"----------------------" \
	"----------------------" \
	"---------"

while IFS= read -r job_name; do
	[ -n "$job_name" ] || continue
	toml="$JOBS_FULL_DIR/$job_name/job.toml"
	[ -f "$toml" ] || continue

	enabled="$(toml_get "$toml" '.enabled')"
	schedule="$(toml_get "$toml" '.schedule')"
	run_at="$(toml_get "$toml" '.run_at')"

	cadence="-"
	if [ -n "$schedule" ] && [ "$schedule" != "null" ]; then
		cadence="cron: $schedule"
	elif [ -n "$run_at" ] && [ "$run_at" != "null" ]; then
		cadence="once: $run_at"
	fi

	plist_path="$(job_plist_path "$job_name")"
	if [ -f "$plist_path" ]; then
		installed="yes"
	elif [ "$enabled" = "false" ]; then
		installed="disabled"
	else
		installed="no"
	fi

	last_run="-"
	last_status="-"
	runs_log="$(job_log_dir "$job_name")/runs.jsonl"
	if [ -f "$runs_log" ] && [ -s "$runs_log" ]; then
		if command -v jq >/dev/null 2>&1; then
			last_run="$(tail -n 1 "$runs_log" | jq -r '.started // .ts // "-"')"
			last_status="$(tail -n 1 "$runs_log" | jq -r '.status // "-"')"
		else
			last_run="(install jq)"
			last_status="?"
		fi
	fi

	printf '%-36s %-9s %-22s %-22s %-9s\n' "$job_name" "$installed" "$cadence" "$last_run" "$last_status"
done < <(list_jobs)

echo >&2 ""
echo "scheduler-version: $SCHEDULER_VERSION  repo-slug: $REPO_SLUG  logs: $LOGS_DIR" >&2
echo "more detail: $MANAGER_DIR/status.sh <job-name> [--runs|--err]" >&2
