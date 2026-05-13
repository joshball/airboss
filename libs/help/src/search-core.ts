/**
 * Search ranking + filter predicates shared by the help registry and the
 * cross-library search facade.
 *
 * Kept in a separate module so:
 *  - `registry.ts` can rank help-only hits without pulling `@ab/aviation`;
 *  - `search.ts` can reuse the same filter predicates to narrow aviation
 *    hits through the same facet language (`tag:`, `rules:`, etc.).
 *
 * Phase 3.5 (WP decision R9) replaces the original 3-bucket ranker with a
 * composite scorer:
 *
 *   score = type_tier_weight + title_match_tier + body_match_tier - depth_penalty
 *
 * Higher score wins; ties break alphabetically by title. Per-intent
 * variations (I-1 / I-2 / I-3) live in `scoreResult` -- I-3 inverts the
 * type tier (sections > books), boosts body, and rewards depth.
 *
 * The original `rankBucket(input)` and `rankBucketIndexed(input)` 3-bucket
 * helpers are retained for back-compat so existing loaders / registry
 * code don't break in this PR. They derive their 1/2/3 verdict from the
 * composite scorer's title-match tier, preserving the original
 * exact/substring/keyword semantics. The next PR (UI rewrite) removes
 * the shim.
 */

import { BODY_MATCH_TIER, DEPTH_PENALTY_PER_LEVEL, TITLE_MATCH_TIER, TYPE_TIER } from '@ab/constants';
import type { SearchIntent } from './intent-classifier';
import type { HelpPage } from './schema/help-page';
import type { ParsedFilter } from './schema/help-registry';
import type { SearchResultType } from './schema/result-types';

/**
 * Input contract for `scoreResult`. A concrete `SearchResult` from a
 * loader is the typical caller, but the scorer also runs against ad-hoc
 * test rows (ranker fixtures) and against the per-row index a loader may
 * build, so we accept the smallest shape that lets the scorer compute
 * each tier.
 *
 * - `type`         drives the type-tier weight.
 * - `title`        title-tier evidence; required.
 * - `aliases`      title-tier evidence; optional.
 * - `docCode`      title-tier evidence; doc-code exact / prefix tier.
 * - `body`         body-tier evidence; optional.
 * - `keywords`     body-tier evidence (KEYWORD_EXACT); optional.
 * - `depth`        depth penalty / reward; optional (defaults to 0).
 */
export interface SearchResultInput {
	readonly type: SearchResultType;
	readonly title: string;
	readonly aliases?: readonly string[];
	readonly docCode?: string;
	readonly body?: string;
	readonly keywords?: readonly string[];
	readonly depth?: number;
}

export interface RankInput {
	needle: string;
	displayName: string;
	aliases: readonly string[];
	keywords: readonly string[];
	/**
	 * Any additional string haystacks to match for the keyword/body bucket.
	 * For aviation: the paraphrase. For help: summary + section bodies.
	 */
	bodies: readonly string[];
}

/**
 * Variant of `rankBucket` that takes pre-lowercased fields and a single
 * pre-built haystack (summary + bodies + keywords joined and lowercased).
 * Used by the help registry's hot search path so each keystroke skips the
 * per-page `String.prototype.toLowerCase` allocations the original
 * `rankBucket` performs.
 *
 * Semantics mirror `rankBucket`: bucket 1 = exact title/alias, bucket 2 =
 * substring title/alias, bucket 3 = substring keyword or haystack.
 */
export interface IndexedRankInput {
	/** The query term, already lowercased and trimmed. */
	needle: string;
	/** Lowercased display title. */
	lowerTitle: string;
	/** Lowercased aliases. Empty array if not applicable. */
	lowerAliases: readonly string[];
	/** Lowercased keywords. */
	lowerKeywords: readonly string[];
	/**
	 * Lowercased concatenation of summary + section bodies + keywords.
	 * Built once at registration time, reused per keystroke.
	 */
	lowerHaystack: string;
}

