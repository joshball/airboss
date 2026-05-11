/**
 * Text-anchor capture + re-anchor matcher (wp-flightbag-rich-reader).
 *
 * Selections in the rich reader are persisted as `(text, start, end, prefix,
 * suffix)` quintuples. On every load the renderer attempts to map each
 * persisted anchor back to a `[start, end]` range in the section's current
 * plain-text projection. The body markdown can change between sessions
 * (figure injection, paragraph splits, errata applied via the seed pipeline),
 * so the matcher is tolerant: it tries the original offset first, then a
 * windowed neighborhood, then a global search. When none of those work the
 * annotation is "orphaned" and surfaced in a side panel rather than painted.
 *
 * The shape is inspired by Hypothes.is's text-quote selector, simplified to
 * UTF-16-offset anchors with prefix/suffix context for disambiguation.
 *
 * Pure function module: no DOM, no browser globals, no I/O. Safe to call
 * from server loaders, tests, scripts, or the browser.
 */

import { ANNOTATION_ANCHOR_TEXT_MAX_LENGTH, ANNOTATION_CONTEXT_DEFAULT_LENGTH } from '@ab/constants';

export interface TextAnchor {
	/** Plain-text excerpt as it appeared at capture time. */
	text: string;
	/** UTF-16 offset of the excerpt's first character (inclusive). */
	start: number;
	/** UTF-16 offset of the excerpt's last character + 1 (exclusive). */
	end: number;
	/** Up to N characters preceding the excerpt at capture time. */
	prefix: string;
	/** Up to N characters following the excerpt at capture time. */
	suffix: string;
}

export interface TextRange {
	start: number;
	end: number;
}

/**
 * Snap a `[start, end]` range against the supplied plain-text projection
 * into a `TextAnchor`. Captures the literal substring + bounded
 * prefix/suffix context for the re-anchor matcher to fall back on when the
 * body text changes underneath us.
 *
 * Range is normalized so `start <= end` and both are clamped into
 * `[0, plainText.length]`. Excerpt is capped at
 * `ANNOTATION_ANCHOR_TEXT_MAX_LENGTH` chars; longer-than-that selections
 * are rare and brittle to re-anchor anyway.
 */
export function captureAnchor(
	plainText: string,
	range: TextRange,
	contextChars: number = ANNOTATION_CONTEXT_DEFAULT_LENGTH,
): TextAnchor {
	const total = plainText.length;
	let start = Math.max(0, Math.min(range.start, total));
	let end = Math.max(0, Math.min(range.end, total));
	if (end < start) [start, end] = [end, start];

	const rawText = plainText.slice(start, end);
	const text = rawText.length > ANNOTATION_ANCHOR_TEXT_MAX_LENGTH ? rawText.slice(0, ANNOTATION_ANCHOR_TEXT_MAX_LENGTH) : rawText;
	const cap = Math.max(0, contextChars);
	const prefix = plainText.slice(Math.max(0, start - cap), start);
	const suffix = plainText.slice(end, Math.min(total, end + cap));

	return { text, start, end: start + text.length, prefix, suffix };
}

/**
 * Search-window radius (chars) for the second-stage match. The matcher
 * prefers a hit close to the original offset since body re-extraction
 * usually shifts content by paragraph-scale offsets, not pages.
 */
const REANCHOR_WINDOW_CHARS = 200;

/**
 * Resolve a captured anchor against a (potentially-changed) plain-text
 * projection. Strategy:
 *
 *   1. Original-offset hit. If `plainText.slice(start, end) === anchor.text`
 *      return `{ start, end }` unchanged. Common case.
 *   2. Windowed search. Look for `anchor.text` in
 *      `[start - WINDOW, end + WINDOW]`. Multiple hits ranked by
 *      `prefixSuffixSimilarity` (Levenshtein distance against the captured
 *      context); ties broken by the closer offset.
 *   3. Global search. If the windowed pass returns nothing, search the
 *      whole `plainText` and pick the candidate with the best
 *      prefix/suffix similarity; ties broken by closest offset.
 *   4. Orphan. Return `null` -- callers surface the anchor in the side
 *      panel rather than painting it on the body.
 *
 * Empty anchor text is always orphaned -- nothing meaningful to match.
 */
export function reanchor(plainText: string, anchor: TextAnchor): TextRange | null {
	if (anchor.text.length === 0) return null;
	const total = plainText.length;
	const len = anchor.text.length;

	// Stage 1 -- exact-offset hit.
	if (anchor.start >= 0 && anchor.end <= total && plainText.slice(anchor.start, anchor.end) === anchor.text) {
		return { start: anchor.start, end: anchor.end };
	}

	// Stage 2 -- windowed search.
	const windowStart = Math.max(0, anchor.start - REANCHOR_WINDOW_CHARS);
	const windowEnd = Math.min(total, anchor.end + REANCHOR_WINDOW_CHARS);
	const windowed = findAllOccurrences(plainText, anchor.text, windowStart, windowEnd);
	if (windowed.length > 0) {
		const best = pickBestMatch(plainText, anchor, windowed);
		if (best !== null) return { start: best, end: best + len };
	}

	// Stage 3 -- global search.
	const all = findAllOccurrences(plainText, anchor.text, 0, total);
	if (all.length === 0) return null;
	const best = pickBestMatch(plainText, anchor, all);
	if (best === null) return null;
	return { start: best, end: best + len };
}

