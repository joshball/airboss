/**
 * Upload job handler. The form action writes the incoming file to a temp path
 * and enqueues an `upload-source` job with the temp path in `payload`. This
 * handler picks the job up, archives the prior binary if a version changed,
 * moves the temp file into place at `data/sources/<type>/<id>.<ext>`, and
 * updates the `hangar.source` row with the new checksum + size + timestamp.
 *
 * Keeping the archive dance in a job handler (rather than the action) gives
 * us the same restart-recovery + cancellation + logging behaviour every
 * other source operation has.
 */

import { constants as fsConstants } from 'node:fs';
import fs from 'node:fs/promises';
import { resolve } from 'node:path';
import { AUDIT_OPS, auditWrite } from '@ab/audit';
import { computeFileHash } from '@ab/aviation/sources';
import { AUDIT_TARGETS, SOURCE_ACTION_LIMITS } from '@ab/constants';
import { db as defaultDb, hangarSource } from '@ab/db';
import type { JobContext, JobHandler } from '@ab/hangar-jobs';
import { and, eq } from 'drizzle-orm';
import type { PgDatabase, PgQueryResultHKT } from 'drizzle-orm/pg-core';
import { REPO_ROOT } from './source-jobs';
import { archiveFilename, destFilename, extensionOf, isNoChange, pickArchivesToPrune } from './upload-helpers';

type Db = PgDatabase<PgQueryResultHKT, Record<string, never>>;

export interface UploadJobPayload {
	sourceId: string;
	/** Absolute path where the form action wrote the uploaded bytes. */
	tempPath: string;
	/** Original client-supplied filename; used to derive the extension. */
	originalFilename: string;
	/** Content size, in bytes, for quick eligibility checks before hashing. */
	sizeBytes: number;
	/** Optional version override when the source version advances. */
	version?: string;
}

async function pathExists(path: string): Promise<boolean> {
	try {
		await fs.access(path, fsConstants.F_OK);
		return true;
	} catch {
		return false;
	}
}

export interface UploadHandlerOptions {
	db?: Db;
	repoRoot?: string;
	now?: () => Date;
}

export function makeUploadHandler(options: UploadHandlerOptions = {}): JobHandler {
	const db = options.db ?? defaultDb;
	const repoRoot = options.repoRoot ?? REPO_ROOT;
	const now = options.now ?? (() => new Date());

	return async (ctx: JobContext): Promise<Record<string, unknown>> => {
		const payload = ctx.job.payload as Partial<UploadJobPayload>;
		if (!payload || typeof payload.sourceId !== 'string' || typeof payload.tempPath !== 'string') {
			throw new Error(`upload job ${ctx.job.id} missing sourceId / tempPath`);
		}
		const { sourceId, tempPath, originalFilename, sizeBytes } = payload as UploadJobPayload;

		if (sizeBytes > SOURCE_ACTION_LIMITS.MAX_UPLOAD_BYTES) {
			throw new Error(`upload size ${sizeBytes} exceeds limit ${SOURCE_ACTION_LIMITS.MAX_UPLOAD_BYTES}`);
		}

		await ctx.reportProgress({ step: 1, total: 4, message: 'looking up source' });
		const [existing] = await db.select().from(hangarSource).where(eq(hangarSource.id, sourceId)).limit(1);
		if (!existing) throw new Error(`upload job ${ctx.job.id}: source '${sourceId}' not found`);
		if (existing.deletedAt) throw new Error(`upload job ${ctx.job.id}: source '${sourceId}' is deleted`);

		const ext = extensionOf(originalFilename) || extensionOf(existing.path) || existing.format || 'bin';
		const destDir = resolve(repoRoot, 'data', 'sources', existing.type);
		const destPath = resolve(destDir, destFilename(sourceId, ext));

		await ctx.reportProgress({ step: 2, total: 4, message: 'hashing upload' });
		const sha256 = await computeFileHash(tempPath);
		await ctx.logEvent(`sha256=${sha256} size=${sizeBytes}`);

		if (isNoChange(existing.checksum, sha256)) {
			await ctx.logEvent('no change: sha matches current checksum');
			await fs.unlink(tempPath).catch(() => {});
			await finalizeAudit(ctx, sourceId, {
				outcome: 'no-change',
				checksum: sha256,
			});
			return { kind: 'upload', outcome: 'no-change', sha256 };
		}

		await fs.mkdir(destDir, { recursive: true });

		const newVersion = payload.version?.trim() || existing.version;
		const versionChanged = newVersion !== existing.version;
		if (versionChanged && (await pathExists(destPath))) {
			const archivePath = resolve(destDir, archiveFilename(sourceId, existing.version, ext));
			await fs.rename(destPath, archivePath);
			await ctx.logEvent(`archived ${destPath} -> ${archivePath}`);
			await pruneOldArchives(destDir, sourceId, ext, SOURCE_ACTION_LIMITS.ARCHIVE_RETENTION, ctx);
		}

		await ctx.reportProgress({ step: 3, total: 4, message: 'writing destination' });
		await fs.rename(tempPath, destPath);
		await ctx.logEvent(`wrote ${destPath}`);

		await ctx.reportProgress({ step: 4, total: 4, message: 'updating registry' });
		const updatedAt = now();
		const [updated] = await db
			.update(hangarSource)
			.set({
				rev: existing.rev + 1,
				checksum: sha256,
				downloadedAt: updatedAt.toISOString(),
				sizeBytes,
				version: newVersion,
				path: `data/sources/${existing.type}/${sourceId}.${ext}`,
				dirty: true,
				updatedBy: ctx.job.actorId,
				updatedAt,
			})
			.where(and(eq(hangarSource.id, sourceId), eq(hangarSource.rev, existing.rev)))
			.returning();

		if (!updated) {
			throw new Error(`upload job ${ctx.job.id}: source row rev advanced mid-upload`);
		}

		await finalizeAudit(ctx, sourceId, {
			outcome: versionChanged ? 'replaced' : 'updated',
			checksum: sha256,
			sizeBytes,
			version: newVersion,
		});

		return {
			kind: 'upload',
			outcome: versionChanged ? 'replaced' : 'updated',
			sha256,
			sizeBytes,
			destPath,
			archived: versionChanged,
		};
	};
}

async function finalizeAudit(ctx: JobContext, sourceId: string, extras: Record<string, unknown>): Promise<void> {
	await auditWrite({
		actorId: ctx.job.actorId,
		op: AUDIT_OPS.UPDATE,
		targetType: AUDIT_TARGETS.HANGAR_SOURCE,
		targetId: sourceId,
		metadata: { jobKind: ctx.job.kind, jobId: ctx.job.id, ...extras },
	});
}

/**
 * Keep at most `keep` archived versions of a source binary. Names sort
 * lexicographically by `<id>@<version>.<ext>` so the newest version string
 * wins when the source uses year-style versioning ("2025", "2026"), which
 * is what every FAA regulatory document does.
 */
async function pruneOldArchives(
	destDir: string,
	sourceId: string,
	ext: string,
	keep: number,
	ctx: JobContext,
): Promise<void> {
	let entries: string[];
	try {
		entries = await fs.readdir(destDir);
	} catch {
		return;
	}
	const prefix = `${sourceId}@`;
	const suffix = `.${ext}`;
	const archives = entries.filter((name) => name.startsWith(prefix) && name.endsWith(suffix));
	const toDelete = pickArchivesToPrune(archives, keep);
	for (const name of toDelete) {
		const path = resolve(destDir, name);
		await fs.unlink(path).catch(() => {});
		await ctx.logEvent(`pruned archive ${path}`);
	}
}
