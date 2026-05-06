/**
 * Drift-sentinel vocabulary + helpers.
 *
 * Source of truth: ADR 019 amendment 2026-05 §2 + D1 + D4 (canonical sentinel
 * vocabulary; flat in node frontmatter). Authors annotate doc-or-chapter-level
 * citations with one of the canonical sentinel fields below; the validator
 * compares the captured value against the resolved (current) edition's value
 * and emits NOTICE on drift.
 *
 * The vocabulary is closed: unknown sentinel field names are ERROR per the
 * amendment's typo-defense rule. New corpora propose additions in their
 * corpus WP, not ad hoc.
 */
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
 * Result of validating a candidate sentinel field name. ERROR-tier reject
 * for unknown names; OK for canonical names.
 */
export type SentinelFieldValidation =
	| { readonly kind: 'ok'; readonly field: SentinelField }
	| { readonly kind: 'unknown-field'; readonly received: string; readonly message: string };

/**
 * Validate a candidate sentinel field name against the canonical vocabulary.
 * Frontmatter parsers / validators call this when reading citation sidecar
 * fields and reject unknown names with the returned ERROR message.
 */
export function validateSentinelFieldName(name: string): SentinelFieldValidation {
	if (isSentinelField(name)) {
		return { kind: 'ok', field: name };
	}
	const allowed = SENTINEL_FIELDS.join(', ');
	return {
		kind: 'unknown-field',
		received: name,
		message: `unknown sentinel field "${name}"; allowed: ${allowed}`,
	};
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
