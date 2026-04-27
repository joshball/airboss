/**
 * Test the SvelteKit server load helper end-to-end:
 * extract -> resolve -> serialize -> deserialize -> substitute.
 *
 * Uses `@ab/sources` test helpers to prime fixture entries; calls the helper;
 * deserializes the resulting payload and feeds it through `substituteTokens`
 * to verify the rendered HTML.
 */

import { fromSerializable, type SourceEntry, type SourceId, substituteTokens } from '@ab/sources';
import { type CorpusResolver, registerCorpusResolver } from '@ab/sources/registry';
import { resetRegistry, withTestEntries } from '@ab/sources/registry/__test_helpers__';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { loadLessonReferences } from './references.ts';

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

function mockResolver(corpus: string, urls: Record<string, string>): CorpusResolver {
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
		async getIndexedContent() {
			return null;
		},
	};
}

describe('loadLessonReferences', () => {
	beforeEach(() => resetRegistry());
	afterEach(() => resetRegistry());

	it('returns empty payload for empty body', async () => {
		const out = await loadLessonReferences('', []);
		expect(out.body).toBe('');
		expect(Object.keys(out.resolved)).toHaveLength(0);
		expect(out.mode).toBe('web');
	});

	it('resolves identifiers and serializes for transport', async () => {
		const e = makeEntry({ id: 'airboss-ref:regs/cfr-14/91/103' as SourceId });
		registerCorpusResolver(mockResolver('regs', {
			[e.id]: 'https://www.ecfr.gov/.../section-91.103',
		}));

		await withTestEntries({ [e.id]: e }, async () => {
			const body = 'Per [@cite](airboss-ref:regs/cfr-14/91/103?at=2026), the PIC...';
			const out = await loadLessonReferences(body, []);
			expect(out.body).toBe(body);
			expect(out.resolved['airboss-ref:regs/cfr-14/91/103?at=2026']).toBeDefined();
			// The resolved payload should be JSON-serializable.
			expect(() => JSON.parse(JSON.stringify(out.resolved))).not.toThrow();
		});
	});

	it('round-trips through substituteTokens to yield the expected HTML', async () => {
		const e = makeEntry({ id: 'airboss-ref:regs/cfr-14/91/103' as SourceId });
		registerCorpusResolver(mockResolver('regs', {
			[e.id]: 'https://www.ecfr.gov/.../section-91.103',
		}));

		await withTestEntries({ [e.id]: e }, async () => {
			const body = 'Per [@cite](airboss-ref:regs/cfr-14/91/103?at=2026), the PIC...';
			const out = await loadLessonReferences(body, []);
			const map = fromSerializable(out.resolved);
			const html = substituteTokens(out.body, map, out.mode);
			expect(html).toContain('§91.103 Preflight action');
			expect(html).toContain('<a href=');
			expect(html).not.toContain('@cite');
		});
	});

	it('honors mode override', async () => {
		const e = makeEntry({ id: 'airboss-ref:regs/cfr-14/91/103' as SourceId });
		registerCorpusResolver(mockResolver('regs', {
			[e.id]: 'https://www.ecfr.gov/.../section-91.103',
		}));

		await withTestEntries({ [e.id]: e }, async () => {
			const body = '[@cite](airboss-ref:regs/cfr-14/91/103?at=2026)';
			const out = await loadLessonReferences(body, [], { mode: 'plain-text' });
			expect(out.mode).toBe('plain-text');
			const map = fromSerializable(out.resolved);
			const text = substituteTokens(out.body, map, out.mode);
			expect(text).not.toContain('<a ');
			expect(text).toContain('§91.103 Preflight action');
			expect(text).toContain('https://');
		});
	});

	it('forwards acks into the cascade', async () => {
		const target = makeEntry({
			id: 'airboss-ref:interp/walker-2017' as SourceId,
			corpus: 'interp',
			canonical_short: 'Walker (2017)',
		});
		registerCorpusResolver(mockResolver('interp', {}));
		await withTestEntries({ [target.id]: target }, async () => {
			const body = '[Walker](airboss-ref:interp/walker-2017)';
			const out = await loadLessonReferences(body, [{ target: target.id, historical: true }]);
			const r = out.resolved['airboss-ref:interp/walker-2017'];
			expect(r?.annotation.kind).toBe('historical');
		});
	});

	it('forwards historicalLens flag', async () => {
		const e = makeEntry({ id: 'airboss-ref:regs/cfr-14/91/103' as SourceId });
		registerCorpusResolver(mockResolver('regs', {
			[e.id]: 'X',
		}));
		await withTestEntries({ [e.id]: e }, async () => {
			const body = '[@cite](airboss-ref:regs/cfr-14/91/103?at=2026)';
			const out = await loadLessonReferences(body, [], { historicalLens: true });
			const r = out.resolved['airboss-ref:regs/cfr-14/91/103?at=2026'];
			expect(r?.annotation.kind).toBe('historical');
		});
	});
});
