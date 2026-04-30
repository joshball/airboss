#!/usr/bin/env bash
# Wrapper invoked by launchd. Runs a job's run.sh in an isolated git worktree,
# captures output, and (optionally) opens a PR if the job produced a diff.
#
# Why a worktree: the user's main checkout is owned by the user (and other
# agents). We must never `git checkout -b`, `git add -A`, or `git commit` on
# a working tree that someone might be editing. The worktree gives the job
# its own HEAD, index, and working files; we tear it down on exit.
#
# Usage: run-job.sh <job-name>

set -uo pipefail

# shellcheck disable=SC1091
. "$(dirname "${BASH_SOURCE[0]}")/lib/common.sh"

job_name="${1:-}"
if [ -z "$job_name" ]; then
	echo "usage: $0 <job-name>" >&2
	exit 1
fi

job_dir="$JOBS_FULL_DIR/$job_name"
toml="$job_dir/job.toml"
run_script="$job_dir/run.sh"

if [ ! -f "$toml" ]; then echo "no job.toml: $toml" >&2; exit 1; fi
if [ ! -f "$run_script" ]; then echo "no run.sh: $run_script" >&2; exit 1; fi

require_yq

# --- locking (portable: mkdir is atomic) -------------------------------------
lock_dir="$MANAGER_FULL_DIR/.cache/locks/$job_name.d"
mkdir -p "$(dirname "$lock_dir")"
trap 'rmdir "$lock_dir" 2>/dev/null || true' EXIT
if ! mkdir "$lock_dir" 2>/dev/null; then
	# Stale lock? If the dir is older than 6h, assume the previous run died.
	if [ -d "$lock_dir" ] && [ -z "$(find "$lock_dir" -maxdepth 0 -mmin -360 2>/dev/null)" ]; then
		echo "warn: stale lock dir found (>6h old); removing and continuing" >&2
		rm -rf "$lock_dir"
		if ! mkdir "$lock_dir" 2>/dev/null; then
			echo "skipped: lost race for stale lock recovery on $job_name" >&2
			trap - EXIT
			exit 0
		fi
	else
		echo "skipped: previous run still active for $job_name" >&2
		trap - EXIT
		exit 0
	fi
fi

# --- read config -------------------------------------------------------------
on_diff="$(toml_get "$toml" '.behaviour.on_diff')"
if [ -z "$on_diff" ] || [ "$on_diff" = "null" ]; then on_diff="open-pr"; fi
branch_prefix="$(toml_get "$toml" '.behaviour.branch_prefix')"
if [ -z "$branch_prefix" ] || [ "$branch_prefix" = "null" ]; then branch_prefix="scheduled/"; fi
auto_disable="$(toml_get "$toml" '.auto_disable')"
working_dir="$(toml_get "$toml" '.behaviour.working_dir')"
if [ -z "$working_dir" ] || [ "$working_dir" = "null" ]; then working_dir="."; fi
base_branch="$(toml_get "$toml" '.behaviour.base_branch')"
if [ -z "$base_branch" ] || [ "$base_branch" = "null" ]; then base_branch="main"; fi

# pr_labels: yq emits a yaml sequence; flatten to comma-separated for gh.
pr_labels_raw="$(toml_get "$toml" '.behaviour.pr_labels')"
pr_labels=""
if [ -n "$pr_labels_raw" ] && [ "$pr_labels_raw" != "null" ]; then
	pr_labels="$(printf '%s\n' "$pr_labels_raw" | sed -E 's/^- *//; /^$/d' | paste -sd, -)"
fi

# --- log dir -----------------------------------------------------------------
log_dir="$(job_log_dir "$job_name")"
mkdir -p "$log_dir"
runs_log="$log_dir/runs.jsonl"

# --- jsonl helper (uses jq for safe quoting) ---------------------------------
log_run() {
	# Args are alternating key/value pairs.
	if ! command -v jq >/dev/null 2>&1; then
		# Last-resort fallback: emit a minimal record without jq.
		printf '{"job":"%s","ts":"%s","note":"jq missing; partial log"}\n' \
			"$job_name" "$(date -u +%Y-%m-%dT%H:%M:%SZ)" >> "$runs_log"
		return
	fi
	local args=()
	while [ "$#" -gt 0 ]; do
		args+=(--arg "$1" "$2")
		shift 2
	done
	jq -nc "${args[@]}" '$ARGS.named' >> "$runs_log"
}

