/**
 * `bun run sources register aim` -- thin delegator to `@ab/sources/aim`.
 *
 * Two modes:
 *   - source-ingest (default when --cache is supplied): walks the cached PDF,
 *     extracts markdown, writes the derivative tree, then registers entries.
 *   - manifest-walk (default when --cache is omitted): reads an existing
 *     derivative tree and only registers entries (--edition required).
 */

import { runIngestCli } from '@ab/sources/aim';

export const HELP = `bun run sources register aim [--cache=<path>] [--out=<path>] [--edition=<YYYY-MM>]

  Walk the AIM cache (default $AIRBOSS_HANDBOOK_CACHE/aim/), extract each
  cached PDF, write derivatives to <repo>/aim/<edition>/, and register entries
  in the @ab/sources registry. Idempotent.

  When --cache= is omitted, the command reads an existing derivative tree at
  <out>/<edition>/manifest.json and only registers entries (--edition required).

  --cache=<path>     Cache root (default $AIRBOSS_HANDBOOK_CACHE).
  --out=<path>       Derivative root (default <cwd>/aim).
  --edition=<slug>   Restrict to one edition (default: every cached edition).
`;

export async function runRegisterAim(argv: readonly string[]): Promise<number> {
	return runIngestCli(argv);
}
