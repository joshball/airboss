/**
 * Geostationary projection helper for GOES satellite imagery (Phase F).
 *
 * GOES (Geostationary Operational Environmental Satellite) imagery is
 * acquired in the satellite's native geostationary projection: a perspective
 * view from a fixed point ~35,786 km above the equator. d3-geo does not
 * ship a satellite/geostationary projection -- the canonical implementation
 * lives in `d3-geo-projection` as `geoSatellite` (vertical perspective).
 *
 * `geoSatellite` is a tilted-perspective projection. For pure geostationary
 * (no tilt), the satellite looks straight down at its sub-satellite point;
 * the projection becomes a "what you see from the satellite" view of the
 * Earth's disc. We use it with `tilt = 0` and `distance` set to the
 * satellite-altitude-above-Earth-center expressed in Earth radii.
 *
 * For GOES-East (currently GOES-16/GOES-19):
 *   - Sub-satellite longitude: -75 deg (75 W)
 *   - Sub-satellite latitude:    0 deg (equatorial)
 *   - Satellite altitude:    35,786 km above mean sea level
 *   - Mean Earth radius:      6,378 km
 *   - Distance from Earth center / Earth radius:
 *       (6378 + 35786) / 6378 = 6.6107
 *
 * For GOES-West (GOES-17/GOES-18): sub-satellite longitude -137 deg.
 *
 * # Architectural choice (chart compositions)
 *
 * The wx-chart library renders every CONUS chart in Lambert Conformal
 * (Phase A's `projection.ts`) so multiple chart layers can compose against
 * the same basemap. For satellite imagery that means:
 *
 *   1. The chart canvas is Lambert (basemap, chrome, graticule, airports).
 *   2. The GOES raster is decoded in its native geostationary frame.
 *   3. `raster/warp.ts` inverts the *Lambert* projection per output pixel
 *      to get `(lon, lat)`, then forward-projects through `geoSatellite`
 *      to find the GOES source pixel.
 *
 * The forward projection (`geoSatellite([lon, lat])`) returns the sample's
 * position in the satellite's projected plane in d3-geo "logical units".
 * We then map those logical units to the source PNG's pixel grid via the
 * source raster's affine transform (its world file). The world file for a
 * GOES PNG -- when one accompanies it -- describes the full-disc projection
 * extent. For "sectorized" PNGs (CONUS sub-region only), the world file
 * describes the sector's bounding box in Plate Carree-equivalent extent.
 *
 * This helper exposes:
 *   - `goesProjection({ subSatelliteLongitude, ... })` -- a fitted GeoProjection
 *     (forward + invert).
 *   - `GOES_EAST_LONGITUDE`, `GOES_WEST_LONGITUDE` -- canonical positions.
 *   - `GOES_DISTANCE_EARTH_RADII` -- the satellite distance constant.
 *
 * Browser-safe: pure d3-geo + d3-geo-projection. No Node imports.
 */

import { type GeoProjection } from 'd3-geo';
import { geoSatellite } from 'd3-geo-projection';

/**
 * GOES-East sub-satellite longitude (current generation: GOES-16, GOES-19).
 * Sign per d3-geo convention (positive east); -75 means 75 west.
 */
export const GOES_EAST_LONGITUDE = -75;

/**
 * GOES-West sub-satellite longitude (current generation: GOES-17, GOES-18).
 */
export const GOES_WEST_LONGITUDE = -137;

/**
 * Sub-satellite latitude. All GOES-series satellites are equatorial.
 */
export const GOES_SUBSATELLITE_LATITUDE = 0;

/**
 * Mean Earth radius in km. Used to compute the unitless `distance`
 * parameter d3-geo's satellite projection requires (in Earth radii).
 */
export const EARTH_RADIUS_KM = 6378;

/**
 * GOES nominal altitude above mean sea level in km.
 */
export const GOES_ALTITUDE_KM = 35786;

/**
 * Satellite distance from Earth center, expressed in Earth radii.
 * d3-geo-projection's `satelliteRaw(P, omega)` parameter `P`.
 *
 *   P = (R_earth + h_satellite) / R_earth
 *     = (6378 + 35786) / 6378
 *     = 6.6107...
 */
export const GOES_DISTANCE_EARTH_RADII = (EARTH_RADIUS_KM + GOES_ALTITUDE_KM) / EARTH_RADIUS_KM;

