// @browser-globals: server-only -- never imported by client .svelte
/**
 * Layer-1 (geography) loader.
 *
 * `loadGeography(regionSlug)` reads the committed vector geometry from
 * `course/sectionals/<region>/` -- the basemap / airspace / navaids
 * GeoJSON files plus the airports index -- validates each against the Zod
 * schemas, and returns a typed `Geography`. The loader caches per region
 * slug so repeated `composeBundle` calls in one process reuse the value.
 *
 * See `docs/work-packages/xc-viewer-v1/spec.md` "Layer composition
 * contracts" -> "Layer 1".
 */

import { XC_SECTIONAL_LAYOUT, type XcRegion } from '@ab/constants';
import type { Feature, FeatureCollection } from 'geojson';
import { joinPath, pathExists, REPO_ROOT, readJson } from '../fs-util';
import { airportSchema, airspacePolygonSchema, geographySchema, navaidSchema } from './schema';
import type {
	AirportRecord,
	AirspacePolygon,
	BasemapFeatureCollection,
	Geography,
	NavaidRecord,
	RegionBounds,
} from './types';

/** Per-process cache, keyed by region slug. */
const cache = new Map<XcRegion, Geography>();

/** The directory holding a region's committed vector geometry. */
export function regionDir(regionSlug: XcRegion): string {
	return joinPath(REPO_ROOT, 'course', 'sectionals', regionSlug);
}

interface AirportsIndexFile {
	bounds: RegionBounds;
	airports: AirportRecord[];
}

interface AirspaceFile {
	type: 'FeatureCollection';
	airspace: AirspacePolygon[];
}

interface NavaidsFile {
	type: 'FeatureCollection';
	navaids: NavaidRecord[];
}

/**
 * Load + validate a region's geography.
 *
 * Throws a descriptive error when a file is missing or fails its Zod
 * schema -- a malformed sectional must fail loud at load time, never
 * silently render a broken viewer.
 */
export function loadGeography(regionSlug: XcRegion): Geography {
	const cached = cache.get(regionSlug);
	if (cached) return cached;

	const dir = regionDir(regionSlug);
	if (!pathExists(dir)) {
		throw new Error(
			`spatial-engine: sectional region "${regionSlug}" not found at ${dir}. ` +
				`Run \`bun run sectionals ingest ${regionSlug}\` first.`,
		);
	}

	const airportsIndex = readJson<AirportsIndexFile>(joinPath(dir, XC_SECTIONAL_LAYOUT.AIRPORTS));
	const airspaceFile = readJson<AirspaceFile>(joinPath(dir, XC_SECTIONAL_LAYOUT.AIRSPACE));
	const navaidsFile = readJson<NavaidsFile>(joinPath(dir, XC_SECTIONAL_LAYOUT.NAVAIDS));
	const basemap = readJson<BasemapFeatureCollection>(joinPath(dir, XC_SECTIONAL_LAYOUT.BASEMAP));

	const airports = airportsIndex.airports.map((a) => airportSchema.parse(a) as AirportRecord);
	const airspace = airspaceFile.airspace.map((a) => airspacePolygonSchema.parse(a) as AirspacePolygon);
	const navaids = navaidsFile.navaids.map((n) => navaidSchema.parse(n) as NavaidRecord);

	const geography: Geography = {
		regionSlug,
		bounds: airportsIndex.bounds,
		airports,
		airspace,
		navaids,
		basemap,
	};

	// Full-shape validation -- structural gate on the whole composite.
	geographySchema.parse(geography);

	cache.set(regionSlug, geography);
	return geography;
}

/** Clear the per-process geography cache. Test-only. */
export function clearGeographyCache(): void {
	cache.clear();
}

/** Build a GeoJSON FeatureCollection of the route's waypoints + line. Used by the bundle writer. */
export function isBasemapFeatureCollection(value: unknown): value is FeatureCollection {
	return (
		typeof value === 'object' &&
		value !== null &&
		(value as { type?: string }).type === 'FeatureCollection' &&
		Array.isArray((value as { features?: Feature[] }).features)
	);
}
