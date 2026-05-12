/**
 * End-to-end render test for the Phase E G-AIRMET turbulence chart.
 *
 * Asserts:
 *   - Renderer produces a complete SVG with every canonical layer band.
 *   - Each severity (light, moderate, severe) renders with a distinct
 *     CSS class suffix and palette-correct stroke + fill.
 *   - Light tier carries the dashed convention.
 *   - Chrome carries the title and severity legend with all active rows.
 *   - Render is deterministic (re-render -> identical SVG bytes).
 *   - Schema rejects malformed area shapes.
 *
 * Pure: no filesystem reads in the renderer path. The basemap is passed
 * in via the test seam (input.sources.basemap).
 */

import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { LAYER_BAND_VALUES } from '@ab/constants';
import { describe, expect, it } from 'vitest';
import { renderTurbulenceGairmet, type TurbulenceGairmetSpec } from '../charts/turbulence-gairmet';

const REPO_ROOT = resolve(import.meta.dirname, '..', '..', '..', '..');
const BASEMAP_PATH = resolve(REPO_ROOT, 'data', 'references', 'basemaps', 'us-states-10m.json');

const SPEC: TurbulenceGairmetSpec = {
	slug: 'wx-turbulence-gairmet-test',
	type: 'turbulence-gairmet',
	title: 'Turbulence G-AIRMET',
	subtitle: 'Test fixture',
	projection: { kind: 'lambert', parallels: [33, 45], rotate: [-96, 0] },
	extent: 'conus',
	sources: {
		areas: 'cache://g-airmet/test-turb.json',
	},
};

const FIXTURE = {
	issued: '2024-12-23T12:00:00Z',
	valid: '2024-12-23T12:00:00Z/2024-12-23T15:00:00Z',
	areas: [
		{
			id: 'TURB-LGT-1',
			severity: 'light',
			topFl: 180,
			bottomFl: 80,
			label: 'LGT TURB\nFL080-FL180',
			rings: [
				[
					[-100, 33],
					[-90, 33],
					[-90, 38],
					[-100, 38],
					[-100, 33],
				],
			],
		},
		{
			id: 'TURB-MOD-1',
			severity: 'moderate',
			topFl: 240,
			bottomFl: 100,
			label: 'MOD TURB\nFL100-FL240',
			rings: [
				[
					[-110, 38],
					[-100, 38],
					[-100, 45],
					[-110, 45],
					[-110, 38],
				],
			],
		},
		{
			id: 'TURB-SEV-1',
			severity: 'severe',
			topFl: 350,
			bottomFl: 200,
			rings: [
				[
					[-92, 41],
					[-86, 41],
					[-86, 44],
					[-92, 44],
					[-92, 41],
				],
			],
		},
	],
};

describe('renderTurbulenceGairmet (Phase E end-to-end)', () => {
	it('renders all three severity tiers with distinct symbology', async () => {
		const basemapJson = readFileSync(BASEMAP_PATH, 'utf8');
		const result = await renderTurbulenceGairmet({
			spec: SPEC,
			sources: {
				areas: JSON.stringify(FIXTURE),
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

		// Each severity produced its own polygon overlay.
		expect(result.svg).toContain('polygon-turb-light');
		expect(result.svg).toContain('polygon-turb-moderate');
		expect(result.svg).toContain('polygon-turb-severe');

		// Light tier carries dashed convention.
		expect(result.svg).toMatch(/data-id="TURB-LGT-1"[\s\S]*?stroke-dasharray="4 3"/);

		// Severe tier carries the high-intensity stroke colour (#7a0000).
		expect(result.svg).toMatch(/data-id="TURB-SEV-1"[\s\S]*?stroke="#7a0000"/);

		// Auto-generated label appears for the area without an explicit label.
		expect(result.svg).toContain('SEV TURB');

		// Chrome carries title + legend.
		expect(result.svg).toContain('TURBULENCE G-AIRMET');
		expect(result.svg).toContain('TURBULENCE INTENSITY');
		expect(result.svg).toContain('Light Turbulence');
		expect(result.svg).toContain('Moderate Turbulence');
		expect(result.svg).toContain('Severe Turbulence');

		// Valid period propagated into legend.
		expect(result.svg).toContain('Valid 2024-12-23T12:00:00Z/2024-12-23T15:00:00Z');

		// Meta sanity.
		expect(result.meta.parser_warnings).toHaveLength(0);
		expect(result.meta.layer_counts['vector-symbology']).toBe(3);
		expect(result.meta.layer_counts['basemap-fill']).toBeGreaterThanOrEqual(48);
		expect(result.meta.drawn_pixels).toBe(0);
	});

	it('is deterministic: render twice -> same SVG bytes', async () => {
		const basemapJson = readFileSync(BASEMAP_PATH, 'utf8');
		const input = {
			spec: SPEC,
			sources: { areas: JSON.stringify(FIXTURE), basemap: basemapJson },
			basemapPath: BASEMAP_PATH,
			libraryVersion: '@ab/wx-charts@0.1.0-test',
		};
		const a = await renderTurbulenceGairmet(input);
		const b = await renderTurbulenceGairmet(input);
		expect(a.svg).toBe(b.svg);
	});

	it('rejects missing required source', async () => {
		const basemapJson = readFileSync(BASEMAP_PATH, 'utf8');
		await expect(
			renderTurbulenceGairmet({
				spec: SPEC,
				sources: { basemap: basemapJson },
				basemapPath: BASEMAP_PATH,
				libraryVersion: '@ab/wx-charts@0.1.0-test',
			}),
		).rejects.toThrow(/areas/);
	});

	it('rejects malformed area schema', async () => {
		const basemapJson = readFileSync(BASEMAP_PATH, 'utf8');
		// Polygon ring with only 2 points -- below the minimum.
		await expect(
			renderTurbulenceGairmet({
				spec: SPEC,
				sources: {
					areas: JSON.stringify({
						areas: [
							{
								id: 'BAD-1',
								severity: 'moderate',
								topFl: 200,
								bottomFl: 50,
								rings: [
									[
										[-95, 40],
										[-90, 40],
									],
								],
							},
						],
					}),
					basemap: basemapJson,
				},
				basemapPath: BASEMAP_PATH,
				libraryVersion: '@ab/wx-charts@0.1.0-test',
			}),
		).rejects.toThrow();
	});
});
