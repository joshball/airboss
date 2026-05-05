// @browser-globals: server-only -- never imported by client .svelte
/**
 * InFO corpus ingestion entry point (WP-SAFO-INFO).
 *
 * Sibling to `safo/ingest.ts`. SAFOs and InFOs share the shared bulletin
 * ingester at `shared/bulletin-ingest.ts`; this module only provides the
 * per-corpus spec and the CLI defaults rooted at the InFO cache subdirectory.
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

export const INFO_INGEST_REVIEWER_ID = 'wp-safo-info-info-ingest';

const INFO_SPEC: BulletinIngestSpec = {
	corpus: 'info',
	shortTag: 'InFO',
	formalPrefix: 'FAA Information for Operators',
	reviewerId: INFO_INGEST_REVIEWER_ID,
};

const USAGE = `usage:
  bun run ingest info [--cache=<path>] [--out=<path>]
  bun run ingest info --help

  Walk the InFO cache (default: $AIRBOSS_HANDBOOK_CACHE/info/), extract each
  PDF, write derivatives to <repo>/info/, and register entries into the
  @ab/sources registry.
`;

export async function runInfoIngest(args: BulletinIngestArgs): Promise<BulletinIngestReport> {
	return runBulletinIngest(INFO_SPEC, args);
}

export async function runInfoIngestCli(argv: readonly string[]): Promise<number> {
	return runBulletinCli(
		INFO_SPEC,
		argv,
		{
			cacheRoot: resolveCacheRoot({ ensureExists: false }),
			derivativeRoot: join(process.cwd(), SOURCE_CACHE.INFO),
			skipShaVerify: false,
			help: false,
		},
		USAGE,
	);
}
