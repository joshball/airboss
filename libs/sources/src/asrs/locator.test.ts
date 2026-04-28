import { describe, expect, it } from 'vitest';
import type { ParsedAsrsLocator } from '../types.ts';
import { formatAsrsLocator, parseAsrsLocator } from './locator.ts';

describe('parseAsrsLocator', () => {
	it('parses a 7-digit ACN', () => {
		const result = parseAsrsLocator('1234567');
		expect(result.kind).toBe('ok');
		if (result.kind !== 'ok') return;
		expect(result.asrs).toEqual({ acn: '1234567' });
	});

	it('parses a 6-digit ACN (legacy)', () => {
		const result = parseAsrsLocator('987654');
		expect(result.kind).toBe('ok');
		if (result.kind !== 'ok') return;
		expect(result.asrs?.acn).toBe('987654');
	});

	it('parses a low-numbered ACN', () => {
		const result = parseAsrsLocator('100001');
		expect(result.kind).toBe('ok');
		if (result.kind !== 'ok') return;
		expect(result.asrs?.acn).toBe('100001');
	});

	it('rejects empty locator', () => {
		const result = parseAsrsLocator('');
		expect(result.kind).toBe('error');
	});

	it('rejects 5-digit ACN', () => {
		const result = parseAsrsLocator('12345');
		expect(result.kind).toBe('error');
		if (result.kind !== 'error') return;
		expect(result.message).toContain('malformed');
	});

	it('rejects 8-digit ACN', () => {
		const result = parseAsrsLocator('12345678');
		expect(result.kind).toBe('error');
	});

	it('rejects alpha ACN', () => {
		const result = parseAsrsLocator('123A567');
		expect(result.kind).toBe('error');
	});

	it('rejects multi-segment locator', () => {
		const result = parseAsrsLocator('1234567/extra');
		expect(result.kind).toBe('error');
		if (result.kind !== 'error') return;
		expect(result.message).toContain('unexpected');
	});

	it('rejects whitespace', () => {
		const result = parseAsrsLocator('123 4567');
		expect(result.kind).toBe('error');
	});

	it('rejects ACN starting with dash', () => {
		const result = parseAsrsLocator('-1234567');
		expect(result.kind).toBe('error');
	});
});

describe('formatAsrsLocator round-trip', () => {
	it('round-trips a 7-digit ACN locator', () => {
		const parsed: ParsedAsrsLocator = { acn: '1234567' };
		expect(formatAsrsLocator(parsed)).toBe('1234567');
	});

	it('round-trips a 6-digit ACN locator', () => {
		const parsed: ParsedAsrsLocator = { acn: '987654' };
		expect(formatAsrsLocator(parsed)).toBe('987654');
	});
});
