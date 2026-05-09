import { describe, expect, it } from 'vitest';
import { type AcsTocArea, buildAcsTocEntries, findAreaIdForTask } from './acs-toc';

const AREAS: ReadonlyArray<AcsTocArea> = [
	{
		id: 'area-1',
		code: 'I',
		title: 'Preflight Preparation',
		padded: '01',
		tasks: [
			{ id: 'task-1a', code: 'I.A', title: 'Pilot Qualifications', letter: 'a' },
			{ id: 'task-1b', code: 'I.B', title: 'Airworthiness Requirements', letter: 'b' },
		],
	},
	{
		id: 'area-2',
		code: 'II',
		title: 'Preflight Procedures',
		padded: '02',
		tasks: [{ id: 'task-2a', code: 'II.A', title: 'Preflight Assessment', letter: 'a' }],
	},
];

describe('buildAcsTocEntries', () => {
	it('emits one header per area and one entry per task', () => {
		const entries = buildAcsTocEntries({ documentSlug: 'ppl-airplane-acs-6c', areas: AREAS });
		expect(entries).toHaveLength(5);
		// area-1 header
		expect(entries[0]?.sectionId).toBe('area-1');
		expect(entries[0]?.depth).toBe(0);
		expect(entries[0]?.href).toBeNull();
		expect(entries[0]?.groupId).toBeUndefined();
		// area-1 task-a -- groupId references the area row
		expect(entries[1]?.sectionId).toBe('task-1a');
		expect(entries[1]?.depth).toBe(1);
		expect(entries[1]?.href).toBe('/acs/ppl-airplane-acs-6c/area/01/task/a');
		expect(entries[1]?.groupId).toBe('area-1');
	});

	it('marks the active task only', () => {
		const entries = buildAcsTocEntries({
			documentSlug: 'ppl-airplane-acs-6c',
			areas: AREAS,
			activeTaskId: 'task-1b',
		});
		const active = entries.filter((e) => e.isActive);
		expect(active).toHaveLength(1);
		expect(active[0]?.sectionId).toBe('task-1b');
	});

	it('returns no active entries when no task is active (publication landing)', () => {
		const entries = buildAcsTocEntries({
			documentSlug: 'ppl-airplane-acs-6c',
			areas: AREAS,
			activeTaskId: null,
		});
		expect(entries.some((e) => e.isActive)).toBe(false);
	});
});

describe('findAreaIdForTask', () => {
	it('returns the parent area id when the task exists', () => {
		expect(findAreaIdForTask(AREAS, 'task-1b')).toBe('area-1');
		expect(findAreaIdForTask(AREAS, 'task-2a')).toBe('area-2');
	});

	it('returns null for an unknown task id', () => {
		expect(findAreaIdForTask(AREAS, 'task-zzz')).toBeNull();
	});
});
