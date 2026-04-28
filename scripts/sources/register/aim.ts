/**
 * `bun run sources register aim` -- thin delegator to `@ab/sources/aim`.
 *
 * Walks an existing AIM derivative tree and registers entries in the
 * @ab/sources registry. Does NOT fetch source PDFs or extract markdown --
 * the AIM source pipeline is a separate follow-up to ADR 016 phase 0.
 */

import { runIngestCli } from '@ab/sources/aim';

export const HELP = `bun run sources register aim --edition=<YYYY-MM> [--out=<path>]

  Register entries from an existing AIM derivative tree into the @ab/sources
  registry. Does NOT fetch source PDFs or extract markdown -- the AIM source
  pipeline is a separate follow-up to ADR 016 phase 0.
`;

export async function runRegisterAim(argv: readonly string[]): Promise<number> {
	return runIngestCli(argv);
}
