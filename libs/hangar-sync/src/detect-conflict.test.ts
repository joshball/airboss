/**
 * `detectConflict` tests.
 *
 * Contract:
 *   - DB rev > baseline rev -> conflict (cause: 'advanced')
 *   - equal revs -> no conflict
 *   - ids in current absent from baseline -> no conflict (new rows
 *     cannot conflict with a snapshot that never saw them)
 *   - ids in baseline absent from current AND not soft-deleted -> conflict
 *     (cause: 'deleted'; row was hard-deleted out of band)
 *   - ids in baseline absent from current BUT soft-deleted -> no conflict
 *     (intentional deletion the sync should propagate via detectDrift)
 *   - malformed rev_snapshot jsonb -> baseline parses to null -> no
 *     conflict (degrades to "no last successful sync" instead of
 *     crashing)
 */

import { describe, expect, it } from 'vitest';
import { baselineFromSyncLog, detectConflict } from './detect-conflict';

describe('detectConflict', () => {
	it('flags a ref whose rev advanced past the baseline (cause = advanced)', () => {
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
			cause: 'advanced',
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
		expect(report.entries[0]?.cause).toBe('advanced');
		expect(report.entries[0]?.currentRev).toBe(4);
		expect(report.entries[0]?.lastSyncedRev).toBe(2);
	});

	it('flags a baseline ref missing from current as cause = deleted (hard-delete)', () => {
		const report = detectConflict({
			referenceRevs: {},
			sourceRevs: {},
			baseline: { references: { 'ref-gone': 4 }, sources: {} },
		});
		expect(report.hasConflict).toBe(true);
		expect(report.entries.length).toBe(1);
		expect(report.entries[0]).toEqual({
			kind: 'reference',
			id: 'ref-gone',
			cause: 'deleted',
			currentRev: null,
			lastSyncedRev: 4,
		});
	});

	it('does NOT flag a baseline ref absent from current when it is tracked as a soft-delete', () => {
		const report = detectConflict({
			referenceRevs: {},
			sourceRevs: {},
			baseline: { references: { 'ref-trash': 5 }, sources: {} },
			deletedIds: { references: ['ref-trash'] },
		});
		expect(report.hasConflict).toBe(false);
		expect(report.entries).toEqual([]);
	});

	it('flags hard-deleted source baseline ids symmetrically', () => {
		const report = detectConflict({
			referenceRevs: {},
			sourceRevs: {},
			baseline: { references: {}, sources: { 'src-gone': 7 } },
			deletedIds: { sources: [] },
		});
		expect(report.hasConflict).toBe(true);
		expect(report.entries.length).toBe(1);
		expect(report.entries[0]?.kind).toBe('source');
		expect(report.entries[0]?.cause).toBe('deleted');
		expect(report.entries[0]?.currentRev).toBeNull();
		expect(report.entries[0]?.lastSyncedRev).toBe(7);
	});

	it('mixes advanced + deleted causes in one report', () => {
		const report = detectConflict({
			referenceRevs: { 'ref-a': 5 },
			sourceRevs: {},
			baseline: { references: { 'ref-a': 4, 'ref-gone': 1 }, sources: {} },
		});
		expect(report.hasConflict).toBe(true);
		expect(report.entries.length).toBe(2);
		const causes = report.entries.map((e) => e.cause).sort();
		expect(causes).toEqual(['advanced', 'deleted']);
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

	it('returns the snapshot when present and well-shaped', () => {
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

	it('returns null when the persisted snapshot is malformed (Zod shape mismatch)', () => {
		// Simulate corruption / shape drift: a manual SQL fixup or a future
		// migration that changes the column shape. Read-side must not crash.
		const malformed = { references: { a: 'not-a-number' }, sources: {} };
		const out = baselineFromSyncLog({
			id: 'syn_test',
			actorId: null,
			kind: 'commit-local',
			files: [],
			commitSha: null,
			prUrl: null,
			outcome: 'success',
			message: 'x',
			// Force the malformed payload through the typed cast --
			// the whole point of the runtime guard is that the type
			// assertion can be wrong.
			revSnapshot: malformed as unknown as {
				references: Readonly<Record<string, number>>;
				sources: Readonly<Record<string, number>>;
			},
			startedAt: new Date(),
			finishedAt: new Date(),
		});
		expect(out).toBeNull();
	});
});
