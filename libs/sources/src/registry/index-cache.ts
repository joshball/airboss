/**
 * Generation-invalidated registry indexes for O(1) registry lookups.
 *
 * The registry tables (`SOURCES`, `EDITIONS`) are mutated via
 * `__sources_internal__.setActiveTable` / `__editions_internal__.setActiveTable`
 * during ingestion + bootstrap, and via `withTestEntries` / `withTestEditions`
 * in tests. Each mutation bumps a per-table generation counter
 * (`getGeneration` on the internal handle).
 *
 * This module derives four indexes from those tables, each cached behind a
 * `(sourcesGen, editionsGen)` pair so the next read triggers a rebuild iff
 * either generation has advanced. The four indexes correspond one-to-one with
 * the four lookups previously implemented as `Object.keys(getSources())`
 * linear scans:
 *
 *   1. `getCorpusEntryIds(corpus)` -- replaces `Object.keys(getSources()).filter(...)`
 *      in `regs/handbooks` resolvers' `getCurrentEdition`.
 *   2. `getCurrentEditionForCorpus(corpus, computeMax)` -- memoizes the
 *      lex-max edition slug per corpus across the cached corpus entry list.
 *   3. `getChildrenIndex().get(parentId)` -- replaces the prefix-walk in
 *      `query.ts:getChildren`.
 *   4. `getCanonicalShortIndex().get(lowercaseShort)` -- replaces the linear
 *      scan in `query.ts:findEntriesByCanonicalShort`.
 *
 * `batchResolve` walks the corpus resolver per id; with this cache each
 * `getCurrentEdition()` call costs one Map-get against an already-built
 * memoization (+ at most one rebuild per registry mutation), so a render with
 * N citations does at most one index pass total instead of N table scans.
 *
 * Invariants:
 *
 *   - Indexes are derived from the active tables; readers never observe a
 *     half-built state. The build runs synchronously during the first read
 *     after a generation bump and finishes before returning.
 *   - The cache is process-local. There is no cross-process invalidation
 *     because the registry itself is process-local (per ADR 019 §2.5
 *     "process-cached").
 *   - Tests reset state via `__test_helpers__.resetRegistry()` which bumps
 *     both generations naturally.
 */

import type { EditionId, SourceEntry, SourceId } from '../types.ts';
import { __editions_internal__ } from './editions.ts';
import { __sources_internal__, getSources } from './sources.ts';

interface RegistryIndexes {
	readonly sourcesGen: number;
	/** corpus -> SourceId[] (entries belonging to that corpus). */
	readonly byCorpus: ReadonlyMap<string, readonly SourceId[]>;
	/** parent SourceId (without trailing slash) -> immediate-child entries. */
	readonly children: ReadonlyMap<string, readonly SourceEntry[]>;
	/** lowercased canonical_short -> entries with that short form. */
	readonly byCanonicalShort: ReadonlyMap<string, readonly SourceEntry[]>;
}

interface CurrentEditionCache {
	readonly sourcesGen: number;
	readonly editionsGen: number;
	readonly perCorpus: Map<string, EditionId | null>;
}

let _indexes: RegistryIndexes | null = null;
let _currentEditionCache: CurrentEditionCache | null = null;
let _rebuildCount = 0;

/**
 * Build (or return cached) sources-only indexes. Rebuilds when the sources
 * generation advances; no rebuild on edition-only changes.
 */
