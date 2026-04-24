/**
 * Stage, commit, and (in `pr` mode) push + open a PR for the sync output.
 *
 * Two modes driven by `HANGAR_SYNC_MODE` (`commit-local` | `pr`):
 *   - `commit-local` (default in dev): stage the files, commit on the
 *     current branch, return the new SHA.
 *   - `pr` (prod): create a new branch from HEAD, stage + commit, push,
 *     open a PR via `gh pr create`, return SHA + PR URL.
 *
 * File writes happen here too: the runner already regenerated TOML + TS
 * bodies in memory; this function is the single point where those bytes
 * hit disk (so a commit failure leaves the filesystem in a known state --
 * either "no changes" because we never wrote, or "wrote + committed").
 *
 * The process runner is injected so tests assert argv + bodies directly
 * without spawning real git / gh.
 */

import { mkdir, writeFile } from 'node:fs/promises';
import { dirname } from 'node:path';
import { HANGAR_SYNC_MODES, type HangarSyncMode } from '@ab/constants';
import {
	ghPrCreate,
	gitAdd,
	gitCheckoutNewBranch,
	gitCommit,
	gitCurrentBranch,
	gitPush,
	type ProcessRunner,
} from './git';
import { REPO_ROOT, SYNC_COMMIT_FILES } from './paths';
import type { CommitOutcome, FileWrites } from './types';

export interface CommitAndMaybePrInput {
	/** Absolute-path-keyed writes from `emitToml` + `emitAviationTs`. */
	writes: FileWrites;
	/** Driven by `HANGAR_SYNC_MODE`. */
	mode: HangarSyncMode;
	/** Actor id (for the commit message attribution). Null -> system. */
	actorId: string | null;
	/**
	 * Human-readable sync summary (e.g. "sync 3 references, 1 source").
	 * Becomes the commit subject; appended to the PR title in `pr` mode.
	 */
	summary: string;
	/** Optional factory for the branch name used in `pr` mode. */
	branchName?: () => string;
	/** Optional factory for `now()`; tests pin to a deterministic string. */
	now?: () => string;
	/** Process runner (defaults are injected higher up so tests stay pure). */
	runner: ProcessRunner;
	/** Working directory for git / gh. Defaults to the repo root. */
	cwd?: string;
}

function defaultBranchName(now: () => string): string {
	// Replace characters that are invalid in a branch name.
	const stamp = now().replace(/[:.]/g, '-');
	return `hangar-sync/${stamp}`;
}

function formatCommitMessage(input: { summary: string; actorId: string | null }): string {
	const actor = input.actorId ?? 'system';
	return `hangar: ${input.summary} (actor: ${actor})`;
}

function formatPrBody(input: { summary: string; files: readonly string[]; actorId: string | null }): string {
	const actor = input.actorId ?? 'system';
	const fileLines = input.files.map((f) => `- \`${f}\``).join('\n');
	return [
		'## Summary',
		'',
		`Automated sync from the hangar registry: ${input.summary}.`,
		'',
		'## Files',
		'',
		fileLines,
		'',
		'## Actor',
		'',
		actor,
	].join('\n');
}

async function ensureParentDir(path: string): Promise<void> {
	await mkdir(dirname(path), { recursive: true });
}

async function writeAllFiles(writes: FileWrites): Promise<void> {
	const entries = Object.entries(writes);
	for (const [path, body] of entries) {
		await ensureParentDir(path);
		await writeFile(path, body, 'utf8');
	}
}

/**
 * Run the mode-dependent commit flow. Returns the outcome (SHA, branch,
 * optional PR URL). Callers pass `mode` already resolved so the env lookup
 * stays close to the sync entry point.
 */
export async function commitAndMaybePr(input: CommitAndMaybePrInput): Promise<CommitOutcome> {
	const cwd = input.cwd ?? REPO_ROOT;
	const runner = input.runner;
	const now = input.now ?? (() => new Date().toISOString());

	// 1. Write files to disk so `git add` has something to stage.
	await writeAllFiles(input.writes);

	const baseBranch = await gitCurrentBranch(runner, cwd);
	let branch = baseBranch;

	if (input.mode === HANGAR_SYNC_MODES.PR) {
		branch = (input.branchName ?? (() => defaultBranchName(now)))();
		await gitCheckoutNewBranch(runner, branch, cwd);
	}

	const files = [...SYNC_COMMIT_FILES];
	await gitAdd(runner, files, cwd);
	const message = formatCommitMessage({ summary: input.summary, actorId: input.actorId });
	const sha = await gitCommit(runner, message, cwd);

	let prUrl: string | null = null;
	if (input.mode === HANGAR_SYNC_MODES.PR) {
		await gitPush(runner, branch, cwd);
		prUrl = await ghPrCreate(
			runner,
			{
				title: `hangar: ${input.summary}`,
				body: formatPrBody({ summary: input.summary, files, actorId: input.actorId }),
				base: baseBranch,
				head: branch,
			},
			cwd,
		);
	}

	return {
		mode: input.mode,
		sha,
		branch,
		files,
		prUrl,
	};
}
