#!/usr/bin/env bun

/**
 * Test dispatcher for airboss.
 *
 * Usage: bun run test [subcommand] [filters...]
 *
 * Run `bun run test help` for the full list of subcommands.
 */

import { existsSync, mkdirSync } from 'node:fs';
import { resolve } from 'node:path';
import { run, runTee } from './lib/spawn';

const args = process.argv.slice(2);
const first = args[0];
const helpFlags = new Set(['help', '-h', '--help']);

// Ensure every SvelteKit app has its generated `.svelte-kit/tsconfig.json`
// before vitest traverses app tests (each app's `tsconfig.json` extends it).
// Fresh worktrees never have these until `bunx svelte-kit sync` runs once.
async function ensureSvelteKitSync(): Promise<void> {
	const apps = ['apps/study', 'apps/sim', 'apps/hangar', 'apps/flightbag'];
	for (const app of apps) {
		if (existsSync(`${app}/.svelte-kit/tsconfig.json`)) continue;
		console.log(`> svelte-kit sync (${app})`);
		const proc = Bun.spawn(['bunx', 'svelte-kit', 'sync'], { cwd: app, stdio: ['inherit', 'inherit', 'inherit'] });
		const code = await proc.exited;
		if (code !== 0) process.exit(code);
	}
}

function showHelp(): void {
	console.log(`Usage: bun run test [subcommand] [filters...]

Subcommands:
  (none)            Run the full unit test suite once (bunx vitest run)
  watch             Run unit tests in watch mode (bunx vitest)
  coverage          Run unit tests with coverage (bunx vitest run --coverage)
  e2e               Run Playwright e2e suite (bunx playwright test)
  e2e:ui            Run Playwright in interactive UI mode
  e2e:install       Install Playwright browsers (one-time)
  integration       Run flightbag coverage sweep (Playwright HTTP-only, parallel)
  all               Run every suite in sequence: unit, then e2e, then integration
  help              Show this help

Any trailing arguments are passed through to the underlying runner.

Integration sweep:
  Walks every public flightbag reader URL across all seeded books. At the end
  it prints a grouped summary -- per-tier counts + timings, failures grouped
  by book (kind/documentSlug), and a per-book retest command. Full artefacts
  land in tests/integration/.out/ (coverage-report.md, coverage-failures.txt).
  Worker count is high (default 100) since the run is HTTP-only; override with
  TEST_INTEGRATION_WORKERS. To retest one book without the whole sweep:
    bun run test integration --grep "handbook/phak"

Examples:
  bun run test                         Full unit run
  bun run test watch                   Watch mode
  bun run test libs/bc/study           Vitest filter
  bun run test coverage                Unit coverage
  bun run test e2e                     Run all e2e tests
  bun run test e2e auth                Run e2e specs matching "auth"
  bun run test e2e:ui                  Open Playwright UI mode
  bun run test e2e:install             Install Playwright browsers
  bun run test integration             Run flightbag coverage sweep
  bun run test integration --grep "handbook/phak"   Retest one book
  bun run test all                     Run unit + e2e + integration in sequence`);
}

if (first && helpFlags.has(first)) {
	showHelp();
	process.exit(0);
}

const rest = args.slice(1);

/**
 * Per-run log path under `.cache/test/`. Filename encodes the subcommand and a
 * UTC timestamp so multiple runs don't collide. Print the absolute path at the
 * end so the user (or an agent) can grep the failure list without re-running.
 */
function newLogPath(label: string): string {
	const dir = resolve('.cache/test');
	mkdirSync(dir, { recursive: true });
	const ts = new Date().toISOString().replace(/[:.]/g, '-');
	return resolve(dir, `${label}-${ts}.log`);
}

async function runWithLog(label: string, cmd: readonly string[]): Promise<void> {
	const logPath = newLogPath(label);
	const code = await runTee(cmd, logPath);
	console.log(`\nlog: ${logPath}`);
	if (code !== 0) process.exit(code);
}

/**
 * Spawn a command inheriting stdio and return its exit code WITHOUT exiting
 * the parent. The integration sweep needs this so the dispatcher can print
 * the reporter's artefact paths after the run regardless of pass/fail.
 */
