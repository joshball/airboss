import { describe, expect, it } from 'vitest';
import type { ParsedTcdsLocator } from '../types.ts';
import { formatTcdsLocator, parseTcdsLocator } from './locator.ts';

describe('parseTcdsLocator', () => {
	it('parses a typical short TCDS', () => {
		const result = parseTcdsLocator('3a12');
		expect(result.kind).toBe('ok');
		if (result.kind !== 'ok') return;
		expect(result.tcds).toEqual({ tcdsNumber: '3a12' });
	});

	it('parses a longer TCDS', () => {
		const result = parseTcdsLocator('a00009ch');
		expect(result.kind).toBe('ok');
		if (result.kind !== 'ok') return;
		expect(result.tcds?.tcdsNumber).toBe('a00009ch');
	});

	it('parses an alpha-prefix TCDS', () => {
		const result = parseTcdsLocator('e5so');
		expect(result.kind).toBe('ok');
		if (result.kind !== 'ok') return;
		expect(result.tcds?.tcdsNumber).toBe('e5so');
	});

	it('parses a numeric-prefix TCDS', () => {
		const result = parseTcdsLocator('7a11');
		expect(result.kind).toBe('ok');
		if (result.kind !== 'ok') return;
		expect(result.tcds?.tcdsNumber).toBe('7a11');
	});

	it('rejects empty locator', () => {
		const result = parseTcdsLocator('');
		expect(result.kind).toBe('error');
	});

	it('rejects single-character TCDS', () => {
		const result = parseTcdsLocator('a');
		expect(result.kind).toBe('error');
		if (result.kind !== 'error') return;
		expect(result.message).toContain('malformed');
	});

	it('rejects uppercase TCDS', () => {
		const result = parseTcdsLocator('3A12');
		expect(result.kind).toBe('error');
	});

	it('rejects TCDS with dashes', () => {
		const result = parseTcdsLocator('3a-12');
		expect(result.kind).toBe('error');
	});

	it('rejects TCDS with whitespace', () => {
		const result = parseTcdsLocator('3a 12');
		expect(result.kind).toBe('error');
	});

	it('rejects multi-segment locator', () => {
		const result = parseTcdsLocator('3a12/extra');
		expect(result.kind).toBe('error');
		if (result.kind !== 'error') return;
		expect(result.message).toContain('unexpected');
	});

	it('rejects too-long TCDS', () => {
		const result = parseTcdsLocator('abcdefghijklmnop');
		expect(result.kind).toBe('error');
	});
});

describe('formatTcdsLocator round-trip', () => {
	it('round-trips a short TCDS locator', () => {
		const parsed: ParsedTcdsLocator = { tcdsNumber: '3a12' };
		expect(formatTcdsLocator(parsed)).toBe('3a12');
	});

	it('round-trips a long TCDS locator', () => {
		const parsed: ParsedTcdsLocator = { tcdsNumber: 'a00009ch' };
		expect(formatTcdsLocator(parsed)).toBe('a00009ch');
	});
});
