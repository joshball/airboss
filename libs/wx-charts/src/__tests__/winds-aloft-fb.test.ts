/**
 * End-to-end render test for the Phase C winds-aloft-fb chart.
 *
 * Per WP test plan WXC-33 ("renders text grid over basemap").
 */

import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { LAYER_BAND_VALUES } from '@ab/constants';
import { describe, expect, it } from 'vitest';
import { renderWindsAloftFb, type WindsAloftFbSpec } from '../charts/winds-aloft-fb';

const REPO_ROOT = resolve(import.meta.dirname, '..', '..', '..', '..');
const BASEMAP_PATH = resolve(REPO_ROOT, 'data', 'references', 'basemaps', 'us-states-10m.json');

const SPEC: WindsAloftFbSpec = {
	slug: 'wx-winds-aloft-fb-2024-05-21-18z',
	type: 'winds-aloft-fb',
	title: 'Winds Aloft (FB)',
	subtitle: '2024-05-21 18Z',
	projection: { kind: 'lambert', parallels: [33, 45], rotate: [-96, -39] },
	extent: 'conus',
	sources: { bulletin: 'cache://winds-aloft/2024-05-21-18z.json' },
	options: {
		altitudes_ft: [3000, 6000, 9000, 12000, 18000],
		show_legend: true,
	},
};

const FIXTURE_ENVELOPE = JSON.stringify({
	validAt: '2024-05-21T18:00:00Z',
	basedOn: '2024-05-21T12:00:00Z',
	source: 'in-test fixture',
	stations: [
		{ icao: 'ABR', lat: 45.45, lon: -98.42 },
		{ icao: 'ATL', lat: 33.64, lon: -84.43 },
		{ icao: 'DEN', lat: 39.86, lon: -104.67 },
	],
	raw: `DATA BASED ON 211200Z
VALID 211800Z

   FT   3000    6000    9000   12000   18000
ABR  2515  2207+02  250207  270413  261917
ATL  1505  2008+18  1812+12  1815+05  2122-08
DEN        2306+10  2410+04  2515-02  2620-12`,
});

describe('renderWindsAloftFb (Phase C end-to-end)', () => {
	it('renders three station blocks over the CONUS basemap', async () => {
		const basemapJson = readFileSync(BASEMAP_PATH, 'utf8');
		const result = await renderWindsAloftFb({
			spec: SPEC,
			sources: { bulletin: FIXTURE_ENVELOPE, basemap: basemapJson },
			basemapPath: BASEMAP_PATH,
			libraryVersion: '@ab/wx-charts@0.1.0-test',
		});

		expect(result.svg).toMatch(/^<\?xml version="1\.0" encoding="UTF-8"\?>\n<svg /);
		for (const band of LAYER_BAND_VALUES) {
			expect(result.svg).toContain(`<g class="layer-${band}"`);
		}
		// Station blocks emitted as <g class='fb-station'>.
		expect((result.svg.match(/class="fb-station"/g) ?? []).length).toBe(3);
		expect(result.svg).toContain('data-station="ABR"');
		expect(result.svg).toContain('data-station="DEN"');
		// Legend present.
		expect(result.svg).toContain('WINDS / TEMPS ALOFT (FB)');
		expect(result.meta.layer_counts['point-symbology']).toBe(3);
	});

	it('is pure: render twice -> same SVG bytes', async () => {
		const basemapJson = readFileSync(BASEMAP_PATH, 'utf8');
		const input = {
			spec: SPEC,
			sources: { bulletin: FIXTURE_ENVELOPE, basemap: basemapJson },
			basemapPath: BASEMAP_PATH,
			libraryVersion: '@ab/wx-charts@0.1.0-test',
		};
		const a = await renderWindsAloftFb(input);
		const b = await renderWindsAloftFb(input);
		expect(a.svg).toBe(b.svg);
	});

	it('warns when a station in the bulletin has no coord lookup', async () => {
		const basemapJson = readFileSync(BASEMAP_PATH, 'utf8');
		const envelope = JSON.stringify({
			source: 'test',
			stations: [{ icao: 'ABR', lat: 45.45, lon: -98.42 }],
			raw: `   FT   3000   6000
ABR  2515  2207+02
XYZ  3010  3210+05`,
		});
		const result = await renderWindsAloftFb({
			spec: SPEC,
			sources: { bulletin: envelope, basemap: basemapJson },
			basemapPath: BASEMAP_PATH,
			libraryVersion: '@ab/wx-charts@0.1.0-test',
		});
		expect(result.meta.parser_warnings.some((w) => w.includes('XYZ') && w.includes('coord'))).toBe(true);
	});

	it('rejects an envelope missing the raw field', async () => {
		const basemapJson = readFileSync(BASEMAP_PATH, 'utf8');
		await expect(
			renderWindsAloftFb({
				spec: SPEC,
				sources: { bulletin: '{"stations": []}', basemap: basemapJson },
				basemapPath: BASEMAP_PATH,
				libraryVersion: '@ab/wx-charts@0.1.0-test',
			}),
		).rejects.toThrow();
	});
});
