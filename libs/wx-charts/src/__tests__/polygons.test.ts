/**
 * Unit tests for the generic polygon-overlay primitive.
 *
 * Covers the common rendering paths the AIRMET / SIGMET chart depends
 * on: ring projection + path emission, fill / stroke / dasharray
 * styling, label placement, and the Convective SIGMET thunderstorm
 * glyph. Future Phase D consumers (GFA + convective outlook) reuse the
 * same primitive; tests stay generic so they don't bake-in assumptions
 * specific to one chart.
 */

import { geoIdentity } from 'd3-geo';
import { describe, expect, it } from 'vitest';
import { renderPolygonOverlays } from '../symbology/polygons';

// `geoIdentity` is the simplest projection -- input pixel coords pass
// through unchanged. Useful for tests that want to assert exact path
// strings without needing to reason about Lambert math.
function identityProjection() {
	return geoIdentity();
}

describe('renderPolygonOverlays', () => {
	it('renders a single fill + stroke polygon with the expected path', () => {
		const svg = renderPolygonOverlays(
			[
				{
					id: 'P1',
					rings: [
						[
							[0, 0],
							[10, 0],
							[10, 10],
							[0, 10],
						],
					],
					style: { stroke: '#ff0000', fill: '#ffaaaa', fillOpacity: 0.3 },
					classSuffix: 'test',
				},
			],
			{ projection: identityProjection() },
		);
		expect(svg).toContain('data-id="P1"');
		expect(svg).toContain('polygon-test');
		expect(svg).toContain('M 0.0 0.0 L 10.0 0.0 L 10.0 10.0 L 0.0 10.0 Z');
		expect(svg).toContain('fill="#ffaaaa"');
		expect(svg).toContain('fill-opacity="0.3"');
		expect(svg).toContain('stroke="#ff0000"');
	});

	it('honours dasharray styling', () => {
		const svg = renderPolygonOverlays(
			[
				{
					id: 'P-DASH',
					rings: [
						[
							[0, 0],
							[5, 0],
							[5, 5],
						],
					],
					style: { stroke: '#000', fill: 'none', dasharray: '4 2' },
				},
			],
			{ projection: identityProjection() },
		);
		expect(svg).toContain('stroke-dasharray="4 2"');
		expect(svg).toContain('fill="none"');
	});

	it('renders the thunderstorm glyph when style.thunderstormGlyph is true', () => {
		const svg = renderPolygonOverlays(
			[
				{
					id: 'CONV-1',
					rings: [
						[
							[0, 0],
							[10, 0],
							[10, 10],
							[0, 10],
						],
					],
					style: { stroke: '#000', fill: '#f00', thunderstormGlyph: true },
				},
			],
			{ projection: identityProjection() },
		);
		expect(svg).toContain('class="tstm-glyph"');
		expect(svg).toContain('TSTM');
	});

	it('places a label at the supplied lon/lat when provided', () => {
		const svg = renderPolygonOverlays(
			[
				{
					id: 'LABELED',
					rings: [
						[
							[0, 0],
							[10, 0],
							[10, 10],
							[0, 10],
						],
					],
					style: { stroke: '#000', fill: '#fff' },
					label: { text: 'HELLO\nWORLD' },
					labelLonLat: [5, 5],
				},
			],
			{ projection: identityProjection() },
		);
		expect(svg).toContain('<tspan x="5.0"');
		expect(svg).toContain('>HELLO</tspan>');
		expect(svg).toContain('>WORLD</tspan>');
	});

	it('skips overlays whose rings have fewer than 3 valid points after projection', () => {
		const svg = renderPolygonOverlays(
			[
				{
					id: 'P-EMPTY',
					// Only 2 points after projection -- below the polygon minimum.
					rings: [
						[
							[0, 0],
							[1, 0],
						],
					],
					style: { stroke: '#000', fill: '#000' },
				},
				{
					id: 'P-OK',
					rings: [
						[
							[0, 0],
							[5, 0],
							[5, 5],
						],
					],
					style: { stroke: '#000', fill: '#000' },
				},
			],
			{ projection: identityProjection() },
		);
		expect(svg).not.toContain('data-id="P-EMPTY"');
		expect(svg).toContain('data-id="P-OK"');
	});

	it('renders multi-ring polygons as a single path with multiple subpaths', () => {
		const svg = renderPolygonOverlays(
			[
				{
					id: 'MULTI',
					rings: [
						[
							[0, 0],
							[10, 0],
							[10, 10],
						],
						[
							[20, 20],
							[30, 20],
							[30, 30],
						],
					],
					style: { stroke: '#000', fill: '#0f0' },
				},
			],
			{ projection: identityProjection() },
		);
		// One <path> with two M...Z subpaths.
		const pathMatches = svg.match(/<path /g);
		expect(pathMatches?.length).toBe(1);
		expect(svg).toContain('M 0.0 0.0');
		expect(svg).toContain('M 20.0 20.0');
	});
});
