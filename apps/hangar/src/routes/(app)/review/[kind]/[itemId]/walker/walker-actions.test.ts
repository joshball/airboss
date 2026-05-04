/**
 * Walker action tests -- exercise the load-bearing invariants of
 * `?/recordStep` and `?/finishSession`:
 *
 *   - tamper guard: a session id mismatch is rejected with 409 (record) /
 *     403 (finish), not silently proxied.
 *   - soft-delete gate: `?/finishSession` rejects when `item.deletedAt` is
 *     set so a stale `item.ref` cannot be the target of a frontmatter flip.
 *   - clean-pass detection: `?/finishSession` writes `review_status: done`
 *     when every plan step recorded `pass` AND the caller passes `pass`.
 *   - partial-pass refusal: `?/finishSession` does NOT flip when any step
 *     recorded `fail` or `blocked`, even when the caller passes `pass`.
 *   - missing-spec graceful fail: when `writeFrontmatterField` throws (the
 *     spec.md was renamed/deleted between session start + finish), the
 *     action returns the error string instead of throwing.
 *   - user-finishable outcome whitelist: a tampered POST with an unknown
 *     outcome is rejected with 400.
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
	getOpenSession: ReturnType<typeof vi.fn>;
	getItem: ReturnType<typeof vi.fn>;
	listSteps: ReturnType<typeof vi.fn>;
	recordStep: ReturnType<typeof vi.fn>;
	finishSession: ReturnType<typeof vi.fn>;
	startSession: ReturnType<typeof vi.fn>;
	writeFrontmatterField: ReturnType<typeof vi.fn>;
	parseTestPlan: ReturnType<typeof vi.fn>;
	everyStepPassed: ReturnType<typeof vi.fn>;
}

function installMocks(setup: BcMocks): void {
	vi.doMock('@ab/auth', () => ({
		requireRole: () => ({ id: 'user_test' }),
	}));
	vi.doMock('@ab/bc-hangar', () => ({
		getOpenSession: setup.getOpenSession,
		getItem: setup.getItem,
		listSteps: setup.listSteps,
		recordStep: setup.recordStep,
		finishSession: setup.finishSession,
		startSession: setup.startSession,
		writeFrontmatterField: setup.writeFrontmatterField,
		parseTestPlan: setup.parseTestPlan,
		everyStepPassed: setup.everyStepPassed,
		REPO_ROOT: '/tmp/airboss-test-repo',
	}));
	vi.doMock('node:fs/promises', () => ({
		readFile: vi.fn(async () => '## Section\n\n| 1 | Do | Pass |\n'),
	}));
}

interface FormActionResult {
	status: number;
	data?: unknown;
}

function makeMocks(overrides: Partial<BcMocks> = {}): BcMocks {
	return {
		getOpenSession: vi.fn(),
		getItem: vi.fn(),
		listSteps: vi.fn(),
		recordStep: vi.fn(),
		finishSession: vi.fn(),
		startSession: vi.fn(),
		writeFrontmatterField: vi.fn(),
		parseTestPlan: vi.fn().mockReturnValue([]),
		everyStepPassed: vi.fn().mockReturnValue(false),
		...overrides,
	};
}

async function runRecordStep(mocks: BcMocks, form: Record<string, string>): Promise<FormActionResult> {
	installMocks(mocks);
	const mod = await import('./+page.server');
	const formData = new FormData();
	for (const [k, v] of Object.entries(form)) formData.append(k, v);
	const event = {
		params: { kind: 'wp_spec', itemId: 'item_test' },
		request: { formData: async () => formData },
		locals: { requestId: 'req-test' },
	} as unknown as Parameters<NonNullable<(typeof mod.actions)['recordStep']>>[0];
	const handler = mod.actions.recordStep;
	if (!handler) throw new Error('recordStep action not exported');
	const result = await handler(event);
	const value = result as { status?: number; data?: unknown };
	return { status: value?.status ?? 200, data: value?.data ?? value };
}

async function runFinishSession(mocks: BcMocks, form: Record<string, string>): Promise<FormActionResult> {
	installMocks(mocks);
	const mod = await import('./+page.server');
	const formData = new FormData();
	for (const [k, v] of Object.entries(form)) formData.append(k, v);
	const event = {
		params: { kind: 'wp_spec', itemId: 'item_test' },
		request: { formData: async () => formData },
		locals: { requestId: 'req-test' },
	} as unknown as Parameters<NonNullable<(typeof mod.actions)['finishSession']>>[0];
	const handler = mod.actions.finishSession;
	if (!handler) throw new Error('finishSession action not exported');
	const result = await handler(event);
	const value = result as { status?: number; data?: unknown };
	return { status: value?.status ?? 200, data: value?.data ?? value };
}

describe('?/recordStep', () => {
	it('rejects missing sessionId with 400', async () => {
		const mocks = makeMocks();
		const result = await runRecordStep(mocks, {
			sessionId: '',
			stepRef: 'r1',
			stepIndex: '1',
			outcome: 'pass',
			note: '',
		});
		expect(result.status).toBe(400);
	});

	it('rejects unknown outcome with 400', async () => {
		const mocks = makeMocks();
		const result = await runRecordStep(mocks, {
			sessionId: 'sess_a',
			stepRef: 'r1',
			stepIndex: '1',
			outcome: 'maybe',
			note: '',
		});
		expect(result.status).toBe(400);
	});

	it('returns 409 when the session id no longer matches the open session', async () => {
		// Tamper guard: form posted a stale session id (or a different user's).
		const mocks = makeMocks({
			getOpenSession: vi.fn().mockResolvedValue({ id: 'sess_other', itemId: 'item_test', userId: 'user_test' }),
		});
		const result = await runRecordStep(mocks, {
			sessionId: 'sess_a',
			stepRef: 'r1',
			stepIndex: '1',
			outcome: 'pass',
			note: '',
		});
		expect(result.status).toBe(409);
		expect(mocks.recordStep).not.toHaveBeenCalled();
	});

	it('returns 409 when there is no open session for the user', async () => {
		const mocks = makeMocks({
			getOpenSession: vi.fn().mockResolvedValue(null),
		});
		const result = await runRecordStep(mocks, {
			sessionId: 'sess_a',
			stepRef: 'r1',
			stepIndex: '1',
			outcome: 'pass',
			note: '',
		});
		expect(result.status).toBe(409);
		expect(mocks.recordStep).not.toHaveBeenCalled();
	});

	it('writes the step when the session id matches', async () => {
		const mocks = makeMocks({
			getOpenSession: vi.fn().mockResolvedValue({ id: 'sess_a', itemId: 'item_test', userId: 'user_test' }),
			recordStep: vi.fn().mockResolvedValue({ id: 'step_x' }),
		});
		const result = await runRecordStep(mocks, {
			sessionId: 'sess_a',
			stepRef: 'r1',
			stepIndex: '1',
			outcome: 'pass',
			note: 'looks good',
		});
		expect(result.status).toBe(200);
		expect(mocks.recordStep).toHaveBeenCalledWith({
			sessionId: 'sess_a',
			stepIndex: 1,
			stepRef: 'r1',
			outcome: 'pass',
			note: 'looks good',
		});
	});
});

describe('?/finishSession', () => {
	it('rejects an unknown outcome with 400', async () => {
		const mocks = makeMocks();
		const result = await runFinishSession(mocks, {
			sessionId: 'sess_a',
			outcome: 'mystery',
			note: '',
		});
		expect(result.status).toBe(400);
	});

	it('rejects when the session id does not match the open session', async () => {
		const mocks = makeMocks({
			getOpenSession: vi.fn().mockResolvedValue({ id: 'sess_other' }),
		});
		const result = await runFinishSession(mocks, {
			sessionId: 'sess_a',
			outcome: 'pass',
			note: '',
		});
		expect(result.status).toBe(403);
	});

	it('rejects soft-deleted items with 404', async () => {
		const mocks = makeMocks({
			getOpenSession: vi.fn().mockResolvedValue({ id: 'sess_a' }),
			getItem: vi.fn().mockResolvedValue({
				id: 'item_test',
				kindId: 'wp_spec',
				ref: 'docs/work-packages/foo/spec.md',
				deletedAt: new Date(),
			}),
			listSteps: vi.fn().mockResolvedValue([]),
		});
		const result = await runFinishSession(mocks, {
			sessionId: 'sess_a',
			outcome: 'pass',
			note: '',
		});
		expect(result.status).toBe(404);
		expect(mocks.writeFrontmatterField).not.toHaveBeenCalled();
	});

	it('flips review_status: done when every step passed AND outcome is pass', async () => {
		const mocks = makeMocks({
			getOpenSession: vi.fn().mockResolvedValue({ id: 'sess_a' }),
			getItem: vi.fn().mockResolvedValue({
				id: 'item_test',
				kindId: 'wp_spec',
				ref: 'docs/work-packages/foo/spec.md',
				deletedAt: null,
			}),
			parseTestPlan: vi.fn().mockReturnValue([{ stepRef: 'r1' }]),
			listSteps: vi.fn().mockResolvedValue([{ stepRef: 'r1', outcome: 'pass' }]),
			everyStepPassed: vi.fn().mockReturnValue(true),
			finishSession: vi.fn().mockResolvedValue({}),
			writeFrontmatterField: vi.fn().mockResolvedValue(undefined),
		});
		const result = await runFinishSession(mocks, {
			sessionId: 'sess_a',
			outcome: 'pass',
			note: '',
		});
		expect(result.status).toBe(200);
		expect(mocks.writeFrontmatterField).toHaveBeenCalledWith(
			expect.stringContaining('docs/work-packages/foo/spec.md'),
			'review_status',
			'done',
		);
		const data = result.data as { frontmatterFlipped?: boolean };
		expect(data.frontmatterFlipped).toBe(true);
	});

	it('does NOT flip when outcome=pass but a step recorded fail', async () => {
		const mocks = makeMocks({
			getOpenSession: vi.fn().mockResolvedValue({ id: 'sess_a' }),
			getItem: vi.fn().mockResolvedValue({
				id: 'item_test',
				kindId: 'wp_spec',
				ref: 'docs/work-packages/foo/spec.md',
				deletedAt: null,
			}),
			parseTestPlan: vi.fn().mockReturnValue([{ stepRef: 'r1' }, { stepRef: 'r2' }]),
			listSteps: vi.fn().mockResolvedValue([
				{ stepRef: 'r1', outcome: 'pass' },
				{ stepRef: 'r2', outcome: 'fail' },
			]),
			everyStepPassed: vi.fn().mockReturnValue(false),
			finishSession: vi.fn().mockResolvedValue({}),
			writeFrontmatterField: vi.fn().mockResolvedValue(undefined),
		});
		const result = await runFinishSession(mocks, {
			sessionId: 'sess_a',
			outcome: 'pass',
			note: '',
		});
		expect(result.status).toBe(200);
		expect(mocks.writeFrontmatterField).not.toHaveBeenCalled();
		const data = result.data as { frontmatterFlipped?: boolean };
		expect(data.frontmatterFlipped).toBe(false);
	});

	it('does NOT flip when outcome=fail even on a clean pass', async () => {
		// Outcome is the explicit user intent; cleanPass alone does not flip.
		const mocks = makeMocks({
			getOpenSession: vi.fn().mockResolvedValue({ id: 'sess_a' }),
			getItem: vi.fn().mockResolvedValue({
				id: 'item_test',
				kindId: 'wp_spec',
				ref: 'docs/work-packages/foo/spec.md',
				deletedAt: null,
			}),
			parseTestPlan: vi.fn().mockReturnValue([{ stepRef: 'r1' }]),
			listSteps: vi.fn().mockResolvedValue([{ stepRef: 'r1', outcome: 'pass' }]),
			everyStepPassed: vi.fn().mockReturnValue(true),
			finishSession: vi.fn().mockResolvedValue({}),
		});
		const result = await runFinishSession(mocks, {
			sessionId: 'sess_a',
			outcome: 'fail',
			note: '',
		});
		expect(result.status).toBe(200);
		expect(mocks.writeFrontmatterField).not.toHaveBeenCalled();
	});

	it('returns frontmatterError instead of throwing when writeFrontmatterField throws', async () => {
		const mocks = makeMocks({
			getOpenSession: vi.fn().mockResolvedValue({ id: 'sess_a' }),
			getItem: vi.fn().mockResolvedValue({
				id: 'item_test',
				kindId: 'wp_spec',
				ref: 'docs/work-packages/foo/spec.md',
				deletedAt: null,
			}),
			parseTestPlan: vi.fn().mockReturnValue([{ stepRef: 'r1' }]),
			listSteps: vi.fn().mockResolvedValue([{ stepRef: 'r1', outcome: 'pass' }]),
			everyStepPassed: vi.fn().mockReturnValue(true),
			finishSession: vi.fn().mockResolvedValue({}),
			writeFrontmatterField: vi.fn().mockRejectedValue(new Error('ENOENT: spec.md missing')),
		});
		const result = await runFinishSession(mocks, {
			sessionId: 'sess_a',
			outcome: 'pass',
			note: '',
		});
		expect(result.status).toBe(200);
		const data = result.data as { frontmatterFlipped?: boolean; frontmatterError?: string };
		expect(data.frontmatterFlipped).toBe(false);
		expect(data.frontmatterError).toMatch(/ENOENT/);
	});

	it('accepts abandoned as a user-finishable outcome', async () => {
		const mocks = makeMocks({
			getOpenSession: vi.fn().mockResolvedValue({ id: 'sess_a' }),
			getItem: vi.fn().mockResolvedValue({
				id: 'item_test',
				kindId: 'wp_spec',
				ref: 'docs/work-packages/foo/spec.md',
				deletedAt: null,
			}),
			parseTestPlan: vi.fn().mockReturnValue([{ stepRef: 'r1' }]),
			listSteps: vi.fn().mockResolvedValue([]),
			everyStepPassed: vi.fn().mockReturnValue(false),
			finishSession: vi.fn().mockResolvedValue({}),
		});
		const result = await runFinishSession(mocks, {
			sessionId: 'sess_a',
			outcome: 'abandoned',
			note: '',
		});
		expect(result.status).toBe(200);
		expect(mocks.finishSession).toHaveBeenCalledWith('sess_a', 'abandoned', '');
		expect(mocks.writeFrontmatterField).not.toHaveBeenCalled();
	});
});
