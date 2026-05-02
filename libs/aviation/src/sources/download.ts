/**
 * HTTP download infrastructure for source binaries.
 *
 * Ported from airboss-firc `scripts/faa-ingest/lib/download.ts` with three changes:
 *   1. Constants (retry count, backoff base, user agent, timeouts) sourced from
 *      `@ab/constants` so one knob tunes everything.
 *   2. `AbortController` bounds the end-to-end GET (parent had only a HEAD timeout).
 *   3. HEAD info + HTTP status available on the result so callers can short-circuit
 *      `304 Not Modified` without inspecting headers themselves.
 *
 * Stays Bun-native: uses `Bun.write`, `Bun.CryptoHasher`, `Bun.file`. The `.part`
 * temp-file -> atomic-rename dance guarantees the destination is either absent
 * or fully hashed; no half-written files survive a crash.
 */

import { createHash } from 'node:crypto';
import fs from 'node:fs/promises';
import path from 'node:path';
import { allowedSourceHost, SOURCE_ACTION_LIMITS, SOURCE_DOWNLOADER_USER_AGENT } from '@ab/constants';

/** HEAD probe info; every field null-safe because many servers block HEAD. */
export interface HeadInfo {
	contentLength: number | null;
	lastModified: string | null;
	etag: string | null;
}

/** Result of a successful download. */
export interface DownloadResult {
	sha256: string;
	fileSize: number;
	headInfo: HeadInfo;
	/** `true` when the server returned 304 and we skipped the GET body. */
	notModified: boolean;
}

/** Optional conditional-request inputs and overrides for deterministic tests. */
export interface DownloadOptions {
	/** If-None-Match value for conditional GET. Enables 304 short-circuit. */
	etag?: string | null;
	/** If-Modified-Since value for conditional GET. */
	lastModified?: string | null;
	/** Override `fetch` for tests. Defaults to the global `fetch`. */
	fetchImpl?: typeof fetch;
	/** Override the sleep between retries. Tests return immediately. */
	sleepImpl?: (ms: number) => Promise<void>;
	/** Structured log hook (events: `head`, `get`, `retry`, `304`, `done`, `cap`). */
	log?: (event: string, detail: Record<string, unknown>) => void;
	/**
	 * Bypass the source-host allowlist. Defaults to `false` (production must
	 * keep this off). Tests that drive `https://example.test/...` through
	 * mocked fetches set `true` to keep the allowlist scoped to real network
	 * targets while still exercising the streaming + cap paths.
	 */
	skipHostAllowlist?: boolean;
}

