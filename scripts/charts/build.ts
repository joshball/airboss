/**
 * `bun run charts build <slug>` and `bun run charts build --all`.
 *
 * Reads `data/charts/wx/<slug>/spec.yaml`, validates against the per-type
 * Zod schema from `CHART_RENDERERS`, resolves source bytes from the dev
 * cache + repo, computes the content hash, and either re-renders + writes
 * (`built`) or short-circuits (`unchanged`) when the hash matches the
 * existing `meta.json.content_hash`.
 *
 * Idempotency is the contract: re-run with no spec / source change should
 * produce zero file writes (verified by mtime + git diff).
 */

import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import {
	CHART_TYPE_VALUES,
	type ChartType,
	WX_CHART_SVG_HARD_LIMIT_BYTES,
	WX_CHART_SVG_WARN_BYTES,
} from '@ab/constants';
import { CHART_RENDERERS } from '@ab/wx-charts/server';
import {
	computeContentHash,
	defaultBasemapPath,
	getLibraryVersion,
	type LoadedSpec,
	listChartSlugs,
	loadSpec,
	type ResolvedSource,
	readSourceBytesByKey,
} from './lib';

interface BuildResult {
	slug: string;
	status: 'built' | 'unchanged' | 'failed';
	message?: string;
	durationMs: number;
}

interface ExistingMeta {
	content_hash?: string;
	library_version?: string;
}

export async function runBuild(args: readonly string[]): Promise<void> {
	if (args.length === 0) {
		console.error('charts build: missing slug. Usage: bun run charts build <slug> | --all');
		process.exit(2);
	}
	const all = args[0] === '--all';
	const slugs = all ? listChartSlugs() : [args[0]];
	if (slugs.length === 0) {
		console.log('charts build: no charts found under data/charts/wx/.');
		return;
	}

	let failures = 0;
	for (const slug of slugs) {
		const result = await buildOne(slug);
		printResult(result);
		if (result.status === 'failed') failures += 1;
	}
	if (failures > 0) process.exit(1);
}

async function buildOne(slug: string): Promise<BuildResult> {
	const start = performance.now();
	let spec: LoadedSpec;
	try {
		spec = loadSpec(slug);
	} catch (err) {
		return {
			slug,
			status: 'failed',
			message: err instanceof Error ? err.message : String(err),
			durationMs: performance.now() - start,
		};
	}

	const type = spec.specObject.type;
	if (!(CHART_TYPE_VALUES as readonly string[]).includes(type)) {
		return {
			slug,
			status: 'failed',
			message: `unknown chart type '${type}'. Legal: ${CHART_TYPE_VALUES.join(', ')}.`,
			durationMs: performance.now() - start,
		};
	}
	const registration = CHART_RENDERERS[type as ChartType];

	// Spec-shape validation -- per-type Zod schema.
	let parsedSpec: unknown;
	try {
		parsedSpec = registration.schema.parse(spec.specObject);
	} catch (err) {
		return {
			slug,
			status: 'failed',
			message: `spec validation failed: ${err instanceof Error ? err.message : String(err)}`,
			durationMs: performance.now() - start,
		};
	}
	if (parsedSpec === null || parsedSpec === undefined) {
		return {
			slug,
			status: 'failed',
			message: 'spec validation returned no parsed value',
			durationMs: performance.now() - start,
		};
	}

	// Slug-shape + dir-name match guard.
	if (spec.specObject.slug !== slug) {
		return {
			slug,
			status: 'failed',
			message: `spec.slug '${spec.specObject.slug}' does not match directory name '${slug}'`,
			durationMs: performance.now() - start,
		};
	}

	// Resolve source bytes.
	let sources: ResolvedSource[];
	try {
		sources = readSourceBytesByKey(spec);
	} catch (err) {
		return {
			slug,
			status: 'failed',
			message: err instanceof Error ? err.message : String(err),
			durationMs: performance.now() - start,
		};
	}

	const libraryVersion = getLibraryVersion();
	const { contentHash, sourceHashes } = computeContentHash({
		specObject: spec.specObject,
		sources,
		libraryVersion,
	});

	// Idempotency check.
	if (existsSync(spec.metaJsonPath)) {
		const existing = JSON.parse(readFileSync(spec.metaJsonPath, 'utf8')) as ExistingMeta;
		if (existing.content_hash === contentHash && existsSync(spec.chartSvgPath)) {
			return {
				slug,
				status: 'unchanged',
				durationMs: performance.now() - start,
			};
		}
	}

	// Render.
	const sourcesByKey: Record<string, Uint8Array | string> = {};
	for (const s of sources) sourcesByKey[s.key] = s.bytes;
	let render: Awaited<ReturnType<(typeof registration)['render']>>;
	try {
		render = await registration.render({
			spec: parsedSpec as never,
			sources: sourcesByKey,
			basemapPath: defaultBasemapPath(),
			libraryVersion,
		});
	} catch (err) {
		return {
			slug,
			status: 'failed',
			message: `render failed: ${err instanceof Error ? err.message : String(err)}`,
			durationMs: performance.now() - start,
		};
	}

	const svgBytes = Buffer.byteLength(render.svg, 'utf8');
	if (svgBytes > WX_CHART_SVG_HARD_LIMIT_BYTES) {
		return {
			slug,
			status: 'failed',
			message: `chart.svg would exceed 5 MB hard limit; aborting`,
			durationMs: performance.now() - start,
		};
	}
	const sizeWarning = svgBytes > WX_CHART_SVG_WARN_BYTES ? ` (warn: ${svgBytes} B exceeds 500 KB)` : '';

	const meta = {
		slug,
		type,
		library_version: libraryVersion,
		built_at: new Date().toISOString(),
		content_hash: contentHash,
		source_hashes: sourceHashes,
		layer_counts: render.meta.layer_counts,
		drawn_pixels: render.meta.drawn_pixels,
		parser_warnings: render.meta.parser_warnings,
		svg_bytes: svgBytes,
	};

	writeFileSync(spec.chartSvgPath, render.svg, 'utf8');
	writeFileSync(spec.metaJsonPath, `${JSON.stringify(meta, null, 2)}\n`, 'utf8');

	return {
		slug,
		status: 'built',
		message: sizeWarning.length > 0 ? sizeWarning : undefined,
		durationMs: performance.now() - start,
	};
}

function printResult(r: BuildResult): void {
	const ms = r.durationMs.toFixed(0);
	const tag = r.status.padEnd(9);
	const trailer = r.message !== undefined ? ` -- ${r.message}` : '';
	console.log(`[${tag}] ${r.slug}  (${ms} ms)${trailer}`);
}
