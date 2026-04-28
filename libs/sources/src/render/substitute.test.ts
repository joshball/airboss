import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { __corpus_resolver_internal__ } from '../registry/corpus-resolver.ts';

const registerCorpusResolver = __corpus_resolver_internal__.registerTestResolver;
import { resetRegistry, withTestEntries } from '../registry/__test_helpers__.ts';
import type { CorpusResolver, IndexedContent, SourceEntry, SourceId } from '../types.ts';
import { batchResolve } from './batch-resolve.ts';
import { extractIdentifiers } from './extract.ts';
import { substituteTokens } from './substitute.ts';

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

function mockResolver(corpus: string, urls: Record<string, string>, indexed?: Record<string, IndexedContent>): CorpusResolver {
	return {
		corpus,
		parseLocator(locator) {
			return { kind: 'ok', segments: locator.split('/') };
		},
		formatCitation(entry, style) {
			return style === 'short' ? entry.canonical_short : style === 'formal' ? entry.canonical_formal : entry.canonical_title;
		},
		getCurrentEdition() {
			return '2026';
		},
		async getEditions() {
			return [];
		},
		getLiveUrl(id) {
			return urls[id] ?? null;
		},
		getDerivativeContent() {
			return null;
		},
		async getIndexedContent(id) {
			return indexed?.[id] ?? null;
		},
	};
}

const E91_103 = makeEntry({
	id: 'airboss-ref:regs/cfr-14/91/103' as SourceId,
	canonical_short: '§91.103',
	canonical_title: 'Preflight action',
});
const E91_167 = makeEntry({
	id: 'airboss-ref:regs/cfr-14/91/167' as SourceId,
	canonical_short: '§91.167',
	canonical_title: 'Fuel requirements for flight in IFR conditions',
});
const E91_168 = makeEntry({
	id: 'airboss-ref:regs/cfr-14/91/168' as SourceId,
	canonical_short: '§91.168',
	canonical_title: 'Reserved',
});
const E91_169 = makeEntry({
	id: 'airboss-ref:regs/cfr-14/91/169' as SourceId,
	canonical_short: '§91.169',
	canonical_title: 'IFR flight plan: Information required',
});

const REGS_URLS: Record<string, string> = {
	[E91_103.id]: 'https://www.ecfr.gov/current/title-14/.../section-91.103',
	[E91_167.id]: 'https://www.ecfr.gov/current/title-14/.../section-91.167',
	[E91_168.id]: 'https://www.ecfr.gov/current/title-14/.../section-91.168',
	[E91_169.id]: 'https://www.ecfr.gov/current/title-14/.../section-91.169',
};

const ALL_ENTRIES = {
	[E91_103.id]: E91_103,
	[E91_167.id]: E91_167,
	[E91_168.id]: E91_168,
	[E91_169.id]: E91_169,
};

