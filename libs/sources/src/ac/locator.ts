/**
 * Phase 8 -- Advisory Circular locator parser.
 *
 * Source of truth: ADR 019 §1.2 ("AC") + the WP at
 * `docs/work-packages/reference-ac-ingestion/`.
 *
 * Accepts every shape ADR 019 §1.2 lists for the `ac` corpus:
 *
 *   <doc-number>/<revision>                       whole AC at this revision
 *   <doc-number>/<revision>/section-<n>           section
 *   <doc-number>/<revision>/change-<n>            Change <n> issued against the revision
 *
 * Per ADR 019, an unrevisioned `ac/<doc-number>` is rejected. The parser
 * enforces this by failing when the revision segment is missing or malformed.
 *
 * Pin format: `?at=YYYY-MM-DD`. The pin is stripped before `parseAcLocator`
 * is called; this module only sees the locator portion.
 */

import type { LocatorError, ParsedAcLocator, ParsedLocator } from '../types.ts';

const DOC_NUMBER_PATTERN = /^[0-9]{1,3}(?:[-.][0-9]{1,3}){1,3}$/;
const REVISION_PATTERN = /^[a-z]$/;
const SECTION_PATTERN = /^section-([1-9][0-9]{0,2})$/;
const CHANGE_PATTERN = /^change-([1-9][0-9]?)$/;

function err(message: string): LocatorError {
	return { kind: 'error', message };
}

/**
 * Parse an `ac` corpus locator. Input is the segment after `airboss-ref:ac/`,
 * with `?at=...` already stripped.
 */
export function parseAcLocator(locator: string): ParsedLocator | LocatorError {
	if (locator.length === 0) {
		return err('ac locator is empty');
	}

	const segments = locator.split('/');

	const docNumber = segments[0] ?? '';
	if (docNumber.length === 0) {
		return err('ac locator missing doc number');
	}
	if (!DOC_NUMBER_PATTERN.test(docNumber)) {
		return err(`ac locator doc number "${docNumber}" is malformed (expected digits with dots/dashes, e.g. "61-65" or "91-21.1")`);
	}

	const revision = segments[1] ?? '';
	if (revision.length === 0) {
		return err(`ac locator missing revision (expected "${docNumber}/<revision>" e.g. "${docNumber}/j") -- unrevisioned ACs are rejected per ADR 019 §1.2`);
	}
	if (!REVISION_PATTERN.test(revision)) {
		return err(`ac locator revision "${revision}" is malformed (expected single lowercase letter)`);
	}

	if (segments.length === 2) {
		const ac: ParsedAcLocator = { docNumber, revision };
		return { kind: 'ok', segments, ac };
	}

	const sub = segments[2] ?? '';
	if (segments.length > 3) {
		return err(`ac locator has unexpected segments after "${sub}": "${segments.slice(3).join('/')}"`);
	}

	const sectionMatch = SECTION_PATTERN.exec(sub);
	if (sectionMatch !== null) {
		const section = sectionMatch[1];
		if (section === undefined) {
			return err(`ac locator section "${sub}" is malformed (no number captured)`);
		}
		const ac: ParsedAcLocator = { docNumber, revision, section };
		return { kind: 'ok', segments, ac };
	}

	const changeMatch = CHANGE_PATTERN.exec(sub);
	if (changeMatch !== null) {
		const change = changeMatch[1];
		if (change === undefined) {
			return err(`ac locator change "${sub}" is malformed (no number captured)`);
		}
		const ac: ParsedAcLocator = { docNumber, revision, change };
		return { kind: 'ok', segments, ac };
	}

	return err(`ac locator sub-segment "${sub}" is malformed (expected "section-<n>" or "change-<n>")`);
}

/**
 * Format an AC locator from a parsed structure. Round-trips with
 * `parseAcLocator`. Used by the ingest to canonicalise SourceIds and by tests.
 */
export function formatAcLocator(parsed: ParsedAcLocator): string {
	const parts = [parsed.docNumber, parsed.revision];
	if (parsed.section !== undefined) {
		parts.push(`section-${parsed.section}`);
	} else if (parsed.change !== undefined) {
		parts.push(`change-${parsed.change}`);
	}
	return parts.join('/');
}
