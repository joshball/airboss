/**
 * Loader admin action tests -- exercise `?/runLoader`:
 *
 *   - happy path returns `ranLoader: 'ok'` with the result counts and emits
 *     one audit row tagged `hangar.review_loader` / op `action`.
 *   - failure path returns SvelteKit `fail(500, ...)` with a friendly
 *     message (NOT the raw thrown message), keeping the action contract
 *     consistent with the bucket actions.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

beforeEach(() => {
	vi.resetModules();
});

afterEach(() => {
	vi.restoreAllMocks();
});

interface LoaderMocks {
	loadReviewItems: ReturnType<typeof vi.fn>;
	countDocsIndex: ReturnType<typeof vi.fn>;
	getLastLoaderRun: ReturnType<typeof vi.fn>;
	REPO_ROOT: string;
}

function makeBc(overrides: Partial<LoaderMocks> = {}): LoaderMocks {
	return {
		loadReviewItems: vi.fn().mockResolvedValue({
			added: 1,
			updated: 2,
			removed: 0,
			fts: { added: 0, updated: 1, removed: 0 },
			errors: [],
			durationMs: 12,
		}),
		countDocsIndex: vi.fn().mockResolvedValue(42),
		getLastLoaderRun: vi.fn().mockReturnValue(null),
		REPO_ROOT: '/repo',
		...overrides,
	};
}

const auditWriteMock = vi.fn().mockResolvedValue({ id: 'audit_test' });

function installCommonMocks(bc: LoaderMocks): void {
	auditWriteMock.mockClear();
	vi.doMock('@ab/auth', () => ({
		requireRole: () => ({ id: 'user_test' }),
	}));
	vi.doMock('@ab/audit', () => ({
		AUDIT_OPS: { CREATE: 'create', UPDATE: 'update', DELETE: 'delete', ACTION: 'action' },
	}));
	vi.doMock('@ab/audit/server', () => ({
		auditWrite: auditWriteMock,
	}));
	vi.doMock('@ab/bc-hangar', () => ({ ...bc }));
	vi.doMock('@ab/bc-hangar/server', () => ({ ...bc }));
	vi.doMock('@ab/db/connection', () => ({
		db: {},
	}));
	vi.doMock('@ab/utils', () => ({
		createLogger: () => ({
			error: () => undefined,
			info: () => undefined,
			warn: () => undefined,
			debug: () => undefined,
		}),
	}));
}

interface ActionResult {
	status: number;
	data?: unknown;
}

async function runRunLoader(bc: LoaderMocks): Promise<ActionResult> {
	installCommonMocks(bc);
	const mod = await import('./+page.server');
	const event = {
		params: {},
		request: { formData: async () => new FormData() },
		locals: { requestId: 'req-test' },
	} as unknown as Parameters<NonNullable<(typeof mod.actions)['runLoader']>>[0];
	const handler = mod.actions.runLoader;
	if (!handler) throw new Error('runLoader action not exported');
	const result = await handler(event);
	const value = result as { status?: number; data?: unknown };
	return { status: value?.status ?? 200, data: value?.data ?? value };
}

describe('?/runLoader', () => {
	it('returns ok shape with result counts on success', async () => {
		const bc = makeBc();
		const result = await runRunLoader(bc);
		expect(result.status).toBe(200);
		const data = result.data as {
			ranLoader: 'ok' | 'error';
			added?: number;
			updated?: number;
			removed?: number;
			durationMs?: number;
		};
		expect(data.ranLoader).toBe('ok');
		expect(data.added).toBe(1);
		expect(data.updated).toBe(2);
		expect(data.removed).toBe(0);
		expect(data.durationMs).toBe(12);
		expect(bc.loadReviewItems).toHaveBeenCalledTimes(1);
		// One audit-write per admin-pressed run.
		expect(auditWriteMock).toHaveBeenCalledTimes(1);
		const audited = auditWriteMock.mock.calls[0]?.[0] as {
			targetType: string;
			op: string;
			metadata: Record<string, unknown>;
		};
		expect(audited.targetType).toBe('hangar.review_loader');
		expect(audited.op).toBe('action');
		expect(audited.metadata.added).toBe(1);
	});

	it('uses fail(500) with a friendly message on failure', async () => {
		const bc = makeBc({
			loadReviewItems: vi.fn().mockRejectedValue(new Error('boom: /Users/foo/bar absolute path leaked')),
		});
		const result = await runRunLoader(bc);
		expect(result.status).toBe(500);
		const data = result.data as { ranLoader: string; error: string };
		expect(data.ranLoader).toBe('error');
		expect(data.error).toMatch(/Loader run failed/);
		// The raw thrown message must NOT bubble back to the UI -- check
		// the absolute path didn't leak through.
		expect(data.error).not.toMatch(/Users\/foo\/bar/);
		// No audit row on failure.
		expect(auditWriteMock).not.toHaveBeenCalled();
	});
});
