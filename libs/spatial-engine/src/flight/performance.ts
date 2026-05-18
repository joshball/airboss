/**
 * Per-leg performance derivation.
 *
 * `derivePerformance` is a pure, deterministic function. For each route
 * leg it computes great-circle distance + true course, looks up the
 * aircraft's TAS + fuel burn at the leg cruise altitude, applies the
 * wind triangle against the projected winds aloft, and produces a
 * `LegPerformance`. The cumulative fuel reserve is the single cross-layer
 * invariant the validator surfaces.
 *
 * Browser-safe pure math -- re-exported as a value from both barrels.
 *
 * See `docs/work-packages/xc-viewer-v1/spec.md` "Performance derivation
 * (v1 -- straight-leg, simplified ISA)".
 */

import type { WxBundleView } from '../weather/types';
import { greatCircleBearing, greatCircleNm } from './geometry';
import type { AircraftSpec, LegPerformance, PerformanceTable, RouteSpec } from './types';
import { applyWind, interpolateWindAtAltitude, type Wind } from './wind';

/** Arguments to `derivePerformance`. */
export interface PerfArgs {
	/** The route to derive performance for. */
	route: RouteSpec;
	/** The aircraft flying it. */
	aircraft: AircraftSpec;
	/** The projected weather view (winds aloft per waypoint). */
	weather: WxBundleView;
	/** Magnetic variation in degrees -- positive East. */
	magneticVariationDeg: number;
}

/**
 * Interpolate the aircraft's cruise TAS at a pressure altitude. Clamps to
 * the polar's endpoints when the altitude is outside the polar range.
 */
export function cruiseTasKt(aircraft: AircraftSpec, altitudeFtMsl: number): number {
	const points = aircraft.perfPolar.cruise.points;
	const first = points[0];
	const last = points[points.length - 1];
	if (altitudeFtMsl <= first.pressureAltitudeFtMsl) return first.tasKt;
	if (altitudeFtMsl >= last.pressureAltitudeFtMsl) return last.tasKt;
	for (let i = 0; i < points.length - 1; i++) {
		const lo = points[i];
		const hi = points[i + 1];
		if (altitudeFtMsl >= lo.pressureAltitudeFtMsl && altitudeFtMsl <= hi.pressureAltitudeFtMsl) {
			const t = (altitudeFtMsl - lo.pressureAltitudeFtMsl) / (hi.pressureAltitudeFtMsl - lo.pressureAltitudeFtMsl);
			return lo.tasKt + (hi.tasKt - lo.tasKt) * t;
		}
	}
	return last.tasKt;
}

/**
 * Interpolate the aircraft's cruise fuel burn (gph) at a pressure
 * altitude. Falls back to the fuel-burn curve's default when the polar
 * lacks a usable point.
 */
export function cruiseGph(aircraft: AircraftSpec, altitudeFtMsl: number): number {
	const points = aircraft.perfPolar.cruise.points;
	if (points.length === 0) return aircraft.fuelBurnCurve.cruise.defaultGph;
	const first = points[0];
	const last = points[points.length - 1];
	if (altitudeFtMsl <= first.pressureAltitudeFtMsl) return first.gph;
	if (altitudeFtMsl >= last.pressureAltitudeFtMsl) return last.gph;
	for (let i = 0; i < points.length - 1; i++) {
		const lo = points[i];
		const hi = points[i + 1];
		if (altitudeFtMsl >= lo.pressureAltitudeFtMsl && altitudeFtMsl <= hi.pressureAltitudeFtMsl) {
			const t = (altitudeFtMsl - lo.pressureAltitudeFtMsl) / (hi.pressureAltitudeFtMsl - lo.pressureAltitudeFtMsl);
			return lo.gph + (hi.gph - lo.gph) * t;
		}
	}
	return last.gph;
}

/**
 * Project the wind at a leg: take the winds-aloft rows from the two leg
 * endpoints' waypoint views, average them, then interpolate to the leg's
 * cruise altitude. Falls back to calm air when no winds are available.
 */
function legWind(args: PerfArgs, fromId: string, toId: string, altitudeFtMsl: number): Wind {
	const fromView = args.weather.byWaypoint[fromId];
	const toView = args.weather.byWaypoint[toId];
	const fromRows = fromView?.windsAloft ?? [];
	const toRows = toView?.windsAloft ?? [];

	const fromWind = interpolateWindAtAltitude(fromRows, altitudeFtMsl);
	const toWind = interpolateWindAtAltitude(toRows, altitudeFtMsl);

	if (fromRows.length === 0 && toRows.length === 0) {
		return { directionDeg: 0, speedKt: 0 };
	}
	if (fromRows.length === 0) return toWind;
	if (toRows.length === 0) return fromWind;

	// Average the two endpoint winds via the shortest angular path.
	const dirDelta = ((toWind.directionDeg - fromWind.directionDeg + 540) % 360) - 180;
	return {
		directionDeg: (fromWind.directionDeg + dirDelta / 2 + 360) % 360,
		speedKt: (fromWind.speedKt + toWind.speedKt) / 2,
	};
}

/**
 * Derive the per-leg performance table for a route + aircraft + weather.
 * Pure + deterministic: a re-build produces identical output.
 */
export function derivePerformance(args: PerfArgs): PerformanceTable {
	const { route, aircraft } = args;
	const legs: LegPerformance[] = [];

	for (let i = 0; i < route.waypoints.length - 1; i++) {
		const from = route.waypoints[i];
		const to = route.waypoints[i + 1];
		const altitudeFtMsl = route.altitudeProfile[i]?.altitudeFtMsl ?? 0;

		const distanceNm = greatCircleNm(from.lon, from.lat, to.lon, to.lat);
		const trueCourse = greatCircleBearing(from.lon, from.lat, to.lon, to.lat);

		// Wind at the leg cruise altitude, sampled from the endpoint views.
		const wind = legWind(args, from.id, to.id, altitudeFtMsl);

		// TAS from the aircraft polar -- prefer the route's planned TAS when
		// it sits below the polar value (a conservative pilot choice).
		const polarTas = cruiseTasKt(aircraft, altitudeFtMsl);
		const plannedTas = route.speedProfile[i]?.tasKt ?? polarTas;
		const tas = Math.min(polarTas, plannedTas);

		const { groundSpeedKt, magneticHeading } = applyWind({
			trueCourse,
			tas,
			wind,
			magneticVariationDeg: args.magneticVariationDeg,
		});

		const gph = cruiseGph(aircraft, altitudeFtMsl);
		const eteMin = (distanceNm / groundSpeedKt) * 60;
		const fuelGal = gph * (eteMin / 60);

		legs.push({
			from: from.id,
			to: to.id,
			distanceNm,
			trueCourse,
			magneticHeading,
			altitudeFtMsl,
			groundSpeedKt,
			eteMin,
			fuelGal,
			windFromDeg: wind.directionDeg,
			windKt: wind.speedKt,
		});
	}

	const totalFuelGal = legs.reduce((sum, leg) => sum + leg.fuelGal, 0);
	const totalEteMin = legs.reduce((sum, leg) => sum + leg.eteMin, 0);
	const reserveGal = aircraft.fuelCapacityGal - totalFuelGal;

	return { legs, totalFuelGal, totalEteMin, reserveGal };
}

/** The empty performance table -- used before weather is loaded. */
export const EMPTY_PERFORMANCE: PerformanceTable = {
	legs: [],
	totalFuelGal: 0,
	totalEteMin: 0,
	reserveGal: 0,
};
