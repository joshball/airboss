/**
 * Phase 3 -- CFR locator parser.
 *
 * Source of truth: ADR 019 §1.2 ("Regulations") + the WP at
 * `docs/work-packages/reference-cfr-ingestion-bulk/`.
 *
 * Accepts every shape ADR 019 §1.2 lists for the `regs` corpus:
 *
 *   cfr-14/<part>/<section>                section
 *   cfr-14/<part>/<section>/<paragraph>... paragraph segments (resolves to section)
 *   cfr-14/<part>/subpart-<letter>         whole subpart
 *   cfr-14/<part>                          whole Part
 *   cfr-49/...                             same shapes under Title 49
 *
 * Returns a `ParsedLocator` with the structured `regs` payload (per
 * `libs/sources/src/types.ts`) so downstream consumers (resolver, renderer)
 * don't re-parse the slash-separated string.
 */

import type { LocatorError, ParsedLocator, ParsedRegsLocator } from '../types.ts';

const TITLE_PREFIX_14 = 'cfr-14';
const TITLE_PREFIX_49 = 'cfr-49';

const PART_PATTERN = /^[1-9][0-9]{0,3}$/;
const SUBPART_PATTERN = /^subpart-[a-z]+$/;
const SECTION_PATTERN = /^[1-9][0-9]{0,4}([a-z]?)$/;
const PARAGRAPH_SEG_PATTERN = /^[a-z0-9]+$/;

function err(message: string): LocatorError {
	return { kind: 'error', message };
}

/**
 * Parse a `regs` corpus locator. The locator is the segment after `airboss-ref:regs/`,
 * stripped of `?at=...`. Returns a `ParsedLocator` with `regs` payload on success.
 */
export function parseRegsLocator(locator: string): ParsedLocator | LocatorError {
	if (locator.length === 0) {
		return err('regs locator is empty');
	}

	const segments = locator.split('/');
	if (segments.length < 1) {
		return err('regs locator has no segments');
	}

	const titleSlug = segments[0];
	if (titleSlug !== TITLE_PREFIX_14 && titleSlug !== TITLE_PREFIX_49) {
		return err(`regs locator must start with "cfr-14" or "cfr-49"; got "${titleSlug ?? ''}"`);
	}

	const title: '14' | '49' = titleSlug === TITLE_PREFIX_14 ? '14' : '49';

	if (segments.length < 2) {
		return err(`regs locator missing part: "${locator}"`);
	}

	const part = segments[1] ?? '';
	if (!PART_PATTERN.test(part)) {
		return err(`regs locator part "${part}" is not a valid CFR part (expected digits)`);
	}

	// Whole-Part reference: cfr-14/91
	if (segments.length === 2) {
		const regs: ParsedRegsLocator = { title, part };
		return { kind: 'ok', segments, regs };
	}

	const third = segments[2] ?? '';

	// Subpart reference: cfr-14/91/subpart-b
	if (third.startsWith('subpart-')) {
		if (!SUBPART_PATTERN.test(third)) {
			return err(`regs locator subpart "${third}" is malformed (expected "subpart-<letter>")`);
		}
		if (segments.length > 3) {
			return err(`regs locator has unexpected segments after subpart: "${segments.slice(3).join('/')}"`);
		}
		const subpart = third.slice('subpart-'.length);
		const regs: ParsedRegsLocator = { title, part, subpart };
		return { kind: 'ok', segments, regs };
	}

	// Section reference: cfr-14/91/103 (and optional paragraph segments after)
	if (!SECTION_PATTERN.test(third)) {
		return err(`regs locator section "${third}" is malformed (expected digits, optional trailing letter)`);
	}

	const section = third;
	const paragraph: string[] = [];
	for (let i = 3; i < segments.length; i += 1) {
		const seg = segments[i] ?? '';
		if (!PARAGRAPH_SEG_PATTERN.test(seg)) {
			return err(`regs locator paragraph segment "${seg}" contains illegal characters`);
		}
		paragraph.push(seg);
	}

	const regs: ParsedRegsLocator =
		paragraph.length === 0 ? { title, part, section } : { title, part, section, paragraph };

	return { kind: 'ok', segments, regs };
}
