/**
 * Unit tests for the `:::cards` directive scanner + the shared
 * `parseCardsYaml` validator. Covers the card-question-tier WP
 * additions (`question_tier`, `source_authority`, `acs_codes`).
 *
 * Per-field error paths keep the historical `yaml-cards[<idx>].<field>`
 * prefix even though the surface fence is now `:::cards` -- the
 * messages are documented in the card-question-tier WP as the
 * authoring contract, and changing them would silently invalidate
 * every grep / runbook that references them.
 */

import { describe, expect, it } from 'vitest';
import { extractCardsFromBody } from './seed-cards-parser';

const REL_PATH = 'course/knowledge/test/node.md';

function wrap(yaml: string): string {
	return ['## Practice', '', ':::cards', yaml.replace(/\n$/, ''), ':::', ''].join('\n');
}

describe('extractCardsFromBody (baseline)', () => {
	it('parses a minimal recall card', () => {
		const body = wrap('- front: "q?"\n  back: "a."\n  cardType: basic\n');
		const cards = extractCardsFromBody(body, REL_PATH);
		expect(cards).toHaveLength(1);
		expect(cards[0]).toMatchObject({
			front: 'q?',
			back: 'a.',
			cardType: 'basic',
			kind: 'recall',
			tags: [],
			questionTier: null,
			sourceAuthority: null,
			acsCodes: null,
		});
	});

	it('reads the optional kind override', () => {
		const body = wrap('- front: "q?"\n  back: "a."\n  cardType: basic\n  kind: calculation\n');
		const cards = extractCardsFromBody(body, REL_PATH);
		expect(cards[0].kind).toBe('calculation');
	});

	it('aggregates cards across multiple :::cards blocks in document order', () => {
		const body = [
			'## Practice',
			'',
			':::cards',
			'- front: "first?"',
			'  back: "1"',
			'  cardType: basic',
			':::',
			'',
			'Some prose between blocks.',
			'',
			':::cards',
			'- front: "second?"',
			'  back: "2"',
			'  cardType: basic',
			':::',
			'',
		].join('\n');
		const cards = extractCardsFromBody(body, REL_PATH);
		expect(cards.map((c) => c.front)).toEqual(['first?', 'second?']);
	});

	it('throws when a :::cards directive is unclosed', () => {
		const body = ['## Practice', '', ':::cards', '- front: "q?"', '  back: "a."', '  cardType: basic'].join('\n');
		expect(() => extractCardsFromBody(body, REL_PATH)).toThrow(/unclosed ':::cards' directive/);
	});
});

describe('extractCardsFromBody / question_tier', () => {
	it('defaults question_tier to null when omitted', () => {
		const body = wrap('- front: "q?"\n  back: "a."\n  cardType: basic\n');
		expect(extractCardsFromBody(body, REL_PATH)[0].questionTier).toBeNull();
	});

	it('accepts faa-written / cfi-essential / both', () => {
		for (const tier of ['faa-written', 'cfi-essential', 'both'] as const) {
			const body = wrap(`- front: "q?"\n  back: "a."\n  cardType: basic\n  question_tier: ${tier}\n`);
			expect(extractCardsFromBody(body, REL_PATH)[0].questionTier).toBe(tier);
		}
	});

	it('rejects an unknown question_tier with a per-field path', () => {
		const body = wrap('- front: "q?"\n  back: "a."\n  cardType: basic\n  question_tier: bogus\n');
		expect(() => extractCardsFromBody(body, REL_PATH)).toThrow(/yaml-cards\[0\]\.question_tier 'bogus'/);
	});

	it('rejects a numeric question_tier (must be a string)', () => {
		const body = wrap('- front: "q?"\n  back: "a."\n  cardType: basic\n  question_tier: 42\n');
		expect(() => extractCardsFromBody(body, REL_PATH)).toThrow(/yaml-cards\[0\]\.question_tier '42'/);
	});
});

