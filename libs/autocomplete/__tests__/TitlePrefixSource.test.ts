/**
 * `TitlePrefixSource` -- min-length threshold + entry shape (R14).
 *
 * Phase 3.5 / slice 3.5g. Walks the live aviation registry; ranks
 * title-prefix matches before alias-prefix matches.
 */

import { TITLE_PREFIX_MIN_NEEDLE_LENGTH } from '@ab/constants';
import { describe, expect, it } from 'vitest';
import { TitlePrefixSource } from '../src/TitlePrefixSource';

describe('TitlePrefixSource -- min length threshold', () => {
	it('defers (returns null) for needles shorter than the threshold', () => {
		expect(TITLE_PREFIX_MIN_NEEDLE_LENGTH).toBeGreaterThanOrEqual(3);
		// "wx" (2 chars) is a synonym, not a title prefix; source must NOT fire.
		expect(TitlePrefixSource.match('wx')).toBeNull();
		// 3-char alias / abbrev should also defer below the threshold.
		expect(TitlePrefixSource.match('avs')).toBeNull();
	});

	it('returns null for empty / whitespace input', () => {
		expect(TitlePrefixSource.match('')).toBeNull();
		expect(TitlePrefixSource.match('    ')).toBeNull();
	});

	it('returns null when no title prefix matches', () => {
		expect(TitlePrefixSource.match('zzzzzzzz')).toBeNull();
	});
});

describe('TitlePrefixSource -- title prefix matching', () => {
	it('matches the Aviation Weather Handbook on a 4+ char title prefix', () => {
		const matches = TitlePrefixSource.match('Aviation');
		expect(matches).not.toBeNull();
		expect((matches ?? []).length).toBeGreaterThan(0);
		const titles = (matches ?? []).map((e) => e.display);
		const hasAviationWx = titles.some((t) => t.toLowerCase().startsWith('aviation weather'));
		expect(hasAviationWx).toBe(true);
	});
});

describe('TitlePrefixSource -- entry shape (R14)', () => {
	it('canonicalForm is the title (not the code)', () => {
		const matches = TitlePrefixSource.match('Aviation Weather');
		expect(matches).not.toBeNull();
		const target = (matches ?? []).find((e) => e.display.toLowerCase().startsWith('aviation weather'));
		expect(target?.canonicalForm).toMatch(/^Aviation Weather/i);
	});

	it('secondary slot carries the doc code (R14: doc IDs always visible)', () => {
		const matches = TitlePrefixSource.match('Aviation Weather');
		expect(matches).not.toBeNull();
		const target = (matches ?? []).find((e) => e.display.toLowerCase().startsWith('aviation weather'));
		// The AvWX entry has FAA-H-8083-28* among its aliases.
		expect(target?.secondary ?? '').toMatch(/FAA-H-8083-28/);
	});

	it('stamps sourceId for host filtering', () => {
		const matches = TitlePrefixSource.match('Aviation');
		const first = (matches ?? [])[0];
		expect(first?.sourceId).toBe('title-prefix');
	});
});
