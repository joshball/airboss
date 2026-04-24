/**
 * `sync-to-disk` job handler.
 *
 * Flow (matches spec + design.md):
 *   1. Take pg_advisory_xact_lock so only one sync runs at a time.
 *   2. Read current DB state for references + sources (live rows + revs).
 *   3. Detect drift vs on-disk TOML.
 *   4. Detect conflict vs the last successful sync's rev_snapshot.
 *   5. If no drift -> outcome = noop, clear dirty flags.
 *   6. If conflict -> outcome = conflict, leave dirty flags, write sync_log.
 *   7. Emit TOML + aviation.ts bodies.
 *   8. Commit (local) or commit + push + gh pr create (pr mode).
 *   9. Clear dirty flags, write sync_log (success), audit.
 *
 * The core state machine (`executeSync`) takes pre-loaded state + writer
 * callbacks so tests can exercise every branch without a DB or filesystem.
 * `runSync` wraps `executeSync` with the real DB transaction + loaders;
 * `runSyncJob` wraps `runSync` with the `@ab/hangar-jobs` JobContext
 * adapter.
 */

import { AUDIT_OPS, auditWrite } from '@ab/audit';
import type { Reference, Source } from '@ab/aviation';
import {
	AUDIT_TARGETS,
	ENV_VARS,
	getEnv,
	HANGAR_SYNC_MODE_VALUES,
	HANGAR_SYNC_MODES,
	type HangarSyncMode,
	SYNC_OUTCOMES,
	type SyncOutcome,
} from '@ab/constants';
import {
	db as defaultDb,
	type HangarReferenceRow,
	type HangarSourceRow,
	type HangarSyncLogRow,
	hangarReference,
	hangarSource,
	hangarSyncLog,
} from '@ab/db';
import type { JobContext } from '@ab/hangar-jobs';
import { generateHangarSyncLogId } from '@ab/utils';
import { and, desc, eq, isNull, sql } from 'drizzle-orm';
import type { PgDatabase, PgQueryResultHKT } from 'drizzle-orm/pg-core';
import { commitAndMaybePr } from './commit-and-maybe-pr';
import { baselineFromSyncLog, detectConflict } from './detect-conflict';
import { detectDrift } from './detect-drift';
import { emitAviationTs } from './emit-aviation-ts';
import { emitToml } from './emit-toml';
import { nodeProcessRunner, type ProcessRunner } from './git';
import { AVIATION_TS_PATH, RELATIVE_PATHS, SYNC_ADVISORY_LOCK_KEY } from './paths';
import { rowToReference, rowToSource } from './to-domain';
import type { ConflictEntry, DriftReport, FileWrites, SyncResult } from './types';

type Db = PgDatabase<PgQueryResultHKT, Record<string, never>>;

/** Log sink used by the core state machine + job adapter. */
export type SyncLogFn = (stream: 'event' | 'stderr', line: string) => Promise<void>;

/**
 * Injectable configuration. Defaults resolve to production behaviour
 * (`Bun.spawn` runner, the shared `db` connection, `HANGAR_SYNC_MODE`
 * from env). Tests override each field to drive specific outcomes.
 */
export interface RunSyncConfig {
	db?: Db;
	runner?: ProcessRunner;
	/** Explicit mode override; falls back to `HANGAR_SYNC_MODE` env var. */
	mode?: HangarSyncMode;
	/** Filesystem reader for drift detection. Lets tests avoid real IO. */
	readFile?: (path: string) => Promise<string | null>;
	/** Deterministic `now()` for branch names + timestamps in tests. */
	now?: () => string;
	/** Branch name factory in `pr` mode. Tests inject a stable value. */
	branchName?: () => string;
}

/**
 * Resolve the sync mode from config or env. Unknown env values fall back
 * to `commit-local` (dev default).
 */
export function resolveSyncMode(config: RunSyncConfig): HangarSyncMode {
	if (config.mode) return config.mode;
	const raw = getEnv(ENV_VARS.HANGAR_SYNC_MODE, HANGAR_SYNC_MODES.COMMIT_LOCAL);
	if ((HANGAR_SYNC_MODE_VALUES as readonly string[]).includes(raw)) {
		return raw as HangarSyncMode;
	}
	return HANGAR_SYNC_MODES.COMMIT_LOCAL;
}