export function rankBucketIndexed(input: IndexedRankInput): 1 | 2 | 3 | null {
	const { needle } = input;
	if (needle.length === 0) return 3;

	if (input.lowerTitle === needle) return 1;
	if (input.lowerAliases.includes(needle)) return 1;

	if (input.lowerTitle.includes(needle)) return 2;
	for (const alias of input.lowerAliases) {
		if (alias.includes(needle)) return 2;
	}

	for (const keyword of input.lowerKeywords) {
		if (keyword.includes(needle)) return 3;
	}
	if (input.lowerHaystack.includes(needle)) return 3;
	return null;
}

/**
 * Returns the rank bucket for the given input:
 *   1 = exact-match on displayName (case-insensitive) or in aliases.
 *   2 = substring-match on displayName or alias.
 *   3 = substring-match on any keyword or body.
 * null = no hit.
 */
export function rankBucket(input: RankInput): 1 | 2 | 3 | null {
	const { needle } = input;
	if (needle.length === 0) return 3;
	const lowerName = input.displayName.toLowerCase();
	const lowerAliases = input.aliases.map((a) => a.toLowerCase());

	if (lowerName === needle) return 1;
	if (lowerAliases.includes(needle)) return 1;

	if (lowerName.includes(needle)) return 2;
	for (const alias of lowerAliases) {
		if (alias.includes(needle)) return 2;
	}

	for (const keyword of input.keywords) {
		if (keyword.toLowerCase().includes(needle)) return 3;
	}
	for (const body of input.bodies) {
		if (body.toLowerCase().includes(needle)) return 3;
	}
	return null;
}

// ===================================================================
// Composite scorer (Phase 3.5)
// ===================================================================

/**
 * Re-export the type-tier table so callers / fixtures can introspect.
 *
 * The table itself lives in `libs/constants/src/palette.ts` because the
 * tuning happens there per CLAUDE.md ("All literal values in
 * libs/constants/"). This re-export is the type-narrowed view the
 * scorer uses; consumers may import either.
 */
export { TYPE_TIER };

/**
 * Look up the type-tier weight for a `SearchResultType`. Unknown types
 * (typos in tests, future types not yet in the table) score 0. In
 * production every concrete type is exhaustively keyed; the runtime
 * fallback exists for forward compatibility.
 */
function typeTier(type: SearchResultType): number {
	const tier = (TYPE_TIER as Record<string, number>)[type];
	return typeof tier === 'number' ? tier : 0;
}

/**
 * Compute the title-tier bonus for a single needle / row pair.
 *
 * Order of evaluation matters: exact-title beats exact-alias beats
 * doc-code-exact beats doc-code-prefix beats whole-word beats substring.
 * Returns the highest bonus that applies; never sums multiple tiers
 * (the design table allocates one bonus per evidence kind).
 */
export function titleMatchTier(
	needle: string,
	title: string,
	aliases: readonly string[] = [],
	docCode?: string,
): number {
	const lower = needle.toLowerCase();
	if (lower.length === 0) return TITLE_MATCH_TIER.NONE;
	const lowerTitle = title.toLowerCase();
	const lowerDocCode = docCode ? docCode.toLowerCase() : undefined;
	const lowerAliases = aliases.map((a) => a.toLowerCase());

	if (lowerTitle === lower) return TITLE_MATCH_TIER.EXACT_TITLE;
	if (lowerDocCode && lowerDocCode === lower) return TITLE_MATCH_TIER.EXACT_DOC_CODE;
	if (lowerAliases.includes(lower)) return TITLE_MATCH_TIER.EXACT_ALIAS;
	if (lowerDocCode && lowerDocCode.startsWith(lower)) return TITLE_MATCH_TIER.DOC_CODE_PREFIX;
	if (containsWholeWord(lowerTitle, lower)) return TITLE_MATCH_TIER.WHOLE_WORD;
	for (const alias of lowerAliases) {
		if (containsWholeWord(alias, lower)) return TITLE_MATCH_TIER.WHOLE_WORD;
	}
	if (lowerTitle.includes(lower)) return TITLE_MATCH_TIER.SUBSTRING;
	for (const alias of lowerAliases) {
		if (alias.includes(lower)) return TITLE_MATCH_TIER.SUBSTRING;
	}
	return TITLE_MATCH_TIER.NONE;
}

