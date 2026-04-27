import { describe, expect, it } from 'vitest';
import { parseHandbooksLocator } from './locator.ts';

describe('parseHandbooksLocator', () => {
	describe('accepts', () => {
		it('whole-handbook reference', () => {
			const result = parseHandbooksLocator('phak/8083-25C');
			expect(result.kind).toBe('ok');
			if (result.kind !== 'ok') return;
			expect(result.handbooks).toEqual({ doc: 'phak', edition: '8083-25C' });
		});

		it('a chapter under PHAK', () => {
			const result = parseHandbooksLocator('phak/8083-25C/12');
			expect(result.kind).toBe('ok');
			if (result.kind !== 'ok') return;
			expect(result.handbooks).toEqual({ doc: 'phak', edition: '8083-25C', chapter: '12' });
		});

		it('a section under PHAK', () => {
			const result = parseHandbooksLocator('phak/8083-25C/12/3');
			expect(result.kind).toBe('ok');
			if (result.kind !== 'ok') return;
			expect(result.handbooks).toEqual({
				doc: 'phak',
				edition: '8083-25C',
				chapter: '12',
				section: '3',
			});
		});

		it('a subsection under PHAK', () => {
			const result = parseHandbooksLocator('phak/8083-25C/1/2/2');
			expect(result.kind).toBe('ok');
			if (result.kind !== 'ok') return;
			expect(result.handbooks).toEqual({
				doc: 'phak',
				edition: '8083-25C',
				chapter: '1',
				section: '2',
				subsection: '2',
			});
		});

		it('a paragraph under PHAK', () => {
			const result = parseHandbooksLocator('phak/8083-25C/12/3/para-2');
			expect(result.kind).toBe('ok');
			if (result.kind !== 'ok') return;
			expect(result.handbooks).toEqual({
				doc: 'phak',
				edition: '8083-25C',
				chapter: '12',
				section: '3',
				paragraph: 'para-2',
			});
		});

		it('a chapter intro under AFH', () => {
			const result = parseHandbooksLocator('afh/8083-3C/5/intro');
			expect(result.kind).toBe('ok');
			if (result.kind !== 'ok') return;
			expect(result.handbooks).toEqual({
				doc: 'afh',
				edition: '8083-3C',
				chapter: '5',
				section: 'intro',
			});
		});

		it('a figure under PHAK', () => {
			const result = parseHandbooksLocator('phak/8083-25C/fig-12-7');
			expect(result.kind).toBe('ok');
			if (result.kind !== 'ok') return;
			expect(result.handbooks).toEqual({
				doc: 'phak',
				edition: '8083-25C',
				figure: 'fig-12-7',
			});
		});

		it('a table under AvWX', () => {
			const result = parseHandbooksLocator('avwx/8083-28B/tbl-3-2');
			expect(result.kind).toBe('ok');
			if (result.kind !== 'ok') return;
			expect(result.handbooks).toEqual({
				doc: 'avwx',
				edition: '8083-28B',
				table: 'tbl-3-2',
			});
		});

		it('AFH chapter', () => {
			const result = parseHandbooksLocator('afh/8083-3C/4');
			expect(result.kind).toBe('ok');
			if (result.kind !== 'ok') return;
			expect(result.handbooks).toEqual({ doc: 'afh', edition: '8083-3C', chapter: '4' });
		});

		it('AvWX section', () => {
			const result = parseHandbooksLocator('avwx/8083-28B/3/2');
			expect(result.kind).toBe('ok');
			if (result.kind !== 'ok') return;
			expect(result.handbooks).toEqual({
				doc: 'avwx',
				edition: '8083-28B',
				chapter: '3',
				section: '2',
			});
		});
	});

	describe('rejects', () => {
		it('an empty locator', () => {
			const result = parseHandbooksLocator('');
			expect(result.kind).toBe('error');
		});

		it('an unknown doc slug', () => {
			const result = parseHandbooksLocator('xfh/8083-25C/12/3');
			expect(result.kind).toBe('error');
			if (result.kind !== 'error') return;
			expect(result.message).toMatch(/doc/);
		});

		it('a missing edition', () => {
			const result = parseHandbooksLocator('phak');
			expect(result.kind).toBe('error');
			if (result.kind !== 'error') return;
			expect(result.message).toMatch(/edition/);
		});

		it('a malformed edition', () => {
			const result = parseHandbooksLocator('phak/abc/12/3');
			expect(result.kind).toBe('error');
			if (result.kind !== 'error') return;
			expect(result.message).toMatch(/edition/);
		});

		it('a non-digit chapter', () => {
			const result = parseHandbooksLocator('phak/8083-25C/abc');
			expect(result.kind).toBe('error');
			if (result.kind !== 'error') return;
			expect(result.message).toMatch(/chapter/);
		});

		it('a malformed section', () => {
			const result = parseHandbooksLocator('phak/8083-25C/12/abc');
			expect(result.kind).toBe('error');
			if (result.kind !== 'error') return;
			expect(result.message).toMatch(/section/);
		});

		it('a malformed paragraph', () => {
			const result = parseHandbooksLocator('phak/8083-25C/12/3/para-abc');
			expect(result.kind).toBe('error');
			if (result.kind !== 'error') return;
			expect(result.message).toMatch(/paragraph/);
		});

		it('a malformed subsection', () => {
			const result = parseHandbooksLocator('phak/8083-25C/12/3/abc');
			expect(result.kind).toBe('error');
			if (result.kind !== 'error') return;
			expect(result.message).toMatch(/subsection/);
		});

		it('a malformed figure', () => {
			const result = parseHandbooksLocator('phak/8083-25C/fig-abc');
			expect(result.kind).toBe('error');
			if (result.kind !== 'error') return;
			expect(result.message).toMatch(/figure/);
		});

		it('a malformed table', () => {
			const result = parseHandbooksLocator('phak/8083-25C/tbl-abc');
			expect(result.kind).toBe('error');
			if (result.kind !== 'error') return;
			expect(result.message).toMatch(/table/);
		});

		it('extra segments after a figure', () => {
			const result = parseHandbooksLocator('phak/8083-25C/fig-12-7/extra');
			expect(result.kind).toBe('error');
		});

		it('extra segments after a paragraph', () => {
			const result = parseHandbooksLocator('phak/8083-25C/12/3/para-2/extra');
			expect(result.kind).toBe('error');
		});

		it('extra segments after a subsection', () => {
			const result = parseHandbooksLocator('phak/8083-25C/12/3/2/extra');
			expect(result.kind).toBe('error');
		});

		it('extra segments after intro', () => {
			const result = parseHandbooksLocator('phak/8083-25C/12/intro/extra');
			expect(result.kind).toBe('error');
		});
	});
});
