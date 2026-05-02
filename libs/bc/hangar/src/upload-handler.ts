/**
 * Upload job handler. The form action writes the incoming file to a temp path
 * and enqueues an `upload-source` job with the temp path in `payload`. This
 * handler picks the job up, archives the prior binary, atomically installs
 * the new bytes at `<hangar-blob-root>/<type>/<id>.<ext>`, and updates the
 * `hangar.source` row with the new checksum + size + timestamp.
 *
 * Atomicity contract:
 *
 *   1. Hash the temp file. If sha matches the existing row's checksum -> no
 *      change; the temp file is removed and the audit row is emitted with
 *      `outcome: 'no-change'`.
 *   2. Otherwise, copy/rename the temp file into a STAGE path inside `destDir`
 *      (`<id>.<ext>.uploading-<random>`) so the final rename stays on the
 *      same filesystem.
 *   3. Archive the existing destPath (if any). Same-version re-uploads with
 *      different bytes use `<id>@<version>-<oldShaPrefix>.<ext>` so multiple
 *      same-version uploads never clobber each other; version-bumped uploads
 *      use `<id>@<oldVersion>.<ext>`.
 *   4. Atomic `rename(stagePath -> destPath)`.
 *   5. Update the `hangar.source` row.
 *
 * On any failure between steps 3 and 5, the handler restores the archived
 * file back to destPath. The end state is one of:
 *
 *   - both archive + new destPath in place + DB row updated (success)
 *   - prior destPath unchanged + DB row unchanged (failure)
 *
 * never:
 *
 *   - DB row pointing at a missing or wrong file
 *   - silent overwrite of the prior binary
 *
 * Every terminal state (no-change, success, failure) emits one
 * `AUDIT_TARGETS.HANGAR_SOURCE` row so per-source audit queries surface
 * failed uploads, not just successful ones.
 *
 * Keeping this dance in a job handler (rather than the action) gives us the
 * same restart-recovery + cancellation + logging behaviour every other
 * source operation has.
 */

import { randomBytes } from 'node:crypto';
import { constants as fsConstants } from 'node:fs';
import fs from 'node:fs/promises';
import { join, resolve } from 'node:path';
import { AUDIT_OPS, auditWrite } from '@ab/audit';
import { computeFileHash } from '@ab/aviation/sources';
import { AUDIT_TARGETS, SOURCE_ACTION_LIMITS } from '@ab/constants';
import { db as defaultDb } from '@ab/db/connection';
import type { JobContext, JobHandler } from '@ab/hangar-jobs';
import { and, eq } from 'drizzle-orm';
import type { PgDatabase, PgQueryResultHKT } from 'drizzle-orm/pg-core';
import { resolveHangarBlobRoot } from './blob-root';
import { hangarSource } from './schema';
import {
	archiveFilename,
	archiveFilenameWithChecksum,
	destFilename,
	extensionOf,
	isNoChange,
	pickArchivesToPrune,
	stageFilename,
} from './upload-helpers';

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
	/**
	 * Override the hangar blob root. Tests pass a per-test tmp directory; the
	 * handler creates `<blobRoot>/<type>/...` underneath.
	 */
	blobRoot?: string;
	now?: () => Date;
}

