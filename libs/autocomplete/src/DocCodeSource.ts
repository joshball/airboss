/**
 * Doc-code autocomplete source.
 *
 * Wraps `detectDocCodeIntent` + `lookupDocsByCode` from `@ab/aviation` so
 * the same trigger rules that drove Phase 3's `DocCodeAutocomplete` now
 * power a generic, host-agnostic autocomplete source.
 *
 * Trigger families (`handbook`, `ac`, `cfr`, `aim`, `acs`, `unknown`)
 * resolve via the registry. Sort order is numeric-aware (`808` ->
 * `8083-2` < `8083-15`) -- delegated to `lookupDocsByCode`.
 *
 * Per WP decision R14, the entry's primary display is the title and the
 * secondary slot ALWAYS carries the doc code, so the dropdown is the same
 * shape whether the user typed the code or the title.
 *
 * Source of truth: `design/mockups/search/mockup-03-autocomplete.md`.
 */

import { detectDocCodeIntent, lookupDocsByCode } from '@ab/aviation';
import type { AutocompleteEntry, AutocompleteSource } from './types';

/** Maximum dropdown rows. Matches the prior `DocCodeAutocomplete` cap. */
const DOC_CODE_MATCH_LIMIT = 12;

/** Source id used by hosts that want to filter / style by provider. */
export const DOC_CODE_SOURCE_ID = 'doc-code';

/**
 * Build a `AutocompleteSource` that surfaces FAA / CFR / AC / AIM / ACS
 * documents matching the user's input. Returns `null` when the input
 * doesn't look like a doc-code fragment so another source (e.g.
 * `TitlePrefixSource`) can claim it.
 */
export const DocCodeSource: AutocompleteSource = {
	id: DOC_CODE_SOURCE_ID,
	match(input: string): readonly AutocompleteEntry[] | null {
		const trimmed = input.trim();
		if (trimmed.length === 0) return null;
		const intent = detectDocCodeIntent(trimmed);
		if (!intent) return null;
		const family = intent.family;
		const fragment = intent.fragment;
		const matches = lookupDocsByCode(fragment, { family, limit: DOC_CODE_MATCH_LIMIT });
		if (matches.length > 0) {
			return matches.map(toEntry);
		}
		// Empty trigger fallback (Decision #6): when the fragment matched a
		// known family pattern but the registry has nothing, emit a sorted
		// alphabetical family listing so users see what IS available.
		const fallback = lookupDocsByCode('', { family, limit: DOC_CODE_MATCH_LIMIT * 2 });
		if (fallback.length === 0) return [];
		const sorted = [...fallback].sort((a, b) => a.displayName.localeCompare(b.displayName));
		return sorted.slice(0, DOC_CODE_MATCH_LIMIT).map(toEntry);
	},
};

interface RegistryDocMatch {
	readonly id: string;
	readonly displayName: string;
	readonly code: string;
	readonly abbreviation: string | null;
}

function toEntry(doc: RegistryDocMatch): AutocompleteEntry {
	// R14: title is primary, code is secondary, so the dropdown shape is
	// stable whether the user typed `8083-28` (code path) or `Aviation
	// Weather Handbook` (title path).
	return {
		id: `${DOC_CODE_SOURCE_ID}:${doc.id}`,
		display: doc.displayName,
		secondary: doc.code,
		// Tab-commit replaces the input with the canonical doc code so the
		// downstream search runs scoped to that doc. Users who want the
		// title in the input can hit Tab again with the title path source.
		canonicalForm: doc.code,
		sourceId: DOC_CODE_SOURCE_ID,
		payload: {
			id: doc.id,
			displayName: doc.displayName,
			code: doc.code,
			abbreviation: doc.abbreviation,
		} satisfies RegistryDocMatch,
	};
}
