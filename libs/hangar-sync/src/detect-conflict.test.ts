/**
 * `detectConflict` tests.
 *
 * Contract from the brief: DB rev=2 with baseline rev=1 -> conflict;
 * equal revs -> no conflict; ids absent from baseline -> no conflict
 * (new rows cannot conflict with a baseline that never saw them).
 */

import { describe, expect, it } from 'vitest';
import { baselineFromSyncLog, detectConflict } from './detect-conflict';

describe('detectConflict', () => {
	it('flags a ref whose rev advanced past the baseline', () => {
		const report = detectConflict({
			referenceRevs: { 'ref-a': 2 },
			sourceRevs: {},
			baseline: { references: { 'ref-a': 1 }, sources: {} },
		});
		expect(report.hasConflict).toBe(true);
		expect(report.entries.length).toBe(1);
		expect(report.entries[0]).toEqual({
			kind: 'reference',
			id: 'ref-a',
			currentRev: 2,
			lastSyncedRev: 1,
		});
	});

	it('reports no conflict when current revs match the baseline', () => {
		const report = detectConflict({
			referenceRevs: { 'ref-a': 1, 'ref-b': 3 },
			sourceRevs: { 'src-a': 1 },
			baseline: { references: { 'ref-a': 1, 'ref-b': 3 }, sources: { 'src-a': 1 } },
		});
		expect(report.hasConflict).toBe(false);
		expect(report.entries).toEqual([]);
	});

	it('ignores ids absent from the baseline (new rows)', () => {
		const report = detectConflict({
			referenceRevs: { 'new-ref': 1 },
			sourceRevs: {},
			baseline: { references: {}, sources: {} },
		});
		expect(report.hasConflict).toBe(false);
	});

	it('reports no conflict when there is no baseline at all', () => {
		const report = detectConflict({
			referenceRevs: { 'ref-a': 5 },
			sourceRevs: { 'src-a': 2 },
			baseline: null,
		});
		expect(report.hasConflict).toBe(false);
	});

	it('flags source drift symmetrically with reference drift', () => {
		const report = detectConflict({
			referenceRevs: {},
			sourceRevs: { 'src-a': 4 },
			baseline: { references: {}, sources: { 'src-a': 2 } },
		});
		expect(report.hasConflict).toBe(true);
		expect(report.entries.length).toBe(1);
		expect(report.entries[0]?.kind).toBe('source');
		expect(report.entries[0]?.currentRev).toBe(4);
		expect(report.entries[0]?.lastSyncedRev).toBe(2);
	});
});

describe('baselineFromSyncLog', () => {
	it('returns null when the row is null', () => {
		expect(baselineFromSyncLog(null)).toBeNull();
	});

	it('returns null when the row has no snapshot', () => {
		expect(
			baselineFromSyncLog({
				id: 'syn_test',
				actorId: null,
				kind: 'commit-local',
				files: [],
				commitSha: null,
				prUrl: null,
				outcome: 'success',
				message: 'x',
				revSnapshot: null,
				startedAt: new Date(),
				finishedAt: new Date(),
			}),
		).toBeNull();
	});

	it('returns the snapshot when present', () => {
		const snap = { references: { a: 1 }, sources: { s: 2 } } as const;
		const out = baselineFromSyncLog({
			id: 'syn_test',
			actorId: null,
			kind: 'commit-local',
			files: [],
			commitSha: null,
			prUrl: null,
			outcome: 'success',
			message: 'x',
			revSnapshot: snap,
			startedAt: new Date(),
			finishedAt: new Date(),
		});
		expect(out).toEqual(snap);
	});
});
