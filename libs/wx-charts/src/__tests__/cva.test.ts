/**
 * End-to-end render test for the Phase D CVA renderer.
 *
 * Per WP test plan (Phase D forecast cluster): the CVA derives flight
 * category per station from a real METAR via the Phase C parser +
 * `computeFlightCategory`, then emits a coloured station dot per
 * observation in the FAA flight-category palette. Optional CVA polygon
 * overlays from the source provide CONUS-wide area shading. The chrome
 * legend lists the active categories with their AIM 7-1-6 thresholds.
 *
 * Pure: no filesystem reads. The basemap is passed in via the test seam.
 */

import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { LAYER_BAND_VALUES } from '@ab/constants';
import { describe, expect, it } from 'vitest';
import { type CvaSpec, renderCva } from '../charts/cva';

const REPO_ROOT = resolve(import.meta.dirname, '..', '..', '..', '..');
const BASEMAP_PATH = resolve(REPO_ROOT, 'data', 'references', 'basemaps', 'us-states-10m.json');

const SPEC: CvaSpec = {
	slug: 'wx-cva-test',
	type: 'cva',
	title: 'Ceiling and Visibility Analysis',
	subtitle: 'Test fixture',
	projection: { kind: 'lambert', parallels: [33, 45], rotate: [-96, 0] },
	extent: 'conus',
	sources: {
		observations: 'cache://metar/test.json',
	},
};

const FIXTURE = {
	targetTimestamp: '2024-01-13T12:00:00Z',
	source: 'Test fixture',
	count: 4,
	observations: [
		{
			station: { icao: 'KSEA', lat: 47.45, lon: -122.31 },
			// 10SM SCT240 -> ceiling unlimited, vis 10 -> VFR
			raw: 'KSEA 131153Z 09015G22KT 10SM SCT240 M09/M19 A3012',
		},
		{
			station: { icao: 'KORD', lat: 41.98, lon: -87.91 },
			// 5SM BKN015 -> ceiling 1500, vis 5 -> MVFR
			raw: 'KORD 131153Z 24025KT 5SM BKN015 M01/M03 A2998',
		},
		{
			station: { icao: 'KMEM', lat: 35.04, lon: -89.98 },
			// 2SM OVC008 -> ceiling 800, vis 2 -> IFR
			raw: 'KMEM 131153Z 18012KT 2SM -RA OVC008 12/11 A2992',
		},
		{
			station: { icao: 'KMSY', lat: 29.99, lon: -90.26 },
			// 1/2SM OVC003 -> ceiling 300, vis 0.5 -> LIFR
			raw: 'KMSY 131153Z 14008KT 1/2SM FG OVC003 19/18 A2990',
		},
	],
};

describe('renderCva (Phase D end-to-end)', () => {
	it('renders one coloured dot per station with category from METAR', async () => {
		const basemapJson = readFileSync(BASEMAP_PATH, 'utf8');
		const result = await renderCva({
			spec: SPEC,
			sources: { observations: JSON.stringify(FIXTURE), basemap: basemapJson },
			basemapPath: BASEMAP_PATH,
			libraryVersion: '@ab/wx-charts@0.1.0-test',
		});
		expect(result.svg).toMatch(/^<\?xml version="1\.0" encoding="UTF-8"\?>\n<svg /);
		for (const band of LAYER_BAND_VALUES) {
			expect(result.svg).toContain(`<g class="layer-${band}"`);
		}
		// One dot per station with the derived category.
		expect(result.svg).toContain('data-station="KSEA"');
		expect(result.svg).toContain('data-category="VFR"');
		expect(result.svg).toContain('data-station="KORD"');
		expect(result.svg).toContain('data-category="MVFR"');
		expect(result.svg).toContain('data-station="KMEM"');
		expect(result.svg).toContain('data-category="IFR"');
		expect(result.svg).toContain('data-station="KMSY"');
		expect(result.svg).toContain('data-category="LIFR"');
		// Chrome legend with all four categories.
		expect(result.svg).toContain('CEILING AND VISIBILITY ANALYSIS');
		expect(result.svg).toContain('FLIGHT CATEGORY (AIM 7-1-6)');
		// Right-rail label.
		expect(result.svg).toContain('CONUS - CVA');
		// Meta sanity.
		expect(result.meta.parser_warnings).toHaveLength(0);
		expect(result.meta.layer_counts['point-symbology']).toBe(4);
		expect(result.meta.layer_counts['vector-symbology']).toBe(0);
	});

	it('renders optional CVA polygon overlays when present in source', async () => {
		const basemapJson = readFileSync(BASEMAP_PATH, 'utf8');
		const fixtureWithPolys = {
			...FIXTURE,
			polygons: [
				{
					id: 'CVA-IFR-1',
					category: 'IFR',
					label: 'IFR area',
					rings: [
						[
							[-92, 33],
							[-86, 33],
							[-86, 38],
							[-92, 38],
							[-92, 33],
						],
					],
				},
			],
		};
		const result = await renderCva({
			spec: SPEC,
			sources: { observations: JSON.stringify(fixtureWithPolys), basemap: basemapJson },
			basemapPath: BASEMAP_PATH,
			libraryVersion: '@ab/wx-charts@0.1.0-test',
		});
		expect(result.svg).toContain('polygon-cva-ifr');
		expect(result.meta.layer_counts['vector-symbology']).toBe(1);
	});

	it('hides polygons when show_polygons disabled', async () => {
		const basemapJson = readFileSync(BASEMAP_PATH, 'utf8');
		const fixtureWithPolys = {
			...FIXTURE,
			polygons: [
				{
					id: 'CVA-IFR-1',
					category: 'IFR',
					rings: [
						[
							[-92, 33],
							[-86, 33],
							[-86, 38],
							[-92, 38],
							[-92, 33],
						],
					],
				},
			],
		};
		const result = await renderCva({
			spec: { ...SPEC, options: { show_polygons: false } },
			sources: { observations: JSON.stringify(fixtureWithPolys), basemap: basemapJson },
			basemapPath: BASEMAP_PATH,
			libraryVersion: '@ab/wx-charts@0.1.0-test',
		});
		expect(result.svg).not.toContain('polygon-cva-ifr');
	});

	it('is deterministic: render twice -> same SVG bytes', async () => {
		const basemapJson = readFileSync(BASEMAP_PATH, 'utf8');
		const input = {
			spec: SPEC,
			sources: { observations: JSON.stringify(FIXTURE), basemap: basemapJson },
			basemapPath: BASEMAP_PATH,
			libraryVersion: '@ab/wx-charts@0.1.0-test',
		};
		const a = await renderCva(input);
		const b = await renderCva(input);
		expect(a.svg).toBe(b.svg);
	});

	it('rejects missing observations source', async () => {
		const basemapJson = readFileSync(BASEMAP_PATH, 'utf8');
		await expect(
			renderCva({
				spec: SPEC,
				sources: { basemap: basemapJson },
				basemapPath: BASEMAP_PATH,
				libraryVersion: '@ab/wx-charts@0.1.0-test',
			}),
		).rejects.toThrow(/observations/);
	});

	it('hides legend when show_legend disabled', async () => {
		const basemapJson = readFileSync(BASEMAP_PATH, 'utf8');
		const result = await renderCva({
			spec: { ...SPEC, options: { show_legend: false } },
			sources: { observations: JSON.stringify(FIXTURE), basemap: basemapJson },
			basemapPath: BASEMAP_PATH,
			libraryVersion: '@ab/wx-charts@0.1.0-test',
		});
		expect(result.svg).not.toContain('FLIGHT CATEGORY (AIM 7-1-6)');
	});
});
