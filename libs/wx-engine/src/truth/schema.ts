/**
 * Truth-model Zod schema. Validates every scenario literal on load through
 * the registry.
 *
 * The contract: derivation layers read only from a validated `TruthModel`.
 * If a scenario literal fails this schema, `loadScenario` throws and the
 * engine refuses to produce a bundle. Author-side bugs surface here, not
 * at chart-render time.
 *
 * Validations (per spec.md "Validation" + DESIGN.md "Truth model schema"):
 *
 *   - Polygons have >= 3 vertices
 *   - Hazard-zone polygons close (first vertex equals last vertex)
 *   - Stations live within CONUS bounds (lon in [-130, -65], lat in [22, 52])
 *   - Pressure systems carry motion vectors
 *   - Severity is required on every hazard zone
 *
 * Self-intersection rejection per spec is intentionally deferred to Phase F
 * (it requires a O(N^2) segment-intersection sweep that the consistency
 * checker is better positioned to own). Authors avoid self-intersection by
 * convention -- the spike's polygon-debug logging catches it during
 * authoring.
 */

import { z } from 'zod';

// ----------------------------------------------------------------
// Validation tuning constants. Kept here so the schema is one-stop for the
// contract; authors can read this file alone to understand what a valid
// scenario looks like.
// ----------------------------------------------------------------

/** CONUS longitude bounds (deg). Stations outside this range are rejected. */
const CONUS_LON_MIN = -130;
const CONUS_LON_MAX = -65;
/** CONUS latitude bounds (deg). */
const CONUS_LAT_MIN = 22;
const CONUS_LAT_MAX = 52;
/** Minimum number of vertices for a valid polygon (excluding implicit ring closure). */
const POLYGON_MIN_VERTICES = 3;
/** Tolerance for ring-closure equality check (deg). */
const RING_CLOSURE_TOLERANCE_DEG = 1e-9;

// ----------------------------------------------------------------
// Reusable primitives
// ----------------------------------------------------------------

const lonLatTuple = z.tuple([z.number(), z.number()]);

const polygonSchema = z
	.array(lonLatTuple)
	.min(POLYGON_MIN_VERTICES, `polygon must have at least ${POLYGON_MIN_VERTICES} vertices`);

const ringClosedPolygonSchema = polygonSchema.refine(
	(ring) => {
		const first = ring[0];
		const last = ring[ring.length - 1];
		if (first === undefined || last === undefined) return false;
		return (
			Math.abs(first[0] - last[0]) <= RING_CLOSURE_TOLERANCE_DEG &&
			Math.abs(first[1] - last[1]) <= RING_CLOSURE_TOLERANCE_DEG
		);
	},
	{ message: 'hazard-zone polygon ring must close (first vertex equals last vertex)' },
);

const stationRecordSchema = z.object({
	icao: z.string().min(1),
	lon: z.number().gte(CONUS_LON_MIN).lte(CONUS_LON_MAX),
	lat: z.number().gte(CONUS_LAT_MIN).lte(CONUS_LAT_MAX),
	elevationFt: z.number(),
	name: z.string().min(1),
});

const pressureSystemSchema = z.object({
	id: z.string().min(1),
	kind: z.enum(['L', 'H']),
	lon: z.number(),
	lat: z.number(),
	centralPressureMb: z.number(),
	motionDegTrue: z.number().gte(0).lte(360),
	motionKt: z.number().gte(0),
	backgroundPressureMb: z.number().optional(),
});

const frontSchema = z.object({
	id: z.string().min(1),
	kind: z.enum(['cold', 'warm', 'occluded', 'stationary']),
	points: z.array(lonLatTuple).min(2, 'front polyline must have at least 2 vertices'),
	pipSide: z.enum(['N', 'S', 'E', 'W']),
	motionDegTrue: z.number().gte(0).lte(360),
	motionKt: z.number().gte(0),
	intensity: z.enum(['weak', 'moderate', 'strong']),
});

const synopticStateSchema = z.object({
	pressureSystems: z.array(pressureSystemSchema),
	fronts: z.array(frontSchema),
});

const airMassSchema = z.object({
	id: z.string().min(1),
	classification: z.enum(['mT', 'mP', 'cT', 'cP', 'cA']),
	polygon: polygonSchema,
	surfaceTempC: z.number(),
	surfaceDewpointC: z.number(),
	stability: z.enum(['stable', 'conditionally-unstable', 'unstable']),
	surfaceWindDirDeg: z.number().gte(0).lte(360),
	surfaceWindKt: z.number().gte(0),
	meanCloudCover: z.enum(['SKC', 'FEW', 'SCT', 'BKN', 'OVC']),
	meanCloudBaseFtAgl: z.number().nullable(),
	meanCloudTopFtAgl: z.number().nullable(),
});

const windByAltitudeRowSchema = z.object({
	altitudeFt: z.number(),
	meanDirDeg: z.number().gte(0).lte(360),
	meanSpeedKt: z.number().gte(0),
	meanTempC: z.number(),
});

const upperLevelStateSchema = z.object({
	jetAxis: z.array(lonLatTuple),
	jetMaxKt: z.number().gte(0),
	windByAltitude: z.array(windByAltitudeRowSchema),
});

const convectiveCellSchema = z.object({
	id: z.string().min(1),
	lon: z.number(),
	lat: z.number(),
	radiusKm: z.number().gt(0),
	peakDbz: z.number(),
});

const frontalPrecipBandSchema = z.object({
	axis: z.array(lonLatTuple).min(2),
	widthKm: z.number().gt(0),
	peakDbz: z.number(),
});

const convectionStateSchema = z.object({
	cells: z.array(convectiveCellSchema),
	frontalBand: frontalPrecipBandSchema.nullable(),
	capeJperKgByStation: z.record(z.string(), z.number()),
});

const diurnalCycleSchema = z.object({
	solarNoonUtcHour: z.number().gte(0).lt(24),
	mixingHeightFtMsl: z.number(),
	nocturnalInversion: z.boolean(),
});

const hazardZoneSchema = z.object({
	id: z.string().min(1),
	kind: z.enum(['turbulence', 'icing', 'ifr', 'mountain-obscuration']),
	polygon: ringClosedPolygonSchema,
	altitudeBandFtMsl: z.object({ min: z.number(), max: z.number().nullable() }),
	source: z.string().min(1),
	severity: z.enum(['light', 'moderate', 'severe']),
});

const terrainStateSchema = z.object({
	ridges: z.array(
		z.object({
			id: z.string().min(1),
			polyline: z.array(lonLatTuple).min(2),
			peakElevationFt: z.number(),
		}),
	),
});

/**
 * Full `TruthModel` schema. Validates every scenario literal on load via
 * `loadScenario`. The inferred type matches the `TruthModel` interface in
 * `./types.ts` exactly.
 */
export const truthModelSchema = z.object({
	scenarioId: z.string().min(1),
	validAt: z.string().min(1),
	primaryTimeZone: z.string().min(1),
	stations: z.record(z.string().min(1), stationRecordSchema),
	synoptic: synopticStateSchema,
	airMasses: z.array(airMassSchema),
	upperLevel: upperLevelStateSchema,
	convection: convectionStateSchema,
	diurnal: diurnalCycleSchema,
	hazardZones: z.array(hazardZoneSchema),
	terrain: terrainStateSchema,
	narrative: z.string().min(1),
});

/** Inferred type from the schema. Equal-by-construction to `TruthModel`. */
export type TruthModelSchema = z.infer<typeof truthModelSchema>;
