import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { __corpus_resolver_internal__ } from '../registry/corpus-resolver.ts';

const registerCorpusResolver = __corpus_resolver_internal__.registerTestResolver;
import { resetRegistry, withTestEditions, withTestEntries } from '../registry/__test_helpers__.ts';
import type {
	CorpusResolver,
	IndexedContent,
	LessonAcknowledgment,
	SourceEntry,
	SourceId,
} from '../types.ts';
import { batchResolve, __batch_internal__ } from './batch-resolve.ts';

function makeEntry(overrides: Partial<SourceEntry> & Pick<SourceEntry, 'id'>): SourceEntry {
	return {
		corpus: overrides.corpus ?? 'regs',
		canonical_short: overrides.canonical_short ?? '§91.103',
		canonical_formal: overrides.canonical_formal ?? '14 CFR § 91.103',
		canonical_title: overrides.canonical_title ?? 'Preflight action',
		last_amended_date: overrides.last_amended_date ?? new Date('2009-08-21'),
		alternative_names: overrides.alternative_names,
		supersedes: overrides.supersedes,
		superseded_by: overrides.superseded_by,
		lifecycle: overrides.lifecycle ?? 'accepted',
		id: overrides.id,
	};
}

function makeMockResolver(corpus: string, opts: {
	liveUrl?: string;
	indexed?: IndexedContent | null;
	indexedReadCount?: { value: number };
}): CorpusResolver {
	return {
		corpus,
		parseLocator(locator) {
			return { kind: 'ok', segments: locator.split('/') };
		},
		formatCitation(entry, style) {
			if (style === 'short') return entry.canonical_short;
			if (style === 'formal') return entry.canonical_formal;
			return entry.canonical_title;
		},
		getCurrentEdition() {
			return '2026';
		},
		async getEditions() {
			return [];
		},
		getLiveUrl() {
			return opts.liveUrl ?? null;
		},
		getDerivativeContent() {
			return null;
		},
		async getIndexedContent() {
			if (opts.indexedReadCount !== undefined) opts.indexedReadCount.value += 1;
			return opts.indexed ?? null;
		},
	};
}

