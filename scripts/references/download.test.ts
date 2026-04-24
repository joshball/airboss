/**
 * CLI tests for `bun references download`. Mocks the fetch pipeline so
 * nothing touches the network / filesystem / database, and asserts the
 * dispatcher wires flags, success, and failure cases correctly.
 */

import type { JobContext } from '@ab/hangar-jobs';
import { describe, expect, it, vi } from 'vitest';

// Stub the DB + audit transitive imports from source-fetch so the CLI's
// pipeline import does not require a live database or env. The CLI swaps
// in an injected `runFetch` for every test case, so these stubs are
// never actually invoked; they just satisfy module-load side effects.
vi.mock('@ab/db', () => ({
	db: {},
	hangarSource: {},
}));
vi.mock('@ab/audit', () => ({
	AUDIT_OPS: { CREATE: 'create', UPDATE: 'update', DELETE: 'delete' },
	AUDIT_TARGETS: {
		HANGAR_SOURCE: 'hangar.source',
		HANGAR_SOURCE_EDITION_RESOLVED: 'hangar.source.edition-resolved',
		HANGAR_SOURCE_EDITION_DRIFT: 'hangar.source.edition-drift',
		HANGAR_SOURCE_THUMBNAIL_GENERATED: 'hangar.source.thumbnail-generated',
	},
	auditWrite: vi.fn(async () => {}),
}));

import type { SectionalFetchOutcome } from '../../apps/hangar/src/lib/server/source-fetch';
import { runDownloadCli } from './download';

function captureIo() {
	const stdout: string[] = [];
	const stderr: string[] = [];
	return {
		stdout: (l: string) => stdout.push(l),
		stderr: (l: string) => stderr.push(l),
		stdoutLines: stdout,
		stderrLines: stderr,
	};
}

function fakeOutcome(overrides: Partial<SectionalFetchOutcome> = {}): SectionalFetchOutcome {
	return {
		kind: 'fetched',
		editionDate: '2026-03-21',
		resolvedUrl: 'https://host/Denver.zip',
		sha256: 'aa'.repeat(32),
		sizeBytes: 1024,
		thumbnailPath: 'data/sources/sectional/sectional-denver/2026-03-21/thumb.jpg',
		generator: 'gdal_translate',
		archiveEntries: [{ name: 'Denver.tif', sizeBytes: 1000 }],
		...overrides,
	};
}

describe('runDownloadCli', () => {
	it('exits 0 and prints summary on successful fetch', async () => {
		const io = captureIo();
		const runFetch = vi.fn(async (_ctx: JobContext, _id: string) => fakeOutcome());

		const result = await runDownloadCli({
			argv: ['--id', 'sectional-denver'],
			stdout: io.stdout,
			stderr: io.stderr,
			runFetch,
			repoRoot: '/tmp/repo',
		});

		expect(result.exitCode).toBe(0);
		expect(runFetch).toHaveBeenCalledTimes(1);
		const [, sourceId, opts] = runFetch.mock.calls[0] ?? [];
		expect(sourceId).toBe('sectional-denver');
		expect(opts?.repoRoot).toBe('/tmp/repo');
		expect(io.stdoutLines.some((l) => l.startsWith('download: fetched'))).toBe(true);
	});

	it('accepts --id=<value> flag form', async () => {
		const io = captureIo();
		const runFetch = vi.fn(async () => fakeOutcome());

		const result = await runDownloadCli({
			argv: ['--id=sectional-denver'],
			stdout: io.stdout,
			stderr: io.stderr,
			runFetch,
			repoRoot: '/tmp/repo',
		});

		expect(result.exitCode).toBe(0);
		expect(runFetch.mock.calls[0]?.[1]).toBe('sectional-denver');
	});

	it('reports no-change outcomes as success', async () => {
		const io = captureIo();
		const runFetch = vi.fn(async () => fakeOutcome({ kind: 'no-change' }));

		const result = await runDownloadCli({
			argv: ['--id', 'sectional-denver'],
			stdout: io.stdout,
			stderr: io.stderr,
			runFetch,
			repoRoot: '/tmp/repo',
		});

		expect(result.exitCode).toBe(0);
		expect(io.stdoutLines.some((l) => l.startsWith('download: no-change'))).toBe(true);
	});

	it('exits 1 when --id is missing', async () => {
		const io = captureIo();
		const runFetch = vi.fn(async () => fakeOutcome());

		const result = await runDownloadCli({
			argv: [],
			stdout: io.stdout,
			stderr: io.stderr,
			runFetch,
			repoRoot: '/tmp/repo',
		});

		expect(result.exitCode).toBe(1);
		expect(runFetch).not.toHaveBeenCalled();
		expect(io.stderrLines.some((l) => l.includes('--id <source-id> is required'))).toBe(true);
	});

	it('exits 1 when the pipeline throws (drift, 404, checksum, etc.)', async () => {
		const io = captureIo();
		const runFetch = vi.fn(async () => {
			throw new Error('edition-drift: sha mismatch');
		});

		const result = await runDownloadCli({
			argv: ['--id', 'sectional-denver'],
			stdout: io.stdout,
			stderr: io.stderr,
			runFetch,
			repoRoot: '/tmp/repo',
		});

		expect(result.exitCode).toBe(1);
		expect(io.stderrLines.some((l) => l.includes('edition-drift'))).toBe(true);
		expect(io.stderrLines.some((l) => l.startsWith('download failed'))).toBe(true);
	});

	it('exits 1 when the pipeline throws a non-Error value', async () => {
		const io = captureIo();
		const runFetch = vi.fn(async () => {
			throw 'raw string failure';
		});

		const result = await runDownloadCli({
			argv: ['--id', 'sectional-denver'],
			stdout: io.stdout,
			stderr: io.stderr,
			runFetch,
			repoRoot: '/tmp/repo',
		});

		expect(result.exitCode).toBe(1);
		expect(io.stderrLines.some((l) => l.includes('raw string failure'))).toBe(true);
	});

	it('prints --help and exits 0 without calling the pipeline', async () => {
		const io = captureIo();
		const runFetch = vi.fn(async () => fakeOutcome());

		const result = await runDownloadCli({
			argv: ['--help'],
			stdout: io.stdout,
			stderr: io.stderr,
			runFetch,
			repoRoot: '/tmp/repo',
		});

		expect(result.exitCode).toBe(0);
		expect(runFetch).not.toHaveBeenCalled();
		const helpBlob = io.stdoutLines.join('\n');
		expect(helpBlob).toContain('bun references download --id <source-id>');
		expect(helpBlob).toContain('--id <source-id>');
		expect(helpBlob).toContain('Exit codes');
	});

	it('forwards progress + event log lines to stdout', async () => {
		const io = captureIo();
		const runFetch = vi.fn(async (ctx: JobContext) => {
			await ctx.logEvent('resolving edition');
			await ctx.reportProgress({ step: 2, total: 7, message: 'downloading' });
			return fakeOutcome();
		});

		const result = await runDownloadCli({
			argv: ['--id', 'sectional-denver'],
			stdout: io.stdout,
			stderr: io.stderr,
			runFetch,
			repoRoot: '/tmp/repo',
		});

		expect(result.exitCode).toBe(0);
		expect(io.stdoutLines.some((l) => l.includes('[event] resolving edition'))).toBe(true);
		expect(io.stdoutLines.some((l) => l.includes('[progress] step 2/7: downloading'))).toBe(true);
	});
});
