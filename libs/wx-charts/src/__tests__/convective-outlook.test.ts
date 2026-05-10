/**
 * End-to-end render test for the Phase D SPC convective outlook renderer.
 *
 * Per WP test plan (Phase D forecast cluster): the renderer styles each
 * categorical risk tier (TSTM/MRGL/SLGT/ENH/MDT/HIGH) per the SPC standard
 * palette, sorts polygons by tier order so outermost-low-risk renders at
 * the back and innermost-high-risk on top, and emits a chrome legend
 * listing the active tiers and the day selector.
 *
 * Pure: no filesystem reads. The basemap is passed in via the test seam.
 */

import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { LAYER_BAND_VALUES } from '@ab/constants';
import { describe, expect, it } from 'vitest';
import { type ConvectiveOutlookSpec, renderConvectiveOutlook } from '../charts/convective-outlook';

const REPO_ROOT = resolve(import.meta.dirname, '..', '..', '..', '..');
const BASEMAP_PATH = resolve(REPO_ROOT, 'data', 'references', 'basemaps', 'us-states-10m.json');

const SPEC: ConvectiveOutlookSpec = {
	slug: 'wx-convective-outlook-test',
	type: 'convective-outlook',
	title: 'SPC Day 1 Convective Outlook',
	subtitle: 'Test fixture',
	projection: { kind: 'lambert', parallels: [33, 45], rotate: [-96, -39] },
	extent: 'conus',
	sources: {
		outlook: 'cache://spc/test.json',
	},
};

const FIXTURE = {
	issued: '2024-05-21T13:00:00Z',
	valid_from: '2024-05-21T12:00:00Z',
	valid_to: '2024-05-22T12:00:00Z',
	day: 1,
	polygons: [
		{
			id: 'SPC-TSTM-1',
			tier: 'tstm',
			label: 'TSTM',
			rings: [
				[
					[-105, 28],
					[-78, 28],
					[-78, 47],
					[-105, 47],
					[-105, 28],
				],
			],
		},
		{
			id: 'SPC-MRGL-1',
			tier: 'mrgl',
			label: 'MRGL',
			rings: [
				[
					[-100, 31],
					[-80, 31],
					[-80, 43],
					[-100, 43],
					[-100, 31],
				],
			],
		},
		{
			id: 'SPC-SLGT-1',
			tier: 'slgt',
			label: 'SLGT',
			rings: [
				[
					[-101, 32],
					[-86, 32],
					[-86, 41],
					[-101, 41],
					[-101, 32],
				],
			],
		},
		{
			id: 'SPC-ENH-1',
			tier: 'enh',
			label: 'ENH',
			rings: [
				[
					[-101, 33],
					[-92, 33],
					[-92, 40],
					[-101, 40],
					[-101, 33],
				],
			],
		},
		{
			id: 'SPC-MDT-1',
			tier: 'mdt',
			label: 'MDT',
			rings: [
				[
					[-100, 33],
					[-94, 33],
					[-94, 39],
					[-100, 39],
					[-100, 33],
				],
			],
		},
		{
			id: 'SPC-HIGH-1',
			tier: 'high',
			label: 'HIGH',
			rings: [
				[
					[-99, 33.5],
					[-96, 33.5],
					[-96, 37.5],
					[-99, 37.5],
					[-99, 33.5],
				],
			],
		},
	],
};