describe('substituteTokens -- web mode', () => {
	beforeEach(() => resetRegistry());
	afterEach(() => __corpus_resolver_internal__.resetToDefaults());

	it('substitutes @cite into a hyperlinked anchor', async () => {
		registerCorpusResolver(mockResolver('regs', REGS_URLS));
		await withTestEntries(ALL_ENTRIES, async () => {
			const body = 'Per [@cite](airboss-ref:regs/cfr-14/91/103?at=2026), the PIC must...';
			const ids = extractIdentifiers(body);
			const resolved = await batchResolve(ids, { acknowledgments: [], historicalLens: false, body });
			const out = substituteTokens(body, resolved, 'web');
			expect(out).toContain('<a href=');
			expect(out).toContain('§91.103 Preflight action');
			expect(out).toContain('class="ab-ref ab-ref-regs"');
			expect(out).not.toContain('@cite');
		});
	});

	it('collapses an adjacency group into a single anchor (range form)', async () => {
		registerCorpusResolver(mockResolver('regs', REGS_URLS));
		await withTestEntries(ALL_ENTRIES, async () => {
			const body =
				'Trio at [§91.167](airboss-ref:regs/cfr-14/91/167?at=2026), [§91.168](airboss-ref:regs/cfr-14/91/168?at=2026), and [§91.169](airboss-ref:regs/cfr-14/91/169?at=2026).';
			const ids = extractIdentifiers(body);
			const resolved = await batchResolve(ids, { acknowledgments: [], historicalLens: false, body });
			const out = substituteTokens(body, resolved, 'web');
			// Single anchor with range form.
			expect(out).toContain('§91.167-91.169');
			// Only one <a> tag.
			expect(out.match(/<a /g)?.length).toBe(1);
			// Interstitial separators consumed.
			expect(out).not.toContain(', and ');
		});
	});

	it('emits comma-list for non-contiguous group', async () => {
		registerCorpusResolver(mockResolver('regs', REGS_URLS));
		await withTestEntries(ALL_ENTRIES, async () => {
			const body =
				'Refs [§91.167](airboss-ref:regs/cfr-14/91/167?at=2026), [§91.169](airboss-ref:regs/cfr-14/91/169?at=2026).';
			const ids = extractIdentifiers(body);
			const resolved = await batchResolve(ids, { acknowledgments: [], historicalLens: false, body });
			const out = substituteTokens(body, resolved, 'web');
			expect(out).toContain('§91.167, §91.169');
			expect(out.match(/<a /g)?.length).toBe(1);
		});
	});

	it('attaches annotation span when ack is covered', async () => {
		const target = makeEntry({
			id: 'airboss-ref:interp/walker-2017' as SourceId,
			corpus: 'interp',
			canonical_short: 'Walker (2017)',
		});
		const superseder = makeEntry({
			id: 'airboss-ref:interp/smith-2030' as SourceId,
			corpus: 'interp',
			canonical_short: 'Smith (2030)',
		});
		registerCorpusResolver(mockResolver('interp', {}));
		await withTestEntries(
			{ [target.id]: target, [superseder.id]: superseder },
			async () => {
				const body = '[Walker letter](airboss-ref:interp/walker-2017)';
				const ids = extractIdentifiers(body);
				const resolved = await batchResolve(ids, {
					acknowledgments: [
						{
							target: target.id,
							superseder: superseder.id,
							historical: false,
							reason: 'original-intact',
							note: 'narrows',
						},
					],
					historicalLens: false,
					body,
				});
				const out = substituteTokens(body, resolved, 'web');
				expect(out).toContain('class="ab-ref-annotation ab-ref-covered"');
				expect(out).toContain('acknowledged');
				expect(out).toContain('Smith (2030)');
				expect(out).toContain('title="narrows"');
			},
		);
	});

	it('leaves non-airboss-ref links untouched', async () => {
		await withTestEntries({}, async () => {
			const body = 'See [eCFR](https://www.ecfr.gov/) for details.';
			const out = substituteTokens(body, new Map(), 'web');
			expect(out).toBe(body);
		});
	});

	it('returns body unchanged for empty body', async () => {
		const out = substituteTokens('', new Map(), 'web');
		expect(out).toBe('');
	});
});

describe('substituteTokens -- plain-text mode', () => {
	beforeEach(() => resetRegistry());
	afterEach(() => __corpus_resolver_internal__.resetToDefaults());

	it('emits substituted text + (URL)', async () => {
		registerCorpusResolver(mockResolver('regs', REGS_URLS));
		await withTestEntries(ALL_ENTRIES, async () => {
			const body = 'Per [@cite](airboss-ref:regs/cfr-14/91/103?at=2026).';
			const ids = extractIdentifiers(body);
			const resolved = await batchResolve(ids, { acknowledgments: [], historicalLens: false, body });
			const out = substituteTokens(body, resolved, 'plain-text');
			expect(out).toContain('§91.103 Preflight action');
			expect(out).toContain('(https://www.ecfr.gov/current/title-14/.../section-91.103)');
			expect(out).not.toContain('<a ');
		});
	});

	it('appends annotation parenthetical', async () => {
		const target = makeEntry({
			id: 'airboss-ref:interp/walker-2017' as SourceId,
			corpus: 'interp',
			canonical_short: 'Walker (2017)',
		});
		registerCorpusResolver(mockResolver('interp', {}));
		await withTestEntries({ [target.id]: target }, async () => {
			const body = '[Walker](airboss-ref:interp/walker-2017)';
			const ids = extractIdentifiers(body);
			const resolved = await batchResolve(ids, {
				acknowledgments: [{ target: target.id, historical: true }],
				historicalLens: false,
				body,
			});
			const out = substituteTokens(body, resolved, 'plain-text');
			expect(out).toContain('(historical reference)');
		});
	});
});

