import { describe, expect, it } from 'vitest';
import { buildQuery } from './url';

describe('buildQuery', () => {
	it('returns empty string when no params', () => {
		expect(buildQuery({})).toBe('');
	});

	it('returns empty string when all params are nullish or empty', () => {
		expect(buildQuery({ a: undefined, b: null, c: '' })).toBe('');
	});

	it('builds single-param query', () => {
		expect(buildQuery({ domain: 'regs' })).toBe('?domain=regs');
	});

	it('builds multi-param query preserving insertion order', () => {
		expect(buildQuery({ domain: 'regs', page: 2, status: 'active' })).toBe('?domain=regs&page=2&status=active');
	});

	it('drops undefined, null, and empty-string values', () => {
		expect(buildQuery({ a: 'x', b: undefined, c: null, d: '', e: 'y' })).toBe('?a=x&e=y');
	});

	it('coerces numbers to strings', () => {
		expect(buildQuery({ item: 0, page: 3 })).toBe('?item=0&page=3');
	});

	it('URL-encodes values with reserved characters', () => {
		expect(buildQuery({ q: 'hello world', slug: 'a/b&c' })).toBe('?q=hello+world&slug=a%2Fb%26c');
	});

	it('URL-encodes keys with reserved characters', () => {
		expect(buildQuery({ 'flight-phase': 'cruise' })).toBe('?flight-phase=cruise');
	});
});
