/**
 * Tests for the source-kind classifier (wp-hangar-non-textual).
 */

import { describe, expect, it } from 'vitest';
import { REFERENCE_SOURCE_TYPES, SOURCE_TYPE_VALUES } from './reference-tags';
import { SECTIONAL_THUMBNAIL, SOURCE_KIND_BY_TYPE, SOURCE_KINDS } from './sources';

describe('SOURCE_KINDS', () => {
	it('exposes the two known kinds', () => {
		expect(SOURCE_KINDS.TEXT).toBe('text');
		expect(SOURCE_KINDS.BINARY_VISUAL).toBe('binary-visual');
	});
});

describe('SOURCE_KIND_BY_TYPE', () => {
	it('covers every registered source type', () => {
		for (const type of SOURCE_TYPE_VALUES) {
			expect(SOURCE_KIND_BY_TYPE[type]).toBeDefined();
		}
	});

	it('classifies sectional as binary-visual', () => {
		expect(SOURCE_KIND_BY_TYPE[REFERENCE_SOURCE_TYPES.SECTIONAL]).toBe(SOURCE_KINDS.BINARY_VISUAL);
	});

	it('classifies CFR/AIM/PHAK as text', () => {
		expect(SOURCE_KIND_BY_TYPE[REFERENCE_SOURCE_TYPES.CFR]).toBe(SOURCE_KINDS.TEXT);
		expect(SOURCE_KIND_BY_TYPE[REFERENCE_SOURCE_TYPES.AIM]).toBe(SOURCE_KINDS.TEXT);
		expect(SOURCE_KIND_BY_TYPE[REFERENCE_SOURCE_TYPES.PHAK]).toBe(SOURCE_KINDS.TEXT);
	});

	it('has exactly one binary-visual entry until a new kind is added', () => {
		const binaryVisualTypes = SOURCE_TYPE_VALUES.filter((t) => SOURCE_KIND_BY_TYPE[t] === SOURCE_KINDS.BINARY_VISUAL);
		// When plates / airport diagrams land, this count grows; the test is a
		// reminder to extend SOURCE_KIND_BY_TYPE explicitly rather than leaving
		// a new type defaulting to text.
		expect(binaryVisualTypes).toEqual([REFERENCE_SOURCE_TYPES.SECTIONAL]);
	});
});

describe('SECTIONAL_THUMBNAIL budget', () => {
	it('caps quality between MIN_QUALITY and QUALITY', () => {
		expect(SECTIONAL_THUMBNAIL.MIN_QUALITY).toBeLessThan(SECTIONAL_THUMBNAIL.QUALITY);
		expect(SECTIONAL_THUMBNAIL.QUALITY).toBeLessThanOrEqual(100);
		expect(SECTIONAL_THUMBNAIL.MIN_QUALITY).toBeGreaterThan(0);
	});

	it('caps output at 256 KiB', () => {
		expect(SECTIONAL_THUMBNAIL.MAX_BYTES).toBe(256 * 1024);
	});
});
