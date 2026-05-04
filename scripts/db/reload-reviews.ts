#!/usr/bin/env bun

/**
 * Manually trigger the review-queue loader. Walks the discovery rules,
 * upserts review items, soft-prunes missing artifacts, and rebuilds the
 * docs FTS index. Idempotent.
 *
 * Usage: bun scripts/db/reload-reviews.ts [--quiet]
 */

import { resolve } from 'node:path';
import { loadReviewItems } from '@ab/bc-hangar';

const QUIET = process.argv.includes('--quiet');

async function main(): Promise<void> {
	const repoRoot = resolve(import.meta.dir, '..', '..');
	const result = await loadReviewItems(repoRoot);
	if (!QUIET) {
		console.log('reload-reviews:');
		console.log(`  items   added=${result.added} updated=${result.updated} removed=${result.removed}`);
		console.log(`  fts     added=${result.fts.added} updated=${result.fts.updated} removed=${result.fts.removed}`);
		console.log(`  errors  ${result.errors.length}`);
		for (const err of result.errors) {
			console.log(`  - [${err.kindId}] ${err.ref}: ${err.message}`);
		}
		console.log(`  duration ${result.durationMs}ms`);
	}
	if (result.errors.length > 0) process.exitCode = 1;
}

await main();
