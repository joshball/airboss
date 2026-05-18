/**
 * `bun run sources register cfr` -- thin delegator to the CFR ingest CLI.
 *
 * The per-corpus runner lives in `libs/sources/src/regs/ingest.ts` and owns
 * arg parsing, validation, network fetch, and derivative emission. This
 * module exists so the dispatcher can route by corpus name without importing
 * the per-corpus surface directly.
 *
 * Imports the CLI from the deep `@ab/sources/regs/ingest` path rather than
 * the `@ab/sources/regs` corpus barrel: the barrel is the resolver-
 * registration entry point loaded by every server, and `ingest.ts` reaches
 * `fast-xml-parser` -- which has no business in an app server bundle.
 */

import { runIngestCli } from '@ab/sources/regs/ingest';

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
