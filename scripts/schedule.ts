#!/usr/bin/env bun

/**
 * Scheduler dispatcher. Wraps the launchd-driven scheduler bash scripts.
 *
 *   bun run schedule              # list registered jobs (default)
 *   bun run schedule list         # list registered jobs
 *   bun run schedule install      # install one or more jobs
 *   bun run schedule uninstall    # uninstall one or more jobs
 *   bun run schedule status       # show job status
 *   bun run schedule new          # scaffold a new job dir
 */

import { spawnSync } from 'node:child_process';

function runShell(script: string, args: readonly string[]): number {
	const result = spawnSync(script, args, { stdio: 'inherit' });
	return result.status ?? 1;
}

function help(): number {
	console.log(`Usage: bun run schedule [subcommand]

Subcommands:
  list        (default) List registered jobs
  install     Install one or more jobs
  uninstall   Uninstall one or more jobs
  status      Show job status
  new         Scaffold a new job dir
  help        This index

See scripts/scheduler/README.md for the underlying bash entrypoints.
`);
	return 0;
}

const [head, ...rest] = process.argv.slice(2);
let exitCode = 0;
switch (head) {
	case undefined:
	case 'list':
		exitCode = runShell('./scripts/scheduler/list.sh', rest);
		break;
	case 'help':
	case '--help':
	case '-h':
		exitCode = help();
		break;
	case 'install':
		exitCode = runShell('./scripts/scheduler/install.sh', rest);
		break;
	case 'uninstall':
		exitCode = runShell('./scripts/scheduler/uninstall.sh', rest);
		break;
	case 'status':
		exitCode = runShell('./scripts/scheduler/status.sh', rest);
		break;
	case 'new':
		exitCode = runShell('./scripts/scheduler/new-job.sh', rest);
		break;
	default:
		console.error(`schedule: unknown subcommand "${head}"`);
		help();
		exitCode = 1;
}
process.exit(exitCode);
