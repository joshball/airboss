import { describe, expect, it } from 'vitest';
import {
	canonicalDeckSpecJson,
	computeDeckHash,
	DeckSpecDecodeError,
	decodeDeckSpec,
	encodeDeckSpec,
} from './deck-spec';
import type { ReviewSessionDeckSpec } from './schema';

// Tests use unknown-cast to push fields the schema interface doesn't
// declare yet (tags, extra dimensions). Layer (b) Redo specifies those
// dimensions land on the canonical form before the interface gets widened
// in subsequent layers, so the canonicaliser already handles them.
type TestSpec = ReviewSessionDeckSpec & {
	tags?: readonly string[];
	cardType?: readonly string[];
	dueOnly?: boolean;
};

describe('deck-spec', () => {
	describe('computeDeckHash', () => {
		it('is deterministic across input key insertion order', () => {
			const a: TestSpec = { domain: 'airspace', dueOnly: true, tags: ['vfr'] } as TestSpec;
			const b: TestSpec = { tags: ['vfr'], dueOnly: true, domain: 'airspace' } as TestSpec;
			expect(computeDeckHash(a)).toBe(computeDeckHash(b));
		});

		it('is deterministic across unordered-array input order (tags)', () => {
			const a: TestSpec = { domain: null, tags: ['weather', 'airspace', 'reg'] } as TestSpec;
			const b: TestSpec = { domain: null, tags: ['airspace', 'reg', 'weather'] } as TestSpec;
			expect(computeDeckHash(a)).toBe(computeDeckHash(b));
		});

		it('is sensitive to semantic differences', () => {
			const a: TestSpec = { domain: 'airspace' };
			const b: TestSpec = { domain: 'weather' };
			expect(computeDeckHash(a)).not.toBe(computeDeckHash(b));
		});

		it('returns an 8-char lowercase hex string', () => {
			const hash = computeDeckHash({ domain: 'airspace' });
			expect(hash).toMatch(/^[0-9a-f]{8}$/);
		});

		it('treats explicit undefined and missing keys identically', () => {
			const a: TestSpec = { domain: 'airspace' };
			const b: TestSpec = { domain: 'airspace', dueOnly: undefined } as TestSpec;
			expect(computeDeckHash(a)).toBe(computeDeckHash(b));
		});

		it('treats empty-string domain and null domain as the same deck', () => {
			// The schema uses `null` as the "all domains" sentinel; an empty
			// string from a stale URL or hand-edited query MUST collapse to
			// the same hash so Saved-Decks does not split into two entries.
			const a: TestSpec = { domain: null };
			const b: TestSpec = { domain: '' as unknown as string | null };
			expect(computeDeckHash(a)).toBe(computeDeckHash(b));
		});
	});

	describe('encodeDeckSpec / decodeDeckSpec', () => {
		it('round-trips a simple spec', () => {
			const spec: TestSpec = { domain: 'airspace' };
			const encoded = encodeDeckSpec(spec);
			expect(decodeDeckSpec(encoded)).toEqual(spec);
		});

		it('round-trips a multi-field spec', () => {
			const spec: TestSpec = {
				domain: 'weather',
				dueOnly: true,
				tags: ['ifr', 'metar'],
				cardType: ['basic'],
			} as TestSpec;
			const encoded = encodeDeckSpec(spec);
			const decoded = decodeDeckSpec(encoded) as TestSpec;
			// `tags` order is canonicalised on encode; the decoded value mirrors
			// canonical (alphabetical) order.
			expect(decoded.domain).toBe('weather');
			expect(decoded.dueOnly).toBe(true);
			expect(decoded.cardType).toEqual(['basic']);
			expect([...(decoded.tags ?? [])]).toEqual(['ifr', 'metar']);
		});

		it('produces a URL-safe value with no padding', () => {
			const encoded = encodeDeckSpec({ domain: 'airspace' });
			expect(encoded).toMatch(/^[A-Za-z0-9_-]+$/);
			expect(encoded).not.toContain('=');
		});

		it('throws DeckSpecDecodeError on empty input', () => {
			expect(() => decodeDeckSpec('')).toThrow(DeckSpecDecodeError);
		});

		it('throws DeckSpecDecodeError on malformed JSON', () => {
			const notJson = Buffer.from('this is not json', 'utf8').toString('base64url');
			expect(() => decodeDeckSpec(notJson)).toThrow(DeckSpecDecodeError);
		});

		it('throws DeckSpecDecodeError when the decoded value is not an object', () => {
			const notObject = Buffer.from(JSON.stringify(['a', 'b']), 'utf8').toString('base64url');
			expect(() => decodeDeckSpec(notObject)).toThrow(DeckSpecDecodeError);
		});

		it('throws DeckSpecDecodeError when the decoded value is null', () => {
			const nullJson = Buffer.from('null', 'utf8').toString('base64url');
			expect(() => decodeDeckSpec(nullJson)).toThrow(DeckSpecDecodeError);
		});
	});

	describe('canonicalDeckSpecJson', () => {
		it('emits keys in alphabetical order', () => {
			const json = canonicalDeckSpecJson({ domain: 'airspace', dueOnly: true } as TestSpec);
			// `domain` precedes `dueOnly` lexicographically.
			expect(json).toBe('{"domain":"airspace","dueOnly":true}');
		});

		it('drops undefined fields', () => {
			const json = canonicalDeckSpecJson({ domain: 'airspace', dueOnly: undefined } as TestSpec);
			expect(json).toBe('{"domain":"airspace"}');
		});

		it('sorts tags alphabetically', () => {
			const json = canonicalDeckSpecJson({ domain: null, tags: ['z', 'a', 'm'] } as TestSpec);
			expect(json).toBe('{"domain":null,"tags":["a","m","z"]}');
		});

		it('preserves the order of arrays whose ordering is semantic', () => {
			// `cardType` is declared as a set in the spec but the encoder treats
			// non-`tags` arrays as ordered. If a future dimension needs sorting
			// it should opt in explicitly; this test pins the current contract.
			const json = canonicalDeckSpecJson({ domain: null, cardType: ['basic', 'cloze'] } as TestSpec);
			expect(json).toBe('{"cardType":["basic","cloze"],"domain":null}');
		});
	});
});
