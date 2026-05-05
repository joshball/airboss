// @browser-globals: server-only -- never imported by client .svelte
/**
 * Phase 3 -- source cache for the eCFR Versioner XML.
 *
 * Source of truth: ADR 021 (cache flat naming) + STORAGE.md. The cache root is
 * `$AIRBOSS_HANDBOOK_CACHE` (default `~/Documents/airboss-handbook-cache/`).
 * Cache layout: `<root>/regulations/cfr-<title>/<YYYY-MM-DD>.xml` for full
 * titles, or `<root>/regulations/cfr-<title>/<YYYY-MM-DD>-parts-<filter>.xml`
 * for filtered fetches.
 *
 * The cache is read-through: the first ingestion run for an edition fetches
 * the XML from the eCFR Versioner endpoint and writes it to the cache; later
 * runs read from the cache directly. Re-fetching is automatic only when the
 * cache file is missing.
 *
 * Hardening (cluster E): the network branch streams the response body and
 * caps it at `SOURCE_ACTION_LIMITS.MAX_DOWNLOAD_BYTES` so a poisoned eCFR
 * endpoint cannot exhaust developer disk via a runaway response. The fetch
 * implementation may expose a `body` stream + `headers.get('content-length')`
 * (the global `fetch` does); the test seam continues to work via the simpler
 * `text()` shape, but with a post-fetch byte-length check that fails fast on
 * oversized payloads.
 */

import { createHash } from 'node:crypto';
import { existsSync, mkdirSync, readFileSync, renameSync, unlinkSync, writeFileSync } from 'node:fs';
import { dirname, isAbsolute, join, resolve } from 'node:path';
import { Readable } from 'node:stream';
import { resolveCacheRoot as resolveSourceCacheRoot, SOURCE_ACTION_LIMITS, SOURCE_CACHE } from '@ab/constants';

const ECFR_BASE = 'https://www.ecfr.gov/api/versioner/v1/full';

export interface CacheLoadResult {
	readonly xml: string;
	readonly sourceUrl: string;
	readonly sourceSha256: string;
}

/**
 * Minimal response shape used by the cache. Compatible with the global
 * `fetch` `Response` (every test `fetchImpl` need only implement `ok`, `status`,
 * and `text()` to keep the existing seam green; production callers get the
 * extra `headers` + `body` for the streaming + size-cap path).
 */
export interface CacheFetchResponse {
	readonly ok: boolean;
	readonly status: number;
	readonly text: () => Promise<string>;
	readonly headers?: { get(name: string): string | null };
	readonly body?: ReadableStream<Uint8Array> | null;
}

export interface CacheLoadOptions {
	readonly title: '14' | '49';
	readonly editionDate: string; // YYYY-MM-DD
	/** When set, additional `?part=` filter applied to the eCFR Versioner request. */
	readonly partFilter?: ReadonlySet<string>;
	/** When set, read from this fixture file instead of cache or network. */
	readonly fixturePath?: string;
	/**
	 * Optional override of the network fetch. Tests pass a stub; production
	 * uses the global `fetch` builtin.
	 */
	readonly fetchImpl?: (url: string) => Promise<CacheFetchResponse>;
	/** Optional override of the per-download body cap. Tests use a tiny value to exercise overrun. */
	readonly maxBodyBytes?: number;
}

/**
 * Resolve the cache root. Honors the `AIRBOSS_HANDBOOK_CACHE` env var; defaults
 * to `~/Documents/airboss-handbook-cache/`. Creates the directory on demand.
 *
 * Thin wrapper around the canonical helper in `@ab/constants` so existing
 * `@ab/sources` consumers keep their import path.
 */
export function resolveCacheRoot(): string {
	return resolveSourceCacheRoot();
}

/** Build the full cache path for a given title + edition date. */
export function cacheXmlPath(title: '14' | '49', editionDate: string, partFilter?: ReadonlySet<string>): string {
	const root = resolveCacheRoot();
	const filename =
		partFilter === undefined || partFilter.size === 0
			? `${editionDate}.xml`
			: `${editionDate}-parts-${[...partFilter].sort().join('-')}.xml`;
	return join(root, SOURCE_CACHE.REGS, `cfr-${title}`, filename);
}

/**
 * Load the XML for a given title + edition. Resolution order:
 *
 *   1. `fixturePath` is set -> read fixture, hash, return.
 *   2. Cache file exists -> read, hash, return.
 *   3. Otherwise -> fetch from eCFR Versioner, write to cache, return.
 *
 * The returned `sourceUrl` is `file://...` for fixture / cache reads; for
 * network fetches it is the canonical eCFR Versioner URL.
 */
