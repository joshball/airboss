/**
 * Cache-freshness check for the source downloader.
 *
 * Decision tree:
 *
 *   no manifest                         -> stale (download)
 *   no cached file                      -> stale (download)
 *   cached size != manifest size        -> stale (download)
 *   HEAD failed                         -> stale (download)
 *   HEAD non-2xx                        -> stale (download)
 *   HEAD content-length disagrees       -> stale (download)
 *   etag matches                        -> fresh (skip)
 *   last-modified did not advance       -> fresh (skip)
 *   content-length matches, no metadata -> fresh (skip; trust size)
 *   otherwise                           -> stale (download)
 *
 * `--force-refresh` short-circuits this entire check at the executor level.
 */

import { existsSync, statSync } from 'node:fs';
import { describeError } from '../../lib/error';
import { isLaterHttpDate } from '../../lib/http-date';
import { type HeadResult, headRequest } from './http';
import type { Manifest } from './manifest';
import type { DownloadPlan } from './plans';

export interface FreshnessDecision {
	readonly fresh: boolean;
	readonly reason: string;
	readonly head: HeadResult | null;
}

export async function evaluateFreshness(
	plan: DownloadPlan,
	manifest: Manifest | null,
	fetchImpl: typeof fetch = globalThis.fetch,
): Promise<FreshnessDecision> {
	if (manifest === null) return { fresh: false, reason: 'no manifest', head: null };
	if (!existsSync(plan.destPath)) return { fresh: false, reason: 'cached file missing', head: null };
	const cachedSize = statSync(plan.destPath).size;
	if (cachedSize !== manifest.size_bytes) {
		return { fresh: false, reason: `size drift (cached=${cachedSize}, manifest=${manifest.size_bytes})`, head: null };
	}

	let head: HeadResult;
	try {
		head = await headRequest(plan.url, fetchImpl);
	} catch (error) {
		return { fresh: false, reason: `HEAD failed: ${describeError(error)}`, head: null };
	}

	if (head.status < 200 || head.status >= 300) {
		return { fresh: false, reason: `HEAD HTTP ${head.status}`, head };
	}

	if (head.contentLength !== null && head.contentLength !== cachedSize) {
		return {
			fresh: false,
			reason: `content-length drift (head=${head.contentLength}, cached=${cachedSize})`,
			head,
		};
	}

	const etagMatch =
		head.etag !== null && manifest.etag !== undefined && manifest.etag.length > 0 && head.etag === manifest.etag;
	const lastModNotAdvanced =
		head.lastModified !== null &&
		manifest.last_modified !== undefined &&
		manifest.last_modified.length > 0 &&
		!isLaterHttpDate(head.lastModified, manifest.last_modified);

	if (etagMatch || lastModNotAdvanced) {
		return { fresh: true, reason: etagMatch ? 'etag match' : 'last-modified unchanged', head };
	}

	// No etag/last-modified comparison possible but content-length matches and
	// we have a manifest hash -- treat as fresh. The remote might have
	// silently rotated bytes, but without metadata we have no signal.
	if (head.contentLength === cachedSize) {
		return { fresh: true, reason: 'content-length match (no etag/last-modified)', head };
	}

	return { fresh: false, reason: 'no metadata match', head };
}
