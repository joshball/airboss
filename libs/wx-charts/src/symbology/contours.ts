/**
 * Scalar-field contour renderer using `d3-contour`.
 *
 * Reusable across any scalar-field overlay (sea-level pressure isobars,
 * 500 mb heights, isotachs, isotherms, dewpoint, ...). Ported from
 * `spikes/wx-charts/01-surface-analysis/src/isobars.ts` and generalized
 * to accept the grid + thresholds + projection + styling per call.
 *
 * Inputs are a regular grid in lon/lat space; the contours are computed
 * in grid index space (per `d3-contour` convention) and projected to
 * screen via the supplied `gridToLonLat` mapper.
 *
 * Browser-safe: pure d3-geo + d3-contour, no Node imports.
 */

import { contours } from 'd3-contour';
import { type GeoProjection, geoPath } from 'd3-geo';

export interface ScalarContourOptions {
	/** Grid values laid out row-major: `grid[iy * gridWidth + ix]`. */
	grid: Float64Array | number[];
	gridWidth: number;
	gridHeight: number;
	/** Contour thresholds (e.g. every 4 mb anchored at 1012). */
	thresholds: number[];
	/** Mapper from grid (gx, gy) -> [lon, lat]. */
	gridToLonLat: (gx: number, gy: number) => [number, number];
	projection: GeoProjection;
	/** Optional: emphasize every Nth threshold (e.g. every 8 mb). */
	emphasizeEvery?: number;
	/** Stroke for non-emphasized contours. */
	stroke?: string;
	/** Stroke for emphasized contours. */
	emphasizedStroke?: string;
	strokeWidth?: number;
	emphasizedStrokeWidth?: number;
}

export interface ScalarContourResult {
	svg: string;
	contourCount: number;
}

const DEFAULT_STROKE = '#9a9587';
const DEFAULT_EMPHASIZED_STROKE = '#5a5750';

/**
 * Compute and render scalar-field contours. Returns the inner SVG
 * fragment plus the raw contour count for `meta.json` provenance.
 */
export function renderScalarContours(opts: ScalarContourOptions): ScalarContourResult {
	const {
		grid,
		gridWidth,
		gridHeight,
		thresholds,
		gridToLonLat,
		projection,
		emphasizeEvery = 0,
		stroke = DEFAULT_STROKE,
		emphasizedStroke = DEFAULT_EMPHASIZED_STROKE,
		strokeWidth = 0.7,
		emphasizedStrokeWidth = 1.0,
	} = opts;

	const path = geoPath(projection);
	const contourGen = contours().size([gridWidth, gridHeight]).thresholds(thresholds);
	// d3-contour's signature is `(values: number[]) -> ContourMultiPolygon[]`,
	// but it accepts any indexable numeric array (including TypedArray) at
	// runtime. Cast for callers that pass a Float64Array.
	const polys = contourGen(grid as unknown as number[]);

	const elements: string[] = [];
	for (const poly of polys) {
		const lonLatRings = poly.coordinates.map((polygon) =>
			polygon.map((ring) => ring.map(([gx, gy]) => gridToLonLat(gx, gy))),
		);
		for (const polygon of lonLatRings) {
			const d = path({
				type: 'MultiLineString',
				coordinates: polygon as [number, number][][],
			});
			if (d === null) continue;
			const isMain = emphasizeEvery > 0 && Math.round(poly.value) % emphasizeEvery === 0;
			const s = isMain ? emphasizedStroke : stroke;
			const w = isMain ? emphasizedStrokeWidth : strokeWidth;
			elements.push(`<path d="${d}" fill="none" stroke="${s}" stroke-width="${w}" />`);
		}
	}

	return { svg: elements.join('\n'), contourCount: polys.length };
}
