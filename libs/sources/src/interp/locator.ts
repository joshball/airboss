/**
 * Phase 10 -- Legal interpretations locator parser.
 *
 * Source of truth: ADR 019 §1.2 ("Legal interpretations").
 *
 * Accepts every shape ADR 019 §1.2 lists for the `interp` corpus:
 *
 *   chief-counsel/<author-year>            e.g. mangiamele-2009, walker-2017
 *   ntsb/<case-name>                       e.g. administrator-v-lobeiko
 *   ntsb/<case-name>?ea=<order-number>     EA-order disambiguation (query, not segment)
 *
 * The `?ea=` query parameter is part of the URL but is stripped by the
 * upstream `parseIdentifier` before this parser sees the locator string.
 * Callers carrying an EA discriminator pass it via the `eaOrder` argument
 * which round-trips through the parsed payload.
 *
 * Author-year tokens are kebab-case (`mangiamele-2009`); the year is the
 * last 4 digits, the author is the rest (so multi-word authors like
 * `van-tassel-1987` parse correctly). NTSB case names use kebab-case and
 * preserve the `-v-` between parties.
 */

import type { LocatorError, ParsedInterpLocator, ParsedLocator } from '../types.ts';

const AUTHORITIES = ['chief-counsel', 'ntsb'] as const;
const AUTHOR_YEAR_PATTERN = /^([a-z][a-z0-9-]*?)-([0-9]{4})$/;
const CASE_NAME_PATTERN = /^[a-z0-9][a-z0-9-]*$/;

function err(message: string): LocatorError {
	return { kind: 'error', message };
}

/**
 * Parse an `interp` corpus locator.
 *
 * @param locator The locator portion (after `airboss-ref:interp/`, with
 *   `?at=` and `?ea=` already stripped).
 * @param eaOrder Optional EA-order discriminator, captured upstream from the
 *   URL's `?ea=` parameter. Round-tripped through the parsed payload.
 */
export function parseInterpLocator(locator: string, eaOrder?: string): ParsedLocator | LocatorError {
	if (locator.length === 0) {
		return err('interp locator is empty');
	}

	const segments = locator.split('/');
	const authority = segments[0] ?? '';
	if (!AUTHORITIES.includes(authority as (typeof AUTHORITIES)[number])) {
		return err(`interp locator authority "${authority}" is not yet supported (known: ${AUTHORITIES.join(', ')})`);
	}

	if (segments.length !== 2) {
		return err(`interp locator has unexpected segment count (expected "${authority}/<slug>", got "${locator}")`);
	}

	const slug = segments[1] ?? '';
	if (slug.length === 0) {
		return err(`interp locator missing slug (expected "${authority}/<slug>")`);
	}

	if (authority === 'chief-counsel') {
		const match = AUTHOR_YEAR_PATTERN.exec(slug);
		if (match === null) {
			return err(
				`interp locator chief-counsel slug "${slug}" is malformed (expected "<author>-<YYYY>", e.g. "mangiamele-2009")`,
			);
		}
		const author = match[1];
		const year = match[2];
		if (author === undefined || year === undefined) {
			return err(`interp locator chief-counsel slug "${slug}" failed to extract author/year`);
		}
		const interp: ParsedInterpLocator = {
			authority: 'chief-counsel',
			slug,
			author,
			year,
			...(eaOrder !== undefined ? { eaOrder } : {}),
		};
		return { kind: 'ok', segments, interp };
	}

	// authority === 'ntsb'
	if (!CASE_NAME_PATTERN.test(slug)) {
		return err(
			`interp locator ntsb case name "${slug}" is malformed (expected lowercase kebab-case, e.g. "administrator-v-lobeiko")`,
		);
	}
	const interp: ParsedInterpLocator = {
		authority: 'ntsb',
		slug,
		...(eaOrder !== undefined ? { eaOrder } : {}),
	};
	return { kind: 'ok', segments, interp };
}

/**
 * Format an interp locator from a parsed structure. Round-trips with
 * `parseInterpLocator`.
 */
export function formatInterpLocator(parsed: ParsedInterpLocator): string {
	return `${parsed.authority}/${parsed.slug}`;
}
