/**
 * Spike 01 -- Layer 1 Truth Model TypeScript types.
 *
 * The atmosphere as a system. Every other layer (METAR derivation, TAF
 * derivation, AIRMET derivation, chart-spec derivation, commentary
 * derivation) reads only from this shape. Substitution at S2/S3 means
 * filling the same shape from a different source -- archive sample,
 * reanalysis ingest -- without rewriting the downstream layers.
 *
 * See ../../../../docs/vision/products/pre-flight/weather-scenario-engine/DESIGN.md
 * for the full schema rationale.
 */

export interface TruthModel {
	/** Scenario identifier. Stable across regenerations of the same seed. */
	scenarioId: string;
	/** UTC ISO timestamp the scenario is "now" -- the analysis time. */
	validAt: string;
	/** Local timezone of the primary departure airport (IANA). */
	primaryTimeZone: string;
	stations: StationRegistry;
	synoptic: SynopticState;
	airMasses: AirMass[];
	upperLevel: UpperLevelState;
	convection: ConvectionState;
	diurnal: DiurnalCycle;
	hazardZones: HazardZone[];
	terrain: TerrainState;
	/** Free-form description of the scenario shape -- copied into chart subtitles. */
	narrative: string;
}

export interface StationRecord {
	icao: string;
	lon: number;
	lat: number;
	elevationFt: number;
	name: string;
}

export interface StationRegistry {
	[icao: string]: StationRecord;
}

// ----------------------------------------------------------------
// Synoptic-scale state
// ----------------------------------------------------------------

export interface SynopticState {
	pressureSystems: PressureSystem[];
	fronts: Front[];
}

export interface PressureSystem {
	id: string;
	kind: 'L' | 'H';
	lon: number;
	lat: number;
	centralPressureMb: number;
	motionDegTrue: number;
	motionKt: number;
	backgroundPressureMb?: number;
}

export type FrontKind = 'cold' | 'warm' | 'occluded' | 'stationary';
export type CardinalSide = 'N' | 'S' | 'E' | 'W';
export type FrontIntensity = 'weak' | 'moderate' | 'strong';

export interface Front {
	id: string;
	kind: FrontKind;
	points: [number, number][];
	pipSide: CardinalSide;
	motionDegTrue: number;
	motionKt: number;
	intensity: FrontIntensity;
}

// ----------------------------------------------------------------
// Air-mass state
// ----------------------------------------------------------------

export type AirMassClassification = 'mT' | 'mP' | 'cT' | 'cP' | 'cA';
export type AirMassStability = 'stable' | 'conditionally-unstable' | 'unstable';
export type SkyCoverHint = 'SKC' | 'FEW' | 'SCT' | 'BKN' | 'OVC';

export interface AirMass {
	id: string;
	classification: AirMassClassification;
	polygon: [number, number][];
	surfaceTempC: number;
	surfaceDewpointC: number;
	stability: AirMassStability;
	surfaceWindDirDeg: number;
	surfaceWindKt: number;
	meanCloudCover: SkyCoverHint;
	meanCloudBaseFtAgl: number | null;
	meanCloudTopFtAgl: number | null;
}

// ----------------------------------------------------------------
// Upper-level state
// ----------------------------------------------------------------

export interface UpperLevelState {
	jetAxis: [number, number][];
	jetMaxKt: number;
	windByAltitude: WindByAltitudeRow[];
}

export interface WindByAltitudeRow {
	altitudeFt: number;
	meanDirDeg: number;
	meanSpeedKt: number;
	meanTempC: number;
}

// ----------------------------------------------------------------
// Convection
// ----------------------------------------------------------------

export interface ConvectionState {
	cells: ConvectiveCell[];
	frontalBand: FrontalPrecipBand | null;
	capeJperKgByStation: Record<string, number>;
}

export interface ConvectiveCell {
	id: string;
	lon: number;
	lat: number;
	radiusKm: number;
	peakDbz: number;
}

export interface FrontalPrecipBand {
	axis: [number, number][];
	widthKm: number;
	peakDbz: number;
}

// ----------------------------------------------------------------
// Diurnal cycle
// ----------------------------------------------------------------

export interface DiurnalCycle {
	solarNoonUtcHour: number;
	mixingHeightFtMsl: number;
	nocturnalInversion: boolean;
}

// ----------------------------------------------------------------
// Hazard zones
// ----------------------------------------------------------------

export type HazardKind = 'turbulence' | 'icing' | 'ifr' | 'mountain-obscuration';
export type HazardSeverity = 'light' | 'moderate' | 'severe';

export interface HazardZone {
	id: string;
	kind: HazardKind;
	polygon: [number, number][];
	altitudeBandFtMsl: { min: number; max: number | null };
	source: string;
	severity: HazardSeverity;
}

// ----------------------------------------------------------------
// Terrain
// ----------------------------------------------------------------

export interface TerrainState {
	ridges: Array<{ id: string; polyline: [number, number][]; peakElevationFt: number }>;
}

// ----------------------------------------------------------------
// Geometry helpers
// ----------------------------------------------------------------

/**
 * Point-in-polygon (ray casting). Polygon is a sequence of [lon, lat]
 * vertices; the ring is implicitly closed.
 */
