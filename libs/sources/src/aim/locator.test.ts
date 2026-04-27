import { describe, expect, it } from 'vitest';
import { parseAimLocator } from './locator.ts';

describe('parseAimLocator', () => {
	describe('accepts', () => {
		it('a chapter', () => {
			const result = parseAimLocator('5');
			expect(result.kind).toBe('ok');
			if (result.kind !== 'ok') return;
			expect(result.aim).toEqual({ chapter: '5' });
		});

		it('a section', () => {
			const result = parseAimLocator('5-1');
			expect(result.kind).toBe('ok');
			if (result.kind !== 'ok') return;
			expect(result.aim).toEqual({ chapter: '5', section: '1' });
		});

		it('a paragraph', () => {
			const result = parseAimLocator('5-1-7');
			expect(result.kind).toBe('ok');
			if (result.kind !== 'ok') return;
			expect(result.aim).toEqual({ chapter: '5', section: '1', paragraph: '7' });
		});

		it('a glossary entry', () => {
			const result = parseAimLocator('glossary/pilot-in-command');
			expect(result.kind).toBe('ok');
			if (result.kind !== 'ok') return;
			expect(result.aim).toEqual({ glossarySlug: 'pilot-in-command' });
		});

		it('an appendix', () => {
			const result = parseAimLocator('appendix-1');
			expect(result.kind).toBe('ok');
			if (result.kind !== 'ok') return;
			expect(result.aim).toEqual({ appendix: '1' });
		});

		it('a multi-digit chapter', () => {
			const result = parseAimLocator('11');
			expect(result.kind).toBe('ok');
			if (result.kind !== 'ok') return;
			expect(result.aim).toEqual({ chapter: '11' });
		});

		it('a multi-digit paragraph', () => {
			const result = parseAimLocator('4-3-22');
			expect(result.kind).toBe('ok');
			if (result.kind !== 'ok') return;
			expect(result.aim).toEqual({ chapter: '4', section: '3', paragraph: '22' });
		});

		it('a glossary slug with multiple words', () => {
			const result = parseAimLocator('glossary/airport-traffic-area');
			expect(result.kind).toBe('ok');
			if (result.kind !== 'ok') return;
			expect(result.aim).toEqual({ glossarySlug: 'airport-traffic-area' });
		});

		it('a multi-digit appendix', () => {
			const result = parseAimLocator('appendix-12');
			expect(result.kind).toBe('ok');
			if (result.kind !== 'ok') return;
			expect(result.aim).toEqual({ appendix: '12' });
		});
	});

	describe('rejects', () => {
		it('an empty locator', () => {
			const result = parseAimLocator('');
			expect(result.kind).toBe('error');
		});

		it('a malformed numeric locator (zero chapter)', () => {
			const result = parseAimLocator('0');
			expect(result.kind).toBe('error');
			if (result.kind !== 'error') return;
			expect(result.message).toMatch(/chapter/);
		});

		it('a non-digit chapter', () => {
			const result = parseAimLocator('abc');
			expect(result.kind).toBe('error');
		});

		it('a chapter greater than 99', () => {
			const result = parseAimLocator('100');
			expect(result.kind).toBe('error');
			if (result.kind !== 'error') return;
			expect(result.message).toMatch(/chapter/);
		});

		it('a malformed section', () => {
			const result = parseAimLocator('5-0');
			expect(result.kind).toBe('error');
			if (result.kind !== 'error') return;
			expect(result.message).toMatch(/section/);
		});

		it('a malformed paragraph', () => {
			const result = parseAimLocator('5-1-0');
			expect(result.kind).toBe('error');
			if (result.kind !== 'error') return;
			expect(result.message).toMatch(/paragraph/);
		});

		it('too many dash-separated parts', () => {
			const result = parseAimLocator('5-1-7-3');
			expect(result.kind).toBe('error');
		});

		it('a missing glossary slug', () => {
			const result = parseAimLocator('glossary');
			expect(result.kind).toBe('error');
			if (result.kind !== 'error') return;
			expect(result.message).toMatch(/glossary/);
		});

		it('an empty glossary slug', () => {
			const result = parseAimLocator('glossary/');
			expect(result.kind).toBe('error');
			if (result.kind !== 'error') return;
			expect(result.message).toMatch(/glossary/);
		});

		it('a malformed glossary slug (uppercase)', () => {
			const result = parseAimLocator('glossary/Pilot-In-Command');
			expect(result.kind).toBe('error');
			if (result.kind !== 'error') return;
			expect(result.message).toMatch(/glossary/);
		});

		it('a malformed glossary slug (trailing dash)', () => {
			const result = parseAimLocator('glossary/pilot-');
			expect(result.kind).toBe('error');
		});

		it('extra segments after glossary slug', () => {
			const result = parseAimLocator('glossary/pilot-in-command/extra');
			expect(result.kind).toBe('error');
		});

		it('a malformed appendix (no digits)', () => {
			const result = parseAimLocator('appendix-');
			expect(result.kind).toBe('error');
			if (result.kind !== 'error') return;
			expect(result.message).toMatch(/appendix/);
		});

		it('a malformed appendix (zero)', () => {
			const result = parseAimLocator('appendix-0');
			expect(result.kind).toBe('error');
		});

		it('a malformed appendix (non-digit)', () => {
			const result = parseAimLocator('appendix-abc');
			expect(result.kind).toBe('error');
		});

		it('extra segments after appendix', () => {
			const result = parseAimLocator('appendix-1/extra');
			expect(result.kind).toBe('error');
		});

		it('extra segments after a numeric chapter', () => {
			const result = parseAimLocator('5/extra');
			expect(result.kind).toBe('error');
		});

		it('a numeric form that begins with zero', () => {
			const result = parseAimLocator('05-1-7');
			expect(result.kind).toBe('error');
		});
	});
});
