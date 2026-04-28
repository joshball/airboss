/**
 * Per-plan execution + verify-mode driver.
 *
 * `executePlan` runs one download with HEAD-then-skip caching, writes the
 * manifest on success, and updates the rolling per-corpus counters.
 *
 * `runVerify` issues HEAD against every plan (no GETs) and produces the rows
 * the verify-table printer renders.
 */

import { existsSync, statSync } from 'node:fs';
import { basename } from 'node:path';
import { formatBytes } from '../../lib/bytes';
import { dim, green, red, yellow } from '../../lib/colors';
import { describeError } from '../../lib/error';
import type { CliArgs } from './args';
import { evaluateFreshness } from './freshness';
import { downloadFile, headRequest } from './http';
import { type Manifest, readManifest, writeManifest } from './manifest';
import { type DownloadPlan, SCHEMA_VERSION } from './plans';
import type { CorpusResult, VerifyRow } from './summary';
import { ensureSourceSymlink } from './symlink';

export async function executePlan(plan: DownloadPlan, args: CliArgs, result: CorpusResult): Promise<void> {
	const label = `${plan.corpus}/${plan.doc}@${plan.edition}`;

	if (args.dryRun) {
		console.log(`  ${dim('[dry-run]')} ${label}`);
		console.log(`    -> ${plan.destPath}`);
		console.log(`       ${plan.url}`);
		return;
	}

	if (!args.forceRefresh) {
		const existing = readManifest(plan);
		const decision = await evaluateFreshness(plan, existing);
		if (decision.fresh && existing !== null) {
			if (args.verbose) {
				console.log(`  ${yellow('skip')} (cached, ${decision.reason}) ${label} ${formatBytes(existing.size_bytes)}`);
			}
			result.skipped += 1;
			return;
		}
		if (existing !== null && args.verbose) {
			console.log(`  refetch ${label} -- ${decision.reason}`);
		}
	}

	console.log(`  fetching ${label}`);
	try {
		const outcome = await downloadFile(plan.url, plan.destPath, { verbose: args.verbose });
		ensureSourceSymlink(plan);
		const manifest: Manifest = {
			corpus: plan.corpus,
			doc: plan.doc,
			edition: plan.edition,
			source_url: outcome.url,
			source_filename: basename(plan.destPath),
			source_sha256: outcome.sha256,
			size_bytes: outcome.bytes,
			fetched_at: new Date().toISOString(),
			...(outcome.lastModified !== null ? { last_modified: outcome.lastModified } : {}),
			...(outcome.etag !== null ? { etag: outcome.etag } : {}),
			schema_version: SCHEMA_VERSION,
		};
		writeManifest(plan, manifest);
		result.files += 1;
		result.bytes += outcome.bytes;
		console.log(`    ${green('ok')} ${formatBytes(outcome.bytes)} sha256=${outcome.sha256.slice(0, 12)}...`);
	} catch (error) {
		result.errors += 1;
		console.error(`    ${red('error')} ${label}: ${describeError(error)}`);
	}
}

export async function runVerify(plans: readonly DownloadPlan[]): Promise<{ rows: VerifyRow[]; ok: boolean }> {
	const rows: VerifyRow[] = [];
	let ok = true;
	for (const plan of plans) {
		const label = `${plan.corpus}/${plan.doc}@${plan.edition}`;
		const manifest = readManifest(plan);
		try {
			const head = await headRequest(plan.url);
			const cacheHit =
				manifest !== null &&
				existsSync(plan.destPath) &&
				statSync(plan.destPath).size === manifest.size_bytes &&
				(head.contentLength === null || head.contentLength === manifest.size_bytes);
			if (head.status < 200 || head.status >= 300) ok = false;
			rows.push({
				label,
				url: plan.url,
				status: head.status,
				contentLength: head.contentLength,
				lastModified: head.lastModified,
				cacheHit,
				note: '',
			});
		} catch (error) {
			ok = false;
			rows.push({
				label,
				url: plan.url,
				status: 'ERR',
				contentLength: null,
				lastModified: null,
				cacheHit: false,
				note: describeError(error),
			});
		}
	}
	return { rows, ok };
}
