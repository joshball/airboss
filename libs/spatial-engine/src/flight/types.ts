/**
 * Layer-2 (flight) types: routes, aircraft, derived performance.
 *
 * Pure type module -- safe at any tier; re-exported `type`-only from the
 * runtime barrel. The pure-math helpers (`geometry.ts`, `wind.ts`) carry
 * their own value exports.
 *
 * See `docs/work-packages/xc-viewer-v1/spec.md` "Data model" + design.md
 * "Aircraft spec authoring discipline".
 */

import type { XcAircraft, XcRoute } from '@ab/constants';

/** A single route waypoint. */
export interface Waypoint {
	/** Stable id, unique within the route. */
	id: string;
	/** Human label (e.g. "KMEM" or "KMEM-DEP-FIX"). */
	label: string;
	/** Longitude in signed decimal degrees. */
	lon: number;
	/** Latitude in signed decimal degrees. */
	lat: number;
	/** Optional ICAO if the waypoint sits on an airport. */
	airportIcao?: string;
	/** Waypoint kind drives the renderer's symbol + the wx projection. */
	kind: 'airport' | 'fix';
}

/** Per-leg cruise altitude. One entry per leg (waypoints.length - 1). */
export interface AltitudeStep {
	/** Cruise altitude for this leg in feet MSL. */
	altitudeFtMsl: number;
}

/** Per-leg planned true airspeed. One entry per leg. */
export interface SpeedStep {
	/** Planned true airspeed for this leg in knots. */
	tasKt: number;
}

/** A hand-authored cross-country route. */
export interface RouteSpec {
	/** Route id; one of `XC_ROUTE_VALUES`. */
	id: XcRoute;
	/** Human label. */
	label: string;
	/** Ordered waypoints; first is departure, last is destination. */
	waypoints: Waypoint[];
	/** Per-leg cruise altitude; length === waypoints.length - 1. */
	altitudeProfile: AltitudeStep[];
	/** Per-leg planned TAS; length === waypoints.length - 1. */
	speedProfile: SpeedStep[];
	/** Optional declared alternate ICAO; must exist in the region airports. */
	alternateIcao?: string;
	/** Planned UTC departure time (ISO timestamp). */
	plannedDepartureUtc: string;
}

/** A single cruise-performance polar point. */
export interface CruisePolarPoint {
	/** Pressure altitude in feet MSL. */
	pressureAltitudeFtMsl: number;
	/** True airspeed in knots at this altitude (75% power, ISA day). */
	tasKt: number;
	/** Fuel burn in gallons per hour at this altitude. */
	gph: number;
}

/** The aircraft performance polar. */
export interface PerformancePolar {
	/** Climb performance. */
	climb: { rateFpm: number; kiasIas: number };
	/** Cruise performance -- monotonic in pressure altitude. */
	cruise: { points: CruisePolarPoint[] };
	/** Descent performance. */
	descent: { rateFpm: number; kiasIas: number };
	/** Certificated service ceiling in feet MSL. */
	serviceCeilingFtMsl: number;
}

/** The fuel-burn curve across phases of flight. */
export interface FuelBurnCurve {
	/** Cruise burn -- the default gph applied when the polar lacks a point. */
	cruise: { defaultGph: number };
	/** Climb burn in gph. */
	climb: { gph: number };
	/** Taxi burn in gph. */
	taxi: { gph: number };
}

/** A single vertex of the weight-and-balance CG envelope. */
export interface WbEnvelopeVertex {
	/** Gross weight in pounds. */
	weightLb: number;
	/** Forward CG limit in inches aft of datum. */
	fwdCgIn: number;
	/** Aft CG limit in inches aft of datum. */
	aftCgIn: number;
}

/** The weight-and-balance envelope. */
export interface WeightBalanceEnvelope {
	/** Maximum gross weight in pounds. */
	maxGrossWeightLb: number;
	/** Minimum useful weight in pounds. */
	minWeightLb: number;
	/** Ordered envelope vertices -- forward < aft at every weight. */
	envelope: WbEnvelopeVertex[];
}

/** Navigation equipment value enum. */
export type NavEquipment = 'vor' | 'gps-vfr-only' | 'gps-ifr' | 'dme' | 'adf';
/** Communication equipment value enum. */
export type ComEquipment = 'comm-1' | 'comm-2';
/** Transponder value enum. */
export type TransponderEquipment = 'none' | 'mode-a' | 'mode-c' | 'mode-s';

/** The aircraft equipment list. */
export interface EquipmentList {
	nav: NavEquipment[];
	com: ComEquipment[];
	transponder: TransponderEquipment;
	adsbOut: boolean;
	autopilot: boolean;
	ifrCertified: boolean;
}

/** A hand-authored aircraft specification. */
export interface AircraftSpec {
	/** Aircraft id; one of `XC_AIRCRAFT_VALUES`. */
	id: XcAircraft;
	/** Make + model display string. */
	model: string;
	/** Performance polar. */
	perfPolar: PerformancePolar;
	/** Fuel-burn curve. */
	fuelBurnCurve: FuelBurnCurve;
	/** Usable fuel capacity in gallons. */
	fuelCapacityGal: number;
	/** Weight-and-balance envelope. */
	wbEnvelope: WeightBalanceEnvelope;
	/** Equipment list. */
	equipment: EquipmentList;
}

/** Optional pilot profile carried on a flight (v2+ uses it; v1 omits). */
export interface PilotProfile {
	/** Pilot certificate level. */
	certificate: 'student' | 'private' | 'commercial' | 'atp';
	/** Instrument rated. */
	instrumentRated: boolean;
	/** Total time in hours. */
	totalTimeHr: number;
}

/** A loaded flight: route + aircraft (+ optional pilot). */
export interface Flight {
	/** Flight scenario id -- route + aircraft tuple (e.g. "kmem-kmkl-kolv-c172n"). */
	scenarioId: string;
	route: RouteSpec;
	aircraft: AircraftSpec;
	pilot?: PilotProfile;
}

/** Derived performance for a single route leg. */
export interface LegPerformance {
	/** Origin waypoint id. */
	from: string;
	/** Destination waypoint id. */
	to: string;
	/** Great-circle distance in nautical miles. */
	distanceNm: number;
	/** True course in degrees [0, 360). */
	trueCourse: number;
	/** Wind-corrected magnetic heading in degrees [0, 360). */
	magneticHeading: number;
	/** Cruise altitude in feet MSL. */
	altitudeFtMsl: number;
	/** Ground speed in knots. */
	groundSpeedKt: number;
	/** Estimated time en route in minutes. */
	eteMin: number;
	/** Planned fuel burn in gallons. */
	fuelGal: number;
	/** Wind direction (from) in degrees true. */
	windFromDeg: number;
	/** Wind speed in knots. */
	windKt: number;
}

/** The derived per-flight performance table. */
export interface PerformanceTable {
	/** One entry per leg. */
	legs: LegPerformance[];
	/** Sum of per-leg fuel in gallons. */
	totalFuelGal: number;
	/** Sum of per-leg ETE in minutes. */
	totalEteMin: number;
	/** Fuel reserve at destination in gallons (capacity - total burn). */
	reserveGal: number;
}

/**
 * The Phase-C geometry-only leg placeholder. The route renderer ships leg
 * labels before the performance derivation lands (Phase E), so it computes
 * `distanceNm` + `trueCourse` inline and renders this narrower shape.
 */
export interface LegPlaceholder {
	from: string;
	to: string;
	distanceNm: number;
	trueCourse: number;
}
