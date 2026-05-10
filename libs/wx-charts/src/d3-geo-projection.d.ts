/**
 * Local type declarations for `d3-geo-projection`.
 *
 * The package does not ship its own `.d.ts`, and DefinitelyTyped does not
 * publish `@types/d3-geo-projection`. Phase F's `projection-geostationary.ts`
 * is the only consumer in this library; we declare the minimal subset of
 * the API that helper uses. If a later renderer reaches for a different
 * projection (Robinson, Aitoff, etc.), append the appropriate factory
 * signature here.
 *
 * The full d3-geo-projection module exports a long list of map projections
 * (~70 of them); their factory shape mirrors `geoSatellite`. We only
 * declare what we use.
 */
declare module 'd3-geo-projection' {
	import type { GeoProjection } from 'd3-geo';

	/**
	 * Tilted vertical-perspective projection, suitable for satellite views.
	 * With `tilt = 0`, becomes a pure geostationary projection. The
	 * `distance` parameter is the satellite's distance from the center of
	 * the Earth, expressed in Earth radii.
	 *
	 * Returns a GeoProjection extended with `distance` and `tilt`
	 * accessor/mutator pairs (d3-style chainable configurators).
	 */
	export interface SatelliteProjection extends GeoProjection {
		distance(): number;
		distance(d: number): SatelliteProjection;
		tilt(): number;
		tilt(degrees: number): SatelliteProjection;
	}

	export function geoSatellite(): SatelliteProjection;
}