/** State the sync reads from the DB before taking any write decision. */
export interface LoadedState {
	refs: readonly Reference[];
	sources: readonly Source[];
	refRows: readonly HangarReferenceRow[];
	sourceRows: readonly HangarSourceRow[];
	lastSync: HangarSyncLogRow | null;
}

/** Writer callbacks the core state machine invokes when it decides an outcome. */
export interface SyncWriters {
	/** Clear dirty flags for the given ids. Empty ids-list is a no-op. */
	clearDirty: (refIds: readonly string[], sourceIds: readonly string[]) => Promise<void>;
	/** Persist a sync_log row. Returns the inserted row (used for audit target id). */
	writeSyncLog: (input: {
		actorId: string | null;
		mode: HangarSyncMode;
		outcome: SyncOutcome;
		files: readonly string[];
		commitSha: string | null;
		prUrl: string | null;
		message: string;
		revSnapshot: { references: Record<string, number>; sources: Record<string, number> } | null;
	}) => Promise<HangarSyncLogRow>;
	/** Write an audit row tagged `AUDIT_TARGETS.HANGAR_SYNC`. */
	auditSync: (input: {
		actorId: string | null;
		syncLogId: string;
		outcome: SyncOutcome;
		metadata: Record<string, unknown>;
	}) => Promise<void>;
	/** Commit files to git (or open a PR). */
	commit: (
		writes: FileWrites,
		mode: HangarSyncMode,
		summary: string,
		actorId: string | null,
	) => Promise<import('./types').CommitOutcome>;
}

function revMap<T extends { id: string; rev: number }>(rows: readonly T[]): Record<string, number> {
	const out: Record<string, number> = {};
	for (const row of rows) out[row.id] = row.rev;
	return out;
}

function formatSummary(ref: number, src: number): string {
	return `sync ${ref} reference${ref === 1 ? '' : 's'}, ${src} source${src === 1 ? '' : 's'}`;
}

function conflictMessage(conflicts: readonly ConflictEntry[]): string {
	const first = conflicts[0];
	if (!first) return 'sync aborted: conflict detected';
	return `sync aborted: ${conflicts.length} row${conflicts.length === 1 ? '' : 's'} advanced since last sync (first: ${first.kind} ${first.id}, rev ${first.lastSyncedRev} -> ${first.currentRev})`;
}

/**
 * Core state machine. Pure of DB / filesystem / child processes: all IO is
 * funneled through `writers` and `options.readFile`. Exported so tests can
 * hit each branch (success, noop, conflict) with zero setup.
 */
