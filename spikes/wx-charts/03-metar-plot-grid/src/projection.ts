/**
 * Lambert Conformal Conic projection for CONUS, identical pattern to
 * Spikes 1+2 -- standard parallels 33/45 (FAA convention), central
 * meridian 96 degW, reference latitude 38 degN.
 *
 * Adapted from spikes/wx-charts/02-radar-mosaic/src/projection.ts.
 *
 * Third reuse confirms this is genuinely reusable across surface analysis,
 * radar mosaic, and station-model plot. The library WP should treat this
 * as a frozen primitive: same canvas, same projection, swap the body.
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

export function buildConusProjection(fitTarget: GeoJSON.GeoJsonObject): GeoProjection {
	const projection = geoConicConformal()
		.parallels(CONUS_STD_PARALLELS)
		.rotate([-CONUS_CENTRAL_MERIDIAN, 0])
		.center([0, CONUS_REFERENCE_LAT]);

	projection.fitExtent(
		[
			[CHART_MARGIN, TITLE_BAND_HEIGHT + CHART_MARGIN],
			[SVG_WIDTH - CHART_MARGIN, SVG_HEIGHT - CHART_MARGIN],
		],
		fitTarget,
	);

	return projection;
}
