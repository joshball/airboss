/**
 * Layer-1 (geography) Zod schemas.
 *
 * Validates: airspace polygons are closed (first point === last point),
 * lon/lat sit within the CONUS bounding box, runway headings are in
 * `[0, 360)`, elevations are physically reasonable.
 *
 * Zod is browser-safe; the schemas could re-export from the runtime
 * barrel, but per the design doc they flow through the server barrel for
 * cleanliness.
 *
 * See `docs/work-packages/xc-viewer-v1/spec.md` "Validation".
 */

import { XC_REGION_VALUES } from '@ab/constants';
import { z } from 'zod';

/** CONUS bounding box -- every authored coordinate must sit inside it. */
export const CONUS_BOUNDS = {
	minLon: -125,
	maxLon: -66,
	minLat: 24,
	maxLat: 50,
} as const;

const lonSchema = z
	.number()
	.min(CONUS_BOUNDS.minLon, 'longitude west of CONUS')
	.max(CONUS_BOUNDS.maxLon, 'longitude east of CONUS');
const latSchema = z
	.number()
	.min(CONUS_BOUNDS.minLat, 'latitude south of CONUS')
	.max(CONUS_BOUNDS.maxLat, 'latitude north of CONUS');

/** A `[lon, lat]` position tuple. */
const positionSchema = z.tuple([lonSchema, latSchema]);

/** A closed linear ring -- first point equals last, at least 4 points. */
const closedRingSchema = z
	.array(positionSchema)
	.min(4, 'a closed ring needs at least 4 positions')
	.refine(
		(ring) => {
			const first = ring[0];
			const last = ring[ring.length - 1];
			return first[0] === last[0] && first[1] === last[1];
		},
		{ message: 'polygon ring is not closed (first point must equal last point)' },
	);

const polygonGeometrySchema = z.object({
	type: z.literal('Polygon'),
	coordinates: z.array(closedRingSchema).min(1),
});

const multiPolygonGeometrySchema = z.object({
	type: z.literal('MultiPolygon'),
	coordinates: z.array(z.array(closedRingSchema).min(1)).min(1),
});

export const airspaceClassSchema = z.enum(['B', 'C', 'D', 'E', 'MOA', 'RESTRICTED', 'PROHIBITED']);

export const airspacePolygonSchema = z.object({
	id: z.string().min(1),
	airspaceClass: airspaceClassSchema,
	label: z.string().min(1),
	floorFtMsl: z.number().min(0).max(60000),
	ceilingFtMsl: z.number().min(0).max(60000),
	geometry: z.union([polygonGeometrySchema, multiPolygonGeometrySchema]),
});

export const runwaySchema = z.object({
	designator: z.string().min(1),
	headingDegMagnetic: z.number().min(0).lt(360, 'runway heading must be in [0, 360)'),
	lengthFt: z.number().min(100).max(20000),
	widthFt: z.number().min(10).max(500),
	surface: z.enum(['asphalt', 'concrete', 'turf', 'gravel', 'water']),
	hasPrecisionApproach: z.boolean(),
});

export const frequencySchema = z.object({
	label: z.string().min(1),
	mhz: z.number().min(108).max(137),
});

export const fboSchema = z.object({
	name: z.string().min(1),
	fuel: z.array(z.enum(['100LL', 'JET-A', 'MOGAS'])),
});

export const airportSchema = z.object({
	icao: z.string().regex(/^[A-Z0-9]{3,4}$/, 'ICAO must be 3-4 uppercase alphanumerics'),
	name: z.string().min(1),
	lon: lonSchema,
	lat: latSchema,
	elevationFtMsl: z.number().min(-300).max(14000),
	attended: z.boolean(),
	airspaceClass: airspaceClassSchema,
	runways: z.array(runwaySchema).min(1),
	frequencies: z.array(frequencySchema),
	fbos: z.array(fboSchema),
});

export const navaidSchema = z.object({
	id: z.string().min(1),
	kind: z.enum(['VOR', 'VORTAC', 'VOR-DME', 'NDB', 'FIX']),
	name: z.string().min(1),
	lon: lonSchema,
	lat: latSchema,
	frequencyMhz: z.number().min(108).max(118).nullable(),
});

export const regionBoundsSchema = z
	.object({
		minLon: lonSchema,
		minLat: latSchema,
		maxLon: lonSchema,
		maxLat: latSchema,
	})
	.refine((b) => b.minLon < b.maxLon && b.minLat < b.maxLat, {
		message: 'region bounds min must be less than max',
	});

export const regionSchema = z.object({
	regionSlug: z.enum(XC_REGION_VALUES as [string, ...string[]]),
	bounds: regionBoundsSchema,
	sourceCycle: z.string().min(1),
	parallels: z.tuple([z.number(), z.number()]),
});

/** Basemap feature collection -- structural validation only. */
const basemapFeatureSchema = z.object({
	type: z.literal('Feature'),
	geometry: z.object({ type: z.string() }).passthrough(),
	properties: z.object({
		kind: z.enum(['state-outline', 'water', 'road', 'city']),
		name: z.string().optional(),
	}),
});

export const basemapFeatureCollectionSchema = z.object({
	type: z.literal('FeatureCollection'),
	features: z.array(basemapFeatureSchema),
});

export const geographySchema = z.object({
	regionSlug: z.enum(XC_REGION_VALUES as [string, ...string[]]),
	bounds: regionBoundsSchema,
	airports: z.array(airportSchema),
	airspace: z.array(airspacePolygonSchema),
	navaids: z.array(navaidSchema),
	basemap: basemapFeatureCollectionSchema,
});

export type GeographySchema = z.infer<typeof geographySchema>;
