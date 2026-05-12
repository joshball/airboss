/**
 * End-to-end render test for the Phase E GTG (Graphical Turbulence
 * Guidance) chart.
 *
 * Asserts:
 *   - Renderer produces a complete SVG with every canonical layer band.
 *   - Filled severity tiers render with the canonical CSS class
 *     (`gtg-tier gtg-tier-{N}`) for each threshold above light.
 *   - Chrome carries the title + altitude band + ramp legend.
 *   - Render is deterministic (re-render -> identical SVG bytes).
 *   - Schema rejects mis-sized grids.
 *
 * Pure: no filesystem reads in the renderer path. The basemap is passed
 * in via the test seam (input.sources.basemap).
 */

import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { LAYER_BAND_VALUES } from '@ab/constants';
import { describe, expect, it } from 'vitest';
import { renderTurbulenceGtg, type TurbulenceGtgSpec } from '../charts/turbulence-gtg';

const REPO_ROOT = resolve(import.meta.dirname, '..', '..', '..', '..');
const BASEMAP_PATH = resolve(REPO_ROOT, 'data', 'references', 'basemaps', 'us-states-10m.json');

const SPEC: TurbulenceGtgSpec = {
	slug: 'wx-turbulence-gtg-test',
	type: 'turbulence-gtg',
	title: 'GTG (Graphical Turbulence Guidance)',
	subtitle: 'Test fixture',
	projection: { kind: 'lambert', parallels: [33, 45], rotate: [-96, -39] },
	extent: 'conus',
	sources: {
		intensity_grid: 'cache://gtg/test.json',
	},
	options: {
		altitude_band: 'mid',
		show_legend: true,
		show_isopleths: true,
	},
};

/**
 * Synthesize a small intensity grid with two Gaussian "bumps" so the
 * renderer has well-formed severity contours to draw. Bump A is a
 * moderate-severity feature near the central plains; bump B is a smaller
 * severe feature near the upper Midwest. Background is 0 (smooth).
 */
function buildSyntheticGrid(): {
	gridLonMin: number;
	gridLonMax: number;
	gridLatMin: number;
	gridLatMax: number;
	gridWidth: number;
	gridHeight: number;
	altitudeLabel: string;
	values: number[];
} {
	const width = 60;
	const height = 30;
	const lonMin = -125;
	const lonMax = -68;
	const latMin = 24;
	const latMax = 49;
	const values = new Array<number>(width * height).fill(0);
	const bumps: Array<{ lon: number; lat: number; amp: number; sigma: number }> = [
		{ lon: -100, lat: 38, amp: 4, sigma: 6 },
		{ lon: -89, lat: 44, amp: 5, sigma: 4 },
	];
	for (let iy = 0; iy < height; iy++) {
		const lat = latMax - (iy / (height - 1)) * (latMax - latMin);
		for (let ix = 0; ix < width; ix++) {
			const lon = lonMin + (ix / (width - 1)) * (lonMax - lonMin);
			let v = 0;
			for (const b of bumps) {
				const dLon = (lon - b.lon) * Math.cos((b.lat * Math.PI) / 180);
				const dLat = lat - b.lat;
				const distDeg = Math.hypot(dLon, dLat);
				v += b.amp * Math.exp(-(distDeg * distDeg) / (2 * b.sigma * b.sigma));
			}
			values[iy * width + ix] = v;
		}
	}
	return {
		gridLonMin: lonMin,
		gridLonMax: lonMax,
		gridLatMin: latMin,
		gridLatMax: latMax,
		gridWidth: width,
		gridHeight: height,
		altitudeLabel: 'FL240 (Mid-band sample)',
		values,
	};
}

const FIXTURE = buildSyntheticGrid();

