/**
 * Title-prefix autocomplete source.
 *
 * Walks `listReferences()` from `@ab/aviation` and surfaces references whose
 * `displayName` or `aliases` start with the user's input (case-insensitive).
 * Below `TITLE_PREFIX_MIN_NEEDLE_LENGTH` characters the source defers so
 * single-keystroke inputs don't dump the entire registry.
 *
 * Per WP decision R14, the doc code is ALWAYS carried in the entry's
 * `secondary` slot. Whether the user typed the code or the title, the
 * dropdown row shows BOTH so the bidirectional shape (code <-> title)
 * is obvious.
 *
 * The source is pure -- it reads the registry on every call. The registry
 * is in-memory and indexed; cost is O(N) over ~250 references which is
 * cheap enough for keystroke evaluation.
 *
 * Source of truth: `design/mockups/search/mockup-03-autocomplete.md`.
 */

import { listReferences, type Reference } from '@ab/aviation';
import { TITLE_PREFIX_MIN_NEEDLE_LENGTH } from '@ab/constants';
import type { AutocompleteEntry, AutocompleteSource } from './types';

/** Maximum dropdown rows. Matches the doc-code source for visual parity. */
const TITLE_PREFIX_MATCH_LIMIT = 12;

/** Source id used by hosts that want to filter / style by provider. */
export const TITLE_PREFIX_SOURCE_ID = 'title-prefix';

interface MatchCandidate {
	readonly ref: Reference;
	/** Lower-case match level: 0 = title prefix, 1 = alias prefix. */
	readonly tier: 0 | 1;
}

export const TitlePrefixSource: AutocompleteSource = {
	id: TITLE_PREFIX_SOURCE_ID,
	match(input: string): readonly AutocompleteEntry[] | null {
		const needle = input.trim().toLowerCase();
		if (needle.length < TITLE_PREFIX_MIN_NEEDLE_LENGTH) return null;

		const candidates: MatchCandidate[] = [];
		for (const ref of listReferences()) {
			if (ref.displayName.toLowerCase().startsWith(needle)) {
				candidates.push({ ref, tier: 0 });
				continue;
			}
			const aliasHit = ref.aliases.some((a) => a.toLowerCase().startsWith(needle));
			if (aliasHit) {
				candidates.push({ ref, tier: 1 });
			}
		}

		if (candidates.length === 0) return null;

		candidates.sort((a, b) => {
			if (a.tier !== b.tier) return a.tier - b.tier;
			return a.ref.displayName.localeCompare(b.ref.displayName);
		});

		return candidates.slice(0, TITLE_PREFIX_MATCH_LIMIT).map(toEntry);
	},
};

function toEntry(candidate: MatchCandidate): AutocompleteEntry {
	const ref = candidate.ref;
	const code = pickDocCode(ref);
	return {
		id: `${TITLE_PREFIX_SOURCE_ID}:${ref.id}`,
		display: ref.displayName,
		// R14: doc code lives in `secondary` whether the source is the code
		// path or the title path. Empty string when no code-shaped alias
		// exists (e.g. glossary entries that have no FAA doc number).
		secondary: code,
		// Title prefix path commits the canonical title, not the code, so
		// the user sees the disambiguation they typed for.
		canonicalForm: ref.displayName,
		sourceId: TITLE_PREFIX_SOURCE_ID,
		payload: {
			id: ref.id,
			displayName: ref.displayName,
			code,
		},
	};
}

/**
 * Pick the most code-like alias from a reference. Falls back to the first
 * alias when nothing matches the FAA / CFR / AC / Part / AIM shapes. The
 * pattern set mirrors `doc-code-detector.ts` so a reference shows the
 * SAME code in autocomplete as it would in the doc-code lookup result.
 */
function pickDocCode(ref: Reference): string {
	const CODE_SHAPES: readonly RegExp[] = [
		/^FAA-[HSP]-/i,
		/^AC[\s-]/i,
		/^14\s?CFR/i,
		/^49\s?CFR/i,
		/^Part\s+\d/i,
		/^AIM\s?\d/i,
		/^§/,
	];
	for (const shape of CODE_SHAPES) {
		const alias = ref.aliases.find((a) => shape.test(a));
		if (alias) return alias;
	}
	return ref.aliases[0] ?? '';
}
