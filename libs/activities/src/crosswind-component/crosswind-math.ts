/**
 * Pure geometric / formatting helpers for the CrosswindComponent activity.
 *
 * Extracted from `CrosswindComponent.svelte` so the rotation, normalisation,
 * decomposition, and pointer-mapping logic can be unit-tested without
 * mounting an SVG. The component re-imports these helpers and uses them in
 * `$derived` blocks; behaviour is unchanged.
 */

/** Convert a compass heading (0 = North, clockwise) to SVG-radians (0 = East, counter-clockwise). */
export function compassToRadians(compassDeg: number): number {
	return ((compassDeg - 90) * Math.PI) / 180;
}

/** Convert degrees to radians. */
export function degToRad(deg: number): number {
	return (deg * Math.PI) / 180;
}

/**
 * Normalise a signed degree delta to (-180, 180]. The signed boundary
 * collapses -180 to +180 so the readout never flips between -180 and +180
 * across the wrap.
 */
export function normalizeSigned(deg: number): number {
	let d = (((deg % 360) + 540) % 360) - 180;
	if (d === -180) d = 180;
	return d;
}

/** Crosswind component magnitude in knots (always >= 0). */
export function crosswindKts(windSpeedKts: number, signedAngleDeg: number): number {
	return Math.abs(windSpeedKts * Math.sin(degToRad(signedAngleDeg)));
}

/** Headwind component in knots; positive = headwind, negative = tailwind. */
export function headwindKts(windSpeedKts: number, signedAngleDeg: number): number {
	return windSpeedKts * Math.cos(degToRad(signedAngleDeg));
}

/**
 * Convert an SVG point (relative to the canvas centre) to a compass heading
 * 0..359 inclusive, rounded to whole degrees. Used by the pointer-drag
 * handler to translate cursor position into wind direction.
 */
export function pointToCompass(p: { x: number; y: number }, center: number): number {
	const dx = p.x - center;
	const dy = p.y - center;
	const rad = Math.atan2(dy, dx);
	let deg = (rad * 180) / Math.PI + 90;
	deg = ((deg % 360) + 360) % 360;
	return Math.round(deg);
}

/** Format a compass heading as a 3-digit zero-padded string (e.g. 030, 270). */
export function formatHeading(deg: number): string {
	const normalized = ((Math.round(deg) % 360) + 360) % 360;
	return normalized.toString().padStart(3, '0');
}

/**
 * Format a signed numeric value with an explicit sign for non-zero values.
 * Zero renders with a leading space to keep readouts column-aligned.
 */
export function formatSigned(val: number, digits = 0): string {
	const rounded = Number(val.toFixed(digits));
	const sign = rounded > 0 ? '+' : rounded < 0 ? '' : ' ';
	return `${sign}${rounded.toFixed(digits)}`;
}

/** Clamp a decomposition magnitude (knots * scale) to the visualised pixel range. */
export function clampDecomp(kts: number, scale: number, maxPixels: number): number {
	return Math.max(-maxPixels, Math.min(maxPixels, kts * scale));
}
