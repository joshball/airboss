import { describe, expect, it } from 'vitest';
import type { ParsedNtsbLocator } from '../types.ts';
import { formatNtsbLocator, parseNtsbLocator } from './locator.ts';

describe('parseNtsbLocator', () => {
	it('parses an NTSB ID with no section', () => {
		const result = parseNtsbLocator('WPR23LA123');
		expect(result.kind).toBe('ok');
		if (result.kind !== 'ok') return;
		expect(result.ntsb).toEqual({
			ntsbId: 'WPR23LA123',
			region: 'WPR',
			year: '23',
			type: 'LA',
			sequence: '123',
		});
	});

	it('parses an FA-type ID', () => {
		const result = parseNtsbLocator('CEN24FA045');
		expect(result.kind).toBe('ok');
		if (result.kind !== 'ok') return;
		expect(result.ntsb?.type).toBe('FA');
		expect(result.ntsb?.region).toBe('CEN');
	});

	it('parses every supported section', () => {
		for (const section of ['factual', 'probable-cause', 'recommendations', 'dockets', 'final']) {
			const result = parseNtsbLocator(`ANC25IA009/${section}`);
			expect(result.kind).toBe('ok');
			if (result.kind !== 'ok') continue;
			expect(result.ntsb?.section).toBe(section);
		}
	});

	it('rejects empty locator', () => {
		const result = parseNtsbLocator('');
		expect(result.kind).toBe('error');
	});

	it('rejects lowercase region', () => {
		const result = parseNtsbLocator('wpr23la123');
		expect(result.kind).toBe('error');
		if (result.kind !== 'error') return;
		expect(result.message).toContain('malformed');
	});

	it('rejects 4-digit year', () => {
		const result = parseNtsbLocator('WPR2023LA123');
		expect(result.kind).toBe('error');
	});

	it('rejects 2-digit sequence', () => {
		const result = parseNtsbLocator('WPR23LA12');
		expect(result.kind).toBe('error');
	});

	it('rejects unknown type code', () => {
		const result = parseNtsbLocator('WPR23XX123');
		expect(result.kind).toBe('error');
	});

	it('rejects unknown section', () => {
		const result = parseNtsbLocator('WPR23LA123/summary');
		expect(result.kind).toBe('error');
		if (result.kind !== 'error') return;
		expect(result.message).toContain('expected one of');
	});

	it('rejects extra segments after section', () => {
		const result = parseNtsbLocator('WPR23LA123/factual/extra');
		expect(result.kind).toBe('error');
		if (result.kind !== 'error') return;
		expect(result.message).toContain('unexpected');
	});
});

describe('formatNtsbLocator round-trip', () => {
	it('round-trips a section-less locator', () => {
		const parsed: ParsedNtsbLocator = {
			ntsbId: 'WPR23LA123',
			region: 'WPR',
			year: '23',
			type: 'LA',
			sequence: '123',
		};
		expect(formatNtsbLocator(parsed)).toBe('WPR23LA123');
	});

	it('round-trips a locator with section', () => {
		const parsed: ParsedNtsbLocator = {
			ntsbId: 'CEN24FA045',
			region: 'CEN',
			year: '24',
			type: 'FA',
			sequence: '045',
			section: 'probable-cause',
		};
		expect(formatNtsbLocator(parsed)).toBe('CEN24FA045/probable-cause');
	});
});
