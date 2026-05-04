/**
 * TOC + knowledge-node action tests -- exercise `?/recordTocStep`,
 * `?/finishTocSession`, `?/markKnowledgeNodeReviewed`:
 *
 *   - `?/recordTocStep`: rejects entryRefs that aren't in the parsed TOC,
 *     rejects sessions that no longer belong to the current user / item,
 *     rejects non-reference_toc items, and writes pass-through values to
 *     `recordStep` on success.
 *   - `?/finishTocSession`: rejects invalid session outcomes via the
 *     `SESSION_OUTCOME_VALUES` constant guard, refuses `pass` when not
 *     every parsed entry has a recorded `pass`, and acknowledges the
 *     bucket side-effect on success.
 *   - `?/markKnowledgeNodeReviewed`: short-circuits when the cached
 *     frontmatter `discovery_review` is already `done`, surfaces write
 *     failures as 409.
 *
 * Pattern mirrors `spec-actions.test.ts`: `vi.doMock` BC primitives, then
 * `await import('./+page.server')` per case so the action layer picks up
 * the freshly-mocked module graph.
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
	getReference: ReturnType<typeof vi.fn>;
	getOpenSession: ReturnType<typeof vi.fn>;
	listSessions: ReturnType<typeof vi.fn>;
	listSteps: ReturnType<typeof vi.fn>;
	recordStep: ReturnType<typeof vi.fn>;
	finishSession: ReturnType<typeof vi.fn>;
	parseToc: ReturnType<typeof vi.fn>;
	parseTestPlan: ReturnType<typeof vi.fn>;
	startSession: ReturnType<typeof vi.fn>;
	writeFrontmatterField: ReturnType<typeof vi.fn>;
	everyStepPassed: ReturnType<typeof vi.fn>;
}

function makeMocks(overrides: Partial<BcMocks> = {}): BcMocks {
	return {
		getItem: vi.fn(),
		getReference: vi.fn().mockResolvedValue(null),
		getOpenSession: vi.fn(),
		listSessions: vi.fn().mockResolvedValue([]),
		listSteps: vi.fn().mockResolvedValue([]),
		recordStep: vi.fn().mockResolvedValue(undefined),
		finishSession: vi.fn().mockResolvedValue(undefined),
		parseToc: vi.fn().mockReturnValue({ entries: [], errors: [] }),
		parseTestPlan: vi.fn().mockReturnValue([]),
		startSession: vi.fn(),
		writeFrontmatterField: vi.fn(),
		everyStepPassed: vi.fn().mockReturnValue(false),
		...overrides,
	};
}

function installMocks(setup: BcMocks): void {
	vi.doMock('@ab/auth', () => ({
		requireRole: () => ({ id: 'user_test' }),
	}));
	vi.doMock('@ab/bc-hangar', () => ({
		getItem: setup.getItem,
		getReference: setup.getReference,
		getOpenSession: setup.getOpenSession,
		listSessions: setup.listSessions,
		listSteps: setup.listSteps,
		recordStep: setup.recordStep,
		finishSession: setup.finishSession,
		parseToc: setup.parseToc,
		parseTestPlan: setup.parseTestPlan,
		startSession: setup.startSession,
		writeFrontmatterField: setup.writeFrontmatterField,
		everyStepPassed: setup.everyStepPassed,
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

interface ActionResult {
	status: number;
	data?: unknown;
}

async function runAction(
	mocks: BcMocks,
	actionName: 'recordTocStep' | 'finishTocSession' | 'markKnowledgeNodeReviewed',
	formEntries: Record<string, string> = {},
	pathParams: { kind: string; itemId: string } = { kind: 'reference_toc', itemId: 'item_test' },
): Promise<ActionResult> {
	installMocks(mocks);
	const mod = await import('./+page.server');
	const formData = new FormData();
	for (const [k, v] of Object.entries(formEntries)) {
		formData.append(k, v);
	}
	const event = {
		params: pathParams,
		request: { formData: async () => formData },
		locals: { requestId: 'req-test' },
	} as unknown as Parameters<NonNullable<(typeof mod.actions)[typeof actionName]>>[0];
	const handler = mod.actions[actionName];
	if (!handler) throw new Error(`action ${actionName} not exported`);
	const result = await handler(event);
	const value = result as { status?: number; data?: unknown };
	return { status: value?.status ?? 200, data: value?.data ?? value };
}

describe('?/recordTocStep', () => {
	it('rejects entryRef not in the parsed TOC', async () => {
		const mocks = makeMocks({
			getItem: vi.fn().mockResolvedValue({
				id: 'item_test',
				kindId: 'reference_toc',
				ref: 'ref_xyz',
				deletedAt: null,
			}),
			parseToc: vi.fn().mockReturnValue({
				entries: [{ entryRef: 'entry_real', entryIndex: 1, label: 'Ch 1', pageNumber: null, anchor: null }],
				errors: [],
			}),
		});
		const result = await runAction(mocks, 'recordTocStep', {
			sessionId: 'sess_test',
			entryRef: 'entry_bogus',
			entryIndex: '1',
			outcome: 'pass',
		});
		expect(result.status).toBe(400);
		expect(mocks.recordStep).not.toHaveBeenCalled();
		const data = result.data as { recordTocStep?: string };
		expect(data.recordTocStep).toMatch(/parsed TOC/);
	});

	it('rejects when no open session matches sessionId', async () => {
		const mocks = makeMocks({
			getItem: vi.fn().mockResolvedValue({
				id: 'item_test',
				kindId: 'reference_toc',
				ref: 'ref_xyz',
				deletedAt: null,
			}),
			parseToc: vi.fn().mockReturnValue({
				entries: [{ entryRef: 'entry_real', entryIndex: 1, label: 'Ch 1', pageNumber: null, anchor: null }],
				errors: [],
			}),
			getOpenSession: vi.fn().mockResolvedValue(null),
		});
		const result = await runAction(mocks, 'recordTocStep', {
			sessionId: 'sess_test',
			entryRef: 'entry_real',
			entryIndex: '1',
			outcome: 'pass',
		});
		expect(result.status).toBe(409);
		expect(mocks.recordStep).not.toHaveBeenCalled();
	});

	it('rejects non-reference_toc kinds with 400', async () => {
		const mocks = makeMocks({
			getItem: vi.fn().mockResolvedValue({
				id: 'item_test',
				kindId: 'wp_spec',
				ref: 'docs/wp/foo/spec.md',
				deletedAt: null,
			}),
		});
		const result = await runAction(mocks, 'recordTocStep', {
			sessionId: 'sess_test',
			entryRef: 'entry_real',
			entryIndex: '1',
			outcome: 'pass',
		});
		expect(result.status).toBe(400);
		expect(mocks.recordStep).not.toHaveBeenCalled();
	});

	it('records the step on a valid entryRef + matching session', async () => {
		const mocks = makeMocks({
			getItem: vi.fn().mockResolvedValue({
				id: 'item_test',
				kindId: 'reference_toc',
				ref: 'ref_xyz',
				deletedAt: null,
			}),
			parseToc: vi.fn().mockReturnValue({
				entries: [{ entryRef: 'entry_real', entryIndex: 1, label: 'Ch 1', pageNumber: null, anchor: null }],
				errors: [],
			}),
			getOpenSession: vi.fn().mockResolvedValue({ id: 'sess_test', startedAt: new Date(), userId: 'user_test' }),
		});
		const result = await runAction(mocks, 'recordTocStep', {
			sessionId: 'sess_test',
			entryRef: 'entry_real',
			entryIndex: '1',
			outcome: 'pass',
		});
		expect(result.status).toBe(200);
		expect(mocks.recordStep).toHaveBeenCalledWith(
			expect.objectContaining({ sessionId: 'sess_test', stepRef: 'entry_real', outcome: 'pass' }),
		);
	});
});

describe('?/finishTocSession', () => {
	it('rejects an invalid session outcome with 400', async () => {
		const mocks = makeMocks({
			getItem: vi.fn().mockResolvedValue({
				id: 'item_test',
				kindId: 'reference_toc',
				ref: 'ref_xyz',
				deletedAt: null,
			}),
		});
		const result = await runAction(mocks, 'finishTocSession', {
			sessionId: 'sess_test',
			outcome: 'blocked', // not a session outcome
			note: '',
		});
		expect(result.status).toBe(400);
		expect(mocks.finishSession).not.toHaveBeenCalled();
	});

	it('refuses pass when not every entry has a recorded pass', async () => {
		const mocks = makeMocks({
			getItem: vi.fn().mockResolvedValue({
				id: 'item_test',
				kindId: 'reference_toc',
				ref: 'ref_xyz',
				deletedAt: null,
			}),
			getOpenSession: vi.fn().mockResolvedValue({ id: 'sess_test', startedAt: new Date(), userId: 'user_test' }),
			parseToc: vi.fn().mockReturnValue({
				entries: [{ entryRef: 'a', entryIndex: 1, label: 'A', pageNumber: null, anchor: null }],
				errors: [],
			}),
			listSteps: vi.fn().mockResolvedValue([{ stepRef: 'a', outcome: 'fail' }]),
			everyStepPassed: vi.fn().mockReturnValue(false),
		});
		const result = await runAction(mocks, 'finishTocSession', {
			sessionId: 'sess_test',
			outcome: 'pass',
			note: '',
		});
		expect(result.status).toBe(400);
		expect(mocks.finishSession).not.toHaveBeenCalled();
		const data = result.data as { finishTocSession?: string };
		expect(data.finishTocSession).toMatch(/Cannot close as pass/);
	});

	it('closes as pass when every entry has a pass step', async () => {
		const mocks = makeMocks({
			getItem: vi.fn().mockResolvedValue({
				id: 'item_test',
				kindId: 'reference_toc',
				ref: 'ref_xyz',
				deletedAt: null,
			}),
			getOpenSession: vi.fn().mockResolvedValue({ id: 'sess_test', startedAt: new Date(), userId: 'user_test' }),
			parseToc: vi.fn().mockReturnValue({
				entries: [{ entryRef: 'a', entryIndex: 1, label: 'A', pageNumber: null, anchor: null }],
				errors: [],
			}),
			listSteps: vi.fn().mockResolvedValue([{ stepRef: 'a', outcome: 'pass' }]),
			everyStepPassed: vi.fn().mockReturnValue(true),
		});
		const result = await runAction(mocks, 'finishTocSession', {
			sessionId: 'sess_test',
			outcome: 'pass',
			note: '',
		});
		expect(result.status).toBe(200);
		expect(mocks.finishSession).toHaveBeenCalledWith('sess_test', 'pass', '');
		expect(result.data).toMatchObject({ finishTocSession: 'ok', closedAs: 'pass', bucketRemoved: true });
	});

	it('rejects mismatched session ownership with 403', async () => {
		const mocks = makeMocks({
			getItem: vi.fn().mockResolvedValue({
				id: 'item_test',
				kindId: 'reference_toc',
				ref: 'ref_xyz',
				deletedAt: null,
			}),
			getOpenSession: vi.fn().mockResolvedValue({ id: 'sess_other', startedAt: new Date(), userId: 'user_test' }),
		});
		const result = await runAction(mocks, 'finishTocSession', {
			sessionId: 'sess_test',
			outcome: 'fail',
			note: '',
		});
		expect(result.status).toBe(403);
		expect(mocks.finishSession).not.toHaveBeenCalled();
	});

	it('flows fail through unchanged', async () => {
		const mocks = makeMocks({
			getItem: vi.fn().mockResolvedValue({
				id: 'item_test',
				kindId: 'reference_toc',
				ref: 'ref_xyz',
				deletedAt: null,
			}),
			getOpenSession: vi.fn().mockResolvedValue({ id: 'sess_test', startedAt: new Date(), userId: 'user_test' }),
		});
		const result = await runAction(mocks, 'finishTocSession', {
			sessionId: 'sess_test',
			outcome: 'fail',
			note: 'short',
		});
		expect(result.status).toBe(200);
		expect(mocks.finishSession).toHaveBeenCalledWith('sess_test', 'fail', 'short');
		expect(result.data).toMatchObject({ closedAs: 'fail', bucketRemoved: false });
	});
});

describe('?/markKnowledgeNodeReviewed', () => {
	it('short-circuits when cached discovery_review is already done', async () => {
		const mocks = makeMocks({
			getItem: vi.fn().mockResolvedValue({
				id: 'item_test',
				kindId: 'knowledge_node',
				ref: 'course/knowledge/foo/node.md',
				deletedAt: null,
				cachedFields: { otherFields: { discovery_review: 'done' } },
			}),
		});
		const result = await runAction(
			mocks,
			'markKnowledgeNodeReviewed',
			{},
			{ kind: 'knowledge_node', itemId: 'item_test' },
		);
		expect(result.status).toBe(200);
		expect(result.data).toMatchObject({ markKnowledgeNodeReviewed: 'already-done' });
		expect(mocks.writeFrontmatterField).not.toHaveBeenCalled();
	});

	it('writes discovery_review: done on first mark', async () => {
		const mocks = makeMocks({
			getItem: vi.fn().mockResolvedValue({
				id: 'item_test',
				kindId: 'knowledge_node',
				ref: 'course/knowledge/foo/node.md',
				deletedAt: null,
				cachedFields: { otherFields: {} },
			}),
			writeFrontmatterField: vi.fn().mockResolvedValue(undefined),
		});
		const result = await runAction(
			mocks,
			'markKnowledgeNodeReviewed',
			{},
			{ kind: 'knowledge_node', itemId: 'item_test' },
		);
		expect(result.status).toBe(200);
		expect(mocks.writeFrontmatterField).toHaveBeenCalledWith(
			expect.stringContaining('course/knowledge/foo/node.md'),
			'discovery_review',
			'done',
		);
	});

	it('surfaces write failures as 409', async () => {
		const mocks = makeMocks({
			getItem: vi.fn().mockResolvedValue({
				id: 'item_test',
				kindId: 'knowledge_node',
				ref: 'course/knowledge/foo/node.md',
				deletedAt: null,
				cachedFields: { otherFields: {} },
			}),
			writeFrontmatterField: vi.fn().mockRejectedValue(new Error('EROFS read-only')),
		});
		const result = await runAction(
			mocks,
			'markKnowledgeNodeReviewed',
			{},
			{ kind: 'knowledge_node', itemId: 'item_test' },
		);
		expect(result.status).toBe(409);
	});
});
