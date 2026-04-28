/**
 * Phase 10 -- Federal statutes locator parser.
 *
 * Source of truth: ADR 019 §1.2 ("Statutes").
 *
 * Locator shape:
 *
 *   <title>/<section>                              e.g. usc-49/40103
 *   <title>/<section>/<subsection>                 e.g. usc-49/44102/a
 *
 * Title format: `usc-<title-number>` where the title number is a
 * decimal integer (1-54 for current US Code titles). Section is a
 * decimal integer (no dashes -- subsections live in the subsection
 * segment). Subsection identifier is one or more lowercase letters or
 * digits (`a`, `b`, `1`, `a-1`); the parser preserves the verbatim
 * lowercase token.
 */

import type { LocatorError, ParsedLocator, ParsedStatutesLocator } from '../types.ts';

const TITLE_PATTERN = /^usc-([1-9][0-9]?)$/;
const SECTION_PATTERN = /^[1-9][0-9]*$/;
const SUBSECTION_PATTERN = /^[a-z0-9][a-z0-9-]*$/;

function err(message: string): LocatorError {
	return { kind: 'error', message };
}

/**
 * Parse a `statutes` corpus locator. The locator is the segment after
 * `airboss-ref:statutes/`, stripped of `?at=...`.
 */
export function parseStatutesLocator(locator: string): ParsedLocator | LocatorError {
	if (locator.length === 0) {
		return err('statutes locator is empty');
	}

	const segments = locator.split('/');
	if (segments.length < 2 || segments.length > 3) {
		return err(
			`statutes locator has unexpected segment count (expected "<title>/<section>" or "<title>/<section>/<subsection>", got "${locator}")`,
		);
	}

	const title = segments[0] ?? '';
	const titleMatch = TITLE_PATTERN.exec(title);
	if (titleMatch === null) {
		return err(`statutes locator title "${title}" is malformed (expected "usc-<title-number>", e.g. "usc-49")`);
	}
	const titleNumber = titleMatch[1];
	if (titleNumber === undefined) {
		return err(`statutes locator title "${title}" failed to extract title number`);
	}

	const section = segments[1] ?? '';
	if (!SECTION_PATTERN.test(section)) {
		return err(`statutes locator section "${section}" is malformed (expected positive integer, e.g. "40103")`);
	}

	if (segments.length === 2) {
		const statutes: ParsedStatutesLocator = { title, titleNumber, section };
		return { kind: 'ok', segments, statutes };
	}

	const subsection = segments[2] ?? '';
	if (!SUBSECTION_PATTERN.test(subsection)) {
		return err(
			`statutes locator subsection "${subsection}" is malformed (expected lowercase identifier, e.g. "a", "b-1")`,
		);
	}
	const statutes: ParsedStatutesLocator = { title, titleNumber, section, subsection };
	return { kind: 'ok', segments, statutes };
}

/**
 * Format a statutes locator from a parsed structure. Round-trips with
 * `parseStatutesLocator`.
 */
export function formatStatutesLocator(parsed: ParsedStatutesLocator): string {
	const parts: string[] = [parsed.title, parsed.section];
	if (parsed.subsection !== undefined) {
		parts.push(parsed.subsection);
	}
	return parts.join('/');
}