export interface GoesProjectionOptions {
	/**
	 * Sub-satellite longitude, in degrees (signed per d3-geo: positive east).
	 * Pass `GOES_EAST_LONGITUDE` (-75) or `GOES_WEST_LONGITUDE` (-137).
	 */
	subSatelliteLongitude: number;

	/**
	 * Output canvas size in pixels. Used to set the projection's translate
	 * (centers the disc inside the canvas).
	 */
	width: number;
	height: number;

	/**
	 * Optional scale override. When omitted, the projection is auto-scaled
	 * so the full Earth disc fills the smaller of `width / height` minus a
	 * small margin. The disc occupies a circle of radius
	 * `scale * sin(arccos(1/distance))`.
	 *
	 * When the projection is consumed only for inverse-projection (the warp
	 * pipeline samples from a Lambert canvas back into GOES space), the
	 * scale only needs to match the source raster's pixel grid. The warp's
	 * source-bounds derivation is responsible for getting the alignment
	 * right.
	 */
	scale?: number;

	/**
	 * Translate override `[tx, ty]` in pixels. Defaults to canvas center.
	 */
	translate?: readonly [number, number];

	/**
	 * Tilt of the perspective in radians. For pure geostationary look-down,
	 * pass `0` (the default).
	 */
	tiltRadians?: number;
}

/**
 * Construct a GOES geostationary GeoProjection. Forward maps `(lon, lat)`
 * to canvas pixel coordinates; `invert` maps canvas pixels back to
 * `(lon, lat)`. Off-disc points return `null` from `forward` (inside the
 * d3-geo `clipAngle`) and `null` from `invert`.
 *
 * The projection is sized for the full Earth disc by default. For sector
 * applications (the CONUS-only PNG product), feed the resulting projection
 * into a fitted Lambert via the warp pipeline rather than rescaling here.
 */
export function goesProjection(opts: GoesProjectionOptions): GeoProjection {
	const tilt = opts.tiltRadians ?? 0;
	// d3-geo-projection's `satellite()` factory call signature:
	//   var p = satellite();         // returns a GeoProjection-like object
	//   p.distance(P).tilt(omegaDeg) // configure
	// `tilt` setter takes degrees.
	const proj = geoSatellite()
		.distance(GOES_DISTANCE_EARTH_RADII)
		.tilt((tilt * 180) / Math.PI)
		// Rotate so the sub-satellite point sits at the projection origin.
		// d3-geo's rotate semantics: to bring geographic longitude `lon0` to
		// the projection center, call `rotate([-lon0, -lat0])`. Passing the
		// geographic value here negated mirrors `lambertProjection` in
		// projection.ts (which passes the longitude already negated to its
		// public API; this helper takes the geographic value directly).
		.rotate([-opts.subSatelliteLongitude, -GOES_SUBSATELLITE_LATITUDE]);

	// Default scale: fit the Earth disc into the smaller canvas axis with a
	// small margin (8 px). The Earth disc in d3-geo-projection's scale
	// units occupies a circle of radius `scale * discRadius`, where
	// `discRadius = sin(arccos(1/distance))`. We choose `scale` so that
	// `2 * scale * discRadius = min(width, height) - margin`.
	const discRadius = Math.sin(Math.acos(1 / GOES_DISTANCE_EARTH_RADII));
	const margin = 8;
	const fitMin = Math.min(opts.width, opts.height) - margin * 2;
	const defaultScale = fitMin / (2 * discRadius);
	proj.scale(opts.scale ?? defaultScale);

	const tx = opts.translate?.[0] ?? opts.width / 2;
	const ty = opts.translate?.[1] ?? opts.height / 2;
	proj.translate([tx, ty]);

	return proj;
}

/**
 * Convenience: GOES-East projection for the given canvas size, full-disc
 * fitted with default 8-pixel margin. Pure look-down (tilt 0).
 */
export function goesEastProjection(width: number, height: number): GeoProjection {
	return goesProjection({
		subSatelliteLongitude: GOES_EAST_LONGITUDE,
		width,
		height,
	});
}

/**
 * Convenience: GOES-West projection for the given canvas size, full-disc
 * fitted with default 8-pixel margin. Pure look-down (tilt 0).
 */
export function goesWestProjection(width: number, height: number): GeoProjection {
	return goesProjection({
		subSatelliteLongitude: GOES_WEST_LONGITUDE,
		width,
		height,
	});
}