export async function loadEcfrXml(opts: CacheLoadOptions): Promise<CacheLoadResult> {
	if (opts.fixturePath !== undefined) {
		const path = isAbsolute(opts.fixturePath) ? opts.fixturePath : resolve(opts.fixturePath);
		const xml = readFileSync(path, 'utf-8');
		return {
			xml,
			sourceUrl: `file://${path}`,
			sourceSha256: sha256(xml),
		};
	}

	const cachePath = cacheXmlPath(opts.title, opts.editionDate, opts.partFilter);
	if (existsSync(cachePath)) {
		const xml = readFileSync(cachePath, 'utf-8');
		return {
			xml,
			sourceUrl: `file://${cachePath}`,
			sourceSha256: sha256(xml),
		};
	}

	const url = buildEcfrUrl(opts);
	const fetchImpl = opts.fetchImpl ?? globalThis.fetch;
	if (typeof fetchImpl !== 'function') {
		throw new Error('eCFR fetch unavailable: no fetch implementation in this runtime');
	}

	const response = await fetchImpl(url);
	if (!response.ok) {
		throw new Error(`eCFR Versioner returned ${response.status} for ${url}`);
	}

	const maxBodyBytes = opts.maxBodyBytes ?? SOURCE_ACTION_LIMITS.MAX_DOWNLOAD_BYTES;

	// Early reject by Content-Length when the server provides one. Catches the
	// "10 GB tarpit" case before we read any bytes.
	const contentLengthHeader = response.headers?.get?.('content-length') ?? null;
	if (contentLengthHeader !== null) {
		const declared = Number.parseInt(contentLengthHeader, 10);
		if (Number.isFinite(declared) && declared > maxBodyBytes) {
			throw new Error(
				`eCFR response Content-Length ${declared} exceeds cap ${maxBodyBytes} for ${url}; refusing to download`,
			);
		}
	}

	const xml = await readBoundedBody(response, maxBodyBytes, url);

	writeAtomic(cachePath, xml);

	return {
		xml,
		sourceUrl: url,
		sourceSha256: sha256(xml),
	};
}

/**
 * Write `content` to `path` atomically: write to `<path>.tmp`, then rename
 * over the destination. POSIX rename is atomic on the same filesystem, so a
 * SIGINT or process kill mid-write leaves either the prior file or no file --
 * never a half-written destination. Required by ADR 021.
 */
function writeAtomic(path: string, content: string): void {
	mkdirSync(dirname(path), { recursive: true });
	const tmp = `${path}.tmp`;
	try {
		writeFileSync(tmp, content, 'utf-8');
		renameSync(tmp, path);
	} catch (err) {
		try {
			unlinkSync(tmp);
		} catch {
			// tmp may not exist; ignore.
		}
		throw err;
	}
}

/**
 * Read the response body up to `maxBodyBytes`. Streams when `response.body`
 * is set (production global `fetch`); falls back to `text()` for the test
 * seam (which then verifies the post-decode byte length).
 */
async function readBoundedBody(response: CacheFetchResponse, maxBodyBytes: number, url: string): Promise<string> {
	if (response.body !== undefined && response.body !== null) {
		const chunks: Buffer[] = [];
		let bytes = 0;
		const stream = Readable.fromWeb(response.body as unknown as import('node:stream/web').ReadableStream);
		try {
			for await (const chunk of stream) {
				const buf = typeof chunk === 'string' ? Buffer.from(chunk) : (chunk as Buffer);
				bytes += buf.byteLength;
				if (bytes > maxBodyBytes) {
					stream.destroy();
					throw new Error(`eCFR response body exceeded ${maxBodyBytes} bytes for ${url}; aborting`);
				}
				chunks.push(buf);
			}
		} catch (err) {
			if (err instanceof Error && err.message.includes('exceeded')) throw err;
			throw err;
		}
		return Buffer.concat(chunks).toString('utf-8');
	}

	const xml = await response.text();
	const bytes = Buffer.byteLength(xml, 'utf-8');
	if (bytes > maxBodyBytes) {
		throw new Error(`eCFR response body exceeded ${maxBodyBytes} bytes for ${url}; refusing to cache`);
	}
	return xml;
}

function buildEcfrUrl(opts: CacheLoadOptions): string {
	const base = `${ECFR_BASE}/${opts.editionDate}/title-${opts.title}.xml`;
	if (opts.partFilter === undefined || opts.partFilter.size === 0) return base;
	const params = new URLSearchParams();
	for (const part of opts.partFilter) {
		params.append('part', part);
	}
	return `${base}?${params.toString()}`;
}

export function sha256(input: string): string {
	return createHash('sha256').update(input, 'utf-8').digest('hex');
}

// Test-only helpers
export const __cache_internal__ = {
	buildEcfrUrl,
	writeAtomic,
};
