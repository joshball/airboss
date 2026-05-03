/**
 * `bun run sources register info` -- thin delegator to `@ab/sources/info`.
 *
 * Walks the InFO cache (default `$AIRBOSS_HANDBOOK_CACHE/info/`), extracts each
 * PDF, writes per-InFO manifest + body markdown to `<repo>/info/`, and registers
 * entries in the @ab/sources registry.
 */

import { runInfoIngestCli } from '@ab/sources/info';

export const HELP = `bun run sources register info [--cache=<path>] [--out=<path>]

  Walk the InFO cache (default $AIRBOSS_HANDBOOK_CACHE/info/), extract each PDF,
  write per-InFO manifest.json + info-<id>.md under <repo>/info/<id>/, and
  register entries into the @ab/sources registry. The downloader populates the
  cache; this command reads it and is idempotent.
`;

export async function runRegisterInfo(argv: readonly string[]): Promise<number> {
	return runInfoIngestCli(argv);
}
