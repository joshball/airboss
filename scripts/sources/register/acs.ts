/**
 * `bun run sources register acs` -- thin delegator to `@ab/sources/acs`.
 *
 * Walks the ACS cache (default `$AIRBOSS_HANDBOOK_CACHE/acs/`), extracts each
 * cert PDF that maps to a registered cert slug, writes per-publication
 * manifest + per-task body markdown to `<repo>/acs/`, and registers entries
 * in the @ab/sources registry.
 *
 * The Lane D slice ships PPL-ASEL only; other certs are deferred until the
 * locator-convention Open Question 7 (cert-syllabus WP) resolves or until
 * a sibling lane lights them up.
 */

import { runIngestCli } from '@ab/sources/acs';

export const HELP = `bun run sources register acs [--cache=<path>] [--out=<path>] [--cert=<slug>]

  Walk the ACS cache (default $AIRBOSS_HANDBOOK_CACHE/acs/), extract each PDF
  whose doc-family maps to a registered cert slug, write per-publication
  manifest.json + per-task body markdown under <repo>/acs/<cert>/<edition>/,
  and register entries into the @ab/sources registry. The downloader populates
  the cache; this command reads it and is idempotent.

  Slice scope: PPL-ASEL only. Other ACS cert families parse and skip with an
  explicit reason until Open Question 7 of the cert-syllabus WP (final ACS
  locator convention) resolves and additional cert mappings are wired in.
`;

export async function runRegisterAcs(argv: readonly string[]): Promise<number> {
	return runIngestCli(argv);
}