export async function executeSync(input: {
	state: LoadedState;
	mode: HangarSyncMode;
	actorId: string | null;
	writers: SyncWriters;
	readFile?: (path: string) => Promise<string | null>;
	log?: SyncLogFn;
}): Promise<SyncResult> {
	const { state, mode, actorId, writers } = input;
	const log = input.log ?? (async () => {});

	await log('event', `starting sync (mode=${mode})`);
	await log('event', `loaded ${state.refs.length} reference(s), ${state.sources.length} source(s)`);

	const drift: DriftReport = await detectDrift(
		{
			references: state.refs,
			sources: state.sources,
			rows: {
				references: state.refRows.map((r) => ({ kind: 'reference' as const, id: r.id, dirty: r.dirty })),
				sources: state.sourceRows.map((r) => ({ kind: 'source' as const, id: r.id, dirty: r.dirty })),
			},
		},
		{ readFile: input.readFile },
	);
	await log(
		'event',
		`drift: ${drift.entries.length} entr${drift.entries.length === 1 ? 'y' : 'ies'}, ${drift.files.length} file(s) to write`,
	);

	const currentRefRevs = revMap(state.refRows);
	const currentSourceRevs = revMap(state.sourceRows);

	const conflicts = detectConflict({
		referenceRevs: currentRefRevs,
		sourceRevs: currentSourceRevs,
		baseline: baselineFromSyncLog(state.lastSync),
	});

	if (conflicts.hasConflict) {
		const message = conflictMessage(conflicts.entries);
		await log('stderr', message);
		const syncLogRow = await writers.writeSyncLog({
			actorId,
			mode,
			outcome: SYNC_OUTCOMES.CONFLICT,
			files: [],
			commitSha: null,
			prUrl: null,
			message,
			revSnapshot: null,
		});
		await writers.auditSync({
			actorId,
			syncLogId: syncLogRow.id,
			outcome: SYNC_OUTCOMES.CONFLICT,
			metadata: { conflicts: conflicts.entries.length },
		});
		return { outcome: SYNC_OUTCOMES.CONFLICT, commit: null, drift, conflicts: conflicts.entries, message };
	}

	if (drift.entries.length === 0) {
		const message = 'sync noop: db state already matches disk';
		const syncLogRow = await writers.writeSyncLog({
			actorId,
			mode,
			outcome: SYNC_OUTCOMES.NOOP,
			files: [],
			commitSha: null,
			prUrl: null,
			message,
			revSnapshot: { references: currentRefRevs, sources: currentSourceRevs },
		});
		await writers.auditSync({
			actorId,
			syncLogId: syncLogRow.id,
			outcome: SYNC_OUTCOMES.NOOP,
			metadata: {},
		});
		return { outcome: SYNC_OUTCOMES.NOOP, commit: null, drift, conflicts: [], message };
	}

	const tomlWrites = emitToml(state.refs, state.sources);
	const aviationTs = emitAviationTs(state.refs);
	const writes: FileWrites = { ...tomlWrites, [AVIATION_TS_PATH]: aviationTs };

	const summary = formatSummary(state.refs.length, state.sources.length);
	const commit = await writers.commit(writes, mode, summary, actorId);
	await log('event', `committed ${commit.sha} on ${commit.branch}`);
	if (commit.prUrl) await log('event', `opened PR: ${commit.prUrl}`);

	const dirtyRefIds = state.refRows.filter((r) => r.dirty).map((r) => r.id);
	const dirtySourceIds = state.sourceRows.filter((r) => r.dirty).map((r) => r.id);
	await writers.clearDirty(dirtyRefIds, dirtySourceIds);

	const relativeFiles = [RELATIVE_PATHS.GLOSSARY_TOML, RELATIVE_PATHS.SOURCES_TOML, RELATIVE_PATHS.AVIATION_TS];
	const syncLogRow = await writers.writeSyncLog({
		actorId,
		mode,
		outcome: SYNC_OUTCOMES.SUCCESS,
		files: relativeFiles,
		commitSha: commit.sha,
		prUrl: commit.prUrl,
		message: `hangar: ${summary}`,
		revSnapshot: { references: currentRefRevs, sources: currentSourceRevs },
	});
	await writers.auditSync({
		actorId,
		syncLogId: syncLogRow.id,
		outcome: SYNC_OUTCOMES.SUCCESS,
		metadata: {
			commitSha: commit.sha,
			prUrl: commit.prUrl,
			files: relativeFiles,
			dirtyRefs: dirtyRefIds.length,
			dirtySources: dirtySourceIds.length,
		},
	});

	return { outcome: SYNC_OUTCOMES.SUCCESS, commit, drift, conflicts: [], message: `hangar: ${summary}` };
}

/**
 * Load `LoadedState` from the DB. Filters soft-deleted rows (deleted_at is
 * null) and picks the most recent successful sync as the conflict baseline.
 */
export async function loadState(db: Db): Promise<LoadedState> {
	const refRows = await db.select().from(hangarReference).where(isNull(hangarReference.deletedAt));
	const sourceRows = await db.select().from(hangarSource).where(isNull(hangarSource.deletedAt));
	const [lastSync] = await db
		.select()
		.from(hangarSyncLog)
		.where(eq(hangarSyncLog.outcome, SYNC_OUTCOMES.SUCCESS))
		.orderBy(desc(hangarSyncLog.startedAt))
		.limit(1);
	return {
		refRows,
		sourceRows,
		refs: refRows.map(rowToReference),
		sources: sourceRows.map(rowToSource),
		lastSync: lastSync ?? null,
	};
}

