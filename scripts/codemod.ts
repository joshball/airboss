#!/usr/bin/env bun

/**
 * Codemod dispatcher.
 *
 *   bun run codemod              # help
 *   bun run codemod theme        # theme-token codemod (rewrite raw values to tokens)
 */

import { spawnSync } from 'node:child_process';

function runBun(args: readonly string[]): number {
	const result = spawnSync('bun', args, { stdio: 'inherit' });
	return result.status ?? 1;
}

function help(): number {
	console.log(`Usage: bun run codemod <subcommand>

Subcommands:
  theme       Rewrite raw values (hex / px / etc.) to design-token vars
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
		exitCode = runBun(['tools/theme-codemod/bin.ts', ...rest]);
		break;
	default:
		console.error(`codemod: unknown subcommand "${head}"`);
		help();
		exitCode = 1;
}
process.exit(exitCode);
