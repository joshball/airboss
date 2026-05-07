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

		it('amendment 2026-05: doc-only locator (edition omitted)', () => {
			const result = parseHandbooksLocator('phak');
			expect(result.kind).toBe('ok');
			if (result.kind !== 'ok') return;
			expect(result.handbooks).toEqual({ doc: 'phak', edition: '' });
		});

		it('amendment 2026-05: doc + chapter (edition omitted)', () => {
			const knownEditions = new Set(['8083-25C']);
			const result = parseHandbooksLocator('phak/12', (_doc, c) => knownEditions.has(c));
			expect(result.kind).toBe('ok');
			if (result.kind !== 'ok') return;
			expect(result.handbooks).toEqual({ doc: 'phak', edition: '', chapter: '12' });
		});

		it('amendment 2026-05: doc + chapter + section (edition omitted)', () => {
			const knownEditions = new Set(['8083-25C']);
			const result = parseHandbooksLocator('phak/12/3', (_doc, c) => knownEditions.has(c));
			expect(result.kind).toBe('ok');
			if (result.kind !== 'ok') return;
			expect(result.handbooks).toEqual({ doc: 'phak', edition: '', chapter: '12', section: '3' });
		});

		it('amendment 2026-05: doc + edition + chapter + section + para (edition pinned, parser uses registry)', () => {
			const knownEditions = new Set(['8083-25C']);
			const result = parseHandbooksLocator('phak/8083-25C/12/3/para-2', (_doc, c) => knownEditions.has(c));
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

		it('amendment 2026-05: doc + chapter intro (edition omitted)', () => {
			const knownEditions = new Set(['8083-3C']);
			const result = parseHandbooksLocator('afh/5/intro', (_doc, c) => knownEditions.has(c));
			expect(result.kind).toBe('ok');
			if (result.kind !== 'ok') return;
			expect(result.handbooks).toEqual({ doc: 'afh', edition: '', chapter: '5', section: 'intro' });
		});

		it('non-FAA-H-numbered handbook (Tips on Mountain Flying)', () => {
			// Pamphlets/handbooks without an FAA H-designator use a `<slug>-<year>`
			// edition shape (see EDITION_PATTERN in locator.ts).
			const result = parseHandbooksLocator('tips-mountain-flying/mtn-2003');
			expect(result.kind).toBe('ok');
			if (result.kind !== 'ok') return;
			expect(result.handbooks).toEqual({ doc: 'tips-mountain-flying', edition: 'mtn-2003' });
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

		it('a malformed chapter (where edition was previously parsed)', () => {
			// Per ADR 019 amendment 2026-05 §1, edition is now optional in the
			// locator path. `phak/abc/12/3` parses `abc` as the chapter slot
			// (no registry-aware predicate is supplied here, so the syntactic
			// EDITION_PATTERN classifies "abc" as a non-edition chapter
			// candidate). The chapter-pattern check then fails.
			const result = parseHandbooksLocator('phak/abc/12/3');
			expect(result.kind).toBe('error');
			if (result.kind !== 'error') return;
			expect(result.message).toMatch(/chapter/);
		});

		it('a syntactically-valid edition not known to the registry', () => {
			// EDITION_PATTERN matches "8083-99Z" but a registry-aware predicate
			// rejects it (no such edition for `phak`). Without a predicate
			// supplied here, the default uses EDITION_PATTERN and accepts it
			// as an edition; with a Set-backed predicate restricted to the
			// real editions, the parser surfaces a "not a known edition" error.
			const knownEditions = new Set(['8083-25C']);
			const result = parseHandbooksLocator('phak/8083-99Z/12', (_doc, c) => knownEditions.has(c));
			expect(result.kind).toBe('error');
			if (result.kind !== 'error') return;
			expect(result.message).toMatch(/not a known edition/);
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
