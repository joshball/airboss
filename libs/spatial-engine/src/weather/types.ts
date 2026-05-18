/**
 * Layer-3 (weather) view types.
 *
 * The viewer composes the wx-engine output by slug reference. The wx
 * engine writes `data/wx-scenarios/<slug>/{truth.json, products/*.json}`;
 * `loadWeatherForScenario` reads those files and projects per-waypoint
 * queries. These types describe the projected view -- NOT the raw
 * wx-engine bundle.
 *
 * Pure type module -- safe at any tier; re-exported `type`-only from the
 * runtime barrel.
 *
 * See `docs/work-packages/xc-viewer-v1/spec.md` "Layer composition
 * contracts".
 */

import type { AirmetFamily, WxScenario } from '@ab/constants';

/** Flight-category discriminator parsed from a METAR / TAF. */
export type FlightCategory = 'VFR' | 'MVFR' | 'IFR' | 'LIFR';

/** Wind at a single altitude, projected to a waypoint. */
export interface WindAtWaypoint {
	/** Altitude in feet MSL. */
	altitudeFtMsl: number;
	/** Wind direction (from) in degrees true. */
	directionDeg: number;
	/** Wind speed in knots. */
	speedKt: number;
	/** Temperature in Celsius (null when the FB row omits it). */
	temperatureC: number | null;
}

/** A METAR observation projected to a waypoint. */
export interface WaypointMetarView {
	/** The station the observation came from. */
	station: string;
	/** Raw METAR text. */
	raw: string;
	/** Parsed flight category. */
	flightCategory: FlightCategory;
	/** Distance from the waypoint to the source station, nautical miles. */
	stationDistanceNm: number;
}

/** A TAF forecast projected to a waypoint. */
export interface WaypointTafView {
	/** The station the forecast came from. */
	station: string;
	/** Raw TAF text (concatenated periods). */
	raw: string;
	/** The flight category of the forecast period covering arrival. */
	arrivalFlightCategory: FlightCategory;
	/** Distance from the waypoint to the source station, nautical miles. */
	stationDistanceNm: number;
}

/** The projected weather view for a single waypoint. */
export interface WaypointWxView {
	/** The route waypoint id this view belongs to. */
	waypointId: string;
	/** Nearest METAR (null if no station within the projection radius). */
	metar: WaypointMetarView | null;
	/** Nearest TAF (null if no TAF station nearby or the waypoint is a fix). */
	taf: WaypointTafView | null;
	/** Winds aloft projected to this waypoint, by altitude. */
	windsAloft: WindAtWaypoint[];
	/** Ids of the AIRMETs whose polygon contains this waypoint. */
	airmetIds: string[];
}

/** An AIRMET polygon carried over from the wx-engine bundle. */
export interface AirmetView {
	/** Stable AIRMET id. */
	id: string;
	/** AIRMET family discriminator. */
	family: AirmetFamily;
	/** Display label (multi-line, as the wx engine emits it). */
	label: string;
	/** Closed ring(s) -- `[lon, lat]` pairs. */
	rings: ReadonlyArray<ReadonlyArray<readonly [number, number]>>;
	/** UTC validity window start. */
	validFrom: string;
	/** UTC validity window end. */
	validTo: string;
}

/** A reference to a wx-engine chart artifact. */
export interface ChartRef {
	/** Chart kind (e.g. "surface-analysis"). */
	kind: string;
	/** Slug into `data/wx-scenarios/<slug>/charts/`. */
	slug: string;
}

/** The projected weather bundle view keyed by route waypoint. */
export interface WxBundleView {
	/** The wx-engine scenario slug this view was projected from. */
	wxScenarioSlug: WxScenario;
	/** The wx-engine truth model's validAt timestamp. */
	truthValidAt: string;
	/** Per-waypoint projected views, keyed by waypoint id. */
	byWaypoint: Record<string, WaypointWxView>;
	/** Every AIRMET in the wx bundle. */
	airmets: AirmetView[];
	/** Chart references available in the wx bundle. */
	charts: ChartRef[];
}