/** Build the real writers backed by `db` + the git runner. */
function makeWriters(input: {
	db: Db;
	runner: ProcessRunner;
	now?: () => string;
	branchName?: () => string;
}): SyncWriters {
	const { db, runner } = input;
	return {
		clearDirty: async (refIds, sourceIds) => {
			if (refIds.length > 0) {
				await db
					.update(hangarReference)
					.set({ dirty: false })
					.where(and(eq(hangarReference.dirty, true), sql`${hangarReference.id} = ANY(${refIds})`));
			}
			if (sourceIds.length > 0) {
				await db
					.update(hangarSource)
					.set({ dirty: false })
					.where(and(eq(hangarSource.dirty, true), sql`${hangarSource.id} = ANY(${sourceIds})`));
			}
		},
		writeSyncLog: async (values) => {
			const [row] = await db
				.insert(hangarSyncLog)
				.values({
					id: generateHangarSyncLogId(),
					actorId: values.actorId,
					kind: values.mode,
					files: values.files,
					commitSha: values.commitSha,
					prUrl: values.prUrl,
					outcome: values.outcome,
					message: values.message,
					revSnapshot: values.revSnapshot,
					finishedAt: new Date(),
				})
				.returning();
			return row;
		},
		auditSync: async (values) => {
			await auditWrite(
				{
					actorId: values.actorId,
					op: AUDIT_OPS.UPDATE,
					targetType: AUDIT_TARGETS.HANGAR_SYNC,
					targetId: values.syncLogId,
					metadata: { outcome: values.outcome, ...values.metadata },
				},
				db,
			);
		},
		commit: async (writes, mode, summary, actorId) =>
			commitAndMaybePr({
				writes,
				mode,
				actorId,
				summary,
				runner,
				now: input.now,
				branchName: input.branchName,
			}),
	};
}

/**
 * Wrap `executeSync` in a DB transaction with the real loaders + writers.
 * The advisory lock lives inside the transaction so a crash before commit
 * auto-releases it. Accepts a `log` sink (wired to the JobContext in the
 * handler; silent by default).
 */
export async function runSync(input: {
	actorId: string | null;
	config?: RunSyncConfig;
	log?: SyncLogFn;
}): Promise<SyncResult> {
	const config = input.config ?? {};
	const db = config.db ?? defaultDb;
	const runner = config.runner ?? nodeProcessRunner;
	const mode = resolveSyncMode(config);

	return db.transaction(async (tx) => {
		await tx.execute(sql`select pg_advisory_xact_lock(${SYNC_ADVISORY_LOCK_KEY})`);
		const state = await loadState(tx);
		const writers = makeWriters({ db: tx, runner, now: config.now, branchName: config.branchName });
		return executeSync({
			state,
			mode,
			actorId: input.actorId,
			writers,
			readFile: config.readFile,
			log: input.log,
		});
	});
}

/**
 * Job handler entry: wires the generic `@ab/hangar-jobs` `JobContext` to
 * `runSync`. The worker invokes this when it picks up a `sync-to-disk`
 * job. Progress + log streams are mirrored from `ctx` into the sync's
 * internal log sink.
 */
export async function runSyncJob(ctx: JobContext): Promise<Record<string, unknown>> {
	await ctx.reportProgress({ step: 1, total: 3, message: 'starting sync' });
	const log: SyncLogFn = async (stream, line) => {
		if (stream === 'stderr') await ctx.logStderr(line);
		else await ctx.logEvent(line);
	};

	await ctx.reportProgress({ step: 2, total: 3, message: 'syncing' });
	const result = await runSync({ actorId: ctx.job.actorId, log });

	await ctx.reportProgress({ step: 3, total: 3, message: `done (${result.outcome})` });
	await ctx.logEvent(result.message);

	return {
		outcome: result.outcome,
		commitSha: result.commit?.sha ?? null,
		prUrl: result.commit?.prUrl ?? null,
		driftedRows: result.drift.entries.length,
		conflicts: result.conflicts.length,
	};
}
