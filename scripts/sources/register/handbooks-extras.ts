/**
 * `bun run sources register handbooks-extras` -- thin delegator to
 * `@ab/sources/handbooks-extras`.
 *
 * Walks `scripts/sources/config/handbooks-extras.yaml` + the matching
 * cache (default `$AIRBOSS_HANDBOOK_CACHE/handbooks/<doc_id>/`), extracts
 * each whole-doc PDF, writes per-doc manifest + body markdown to
 * `<repo>/handbooks/<friendly-slug>/<faa-dir>/`, and registers entries in
 * the @ab/sources registry. Idempotent.
 *
 * Closes library-broad-extraction-survey gap 5 -- the six Class C
 * whole-doc-only handbooks (risk-management, aviation-instructor, IFH,
 * IPH, AMT-G, AMT-P) had no register pipeline before this command.
 */

import { runIngestCli } from '@ab/sources/handbooks-extras';

export const HELP = `bun run sources register handbooks-extras [--cache=<path>] [--out=<path>]

  Walk the handbooks-extras cache (default $AIRBOSS_HANDBOOK_CACHE/handbooks/),
  extract each whole-doc PDF, write per-doc manifest.json + document.md under
  <repo>/handbooks/<friendly-slug>/<faa-dir>/, and register entries into the
  @ab/sources registry. The downloader populates the cache; this command
  reads it and is idempotent.
`;

export async function runRegisterHandbooksExtras(argv: readonly string[]): Promise<number> {
	return runIngestCli(argv);
}
