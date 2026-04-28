/**
 * End-to-end tests for the `sync-to-disk` state machine.
 *
 * Uses `executeSync` (the pure core) so no DB / filesystem / child process
 * is touched. The three code paths are covered:
 *   - happy path: drift detected, files emitted, writers called in order,
 *     sync_log = success, audit = 1 row.
 *   - conflict path: DB rev advanced past the baseline -> writers abort,
 *     sync_log = conflict, no commit, dirty flags NOT cleared.
 *   - `pr` mode wiring: `commitAndMaybePr` is invoked with the right mode
 *     (the underlying git / gh process calls are tested separately via the
 *     injected runner in the integration test below).
 */

import type { Reference } from '@ab/aviation';
import { encodeReferences, encodeSources } from '@ab/aviation';
import type { HangarReferenceRow, HangarSyncLogRow } from '@ab/bc-hangar/schema';
import { HANGAR_SYNC_MODES, SYNC_OUTCOMES } from '@ab/constants';
import { describe, expect, it } from 'vitest';
import { commitAndMaybePr } from './commit-and-maybe-pr';
import type { ProcessCall, ProcessResult, ProcessRunner } from './git';
import { executeSync, type LoadedState, type SyncWriters } from './run-sync-job';
import type { CommitOutcome, FileWrites } from './types';

function makeReferenceRow(id: string, rev = 1, dirty = false, paraphrase = 'body'): HangarReferenceRow {
	const now = new Date();
	return {
		id,
		rev,
		displayName: id.toUpperCase(),
		aliases: [],
		paraphrase,
		tags: {
			sourceType: 'cfr',
			aviationTopic: ['regulations'],
			flightRules: 'both',
			knowledgeKind: 'reference',
		},
		sources: [],
		related: [],
		author: null,
		reviewedAt: null,
		verbatim: null,
		dirty,
		updatedBy: null,
		deletedAt: null,
		createdAt: now,
		updatedAt: now,
	};
}

function makeReference(row: HangarReferenceRow): Reference {
	return {
		id: row.id,
		displayName: row.displayName,
		aliases: row.aliases,
		paraphrase: row.paraphrase,
		tags: row.tags as Reference['tags'],
		sources: [],
		related: [],
	};
}

interface WriterSpy {
	writers: SyncWriters;
	readonly syncLogs: {
		outcome: string;
		commitSha: string | null;
		prUrl: string | null;
		message: string;
		files: readonly string[];
	}[];
	readonly audits: { outcome: string; syncLogId: string; metadata: Record<string, unknown> }[];
	readonly clears: { refs: readonly string[]; sources: readonly string[] }[];
	readonly commits: { mode: string; summary: string; actorId: string | null; writes: FileWrites }[];
}

function makeWriterSpy(options: { commitOutcome?: CommitOutcome; lastSyncLogId?: string } = {}): WriterSpy {
	const syncLogs: WriterSpy['syncLogs'] = [];
	const audits: WriterSpy['audits'] = [];
	const clears: WriterSpy['clears'] = [];
	const commits: WriterSpy['commits'] = [];
	let counter = 0;
	const writers: SyncWriters = {
		clearDirty: async (refIds, sourceIds) => {
			clears.push({ refs: refIds, sources: sourceIds });
		},
		writeSyncLog: async (values) => {
			const id = options.lastSyncLogId ?? `syn_test_${++counter}`;
			syncLogs.push({
				outcome: values.outcome,
				commitSha: values.commitSha,
				prUrl: values.prUrl,
				message: values.message,
				files: values.files,
			});
			const row: HangarSyncLogRow = {
				id,
				actorId: values.actorId,
				kind: values.mode,
				files: values.files,
				commitSha: values.commitSha,
				prUrl: values.prUrl,
				outcome: values.outcome,
				message: values.message,
				revSnapshot: values.revSnapshot,
				startedAt: new Date(),
				finishedAt: new Date(),
			};
			return row;
		},
		auditSync: async (values) => {
			audits.push({ outcome: values.outcome, syncLogId: values.syncLogId, metadata: values.metadata });
		},
		commit: async (writes, mode, summary, actorId) => {
			commits.push({ mode, summary, actorId, writes });
			return (
				options.commitOutcome ?? {
					mode,
					sha: 'abc1234',
					branch: 'main',
					files: [
						'libs/db/seed/glossary.toml',
						'libs/db/seed/sources.toml',
						'libs/aviation/src/references/aviation.ts',
					],
					prUrl: null,
				}
			);
		},
	};
	return { writers, syncLogs, audits, clears, commits };
}

