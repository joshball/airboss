/**
 * Great-circle geometry helpers.
 *
 * Pure functions over `[lon, lat]` points. Browser-safe -- re-exported as
 * values from both the runtime and server barrels.
 *
 * See `docs/work-packages/xc-viewer-v1/spec.md` "Performance derivation"
 * and design.md "Per-leg performance accuracy bounds".
 */

/** Mean Earth radius in nautical miles. */
const EARTH_RADIUS_NM = 3440.065;

/** Degrees -> radians. */
function toRad(deg: number): number {
	return (deg * Math.PI) / 180;
}

/** Radians -> degrees. */
function toDeg(rad: number): number {
	return (rad * 180) / Math.PI;
}

/** Normalize a bearing into the [0, 360) range. */
export function normalizeBearing(deg: number): number {
	const wrapped = deg % 360;
	return wrapped < 0 ? wrapped + 360 : wrapped;
}

/**
 * Great-circle distance between two `[lon, lat]` points in nautical miles.
 * Uses the haversine formula -- numerically stable for short legs.
 */
export function greatCircleNm(lon1: number, lat1: number, lon2: number, lat2: number): number {
	const phi1 = toRad(lat1);
	const phi2 = toRad(lat2);
	const dPhi = toRad(lat2 - lat1);
	const dLambda = toRad(lon2 - lon1);

	const a =
		Math.sin(dPhi / 2) * Math.sin(dPhi / 2) +
		Math.cos(phi1) * Math.cos(phi2) * Math.sin(dLambda / 2) * Math.sin(dLambda / 2);
	const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
	return EARTH_RADIUS_NM * c;
}

/**
 * Initial great-circle bearing (true course) from point 1 to point 2, in
 * degrees [0, 360).
 */
export function greatCircleBearing(lon1: number, lat1: number, lon2: number, lat2: number): number {
	const phi1 = toRad(lat1);
	const phi2 = toRad(lat2);
	const dLambda = toRad(lon2 - lon1);

	const y = Math.sin(dLambda) * Math.cos(phi2);
	const x = Math.cos(phi1) * Math.sin(phi2) - Math.sin(phi1) * Math.cos(phi2) * Math.cos(dLambda);
	return normalizeBearing(toDeg(Math.atan2(y, x)));
}

/**
 * Midpoint of the great-circle arc between two `[lon, lat]` points.
 * Returns `[lon, lat]`.
 */
export function midpoint(a: readonly [number, number], b: readonly [number, number]): [number, number] {
	const phi1 = toRad(a[1]);
	const phi2 = toRad(b[1]);
	const lambda1 = toRad(a[0]);
	const dLambda = toRad(b[0] - a[0]);

	const bx = Math.cos(phi2) * Math.cos(dLambda);
	const by = Math.cos(phi2) * Math.sin(dLambda);
	const phiM = Math.atan2(
		Math.sin(phi1) + Math.sin(phi2),
		Math.sqrt((Math.cos(phi1) + bx) * (Math.cos(phi1) + bx) + by * by),
	);
	const lambdaM = lambda1 + Math.atan2(by, Math.cos(phi1) + bx);
	return [normalizeLon(toDeg(lambdaM)), toDeg(phiM)];
}

/** Normalize a longitude into [-180, 180). */
function normalizeLon(lon: number): number {
	let l = lon;
	while (l < -180) l += 360;
	while (l >= 180) l -= 360;
	return l;
}
