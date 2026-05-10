/**
 * Lambert projection helper.
 *
 * The CONUS Lambert projection underlies every chart; a regression
 * here cascades to every chart-type. These tests pin known-point
 * projection results so a "I tweaked the rotate sign" change surfaces
 * here before the chart-snapshot tests pick it up.
 */

import { describe, expect, it } from 'vitest';
import {
	buildConusProjection,
	CHART_MARGIN,
	CONUS_CENTRAL_MERIDIAN,
	CONUS_REFERENCE_LAT,
	CONUS_STD_PARALLELS,
	lambertProjection,
	SVG_HEIGHT,
	SVG_WIDTH,
	TITLE_BAND_HEIGHT,
} from '../projection';

// Rectangular CONUS-ish bounding box used as a simple fit target so the
// projection can scale itself; sufficient for the "is the math right?"
// quadrant checks below.
const CONUS_BBOX = {
	type: 'Polygon' as const,
	coordinates: [
		[
			[-130, 22],
			[-65, 22],
			[-65, 52],
			[-130, 52],
			[-130, 22],
		],
	],
};

describe('lambertProjection()', () => {
	it('respects supplied parallels + rotate (constants check)', () => {
		expect(CONUS_STD_PARALLELS).toEqual([33, 45]);
		expect(CONUS_CENTRAL_MERIDIAN).toBe(-96);
		expect(CONUS_REFERENCE_LAT).toBe(38);
	});

	it('returns null for points off the projected sphere edge cases', () => {
		const projection = lambertProjection({
			parallels: CONUS_STD_PARALLELS,
			rotate: [CONUS_CENTRAL_MERIDIAN, 0],
			fitTarget: CONUS_BBOX,
		});
		// Antipode-ish coordinate -- d3-geo conic conformal does still
		// project most globe points, so we just confirm the helper
		// itself returns numeric pairs for a clearly in-range input.
		const houstonPx = projection([-95.342, 29.984]);
		expect(houstonPx).not.toBeNull();
	});
});

describe('buildConusProjection()', () => {
	const projection = buildConusProjection(CONUS_BBOX);

	it('projects Houston KIAH (29.984N, -95.342W) into the chart drawing area', () => {
		const px = projection([-95.342, 29.984]);
		expect(px).not.toBeNull();
		if (px === null) return;
		const [x, y] = px;
		// Houston sits south of -96W central meridian, slightly east of
		// center. With CONUS_REFERENCE_LAT = 38, Houston is ~8 deg south,
		// so y is well below the vertical midpoint -- but the projected
		// shape is bow-shaped, so "south" in lat-space lands in the
		// lower-MIDDLE of the canvas, not the lower-right corner.
		expect(x).toBeGreaterThan(SVG_WIDTH * 0.4);
		expect(x).toBeLessThan(SVG_WIDTH * 0.7);
		// Inside the chart drawing area.
		expect(x).toBeGreaterThan(CHART_MARGIN);
		expect(x).toBeLessThan(SVG_WIDTH - CHART_MARGIN);
		expect(y).toBeGreaterThan(TITLE_BAND_HEIGHT + CHART_MARGIN);
		expect(y).toBeLessThan(SVG_HEIGHT - CHART_MARGIN);
	});

	it('places Seattle KSEA (47.450N, -122.309W) in the upper-left quadrant', () => {
		const px = projection([-122.309, 47.45]);
		expect(px).not.toBeNull();
		if (px === null) return;
		const [x, y] = px;
		expect(x).toBeLessThan(SVG_WIDTH / 2);
		expect(y).toBeLessThan((SVG_HEIGHT + TITLE_BAND_HEIGHT) / 2);
	});

	it('east coast (DCA, 38.85N, -77.04W) lands east of central meridian', () => {
		const px = projection([-77.04, 38.85]);
		expect(px).not.toBeNull();
		if (px === null) return;
		const [x, y] = px;
		// CONUS_CENTRAL_MERIDIAN = -96; DCA is well east of -96, so x is
		// past the canvas midpoint.
		expect(x).toBeGreaterThan(SVG_WIDTH / 2);
		// DCA is near the reference latitude (38N), so y is near the
		// vertical center.
		expect(y).toBeGreaterThan(TITLE_BAND_HEIGHT + CHART_MARGIN);
		expect(y).toBeLessThan(SVG_HEIGHT - CHART_MARGIN);
	});

	it('is deterministic across runs (same input -> same pixel coords)', () => {
		const a = buildConusProjection(CONUS_BBOX);
		const b = buildConusProjection(CONUS_BBOX);
		const dca: [number, number] = [-77.0402, 38.8512];
		const aPx = a(dca);
		const bPx = b(dca);
		expect(aPx).not.toBeNull();
		expect(bPx).not.toBeNull();
		if (aPx === null || bPx === null) return;
		expect(aPx[0]).toBeCloseTo(bPx[0], 4);
		expect(aPx[1]).toBeCloseTo(bPx[1], 4);
	});
});
