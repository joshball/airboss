/**
 * Phase 10 -- Safety Alerts for Operators (SAFO) locator parser.
 *
 * Source of truth: ADR 019 §1.2 ("SAFO").
 *
 * Locator shape:
 *
 *   <safo-id>                                5-digit id (year + sequence), e.g. 23004
 *
 * Same shape as `info` (year + sequence). Distinct corpus because SAFO
 * is a regulatory category separate from InFO.
 *
 * SAFOs are immutable post-publication so no `?at=` pin is required.
 */

import type { LocatorError, ParsedLocator, ParsedSafoLocator } from '../types.ts';

const SAFO_ID_PATTERN = /^([0-9]{2})([0-9]{3})$/;

function err(message: string): LocatorError {
	return { kind: 'error', message };
}

/**
 * Parse a `safo` corpus locator. The locator is the segment after
 * `airboss-ref:safo/`, stripped of `?at=...`.
 */
export function parseSafoLocator(locator: string): ParsedLocator | LocatorError {
	if (locator.length === 0) {
		return err('safo locator is empty');
	}

	const segments = locator.split('/');
	if (segments.length > 1) {
		return err(`safo locator has unexpected segments (expected single 5-digit id, got "${locator}")`);
	}

	const safoId = segments[0] ?? '';
	const match = SAFO_ID_PATTERN.exec(safoId);
	if (match === null) {
		return err(
			`safo locator id "${safoId}" is malformed (expected 5 digits = 2-digit year + 3-digit sequence, e.g. "23004")`,
		);
	}
	const year = match[1];
	const sequence = match[2];
	if (year === undefined || sequence === undefined) {
		return err(`safo locator id "${safoId}" failed to extract year/sequence`);
	}

	const safo: ParsedSafoLocator = { safoId, year, sequence };
	return { kind: 'ok', segments, safo };
}

/**
 * Format a safo locator. Round-trips with `parseSafoLocator`.
 */
export function formatSafoLocator(parsed: ParsedSafoLocator): string {
	return parsed.safoId;
}
