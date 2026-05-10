/**
 * `composeChart()` is the substrate's z-order contract. Two charts that
 * follow the contract compose layer-by-layer; if a renderer ships a
 * band ordering bug, every later phase compounds it. These tests guard
 * the bands-in-order invariant and the closed-band-set rule.
 */

import { LAYER_BAND_VALUES, LAYER_BANDS } from '@ab/constants';
import { describe, expect, it } from 'vitest';
import { composeChart, emptyLayerBands, LayerBandError } from '../layers';

describe('composeChart()', () => {
	it('emits one <g class="layer-{band}"> for every canonical band, in order', () => {
		const svg = composeChart({});
		// Find every layer group's class attr in order.
		const matches = [...svg.matchAll(/<g class="layer-([a-z-]+)"/g)].map((m) => m[1]);
		expect(matches).toEqual(LAYER_BAND_VALUES);
	});

	it('background precedes graticule precedes basemap-fill', () => {
		const svg = composeChart({});
		const bgIdx = svg.indexOf(`layer-${LAYER_BANDS.BACKGROUND}`);
		const gratIdx = svg.indexOf(`layer-${LAYER_BANDS.GRATICULE}`);
		const fillIdx = svg.indexOf(`layer-${LAYER_BANDS.BASEMAP_FILL}`);
		expect(bgIdx).toBeGreaterThan(0);
		expect(bgIdx).toBeLessThan(gratIdx);
		expect(gratIdx).toBeLessThan(fillIdx);
	});

	it('chrome is the topmost (last) band in the SVG', () => {
		const svg = composeChart({});
		const all = [...svg.matchAll(/<g class="layer-([a-z-]+)"/g)].map((m) => m[1]);
		expect(all[all.length - 1]).toBe(LAYER_BANDS.CHROME);
	});

	it('populated bands carry their content; missing bands render as empty <g>', () => {
		const svg = composeChart({
			background: '<rect class="bg" />',
			'basemap-fill': '<g class="states"/>',
		});
		expect(svg).toContain('<g class="layer-background"><rect class="bg" /></g>');
		expect(svg).toContain('<g class="layer-graticule"></g>');
		expect(svg).toContain('<g class="layer-basemap-fill"><g class="states"/></g>');
	});

	it('rejects unknown bands with LayerBandError naming the legal set', () => {
		expect(() =>
			composeChart({
				'not-a-band': '<g/>',
			} as never),
		).toThrow(LayerBandError);

		try {
			composeChart({ 'not-a-band': '<g/>' } as never);
		} catch (err) {
			expect(err).toBeInstanceOf(LayerBandError);
			expect((err as Error).message).toContain('not-a-band');
			for (const band of LAYER_BAND_VALUES) {
				expect((err as Error).message).toContain(band);
			}
		}
	});

	it('honors width / height / viewBox overrides', () => {
		const svg = composeChart({}, { width: 800, height: 400, viewBox: '0 0 800 400' });
		expect(svg).toContain('width="800"');
		expect(svg).toContain('height="400"');
		expect(svg).toContain('viewBox="0 0 800 400"');
	});
});

describe('emptyLayerBands()', () => {
	it('returns a map with every band initialized to empty string', () => {
		const map = emptyLayerBands();
		for (const band of LAYER_BAND_VALUES) {
			expect(map[band]).toBe('');
		}
	});
});
