/**
 * `bun run sources register handbooks` -- thin delegator to `@ab/sources/handbooks`.
 *
 * Walks an existing handbook derivative tree and registers entries in the
 * @ab/sources registry. Does NOT fetch source PDFs or extract markdown --
 * use `bun run sources extract handbooks` for that.
 */

import { runIngestCli } from '@ab/sources/handbooks';

export const HELP = `bun run sources register handbooks --doc=<phak|afh|avwx> --edition=<edition> [--out=<path>]

  Register entries from an existing handbook derivative tree into the
  @ab/sources registry. Does NOT fetch source PDFs or extract markdown --
  use \`bun run sources extract handbooks\` for that.
`;

export async function runRegisterHandbooks(argv: readonly string[]): Promise<number> {
	return runIngestCli(argv);
}