export function makeUploadHandler(options: UploadHandlerOptions = {}): JobHandler {
	const db = options.db ?? defaultDb;
	const blobRoot = options.blobRoot ?? resolveHangarBlobRoot();
	const now = options.now ?? (() => new Date());

	return async (ctx: JobContext): Promise<Record<string, unknown>> => {
		const payload = ctx.job.payload as Partial<UploadJobPayload>;
		if (!payload || typeof payload.sourceId !== 'string' || typeof payload.tempPath !== 'string') {
			throw new Error(`upload job ${ctx.job.id} missing sourceId / tempPath`);
		}
		const { sourceId, tempPath, originalFilename, sizeBytes } = payload as UploadJobPayload;

		if (sizeBytes > SOURCE_ACTION_LIMITS.MAX_UPLOAD_BYTES) {
			await finalizeAudit(ctx, sourceId, {
				outcome: 'failed',
				reason: 'oversize',
				sizeBytes,
				limitBytes: SOURCE_ACTION_LIMITS.MAX_UPLOAD_BYTES,
			}).catch(() => {});
			throw new Error(`upload size ${sizeBytes} exceeds limit ${SOURCE_ACTION_LIMITS.MAX_UPLOAD_BYTES}`);
		}

		try {
			await ctx.reportProgress({ step: 1, total: 4, message: 'looking up source' });
			const [existing] = await db.select().from(hangarSource).where(eq(hangarSource.id, sourceId)).limit(1);
			if (!existing) throw new Error(`upload job ${ctx.job.id}: source '${sourceId}' not found`);
			if (existing.deletedAt) throw new Error(`upload job ${ctx.job.id}: source '${sourceId}' is deleted`);

			const ext = extensionOf(originalFilename) || extensionOf(existing.path) || existing.format || 'bin';
			const destDir = resolve(blobRoot, existing.type);
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

			// Stage the new bytes inside destDir so the final install is a
			// same-filesystem rename. tempPath sits in os.tmpdir() which on
			// many hosts is a different mount point.
			const stageSuffix = randomBytes(8).toString('hex');
			const stagePath = resolve(destDir, stageFilename(sourceId, ext, stageSuffix));
			try {
				await fs.rename(tempPath, stagePath);
			} catch (err) {
				// Cross-device rename: fall back to copy+unlink so the bytes
				// still land in destDir for the atomic install step.
				if (typeof err === 'object' && err !== null && (err as { code?: string }).code === 'EXDEV') {
					await fs.copyFile(tempPath, stagePath);
					await fs.unlink(tempPath).catch(() => {});
				} else {
					throw err;
				}
			}

			// Archive prior bytes BEFORE installing the new file. We only get
			// here when sha differs from existing.checksum, so any extant
			// destPath is data we must preserve. Use a checksum-suffixed name
			// when the version did not advance so same-version re-uploads do
			// not clobber each other.
			let archivePath: string | null = null;
			let archived = false;
			if (await pathExists(destPath)) {
				archivePath = versionChanged
					? resolve(destDir, archiveFilename(sourceId, existing.version, ext))
					: resolve(destDir, archiveFilenameWithChecksum(sourceId, existing.version, existing.checksum, ext));
				try {
					await fs.rename(destPath, archivePath);
					archived = true;
					await ctx.logEvent(`archived ${destPath} -> ${archivePath}`);
				} catch (archiveErr) {
					// Archive failed; do not proceed with install. Best-effort
					// stage cleanup so we do not leak bytes.
					await fs.unlink(stagePath).catch(() => {});
					throw archiveErr;
				}
			}

			// Atomic install. On failure, roll back the archive so the source
			// row's pointer remains valid.
			await ctx.reportProgress({ step: 3, total: 4, message: 'writing destination' });
			try {
				await fs.rename(stagePath, destPath);
			} catch (renameErr) {
				if (archived && archivePath) {
					// Best-effort rollback: restore the archived file. If this
					// throws too, surface the original rename error since it
					// is the operator-actionable cause.
					await fs.rename(archivePath, destPath).catch(async (rollbackErr) => {
						await ctx.logStderr(
							`rollback of archive '${archivePath}' -> '${destPath}' failed: ${rollbackErr instanceof Error ? rollbackErr.message : String(rollbackErr)}`,
						);
					});
				}
				await fs.unlink(stagePath).catch(() => {});
				throw renameErr;
			}
			await ctx.logEvent(`wrote ${destPath}`);

			// Prune older archives now that the new edition slot is full.
			await pruneOldArchives(destDir, sourceId, ext, SOURCE_ACTION_LIMITS.ARCHIVE_RETENTION, ctx);

			await ctx.reportProgress({ step: 4, total: 4, message: 'updating registry' });
			const updatedAt = now();
			let updated: typeof hangarSource.$inferSelect | undefined;
			try {
				[updated] = await db
					.update(hangarSource)
					.set({
						rev: existing.rev + 1,
						checksum: sha256,
						downloadedAt: updatedAt.toISOString(),
						sizeBytes,
						version: newVersion,
						path: join(existing.type, `${sourceId}.${ext}`),
						dirty: true,
						updatedBy: ctx.job.actorId,
						updatedAt,
					})
					.where(and(eq(hangarSource.id, sourceId), eq(hangarSource.rev, existing.rev)))
					.returning();
			} catch (dbErr) {
				// DB failed AFTER the on-disk install completed. Roll the
				// bytes back to the prior state so the row still points at a
				// valid file.
				await rollbackInstall({ archived, archivePath, destPath, ctx });
				throw dbErr;
			}

			if (!updated) {
				await rollbackInstall({ archived, archivePath, destPath, ctx });
				throw new Error(`upload job ${ctx.job.id}: source row rev advanced mid-upload`);
			}

			await finalizeAudit(ctx, sourceId, {
				outcome: versionChanged ? 'replaced' : 'updated',
				checksum: sha256,
				sizeBytes,
				version: newVersion,
				archived,
			});

			return {
				kind: 'upload',
				outcome: versionChanged ? 'replaced' : 'updated',
				sha256,
				sizeBytes,
				destPath,
				archived,
			};
		} catch (err) {
			// Emit a `failed` audit row for any error we did not already
			// audit. The size-cap branch above audits before throwing;
			// reaching here means a different failure mode (lookup, hash,
			// archive, rename, db).
			const message = err instanceof Error ? err.message : String(err);
			await finalizeAudit(ctx, sourceId, { outcome: 'failed', error: message }).catch(() => {});
			// Best-effort temp cleanup so a failed run does not leak bytes.
			await fs.unlink(tempPath).catch(() => {});
			throw err;
		}
	};
}

interface RollbackInstallArgs {
	archived: boolean;
	archivePath: string | null;
	destPath: string;
	ctx: JobContext;
}

async function rollbackInstall({ archived, archivePath, destPath, ctx }: RollbackInstallArgs): Promise<void> {
	if (!archived || !archivePath) return;
	// Remove the (possibly partial) new install if present, then restore the
	// archive so the on-disk state matches the unchanged DB row.
	await fs.unlink(destPath).catch(() => {});
	await fs.rename(archivePath, destPath).catch(async (err) => {
		await ctx.logStderr(
			`post-install rollback failed: archive='${archivePath}' destPath='${destPath}' err=${err instanceof Error ? err.message : String(err)}`,
		);
	});
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
