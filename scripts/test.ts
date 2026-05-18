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
import { ensureFlightbagBuild } from './lib/flightbag-build';
import { run, runTee } from './lib/spawn';

// --- Integration sweep: env-var contract -------------------------------------
//
// The flightbag coverage sweep is steered entirely through environment
// variables read by `tests/integration/flightbag-coverage.spec.ts` and
// `tests/integration/reporter.ts`. This dispatcher's only job is to translate
// friendly `bun run test integration ...` flags into these env vars (plus the
// build-cache step + the Playwright invocation). The names below are the
// shared contract -- the spec/reporter own the consuming side.
const SWEEP_ENV = {
	MODE: 'SWEEP_MODE',
	TIERS: 'SWEEP_TIERS',
	SAMPLE_PER_BOOK: 'SWEEP_SAMPLE_PER_BOOK',
	RESUME: 'SWEEP_RESUME',
	LIST: 'SWEEP_LIST',
	FORCE_REBUILD: 'SWEEP_FORCE_REBUILD',
	SKIP_BUILD: 'SWEEP_SKIP_BUILD',
} as const;
const TEST_INTEGRATION_WORKERS = 'TEST_INTEGRATION_WORKERS';
const PLAYWRIGHT_SKIP_DB_SETUP = 'PLAYWRIGHT_SKIP_DB_SETUP';
const SWEEP_MODE_FULL = 'full';
const INTEGRATION_PROJECT = 'flightbag-coverage';

// Where the spec + reporter write their artefacts. Printed after a run so the
// user (or an agent) can inspect results without re-running the sweep.
const INTEGRATION_OUT_DIR = 'tests/integration/.out';
const INTEGRATION_ARTEFACTS = [
	'manifest.json',
	'progress.ndjson',
	'last-run.json',
	'coverage-report.md',
	'coverage-failures.txt',
	'coverage-summary.json',
] as const;

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
  integration       Run the flightbag coverage sweep (see 'integration --help')
  all               Run every suite in sequence: unit, then e2e, then integration
  help              Show this help

Any trailing arguments are passed through to the underlying runner.

Examples:
  bun run test                         Full unit run
  bun run test watch                   Watch mode
  bun run test libs/bc/study           Vitest filter
  bun run test coverage                Unit coverage
  bun run test e2e                     Run all e2e tests
  bun run test e2e auth                Run e2e specs matching "auth"
  bun run test e2e:ui                  Open Playwright UI mode
  bun run test e2e:install             Install Playwright browsers
  bun run test integration             Run the flightbag coverage sweep
  bun run test integration --help      Sweep-specific flags + examples
  bun run test all                     Run unit + e2e + integration in sequence`);
}

const INTEGRATION_HELP = `Usage: bun run test integration [list] [flags...] [-- <playwright args>]

Flightbag coverage sweep -- an HTTP-only Playwright project that walks every
reader URL derived from the reference registry and asserts each one renders.
The sweep serves the flightbag adapter-node PRODUCTION build (cached, rebuilt
only when inputs change) instead of the dev server, which OOM-crashes under
the sweep's worker fan-out.

Modes:
  (default)            Sample sweep: a fixed number of URLs per book
  list                 List the URLs the sweep would run, execute zero tests
                       (the build-cache step still runs -- fast when cached)

