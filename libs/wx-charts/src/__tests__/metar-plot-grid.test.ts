/**
 * End-to-end render test for the Phase C metar-plot-grid chart.
 *
 * Per the WP test plan WXC-30 ("renders for the 2024-01-13 12Z fixture")
 * + WXC-11 ("renderer is pure / no I/O"): we read the basemap + source
 * fixtures into memory once, pass them to the renderer via
 * input.sources.basemap (the test seam), and assert structural invariants
 * on the produced SVG.
 *
 * The full pixel-accurate output lives in
 * `data/charts/wx/wx-metar-plot-grid-2024-01-13-12z/chart.svg` and is
 * verified visually as part of the WP closeout.
 */

import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { LAYER_BAND_VALUES, referenceFixtureChartSlug } from '@ab/constants';
import { describe, expect, it } from 'vitest';
import { type MetarPlotGridSpec, renderMetarPlotGrid } from '../charts/metar-plot-grid';

const REPO_ROOT = resolve(import.meta.dirname, '..', '..', '..', '..');
const BASEMAP_PATH = resolve(REPO_ROOT, 'data', 'references', 'basemaps', 'us-states-10m.json');
const FIXTURE_SOURCE_PATH = resolve(
	REPO_ROOT,
	'spikes',
	'wx-charts',
	'03-metar-plot-grid',
	'data',
	'metars-2024-01-13-12z.json',
);

const SPEC: MetarPlotGridSpec = {
	slug: referenceFixtureChartSlug('metar-plot-grid', '2024-01-13-12z'),
	type: 'metar-plot-grid',
	title: 'METAR Plot',
	subtitle: '2024-01-13 12Z (Sat) -- 49 ASOS stations',
	projection: { kind: 'lambert', parallels: [33, 45], rotate: [-96, 0] },
	extent: 'conus',
	sources: {
		observations: 'cache://metar/2024-01-13-12z.json',
	},
	options: {
		collision_min_distance_px: 36,
		collision_max_iterations: 40,
		show_category_ring: true,
		show_station_model_legend: true,
		show_category_legend: true,
		temp_unit: 'F',
		source_attribution: 'IEM ASOS Archive',
	},
};

describe('renderMetarPlotGrid (Phase C end-to-end)', () => {
	it('renders the 2024-01-13 12Z fixture into a complete SVG', async () => {
		const basemapJson = readFileSync(BASEMAP_PATH, 'utf8');
		const fixtureJson = readFileSync(FIXTURE_SOURCE_PATH, 'utf8');

		const result = await renderMetarPlotGrid({
			spec: SPEC,
			sources: {
				observations: fixtureJson,
				basemap: basemapJson,
			},
			basemapPath: BASEMAP_PATH,
			libraryVersion: '@ab/wx-charts@0.1.0-test',
		});

		// Top-level SVG document.
		expect(result.svg).toMatch(/^<\?xml version="1\.0" encoding="UTF-8"\?>\n<svg /);
		expect(result.svg).toContain('width="1200"');
		// METAR plot extends below the projection box for the legend strip.
		expect(result.svg).toMatch(/height="\d{3,4}"/);

		// Every canonical layer band present.
		for (const band of LAYER_BAND_VALUES) {
			expect(result.svg).toContain(`<g class="layer-${band}"`);
		}

		// Station-model glyphs rendered.
		expect(result.svg).toContain('class="station"');
		// Title band carries the chart title (uppercased).
		expect(result.svg).toContain('METAR PLOT');
		// Library version stamped.
		expect(result.svg).toContain('@ab/wx-charts@0.1.0-test');
		// Legends rendered.
		expect(result.svg).toContain('STATION MODEL');
		expect(result.svg).toContain('FLIGHT CATEGORY');

		// Meta sanity: at least one glyph; basemap had its CONUS state count;
		// no parser warnings on the canonical fixture.
		expect(result.meta.layer_counts['point-symbology']).toBeGreaterThan(0);
		expect(result.meta.layer_counts['basemap-fill']).toBeGreaterThanOrEqual(48);
		expect(result.meta.parser_warnings).toEqual([]);
	});

	it('is pure: render twice with same inputs -> same SVG bytes', async () => {
		const basemapJson = readFileSync(BASEMAP_PATH, 'utf8');
		const fixtureJson = readFileSync(FIXTURE_SOURCE_PATH, 'utf8');
		const input = {
			spec: SPEC,
			sources: { observations: fixtureJson, basemap: basemapJson },
			basemapPath: BASEMAP_PATH,
			libraryVersion: '@ab/wx-charts@0.1.0-test',
		};
		const a = await renderMetarPlotGrid(input);
		const b = await renderMetarPlotGrid(input);
		expect(a.svg).toBe(b.svg);
	});

	it('emits a parser warning when an observation contains an unparseable wind token', async () => {
		const basemapJson = readFileSync(BASEMAP_PATH, 'utf8');
		const envelope = {
			targetTimestamp: '2024-01-13T12:00:00Z',
			observations: [
				{
					station: { icao: 'KDEN', lat: 39.8617, lon: -104.6731 },
					raw: 'KDEN 131153Z /////KT 10SM CLR M02/M19 A3015',
				},
				{
					station: { icao: 'KORD', lat: 41.978, lon: -87.9 },
					raw: 'KORD 131151Z 04007KT 10SM CLR 02/01 A2998',
				},
			],
		};
		const result = await renderMetarPlotGrid({
			spec: SPEC,
			sources: {
				observations: JSON.stringify(envelope),
				basemap: basemapJson,
			},
			basemapPath: BASEMAP_PATH,
			libraryVersion: '@ab/wx-charts@0.1.0-test',
		});
		expect(result.meta.parser_warnings.length).toBeGreaterThan(0);
		expect(result.meta.parser_warnings.some((w) => w.includes('KDEN') && w.includes('wind'))).toBe(true);
	});

	it('rejects an envelope missing the observations array', async () => {
		const basemapJson = readFileSync(BASEMAP_PATH, 'utf8');
		await expect(
			renderMetarPlotGrid({
				spec: SPEC,
				sources: {
					observations: '{"targetTimestamp": "2024-01-13T12:00:00Z"}',
					basemap: basemapJson,
				},
				basemapPath: BASEMAP_PATH,
				libraryVersion: '@ab/wx-charts@0.1.0-test',
			}),
		).rejects.toThrow();
	});
});
