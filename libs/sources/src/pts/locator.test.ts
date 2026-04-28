import { describe, expect, it } from 'vitest';
import type { ParsedPtsLocator } from '../types.ts';
import { formatPtsLocator, parsePtsLocator } from './locator.ts';

// PTS locator format mirrors `acs:` minus the K/R/S triad. The cert-syllabus
// WP's locked Q7 resolution applies: 2-digit zero-padded ordinals, lowercase
// kebab-case slug.

describe('parsePtsLocator', () => {
	it('parses a whole-publication locator', () => {
		const result = parsePtsLocator('cfii-airplane-9e');
		expect(result.kind).toBe('ok');
		if (result.kind !== 'ok') return;
		expect(result.pts).toEqual({ slug: 'cfii-airplane-9e' });
	});

	it('parses an area locator', () => {
		const result = parsePtsLocator('cfii-airplane-9e/area-05');
		expect(result.kind).toBe('ok');
		if (result.kind !== 'ok') return;
		expect(result.pts).toEqual({ slug: 'cfii-airplane-9e', area: '05' });
	});

	it('parses a task locator', () => {
		const result = parsePtsLocator('cfii-airplane-9e/area-05/task-a');
		expect(result.kind).toBe('ok');
		if (result.kind !== 'ok') return;
		expect(result.pts).toEqual({ slug: 'cfii-airplane-9e', area: '05', task: 'a' });
	});

	it('parses an element/objective locator', () => {
		const result = parsePtsLocator('cfii-airplane-9e/area-05/task-a/elem-01');
		expect(result.kind).toBe('ok');
		if (result.kind !== 'ok') return;
		expect(result.pts).toEqual({
			slug: 'cfii-airplane-9e',
			area: '05',
			task: 'a',
			elementOrdinal: '01',
		});
	});

	it('rejects empty locator', () => {
		const result = parsePtsLocator('');
		expect(result.kind).toBe('error');
	});

	it('rejects unknown publication slug', () => {
		const result = parsePtsLocator('made-up-pts-99');
		expect(result.kind).toBe('error');
		if (result.kind !== 'error') return;
		expect(result.message).toContain('not a registered publication');
	});

	it('rejects single-digit area ordinal', () => {
		const result = parsePtsLocator('cfii-airplane-9e/area-5');
		expect(result.kind).toBe('error');
		if (result.kind !== 'error') return;
		expect(result.message).toContain('zero-padding');
	});

	it('rejects roman-numeral area', () => {
		const result = parsePtsLocator('cfii-airplane-9e/area-v');
		expect(result.kind).toBe('error');
	});

	it('rejects element segment with K/R/S triad (PTS has no triad)', () => {
		const result = parsePtsLocator('cfii-airplane-9e/area-05/task-a/elem-k01');
		expect(result.kind).toBe('error');
	});

	it('rejects element segment with single-digit ordinal', () => {
		const result = parsePtsLocator('cfii-airplane-9e/area-05/task-a/elem-1');
		expect(result.kind).toBe('error');
	});

	it('rejects extra segments after element', () => {
		const result = parsePtsLocator('cfii-airplane-9e/area-05/task-a/elem-01/extra');
		expect(result.kind).toBe('error');
		if (result.kind !== 'error') return;
		expect(result.message).toContain('unexpected segments');
	});
});

describe('formatPtsLocator', () => {
	it('round-trips through parse', () => {
		const cases: ParsedPtsLocator[] = [
			{ slug: 'cfii-airplane-9e' },
			{ slug: 'cfii-airplane-9e', area: '05' },
			{ slug: 'cfii-airplane-9e', area: '05', task: 'a' },
			{ slug: 'cfii-airplane-9e', area: '05', task: 'a', elementOrdinal: '01' },
		];
		for (const c of cases) {
			const formatted = formatPtsLocator(c);
			const parsed = parsePtsLocator(formatted);
			expect(parsed.kind).toBe('ok');
			if (parsed.kind !== 'ok') continue;
			expect(parsed.pts).toEqual(c);
		}
	});

	it('truncates output when intermediate fields are missing', () => {
		const formatted = formatPtsLocator({
			slug: 'cfii-airplane-9e',
			area: '05',
			elementOrdinal: '01',
		});
		expect(formatted).toBe('cfii-airplane-9e/area-05');
	});
});
