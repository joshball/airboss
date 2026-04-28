#!/usr/bin/env bun
/**
 * `bun references download --id <source-id>`: CLI wrapper for the
 * hangar binary-visual fetch pipeline.
 *
 * Runs the same in-process pipeline the hangar UI's Fetch action drives
 * (`handleBinaryVisualFetch`): resolve edition -> short-circuit if no
 * change -> download -> drift-detect -> archive rotation -> write
 * meta.json + thumbnail -> commit to `data/sources/<type>/<id>/<edition>/`
 * and update the `hangar.source` row.
 *
 * Intended for operators who want a terminal-only path for a fetch
 * without standing up the hangar UI. The JobContext is a thin in-process
 * stub that logs to stdout/stderr (no DB job row is created); audit +
 * source-row writes still flow through the real pipeline adapters.
 *
 * Exit codes:
 *   0  success (fetched or no-change)
 *   1  failure (missing source id, edition drift, download error,
 *      checksum mismatch, etc.)
 */

import { resolve } from 'node:path';
import { handleBinaryVisualFetch, type SectionalFetchOutcome } from '@ab/bc-hangar';
import { JOB_KINDS, JOB_STATUSES } from '@ab/constants';
import type { JobContext, JobProgress } from '@ab/hangar-jobs';

const REPO_ROOT = resolve(import.meta.dirname ?? import.meta.dir, '..', '..');

const HELP_TEXT = `
bun references download --id <source-id>

Download a binary-visual source (e.g. a VFR sectional chart) via the same
in-process pipeline the hangar UI drives.

Flags:
  --id <source-id>   Required. The hangar.source.id to fetch (e.g. sectional-denver).
  --help, -h         Show this help.

Exit codes:
  0  success (fetched or no-change)
  1  failure (missing source, drift, 404, checksum mismatch, etc.)

Examples:
  bun references download --id sectional-denver
`;

export interface DownloadCliOptions {
	argv: readonly string[];
	stdout?: (line: string) => void;
	stderr?: (line: string) => void;
	/** Injected so tests can swap in a mock pipeline. */
	runFetch?: typeof handleBinaryVisualFetch;
	/** Overridable repo root for tests. */
	repoRoot?: string;
}

export interface DownloadCliResult {
	exitCode: number;
	outcome?: SectionalFetchOutcome;
}

function parseId(argv: readonly string[]): string | null {
	for (let i = 0; i < argv.length; i += 1) {
		const a = argv[i];
		if (a === '--id') return argv[i + 1] ?? null;
		if (a?.startsWith('--id=')) return a.slice('--id='.length);
	}
	return null;
}

function wantsHelp(argv: readonly string[]): boolean {
	return argv.includes('--help') || argv.includes('-h');
}

function buildCliContext(sourceId: string, stdout: (l: string) => void, stderr: (l: string) => void): JobContext {
	const now = new Date();
	const job = {
		id: `cli_${now.getTime()}`,
		kind: JOB_KINDS.FETCH_SOURCE,
		status: JOB_STATUSES.RUNNING,
		targetType: 'hangar.source',
		targetId: sourceId,
		actorId: null,
		progress: {},
		payload: { sourceId },
		result: null,
		error: null,
		createdAt: now,
		startedAt: now,
		finishedAt: null,
	} as unknown as JobContext['job'];

	return {
		job,
		reportProgress: async (p: JobProgress) => {
			const total = p.total ? `/${p.total}` : '';
			stdout(`[progress] step ${p.step}${total}: ${p.message}`);
		},
		logStdout: async (line) => stdout(line),
		logStderr: async (line) => stderr(line),
		logEvent: async (line) => stdout(`[event] ${line}`),
		isCancelled: async () => false,
	};
}

export async function runDownloadCli(options: DownloadCliOptions): Promise<DownloadCliResult> {
	const stdout = options.stdout ?? ((l: string) => console.log(l));
	const stderr = options.stderr ?? ((l: string) => console.error(l));
	const runFetch = options.runFetch ?? handleBinaryVisualFetch;
	const repoRoot = options.repoRoot ?? REPO_ROOT;

	if (wantsHelp(options.argv)) {
		stdout(HELP_TEXT.trim());
		return { exitCode: 0 };
	}

	const sourceId = parseId(options.argv);
	if (!sourceId) {
		stderr('error: --id <source-id> is required');
		stderr(HELP_TEXT.trim());
		return { exitCode: 1 };
	}

	const ctx = buildCliContext(sourceId, stdout, stderr);
	try {
		const outcome = await runFetch(ctx, sourceId, { repoRoot });
		stdout(
			`download: ${outcome.kind} (edition=${outcome.editionDate}, sha=${outcome.sha256.slice(0, 16)}, size=${outcome.sizeBytes} bytes)`,
		);
		return { exitCode: 0, outcome };
	} catch (err) {
		const message = err instanceof Error ? err.message : String(err);
		stderr(`download failed: ${message}`);
		return { exitCode: 1 };
	}
}

// Direct-invocation guard so `import { runDownloadCli } from './download'`
// in the test file does not re-enter the CLI.
if (import.meta.main) {
	const result = await runDownloadCli({ argv: process.argv.slice(2) });
	process.exit(result.exitCode);
}
