/**
 * Phase 3 -- source cache for the eCFR Versioner XML.
 *
 * Source of truth: ADR 018 (storage policy) + STORAGE.md. The cache root is
 * `$AIRBOSS_HANDBOOK_CACHE` (default `~/Documents/airboss-handbook-cache/`).
 * Cache layout: `<root>/regulations/cfr-<title>/<YYYY-MM-DD>/source.xml`.
 *
 * The cache is read-through: the first ingestion run for an edition fetches
 * the XML from the eCFR Versioner endpoint and writes it to the cache; later
 * runs read from the cache directly. Re-fetching is automatic only when the
 * cache file is missing.
 */

import { createHash } from 'node:crypto';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { homedir } from 'node:os';
import { dirname, isAbsolute, join, resolve } from 'node:path';

const ECFR_BASE = 'https://www.ecfr.gov/api/versioner/v1/full';

export interface CacheLoadResult {
	readonly xml: string;
	readonly sourceUrl: string;
	readonly sourceSha256: string;
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
	readonly fetchImpl?: (url: string) => Promise<{ ok: boolean; status: number; text: () => Promise<string> }>;
}

/**
 * Resolve the cache root. Honors the `AIRBOSS_HANDBOOK_CACHE` env var; defaults
 * to `~/Documents/airboss-handbook-cache/`. Creates the directory on demand.
 */
export function resolveCacheRoot(): string {
	const fromEnv = process.env.AIRBOSS_HANDBOOK_CACHE;
	const root =
		fromEnv !== undefined && fromEnv.length > 0
			? expandHome(fromEnv)
			: join(homedir(), 'Documents', 'airboss-handbook-cache');
	if (!existsSync(root)) {
		mkdirSync(root, { recursive: true });
	}
	return root;
}

/** Build the full cache path for a given title + edition date. */
export function cacheXmlPath(title: '14' | '49', editionDate: string, partFilter?: ReadonlySet<string>): string {
	const root = resolveCacheRoot();
	const partSlug = partFilter !== undefined ? `parts-${[...partFilter].sort().join('-')}` : 'full';
	return join(root, 'regulations', `cfr-${title}`, editionDate, `${partSlug}.xml`);
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
	const xml = await response.text();

	mkdirSync(dirname(cachePath), { recursive: true });
	writeFileSync(cachePath, xml, 'utf-8');

	return {
		xml,
		sourceUrl: url,
		sourceSha256: sha256(xml),
	};
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

function expandHome(p: string): string {
	if (p.startsWith('~/')) return join(homedir(), p.slice(2));
	if (p === '~') return homedir();
	return p;
}

// Test-only helpers
export const __cache_internal__ = {
	buildEcfrUrl,
};
