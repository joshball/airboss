/**
 * Git + gh process runner.
 *
 * Factored behind a `ProcessRunner` interface so tests can assert on
 * exact argv sequences without spawning real subprocesses. The default
 * runner shells out via `node:child_process.spawn`; tests inject a fake
 * that records calls and replays canned responses.
 *
 * `child_process` is preferred over `Bun.spawn` here because this module
 * is loaded by the hangar SvelteKit server (which doesn't pull in Bun
 * types). Bun supports `node:child_process` transparently, so the same
 * runner works under both runtimes.
 */

import { spawn } from 'node:child_process';

/** One command invocation. */
export interface ProcessCall {
	cmd: string;
	args: readonly string[];
	/** Optional stdin body (used by `gh pr create --body-file -`). */
	stdin?: string;
	/** Optional working directory. Defaults to the repo root. */
	cwd?: string;
}

/** Result of one command invocation. */
export interface ProcessResult {
	exitCode: number;
	stdout: string;
	stderr: string;
}

/** Runner interface. Always succeeds must be explicit (non-zero exit -> throw). */
export type ProcessRunner = (call: ProcessCall) => Promise<ProcessResult>;

/** Thrown when a command exits non-zero. */
export class ProcessError extends Error {
	readonly exitCode: number;
	readonly cmd: string;
	readonly args: readonly string[];
	readonly stdout: string;
	readonly stderr: string;

	constructor(call: ProcessCall, result: ProcessResult) {
		super(`${call.cmd} ${call.args.join(' ')} exited ${result.exitCode}: ${result.stderr.trim()}`);
		this.name = 'ProcessError';
		this.exitCode = result.exitCode;
		this.cmd = call.cmd;
		this.args = call.args;
		this.stdout = result.stdout;
		this.stderr = result.stderr;
	}
}

/**
 * Default runner backed by `node:child_process.spawn`. Works under both
 * node and bun so hangar's SvelteKit server (node typing) and standalone
 * scripts (bun) share one implementation.
 */
export const nodeProcessRunner: ProcessRunner = async (call) =>
	new Promise((resolve, reject) => {
		const child = spawn(call.cmd, [...call.args], {
			cwd: call.cwd,
			stdio: ['pipe', 'pipe', 'pipe'],
		});
		let stdout = '';
		let stderr = '';
		child.stdout.on('data', (chunk: Buffer) => {
			stdout += chunk.toString('utf8');
		});
		child.stderr.on('data', (chunk: Buffer) => {
			stderr += chunk.toString('utf8');
		});
		child.on('error', reject);
		child.on('close', (code) => {
			resolve({ exitCode: code ?? 0, stdout, stderr });
		});
		if (call.stdin !== undefined) {
			child.stdin.write(call.stdin);
			child.stdin.end();
		} else {
			child.stdin.end();
		}
	});

/**
 * Helper that invokes the runner and throws `ProcessError` on non-zero exit.
 */
export async function run(runner: ProcessRunner, call: ProcessCall): Promise<ProcessResult> {
	const result = await runner(call);
	if (result.exitCode !== 0) throw new ProcessError(call, result);
	return result;
}

/** Stage one or more files by path. Relative to `cwd`. */
export async function gitAdd(runner: ProcessRunner, files: readonly string[], cwd?: string): Promise<void> {
	if (files.length === 0) return;
	await run(runner, { cmd: 'git', args: ['add', '--', ...files], cwd });
}

/** Create a commit with the given message. Returns the new SHA. */
export async function gitCommit(runner: ProcessRunner, message: string, cwd?: string): Promise<string> {
	await run(runner, { cmd: 'git', args: ['commit', '-m', message], cwd });
	const head = await run(runner, { cmd: 'git', args: ['rev-parse', 'HEAD'], cwd });
	return head.stdout.trim();
}

/** Return the current branch name. */
export async function gitCurrentBranch(runner: ProcessRunner, cwd?: string): Promise<string> {
	const result = await run(runner, { cmd: 'git', args: ['rev-parse', '--abbrev-ref', 'HEAD'], cwd });
	return result.stdout.trim();
}

/** Create + switch to a new branch from the current HEAD. */
export async function gitCheckoutNewBranch(runner: ProcessRunner, branch: string, cwd?: string): Promise<void> {
	await run(runner, { cmd: 'git', args: ['checkout', '-b', branch], cwd });
}

/** Push a branch to origin with upstream. */
export async function gitPush(runner: ProcessRunner, branch: string, cwd?: string): Promise<void> {
	await run(runner, { cmd: 'git', args: ['push', '-u', 'origin', branch], cwd });
}

/**
 * Open a GitHub PR via `gh pr create`. Body is piped through stdin to avoid
 * shell-escape footguns. Returns the PR URL from stdout.
 */
export async function ghPrCreate(
	runner: ProcessRunner,
	input: { title: string; body: string; base?: string; head?: string },
	cwd?: string,
): Promise<string> {
	const args = ['pr', 'create', '--title', input.title, '--body-file', '-'];
	if (input.base !== undefined) args.push('--base', input.base);
	if (input.head !== undefined) args.push('--head', input.head);
	const result = await run(runner, { cmd: 'gh', args, stdin: input.body, cwd });
	return result.stdout.trim();
}
