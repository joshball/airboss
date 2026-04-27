/**
 * Phase 5 -- edition pair walker.
 *
 * Source of truth: ADR 019 §5 (versioning workflow), §6.1 (aliases).
 *
 * Walks `EDITIONS` for the named corpus and emits chronologically-ordered
 * `(id, oldEdition, newEdition)` pairs. Cumulative: a section with editions
 * `[2025, 2026, 2027]` produces three pairs -- `(2025,2026)`, `(2026,2027)`,
 * `(2025,2027)` -- so callers can answer both "what changed last year" and
 * "what changed in N years".
 */

import { __editions_internal__ } from '../registry/editions.ts';
import { __sources_internal__ } from '../registry/sources.ts';
import type { Edition, EditionId, SourceId } from '../types.ts';

export interface EditionPair {
	readonly id: SourceId;
	readonly corpus: string;
	readonly oldEdition: EditionId;
	readonly newEdition: EditionId;
}

/**
 * Every chronological `(old, new)` pair across every entry in `corpus`.
 * Cumulative emission per the module-level note. Returned order is stable
 * (entry id, then old-edition asc, then new-edition asc).
 */
export function walkEditionPairs(corpus: string): readonly EditionPair[] {
	const sources = __sources_internal__.getActiveTable();
	const editionsMap = __editions_internal__.getActiveTable();
	const pairs: EditionPair[] = [];

	const ids = Object.keys(sources)
		.map((k) => k as SourceId)
		.filter((id) => sources[id]?.corpus === corpus)
		.sort();

	for (const id of ids) {
		const editions = editionsMap.get(id) ?? [];
		if (editions.length < 2) continue;
		const sorted = [...editions].sort(byPublishedDate);
		for (let i = 0; i < sorted.length; i += 1) {
			for (let j = i + 1; j < sorted.length; j += 1) {
				const oldEdition = sorted[i];
				const newEdition = sorted[j];
				if (oldEdition === undefined || newEdition === undefined) continue;
				pairs.push({
					id,
					corpus,
					oldEdition: oldEdition.id,
					newEdition: newEdition.id,
				});
			}
		}
	}

	return pairs;
}

/**
 * The latest pair only -- old = second-most-recent, new = most-recent --
 * across every entry in the corpus. Returns `null` when no entry in the
 * corpus has at least two editions.
 *
 * NOTE: this returns the latest pair _per entry_; the caller filters as
 * needed. When the operator runs `diff` without `--edition-pair=`, the CLI
 * uses the corpus's globally-latest two editions, computed from this set.
 */
export function latestEditionPair(corpus: string): EditionPair | null {
	const all = walkEditionPairs(corpus);
	if (all.length === 0) return null;
	// Find the largest (oldEdition, newEdition) lexically; matches calendar
	// chronology since edition slugs are year or YYYY-MM-DD strings.
	let best: EditionPair | null = null;
	for (const pair of all) {
		if (best === null) {
			best = pair;
			continue;
		}
		if (pair.newEdition > best.newEdition) {
			best = pair;
			continue;
		}
		if (pair.newEdition === best.newEdition && pair.oldEdition > best.oldEdition) {
			best = pair;
		}
	}
	return best;
}

/**
 * The two most-recent edition slugs across the corpus, oldest-first. `null`
 * when the corpus has fewer than two distinct editions.
 */
export function latestTwoEditionsForCorpus(
	corpus: string,
): { readonly old: EditionId; readonly new: EditionId } | null {
	const sources = __sources_internal__.getActiveTable();
	const editionsMap = __editions_internal__.getActiveTable();
	const slugs = new Set<EditionId>();

	for (const key of Object.keys(sources)) {
		const id = key as SourceId;
		if (sources[id]?.corpus !== corpus) continue;
		const editions = editionsMap.get(id) ?? [];
		for (const edition of editions) {
			slugs.add(edition.id);
		}
	}

	if (slugs.size < 2) return null;
	const sorted = [...slugs].sort();
	const newSlug = sorted[sorted.length - 1];
	const oldSlug = sorted[sorted.length - 2];
	if (newSlug === undefined || oldSlug === undefined) return null;
	return { old: oldSlug, new: newSlug };
}

function byPublishedDate(a: Edition, b: Edition): number {
	const at = a.published_date.getTime();
	const bt = b.published_date.getTime();
	if (at !== bt) return at - bt;
	return a.id.localeCompare(b.id);
}
