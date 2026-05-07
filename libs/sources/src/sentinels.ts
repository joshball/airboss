/**
 * Drift-sentinel vocabulary + helpers, plus the parallel non-sentinel
 * well-known citation field vocabulary.
 *
 * Source of truth: ADR 019 amendment 2026-05 §2 + D1 + D4 (canonical sentinel
 * vocabulary; flat in node frontmatter) and the same §2 "Well-known citation
 * fields (non-sentinel)" subsection (provenance fields like
 * `redirected_from`).
 *
 * Two closed vocabularies live here:
 *
 *   1. Sentinels (`SENTINEL_FIELDS`) -- present-state matching. Authors
 *      annotate doc-or-chapter-level citations with one of these; the
 *      validator compares the captured value against the resolved (current)
 *      edition's value and emits NOTICE on drift.
 *
 *   2. Well-known non-sentinel fields (`WELL_KNOWN_CITATION_FIELDS`) --
 *      provenance / history. The validator preserves them and surfaces them
 *      to the renderer; it does not match them against the current edition.
 *      `redirected_from` records the original `airboss-ref:` URI before a
 *      human override moved a citation across editions or books.
 *
 * Both vocabularies are closed: unknown field names are ERROR per the
 * amendment's typo-defense rule. New corpora / new well-known fields propose
 * additions in their corpus WP or a follow-on amendment, not ad hoc. The
 * combined gatekeeper {@link isKnownStructuredCitationField} accepts a name
 * iff it appears in either vocabulary.
 */
import { isParseError, parseIdentifier } from './parser.ts';
import type { ParsedIdentifier } from './types.ts';

/**
 * The closed enum of allowed sentinel field names. Kept here (not in
 * `libs/constants`) because the vocabulary is sources-domain and the
 * validator is the only consumer that needs it as a constant.
 */
export const SENTINEL_FIELDS = ['chapter_title', 'section_title', 'paragraph_text', 'page_heading'] as const;

export type SentinelField = (typeof SENTINEL_FIELDS)[number];

/** True when `name` is one of the canonical sentinel field names. */
export function isSentinelField(name: string): name is SentinelField {
	return (SENTINEL_FIELDS as readonly string[]).includes(name);
}

/**
 * The closed enum of allowed well-known non-sentinel citation field names.
 * These are provenance / history fields per ADR 019 amendment 2026-05 §2
 * "Well-known citation fields (non-sentinel)" -- the validator preserves
 * them and surfaces them to the renderer but does not match them against
 * the resolved edition. Members today: `redirected_from` (the original
 * `airboss-ref:` URI before a human override).
 */
export const WELL_KNOWN_CITATION_FIELDS = ['redirected_from'] as const;

export type WellKnownCitationField = (typeof WELL_KNOWN_CITATION_FIELDS)[number];

/** True when `name` is one of the canonical well-known non-sentinel field names. */
export function isWellKnownCitationField(name: string): name is WellKnownCitationField {
	return (WELL_KNOWN_CITATION_FIELDS as readonly string[]).includes(name);
}

/**
 * True when `name` is a known structured-citation field -- either a sentinel
 * (drift-detected) or a well-known non-sentinel (provenance). The schema
 * gatekeeper uses this to distinguish "valid extension field" from "typo".
 */
export function isKnownStructuredCitationField(name: string): name is SentinelField | WellKnownCitationField {
	return isSentinelField(name) || isWellKnownCitationField(name);
}

/**
 * Result of validating a candidate sentinel field name. ERROR-tier reject
 * for names that are neither sentinels nor well-known fields; OK with the
 * narrowed kind for canonical names.
 *
 * The two `ok` variants tell the caller which vocabulary matched so the
 * downstream parser can route the value to the right slot (sentinel
 * comparison vs. well-known passthrough).
 */
export type SentinelFieldValidation =
	| { readonly kind: 'ok'; readonly field: SentinelField }
	| { readonly kind: 'ok-well-known'; readonly field: WellKnownCitationField }
	| { readonly kind: 'unknown-field'; readonly received: string; readonly message: string };

