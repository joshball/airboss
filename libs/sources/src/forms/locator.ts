/**
 * Phase 10 -- FAA forms locator parser.
 *
 * Source of truth: ADR 019 §1.2 ("Forms").
 *
 * Locator shape:
 *
 *   <form-number>                           e.g. 8710-1, 8500-9
 *
 * Form numbers use the FAA's catalog form: digits, dashes, and an
 * optional trailing letter (e.g. `8710-1`, `8060-4`, `8500-9`).
 *
 * Pin format: `?at=YYYY-MM` for the form's revision tag.
 */

import type { LocatorError, ParsedFormsLocator, ParsedLocator } from '../types.ts';

const FORM_NUMBER_PATTERN = /^[0-9]{2,5}(?:-[0-9]{1,3})?[A-Z]?$/;

function err(message: string): LocatorError {
	return { kind: 'error', message };
}

/**
 * Parse a `forms` corpus locator. The locator is the segment after
 * `airboss-ref:forms/`, stripped of `?at=...`.
 */
export function parseFormsLocator(locator: string): ParsedLocator | LocatorError {
	if (locator.length === 0) {
		return err('forms locator is empty');
	}

	const segments = locator.split('/');
	if (segments.length > 1) {
		return err(`forms locator has unexpected segments (expected single form number, got "${locator}")`);
	}
	const formNumber = segments[0] ?? '';
	if (!FORM_NUMBER_PATTERN.test(formNumber)) {
		return err(
			`forms locator form number "${formNumber}" is malformed (expected digits with optional dash + revision letter, e.g. "8710-1", "8500-9")`,
		);
	}
	const forms: ParsedFormsLocator = { formNumber };
	return { kind: 'ok', segments, forms };
}

/**
 * Format a forms locator. Round-trips with `parseFormsLocator`.
 */
export function formatFormsLocator(parsed: ParsedFormsLocator): string {
	return parsed.formNumber;
}
