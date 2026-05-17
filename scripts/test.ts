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
  integration       Run flightbag coverage sweep (Playwright HTTP-only, 32 workers)
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
  bun run test integration             Run flightbag coverage sweep
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
	// Flightbag coverage sweep -- HTTP-only, 32 workers, dedicated DB and
	// vite process (see `playwright.config.ts` -> `flightbag-coverage` project
	// and `flightbag-integration` webServer entry). The project filter scopes
	// the run to the integration spec; the e2e projects do not boot.
	await run(['bunx', 'playwright', 'test', '--project=flightbag-coverage', ...rest]);
} else {
	await ensureSvelteKitSync();
	await runWithLog('unit', ['bunx', 'vitest', 'run', ...args]);
}
