/**
 * HTTP primitives for the source downloader: HEAD requests, redirect chasing,
 * streaming GET with sha256, and a single retry on transient errors.
 *
 * FAA / eCFR endpoints occasionally 5xx and frequently send 30x redirects to
 * the same server, so every request flows through `followRedirectsHead` first
 * and a 5-second backoff is the only retry policy.
 *
 * Hardening (cluster E):
 *   - `followRedirectsHead` enforces same-scheme (`https:`) and a hostname
 *     allowlist on every redirect hop. A 302 to a non-FAA / non-eCFR host or
 *     to plain `http:` is refused so a poisoned DNS / MITM 302 cannot swap
 *     the corpus bytes from an unauthenticated source.
 *   - `downloadOnce` caps the streamed body at `SOURCE_ACTION_LIMITS.MAX_DOWNLOAD_BYTES`
 *     and aborts cleanly on overrun so a tarpit / runaway response can't fill
 *     the cache.
 */

import { createHash } from 'node:crypto';
import { createWriteStream, mkdirSync, renameSync, unlinkSync } from 'node:fs';
import { dirname } from 'node:path';
import { Readable } from 'node:stream';
import { pipeline } from 'node:stream/promises';
import { SOURCE_ACTION_LIMITS, SOURCE_FETCH_ALLOWED_HOSTS } from '@ab/constants';
import { sleep } from '../../lib/sleep';
import { MAX_REDIRECTS, NETWORK_TIMEOUT_MS, RETRY_DELAY_MS, USER_AGENT } from './constants';

const HTTPS_SCHEME = 'https:';

export interface HeadResult {
	readonly url: string;
	readonly status: number;
	readonly contentLength: number | null;
	readonly lastModified: string | null;
	readonly etag: string | null;
}

export interface DownloadOptions {
	readonly verbose: boolean;
	readonly fetchImpl?: typeof fetch;
	/**
	 * Optional override of the per-download body cap. Tests use a tiny value to
	 * exercise the overrun path without staging hundreds of MB. Production callers
	 * leave this undefined; the default is `SOURCE_ACTION_LIMITS.MAX_DOWNLOAD_BYTES`.
	 */
	readonly maxBodyBytes?: number;
	/**
	 * Optional override of the redirect-host allowlist. Tests pass a stub so they
	 * can exercise the same-host happy path against a fake host. Production callers
	 * leave this undefined; the default is `SOURCE_FETCH_ALLOWED_HOSTS`.
	 */
	readonly allowedHosts?: readonly string[];
}

export interface DownloadOutcome {
	readonly url: string;
	readonly sha256: string;
	readonly bytes: number;
	readonly lastModified: string | null;
	readonly etag: string | null;
}

export class HttpError extends Error {
	readonly status: number;
	constructor(message: string, status: number) {
		super(message);
		this.status = status;
	}
}

export async function headRequest(
	startUrl: string,
	fetchImpl: typeof fetch = globalThis.fetch,
	allowedHosts: readonly string[] = SOURCE_FETCH_ALLOWED_HOSTS,
): Promise<HeadResult> {
	const finalUrl = await followRedirectsHead(startUrl, fetchImpl, false, allowedHosts);
	const controller = new AbortController();
	const timer = setTimeout(() => controller.abort(), NETWORK_TIMEOUT_MS);
	let response: Response;
	try {
		response = await fetchImpl(finalUrl, {
			method: 'HEAD',
			redirect: 'manual',
			signal: controller.signal,
			headers: { 'User-Agent': USER_AGENT },
		});
	} finally {
		clearTimeout(timer);
	}
	const cl = response.headers.get('content-length');
	return {
		url: finalUrl,
		status: response.status,
		contentLength: cl === null ? null : Number.parseInt(cl, 10),
		lastModified: response.headers.get('last-modified'),
		etag: response.headers.get('etag'),
	};
}

export async function downloadFile(url: string, destPath: string, opts: DownloadOptions): Promise<DownloadOutcome> {
	let attempt = 0;
	while (true) {
		attempt += 1;
		try {
			return await downloadOnce(url, destPath, opts);
		} catch (error) {
			if (attempt >= 2 || !isTransient(error)) throw error;
			if (opts.verbose) console.warn(`  transient error on ${url}, retrying in ${RETRY_DELAY_MS}ms`);
			await sleep(RETRY_DELAY_MS);
		}
	}
}

