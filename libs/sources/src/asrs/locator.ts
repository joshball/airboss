/**
 * Phase 10 -- Aviation Safety Reporting System (ASRS) locator parser.
 *
 * Source of truth: ADR 019 §1.2 ("ASRS").
 *
 * Locator shape:
 *
 *   <acn>                                7-digit ACN, e.g. 1234567
 *
 * The Accession Number (ACN) is NASA's monotonically-increasing report
 * id. As of mid-2026 ACNs have crossed into 7-digit territory; the
 * parser accepts 6 or 7 digits to cover both legacy reports and the
 * current numbering range.
 *
 * ASRS reports are immutable post-publication so no `?at=` pin is used.
 */

import type { LocatorError, ParsedAsrsLocator, ParsedLocator } from '../types.ts';

const ACN_PATTERN = /^[0-9]{6,7}$/;

function err(message: string): LocatorError {
	return { kind: 'error', message };
}

/**
 * Parse an `asrs` corpus locator. The locator is the segment after
 * `airboss-ref:asrs/`.
 */
export function parseAsrsLocator(locator: string): ParsedLocator | LocatorError {
	if (locator.length === 0) {
		return err('asrs locator is empty');
	}

	const segments = locator.split('/');
	if (segments.length > 1) {
		return err(`asrs locator has unexpected segments (expected single ACN, got "${locator}")`);
	}

	const acn = segments[0] ?? '';
	if (!ACN_PATTERN.test(acn)) {
		return err(`asrs locator ACN "${acn}" is malformed (expected 6 or 7 digits, e.g. "1234567")`);
	}

	const asrs: ParsedAsrsLocator = { acn };
	return { kind: 'ok', segments, asrs };
}

/**
 * Format an asrs locator. Round-trips with `parseAsrsLocator`.
 */
export function formatAsrsLocator(parsed: ParsedAsrsLocator): string {
	return parsed.acn;
}
