/**
 * Tests for the unified register dispatcher (`scripts/sources/register.ts`).
 *
 * The dispatcher is responsible only for routing -- per-corpus arg parsing,
 * validation, and execution live in `libs/sources/src/<corpus>/ingest.ts`.
 * These tests stub the per-corpus runners by mutating the `REGISTER_SUBCOMMANDS`
 * registry so we exercise dispatch behavior without touching the live
 * ingestion code.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { REGISTER_SUBCOMMANDS, type RegisterCorpus, type RegisterSpec, runRegisterDispatcher } from './register';

interface CallRecord {
	readonly name: RegisterCorpus;
	readonly argv: readonly string[];
}

let calls: CallRecord[];
let stdoutSpy: ReturnType<typeof vi.spyOn>;
let stderrSpy: ReturnType<typeof vi.spyOn>;
let stdoutChunks: string[];
let stderrChunks: string[];
const originalSpecs = new Map<RegisterCorpus, RegisterSpec>();

function stubRegisterCorpus(name: RegisterCorpus, exitCode: number): void {
	originalSpecs.set(name, REGISTER_SUBCOMMANDS[name]);
	const original = REGISTER_SUBCOMMANDS[name];
	const stub: RegisterSpec = {
		help: original.help,
		run: async (argv) => {
			calls.push({ name, argv });
			return exitCode;
		},
	};
	(REGISTER_SUBCOMMANDS as Record<RegisterCorpus, RegisterSpec>)[name] = stub;
}

function restoreRegisterSubcommands(): void {
	for (const [name, spec] of originalSpecs) {
		(REGISTER_SUBCOMMANDS as Record<RegisterCorpus, RegisterSpec>)[name] = spec;
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
	restoreRegisterSubcommands();
	stdoutSpy.mockRestore();
	stderrSpy.mockRestore();
});

describe('top-level help and routing', () => {
	it('--help prints the dispatcher usage banner and exits 0', async () => {
		const code = await runRegisterDispatcher(['--help']);
		expect(code).toBe(0);
		const out = stdoutChunks.join('');
		expect(out).toContain('bun run sources register <corpus>');
		expect(out).toContain('cfr');
		expect(out).toContain('handbooks');
		expect(out).toContain('aim');
	});

	it('-h is an alias for --help', async () => {
		const code = await runRegisterDispatcher(['-h']);
		expect(code).toBe(0);
		expect(stdoutChunks.join('')).toContain('bun run sources register <corpus>');
	});

	it('no arguments prints usage to stderr and exits non-zero', async () => {
		const code = await runRegisterDispatcher([]);
		expect(code).not.toBe(0);
		expect(stderrChunks.join('')).toContain('bun run sources register <corpus>');
		expect(stdoutChunks.join('')).toBe('');
	});

	it('unknown subcommand prints helpful message and exits non-zero', async () => {
		const code = await runRegisterDispatcher(['nonsense']);
		expect(code).not.toBe(0);
		const err = stderrChunks.join('');
		expect(err).toContain('unknown corpus: nonsense');
		expect(err).toContain('bun run sources register <corpus>');
	});
});

describe('per-subcommand help', () => {
	it('cfr --help prints the cfr-specific usage', async () => {
		const code = await runRegisterDispatcher(['cfr', '--help']);
		expect(code).toBe(0);
		const out = stdoutChunks.join('');
		expect(out).toContain('bun run sources register cfr');
		expect(out).toContain('--title=');
	});

	it('handbooks --help prints the handbooks-specific usage', async () => {
		const code = await runRegisterDispatcher(['handbooks', '--help']);
		expect(code).toBe(0);
		const out = stdoutChunks.join('');
		expect(out).toContain('bun run sources register handbooks');
		expect(out).toContain('--doc=');
	});

	it('aim --help prints the aim-specific usage', async () => {
		const code = await runRegisterDispatcher(['aim', '--help']);
		expect(code).toBe(0);
		const out = stdoutChunks.join('');
		expect(out).toContain('bun run sources register aim');
		expect(out).toContain('--edition=');
	});

	it('per-subcommand --help short-circuits before invoking the runner', async () => {
		stubRegisterCorpus('cfr', 0);
		const code = await runRegisterDispatcher(['cfr', '--help']);
		expect(code).toBe(0);
		expect(calls).toHaveLength(0);
	});
});

describe('argument forwarding', () => {
	it('cfr forwards remaining args to the cfr runner', async () => {
		stubRegisterCorpus('cfr', 0);
		const code = await runRegisterDispatcher(['cfr', '--title=14', '--fixture=x.xml']);
		expect(code).toBe(0);
		expect(calls).toEqual([{ name: 'cfr', argv: ['--title=14', '--fixture=x.xml'] }]);
	});

	it('handbooks forwards remaining args to the handbooks runner', async () => {
		stubRegisterCorpus('handbooks', 0);
		const code = await runRegisterDispatcher(['handbooks', '--doc=phak', '--edition=8083-25C']);
		expect(code).toBe(0);
		expect(calls).toEqual([{ name: 'handbooks', argv: ['--doc=phak', '--edition=8083-25C'] }]);
	});

	it('aim forwards remaining args to the aim runner', async () => {
		stubRegisterCorpus('aim', 0);
		const code = await runRegisterDispatcher(['aim', '--edition=2026-09']);
		expect(code).toBe(0);
		expect(calls).toEqual([{ name: 'aim', argv: ['--edition=2026-09'] }]);
	});

	it('propagates the per-subcommand exit code', async () => {
		stubRegisterCorpus('cfr', 7);
		const code = await runRegisterDispatcher(['cfr', '--fixture=x.xml']);
		expect(code).toBe(7);
	});
});

describe('--all', () => {
	it('invokes every registered subcommand with the forwarded args', async () => {
		stubRegisterCorpus('cfr', 0);
		stubRegisterCorpus('handbooks', 0);
		stubRegisterCorpus('aim', 0);
		const code = await runRegisterDispatcher(['--all']);
		expect(code).toBe(0);
		expect(calls.map((c) => c.name)).toEqual(['cfr', 'handbooks', 'aim']);
		for (const c of calls) expect(c.argv).toEqual([]);
	});

	it('returns the first non-zero exit code, but still runs every subcommand', async () => {
		stubRegisterCorpus('cfr', 0);
		stubRegisterCorpus('handbooks', 5);
		stubRegisterCorpus('aim', 9);
		const code = await runRegisterDispatcher(['--all']);
		expect(code).toBe(5);
		expect(calls.map((c) => c.name)).toEqual(['cfr', 'handbooks', 'aim']);
	});

	it('forwards trailing args to every subcommand', async () => {
		stubRegisterCorpus('cfr', 0);
		stubRegisterCorpus('handbooks', 0);
		stubRegisterCorpus('aim', 0);
		const code = await runRegisterDispatcher(['--all', '--out=/tmp/x']);
		expect(code).toBe(0);
		for (const c of calls) expect(c.argv).toEqual(['--out=/tmp/x']);
	});
});
