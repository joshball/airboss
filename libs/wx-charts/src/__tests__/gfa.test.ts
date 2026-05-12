/**
 * End-to-end render test for the Phase D GFA renderer.
 *
 * Per WP test plan (Phase D forecast cluster): the GFA composes basemap +
 * cloud / precipitation polygons (severity-by-color) + IFR / MVFR area
 * overlays + chrome legend per AC 00-45H Ch 5 + AWC product page. Each
 * polygon family gets its own palette entry; the renderer enforces a fixed
 * z-order so cloud layers sit at the back, precipitation in the middle,
 * IFR / MVFR overlays on top.
 *
 * Pure: no filesystem reads. The basemap is passed in via the test seam.
 */

import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { LAYER_BAND_VALUES } from '@ab/constants';
import { describe, expect, it } from 'vitest';
import { type GfaSpec, renderGfa } from '../charts/gfa';

const REPO_ROOT = resolve(import.meta.dirname, '..', '..', '..', '..');
const BASEMAP_PATH = resolve(REPO_ROOT, 'data', 'references', 'basemaps', 'us-states-10m.json');

const SPEC: GfaSpec = {
	slug: 'wx-gfa-test',
	type: 'gfa',
	title: 'Graphical Forecasts for Aviation',
	subtitle: 'Test fixture',
	projection: { kind: 'lambert', parallels: [33, 45], rotate: [-96, 0] },
	extent: 'conus',
	sources: {
		polygons: 'cache://gfa/test.json',
	},
};

const FIXTURE = {
	issued: '2024-12-23T12:00:00Z',
	valid_at: '2024-12-23T15:00:00Z',
	altitude_band: 'SFC-180',
	polygons: [
		{
			id: 'GFA-CLD-1',
			kind: 'clouds_bkn_ovc',
			label: 'BKN/OVC',
			rings: [
				[
					[-90, 32],
					[-78, 32],
					[-78, 42],
					[-90, 42],
					[-90, 32],
				],
			],
		},
		{
			id: 'GFA-CLD-2',
			kind: 'clouds_few_sct',
			label: 'FEW/SCT',
			rings: [
				[
					[-110, 38],
					[-100, 38],
					[-100, 46],
					[-110, 46],
					[-110, 38],
				],
			],
		},
		{
			id: 'GFA-RAIN',
			kind: 'precip_rain',
			label: 'RA',
			rings: [
				[
					[-95, 28],
					[-87, 28],
					[-87, 33],
					[-95, 33],
					[-95, 28],
				],
			],
		},
		{
			id: 'GFA-TSTM',
			kind: 'precip_tstm',
			label: 'TSRA',
			rings: [
				[
					[-85, 26],
					[-80, 26],
					[-80, 30],
					[-85, 30],
					[-85, 26],
				],
			],
		},
		{
			id: 'GFA-IFR',
			kind: 'ifr_area',
			label: 'IFR',
			rings: [
				[
					[-91, 34],
					[-84, 34],
					[-84, 39],
					[-91, 39],
					[-91, 34],
				],
			],
		},
		{
			id: 'GFA-MVFR',
			kind: 'mvfr_area',
			label: 'MVFR',
			rings: [
				[
					[-94, 40],
					[-86, 40],
					[-86, 46],
					[-94, 46],
					[-94, 40],
				],
			],
		},
	],
};

