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
	/**
	 * v2 temporal evolution block (optional). When present, `sampleTruthAt`
	 * (`./time.ts`) derives a v1-shape snapshot for any timestamp inside
	 * `[evolution.start, evolution.end]`. v1 callers ignore this field --
	 * the temporal extension is purely additive.
	 */
	evolution?: TemporalEvolution;
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
// v2 temporal evolution (additive, optional)
// ----------------------------------------------------------------
//
// The `evolution` block describes how the v1 snapshot changes over a scenario
// window. v1 callers ignore it entirely; the `sampleTruthAt` helper in
// `./time.ts` consults it to produce a v1-shape snapshot for any timestamp
// inside [start, end]. Nothing in the v1 derivation path reads `evolution` --
// the temporal extension is purely upstream of derivation.
//
// See `docs/work/plans/2026-05-14-truth-model-v2-temporal.md` "Shape A".

/**
 * Per-cell intensity sample. An inline curve overrides the named-curve
 * presets ('building' | 'mature' | 'decaying') for finer authored control.
 */
export interface CellIntensitySample {
	/** UTC ISO timestamp; the sample applies from this instant forward. */
	at: string;
	/** Radar reflectivity (dBZ) at this instant. */
	peakDbz: number;
}

/**
 * Inline cell intensity curve -- a sorted list of (time, dBZ) samples.
 * `sampleTruthAt` linearly interpolates between adjacent samples.
 */
export type InlineIntensityCurve = CellIntensitySample[];

/**
 * Shape of a cell spawned ahead of a temporal front by its
 * `prefrontalConvection` block.
 */
export interface CellTemplate {
	/** Reach (radius) of each spawned cell, km. */
	radiusKm: number;
	/** Peak reflectivity (dBZ) of each spawned cell. */
	peakDbz: number;
	/** When true the spawned cell tracks with the front's motion vector. */
	motionMatchesFront: boolean;
}

/** Constant translation vector -- a true heading plus a speed in knots. */
export interface ConstantMotion {
	kind: 'constant';
	bearingDeg: number;
	speedKt: number;
}

/** Piecewise translation -- each segment applies up to its `until` instant. */
export interface PiecewiseMotion {
	kind: 'piecewise';
	segments: { until: string; bearingDeg: number; speedKt: number }[];
}

export type FrontMotion = ConstantMotion | PiecewiseMotion;

/** A v1 front plus the rules for how it translates + evolves over time. */
export interface TemporalFront {
	id: string;
	/** Initial polyline at `TemporalEvolution.start`. */
	pointsAtStart: [number, number][];
	/** Translation vector; may vary over time when `kind` is 'piecewise'. */
	motion: FrontMotion;
	/** Intensity overrides; each entry applies from its `at` instant forward. */
	intensitySchedule?: { at: string; intensity: FrontIntensity }[];
	/** Convection that appears ahead of the boundary (gust-front signature). */
	prefrontalConvection?: {
		/** Distance ahead of the boundary the cells spawn, nm. */
		leadDistanceNm: number;
		/** When pre-frontal convection becomes active. */
		onsetAt: string;
		/** Shape of every cell spawned ahead of the front. */
		cellTemplate: CellTemplate;
	};
}

/** A convective cell with a genesis/dissipation lifecycle + motion. */
export interface TemporalCell {
	id: string;
	/** Genesis longitude (deg). */
	initialLon: number;
	/** Genesis latitude (deg). */
	initialLat: number;
	/** When the cell first appears. */
	genesisAt: string;
	/** When the cell dissipates. */
	dissipatesAt: string;
	/** Translation vector applied across the cell lifetime. */
	motion: { bearingDeg: number; speedKt: number };
	/** Intensity curve -- a named preset or an inline sample list. */
	intensityCurve: 'building' | 'mature' | 'decaying' | InlineIntensityCurve;
	/** Reach (radius) curve over the cell lifetime. Defaults to constant. */
	radiusKmCurve?: 'linear-grow-shrink' | { peak: number; peakAt: string };
}

/** Translation + drift rules for one air-mass polygon. */
export interface AirMassMotion {
	/** `AirMass.id` this motion applies to. */
	airMassId: string;
	/** Polygon translation vector. */
	motion: { bearingDeg: number; speedKt: number };
	/** Optional surface-wind drift, applied per hour of elapsed time. */
	surfaceWindShift?: { perHour: { dirDeg: number; speedKt: number } };
	/** Optional surface-temperature drift, degrees C per hour. */
	temperatureDriftCPerHour?: number;
}

/** Onset/dissipation + severity schedule for one hazard zone. */
export interface HazardLifecycle {
	/** `HazardZone.id` this lifecycle applies to. */
	hazardZoneId: string;
	/** When the hazard first appears. */
	onsetAt: string;
	/** When the hazard dissipates. */
	endAt: string;
	/** Severity overrides; each entry applies from its `at` instant forward. */
	severitySchedule?: { at: string; severity: HazardSeverity }[];
}

/**
 * Temporal evolution block. The static v1 snapshot fields describe the world
 * at `start`; this block describes how it changes through `end`.
 */
export interface TemporalEvolution {
	/** Start of the scenario window (UTC ISO). Equals the v1 `validAt`. */
	start: string;
	/** End of the scenario window (UTC ISO). */
	end: string;
	/** Native derivation step size, minutes. >= 5; default 60. */
	stepMinutes: number;
	/** Temporal fronts; each `id` should match a v1 `synoptic.fronts` entry. */
	fronts: TemporalFront[];
	/** Temporal cells spawned/evolved over the window. */
	cells: TemporalCell[];
	/** Per-air-mass translation + drift rules. */
	airMassMotion: AirMassMotion[];
	/** Per-hazard-zone lifecycle rules. */
	hazardLifecycle: HazardLifecycle[];
}
