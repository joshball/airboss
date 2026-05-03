/**
 * NTSB administrative law judge (ALJ) ruling locator parser.
 *
 * Source of truth: WP-NTSB-ALJ spec at `docs/work-packages/wp-ntsb-alj/spec.md`
 * + `docs/work-packages/library-completeness/spec.md` §4.A.
 *
 * Accepts the shapes the WP carves out for the `ntsb-alj` corpus:
 *
 *   <case-number>                             whole ruling (= final)
 *   <case-number>/<section>                   named opinion section
 *
 * Case-number format: `<prefix>-<digits>` where prefix is one of `ea`
 * (Enforcement Appeals -- Board orders), `se` (Safety / Enforcement
 * docket), `wd` (Withdrawal), or `ia` (Informal action). Stored
 * lowercase in the locator; canonical FAA presentations uppercase the
 * prefix (`EA-5567`).
 *
 * Section is one of `findings-of-fact`, `conclusions-of-law`, `order`,
 * `discussion`, `final` (default). The `final` section is implied when
 * no section segment is present.
 *
 * Pin format: ALJ rulings are immutable post-publication so `?at=` is
 * not required. The validator's row-3 pin-required check has a
 * per-corpus exception list that should include `ntsb-alj`.
 */

import type { LocatorError, ParsedLocator, ParsedNtsbAljLocator } from '../types.ts';

const ALJ_CASE_NUMBER_PATTERN = /^(ea|se|wd|ia)-([0-9]+)$/;
const ALJ_SECTION_PATTERN = /^(findings-of-fact|conclusions-of-law|order|discussion|final)$/;

function err(message: string): LocatorError {
	return { kind: 'error', message };
}

/**
 * Parse an `ntsb-alj` corpus locator. The locator is the segment after
 * `airboss-ref:ntsb-alj/`.
 */
export function parseNtsbAljLocator(locator: string): ParsedLocator | LocatorError {
	if (locator.length === 0) {
		return err('ntsb-alj locator is empty');
	}

	const segments = locator.split('/');

	const caseNumber = segments[0] ?? '';
	if (caseNumber.length === 0) {
		return err('ntsb-alj locator missing case number');
	}

	const idMatch = ALJ_CASE_NUMBER_PATTERN.exec(caseNumber);
	if (idMatch === null) {
		return err(
			`ntsb-alj locator case number "${caseNumber}" is malformed (expected lowercase prefix + dash + digits, one of ea-/se-/wd-/ia- followed by digits, e.g. "ea-5567")`,
		);
	}

	const prefix = idMatch[1];
	const sequence = idMatch[2];
	if (prefix === undefined || sequence === undefined) {
		return err(`ntsb-alj locator case number "${caseNumber}" failed to extract prefix/sequence`);
	}

	if (segments.length === 1) {
		const ntsbAlj: ParsedNtsbAljLocator = { caseNumber, prefix, sequence };
		return { kind: 'ok', segments, ntsbAlj };
	}

	const sectionSegment = segments[1] ?? '';
	if (segments.length > 2) {
		return err(`ntsb-alj locator has unexpected segments after "${sectionSegment}": "${segments.slice(2).join('/')}"`);
	}

	if (!ALJ_SECTION_PATTERN.test(sectionSegment)) {
		return err(
			`ntsb-alj locator section "${sectionSegment}" is malformed (expected one of: findings-of-fact, conclusions-of-law, order, discussion, final)`,
		);
	}

	const ntsbAlj: ParsedNtsbAljLocator = { caseNumber, prefix, sequence, section: sectionSegment };
	return { kind: 'ok', segments, ntsbAlj };
}

/**
 * Format an NTSB-ALJ locator from a parsed structure. Round-trips with
 * `parseNtsbAljLocator`.
 */
export function formatNtsbAljLocator(parsed: ParsedNtsbAljLocator): string {
	if (parsed.section !== undefined) {
		return `${parsed.caseNumber}/${parsed.section}`;
	}
	return parsed.caseNumber;
}
