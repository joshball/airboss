#!/usr/bin/env bash
# Shared helpers sourced by every manager script. Not executed directly.

# Caller has already done `cd` to the manager dir or set MANAGER_DIR explicitly.
# Locate the manager dir from this file's path.
_LIB_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
MANAGER_FULL_DIR="$(cd "$_LIB_DIR/.." && pwd)"

# Find repo root by walking up from manager dir.
if ! REPO_ROOT="$(cd "$MANAGER_FULL_DIR" && git rev-parse --show-toplevel 2>/dev/null)"; then
	echo "error: could not determine repo root from $MANAGER_FULL_DIR" >&2
	exit 1
fi
if [ -z "$REPO_ROOT" ]; then
	echo "error: could not determine repo root from $MANAGER_FULL_DIR" >&2
	exit 1
fi

# Source per-repo config.
# shellcheck disable=SC1091
. "$MANAGER_FULL_DIR/.scheduler-config"

JOBS_FULL_DIR="$REPO_ROOT/$JOBS_DIR"
LAUNCH_AGENTS_DIR="$HOME/Library/LaunchAgents"
PLIST_PREFIX="com.scheduled-jobs.$REPO_SLUG"

require_yq() {
	if ! command -v yq >/dev/null 2>&1; then
		echo "error: yq required to parse job.toml. Install: brew install yq" >&2
		exit 1
	fi
}

# Read a TOML key from job.toml. yq's TOML support: -p toml.
# Usage: toml_get <job.toml path> <key path>  e.g. toml_get foo/job.toml '.behaviour.on_diff'
toml_get() {
	local path="$1"
	local key="$2"
	yq -p toml -o yaml "$key" "$path" 2>/dev/null
}

list_jobs() {
	# Print every job dir name on stdout.
	if [ ! -d "$JOBS_FULL_DIR" ]; then return 0; fi
	find "$JOBS_FULL_DIR" -mindepth 1 -maxdepth 1 -type d -exec basename {} \; | sort
}

job_plist_label() {
	echo "$PLIST_PREFIX.$1"
}

job_plist_path() {
	echo "$LAUNCH_AGENTS_DIR/$(job_plist_label "$1").plist"
}

job_log_dir() {
	echo "$LOGS_DIR/$1"
}

ensure_dirs() {
	mkdir -p "$LAUNCH_AGENTS_DIR" "$LOGS_DIR" "$MANAGER_FULL_DIR/.cache/locks"
}

# Generate a launchd plist for a single job.
# Args:
#   $1 job name (dir name under $JOBS_DIR)
#   $2 path to job.toml
# Writes to job_plist_path on success. Returns non-zero if disabled or malformed.
generate_plist() {
	local job_name="$1"
	local toml="$2"
	local label
	label="$(job_plist_label "$job_name")"

	local enabled schedule run_at auto_disable working_dir
	enabled="$(toml_get "$toml" '.enabled')"
	if [ "$enabled" = "false" ]; then return 1; fi

	schedule="$(toml_get "$toml" '.schedule')"
	run_at="$(toml_get "$toml" '.run_at')"
	auto_disable="$(toml_get "$toml" '.auto_disable')"
	working_dir="$(toml_get "$toml" '.behaviour.working_dir')"
	if [ -z "$working_dir" ] || [ "$working_dir" = "null" ]; then working_dir="."; fi

	local log_dir
	log_dir="$(job_log_dir "$job_name")"
	mkdir -p "$log_dir"

	local plist_path
	plist_path="$(job_plist_path "$job_name")"

	local cadence_xml
	if [ -n "$schedule" ] && [ "$schedule" != "null" ]; then
		cadence_xml="$(cron_to_plist_calendar "$schedule")" || {
			echo "error: malformed cron in $toml: $schedule" >&2
			return 2
		}
	elif [ -n "$run_at" ] && [ "$run_at" != "null" ]; then
		# launchd's StartCalendarInterval has no Year key, so the cadence
		# would otherwise re-fire annually. Require auto_disable=true so the
		# plist removes itself after the one-time fire.
		if [ "$auto_disable" != "true" ]; then
			echo "error: $toml uses 'run_at' without 'auto_disable = true'. launchd has no Year key, so the job would re-fire every year. Set auto_disable=true." >&2
			return 2
		fi
		cadence_xml="$(iso_to_plist_calendar "$run_at")" || {
			echo "error: malformed run_at in $toml: $run_at" >&2
			return 2
		}
	else
		echo "error: $toml has neither 'schedule' nor 'run_at'" >&2
		return 2
	fi

	# RunAtLoad is intentionally NOT set: we don't want jobs to fire at
	# launchctl load time. StartCalendarInterval handles scheduling. macOS
	# coalesces missed fires after wake -- if the laptop is asleep at the
	# scheduled time, launchd fires the job once on next wake. (See
	# DESIGN.md decision 1.)
	cat > "$plist_path" <<PLIST
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
	<key>Label</key>
	<string>$label</string>
	<key>ProgramArguments</key>
	<array>
		<string>/bin/bash</string>
		<string>$MANAGER_FULL_DIR/run-job.sh</string>
		<string>$job_name</string>
	</array>
	<key>WorkingDirectory</key>
	<string>$REPO_ROOT</string>
	<key>StandardOutPath</key>
	<string>$log_dir/stdout.log</string>
	<key>StandardErrorPath</key>
	<string>$log_dir/stderr.log</string>
	<key>EnvironmentVariables</key>
	<dict>
		<key>PATH</key>
		<string>/opt/homebrew/bin:/usr/local/bin:/usr/bin:/bin:/opt/homebrew/sbin:/usr/sbin:/sbin</string>
		<key>HOME</key>
		<string>$HOME</string>
	</dict>
$cadence_xml
</dict>
</plist>
PLIST
	echo "$plist_path"
	return 0
}

