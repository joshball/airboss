/**
 * End-to-end render test for the Phase B AIRMET / SIGMET advisory chart.
 *
 * Per WP test plan WXC-22 ("renders AIRMET/SIGMET/Convective SIGMET
 * polygons distinctly"): the test passes a synthetic advisory bundle
 * containing all five families (Sierra/Tango/Zulu/SIGMET/Conv SIGMET)
 * and asserts the renderer styles each family per the palette and emits
 * a chrome legend listing the active families.
 *
 * Pure: no filesystem reads. The basemap is passed in via the test seam
 * (input.sources.basemap) so the renderer skips the lazy node:fs read.
 */

import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { LAYER_BAND_VALUES } from '@ab/constants';
import { describe, expect, it } from 'vitest';
import { type AirmetSigmetSpec, renderAirmetSigmet } from '../charts/airmet-sigmet';

const REPO_ROOT = resolve(import.meta.dirname, '..', '..', '..', '..');
const BASEMAP_PATH = resolve(REPO_ROOT, 'data', 'references', 'basemaps', 'us-states-10m.json');

const SPEC: AirmetSigmetSpec = {
	slug: 'wx-airmet-sigmet-test',
	type: 'advisory-overlay',
	title: 'AIRMET / SIGMET',
	subtitle: 'Test fixture',
	projection: { kind: 'lambert', parallels: [33, 45], rotate: [-96, -39] },
	extent: 'conus',
	sources: {
		advisories: 'cache://sigmet/test.json',
	},
};

const FIXTURE = {
	issued: '2024-12-23T12:00:00Z',
	advisories: [
		{
			id: 'SIERRA-1',
			kind: 'airmet-sierra',
			label: 'AIRMET S',
			rings: [
				[
					[-78, 33],
					[-72, 33],
					[-72, 38],
					[-78, 38],
					[-78, 33],
				],
			],
		},
		{
			id: 'TANGO-1',
			kind: 'airmet-tango',
			label: 'AIRMET T',
			rings: [
				[
					[-105, 38],
					[-95, 38],
					[-95, 45],
					[-105, 45],
					[-105, 38],
				],
			],
		},
		{
			id: 'ZULU-1',
			kind: 'airmet-zulu',
			label: 'AIRMET Z',
			rings: [
				[
					[-95, 36],
					[-87, 36],
					[-87, 43],
					[-95, 43],
					[-95, 36],
				],
			],
		},
		{
			id: 'SIGE-1',
			kind: 'sigmet',
			label: 'SIGMET E',
			rings: [
				[
					[-91, 41],
					[-87, 41],
					[-87, 44],
					[-91, 44],
					[-91, 41],
				],
			],
		},
		{
			id: 'CONV-1',
			kind: 'convective-sigmet',
			label: 'WST 13C',
			rings: [
				[
					[-91, 33],
					[-86, 33],
					[-86, 37],
					[-91, 37],
					[-91, 33],
				],
			],
		},
	],
};

describe('renderAirmetSigmet (Phase B end-to-end)', () => {
	it('renders all five advisory families with distinct symbology', async () => {
		const basemapJson = readFileSync(BASEMAP_PATH, 'utf8');
		const result = await renderAirmetSigmet({
			spec: SPEC,
			sources: {
				advisories: JSON.stringify(FIXTURE),
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

		// Each advisory family produced its own polygon overlay.
		expect(result.svg).toContain('polygon-airmet-sierra');
		expect(result.svg).toContain('polygon-airmet-tango');
		expect(result.svg).toContain('polygon-airmet-zulu');
		expect(result.svg).toContain('polygon-sigmet');
		expect(result.svg).toContain('polygon-convective-sigmet');

		// Convective SIGMET adds the thunderstorm glyph.
		expect(result.svg).toContain('class="tstm-glyph"');
		expect(result.svg).toContain('TSTM');

		// Tango + Zulu carry the dashed convention.
		expect(result.svg).toMatch(/data-id="TANGO-1"[\s\S]*?stroke-dasharray="6 4"/);
		expect(result.svg).toMatch(/data-id="ZULU-1"[\s\S]*?stroke-dasharray="6 4"/);

		// Chrome carries title + active-advisory legend with all five rows.
		expect(result.svg).toContain('AIRMET / SIGMET');
		expect(result.svg).toContain('ACTIVE ADVISORIES');
		expect(result.svg).toContain('AIRMET Sierra');
		expect(result.svg).toContain('AIRMET Tango');
		expect(result.svg).toContain('AIRMET Zulu');
		expect(result.svg).toContain('SIGMET (Severe Wx)');
		expect(result.svg).toContain('Convective SIGMET');

		// Meta sanity.
		expect(result.meta.parser_warnings).toHaveLength(0);
		expect(result.meta.layer_counts['vector-symbology']).toBe(5);
		expect(result.meta.layer_counts['basemap-fill']).toBeGreaterThanOrEqual(48);
		expect(result.meta.drawn_pixels).toBe(0);
	});

	it('is deterministic: render twice -> same SVG bytes', async () => {
		const basemapJson = readFileSync(BASEMAP_PATH, 'utf8');
		const input = {
			spec: SPEC,
			sources: { advisories: JSON.stringify(FIXTURE), basemap: basemapJson },
			basemapPath: BASEMAP_PATH,
			libraryVersion: '@ab/wx-charts@0.1.0-test',
		};
		const a = await renderAirmetSigmet(input);
		const b = await renderAirmetSigmet(input);
		expect(a.svg).toBe(b.svg);
	});

	it('rejects missing required source', async () => {
		const basemapJson = readFileSync(BASEMAP_PATH, 'utf8');
		await expect(
			renderAirmetSigmet({
				spec: SPEC,
				sources: { basemap: basemapJson },
				basemapPath: BASEMAP_PATH,
				libraryVersion: '@ab/wx-charts@0.1.0-test',
			}),
		).rejects.toThrow(/advisories/);
	});

	it('rejects malformed advisory schema', async () => {
		const basemapJson = readFileSync(BASEMAP_PATH, 'utf8');
		// Polygon ring with only 2 points -- below the minimum.
		await expect(
			renderAirmetSigmet({
				spec: SPEC,
				sources: {
					advisories: JSON.stringify({
						advisories: [
							{
								id: 'BAD-1',
								kind: 'sigmet',
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