/**
 * All occurrences of `needle` whose start offset lies in
 * `[from, to)`. The needle itself is allowed to extend past `to` so a hit
 * straddling the window boundary still surfaces.
 */
function findAllOccurrences(haystack: string, needle: string, from: number, to: number): number[] {
	const out: number[] = [];
	if (needle.length === 0) return out;
	let cursor = Math.max(0, from);
	while (cursor < to) {
		const idx = haystack.indexOf(needle, cursor);
		if (idx === -1 || idx >= to) break;
		out.push(idx);
		cursor = idx + 1;
	}
	return out;
}

/**
 * Pick the candidate with the highest combined prefix/suffix similarity to
 * the captured context; ties broken by smallest offset distance to the
 * captured `anchor.start`. Returns `null` when the candidate list is empty.
 */
function pickBestMatch(plainText: string, anchor: TextAnchor, candidates: readonly number[]): number | null {
	if (candidates.length === 0) return null;
	const len = anchor.text.length;
	const ctx = Math.max(anchor.prefix.length, anchor.suffix.length, ANNOTATION_CONTEXT_DEFAULT_LENGTH);

	let best = candidates[0];
	if (best === undefined) return null;
	let bestScore = scoreCandidate(plainText, anchor, best, ctx);
	let bestDistance = Math.abs(best - anchor.start);

	for (let i = 1; i < candidates.length; i++) {
		const cand = candidates[i];
		if (cand === undefined) continue;
		const score = scoreCandidate(plainText, anchor, cand, ctx);
		const distance = Math.abs(cand - anchor.start);
		if (score > bestScore || (score === bestScore && distance < bestDistance)) {
			best = cand;
			bestScore = score;
			bestDistance = distance;
		}
		void len;
	}
	return best;
}

/**
 * Combined prefix+suffix similarity, in `[0, 1]`. The empty-context case
 * yields a neutral 0.5 so candidates aren't penalized when the original
 * anchor had no context to begin with (selection at start/end of body).
 */
function scoreCandidate(plainText: string, anchor: TextAnchor, candidateStart: number, contextChars: number): number {
	const len = anchor.text.length;
	const total = plainText.length;
	const candidateEnd = candidateStart + len;
	const candPrefix = plainText.slice(Math.max(0, candidateStart - contextChars), candidateStart);
	const candSuffix = plainText.slice(candidateEnd, Math.min(total, candidateEnd + contextChars));
	const prefixScore = anchor.prefix.length === 0 && candPrefix.length === 0 ? 0.5 : similarity(anchor.prefix, candPrefix);
	const suffixScore = anchor.suffix.length === 0 && candSuffix.length === 0 ? 0.5 : similarity(anchor.suffix, candSuffix);
	return (prefixScore + suffixScore) / 2;
}

/**
 * `1 - normalized_levenshtein(a, b)` in `[0, 1]`. Returns 1 for two empty
 * strings (perfect match by convention).
 */
function similarity(a: string, b: string): number {
	const max = Math.max(a.length, b.length);
	if (max === 0) return 1;
	const distance = levenshtein(a, b);
	return 1 - distance / max;
}

/**
 * Wagner-Fischer Levenshtein distance with a single-row buffer so the cost
 * is O(min(|a|, |b|)) memory. Bounded by the context-window size
 * (`ANNOTATION_CONTEXT_DEFAULT_LENGTH`) at the call sites here, so even a
 * fully-quadratic worst case is cheap in practice.
 */
function levenshtein(a: string, b: string): number {
	if (a === b) return 0;
	if (a.length === 0) return b.length;
	if (b.length === 0) return a.length;

	// Make `a` the longer string so the row buffer is the short dimension.
	let s1 = a;
	let s2 = b;
	if (s1.length < s2.length) {
		const tmp = s1;
		s1 = s2;
		s2 = tmp;
	}

	const prev: number[] = new Array(s2.length + 1);
	for (let j = 0; j <= s2.length; j++) prev[j] = j;

	for (let i = 1; i <= s1.length; i++) {
		let prevDiag = prev[0] ?? 0;
		prev[0] = i;
		for (let j = 1; j <= s2.length; j++) {
			const cost = s1.charCodeAt(i - 1) === s2.charCodeAt(j - 1) ? 0 : 1;
			const top = prev[j] ?? 0;
			const left = prev[j - 1] ?? 0;
			const next = Math.min(top + 1, left + 1, prevDiag + cost);
			prevDiag = top;
			prev[j] = next;
		}
	}
	return prev[s2.length] ?? 0;
}
