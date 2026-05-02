/**
 * Unit tests for the source-operation job handlers. Uses a fake spawn runner
 * + a fake JobContext so we never touch the DB or actually spawn subprocesses.
 *
 * Exercises the payload plumbing, exit-code-error path, output streaming, and
 * cancellation handoff to the runner. The integration-level path (real Bun
 * subprocess against a fixture source) is covered by the end-to-end manual
 * walkthrough in the test plan.
 */

import type { JobContext, JobProgress } from '@ab/hangar-jobs';
import { describe, expect, it } from 'vitest';
import {
	makeBuildHandler,
	makeDiffHandler,
	makeExtractHandler,
	makeFetchHandler,
	makeValidateHandler,
	type SpawnRunner,
	truncateLogLine,
	truncateResultText,
} from './source-jobs';

vi.mock('@ab/audit', () => ({
	AUDIT_OPS: { CREATE: 'create', UPDATE: 'update', DELETE: 'delete' },
	auditWrite: vi.fn(async () => {}),
}));

import { vi } from 'vitest';

interface FakeContext {
	ctx: JobContext;
	stdout: string[];
	stderr: string[];
	events: string[];
	progress: JobProgress[];
}

function fakeContext(overrides: {
	kind: string;
	payload?: Record<string, unknown>;
	isCancelled?: () => Promise<boolean>;
}): FakeContext {
	const stdout: string[] = [];
	const stderr: string[] = [];
	const events: string[] = [];
	const progress: JobProgress[] = [];
	const ctx: JobContext = {
		job: {
			id: 'job_test',
			kind: overrides.kind,
			status: 'running',
			targetType: 'hangar.source',
			targetId: (overrides.payload as { sourceId?: string } | undefined)?.sourceId ?? null,
			actorId: 'actor_test',
			progress: {},
			payload: overrides.payload ?? {},
			// biome-ignore lint/suspicious/noExplicitAny: test-only narrow of Row type.
			result: null as any,
			// biome-ignore lint/suspicious/noExplicitAny: test-only narrow of Row type.
			error: null as any,
			// biome-ignore lint/suspicious/noExplicitAny: test-only narrow of Row type.
			createdAt: new Date() as any,
			startedAt: new Date(),
			finishedAt: null,
		},
		reportProgress: async (p) => {
			progress.push(p);
		},
		logStdout: async (line) => {
			stdout.push(line);
		},
		logStderr: async (line) => {
			stderr.push(line);
		},
		logEvent: async (line) => {
			events.push(line);
		},
		isCancelled: overrides.isCancelled ?? (async () => false),
	};
	return { ctx, stdout, stderr, events, progress };
}

function makeSuccessRunner(stdout: readonly string[]): SpawnRunner {
	return async ({ onStdout }) => {
		for (const line of stdout) await onStdout(line);
		return { exitCode: 0, stdout, stderr: [] };
	};
}

function makeFailureRunner(exitCode: number, stderr: readonly string[]): SpawnRunner {
	return async ({ onStderr }) => {
		for (const line of stderr) await onStderr(line);
		return { exitCode, stdout: [], stderr };
	};
}

