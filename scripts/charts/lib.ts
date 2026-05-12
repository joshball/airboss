/**
 * Shared helpers for the `bun run charts` dispatcher subcommands.
 *
 * Owns:
 *   - `chartsDir()`  -- repo path to the per-chart output root.
 *   - `cacheDir()`   -- resolves the wx subtree inside the dev cache root.
 *   - `loadSpec()`   -- read + parse a chart's spec.yaml (per-family filename).
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
import {
	chartArtifactFilename,
	chartSlugToDir,
	chartSpecFilename,
	chartsRootDir,
	resolveCacheRoot,
	WX_CHART_ARTIFACTS,
	WX_CHART_FAMILIES,
} from '@ab/constants';
import { parse as parseYaml, stringify } from 'yaml';

// Resolve the repo root relative to this file. `import.meta.url` is
// portable across Bun + vitest (whereas `import.meta.dir` is Bun-only).
const HERE = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = resolve(HERE, '..', '..');

/**
 * Backwards-compatible shim over `chartsRootDir(REPO_ROOT)`. The layout is
 * owned in `@ab/constants` per ADR 027; this helper stays so existing
 * call sites in `build.ts` / `validate.ts` / `list.ts` keep their import
 * path stable. New code should import `chartsRootDir` from `@ab/constants`
 * directly.
 */
export function chartsDir(): string {
	return chartsRootDir(REPO_ROOT);
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
	const chartDir = chartSlugToDir(REPO_ROOT, slug);
	const specPath = resolve(chartDir, chartSpecFilename(slug));
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
		chartSvgPath: resolve(chartDir, chartArtifactFilename(slug, WX_CHART_ARTIFACTS.CHART)),
		metaJsonPath: resolve(chartDir, chartArtifactFilename(slug, WX_CHART_ARTIFACTS.META)),
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

/**
 * Enumerate every chart slug present under `data/charts/wx/`, walking the
 * two production families introduced in ADR 027 PR 3:
 *
 *   reference-fixtures/<lib-slug>/spec.yaml
 *   wx-scenarios/<scenario-id>/<chart-kind>/<scenario-id>-<chart-kind>-spec.yaml
 *
 * The `mockups/` family is explicitly skipped: mockups are internal design
 * exploration owned by the agent that generated them; they are not
 * consumed by the chart-build pipeline.
 */
export function listChartSlugs(): string[] {
	const root = chartsDir();
	if (!existsSync(root)) return [];

	const slugs: string[] = [];

	// reference-fixtures/<lib-slug>/spec.yaml (flat artifact filename)
	const refRoot = resolve(root, WX_CHART_FAMILIES.REFERENCE_FIXTURES);
	if (existsSync(refRoot)) {
		for (const name of readdirSync(refRoot)) {
			const dir = resolve(refRoot, name);
			if (!statSync(dir).isDirectory()) continue;
			const slug = `${WX_CHART_FAMILIES.REFERENCE_FIXTURES}/${name}`;
			if (existsSync(resolve(dir, chartSpecFilename(slug)))) {
				slugs.push(slug);
			}
		}
	}

	// wx-scenarios/<scenario-id>/<chart-kind>/<disambiguated-spec>.yaml
	const scenariosRoot = resolve(root, WX_CHART_FAMILIES.WX_SCENARIOS);
	if (existsSync(scenariosRoot)) {
		for (const scenarioId of readdirSync(scenariosRoot)) {
			const scenarioPath = resolve(scenariosRoot, scenarioId);
			if (!statSync(scenarioPath).isDirectory()) continue;
			for (const chartKind of readdirSync(scenarioPath)) {
				const chartPath = resolve(scenarioPath, chartKind);
				if (!statSync(chartPath).isDirectory()) continue;
				const slug = `${WX_CHART_FAMILIES.WX_SCENARIOS}/${scenarioId}/${chartKind}`;
				if (existsSync(resolve(chartPath, chartSpecFilename(slug)))) {
					slugs.push(slug);
				}
			}
		}
	}

	return slugs.sort();
}
