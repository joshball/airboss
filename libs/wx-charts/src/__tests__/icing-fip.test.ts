/**
 * End-to-end render test for the Phase E Forecast Icing Product (FIP) chart.
 *
 * FIP delegates to the shared CIP body; the test verifies the renderer wires
 * the FIP attribution + spec discriminator correctly and that the output
 * is deterministic.
 */

import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { LAYER_BAND_VALUES } from '@ab/constants';
import { describe, expect, it } from 'vitest';
import { type IcingFipSpec, renderIcingFip } from '../charts/icing-fip';

const REPO_ROOT = resolve(import.meta.dirname, '..', '..', '..', '..');
const BASEMAP_PATH = resolve(REPO_ROOT, 'data', 'references', 'basemaps', 'us-states-10m.json');

const SPEC: IcingFipSpec = {
	slug: 'wx-icing-fip-test',
	type: 'icing-fip',
	title: 'FIP Icing +6h',
	subtitle: '6-hour forecast',
	projection: { kind: 'lambert', parallels: [33, 45], rotate: [-96, -39] },
	extent: 'conus',
	sources: { field: 'cache://icing/test-fip.json' },
};

const FIXTURE = {
	issued: '2024-12-23T12:00:00Z',
	valid_at: '2024-12-23T18:00:00Z',
	altitude_ft: 9000,
	centers: [
		{ lon: -82, lat: 41, amplitude: 90, sigma: 5, severity: 0.55 },
		{ lon: -100, lat: 38, amplitude: 70, sigma: 5, severity: 0.4 },
	],
};

describe('renderIcingFip (Phase E end-to-end)', () => {
	it('renders the FIP product with the FIP-tagged attribution', async () => {
		const basemapJson = readFileSync(BASEMAP_PATH, 'utf8');
		const result = await renderIcingFip({
			spec: SPEC,
			sources: { field: JSON.stringify(FIXTURE), basemap: basemapJson },
			basemapPath: BASEMAP_PATH,
			libraryVersion: '@ab/wx-charts@0.1.0-test',
		});

		expect(result.svg).toMatch(/^<\?xml version="1\.0" encoding="UTF-8"\?>\n<svg /);
		for (const band of LAYER_BAND_VALUES) {
			expect(result.svg).toContain(`<g class="layer-${band}"`);
		}

		expect(result.svg).toContain('FIP ICING +6H'); // uppercased title
		expect(result.svg).toContain('AWC FIP archive');
		expect(result.meta.layer_counts['raster-overlay']).toBeGreaterThan(0);
	});

	it('is deterministic: render twice -> same SVG bytes', async () => {
		const basemapJson = readFileSync(BASEMAP_PATH, 'utf8');
		const input = {
			spec: SPEC,
			sources: { field: JSON.stringify(FIXTURE), basemap: basemapJson },
			basemapPath: BASEMAP_PATH,
			libraryVersion: '@ab/wx-charts@0.1.0-test',
		};
		const a = await renderIcingFip(input);
		const b = await renderIcingFip(input);
		expect(a.svg).toBe(b.svg);
	});
});
