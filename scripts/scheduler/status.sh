#!/usr/bin/env bash
# Show recent log output for one job.
#
# Usage: ./status.sh <job-name> [--lines=N] [--runs] [--err]
#   --lines=N  tail N lines (default 50)
#   --runs     show structured run log instead of stdout
#   --err      show stderr instead of stdout

set -euo pipefail

# shellcheck disable=SC1091
. "$(dirname "${BASH_SOURCE[0]}")/lib/common.sh"

if [ "$#" -lt 1 ]; then
	echo "usage: $0 <job-name> [--lines=N] [--runs] [--err]" >&2
	exit 1
fi

job_name="$1"; shift
lines=50
target="stdout"

for arg in "$@"; do
	case "$arg" in
		--lines=*)
			val="${arg#--lines=}"
			if ! [[ "$val" =~ ^[0-9]+$ ]] || [ "$val" -lt 1 ]; then
				echo "error: --lines must be a positive integer (got '$val')" >&2
				exit 1
			fi
			lines="$val"
			;;
		--runs) target="runs" ;;
		--err) target="stderr" ;;
		*) echo "unknown flag: $arg" >&2; exit 1 ;;
	esac
done

log_dir="$(job_log_dir "$job_name")"
case "$target" in
	stdout) log_file="$log_dir/stdout.log" ;;
	stderr) log_file="$log_dir/stderr.log" ;;
	runs)   log_file="$log_dir/runs.jsonl" ;;
esac

if [ ! -f "$log_file" ]; then
	echo "no log yet: $log_file"
	echo "(job hasn't fired, or hasn't been installed)"
	exit 0
fi

echo "==> $log_file (last $lines lines)"
tail -n "$lines" "$log_file"
