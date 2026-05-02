/**
 * Tests for the registry's lookup index cache.
 *
 * Two stories the suite must protect:
 *
 *   1. Correctness parity. Indexed `getCurrentEditionForCorpus`,
 *      `getChildrenIndexed`, `findEntriesByCanonicalShortIndexed` return the
 *      same results as the pre-index linear-scan implementations.
 *   2. Rebuild cost. The index rebuilds at most once between mutations -- N
 *      reads after one swap should produce one rebuild, not N.
 *
 * The rebuild-count assertion is the key perf safety net. It catches the
 * "linear-scan-per-id" regression Cluster F was created to fix: if a future
 * change accidentally reverts to per-call iteration, the count will spike.
 */

import { afterEach, beforeEach, describe, expect, test } from 'vitest';
import type { Edition, SourceEntry, SourceId } from '../types.ts';
import { resetRegistry, withTestEditions, withTestEntries } from './__test_helpers__.ts';
import { __corpus_resolver_internal__ } from './corpus-resolver.ts';
import {
	__index_cache_internal__,
	findEntriesByCanonicalShortIndexed,
	getChildrenIndexed,
	getCurrentEditionForCorpus,
	getRegistryIndex,
} from './index-cache.ts';
import { findEntriesByCanonicalShort, getChildren } from './query.ts';

let restoreProductionSnapshot: (() => void) | null = null;

beforeEach(() => {
	restoreProductionSnapshot = __corpus_resolver_internal__.saveProductionSnapshot();
	resetRegistry();
	__corpus_resolver_internal__.wipeToNoOpDefaults();
});

afterEach(() => {
	restoreProductionSnapshot?.();
	restoreProductionSnapshot = null;
	resetRegistry();
});

function makeEntry(id: string, opts: Partial<SourceEntry> = {}): SourceEntry {
	const corpus = id.split(':')[1]?.split('/')[0] ?? 'regs';
	return {
		id: id as SourceId,
		corpus,
		canonical_short: '§91.103',
		canonical_formal: '14 CFR § 91.103',
		canonical_title: 'Preflight action',
		last_amended_date: new Date('2026-01-01'),
		lifecycle: 'accepted',
		...opts,
	};
}

describe('index-cache: correctness parity', () => {
	test('IC-01: getCurrentEditionForCorpus returns lex-max edition across corpus entries', () => {
		const a = 'airboss-ref:regs/cfr-14/91/103' as SourceId;
		const b = 'airboss-ref:regs/cfr-14/91/107' as SourceId;
		const c = 'airboss-ref:handbooks/phak/8083-25C' as SourceId;
		const editions: Map<SourceId, readonly Edition[]> = new Map([
			[a, [{ id: '2024', published_date: new Date('2024-01-01'), source_url: 'about:blank' }]],
			[b, [{ id: '2026', published_date: new Date('2026-01-01'), source_url: 'about:blank' }]],
			[c, [{ id: '8083-25C', published_date: new Date('2024-01-01'), source_url: 'about:blank' }]],
		]);
		withTestEntries(
			{
				[a]: makeEntry(a, { corpus: 'regs' }),
				[b]: makeEntry(b, { corpus: 'regs' }),
				[c]: makeEntry(c, { corpus: 'handbooks' }),
			},
			() => {
				withTestEditions(editions, () => {
					expect(getCurrentEditionForCorpus('regs')).toBe('2026');
					expect(getCurrentEditionForCorpus('handbooks')).toBe('8083-25C');
					expect(getCurrentEditionForCorpus('aim')).toBeNull();
				});
			},
		);
	});

	test('IC-02: getChildrenIndexed matches getChildren for one-level prefix', () => {
		const parent = 'airboss-ref:regs/cfr-14/91' as SourceId;
		const child1 = 'airboss-ref:regs/cfr-14/91/103' as SourceId;
		const child2 = 'airboss-ref:regs/cfr-14/91/107' as SourceId;
		const grandchild = 'airboss-ref:regs/cfr-14/91/103/b' as SourceId;
		withTestEntries(
			{
				[parent]: makeEntry(parent),
				[child1]: makeEntry(child1),
				[child2]: makeEntry(child2),
				[grandchild]: makeEntry(grandchild),
			},
			() => {
				const indexed = getChildrenIndexed(parent);
				const fromQuery = getChildren(parent);
				expect(indexed.map((e) => e.id).sort()).toEqual([child1, child2].sort());
				// `getChildren` should now route through the indexed path; both
				// answers must be the same set.
				expect(fromQuery.map((e) => e.id).sort()).toEqual(indexed.map((e) => e.id).sort());
			},
		);
	});

	test('IC-03: findEntriesByCanonicalShortIndexed is case-insensitive and parity with findEntriesByCanonicalShort', () => {
		const id = 'airboss-ref:regs/cfr-14/91/103' as SourceId;
		withTestEntries({ [id]: makeEntry(id, { canonical_short: '§91.103' }) }, () => {
			expect(findEntriesByCanonicalShortIndexed('§91.103')).toHaveLength(1);
			expect(findEntriesByCanonicalShortIndexed('§91.103'.toUpperCase())).toHaveLength(1);
			expect(findEntriesByCanonicalShortIndexed('§99.999')).toEqual([]);
			expect(findEntriesByCanonicalShort('§91.103').map((e) => e.id)).toEqual([id]);
		});
	});
});