describe('substituteTokens -- print mode', () => {
	beforeEach(() => resetRegistry());
	afterEach(() => __corpus_resolver_internal__.resetToDefaults());

	it('emits sup-numbered footnote markers and trailing aside for non-adjacent refs', async () => {
		registerCorpusResolver(mockResolver('regs', REGS_URLS));
		await withTestEntries(ALL_ENTRIES, async () => {
			const body =
				'Per [@cite](airboss-ref:regs/cfr-14/91/103?at=2026), the PIC must check fuel under [@short](airboss-ref:regs/cfr-14/91/167?at=2026).';
			const ids = extractIdentifiers(body);
			const resolved = await batchResolve(ids, { acknowledgments: [], historicalLens: false, body });
			const out = substituteTokens(body, resolved, 'print');
			expect(out).toContain('<sup>1</sup>');
			expect(out).toContain('<sup>2</sup>');
			expect(out).toContain('<aside class="ab-ref-footnotes">');
			expect(out).toContain('section-91.103');
			expect(out).toContain('section-91.167');
		});
	});
});

describe('substituteTokens -- tts mode', () => {
	beforeEach(() => resetRegistry());
	afterEach(() => __corpus_resolver_internal__.resetToDefaults());

	it('emits substituted text without URL or anchor', async () => {
		registerCorpusResolver(mockResolver('regs', REGS_URLS));
		await withTestEntries(ALL_ENTRIES, async () => {
			const body = 'Per [@cite](airboss-ref:regs/cfr-14/91/103?at=2026), the PIC.';
			const ids = extractIdentifiers(body);
			const resolved = await batchResolve(ids, { acknowledgments: [], historicalLens: false, body });
			const out = substituteTokens(body, resolved, 'tts');
			expect(out).toContain('§91.103 Preflight action');
			expect(out).not.toContain('http');
			expect(out).not.toContain('<a ');
		});
	});

	it('substitutes @text token to indexed content', async () => {
		const indexed: IndexedContent = {
			id: E91_103.id,
			edition: '2026',
			normalizedText: '(a) Each PIC shall...',
		};
		registerCorpusResolver(mockResolver('regs', REGS_URLS, { [E91_103.id]: indexed }));
		await withTestEntries(ALL_ENTRIES, async () => {
			const body = '[@text](airboss-ref:regs/cfr-14/91/103?at=2026)';
			const ids = extractIdentifiers(body);
			const resolved = await batchResolve(ids, { acknowledgments: [], historicalLens: false, body });
			const out = substituteTokens(body, resolved, 'tts');
			expect(out).toContain('(a) Each PIC shall...');
		});
	});
});

