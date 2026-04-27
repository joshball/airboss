import { describe, expect, it } from 'vitest';
import type { ResolvedIdentifier, SourceEntry, SourceId } from '../types.ts';
import { fromSerializable, toSerializable } from './serialize.ts';

function makeEntry(): SourceEntry {
	return {
		id: 'airboss-ref:regs/cfr-14/91/103' as SourceId,
		corpus: 'regs',
		canonical_short: '§91.103',
		canonical_formal: '14 CFR § 91.103',
		canonical_title: 'Preflight action',
		last_amended_date: new Date('2009-08-21T00:00:00.000Z'),
		lifecycle: 'accepted',
	};
}

function makeResolved(): ResolvedIdentifier {
	const entry = makeEntry();
	return {
		raw: 'airboss-ref:regs/cfr-14/91/103?at=2026',
		parsed: {
			raw: 'airboss-ref:regs/cfr-14/91/103?at=2026',
			corpus: 'regs',
			locator: 'cfr-14/91/103',
			pin: '2026',
		},
		entry,
		chain: [entry],
		liveUrl: 'https://www.ecfr.gov/.../section-91.103',
		indexed: { id: entry.id, edition: '2026', normalizedText: 'BODY' },
		annotation: { kind: 'covered', text: '(acknowledged ...)', note: 'narrows' },
	};
}

describe('toSerializable / fromSerializable', () => {
	it('round-trips an empty map', () => {
		const out = fromSerializable(toSerializable(new Map()));
		expect(out.size).toBe(0);
	});

	it('round-trips a single entry preserving every field', () => {
		const r = makeResolved();
		const map = new Map([[r.raw, r]]);
		const restored = fromSerializable(toSerializable(map));
		const back = restored.get(r.raw);
		expect(back).toBeDefined();
		if (back === undefined) return;
		expect(back.raw).toBe(r.raw);
		expect(back.parsed).toEqual(r.parsed);
		expect(back.entry?.id).toBe(r.entry?.id);
		expect(back.entry?.last_amended_date.getTime()).toBe(r.entry?.last_amended_date.getTime());
		expect(back.liveUrl).toBe(r.liveUrl);
		expect(back.indexed).toEqual(r.indexed);
		expect(back.annotation).toEqual(r.annotation);
	});

	it('round-trips chain length', () => {
		const e1 = makeEntry();
		const e2 = { ...makeEntry(), id: 'airboss-ref:regs/cfr-14/91/107' as SourceId };
		const r: ResolvedIdentifier = {
			...makeResolved(),
			chain: [e1, e2],
		};
		const map = new Map([[r.raw, r]]);
		const restored = fromSerializable(toSerializable(map));
		expect(restored.get(r.raw)?.chain.length).toBe(2);
	});

	it('round-trips null entry', () => {
		const r: ResolvedIdentifier = {
			raw: 'airboss-ref:regs/cfr-14/91/missing?at=2026',
			parsed: {
				raw: 'airboss-ref:regs/cfr-14/91/missing?at=2026',
				corpus: 'regs',
				locator: 'cfr-14/91/missing',
				pin: '2026',
			},
			entry: null,
			chain: [],
			liveUrl: null,
			indexed: null,
			annotation: { kind: 'none', text: '' },
		};
		const map = new Map([[r.raw, r]]);
		const restored = fromSerializable(toSerializable(map));
		expect(restored.get(r.raw)?.entry).toBeNull();
		expect(restored.get(r.raw)?.chain).toEqual([]);
	});

	it('preserves date precision', () => {
		const r = makeResolved();
		const map = new Map([[r.raw, r]]);
		const restored = fromSerializable(toSerializable(map));
		expect(restored.get(r.raw)?.entry?.last_amended_date.toISOString()).toBe('2009-08-21T00:00:00.000Z');
	});
});
