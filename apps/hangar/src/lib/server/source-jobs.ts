/**
 * Hangar source-operation job handlers.
 *
 * Wrap the `scripts/references/*` dispatcher as `@ab/hangar-jobs` handlers so
 * every terminal-available operation is reachable from the UI with a streamed
 * log. Handlers shell out via `Bun.spawn` by default; tests inject a fake
 * `spawnRunner` so we can exercise success, failure, and cancellation without
 * actually running subprocesses.
 *
 * Contract:
 *   - Each handler reads its `payload.sourceId` (if the operation targets a
 *     single source) and serialises its subprocess output into the job log.
 *   - Long-running handlers poll `ctx.isCancelled()` between streaming boundaries.
 *   - Handler return values land in `hangar.job.result` (JSONB) so the UI can
 *     render operation-specific payloads -- for example the diff hunks.
 */

import { spawn } from 'node:child_process';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { AUDIT_OPS, auditWrite } from '@ab/audit';
import { AUDIT_TARGETS } from '@ab/constants';
import type { JobContext, JobHandler } from '@ab/hangar-jobs';

const HERE = dirname(fileURLToPath(import.meta.url));
/** Three ascents: src/lib/server/ -> src/lib/ -> src/ -> app root -> repo root. */
export const REPO_ROOT = resolve(HERE, '..', '..', '..', '..', '..');

/** Shape a subprocess runner produces; aligns with the smaller of the Bun + node APIs. */
export interface SpawnResult {
	exitCode: number;
	/** Streamed stdout lines, in order. */
	stdout: readonly string[];
	/** Streamed stderr lines, in order. */
	stderr: readonly string[];
}

/** Callable runner the handlers use. Injectable for tests. */
export type SpawnRunner = (args: {
	cmd: readonly string[];
	cwd: string;
	onStdout: (line: string) => Promise<void> | void;
	onStderr: (line: string) => Promise<void> | void;
	isCancelled: () => Promise<boolean>;
}) => Promise<SpawnResult>;

/**
 * How often the cancellation poll fires once a subprocess is running.
 * The loop stays a no-op when the job isn't cancelled, so a 500 ms cadence
 * is plenty for "stop this long-running extract".
 */
const CANCEL_POLL_INTERVAL_MS = 500;

/**
 * Default runner backed by `node:child_process.spawn`. Uses node's stdio
 * event APIs so it works under both node and bun (hangar runs under node
 * in the SvelteKit server; bun only powers the dev tooling).
 *
 * Streams stdout + stderr line-by-line into the provided callbacks. The
 * `isCancelled` poll runs on a separate timer so we can SIGTERM the child
 * promptly after the user cancels the job, even when the child hasn't
 * produced output in a while.
 */
export const nodeSpawnRunner: SpawnRunner = async ({ cmd, cwd, onStdout, onStderr, isCancelled }) => {
	const [head, ...rest] = cmd;
	if (!head) throw new Error('spawn runner called with empty cmd');
	const child = spawn(head, rest, { cwd, stdio: ['ignore', 'pipe', 'pipe'] });

	const outLines: string[] = [];
	const errLines: string[] = [];

	function installLineBuffer(
		stream: NodeJS.ReadableStream,
		sink: string[],
		emit: (line: string) => Promise<void> | void,
	): Promise<void> {
		return new Promise((resolveStream) => {
			let buffer = '';
			stream.setEncoding('utf8');
			stream.on('data', async (chunk: string) => {
				buffer += chunk;
				let nl = buffer.indexOf('\n');
				while (nl >= 0) {
					const line = buffer.slice(0, nl);
					buffer = buffer.slice(nl + 1);
					sink.push(line);
					await emit(line);
					nl = buffer.indexOf('\n');
				}
			});
			stream.on('end', async () => {
				if (buffer.length > 0) {
					sink.push(buffer);
					await emit(buffer);
				}
				resolveStream();
			});
			stream.on('error', () => resolveStream());
		});
	}

	const cancelPoll = setInterval(async () => {
		if (await isCancelled()) {
			child.kill('SIGTERM');
		}
	}, CANCEL_POLL_INTERVAL_MS);

	const stdoutDone = child.stdout ? installLineBuffer(child.stdout, outLines, onStdout) : Promise.resolve();
	const stderrDone = child.stderr ? installLineBuffer(child.stderr, errLines, onStderr) : Promise.resolve();

	const exitCode = await new Promise<number>((resolveExit) => {
		child.on('close', (code) => resolveExit(code ?? 0));
		child.on('error', () => resolveExit(-1));
	});
	clearInterval(cancelPoll);
	await Promise.all([stdoutDone, stderrDone]);

	return { exitCode, stdout: outLines, stderr: errLines };
};

/** Options for every source-job handler (test-overridable). */
export interface SourceJobOptions {
	runner?: SpawnRunner;
	repoRoot?: string;
}

/** What a targeted-source job looks like in `payload`. */
export interface TargetedSourcePayload {
	sourceId: string;
	[key: string]: unknown;
}

function readSourceId(ctx: JobContext): string {
	const payload = ctx.job.payload as Partial<TargetedSourcePayload>;
	if (typeof payload?.sourceId !== 'string' || payload.sourceId.length === 0) {
		throw new Error(`${ctx.job.kind} job ${ctx.job.id} missing payload.sourceId`);
	}
	return payload.sourceId;
}

/** Emit `completed / exit-code` + audit the operation. Shared by every handler. */
async function finalizeAudit(ctx: JobContext, targetId: string, extras: Record<string, unknown>): Promise<void> {
	await auditWrite({
		actorId: ctx.job.actorId,
		op: AUDIT_OPS.UPDATE,
		targetType: AUDIT_TARGETS.HANGAR_SOURCE,
		targetId,
		metadata: { jobKind: ctx.job.kind, jobId: ctx.job.id, ...extras },
	});
}