# --- helpers (defined before use) --------------------------------------------
maybe_auto_disable() {
	if [ "$auto_disable" = "true" ]; then
		local plist_path
		plist_path="$(job_plist_path "$job_name")"
		echo "==> auto_disable=true -- removing plist after fire" >&2
		launchctl unload "$plist_path" 2>/dev/null || true
		rm -f "$plist_path"
	fi
}

# --- safety: refuse to run if main checkout is in a fragile state ------------
# We won't run if HEAD is detached or a rebase/merge/cherry-pick is in progress.
# (The job runs in its own worktree, but the checkout we branch FROM is the
# main repo's main/master, and we don't want to operate adjacent to a half-
# finished operation.)
git_dir="$(git -C "$REPO_ROOT" rev-parse --git-dir 2>/dev/null || echo "")"
if [ -z "$git_dir" ]; then
	echo "skipped: $REPO_ROOT is not a git repo" >&2
	exit 0
fi
if [ -e "$git_dir/rebase-merge" ] || [ -e "$git_dir/rebase-apply" ] \
	|| [ -e "$git_dir/MERGE_HEAD" ] || [ -e "$git_dir/CHERRY_PICK_HEAD" ] \
	|| [ -e "$git_dir/BISECT_LOG" ]; then
	echo "skipped: main repo is mid-rebase/merge/cherry-pick/bisect; refusing to run" >&2
	log_run job "$job_name" status skipped reason fragile_repo_state
	exit 0
fi

# --- log entry start ---------------------------------------------------------
started="$(date -u +%Y-%m-%dT%H:%M:%SZ)"
sha_before="$(git -C "$REPO_ROOT" rev-parse "$base_branch" 2>/dev/null || echo "unknown")"
if [ "$sha_before" = "unknown" ]; then
	echo "skipped: base branch '$base_branch' does not exist in $REPO_ROOT" >&2
	log_run job "$job_name" status skipped reason missing_base_branch base "$base_branch"
	exit 0
fi

echo "==> [$started] running $job_name (sha=$sha_before, on_diff=$on_diff)" >&2

# --- create isolated worktree -----------------------------------------------
# Worktree path sits next to the main repo, NOT inside it (so the wrapper's
# git ops can't accidentally touch the main checkout).
stamp="$(date -u +%Y%m%d-%H%M%S)"
wt_branch="${branch_prefix}${job_name}-${stamp}"
wt_root="$REPO_ROOT/../.scheduled-jobs-worktrees/$REPO_SLUG/$job_name-$stamp"
mkdir -p "$(dirname "$wt_root")"

cleanup_worktree() {
	# Run on every exit path. Removes the worktree but leaves $wt_branch alone
	# if it has a successful PR (we'll have pushed it). On failure paths we
	# delete the local branch so it doesn't accumulate.
	local keep_branch="${1:-no}"
	if [ -d "$wt_root" ]; then
		git -C "$REPO_ROOT" worktree remove --force "$wt_root" 2>/dev/null || rm -rf "$wt_root"
	fi
	if [ "$keep_branch" != "yes" ]; then
		git -C "$REPO_ROOT" branch -D "$wt_branch" 2>/dev/null || true
	fi
}
# Update the EXIT trap to cover both lock + worktree.
trap 'cleanup_worktree no; rmdir "$lock_dir" 2>/dev/null || true' EXIT

if ! git -C "$REPO_ROOT" worktree add -b "$wt_branch" "$wt_root" "$base_branch" >/dev/null 2>&1; then
	echo "error: failed to create worktree at $wt_root" >&2
	log_run job "$job_name" started "$started" status failed reason worktree_create_failed
	exit 1
fi

# --- run the job inside the worktree ----------------------------------------
job_stdout="$log_dir/last-run.stdout"
job_stderr="$log_dir/last-run.stderr"

(
	cd "$wt_root/$working_dir"
	bash "$run_script"
) >"$job_stdout" 2>"$job_stderr"
rc=$?