function getIndexes(): RegistryIndexes {
	const gen = __sources_internal__.getGeneration();
	if (_indexes !== null && _indexes.sourcesGen === gen) return _indexes;

	const byCorpus = new Map<string, SourceId[]>();
	const children = new Map<string, SourceEntry[]>();
	const byCanonicalShort = new Map<string, SourceEntry[]>();

	const sources = getSources();
	for (const key of Object.keys(sources)) {
		const id = key as SourceId;
		const entry = sources[id];
		if (entry === undefined) continue;

		// 1. Corpus index.
		const corpusList = byCorpus.get(entry.corpus);
		if (corpusList === undefined) {
			byCorpus.set(entry.corpus, [id]);
		} else {
			corpusList.push(id);
		}

		// 2. Canonical-short index (case-insensitive).
		const shortKey = entry.canonical_short.toLowerCase();
		const shortList = byCanonicalShort.get(shortKey);
		if (shortList === undefined) {
			byCanonicalShort.set(shortKey, [entry]);
		} else {
			shortList.push(entry);
		}

		// 3. Children index (parent path = id with last `/segment` trimmed).
		const lastSlash = key.lastIndexOf('/');
		if (lastSlash > 0) {
			const parent = key.slice(0, lastSlash);
			const remainder = key.slice(lastSlash + 1);
			if (remainder.length > 0 && !remainder.includes('/')) {
				const childList = children.get(parent);
				if (childList === undefined) {
					children.set(parent, [entry]);
				} else {
					childList.push(entry);
				}
			}
		}
	}

	_indexes = {
		sourcesGen: gen,
		byCorpus,
		children,
		byCanonicalShort,
	};
	_rebuildCount += 1;

	// Edition-derived caches depend on the sources index too; invalidate when
	// the underlying sources index rebuilds.
	_currentEditionCache = null;

	return _indexes;
}

/**
 * Return the SourceIds in `corpus`. Empty array when the corpus has no
 * entries. Result is a stable reference for the lifetime of the current
 * sources generation; callers MUST NOT mutate it.
 */
export function getCorpusEntryIds(corpus: string): readonly SourceId[] {
	return getIndexes().byCorpus.get(corpus) ?? [];
}

/**
 * Lex-max edition slug across all entries in `corpus`. Memoized against
 * (sources-gen, editions-gen): O(1) on repeat reads inside one batch, and
 * an O(corpus_entries) recompute when either table is mutated.
 *
 * Editions are calendar years (`2026`, `2026-01-01`) for `regs` and
 * letter-suffixed FAA revisions (`8083-25C`) for `handbooks`; in both cases
 * lexical max equals chronological max within a doc, matching the contract
 * each resolver carried inline before this index existed.
 */
export function getCurrentEditionForCorpus(
	corpus: string,
	editionsForId: (id: SourceId) => readonly { id: EditionId }[],
): EditionId | null {
	// Build the sources index FIRST. The build path nulls
	// `_currentEditionCache` on rebuild, so we have to settle the sources
	// index before reading the edition cache state.
	const ids = getCorpusEntryIds(corpus);

	const sourcesGen = __sources_internal__.getGeneration();
	const editionsGen = __editions_internal__.getGeneration();
	let cache = _currentEditionCache;
	if (cache === null || cache.sourcesGen !== sourcesGen || cache.editionsGen !== editionsGen) {
		cache = {
			sourcesGen,
			editionsGen,
			perCorpus: new Map(),
		};
		_currentEditionCache = cache;
	} else {
		const cached = cache.perCorpus.get(corpus);
		if (cached !== undefined) return cached;
	}

	let max: EditionId | null = null;
	for (const id of ids) {
		const editions = editionsForId(id);
		for (const edition of editions) {
			if (max === null || edition.id > max) max = edition.id;
		}
	}

	cache.perCorpus.set(corpus, max);
	return max;
}

/**
 * One-level children of `parentId`. Children are entries whose canonical
 * SourceId equals `${parentId}/<single-segment>`. Empty array when there are
 * none. Stable reference for the lifetime of the current sources generation.
 */
export function getChildrenForId(parentId: string): readonly SourceEntry[] {
	return getIndexes().children.get(parentId) ?? [];
}

/**
 * Entries whose `canonical_short` matches `short` (case-insensitive). Empty
 * array when no entries match. Stable reference for the lifetime of the
 * current sources generation.
 */
export function getEntriesForCanonicalShort(short: string): readonly SourceEntry[] {
	return getIndexes().byCanonicalShort.get(short.toLowerCase()) ?? [];
}

/**
 * Test-only inspection surface. Production code MUST NOT depend on these.
 * Used by index-cache.test.ts to assert rebuild semantics + structural O(1)
 * lookups (no `Object.keys(getSources())` per call).
 */
export const __index_cache_internal__ = {
	getRebuildCount(): number {
		return _rebuildCount;
	},
	resetForTests(): void {
		_indexes = null;
		_currentEditionCache = null;
		_rebuildCount = 0;
	},
	/** Force a rebuild on next read by clearing the cache without bumping a gen. */
	clear(): void {
		_indexes = null;
		_currentEditionCache = null;
	},
};