async function runPlaywright(cmd: readonly string[]): Promise<number> {
	console.log(`> ${cmd.join(' ')}`);
	const proc = Bun.spawn([...cmd], { stdio: ['inherit', 'inherit', 'inherit'] });
	return await proc.exited;
}

/**
 * Print the integration sweep's artefact paths. The custom reporter
 * (`tests/integration/reporter.ts`) writes these; surfacing the paths here
 * means the user never has to remember where they land.
 */
function printIntegrationArtefacts(): void {
	const outDir = resolve('tests/integration/.out');
	const report = resolve(outDir, 'coverage-report.md');
	const failures = resolve(outDir, 'coverage-failures.txt');
	console.log('');
	if (existsSync(report)) console.log(`coverage report:   ${report}`);
	if (existsSync(failures)) console.log(`failure log:       ${failures}`);
	console.log('retest one book:   bun run test integration --book "<kind>/<slug>"');
}

const INTEGRATION_HELP = `Usage: bun run test integration [subcommand] [options]

The flightbag coverage sweep -- walks every public reader URL across all
seeded books (HTTP-only, highly parallel). See the run plan, run it, or
retest a single book.

Subcommands:
  (none)              Run the full sweep
  list                Print the run plan and exit -- every book + URL counts,
                      broken down by tier. Nothing is asserted.
  help                Show this help

Options:
  --book <name>       Run only books matching <name> (a regex against the
                      "kind/documentSlug" key, e.g. "handbook/phak", "cfr",
                      "handbook/phak|cfr"). Repeatable; values are OR-ed.
  --grep <regex>      Raw Playwright title filter (advanced; --book is the
                      friendly form).
  --workers <n>       Worker count (default 100; or set TEST_INTEGRATION_WORKERS).
  --reuse-db          Skip the DB re-seed, reuse airboss_integration as-is.
  -- <playwright...>  Everything after a bare -- passes straight to Playwright.

Examples:
  bun run test integration                       Full sweep
  bun run test integration list                  Show what will be checked
  bun run test integration --book handbook/phak  Retest one book
  bun run test integration --book cfr --book aim Retest two corpora
  bun run test integration --reuse-db --book phak  Fast iterate, no re-seed
  bun run test integration -- --max-failures=1   Pass a raw Playwright flag`;

/**
 * Parse the args after `integration` into a structured shape. `--book` values
 * become a single `--grep` regex (OR-joined); `--reuse-db` flips the env var
 * the Playwright globalSetup honours; `--` ends our parsing and forwards the
 * rest verbatim.
 */
interface IntegrationOpts {
	readonly mode: 'run' | 'list' | 'help';
	readonly books: readonly string[];
	readonly grep: string | null;
	readonly workers: string | null;
	readonly reuseDb: boolean;
	readonly passthrough: readonly string[];
	readonly error: string | null;
}

function parseIntegrationArgs(argv: readonly string[]): IntegrationOpts {
	let mode: IntegrationOpts['mode'] = 'run';
	const books: string[] = [];
	let grep: string | null = null;
	let workers: string | null = null;
	let reuseDb = false;
	const passthrough: string[] = [];

	const tokens = [...argv];
	while (tokens.length > 0) {
		const tok = tokens.shift() as string;
		if (tok === '--') {
			passthrough.push(...tokens);
			break;
		}
		if (tok === 'list' || tok === 'plan') {
			mode = 'list';
		} else if (tok === 'help' || tok === '-h' || tok === '--help') {
			mode = 'help';
		} else if (tok === '--book' || tok === '-b') {
			const v = tokens.shift();
			if (v === undefined) return { ...empty(), error: '--book needs a value' };
			books.push(v);
		} else if (tok.startsWith('--book=')) {
			books.push(tok.slice('--book='.length));
		} else if (tok === '--grep' || tok === '-g') {
			const v = tokens.shift();
			if (v === undefined) return { ...empty(), error: '--grep needs a value' };
			grep = v;
		} else if (tok.startsWith('--grep=')) {
			grep = tok.slice('--grep='.length);
		} else if (tok === '--workers' || tok === '-j') {
			const v = tokens.shift();
			if (v === undefined) return { ...empty(), error: '--workers needs a value' };
			workers = v;
		} else if (tok.startsWith('--workers=')) {
			workers = tok.slice('--workers='.length);
		} else if (tok === '--reuse-db') {
			reuseDb = true;
		} else {
			// Unknown token -- forward to Playwright rather than erroring, so
			// power users keep raw access without needing the bare `--`.
			passthrough.push(tok);
		}
	}
	return { mode, books, grep, workers, reuseDb, passthrough, error: null };

	function empty(): IntegrationOpts {
		return { mode: 'run', books: [], grep: null, workers: null, reuseDb: false, passthrough: [], error: null };
	}
}

