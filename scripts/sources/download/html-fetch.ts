/**
 * HTML download path used by the AIM section + appendix downloader.
 *
 * Same retry / atomic-write / sha256 semantics as the PDF path in `http.ts`,
 * with one extra check: the response Content-Type must be `text/html` (or a
 * `text/html; charset=...` variant). Anything else is an error -- the
 * publisher silently switching the URL to a 200 OK redirect page is the
 * failure mode we want to catch loudly.
 */

import { createHash } from 'node:crypto';
import { createWriteStream, mkdirSync, unlinkSync } from 'node:fs';
import { dirname } from 'node:path';
import { Readable } from 'node:stream';
import { pipeline } from 'node:stream/promises';
import { SOURCE_ACTION_LIMITS } from '@ab/constants';
import { sleep } from '../../lib/sleep';
import { NETWORK_TIMEOUT_MS, RETRY_DELAY_MS, USER_AGENT } from './constants';
import {
	assertAllowedHost,
	BodyTooLargeError,
	type DownloadOutcome,
	followRedirectsHead,
	HostPolicyError,
	HttpError,
} from './http';

export interface HtmlDownloadOptions {
	readonly verbose: boolean;
	readonly fetchImpl?: typeof fetch;
}

export async function downloadHtmlFile(
	url: string,
	destPath: string,
	opts: HtmlDownloadOptions,
): Promise<DownloadOutcome> {
	let attempt = 0;
	while (true) {
		attempt += 1;
		try {
			return await downloadHtmlOnce(url, destPath, opts);
		} catch (error) {
			if (attempt >= 2 || !isTransient(error)) throw error;
			if (opts.verbose) console.warn(`  transient error on ${url}, retrying in ${RETRY_DELAY_MS}ms`);
			await sleep(RETRY_DELAY_MS);
		}
	}
}

async function downloadHtmlOnce(url: string, destPath: string, opts: HtmlDownloadOptions): Promise<DownloadOutcome> {
	const fetchImpl = opts.fetchImpl ?? globalThis.fetch;
	if (typeof fetchImpl !== 'function') {
		throw new Error('no fetch implementation available in this runtime');
	}

	assertAllowedHost(url);
	const finalUrl = await followRedirectsHead(url, fetchImpl, opts.verbose);
	const controller = new AbortController();
	const timer = setTimeout(() => controller.abort(), NETWORK_TIMEOUT_MS);

	let response: Response;
	try {
		response = await fetchImpl(finalUrl, {
			signal: controller.signal,
			redirect: 'manual',
			// FAA returns 406 for `Accept: text/html` on some HTML files (chap0_info_eoc.html,
			// some appendices). Use `*/*` to match curl's default behavior, then validate the
			// returned Content-Type ourselves below.
			headers: { 'User-Agent': USER_AGENT, Accept: '*/*' },
		});
	} finally {
		clearTimeout(timer);
	}

	if (!response.ok) {
		throw new HttpError(`HTTP ${response.status} for ${finalUrl}`, response.status);
	}

	const contentType = response.headers.get('content-type') ?? '';
	const ctLower = contentType.toLowerCase().split(';')[0]?.trim() ?? '';
	if (ctLower !== 'text/html') {
		throw new Error(`html-fetch: unexpected Content-Type "${contentType}" for ${finalUrl} (expected text/html)`);
	}

	if (response.body === null) {
		throw new Error(`response body was null for ${finalUrl}`);
	}

	mkdirSync(dirname(destPath), { recursive: true });

	const hash = createHash('sha256');
	let bytes = 0;
	const fileStream = createWriteStream(destPath);
	const nodeStream = Readable.fromWeb(response.body as unknown as import('node:stream/web').ReadableStream);

	const cap = SOURCE_ACTION_LIMITS.MAX_DOWNLOAD_BYTES;
	let cappedError: BodyTooLargeError | null = null;
	nodeStream.on('data', (chunk: Buffer | string) => {
		const buf = typeof chunk === 'string' ? Buffer.from(chunk) : chunk;
		hash.update(buf);
		bytes += buf.byteLength;
		if (bytes > cap && cappedError === null) {
			cappedError = new BodyTooLargeError(finalUrl, cap);
			nodeStream.destroy(cappedError);
		}
	});

	try {
		await pipeline(nodeStream, fileStream);
	} catch (error) {
		try {
			unlinkSync(destPath);
		} catch {
			// File may not have been created; ignore.
		}
		if (cappedError !== null) throw cappedError;
		throw error;
	}

	return {
		url: finalUrl,
		sha256: hash.digest('hex'),
		bytes,
		lastModified: response.headers.get('last-modified'),
		etag: response.headers.get('etag'),
	};
}

function isTransient(error: unknown): boolean {
	if (error instanceof HostPolicyError) return false;
	if (error instanceof BodyTooLargeError) return false;
	if (error instanceof HttpError) {
		return error.status >= 500 && error.status < 600;
	}
	if (error instanceof Error) {
		const msg = error.message.toLowerCase();
		return msg.includes('timeout') || msg.includes('network') || msg.includes('socket') || error.name === 'AbortError';
	}
	return false;
}
