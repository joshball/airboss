/**
 * End-to-end render tests for the Phase F satellite chart trio
 * (IR / VIS / WV).
 *
 * Each test generates a synthetic single-channel raster + worldfile in
 * memory, feeds it through the renderer with the basemap passed via the
 * `input.sources.basemap` test seam, and asserts:
 *
 *   - Every canonical layer band is present in the SVG.
 *   - The chart's chrome renders title + library version + per-band
 *     legend headers.
 *   - The raster overlay band carries an embedded base64 PNG.
 *   - drawn_pixels > 0 (the warp landed actual pixels on the canvas).
 *   - Re-rendering with the same inputs produces identical SVG bytes.
 *   - Missing required sources raise a renderer-labelled error.
 *
 * Tests are hermetic: they generate the source fixtures inline using
 * sharp via the same helper the renderer uses, so they don't depend on
 * the `~/Documents/airboss-handbook-cache/` cache being populated.
 */

import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { LAYER_BAND_VALUES } from '@ab/constants';
import sharp from 'sharp';
import { describe, expect, it } from 'vitest';
import { renderSatelliteIr, type SatelliteIrSpec } from '../charts/satellite-ir';
import { renderSatelliteVis, type SatelliteVisSpec } from '../charts/satellite-vis';
import { renderSatelliteWv, type SatelliteWvSpec } from '../charts/satellite-wv';

const REPO_ROOT = resolve(import.meta.dirname, '..', '..', '..', '..');
const BASEMAP_PATH = resolve(REPO_ROOT, 'data', 'references', 'basemaps', 'us-states-10m.json');

// ----------------------------------------------------------------------
// Synthetic single-channel raster + worldfile builder
// ----------------------------------------------------------------------

const FIXTURE_WIDTH = 240;
const FIXTURE_HEIGHT = 120;
const FIXTURE_LAT_MIN = 24;
const FIXTURE_LAT_MAX = 50;
const FIXTURE_LON_MIN = -126;
const FIXTURE_LON_MAX = -66;

interface Fixture {
	pngBytes: Uint8Array;
	worldFile: string;
}

function mulberry32(seed: number): () => number {
	let a = seed >>> 0;
	return () => {
		a = (a + 0x6d2b79f5) >>> 0;
		let t = a;
		t = Math.imul(t ^ (t >>> 15), t | 1);
		t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
		return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
	};
}

async function buildFixture(seed: number, edgeByte: number, centreByte: number): Promise<Fixture> {
	const rand = mulberry32(seed);
	const cx = FIXTURE_WIDTH / 2;
	const cy = FIXTURE_HEIGHT / 2;
	const maxR = Math.hypot(cx, cy);
	const raw = new Uint8Array(FIXTURE_WIDTH * FIXTURE_HEIGHT);
	for (let py = 0; py < FIXTURE_HEIGHT; py += 1) {
		for (let px = 0; px < FIXTURE_WIDTH; px += 1) {
			const dx = px - cx;
			const dy = py - cy;
			const r = Math.hypot(dx, dy);
			const t = Math.min(r / maxR, 1);
			const ramp = 0.5 - 0.5 * Math.cos(t * Math.PI);
			let v = centreByte + (edgeByte - centreByte) * ramp;
			v += (rand() - 0.5) * 16;
			v = Math.max(1, Math.min(254, Math.round(v)));
			raw[py * FIXTURE_WIDTH + px] = v;
		}
	}
	const png = await sharp(Buffer.from(raw), { raw: { width: FIXTURE_WIDTH, height: FIXTURE_HEIGHT, channels: 1 } })
		.png()
		.toBuffer();
	const dx = (FIXTURE_LON_MAX - FIXTURE_LON_MIN) / FIXTURE_WIDTH;
	const dy = -(FIXTURE_LAT_MAX - FIXTURE_LAT_MIN) / FIXTURE_HEIGHT;
	const ulX = FIXTURE_LON_MIN + dx / 2;
	const ulY = FIXTURE_LAT_MAX + dy / 2;
	const worldFile =
		[dx.toFixed(8), '0.00000000', '0.00000000', dy.toFixed(8), ulX.toFixed(8), ulY.toFixed(8)].join('\n') + '\n';
	return { pngBytes: new Uint8Array(png), worldFile };
}

// ----------------------------------------------------------------------
// Shared helpers
// ----------------------------------------------------------------------

function expectChartShape(svg: string): void {
	expect(svg).toMatch(/^<\?xml version="1\.0" encoding="UTF-8"\?>\n<svg /);
	expect(svg).toContain('width="1200"');
	expect(svg).toContain('height="780"');
	for (const band of LAYER_BAND_VALUES) {
		expect(svg).toContain(`<g class="layer-${band}"`);
	}
	expect(svg).toContain('href="data:image/png;base64,');
}

