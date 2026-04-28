/**
 * Phase 10 -- Pilot Operating Handbook (POH/AFM) locator parser.
 *
 * Source of truth: ADR 019 §1.2 ("POH/AFM").
 *
 * Accepts every shape ADR 019 §1.2 lists for the `pohs` corpus:
 *
 *   <aircraft-slug>                                  whole POH
 *   <aircraft-slug>/<section>                        section (e.g. section-2)
 *   <aircraft-slug>/<section>/<subsection>           subsection (e.g. vne)
 *   <aircraft-slug>/emergency/<procedure>            emergency procedure
 *
 * Aircraft slug is lowercase kebab-case (`c172s`, `pa-28-181`, `sr22`).
 * Section is `section-<N>` (1+) or the literal `emergency`. When the
 * section is `emergency`, the third segment is captured as
 * `emergencyProcedure` rather than `subsection`.
 *
 * Pin format: POHs do not have a stable public publication cadence; the
 * `?at=YYYY-MM` pin captures the manufacturer's revision date when known.
 */

import type { LocatorError, ParsedLocator, ParsedPohsLocator } from '../types.ts';

const AIRCRAFT_SLUG_PATTERN = /^[a-z][a-z0-9-]*$/;
const SECTION_PATTERN = /^section-([1-9][0-9]?)$/;
const SUBSECTION_PATTERN = /^[a-z0-9][a-z0-9-]*$/;
const EMERGENCY_LITERAL = 'emergency';

function err(message: string): LocatorError {
	return { kind: 'error', message };
}

/**
 * Parse a `pohs` corpus locator. The locator is the segment after
 * `airboss-ref:pohs/`, stripped of `?at=...`.
 */
export function parsePohsLocator(locator: string): ParsedLocator | LocatorError {
	if (locator.length === 0) {
		return err('pohs locator is empty');
	}

	const segments = locator.split('/');
	const aircraftSlug = segments[0] ?? '';
	if (aircraftSlug.length === 0) {
		return err('pohs locator missing aircraft slug');
	}
	if (!AIRCRAFT_SLUG_PATTERN.test(aircraftSlug)) {
		return err(
			`pohs locator aircraft slug "${aircraftSlug}" is malformed (expected lowercase kebab-case, e.g. "c172s", "pa-28-181")`,
		);
	}

	if (segments.length === 1) {
		const pohs: ParsedPohsLocator = { aircraftSlug };
		return { kind: 'ok', segments, pohs };
	}

	const sectionSegment = segments[1] ?? '';
	if (sectionSegment === EMERGENCY_LITERAL) {
		if (segments.length === 2) {
			const pohs: ParsedPohsLocator = { aircraftSlug, section: EMERGENCY_LITERAL };
			return { kind: 'ok', segments, pohs };
		}
		const procedure = segments[2] ?? '';
		if (segments.length > 3) {
			return err(`pohs locator has unexpected segments after emergency/${procedure}: "${segments.slice(3).join('/')}"`);
		}
		if (!SUBSECTION_PATTERN.test(procedure)) {
			return err(
				`pohs locator emergency procedure "${procedure}" is malformed (expected lowercase kebab-case, e.g. "engine-fire")`,
			);
		}
		const pohs: ParsedPohsLocator = {
			aircraftSlug,
			section: EMERGENCY_LITERAL,
			emergencyProcedure: procedure,
		};
		return { kind: 'ok', segments, pohs };
	}

	if (!SECTION_PATTERN.test(sectionSegment)) {
		return err(
			`pohs locator section "${sectionSegment}" is malformed (expected "section-<N>" or "emergency", got "${sectionSegment}")`,
		);
	}

	if (segments.length === 2) {
		const pohs: ParsedPohsLocator = { aircraftSlug, section: sectionSegment };
		return { kind: 'ok', segments, pohs };
	}

	const subsection = segments[2] ?? '';
	if (segments.length > 3) {
		return err(
			`pohs locator has unexpected segments after ${sectionSegment}/${subsection}: "${segments.slice(3).join('/')}"`,
		);
	}
	if (!SUBSECTION_PATTERN.test(subsection)) {
		return err(`pohs locator subsection "${subsection}" is malformed (expected lowercase kebab-case, e.g. "vne")`);
	}
	const pohs: ParsedPohsLocator = { aircraftSlug, section: sectionSegment, subsection };
	return { kind: 'ok', segments, pohs };
}

/**
 * Format a POH locator from a parsed structure. Round-trips with
 * `parsePohsLocator`.
 */
export function formatPohsLocator(parsed: ParsedPohsLocator): string {
	const parts: string[] = [parsed.aircraftSlug];
	if (parsed.section !== undefined) {
		parts.push(parsed.section);
		if (parsed.section === EMERGENCY_LITERAL) {
			if (parsed.emergencyProcedure !== undefined) {
				parts.push(parsed.emergencyProcedure);
			}
		} else if (parsed.subsection !== undefined) {
			parts.push(parsed.subsection);
		}
	}
	return parts.join('/');
}