/**
 * Validate a candidate structured-citation field name against the union of
 * the sentinel vocabulary and the well-known non-sentinel vocabulary.
 * Frontmatter parsers / validators call this when reading citation sidecar
 * fields and reject unknown names with the returned ERROR message.
 *
 * Naming preserved (`validateSentinelFieldName`) because the function is
 * the schema gatekeeper for every named structured-citation key, and every
 * caller already routes through it. Renaming would touch every call-site
 * for a stylistic gain only.
 */
export function validateSentinelFieldName(name: string): SentinelFieldValidation {
	if (isSentinelField(name)) {
		return { kind: 'ok', field: name };
	}
	if (isWellKnownCitationField(name)) {
		return { kind: 'ok-well-known', field: name };
	}
	const allowed = [...SENTINEL_FIELDS, ...WELL_KNOWN_CITATION_FIELDS].join(', ');
	return {
		kind: 'unknown-field',
		received: name,
		message: `unknown sentinel field "${name}"; allowed: ${allowed}`,
	};
}

/**
 * Result of validating a `redirected_from` value. The validator parses the
 * candidate via {@link parseIdentifier}; an un-parseable URI is rejected
 * with the parser's own message. The validator does NOT look the URI up in
 * the registry -- per amendment §2, the original target may be a retired
 * edition that no longer has a current row, and that is exactly the case
 * `redirected_from` exists to record.
 */
export type RedirectedFromValidation =
	| { readonly ok: true; readonly value: string }
	| { readonly ok: false; readonly message: string };

/**
 * Validate a candidate `redirected_from` value. Accepts only strings whose
 * value is a parseable `airboss-ref:` URI. Returns the validation outcome
 * with a parser-supplied message on failure so the schema parser can
 * surface it verbatim in the build summary.
 *
 * Future-proofed for list-valued redirects (a citation that has been
 * redirected multiple times) but ships single-value-only -- list expansion
 * is a separate amendment. Non-string inputs (numbers, arrays, nested
 * objects) are rejected here so callers don't need to defend independently.
 */
export function validateRedirectedFrom(value: unknown): RedirectedFromValidation {
	if (typeof value !== 'string') {
		return {
			ok: false,
			message: "'redirected_from' must be a string (single airboss-ref: URI)",
		};
	}
	if (value.length === 0) {
		return {
			ok: false,
			message: "'redirected_from' must be a non-empty string",
		};
	}
	const parsed = parseIdentifier(value);
	if (isParseError(parsed)) {
		return {
			ok: false,
			message: `'redirected_from' is not a parseable airboss-ref URI: ${parsed.message}`,
		};
	}
	return { ok: true, value };
}

/**
 * Result of comparing a captured sentinel value against the current
 * edition's value. `match: false` and `actual: null` are distinct: null
 * means the resolver could not look up a value at all (e.g. unknown
 * handbook chapter), false-with-string means the resolver returned a
 * different value than the author captured.
 */
export interface SentinelComparison {
	readonly match: boolean;
	readonly actual: string | null;
}

/**
 * Compare an expected sentinel value to the resolver-supplied actual.
 * Pure function; the resolver provides `actual`. The comparison is exact
 * string equality after trimming -- normalisation beyond trim is the
 * resolver's responsibility (it owns the canonical title shape).
 */
export function compareSentinel(expected: string, actual: string | null): SentinelComparison {
	if (actual === null) {
		return { match: false, actual: null };
	}
	const left = expected.trim();
	const right = actual.trim();
	return { match: left === right, actual: right };
}

/**
 * One captured sentinel from a citation's frontmatter. The validator passes
 * an array of these per-citation; the resolver looks up `actual` and the
 * validator emits NOTICE per mismatch.
 */
export interface CitationSentinel {
	readonly field: SentinelField;
	readonly expected: string;
}

/**
 * Resolver-side hook: corpus resolvers expose this to look up the current
 * (or pinned) edition's sentinel value for a given parsed identifier. Pure
 * lookup -- no side effects, no I/O beyond what the resolver already
 * caches (manifests are read-through cached).
 *
 * Returns `null` when the resolver can't supply a value for that
 * (identifier, sentinel) combination -- e.g. the locator addresses a
 * subsection but the sentinel is `chapter_title` of an unknown chapter.
 * `null` propagates to `compareSentinel` which surfaces as `match: false`.
 */
export type SentinelLookup = (parsed: ParsedIdentifier, field: SentinelField) => string | null;
