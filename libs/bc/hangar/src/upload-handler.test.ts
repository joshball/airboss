/**
 * Integration tests for the upload job handler. Closes the source-ingest
 * data-integrity findings:
 *
 *   - same-version re-upload archives the prior bytes via a checksum-suffixed
 *     name instead of silently overwriting (correctness critical)
 *   - archive + install pair is atomic: a mid-flow failure rolls back to the
 *     prior on-disk state and leaves the source row pointing at a valid file
 *     (correctness major)
 *   - every terminal state (no-change, success, failure) emits one
 *     `AUDIT_TARGETS.HANGAR_SOURCE` row so per-source audit queries surface
 *     failed uploads, not just successful ones (dx major)
 *
 * Uses the live dev Postgres connection (same pattern as registry.test.ts) so
 * the row + audit emission paths run end-to-end.
 */

import { mkdir, readFile, rm, stat, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { auditLog } from '@ab/audit';
import { bauthUser } from '@ab/auth/schema';
import { db } from '@ab/db/connection';
import type { JobContext } from '@ab/hangar-jobs';
import { generateAuthId, generateHangarJobId } from '@ab/utils';
import { and, eq } from 'drizzle-orm';
import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest';
import { hangarSource } from './schema';
import { makeUploadHandler } from './upload-handler';

const TEST_USER_ID = generateAuthId();
const TEST_EMAIL = `upload-handler-test-${TEST_USER_ID}@airboss.test`;
const ID_PREFIX = `test-uph-${TEST_USER_ID.slice(-12)
	.toLowerCase()
	.replace(/[^a-z0-9]/g, '-')}`;

const TMP_ROOT = join(import.meta.dirname, '__tmp_upload_handler__');
const srcIds: string[] = [];

function srcId(suffix: string): string {
	const id = `${ID_PREFIX}-${suffix}`;
	srcIds.push(id);
	return id;
}

beforeAll(async () => {
	const now = new Date();
	await db
		.insert(bauthUser)
		.values({
			id: TEST_USER_ID,
			email: TEST_EMAIL,
			emailVerified: false,
			name: 'Upload handler test',
			firstName: 'Upload',
			lastName: 'Test',
			createdAt: now,
			updatedAt: now,
		})
		.onConflictDoNothing();
	await mkdir(TMP_ROOT, { recursive: true });
});

afterAll(async () => {
	for (const id of srcIds) {
		await db.delete(hangarSource).where(eq(hangarSource.id, id));
		await db.delete(auditLog).where(and(eq(auditLog.targetType, 'hangar.source'), eq(auditLog.targetId, id)));
	}
	await db.delete(bauthUser).where(eq(bauthUser.id, TEST_USER_ID));
	await rm(TMP_ROOT, { recursive: true, force: true });
});

afterEach(async () => {
	// Fresh blob root per test so file-state assertions are not cross-contaminated.
	await rm(TMP_ROOT, { recursive: true, force: true });
	await mkdir(TMP_ROOT, { recursive: true });
});

async function seedSource(id: string, version: string, sha: string, ext: string): Promise<string> {
	const blobPath = join('cfr', `${id}.${ext}`);
	const now = new Date();
	await db.insert(hangarSource).values({
		id,
		rev: 1,
		type: 'cfr',
		title: id,
		version,
		url: 'https://example.test',
		path: blobPath,
		format: ext,
		checksum: sha,
		downloadedAt: 'seed',
		dirty: false,
		updatedBy: TEST_USER_ID,
		createdAt: now,
		updatedAt: now,
	});
	// Also place a real file on disk so archive logic has something to move.
	const destDir = join(TMP_ROOT, 'cfr');
	await mkdir(destDir, { recursive: true });
	await writeFile(join(destDir, `${id}.${ext}`), Buffer.from('PRIOR-BYTES'));
	return blobPath;
}

interface FakeCtxArgs {
	jobId: string;
	sourceId: string;
	tempPath: string;
	originalFilename: string;
	sizeBytes: number;
	version?: string;
}

function fakeCtx(args: FakeCtxArgs): JobContext {
	return {
		job: {
			id: args.jobId,
			kind: 'upload-source',
			status: 'running',
			targetType: 'hangar.source',
			targetId: args.sourceId,
			actorId: TEST_USER_ID,
			progress: {},
			payload: {
				sourceId: args.sourceId,
				tempPath: args.tempPath,
				originalFilename: args.originalFilename,
				sizeBytes: args.sizeBytes,
				version: args.version,
			},
			result: null,
			error: null,
			startedAt: new Date(),
			finishedAt: null,
			createdAt: new Date(),
		} as unknown as JobContext['job'],
		reportProgress: async () => {},
		logStdout: async () => {},
		logStderr: async () => {},
		logEvent: async () => {},
		isCancelled: async () => false,
	};
}

async function writeUpload(name: string, body: string): Promise<string> {
	const path = join(TMP_ROOT, '__incoming__', name);
	await mkdir(join(TMP_ROOT, '__incoming__'), { recursive: true });
	await writeFile(path, Buffer.from(body));
	return path;
}

async function getRow(id: string) {
	const [row] = await db.select().from(hangarSource).where(eq(hangarSource.id, id)).limit(1);
	return row;
}

async function getAuditRows(sourceId: string) {
	return db
		.select()
		.from(auditLog)
		.where(and(eq(auditLog.targetType, 'hangar.source'), eq(auditLog.targetId, sourceId)));
}

describe('makeUploadHandler -- same-version archive', () => {
	it('archives the prior binary with a checksum-suffixed name when version matches but bytes differ', async () => {
		const id = srcId('same-version');
		await seedSource(id, '2025', 'aa'.repeat(32), 'xml');
		const tempPath = await writeUpload('upload.bin', 'NEW-BYTES');
		const handler = makeUploadHandler({ blobRoot: TMP_ROOT });

		await handler(
			fakeCtx({
				jobId: generateHangarJobId(),
				sourceId: id,
				tempPath,
				originalFilename: 'doc.xml',
				sizeBytes: 9,
				version: '2025',
			}),
		);

		// New bytes are at destPath.
		const dest = await readFile(join(TMP_ROOT, 'cfr', `${id}.xml`), 'utf8');
		expect(dest).toBe('NEW-BYTES');

		// Prior bytes are preserved in a sha-prefixed archive (NOT clobbered).
		const expectedArchive = `${id}@2025-${'aa'.repeat(6)}.xml`;
		const archiveBody = await readFile(join(TMP_ROOT, 'cfr', expectedArchive), 'utf8');
		expect(archiveBody).toBe('PRIOR-BYTES');

		// Row points at destPath with the new sha.
		const row = await getRow(id);
		expect(row?.path).toBe(`cfr/${id}.xml`);
		expect(row?.checksum).not.toBe('aa'.repeat(32));
	});

	it('archives the prior binary with a version-only name when the version advances', async () => {
		const id = srcId('version-bump');
		await seedSource(id, '2025', 'bb'.repeat(32), 'xml');
		const tempPath = await writeUpload('upload.bin', 'NEW-BYTES-2');
		const handler = makeUploadHandler({ blobRoot: TMP_ROOT });

		await handler(
			fakeCtx({
				jobId: generateHangarJobId(),
				sourceId: id,
				tempPath,
				originalFilename: 'doc.xml',
				sizeBytes: 11,
				version: '2026',
			}),
		);

		const archiveBody = await readFile(join(TMP_ROOT, 'cfr', `${id}@2025.xml`), 'utf8');
		expect(archiveBody).toBe('PRIOR-BYTES');
		const row = await getRow(id);
		expect(row?.version).toBe('2026');
	});
});

describe('makeUploadHandler -- atomicity rollback', () => {
	it('restores the prior bytes when the DB update fails after install', async () => {
		const id = srcId('rollback');
		await seedSource(id, '2025', 'cc'.repeat(32), 'xml');
		const tempPath = await writeUpload('upload.bin', 'NEW-BYTES');

		// Fake `db` whose update throws AFTER select returns the existing row.
		const fakeDb = {
			select: db.select.bind(db),
			insert: db.insert.bind(db),
			update: () => {
				throw new Error('simulated db blip mid-upload');
			},
			delete: db.delete.bind(db),
			transaction: db.transaction.bind(db),
		} as unknown as Parameters<typeof makeUploadHandler>[0]['db'];

		const handler = makeUploadHandler({ blobRoot: TMP_ROOT, db: fakeDb });
		await expect(
			handler(
				fakeCtx({
					jobId: generateHangarJobId(),
					sourceId: id,
					tempPath,
					originalFilename: 'doc.xml',
					sizeBytes: 9,
					version: '2025',
				}),
			),
		).rejects.toThrow(/db blip/);

		// On-disk state matches the unchanged DB row: destPath points at the
		// PRIOR bytes (rolled back from archive), not the failed new bytes.
		const destBody = await readFile(join(TMP_ROOT, 'cfr', `${id}.xml`), 'utf8');
		expect(destBody).toBe('PRIOR-BYTES');

		// DB row is untouched.
		const row = await getRow(id);
		expect(row?.checksum).toBe('cc'.repeat(32));
		expect(row?.version).toBe('2025');
	});
});

describe('makeUploadHandler -- audit-on-failure', () => {
	it('emits a HANGAR_SOURCE failed audit row when the upload exceeds MAX_UPLOAD_BYTES', async () => {
		const id = srcId('oversize');
		await seedSource(id, '2025', 'dd'.repeat(32), 'xml');
		const tempPath = await writeUpload('upload.bin', 'x');
		const handler = makeUploadHandler({ blobRoot: TMP_ROOT });

		await expect(
			handler(
				fakeCtx({
					jobId: generateHangarJobId(),
					sourceId: id,
					tempPath,
					originalFilename: 'doc.xml',
					sizeBytes: 99 * 1024 * 1024 * 1024, // 99 GiB -- well over the cap
					version: '2025',
				}),
			),
		).rejects.toThrow(/exceeds limit/);

		const rows = await getAuditRows(id);
		const failed = rows.filter((r) => {
			const md = r.metadata as Record<string, unknown> | null;
			return md && md.outcome === 'failed';
		});
		expect(failed.length).toBeGreaterThanOrEqual(1);
		const md = failed[0]?.metadata as Record<string, unknown>;
		expect(md.reason).toBe('oversize');
	});

	it('emits a failed audit row when the source is missing', async () => {
		const id = srcId('missing');
		// NOTE: do NOT seed -- we want the lookup branch to fail.
		srcIds.push(id);
		const tempPath = await writeUpload('upload.bin', 'NEW-BYTES');
		const handler = makeUploadHandler({ blobRoot: TMP_ROOT });

		await expect(
			handler(
				fakeCtx({
					jobId: generateHangarJobId(),
					sourceId: id,
					tempPath,
					originalFilename: 'doc.xml',
					sizeBytes: 9,
					version: '2025',
				}),
			),
		).rejects.toThrow(/not found/);

		const rows = await getAuditRows(id);
		expect(rows.length).toBeGreaterThanOrEqual(1);
		const md = rows[0]?.metadata as Record<string, unknown>;
		expect(md.outcome).toBe('failed');
		expect(String(md.error ?? '')).toContain('not found');

		// Failed temp path should be cleaned up so the run does not leak bytes.
		await expect(stat(tempPath)).rejects.toBeDefined();
	});

	it('emits a `no-change` audit row when the upload sha matches the existing checksum', async () => {
		const id = srcId('no-change');
		// Seed with a known sha that we know up front. We compute the sha of
		// the body we are about to write so the handler short-circuits.
		const body = 'IDENTICAL';
		const { createHash } = await import('node:crypto');
		const sha = createHash('sha256').update(body).digest('hex');
		await seedSource(id, '2025', sha, 'xml');
		const tempPath = await writeUpload('upload.bin', body);
		const handler = makeUploadHandler({ blobRoot: TMP_ROOT });

		const result = await handler(
			fakeCtx({
				jobId: generateHangarJobId(),
				sourceId: id,
				tempPath,
				originalFilename: 'doc.xml',
				sizeBytes: body.length,
				version: '2025',
			}),
		);
		expect(result?.outcome).toBe('no-change');
		const rows = await getAuditRows(id);
		const noChange = rows.filter((r) => {
			const md = r.metadata as Record<string, unknown> | null;
			return md && md.outcome === 'no-change';
		});
		expect(noChange).toHaveLength(1);
	});
});