describe('executeSync -- happy path', () => {
	it('writes two files, logs success, audits once, clears dirty flags', async () => {
		const refRow = makeReferenceRow('ref-edited', 2, true, 'edited body');
		const onDiskRef = { ...makeReference(refRow), paraphrase: 'old body' };
		const state: LoadedState = {
			refRows: [refRow],
			sourceRows: [],
			refs: [makeReference(refRow)],
			sources: [],
			lastSync: null,
		};
		const glossaryOnDisk = encodeReferences([onDiskRef]);
		const sourcesOnDisk = encodeSources([]);

		const spy = makeWriterSpy();
		const result = await executeSync({
			state,
			mode: HANGAR_SYNC_MODES.COMMIT_LOCAL,
			actorId: 'user-1',
			writers: spy.writers,
			readFile: async (path) => {
				if (path.endsWith('glossary.toml')) return glossaryOnDisk;
				if (path.endsWith('sources.toml')) return sourcesOnDisk;
				return null;
			},
		});

		expect(result.outcome).toBe(SYNC_OUTCOMES.SUCCESS);
		expect(result.commit?.sha).toBe('abc1234');
		expect(spy.commits.length).toBe(1);
		expect(spy.commits[0]?.mode).toBe(HANGAR_SYNC_MODES.COMMIT_LOCAL);
		expect(Object.keys(spy.commits[0]?.writes ?? {})).toEqual(
			expect.arrayContaining([
				expect.stringContaining('glossary.toml'),
				expect.stringContaining('sources.toml'),
				expect.stringContaining('aviation.ts'),
			]),
		);
		expect(spy.syncLogs.length).toBe(1);
		expect(spy.syncLogs[0]?.outcome).toBe(SYNC_OUTCOMES.SUCCESS);
		expect(spy.audits.length).toBe(1);
		expect(spy.audits[0]?.outcome).toBe(SYNC_OUTCOMES.SUCCESS);
		expect(spy.clears.length).toBe(1);
		expect(spy.clears[0]?.refs).toEqual(['ref-edited']);
		expect(spy.clears[0]?.sources).toEqual([]);
	});
});

describe('executeSync -- conflict path', () => {
	it('writes a conflict sync_log, skips commit, leaves dirty flags set', async () => {
		const refRow = makeReferenceRow('ref-a', 3, true, 'edited');
		const baseline: HangarSyncLogRow = {
			id: 'syn_baseline',
			actorId: 'user-0',
			kind: 'commit-local',
			files: [],
			commitSha: 'baseline-sha',
			prUrl: null,
			outcome: 'success',
			message: 'baseline',
			revSnapshot: { references: { 'ref-a': 1 }, sources: {} },
			startedAt: new Date(),
			finishedAt: new Date(),
		};
		const state: LoadedState = {
			refRows: [refRow],
			sourceRows: [],
			refs: [makeReference(refRow)],
			sources: [],
			lastSync: baseline,
		};

		const spy = makeWriterSpy();
		const result = await executeSync({
			state,
			mode: HANGAR_SYNC_MODES.COMMIT_LOCAL,
			actorId: 'user-2',
			writers: spy.writers,
			readFile: async () => '',
		});

		expect(result.outcome).toBe(SYNC_OUTCOMES.CONFLICT);
		expect(result.commit).toBeNull();
		expect(result.conflicts.length).toBe(1);
		expect(spy.commits.length).toBe(0);
		expect(spy.clears.length).toBe(0);
		expect(spy.syncLogs.length).toBe(1);
		expect(spy.syncLogs[0]?.outcome).toBe(SYNC_OUTCOMES.CONFLICT);
		expect(spy.syncLogs[0]?.commitSha).toBeNull();
		expect(spy.audits[0]?.outcome).toBe(SYNC_OUTCOMES.CONFLICT);
	});
});

describe('executeSync -- noop path', () => {
	it('returns noop when nothing is dirty and disk matches db', async () => {
		const refRow = makeReferenceRow('ref-clean', 1, false, 'same');
		const ref = makeReference(refRow);
		const state: LoadedState = {
			refRows: [refRow],
			sourceRows: [],
			refs: [ref],
			sources: [],
			lastSync: null,
		};
		const glossaryOnDisk = encodeReferences([ref]);
		const sourcesOnDisk = encodeSources([]);

		const spy = makeWriterSpy();
		const result = await executeSync({
			state,
			mode: HANGAR_SYNC_MODES.COMMIT_LOCAL,
			actorId: 'user-3',
			writers: spy.writers,
			readFile: async (path) => {
				if (path.endsWith('glossary.toml')) return glossaryOnDisk;
				if (path.endsWith('sources.toml')) return sourcesOnDisk;
				return null;
			},
		});

		expect(result.outcome).toBe(SYNC_OUTCOMES.NOOP);
		expect(spy.commits.length).toBe(0);
		expect(spy.clears.length).toBe(0);
		expect(spy.syncLogs[0]?.outcome).toBe(SYNC_OUTCOMES.NOOP);
	});
});

