#!/usr/bin/env bash
# cert-goals-drop-trigger-watch -- nightly check on engine-targeting telemetry.
#
# Reads the engine-targeting source distribution for the last 14 days from the DB
# (via `bun run db check engine-targeting-source --window=14d`). When the result
# says READY TO DROP, ships the staged migration by:
#
#   1. Renaming `libs/bc/study/src/0NNN_drop_cert_goals.sql` (or its drizzle
#      sibling under drizzle/) to the next sequential migration number
#   2. Running `bunx drizzle-kit generate` to regenerate the journal
#
# The wrapper handles branch + commit + PR.
#
# Until the trigger fires, this script logs status and exits 0 with no diff.

set -euo pipefail

CHECK_OUTPUT_FILE="$(mktemp)"
trap 'rm -f "$CHECK_OUTPUT_FILE"' EXIT

# Run the DB check. Tolerate non-zero exit (the script may exit non-zero when
# reporting NOT READY -- we read its stdout to decide).
if ! bun run db check engine-targeting-source --window=14d > "$CHECK_OUTPUT_FILE" 2>&1; then
	# Check whether the output is well-formed despite the non-zero exit.
	if ! grep -qE '^(READY TO DROP|NOT READY|NO DATA)' "$CHECK_OUTPUT_FILE"; then
		echo "engine-targeting check failed unexpectedly:" >&2
		cat "$CHECK_OUTPUT_FILE" >&2
		exit 1
	fi
fi

verdict="$(grep -m1 -E '^(READY TO DROP|NOT READY|NO DATA)' "$CHECK_OUTPUT_FILE" || echo 'UNKNOWN')"

case "$verdict" in
	"READY TO DROP"*)
		echo "==> trigger fired: $verdict" >&2
		;;
	"NOT READY"*)
		echo "==> not yet: $verdict" >&2
		exit 0
		;;
	"NO DATA"*)
		echo "==> no telemetry data yet: $verdict" >&2
		exit 0
		;;
	*)
		echo "==> unknown verdict from check: $verdict" >&2
		cat "$CHECK_OUTPUT_FILE" >&2
		exit 1
		;;
esac

# --- READY TO DROP path ------------------------------------------------------

# Locate the staged migration. The engine-goal-cutover WP staged a file with a
# placeholder name; find it.
staged="$(find drizzle libs/bc/study/src -maxdepth 3 -type f -name '*drop_cert_goals*.sql' 2>/dev/null | head -1)"
if [ -z "$staged" ]; then
	echo "error: no staged drop_cert_goals migration found" >&2
	exit 1
fi

# Compute the next sequential migration number from drizzle/.
last_num="$(ls drizzle/[0-9][0-9][0-9][0-9]_*.sql 2>/dev/null | sed -E 's|drizzle/([0-9]{4})_.*|\1|' | sort -n | tail -1)"
if [ -z "$last_num" ]; then
	echo "error: could not infer next migration number from drizzle/" >&2
	exit 1
fi
next_num="$(printf '%04d' "$((10#$last_num + 1))")"
new_path="drizzle/${next_num}_drop_cert_goals.sql"

# If staged is already in drizzle/ with the wrong number, just rename. Otherwise copy.
if [ "$(dirname "$staged")" = "drizzle" ]; then
	git mv "$staged" "$new_path" 2>/dev/null || mv "$staged" "$new_path"
else
	mkdir -p drizzle
	mv "$staged" "$new_path"
fi

# Regenerate journal so the migration is registered.
if command -v bunx >/dev/null 2>&1; then
	bunx drizzle-kit generate >/dev/null 2>&1 || true
fi

echo "==> staged migration shipped as $new_path" >&2
echo "==> wrapper will open PR" >&2
