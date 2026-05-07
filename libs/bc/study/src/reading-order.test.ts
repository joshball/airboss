/**
 * Reading-order helper tests. Pure functions over a synthetic
 * `ReferenceSectionRow` tree -- no DB. Covers:
 *   - depth-first walk by ordinal
 *   - chapter-context resolution (own chapter; nested under chapter; whole-doc
 *     with no chapter row)
 *   - prev/next neighbours
 *   - first/last/single-section/empty edge cases
 *   - word counts strip markdown noise
 *
 * The flightbag prev/next/up nav, the TOC drawer, and the read-progress
 * counter all consume this output, so the synthetic fixtures cover one row
 * per corpus shape we care about (handbook, AIM, CFR, AC, ACS).
 */

import { REFERENCE_SECTION_LEVELS } from '@ab/constants';
import { describe, expect, it } from 'vitest';
import {
	computeReadingOrder,
	getNextInReadingOrder,
	getPreviousInReadingOrder,
	type ReadingOrderEntry,
} from './references';
import type { ReferenceSectionRow } from './schema';

// Build a section row with sensible defaults for tests. The scaffolding
// fields (timestamps, source locator, hashes) don't influence reading-order
// computation -- only `id`, `parentId`, `ordinal`, `code`, `level`, `depth`,
// `title`, `contentMd` matter.
let counter = 0;
function row(
	overrides: Partial<ReferenceSectionRow> & Pick<ReferenceSectionRow, 'id' | 'parentId' | 'ordinal' | 'code'>,
): ReferenceSectionRow {
	counter += 1;
	return {
		referenceId: 'ref_test',
		level: REFERENCE_SECTION_LEVELS.SECTION,
		depth: 1,
		title: `Title ${counter}`,
		contentMd: '',
		contentHash: 'h',
		airbossRef: 'airboss-ref:test',
		hasFigures: false,
		hasTables: false,		sourceLocator: null,
		metadata: {},
		seedOrigin: null,
		createdAt: new Date(0),
		updatedAt: new Date(0),
		...overrides,
	} as ReferenceSectionRow;
}

describe('computeReadingOrder', () => {
	it('walks depth-first by ordinal: handbook (chapter -> sections)', () => {
		const ch1 = row({
			id: 'ch1',
			parentId: null,
			ordinal: 0,
			code: '1',
			level: REFERENCE_SECTION_LEVELS.CHAPTER,
			depth: 0,
			title: 'Chapter 1',
		});
		const sec1_1 = row({ id: 's1.1', parentId: 'ch1', ordinal: 0, code: '1.1', title: 'Section 1.1' });
		const sec1_2 = row({ id: 's1.2', parentId: 'ch1', ordinal: 1, code: '1.2', title: 'Section 1.2' });
		const ch2 = row({
			id: 'ch2',
			parentId: null,
			ordinal: 1,
			code: '2',
			level: REFERENCE_SECTION_LEVELS.CHAPTER,
			depth: 0,
			title: 'Chapter 2',
		});
		const sec2_1 = row({ id: 's2.1', parentId: 'ch2', ordinal: 0, code: '2.1', title: 'Section 2.1' });

		// Pass in any input order; computeReadingOrder sorts by ordinal.
		const order = computeReadingOrder([sec2_1, ch1, ch2, sec1_2, sec1_1]);

		expect(order.map((e) => e.code)).toEqual(['1', '1.1', '1.2', '2', '2.1']);
		// Chapter rows have no parentChapter (they ARE the chapter context).
		expect(order[0]?.parentChapterCode).toBe(null);
		expect(order[3]?.parentChapterCode).toBe(null);
		// Sections name their chapter ancestor.
		expect(order[1]?.parentChapterCode).toBe('1');
		expect(order[1]?.parentChapterTitle).toBe('Chapter 1');
		expect(order[4]?.parentChapterCode).toBe('2');
	});

	it('handles AIM-style nesting (chapter -> section -> paragraph)', () => {
		const ch = row({
			id: 'aim1',
			parentId: null,
			ordinal: 0,
			code: '1',
			level: REFERENCE_SECTION_LEVELS.CHAPTER,
			depth: 0,
			title: 'AIM Chapter 1',
		});
		const sec = row({
			id: 'aim1-1',
			parentId: 'aim1',
			ordinal: 0,
			code: '1-1',
			depth: 1,
			title: 'AIM 1-1',
		});
		const p1 = row({ id: 'aim1-1-1', parentId: 'aim1-1', ordinal: 0, code: '1-1-1', depth: 2, title: 'AIM 1-1-1' });
		const p2 = row({ id: 'aim1-1-2', parentId: 'aim1-1', ordinal: 1, code: '1-1-2', depth: 2, title: 'AIM 1-1-2' });

		const order = computeReadingOrder([ch, sec, p1, p2]);
		expect(order.map((e) => e.code)).toEqual(['1', '1-1', '1-1-1', '1-1-2']);
		// Paragraph rows still resolve to the top chapter, not the immediate
		// section parent.
		expect(order[2]?.parentChapterCode).toBe('1');
		expect(order[3]?.parentChapterCode).toBe('1');
	});

	it('handles whole-doc corpus (no chapter row): top row is its own chapter context', () => {
		const doc = row({
			id: 'doc',
			parentId: null,
			ordinal: 0,
			code: 'doc',
			level: REFERENCE_SECTION_LEVELS.DOCUMENT,
			depth: 0,
			title: 'Whole Doc',
		});
		const sub = row({ id: 'sub', parentId: 'doc', ordinal: 0, code: 'doc/1', depth: 1, title: 'Sub' });

		const order = computeReadingOrder([doc, sub]);
		expect(order[0]?.parentChapterCode).toBe(null);
		// The top-level non-chapter row counts as the chapter context for its
		// children -- so the section names "doc" as its container.
		expect(order[1]?.parentChapterCode).toBe('doc');
		expect(order[1]?.parentChapterTitle).toBe('Whole Doc');
	});

	it('handles CFR-style (subpart -> section): subpart serves as chapter context', () => {
		const subpart = row({
			id: 'sp-A',
			parentId: null,
			ordinal: 0,
			code: 'A',
			level: REFERENCE_SECTION_LEVELS.SECTION,
			depth: 0,
			title: 'Subpart A',
		});
		const sec103 = row({ id: 'cfr103', parentId: 'sp-A', ordinal: 0, code: '103', depth: 1, title: '§103' });
		const sec105 = row({ id: 'cfr105', parentId: 'sp-A', ordinal: 1, code: '105', depth: 1, title: '§105' });

		const order = computeReadingOrder([subpart, sec103, sec105]);
		expect(order.map((e) => e.code)).toEqual(['A', '103', '105']);
		expect(order[1]?.parentChapterCode).toBe('A');
		expect(order[2]?.parentChapterCode).toBe('A');
	});

	it('returns empty for empty input', () => {
		expect(computeReadingOrder([])).toEqual([]);
	});

	it('counts words: strips markdown noise', () => {
		const r = row({
			id: 'r',
			parentId: null,
			ordinal: 0,
			code: 'r',
			contentMd: '# Title\n\nHello world this is a [link](https://example.com).\n\n```\ncode block\n```\n',
		});
		const order = computeReadingOrder([r]);
		// Words: "Title Hello world this is a link." (period stays attached to
		// "link"; punctuation isn't split). Fenced code block + URL stripped.
		expect(order[0]?.wordCount).toBe(7);
	});

	it('counts words: handles only-code-blocks body', () => {
		const r = row({
			id: 'r',
			parentId: null,
			ordinal: 0,
			code: 'r',
			contentMd: '```\nint x = 1;\nint y = 2;\n```\n',
		});
		const order = computeReadingOrder([r]);
		expect(order[0]?.wordCount).toBe(0);
	});

	it('counts words: handles inline code + bold + headings', () => {
		const r = row({
			id: 'r',
			parentId: null,
			ordinal: 0,
			code: 'r',
			contentMd: '## Section\n\n**Bold word** and `inline code` and a list:\n\n- one\n- two\n',
		});
		const order = computeReadingOrder([r]);
		// Words after stripping: "Section Bold word and and a list one two"
		// (inline code is stripped by `\`...\``; bold markup removed)
		expect(order[0]?.wordCount).toBe(9);
	});

	it('returns 0 word count for empty body', () => {
		const r = row({ id: 'r', parentId: null, ordinal: 0, code: 'r', contentMd: '' });
		const order = computeReadingOrder([r]);
		expect(order[0]?.wordCount).toBe(0);
	});
});