describe('renderConvectiveOutlook (Phase D end-to-end)', () => {
	it('renders all six SPC tiers with chrome legend + day label', async () => {
		const basemapJson = readFileSync(BASEMAP_PATH, 'utf8');
		const result = await renderConvectiveOutlook({
			spec: SPEC,
			sources: { outlook: JSON.stringify(FIXTURE), basemap: basemapJson },
			basemapPath: BASEMAP_PATH,
			libraryVersion: '@ab/wx-charts@0.1.0-test',
		});
		expect(result.svg).toMatch(/^<\?xml version="1\.0" encoding="UTF-8"\?>\n<svg /);
		for (const band of LAYER_BAND_VALUES) {
			expect(result.svg).toContain(`<g class="layer-${band}"`);
		}
		expect(result.svg).toContain('polygon-spc-tstm');
		expect(result.svg).toContain('polygon-spc-mrgl');
		expect(result.svg).toContain('polygon-spc-slgt');
		expect(result.svg).toContain('polygon-spc-enh');
		expect(result.svg).toContain('polygon-spc-mdt');
		expect(result.svg).toContain('polygon-spc-high');
		// Chrome legend with day + tier labels.
		expect(result.svg).toContain('SPC DAY 1 CONVECTIVE OUTLOOK');
		expect(result.svg).toContain('SPC CATEGORICAL RISK');
		expect(result.svg).toContain('Day 1 convective outlook');
		expect(result.svg).toContain('TSTM (General thunder)');
		expect(result.svg).toContain('HIGH (High risk)');
		expect(result.svg).toContain('CONUS - SPC Day 1');
		// Meta sanity.
		expect(result.meta.parser_warnings).toHaveLength(0);
		expect(result.meta.layer_counts['vector-symbology']).toBe(6);
	});

	it('z-orders TSTM at back, HIGH at front regardless of input order', async () => {
		const basemapJson = readFileSync(BASEMAP_PATH, 'utf8');
		// Reverse the input order; the renderer should still draw TSTM
		// first (back) and HIGH last (front).
		const reversed = { ...FIXTURE, polygons: [...FIXTURE.polygons].reverse() };
		const result = await renderConvectiveOutlook({
			spec: SPEC,
			sources: { outlook: JSON.stringify(reversed), basemap: basemapJson },
			basemapPath: BASEMAP_PATH,
			libraryVersion: '@ab/wx-charts@0.1.0-test',
		});
		const tstmIdx = result.svg.indexOf('polygon-spc-tstm');
		const highIdx = result.svg.indexOf('polygon-spc-high');
		expect(tstmIdx).toBeGreaterThan(0);
		expect(highIdx).toBeGreaterThan(0);
		expect(tstmIdx).toBeLessThan(highIdx);
	});

	it('is deterministic: render twice -> same SVG bytes', async () => {
		const basemapJson = readFileSync(BASEMAP_PATH, 'utf8');
		const input = {
			spec: SPEC,
			sources: { outlook: JSON.stringify(FIXTURE), basemap: basemapJson },
			basemapPath: BASEMAP_PATH,
			libraryVersion: '@ab/wx-charts@0.1.0-test',
		};
		const a = await renderConvectiveOutlook(input);
		const b = await renderConvectiveOutlook(input);
		expect(a.svg).toBe(b.svg);
	});

	it('rejects missing outlook source', async () => {
		const basemapJson = readFileSync(BASEMAP_PATH, 'utf8');
		await expect(
			renderConvectiveOutlook({
				spec: SPEC,
				sources: { basemap: basemapJson },
				basemapPath: BASEMAP_PATH,
				libraryVersion: '@ab/wx-charts@0.1.0-test',
			}),
		).rejects.toThrow(/outlook/);
	});

	it('rejects unknown tier value', async () => {
		const basemapJson = readFileSync(BASEMAP_PATH, 'utf8');
		const bad = {
			polygons: [
				{
					id: 'BAD-1',
					tier: 'extreme',
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
			],
		};
		await expect(
			renderConvectiveOutlook({
				spec: SPEC,
				sources: { outlook: JSON.stringify(bad), basemap: basemapJson },
				basemapPath: BASEMAP_PATH,
				libraryVersion: '@ab/wx-charts@0.1.0-test',
			}),
		).rejects.toThrow();
	});

	it('hides legend when show_legend disabled', async () => {
		const basemapJson = readFileSync(BASEMAP_PATH, 'utf8');
		const result = await renderConvectiveOutlook({
			spec: { ...SPEC, options: { show_legend: false } },
			sources: { outlook: JSON.stringify(FIXTURE), basemap: basemapJson },
			basemapPath: BASEMAP_PATH,
			libraryVersion: '@ab/wx-charts@0.1.0-test',
		});
		expect(result.svg).not.toContain('SPC CATEGORICAL RISK');
	});
});
