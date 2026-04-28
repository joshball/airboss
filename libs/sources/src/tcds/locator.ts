/**
 * Phase 10 -- Type Certificate Data Sheet (TCDS) locator parser.
 *
 * Source of truth: ADR 019 §1.2 ("TCDS").
 *
 * Locator shape:
 *
 *   <tcds-number>                         FAA catalog number, e.g. 3a12, a00009ch
 *
 * TCDS numbers are FAA's catalog identifiers, mixing letters and digits
 * in arbitrary order (`3A12`, `A00009CH`, `7A11`, `E5SO`). The parser
 * accepts the verbatim catalog form lowercased, since the FAA's regulatory
 * dynamics database normalizes to lowercase in URLs.
 */

import type { LocatorError, ParsedLocator, ParsedTcdsLocator } from '../types.ts';

const TCDS_NUMBER_PATTERN = /^[a-z0-9]{2,12}$/;

function err(message: string): LocatorError {
	return { kind: 'error', message };
}

/**
 * Parse a `tcds` corpus locator. The locator is the segment after
 * `airboss-ref:tcds/`, stripped of `?at=...`.
 */
export function parseTcdsLocator(locator: string): ParsedLocator | LocatorError {
	if (locator.length === 0) {
		return err('tcds locator is empty');
	}

	const segments = locator.split('/');
	if (segments.length > 1) {
		return err(`tcds locator has unexpected segments (expected single TCDS number, got "${locator}")`);
	}
	const tcdsNumber = segments[0] ?? '';
	if (!TCDS_NUMBER_PATTERN.test(tcdsNumber)) {
		return err(
			`tcds locator number "${tcdsNumber}" is malformed (expected lowercase alphanumeric 2-12 chars, e.g. "3a12", "a00009ch")`,
		);
	}
	const tcds: ParsedTcdsLocator = { tcdsNumber };
	return { kind: 'ok', segments, tcds };
}

/**
 * Format a tcds locator. Round-trips with `parseTcdsLocator`.
 */
export function formatTcdsLocator(parsed: ParsedTcdsLocator): string {
	return parsed.tcdsNumber;
}