const SOURCE_BOUNDS = {
	lon_min: FIXTURE_LON_MIN,
	lon_max: FIXTURE_LON_MAX,
	lat_min: FIXTURE_LAT_MIN,
	lat_max: FIXTURE_LAT_MAX,
} as const;

const PROJECTION = {
	kind: 'lambert' as const,
	parallels: [33, 45] as [number, number],
	rotate: [-96, 0] as [number, number],
};

// ----------------------------------------------------------------------
// IR
// ----------------------------------------------------------------------

describe('renderSatelliteIr (Phase F end-to-end)', () => {
	const SPEC: SatelliteIrSpec = {
		slug: 'wx-satellite-ir-test',
		type: 'satellite-ir',
		title: 'GOES IR Satellite',
		subtitle: 'test fixture',
		projection: PROJECTION,
		extent: 'conus',
		sources: {
			ir_png: 'inline://test',
			ir_world: 'inline://test',
		},
		options: {
			raster_opacity: 0.92,
			show_legend: true,
			source_bounds: SOURCE_BOUNDS,
			palette_mode: 'apply',
			bt_min_c: -90,
			bt_max_c: 40,
		},
	};

	it('renders a synthetic IR fixture into a complete SVG', async () => {
		const basemapJson = readFileSync(BASEMAP_PATH, 'utf8');
		const fixture = await buildFixture(0xa1a1, 187, 25);
		const result = await renderSatelliteIr({
			spec: SPEC,
			sources: {
				ir_png: fixture.pngBytes,
				ir_world: fixture.worldFile,
				basemap: basemapJson,
			},
			basemapPath: BASEMAP_PATH,
			libraryVersion: '@ab/wx-charts@0.1.0-test',
		});

		expectChartShape(result.svg);
		expect(result.svg).toContain('GOES IR SATELLITE');
		expect(result.svg).toContain('CLOUD-TOP TEMP (deg C)');
		expect(result.svg).toContain('@ab/wx-charts@0.1.0-test');
		expect(result.meta.parser_warnings).toHaveLength(0);
		expect(result.meta.layer_counts['raster-overlay']).toBe(1);
		expect(result.meta.drawn_pixels).toBeGreaterThan(1000);
	});

	it('is deterministic: same fixture -> same SVG bytes', async () => {
		const basemapJson = readFileSync(BASEMAP_PATH, 'utf8');
		const fixture = await buildFixture(0xa1a1, 187, 25);
		const input = {
			spec: SPEC,
			sources: {
				ir_png: fixture.pngBytes,
				ir_world: fixture.worldFile,
				basemap: basemapJson,
			},
			basemapPath: BASEMAP_PATH,
			libraryVersion: '@ab/wx-charts@0.1.0-test',
		};
		const a = await renderSatelliteIr(input);
		const b = await renderSatelliteIr(input);
		expect(a.svg).toBe(b.svg);
	});

	it('rejects missing required source ir_png', async () => {
		const basemapJson = readFileSync(BASEMAP_PATH, 'utf8');
		const fixture = await buildFixture(0xa1a1, 187, 25);
		await expect(
			renderSatelliteIr({
				spec: SPEC,
				sources: {
					ir_world: fixture.worldFile,
					basemap: basemapJson,
				},
				basemapPath: BASEMAP_PATH,
				libraryVersion: '@ab/wx-charts@0.1.0-test',
			}),
		).rejects.toThrow(/ir_png/);
	});
});

// ----------------------------------------------------------------------
// VIS
// ----------------------------------------------------------------------