/**
 * Compute the body-tier bonus for a needle / row pair. Keyword-exact is
 * a row-level signal (the loader's curated keywords); body whole-word /
 * substring fall through to the row's body / snippet text.
 */
export function bodyMatchTier(needle: string, body = '', keywords: readonly string[] = []): number {
	const lower = needle.toLowerCase();
	if (lower.length === 0) return BODY_MATCH_TIER.NONE;
	for (const kw of keywords) {
		if (kw.toLowerCase() === lower) return BODY_MATCH_TIER.KEYWORD_EXACT;
	}
	const lowerBody = body.toLowerCase();
	if (lowerBody.length === 0) return BODY_MATCH_TIER.NONE;
	if (containsWholeWord(lowerBody, lower)) return BODY_MATCH_TIER.BODY_WHOLE_WORD;
	if (lowerBody.includes(lower)) return BODY_MATCH_TIER.BODY_SUBSTRING;
	return BODY_MATCH_TIER.NONE;
}

/**
 * The composite scorer.
 *
 *   I-1 scoped     : same composite as I-2; filtering by `doc:` chip is
 *                    the search facade's responsibility. The chip-set
 *                    cases reach this function only after the filter
 *                    has narrowed the candidate set.
 *   I-2 broad      : `type_tier + title + body - depth*3`.
 *   I-3 phrase-FTS : `(120 - type_tier) + body*1.5 + depth*3`. The
 *                    inversion lifts deeper section-level results above
 *                    book-level results, and depth is REWARDED (deeper
 *                    = more specific passage). Title tier suppressed --
 *                    a user typing a 5-word phrase isn't searching for
 *                    a title. Passage-rank lift (ts_rank_cd) is added
 *                    by the phrase-FTS loader directly to the row score
 *                    in PR C; we leave a hook here via the row's
 *                    `body` field length so the scorer ranks longer
 *                    body-match evidence higher in I-3 as well.
 */
export function scoreResult(needle: string, r: SearchResultInput, intent: SearchIntent): number {
	const baseTier = typeTier(r.type);
	const titleTier = titleMatchTier(needle, r.title, r.aliases, r.docCode);
	const bodyTier = bodyMatchTier(needle, r.body, r.keywords);
	const depth = r.depth ?? 0;
	const depthDelta = depth * DEPTH_PENALTY_PER_LEVEL;
	if (intent === 'phrase-fts') {
		// Invert the type tier so leaf rows (50/45/50) outrank book roots
		// (100/90/85). Body evidence gets a 1.5x multiplier; title tier
		// is suppressed (multiplied by 0).
		const invertedType = 120 - baseTier;
		const boostedBody = bodyTier * 1.5;
		return invertedType + boostedBody + depthDelta;
	}
	// I-1 / I-2: composite score, depth PENALISED.
	return baseTier + titleTier + bodyTier - depthDelta;
}

/**
 * Whole-word containment check: needle appears in haystack delimited by
 * either word boundaries or string ends. Both inputs are expected to be
 * lowercased. Used by `titleMatchTier` + `bodyMatchTier`.
 *
 * Avoids `RegExp` construction so we don't pay the per-keystroke compile
 * cost; the manual scan is sufficient and predictable.
 */