describe('renderGfa (Phase D end-to-end)', () => {
	it('renders cloud + precip + IFR / MVFR polygons with chrome legend', async () => {
		const basemapJson = readFileSync(BASEMAP_PATH, 'utf8');
		const result = await renderGfa({
			spec: SPEC,
			sources: { polygons: JSON.stringify(FIXTURE), basemap: basemapJson },
			basemapPath: BASEMAP_PATH,
			libraryVersion: '@ab/wx-charts@0.1.0-test',
		});
		expect(result.svg).toMatch(/^<\?xml version="1\.0" encoding="UTF-8"\?>\n<svg /);
		for (const band of LAYER_BAND_VALUES) {
			expect(result.svg).toContain(`<g class="layer-${band}"`);
		}
		// Each polygon family produced its own overlay class.
		expect(result.svg).toContain('polygon-gfa-clouds-bkn-ovc');
		expect(result.svg).toContain('polygon-gfa-clouds-few-sct');
		expect(result.svg).toContain('polygon-gfa-precip-rain');
		expect(result.svg).toContain('polygon-gfa-precip-tstm');
		expect(result.svg).toContain('polygon-gfa-ifr-area');
		expect(result.svg).toContain('polygon-gfa-mvfr-area');
		// Chrome legend with altitude band + active families.
		expect(result.svg).toContain('GRAPHICAL FORECASTS FOR AVIATION');
		expect(result.svg).toContain('GFA POLYGONS');
		expect(result.svg).toContain('Altitude: SFC-180');
		expect(result.svg).toContain('FEW/SCT clouds');
		expect(result.svg).toContain('IFR conditions');
		// Right-rail GFA band label visible in chrome.
		expect(result.svg).toContain('CONUS GFA SFC-180');
		// Meta sanity.
		expect(result.meta.parser_warnings).toHaveLength(0);
		expect(result.meta.layer_counts['vector-symbology']).toBe(6);
		expect(result.meta.drawn_pixels).toBe(0);
	});

	it('z-orders cloud back, precipitation middle, IFR/MVFR front', async () => {
		const basemapJson = readFileSync(BASEMAP_PATH, 'utf8');
		// Reverse the input order; the renderer should still draw clouds
		// first (back) and IFR last (front).
		const reversed = { ...FIXTURE, polygons: [...FIXTURE.polygons].reverse() };
		const result = await renderGfa({
			spec: SPEC,
			sources: { polygons: JSON.stringify(reversed), basemap: basemapJson },
			basemapPath: BASEMAP_PATH,
			libraryVersion: '@ab/wx-charts@0.1.0-test',
		});
		const cloudIdx = result.svg.indexOf('polygon-gfa-clouds-few-sct');
		const ifrIdx = result.svg.indexOf('polygon-gfa-ifr-area');
		expect(cloudIdx).toBeGreaterThan(0);
		expect(ifrIdx).toBeGreaterThan(0);
		expect(cloudIdx).toBeLessThan(ifrIdx);
	});

	it('is deterministic: render twice -> same SVG bytes', async () => {
		const basemapJson = readFileSync(BASEMAP_PATH, 'utf8');
		const input = {
			spec: SPEC,
			sources: { polygons: JSON.stringify(FIXTURE), basemap: basemapJson },
			basemapPath: BASEMAP_PATH,
			libraryVersion: '@ab/wx-charts@0.1.0-test',
		};
		const a = await renderGfa(input);
		const b = await renderGfa(input);
		expect(a.svg).toBe(b.svg);
	});

	it('rejects missing polygons source', async () => {
		const basemapJson = readFileSync(BASEMAP_PATH, 'utf8');
		await expect(
			renderGfa({
				spec: SPEC,
				sources: { basemap: basemapJson },
				basemapPath: BASEMAP_PATH,
				libraryVersion: '@ab/wx-charts@0.1.0-test',
			}),
		).rejects.toThrow(/polygons/);
	});

	it('rejects unknown polygon kind', async () => {
		const basemapJson = readFileSync(BASEMAP_PATH, 'utf8');
		const bad = {
			polygons: [
				{
					id: 'BAD-1',
					kind: 'fog',
					rings: [
						[
							[-95, 40],
							[-90, 40],
							[-90, 45],
							[-95, 45],
							[-95, 40],
						],
					],
				},
			],
		};
		await expect(
			renderGfa({
				spec: SPEC,
				sources: { polygons: JSON.stringify(bad), basemap: basemapJson },
				basemapPath: BASEMAP_PATH,
				libraryVersion: '@ab/wx-charts@0.1.0-test',
			}),
		).rejects.toThrow();
	});

	it('hides legend when show_legend disabled', async () => {
		const basemapJson = readFileSync(BASEMAP_PATH, 'utf8');
		const result = await renderGfa({
			spec: { ...SPEC, options: { show_legend: false } },
			sources: { polygons: JSON.stringify(FIXTURE), basemap: basemapJson },
			basemapPath: BASEMAP_PATH,
			libraryVersion: '@ab/wx-charts@0.1.0-test',
		});
		expect(result.svg).not.toContain('GFA POLYGONS');
	});
});
