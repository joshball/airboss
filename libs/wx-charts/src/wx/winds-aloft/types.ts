/**
 * Winds and Temperatures Aloft (FB) parser shape.
 *
 * Source of truth: FAA Advisory Circular AC 00-45 + FMH-1 Chapter 6 (FB
 * encoding). The library captures the field set the winds-aloft chart
 * type renders:
 *
 * - Station ICAO (3 or 4 letter)
 * - One row per altitude in the grid (3000, 6000, 9000, 12000, 18000,
 *   24000, 30000, 34000, 39000 -- standard FAA set; not every station
 *   reports every altitude)
 * - Per row: wind direction (degrees true, in tens), speed (knots),
 *   temperature (degrees C; sign convention: negative implied above
 *   24000 ft per FAA encoding rule)
 *
 * # FB encoding rules (per AC 00-45)
 *
 * - Each row is 4 or 6 characters. 4-char rows omit the temperature
 *   (typical at 3000 ft when the station is below that altitude;
 *   per FAA convention temps at <2500 ft AGL are not forecast).
 * - The first two digits encode wind direction in tens of degrees true.
 *   Direction 99 means "light and variable" (calm); the second pair is
 *   then forced to 0.
 * - The middle two digits encode wind speed in knots. If wind > 99 KT,
 *   FAA adds 50 to the direction and subtracts 100 from the speed
 *   (e.g., `731960` decodes to dir=230, spd=119, temp=-60). Direction
 *   732 = 230, speed encoded as 19 -> +100 = 119.
 * - The last two digits (when present) encode temperature in degrees C.
 *   At altitudes above FL240 the temperature is always negative (the
 *   sign is implied; we apply it post-decode). Below FL240 the sign is
 *   explicit via a leading `-` in the source -- which our regex
 *   accommodates as an optional minus.
 *
 * # Browser safety
 *
 * Pure type module; no values, no imports of Node built-ins.
 */

export interface WindsAloftRow {
	/** Altitude in feet MSL (3000, 6000, 9000, 12000, 18000, 24000, 30000, 34000, 39000). */
	altitudeFt: number;
	/** Wind direction in degrees true. `null` if light-and-variable (encoded `9900`). */
	directionDeg: number | null;
	/** Wind speed in knots. `0` if light-and-variable. */
	speedKt: number;
	/** Temperature in degrees C. `null` when not forecast (typical at low altitudes). */
	temperatureC: number | null;
	/** Original 4 or 6-char encoded row, for traceability. */
	raw: string;
}

export interface ParsedFbStation {
	station: string;
	rows: WindsAloftRow[];
}

export interface ParsedFbGrid {
	/** ISO timestamp the FB cycle is valid at (e.g., 2024-05-21T18:00:00Z). */
	validAt: string | null;
	/** Issue timestamp (when the bulletin was issued). */
	issuedAt: string | null;
	/** Forecast-based-on time (the model run the FB derives from). */
	basedOn: string | null;
	/** Per-station rows. */
	stations: ParsedFbStation[];
	warnings: string[];
}
