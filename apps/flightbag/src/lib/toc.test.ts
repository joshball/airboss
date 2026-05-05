/**
 * Tests for the route-side TOC builder. Maps reading-order entries to TOC
 * drawer payload + computes total minutes.
 */

import type { ReadingOrderEntry } from '@ab/bc-study/server';
import { describe, expect, test } from 'vitest';
import { buildTOCEntries, totalReadingMinutes } from './toc';

const order: ReadingOrderEntry[] = [
	{
		sectionId: 'ch1',
		code: '1',
		title: 'NAS',
		depth: 0,
		level: 'chapter',
		parentId: null,
		parentChapterCode: null,
		parentChapterTitle: null,
		wordCount: 250,
	},
	{
		sectionId: 's1.1',
		code: '1.1',
		title: 'Intro',
		depth: 1,
		level: 'section',
		parentId: 'ch1',
		parentChapterCode: '1',
		parentChapterTitle: 'NAS',
		wordCount: 30,
	},
	{
		sectionId: 's1.2',
		code: '1.2',
		title: 'Skipped',
		depth: 1,
		level: 'section',
		parentId: 'ch1',
		parentChapterCode: '1',
		parentChapterTitle: 'NAS',
		wordCount: 600,
	},
];

const href = (e: ReadingOrderEntry): string | null => (e.sectionId === 's1.2' ? null : `/${e.sectionId}`);

describe('buildTOCEntries', () => {
	test('maps every entry; null href passes through; minutes round up', () => {
		const tocs = buildTOCEntries(order, 's1.1', href);
		expect(tocs).toHaveLength(3);
		expect(tocs[0]?.href).toBe('/ch1');
		// 250 / 250 = 1 min
		expect(tocs[0]?.minutesToRead).toBe(1);
		// 30 / 250 = 0.12, but floor is 1 min for non-empty bodies
		expect(tocs[1]?.minutesToRead).toBe(1);
		// 600 / 250 = 2.4 -> 3
		expect(tocs[2]?.minutesToRead).toBe(3);
		// null href passes through.
		expect(tocs[2]?.href).toBe(null);
	});

	test('marks the active section', () => {
		const tocs = buildTOCEntries(order, 's1.2', href);
		expect(tocs[2]?.isActive).toBe(true);
		expect(tocs[1]?.isActive).toBe(false);
	});

	test('passes a null active section: no entry is active', () => {
		const tocs = buildTOCEntries(order, null, href);
		expect(tocs.every((t) => !t.isActive)).toBe(true);
	});
});

describe('totalReadingMinutes', () => {
	test('sums per-entry minutes (each rounded up)', () => {
		// 1 + 1 + 3 = 5
		expect(totalReadingMinutes(order)).toBe(5);
	});

	test('returns 0 for empty order', () => {
		expect(totalReadingMinutes([])).toBe(0);
	});

	test('skips zero-word entries', () => {
		const empty: ReadingOrderEntry[] = [
			{
				sectionId: 'a',
				code: 'a',
				title: 'A',
				depth: 0,
				level: 'chapter',
				parentId: null,
				parentChapterCode: null,
				parentChapterTitle: null,
				wordCount: 0,
			},
		];
		expect(totalReadingMinutes(empty)).toBe(0);
	});
});