Flags:
  --full               Full sweep -- every URL, not a per-book sample
  --tier <name>        Restrict to a coverage tier (repeatable; e.g. sanity,
                       structural). Multiple --tier flags are comma-joined.
  --book <name>        Restrict to a book/document (repeatable; OR-joined into
                       a Playwright --grep against kind/documentSlug)
  --sample <n>         URLs sampled per book in sample mode (default 12)
  --resume             Re-run only the URLs that failed or never ran last time
  --rebuild            Force a fresh flightbag build, ignoring the input hash
  --reuse-db           Skip the integration DB drop+seed (PLAYWRIGHT_SKIP_DB_SETUP)
  --workers <n>        Override the sweep worker count (clamped 1..512)
  --help, help         Show this help (not Playwright's passthrough help)
  --                   Pass every following argument straight to Playwright

Build cache:
  The sweep builds apps/flightbag once and reuses it while inputs are
  unchanged (content hash of app src + config + libs). --rebuild forces a
  rebuild; SWEEP_SKIP_BUILD=1 in the environment skips the build entirely.

Examples:
  bun run test integration                       Sample sweep, all books
  bun run test integration list                  List sweep URLs, run nothing
  bun run test integration --full                Full sweep, every URL
  bun run test integration --tier sanity         Only the sanity tier
  bun run test integration --book far --book aim Sweep just the FAR + AIM books
  bun run test integration --resume              Retry last run's failures
  bun run test integration --sample 30           30 URLs per book
  bun run test integration --rebuild --workers 64
  bun run test integration -- --reporter=line    Raw passthrough to Playwright`;

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

/** Parsed shape of `bun run test integration ...` arguments. */
interface IntegrationArgs {
	/** `list` subcommand -> SWEEP_LIST=1, Playwright runs zero tests. */
	readonly list: boolean;
	/** `--full` -> SWEEP_MODE=full. */
	readonly full: boolean;
	/** `--tier` values, comma-joined into SWEEP_TIERS. */
	readonly tiers: readonly string[];
	/** `--book` values, OR-joined into a Playwright --grep. */
	readonly books: readonly string[];
	/** `--sample <n>` -> SWEEP_SAMPLE_PER_BOOK. */
	readonly sample?: string;
	/** `--resume` -> SWEEP_RESUME=1. */
	readonly resume: boolean;
	/** `--rebuild` -> SWEEP_FORCE_REBUILD=1 + forced build. */
	readonly rebuild: boolean;
	/** `--reuse-db` -> PLAYWRIGHT_SKIP_DB_SETUP=1. */
	readonly reuseDb: boolean;
	/** `--workers <n>` -> TEST_INTEGRATION_WORKERS. */
	readonly workers?: string;
	/** Whether `--help`/`help` was requested. */
	readonly help: boolean;
	/** Everything after a bare `--`, passed raw to Playwright. */
	readonly passthrough: readonly string[];
}

/**
 * Parse the arguments that follow `integration`. Throws on a flag that
 * expects a value but is missing one, so the dispatcher can surface a clear
 * error instead of silently dropping the flag.
 */
function parseIntegrationArgs(input: readonly string[]): IntegrationArgs {
	let list = false;
	let full = false;
	const tiers: string[] = [];
	const books: string[] = [];
	let sample: string | undefined;
	let resume = false;
	let rebuild = false;
	let reuseDb = false;
	let workers: string | undefined;
	let help = false;
	const passthrough: string[] = [];

	for (let i = 0; i < input.length; i += 1) {
		const arg = input[i];
		if (arg === undefined) continue;
		if (arg === '--') {
			passthrough.push(...input.slice(i + 1));
			break;
		}
		const expectValue = (flag: string): string => {
			const value = input[i + 1];
			if (value === undefined) throw new Error(`test integration: ${flag} requires a value`);
			i += 1;
			return value;
		};
		switch (arg) {
			case 'list':
				list = true;
				break;
			case 'help':
			case '--help':
			case '-h':
				help = true;
				break;
			case '--full':
				full = true;
				break;
			case '--tier':
				tiers.push(expectValue('--tier'));
				break;
			case '--book':
				books.push(expectValue('--book'));
				break;
			case '--sample':
				sample = expectValue('--sample');
				break;
			case '--resume':
				resume = true;
				break;
			case '--rebuild':
				rebuild = true;
				break;
			case '--reuse-db':
				reuseDb = true;
				break;
			case '--workers':
				workers = expectValue('--workers');
				break;
			default:
				throw new Error(`test integration: unknown argument "${arg}" (run 'bun run test integration --help')`);
		}
	}

	return { list, full, tiers, books, sample, resume, rebuild, reuseDb, workers, help, passthrough };
}

/**
 * Run the flightbag coverage sweep: build-cache step, then Playwright scoped
 * to the `flightbag-coverage` project with the parsed flags translated into
 * the shared SWEEP_* env-var contract.
 */
async function runIntegration(input: readonly string[]): Promise<void> {
	let parsed: IntegrationArgs;
	try {
		parsed = parseIntegrationArgs(input);
	} catch (err) {
		console.error(err instanceof Error ? err.message : String(err));
		process.exit(2);
	}

	if (parsed.help) {
		console.log(INTEGRATION_HELP);
		process.exit(0);
	}

	// Build-cache step. Skipped only when the environment carries
	// SWEEP_SKIP_BUILD=1; `--rebuild` forces a fresh build.
	const skipBuild = process.env[SWEEP_ENV.SKIP_BUILD] === '1';
	await ensureFlightbagBuild({
		forceRebuild: parsed.rebuild,
		skipBuild,
		run,
	});

	// Translate flags into the SWEEP_* env-var contract. Start from the
	// current process env so an explicitly-exported SWEEP_* var still wins
	// where the dispatcher does not override it.
	const env: Record<string, string | undefined> = { ...process.env };
	if (parsed.full) env[SWEEP_ENV.MODE] = SWEEP_MODE_FULL;
	if (parsed.tiers.length > 0) env[SWEEP_ENV.TIERS] = parsed.tiers.join(',');
	if (parsed.sample !== undefined) env[SWEEP_ENV.SAMPLE_PER_BOOK] = parsed.sample;
	if (parsed.resume) env[SWEEP_ENV.RESUME] = '1';
	if (parsed.rebuild) env[SWEEP_ENV.FORCE_REBUILD] = '1';
	if (parsed.list) env[SWEEP_ENV.LIST] = '1';
	if (parsed.reuseDb) env[PLAYWRIGHT_SKIP_DB_SETUP] = '1';
	if (parsed.workers !== undefined) env[TEST_INTEGRATION_WORKERS] = parsed.workers;

	const cmd: string[] = ['bunx', 'playwright', 'test', `--project=${INTEGRATION_PROJECT}`];

	// `list` mode -> a --grep that matches nothing, so Playwright registers
	// the project (booting the webServer + spec) without executing a test.
	// The spec, seeing SWEEP_LIST=1, prints the URL inventory itself.
	// `--pass-with-no-tests` keeps the exit code 0: a zero-test run is the
	// intended success path here, not a "no tests found" failure.
	if (parsed.list) {
		cmd.push('--grep', '$^', '--pass-with-no-tests');
	} else if (parsed.books.length > 0) {
		// `--book` filters via a Playwright --grep against the test titles
		// (which the spec names `kind/documentSlug`). Multiple books are
		// OR-joined into a single alternation.
		const escaped = parsed.books.map((b) => b.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'));
		cmd.push('--grep', escaped.join('|'));
	}

	cmd.push(...parsed.passthrough);

	const logPath = newLogPath('integration');
	const code = await runTee(cmd, logPath, { env });
	console.log(`\nlog: ${logPath}`);
	printIntegrationArtefacts();
	if (code !== 0) process.exit(code);
}

/** Print artefact paths + a retest-by-book hint after a sweep run. */
function printIntegrationArtefacts(): void {
	console.log('\nartefacts:');
	for (const name of INTEGRATION_ARTEFACTS) {
		console.log(`  ${resolve(INTEGRATION_OUT_DIR, name)}`);
	}
	console.log('\nretry a single book:  bun run test integration --book <name>');
	console.log('retry only failures:  bun run test integration --resume');
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
	await runIntegration([]);
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
	// Flightbag coverage sweep -- HTTP-only Playwright project against a
	// dedicated DB and the cached adapter-node production build (see
	// `playwright.config.ts` -> `flightbag-coverage` project + integration
	// webServer entry, and `scripts/lib/flightbag-build.ts` for the build
	// cache). `runIntegration` parses the sweep flags, runs the build-cache
	// step, then invokes Playwright scoped to the integration project.
	await runIntegration(rest);
} else {
	await ensureSvelteKitSync();
	await runWithLog('unit', ['bunx', 'vitest', 'run', ...args]);
}
