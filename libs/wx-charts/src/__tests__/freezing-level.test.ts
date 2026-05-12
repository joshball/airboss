/**
 * End-to-end render test for the Phase E freezing-level forecast chart.
 *
 * Verifies the gridded altitude scalar field renders the expected filled
 * altitude bands plus contour lines, that warnings record clamp counts on
 * out-of-range cells, and that the renderer is deterministic.
 */

import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { LAYER_BAND_VALUES } from '@ab/constants';
import { describe, expect, it } from 'vitest';
import { type FreezingLevelSpec, renderFreezingLevel } from '../charts/freezing-level';

const REPO_ROOT = resolve(import.meta.dirname, '..', '..', '..', '..');
const BASEMAP_PATH = resolve(REPO_ROOT, 'data', 'references', 'basemaps', 'us-states-10m.json');

const SPEC: FreezingLevelSpec = {
	slug: 'wx-freezing-level-test',
	type: 'freezing-level',
	title: 'Freezing Level',
	subtitle: 'Test fixture',
	projection: { kind: 'lambert', parallels: [33, 45], rotate: [-96, 0] },
	extent: 'conus',
	sources: { field: 'cache://freezing-level/test.json' },
};

const FIXTURE = {
	issued: '2024-12-23T12:00:00Z',
	valid_at: '2024-12-23T12:00:00Z',
	synth: {
		north_floor_ft: 1500,
		south_ceiling_ft: 15500,
		bumps: [
			{ lon: -88, lat: 45, amplitude_ft: -1500, sigma: 5 },
			{ lon: -100, lat: 32, amplitude_ft: 2000, sigma: 5 },
		],
	},
};

describe('renderFreezingLevel (Phase E end-to-end)', () => {
	it('renders altitude bands + contour lines with chrome legend', async () => {
		const basemapJson = readFileSync(BASEMAP_PATH, 'utf8');
		const result = await renderFreezingLevel({
			spec: SPEC,
			sources: { field: JSON.stringify(FIXTURE), basemap: basemapJson },
			basemapPath: BASEMAP_PATH,
			libraryVersion: '@ab/wx-charts@0.1.0-test',
		});

		expect(result.svg).toMatch(/^<\?xml version="1\.0" encoding="UTF-8"\?>\n<svg /);
		for (const band of LAYER_BAND_VALUES) {
			expect(result.svg).toContain(`<g class="layer-${band}"`);
		}

		// Filled altitude bands present.
		expect(result.meta.layer_counts['raster-overlay']).toBeGreaterThan(0);

		// Contour lines present.
		expect(result.meta.layer_counts['vector-symbology']).toBeGreaterThan(0);

		// Chrome legend.
		expect(result.svg).toContain('FREEZING LEVEL');
		expect(result.svg).toContain('SFC-2000 ft');
		expect(result.svg).toContain('15 kft+');

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
		const a = await renderFreezingLevel(input);
		const b = await renderFreezingLevel(input);
		expect(a.svg).toBe(b.svg);
	});

	it('clamps out-of-range altitude cells and records the warning', async () => {
		const basemapJson = readFileSync(BASEMAP_PATH, 'utf8');
		const result = await renderFreezingLevel({
			spec: SPEC,
			sources: {
				field: JSON.stringify({
					altitude_grid: {
						gridLonMin: -100,
						gridLonMax: -90,
						gridLatMin: 35,
						gridLatMax: 40,
						gridWidth: 4,
						gridHeight: 3,
						values: [-2000, 5000, 8000, 12000, 1000, 3000, 9000, 35000, 0, 4000, 6000, 11000],
					},
				}),
				basemap: basemapJson,
			},
			basemapPath: BASEMAP_PATH,
			libraryVersion: '@ab/wx-charts@0.1.0-test',
		});
		expect(result.meta.parser_warnings.some((w) => w.includes('altitude cells outside [0, 30000]'))).toBe(true);
	});

	it('rejects missing required source', async () => {
		const basemapJson = readFileSync(BASEMAP_PATH, 'utf8');
		await expect(
			renderFreezingLevel({
				spec: SPEC,
				sources: { basemap: basemapJson },
				basemapPath: BASEMAP_PATH,
				libraryVersion: '@ab/wx-charts@0.1.0-test',
			}),
		).rejects.toThrow(/field/);
	});

	it('clips both filled altitude bands and contour lines to the CONUS union polygon', async () => {
		const basemapJson = readFileSync(BASEMAP_PATH, 'utf8');
		const result = await renderFreezingLevel({
			spec: SPEC,
			sources: { field: JSON.stringify(FIXTURE), basemap: basemapJson },
			basemapPath: BASEMAP_PATH,
			libraryVersion: '@ab/wx-charts@0.1.0-test',
		});
		// clipPath element exists with a chart-namespaced id.
		expect(result.svg).toMatch(/<clipPath id="conus-clip-[A-Za-z0-9_-]+">/);
		// At least two clip-path references: raster-overlay (filled bands)
		// + vector-symbology (contour lines).
		const refs = result.svg.match(/<g clip-path="url\(#conus-clip-[A-Za-z0-9_-]+\)">/g) ?? [];
		expect(refs.length).toBeGreaterThanOrEqual(2);
	});

	it('hides contour lines when show_contours is false', async () => {
		const basemapJson = readFileSync(BASEMAP_PATH, 'utf8');
		const result = await renderFreezingLevel({
			spec: { ...SPEC, options: { show_contours: false } },
			sources: { field: JSON.stringify(FIXTURE), basemap: basemapJson },
			basemapPath: BASEMAP_PATH,
			libraryVersion: '@ab/wx-charts@0.1.0-test',
		});
		expect(result.meta.layer_counts['vector-symbology']).toBe(0);
	});
});
