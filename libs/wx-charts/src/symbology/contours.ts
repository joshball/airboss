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

/**
 * Filled scalar-band stop. Cells whose value is in `[min, max)` are filled
 * with `fill` at `fillOpacity`. Stops with `min === Number.NEGATIVE_INFINITY`
 * cover the bottom; stops with `max === Number.POSITIVE_INFINITY` cover the
 * top. Mirrors the `ScalarBandStop` shape exported from `raster/palettes`
 * (kept duplicated here so the symbology layer doesn't reach back into
 * raster -- one-way dep direction).
 */
export interface FilledBandStop {
	min: number;
	max: number;
	fill: string;
	fillOpacity: number;
}

export interface FilledScalarBandsOptions {
	/** Grid values laid out row-major: `grid[iy * gridWidth + ix]`. */
	grid: Float64Array | number[];
	gridWidth: number;
	gridHeight: number;
	bands: ReadonlyArray<FilledBandStop>;
	gridToLonLat: (gx: number, gy: number) => [number, number];
	projection: GeoProjection;
}

export interface FilledScalarBandsResult {
	svg: string;
	bandCount: number;
}

/**
 * Render filled scalar-field bands using `d3-contour`'s polygon output. For
 * each band stop, generates the contour polygon at `min` (the lower bound
 * of the band) and emits a filled SVG path. The polygons are stacked back-to-front
 * by ascending `min` so higher-value bands overlay lower-value bands; with
 * the canonical CIP / FIP / freezing-level ramps that's exactly the right
 * z-order (deeper colour on top of lighter colour for higher severity).
 *
 * A grid cell value `v` falls into band `i` iff `bands[i].min <= v < bands[i].max`.
 * Top-tier bands typically use `Number.POSITIVE_INFINITY` for `max`.
 */
export function renderFilledScalarBands(opts: FilledScalarBandsOptions): FilledScalarBandsResult {
	const { grid, gridWidth, gridHeight, bands, gridToLonLat, projection } = opts;
	if (bands.length === 0) return { svg: '', bandCount: 0 };

	const path = geoPath(projection);
	// d3-contour treats each threshold as the lower bound of a "polygon
	// containing all cells >= threshold". One band per stop; the upper
	// bound is enforced visually by stacking the next band on top.
	const thresholds = bands.map((b) => b.min);
	const contourGen = contours().size([gridWidth, gridHeight]).thresholds(thresholds);
	const polys = contourGen(grid as unknown as number[]);

	const elements: string[] = [];
	let bandCount = 0;
	for (const poly of polys) {
		// Match the polygon back to its band by min-value.
		const band = bands.find((b) => b.min === poly.value);
		if (band === undefined) continue;
		const lonLatRings = poly.coordinates.map((polygon) =>
			polygon.map((ring) => ring.map(([gx, gy]) => gridToLonLat(gx, gy))),
		);
		const features = lonLatRings.map((coords) => ({
			type: 'Polygon' as const,
			coordinates: coords as [number, number][][],
		}));
		for (const feature of features) {
			const d = path(feature);
			if (d === null) continue;
			elements.push(
				`<path d="${d}" fill="${band.fill}" fill-opacity="${band.fillOpacity.toFixed(2)}" stroke="none" />`,
			);
			bandCount += 1;
		}
	}

	return { svg: elements.join('\n'), bandCount };
}
