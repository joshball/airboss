/**
 * End-to-end render test for the Phase A surface-analysis chart.
 *
 * Per the WP test plan WXC-10 ("renders for the 2024-12-23 12Z fixture")
 * + WXC-11 ("renderer is pure / no I/O"): we read the basemap + source
 * fixtures into memory once, pass them to the renderer via
 * input.sources.basemap (the test seam), and assert structural invariants
 * on the produced SVG.
 *
 * Snapshot baseline: a deterministic SVG scaffold check (presence of
 * every expected layer band + at least one of each symbology kind).
 * The full pixel-accurate snapshot lives in
 * `data/charts/wx/wx-surface-analysis-2024-12-23-12z/chart.svg` and is
 * verified visually as part of the WP closeout.
 */

import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { LAYER_BAND_VALUES, referenceFixtureChartSlug } from '@ab/constants';
import { describe, expect, it } from 'vitest';
import { renderSurfaceAnalysis, type SurfaceAnalysisSpec } from '../charts/surface-analysis';

const REPO_ROOT = resolve(import.meta.dirname, '..', '..', '..', '..');
const BASEMAP_PATH = resolve(REPO_ROOT, 'data', 'references', 'basemaps', 'us-states-10m.json');
const FIXTURE_SOURCE_PATH = resolve(
	REPO_ROOT,
	'spikes',
	'wx-charts',
	'01-surface-analysis',
	'data',
	'sfc-2024-12-23-12z.json',
);

const SPEC: SurfaceAnalysisSpec = {
	slug: referenceFixtureChartSlug('surface-analysis', '2024-12-23-12z'),
	type: 'surface-analysis',
	title: 'Surface Analysis',
	subtitle: '2024-12-23 12Z (Mon)',
	projection: { kind: 'lambert', parallels: [33, 45], rotate: [-96, -39] },
	extent: 'conus',
	sources: {
		fronts: 'cache://sfc-bulletin/2024-12-23-12z.json',
	},
	options: {
		station_density: 'hubs',
		isobar_interval_mb: 4,
		emphasize_every_mb: 8,
		show_h_l_markers: true,
	},
};

describe('renderSurfaceAnalysis (Phase A end-to-end)', () => {
	it('renders the 2024-12-23 12Z fixture into a complete SVG', async () => {
		const basemapJson = readFileSync(BASEMAP_PATH, 'utf8');
		const fixtureJson = readFileSync(FIXTURE_SOURCE_PATH, 'utf8');

		const result = await renderSurfaceAnalysis({
			spec: SPEC,
			sources: {
				fronts: fixtureJson,
				// Test seam: pass the basemap in-memory so the renderer
				// short-circuits the lazy node:fs reader.
				basemap: basemapJson,
			},
			basemapPath: BASEMAP_PATH,
			libraryVersion: '@ab/wx-charts@0.1.0-test',
		});

		// Top-level SVG document.
		expect(result.svg).toMatch(/^<\?xml version="1\.0" encoding="UTF-8"\?>\n<svg /);
		expect(result.svg).toContain('width="1200"');
		expect(result.svg).toContain('height="780"');

		// Every canonical layer band present, in order.
		for (const band of LAYER_BAND_VALUES) {
			expect(result.svg).toContain(`<g class="layer-${band}"`);
		}

		// Symbology produced visible content.
		expect(result.svg).toContain('class="front-cold"');
		expect(result.svg).toContain('class="front-warm"');
		expect(result.svg).toContain('class="pressure-center'); // H or L variant
		expect(result.svg).toContain('SURFACE ANALYSIS');
		expect(result.svg).toContain('@ab/wx-charts@0.1.0-test');

		// Meta sanity.
		expect(result.meta.parser_warnings).toHaveLength(0);
		expect(result.meta.layer_counts['vector-symbology']).toBeGreaterThan(0);
		expect(result.meta.layer_counts['point-symbology']).toBeGreaterThan(0);
		expect(result.meta.layer_counts['basemap-fill']).toBeGreaterThanOrEqual(48);
	});

	it('is pure: render twice with same inputs -> same SVG bytes', async () => {
		const basemapJson = readFileSync(BASEMAP_PATH, 'utf8');
		const fixtureJson = readFileSync(FIXTURE_SOURCE_PATH, 'utf8');
		const input = {
			spec: SPEC,
			sources: { fronts: fixtureJson, basemap: basemapJson },
			basemapPath: BASEMAP_PATH,
			libraryVersion: '@ab/wx-charts@0.1.0-test',
		};
		const a = await renderSurfaceAnalysis(input);
		const b = await renderSurfaceAnalysis(input);
		expect(a.svg).toBe(b.svg);
	});

	it('rejects a fronts source missing the required centers/fronts fields', async () => {
		const basemapJson = readFileSync(BASEMAP_PATH, 'utf8');
		await expect(
			renderSurfaceAnalysis({
				spec: SPEC,
				sources: { fronts: '{"centers": []}', basemap: basemapJson },
				basemapPath: BASEMAP_PATH,
				libraryVersion: '@ab/wx-charts@0.1.0-test',
			}),
		).rejects.toThrow();
	});
});
