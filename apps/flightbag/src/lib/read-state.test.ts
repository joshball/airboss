/**
 * Unit tests for `loadReadSetForReference`. The helper translates a list of
 * `ReferenceSectionReadStateRow` rows into the `Set<string>` of section ids
 * the TOC drawer renders with checkmarks.
 */

import type { ReferenceSectionReadStateRow } from '@ab/bc-study/server';
import { HANDBOOK_READ_STATUSES } from '@ab/constants';
import { describe, expect, test, vi } from 'vitest';

vi.mock('@ab/bc-study/server', async (importOriginal) => {
	const actual = await importOriginal<typeof import('@ab/bc-study/server')>();
	return {
		...actual,
		listReadStatesForReference: vi.fn(),
	};
});

import { listReadStatesForReference } from '@ab/bc-study/server';
import { loadReadSetForReference } from './read-state';

function row(referenceSectionId: string, status: ReferenceSectionReadStateRow['status']): ReferenceSectionReadStateRow {
	return {
		userId: 'user_1',
		referenceSectionId,
		status,
		comprehended: false,
		lastReadAt: new Date(),
		openedCount: 1,
		totalSecondsVisible: 60,
		notesMd: '',
		seedOrigin: null,
		createdAt: new Date(),
		updatedAt: new Date(),
	};
}

describe('loadReadSetForReference', () => {
	test('returns empty set for anonymous (null userId) without hitting the DB', async () => {
		const result = await loadReadSetForReference(null, 'ref_1');
		expect(result).toEqual(new Set());
		expect(listReadStatesForReference).not.toHaveBeenCalled();
	});

	test('includes sections with status reading or read', async () => {
		vi.mocked(listReadStatesForReference).mockResolvedValueOnce([
			row('s_1', HANDBOOK_READ_STATUSES.READ),
			row('s_2', HANDBOOK_READ_STATUSES.READING),
			row('s_3', HANDBOOK_READ_STATUSES.UNREAD),
		]);
		const result = await loadReadSetForReference('user_1', 'ref_1');
		expect(result).toEqual(new Set(['s_1', 's_2']));
	});

	test('returns empty set when no rows exist', async () => {
		vi.mocked(listReadStatesForReference).mockResolvedValueOnce([]);
		const result = await loadReadSetForReference('user_1', 'ref_1');
		expect(result).toEqual(new Set());
	});
});
