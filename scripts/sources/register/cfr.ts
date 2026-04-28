/**
 * `bun run sources register cfr` -- thin delegator to `@ab/sources/regs`.
 *
 * The per-corpus runner lives in `libs/sources/src/regs/ingest.ts` and owns
 * arg parsing, validation, network fetch, and derivative emission. This
 * module exists so the dispatcher can route by corpus name without importing
 * the per-corpus surface directly.
 */

import { runIngestCli } from '@ab/sources/regs';

export const HELP = `bun run sources register cfr [--title=14|49] [--edition=<YYYY-MM-DD>] [--fixture=<path>] [--out=<path>]

  Ingest one CFR title (14 or 49) at a given edition. Either --edition= or
  --fixture= is required. Live ingestion (no --fixture) hits the eCFR
  Versioner API and caches XML under
  $AIRBOSS_HANDBOOK_CACHE/regulations/cfr-<title>/<edition>/.
  CI runs MUST pass --fixture= -- live network ingest is an operator action.
`;

export async function runRegisterCfr(argv: readonly string[]): Promise<number> {
	return runIngestCli(argv);
}