async function downloadOnce(url: string, destPath: string, opts: DownloadOptions): Promise<DownloadOutcome> {
	const fetchImpl = opts.fetchImpl ?? globalThis.fetch;
	if (typeof fetchImpl !== 'function') {
		throw new Error('no fetch implementation available in this runtime');
	}

	const allowedHosts = opts.allowedHosts ?? SOURCE_FETCH_ALLOWED_HOSTS;
	const finalUrl = await followRedirectsHead(url, fetchImpl, opts.verbose, allowedHosts);
	const controller = new AbortController();
	const timer = setTimeout(() => controller.abort(), NETWORK_TIMEOUT_MS);

	let response: Response;
	try {
		response = await fetchImpl(finalUrl, {
			signal: controller.signal,
			redirect: 'manual',
			headers: { 'User-Agent': USER_AGENT },
		});
	} finally {
		clearTimeout(timer);
	}

	if (!response.ok) {
		throw new HttpError(`HTTP ${response.status} for ${finalUrl}`, response.status);
	}

	if (response.body === null) {
		throw new Error(`response body was null for ${finalUrl}`);
	}

	mkdirSync(dirname(destPath), { recursive: true });

	// Atomic write: stream into `${destPath}.part`, then rename over the
	// destination after the pipeline completes. POSIX rename is atomic on the
	// same filesystem, so a SIGINT or network drop mid-stream leaves either
	// the prior file or no file -- never a partially-written destination.
	// Required by ADR 021.
	const partPath = `${destPath}.part`;
	const maxBodyBytes = opts.maxBodyBytes ?? SOURCE_ACTION_LIMITS.MAX_DOWNLOAD_BYTES;
	const hash = createHash('sha256');
	let bytes = 0;
	const fileStream = createWriteStream(partPath);
	const nodeStream = Readable.fromWeb(response.body as unknown as import('node:stream/web').ReadableStream);

	let overrunError: Error | null = null;
	nodeStream.on('data', (chunk: Buffer | string) => {
		const buf = typeof chunk === 'string' ? Buffer.from(chunk) : chunk;
		hash.update(buf);
		bytes += buf.byteLength;
		if (bytes > maxBodyBytes) {
			overrunError = new Error(
				`download body exceeded ${maxBodyBytes} bytes for ${finalUrl}; aborting to defend the cache`,
			);
			nodeStream.destroy(overrunError);
		}
	});

	try {
		await pipeline(nodeStream, fileStream);
		renameSync(partPath, destPath);
	} catch (err) {
		try {
			unlinkSync(partPath);
		} catch {
			// .part may not exist or may already be gone; ignore.
		}
		if (overrunError !== null) throw overrunError;
		throw err;
	}

	return {
		url: finalUrl,
		sha256: hash.digest('hex'),
		bytes,
		lastModified: response.headers.get('last-modified'),
		etag: response.headers.get('etag'),
	};
}

export async function followRedirectsHead(
	startUrl: string,
	fetchImpl: typeof fetch,
	verbose: boolean,
	allowedHosts: readonly string[] = SOURCE_FETCH_ALLOWED_HOSTS,
): Promise<string> {
	let url = startUrl;
	assertHopAllowed(url, startUrl, allowedHosts);
	for (let i = 0; i < MAX_REDIRECTS; i += 1) {
		const head = await fetchImpl(url, {
			method: 'HEAD',
			redirect: 'manual',
			headers: { 'User-Agent': USER_AGENT },
		});
		if (head.status >= 300 && head.status < 400) {
			const next = head.headers.get('location');
			if (next === null) return url;
			const nextUrl = new URL(next, url).toString();
			assertHopAllowed(nextUrl, startUrl, allowedHosts);
			url = nextUrl;
			if (verbose) console.warn(`  redirect ${head.status} -> ${url}`);
			continue;
		}
		return url;
	}
	throw new Error(`too many redirects starting at ${startUrl}`);
}

/**
 * Refuse a redirect hop that would leave the allowed scheme + host set.
 *
 * - Scheme must be `https:`. A 302 from an FAA endpoint to plain `http:` (the
 *   classic MITM downgrade vector on hotel / coffee-shop networks) is rejected.
 * - Host must be in the YAML-derived `SOURCE_FETCH_ALLOWED_HOSTS` allowlist
 *   (overridable per-call for tests). A 302 to an attacker-controlled host
 *   after a poisoned DNS response or compromised CDN edge is rejected.
 */
function assertHopAllowed(rawUrl: string, startUrl: string, allowedHosts: readonly string[]): void {
	let parsed: URL;
	try {
		parsed = new URL(rawUrl);
	} catch {
		throw new Error(`refused redirect: malformed URL ${rawUrl} starting from ${startUrl}`);
	}
	if (parsed.protocol !== HTTPS_SCHEME) {
		throw new Error(
			`refused redirect: ${parsed.protocol} is not allowed (only ${HTTPS_SCHEME}) at ${rawUrl} starting from ${startUrl}`,
		);
	}
	if (!allowedHosts.includes(parsed.hostname)) {
		throw new Error(
			`refused redirect: host ${parsed.hostname} is not in the allowlist at ${rawUrl} starting from ${startUrl}`,
		);
	}
}

function isTransient(error: unknown): boolean {
	if (error instanceof HttpError) {
		return error.status >= 500 && error.status < 600;
	}
	if (error instanceof Error) {
		const msg = error.message.toLowerCase();
		return msg.includes('timeout') || msg.includes('network') || msg.includes('socket') || error.name === 'AbortError';
	}
	return false;
}
