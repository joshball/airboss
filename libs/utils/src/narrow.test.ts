import { describe, expect, it } from 'vitest';
import { narrow } from './narrow';

describe('narrow', () => {
	const DOMAINS = ['regs', 'weather', 'systems'] as const;
	type Domain = (typeof DOMAINS)[number];

	describe('without fallback', () => {
		it('returns the matching member when value is in the set', () => {
			const result: Domain | undefined = narrow('regs', DOMAINS);
			expect(result).toBe('regs');
		});

		it('returns undefined when value is not in the set', () => {
			expect(narrow('nope', DOMAINS)).toBeUndefined();
		});

		it('returns undefined for null', () => {
			expect(narrow(null, DOMAINS)).toBeUndefined();
		});

		it('returns undefined for undefined', () => {
			expect(narrow(undefined, DOMAINS)).toBeUndefined();
		});

		it('returns undefined for non-string values', () => {
			expect(narrow(42, DOMAINS)).toBeUndefined();
			expect(narrow({}, DOMAINS)).toBeUndefined();
			expect(narrow([], DOMAINS)).toBeUndefined();
		});
	});

	describe('with fallback', () => {
		it('returns the matching member when value is in the set', () => {
			const result: Domain = narrow('weather', DOMAINS, 'regs');
			expect(result).toBe('weather');
		});

		it('returns the fallback when value is not in the set', () => {
			expect(narrow('nope', DOMAINS, 'regs')).toBe('regs');
		});

		it('returns the fallback for null / undefined / non-string', () => {
			expect(narrow(null, DOMAINS, 'regs')).toBe('regs');
			expect(narrow(undefined, DOMAINS, 'regs')).toBe('regs');
			expect(narrow(99, DOMAINS, 'regs')).toBe('regs');
		});
	});
});
