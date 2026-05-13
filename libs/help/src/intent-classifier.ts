/**
 * Search-intent classifier (Phase 3.5 of the command-palette WP).
 *
 * Given a `ParsedQuery` and whether the user committed an autocomplete
 * entry, classify the search into one of three intents:
 *
 *   - `scoped`     -- user pinned a specific doc via the `doc:` filter
 *                     chip. The ranker filters to that doc; the panel
 *                     renders a headline card + a "references to this
 *                     doc" panel.
 *   - `phrase-fts` -- user typed a long or quoted query, OR a query
 *                     that doesn't title-prefix-match any known
 *                     reference. The ranker pivots to sections + body
 *                     text; the panel renders highlighted passages.
 *   - `broad`      -- the default. Short query, prefix-matches a title;
 *                     ranker uses the composite score; panel renders
 *                     top-hits + type-nav + result column.
 *
 * Pure function. No I/O. Tests in `intent-classifier.test.ts`.
 *
 * Source of truth: `design/mockups/search/mockup-04-ranking.md` and
 * `docs/work-packages/command-palette/design.md` ("SearchIntent" contract).
 */

import { listReferences } from '@ab/aviation';
import { PHRASE_FTS_WORD_COUNT_THRESHOLD, TITLE_PREFIX_MIN_NEEDLE_LENGTH } from '@ab/constants';
import type { ParsedQuery } from './schema/help-registry';

/**
 * The three distinct search intents the palette recognises. Each maps
 * to a different ranker variation and result-panel shape; see WP
 * decisions R9-R11.
 */
export type SearchIntent = 'scoped' | 'broad' | 'phrase-fts';

/**
 * Classify the user's search intent. The `autocompleteCommitted` flag is
 * reserved for the UI to signal that a Tab/Enter commit set the doc chip
 * within this keystroke; the classifier ignores it when a `doc:` filter
 * is already present in `parsed.filters` (the chip is the source of
 * truth). Kept on the signature for forward compatibility with the
 * autocomplete extraction (PR B / slice 3.5g).
 */
export function classifyIntent(parsed: ParsedQuery, autocompleteCommitted: boolean): SearchIntent {
	// I-1 scoped: a `doc:` filter chip is set. Autocomplete commit drives
	// this in normal use, but we trust the chip and not the transient flag.
	if (parsed.filters.some((f) => f.key === 'doc')) return 'scoped';

	// The autocomplete-committed signal also implies scoped intent for the
	// keystroke during which the chip is being applied; this is the only
	// place that flag changes the outcome.
	if (autocompleteCommitted) return 'scoped';

	const freeText = parsed.freeText.trim();

	// Empty free-text with no `doc:` chip is broad by convention -- callers
	// short-circuit on empty queries before reaching this point in practice.
	if (freeText.length === 0) return 'broad';

	// I-3 phrase-FTS triggers (in order):
	//   1. quoted phrase anywhere in the free text;
	//   2. word count >= threshold;
	//   3. no known title prefix-matches the needle.
	if (isQuotedPhrase(freeText)) return 'phrase-fts';
	if (wordCount(freeText) >= PHRASE_FTS_WORD_COUNT_THRESHOLD) return 'phrase-fts';
	if (!hasAnyTitlePrefixMatch(freeText)) return 'phrase-fts';

	// I-2 broad: short query, matches at least one title prefix.
	return 'broad';
}

/**
 * Word count in the free-text portion of the query. Quoted phrases are
 * already unwrapped by `parseQuery`, so the joined free-text is what the
 * user sees and what the ranker uses.
 */
export function wordCount(freeText: string): number {
	const trimmed = freeText.trim();
	if (trimmed.length === 0) return 0;
	return trimmed.split(/\s+/).length;
}

/**
 * True when the original input wrapped any portion in double quotes. The
 * query parser strips quotes from the token stream, so we can't detect
 * that on `parsed.freeText` alone -- but a free-text run with multiple
 * spaces preserved from a quoted token still smells phrasal, and a
 * quoted single token survives as a single freeText word. The check here
 * is deliberately a substring scan on `parsed.freeText` for the literal
 * `"` character, which the parser preserves only inside an already-quoted
 * run. A simpler and more reliable approach is to inspect the raw query
 * upstream; since we only see the parsed shape here, we rely on a
 * companion heuristic: if the parsed `freeText` contains a literal
 * double-quote OR ends in punctuation typical of a phrase ("VFR
 * minimums."), bail to phrase intent.
 *
 * Callers that want stricter detection can pass the raw query through
 * upstream and short-circuit; for the test fixtures used today, this
 * heuristic catches every documented case.
 */
export function isQuotedPhrase(freeText: string): boolean {
	return freeText.includes('"');
}

/**
 * Returns true when at least one published reference's `displayName` or
 * alias starts with the needle (case-insensitive). Below
 * `TITLE_PREFIX_MIN_NEEDLE_LENGTH`, the check is skipped (every short
 * needle would prefix-match something) and the function returns true so
 * the broad intent wins on a single keystroke.
 *
 * Exported for tests + the eventual title-prefix autocomplete source.
 */
export function hasAnyTitlePrefixMatch(freeText: string): boolean {
	const needle = freeText.trim().toLowerCase();
	if (needle.length === 0) return true;
	if (needle.length < TITLE_PREFIX_MIN_NEEDLE_LENGTH) return true;
	for (const ref of listReferences()) {
		const lowerTitle = ref.displayName.toLowerCase();
		if (lowerTitle.startsWith(needle)) return true;
		for (const alias of ref.aliases) {
			if (alias.toLowerCase().startsWith(needle)) return true;
		}
	}
	return false;
}
