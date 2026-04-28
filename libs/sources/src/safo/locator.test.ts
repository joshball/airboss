import { describe, expect, it } from 'vitest';
import type { ParsedSafoLocator } from '../types.ts';
import { formatSafoLocator, parseSafoLocator } from './locator.ts';

describe('parseSafoLocator', () => {
	it('parses a typical SAFO id', () => {
		const result = parseSafoLocator('23004');
		expect(result.kind).toBe('ok');
		if (result.kind !== 'ok') return;
		expect(result.safo).toEqual({ safoId: '23004', year: '23', sequence: '004' });
	});

	it('parses a different SAFO id', () => {
		const result = parseSafoLocator('21002');
		expect(result.kind).toBe('ok');
		if (result.kind !== 'ok') return;
		expect(result.safo).toEqual({ safoId: '21002', year: '21', sequence: '002' });
	});

	it('parses a high-sequence SAFO id', () => {
		const result = parseSafoLocator('20999');
		expect(result.kind).toBe('ok');
		if (result.kind !== 'ok') return;
		expect(result.safo?.sequence).toBe('999');
	});

	it('rejects empty locator', () => {
		const result = parseSafoLocator('');
		expect(result.kind).toBe('error');
	});

	it('rejects 4-digit id', () => {
		const result = parseSafoLocator('2300');
		expect(result.kind).toBe('error');
		if (result.kind !== 'error') return;
		expect(result.message).toContain('malformed');
	});

	it('rejects 6-digit id', () => {
		const result = parseSafoLocator('230040');
		expect(result.kind).toBe('error');
	});

	it('rejects alpha id', () => {
		const result = parseSafoLocator('23A04');
		expect(result.kind).toBe('error');
	});

	it('rejects multi-segment locator', () => {
		const result = parseSafoLocator('23004/extra');
		expect(result.kind).toBe('error');
		if (result.kind !== 'error') return;
		expect(result.message).toContain('unexpected');
	});

	it('rejects whitespace', () => {
		const result = parseSafoLocator('23 004');
		expect(result.kind).toBe('error');
	});

	it('rejects empty subsegments', () => {
		const result = parseSafoLocator('23004/');
		expect(result.kind).toBe('error');
	});
});

describe('formatSafoLocator round-trip', () => {
	it('round-trips a basic safo locator', () => {
		const parsed: ParsedSafoLocator = { safoId: '23004', year: '23', sequence: '004' };
		expect(formatSafoLocator(parsed)).toBe('23004');
	});
});
