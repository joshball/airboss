/**
 * Shared helpers for the `bun run charts` dispatcher subcommands.
 *
 * Owns:
 *   - `chartsDir()`  -- repo path to the per-chart output root.
 *   - `cacheDir()`   -- resolves the wx subtree inside the dev cache root.
 *   - `loadSpec()`   -- read + parse a chart's spec.yaml.
 *   - `resolveSourceBytes()` -- map `cache://...` URIs and repo-relative
 *     paths to byte buffers.
 *   - `computeContentHash()` -- canonical hash of (spec.yaml + source bytes
 *     + library_version) used for the idempotency check.
 *   - `getLibraryVersion()` -- read libs/wx-charts/package.json once.
 */

import { createHash } from 'node:crypto';
import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { resolveCacheRoot } from '@ab/constants';
import { parse as parseYaml, stringify } from 'yaml';

// Resolve the repo root relative to this file. `import.meta.url` is
// portable across Bun + vitest (whereas `import.meta.dir` is Bun-only).
const HERE = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = resolve(HERE, '..', '..');

export function chartsDir(): string {
	return resolve(REPO_ROOT, 'data', 'charts', 'wx');
}

export function defaultBasemapPath(): string {
	return resolve(REPO_ROOT, 'data', 'references', 'basemaps', 'us-states-10m.json');
}

export function cacheWxRoot(): string {
	return resolve(resolveCacheRoot({ ensureExists: false }), 'wx');
}

export interface RawChartSpec {
	slug: string;
	type: string;
	title: string;
	subtitle?: string;
	projection: { kind: string; parallels: [number, number]; rotate: [number, number] };
	extent: unknown;
	sources: Record<string, string>;
	options?: Record<string, unknown>;
}

export interface LoadedSpec {
	slug: string;
	specPath: string;
	specYaml: string;
	specObject: RawChartSpec;
	chartDir: string;
	chartSvgPath: string;
	metaJsonPath: string;
}

export function loadSpec(slug: string): LoadedSpec {
	const chartDir = resolve(chartsDir(), slug);
	const specPath = resolve(chartDir, 'spec.yaml');
	if (!existsSync(specPath)) {
		throw new Error(`spec not found: ${specPath}`);
	}
	const specYaml = readFileSync(specPath, 'utf8');
	const specObject = parseYaml(specYaml) as RawChartSpec;
	if (specObject === null || specObject === undefined || typeof specObject !== 'object') {
		throw new Error(`spec is not a valid YAML object: ${specPath}`);
	}
	return {
		slug,
		specPath,
		specYaml,
		specObject,
		chartDir,
		chartSvgPath: resolve(chartDir, 'chart.svg'),
		metaJsonPath: resolve(chartDir, 'meta.json'),
	};
}

export interface ResolvedSource {
	key: string;
	uri: string;
	resolvedPath: string;
	bytes: Uint8Array;
}

/**
 * Resolve a `sources` URI against the cache or the repo root.
 *
 * Conventions:
 *   - `cache://<rel-path>`   -> `<cache-root>/wx/<rel-path>` (default)
 *                                Note: rel-path may already start with the
 *                                corpus name (e.g. `wx/sfc-bulletin/...`)
 *                                in which case it resolves under the cache
 *                                root directly.
 *   - `<rel-path>`           -> `<repo-root>/<rel-path>` (no scheme)
 */
export function resolveSourceUri(uri: string): string {
	if (uri.startsWith('cache://')) {
		const rest = uri.slice('cache://'.length);
		// If the URI begins with `wx/`, treat as relative to cache root.
		// Otherwise resolve under the wx subtree (the default convention).
		if (rest.startsWith('wx/')) {
			return resolve(resolveCacheRoot({ ensureExists: false }), rest);
		}
		return resolve(cacheWxRoot(), rest);
	}
	return resolve(REPO_ROOT, uri);
}

export function readSourceBytes(uri: string): { resolvedPath: string; bytes: Uint8Array } {
	const resolvedPath = resolveSourceUri(uri);
	if (!existsSync(resolvedPath)) {
		throw new Error(`source not found at ${resolvedPath}`);
	}
	const bytes = readFileSync(resolvedPath);
	return { resolvedPath, bytes: new Uint8Array(bytes) };
}

export function readSourceBytesByKey(spec: LoadedSpec): ResolvedSource[] {
	const out: ResolvedSource[] = [];
	for (const [key, uri] of Object.entries(spec.specObject.sources)) {
		const resolvedPath = resolveSourceUri(uri);
		if (!existsSync(resolvedPath)) {
			throw new Error(`source '${key}' not found at ${resolvedPath}`);
		}
		const bytes = readFileSync(resolvedPath);
		out.push({ key, uri, resolvedPath, bytes: new Uint8Array(bytes) });
	}
	return out;
}

export function sha256Hex(bytes: Uint8Array | string): string {
	const h = createHash('sha256');
	h.update(typeof bytes === 'string' ? bytes : Buffer.from(bytes));
	return h.digest('hex');
}

export function computeContentHash(args: {
	specObject: RawChartSpec;
	sources: ResolvedSource[];
	libraryVersion: string;
}): { contentHash: string; sourceHashes: Record<string, string> } {
	// Canonical YAML emit: parsed spec -> stable serialization.
	const canonicalYaml = stringify(args.specObject, { sortMapEntries: true });
	const sourceHashes: Record<string, string> = {};
	for (const s of args.sources) {
		sourceHashes[s.key] = sha256Hex(s.bytes);
	}
	const sortedKeys = Object.keys(sourceHashes).sort();
	const sortedHashList = sortedKeys.map((k) => `${k}:${sourceHashes[k]}`).join('|');
	const combined = `${canonicalYaml}\n---sources---\n${sortedHashList}\n---version---\n${args.libraryVersion}`;
	return { contentHash: `sha256:${sha256Hex(combined)}`, sourceHashes };
}

let cachedLibraryVersion: string | null = null;

export function getLibraryVersion(): string {
	if (cachedLibraryVersion !== null) return cachedLibraryVersion;
	const pkgPath = resolve(REPO_ROOT, 'libs', 'wx-charts', 'package.json');
	const raw = readFileSync(pkgPath, 'utf8');
	const pkg = JSON.parse(raw) as { name: string; version: string };
	cachedLibraryVersion = `${pkg.name}@${pkg.version}`;
	return cachedLibraryVersion;
}

export function listChartSlugs(): string[] {
	const dir = chartsDir();
	if (!existsSync(dir)) return [];
	const entries = readdirSync(dir);
	return entries
		.filter((name) => {
			const sub = resolve(dir, name);
			return statSync(sub).isDirectory() && existsSync(resolve(sub, 'spec.yaml'));
		})
		.sort();
}
