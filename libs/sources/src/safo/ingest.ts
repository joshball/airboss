/**
 * SAFO corpus ingestion entry point (WP-SAFO-INFO).
 *
 * Thin wrapper around the shared bulletin ingester. SAFOs and InFOs share an
 * identical pipeline (see `shared/bulletin-ingest.ts`); this module only
 * provides the per-corpus spec (canonical labels, reviewer id) and the CLI
 * defaults rooted at the SAFO cache subdirectory.
 */

import { join } from 'node:path';
import { resolveCacheRoot, SOURCE_CACHE } from '@ab/constants';
import {
	type BulletinIngestArgs,
	type BulletinIngestReport,
	type BulletinIngestSpec,
	runBulletinCli,
	runBulletinIngest,
} from '../shared/bulletin-ingest.ts';

export const SAFO_INGEST_REVIEWER_ID = 'wp-safo-info-safo-ingest';

const SAFO_SPEC: BulletinIngestSpec = {
	corpus: 'safo',
	shortTag: 'SAFO',
	formalPrefix: 'FAA Safety Alert for Operators',
	reviewerId: SAFO_INGEST_REVIEWER_ID,
};

const USAGE = `usage:
  bun run ingest safo [--cache=<path>] [--out=<path>]
  bun run ingest safo --help

  Walk the SAFO cache (default: $AIRBOSS_HANDBOOK_CACHE/safo/), extract each
  PDF, write derivatives to <repo>/safo/, and register entries into the
  @ab/sources registry.
`;

export async function runSafoIngest(args: BulletinIngestArgs): Promise<BulletinIngestReport> {
	return runBulletinIngest(SAFO_SPEC, args);
}

export async function runSafoIngestCli(argv: readonly string[]): Promise<number> {
	return runBulletinCli(
		SAFO_SPEC,
		argv,
		{
			cacheRoot: resolveCacheRoot({ ensureExists: false }),
			derivativeRoot: join(process.cwd(), SOURCE_CACHE.SAFO),
			skipShaVerify: false,
			help: false,
		},
		USAGE,
	);
}
