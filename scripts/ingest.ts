#!/usr/bin/env bun

/**
 * `bun scripts/ingest.ts` -- unified corpus ingestion dispatcher.
 *
 * Single entry point that routes to the per-corpus `runIngestCli` exported
 * from `@ab/sources/<corpus>`. Each corpus owns its arg parsing, validation,
 * and execution. The dispatcher only handles routing, top-level help, and
 * the `--all` orchestrator.
 *
 * Usage:
 *
 *   bun run ingest cfr [--title=14|49] [--edition=YYYY-MM-DD] [--fixture=<path>] [--out=<path>]
 *   bun run ingest handbooks [--doc=phak|afh|avwx] [--edition=<...>] [--out=<path>]
 *   bun run ingest aim [--edition=<YYYY-MM>] [--out=<path>]
 *   bun run ingest --all
 *   bun run ingest --help
 *   bun run ingest <corpus> --help
 *
 * Adding a new corpus is a single import + one entry in `SUBCOMMANDS`.
 *
 * Source of truth: ADR 019 §1.2 (corpus catalogue) and the per-corpus WPs:
 *   - `docs/work-packages/reference-cfr-ingestion-bulk/`
 *   - `docs/work-packages/reference-handbook-ingestion/`
 *   - `docs/work-packages/reference-aim-ingestion/`
 */

import { runIngestCli as runAimIngestCli } from '@ab/sources/aim';
import { runIngestCli as runHandbooksIngestCli } from '@ab/sources/handbooks';
import { runIngestCli as runRegsIngestCli } from '@ab/sources/regs';

export type Subcommand = 'cfr' | 'handbooks' | 'aim';

export interface SubcommandSpec {
	readonly run: (argv: readonly string[]) => Promise<number>;
	readonly help: string;
}

export const SUBCOMMANDS: Readonly<Record<Subcommand, SubcommandSpec>> = {
	cfr: {
		run: runRegsIngestCli,
		help: `bun run ingest cfr [--title=14|49] [--edition=<YYYY-MM-DD>] [--fixture=<path>] [--out=<path>]

  Ingest one CFR title (14 or 49) at a given edition. Either --edition= or
  --fixture= is required. Live ingestion (no --fixture) hits the eCFR
  Versioner API and caches XML under
  $AIRBOSS_HANDBOOK_CACHE/regulations/cfr-<title>/<edition>/.
  CI runs MUST pass --fixture= -- live network ingest is an operator action.
`,
	},
	handbooks: {
		run: runHandbooksIngestCli,
		help: `bun run ingest handbooks --doc=<phak|afh|avwx> --edition=<edition> [--out=<path>]

  Register entries from an existing handbook derivative tree into the
  @ab/sources registry. Does NOT fetch source PDFs or extract markdown --
  use the operator's PDF pipeline (\`bun run handbook-ingest\`) for that.
`,
	},
	aim: {
		run: runAimIngestCli,
		help: `bun run ingest aim --edition=<YYYY-MM> [--out=<path>]

  Register entries from an existing AIM derivative tree into the @ab/sources
  registry. Does NOT fetch source PDFs or extract markdown -- the operator
  source pipeline is a separate follow-up to ADR 016 phase 0.
`,
	},
};

const SUBCOMMAND_NAMES = Object.keys(SUBCOMMANDS) as readonly Subcommand[];

const TOP_USAGE = `usage:
  bun run ingest <corpus> [args...]    run a single corpus ingest
  bun run ingest --all [args...]       run every corpus sequentially
  bun run ingest --help                show this usage
  bun run ingest <corpus> --help       show per-corpus usage

corpora:
${SUBCOMMAND_NAMES.map((name) => `  ${name}`).join('\n')}
`;

function isSubcommand(value: string): value is Subcommand {
	return (SUBCOMMAND_NAMES as readonly string[]).includes(value);
}

export async function runIngestDispatcher(argv: readonly string[]): Promise<number> {
	const [head, ...rest] = argv;

	if (head === undefined) {
		process.stderr.write(TOP_USAGE);
		return 2;
	}

	if (head === '--help' || head === '-h') {
		process.stdout.write(TOP_USAGE);
		return 0;
	}

	if (head === '--all') {
		let firstFailure = 0;
		for (const name of SUBCOMMAND_NAMES) {
			process.stdout.write(`\n--- ingest ${name} ---\n`);
			const code = await SUBCOMMANDS[name].run(rest);
			if (code !== 0 && firstFailure === 0) firstFailure = code;
		}
		return firstFailure;
	}

	if (!isSubcommand(head)) {
		process.stderr.write(`unknown corpus: ${head}\n${TOP_USAGE}`);
		return 2;
	}

	const spec = SUBCOMMANDS[head];

	if (rest.includes('--help') || rest.includes('-h')) {
		process.stdout.write(spec.help);
		return 0;
	}

	return await spec.run(rest);
}

if (import.meta.main) {
	const code = await runIngestDispatcher(process.argv.slice(2));
	process.exit(code);
}
