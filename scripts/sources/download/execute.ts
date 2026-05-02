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
import { downloadHtmlFile } from './html-fetch';
import { downloadFile, headRequest } from './http';
import { type ManifestEntry, readManifestEntry, writeManifestEntry } from './manifest';
import { appendPartialDownload } from './partial-log';
import { type DownloadPlan, SCHEMA_VERSION } from './plans';
import type { CorpusResult, VerifyRow } from './summary';

export interface ExecuteContext {
	readonly cacheRoot: string;
}

export async function executePlan(
	plan: DownloadPlan,
	args: CliArgs,
	result: CorpusResult,
	ctx?: ExecuteContext,
): Promise<void> {
	const label = describePlan(plan);

	if (args.dryRun) {
		console.log(`  ${dim('[dry-run]')} ${label}`);
		console.log(`    -> ${plan.destPath}`);
		console.log(`       ${plan.url}`);
		return;
	}

	if (!args.forceRefresh) {
		const existing = readManifestEntry(plan);
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
		const outcome =
			plan.extension === 'html'
				? await downloadHtmlFile(plan.url, plan.destPath, { verbose: args.verbose })
				: await downloadFile(plan.url, plan.destPath, { verbose: args.verbose });
		const entry: ManifestEntry = {
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
		writeManifestEntry(plan, entry);
		result.files += 1;
		result.bytes += outcome.bytes;
		console.log(`    ${green('ok')} ${formatBytes(outcome.bytes)} sha256=${outcome.sha256.slice(0, 12)}...`);
	} catch (error) {
		result.errors += 1;
		console.error(`    ${red('error')} ${label}: ${describeError(error)}`);
		if (ctx !== undefined) {
			try {
				appendPartialDownload(ctx.cacheRoot, plan, error);
			} catch (logError) {
				console.error(`    ${red('error')} (failed to record partial-download log: ${describeError(logError)})`);
			}
		}
	}
}

function describePlan(plan: DownloadPlan): string {
	const base = `${plan.corpus}/${plan.doc}@${plan.edition ?? 'flat'}`;
	if (plan.kind === 'chapter-pdf' && plan.ordinal !== null) {
		return `${base} ch${String(plan.ordinal).padStart(2, '0')}`;
	}
	if (plan.kind === 'ancillary-pdf' && plan.ancillaryKind !== null) {
		return `${base} ${plan.ancillaryKind}`;
	}
	if (plan.kind === 'aim-section' && plan.ordinal !== null && plan.section !== null) {
		return `${base} ch${String(plan.ordinal).padStart(2, '0')}-s${String(plan.section).padStart(2, '0')}`;
	}
	if (plan.kind === 'aim-appendix' && plan.ordinal !== null) {
		return `${base} appendix-${String(plan.ordinal).padStart(2, '0')}`;
	}
	return base;
}

export async function runVerify(plans: readonly DownloadPlan[]): Promise<{ rows: VerifyRow[]; ok: boolean }> {
	const rows: VerifyRow[] = [];
	let ok = true;
	for (const plan of plans) {
		const label = describePlan(plan);
		const manifest = readManifestEntry(plan);
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
