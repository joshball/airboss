/**
 * Upload form-action tests. Exercises:
 *   - tmpdir cleanup ordering (closed by the source-ingest data-integrity
 *     convergent fix): on failed enqueue the staged dir is removed; on
 *     success it's preserved (the worker now owns it).
 *   - 400 (no file), 404 (missing or soft-deleted source), 409 (active
 *     job already running for the target), 413 (over MAX_UPLOAD_BYTES),
 *     500 (enqueue failure).
 *   - path-traversal defence: even when `originalFilename` carries
 *     `../../../etc/passwd`, the staged temp file lands inside the
 *     mkdtemp dir (not somewhere else on disk) and the original name
 *     flows through to the job payload unchanged for downstream use.
 *
 * The action mounts SvelteKit primitives (`fail`, `redirect`, `requireRole`,
 * `enqueueJob`, `getSource`, `getActiveJobForTarget`) so the test mocks each
 * one and re-imports the action module fresh per case.
 */
import { mkdir, readdir, rm, stat } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { SOURCE_ACTION_LIMITS } from '@ab/constants';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const TMP_ROOT = join(tmpdir(), 'airboss-upload-action-test');

async function dirExists(path: string): Promise<boolean> {
	try {
		await stat(path);
		return true;
	} catch {
		return false;
	}
}

beforeEach(async () => {
	await mkdir(TMP_ROOT, { recursive: true });
	vi.resetModules();
});

afterEach(async () => {
	await rm(TMP_ROOT, { recursive: true, force: true });
	vi.restoreAllMocks();
});

interface MockSetup {
	enqueueJob: ReturnType<typeof vi.fn>;
	getSource: ReturnType<typeof vi.fn>;
	getActiveJobForTarget: ReturnType<typeof vi.fn>;
}

function installMocks(setup: MockSetup): void {
	vi.doMock('@ab/auth', () => ({
		requireRole: () => ({ id: 'user_test' }),
	}));
	vi.doMock('@ab/bc-hangar', () => ({
		getSource: setup.getSource,
		getActiveJobForTarget: setup.getActiveJobForTarget,
	}));
	vi.doMock('@ab/hangar-jobs', () => ({
		enqueueJob: setup.enqueueJob,
	}));
}

interface FormActionResult {
	status: number;
	data?: unknown;
	location?: string;
	thrown?: unknown;
}

async function runAction(file: File, version: string | undefined): Promise<FormActionResult> {
	const mod = await import('./+page.server');
	const formData = new FormData();
	formData.append('file', file);
	if (version !== undefined) formData.append('version', version);
	const event = {
		params: { id: 'src-test' },
		request: { formData: async () => formData },
		locals: { requestId: 'req-test' },
	} as unknown as Parameters<(typeof mod.actions)['default']>[0];

	try {
		const result = await mod.actions.default(event);
		const value = result as { status?: number; data?: unknown };
		return { status: value?.status ?? 200, data: value?.data };
	} catch (err) {
		// SvelteKit `redirect()` throws a Redirect object; capture its location.
		const r = err as { status?: number; location?: string };
		if (typeof r === 'object' && r !== null && r.status === 303 && typeof r.location === 'string') {
			return { status: 303, location: r.location };
		}
		return { status: 500, thrown: err };
	}
}

async function listUploadDirs(): Promise<string[]> {
	const root = tmpdir();
	const entries = await readdir(root).catch(() => [] as string[]);
	return entries.filter((e) => e.startsWith('airboss-hangar-upload-')).map((e) => join(root, e));
}

describe('upload form action -- temp-dir cleanup ordering', () => {
	it('removes the staged temp directory when enqueueJob throws', async () => {
		const before = new Set(await listUploadDirs());
		const enqueueJob = vi.fn(async () => {
			throw new Error('db blip');
		});
		installMocks({
			enqueueJob,
			getSource: vi.fn(async () => ({ id: 'src-test', deletedAt: null, version: '2025', type: 'cfr' })),
			getActiveJobForTarget: vi.fn(async () => null),
		});

		const file = new File([new Uint8Array([1, 2, 3])], 'doc.xml', { type: 'application/xml' });
		const result = await runAction(file, '2025');

		expect(result.status).toBe(500);
		expect(enqueueJob).toHaveBeenCalledTimes(1);
		// No new airboss-hangar-upload-* directories survived the failed enqueue.
		const after = await listUploadDirs();
		const leaked = after.filter((p) => !before.has(p));
		expect(leaked).toEqual([]);
	});

	it('preserves the staged temp directory and redirects after a successful enqueueJob', async () => {
		const before = new Set(await listUploadDirs());
		const enqueueJob = vi.fn(async () => ({ id: 'job_abc' }));
		installMocks({
			enqueueJob,
			getSource: vi.fn(async () => ({ id: 'src-test', deletedAt: null, version: '2025', type: 'cfr' })),
			getActiveJobForTarget: vi.fn(async () => null),
		});

		const file = new File([new Uint8Array([4, 5, 6])], 'doc.xml', { type: 'application/xml' });
		const result = await runAction(file, '2025');

		expect(result.status).toBe(303);
		expect(result.location).toContain('job_abc');
		expect(enqueueJob).toHaveBeenCalledTimes(1);

		// Worker now owns the dir; it must NOT have been removed.
		const after = await listUploadDirs();
		const survived = after.filter((p) => !before.has(p));
		expect(survived.length).toBeGreaterThanOrEqual(1);
		// Test-owned cleanup since the real worker would unlink.
		for (const dir of survived) await rm(dir, { recursive: true, force: true });
	});
});

