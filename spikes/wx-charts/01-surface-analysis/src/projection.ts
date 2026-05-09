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

export const SVG_WIDTH = 1100;
export const SVG_HEIGHT = 700;

/**
 * Construct a Lambert Conformal Conic projection fitted to a GeoJSON.
 * Pass the CONUS-only nation outline as `fitTarget` for best framing.
 */
export function buildConusProjection(fitTarget: GeoJSON.GeoJsonObject): GeoProjection {
	const projection = geoConicConformal()
		.parallels(CONUS_STD_PARALLELS)
		.rotate([-CONUS_CENTRAL_MERIDIAN, 0])
		.center([0, CONUS_REFERENCE_LAT]);

	// Fit with a small inset so chart frame doesn't hug the coastline.
	projection.fitExtent(
		[
			[20, 20],
			[SVG_WIDTH - 20, SVG_HEIGHT - 20],
		],
		fitTarget,
	);

	return projection;
}
