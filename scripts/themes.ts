#!/usr/bin/env bun

/**
 * Themes dispatcher.
 *
 *   bun run themes              # help
 *   bun run themes emit         # regenerate generated theme tokens
 */

import { spawnSync } from 'node:child_process';

function runBun(args: readonly string[]): number {
	const result = spawnSync('bun', args, { stdio: 'inherit' });
	return result.status ?? 1;
}

function help(): number {
	console.log(`Usage: bun run themes <subcommand>

Subcommands:
  emit        Regenerate libs/themes/generated/* from libs/themes/src/
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
	case 'emit':
		exitCode = runBun(['scripts/themes/emit.ts', ...rest]);
		break;
	default:
		console.error(`themes: unknown subcommand "${head}"`);
		help();
		exitCode = 1;
}
process.exit(exitCode);
