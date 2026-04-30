#!/usr/bin/env bash
# Generate a plist for every enabled job and load it into launchd.
# Idempotent -- existing plists are unloaded + regenerated + reloaded.

set -uo pipefail

# shellcheck disable=SC1091
. "$(dirname "${BASH_SOURCE[0]}")/lib/common.sh"

require_yq
ensure_dirs

count_installed=0
count_skipped=0
count_failed=0

while IFS= read -r job_name; do
	[ -n "$job_name" ] || continue
	toml="$JOBS_FULL_DIR/$job_name/job.toml"
	if [ ! -f "$toml" ]; then
		echo "skip: $job_name (no job.toml)" >&2
		count_skipped=$((count_skipped+1))
		continue
	fi

	# Unload existing plist first so reinstall is clean.
	plist_path="$(job_plist_path "$job_name")"
	label="$(job_plist_label "$job_name")"
	if [ -f "$plist_path" ]; then
		launchctl unload "$plist_path" 2>/dev/null || true
	fi

	# Capture rc directly so we can distinguish disabled (1) from malformed (2).
	generate_plist "$job_name" "$toml" >/dev/null
	gen_rc=$?
	case "$gen_rc" in
		0)
			if launchctl load "$plist_path" 2>/dev/null; then
				echo "installed: $label" >&2
				count_installed=$((count_installed+1))
			else
				echo "fail (load): $label" >&2
				count_failed=$((count_failed+1))
			fi
			;;
		1)
			echo "disabled:  $job_name" >&2
			count_skipped=$((count_skipped+1))
			# Remove any stale plist for a now-disabled job.
			[ -f "$plist_path" ] && rm -f "$plist_path"
			;;
		2)
			echo "fail (config): $job_name -- see error above" >&2
			count_failed=$((count_failed+1))
			;;
		*)
			echo "fail (rc=$gen_rc): $job_name" >&2
			count_failed=$((count_failed+1))
			;;
	esac
done < <(list_jobs)

echo >&2 ""
if [ "$count_failed" -eq 0 ]; then
	echo "Done. installed=$count_installed skipped=$count_skipped failed=$count_failed" >&2
	exit 0
else
	echo "Failed. installed=$count_installed skipped=$count_skipped failed=$count_failed" >&2
	exit 1
fi
