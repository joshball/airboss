/**
 * End-to-end render test for the Phase B radar-mosaic chart.
 *
 * Per WP test plan WXC-20 ("renders for the 2024-05-21 22Z fixture") +
 * idempotency. The test reads the IEM PNG + worldfile + basemap from
 * the dev cache and the substrate, then asserts structural invariants on
 * the produced SVG plus stable byte output across two renders with the
 * same inputs.
 *
 * Skips automatically when the dev-cache fixture is absent (CI envs that
 * have not run the manual capture step). The fixture is committed
 * alongside the chart at `data/charts/wx/wx-radar-mosaic-2024-05-21-22z/`.
 */

import { existsSync, readFileSync } from 'node:fs';
import { homedir } from 'node:os';
import { resolve } from 'node:path';
import { LAYER_BAND_VALUES, referenceFixtureChartSlug } from '@ab/constants';
import { describe, expect, it } from 'vitest';
import { type RadarMosaicSpec, renderRadarMosaic } from '../charts/radar-mosaic';

const REPO_ROOT = resolve(import.meta.dirname, '..', '..', '..', '..');
const BASEMAP_PATH = resolve(REPO_ROOT, 'data', 'references', 'basemaps', 'us-states-10m.json');
const CACHE_ROOT = process.env.AIRBOSS_HANDBOOK_CACHE ?? resolve(homedir(), 'Documents', 'airboss-handbook-cache');
const RADAR_PNG_PATH = resolve(CACHE_ROOT, 'wx', 'radar', 'n0r_202405212200.png');
const RADAR_WLD_PATH = resolve(CACHE_ROOT, 'wx', 'radar', 'n0r_202405212200.wld');

const SPEC: RadarMosaicSpec = {
	slug: referenceFixtureChartSlug('radar-mosaic', '2024-05-21-22z'),
	type: 'radar-mosaic',
	title: 'Radar Mosaic',
	subtitle: '2024-05-21 22:00Z -- NEXRAD composite reflectivity',
	projection: { kind: 'lambert', parallels: [33, 45], rotate: [-96, 0] },
	extent: 'conus',
	sources: {
		radar_png: 'cache://radar/n0r_202405212200.png',
		radar_world: 'cache://radar/n0r_202405212200.wld',
	},
	options: {
		raster_opacity: 0.78,
		show_airports: true,
		show_legend: true,
		source_bounds: { lon_min: -126, lon_max: -66, lat_min: 24, lat_max: 50 },
	},
};

const fixturesPresent = existsSync(RADAR_PNG_PATH) && existsSync(RADAR_WLD_PATH) && existsSync(BASEMAP_PATH);

describe.skipIf(!fixturesPresent)('renderRadarMosaic (Phase B end-to-end)', () => {
	it('renders the 2024-05-21 22Z fixture into a complete SVG', async () => {
		const basemapJson = readFileSync(BASEMAP_PATH, 'utf8');
		const radarPng = readFileSync(RADAR_PNG_PATH);
		const radarWld = readFileSync(RADAR_WLD_PATH, 'utf8');

		const result = await renderRadarMosaic({
			spec: SPEC,
			sources: {
				radar_png: new Uint8Array(radarPng),
				radar_world: radarWld,
				basemap: basemapJson,
			},
			basemapPath: BASEMAP_PATH,
			libraryVersion: '@ab/wx-charts@0.1.0-test',
		});

		// Top-level SVG document.
		expect(result.svg).toMatch(/^<\?xml version="1\.0" encoding="UTF-8"\?>\n<svg /);
		expect(result.svg).toContain('width="1200"');
		expect(result.svg).toContain('height="780"');

		// Every canonical layer band present.
		for (const band of LAYER_BAND_VALUES) {
			expect(result.svg).toContain(`<g class="layer-${band}"`);
		}

		// Raster + chrome content present.
		expect(result.svg).toContain('href="data:image/png;base64,');
		expect(result.svg).toContain('RADAR MOSAIC');
		expect(result.svg).toContain('REFLECTIVITY (dBZ)');
		expect(result.svg).toContain('@ab/wx-charts@0.1.0-test');
		// Airports rendered.
		expect(result.svg).toContain('class="airport-marker"');

		// Meta sanity.
		expect(result.meta.parser_warnings).toHaveLength(0);
		expect(result.meta.layer_counts['raster-overlay']).toBe(1);
		expect(result.meta.layer_counts['point-symbology']).toBe(12);
		expect(result.meta.layer_counts['basemap-fill']).toBeGreaterThanOrEqual(48);
		expect(result.meta.drawn_pixels).toBeGreaterThan(1000);
	});

	it('is deterministic: render twice with same inputs -> same SVG bytes', async () => {
		const basemapJson = readFileSync(BASEMAP_PATH, 'utf8');
		const radarPng = readFileSync(RADAR_PNG_PATH);
		const radarWld = readFileSync(RADAR_WLD_PATH, 'utf8');
		const input = {
			spec: SPEC,
			sources: {
				radar_png: new Uint8Array(radarPng),
				radar_world: radarWld,
				basemap: basemapJson,
			},
			basemapPath: BASEMAP_PATH,
			libraryVersion: '@ab/wx-charts@0.1.0-test',
		};
		const a = await renderRadarMosaic(input);
		const b = await renderRadarMosaic(input);
		expect(a.svg).toBe(b.svg);
	});

	it('rejects missing required sources', async () => {
		const basemapJson = readFileSync(BASEMAP_PATH, 'utf8');
		await expect(
			renderRadarMosaic({
				spec: SPEC,
				sources: { basemap: basemapJson },
				basemapPath: BASEMAP_PATH,
				libraryVersion: '@ab/wx-charts@0.1.0-test',
			}),
		).rejects.toThrow(/radar_png/);
	});
});
