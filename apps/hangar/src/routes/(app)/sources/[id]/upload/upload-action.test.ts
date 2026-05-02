/**
 * Upload form-action tests. Exercises the temp-dir cleanup ordering closed
 * by the source-ingest data-integrity convergent fix:
 *
 *   - on a failed `enqueueJob`, the staged temp directory is removed
 *   - on a successful `enqueueJob`, the temp directory is preserved (the
 *     worker now owns it) and the action redirects to /jobs/<id>
 *
 * The action mounts SvelteKit primitives (`fail`, `redirect`, `requireRole`,
 * `enqueueJob`, `getSource`, `getActiveJobForTarget`) so the test mocks each
 * one and re-imports the action module fresh per case.
 */
import { mkdir, readdir, rm, stat } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const TMP_ROOT = join(tmpdir(), 'airboss-upload-action-test');

async function _dirExists(path: string): Promise<boolean> {
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
