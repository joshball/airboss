#!/usr/bin/env bun

/**
 * `bun scripts/airboss-ref.ts` -- entry point for the ADR 019 reference-
 * identifier system.
 *
 * Subcommands:
 *
 *   - (default)        validate `course/regulations/**`. Read-only.
 *   - --fix            validate AND auto-stamp `?at=<currentAccepted>` on
 *                      unpinned identifiers. Local-only; refuses to run
 *                      when `process.env.CI === 'true'`.
 *   - snapshot         write a JSON snapshot of the static + indexed-tier
 *                      registry. Defaults to `data/sources-snapshot.json`;
 *                      override with `--out=<path>`.
 *   - --help / -h      print this usage.
 *
 * Source of truth: ADR 019 §1.3 (`--fix`), §2.5 (snapshot).
 */

import { runCli } from '@ab/sources/check';
import { runFixCli } from '@ab/sources/fix';
import { runSnapshotCli } from '@ab/sources/snapshot';

const USAGE = `usage:
  bun scripts/airboss-ref.ts                validate (default)
  bun scripts/airboss-ref.ts --fix          validate + auto-stamp pins (local only)
  bun scripts/airboss-ref.ts snapshot       write JSON snapshot (default: data/sources-snapshot.json)
  bun scripts/airboss-ref.ts snapshot --out=<path>
  bun scripts/airboss-ref.ts --help         show this usage
`;

function main(argv: readonly string[]): number {
	const [command, ...rest] = argv;

	if (command === '--help' || command === '-h') {
		process.stdout.write(USAGE);
		return 0;
	}

	if (command === undefined) {
		return runCli();
	}

	if (command === '--fix') {
		if (rest.length > 0) {
			process.stderr.write(`unknown arguments after --fix: ${rest.join(' ')}\n`);
			process.stderr.write(USAGE);
			return 2;
		}
		return runFixCli();
	}

	if (command === 'snapshot') {
		return runSnapshotCli(rest);
	}

	process.stderr.write(`unknown subcommand: ${command}\n`);
	process.stderr.write(USAGE);
	return 2;
}

process.exit(main(process.argv.slice(2)));