describe('renderTurbulenceGtg (Phase E end-to-end)', () => {
	it('renders filled severity tiers with all canonical layer bands', async () => {
		const basemapJson = readFileSync(BASEMAP_PATH, 'utf8');
		const result = await renderTurbulenceGtg({
			spec: SPEC,
			sources: {
				intensity_grid: JSON.stringify(FIXTURE),
				basemap: basemapJson,
			},
			basemapPath: BASEMAP_PATH,
			libraryVersion: '@ab/wx-charts@0.1.0-test',
		});

		// Top-level SVG document.
		expect(result.svg).toMatch(/^<\?xml version="1\.0" encoding="UTF-8"\?>\n<svg /);

		// Every canonical layer band present.
		for (const band of LAYER_BAND_VALUES) {
			expect(result.svg).toContain(`<g class="layer-${band}"`);
		}

		// Filled tiers carry the per-threshold class. The synthetic grid's
		// peak amplitude (~5) crosses thresholds 1-5; the renderer emits
		// classes for every threshold the contour algorithm draws at.
		expect(result.svg).toMatch(/class="gtg-tier gtg-tier-1"/);
		expect(result.svg).toMatch(/class="gtg-tier gtg-tier-2"/);
		expect(result.svg).toMatch(/class="gtg-tier gtg-tier-3"/);
		expect(result.svg).toMatch(/class="gtg-tier gtg-tier-4"/);

		// Chrome legend.
		expect(result.svg).toContain('GTG (GRAPHICAL TURBULENCE GUIDANCE)');
		expect(result.svg).toContain('GTG SEVERITY');
		expect(result.svg).toContain('Light');
		expect(result.svg).toContain('Moderate');
		expect(result.svg).toContain('Severe');
		expect(result.svg).toContain('FL240');

		// Re-stroke band populated (the layer that re-applies state borders
		// over the filled tiers).
		expect(result.svg).toMatch(/<g class="layer-basemap-re-stroke">/);

		// Meta sanity.
		expect(result.meta.parser_warnings).toHaveLength(0);
		expect(result.meta.layer_counts['vector-symbology']).toBeGreaterThan(0);
		expect(result.meta.layer_counts['basemap-fill']).toBeGreaterThanOrEqual(48);
		expect(result.meta.drawn_pixels).toBe(0);
	});

	it('is deterministic: render twice -> same SVG bytes', async () => {
		const basemapJson = readFileSync(BASEMAP_PATH, 'utf8');
		const input = {
			spec: SPEC,
			sources: { intensity_grid: JSON.stringify(FIXTURE), basemap: basemapJson },
			basemapPath: BASEMAP_PATH,
			libraryVersion: '@ab/wx-charts@0.1.0-test',
		};
		const a = await renderTurbulenceGtg(input);
		const b = await renderTurbulenceGtg(input);
		expect(a.svg).toBe(b.svg);
	});

	it('clips filled severity tiers + isopleths to the CONUS union polygon', async () => {
		const basemapJson = readFileSync(BASEMAP_PATH, 'utf8');
		const result = await renderTurbulenceGtg({
			spec: SPEC,
			sources: { intensity_grid: JSON.stringify(FIXTURE), basemap: basemapJson },
			basemapPath: BASEMAP_PATH,
			libraryVersion: '@ab/wx-charts@0.1.0-test',
		});
		expect(result.svg).toMatch(/<clipPath id="conus-clip-[A-Za-z0-9_-]+">/);
		expect(result.svg).toMatch(/<g clip-path="url\(#conus-clip-[A-Za-z0-9_-]+\)">/);
	});

	it('rejects missing required source', async () => {
		const basemapJson = readFileSync(BASEMAP_PATH, 'utf8');
		await expect(
			renderTurbulenceGtg({
				spec: SPEC,
				sources: { basemap: basemapJson },
				basemapPath: BASEMAP_PATH,
				libraryVersion: '@ab/wx-charts@0.1.0-test',
			}),
		).rejects.toThrow(/intensity_grid/);
	});

	it('rejects mis-sized grid (values length != width*height)', async () => {
		const basemapJson = readFileSync(BASEMAP_PATH, 'utf8');
		const broken = {
			...FIXTURE,
			values: FIXTURE.values.slice(0, FIXTURE.values.length - 5),
		};
		await expect(
			renderTurbulenceGtg({
				spec: SPEC,
				sources: { intensity_grid: JSON.stringify(broken), basemap: basemapJson },
				basemapPath: BASEMAP_PATH,
				libraryVersion: '@ab/wx-charts@0.1.0-test',
			}),
		).rejects.toThrow(/grid value count/);
	});

	it('hides legend + isopleths when options disable them', async () => {
		const basemapJson = readFileSync(BASEMAP_PATH, 'utf8');
		const noLegendSpec: TurbulenceGtgSpec = {
			...SPEC,
			options: { altitude_band: 'mid', show_legend: false, show_isopleths: false },
		};
		const result = await renderTurbulenceGtg({
			spec: noLegendSpec,
			sources: { intensity_grid: JSON.stringify(FIXTURE), basemap: basemapJson },
			basemapPath: BASEMAP_PATH,
			libraryVersion: '@ab/wx-charts@0.1.0-test',
		});
		expect(result.svg).not.toContain('GTG SEVERITY');
		// Filled tiers still rendered.
		expect(result.svg).toMatch(/class="gtg-tier gtg-tier-/);
	});
});
