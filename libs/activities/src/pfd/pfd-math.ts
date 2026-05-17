/**
 * Pure mapping helpers for the PFD instrument tapes.
 *
 * Extracted from the SVG components so the value -> pixel mapping, label
 * conventions, and tick-window math can be unit-tested without mounting a
 * tape. Each helper has zero side effects and zero dependence on the DOM
 * or SvelteKit runtime.
 */

/**
 * Convert a tape value (knots, feet, fpm) to its tape-internal y coordinate
 * given the tape centerline and pixels-per-unit. The tape itself translates
 * by `value * pixelsPerUnit` so the current value sits on the centerline,
 * which means a tick at `kt` lands at `centerY - kt * pixelsPerUnit` in
 * tape-internal coords.
 */
export function tapeY(value: number, centerY: number, pixelsPerUnit: number): number {
	return centerY - value * pixelsPerUnit;
}

/**
 * Cardinal label for an exact compass heading; returns null for non-cardinal
 * angles. Used by the PFD heading strip so N/E/S/W render as letters and the
 * other major ticks render as glass-cockpit-style numerics.
 */
export function cardinalFor(deg: number): string | null {
	if (deg === 0) return 'N';
	if (deg === 90) return 'E';
	if (deg === 180) return 'S';
	if (deg === 270) return 'W';
	return null;
}

/**
 * Glass-cockpit major-label string for a heading (e.g. 30 -> "3", 330 -> "33").
 * Returns null when:
 *   - `deg` is not on a `labelInterval` boundary
 *   - `deg` is one of the cardinals (rendered as a letter instead)
 */
export function majorLabelFor(deg: number, labelInterval: number): string | null {
	if (deg % labelInterval !== 0) return null;
	if (cardinalFor(deg) !== null) return null;
	return Math.round(deg / 10).toString();
}

/**
 * Normalise a heading to [0, 360). The PFD readout treats raw 0 as 360 for
 * display so the compass card never shows "0" -- pilots read 360, not 0.
 */
export function normalizeHeadingForLabel(rawDeg: number): number {
	const safe = Number.isFinite(rawDeg) ? rawDeg : 0;
	const wrapped = ((safe % 360) + 360) % 360;
	const rounded = Math.round(wrapped);
	return rounded === 0 ? 360 : rounded;
}

/**
 * VSI tick label following glass-cockpit convention: `0` for 0 fpm, scaled
 * hundreds otherwise (e.g. -2000 -> "20", -500 -> "5", 1500 -> "15").
 */
export function vsiTickLabel(fpm: number): string {
	if (fpm === 0) return '0';
	return (Math.abs(fpm) / 100).toString();
}

/**
 * Clamp a vertical-speed value to the tape's renderable range. Real PFDs
 * pin the pointer at the rail when VS exceeds +/- 2000 fpm.
 */
export function clampVerticalSpeed(fpm: number, rangeFpm: number): number {
	if (!Number.isFinite(fpm)) return 0;
	if (fpm > rangeFpm) return rangeFpm;
	if (fpm < -rangeFpm) return -rangeFpm;
	return fpm;
}

/**
 * Linear value-to-angle mapping used by every dial (tachometer, ASI, VSI).
 * Clamps the input to `[minValue, maxValue]` and returns an angle in the
 * `[minAngle, maxAngle]` range.
 */
export function linearToAngle(
	value: number,
	minValue: number,
	maxValue: number,
	minAngle: number,
	maxAngle: number,
): number {
	const clamped = Math.max(minValue, Math.min(maxValue, value));
	const t = (clamped - minValue) / (maxValue - minValue);
	return minAngle + t * (maxAngle - minAngle);
}

/**
 * AltitudeTape rolled-counter translation. The thousands digit slides
 * smoothly across each thousand-foot boundary; this returns the y-offset
 * to apply to a vertical strip of digit glyphs of cell height `cellHeight`.
 */
export function counterTranslateY(altitudeFeet: number, cellHeight: number): number {
	// Guard non-finite altitude the same way the sibling helpers do -- a NaN
	// here would inject NaN straight into an SVG transform and break layout.
	const safe = Number.isFinite(altitudeFeet) ? altitudeFeet : 0;
	const fractional = safe / 1000;
	return -((fractional % 10) * cellHeight);
}

/**
 * AltitudeTape low-digits readout (the trailing 3 digits left of the
 * rolled thousands counter). Always rendered as a 3-digit zero-padded
 * string so 050 stays "050" rather than "50".
 */
export function altitudeLowDigits(altitudeFeet: number): string {
	const safe = Number.isFinite(altitudeFeet) ? Math.max(0, altitudeFeet) : 0;
	const lo = Math.floor(safe) % 1000;
	return lo.toString().padStart(3, '0');
}
