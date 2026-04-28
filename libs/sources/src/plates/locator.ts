/**
 * Phase 10 -- Approach plate locator parser.
 *
 * Source of truth: ADR 019 §1.2 ("Plates").
 *
 * Locator shape:
 *
 *   <airport-id>/<procedure-slug>          e.g. KAPA/ils-rwy-35R, KSFO/airport-diagram
 *
 * Airport ID is uppercase 3 or 4 chars (ICAO-style; FAA TPP also accepts
 * the 3-char domestic identifier, but plates are catalogued by the
 * 4-letter ICAO code by convention).
 *
 * Procedure slug is lowercase kebab-case but may include uppercase
 * runway-suffix tokens (`35R`, `28L`, `09C`) and digit groups -- so the
 * slug pattern accepts mixed case after the first lowercase letter.
 *
 * Pin format: `?at=YYYY-MM-DD` (28-day TPP cycle).
 */

import type { LocatorError, ParsedLocator, ParsedPlatesLocator } from '../types.ts';

const AIRPORT_ID_PATTERN = /^[A-Z][A-Z0-9]{2,3}$/;
const PROCEDURE_SLUG_PATTERN = /^[a-z][a-zA-Z0-9-]*$/;

function err(message: string): LocatorError {
	return { kind: 'error', message };
}

/**
 * Parse a `plates` corpus locator. The locator is the segment after
 * `airboss-ref:plates/`, stripped of `?at=...`.
 */
export function parsePlatesLocator(locator: string): ParsedLocator | LocatorError {
	if (locator.length === 0) {
		return err('plates locator is empty');
	}

	const segments = locator.split('/');
	if (segments.length !== 2) {
		return err(
			`plates locator has unexpected segment count (expected "<airport-id>/<procedure-slug>", got "${locator}")`,
		);
	}

	const airportId = segments[0] ?? '';
	if (!AIRPORT_ID_PATTERN.test(airportId)) {
		return err(
			`plates locator airport id "${airportId}" is malformed (expected uppercase 3-4 chars, e.g. "KAPA", "KSFO")`,
		);
	}

	const procedureSlug = segments[1] ?? '';
	if (procedureSlug.length === 0) {
		return err('plates locator missing procedure slug');
	}
	if (!PROCEDURE_SLUG_PATTERN.test(procedureSlug)) {
		return err(
			`plates locator procedure slug "${procedureSlug}" is malformed (expected lowercase kebab-case, e.g. "ils-rwy-35R", "airport-diagram")`,
		);
	}

	const plates: ParsedPlatesLocator = { airportId, procedureSlug };
	return { kind: 'ok', segments, plates };
}

/**
 * Format a plates locator from a parsed structure. Round-trips with
 * `parsePlatesLocator`.
 */
export function formatPlatesLocator(parsed: ParsedPlatesLocator): string {
	return `${parsed.airportId}/${parsed.procedureSlug}`;
}
