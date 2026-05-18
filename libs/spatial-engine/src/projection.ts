/**
 * Regional Lambert Conformal Conic projection helpers.
 *
 * Mirrors `libs/wx-charts/src/projection.ts`. The XC viewer renders one
 * sectional region at a time, so the projection is fitted per region from
 * the `XC_REGION_PROJECTIONS` table rather than the CONUS-wide default.
 *
 * Browser-safe: pure `d3-geo`, no Node imports. Re-exported as a value
 * from the server barrel (the engine uses it during bundle composition);
 * the projection-options type is re-exported from the runtime barrel for
 * the renderer.
 *
 * See `docs/work-packages/xc-viewer-v1/tasks.md` A.4.
 */

import { XC_REGION_PROJECTIONS, type XcRegion } from '@ab/constants';
import { type ExtendedFeatureCollection, type GeoGeometryObjects, type GeoProjection, geoConicConformal } from 'd3-geo';

/** Default rendered SVG width in user units. */
export const SECTIONAL_SVG_WIDTH = 1280;
/** Default rendered SVG height in user units. */
export const SECTIONAL_SVG_HEIGHT = 800;
/** Margin reserved on every side when fitting the projection. */
export const SECTIONAL_MARGIN = 32;

/** Geographic shape acceptable to a fit target -- matches d3-geo's arg shape. */
export type FitTarget =
	| GeoGeometryObjects
	| ExtendedFeatureCollection
	| { type: 'Feature'; geometry: GeoGeometryObjects | null; properties: unknown };

/** Options for `regionalLambertProjection`. */
export interface RegionalProjectionOptions {
	/** Override the rendered canvas width. */
	width?: number;
	/** Override the rendered canvas height. */
	height?: number;
	/** Override the per-side margin. */
	margin?: number;
	/**
	 * If supplied, fits the projection to this GeoJSON shape inside the
	 * canvas extent. Pass the region's basemap feature collection so the
	 * region fills the viewport.
	 */
	fitTarget?: FitTarget;
}

/**
 * Construct the Lambert Conformal Conic projection for a sectional region.
 *
 * The standard parallels + central meridian + reference center come from
 * `XC_REGION_PROJECTIONS` keyed by `XcRegion`. Pass `fitTarget` (the
 * region basemap) to size the projection so the region fills the canvas.
 */
export function regionalLambertProjection(region: XcRegion, opts: RegionalProjectionOptions = {}): GeoProjection {
	const params = XC_REGION_PROJECTIONS[region];
	const width = opts.width ?? SECTIONAL_SVG_WIDTH;
	const height = opts.height ?? SECTIONAL_SVG_HEIGHT;
	const margin = opts.margin ?? SECTIONAL_MARGIN;

	const projection = geoConicConformal()
		.parallels([params.parallels[0], params.parallels[1]])
		.rotate([-params.rotate[0], -params.rotate[1]])
		.center([params.center[0], params.center[1]]);

	if (opts.fitTarget !== undefined) {
		const extent: [[number, number], [number, number]] = [
			[margin, margin],
			[width - margin, height - margin],
		];
		projection.fitExtent(extent, opts.fitTarget as Parameters<typeof projection.fitExtent>[1]);
	} else {
		// Without a fit target, scale + translate to put the reference
		// center near the canvas center. Callers that want the region to
		// fill the viewport should pass `fitTarget`.
		projection.translate([width / 2, height / 2]).scale(width * 4);
	}

	return projection;
}
