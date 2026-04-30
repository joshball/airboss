#!/usr/bin/env bash
# Scaffold a new job from templates.
#
# Usage: ./new-job.sh <job-name>

set -euo pipefail

# shellcheck disable=SC1091
. "$(dirname "${BASH_SOURCE[0]}")/lib/common.sh"

if [ "$#" -lt 1 ]; then
	echo "usage: $0 <job-name>" >&2
	exit 1
fi

job_name="$1"
case "$job_name" in
	*[^a-z0-9-]*)
		echo "error: job name must be lowercase alphanumerics + hyphens only" >&2
		exit 1
		;;
esac

job_dir="$JOBS_FULL_DIR/$job_name"
if [ -d "$job_dir" ]; then
	echo "error: $JOBS_DIR/$job_name/ already exists" >&2
	exit 1
fi

templates="$MANAGER_FULL_DIR/templates"
if [ ! -d "$templates" ]; then
	echo "error: templates dir missing: $templates" >&2
	exit 1
fi

mkdir -p "$job_dir"

# Substitute {{NAME}} -> job name in each template.
# We escape sed metacharacters in $job_name even though the validator above
# limits it to [a-z0-9-]; defensive in case the validator ever loosens.
escaped_name="$(printf '%s' "$job_name" | sed -e 's/[\/&]/\\&/g')"
for template in "$templates"/*; do
	[ -f "$template" ] || continue
	name="$(basename "$template")"
	out_name="${name%.template}"
	sed "s/{{NAME}}/$escaped_name/g" "$template" > "$job_dir/$out_name"
done

chmod +x "$job_dir/run.sh" 2>/dev/null || true

cat >&2 <<EOF

Scaffolded $JOBS_DIR/$job_name/

Next:
  1. Edit $JOBS_DIR/$job_name/job.toml (set the schedule + behaviour)
  2. Edit $JOBS_DIR/$job_name/run.sh   (write the actual work)
  3. $MANAGER_DIR/install.sh           (register with launchd)
EOF
