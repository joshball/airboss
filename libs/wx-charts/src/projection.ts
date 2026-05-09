/**
 * Lambert Conformal Conic projection helpers.
 *
 * FAA convention: standard parallels 33 degN and 45 degN. Reference
 * latitude/longitude centered on the continental US (96 degW, 38 degN).
 * `d3-geo`'s `geoConicConformal` is the right call -- pass parallels via
 * `.parallels([phi1, phi2])` and rotate via `.rotate([-lon0, 0])`.
 *
 * Output canvas defaults: 1200 x 780 SVG with a 60 px reserved title band
 * at the top. The projection is fitted into the area below the title band
 * with a 24 px margin on every side.
 *
 * Browser-safe: pure d3-geo, no Node imports.
 *
 * Ported from `spikes/wx-charts/01-surface-analysis/src/projection.ts`.
 */

import { type ExtendedFeatureCollection, type GeoGeometryObjects, type GeoProjection, geoConicConformal } from 'd3-geo';

/**
 * Geographic shape acceptable to `fitTarget`. Matches d3-geo's
 * `geoPath`/`fitExtent` arg shape: GeoJSON Feature, FeatureCollection,
 * Geometry, or GeometryCollection. The narrower type (vs `GeoJsonObject`)
 * avoids a TS conversion error against `projection.fitExtent`.
 */
export type FitTarget =
	| GeoGeometryObjects
	| ExtendedFeatureCollection
	| { type: 'Feature'; geometry: GeoGeometryObjects | null; properties: unknown };

export const CONUS_STD_PARALLELS: readonly [number, number] = [33, 45];
export const CONUS_CENTRAL_MERIDIAN = -96;
export const CONUS_REFERENCE_LAT = 38;

export const SVG_WIDTH = 1200;
export const SVG_HEIGHT = 780;
export const TITLE_BAND_HEIGHT = 60;
export const CHART_MARGIN = 24;

export interface LambertProjectionOptions {
	/**
	 * Standard parallels for the cone, in degrees latitude. FAA convention
	 * is `[33, 45]` for CONUS; other projections may pick wider or narrower
	 * spreads depending on the region's latitude band.
	 */
	parallels: readonly [number, number];
	/**
	 * `[lon0, lat0]` in degrees, signed per d3-geo convention: positive is
	 * east / north. For the CONUS default, `lon0 = -96` (west) becomes
	 * `rotate([+96, 0])`. Pass the geographic value here; the helper
	 * applies the d3-geo sign flip.
	 */
	rotate: readonly [number, number];
	/**
	 * `[lon, lat]` reference center in degrees. Defaults to CONUS center
	 * `[0, 38]` (latitude only after rotate).
	 */
	center?: readonly [number, number];
	/**
	 * If supplied, fits the projection to this GeoJSON inside `[[minX, minY], [maxX, maxY]]`.
	 * For CONUS, pass the CONUS-only states FeatureCollection as the fit
	 * target: the us-atlas `nation` outline includes Alaska/Hawaii/PR which
	 * stretches the projection into a tall, skinny band.
	 */
	fitTarget?: FitTarget;
	/**
	 * `[[x0, y0], [x1, y1]]` extent the fit target should fill. Defaults to
	 * the area below the title band with `CHART_MARGIN` padding.
	 */
	fitExtent?: readonly [readonly [number, number], readonly [number, number]];
}

/**
 * Construct a Lambert Conformal Conic projection. Pass `fitTarget` to
 * size the projection to a region; pass `fitExtent` to control the box
 * the fit target should fill.
 */
export function lambertProjection(opts: LambertProjectionOptions): GeoProjection {
	const projection = geoConicConformal()
		.parallels([opts.parallels[0], opts.parallels[1]])
		.rotate([-opts.rotate[0], -opts.rotate[1]]);

	if (opts.center !== undefined) {
		projection.center([opts.center[0], opts.center[1]]);
	}

	if (opts.fitTarget !== undefined) {
		const extent = (opts.fitExtent ?? [
			[CHART_MARGIN, TITLE_BAND_HEIGHT + CHART_MARGIN],
			[SVG_WIDTH - CHART_MARGIN, SVG_HEIGHT - CHART_MARGIN],
		]) as [[number, number], [number, number]];
		// d3-geo's fitExtent accepts GeoJSON Features / FeatureCollections /
		// Geometries / GeometryCollections. Our FitTarget alias subset
		// matches all four; the cast is structural.
		projection.fitExtent(extent, opts.fitTarget as Parameters<typeof projection.fitExtent>[1]);
	}

	return projection;
}

/**
 * Convenience: build the canonical CONUS Lambert projection fitted to the
 * supplied CONUS-only states FeatureCollection. The reserved title-band
 * area is preserved at the top of the canvas.
 */
export function buildConusProjection(fitTarget: FitTarget): GeoProjection {
	return lambertProjection({
		parallels: CONUS_STD_PARALLELS,
		rotate: [CONUS_CENTRAL_MERIDIAN, 0],
		center: [0, CONUS_REFERENCE_LAT],
		fitTarget,
	});
}