describe('renderSatelliteVis (Phase F end-to-end)', () => {
	const SPEC: SatelliteVisSpec = {
		slug: 'wx-satellite-vis-test',
		type: 'satellite-visible',
		title: 'GOES Visible Satellite',
		subtitle: 'test fixture',
		projection: PROJECTION,
		extent: 'conus',
		sources: {
			vis_png: 'inline://test',
			vis_world: 'inline://test',
		},
		options: {
			raster_opacity: 0.95,
			show_legend: true,
			source_bounds: SOURCE_BOUNDS,
			palette_mode: 'apply',
		},
	};

	it('renders a synthetic VIS fixture into a complete SVG', async () => {
		const basemapJson = readFileSync(BASEMAP_PATH, 'utf8');
		const fixture = await buildFixture(0xb2b2, 30, 220);
		const result = await renderSatelliteVis({
			spec: SPEC,
			sources: {
				vis_png: fixture.pngBytes,
				vis_world: fixture.worldFile,
				basemap: basemapJson,
			},
			basemapPath: BASEMAP_PATH,
			libraryVersion: '@ab/wx-charts@0.1.0-test',
		});

		expectChartShape(result.svg);
		expect(result.svg).toContain('GOES VISIBLE SATELLITE');
		expect(result.svg).toContain('REFLECTANCE (0-255)');
		expect(result.meta.layer_counts['raster-overlay']).toBe(1);
		expect(result.meta.drawn_pixels).toBeGreaterThan(1000);
	});

	it('is deterministic: same fixture -> same SVG bytes', async () => {
		const basemapJson = readFileSync(BASEMAP_PATH, 'utf8');
		const fixture = await buildFixture(0xb2b2, 30, 220);
		const input = {
			spec: SPEC,
			sources: {
				vis_png: fixture.pngBytes,
				vis_world: fixture.worldFile,
				basemap: basemapJson,
			},
			basemapPath: BASEMAP_PATH,
			libraryVersion: '@ab/wx-charts@0.1.0-test',
		};
		const a = await renderSatelliteVis(input);
		const b = await renderSatelliteVis(input);
		expect(a.svg).toBe(b.svg);
	});

	it('rejects missing required source vis_world', async () => {
		const basemapJson = readFileSync(BASEMAP_PATH, 'utf8');
		const fixture = await buildFixture(0xb2b2, 30, 220);
		await expect(
			renderSatelliteVis({
				spec: SPEC,
				sources: {
					vis_png: fixture.pngBytes,
					basemap: basemapJson,
				},
				basemapPath: BASEMAP_PATH,
				libraryVersion: '@ab/wx-charts@0.1.0-test',
			}),
		).rejects.toThrow(/vis_world/);
	});
});

// ----------------------------------------------------------------------
// WV
// ----------------------------------------------------------------------

describe('renderSatelliteWv (Phase F end-to-end)', () => {
	const SPEC: SatelliteWvSpec = {
		slug: 'wx-satellite-wv-test',
		type: 'satellite-water-vapor',
		title: 'GOES Water Vapor Satellite',
		subtitle: 'test fixture',
		projection: PROJECTION,
		extent: 'conus',
		sources: {
			wv_png: 'inline://test',
			wv_world: 'inline://test',
		},
		options: {
			raster_opacity: 0.92,
			show_legend: true,
			source_bounds: SOURCE_BOUNDS,
			palette_mode: 'apply',
			bt_min_c: -80,
			bt_max_c: 20,
		},
	};

	it('renders a synthetic WV fixture into a complete SVG', async () => {
		const basemapJson = readFileSync(BASEMAP_PATH, 'utf8');
		const fixture = await buildFixture(0xc3c3, 230, 38);
		const result = await renderSatelliteWv({
			spec: SPEC,
			sources: {
				wv_png: fixture.pngBytes,
				wv_world: fixture.worldFile,
				basemap: basemapJson,
			},
			basemapPath: BASEMAP_PATH,
			libraryVersion: '@ab/wx-charts@0.1.0-test',
		});

		expectChartShape(result.svg);
		expect(result.svg).toContain('GOES WATER VAPOR SATELLITE');
		expect(result.svg).toContain('WV BRIGHTNESS TEMP (deg C)');
		expect(result.meta.layer_counts['raster-overlay']).toBe(1);
		expect(result.meta.drawn_pixels).toBeGreaterThan(1000);
	});

	it('is deterministic: same fixture -> same SVG bytes', async () => {
		const basemapJson = readFileSync(BASEMAP_PATH, 'utf8');
		const fixture = await buildFixture(0xc3c3, 230, 38);
		const input = {
			spec: SPEC,
			sources: {
				wv_png: fixture.pngBytes,
				wv_world: fixture.worldFile,
				basemap: basemapJson,
			},
			basemapPath: BASEMAP_PATH,
			libraryVersion: '@ab/wx-charts@0.1.0-test',
		};
		const a = await renderSatelliteWv(input);
		const b = await renderSatelliteWv(input);
		expect(a.svg).toBe(b.svg);
	});

	it('rejects missing required source wv_png', async () => {
		const basemapJson = readFileSync(BASEMAP_PATH, 'utf8');
		const fixture = await buildFixture(0xc3c3, 230, 38);
		await expect(
			renderSatelliteWv({
				spec: SPEC,
				sources: {
					wv_world: fixture.worldFile,
					basemap: basemapJson,
				},
				basemapPath: BASEMAP_PATH,
				libraryVersion: '@ab/wx-charts@0.1.0-test',
			}),
		).rejects.toThrow(/wv_png/);
	});
});
