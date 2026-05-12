/**
 * End-to-end render test for the Phase E Current Icing Product (CIP) chart.
 *
 * Verifies the gridded probability + severity field renders the expected
 * filled bands plus optional severity contour lines, that warnings are
 * recorded for out-of-range cells, and that the renderer is deterministic.
 */

import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { LAYER_BAND_VALUES } from '@ab/constants';
import { describe, expect, it } from 'vitest';
import { type IcingCipSpec, renderIcingCip } from '../charts/icing-cip';

const REPO_ROOT = resolve(import.meta.dirname, '..', '..', '..', '..');
const BASEMAP_PATH = resolve(REPO_ROOT, 'data', 'references', 'basemaps', 'us-states-10m.json');

const SPEC: IcingCipSpec = {
	slug: 'wx-icing-cip-test',
	type: 'icing-cip',
	title: 'CIP Icing',
	subtitle: 'Test fixture',
	projection: { kind: 'lambert', parallels: [33, 45], rotate: [-96, 0] },
	extent: 'conus',
	sources: { field: 'cache://icing/test-cip.json' },
};

const FIXTURE = {
	issued: '2024-12-23T12:00:00Z',
	altitude_ft: 9000,
	centers: [
		// Strong moderate-severity area over the Great Lakes.
		{ lon: -85, lat: 43, amplitude: 95, sigma: 5, severity: 0.65 },
		// Weaker, lower-severity area over the central plains.
		{ lon: -98, lat: 36, amplitude: 60, sigma: 6, severity: 0.3 },
	],
};

describe('renderIcingCip (Phase E end-to-end)', () => {
	it('renders filled probability bands + severity contours with chrome legend', async () => {
		const basemapJson = readFileSync(BASEMAP_PATH, 'utf8');
		const result = await renderIcingCip({
			spec: SPEC,
			sources: {
				field: JSON.stringify(FIXTURE),
				basemap: basemapJson,
			},
			basemapPath: BASEMAP_PATH,
			libraryVersion: '@ab/wx-charts@0.1.0-test',
		});

		expect(result.svg).toMatch(/^<\?xml version="1\.0" encoding="UTF-8"\?>\n<svg /);
		for (const band of LAYER_BAND_VALUES) {
			expect(result.svg).toContain(`<g class="layer-${band}"`);
		}

		// Filled probability bands present (raster overlay band).
		expect(result.meta.layer_counts['raster-overlay']).toBeGreaterThan(0);

		// Severity contour lines present (vector symbology band).
		expect(result.meta.layer_counts['vector-symbology']).toBeGreaterThan(0);

		// Chrome legend.
		expect(result.svg).toContain('CIP ICING'); // uppercased title
		expect(result.svg).toContain('ICING PROBABILITY');
		expect(result.svg).toContain('20-40%');
		expect(result.svg).toContain('FL 090');

		// No warnings on the well-behaved fixture.
		expect(result.meta.parser_warnings).toHaveLength(0);
	});

	it('is deterministic: render twice -> same SVG bytes', async () => {
		const basemapJson = readFileSync(BASEMAP_PATH, 'utf8');
		const input = {
			spec: SPEC,
			sources: { field: JSON.stringify(FIXTURE), basemap: basemapJson },
			basemapPath: BASEMAP_PATH,
			libraryVersion: '@ab/wx-charts@0.1.0-test',
		};
		const a = await renderIcingCip(input);
		const b = await renderIcingCip(input);
		expect(a.svg).toBe(b.svg);
	});

	it('clamps out-of-range probability cells and records the warning', async () => {
		const basemapJson = readFileSync(BASEMAP_PATH, 'utf8');
		const probWidth = 4;
		const probHeight = 3;
		const probValues = [
			-15,
			50,
			110,
			80, // row 0: -15 + 110 are out of range
			20,
			30,
			40,
			50,
			60,
			70,
			80,
			200, // row 2: 200 is out of range
		];
		const result = await renderIcingCip({
			spec: SPEC,
			sources: {
				field: JSON.stringify({
					probability_grid: {
						gridLonMin: -100,
						gridLonMax: -90,
						gridLatMin: 35,
						gridLatMax: 40,
						gridWidth: probWidth,
						gridHeight: probHeight,
						values: probValues,
					},
					severity_grid: {
						gridLonMin: -100,
						gridLonMax: -90,
						gridLatMin: 35,
						gridLatMax: 40,
						gridWidth: probWidth,
						gridHeight: probHeight,
						values: [0, 0.2, 0.4, 0.6, 0.5, 0.5, 0.5, 0.5, 0.7, 0.9, 1.1, 0.8],
					},
				}),
				basemap: basemapJson,
			},
			basemapPath: BASEMAP_PATH,
			libraryVersion: '@ab/wx-charts@0.1.0-test',
		});
		expect(result.meta.parser_warnings.some((w) => w.includes('probability cells outside [0, 100]'))).toBe(true);
		expect(result.meta.parser_warnings.some((w) => w.includes('severity cells outside [0, 1]'))).toBe(true);
	});

	it('rejects missing required source', async () => {
		const basemapJson = readFileSync(BASEMAP_PATH, 'utf8');
		await expect(
			renderIcingCip({
				spec: SPEC,
				sources: { basemap: basemapJson },
				basemapPath: BASEMAP_PATH,
				libraryVersion: '@ab/wx-charts@0.1.0-test',
			}),
		).rejects.toThrow(/field/);
	});

	it('clips filled probability bands + severity contours to the CONUS union polygon', async () => {
		const basemapJson = readFileSync(BASEMAP_PATH, 'utf8');
		const result = await renderIcingCip({
			spec: SPEC,
			sources: { field: JSON.stringify(FIXTURE), basemap: basemapJson },
			basemapPath: BASEMAP_PATH,
			libraryVersion: '@ab/wx-charts@0.1.0-test',
		});
		expect(result.svg).toMatch(/<clipPath id="conus-clip-[A-Za-z0-9_-]+">/);
		const refs = result.svg.match(/<g clip-path="url\(#conus-clip-[A-Za-z0-9_-]+\)">/g) ?? [];
		// raster-overlay band + vector-symbology band -> two clip refs.
		expect(refs.length).toBeGreaterThanOrEqual(2);
	});

	it('hides severity contours when show_severity_contours is false', async () => {
		const basemapJson = readFileSync(BASEMAP_PATH, 'utf8');
		const result = await renderIcingCip({
			spec: { ...SPEC, options: { show_severity_contours: false } },
			sources: { field: JSON.stringify(FIXTURE), basemap: basemapJson },
			basemapPath: BASEMAP_PATH,
			libraryVersion: '@ab/wx-charts@0.1.0-test',
		});
		expect(result.meta.layer_counts['vector-symbology']).toBe(0);
	});
});