describe('extractCardsFromBody / source_authority', () => {
	it('defaults to null when omitted', () => {
		const body = wrap('- front: "q?"\n  back: "a."\n  cardType: basic\n');
		expect(extractCardsFromBody(body, REL_PATH)[0].sourceAuthority).toBeNull();
	});

	it('parses a single-entry array', () => {
		const body = wrap(
			[
				'- front: "q?"',
				'  back: "a."',
				'  cardType: basic',
				'  source_authority:',
				'    - kind: cfr',
				'      cite: 14 CFR 91.155',
				'',
			].join('\n'),
		);
		expect(extractCardsFromBody(body, REL_PATH)[0].sourceAuthority).toEqual([{ kind: 'cfr', cite: '14 CFR 91.155' }]);
	});

	it('parses a multi-entry array (PHAK + AC)', () => {
		const body = wrap(
			[
				'- front: "q?"',
				'  back: "a."',
				'  cardType: basic',
				'  source_authority:',
				'    - kind: phak',
				'      cite: PHAK Ch 11',
				'    - kind: ac',
				'      cite: AC 00-45H',
				'',
			].join('\n'),
		);
		const sa = extractCardsFromBody(body, REL_PATH)[0].sourceAuthority;
		expect(sa).toEqual([
			{ kind: 'phak', cite: 'PHAK Ch 11' },
			{ kind: 'ac', cite: 'AC 00-45H' },
		]);
	});

	it('trims whitespace on cite values', () => {
		const body = wrap(
			[
				'- front: "q?"',
				'  back: "a."',
				'  cardType: basic',
				'  source_authority:',
				'    - kind: aim',
				'      cite: "  AIM 7-1-21  "',
				'',
			].join('\n'),
		);
		expect(extractCardsFromBody(body, REL_PATH)[0].sourceAuthority).toEqual([{ kind: 'aim', cite: 'AIM 7-1-21' }]);
	});

	it('rejects an unknown source_authority kind with a per-field path', () => {
		const body = wrap(
			[
				'- front: "q?"',
				'  back: "a."',
				'  cardType: basic',
				'  source_authority:',
				'    - kind: noaa',
				'      cite: x',
				'',
			].join('\n'),
		);
		expect(() => extractCardsFromBody(body, REL_PATH)).toThrow(
			/yaml-cards\[0\]\.source_authority\[0\]\.kind 'noaa' is not in SOURCE_AUTHORITY_KIND_VALUES/,
		);
	});

	it('rejects an empty cite string with a per-field path', () => {
		const body = wrap(
			[
				'- front: "q?"',
				'  back: "a."',
				'  cardType: basic',
				'  source_authority:',
				'    - kind: phak',
				'      cite: ""',
				'',
			].join('\n'),
		);
		expect(() => extractCardsFromBody(body, REL_PATH)).toThrow(
			/yaml-cards\[0\]\.source_authority\[0\]\.cite must be a non-empty string/,
		);
	});

	it('rejects a non-array source_authority value', () => {
		const body = wrap(
			['- front: "q?"', '  back: "a."', '  cardType: basic', '  source_authority: "PHAK Ch 11"', ''].join('\n'),
		);
		expect(() => extractCardsFromBody(body, REL_PATH)).toThrow(
			/yaml-cards\[0\]\.source_authority must be an array of \{kind, cite\} objects/,
		);
	});

	it('rejects more than 10 entries (SOURCE_AUTHORITY_MAX_PER_CARD)', () => {
		const eleven = Array.from({ length: 11 }, () => '    - kind: phak\n      cite: PHAK Ch 11').join('\n');
		const body = wrap(
			['- front: "q?"', '  back: "a."', '  cardType: basic', '  source_authority:', eleven, ''].join('\n'),
		);
		expect(() => extractCardsFromBody(body, REL_PATH)).toThrow(/source_authority has 11 entries; maximum is 10/);
	});
});

describe('extractCardsFromBody / acs_codes', () => {
	it('defaults to null when omitted', () => {
		const body = wrap('- front: "q?"\n  back: "a."\n  cardType: basic\n');
		expect(extractCardsFromBody(body, REL_PATH)[0].acsCodes).toBeNull();
	});

	it('accepts an array of canonical ACS codes', () => {
		const body = wrap(
			[
				'- front: "q?"',
				'  back: "a."',
				'  cardType: basic',
				'  acs_codes: [PA.I.C.K2a, IR.II.A.K2c, CA.III.B.S1]',
				'',
			].join('\n'),
		);
		expect(extractCardsFromBody(body, REL_PATH)[0].acsCodes).toEqual(['PA.I.C.K2a', 'IR.II.A.K2c', 'CA.III.B.S1']);
	});

	it('rejects a malformed ACS code with a per-field path', () => {
		const body = wrap(
			['- front: "q?"', '  back: "a."', '  cardType: basic', '  acs_codes: ["lowercase.bad"]', ''].join('\n'),
		);
		expect(() => extractCardsFromBody(body, REL_PATH)).toThrow(
			/yaml-cards\[0\]\.acs_codes\[0\] 'lowercase\.bad' does not match ACS_CODE_PATTERN/,
		);
	});

	it('rejects a non-string ACS code', () => {
		const body = wrap(['- front: "q?"', '  back: "a."', '  cardType: basic', '  acs_codes: [42]', ''].join('\n'));
		expect(() => extractCardsFromBody(body, REL_PATH)).toThrow(/yaml-cards\[0\]\.acs_codes\[0\] must be a string/);
	});

	it('rejects a non-array acs_codes value', () => {
		const body = wrap(['- front: "q?"', '  back: "a."', '  cardType: basic', '  acs_codes: PA.I.C.K2a', ''].join('\n'));
		expect(() => extractCardsFromBody(body, REL_PATH)).toThrow(
			/yaml-cards\[0\]\.acs_codes must be an array of code strings/,
		);
	});

	it('rejects more than 20 codes (ACS_CODES_MAX_PER_CARD)', () => {
		const codes = Array.from({ length: 21 }, () => 'PA.I.C.K2a').join(', ');
		const body = wrap(['- front: "q?"', '  back: "a."', '  cardType: basic', `  acs_codes: [${codes}]`, ''].join('\n'));
		expect(() => extractCardsFromBody(body, REL_PATH)).toThrow(/acs_codes has 21 entries; maximum is 20/);
	});
});

describe('extractCardsFromBody / all-three-together', () => {
	it('round-trips question_tier + source_authority + acs_codes on one card', () => {
		const body = wrap(
			[
				'- front: "VFR cloud clearance in Class B?"',
				'  back: "Clear of clouds."',
				'  cardType: basic',
				'  question_tier: faa-written',
				'  source_authority:',
				'    - kind: cfr',
				'      cite: 14 CFR 91.155',
				'  acs_codes: [PA.I.C.K1]',
				'  tags: [weather, vfr-mins]',
				'',
			].join('\n'),
		);
		expect(extractCardsFromBody(body, REL_PATH)[0]).toMatchObject({
			front: 'VFR cloud clearance in Class B?',
			back: 'Clear of clouds.',
			cardType: 'basic',
			kind: 'recall',
			tags: ['weather', 'vfr-mins'],
			questionTier: 'faa-written',
			sourceAuthority: [{ kind: 'cfr', cite: '14 CFR 91.155' }],
			acsCodes: ['PA.I.C.K1'],
		});
	});
});