describe('batchResolve', () => {
	beforeEach(() => resetRegistry());
	afterEach(() => __corpus_resolver_internal__.resetToDefaults());

	it('returns empty map for empty ids', async () => {
		const map = await batchResolve([], { acknowledgments: [], historicalLens: false, body: '' });
		expect(map.size).toBe(0);
	});

	it('resolves a known entry without reading indexed content (no @text/@quote in body)', async () => {
		const entry = makeEntry({ id: 'airboss-ref:regs/cfr-14/91/103' as SourceId });
		const reads = { value: 0 };
		registerCorpusResolver(makeMockResolver('regs', {
			liveUrl: 'https://www.ecfr.gov/...',
			indexed: { id: entry.id, edition: '2026', normalizedText: 'BODY' },
			indexedReadCount: reads,
		}));

		await withTestEntries({ [entry.id]: entry }, async () => {
			const body = '[@cite](airboss-ref:regs/cfr-14/91/103?at=2026)';
			const map = await batchResolve([`${entry.id}?at=2026`], {
				acknowledgments: [],
				historicalLens: false,
				body,
			});
			const r = map.get(`${entry.id}?at=2026`);
			expect(r?.entry).toBe(entry);
			expect(r?.liveUrl).toBe('https://www.ecfr.gov/...');
			expect(r?.indexed).toBeNull();
			expect(reads.value).toBe(0);
		});
	});

	it('reads indexed content when body has @text token', async () => {
		const entry = makeEntry({ id: 'airboss-ref:regs/cfr-14/91/103' as SourceId });
		const indexed: IndexedContent = { id: entry.id, edition: '2026', normalizedText: 'BODY' };
		const reads = { value: 0 };
		registerCorpusResolver(makeMockResolver('regs', {
			liveUrl: 'X',
			indexed,
			indexedReadCount: reads,
		}));

		await withTestEntries({ [entry.id]: entry }, async () => {
			const body = '[@text](airboss-ref:regs/cfr-14/91/103?at=2026)';
			const map = await batchResolve([`${entry.id}?at=2026`], {
				acknowledgments: [],
				historicalLens: false,
				body,
			});
			const r = map.get(`${entry.id}?at=2026`);
			expect(r?.indexed).toEqual(indexed);
			expect(reads.value).toBe(1);
		});
	});

	it('returns null entry when registry has no record', async () => {
		const map = await batchResolve(['airboss-ref:regs/cfr-14/91/missing?at=2026'], {
			acknowledgments: [],
			historicalLens: false,
			body: '',
		});
		const r = map.get('airboss-ref:regs/cfr-14/91/missing?at=2026');
		expect(r?.entry).toBeNull();
		expect(r?.chain).toEqual([]);
		expect(r?.liveUrl).toBeNull();
	});

	it('walks supersession chain', async () => {
		const original = makeEntry({
			id: 'airboss-ref:interp/walker-2017' as SourceId,
			corpus: 'interp',
			canonical_short: 'Walker (2017)',
			superseded_by: 'airboss-ref:interp/smith-2030' as SourceId,
		});
		const successor = makeEntry({
			id: 'airboss-ref:interp/smith-2030' as SourceId,
			corpus: 'interp',
			canonical_short: 'Smith (2030)',
		});
		registerCorpusResolver(makeMockResolver('interp', {}));

		await withTestEntries(
			{ [original.id]: original, [successor.id]: successor },
			async () => {
				const map = await batchResolve(['airboss-ref:interp/walker-2017'], {
					acknowledgments: [],
					historicalLens: false,
					body: '',
				});
				const r = map.get('airboss-ref:interp/walker-2017');
				expect(r?.chain.length).toBe(2);
				expect(r?.chain[0]?.id).toBe(original.id);
				expect(r?.chain[1]?.id).toBe(successor.id);
			},
		);
	});

	it('detects cross-corpus chain in annotation', async () => {
		const original = makeEntry({
			id: 'airboss-ref:regs/cfr-14/91/103' as SourceId,
			corpus: 'regs',
			superseded_by: 'airboss-ref:icao/annex-6' as SourceId,
		});
		const successor = makeEntry({
			id: 'airboss-ref:icao/annex-6' as SourceId,
			corpus: 'icao',
			canonical_short: '4.3.1',
		});
		registerCorpusResolver(makeMockResolver('regs', {}));

		await withTestEntries(
			{ [original.id]: original, [successor.id]: successor },
			async () => {
				const map = await batchResolve(['airboss-ref:regs/cfr-14/91/103?at=2026'], {
					acknowledgments: [],
					historicalLens: false,
					body: '',
				});
				const r = map.get('airboss-ref:regs/cfr-14/91/103?at=2026');
				expect(r?.annotation.kind).toBe('cross-corpus');
				expect(r?.annotation.text).toContain('icao');
			},
		);
	});

	it('forwards acks into the annotation cascade', async () => {
		const target = makeEntry({
			id: 'airboss-ref:interp/walker-2017' as SourceId,
			corpus: 'interp',
		});
		registerCorpusResolver(makeMockResolver('interp', {}));
		const ack: LessonAcknowledgment = {
			target: target.id,
			historical: true,
		};
		await withTestEntries({ [target.id]: target }, async () => {
			const map = await batchResolve(['airboss-ref:interp/walker-2017'], {
				acknowledgments: [ack],
				historicalLens: false,
				body: '',
			});
			expect(map.get('airboss-ref:interp/walker-2017')?.annotation.kind).toBe('historical');
		});
	});
});

describe('__batch_internal__.identifyIndexedReads', () => {
	it('finds @text tokens', () => {
		const body = '[@text](airboss-ref:regs/cfr-14/91/103?at=2026) [@cite](airboss-ref:regs/cfr-14/91/107?at=2026)';
		const out = __batch_internal__.identifyIndexedReads(body);
		expect(out.has('airboss-ref:regs/cfr-14/91/103?at=2026')).toBe(true);
		expect(out.has('airboss-ref:regs/cfr-14/91/107?at=2026')).toBe(false);
	});

	it('finds @quote tokens', () => {
		const body = '[@quote](airboss-ref:regs/cfr-14/91/103?at=2026)';
		const out = __batch_internal__.identifyIndexedReads(body);
		expect(out.has('airboss-ref:regs/cfr-14/91/103?at=2026')).toBe(true);
	});

	it('returns empty set when no @text/@quote tokens', () => {
		const body = '[@cite](airboss-ref:regs/cfr-14/91/103?at=2026)';
		const out = __batch_internal__.identifyIndexedReads(body);
		expect(out.size).toBe(0);
	});
});
