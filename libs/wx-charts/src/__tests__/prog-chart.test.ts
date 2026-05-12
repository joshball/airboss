/**
 * End-to-end render test for the Phase D prog-chart renderer.
 *
 * Per WP test plan (Phase D forecast cluster): the prog chart is the
 * forecast counterpart to surface analysis. It composes the same isobar +
 * front + pressure-center substrate, plus an optional hazard-polygon
 * layer for forecast turbulence / icing / IFR conditions per AC 00-45H
 * Ch 5 SIGWX prog conventions. The chrome surfaces the forecast lead
 * time so a learner can read "12HR PROG VALID 2024-12-24 00Z" at a
 * glance.
 *
 * Pure: no filesystem reads. The basemap is passed in via the test seam.
 */

import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { LAYER_BAND_VALUES } from '@ab/constants';
import { describe, expect, it } from 'vitest';
import { type ProgChartSpec, renderProgChart } from '../charts/prog-chart';

const REPO_ROOT = resolve(import.meta.dirname, '..', '..', '..', '..');
const BASEMAP_PATH = resolve(REPO_ROOT, 'data', 'references', 'basemaps', 'us-states-10m.json');

const SPEC: ProgChartSpec = {
	slug: 'wx-prog-chart-test',
	type: 'prog-chart',
	title: '12hr Surface Prog',
	subtitle: 'Test fixture',
	projection: { kind: 'lambert', parallels: [33, 45], rotate: [-96, -39] },
	extent: 'conus',
	sources: {
		forecast: 'cache://prog-chart/test.json',
	},
};

const FIXTURE = {
	title: 'Test prog 12hr',
	validTimeIso: '2024-12-24T00:00:00Z',
	forecastHours: 12,
	centers: [
		{ kind: 'L', lon: -76, lat: 49, pressureMb: 988 },
		{ kind: 'H', lon: -106, lat: 38, pressureMb: 1026 },
	],
	fronts: [
		{
			kind: 'cold',
			pipSide: 'E',
			points: [
				[-76, 49],
				[-78, 44],
				[-79, 39],
				[-82, 34],
			],
		},
		{
			kind: 'warm',
			pipSide: 'N',
			points: [
				[-76, 49],
				[-72, 46],
				[-68, 43],
			],
		},
	],
	hazards: [
		{
			id: 'PROG-TURB-1',
			kind: 'turbulence',
			label: 'MOD TURB',
			rings: [
				[
					[-99, 38],
					[-91, 38],
					[-91, 45],
					[-99, 45],
					[-99, 38],
				],
			],
		},
		{
			id: 'PROG-ICE-1',
			kind: 'icing',
			label: 'MOD ICE',
			rings: [
				[
					[-86, 35],
					[-79, 35],
					[-79, 42],
					[-86, 42],
					[-86, 35],
				],
			],
		},
	],
};

describe('renderProgChart (Phase D end-to-end)', () => {
	it('renders forecast substrate + hazard polygons + chrome', async () => {
		const basemapJson = readFileSync(BASEMAP_PATH, 'utf8');
		const result = await renderProgChart({
			spec: SPEC,
			sources: { forecast: JSON.stringify(FIXTURE), basemap: basemapJson },
			basemapPath: BASEMAP_PATH,
			libraryVersion: '@ab/wx-charts@0.1.0-test',
		});
		expect(result.svg).toMatch(/^<\?xml version="1\.0" encoding="UTF-8"\?>\n<svg /);
		for (const band of LAYER_BAND_VALUES) {
			expect(result.svg).toContain(`<g class="layer-${band}"`);
		}
		// Forecast indicator + lead-time label in chrome.
		expect(result.svg).toContain('12HR SURFACE PROG'); // title is uppercased
		expect(result.svg).toContain('12HR PROG');
		// Hazard legend present.
		expect(result.svg).toContain('FORECAST HAZARDS');
		expect(result.svg).toContain('Turbulence forecast');
		expect(result.svg).toContain('Icing forecast');
		// Hazard polygons in raster overlay band carrying class suffixes.
		expect(result.svg).toContain('polygon-prog-turbulence');
		expect(result.svg).toContain('polygon-prog-icing');
		// Meta sanity.
		expect(result.meta.parser_warnings).toHaveLength(0);
		expect(result.meta.layer_counts['raster-overlay']).toBe(2);
		expect(result.meta.layer_counts['point-symbology']).toBe(2); // two centers
		expect(result.meta.drawn_pixels).toBe(0);
	});

	it('is deterministic: render twice -> same SVG bytes', async () => {
		const basemapJson = readFileSync(BASEMAP_PATH, 'utf8');
		const input = {
			spec: SPEC,
			sources: { forecast: JSON.stringify(FIXTURE), basemap: basemapJson },
			basemapPath: BASEMAP_PATH,
			libraryVersion: '@ab/wx-charts@0.1.0-test',
		};
		const a = await renderProgChart(input);
		const b = await renderProgChart(input);
		expect(a.svg).toBe(b.svg);
	});

	it('hides hazards when show_hazards disabled', async () => {
		const basemapJson = readFileSync(BASEMAP_PATH, 'utf8');
		const result = await renderProgChart({
			spec: { ...SPEC, options: { show_hazards: false } },
			sources: { forecast: JSON.stringify(FIXTURE), basemap: basemapJson },
			basemapPath: BASEMAP_PATH,
			libraryVersion: '@ab/wx-charts@0.1.0-test',
		});
		expect(result.svg).not.toContain('polygon-prog-turbulence');
		expect(result.svg).not.toContain('polygon-prog-icing');
	});

	it('rejects missing forecast source', async () => {
		const basemapJson = readFileSync(BASEMAP_PATH, 'utf8');
		await expect(
			renderProgChart({
				spec: SPEC,
				sources: { basemap: basemapJson },
				basemapPath: BASEMAP_PATH,
				libraryVersion: '@ab/wx-charts@0.1.0-test',
			}),
		).rejects.toThrow(/forecast/);
	});

	it('clips the vector-symbology layer to the CONUS union polygon', async () => {
		const basemapJson = readFileSync(BASEMAP_PATH, 'utf8');
		const result = await renderProgChart({
			spec: SPEC,
			sources: { forecast: JSON.stringify(FIXTURE), basemap: basemapJson },
			basemapPath: BASEMAP_PATH,
			libraryVersion: '@ab/wx-charts@0.1.0-test',
		});
		expect(result.svg).toMatch(/<clipPath id="conus-clip-[A-Za-z0-9_-]+">/);
		expect(result.svg).toMatch(/<g clip-path="url\(#conus-clip-[A-Za-z0-9_-]+\)">/);
	});

	it('falls back to generic right title when forecast hours absent', async () => {
		const basemapJson = readFileSync(BASEMAP_PATH, 'utf8');
		const fixtureNoHours = { ...FIXTURE, forecastHours: undefined, validTimeIso: undefined };
		const result = await renderProgChart({
			spec: SPEC,
			sources: { forecast: JSON.stringify(fixtureNoHours), basemap: basemapJson },
			basemapPath: BASEMAP_PATH,
			libraryVersion: '@ab/wx-charts@0.1.0-test',
		});
		expect(result.svg).toContain('CONUS - PROG');
	});
});