export function pointInPolygon(point: [number, number], polygon: [number, number][]): boolean {
	const [x, y] = point;
	let inside = false;
	for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i, i += 1) {
		const a = polygon[i];
		const b = polygon[j];
		if (a === undefined || b === undefined) continue;
		const xi = a[0];
		const yi = a[1];
		const xj = b[0];
		const yj = b[1];
		const intersects = yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi + 1e-12) + xi;
		if (intersects) inside = !inside;
	}
	return inside;
}

/**
 * Approximate great-circle distance in km between two lon/lat pairs.
 * Haversine; good enough for the spike's "within 50 nm" tests.
 */
export function distanceKm(a: [number, number], b: [number, number]): number {
	const R = 6371;
	const toRad = (d: number) => (d * Math.PI) / 180;
	const lat1 = toRad(a[1]);
	const lat2 = toRad(b[1]);
	const dLat = toRad(b[1] - a[1]);
	const dLon = toRad(b[0] - a[0]);
	const h = Math.sin(dLat / 2) ** 2 + Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLon / 2) ** 2;
	return 2 * R * Math.asin(Math.sqrt(h));
}

export function distanceNm(a: [number, number], b: [number, number]): number {
	return distanceKm(a, b) * 0.539957;
}

/**
 * Find the air mass whose polygon contains the given point. Returns null
 * if no air mass contains it. When polygons overlap (front-zone seam),
 * returns the first match.
 */
export function findAirMass(truth: TruthModel, point: [number, number]): AirMass | null {
	for (const am of truth.airMasses) {
		if (pointInPolygon(point, am.polygon)) return am;
	}
	return null;
}

/**
 * Distance from a point to a polyline (km). Walks segments and returns
 * the minimum perpendicular distance. Used for "is this station within
 * X km of the front?" checks.
 */
export function distanceToPolylineKm(point: [number, number], polyline: [number, number][]): number {
	let minKm = Number.POSITIVE_INFINITY;
	for (let i = 0; i < polyline.length - 1; i += 1) {
		const a = polyline[i];
		const b = polyline[i + 1];
		if (a === undefined || b === undefined) continue;
		// Approximate by sampling 10 points along the segment.
		for (let t = 0; t <= 10; t += 1) {
			const f = t / 10;
			const sample: [number, number] = [a[0] + (b[0] - a[0]) * f, a[1] + (b[1] - a[1]) * f];
			const d = distanceKm(point, sample);
			if (d < minKm) minKm = d;
		}
	}
	return minKm;
}

/**
 * Side-of-front detector. For a given front polyline + a query point,
 * returns 'pip-side' (the side the pip glyphs face) or 'opposite'.
 * Used to decide whether a station is in the post-frontal sector
 * (cold side for cold front, warm side for warm front).
 */
export function sideOfFront(point: [number, number], front: Front): 'pip-side' | 'opposite' {
	// Find the nearest segment.
	let nearestI = 0;
	let nearestKm = Number.POSITIVE_INFINITY;
	for (let i = 0; i < front.points.length - 1; i += 1) {
		const a = front.points[i];
		const b = front.points[i + 1];
		if (a === undefined || b === undefined) continue;
		const mid: [number, number] = [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2];
		const d = distanceKm(point, mid);
		if (d < nearestKm) {
			nearestKm = d;
			nearestI = i;
		}
	}
	const a = front.points[nearestI];
	const b = front.points[nearestI + 1];
	if (a === undefined || b === undefined) return 'opposite';
	// Cross product (a -> b) x (a -> point); sign tells us which side.
	const ax = b[0] - a[0];
	const ay = b[1] - a[1];
	const bx = point[0] - a[0];
	const by = point[1] - a[1];
	const cross = ax * by - ay * bx;
	// Map cross-sign to cardinal. If pipSide is N, the pip side is +y in lon/lat space.
	// For a polyline going eastward (head-to-tail), positive cross = N side.
	// For non-eastward polylines, this gets fuzzy. The spike uses head-tail = decreasing lat
	// (typical for fronts trailing south from a low) so positive cross = E side.
	// We adapt by mapping pipSide via the front's mean direction.
	const meanDx = b[0] - a[0]; // segment direction
	const meanDy = b[1] - a[1];
	// 'pip-side' direction: rotate segment 90 deg CCW for E pips when going N, etc.
	// Simpler: the pip side is at perpendicular = cardinal vector.
	const pipVec = pipSideVector(front.pipSide);
	// Perpendicular to segment, oriented toward "left of travel" (CCW).
	const perpX = -meanDy;
	const perpY = meanDx;
	const dot = perpX * pipVec[0] + perpY * pipVec[1];
	const pipIsLeft = dot >= 0;
	const pointIsLeft = cross >= 0;
	return pipIsLeft === pointIsLeft ? 'pip-side' : 'opposite';
}

function pipSideVector(side: CardinalSide): [number, number] {
	switch (side) {
		case 'N':
			return [0, 1];
		case 'S':
			return [0, -1];
		case 'E':
			return [1, 0];
		case 'W':
			return [-1, 0];
	}
}

