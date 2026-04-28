/**
 * HTTP primitives for the source downloader: HEAD requests, redirect chasing,
 * streaming GET with sha256, and a single retry on transient errors.
 *
 * FAA / eCFR endpoints occasionally 5xx and frequently send 30x redirects to
 * the same server, so every request flows through `followRedirectsHead` first
 * and a 5-second backoff is the only retry policy.
 */

import { createHash } from 'node:crypto';
import { createWriteStream, mkdirSync } from 'node:fs';
import { dirname } from 'node:path';
import { Readable } from 'node:stream';
import { pipeline } from 'node:stream/promises';
import { sleep } from '../../lib/sleep';
import { MAX_REDIRECTS, NETWORK_TIMEOUT_MS, RETRY_DELAY_MS, USER_AGENT } from './constants';

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

export async function headRequest(startUrl: string, fetchImpl: typeof fetch = globalThis.fetch): Promise<HeadResult> {
	const finalUrl = await followRedirectsHead(startUrl, fetchImpl, false);
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

	const finalUrl = await followRedirectsHead(url, fetchImpl, opts.verbose);
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

	const hash = createHash('sha256');
	let bytes = 0;
	const fileStream = createWriteStream(destPath);
	const nodeStream = Readable.fromWeb(response.body as unknown as import('node:stream/web').ReadableStream);

	nodeStream.on('data', (chunk: Buffer | string) => {
		const buf = typeof chunk === 'string' ? Buffer.from(chunk) : chunk;
		hash.update(buf);
		bytes += buf.byteLength;
	});

	await pipeline(nodeStream, fileStream);

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
): Promise<string> {
	let url = startUrl;
	for (let i = 0; i < MAX_REDIRECTS; i += 1) {
		const head = await fetchImpl(url, {
			method: 'HEAD',
			redirect: 'manual',
			headers: { 'User-Agent': USER_AGENT },
		});
		if (head.status >= 300 && head.status < 400) {
			const next = head.headers.get('location');
			if (next === null) return url;
			url = new URL(next, url).toString();
			if (verbose) console.warn(`  redirect ${head.status} -> ${url}`);
			continue;
		}
		return url;
	}
	throw new Error(`too many redirects starting at ${startUrl}`);
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
