/**
 * Lazy lookup index for the registry.
 *
 * Source of truth: ADR 019 §2.3 (12-function query API). The query API ships
 * O(1)-style steady-state reads via three indexes that are rebuilt lazily when
 * the underlying sources/editions tables change.
 *
 * Rebuild strategy: the sources table (`registry/sources.ts`) and the editions
 * map (`registry/editions.ts`) each carry a generation counter that is bumped
 * on every swap. This module captures both counters at build-time; on every
 * read, it compares the captured pair against the current pair and rebuilds
 * when they diverge. The rebuild is a single linear walk, so amortized cost
 * across N reads of an unchanged table is O(table_size) per swap rather than
 * O(N * table_size) per render.
 *
 * Indexes:
 *
 *   - `currentEditionByCorpus`  -> `Map<corpus, EditionId | null>`. The
 *     lex-max edition slug across every entry in that corpus. Used by every
 *     resolver's `getCurrentEdition` (regs, handbooks, ac, acs, aim, ...).
 *
 *   - `childrenByParentId`  -> `Map<parentId, SourceEntry[]>`. The one-level
 *     children of `parentId` keyed on slug-prefix-strip-one-segment. Used by
 *     `getChildren`.
 *
 *   - `entriesByCanonicalShort` -> `Map<lowercaseShort, SourceEntry[]>`. Used
 *     by `findEntriesByCanonicalShort` (case-insensitive).
 *
 * Why "rebuild count": tests assert that a 1000-entry registry with 1000
 * lookups builds the index exactly once, not 1000 times. The exposed
 * `__index_cache_internal__.getRebuildCount` makes that assertion explicit.
 */

import type { EditionId, SourceEntry, SourceId } from '../types.ts';
import { __editions_internal__ } from './editions.ts';
import { __sources_internal__, getSources } from './sources.ts';

interface RegistryIndex {
	readonly currentEditionByCorpus: ReadonlyMap<string, EditionId | null>;
	readonly childrenByParentId: ReadonlyMap<string, readonly SourceEntry[]>;
	readonly entriesByCanonicalShort: ReadonlyMap<string, readonly SourceEntry[]>;
}

let _cached: RegistryIndex | null = null;
let _cachedSourcesGen = -1;
let _cachedEditionsGen = -1;
let _rebuildCount = 0;

/**
 * Return the lookup index, rebuilding when either generation has advanced
 * since the last read.
 */
export function getRegistryIndex(): RegistryIndex {
	const sourcesGen = __sources_internal__.getGeneration();
	const editionsGen = __editions_internal__.getGeneration();
	if (_cached !== null && sourcesGen === _cachedSourcesGen && editionsGen === _cachedEditionsGen) {
		return _cached;
	}
	_cached = buildIndex();
	_cachedSourcesGen = sourcesGen;
	_cachedEditionsGen = editionsGen;
	_rebuildCount += 1;
	return _cached;
}

/**
 * Look up the lex-max edition slug across every entry in `corpus`. Returns
 * null when the corpus has no entries with editions yet.
 *
 * Replaces the per-call linear scan that every resolver's `getCurrentEdition`
 * was performing. Steady-state cost is one map read; amortized rebuild cost is
 * O(entries_in_corpus + total_editions) per registry swap.
 */
export function getCurrentEditionForCorpus(corpus: string): EditionId | null {
	const idx = getRegistryIndex();
	return idx.currentEditionByCorpus.get(corpus) ?? null;
}

/**
 * Look up the one-level children of `parentId`. Returns an empty array when
 * the parent has no children. Result is the same as the previous linear-scan
 * implementation in `query.ts`; only the cost shape changed.
 */
export function getChildrenIndexed(parentId: string): readonly SourceEntry[] {
	const idx = getRegistryIndex();
	return idx.childrenByParentId.get(parentId) ?? [];
}

/**
 * Look up entries whose `canonical_short` (case-insensitive) matches `short`.
 * Returns an empty array when nothing matches.
 */
export function findEntriesByCanonicalShortIndexed(short: string): readonly SourceEntry[] {
	const idx = getRegistryIndex();
	return idx.entriesByCanonicalShort.get(short.toLowerCase()) ?? [];
}

// ---------------------------------------------------------------------------
// Internals
// ---------------------------------------------------------------------------

function buildIndex(): RegistryIndex {
	const sources = getSources();
	const editions = __editions_internal__.getActiveTable();

	const currentEditionByCorpus = new Map<string, EditionId | null>();
	const childrenByParentId = new Map<string, SourceEntry[]>();
	const entriesByCanonicalShort = new Map<string, SourceEntry[]>();

	for (const key of Object.keys(sources)) {
		const id = key as SourceId;
		const entry = sources[id];
		if (entry === undefined) continue;

		// canonical_short -> entries
		const shortKey = entry.canonical_short.toLowerCase();
		const shortBucket = entriesByCanonicalShort.get(shortKey);
		if (shortBucket === undefined) {
			entriesByCanonicalShort.set(shortKey, [entry]);
		} else {
			shortBucket.push(entry);
		}

		// children (one-level): parent is `id` with the trailing slug segment
		// removed. Top-level corpus roots (`airboss-ref:<corpus>`) have no
		// parent and contribute no children edge.
		const lastSlash = id.lastIndexOf('/');
		// Guard: only treat as a child when the id has at least one `/` past
		// the corpus authority. `airboss-ref:regs` (no slash) -> no parent.
		if (lastSlash > 0) {
			const parent = id.slice(0, lastSlash);
			const bucket = childrenByParentId.get(parent);
			if (bucket === undefined) {
				childrenByParentId.set(parent, [entry]);
			} else {
				bucket.push(entry);
			}
		}

		// current edition per corpus: lex-max across this corpus's entries.
		// Seed the corpus key on first sight so corpora with entries-but-no-editions
		// still appear with `null` (lets callers distinguish "unknown corpus"
		// from "known corpus, no editions yet").
		const corpus = entry.corpus;
		if (!currentEditionByCorpus.has(corpus)) {
			currentEditionByCorpus.set(corpus, null);
		}
		const editionList = editions.get(id) ?? [];
		if (editionList.length === 0) continue;
		let runningMax: EditionId | null = currentEditionByCorpus.get(corpus) ?? null;
		for (const edition of editionList) {
			if (runningMax === null || edition.id > runningMax) runningMax = edition.id;
		}
		if (runningMax !== currentEditionByCorpus.get(corpus)) {
			currentEditionByCorpus.set(corpus, runningMax);
		}
	}

	return {
		currentEditionByCorpus,
		childrenByParentId,
		entriesByCanonicalShort,
	};
}

/**
 * Test-only surface. Production code MUST NOT call this.
 *
 * `getRebuildCount` is used by perf assertions to verify that N lookups across
 * an unchanged registry rebuild the index exactly once.
 *
 * `reset` clears the cache so the next read forces a rebuild. The registry
 * test helpers call this in their teardown path so each test starts fresh.
 */
export const __index_cache_internal__ = {
	getRebuildCount(): number {
		return _rebuildCount;
	},
	reset(): void {
		_cached = null;
		_cachedSourcesGen = -1;
		_cachedEditionsGen = -1;
		_rebuildCount = 0;
	},
};
