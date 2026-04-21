#!/usr/bin/env bun

/**
 * Test dispatcher for airboss.
 *
 * Usage: bun run test [subcommand] [filters...]
 *
 * Run `bun run test help` for the full list of subcommands.
 */

const args = process.argv.slice(2);
const first = args[0];
const helpFlags = new Set(['help', '-h', '--help']);

async function run(cmd: string[]): Promise<void> {
	console.log(`> ${cmd.join(' ')}`);
	const proc = Bun.spawn(cmd, { stdio: ['inherit', 'inherit', 'inherit'] });
	const code = await proc.exited;
	if (code !== 0) process.exit(code);
}

function showHelp(): void {
	console.log(`Usage: bun run test [subcommand] [filters...]

Subcommands:
  (none)            Run the full test suite once (bunx vitest run)
  watch             Run tests in watch mode (bunx vitest)
  coverage          Run the full test suite with coverage (bunx vitest run --coverage)
  help              Show this help

Any trailing arguments are passed through to vitest as filters.

Examples:
  bun run test                         Full run
  bun run test watch                   Watch mode
  bun run test libs/bc/study           Run matching files once
  bun run test watch libs/bc/study     Watch matching files
  bun run test coverage                Full run with coverage`);
}

if (first && helpFlags.has(first)) {
	showHelp();
	process.exit(0);
}

const rest = args.slice(1);

if (first === 'watch') {
	await run(['bunx', 'vitest', ...rest]);
} else if (first === 'coverage') {
	await run(['bunx', 'vitest', 'run', '--coverage', ...rest]);
} else {
	await run(['bunx', 'vitest', 'run', ...args]);
}