describe('substituteTokens -- forward-compatible modes', () => {
	beforeEach(() => resetRegistry());
	afterEach(() => __corpus_resolver_internal__.resetToDefaults());

	it('rag mode includes machine-readable comment', async () => {
		registerCorpusResolver(mockResolver('regs', REGS_URLS));
		await withTestEntries(ALL_ENTRIES, async () => {
			const body = '[@formal](airboss-ref:regs/cfr-14/91/103?at=2026)';
			const ids = extractIdentifiers(body);
			const resolved = await batchResolve(ids, { acknowledgments: [], historicalLens: false, body });
			const out = substituteTokens(body, resolved, 'rag');
			expect(out).toContain('<!-- airboss-ref:regs/cfr-14/91/103?at=2026 -->');
			expect(out).toContain('14 CFR § 91.103');
			expect(out).toContain('https://');
		});
	});

	it('share-card truncates to 80 chars', async () => {
		registerCorpusResolver(mockResolver('regs', REGS_URLS));
		const long = makeEntry({
			id: 'airboss-ref:regs/cfr-14/91/103' as SourceId,
			canonical_short: '§91.103',
			canonical_title: 'A very long title that is clearly going to exceed eighty characters when combined with the section symbol',
		});
		await withTestEntries({ [long.id]: long }, async () => {
			const body = '[@cite](airboss-ref:regs/cfr-14/91/103?at=2026)';
			const ids = extractIdentifiers(body);
			const resolved = await batchResolve(ids, { acknowledgments: [], historicalLens: false, body });
			const out = substituteTokens(body, resolved, 'share-card');
			expect(out.length).toBeLessThanOrEqual(80);
			expect(out.endsWith('…')).toBe(true);
		});
	});

	it('screen-reader sets aria-label', async () => {
		registerCorpusResolver(mockResolver('regs', REGS_URLS));
		await withTestEntries(ALL_ENTRIES, async () => {
			const body = '[@cite](airboss-ref:regs/cfr-14/91/103?at=2026)';
			const ids = extractIdentifiers(body);
			const resolved = await batchResolve(ids, { acknowledgments: [], historicalLens: false, body });
			const out = substituteTokens(body, resolved, 'screen-reader');
			expect(out).toContain('aria-label=');
			expect(out).toContain('§91.103 Preflight action');
		});
	});

	it('tooltip truncates to 200 chars', async () => {
		registerCorpusResolver(mockResolver('regs', REGS_URLS));
		await withTestEntries(ALL_ENTRIES, async () => {
			const body = '[@cite](airboss-ref:regs/cfr-14/91/103?at=2026)';
			const ids = extractIdentifiers(body);
			const resolved = await batchResolve(ids, { acknowledgments: [], historicalLens: false, body });
			const out = substituteTokens(body, resolved, 'tooltip');
			expect(out.length).toBeLessThanOrEqual(200);
		});
	});

	it('rss emits anchor with absolute URL', async () => {
		registerCorpusResolver(mockResolver('regs', REGS_URLS));
		await withTestEntries(ALL_ENTRIES, async () => {
			const body = '[@cite](airboss-ref:regs/cfr-14/91/103?at=2026)';
			const ids = extractIdentifiers(body);
			const resolved = await batchResolve(ids, { acknowledgments: [], historicalLens: false, body });
			const out = substituteTokens(body, resolved, 'rss');
			expect(out).toContain('<a href=');
			expect(out).toContain('https://www.ecfr.gov');
		});
	});

	it('slack-unfurl returns title plus optional description', async () => {
		registerCorpusResolver(mockResolver('regs', REGS_URLS));
		await withTestEntries(ALL_ENTRIES, async () => {
			const body = '[@cite](airboss-ref:regs/cfr-14/91/103?at=2026)';
			const ids = extractIdentifiers(body);
			const resolved = await batchResolve(ids, { acknowledgments: [], historicalLens: false, body });
			const out = substituteTokens(body, resolved, 'slack-unfurl');
			expect(out).toContain('§91.103 Preflight action');
		});
	});

	it('transclusion emits anchor with transclusion class', async () => {
		registerCorpusResolver(mockResolver('regs', REGS_URLS));
		await withTestEntries(ALL_ENTRIES, async () => {
			const body = '[@cite](airboss-ref:regs/cfr-14/91/103?at=2026)';
			const ids = extractIdentifiers(body);
			const resolved = await batchResolve(ids, { acknowledgments: [], historicalLens: false, body });
			const out = substituteTokens(body, resolved, 'transclusion');
			expect(out).toContain('class="ab-ref ab-ref-transclusion"');
		});
	});
});
