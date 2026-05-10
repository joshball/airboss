/**
 * Unit tests for the ESRI world-file parser + helpers.
 *
 * Per WP test plan: the worldfile parser is the foundation of the radar
 * warp's geospatial sampling. Tests exercise (1) parsing the canonical
 * 6-line shape, (2) round-tripping pixel <-> world coords, (3) the
 * inverse helper's degenerate-transform guard.
 */

import { describe, expect, it } from 'vitest';
import { parseWorldFile, pixelToWorld, type WorldFile, worldToPixel } from '../raster/worldfile';

describe('parseWorldFile', () => {
	it('parses the canonical IEM n0r world file (Plate Carree, 0.01 deg per pixel)', () => {
		// Real worldfile bytes for the IEM NEXRAD n0r product:
		// 6000x2600 px, 0.01 deg per pixel, top-left corner at -126W / +50N.
		const text = '0.01\n0.0\n0.0\n-0.01\n-126.0\n50.0\n';
		const wf = parseWorldFile(text);
		expect(wf).toEqual<WorldFile>({
			pixelWidth: 0.01,
			rotationY: 0,
			rotationX: 0,
			pixelHeight: -0.01,
			upperLeftX: -126.0,
			upperLeftY: 50.0,
		});
	});

	it('accepts space- or tab-separated tokens', () => {
		const text = '0.01 0 0\t-0.01\n-126.0  50.0';
		const wf = parseWorldFile(text);
		expect(wf.pixelWidth).toBe(0.01);
		expect(wf.upperLeftY).toBe(50.0);
	});

	it('rejects files without exactly six tokens', () => {
		expect(() => parseWorldFile('0.01\n0\n0\n-0.01\n-126\n')).toThrow(/expected 6 numeric values/);
		expect(() => parseWorldFile('0.01 0 0 -0.01 -126 50 9')).toThrow(/expected 6 numeric values/);
	});

	it('rejects non-numeric tokens', () => {
		expect(() => parseWorldFile('0.01\nabc\n0\n-0.01\n-126\n50')).toThrow(/not a finite number/);
	});
});

describe('pixelToWorld + worldToPixel round-trip', () => {
	const wf: WorldFile = {
		pixelWidth: 0.01,
		rotationY: 0,
		rotationX: 0,
		pixelHeight: -0.01,
		upperLeftX: -126.0,
		upperLeftY: 50.0,
	};

	it('maps pixel (0, 0) to the upper-left world coord', () => {
		const [x, y] = pixelToWorld(wf, 0, 0);
		expect(x).toBeCloseTo(-126.0, 6);
		expect(y).toBeCloseTo(50.0, 6);
	});

	it('round-trips a pixel coord through pixelToWorld + worldToPixel', () => {
		const [x, y] = pixelToWorld(wf, 1234, 567);
		const [px, py] = worldToPixel(wf, x, y);
		expect(px).toBeCloseTo(1234, 6);
		expect(py).toBeCloseTo(567, 6);
	});

	it('round-trips a world coord through worldToPixel + pixelToWorld', () => {
		// KIAH ~ -95.342, 29.984 (well inside the IEM extent).
		const [px, py] = worldToPixel(wf, -95.342, 29.984);
		const [x, y] = pixelToWorld(wf, px, py);
		expect(x).toBeCloseTo(-95.342, 6);
		expect(y).toBeCloseTo(29.984, 6);
	});

	it('rejects degenerate transforms', () => {
		const degenerate: WorldFile = { ...wf, pixelWidth: 0, pixelHeight: 0, rotationX: 0, rotationY: 0 };
		expect(() => worldToPixel(degenerate, 0, 0)).toThrow(/degenerate affine transform/);
	});
});
