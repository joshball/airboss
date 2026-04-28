/**
 * `bun run sources register <corpus>` -- ingestion-registry dispatcher.
 *
 * Routes to the per-corpus `runIngestCli` exported from `@ab/sources/<corpus>`.
 * Each corpus owns its arg parsing, validation, and execution. This file only
 * handles routing, top-level help, and the `--all` orchestrator.
 *
 * Source of truth: ADR 019 §1.2 (corpus catalogue) and the per-corpus WPs:
 *
 *   - `docs/work-packages/reference-cfr-ingestion-bulk/`
 *   - `docs/work-packages/reference-handbook-ingestion/`
 *   - `docs/work-packages/reference-aim-ingestion/`
 */

import { HELP as AC_HELP, runRegisterAc } from './register/ac';
import { HELP as AIM_HELP, runRegisterAim } from './register/aim';
import { HELP as CFR_HELP, runRegisterCfr } from './register/cfr';
import { HELP as HANDBOOKS_HELP, runRegisterHandbooks } from './register/handbooks';

export type RegisterCorpus = 'cfr' | 'handbooks' | 'aim' | 'ac';

export interface RegisterSpec {
	readonly run: (argv: readonly string[]) => Promise<number>;
	readonly help: string;
}

export const REGISTER_SUBCOMMANDS: Readonly<Record<RegisterCorpus, RegisterSpec>> = {
	cfr: { run: runRegisterCfr, help: CFR_HELP },
	handbooks: { run: runRegisterHandbooks, help: HANDBOOKS_HELP },
	aim: { run: runRegisterAim, help: AIM_HELP },
	ac: { run: runRegisterAc, help: AC_HELP },
};

const REGISTER_NAMES = Object.keys(REGISTER_SUBCOMMANDS) as readonly RegisterCorpus[];

export const REGISTER_USAGE = `usage:
  bun run sources register <corpus> [args...]   run a single corpus register
  bun run sources register --all [args...]      run every corpus sequentially
  bun run sources register --help               show this usage
  bun run sources register <corpus> --help      show per-corpus usage

corpora:
${REGISTER_NAMES.map((name) => `  ${name}`).join('\n')}
`;

function isRegisterCorpus(value: string): value is RegisterCorpus {
	return (REGISTER_NAMES as readonly string[]).includes(value);
}

export async function runRegisterDispatcher(argv: readonly string[]): Promise<number> {
	const [head, ...rest] = argv;

	if (head === undefined) {
		process.stderr.write(REGISTER_USAGE);
		return 2;
	}

	if (head === '--help' || head === '-h') {
		process.stdout.write(REGISTER_USAGE);
		return 0;
	}

	if (head === '--all') {
		let firstFailure = 0;
		for (const name of REGISTER_NAMES) {
			process.stdout.write(`\n--- register ${name} ---\n`);
			const code = await REGISTER_SUBCOMMANDS[name].run(rest);
			if (code !== 0 && firstFailure === 0) firstFailure = code;
		}
		return firstFailure;
	}

	if (!isRegisterCorpus(head)) {
		process.stderr.write(`unknown corpus: ${head}\n${REGISTER_USAGE}`);
		return 2;
	}

	const spec = REGISTER_SUBCOMMANDS[head];

	if (rest.includes('--help') || rest.includes('-h')) {
		process.stdout.write(spec.help);
		return 0;
	}

	return await spec.run(rest);
}