/**
 * Sample the synoptic SLP field at a lon/lat. Uses the same Gaussian-bump
 * model the wx-charts surface-analysis renderer uses, so the chart's
 * isobars and the engine's per-station altimeter readings agree.
 */
const BACKGROUND_SLP_DEFAULT = 1015;
const CENTER_SIGMA_DEG = 7;

export function samplePressureMb(truth: TruthModel, point: [number, number]): number {
	const [lon, lat] = point;
	let p = BACKGROUND_SLP_DEFAULT;
	for (const c of truth.synoptic.pressureSystems) {
		const dLon = (lon - c.lon) * Math.cos((c.lat * Math.PI) / 180);
		const dLat = lat - c.lat;
		const distDeg = Math.hypot(dLon, dLat);
		const amp = c.centralPressureMb - (c.backgroundPressureMb ?? BACKGROUND_SLP_DEFAULT);
		p += amp * Math.exp(-(distDeg * distDeg) / (2 * CENTER_SIGMA_DEG * CENTER_SIGMA_DEG));
	}
	return p;
}

/**
 * Compute pressure-gradient magnitude (mb / 100 km) at a point. Used for
 * post-frontal gust derivation (steep gradient -> stronger gusts).
 */
export function pressureGradientMbPer100km(truth: TruthModel, point: [number, number]): number {
	const dDeg = 0.5;
	const here = samplePressureMb(truth, point);
	const east = samplePressureMb(truth, [point[0] + dDeg, point[1]]);
	const north = samplePressureMb(truth, [point[0], point[1] + dDeg]);
	const dpDx = (east - here) / dDeg;
	const dpDy = (north - here) / dDeg;
	const magPerDeg = Math.hypot(dpDx, dpDy);
	// 1 deg lat ~= 111 km. Approximate.
	const magPer100km = (magPerDeg * 100) / 111;
	return magPer100km;
}

/**
 * Walk the truth model forward in time. Translates pressure systems,
 * fronts, and convective cells by their motion vectors. Air masses are
 * dragged by the average front motion (rough but sufficient for prog
 * charts at 12hr lead).
 *
 * Pure: returns a new TruthModel; does not mutate.
 */
export function advanceTruth(truth: TruthModel, hours: number): TruthModel {
	const advance = (pt: [number, number], dirDeg: number, kt: number): [number, number] => {
		// Translate point by vector.
		const distNm = kt * hours;
		const distKm = distNm * 1.852;
		const distLat = distKm / 111;
		const distLon = distKm / (111 * Math.cos((pt[1] * Math.PI) / 180));
		const rad = (dirDeg * Math.PI) / 180;
		// Motion bearing -> dx/dy in lon/lat. Bearing is degrees true (clockwise from N).
		const dx = distLon * Math.sin(rad);
		const dy = distLat * Math.cos(rad);
		return [pt[0] + dx, pt[1] + dy];
	};

	const newSystems = truth.synoptic.pressureSystems.map((s) => {
		const [newLon, newLat] = advance([s.lon, s.lat], s.motionDegTrue, s.motionKt);
		return { ...s, lon: newLon, lat: newLat };
	});
	const newFronts = truth.synoptic.fronts.map((f) => ({
		...f,
		points: f.points.map((p) => advance(p, f.motionDegTrue, f.motionKt)),
	}));
	const newCells = truth.convection.cells.map((c) => {
		// Cells track with the mean front motion if any; otherwise no movement.
		const ref = truth.synoptic.fronts[0];
		if (ref === undefined) return c;
		const [newLon, newLat] = advance([c.lon, c.lat], ref.motionDegTrue, ref.motionKt);
		return { ...c, lon: newLon, lat: newLat };
	});
	const newBand = truth.convection.frontalBand
		? {
				...truth.convection.frontalBand,
				axis: truth.convection.frontalBand.axis.map((p) => {
					const ref = truth.synoptic.fronts[0];
					if (ref === undefined) return p;
					return advance(p, ref.motionDegTrue, ref.motionKt);
				}),
			}
		: null;
	// Air-mass polygons drag with the average front motion (cheap
	// approximation; production should drag each polygon by the local
	// barotropic flow).
	const meanFront = truth.synoptic.fronts[0];
	const newAirMasses = truth.airMasses.map((am) => {
		if (meanFront === undefined) return am;
		return {
			...am,
			polygon: am.polygon.map((p) => advance(p, meanFront.motionDegTrue, meanFront.motionKt)),
		};
	});
	// Hazard zones drag the same way.
	const newHazards = truth.hazardZones.map((h) => {
		if (meanFront === undefined) return h;
		return {
			...h,
			polygon: h.polygon.map((p) => advance(p, meanFront.motionDegTrue, meanFront.motionKt)),
		};
	});

	const newValidAt = new Date(new Date(truth.validAt).getTime() + hours * 3600_000).toISOString();

	return {
		...truth,
		validAt: newValidAt,
		synoptic: { pressureSystems: newSystems, fronts: newFronts },
		airMasses: newAirMasses,
		convection: { ...truth.convection, cells: newCells, frontalBand: newBand },
		hazardZones: newHazards,
	};
}