describe('getNextInReadingOrder / getPreviousInReadingOrder', () => {
	const order: ReadingOrderEntry[] = [
		{
			sectionId: 'a',
			code: 'a',
			title: 'A',
			depth: 0,
			level: REFERENCE_SECTION_LEVELS.CHAPTER,
			parentId: null,
			parentChapterCode: null,
			parentChapterTitle: null,
			wordCount: 0,
		},
		{
			sectionId: 'b',
			code: 'b',
			title: 'B',
			depth: 1,
			level: REFERENCE_SECTION_LEVELS.SECTION,
			parentId: 'a',
			parentChapterCode: 'a',
			parentChapterTitle: 'A',
			wordCount: 0,
		},
		{
			sectionId: 'c',
			code: 'c',
			title: 'C',
			depth: 1,
			level: REFERENCE_SECTION_LEVELS.SECTION,
			parentId: 'a',
			parentChapterCode: 'a',
			parentChapterTitle: 'A',
			wordCount: 0,
		},
	];

	it('next: middle -> last', () => {
		expect(getNextInReadingOrder(order, 'b')?.sectionId).toBe('c');
	});

	it('next: last -> null', () => {
		expect(getNextInReadingOrder(order, 'c')).toBe(null);
	});

	it('prev: middle -> first', () => {
		expect(getPreviousInReadingOrder(order, 'b')?.sectionId).toBe('a');
	});

	it('prev: first -> null', () => {
		expect(getPreviousInReadingOrder(order, 'a')).toBe(null);
	});

	it('unknown section: both helpers return null', () => {
		expect(getNextInReadingOrder(order, 'unknown')).toBe(null);
		expect(getPreviousInReadingOrder(order, 'unknown')).toBe(null);
	});

	it('single-entry order: prev and next both null', () => {
		const single: ReadingOrderEntry[] = [
			{
				sectionId: 'only',
				code: 'only',
				title: 'Only',
				depth: 0,
				level: REFERENCE_SECTION_LEVELS.DOCUMENT,
				parentId: null,
				parentChapterCode: null,
				parentChapterTitle: null,
				wordCount: 0,
			},
		];
		expect(getNextInReadingOrder(single, 'only')).toBe(null);
		expect(getPreviousInReadingOrder(single, 'only')).toBe(null);
	});
});
