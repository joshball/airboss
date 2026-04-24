#!/usr/bin/env bun

/**
 * Test dispatcher for airboss.
 *
 * Usage: bun run test [subcommand] [filters...]
 *
 * Run `bun run test help` for the full list of subcommands.
 */

import { existsSync } from 'node:fs';

const args = process.argv.slice(2);
const first = args[0];
const helpFlags = new Set(['help', '-h', '--help']);

async function run(cmd: string[]): Promise<void> {
	console.log(`> ${cmd.join(' ')}`);
	const proc = Bun.spawn(cmd, { stdio: ['inherit', 'inherit', 'inherit'] });
	const code = await proc.exited;
	if (code !== 0) process.exit(code);
}

// Ensure every SvelteKit app has its generated `.svelte-kit/tsconfig.json`
// before vitest traverses app tests (each app's `tsconfig.json` extends it).
// Fresh worktrees never have these until `bunx svelte-kit sync` runs once.
async function ensureSvelteKitSync(): Promise<void> {
	const apps = ['apps/study', 'apps/sim', 'apps/hangar'];
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
  bun run test e2e:install             Install Playwright browsers`);
}

if (first && helpFlags.has(first)) {
	showHelp();
	process.exit(0);
}

const rest = args.slice(1);

if (first === 'watch') {
	await ensureSvelteKitSync();
	await run(['bunx', 'vitest', ...rest]);
} else if (first === 'coverage') {
	await ensureSvelteKitSync();
	await run(['bunx', 'vitest', 'run', '--coverage', ...rest]);
} else if (first === 'e2e') {
	await run(['bunx', 'playwright', 'test', ...rest]);
} else if (first === 'e2e:ui') {
	await run(['bunx', 'playwright', 'test', '--ui', ...rest]);
} else if (first === 'e2e:install') {
	await run(['bunx', 'playwright', 'install', ...(rest.length ? rest : ['chromium'])]);
} else {
	await ensureSvelteKitSync();
	await run(['bunx', 'vitest', 'run', ...args]);
}
