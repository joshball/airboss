import { describe, expect, it } from 'vitest';
import type { ParsedStatutesLocator } from '../types.ts';
import { formatStatutesLocator, parseStatutesLocator } from './locator.ts';

describe('parseStatutesLocator', () => {
	it('parses a section locator', () => {
		const result = parseStatutesLocator('usc-49/40103');
		expect(result.kind).toBe('ok');
		if (result.kind !== 'ok') return;
		expect(result.statutes).toEqual({
			title: 'usc-49',
			titleNumber: '49',
			section: '40103',
		});
	});

	it('parses a section + subsection locator', () => {
		const result = parseStatutesLocator('usc-49/44102/a');
		expect(result.kind).toBe('ok');
		if (result.kind !== 'ok') return;
		expect(result.statutes).toEqual({
			title: 'usc-49',
			titleNumber: '49',
			section: '44102',
			subsection: 'a',
		});
	});

	it('parses a multi-character subsection', () => {
		const result = parseStatutesLocator('usc-49/44102/b-1');
		expect(result.kind).toBe('ok');
		if (result.kind !== 'ok') return;
		expect(result.statutes?.subsection).toBe('b-1');
	});

	it('parses a single-digit title', () => {
		const result = parseStatutesLocator('usc-5/552');
		expect(result.kind).toBe('ok');
		if (result.kind !== 'ok') return;
		expect(result.statutes?.titleNumber).toBe('5');
	});

	it('rejects empty locator', () => {
		const result = parseStatutesLocator('');
		expect(result.kind).toBe('error');
	});

	it('rejects single-segment locator', () => {
		const result = parseStatutesLocator('usc-49');
		expect(result.kind).toBe('error');
	});

	it('rejects malformed title (no usc- prefix)', () => {
		const result = parseStatutesLocator('cfr-49/40103');
		expect(result.kind).toBe('error');
		if (result.kind !== 'error') return;
		expect(result.message).toContain('malformed');
	});

	it('rejects malformed title (uppercase)', () => {
		const result = parseStatutesLocator('USC-49/40103');
		expect(result.kind).toBe('error');
	});

	it('rejects malformed section (zero)', () => {
		const result = parseStatutesLocator('usc-49/0');
		expect(result.kind).toBe('error');
	});

	it('rejects malformed section (alpha)', () => {
		const result = parseStatutesLocator('usc-49/four-zero');
		expect(result.kind).toBe('error');
	});

	it('rejects malformed subsection (uppercase)', () => {
		const result = parseStatutesLocator('usc-49/44102/A');
		expect(result.kind).toBe('error');
	});

	it('rejects too many segments', () => {
		const result = parseStatutesLocator('usc-49/44102/a/extra');
		expect(result.kind).toBe('error');
		if (result.kind !== 'error') return;
		expect(result.message).toContain('unexpected');
	});

	it('rejects empty subsection', () => {
		const result = parseStatutesLocator('usc-49/44102/');
		expect(result.kind).toBe('error');
	});
});

describe('formatStatutesLocator round-trip', () => {
	it('round-trips a section locator', () => {
		const parsed: ParsedStatutesLocator = {
			title: 'usc-49',
			titleNumber: '49',
			section: '40103',
		};
		expect(formatStatutesLocator(parsed)).toBe('usc-49/40103');
	});

	it('round-trips a subsection locator', () => {
		const parsed: ParsedStatutesLocator = {
			title: 'usc-49',
			titleNumber: '49',
			section: '44102',
			subsection: 'a',
		};
		expect(formatStatutesLocator(parsed)).toBe('usc-49/44102/a');
	});
});
