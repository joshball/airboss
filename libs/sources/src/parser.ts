/**
 * `airboss-ref:` URI parser. Source of truth: ADR 019 §1.1 + §1.1.1.
 *
 * Strict: rejects path-absolute (`airboss-ref:/...`) and authority-based
 * (`airboss-ref://...`) forms with specific error messages, even though the
 * WHATWG URL parser accepts all three syntactic variants. Whitespace is
 * trimmed before parsing. The locator is treated as opaque (multi-segment
 * permitted); per-corpus locator validation lives in the per-corpus resolver
 * shipped by later phases.
 *
 * The `unknown:` magic prefix (ADR 019 §1.7) is recognised here as a regular
 * shape with `corpus === 'unknown'`. The validator's row-0 rule emits the
 * transitional-reference ERROR for it.
 */

import type { ParsedIdentifier, ParseError } from './types.ts';

/** The required URI scheme. */
const SCHEME = 'airboss-ref:';

/**
 * Parse a raw string as an `airboss-ref:` URL. Returns either a
 * `ParsedIdentifier` (success) or `ParseError` (rejected). Never throws.
 *
 * Behavior:
 * - Trims leading and trailing whitespace.
 * - Rejects strings that don't start with `airboss-ref:` (after trim).
 * - Rejects path-absolute (`airboss-ref:/...`) with a specific message.
 * - Rejects authority-based (`airboss-ref://...`) with a specific message.
 * - Splits the rest on the first `?` to separate locator-path from query.
 * - Splits the locator-path on the first `/` to extract corpus + locator.
 * - Reads `at` from the query string when present; null otherwise.
 * - Multi-segment locators are returned verbatim; the parser does not enforce
 *   segment depth or per-corpus shape.
 */
export function parseIdentifier(rawInput: string): ParsedIdentifier | ParseError {
	const raw = rawInput.trim();

	if (!raw.startsWith(SCHEME)) {
		return {
			kind: 'not-airboss-ref',
			message: `Not an airboss-ref: URL: ${rawInput}`,
			raw: rawInput,
		};
	}

	// Everything after the scheme.
	const afterScheme = raw.slice(SCHEME.length);

	// Reject path-absolute (`airboss-ref:/...`) and authority-based
	// (`airboss-ref://...`). Authority-based has TWO leading slashes; check it
	// first so the path-absolute message doesn't mask the more specific one.
	if (afterScheme.startsWith('//')) {
		return {
			kind: 'authority-based',
			message: 'authority-based form is not canonical; use path-rootless `airboss-ref:<corpus>/<locator>`',
			raw: rawInput,
		};
	}
	if (afterScheme.startsWith('/')) {
		return {
			kind: 'path-absolute',
			message: 'path-absolute form is not canonical; use path-rootless `airboss-ref:<corpus>/<locator>`',
			raw: rawInput,
		};
	}

	if (afterScheme.length === 0) {
		return {
			kind: 'empty-corpus',
			message: 'airboss-ref: URL has no corpus or locator',
			raw: rawInput,
		};
	}

	// Split off the query string (everything after the first `?`).
	const queryStart = afterScheme.indexOf('?');
	const pathPart = queryStart === -1 ? afterScheme : afterScheme.slice(0, queryStart);
	const queryPart = queryStart === -1 ? null : afterScheme.slice(queryStart + 1);

	// Split corpus / locator on the first `/`.
	const slashIndex = pathPart.indexOf('/');
	if (slashIndex === -1) {
		// No slash: the whole thing is corpus, no locator.
		return {
			kind: 'empty-locator',
			message: 'airboss-ref: URL has no locator (expected `airboss-ref:<corpus>/<locator>`)',
			raw: rawInput,
		};
	}

	const corpus = pathPart.slice(0, slashIndex);
	const locator = pathPart.slice(slashIndex + 1);

	if (corpus.length === 0) {
		// Defensive: `airboss-ref:/x` is caught by the path-absolute branch above,
		// but keep this for clarity if the input is something exotic.
		return {
			kind: 'empty-corpus',
			message: 'airboss-ref: URL has empty corpus',
			raw: rawInput,
		};
	}
	if (locator.length === 0) {
		return {
			kind: 'empty-locator',
			message: 'airboss-ref: URL has empty locator',
			raw: rawInput,
		};
	}

	let pin: string | null = null;
	if (queryPart !== null) {
		const result = readAtParam(queryPart);
		if (result.kind === 'error') {
			return {
				kind: 'malformed-query',
				message: result.message,
				raw: rawInput,
			};
		}
		pin = result.value;
	}

	return { raw, corpus, locator, pin };
}

interface AtParamOk {
	kind: 'ok';
	value: string | null;
}
interface AtParamErr {
	kind: 'error';
	message: string;
}

/**
 * Read the `at` parameter from a URL query string. Other parameters are
 * tolerated but ignored (per ADR 019 §1.1: `?at=` is the documented param;
 * future params will be defined by their owning concern).
 */
function readAtParam(query: string): AtParamOk | AtParamErr {
	if (query.length === 0) return { kind: 'ok', value: null };

	const params = query.split('&');
	let at: string | null = null;
	for (const param of params) {
		if (param.length === 0) {
			return { kind: 'error', message: 'malformed query: empty parameter' };
		}
		const eqIndex = param.indexOf('=');
		const key = eqIndex === -1 ? param : param.slice(0, eqIndex);
		const value = eqIndex === -1 ? '' : param.slice(eqIndex + 1);
		if (key !== 'at') continue;
		if (value.length === 0) {
			return { kind: 'error', message: 'malformed query: `at=` has no value' };
		}
		// Decode percent-encoding so callers compare against canonical edition slugs.
		try {
			at = decodeURIComponent(value);
		} catch {
			return { kind: 'error', message: 'malformed query: invalid percent-encoding in `at=`' };
		}
	}
	return { kind: 'ok', value: at };
}

/** Type guard: distinguishes a successful parse from an error. */
export function isParseError(value: ParsedIdentifier | ParseError): value is ParseError {
	return 'kind' in value && 'message' in value;
}
