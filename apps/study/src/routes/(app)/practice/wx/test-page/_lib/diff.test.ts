/**
 * Unit tests for the compare-against-expected METAR diff helper.
 */

import { describe, expect, it } from 'vitest';
import { diffIsClean, diffMetarTokens, metarTokens } from './diff';

describe('metarTokens', () => {
	it('splits on whitespace and drops empties', () => {
		expect(metarTokens('  KTST 191953Z  20012KT 10SM ')).toEqual(['KTST', '191953Z', '20012KT', '10SM']);
	});
});

describe('diffMetarTokens', () => {
	it('marks every row a match for identical strings', () => {
		const rows = diffMetarTokens('KTST 191953Z 20012KT', 'KTST 191953Z 20012KT');
		expect(rows.every((r) => r.match)).toBe(true);
		expect(diffIsClean(rows)).toBe(true);
	});

	it('flags the token that differs', () => {
		const rows = diffMetarTokens('KTST 191953Z 20012KT', 'KTST 191953Z 20018KT');
		expect(rows[2]).toMatchObject({ actual: '20012KT', expected: '20018KT', match: false });
		expect(diffIsClean(rows)).toBe(false);
	});

	it('pads with nulls when the actual has extra tokens', () => {
		const rows = diffMetarTokens('KTST 191953Z 20012KT 10SM', 'KTST 191953Z 20012KT');
		expect(rows[3]).toMatchObject({ actual: '10SM', expected: null, match: false });
	});

	it('pads with nulls when the expected has extra tokens', () => {
		const rows = diffMetarTokens('KTST 191953Z', 'KTST 191953Z 20012KT');
		expect(rows[2]).toMatchObject({ actual: null, expected: '20012KT', match: false });
	});

	it('treats an empty expected string as a non-clean diff', () => {
		expect(diffIsClean(diffMetarTokens('KTST 191953Z', ''))).toBe(false);
	});
});
