/**
 * `bun run sources register safo` -- thin delegator to `@ab/sources/safo`.
 *
 * Walks the SAFO cache (default `$AIRBOSS_HANDBOOK_CACHE/safo/`), extracts each
 * PDF, writes per-SAFO manifest + body markdown to `<repo>/safo/`, and registers
 * entries in the @ab/sources registry.
 */

import { runSafoIngestCli } from '@ab/sources/safo';

export const HELP = `bun run sources register safo [--cache=<path>] [--out=<path>]

  Walk the SAFO cache (default $AIRBOSS_HANDBOOK_CACHE/safo/), extract each PDF,
  write per-SAFO manifest.json + safo-<id>.md under <repo>/safo/<id>/, and
  register entries into the @ab/sources registry. The downloader populates the
  cache; this command reads it and is idempotent.
`;

export async function runRegisterSafo(argv: readonly string[]): Promise<number> {
	return runSafoIngestCli(argv);
}
