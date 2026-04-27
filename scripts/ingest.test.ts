/**
 * Tests for the unified ingest dispatcher (`scripts/ingest.ts`).
 *
 * The dispatcher is responsible only for routing -- per-corpus arg parsing,
 * validation, and execution live in `libs/sources/src/<corpus>/ingest.ts`.
 * These tests stub the per-corpus runners by mutating the `SUBCOMMANDS`
 * registry so we exercise dispatch behavior without touching the live
 * ingestion code.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { runIngestDispatcher, SUBCOMMANDS, type Subcommand, type SubcommandSpec } from './ingest';

interface CallRecord {
	readonly name: Subcommand;
	readonly argv: readonly string[];
}

let calls: CallRecord[];
let stdoutSpy: ReturnType<typeof vi.spyOn>;
let stderrSpy: ReturnType<typeof vi.spyOn>;
let stdoutChunks: string[];
let stderrChunks: string[];
const originalSpecs = new Map<Subcommand, SubcommandSpec>();

function stubSubcommand(name: Subcommand, exitCode: number): void {
	originalSpecs.set(name, SUBCOMMANDS[name]);
	const original = SUBCOMMANDS[name];
	const stub: SubcommandSpec = {
		help: original.help,
		run: async (argv) => {
			calls.push({ name, argv });
			return exitCode;
		},
	};
	(SUBCOMMANDS as Record<Subcommand, SubcommandSpec>)[name] = stub;
}

function restoreSubcommands(): void {
	for (const [name, spec] of originalSpecs) {
		(SUBCOMMANDS as Record<Subcommand, SubcommandSpec>)[name] = spec;
	}
	originalSpecs.clear();
}

beforeEach(() => {
	calls = [];
	stdoutChunks = [];
	stderrChunks = [];
	stdoutSpy = vi.spyOn(process.stdout, 'write').mockImplementation((chunk) => {
		stdoutChunks.push(typeof chunk === 'string' ? chunk : chunk.toString());
		return true;
	});
	stderrSpy = vi.spyOn(process.stderr, 'write').mockImplementation((chunk) => {
		stderrChunks.push(typeof chunk === 'string' ? chunk : chunk.toString());
		return true;
	});
});

afterEach(() => {
	restoreSubcommands();
	stdoutSpy.mockRestore();
	stderrSpy.mockRestore();
});

describe('top-level help and routing', () => {
	it('--help prints the dispatcher usage banner and exits 0', async () => {
		const code = await runIngestDispatcher(['--help']);
		expect(code).toBe(0);
		const out = stdoutChunks.join('');
		expect(out).toContain('bun run ingest <corpus>');
		expect(out).toContain('cfr');
		expect(out).toContain('handbooks');
		expect(out).toContain('aim');
	});

	it('-h is an alias for --help', async () => {
		const code = await runIngestDispatcher(['-h']);
		expect(code).toBe(0);
		expect(stdoutChunks.join('')).toContain('bun run ingest <corpus>');
	});

	it('no arguments prints usage to stderr and exits non-zero', async () => {
		const code = await runIngestDispatcher([]);
		expect(code).not.toBe(0);
		expect(stderrChunks.join('')).toContain('bun run ingest <corpus>');
		expect(stdoutChunks.join('')).toBe('');
	});

	it('unknown subcommand prints helpful message and exits non-zero', async () => {
		const code = await runIngestDispatcher(['nonsense']);
		expect(code).not.toBe(0);
		const err = stderrChunks.join('');
		expect(err).toContain('unknown corpus: nonsense');
		expect(err).toContain('bun run ingest <corpus>');
	});
});

describe('per-subcommand help', () => {
	it('cfr --help prints the cfr-specific usage', async () => {
		const code = await runIngestDispatcher(['cfr', '--help']);
		expect(code).toBe(0);
		const out = stdoutChunks.join('');
		expect(out).toContain('bun run ingest cfr');
		expect(out).toContain('--title=');
	});

	it('handbooks --help prints the handbooks-specific usage', async () => {
		const code = await runIngestDispatcher(['handbooks', '--help']);
		expect(code).toBe(0);
		const out = stdoutChunks.join('');
		expect(out).toContain('bun run ingest handbooks');
		expect(out).toContain('--doc=');
	});

	it('aim --help prints the aim-specific usage', async () => {
		const code = await runIngestDispatcher(['aim', '--help']);
		expect(code).toBe(0);
		const out = stdoutChunks.join('');
		expect(out).toContain('bun run ingest aim');
		expect(out).toContain('--edition=');
	});

	it('per-subcommand --help short-circuits before invoking the runner', async () => {
		stubSubcommand('cfr', 0);
		const code = await runIngestDispatcher(['cfr', '--help']);
		expect(code).toBe(0);
		expect(calls).toHaveLength(0);
	});
});

describe('argument forwarding', () => {
	it('cfr forwards remaining args to the cfr runner', async () => {
		stubSubcommand('cfr', 0);
		const code = await runIngestDispatcher(['cfr', '--title=14', '--fixture=x.xml']);
		expect(code).toBe(0);
		expect(calls).toEqual([{ name: 'cfr', argv: ['--title=14', '--fixture=x.xml'] }]);
	});

	it('handbooks forwards remaining args to the handbooks runner', async () => {
		stubSubcommand('handbooks', 0);
		const code = await runIngestDispatcher(['handbooks', '--doc=phak', '--edition=8083-25C']);
		expect(code).toBe(0);
		expect(calls).toEqual([{ name: 'handbooks', argv: ['--doc=phak', '--edition=8083-25C'] }]);
	});

	it('aim forwards remaining args to the aim runner', async () => {
		stubSubcommand('aim', 0);
		const code = await runIngestDispatcher(['aim', '--edition=2026-09']);
		expect(code).toBe(0);
		expect(calls).toEqual([{ name: 'aim', argv: ['--edition=2026-09'] }]);
	});

	it('propagates the per-subcommand exit code', async () => {
		stubSubcommand('cfr', 7);
		const code = await runIngestDispatcher(['cfr', '--fixture=x.xml']);
		expect(code).toBe(7);
	});
});

describe('--all', () => {
	it('invokes every registered subcommand with the forwarded args', async () => {
		stubSubcommand('cfr', 0);
		stubSubcommand('handbooks', 0);
		stubSubcommand('aim', 0);
		const code = await runIngestDispatcher(['--all']);
		expect(code).toBe(0);
		expect(calls.map((c) => c.name)).toEqual(['cfr', 'handbooks', 'aim']);
		for (const c of calls) expect(c.argv).toEqual([]);
	});

	it('returns the first non-zero exit code, but still runs every subcommand', async () => {
		stubSubcommand('cfr', 0);
		stubSubcommand('handbooks', 5);
		stubSubcommand('aim', 9);
		const code = await runIngestDispatcher(['--all']);
		expect(code).toBe(5);
		expect(calls.map((c) => c.name)).toEqual(['cfr', 'handbooks', 'aim']);
	});

	it('forwards trailing args to every subcommand', async () => {
		stubSubcommand('cfr', 0);
		stubSubcommand('handbooks', 0);
		stubSubcommand('aim', 0);
		const code = await runIngestDispatcher(['--all', '--out=/tmp/x']);
		expect(code).toBe(0);
		for (const c of calls) expect(c.argv).toEqual(['--out=/tmp/x']);
	});
});
