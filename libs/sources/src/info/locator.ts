/**
 * Phase 10 -- Information for Operators (InFO) locator parser.
 *
 * Source of truth: ADR 019 §1.2 ("InFO").
 *
 * Locator shape:
 *
 *   <info-id>                                5-digit id (year + sequence), e.g. 21010
 *
 * The first 2 digits are the 2-digit year (e.g. `21` -> 2021); the last
 * 3 digits are the sequence number within that year. The parser
 * preserves the verbatim 5-digit form and exposes year + sequence as
 * convenience fields.
 *
 * InFOs are immutable post-publication so no `?at=` pin is required.
 */

import type { LocatorError, ParsedInfoLocator, ParsedLocator } from '../types.ts';

const INFO_ID_PATTERN = /^([0-9]{2})([0-9]{3})$/;

function err(message: string): LocatorError {
	return { kind: 'error', message };
}

/**
 * Parse an `info` corpus locator. The locator is the segment after
 * `airboss-ref:info/`, stripped of `?at=...`.
 */
export function parseInfoLocator(locator: string): ParsedLocator | LocatorError {
	if (locator.length === 0) {
		return err('info locator is empty');
	}

	const segments = locator.split('/');
	if (segments.length > 1) {
		return err(`info locator has unexpected segments (expected single 5-digit id, got "${locator}")`);
	}

	const infoId = segments[0] ?? '';
	const match = INFO_ID_PATTERN.exec(infoId);
	if (match === null) {
		return err(
			`info locator id "${infoId}" is malformed (expected 5 digits = 2-digit year + 3-digit sequence, e.g. "21010")`,
		);
	}
	const year = match[1];
	const sequence = match[2];
	if (year === undefined || sequence === undefined) {
		return err(`info locator id "${infoId}" failed to extract year/sequence`);
	}

	const info: ParsedInfoLocator = { infoId, year, sequence };
	return { kind: 'ok', segments, info };
}

/**
 * Format an info locator. Round-trips with `parseInfoLocator`.
 */
export function formatInfoLocator(parsed: ParsedInfoLocator): string {
	return parsed.infoId;
}
