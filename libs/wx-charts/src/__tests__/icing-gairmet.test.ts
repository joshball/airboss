/**
 * End-to-end render test for the Phase E G-AIRMET icing chart.
 *
 * Per WP test plan (Phase E icing): the renderer styles each severity tier
 * (light / light-mod / moderate / severe) per AC 00-45H Ch 5, emits a
 * chrome legend listing only the active severities, and is deterministic.
 *
 * Pure: no filesystem reads. The basemap is passed in via the test seam
 * (input.sources.basemap).
 */

import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { LAYER_BAND_VALUES } from '@ab/constants';
import { describe, expect, it } from 'vitest';
import { type IcingGairmetSpec, renderIcingGairmet } from '../charts/icing-gairmet';

const REPO_ROOT = resolve(import.meta.dirname, '..', '..', '..', '..');
const BASEMAP_PATH = resolve(REPO_ROOT, 'data', 'references', 'basemaps', 'us-states-10m.json');

const SPEC: IcingGairmetSpec = {
	slug: 'wx-icing-gairmet-test',
	type: 'icing-gairmet',
	title: 'G-AIRMET Icing',
	subtitle: 'Test fixture',
	projection: { kind: 'lambert', parallels: [33, 45], rotate: [-96, 0] },
	extent: 'conus',
	sources: {
		areas: 'cache://g-airmet/test-icing.json',
	},
};

const FIXTURE = {
	issued: '2024-12-23T12:00:00Z',
	valid_from: '2024-12-23T12:00:00Z',
	valid_to: '2024-12-23T15:00:00Z',
	areas: [
		{
			id: 'GA-LIGHT-1',
			intensity: 'icing-light',
			type: 'rime',
			altLow: 5000,
			altHigh: 12000,
			label: 'LGT RIME ICE',
			rings: [
				[
					[-100, 35],
					[-95, 35],
					[-95, 40],
					[-100, 40],
					[-100, 35],
				],
			],
		},
		{
			id: 'GA-LMOD-1',
			intensity: 'icing-light-mod',
			label: 'LGT-MOD MX ICE',
			rings: [
				[
					[-90, 38],
					[-84, 38],
					[-84, 44],
					[-90, 44],
					[-90, 38],
				],
			],
		},
		{
			id: 'GA-MOD-1',
			intensity: 'icing-moderate',
			type: 'mixed',
			altLow: 6000,
			altHigh: 14000,
			label: 'MOD MX ICE\n060-140',
			rings: [
				[
					[-85, 42],
					[-78, 42],
					[-78, 47],
					[-85, 47],
					[-85, 42],
				],
			],
		},
		{
			id: 'GA-SEV-1',
			intensity: 'icing-severe',
			type: 'clear',
			label: 'SEV CLR ICE',
			rings: [
				[
					[-80, 36],
					[-75, 36],
					[-75, 40],
					[-80, 40],
					[-80, 36],
				],
			],
		},
	],
};

describe('renderIcingGairmet (Phase E end-to-end)', () => {
	it('renders all four icing-intensity tiers with distinct symbology', async () => {
		const basemapJson = readFileSync(BASEMAP_PATH, 'utf8');
		const result = await renderIcingGairmet({
			spec: SPEC,
			sources: {
				areas: JSON.stringify(FIXTURE),
				basemap: basemapJson,
			},
			basemapPath: BASEMAP_PATH,
			libraryVersion: '@ab/wx-charts@0.1.0-test',
		});

		expect(result.svg).toMatch(/^<\?xml version="1\.0" encoding="UTF-8"\?>\n<svg /);
		for (const band of LAYER_BAND_VALUES) {
			expect(result.svg).toContain(`<g class="layer-${band}"`);
		}

		// Each severity tier produced its own polygon overlay.
		expect(result.svg).toContain('polygon-icing-light');
		expect(result.svg).toContain('polygon-icing-light-mod');
		expect(result.svg).toContain('polygon-icing-moderate');
		expect(result.svg).toContain('polygon-icing-severe');

		// Chrome carries title + active-severity legend with all four rows.
		expect(result.svg).toContain('G-AIRMET ICING'); // title is uppercased by chrome
		expect(result.svg).toContain('ICING SEVERITY');
		expect(result.svg).toContain('Light icing');
		expect(result.svg).toContain('Light to moderate icing');
		expect(result.svg).toContain('Moderate icing');
		expect(result.svg).toContain('Severe icing');

		// Meta sanity.
		expect(result.meta.parser_warnings).toHaveLength(0);
		expect(result.meta.layer_counts['vector-symbology']).toBe(4);
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
		const a = await renderIcingGairmet(input);
		const b = await renderIcingGairmet(input);
		expect(a.svg).toBe(b.svg);
	});

	it('rejects missing required source', async () => {
		const basemapJson = readFileSync(BASEMAP_PATH, 'utf8');
		await expect(
			renderIcingGairmet({
				spec: SPEC,
				sources: { basemap: basemapJson },
				basemapPath: BASEMAP_PATH,
				libraryVersion: '@ab/wx-charts@0.1.0-test',
			}),
		).rejects.toThrow(/areas/);
	});

	it('rejects unknown intensity', async () => {
		const basemapJson = readFileSync(BASEMAP_PATH, 'utf8');
		const bad = {
			areas: [
				{
					id: 'BAD-1',
					intensity: 'icing-extreme',
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
			renderIcingGairmet({
				spec: SPEC,
				sources: { areas: JSON.stringify(bad), basemap: basemapJson },
				basemapPath: BASEMAP_PATH,
				libraryVersion: '@ab/wx-charts@0.1.0-test',
			}),
		).rejects.toThrow();
	});

	it('hides legend when show_legend disabled', async () => {
		const basemapJson = readFileSync(BASEMAP_PATH, 'utf8');
		const result = await renderIcingGairmet({
			spec: { ...SPEC, options: { show_legend: false } },
			sources: { areas: JSON.stringify(FIXTURE), basemap: basemapJson },
			basemapPath: BASEMAP_PATH,
			libraryVersion: '@ab/wx-charts@0.1.0-test',
		});
		expect(result.svg).not.toContain('ICING SEVERITY');
	});
});
