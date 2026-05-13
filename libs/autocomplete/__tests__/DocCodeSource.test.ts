/**
 * `DocCodeSource` -- trigger detection + entry shape.
 *
 * Phase 3.5 / slice 3.5g: the source replaces the Phase 3 in-component
 * `detectDocCodeIntent` wiring and routes through the aviation registry
 * (seeded by PR #817).
 */

import { describe, expect, it } from 'vitest';
import { DocCodeSource } from '../src/DocCodeSource';

describe('DocCodeSource -- trigger detection', () => {
	it('returns null for empty input', () => {
		expect(DocCodeSource.match('')).toBeNull();
		expect(DocCodeSource.match('   ')).toBeNull();
	});

	it('returns null for plain non-doc-code text', () => {
		expect(DocCodeSource.match('weather')).toBeNull();
		expect(DocCodeSource.match('something fuzzy')).toBeNull();
	});

	it('fires on FAA-H- partial fragment', () => {
		const matches = DocCodeSource.match('FAA-H-');
		expect(matches).not.toBeNull();
		expect(matches?.length).toBeGreaterThan(0);
	});

	it('fires on "Part 91" trigger', () => {
		const matches = DocCodeSource.match('Part 91');
		expect(matches).not.toBeNull();
		expect(matches?.length).toBeGreaterThan(0);
	});

	it('fires on a known handbook abbreviation (AvWX)', () => {
		const matches = DocCodeSource.match('AvWX');
		expect(matches).not.toBeNull();
		expect(matches?.length).toBeGreaterThan(0);
	});
});

describe('DocCodeSource -- entry shape (R14: doc IDs always visible)', () => {
	it('carries the canonical doc code in `secondary`', () => {
		const matches = DocCodeSource.match('FAA-H-808');
		expect(matches).not.toBeNull();
		const first = matches?.[0];
		expect(first?.secondary).toMatch(/^FAA-[HSP]-/);
	});

	it('puts the document title in `display`', () => {
		const matches = DocCodeSource.match('FAA-H-808');
		expect(matches).not.toBeNull();
		const first = matches?.[0];
		// Display is the displayName from the registry; should be a real title.
		expect((first?.display ?? '').length).toBeGreaterThan(3);
		expect(first?.display ?? '').not.toMatch(/^FAA-[HSP]-/);
	});

	it('canonicalForm commits the doc code, not the title', () => {
		const matches = DocCodeSource.match('FAA-H-808');
		expect(matches).not.toBeNull();
		const first = matches?.[0];
		expect(first?.canonicalForm).toMatch(/^FAA-[HSP]-/);
	});

	it('stamps sourceId so hosts can filter by provider', () => {
		const matches = DocCodeSource.match('FAA-H-');
		const first = matches?.[0];
		expect(first?.sourceId).toBe('doc-code');
	});

	it('numeric-prefix sorts the family list (808 -> 8083-2 before 8083-15)', () => {
		const matches = DocCodeSource.match('FAA-H-808');
		expect(matches).not.toBeNull();
		// Pull just the codes; numbers in them should be in ascending order
		// across the first two-digit / three-digit slot.
		const codes = (matches ?? []).map((e) => e.secondary ?? '');
		// Spot-check: 8083-2 / 8083-3 appear before 8083-15 / 8083-25 in
		// numeric order.
		const idxFor = (suffix: string): number => codes.findIndex((c) => c.endsWith(suffix));
		const i2 = idxFor('8083-2A');
		const i15 = idxFor('8083-15B');
		// Both should be present; numeric sort puts 2 < 15.
		if (i2 !== -1 && i15 !== -1) {
			expect(i2).toBeLessThan(i15);
		}
	});
});
