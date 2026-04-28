import { describe, expect, it } from 'vitest';
import type { ParsedAcsLocator } from '../types.ts';
import { formatAcsLocator, parseAcsLocator } from './locator.ts';

// Test format reflects the cert-syllabus WP's locked Q7 resolution
// (2026-04-27): publication-slug locators with 2-digit zero-padding on
// areas + element ordinals, `elem-` (not `element-`) prefix on element
// segments. The slug collapses cert+category+edition into one token.

describe('parseAcsLocator', () => {
	it('parses a whole-publication locator', () => {
		const result = parseAcsLocator('ppl-airplane-6c');
		expect(result.kind).toBe('ok');
		if (result.kind !== 'ok') return;
		expect(result.acs).toEqual({ slug: 'ppl-airplane-6c' });
	});

	it('parses an area locator', () => {
		const result = parseAcsLocator('ppl-airplane-6c/area-05');
		expect(result.kind).toBe('ok');
		if (result.kind !== 'ok') return;
		expect(result.acs).toEqual({ slug: 'ppl-airplane-6c', area: '05' });
	});

	it('parses a task locator', () => {
		const result = parseAcsLocator('ppl-airplane-6c/area-05/task-a');
		expect(result.kind).toBe('ok');
		if (result.kind !== 'ok') return;
		expect(result.acs).toEqual({ slug: 'ppl-airplane-6c', area: '05', task: 'a' });
	});

	it('parses a knowledge element locator', () => {
		const result = parseAcsLocator('ppl-airplane-6c/area-05/task-a/elem-k01');
		expect(result.kind).toBe('ok');
		if (result.kind !== 'ok') return;
		expect(result.acs).toEqual({
			slug: 'ppl-airplane-6c',
			area: '05',
			task: 'a',
			elementTriad: 'k',
			elementOrdinal: '01',
		});
	});

	it('parses a risk-management element locator', () => {
		const result = parseAcsLocator('cfi-airplane-25/area-01/task-a/elem-r02');
		expect(result.kind).toBe('ok');
		if (result.kind !== 'ok') return;
		expect(result.acs).toMatchObject({ elementTriad: 'r', elementOrdinal: '02' });
	});

	it('parses a skill element locator', () => {
		const result = parseAcsLocator('ppl-airplane-6c/area-05/task-a/elem-s03');
		expect(result.kind).toBe('ok');
		if (result.kind !== 'ok') return;
		expect(result.acs).toMatchObject({ elementTriad: 's', elementOrdinal: '03' });
	});

	it('parses two-digit element ordinals up to 99', () => {
		const result = parseAcsLocator('cfi-airplane-25/area-02/task-b/elem-k12');
		expect(result.kind).toBe('ok');
		if (result.kind !== 'ok') return;
		expect(result.acs).toMatchObject({ elementOrdinal: '12' });
	});

	it('rejects empty locator', () => {
		const result = parseAcsLocator('');
		expect(result.kind).toBe('error');
	});

	it('rejects unknown publication slug', () => {
		const result = parseAcsLocator('made-up-publication-99');
		expect(result.kind).toBe('error');
		if (result.kind !== 'error') return;
		expect(result.message).toContain('not a registered publication');
	});

	it('rejects single-digit (non-padded) area ordinal', () => {
		const result = parseAcsLocator('ppl-airplane-6c/area-5');
		expect(result.kind).toBe('error');
		if (result.kind !== 'error') return;
		expect(result.message).toContain('zero-padding');
	});

	it('rejects roman-numeral area ordinal (the pre-Q7 PR2 format)', () => {
		const result = parseAcsLocator('ppl-airplane-6c/area-v');
		expect(result.kind).toBe('error');
	});

	it('rejects malformed task segment (multi-letter)', () => {
		const result = parseAcsLocator('ppl-airplane-6c/area-05/task-aa');
		expect(result.kind).toBe('error');
		if (result.kind !== 'error') return;
		expect(result.message).toContain('task');
	});

	it('rejects element segment using the pre-Q7 `element-` prefix', () => {
		const result = parseAcsLocator('ppl-airplane-6c/area-05/task-a/element-k1');
		expect(result.kind).toBe('error');
	});

	it('rejects element segment without 2-digit ordinal', () => {
		const result = parseAcsLocator('ppl-airplane-6c/area-05/task-a/elem-k1');
		expect(result.kind).toBe('error');
	});

	it('rejects element segment with unknown triad letter', () => {
		const result = parseAcsLocator('ppl-airplane-6c/area-05/task-a/elem-x01');
		expect(result.kind).toBe('error');
	});

	it('rejects element segment with no ordinal', () => {
		const result = parseAcsLocator('ppl-airplane-6c/area-05/task-a/elem-k');
		expect(result.kind).toBe('error');
	});

	it('rejects extra segments after element', () => {
		const result = parseAcsLocator('ppl-airplane-6c/area-05/task-a/elem-k01/extra');
		expect(result.kind).toBe('error');
		if (result.kind !== 'error') return;
		expect(result.message).toContain('unexpected segments');
	});
});

describe('formatAcsLocator', () => {
	it('round-trips through parse', () => {
		const cases: ParsedAcsLocator[] = [
			{ slug: 'ppl-airplane-6c' },
			{ slug: 'ppl-airplane-6c', area: '05' },
			{ slug: 'ppl-airplane-6c', area: '05', task: 'a' },
			{
				slug: 'ppl-airplane-6c',
				area: '05',
				task: 'a',
				elementTriad: 'k',
				elementOrdinal: '01',
			},
			{
				slug: 'cfi-airplane-25',
				area: '03',
				task: 'b',
				elementTriad: 'r',
				elementOrdinal: '07',
			},
		];
		for (const c of cases) {
			const formatted = formatAcsLocator(c);
			const parsed = parseAcsLocator(formatted);
			expect(parsed.kind).toBe('ok');
			if (parsed.kind !== 'ok') continue;
			expect(parsed.acs).toEqual(c);
		}
	});

	it('truncates output when intermediate fields are missing', () => {
		// area set but task missing -> stops at area
		const formatted = formatAcsLocator({
			slug: 'ppl-airplane-6c',
			area: '05',
			elementTriad: 'k',
			elementOrdinal: '01',
		});
		expect(formatted).toBe('ppl-airplane-6c/area-05');
	});
});
