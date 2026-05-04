/**
 * Tests for `computeSiblingNav` -- the reader's prev/next/up calculator.
 */

import type { ReferenceSectionRow } from '@ab/bc-study';
import { describe, expect, test } from 'vitest';
import { computeSiblingNav } from './section-nav';

function row(partial: Partial<ReferenceSectionRow>): ReferenceSectionRow {
	const base: ReferenceSectionRow = {
		id: 'rs_x',
		referenceId: 'ref_a',
		parentId: null,
		level: 'section',
		ordinal: 0,
		depth: 0,
		code: 'x',
		airbossRef: 'airboss-ref:test',
		title: 'X',
		faaPageStart: null,
		faaPageEnd: null,
		sourceLocator: '',
		contentMd: '',
		contentHash: '',
		hasFigures: false,
		hasTables: false,
		metadata: {},
		seedOrigin: null,
		createdAt: new Date(),
		updatedAt: new Date(),
	};
	return { ...base, ...partial };
}

const tree: ReferenceSectionRow[] = [
	row({ id: 'ch1', code: '1', title: 'Chapter 1', level: 'chapter', ordinal: 1 }),
	row({ id: 'ch1.1', parentId: 'ch1', code: '1.1', title: 'Intro', ordinal: 1 }),
	row({ id: 'ch1.2', parentId: 'ch1', code: '1.2', title: 'Airspace', ordinal: 2 }),
	row({ id: 'ch1.3', parentId: 'ch1', code: '1.3', title: 'Charts', ordinal: 3 }),
	row({ id: 'ch2', code: '2', title: 'Chapter 2', level: 'chapter', ordinal: 2 }),
	row({ id: 'ch2.1', parentId: 'ch2', code: '2.1', title: 'ATC', ordinal: 1 }),
	row({ id: 'ch2.2', parentId: 'ch2', code: '2.2', title: 'Comms', ordinal: 2 }),
];

const href = (r: ReferenceSectionRow): string | null => `/r/${r.id}`;

describe('computeSiblingNav', () => {
	test('returns mid-chapter prev/next inside a single chapter', () => {
		const nav = computeSiblingNav(tree, 'ch1.2', href);
		expect(nav.prev?.id).toBe('ch1.1');
		expect(nav.next?.id).toBe('ch1.3');
		expect(nav.up?.id).toBe('ch1');
	});

	test('wraps "next" from last section to next chapter', () => {
		const nav = computeSiblingNav(tree, 'ch1.3', href);
		expect(nav.prev?.id).toBe('ch1.2');
		expect(nav.next?.id).toBe('ch2');
	});

	test('wraps "prev" from first section to chapter preamble', () => {
		const nav = computeSiblingNav(tree, 'ch1.1', href);
		expect(nav.prev?.id).toBe('ch1');
		expect(nav.next?.id).toBe('ch1.2');
		expect(nav.up?.id).toBe('ch1');
	});

	test('chapter has prev=last-of-prior-chapter, next=first-of-its-children', () => {
		const nav = computeSiblingNav(tree, 'ch2', href);
		expect(nav.prev?.id).toBe('ch1.3');
		expect(nav.next?.id).toBe('ch2.1');
		expect(nav.up).toBeNull();
	});

	test('first chapter has no prev', () => {
		const nav = computeSiblingNav(tree, 'ch1', href);
		expect(nav.prev).toBeNull();
		expect(nav.next?.id).toBe('ch1.1');
		expect(nav.up).toBeNull();
	});

	test('last section of last chapter has no next', () => {
		const nav = computeSiblingNav(tree, 'ch2.2', href);
		expect(nav.prev?.id).toBe('ch2.1');
		expect(nav.next).toBeNull();
		expect(nav.up?.id).toBe('ch2');
	});

	test('skips rows whose hrefFor returns null', () => {
		const skippy = (r: ReferenceSectionRow): string | null => (r.id === 'ch1.2' ? null : `/r/${r.id}`);
		const nav = computeSiblingNav(tree, 'ch1.1', skippy);
		// Skip 1.2 (null href), advance to 1.3.
		expect(nav.next?.id).toBe('ch1.3');
	});

	test('returns nulls when target is not in tree', () => {
		const nav = computeSiblingNav(tree, 'unknown', href);
		expect(nav.prev).toBeNull();
		expect(nav.next).toBeNull();
		expect(nav.up).toBeNull();
	});

	test('respects ordinal ordering even when rows are passed out of order', () => {
		const shuffled = [tree[6], tree[0], tree[2], tree[1], tree[5], tree[3], tree[4]].filter(
			(r): r is ReferenceSectionRow => r !== undefined,
		);
		const nav = computeSiblingNav(shuffled, 'ch1.2', href);
		expect(nav.prev?.id).toBe('ch1.1');
		expect(nav.next?.id).toBe('ch1.3');
	});
});