describe('index-cache: lazy rebuild on generation change', () => {
	test('IC-04: index rebuilds when sources table swaps', () => {
		__index_cache_internal__.reset();
		const before = __index_cache_internal__.getRebuildCount();

		// First read triggers a build.
		getRegistryIndex();
		const afterFirst = __index_cache_internal__.getRebuildCount();
		expect(afterFirst).toBe(before + 1);

		// Second read with no swap reuses the cache.
		getRegistryIndex();
		expect(__index_cache_internal__.getRebuildCount()).toBe(afterFirst);

		// Swap the sources table; next read rebuilds.
		const id = 'airboss-ref:regs/foo' as SourceId;
		withTestEntries({ [id]: makeEntry(id) }, () => {
			getRegistryIndex();
			expect(__index_cache_internal__.getRebuildCount()).toBe(afterFirst + 1);
		});
		// The withTestEntries restore counts as another swap -> another rebuild
		// on the next read.
		getRegistryIndex();
		expect(__index_cache_internal__.getRebuildCount()).toBe(afterFirst + 2);
	});

	test('IC-05: index rebuilds when editions map swaps', () => {
		__index_cache_internal__.reset();
		const before = __index_cache_internal__.getRebuildCount();
		getRegistryIndex();
		const afterFirst = __index_cache_internal__.getRebuildCount();

		const id = 'airboss-ref:regs/cfr-14/91/103' as SourceId;
		const editions = new Map<SourceId, readonly Edition[]>([
			[id, [{ id: '2026', published_date: new Date('2026-01-01'), source_url: 'about:blank' }]],
		]);
		withTestEditions(editions, () => {
			getRegistryIndex();
			expect(__index_cache_internal__.getRebuildCount()).toBe(afterFirst + 1);
		});
		expect(before).toBeGreaterThanOrEqual(0);
	});
});

describe('index-cache: perf budget against linear-scan regression', () => {
	test('IC-06: 1000 entries + 1000 findEntriesByCanonicalShort lookups -> exactly one rebuild', () => {
		const entries: Record<string, SourceEntry> = {};
		for (let i = 0; i < 1000; i += 1) {
			const id = `airboss-ref:regs/cfr-14/91/${i}` as SourceId;
			entries[id] = makeEntry(id, { canonical_short: `§91.${i}` });
		}

		withTestEntries(entries, () => {
			__index_cache_internal__.reset();
			const before = __index_cache_internal__.getRebuildCount();

			for (let i = 0; i < 1000; i += 1) {
				findEntriesByCanonicalShortIndexed(`§91.${i}`);
			}

			const after = __index_cache_internal__.getRebuildCount();
			// Critical assertion: 1000 reads = 1 build, not 1000 builds.
			// Catches reversion to the per-call linear-scan pattern Cluster F
			// was filed to remove.
			expect(after - before).toBe(1);
		});
	});

	test('IC-07: 1000 entries + 1000 getChildrenIndexed lookups -> exactly one rebuild', () => {
		const entries: Record<string, SourceEntry> = {};
		const parent = 'airboss-ref:regs/cfr-14/91' as SourceId;
		entries[parent] = makeEntry(parent);
		for (let i = 0; i < 1000; i += 1) {
			const id = `airboss-ref:regs/cfr-14/91/${i}` as SourceId;
			entries[id] = makeEntry(id);
		}

		withTestEntries(entries, () => {
			__index_cache_internal__.reset();
			const before = __index_cache_internal__.getRebuildCount();

			for (let i = 0; i < 1000; i += 1) {
				getChildrenIndexed(parent);
			}

			expect(__index_cache_internal__.getRebuildCount() - before).toBe(1);
		});
	});

	test('IC-08: 1000 entries + 1000 getCurrentEditionForCorpus lookups -> exactly one rebuild', () => {
		const entries: Record<string, SourceEntry> = {};
		const editionMap = new Map<SourceId, readonly Edition[]>();
		for (let i = 0; i < 1000; i += 1) {
			const id = `airboss-ref:regs/cfr-14/91/${i}` as SourceId;
			entries[id] = makeEntry(id);
			editionMap.set(id, [
				{
					id: i % 7 === 0 ? '2026' : '2024',
					published_date: new Date('2024-01-01'),
					source_url: 'about:blank',
				},
			]);
		}

		withTestEntries(entries, () => {
			withTestEditions(editionMap, () => {
				__index_cache_internal__.reset();
				const before = __index_cache_internal__.getRebuildCount();

				let last: string | null = null;
				for (let i = 0; i < 1000; i += 1) {
					last = getCurrentEditionForCorpus('regs');
				}

				expect(last).toBe('2026');
				expect(__index_cache_internal__.getRebuildCount() - before).toBe(1);
			});
		});
	});
});
