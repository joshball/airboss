import { describe, expect, test } from 'vitest';
import { compareSentinel, isSentinelField, SENTINEL_FIELDS, validateSentinelFieldName } from './sentinels.ts';

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