describe('upload form action -- input validation', () => {
	it('returns 400 when no file is attached', async () => {
		const enqueueJob = vi.fn();
		installMocks({
			enqueueJob,
			getSource: vi.fn(async () => ({ id: 'src-test', deletedAt: null, version: '2025', type: 'cfr' })),
			getActiveJobForTarget: vi.fn(async () => null),
		});

		// Empty File is 0 bytes -- the action treats `size === 0` as "no file".
		const file = new File([], 'empty.xml', { type: 'application/xml' });
		const result = await runAction(file, undefined);

		expect(result.status).toBe(400);
		expect(enqueueJob).not.toHaveBeenCalled();
	});

	it('returns 413 when file exceeds MAX_UPLOAD_BYTES', async () => {
		const enqueueJob = vi.fn();
		installMocks({
			enqueueJob,
			getSource: vi.fn(async () => ({ id: 'src-test', deletedAt: null, version: '2025', type: 'cfr' })),
			getActiveJobForTarget: vi.fn(async () => null),
		});

		// Build a small File and override `size` to bypass the 500 MB allocation.
		// The action only reads `file.size` for the over-limit check; the
		// `instanceof File` gate is satisfied by the underlying File object.
		const file = new File([new Uint8Array([1])], 'huge.xml', { type: 'application/xml' });
		Object.defineProperty(file, 'size', { value: SOURCE_ACTION_LIMITS.MAX_UPLOAD_BYTES + 1 });
		const result = await runAction(file, '2025');

		expect(result.status).toBe(413);
		expect(enqueueJob).not.toHaveBeenCalled();
		const data = result.data as { error?: string } | undefined;
		expect(data?.error ?? '').toMatch(/MB/);
	});

	it('returns 404 when the source is missing', async () => {
		const enqueueJob = vi.fn();
		installMocks({
			enqueueJob,
			getSource: vi.fn(async () => null),
			getActiveJobForTarget: vi.fn(async () => null),
		});

		const file = new File([new Uint8Array([1, 2])], 'doc.xml');
		const result = await runAction(file, '2025');

		expect(result.status).toBe(404);
		expect(enqueueJob).not.toHaveBeenCalled();
	});

	it('returns 404 when the source is soft-deleted', async () => {
		const enqueueJob = vi.fn();
		installMocks({
			enqueueJob,
			getSource: vi.fn(async () => ({ id: 'src-test', deletedAt: new Date(), version: '2025', type: 'cfr' })),
			getActiveJobForTarget: vi.fn(async () => null),
		});

		const file = new File([new Uint8Array([1, 2])], 'doc.xml');
		const result = await runAction(file, '2025');

		expect(result.status).toBe(404);
		const data = result.data as { error?: string } | undefined;
		expect(data?.error ?? '').toMatch(/deleted/i);
		expect(enqueueJob).not.toHaveBeenCalled();
	});

	it('returns 409 when the source already has an active job', async () => {
		const enqueueJob = vi.fn();
		installMocks({
			enqueueJob,
			getSource: vi.fn(async () => ({ id: 'src-test', deletedAt: null, version: '2025', type: 'cfr' })),
			// Defense-in-depth busy pre-check returns an existing running upload.
			getActiveJobForTarget: vi.fn(async () => ({
				id: 'job_busy',
				kind: 'upload-source',
				status: 'running',
			})),
		});

		const file = new File([new Uint8Array([1, 2])], 'doc.xml');
		const result = await runAction(file, '2025');

		expect(result.status).toBe(409);
		expect(enqueueJob).not.toHaveBeenCalled();
		const data = result.data as { error?: string } | undefined;
		expect(data?.error ?? '').toContain('job_busy');
	});
});

describe('upload form action -- path-traversal defence', () => {
	it('writes the staged file to the mkdtemp directory regardless of originalFilename', async () => {
		const before = new Set(await listUploadDirs());
		interface SeenPayload {
			sourceId: string;
			tempPath: string;
			originalFilename: string;
		}
		let payloadSeen: SeenPayload | null = null;
		const enqueueJob = vi.fn(async (input: { payload: SeenPayload }) => {
			payloadSeen = input.payload;
			return { id: 'job_traversal' };
		});
		installMocks({
			enqueueJob,
			getSource: vi.fn(async () => ({ id: 'src-test', deletedAt: null, version: '2025', type: 'cfr' })),
			getActiveJobForTarget: vi.fn(async () => null),
		});

		const malicious = '../../../../etc/cron.d/evil';
		const file = new File([new Uint8Array([9, 9, 9])], malicious, { type: 'application/xml' });
		const result = await runAction(file, '2025');

		expect(result.status).toBe(303);
		// originalFilename flows through unchanged so the worker can see it
		// for extension detection / audit purposes.
		const payload = payloadSeen as SeenPayload | null;
		expect(payload?.originalFilename).toBe(malicious);

		// The staged file path lives inside an `airboss-hangar-upload-*`
		// directory in os.tmpdir() -- NOT at the malicious filename.
		const tempPath = payload?.tempPath ?? '';
		expect(tempPath).toContain('airboss-hangar-upload-');
		// Filename component is the fixed `upload.bin`, not the operator-supplied name.
		expect(tempPath.endsWith('/upload.bin')).toBe(true);
		// Parent dir lives directly under os.tmpdir() with no `..` segments.
		const parent = dirname(tempPath);
		expect(parent.startsWith(tmpdir())).toBe(true);
		expect(tempPath).not.toContain('..');
		expect(tempPath).not.toMatch(/\/etc\//);

		// And the file actually exists on disk before the worker takes over.
		expect(await dirExists(tempPath)).toBe(true);

		// Test-owned cleanup since the real worker would unlink.
		const after = await listUploadDirs();
		for (const dir of after.filter((p) => !before.has(p))) {
			await rm(dir, { recursive: true, force: true });
		}
	});
});
