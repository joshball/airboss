import { describe, expect, it } from 'vitest';
import type { ParsedInterpLocator } from '../types.ts';
import { formatInterpLocator, parseInterpLocator } from './locator.ts';

describe('parseInterpLocator', () => {
	it('parses a chief-counsel author-year slug', () => {
		const result = parseInterpLocator('chief-counsel/mangiamele-2009');
		expect(result.kind).toBe('ok');
		if (result.kind !== 'ok') return;
		expect(result.interp).toEqual({
			authority: 'chief-counsel',
			slug: 'mangiamele-2009',
			author: 'mangiamele',
			year: '2009',
		});
	});

	it('parses a chief-counsel slug with multi-word author', () => {
		const result = parseInterpLocator('chief-counsel/van-tassel-1987');
		expect(result.kind).toBe('ok');
		if (result.kind !== 'ok') return;
		expect(result.interp?.author).toBe('van-tassel');
		expect(result.interp?.year).toBe('1987');
	});

	it('parses an ntsb case-name slug', () => {
		const result = parseInterpLocator('ntsb/administrator-v-lobeiko');
		expect(result.kind).toBe('ok');
		if (result.kind !== 'ok') return;
		expect(result.interp).toEqual({
			authority: 'ntsb',
			slug: 'administrator-v-lobeiko',
		});
	});

	it('captures the eaOrder discriminator when supplied', () => {
		const result = parseInterpLocator('ntsb/administrator-v-lobeiko', 'EA-5817');
		expect(result.kind).toBe('ok');
		if (result.kind !== 'ok') return;
		expect(result.interp?.eaOrder).toBe('EA-5817');
	});

	it('does not set eaOrder when omitted', () => {
		const result = parseInterpLocator('ntsb/administrator-v-lobeiko');
		expect(result.kind).toBe('ok');
		if (result.kind !== 'ok') return;
		expect(result.interp?.eaOrder).toBeUndefined();
	});

	it('rejects empty locator', () => {
		const result = parseInterpLocator('');
		expect(result.kind).toBe('error');
	});

	it('rejects unknown authority', () => {
		const result = parseInterpLocator('ombudsman/foo-2020');
		expect(result.kind).toBe('error');
		if (result.kind !== 'error') return;
		expect(result.message).toContain('not yet supported');
	});

	it('rejects malformed chief-counsel slug (no year)', () => {
		const result = parseInterpLocator('chief-counsel/mangiamele');
		expect(result.kind).toBe('error');
		if (result.kind !== 'error') return;
		expect(result.message).toContain('malformed');
	});

	it('rejects malformed chief-counsel slug (3-digit year)', () => {
		const result = parseInterpLocator('chief-counsel/mangiamele-009');
		expect(result.kind).toBe('error');
	});

	it('rejects malformed chief-counsel slug (uppercase)', () => {
		const result = parseInterpLocator('chief-counsel/Mangiamele-2009');
		expect(result.kind).toBe('error');
	});

	it('rejects ntsb case name with whitespace', () => {
		const result = parseInterpLocator('ntsb/administrator v lobeiko');
		expect(result.kind).toBe('error');
	});

	it('rejects ntsb case name starting with hyphen', () => {
		const result = parseInterpLocator('ntsb/-bad-case');
		expect(result.kind).toBe('error');
	});

	it('rejects extra segments', () => {
		const result = parseInterpLocator('chief-counsel/mangiamele-2009/extra');
		expect(result.kind).toBe('error');
		if (result.kind !== 'error') return;
		expect(result.message).toContain('unexpected segment count');
	});

	it('rejects missing slug', () => {
		const result = parseInterpLocator('chief-counsel');
		expect(result.kind).toBe('error');
	});

	it('rejects empty slug', () => {
		const result = parseInterpLocator('chief-counsel/');
		expect(result.kind).toBe('error');
	});
});

describe('formatInterpLocator round-trip', () => {
	it('round-trips a chief-counsel locator', () => {
		const parsed: ParsedInterpLocator = {
			authority: 'chief-counsel',
			slug: 'mangiamele-2009',
			author: 'mangiamele',
			year: '2009',
		};
		expect(formatInterpLocator(parsed)).toBe('chief-counsel/mangiamele-2009');
	});

	it('round-trips an ntsb locator', () => {
		const parsed: ParsedInterpLocator = {
			authority: 'ntsb',
			slug: 'administrator-v-lobeiko',
		};
		expect(formatInterpLocator(parsed)).toBe('ntsb/administrator-v-lobeiko');
	});
});
