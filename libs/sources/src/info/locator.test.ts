import { describe, expect, it } from 'vitest';
import type { ParsedInfoLocator } from '../types.ts';
import { formatInfoLocator, parseInfoLocator } from './locator.ts';

describe('parseInfoLocator', () => {
	it('parses a typical InFO id', () => {
		const result = parseInfoLocator('21010');
		expect(result.kind).toBe('ok');
		if (result.kind !== 'ok') return;
		expect(result.info).toEqual({ infoId: '21010', year: '21', sequence: '010' });
	});

	it('parses a different InFO id', () => {
		const result = parseInfoLocator('22008');
		expect(result.kind).toBe('ok');
		if (result.kind !== 'ok') return;
		expect(result.info).toEqual({ infoId: '22008', year: '22', sequence: '008' });
	});

	it('parses a high-sequence InFO id', () => {
		const result = parseInfoLocator('20999');
		expect(result.kind).toBe('ok');
		if (result.kind !== 'ok') return;
		expect(result.info?.sequence).toBe('999');
	});

	it('rejects empty locator', () => {
		const result = parseInfoLocator('');
		expect(result.kind).toBe('error');
	});

	it('rejects 4-digit id', () => {
		const result = parseInfoLocator('2101');
		expect(result.kind).toBe('error');
		if (result.kind !== 'error') return;
		expect(result.message).toContain('malformed');
	});

	it('rejects 6-digit id', () => {
		const result = parseInfoLocator('210100');
		expect(result.kind).toBe('error');
	});

	it('rejects alpha id', () => {
		const result = parseInfoLocator('21A10');
		expect(result.kind).toBe('error');
	});

	it('rejects negative-style id', () => {
		const result = parseInfoLocator('-2101');
		expect(result.kind).toBe('error');
	});

	it('rejects multi-segment locator', () => {
		const result = parseInfoLocator('21010/extra');
		expect(result.kind).toBe('error');
		if (result.kind !== 'error') return;
		expect(result.message).toContain('unexpected');
	});

	it('rejects whitespace-padded id', () => {
		const result = parseInfoLocator(' 21010 ');
		expect(result.kind).toBe('error');
	});
});

describe('formatInfoLocator round-trip', () => {
	it('round-trips a basic info locator', () => {
		const parsed: ParsedInfoLocator = { infoId: '21010', year: '21', sequence: '010' };
		expect(formatInfoLocator(parsed)).toBe('21010');
	});
});