# Convert a 5-field cron string ("min hour dom mon dow") to launchd
# StartCalendarInterval.
#
# Supported subset (intentional v1 simplicity):
#   - `*` (any)
#   - bare integer in the field's valid range
#
# NOT supported (rejected with a clear error):
#   - lists ("1,15,30")
#   - ranges ("1-5")
#   - steps ("*/15")
#   - named months/weekdays ("MON", "JAN")
#
# A common cron quirk: with both DOM and DOW set, cron uses OR semantics but
# launchd's StartCalendarInterval uses AND. We refuse the combination instead
# of silently doing the wrong thing.
cron_to_plist_calendar() {
	local cron="$1"
	# Disable globbing so '*' in cron fields stays literal.
	set -f
	# shellcheck disable=SC2206
	local fields=( $cron )
	set +f
	if [ "${#fields[@]}" -ne 5 ]; then
		echo "cron: expected 5 fields, got ${#fields[@]} ('$cron')" >&2
		return 1
	fi
	local min="${fields[0]}" hour="${fields[1]}" dom="${fields[2]}" mon="${fields[3]}" dow="${fields[4]}"

	_validate_cron_field() {
		local field="$1" max="$2" name="$3"
		if [ "$field" = "*" ]; then return 0; fi
		if ! [[ "$field" =~ ^[0-9]+$ ]]; then
			echo "cron: $name field '$field' uses unsupported syntax (only '*' or bare integer)" >&2
			return 1
		fi
		if [ "$field" -lt 0 ] || [ "$field" -gt "$max" ]; then
			echo "cron: $name field '$field' out of range (0..$max)" >&2
			return 1
		fi
	}

	_validate_cron_field "$min"  59 minute  || return 1
	_validate_cron_field "$hour" 23 hour    || return 1
	_validate_cron_field "$dom"  31 day     || return 1
	_validate_cron_field "$mon"  12 month   || return 1
	_validate_cron_field "$dow"   7 weekday || return 1

	if [ "$dom" != "*" ] && [ "$dow" != "*" ]; then
		echo "cron: setting both day-of-month and day-of-week is ambiguous between cron (OR) and launchd (AND); pick one" >&2
		return 1
	fi

	echo "	<key>StartCalendarInterval</key>"
	echo "	<dict>"
	[ "$min"  != "*" ] && echo "		<key>Minute</key>  <integer>$min</integer>"
	[ "$hour" != "*" ] && echo "		<key>Hour</key>    <integer>$hour</integer>"
	[ "$dom"  != "*" ] && echo "		<key>Day</key>     <integer>$dom</integer>"
	[ "$mon"  != "*" ] && echo "		<key>Month</key>   <integer>$mon</integer>"
	[ "$dow"  != "*" ] && echo "		<key>Weekday</key> <integer>$dow</integer>"
	echo "	</dict>"
}

# Convert an ISO 8601 datetime to a one-time StartCalendarInterval.
# Year is set explicitly; launchd will fire once at the next match. Combined
# with auto_disable, the plist removes itself after fire.
iso_to_plist_calendar() {
	local iso="$1"
	# Parse with `date` (BSD on macOS).
	local year month day hour minute
	if ! year="$(date -j -f '%Y-%m-%dT%H:%M:%S%z' "${iso/Z/+0000}" '+%Y' 2>/dev/null)"; then
		# Try without timezone (assume local).
		if ! year="$(date -j -f '%Y-%m-%dT%H:%M:%S' "${iso%%[+-]*}" '+%Y' 2>/dev/null)"; then
			return 1
		fi
		month="$(date -j -f '%Y-%m-%dT%H:%M:%S' "${iso%%[+-]*}" '+%m')"
		day="$(  date -j -f '%Y-%m-%dT%H:%M:%S' "${iso%%[+-]*}" '+%d')"
		hour="$( date -j -f '%Y-%m-%dT%H:%M:%S' "${iso%%[+-]*}" '+%H')"
		minute="$(date -j -f '%Y-%m-%dT%H:%M:%S' "${iso%%[+-]*}" '+%M')"
	else
		month="$( date -j -f '%Y-%m-%dT%H:%M:%S%z' "${iso/Z/+0000}" '+%m')"
		day="$(   date -j -f '%Y-%m-%dT%H:%M:%S%z' "${iso/Z/+0000}" '+%d')"
		hour="$(  date -j -f '%Y-%m-%dT%H:%M:%S%z' "${iso/Z/+0000}" '+%H')"
		minute="$(date -j -f '%Y-%m-%dT%H:%M:%S%z' "${iso/Z/+0000}" '+%M')"
	fi
	# Strip leading zeros so plist gets clean integers.
	month=$((10#$month)); day=$((10#$day)); hour=$((10#$hour)); minute=$((10#$minute))

	echo "	<key>StartCalendarInterval</key>"
	echo "	<dict>"
	echo "		<key>Month</key>  <integer>$month</integer>"
	echo "		<key>Day</key>    <integer>$day</integer>"
	echo "		<key>Hour</key>   <integer>$hour</integer>"
	echo "		<key>Minute</key> <integer>$minute</integer>"
	echo "	</dict>"
}
