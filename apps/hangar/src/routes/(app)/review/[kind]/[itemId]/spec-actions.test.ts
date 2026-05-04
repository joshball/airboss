/**
 * Spec-view action tests -- exercise `?/markSpecRead` and
 * `?/flipReviewStatus`:
 *
 *   - both reject soft-deleted items with 404 (a stale `item.ref` must not
 *     be the target of a frontmatter write).
 *   - both reject non-`wp_spec` kinds with 400.
 *   - `markSpecRead` is idempotent: when status is already `done`, returns
 *     the `already-done` sentinel rather than performing a redundant write
 *     so the toast can read accurately.
 *   - both surface `writeFrontmatterField` failures as 409 with the error
 *     message preserved (the user can retry).
 *
 * The action module mounts SvelteKit + BC primitives, so the test mocks
 * each one with `vi.doMock` and re-imports the module per case.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

beforeEach(() => {
	vi.resetModules();
});

afterEach(() => {
	vi.restoreAllMocks();
});

interface BcMocks {
	getItem: ReturnType<typeof vi.fn>;
	writeFrontmatterField: ReturnType<typeof vi.fn>;
	getOpenSession: ReturnType<typeof vi.fn>;
	listSessions: ReturnType<typeof vi.fn>;
	listSteps: ReturnType<typeof vi.fn>;
	parseTestPlan: ReturnType<typeof vi.fn>;
}

function installMocks(setup: BcMocks): void {
	vi.doMock('@ab/auth', () => ({
		requireRole: () => ({ id: 'user_test' }),
	}));
	vi.doMock('@ab/bc-hangar', () => ({
		getItem: setup.getItem,
		getOpenSession: setup.getOpenSession,
		listSessions: setup.listSessions,
		listSteps: setup.listSteps,
		parseTestPlan: setup.parseTestPlan,
		writeFrontmatterField: setup.writeFrontmatterField,
		REPO_ROOT: '/tmp/airboss-test-repo',
	}));
	vi.doMock('node:fs/promises', () => ({
		readFile: vi.fn(async () => '## Section\n'),
	}));
	vi.doMock('@ab/utils', () => ({
		createLogger: () => ({
			error: () => undefined,
			info: () => undefined,
			warn: () => undefined,
			debug: () => undefined,
		}),
		parseFrontmatter: vi.fn().mockReturnValue({ entries: [], body: '' }),
		renderMarkdown: vi.fn().mockReturnValue(''),
	}));
}

interface FormActionResult {
	status: number;
	data?: unknown;
}

function makeMocks(overrides: Partial<BcMocks> = {}): BcMocks {
	return {
		getItem: vi.fn(),
		writeFrontmatterField: vi.fn(),
		getOpenSession: vi.fn(),
		listSessions: vi.fn().mockResolvedValue([]),
		listSteps: vi.fn().mockResolvedValue([]),
		parseTestPlan: vi.fn().mockReturnValue([]),
		...overrides,
	};
}

async function runAction(mocks: BcMocks, actionName: 'markSpecRead' | 'flipReviewStatus'): Promise<FormActionResult> {
	installMocks(mocks);
	const mod = await import('./+page.server');
	const formData = new FormData();
	const event = {
		params: { kind: 'wp_spec', itemId: 'item_test' },
		request: { formData: async () => formData },
		locals: { requestId: 'req-test' },
	} as unknown as Parameters<NonNullable<(typeof mod.actions)[typeof actionName]>>[0];
	const handler = mod.actions[actionName];
	if (!handler) throw new Error(`action ${actionName} not exported`);
	const result = await handler(event);
	const value = result as { status?: number; data?: unknown };
	return { status: value?.status ?? 200, data: value?.data ?? value };
}

describe('?/markSpecRead', () => {
	it('rejects soft-deleted items with 404', async () => {
		const mocks = makeMocks({
			getItem: vi.fn().mockResolvedValue({
				id: 'item_test',
				kindId: 'wp_spec',
				ref: 'docs/wp/foo/spec.md',
				frontmatterStatus: 'unread',
				deletedAt: new Date(),
			}),
		});
		const result = await runAction(mocks, 'markSpecRead');
		expect(result.status).toBe(404);
		expect(mocks.writeFrontmatterField).not.toHaveBeenCalled();
	});

	it('rejects non-wp_spec kinds with 400', async () => {
		const mocks = makeMocks({
			getItem: vi.fn().mockResolvedValue({
				id: 'item_test',
				kindId: 'reference_toc',
				ref: 'docs/wp/foo/spec.md',
				frontmatterStatus: 'unread',
				deletedAt: null,
			}),
		});
		const result = await runAction(mocks, 'markSpecRead');
		expect(result.status).toBe(400);
		expect(mocks.writeFrontmatterField).not.toHaveBeenCalled();
	});

	it('returns already-done sentinel when status is already done', async () => {
		const mocks = makeMocks({
			getItem: vi.fn().mockResolvedValue({
				id: 'item_test',
				kindId: 'wp_spec',
				ref: 'docs/wp/foo/spec.md',
				frontmatterStatus: 'done',
				deletedAt: null,
			}),
		});
		const result = await runAction(mocks, 'markSpecRead');
		expect(result.status).toBe(200);
		expect(result.data).toMatchObject({ markSpecRead: 'already-done' });
		expect(mocks.writeFrontmatterField).not.toHaveBeenCalled();
	});

	it('writes status: done on success', async () => {
		const mocks = makeMocks({
			getItem: vi.fn().mockResolvedValue({
				id: 'item_test',
				kindId: 'wp_spec',
				ref: 'docs/wp/foo/spec.md',
				frontmatterStatus: 'unread',
				deletedAt: null,
			}),
			writeFrontmatterField: vi.fn().mockResolvedValue(undefined),
		});
		const result = await runAction(mocks, 'markSpecRead');
		expect(result.status).toBe(200);
		expect(mocks.writeFrontmatterField).toHaveBeenCalledWith(
			expect.stringContaining('docs/wp/foo/spec.md'),
			'status',
			'done',
		);
		expect(result.data).toMatchObject({ markSpecRead: 'ok' });
	});

	it('returns 409 with the error message when writeFrontmatterField throws', async () => {
		const mocks = makeMocks({
			getItem: vi.fn().mockResolvedValue({
				id: 'item_test',
				kindId: 'wp_spec',
				ref: 'docs/wp/foo/spec.md',
				frontmatterStatus: 'unread',
				deletedAt: null,
			}),
			writeFrontmatterField: vi.fn().mockRejectedValue(new Error('disk full')),
		});
		const result = await runAction(mocks, 'markSpecRead');
		expect(result.status).toBe(409);
		const data = result.data as { markSpecRead?: string };
		expect(data.markSpecRead).toMatch(/disk full/);
	});
});

describe('?/flipReviewStatus', () => {
	it('rejects soft-deleted items with 404', async () => {
		const mocks = makeMocks({
			getItem: vi.fn().mockResolvedValue({
				id: 'item_test',
				kindId: 'wp_spec',
				ref: 'docs/wp/foo/spec.md',
				deletedAt: new Date(),
			}),
		});
		const result = await runAction(mocks, 'flipReviewStatus');
		expect(result.status).toBe(404);
		expect(mocks.writeFrontmatterField).not.toHaveBeenCalled();
	});

	it('rejects non-wp_spec kinds with 400', async () => {
		const mocks = makeMocks({
			getItem: vi.fn().mockResolvedValue({
				id: 'item_test',
				kindId: 'ad_hoc',
				ref: 'docs/wp/foo/spec.md',
				deletedAt: null,
			}),
		});
		const result = await runAction(mocks, 'flipReviewStatus');
		expect(result.status).toBe(400);
	});

	it('writes review_status: done on success', async () => {
		const mocks = makeMocks({
			getItem: vi.fn().mockResolvedValue({
				id: 'item_test',
				kindId: 'wp_spec',
				ref: 'docs/wp/foo/spec.md',
				deletedAt: null,
			}),
			writeFrontmatterField: vi.fn().mockResolvedValue(undefined),
		});
		const result = await runAction(mocks, 'flipReviewStatus');
		expect(result.status).toBe(200);
		expect(mocks.writeFrontmatterField).toHaveBeenCalledWith(
			expect.stringContaining('docs/wp/foo/spec.md'),
			'review_status',
			'done',
		);
	});

	it('surfaces write failure as 409 with the error preserved', async () => {
		const mocks = makeMocks({
			getItem: vi.fn().mockResolvedValue({
				id: 'item_test',
				kindId: 'wp_spec',
				ref: 'docs/wp/foo/spec.md',
				deletedAt: null,
			}),
			writeFrontmatterField: vi.fn().mockRejectedValue(new Error('EROFS read-only')),
		});
		const result = await runAction(mocks, 'flipReviewStatus');
		expect(result.status).toBe(409);
		const data = result.data as { flipReviewStatus?: string };
		expect(data.flipReviewStatus).toMatch(/EROFS/);
	});
});