/** Run the integration sweep (or print its plan) per the parsed options. */
async function runIntegration(argv: readonly string[]): Promise<void> {
	const opts = parseIntegrationArgs(argv);
	if (opts.error) {
		console.error(`test integration: ${opts.error}`);
		process.exit(2);
	}
	if (opts.mode === 'help') {
		console.log(INTEGRATION_HELP);
		process.exit(0);
	}

	// `--book a --book b` and a raw `--grep` combine into one OR-ed regex.
	const grepParts = [...opts.books, ...(opts.grep ? [opts.grep] : [])];
	const grep = grepParts.length > 0 ? grepParts.join('|') : null;

	const cmd = ['bunx', 'playwright', 'test', '--project=flightbag-coverage'];
	if (opts.mode === 'list') cmd.push('--list');
	if (grep) cmd.push('--grep', grep);
	if (opts.workers) cmd.push('--workers', opts.workers);
	cmd.push(...opts.passthrough);

	// `--reuse-db` is honoured by `tests/e2e/global-db-setup.ts` via this env
	// var -- skips the drop+reseed of airboss_integration for fast iteration.
	const env = opts.reuseDb ? { ...process.env, PLAYWRIGHT_SKIP_DB_SETUP: '1' } : { ...process.env };

	console.log(`> ${cmd.join(' ')}`);
	const proc = Bun.spawn([...cmd], { stdio: ['inherit', 'inherit', 'inherit'], env });
	const code = await proc.exited;

	if (opts.mode !== 'list') printIntegrationArtefacts();
	if (code !== 0) process.exit(code);
}

if (first === 'all') {
	// Run every suite in sequence. Each leg fails fast: `runWithLog` calls
	// `process.exit` on a non-zero exit, so a unit failure never wastes the
	// (slow) e2e + integration legs. Trailing args are ignored -- `all`
	// always runs the complete matrix.
	if (rest.length > 0) {
		console.error(`test all: trailing arguments are not supported (got: ${rest.join(' ')})`);
		process.exit(2);
	}
	await ensureSvelteKitSync();
	await runWithLog('unit', ['bunx', 'vitest', 'run']);
	await runWithLog('e2e', ['bunx', 'playwright', 'test']);
	await runWithLog('integration', ['bunx', 'playwright', 'test', '--project=flightbag-coverage']);
} else if (first === 'watch') {
	await ensureSvelteKitSync();
	await run(['bunx', 'vitest', ...rest]);
} else if (first === 'coverage') {
	await ensureSvelteKitSync();
	await runWithLog('coverage', ['bunx', 'vitest', 'run', '--coverage', ...rest]);
} else if (first === 'e2e') {
	await runWithLog('e2e', ['bunx', 'playwright', 'test', ...rest]);
} else if (first === 'e2e:ui') {
	await run(['bunx', 'playwright', 'test', '--ui', ...rest]);
} else if (first === 'e2e:install') {
	await run(['bunx', 'playwright', 'install', ...(rest.length ? rest : ['chromium'])]);
} else if (first === 'integration') {
	// Flightbag coverage sweep. `runIntegration` parses the friendly flags
	// (`list`, `--book`, `--reuse-db`, `--help`) and forwards to Playwright;
	// `tests/integration/reporter.ts` prints the plan + per-book progress +
	// grouped summary and writes the artefacts.
	await runIntegration(rest);
} else {
	await ensureSvelteKitSync();
	await runWithLog('unit', ['bunx', 'vitest', 'run', ...args]);
}
