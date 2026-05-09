/**
 * Lambert Conformal Conic projection for CONUS.
 *
 * FAA convention: standard parallels 33 degN and 45 degN.
 * Reference latitude/longitude centered on the continental US.
 *
 * d3-geo's `geoConicConformal` is the right call. Standard parallels
 * are passed via `.parallels([phi1, phi2])`. Center via `.center()`,
 * which moves the projected origin in projected coordinates (after
 * rotate). For CONUS we rotate longitude by -96 (so 96 degW is the
 * central meridian) and center latitude on ~38 degN.
 *
 * Output canvas: 1100 x 700 SVG. fitSize() handles the scale fit.
 */

import { geoConicConformal, type GeoProjection } from 'd3-geo';
import type { GeoJSON } from 'geojson';

export const CONUS_STD_PARALLELS: [number, number] = [33, 45];
export const CONUS_CENTRAL_MERIDIAN = -96;
export const CONUS_REFERENCE_LAT = 38;

export const SVG_WIDTH = 1200;
export const SVG_HEIGHT = 780;
export const TITLE_BAND_HEIGHT = 60;
export const CHART_MARGIN = 24;

/**
 * Construct a Lambert Conformal Conic projection fitted to a GeoJSON.
 * Pass the CONUS-only states FeatureCollection as `fitTarget` for best
 * framing. Reserves a band at the top for chart title (so the projected
 * map does not collide with the title text).
 */
export function buildConusProjection(fitTarget: GeoJSON.GeoJsonObject): GeoProjection {
	const projection = geoConicConformal()
		.parallels(CONUS_STD_PARALLELS)
		.rotate([-CONUS_CENTRAL_MERIDIAN, 0])
		.center([0, CONUS_REFERENCE_LAT]);

	// Fit into the area below the title band, with margins.
	projection.fitExtent(
		[
			[CHART_MARGIN, TITLE_BAND_HEIGHT + CHART_MARGIN],
			[SVG_WIDTH - CHART_MARGIN, SVG_HEIGHT - CHART_MARGIN],
		],
		fitTarget,
	);

	return projection;
}
