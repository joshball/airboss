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
 * Hardening (cluster E):
 *   - The GET path streams the body chunk-by-chunk and aborts the moment the
 *     running byte count exceeds `SOURCE_ACTION_LIMITS.MAX_DOWNLOAD_BYTES` so
 *     a tarpit / runaway response can't fill the developer's home directory.
 *   - When the server provides a `Content-Length` larger than the cap, we
 *     refuse before reading any body bytes.
 *   - The hash is computed incrementally over the same chunks, no double-buffer.
 *
 * Stays Bun-native: uses `Bun.write`, `Bun.CryptoHasher`, `Bun.file`. The `.part`
 * temp-file -> atomic-rename dance guarantees the destination is either absent
 * or fully hashed; no half-written files survive a crash.
 */

import { createHash } from 'node:crypto';
import { createWriteStream } from 'node:fs';
import fs from 'node:fs/promises';
import path from 'node:path';
import { Readable } from 'node:stream';
import { pipeline } from 'node:stream/promises';
import { SOURCE_ACTION_LIMITS, SOURCE_DOWNLOADER_USER_AGENT } from '@ab/constants';

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
	/** Structured log hook (events: `head`, `get`, `retry`, `304`, `done`). */
	log?: (event: string, detail: Record<string, unknown>) => void;
	/**
	 * Override the per-download body cap. Tests use a small value to exercise
	 * the overrun path. Production callers leave this undefined; the default
	 * is `SOURCE_ACTION_LIMITS.MAX_DOWNLOAD_BYTES`.
	 */
	maxBodyBytes?: number;
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

/**
 * Download `url` into `destPath` with retry + conditional-GET + atomic rename.
 *
 * Returns `{ notModified: true }` (without writing any file) when the server
 * honors `If-None-Match` / `If-Modified-Since` and returns 304.
 *
 * Throws `Error` after `SOURCE_ACTION_LIMITS.DOWNLOAD_MAX_RETRIES` failures or
 * the moment a body exceeds `maxBodyBytes` (defaults to MAX_DOWNLOAD_BYTES).
 */
export async function downloadFile(
	url: string,
	destPath: string,
	options: DownloadOptions = {},
): Promise<DownloadResult> {
	const fetchImpl = options.fetchImpl ?? fetch;
	const sleepImpl = options.sleepImpl ?? defaultSleep;
	const log = options.log ?? (() => {});
	const maxBodyBytes = options.maxBodyBytes ?? SOURCE_ACTION_LIMITS.MAX_DOWNLOAD_BYTES;

	log('head', { url });
	const headInfo = await headCheck(url, options);

	if (headInfo.contentLength !== null && headInfo.contentLength > maxBodyBytes) {
		throw new Error(
			`refusing to download: HEAD Content-Length ${headInfo.contentLength} exceeds cap ${maxBodyBytes} for ${url}`,
		);
	}

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
			if (!response.body) {
				throw new Error('download failed: response has no body');
			}

			// Re-check the body's own Content-Length (HEAD and GET can differ).
			const responseLengthHeader = response.headers.get('content-length');
			if (responseLengthHeader !== null) {
				const declared = Number.parseInt(responseLengthHeader, 10);
				if (Number.isFinite(declared) && declared > maxBodyBytes) {
					throw new Error(`download failed: GET Content-Length ${declared} exceeds cap ${maxBodyBytes} for ${url}`);
				}
			}

			const result = await streamToFileWithCap(response.body, partPath, maxBodyBytes, url);

			await fs.rename(partPath, destPath);

			log('done', { url, fileSize: result.bytes, sha256: result.sha256 });
			return { sha256: result.sha256, fileSize: result.bytes, headInfo, notModified: false };
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

/**
 * Pipe a Web ReadableStream to a file while updating a sha256 hash and aborting
 * once the running byte count exceeds `maxBodyBytes`. The stream is destroyed
 * on overrun so we never write more than `maxBodyBytes + last-chunk-size` to
 * disk; the `.part` file is unlinked by the caller's catch handler.
 */
async function streamToFileWithCap(
	body: ReadableStream<Uint8Array>,
	partPath: string,
	maxBodyBytes: number,
	url: string,
): Promise<{ sha256: string; bytes: number }> {
	const hash = createHash('sha256');
	let bytes = 0;
	let overrunError: Error | null = null;
	const fileStream = createWriteStream(partPath);
	const nodeStream = Readable.fromWeb(body as unknown as import('node:stream/web').ReadableStream);

	nodeStream.on('data', (chunk: Buffer | string) => {
		const buf = typeof chunk === 'string' ? Buffer.from(chunk) : chunk;
		hash.update(buf);
		bytes += buf.byteLength;
		if (bytes > maxBodyBytes) {
			overrunError = new Error(`download body exceeded ${maxBodyBytes} bytes for ${url}; aborting to defend the cache`);
			nodeStream.destroy(overrunError);
		}
	});

	try {
		await pipeline(nodeStream, fileStream);
	} catch (err) {
		if (overrunError !== null) throw overrunError;
		throw err;
	}

	return { sha256: hash.digest('hex'), bytes };
}

/** Stream a file from disk and return its sha256 without loading the whole buffer. */
export async function computeFileHash(filePath: string): Promise<string> {
	const data = await fs.readFile(filePath);
	const hasher = createHash('sha256');
	hasher.update(data);
	return hasher.digest('hex');
}