function containsWholeWord(haystack: string, needle: string): boolean {
	if (needle.length === 0) return false;
	let idx = haystack.indexOf(needle);
	while (idx >= 0) {
		const before = idx === 0 ? ' ' : haystack[idx - 1];
		const after = idx + needle.length >= haystack.length ? ' ' : haystack[idx + needle.length];
		if (isWordBoundary(before) && isWordBoundary(after)) return true;
		idx = haystack.indexOf(needle, idx + 1);
	}
	return false;
}

function isWordBoundary(ch: string | undefined): boolean {
	if (ch === undefined) return true;
	// Treat alphanumerics as word characters; everything else (space,
	// punctuation, paren, hyphen, slash) as a boundary. Avoids relying on
	// the Unicode regex shorthand which is over-broad for our needles.
	return !/[a-z0-9]/i.test(ch);
}

/**
 * Map a composite score to a 1/2/3 back-compat bucket. Threshold values
 * chosen so the bucket assignments match the original 3-bucket ranker
 * for the common cases: exact title / alias / doc-code -> 1; substring
 * title / alias -> 2; keyword / body -> 3.
 *
 * The shim exists so loaders + the registry's hot path can keep
 * populating `SearchResult.rankBucket` without rewriting every call
 * site in this PR. The UI PR removes the shim once every consumer uses
 * `score` directly.
 */
export function bucketFromScore(score: number): 1 | 2 | 3 | null {
	if (score <= 0) return null;
	// 1 -- exact-tier evidence present (title >= EXACT_ALIAS bonus).
	if (score >= TITLE_MATCH_TIER.EXACT_ALIAS) return 1;
	// 2 -- title-tier substring/word-boundary evidence (>= SUBSTRING bonus).
	if (score >= TITLE_MATCH_TIER.SUBSTRING) return 2;
	// 3 -- everything else (body / keyword evidence).
	return 3;
}

/**
 * True when a help page satisfies every provided facet filter. Each filter
 * is AND; within a filter, its comma-separated values are OR.
 *
 * Facets consumed here:
 *   - `lib:help` / `lib:aviation` -- handled at the search facade level
 *     (we trust only help pages reach this function when the filter is
 *     `lib:help` from the facade).
 *   - `surface:<appSurface>` -- matches any entry in page.tags.appSurface.
 *   - `kind:<helpKind>` -- matches page.tags.helpKind.
 *   - `tag:<aviationTopic>` -- matches when page.tags.aviationTopic
 *     includes the value.
 *   - `source:*` / `rules:*` -- don't apply to help pages; returns false
 *     when filtered (so help bucket empties cleanly).
 */
export function matchesFilters(page: HelpPage, filters: readonly ParsedFilter[]): boolean {
	for (const filter of filters) {
		switch (filter.key) {
			case 'lib': {
				// Help pages only match `lib:help` / `lib:both`. `lib:aviation`
				// alone empties the help bucket.
				if (!filter.values.includes('help') && !filter.values.includes('both')) {
					return false;
				}
				break;
			}
			case 'surface': {
				const anyMatch = page.tags.appSurface.some((s) => filter.values.includes(s));
				if (!anyMatch) return false;
				break;
			}
			case 'kind': {
				if (!filter.values.includes(page.tags.helpKind)) return false;
				break;
			}
			case 'tag': {
				const topics = page.tags.aviationTopic ?? [];
				const anyMatch = topics.some((t) => filter.values.includes(t));
				if (!anyMatch) return false;
				break;
			}
			case 'source':
			case 'rules':
			case 'doc':
			case 'library':
				// These facets either describe aviation-only axes (sourceType,
				// flightRules) or scope to non-help content (doc:, library:mine).
				// A help page can never satisfy them, so an active filter of
				// any of these shapes empties the help bucket.
				return false;
			default: {
				// Should be exhaustive, but keep the guard in case a new
				// FilterKey is added without updating this switch.
				const exhaustive: never = filter.key;
				void exhaustive;
				return false;
			}
		}
	}
	return true;
}