/**
 * Generic "spawn `bun scripts/references/<cmd>`" driver. All of the
 * scan / extract / build / diff / validate / size-report handlers share this
 * shape; they only differ in the script path + the way the result is shaped.
 */
async function runReferenceScript(
	ctx: JobContext,
	args: {
		scriptPath: string;
		extraArgs: readonly string[];
		options: SourceJobOptions;
	},
): Promise<{ exitCode: number; stdout: readonly string[]; stderr: readonly string[] }> {
	const runner = args.options.runner ?? nodeSpawnRunner;
	const cwd = args.options.repoRoot ?? REPO_ROOT;
	const cmd = ['bun', args.scriptPath, ...args.extraArgs];

	await ctx.logEvent(`spawning: ${cmd.join(' ')}`);
	await ctx.reportProgress({ step: 1, total: 2, message: `running ${args.scriptPath}` });

	const result = await runner({
		cmd,
		cwd,
		onStdout: (line) => ctx.logStdout(line),
		onStderr: (line) => ctx.logStderr(line),
		isCancelled: () => ctx.isCancelled(),
	});

	await ctx.reportProgress({
		step: 2,
		total: 2,
		message: result.exitCode === 0 ? 'done' : `exit ${result.exitCode}`,
	});
	if (result.exitCode !== 0) {
		throw new Error(`${args.scriptPath} exited with code ${result.exitCode}`);
	}
	return result;
}

export function makeFetchHandler(options: SourceJobOptions = {}): JobHandler {
	return async (ctx) => {
		const sourceId = readSourceId(ctx);
		const result = await runReferenceScript(ctx, {
			scriptPath: 'scripts/references/scan.ts',
			extraArgs: ['--id', sourceId],
			options,
		});
		await finalizeAudit(ctx, sourceId, { outcome: 'fetched', lines: result.stdout.length });
		return {
			kind: 'fetch',
			sourceId,
			exitCode: result.exitCode,
			stdoutLines: result.stdout.length,
		};
	};
}

export function makeExtractHandler(options: SourceJobOptions = {}): JobHandler {
	return async (ctx) => {
		const sourceId = readSourceId(ctx);
		const result = await runReferenceScript(ctx, {
			scriptPath: 'scripts/references/extract.ts',
			extraArgs: ['--source', sourceId],
			options,
		});
		await finalizeAudit(ctx, sourceId, { outcome: 'extracted' });
		return { kind: 'extract', sourceId, exitCode: result.exitCode, stdoutLines: result.stdout.length };
	};
}

export function makeBuildHandler(options: SourceJobOptions = {}): JobHandler {
	return async (ctx) => {
		const result = await runReferenceScript(ctx, {
			scriptPath: 'scripts/references/build.ts',
			extraArgs: [],
			options,
		});
		await auditWrite({
			actorId: ctx.job.actorId,
			op: AUDIT_OPS.UPDATE,
			targetType: AUDIT_TARGETS.HANGAR_SOURCE,
			targetId: 'registry',
			metadata: { jobKind: ctx.job.kind, jobId: ctx.job.id, outcome: 'built' },
		});
		return { kind: 'build', exitCode: result.exitCode, stdoutLines: result.stdout.length };
	};
}

export function makeDiffHandler(options: SourceJobOptions = {}): JobHandler {
	return async (ctx) => {
		const sourceId = readSourceId(ctx);
		const result = await runReferenceScript(ctx, {
			scriptPath: 'scripts/references/diff.ts',
			extraArgs: [sourceId],
			options,
		});
		const body = result.stdout.join('\n');
		await finalizeAudit(ctx, sourceId, { outcome: 'diffed' });
		return {
			kind: 'diff',
			sourceId,
			exitCode: result.exitCode,
			text: body,
			lines: result.stdout.length,
		};
	};
}

export function makeValidateHandler(options: SourceJobOptions = {}): JobHandler {
	return async (ctx) => {
		const result = await runReferenceScript(ctx, {
			scriptPath: 'scripts/references/validate.ts',
			extraArgs: [],
			options,
		});
		await auditWrite({
			actorId: ctx.job.actorId,
			op: AUDIT_OPS.UPDATE,
			targetType: AUDIT_TARGETS.HANGAR_SOURCE,
			targetId: 'registry',
			metadata: { jobKind: ctx.job.kind, jobId: ctx.job.id, outcome: 'validated' },
		});
		return { kind: 'validate', exitCode: result.exitCode, stdoutLines: result.stdout.length };
	};
}

export function makeSizeReportHandler(options: SourceJobOptions = {}): JobHandler {
	return async (ctx) => {
		const result = await runReferenceScript(ctx, {
			scriptPath: 'scripts/references/size-report.ts',
			extraArgs: [],
			options,
		});
		await auditWrite({
			actorId: ctx.job.actorId,
			op: AUDIT_OPS.UPDATE,
			targetType: AUDIT_TARGETS.HANGAR_SOURCE,
			targetId: 'registry',
			metadata: { jobKind: ctx.job.kind, jobId: ctx.job.id, outcome: 'reported' },
		});
		return {
			kind: 'size-report',
			exitCode: result.exitCode,
			text: result.stdout.join('\n'),
			lines: result.stdout.length,
		};
	};
}

/**
 * Upload handler. Unlike the others this does not shell out; the form action
 * writes the temp file, and the handler archives the prior version + updates
 * the `hangar.source` row. Implementation lives in `upload-handler.ts` so the
 * non-subprocess IO is testable in isolation.
 */
export { makeUploadHandler } from './upload-handler';
