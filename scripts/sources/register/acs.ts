/**
 * `bun run sources register acs` -- thin delegator to `@ab/sources/acs`.
 *
 * Walks the ACS cache (default `$AIRBOSS_HANDBOOK_CACHE/acs/`), extracts each
 * PDF that maps to a registered publication slug, writes per-publication
 * manifest + per-task body markdown to `<repo>/acs/<slug>/`, and registers
 * entries in the @ab/sources registry under the locked-Q7 SourceId format.
 *
 * Slice scope: ppl-airplane-6c only; other publications are deferred until a
 * sibling lane lights them up.
 */

import { runIngestCli } from '@ab/sources/acs';

export const HELP = `bun run sources register acs [--cache=<path>] [--out=<path>] [--slug=<slug>]

  Walk the ACS cache (default $AIRBOSS_HANDBOOK_CACHE/acs/), extract each PDF
  whose detected edition maps to a registered publication slug, write
  per-publication manifest.json + per-task body markdown under
  <repo>/acs/<slug>/, and register entries into the @ab/sources registry.
  The downloader populates the cache; this command reads it and is idempotent.

  Slice scope: ppl-airplane-6c only. Other publications parse and skip with
  an explicit reason until additional slug mappings are wired in.
`;

export async function runRegisterAcs(argv: readonly string[]): Promise<number> {
	return runIngestCli(argv);
}
