/**
 * `bun run sources extract <pipeline>` -- source-extraction dispatcher.
 *
 * Currently routes to a single sub-pipeline:
 *
 *   handbooks -- Python TOC + LLM section extraction (delegates to
 *                `tools/handbook-ingest/`).
 *
 * New extraction surfaces (regs, ac, acs) plug in here without touching the
 * top-level `sources` dispatcher.
 */

import { runExtractHandbooks } from './extract/handbooks';

export type ExtractPipeline = 'handbooks';

export interface ExtractSpec {
	readonly run: (argv: readonly string[]) => Promise<number>;
	readonly help: string;
}

const HANDBOOKS_HELP = `bun run sources extract handbooks [args passthrough to python]

  Dispatches to \`python -m ingest\` from \`tools/handbook-ingest/\`. Use
  \`bun run sources extract handbooks --help\` to see the Python-side flags.
  Examples:

    bun run sources extract handbooks phak --edition FAA-H-8083-25C
    bun run sources extract handbooks phak --edition FAA-H-8083-25C --dry-run
    bun run sources extract handbooks phak --edition FAA-H-8083-25C --strategy compare
`;

export const EXTRACT_SUBCOMMANDS: Readonly<Record<ExtractPipeline, ExtractSpec>> = {
	handbooks: { run: runExtractHandbooks, help: HANDBOOKS_HELP },
};

const EXTRACT_NAMES = Object.keys(EXTRACT_SUBCOMMANDS) as readonly ExtractPipeline[];

export const EXTRACT_USAGE = `usage:
  bun run sources extract <pipeline> [args...]   run an extraction pipeline
  bun run sources extract --help                 show this usage
  bun run sources extract <pipeline> --help      show per-pipeline usage

pipelines:
${EXTRACT_NAMES.map((name) => `  ${name}`).join('\n')}
`;

function isExtractPipeline(value: string): value is ExtractPipeline {
	return (EXTRACT_NAMES as readonly string[]).includes(value);
}

export async function runExtractDispatcher(argv: readonly string[]): Promise<number> {
	const [head, ...rest] = argv;

	if (head === undefined) {
		process.stderr.write(EXTRACT_USAGE);
		return 2;
	}

	if (head === '--help' || head === '-h') {
		process.stdout.write(EXTRACT_USAGE);
		return 0;
	}

	if (!isExtractPipeline(head)) {
		process.stderr.write(`unknown extract pipeline: ${head}\n${EXTRACT_USAGE}`);
		return 2;
	}

	const spec = EXTRACT_SUBCOMMANDS[head];

	// `--help` for handbooks is handled by python's argparse (it has its own
	// surface). Forwarding the flag instead of intercepting it lets the
	// downstream tool stay the source of truth on its own arguments.
	return await spec.run(rest);
}