ended="$(date -u +%Y-%m-%dT%H:%M:%SZ)"

if [ "$rc" -ne 0 ]; then
	echo "==> [$ended] $job_name exited $rc" >&2
	log_run job "$job_name" started "$started" ended "$ended" sha_before "$sha_before" \
		status failed exit "$rc"
	# Also auto-disable a one-time job that errored, so we don't loop on
	# a permanent failure. (User can re-enable by editing job.toml.)
	maybe_auto_disable
	exit "$rc"
fi

# --- diff handling -----------------------------------------------------------
diff_present=0
if [ -n "$(git -C "$wt_root" status --porcelain)" ]; then
	diff_present=1
fi

if [ "$diff_present" -eq 0 ]; then
	echo "==> [$ended] $job_name: no diff produced" >&2
	log_run job "$job_name" started "$started" ended "$ended" sha_before "$sha_before" \
		status ok diff false
	maybe_auto_disable
	exit 0
fi

case "$on_diff" in
	log-only)
		patch_file="$log_dir/diffs/$started.patch"
		mkdir -p "$(dirname "$patch_file")"
		# Capture tracked + untracked. `git add -N` makes untracked show up
		# in `git diff` without staging them.
		(
			cd "$wt_root"
			git add -N .
			git diff
		) > "$patch_file"
		echo "==> [$ended] $job_name: diff captured -> $patch_file" >&2
		log_run job "$job_name" started "$started" ended "$ended" sha_before "$sha_before" \
			status ok diff true diff_action log-only patch "$patch_file"
		maybe_auto_disable
		exit 0
		;;
	open-pr)
		# Commit + push from the worktree.
		if ! command -v gh >/dev/null 2>&1; then
			echo "==> diff present but gh CLI missing; cannot open PR" >&2
			log_run job "$job_name" started "$started" ended "$ended" sha_before "$sha_before" \
				status failed reason missing_gh
			exit 1
		fi

		commit_msg="chore(scheduled-job): $job_name auto-PR

Job ran at $started UTC and produced a working-tree diff.

See log: $runs_log"

		if ! (
			cd "$wt_root"
			git add -A
			git -c user.name="scheduled-jobs" -c user.email="scheduled-jobs@local" \
				commit -m "$commit_msg"
		) >/dev/null; then
			echo "==> commit failed for $wt_branch" >&2
			log_run job "$job_name" started "$started" ended "$ended" sha_before "$sha_before" \
				status failed reason commit_failed branch "$wt_branch"
			exit 1
		fi

		if ! git -C "$wt_root" push -u origin "$wt_branch" >/dev/null 2>&1; then
			echo "==> push failed for $wt_branch" >&2
			log_run job "$job_name" started "$started" ended "$ended" sha_before "$sha_before" \
				status failed reason push_failed branch "$wt_branch"
			exit 1
		fi

		gh_args=(pr create --head "$wt_branch" --base "$base_branch"
			--title "chore(scheduled-job): $job_name ($stamp)"
			--body "Auto-opened by scheduled job \`$job_name\` at $started UTC. Review the diff and decide whether to merge or close.")
		if [ -n "$pr_labels" ]; then
			gh_args+=(--label "$pr_labels")
		fi

		pr_url="$(gh -R "$(git -C "$REPO_ROOT" config --get remote.origin.url 2>/dev/null || true)" "${gh_args[@]}" 2>&1 || true)"

		echo "==> opened PR: $pr_url" >&2
		log_run job "$job_name" started "$started" ended "$ended" sha_before "$sha_before" \
			status ok diff true diff_action open-pr branch "$wt_branch" pr_url "$pr_url"

		# Keep the branch -- it's pushed and has a PR.
		trap 'cleanup_worktree yes; rmdir "$lock_dir" 2>/dev/null || true' EXIT
		maybe_auto_disable
		exit 0
		;;
	*)
		echo "error: unknown on_diff: $on_diff" >&2
		log_run job "$job_name" started "$started" ended "$ended" sha_before "$sha_before" \
			status failed reason "unknown_on_diff:$on_diff"
		exit 1
		;;
esac
