/**
 * Layer 1 truth-model TypeScript types.
 *
 * The atmosphere as a system. Every other layer (METAR derivation, TAF
 * derivation, AIRMET derivation, chart-spec derivation, commentary
 * derivation) reads only from this shape. Substitution at S2/S3 means
 * filling the same shape from a different source -- archive sample,
 * reanalysis ingest -- without rewriting the downstream layers.
 *
 * Lifted from the spike's pre-retirement `spikes/wx-engine/src/truth/types.ts`
 * (PR #801 -- now retired; see `spikes/wx-engine/01-frontal-xc/spike-notes.md`
 * for the spike verdict). The production lib splits
 * the spike's colocated types + helpers into separate modules:
 *
 *   - this file:          interfaces only
 *   - `./schema.ts`:      Zod schema (the contract enforced at scenario load)
 *   - `./geometry.ts`:    point-in-polygon, side-of-front, pressure sampler
 *   - `./advance.ts`:     advanceTruth (the only sanctioned time-evolution)
 *
 * See the full schema rationale in
 * `docs/vision/products/pre-flight/weather-scenario-engine/DESIGN.md`.
 */

export interface TruthModel {
	/** Scenario identifier. Stable across regenerations of the same seed. */
	scenarioId: string;
	/** UTC ISO timestamp the scenario is "now" -- the analysis time. */
	validAt: string;
	/** Local timezone of the primary departure airport (IANA). */
	primaryTimeZone: string;
	/** Free-form description of the scenario shape -- copied into chart subtitles. */
	narrative: string;
	stations: StationRegistry;
	synoptic: SynopticState;
	airMasses: AirMass[];
	upperLevel: UpperLevelState;
	convection: ConvectionState;
	diurnal: DiurnalCycle;
	hazardZones: HazardZone[];
	terrain: TerrainState;
	/**
	 * Stations along the planned route. Drives METAR + TAF emission. Every
	 * entry must resolve in `stations`. Order is the canonical iteration
	 * order for the per-scenario product collections.
	 */
	routeStations: string[];
	/**
	 * Stations included in the winds-aloft FB bulletin. Often equals
	 * `routeStations` plus a handful of regional references (KMSP, KDSM,
	 * KIND in the spike scenario). Every entry must resolve in `stations`.
	 */
	fbStations: string[];
	/**
	 * TAF valid window in hours. Defaults to 12 when absent -- the spike's
	 * analysis-time-anchored window that surfaces the upcoming frontal
	 * passage.
	 */
	tafValidHours?: number;
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
