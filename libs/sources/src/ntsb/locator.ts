/**
 * Phase 10 -- NTSB report locator parser.
 *
 * Source of truth: ADR 019 §1.2 ("NTSB reports") + the WP at
 * `docs/work-packages/reference-irregular-corpora/`.
 *
 * Accepts every shape ADR 019 §1.2 lists for the `ntsb` corpus:
 *
 *   <ntsb-id>                                whole report (= final)
 *   <ntsb-id>/<section>                      named section
 *
 * NTSB ID format: `<region><YY><type><sequence>` -- 3-letter region
 * (`WPR`, `CEN`, `ANC`, `ERA`, `GAA`, `CHI`, `DCA`, `MIA`), 2-digit
 * year, 2-letter type code (`LA` light accident / `FA` fatal accident /
 * `MA` major / `IA` incident), 3-digit sequence number.
 *
 * Section is one of `factual`, `probable-cause`, `recommendations`,
 * `dockets`, `final` (default). The `final` section is implied when
 * no section segment is present.
 *
 * Pin format: NTSB reports are immutable post-publication so
 * `?at=<edition>` is not used; the validator's row-3 pin-required check
 * has a per-corpus exception list that includes `ntsb`.
 */

import type { LocatorError, ParsedLocator, ParsedNtsbLocator } from '../types.ts';

const NTSB_ID_PATTERN = /^([A-Z]{3})([0-9]{2})(LA|FA|MA|IA)([0-9]{3})$/;
const SECTION_PATTERN = /^(factual|probable-cause|recommendations|dockets|final)$/;

function err(message: string): LocatorError {
	return { kind: 'error', message };
}

/**
 * Parse an `ntsb` corpus locator. The locator is the segment after
 * `airboss-ref:ntsb/`.
 */
export function parseNtsbLocator(locator: string): ParsedLocator | LocatorError {
	if (locator.length === 0) {
		return err('ntsb locator is empty');
	}

	const segments = locator.split('/');

	const ntsbId = segments[0] ?? '';
	if (ntsbId.length === 0) {
		return err('ntsb locator missing NTSB ID');
	}

	const idMatch = NTSB_ID_PATTERN.exec(ntsbId);
	if (idMatch === null) {
		return err(
			`ntsb locator id "${ntsbId}" is malformed (expected 3-letter region + 2-digit year + LA/FA/MA/IA + 3-digit sequence, e.g. "WPR23LA123")`,
		);
	}

	const region = idMatch[1];
	const year = idMatch[2];
	const type = idMatch[3];
	const sequence = idMatch[4];
	if (region === undefined || year === undefined || type === undefined || sequence === undefined) {
		return err(`ntsb locator id "${ntsbId}" failed to extract components`);
	}

	if (segments.length === 1) {
		const ntsb: ParsedNtsbLocator = { ntsbId, region, year, type, sequence };
		return { kind: 'ok', segments, ntsb };
	}

	const sectionSegment = segments[1] ?? '';
	if (segments.length > 2) {
		return err(`ntsb locator has unexpected segments after "${sectionSegment}": "${segments.slice(2).join('/')}"`);
	}

	if (!SECTION_PATTERN.test(sectionSegment)) {
		return err(
			`ntsb locator section "${sectionSegment}" is malformed (expected one of: factual, probable-cause, recommendations, dockets, final)`,
		);
	}

	const ntsb: ParsedNtsbLocator = { ntsbId, region, year, type, sequence, section: sectionSegment };
	return { kind: 'ok', segments, ntsb };
}

/**
 * Format an NTSB locator from a parsed structure. Round-trips with
 * `parseNtsbLocator`. Used by tests.
 */
export function formatNtsbLocator(parsed: ParsedNtsbLocator): string {
	if (parsed.section !== undefined) {
		return `${parsed.ntsbId}/${parsed.section}`;
	}
	return parsed.ntsbId;
}
