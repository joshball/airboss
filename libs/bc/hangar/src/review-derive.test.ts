/**
 * Pure-function tests for the in-memory derive helpers used by the
 * `/review` board: `getDerivedColumnName`, `resolveItemColumnId`,
 * `filterItemsByCriteria`. These don't need the live DB.
 */

import { describe, expect, test } from 'vitest';
import { filterItemsByCriteria, getDerivedColumnName, resolveItemColumnId } from './review';

describe('getDerivedColumnName', () => {
	test('null/null defaults to Backlog', () => {
		expect(getDerivedColumnName(null, null)).toBe('Backlog');
	});

	test('unread defaults to Backlog regardless of review_status', () => {
		expect(getDerivedColumnName('unread', null)).toBe('Backlog');
		expect(getDerivedColumnName('unread', 'pending')).toBe('Backlog');
		expect(getDerivedColumnName('unread', 'done')).toBe('Backlog');
	});

	test('reading goes to In Progress', () => {
		expect(getDerivedColumnName('reading', null)).toBe('In Progress');
		expect(getDerivedColumnName('reading', 'pending')).toBe('In Progress');
	});

	test('done + pending review_status goes to Review', () => {
		expect(getDerivedColumnName('done', 'pending')).toBe('Review');
		expect(getDerivedColumnName('done', null)).toBe('Review');
	});

	test('done + done review_status goes to Done', () => {
		expect(getDerivedColumnName('done', 'done')).toBe('Done');
	});
});

describe('resolveItemColumnId', () => {
	const columns = [
		{ id: 'col_backlog', name: 'Backlog' },
		{ id: 'col_inprogress', name: 'In Progress' },
		{ id: 'col_review', name: 'Review' },
		{ id: 'col_done', name: 'Done' },
	];

	test('returns the pinned column when set', () => {
		const item = { pinnedColumnId: 'col_done', frontmatterStatus: 'unread' as const, reviewStatus: null };
		expect(resolveItemColumnId(item, columns)).toBe('col_done');
	});

	test('falls through to derived column when not pinned', () => {
		const item = { pinnedColumnId: null, frontmatterStatus: 'reading' as const, reviewStatus: null };
		expect(resolveItemColumnId(item, columns)).toBe('col_inprogress');
	});

	test('null frontmatter and no pin lands in Backlog', () => {
		const item = { pinnedColumnId: null, frontmatterStatus: null, reviewStatus: null };
		expect(resolveItemColumnId(item, columns)).toBe('col_backlog');
	});

	test('falls back to first column when derived name is missing from board', () => {
		const partial = [{ id: 'col_only', name: 'Only' }];
		const item = { pinnedColumnId: null, frontmatterStatus: 'done' as const, reviewStatus: 'done' as const };
		expect(resolveItemColumnId(item, partial)).toBe('col_only');
	});

	test('throws when board has no columns at all', () => {
		const item = { pinnedColumnId: null, frontmatterStatus: null, reviewStatus: null };
		expect(() => resolveItemColumnId(item, [])).toThrow();
	});
});

describe('filterItemsByCriteria', () => {
	const items = [
		{ id: 'a', kindId: 'wp_spec', frontmatterStatus: 'unread' as const, reviewStatus: 'pending' as const },
		{ id: 'b', kindId: 'wp_spec', frontmatterStatus: 'reading' as const, reviewStatus: null },
		{ id: 'c', kindId: 'wp_test_plan', frontmatterStatus: 'done' as const, reviewStatus: 'done' as const },
		{ id: 'd', kindId: 'ad_hoc', frontmatterStatus: null, reviewStatus: null },
	];

	test('kind filter narrows to matching kind only', () => {
		const out = filterItemsByCriteria(items, { kind: 'wp_spec' });
		expect(out.map((i) => i.id)).toEqual(['a', 'b']);
	});

	test('frontmatterStatus filter narrows to matching set', () => {
		const out = filterItemsByCriteria(items, { kind: 'wp_spec', frontmatterStatus: ['unread'] });
		expect(out.map((i) => i.id)).toEqual(['a']);
	});

	test('reviewStatus filter narrows to matching set', () => {
		const out = filterItemsByCriteria(items, { reviewStatus: ['done'] });
		expect(out.map((i) => i.id)).toEqual(['c']);
	});

	test('kind-only criteria with no other predicates matches every item of that kind', () => {
		const out = filterItemsByCriteria(items, { kind: 'ad_hoc' });
		expect(out.map((i) => i.id)).toEqual(['d']);
	});

	test('noPassingSession excludes ids in the passingSessionItemIds set', () => {
		const passing = new Set(['c']);
		const out = filterItemsByCriteria(items, { kind: 'wp_test_plan', noPassingSession: true }, passing);
		expect(out).toEqual([]);
	});

	test('noPassingSession with empty passing-set keeps everything', () => {
		const out = filterItemsByCriteria(items, { kind: 'wp_test_plan', noPassingSession: true });
		expect(out.map((i) => i.id)).toEqual(['c']);
	});

	test('items with null frontmatterStatus do not match a status filter', () => {
		const out = filterItemsByCriteria(items, { frontmatterStatus: ['unread'] });
		expect(out.map((i) => i.id)).toEqual(['a']);
	});

	test('empty criteria returns the full input', () => {
		const out = filterItemsByCriteria(items, {});
		expect(out).toEqual(items);
	});
});
