import { describe, expect, it } from 'vitest';
import type { ParsedOrdersLocator } from '../types.ts';
import { formatOrdersLocator, parseOrdersLocator } from './locator.ts';

describe('parseOrdersLocator', () => {
	it('parses an order with no sub-segments', () => {
		const result = parseOrdersLocator('faa/2150-3');
		expect(result.kind).toBe('ok');
		if (result.kind !== 'ok') return;
		expect(result.orders).toEqual({ authority: 'faa', orderNumber: '2150-3' });
	});

	it('parses an order number with revision-letter suffix', () => {
		const result = parseOrdersLocator('faa/8260-3C');
		expect(result.kind).toBe('ok');
		if (result.kind !== 'ok') return;
		expect(result.orders).toEqual({ authority: 'faa', orderNumber: '8260-3C' });
	});

	it('parses a single-digit order number', () => {
		const result = parseOrdersLocator('faa/8000-373');
		expect(result.kind).toBe('ok');
		if (result.kind !== 'ok') return;
		expect(result.orders).toEqual({ authority: 'faa', orderNumber: '8000-373' });
	});

	it('parses an order with volume', () => {
		const result = parseOrdersLocator('faa/8900-1/vol-5');
		expect(result.kind).toBe('ok');
		if (result.kind !== 'ok') return;
		expect(result.orders).toEqual({ authority: 'faa', orderNumber: '8900-1', volume: '5' });
	});

	it('parses an order with volume + chapter', () => {
		const result = parseOrdersLocator('faa/8900-1/vol-5/ch-1');
		expect(result.kind).toBe('ok');
		if (result.kind !== 'ok') return;
		expect(result.orders).toEqual({
			authority: 'faa',
			orderNumber: '8900-1',
			volume: '5',
			chapter: '1',
		});
	});

	it('parses an order with chapter only (single-volume orders)', () => {
		const result = parseOrdersLocator('faa/2150-3/ch-12');
		expect(result.kind).toBe('ok');
		if (result.kind !== 'ok') return;
		expect(result.orders).toEqual({ authority: 'faa', orderNumber: '2150-3', chapter: '12' });
	});

	it('parses an order with paragraph (TERPS-style)', () => {
		const result = parseOrdersLocator('faa/8260-3C/par-5.2.1');
		expect(result.kind).toBe('ok');
		if (result.kind !== 'ok') return;
		expect(result.orders).toEqual({
			authority: 'faa',
			orderNumber: '8260-3C',
			paragraph: '5.2.1',
		});
	});

	it('parses a single-segment paragraph', () => {
		const result = parseOrdersLocator('faa/2150-3/par-7');
		expect(result.kind).toBe('ok');
		if (result.kind !== 'ok') return;
		expect(result.orders).toEqual({ authority: 'faa', orderNumber: '2150-3', paragraph: '7' });
	});

	it('rejects empty locator', () => {
		const result = parseOrdersLocator('');
		expect(result.kind).toBe('error');
	});

	it('rejects unknown authority', () => {
		const result = parseOrdersLocator('dot/1234-5');
		expect(result.kind).toBe('error');
		if (result.kind !== 'error') return;
		expect(result.message).toContain('not yet supported');
	});

	it('rejects malformed authority', () => {
		const result = parseOrdersLocator('FAA/1234-5');
		expect(result.kind).toBe('error');
		if (result.kind !== 'error') return;
		expect(result.message).toContain('malformed');
	});

	it('rejects missing order number', () => {
		const result = parseOrdersLocator('faa');
		expect(result.kind).toBe('error');
		if (result.kind !== 'error') return;
		expect(result.message).toContain('missing order number');
	});

	it('rejects malformed order number', () => {
		const result = parseOrdersLocator('faa/abc-def');
		expect(result.kind).toBe('error');
		if (result.kind !== 'error') return;
		expect(result.message).toContain('malformed');
	});

	it('rejects bare ch-N without an order number', () => {
		const result = parseOrdersLocator('faa//ch-1');
		expect(result.kind).toBe('error');
	});

	it('rejects garbage sub-segment', () => {
		const result = parseOrdersLocator('faa/2150-3/wat');
		expect(result.kind).toBe('error');
		if (result.kind !== 'error') return;
		expect(result.message).toContain('expected');
	});

	it('rejects extra segments after ch-N', () => {
		const result = parseOrdersLocator('faa/2150-3/ch-1/extra');
		expect(result.kind).toBe('error');
		if (result.kind !== 'error') return;
		expect(result.message).toContain('unexpected');
	});

	it('rejects extra segments after vol-N/ch-N', () => {
		const result = parseOrdersLocator('faa/8900-1/vol-5/ch-1/sec-3');
		expect(result.kind).toBe('error');
		if (result.kind !== 'error') return;
		expect(result.message).toContain('unexpected');
	});

	it('rejects vol-N without trailing ch-N', () => {
		const result = parseOrdersLocator('faa/8900-1/vol-5/wat');
		expect(result.kind).toBe('error');
		if (result.kind !== 'error') return;
		expect(result.message).toContain('ch-');
	});

	it('rejects extra segments after par-...', () => {
		const result = parseOrdersLocator('faa/8260-3C/par-5.2.1/extra');
		expect(result.kind).toBe('error');
	});
});

describe('formatOrdersLocator round-trip', () => {
	it('round-trips a whole-order locator', () => {
		const parsed: ParsedOrdersLocator = { authority: 'faa', orderNumber: '2150-3' };
		expect(formatOrdersLocator(parsed)).toBe('faa/2150-3');
	});

	it('round-trips volume + chapter', () => {
		const parsed: ParsedOrdersLocator = {
			authority: 'faa',
			orderNumber: '8900-1',
			volume: '5',
			chapter: '1',
		};
		expect(formatOrdersLocator(parsed)).toBe('faa/8900-1/vol-5/ch-1');
	});

	it('round-trips chapter-only', () => {
		const parsed: ParsedOrdersLocator = { authority: 'faa', orderNumber: '2150-3', chapter: '12' };
		expect(formatOrdersLocator(parsed)).toBe('faa/2150-3/ch-12');
	});

	it('round-trips paragraph', () => {
		const parsed: ParsedOrdersLocator = {
			authority: 'faa',
			orderNumber: '8260-3C',
			paragraph: '5.2.1',
		};
		expect(formatOrdersLocator(parsed)).toBe('faa/8260-3C/par-5.2.1');
	});
});
