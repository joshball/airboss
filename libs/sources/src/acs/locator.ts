/**
 * ACS / PTS corpus locator parser.
 *
 * Source of truth: ADR 019 §1.2 ("ACS") + the WP at
 * `docs/work-packages/cert-syllabus-and-goal-composer/`.
 *
 * Accepts the shapes ADR 019 §1.2 documents for the `acs` corpus:
 *
 *   <cert>/<edition>                                            whole publication
 *   <cert>/<edition>/area-<roman>                               area
 *   <cert>/<edition>/area-<roman>/task-<letter>                 task
 *   <cert>/<edition>/area-<roman>/task-<letter>/element-<k|r|s><ord>   element
 *
 * The K/R/S element prefix is the ACS triad (Knowledge / Risk management /
 * Skill); the parser explicitly preserves both the triad letter and the
 * ordinal so downstream BC code can present them separately.
 *
 * NOTE: Open Question 7 of the cert-syllabus WP (final ACS locator
 * convention) is still pending; this implementation pins to ADR 019 §1.2's
 * example. If the convention resolves differently, the parser updates here
 * without breaking the parser-locator type's `segments` consumers.
 */

import type { LocatorError, ParsedAcsLocator, ParsedLocator } from '../types.ts';

/**
 * Enumerated ACS / PTS cert slugs. Mirrors the credential slugs used by the
 * cert-syllabus WP for ACS-publishing certs. Adding a new ACS cert here is
 * non-breaking; the parser rejects unknown cert slugs to catch typos at the
 * earliest layer.
 */
export const ACS_CERT_SLUGS: readonly string[] = [
	'ppl-asel',
	'ppl-amel',
	'ppl-ases',
	'ppl-ames',
	'ppl-helo',
	'ppl-glider',
	'ipl', // Instrument-airplane (instrument rating)
	'ipl-helo',
	'cpl-asel',
	'cpl-amel',
	'cpl-ases',
	'cpl-ames',
	'cpl-helo',
	'atp-amel',
	'atp-asel',
	'cfi-asel',
	'cfi-amel',
	'cfi-helo',
	'cfii-asel',
	'cfii-amel',
	'cfii-helo',
	'mei',
	'meii',
];

/**
 * ACS / PTS edition slug pattern. The FAA publication ID format is
 * `faa-s-<series>-<number>` (e.g. `faa-s-acs-25`, `faa-s-acs-6b`). Slug-
 * encoded; the parser compares lowercased.
 */
const EDITION_PATTERN = /^faa-s-[a-z0-9]+(-[a-z0-9]+){1,3}$/;
const AREA_PATTERN = /^area-([ivxlcdm]+)$/;
const TASK_PATTERN = /^task-([a-z])$/;
const ELEMENT_PATTERN = /^element-([krs])([1-9][0-9]?)$/;

function err(message: string): LocatorError {
	return { kind: 'error', message };
}

/**
 * Parse an `acs` corpus locator. Input is the segment after
 * `airboss-ref:acs/`, with `?at=...` already stripped.
 */
export function parseAcsLocator(locator: string): ParsedLocator | LocatorError {
	if (locator.length === 0) {
		return err('acs locator is empty');
	}

	const segments = locator.split('/');

	const cert = segments[0] ?? '';
	if (cert.length === 0) {
		return err('acs locator missing cert slug');
	}
	if (!ACS_CERT_SLUGS.includes(cert)) {
		return err(`acs locator cert "${cert}" is not one of: ${ACS_CERT_SLUGS.join(', ')}`);
	}

	const edition = segments[1] ?? '';
	if (edition.length === 0) {
		return err(`acs locator missing edition (e.g. "${cert}/faa-s-acs-25")`);
	}
	if (!EDITION_PATTERN.test(edition)) {
		return err(`acs locator edition "${edition}" is malformed (expected e.g. "faa-s-acs-25")`);
	}

	// Whole publication: <cert>/<edition>
	if (segments.length === 2) {
		const acs: ParsedAcsLocator = { cert, edition };
		return { kind: 'ok', segments, acs };
	}

	// Area: <cert>/<edition>/area-<roman>
	const areaSeg = segments[2] ?? '';
	const areaMatch = AREA_PATTERN.exec(areaSeg);
	if (areaMatch === null) {
		return err(`acs locator area segment "${areaSeg}" is malformed (expected "area-<roman>" e.g. "area-v")`);
	}
	const area = areaMatch[1];
	if (area === undefined) {
		return err(`acs locator area segment "${areaSeg}" is malformed (no roman numeral captured)`);
	}

	if (segments.length === 3) {
		const acs: ParsedAcsLocator = { cert, edition, area };
		return { kind: 'ok', segments, acs };
	}

	// Task: <cert>/<edition>/area-<roman>/task-<letter>
	const taskSeg = segments[3] ?? '';
	const taskMatch = TASK_PATTERN.exec(taskSeg);
	if (taskMatch === null) {
		return err(`acs locator task segment "${taskSeg}" is malformed (expected "task-<letter>" e.g. "task-a")`);
	}
	const task = taskMatch[1];
	if (task === undefined) {
		return err(`acs locator task segment "${taskSeg}" is malformed (no letter captured)`);
	}

	if (segments.length === 4) {
		const acs: ParsedAcsLocator = { cert, edition, area, task };
		return { kind: 'ok', segments, acs };
	}

	// Element: <cert>/<edition>/area-<roman>/task-<letter>/element-<triad><ord>
	const elementSeg = segments[4] ?? '';
	const elementMatch = ELEMENT_PATTERN.exec(elementSeg);
	if (elementMatch === null) {
		return err(
			`acs locator element segment "${elementSeg}" is malformed (expected "element-<k|r|s><ord>" e.g. "element-k1")`,
		);
	}
	const triadLetter = elementMatch[1] as 'k' | 'r' | 's' | undefined;
	const ordinal = elementMatch[2];
	if (triadLetter === undefined || ordinal === undefined) {
		return err(`acs locator element segment "${elementSeg}" is malformed (triad or ordinal missing)`);
	}

	if (segments.length > 5) {
		return err(`acs locator has unexpected segments after element: "${segments.slice(5).join('/')}"`);
	}

	const acs: ParsedAcsLocator = {
		cert,
		edition,
		area,
		task,
		elementTriad: triadLetter,
		elementOrdinal: ordinal,
	};
	return { kind: 'ok', segments, acs };
}

/**
 * Format an ACS locator from a parsed structure. Round-trips with
 * `parseAcsLocator`. Useful for canonicalising authored identifiers and for
 * tests that need to derive a locator from a triad of fields.
 */
export function formatAcsLocator(parsed: ParsedAcsLocator): string {
	const parts: string[] = [parsed.cert, parsed.edition];
	if (parsed.area === undefined) return parts.join('/');
	parts.push(`area-${parsed.area}`);
	if (parsed.task === undefined) return parts.join('/');
	parts.push(`task-${parsed.task}`);
	if (parsed.elementTriad === undefined || parsed.elementOrdinal === undefined) return parts.join('/');
	parts.push(`element-${parsed.elementTriad}${parsed.elementOrdinal}`);
	return parts.join('/');
}
