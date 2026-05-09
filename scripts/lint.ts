#!/usr/bin/env bun

/**
 * Lint dispatcher.
 *
 *   bun run lint              # help
 *   bun run lint theme        # theme-token lint (raw hex / px / etc.)
 */

import { spawnSync } from 'node:child_process';

function runBun(args: readonly string[]): number {
	const result = spawnSync('bun', args, { stdio: 'inherit' });
	return result.status ?? 1;
}

function help(): number {
	console.log(`Usage: bun run lint <subcommand>

Subcommands:
  theme       Run the theme-token linter (raw hex / px / etc.)
  help        This index
`);
	return 0;
}

const [head, ...rest] = process.argv.slice(2);
let exitCode = 0;
switch (head) {
	case undefined:
	case 'help':
	case '--help':
	case '-h':
		exitCode = help();
		break;
	case 'theme':
		exitCode = runBun(['tools/theme-lint/bin.ts', ...rest]);
		break;
	default:
		console.error(`lint: unknown subcommand "${head}"`);
		help();
		exitCode = 1;
}
process.exit(exitCode);
