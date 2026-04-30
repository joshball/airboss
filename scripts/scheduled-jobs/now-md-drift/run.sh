#!/usr/bin/env bash
# now-md-drift -- detect "status: shipped" WPs that NOW.md's "In flight" section
# still references. Writes a markdown drift report to docs/loose-ends/now-md-drift-<date>.md
# if any drift is found; produces no diff otherwise.

set -euo pipefail

NOW_MD="docs/work/NOW.md"
WP_DIR="docs/work-packages"

if [ ! -f "$NOW_MD" ]; then
	echo "no $NOW_MD; nothing to check" >&2
	exit 0
fi

# Extract the "## In flight" section.
in_flight="$(awk '
	/^## In flight/ { in_section=1; next }
	in_section && /^## / { exit }
	in_section { print }
' "$NOW_MD")"

if [ -z "$in_flight" ]; then
	echo "no In flight section found in $NOW_MD" >&2
	exit 0
fi

# Find every WP link in the In flight section.
# Pattern: (../work-packages/<name>/spec.md)
mapfile -t referenced < <(echo "$in_flight" \
	| grep -oE '\(\.\./work-packages/[a-z0-9-]+/spec\.md\)' \
	| sed -E 's|\(\.\./work-packages/||; s|/spec\.md\)||' \
	| sort -u)

if [ "${#referenced[@]}" -eq 0 ]; then
	echo "In flight section references no WPs by link" >&2
	exit 0
fi

# For each referenced WP, check its spec frontmatter.
drift=()
for wp in "${referenced[@]}"; do
	spec="$WP_DIR/$wp/spec.md"
	if [ ! -f "$spec" ]; then continue; fi
	status="$(awk '/^---/{n++; next} n==1 && /^status:/ { print $2; exit }' "$spec")"
	if [ "$status" = "shipped" ]; then
		drift+=("$wp")
	fi
done

if [ "${#drift[@]}" -eq 0 ]; then
	echo "no drift" >&2
	exit 0
fi

# Drift found. Write a report.
date_stamp="$(date -u +%Y-%m-%d)"
report="docs/loose-ends/now-md-drift-$date_stamp.md"
mkdir -p "$(dirname "$report")"

{
	echo "---"
	echo "title: 'NOW.md drift -- $date_stamp'"
	echo "date: $date_stamp"
	echo "generator: scheduled-jobs/now-md-drift"
	echo "---"
	echo
	echo "# NOW.md drift -- $date_stamp"
	echo
	echo "These WPs are marked \`status: shipped\` in their spec frontmatter but"
	echo "are still listed in [NOW.md's \"In flight\" section](../work/NOW.md)."
	echo
	echo "Either move them to \"Just shipped\" in NOW.md, or correct the spec"
	echo "frontmatter if the WP isn't actually shipped."
	echo
	for wp in "${drift[@]}"; do
		echo "- [$wp](../work-packages/$wp/spec.md)"
	done
} > "$report"

echo "drift report: $report" >&2
echo "drifting WPs: ${drift[*]}" >&2
