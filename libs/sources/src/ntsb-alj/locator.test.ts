import { describe, expect, it } from 'vitest';
import type { ParsedNtsbAljLocator } from '../types.ts';
import { formatNtsbAljLocator, parseNtsbAljLocator } from './locator.ts';

describe('parseNtsbAljLocator', () => {
	it('parses a typical EA case number', () => {
		const result = parseNtsbAljLocator('ea-5567');
		expect(result.kind).toBe('ok');
		if (result.kind !== 'ok') return;
		expect(result.ntsbAlj).toEqual({ caseNumber: 'ea-5567', prefix: 'ea', sequence: '5567' });
	});

	it('parses an SE docket case number', () => {
		const result = parseNtsbAljLocator('se-19045');
		expect(result.kind).toBe('ok');
		if (result.kind !== 'ok') return;
		expect(result.ntsbAlj).toEqual({ caseNumber: 'se-19045', prefix: 'se', sequence: '19045' });
	});

	it('parses a WD case number', () => {
		const result = parseNtsbAljLocator('wd-1234');
		expect(result.kind).toBe('ok');
		if (result.kind !== 'ok') return;
		expect(result.ntsbAlj?.prefix).toBe('wd');
	});

	it('parses an IA case number', () => {
		const result = parseNtsbAljLocator('ia-987');
		expect(result.kind).toBe('ok');
		if (result.kind !== 'ok') return;
		expect(result.ntsbAlj?.prefix).toBe('ia');
	});

	it('parses a case number with a section segment', () => {
		const result = parseNtsbAljLocator('ea-5567/findings-of-fact');
		expect(result.kind).toBe('ok');
		if (result.kind !== 'ok') return;
		expect(result.ntsbAlj?.section).toBe('findings-of-fact');
	});

	it('parses each known section', () => {
		for (const section of ['findings-of-fact', 'conclusions-of-law', 'order', 'discussion', 'final']) {
			const result = parseNtsbAljLocator(`ea-5567/${section}`);
			expect(result.kind).toBe('ok');
			if (result.kind !== 'ok') continue;
			expect(result.ntsbAlj?.section).toBe(section);
		}
	});

	it('rejects empty locator', () => {
		const result = parseNtsbAljLocator('');
		expect(result.kind).toBe('error');
	});

	it('rejects unknown prefix', () => {
		const result = parseNtsbAljLocator('xy-1234');
		expect(result.kind).toBe('error');
		if (result.kind !== 'error') return;
		expect(result.message).toContain('malformed');
	});

	it('rejects uppercase prefix', () => {
		const result = parseNtsbAljLocator('EA-5567');
		expect(result.kind).toBe('error');
	});

	it('rejects missing dash', () => {
		const result = parseNtsbAljLocator('ea5567');
		expect(result.kind).toBe('error');
	});

	it('rejects non-numeric sequence', () => {
		const result = parseNtsbAljLocator('ea-55a7');
		expect(result.kind).toBe('error');
	});

	it('rejects an unknown section', () => {
		const result = parseNtsbAljLocator('ea-5567/preamble');
		expect(result.kind).toBe('error');
		if (result.kind !== 'error') return;
		expect(result.message).toContain('section');
	});

	it('rejects extra segments after section', () => {
		const result = parseNtsbAljLocator('ea-5567/order/extra');
		expect(result.kind).toBe('error');
		if (result.kind !== 'error') return;
		expect(result.message).toContain('unexpected');
	});

	it('rejects whitespace', () => {
		const result = parseNtsbAljLocator('ea 5567');
		expect(result.kind).toBe('error');
	});
});

describe('formatNtsbAljLocator round-trip', () => {
	it('round-trips a basic case number', () => {
		const parsed: ParsedNtsbAljLocator = { caseNumber: 'ea-5567', prefix: 'ea', sequence: '5567' };
		expect(formatNtsbAljLocator(parsed)).toBe('ea-5567');
	});

	it('round-trips a case number with a section', () => {
		const parsed: ParsedNtsbAljLocator = {
			caseNumber: 'ea-5567',
			prefix: 'ea',
			sequence: '5567',
			section: 'findings-of-fact',
		};
		expect(formatNtsbAljLocator(parsed)).toBe('ea-5567/findings-of-fact');
	});
});