describe('source-jobs cancellation handoff', () => {
	it('runner observes ctx.isCancelled() and reports a non-zero exit code', async () => {
		// Track every poll the runner makes -- the handler hands `isCancelled`
		// straight through, so a runner that polls it once per tick exercises
		// the cancellation plumbing end-to-end.
		const polls: boolean[] = [];
		// `isCancelled` flips to `true` after the first poll; the runner then
		// returns a non-zero exit code as if SIGTERM landed on the child.
		const runner: SpawnRunner = async ({ isCancelled, onStdout }) => {
			await onStdout('progress: 25%');
			let safetyTicks = 0;
			while (true) {
				const cancelled = await isCancelled();
				polls.push(cancelled);
				if (cancelled) break;
				safetyTicks += 1;
				if (safetyTicks > 5) break; // prevent runaway loop in test
			}
			return { exitCode: 130, stdout: ['progress: 25%'], stderr: ['terminated'] };
		};
		const handler = makeFetchHandler({ runner, loadSource: async () => null });
		let calls = 0;
		const { ctx } = fakeContext({
			kind: 'fetch-source',
			payload: { sourceId: 'cfr-14' },
			isCancelled: async () => {
				calls += 1;
				return calls >= 2; // first poll = false, second poll = true
			},
		});
		// The handler throws on a non-zero exit code; we assert the cancellation
		// triggered that path AND that the runner observed at least one cancelled
		// poll (the SIGTERM signal in production code).
		await expect(handler(ctx)).rejects.toThrow(/exit/);
		expect(polls.some((p) => p === true)).toBe(true);
		expect(calls).toBeGreaterThanOrEqual(2);
	});

	it('runner sees isCancelled=true on the very first poll when the job is already cancelled', async () => {
		const polled: boolean[] = [];
		const runner: SpawnRunner = async ({ isCancelled }) => {
			polled.push(await isCancelled());
			return { exitCode: 130, stdout: [], stderr: [] };
		};
		const handler = makeFetchHandler({ runner, loadSource: async () => null });
		const { ctx } = fakeContext({
			kind: 'fetch-source',
			payload: { sourceId: 'cfr-14' },
			isCancelled: async () => true,
		});
		await expect(handler(ctx)).rejects.toThrow(/exit/);
		expect(polled).toEqual([true]);
	});
});

describe('source-jobs.makeFetchHandler', () => {
	it('runs the scan script with --id <sourceId> and streams stdout', async () => {
		const capturedCmd: string[][] = [];
		const runner: SpawnRunner = async ({ cmd, onStdout }) => {
			capturedCmd.push([...cmd]);
			await onStdout('sha256=abc');
			return { exitCode: 0, stdout: ['sha256=abc'], stderr: [] };
		};
		const handler = makeFetchHandler({ runner, loadSource: async () => null });
		const { ctx, stdout, progress } = fakeContext({
			kind: 'fetch-source',
			payload: { sourceId: 'cfr-14-91' },
		});
		const result = await handler(ctx);
		expect(capturedCmd[0]).toEqual(['bun', 'scripts/references/scan.ts', '--id', 'cfr-14-91']);
		expect(stdout).toEqual(['sha256=abc']);
		expect(result).toEqual(expect.objectContaining({ kind: 'fetch', sourceId: 'cfr-14-91', exitCode: 0 }));
		expect(progress[progress.length - 1]?.message).toBe('done');
	});

	it('throws when sourceId is missing', async () => {
		const handler = makeFetchHandler({ runner: makeSuccessRunner([]), loadSource: async () => null });
		const { ctx } = fakeContext({ kind: 'fetch-source', payload: {} });
		await expect(handler(ctx)).rejects.toThrow(/missing payload.sourceId/);
	});

	it('throws and reports exit code when the script fails', async () => {
		const handler = makeFetchHandler({ runner: makeFailureRunner(2, ['boom']), loadSource: async () => null });
		const { ctx, stderr, progress } = fakeContext({
			kind: 'fetch-source',
			payload: { sourceId: 'cfr-14-91' },
		});
		await expect(handler(ctx)).rejects.toThrow(/exited with code 2/);
		expect(stderr).toEqual(['boom']);
		expect(progress[progress.length - 1]?.message).toBe('exit 2');
	});
});

describe('source-jobs.makeExtractHandler', () => {
	it('runs extract with --source', async () => {
		const captured: string[][] = [];
		const runner: SpawnRunner = async ({ cmd }) => {
			captured.push([...cmd]);
			return { exitCode: 0, stdout: [], stderr: [] };
		};
		const handler = makeExtractHandler({ runner, loadSource: async () => null });
		const { ctx } = fakeContext({ kind: 'extract-source', payload: { sourceId: 'aim' } });
		const result = await handler(ctx);
		expect(captured[0]).toEqual(['bun', 'scripts/references/extract.ts', '--source', 'aim']);
		expect(result).toMatchObject({ kind: 'extract', sourceId: 'aim' });
	});
});

describe('source-jobs.makeBuildHandler', () => {
	it('runs build with no args', async () => {
		const captured: string[][] = [];
		const runner: SpawnRunner = async ({ cmd }) => {
			captured.push([...cmd]);
			return { exitCode: 0, stdout: [], stderr: [] };
		};
		const handler = makeBuildHandler({ runner });
		const { ctx } = fakeContext({ kind: 'build-references', payload: {} });
		const result = await handler(ctx);
		expect(captured[0]).toEqual(['bun', 'scripts/references/build.ts']);
		expect(result).toMatchObject({ kind: 'build' });
	});
});

