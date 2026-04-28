/**
 * `bun run sources register ac` -- thin delegator to `@ab/sources/ac`.
 *
 * Walks the AC cache (default `$AIRBOSS_HANDBOOK_CACHE/ac/`), extracts each
 * PDF, writes per-AC manifest + body markdown to `<repo>/ac/`, and registers
 * entries in the @ab/sources registry.
 */

import { runIngestCli } from '@ab/sources/ac';

export const HELP = `bun run sources register ac [--cache=<path>] [--out=<path>]

  Walk the AC cache (default $AIRBOSS_HANDBOOK_CACHE/ac/), extract each PDF,
  write per-AC manifest.json + document.md under <repo>/ac/<doc>/<rev>/, and
  register entries into the @ab/sources registry. The downloader populates
  the cache; this command reads it and is idempotent.
`;

export async function runRegisterAc(argv: readonly string[]): Promise<number> {
	return runIngestCli(argv);
}