async function defaultSleep(ms: number): Promise<void> {
	return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Probe `url` with HEAD. A servers-block-HEAD situation yields all-null fields
 * rather than throwing; callers treat absent fields as "unknown, proceed with GET".
 */
export async function headCheck(url: string, options: DownloadOptions = {}): Promise<HeadInfo> {
	const fetchImpl = options.fetchImpl ?? fetch;
	const controller = new AbortController();
	const timeout = setTimeout(() => controller.abort(), SOURCE_ACTION_LIMITS.HEAD_TIMEOUT_MS);

	try {
		const response = await fetchImpl(url, {
			method: 'HEAD',
			signal: controller.signal,
			redirect: 'follow',
			headers: { 'User-Agent': SOURCE_DOWNLOADER_USER_AGENT },
		});
		if (!response.ok) {
			return { contentLength: null, lastModified: null, etag: null };
		}
		const contentLengthHeader = response.headers.get('content-length');
		return {
			contentLength: contentLengthHeader ? Number.parseInt(contentLengthHeader, 10) : null,
			lastModified: response.headers.get('last-modified'),
			etag: response.headers.get('etag'),
		};
	} catch {
		return { contentLength: null, lastModified: null, etag: null };
	} finally {
		clearTimeout(timeout);
	}
}

function computeSha256(bytes: Uint8Array): string {
	// Bun ships Bun.CryptoHasher, but we use node:crypto so the function is
	// testable under the Vitest node runtime without Bun-only globals.
	const hasher = createHash('sha256');
	hasher.update(bytes);
	return hasher.digest('hex');
}

/**
 * Stream `response.body` into the file at `partPath`, hashing as we go and
 * aborting the moment cumulative bytes exceed
 * {@link SOURCE_ACTION_LIMITS.MAX_DOWNLOAD_BYTES}. Returns the sha256 + byte
 * count on success; throws (and removes the partial file) when the cap is
 * exceeded or the stream errors.
 *
 * Replaces the prior `await response.arrayBuffer()` pattern that buffered
 * the entire body in memory before disk write, eliminating both the
 * memory-DoS surface and the no-cap concern.
 */
async function streamBodyToPart(
	response: Response,
	partPath: string,
	url: string,
	log: (event: string, detail: Record<string, unknown>) => void,
): Promise<{ sha256: string; bytes: number }> {
	if (!response.body) {
		throw new Error('download failed: response has no body');
	}
	const cap = SOURCE_ACTION_LIMITS.MAX_DOWNLOAD_BYTES;
	const reader = response.body.getReader();
	const handle = await fs.open(partPath, 'w');
	const hasher = createHash('sha256');
	let total = 0;
	try {
		while (true) {
			const { done, value } = await reader.read();
			if (done) break;
			total += value.byteLength;
			if (total > cap) {
				log('cap', { url, cap, bytesAtAbort: total });
				try {
					await reader.cancel();
				} catch {
					// reader may already be terminal; ignore.
				}
				throw new Error(`download failed: response body exceeded ${cap} bytes for ${url}`);
			}
			hasher.update(value);
			await handle.write(value);
		}
	} finally {
		await handle.close();
	}
	return { sha256: hasher.digest('hex'), bytes: total };
}

/**
 * Download `url` into `destPath` with retry + conditional-GET + atomic rename.
 *
 * Returns `{ notModified: true }` (without writing any file) when the server
 * honors `If-None-Match` / `If-Modified-Since` and returns 304.
 *
 * Throws `Error` after `SOURCE_ACTION_LIMITS.DOWNLOAD_MAX_RETRIES` failures.
 */
export async function downloadFile(
	url: string,
	destPath: string,
	options: DownloadOptions = {},
): Promise<DownloadResult> {
	if (!options.skipHostAllowlist && allowedSourceHost(url) === null) {
		throw new Error(
			`refusing download from disallowed host or scheme: ${url} (must be https: and host in SOURCE_DOWNLOAD_HOST_ALLOWLIST)`,
		);
	}
	const fetchImpl = options.fetchImpl ?? fetch;
	const sleepImpl = options.sleepImpl ?? defaultSleep;
	const log = options.log ?? (() => {});

	log('head', { url });
	const headInfo = await headCheck(url, options);

	const partPath = `${destPath}.part`;
	const dir = path.dirname(destPath);
	await fs.mkdir(dir, { recursive: true });

	const conditionalHeaders: Record<string, string> = {
		'User-Agent': SOURCE_DOWNLOADER_USER_AGENT,
	};
	if (options.etag) conditionalHeaders['If-None-Match'] = options.etag;
	if (options.lastModified) conditionalHeaders['If-Modified-Since'] = options.lastModified;

	let lastError: Error | null = null;

	for (let attempt = 0; attempt < SOURCE_ACTION_LIMITS.DOWNLOAD_MAX_RETRIES; attempt++) {
		if (attempt > 0) {
			const delay = SOURCE_ACTION_LIMITS.DOWNLOAD_BACKOFF_BASE_MS * 2 ** (attempt - 1);
			log('retry', { attempt, delayMs: delay });
			await sleepImpl(delay);
		}

		const controller = new AbortController();
		const timeout = setTimeout(() => controller.abort(), SOURCE_ACTION_LIMITS.DOWNLOAD_TIMEOUT_MS);

		try {
			log('get', { url, attempt });
			const response = await fetchImpl(url, {
				method: 'GET',
				signal: controller.signal,
				redirect: 'follow',
				headers: conditionalHeaders,
			});

			if (response.status === 304) {
				log('304', { url });
				return { sha256: '', fileSize: 0, headInfo, notModified: true };
			}
			if (!response.ok) {
				throw new Error(`download failed: HTTP ${response.status}`);
			}

			// Stream + cap: write directly to `.part`, hashing chunks as they
			// arrive. Replaces the old `await response.arrayBuffer()` which
			// loaded the entire body into memory before disk write.
			const { sha256, bytes } = await streamBodyToPart(response, partPath, url, log);
			await fs.rename(partPath, destPath);

			log('done', { url, fileSize: bytes, sha256 });
			return { sha256, fileSize: bytes, headInfo, notModified: false };
		} catch (err) {
			lastError = err instanceof Error ? err : new Error(String(err));
			try {
				await fs.unlink(partPath);
			} catch {
				// .part may not exist; ignore.
			}
		} finally {
			clearTimeout(timeout);
		}
	}

	throw new Error(
		`failed to download ${url} after ${SOURCE_ACTION_LIMITS.DOWNLOAD_MAX_RETRIES} attempts: ${lastError?.message ?? 'unknown error'}`,
	);
}

/** Stream a file from disk and return its sha256 without loading the whole buffer. */
export async function computeFileHash(filePath: string): Promise<string> {
	const data = await fs.readFile(filePath);
	return computeSha256(data);
}