describe('commitAndMaybePr -- pr mode with fake runner', () => {
	it('creates a branch, pushes, and opens a PR via gh', async () => {
		const calls: ProcessCall[] = [];
		const runner: ProcessRunner = async (call) => {
			calls.push(call);
			if (call.cmd === 'git' && call.args[0] === 'rev-parse' && call.args[1] === '--abbrev-ref') {
				return { exitCode: 0, stdout: 'main\n', stderr: '' } satisfies ProcessResult;
			}
			if (call.cmd === 'git' && call.args[0] === 'rev-parse' && call.args[1] === 'HEAD') {
				return { exitCode: 0, stdout: 'deadbeef1234\n', stderr: '' } satisfies ProcessResult;
			}
			if (call.cmd === 'gh') {
				return { exitCode: 0, stdout: 'https://github.com/example/repo/pull/42\n', stderr: '' } satisfies ProcessResult;
			}
			return { exitCode: 0, stdout: '', stderr: '' } satisfies ProcessResult;
		};

		// Writes go to tmp files; we don't care about the filesystem assertion
		// here, the test is about argv + mode wiring.
		const { mkdtemp } = await import('node:fs/promises');
		const { tmpdir } = await import('node:os');
		const { join } = await import('node:path');
		const dir = await mkdtemp(join(tmpdir(), 'hangar-sync-test-'));
		const writes: FileWrites = {
			[join(dir, 'glossary.toml')]: '# glossary\n',
			[join(dir, 'sources.toml')]: '# sources\n',
			[join(dir, 'aviation.ts')]: '// generated\n',
		};

		const outcome = await commitAndMaybePr({
			writes,
			mode: HANGAR_SYNC_MODES.PR,
			actorId: 'user-1',
			summary: 'sync 1 reference, 0 sources',
			runner,
			cwd: dir,
			now: () => '2026-04-24T00:00:00.000Z',
			branchName: () => 'hangar-sync/2026-04-24',
		});

		expect(outcome.mode).toBe(HANGAR_SYNC_MODES.PR);
		expect(outcome.sha).toBe('deadbeef1234');
		expect(outcome.branch).toBe('hangar-sync/2026-04-24');
		expect(outcome.prUrl).toBe('https://github.com/example/repo/pull/42');

		const ghCall = calls.find((c) => c.cmd === 'gh');
		expect(ghCall).toBeDefined();
		expect(ghCall?.args).toContain('pr');
		expect(ghCall?.args).toContain('create');
		expect(ghCall?.args).toContain('--body-file');
		expect(ghCall?.args).toContain('-');
		expect(ghCall?.stdin).toContain('sync 1 reference, 0 sources');

		const pushCall = calls.find((c) => c.cmd === 'git' && c.args[0] === 'push');
		expect(pushCall?.args).toEqual(['push', '-u', 'origin', 'hangar-sync/2026-04-24']);

		const checkoutCall = calls.find((c) => c.cmd === 'git' && c.args[0] === 'checkout');
		expect(checkoutCall?.args).toEqual(['checkout', '-b', 'hangar-sync/2026-04-24']);
	});

	it('in commit-local mode stays on the current branch and never calls gh', async () => {
		const calls: ProcessCall[] = [];
		const runner: ProcessRunner = async (call) => {
			calls.push(call);
			if (call.cmd === 'git' && call.args[0] === 'rev-parse' && call.args[1] === '--abbrev-ref') {
				return { exitCode: 0, stdout: 'feature-branch\n', stderr: '' } satisfies ProcessResult;
			}
			if (call.cmd === 'git' && call.args[0] === 'rev-parse' && call.args[1] === 'HEAD') {
				return { exitCode: 0, stdout: 'cafebabe\n', stderr: '' } satisfies ProcessResult;
			}
			return { exitCode: 0, stdout: '', stderr: '' } satisfies ProcessResult;
		};

		const { mkdtemp } = await import('node:fs/promises');
		const { tmpdir } = await import('node:os');
		const { join } = await import('node:path');
		const dir = await mkdtemp(join(tmpdir(), 'hangar-sync-local-'));

		const outcome = await commitAndMaybePr({
			writes: { [join(dir, 'f.toml')]: 'body' },
			mode: HANGAR_SYNC_MODES.COMMIT_LOCAL,
			actorId: null,
			summary: 'noop summary',
			runner,
			cwd: dir,
		});

		expect(outcome.mode).toBe(HANGAR_SYNC_MODES.COMMIT_LOCAL);
		expect(outcome.prUrl).toBeNull();
		expect(outcome.branch).toBe('feature-branch');
		expect(calls.find((c) => c.cmd === 'gh')).toBeUndefined();
		expect(calls.find((c) => c.cmd === 'git' && c.args[0] === 'push')).toBeUndefined();
		expect(calls.find((c) => c.cmd === 'git' && c.args[0] === 'checkout')).toBeUndefined();
	});
});
