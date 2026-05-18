/**
 * Wind-triangle helpers.
 *
 * Pure functions -- browser-safe; re-exported as values from both barrels.
 * `applyWind` solves the standard navigation wind triangle: given a true
 * course, a true airspeed, and a wind vector, it returns the ground speed
 * and the wind-corrected magnetic heading.
 *
 * v1 uses a single per-region magnetic variation (`XC_REGION_MAGNETIC_
 * VARIATION_DEG`); v2+ may use the NOAA WMM grid.
 *
 * See `docs/work-packages/xc-viewer-v1/tasks.md` A.6 + design.md
 * "Per-leg performance accuracy bounds".
 */

import { normalizeBearing } from './geometry';

/** A wind vector -- direction the wind blows FROM, in degrees true. */
export interface Wind {
	/** Direction the wind comes from, degrees true [0, 360). */
	directionDeg: number;
	/** Wind speed in knots. */
	speedKt: number;
}

/** Arguments to `applyWind`. */
export interface ApplyWindArgs {
	/** Desired true course over the ground, degrees [0, 360). */
	trueCourse: number;
	/** True airspeed in knots. */
	tas: number;
	/** Wind vector. */
	wind: Wind;
	/**
	 * Magnetic variation in degrees -- positive East, negative West. The
	 * magnetic heading is the true heading minus easterly variation
	 * ("east is least"). Defaults to 0 (true === magnetic).
	 */
	magneticVariationDeg?: number;
}

/** Result of `applyWind`. */
export interface ApplyWindResult {
	/** Ground speed in knots. */
	groundSpeedKt: number;
	/** Wind-corrected true heading, degrees [0, 360). */
	trueHeading: number;
	/** Wind-corrected magnetic heading, degrees [0, 360). */
	magneticHeading: number;
	/** Wind correction angle, degrees (signed -- positive = crab right). */
	windCorrectionAngleDeg: number;
}

/** Degrees -> radians. */
function toRad(deg: number): number {
	return (deg * Math.PI) / 180;
}

/** Radians -> degrees. */
function toDeg(rad: number): number {
	return (rad * 180) / Math.PI;
}

/**
 * Solve the wind triangle.
 *
 * The wind angle is the difference between the wind's "from" direction and
 * the desired course. The crosswind component drives the wind correction
 * angle (WCA = asin(crosswind / TAS)); the headwind component reduces the
 * ground speed. The true heading is the course plus the WCA; the magnetic
 * heading subtracts easterly variation.
 *
 * If the crosswind exceeds the TAS the leg is unflyable; the function
 * clamps the WCA to +/- 90 deg and returns a near-zero ground speed
 * rather than producing `NaN`.
 */
export function applyWind(args: ApplyWindArgs): ApplyWindResult {
	const { trueCourse, tas, wind } = args;
	const variation = args.magneticVariationDeg ?? 0;

	// Angle between the wind (from) direction and the desired course.
	const windAngleDeg = wind.directionDeg - trueCourse;
	const windAngleRad = toRad(windAngleDeg);

	// Crosswind drives the crab; headwind reduces the ground speed.
	const crosswindKt = wind.speedKt * Math.sin(windAngleRad);
	const headwindKt = wind.speedKt * Math.cos(windAngleRad);

	// Wind correction angle: crab into the crosswind.
	const sinWca = Math.max(-1, Math.min(1, crosswindKt / tas));
	const wcaRad = Math.asin(sinWca);
	const wcaDeg = toDeg(wcaRad);

	// Ground speed: TAS along the heading minus the headwind component.
	const groundSpeedKt = Math.max(1, tas * Math.cos(wcaRad) - headwindKt);

	const trueHeading = normalizeBearing(trueCourse + wcaDeg);
	const magneticHeading = normalizeBearing(trueHeading - variation);

	return {
		groundSpeedKt,
		trueHeading,
		magneticHeading,
		windCorrectionAngleDeg: wcaDeg,
	};
}

/**
 * Linear interpolation of a wind vector across two altitude rows. Returns
 * the interpolated wind at `altitudeFtMsl`. Clamps to the nearest row when
 * the requested altitude is outside the row range.
 */
export function interpolateWindAtAltitude(
	rows: ReadonlyArray<{ altitudeFtMsl: number; directionDeg: number; speedKt: number }>,
	altitudeFtMsl: number,
): Wind {
	if (rows.length === 0) {
		return { directionDeg: 0, speedKt: 0 };
	}
	const sorted = [...rows].sort((a, b) => a.altitudeFtMsl - b.altitudeFtMsl);
	const first = sorted[0];
	const last = sorted[sorted.length - 1];
	if (altitudeFtMsl <= first.altitudeFtMsl) {
		return { directionDeg: first.directionDeg, speedKt: first.speedKt };
	}
	if (altitudeFtMsl >= last.altitudeFtMsl) {
		return { directionDeg: last.directionDeg, speedKt: last.speedKt };
	}
	for (let i = 0; i < sorted.length - 1; i++) {
		const lo = sorted[i];
		const hi = sorted[i + 1];
		if (altitudeFtMsl >= lo.altitudeFtMsl && altitudeFtMsl <= hi.altitudeFtMsl) {
			const t = (altitudeFtMsl - lo.altitudeFtMsl) / (hi.altitudeFtMsl - lo.altitudeFtMsl);
			// Interpolate direction via the shortest angular path.
			const dirDelta = ((hi.directionDeg - lo.directionDeg + 540) % 360) - 180;
			return {
				directionDeg: normalizeBearing(lo.directionDeg + dirDelta * t),
				speedKt: lo.speedKt + (hi.speedKt - lo.speedKt) * t,
			};
		}
	}
	return { directionDeg: last.directionDeg, speedKt: last.speedKt };
}
