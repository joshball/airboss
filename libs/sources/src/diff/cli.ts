/**
 * Phase 5 -- diff + advance CLI runners.
 *
 * Source of truth: ADR 019 §5.
 *
 * `runDiffCli(argv)` -- diff job. Walks the registry, hashes bodies,
 *   partitions, writes JSON report, prints summary.
 *
 * `runAdvanceCli(argv)` -- consumes a JSON report, rewrites lesson pins.
 */

import { existsSync, mkdtempSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { runIngest } from '../regs/ingest.ts';
import { setRegsDerivativeRoot } from '../regs/resolver.ts';
import { type DiffJobArgs, formatDiffSummary, runDiffJob } from './diff-job.ts';
import { RewriterError, runRewrite } from './lesson-rewriter.ts';
import type { DiffReport } from './types.ts';

const DIFF_USAGE = `usage:
  bun run airboss-ref diff [--corpus=<corpus>] [--edition-pair=<old>,<new>] [--out=<path>] [--regulations-root=<path>]
  bun run airboss-ref diff --fixture-pair=<oldXml>,<newXml> [--corpus=<corpus>] [--out=<path>]
`;

const ADVANCE_USAGE = `usage:
  bun run airboss-ref advance --report=<path> [--cwd=<path>]
`;

interface DiffCliArgs {
	readonly corpus: string;
	readonly editionPair: { readonly old: string; readonly new: string } | null;
	readonly outPath: string | null;
	readonly fixturePair: { readonly oldXml: string; readonly newXml: string } | null;
	readonly regulationsRoot: string | null;
	readonly help: boolean;
}

interface AdvanceCliArgs {
	readonly reportPath: string | null;
	readonly cwd: string | null;
	readonly help: boolean;
}

export function parseDiffArgs(argv: readonly string[]): DiffCliArgs | { error: string } {
	let corpus = 'regs';
	let editionPair: { readonly old: string; readonly new: string } | null = null;
	let outPath: string | null = null;
	let fixturePair: { readonly oldXml: string; readonly newXml: string } | null = null;
	let regulationsRoot: string | null = null;
	let help = false;

	for (const arg of argv) {
		if (arg === '--help' || arg === '-h') help = true;
		else if (arg.startsWith('--corpus=')) corpus = arg.slice('--corpus='.length);
		else if (arg.startsWith('--edition-pair=')) {
			const value = arg.slice('--edition-pair='.length);
			const parts = value.split(',');
			if (parts.length !== 2) return { error: `--edition-pair expects "<old>,<new>"; got "${value}"` };
			const [oldEd, newEd] = parts;
			if (oldEd === undefined || newEd === undefined || oldEd.length === 0 || newEd.length === 0) {
				return { error: `--edition-pair edition slugs must be non-empty` };
			}
			editionPair = { old: oldEd, new: newEd };
		} else if (arg.startsWith('--out=')) {
			outPath = arg.slice('--out='.length);
		} else if (arg.startsWith('--fixture-pair=')) {
			const value = arg.slice('--fixture-pair='.length);
			const parts = value.split(',');
			if (parts.length !== 2) return { error: `--fixture-pair expects "<oldXml>,<newXml>"; got "${value}"` };
			const [oldXml, newXml] = parts;
			if (oldXml === undefined || newXml === undefined || oldXml.length === 0 || newXml.length === 0) {
				return { error: `--fixture-pair paths must be non-empty` };
			}
			fixturePair = { oldXml, newXml };
		} else if (arg.startsWith('--regulations-root=')) {
			regulationsRoot = arg.slice('--regulations-root='.length);
		} else {
			return { error: `unknown argument: ${arg}` };
		}
	}

	return { corpus, editionPair, outPath, fixturePair, regulationsRoot, help };
}

export function parseAdvanceArgs(argv: readonly string[]): AdvanceCliArgs | { error: string } {
	let reportPath: string | null = null;
	let cwd: string | null = null;
	let help = false;

	for (const arg of argv) {
		if (arg === '--help' || arg === '-h') help = true;
		else if (arg.startsWith('--report=')) reportPath = arg.slice('--report='.length);
		else if (arg.startsWith('--cwd=')) cwd = arg.slice('--cwd='.length);
		else return { error: `unknown argument: ${arg}` };
	}

	return { reportPath, cwd, help };
}

/** CLI runner for `airboss-ref diff`. Returns numeric exit code. */
export async function runDiffCli(argv: readonly string[]): Promise<number> {
	const parsed = parseDiffArgs(argv);
	if ('error' in parsed) {
		process.stderr.write(`${parsed.error}\n${DIFF_USAGE}`);
		return 2;
	}
	if (parsed.help) {
		process.stdout.write(DIFF_USAGE);
		return 0;
	}

	const outRoot = parsed.regulationsRoot ?? join(process.cwd(), 'regulations');

	// Fixture-pair short-circuit: ingest both fixtures into a fresh in-memory
	// registry with a temp derivative root, then run the diff against that.
	if (parsed.fixturePair !== null) {
		const tempOutRoot = mkdtempSync(join(tmpdir(), 'airboss-ref-diff-'));
		setRegsDerivativeRoot(tempOutRoot);
		const oldDate = inferEditionDateFromFixture(parsed.fixturePair.oldXml);
		const newDate = inferEditionDateFromFixture(parsed.fixturePair.newXml);
		await runIngest({
			title: '14',
			editionDate: oldDate,
			outRoot: tempOutRoot,
			fixturePath: parsed.fixturePair.oldXml,
		});
		await runIngest({
			title: '14',
			editionDate: newDate,
			outRoot: tempOutRoot,
			fixturePath: parsed.fixturePair.newXml,
		});
		const jobArgs: DiffJobArgs = {
			corpus: parsed.corpus,
			outRoot: tempOutRoot,
			editionPair: parsed.editionPair ?? undefined,
			outPath: parsed.outPath ?? undefined,
		};
		const result = runDiffJob(jobArgs);
		process.stdout.write(formatDiffSummary(result.report, result.reportPath));
		return 0;
	}

	const result = runDiffJob({
		corpus: parsed.corpus,
		outRoot,
		editionPair: parsed.editionPair ?? undefined,
		outPath: parsed.outPath ?? undefined,
	});
	process.stdout.write(formatDiffSummary(result.report, result.reportPath));
	return 0;
}

/** CLI runner for `airboss-ref advance`. Returns numeric exit code. */
export function runAdvanceCli(argv: readonly string[]): number {
	const parsed = parseAdvanceArgs(argv);
	if ('error' in parsed) {
		process.stderr.write(`${parsed.error}\n${ADVANCE_USAGE}`);
		return 2;
	}
	if (parsed.help) {
		process.stdout.write(ADVANCE_USAGE);
		return 0;
	}
	if (parsed.reportPath === null) {
		process.stderr.write(`advance: --report=<path> is required\n${ADVANCE_USAGE}`);
		return 2;
	}
	if (!existsSync(parsed.reportPath)) {
		process.stderr.write(`advance: report file not found: ${parsed.reportPath}\n`);
		return 2;
	}

	let report: DiffReport;
	try {
		const raw = readFileSync(parsed.reportPath, 'utf-8');
		report = JSON.parse(raw) as DiffReport;
	} catch (err) {
		process.stderr.write(`advance: failed to parse report: ${(err as Error).message}\n`);
		return 2;
	}

	try {
		const result = runRewrite(report, { cwd: parsed.cwd ?? undefined });
		process.stdout.write(
			`advance: corpus=${result.corpus} ${result.editionPair.old} -> ${result.editionPair.new}\n` +
				`  filesScanned=${result.filesScanned} filesRewritten=${result.filesRewritten} occurrencesAdvanced=${result.occurrencesAdvanced}\n` +
				(result.skipped.length > 0 ? `  skipped=${result.skipped.length}\n` : ''),
		);
		return 0;
	} catch (err) {
		if (err instanceof RewriterError) {
			process.stderr.write(`advance: ${err.message}\n`);
			return 2;
		}
		throw err;
	}
}

function inferEditionDateFromFixture(path: string): string {
	const match = path.match(/-(\d{4})-/u);
	if (match !== null && match[1] !== undefined) return `${match[1]}-01-01`;
	return '2026-01-01';
}
