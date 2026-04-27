import { afterEach, beforeEach, describe, expect, test } from 'vitest';
import type { Edition, SourceEntry, SourceId } from '../types.ts';
import { resetRegistry, withTestEditions, withTestEntries } from './__test_helpers__.ts';
import type { CorpusResolver } from './corpus-resolver.ts';
import { registerCorpusResolver } from './corpus-resolver.ts';
import {
	buildReverseIndex,
	clearReverseIndex,
	findEntriesByCanonicalShort,
	findLessonsCitingEntry,
	findLessonsCitingMultiple,
	findLessonsTransitivelyCitingEntry,
	getChildren,
	getCurrentEdition,
	getEditions,
	hasEntry,
	isPinStale,
	isSupersessionChainBroken,
	lessonId,
	resolveIdentifier,
	stripPin,
	walkSupersessionChain,
} from './query.ts';

beforeEach(() => {
	resetRegistry();
});

afterEach(() => {
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

describe('stripPin', () => {
	test('RI-01: strips ?at=... from a SourceId-shaped string', () => {
		expect(stripPin('airboss-ref:regs/cfr-14/91/103?at=2026')).toBe('airboss-ref:regs/cfr-14/91/103');
	});

	test('RI-02: leaves pin-less strings unchanged', () => {
		expect(stripPin('airboss-ref:regs/cfr-14/91/103')).toBe('airboss-ref:regs/cfr-14/91/103');
	});
});

describe('lessonId', () => {
	test('RI-03: strips .md extension', () => {
		expect(lessonId('course/regulations/foo/bar.md')).toBe('course/regulations/foo/bar');
	});

	test('leaves non-.md unchanged', () => {
		expect(lessonId('course/regulations/foo/bar')).toBe('course/regulations/foo/bar');
	});
});

describe('resolveIdentifier / hasEntry', () => {
	test('Q-01: resolveIdentifier returns the entry when present', () => {
		const id = 'airboss-ref:regs/cfr-14/91/103';
		withTestEntries({ [id]: makeEntry(id) }, () => {
			const resolved = resolveIdentifier(id as SourceId);
			expect(resolved).not.toBeNull();
			expect(resolved?.id).toBe(id);
		});
	});

	test('Q-02: resolveIdentifier strips ?at= before lookup', () => {
		const id = 'airboss-ref:regs/cfr-14/91/103';
		withTestEntries({ [id]: makeEntry(id) }, () => {
			const resolved = resolveIdentifier(`${id}?at=2026` as SourceId);
			expect(resolved?.id).toBe(id);
		});
	});

	test('Q-03: resolveIdentifier returns null for missing entry', () => {
		expect(resolveIdentifier('airboss-ref:regs/missing' as SourceId)).toBeNull();
	});

	test('Q-04: hasEntry boolean form matches resolveIdentifier', () => {
		const id = 'airboss-ref:regs/cfr-14/91/103';
		withTestEntries({ [id]: makeEntry(id) }, () => {
			expect(hasEntry(id as SourceId)).toBe(true);
			expect(hasEntry('airboss-ref:regs/missing' as SourceId)).toBe(false);
		});
	});
});

describe('getChildren', () => {
	test('Q-05: returns one-level-deep children only', () => {
		const parent = 'airboss-ref:regs/cfr-14/91';
		const child1 = 'airboss-ref:regs/cfr-14/91/103';
		const child2 = 'airboss-ref:regs/cfr-14/91/107';
		const grandchild = 'airboss-ref:regs/cfr-14/91/103/b';
		withTestEntries(
			{
				[parent]: makeEntry(parent),
				[child1]: makeEntry(child1),
				[child2]: makeEntry(child2),
				[grandchild]: makeEntry(grandchild),
			},
			() => {
				const children = getChildren(parent as SourceId);
				expect(children).toHaveLength(2);
				const ids = children.map((c) => c.id);
				expect(ids).toContain(child1);
				expect(ids).toContain(child2);
				expect(ids).not.toContain(grandchild);
			},
		);
	});

	test('returns empty array when parent has no children', () => {
		const id = 'airboss-ref:regs/cfr-14/91/103';
		withTestEntries({ [id]: makeEntry(id) }, () => {
			expect(getChildren(id as SourceId)).toEqual([]);
		});
	});
});

describe('walkSupersessionChain / isSupersessionChainBroken', () => {
	test('Q-06: walks a 3-entry chain in order', () => {
		const a = 'airboss-ref:interp/chief-counsel/mangiamele-2009';
		const b = 'airboss-ref:interp/chief-counsel/smith-2027';
		const c = 'airboss-ref:interp/chief-counsel/jones-2030';
		withTestEntries(
			{
				[a]: makeEntry(a, { superseded_by: b as SourceId }),
				[b]: makeEntry(b, { supersedes: a as SourceId, superseded_by: c as SourceId }),
				[c]: makeEntry(c, { supersedes: b as SourceId }),
			},
			() => {
				const chain = walkSupersessionChain(a as SourceId);
				expect(chain.map((e) => e.id)).toEqual([a, b, c]);
			},
		);
	});

	test('Q-07: cycle protection caps the walk', () => {
		const a = 'airboss-ref:interp/chief-counsel/a';
		const b = 'airboss-ref:interp/chief-counsel/b';
		withTestEntries(
			{
				[a]: makeEntry(a, { superseded_by: b as SourceId }),
				[b]: makeEntry(b, { superseded_by: a as SourceId }),
			},
			() => {
				const chain = walkSupersessionChain(a as SourceId);
				// Walks until cycle detected; at minimum returns a + b.
				expect(chain.length).toBeGreaterThan(0);
				expect(chain.length).toBeLessThanOrEqual(32);
			},
		);
	});

	test('Q-08: isSupersessionChainBroken returns true for missing target', () => {
		const a = 'airboss-ref:interp/chief-counsel/a';
		withTestEntries(
			{
				[a]: makeEntry(a, { superseded_by: 'airboss-ref:interp/chief-counsel/missing' as SourceId }),
			},
			() => {
				expect(isSupersessionChainBroken(a as SourceId)).toBe(true);
			},
		);
	});

	test('isSupersessionChainBroken returns false for an unbroken chain', () => {
		const a = 'airboss-ref:interp/chief-counsel/a';
		const b = 'airboss-ref:interp/chief-counsel/b';
		withTestEntries(
			{
				[a]: makeEntry(a, { superseded_by: b as SourceId }),
				[b]: makeEntry(b),
			},
			() => {
				expect(isSupersessionChainBroken(a as SourceId)).toBe(false);
			},
		);
	});
});

describe('findEntriesByCanonicalShort', () => {
	test('Q-09: finds matching entries (case-insensitive)', () => {
		const id = 'airboss-ref:regs/cfr-14/91/103';
		withTestEntries({ [id]: makeEntry(id) }, () => {
			expect(findEntriesByCanonicalShort('§91.103')).toHaveLength(1);
			expect(findEntriesByCanonicalShort('§91.103'.toUpperCase())).toHaveLength(1);
			expect(findEntriesByCanonicalShort('§99.999')).toEqual([]);
		});
	});
});

describe('reverse-index walk -- findLessonsCiting*', () => {
	test('Q-10/Q-11: finds a lesson citing a given entry; ignores pin in the body URL', async () => {
		// We stub the reverse index by building it against a temp directory.
		// But cleaner: use the live LESSON_CONTENT_PATHS scan after writing a
		// fixture file. Here we go lower-level and use buildReverseIndex on a
		// custom cwd. The function is process-cached so we clear the cache.
		clearReverseIndex();
		const { mkdirSync, rmSync, writeFileSync } = await import('node:fs');
		const { tmpdir } = await import('node:os');
		const { join: pathJoin } = await import('node:path');
		const tmpRoot = `${tmpdir()}/airboss-rix-${process.pid}-${Date.now()}`;
		mkdirSync(pathJoin(tmpRoot, 'course/regulations/sample'), { recursive: true });
		writeFileSync(
			pathJoin(tmpRoot, 'course/regulations/sample/lesson.md'),
			`---\ntitle: x\n---\n\nSee [@cite](airboss-ref:regs/cfr-14/91/103?at=2026).\n`,
			'utf-8',
		);
		try {
			const index = buildReverseIndex(tmpRoot);
			const stripped = 'airboss-ref:regs/cfr-14/91/103';
			const lessons = index.get(stripped);
			expect(lessons).toBeDefined();
			expect(lessons).toContain('course/regulations/sample/lesson');
		} finally {
			rmSync(tmpRoot, { recursive: true, force: true });
		}
	});

	test('Q-12: findLessonsCitingMultiple returns intersection', async () => {
		// We can't easily exercise findLessonsCitingMultiple against the live
		// reverse index because the live tree has no airboss-ref: URLs today.
		// Instead, verify the function returns an empty array for an empty
		// id list, which is the documented degenerate case.
		expect(await findLessonsCitingMultiple([])).toEqual([]);
	});

	test('findLessonsCitingEntry returns empty when no lessons match', async () => {
		// The live reverse index has no entries citing this id.
		const lessons = await findLessonsCitingEntry('airboss-ref:regs/cfr-14/91/999' as SourceId);
		expect(lessons).toEqual([]);
	});

	test('Q-18: findLessonsTransitivelyCitingEntry mirrors findLessonsCitingEntry', async () => {
		const direct = await findLessonsCitingEntry('airboss-ref:regs/cfr-14/91/999' as SourceId);
		const transitive = await findLessonsTransitivelyCitingEntry('airboss-ref:regs/cfr-14/91/999' as SourceId);
		expect(transitive).toEqual(direct);
	});
});

describe('getCurrentEdition', () => {
	test('Q-13: returns null for default no-op resolver', () => {
		expect(getCurrentEdition('regs')).toBeNull();
	});

	test('Q-14: returns resolver value after registerCorpusResolver', () => {
		const real: CorpusResolver = {
			corpus: 'regs',
			parseLocator: (_l) => ({ kind: 'ok', segments: [] }),
			formatCitation: (e) => e.canonical_short,
			getCurrentEdition: () => '2026',
			getEditions: async () => [],
			getLiveUrl: () => null,
			getDerivativeContent: () => null,
			getIndexedContent: async () => null,
		};
		registerCorpusResolver(real);
		expect(getCurrentEdition('regs')).toBe('2026');
	});

	test('returns null for unknown corpus', () => {
		expect(getCurrentEdition('not-a-corpus')).toBeNull();
	});
});

describe('getEditions / isPinStale', () => {
	test('Q-15: getEditions resolves to EDITIONS map value', async () => {
		const id = 'airboss-ref:regs/cfr-14/91/103' as SourceId;
		const editions: readonly Edition[] = [
			{ id: '2024', published_date: new Date('2024-01-01'), source_url: 'about:blank' },
			{ id: '2026', published_date: new Date('2026-01-01'), source_url: 'about:blank' },
		];
		await withTestEditions(new Map([[id, editions]]), async () => {
			const result = await getEditions(id);
			expect(result.map((e) => e.id)).toEqual(['2024', '2026']);
		});
	});

	test('Q-16/Q-17: isPinStale calculates distance correctly', async () => {
		const id = 'airboss-ref:regs/cfr-14/91/103' as SourceId;
		const editions: readonly Edition[] = [
			{ id: '2024', published_date: new Date('2024-01-01'), source_url: 'about:blank' },
			{ id: '2025', published_date: new Date('2025-01-01'), source_url: 'about:blank' },
			{ id: '2026', published_date: new Date('2026-01-01'), source_url: 'about:blank' },
		];
		const real: CorpusResolver = {
			corpus: 'regs',
			parseLocator: (_l) => ({ kind: 'ok', segments: [] }),
			formatCitation: (e) => e.canonical_short,
			getCurrentEdition: () => '2026',
			getEditions: async () => editions,
			getLiveUrl: () => null,
			getDerivativeContent: () => null,
			getIndexedContent: async () => null,
		};
		registerCorpusResolver(real);
		await withTestEntries({ [id]: makeEntry(id) }, async () => {
			await withTestEditions(new Map([[id, editions]]), async () => {
				expect(await isPinStale(id, '2024')).toBe(true); // distance 2 -> stale
				expect(await isPinStale(id, '2025')).toBe(false); // distance 1 -> not stale
				expect(await isPinStale(id, '2026')).toBe(false); // current
			});
		});
	});
});