describe('source-jobs.makeDiffHandler', () => {
	it('runs diff with the sourceId positional and returns the joined body', async () => {
		const runner: SpawnRunner = async ({ onStdout }) => {
			await onStdout('@@ -1 +1 @@');
			await onStdout('-old');
			await onStdout('+new');
			return { exitCode: 0, stdout: ['@@ -1 +1 @@', '-old', '+new'], stderr: [] };
		};
		const handler = makeDiffHandler({ runner, loadSource: async () => null });
		const { ctx } = fakeContext({ kind: 'diff-source', payload: { sourceId: 'cfr-14' } });
		const result = await handler(ctx);
		expect(result).toMatchObject({ kind: 'diff', sourceId: 'cfr-14', lines: 3 });
		expect(String(result?.text ?? '')).toContain('+new');
	});
});

describe('source-jobs.makeValidateHandler', () => {
	it('runs validate and returns its exit code', async () => {
		const handler = makeValidateHandler({ runner: makeSuccessRunner(['clean']) });
		const { ctx } = fakeContext({ kind: 'validate-references', payload: {} });
		const result = await handler(ctx);
		expect(result).toMatchObject({ kind: 'validate', exitCode: 0 });
	});
});

describe('source-jobs subprocess output cap', () => {
	it('truncateLogLine leaves under-cap lines untouched', () => {
		expect(truncateLogLine('hello')).toBe('hello');
	});

	it('truncateLogLine caps a multi-MiB line at JOB_LOG_MAX_BYTES + truncation marker', () => {
		const big = 'x'.repeat(2 * 1024 * 1024);
		const out = truncateLogLine(big);
		// Must end with the truncation marker so the operator knows the cut.
		expect(out.endsWith('[truncated]')).toBe(true);
		// Body before marker is bounded; total length is well below the
		// pathological 2 MiB input.
		expect(out.length).toBeLessThan(big.length / 100);
	});

	it('truncateResultText caps a noisy diff body under JOB_RESULT_TEXT_MAX_BYTES', () => {
		const noisyDiff = 'a'.repeat(1024 * 1024);
		const out = truncateResultText(noisyDiff);
		expect(out.endsWith('[truncated]')).toBe(true);
		// Should be at most ~256 KiB + marker, definitely much less than 1 MiB.
		expect(out.length).toBeLessThan(noisyDiff.length / 2);
	});

	it('runReferenceScript truncates a runaway stdout line before passing it to logStdout', async () => {
		const big = 'B'.repeat(1024 * 1024);
		const runner: SpawnRunner = async ({ onStdout }) => {
			await onStdout(big);
			return { exitCode: 0, stdout: [big], stderr: [] };
		};
		const handler = makeFetchHandler({ runner, loadSource: async () => null });
		const { ctx, stdout } = fakeContext({ kind: 'fetch-source', payload: { sourceId: 'cfr-14' } });
		await handler(ctx);
		// Exactly one line emitted; it's truncated at the cap, not the
		// pathological 1 MiB input. The job_log row therefore never carries
		// the unbounded payload.
		expect(stdout).toHaveLength(1);
		const emitted = stdout[0] ?? '';
		expect(emitted.endsWith('[truncated]')).toBe(true);
		expect(emitted.length).toBeLessThan(big.length / 10);
	});

	it('makeDiffHandler caps the result `text` field via truncateResultText', async () => {
		const big = 'x'.repeat(1024 * 1024);
		const runner: SpawnRunner = async ({ onStdout }) => {
			await onStdout(big);
			return { exitCode: 0, stdout: [big, big, big], stderr: [] };
		};
		const handler = makeDiffHandler({ runner, loadSource: async () => null });
		const { ctx } = fakeContext({ kind: 'diff-source', payload: { sourceId: 'cfr-14' } });
		const result = await handler(ctx);
		const text = String(result?.text ?? '');
		expect(text.endsWith('[truncated]')).toBe(true);
		expect(text.length).toBeLessThan(3 * big.length);
	});
});
