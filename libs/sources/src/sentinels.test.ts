import { describe, expect, test } from 'vitest';
import {
	compareSentinel,
	isKnownStructuredCitationField,
	isSentinelField,
	isWellKnownCitationField,
	SENTINEL_FIELDS,
	validateRedirectedFrom,
	validateSentinelFieldName,
	WELL_KNOWN_CITATION_FIELDS,
} from './sentinels.ts';

describe('SENTINEL_FIELDS canonical vocabulary (amendment 2026-05 D1)', () => {
	test('S-01: contains exactly the four canonical names', () => {
		expect([...SENTINEL_FIELDS]).toEqual(['chapter_title', 'section_title', 'paragraph_text', 'page_heading']);
	});
});

describe('isSentinelField', () => {
	test('S-02: accepts canonical names', () => {
		expect(isSentinelField('chapter_title')).toBe(true);
		expect(isSentinelField('section_title')).toBe(true);
		expect(isSentinelField('paragraph_text')).toBe(true);
		expect(isSentinelField('page_heading')).toBe(true);
	});

	test('S-03: rejects typos and unknown names', () => {
		expect(isSentinelField('chapter-title')).toBe(false);
		expect(isSentinelField('chapterTitle')).toBe(false);
		expect(isSentinelField('expect.chapter_title')).toBe(false);
		expect(isSentinelField('')).toBe(false);
	});
});

describe('validateSentinelFieldName', () => {
	test('S-04: returns ok for canonical names', () => {
		const result = validateSentinelFieldName('chapter_title');
		expect(result.kind).toBe('ok');
		if (result.kind !== 'ok') return;
		expect(result.field).toBe('chapter_title');
	});

	test('S-05: returns unknown-field ERROR for typos with the canonical list in the message', () => {
		const result = validateSentinelFieldName('chapterTitle');
		expect(result.kind).toBe('unknown-field');
		if (result.kind !== 'unknown-field') return;
		expect(result.received).toBe('chapterTitle');
		expect(result.message).toMatch(/unknown sentinel field "chapterTitle"/);
		expect(result.message).toMatch(/chapter_title/);
		expect(result.message).toMatch(/section_title/);
		expect(result.message).toMatch(/paragraph_text/);
		expect(result.message).toMatch(/page_heading/);
	});
});

describe('WELL_KNOWN_CITATION_FIELDS canonical vocabulary (amendment 2026-05 well-known fields)', () => {
	test('W-01: contains exactly redirected_from for v1', () => {
		expect([...WELL_KNOWN_CITATION_FIELDS]).toEqual(['redirected_from']);
	});
});

describe('isWellKnownCitationField', () => {
	test('W-02: accepts canonical well-known names', () => {
		expect(isWellKnownCitationField('redirected_from')).toBe(true);
	});

	test('W-03: rejects sentinel names (separate vocabularies)', () => {
		expect(isWellKnownCitationField('chapter_title')).toBe(false);
		expect(isWellKnownCitationField('section_title')).toBe(false);
	});

	test('W-04: rejects typos and unknown names', () => {
		expect(isWellKnownCitationField('redirectedFrom')).toBe(false);
		expect(isWellKnownCitationField('redirected-from')).toBe(false);
		expect(isWellKnownCitationField('')).toBe(false);
	});
});

describe('isKnownStructuredCitationField', () => {
	test('W-05: accepts both sentinel and well-known names', () => {
		expect(isKnownStructuredCitationField('chapter_title')).toBe(true);
		expect(isKnownStructuredCitationField('redirected_from')).toBe(true);
	});

	test('W-06: rejects unknown names', () => {
		expect(isKnownStructuredCitationField('chapterTitle')).toBe(false);
		expect(isKnownStructuredCitationField('redirectedFrom')).toBe(false);
		expect(isKnownStructuredCitationField('arbitrary_extension')).toBe(false);
	});
});

describe('validateSentinelFieldName -- well-known fields', () => {
	test('W-07: returns ok-well-known for redirected_from', () => {
		const result = validateSentinelFieldName('redirected_from');
		expect(result.kind).toBe('ok-well-known');
		if (result.kind !== 'ok-well-known') return;
		expect(result.field).toBe('redirected_from');
	});

	test('W-08: unknown-field message lists both sentinel and well-known names', () => {
		const result = validateSentinelFieldName('chapterTitle');
		expect(result.kind).toBe('unknown-field');
		if (result.kind !== 'unknown-field') return;
		expect(result.message).toMatch(/chapter_title/);
		expect(result.message).toMatch(/redirected_from/);
	});
});

describe('validateRedirectedFrom', () => {
	test('W-09: accepts a parseable airboss-ref URI', () => {
		const result = validateRedirectedFrom('airboss-ref:handbooks/afh/FAA-H-8083-3B/4');
		expect(result.ok).toBe(true);
		if (!result.ok) return;
		expect(result.value).toBe('airboss-ref:handbooks/afh/FAA-H-8083-3B/4');
	});

	test('W-10: accepts a doc-only airboss-ref URI (retired-edition case)', () => {
		const result = validateRedirectedFrom('airboss-ref:handbooks/afh/FAA-H-8083-3B');
		expect(result.ok).toBe(true);
	});

	test('W-11: rejects non-string input', () => {
		expect(validateRedirectedFrom(undefined).ok).toBe(false);
		expect(validateRedirectedFrom(null).ok).toBe(false);
		expect(validateRedirectedFrom(42).ok).toBe(false);
		expect(validateRedirectedFrom(['airboss-ref:handbooks/afh/3']).ok).toBe(false);
	});

	test('W-12: rejects empty string', () => {
		const result = validateRedirectedFrom('');
		expect(result.ok).toBe(false);
		if (result.ok) return;
		expect(result.message).toMatch(/non-empty/);
	});

	test('W-13: rejects un-parseable airboss-ref values with the parser message', () => {
		const result = validateRedirectedFrom('not-a-uri');
		expect(result.ok).toBe(false);
		if (result.ok) return;
		expect(result.message).toMatch(/not a parseable airboss-ref URI/);
		expect(result.message).toMatch(/Not an airboss-ref/);
	});

	test('W-14: rejects path-absolute airboss-ref forms via the parser', () => {
		const result = validateRedirectedFrom('airboss-ref:/handbooks/afh/3');
		expect(result.ok).toBe(false);
		if (result.ok) return;
		expect(result.message).toMatch(/path-absolute/);
	});
});

describe('compareSentinel', () => {
	test('S-06: exact match returns match=true', () => {
		const cmp = compareSentinel('Basic Flight Maneuvers', 'Basic Flight Maneuvers');
		expect(cmp.match).toBe(true);
		expect(cmp.actual).toBe('Basic Flight Maneuvers');
	});

	test('S-07: trim difference still matches', () => {
		const cmp = compareSentinel('Basic Flight Maneuvers', '  Basic Flight Maneuvers  ');
		expect(cmp.match).toBe(true);
	});

	test('S-08: literal mismatch returns match=false with actual', () => {
		const cmp = compareSentinel('Basic Flight Maneuvers', 'Fundamentals of Flight');
		expect(cmp.match).toBe(false);
		expect(cmp.actual).toBe('Fundamentals of Flight');
	});

	test('S-09: null actual returns match=false with actual=null', () => {
		const cmp = compareSentinel('Basic Flight Maneuvers', null);
		expect(cmp.match).toBe(false);
		expect(cmp.actual).toBe(null);
	});
});
