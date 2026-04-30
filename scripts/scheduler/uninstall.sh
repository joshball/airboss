#!/usr/bin/env bash
# Remove plists installed by this skill.
#
#   ./uninstall.sh           -- this repo only (matches com.scheduled-jobs.<slug>.*)
#   ./uninstall.sh --all     -- every plist this skill ever generated, across all repos
#   ./uninstall.sh --dry-run -- show what would be removed without removing it
#   ./uninstall.sh --all --dry-run

set -euo pipefail
shopt -s nullglob

# shellcheck disable=SC1091
. "$(dirname "${BASH_SOURCE[0]}")/lib/common.sh"

mode="repo"
dry_run="no"
for arg in "$@"; do
	case "$arg" in
		--all)     mode="all" ;;
		--dry-run) dry_run="yes" ;;
		*) echo "unknown flag: $arg" >&2; exit 1 ;;
	esac
done

if [ "$mode" = "all" ]; then
	matches=( "$LAUNCH_AGENTS_DIR"/com.scheduled-jobs.*.plist )
else
	matches=( "$LAUNCH_AGENTS_DIR/$PLIST_PREFIX".*.plist )
fi

if [ "${#matches[@]}" -eq 0 ]; then
	echo "No matching plists found." >&2
	exit 0
fi

if [ "$mode" = "all" ] && [ "$dry_run" = "no" ]; then
	echo "About to remove ${#matches[@]} plist(s) across ALL repos:" >&2
	for plist in "${matches[@]}"; do
		echo "  - $(basename "$plist" .plist)" >&2
	done
	printf 'Continue? [y/N]: ' >&2
	read -r reply
	case "$reply" in
		y|Y|yes|YES) ;;
		*) echo "aborted." >&2; exit 0 ;;
	esac
fi

count=0
for plist in "${matches[@]}"; do
	label="$(basename "$plist" .plist)"
	if [ "$dry_run" = "yes" ]; then
		echo "would remove: $label" >&2
	else
		launchctl unload "$plist" 2>/dev/null || true
		rm -f "$plist"
		echo "removed: $label" >&2
	fi
	count=$((count+1))
done

if [ "$dry_run" = "yes" ]; then
	echo "Dry run. Would have removed $count plist(s)." >&2
else
	echo "Done. Removed $count plist(s)." >&2
fi
