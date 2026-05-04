/**
 * Task CRUD action tests -- exercise `default` (create), `update`, and
 * `delete`:
 *
 *   - all three wrap their two-step writes in `db.transaction`. We mock
 *     `@ab/db/connection` so `db.transaction(fn)` invokes `fn(tx)` with a
 *     stub `tx`, then assert the BC primitives received that tx (proves
 *     they were threaded through, not run on the default connection).
 *   - `default` (create) validates title / type / productArea, redirects
 *     on success, friendlies a Postgres FK violation.
 *   - `update` echoes form values back on validation failure (mirrors
 *     create's pattern), upserts the mirror inside the same tx as the
 *     task update.
 *   - `delete` soft-deletes the mirror review_item before hard-deleting
 *     the task, then redirects with the deletedTitle param.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

beforeEach(() => {
	vi.resetModules();
});

afterEach(() => {
	vi.restoreAllMocks();
});

interface BcMocks {
	createTask: ReturnType<typeof vi.fn>;
	updateTask: ReturnType<typeof vi.fn>;
	deleteTask: ReturnType<typeof vi.fn>;
	getTask: ReturnType<typeof vi.fn>;
	getOrCreateBoard: ReturnType<typeof vi.fn>;
	listColumns: ReturnType<typeof vi.fn>;
	listTasks: ReturnType<typeof vi.fn>;
	upsertItem: ReturnType<typeof vi.fn>;
	findItemByRef: ReturnType<typeof vi.fn>;
	softDeleteItem: ReturnType<typeof vi.fn>;
}

function makeBc(overrides: Partial<BcMocks> = {}): BcMocks {
	return {
		createTask: vi.fn().mockResolvedValue({ id: 'task_new' }),
		updateTask: vi.fn().mockResolvedValue(undefined),
		deleteTask: vi.fn().mockResolvedValue(undefined),
		getTask: vi.fn(),
		getOrCreateBoard: vi.fn().mockResolvedValue({ id: 'board_test' }),
		listColumns: vi.fn().mockResolvedValue([]),
		listTasks: vi.fn().mockResolvedValue([]),
		upsertItem: vi.fn().mockResolvedValue(undefined),
		findItemByRef: vi.fn().mockResolvedValue(null),
		softDeleteItem: vi.fn().mockResolvedValue(undefined),
		...overrides,
	};
}

const TX_MARKER = { __tx: true };

function installCommonMocks(bc: BcMocks): void {
	vi.doMock('@ab/auth', () => ({
		requireRole: () => ({ id: 'user_test' }),
	}));
	vi.doMock('@ab/bc-hangar', () => ({ ...bc }));
	vi.doMock('@ab/db/connection', () => ({
		db: {
			transaction: async (fn: (tx: unknown) => Promise<unknown>) => fn(TX_MARKER),
		},
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
	location?: string;
}

async function runCreate(bc: BcMocks, form: Record<string, string>): Promise<ActionResult> {
	installCommonMocks(bc);
	const mod = await import('./new/+page.server');
	const fd = new FormData();
	for (const [k, v] of Object.entries(form)) fd.append(k, v);
	const event = {
		params: {},
		request: { formData: async () => fd },
		locals: { requestId: 'req-test' },
	} as unknown as Parameters<NonNullable<(typeof mod.actions)['default']>>[0];
	const handler = mod.actions.default;
	if (!handler) throw new Error('default action not exported');
	try {
		const result = await handler(event);
		const value = result as { status?: number; data?: unknown };
		return { status: value?.status ?? 200, data: value?.data ?? value };
	} catch (err) {
		// SvelteKit `redirect()` throws a `{ status, location }` object.
		if (typeof err === 'object' && err !== null && 'status' in err && 'location' in err) {
			const r = err as { status: number; location: string };
			return { status: r.status, location: r.location };
		}
		throw err;
	}
}

async function runEditUpdate(bc: BcMocks, taskId: string, form: Record<string, string>): Promise<ActionResult> {
	installCommonMocks(bc);
	const mod = await import('./[taskId]/edit/+page.server');
	const fd = new FormData();
	for (const [k, v] of Object.entries(form)) fd.append(k, v);
	const event = {
		params: { taskId },
		request: { formData: async () => fd },
		locals: { requestId: 'req-test' },
	} as unknown as Parameters<NonNullable<(typeof mod.actions)['update']>>[0];
	const handler = mod.actions.update;
	if (!handler) throw new Error('update action not exported');
	const result = await handler(event);
	const value = result as { status?: number; data?: unknown };
	return { status: value?.status ?? 200, data: value?.data ?? value };
}

async function runEditDelete(bc: BcMocks, taskId: string): Promise<ActionResult> {
	installCommonMocks(bc);
	const mod = await import('./[taskId]/edit/+page.server');
	const fd = new FormData();
	const event = {
		params: { taskId },
		request: { formData: async () => fd },
		locals: { requestId: 'req-test' },
	} as unknown as Parameters<NonNullable<(typeof mod.actions)['delete']>>[0];
	const handler = mod.actions.delete;
	if (!handler) throw new Error('delete action not exported');
	try {
		const result = await handler(event);
		const value = result as { status?: number; data?: unknown };
		return { status: value?.status ?? 200, data: value?.data ?? value };
	} catch (err) {
		if (typeof err === 'object' && err !== null && 'status' in err && 'location' in err) {
			const r = err as { status: number; location: string };
			return { status: r.status, location: r.location };
		}
		throw err;
	}
}

describe('?/createTask (default action on /review/tasks/new)', () => {
	it('rejects missing title with field errors and echoes values', async () => {
		const bc = makeBc();
		const result = await runCreate(bc, {
			title: '',
			type: 'bug',
			productArea: 'hangar',
			description: 'Lost description should be echoed back',
		});
		expect(result.status).toBe(400);
		const data = result.data as { errors: Record<string, string>; values: Record<string, string> };
		expect(data.errors.title).toMatch(/required/i);
		expect(data.values.description).toBe('Lost description should be echoed back');
		expect(bc.createTask).not.toHaveBeenCalled();
		expect(bc.upsertItem).not.toHaveBeenCalled();
	});

	it('rejects invalid type with 400', async () => {
		const bc = makeBc();
		const result = await runCreate(bc, {
			title: 'Test',
			type: 'not-a-type',
			productArea: 'hangar',
		});
		expect(result.status).toBe(400);
		expect(bc.createTask).not.toHaveBeenCalled();
	});

	it('threads the transaction handle to createTask + upsertItem on success', async () => {
		const bc = makeBc();
		const result = await runCreate(bc, {
			title: 'Test task',
			type: 'bug',
			productArea: 'hangar',
		});
		expect(result.status).toBe(303);
		expect(bc.createTask).toHaveBeenCalledTimes(1);
		expect(bc.upsertItem).toHaveBeenCalledTimes(1);
		// Both calls receive `TX_MARKER` as their second / db arg.
		expect(bc.createTask.mock.calls[0]?.[1]).toBe(TX_MARKER);
		expect(bc.upsertItem.mock.calls[0]?.[1]).toBe(TX_MARKER);
		expect(result.location).toMatch(/created=task_new/);
	});

	it('friendlies a Postgres FK violation on assignee', async () => {
		const fkError = Object.assign(new Error('insert violates foreign key constraint "board_task_assignee_fk"'), {
			code: '23503',
			constraint: 'board_task_assignee_fk',
		});
		const bc = makeBc({
			createTask: vi.fn().mockRejectedValue(fkError),
		});
		const result = await runCreate(bc, {
			title: 'Test',
			type: 'bug',
			productArea: 'hangar',
			assigneeId: 'auth_bogus',
		});
		expect(result.status).toBe(500);
		const data = result.data as { errors: Record<string, string> };
		expect(data.errors._form).toMatch(/Assignee not found/);
	});
});

describe('?/update (edit page)', () => {
	it('echoes form values back on validation failure', async () => {
		const bc = makeBc();
		const result = await runEditUpdate(bc, 'task_existing', {
			title: '', // invalid
			type: 'bug',
			productArea: 'hangar',
			description: 'Should survive validation rejection',
		});
		expect(result.status).toBe(400);
		const data = result.data as { update: 'invalid'; errors: Record<string, string>; values: Record<string, string> };
		expect(data.update).toBe('invalid');
		expect(data.values.description).toBe('Should survive validation rejection');
		expect(bc.updateTask).not.toHaveBeenCalled();
	});

	it('threads the transaction to updateTask + upsertItem', async () => {
		const bc = makeBc();
		const result = await runEditUpdate(bc, 'task_existing', {
			title: 'Edited title',
			type: 'bug',
			productArea: 'hangar',
			description: 'desc',
		});
		expect(result.status).toBe(200);
		expect(bc.updateTask).toHaveBeenCalledTimes(1);
		expect(bc.upsertItem).toHaveBeenCalledTimes(1);
		expect(bc.updateTask.mock.calls[0]?.[2]).toBe(TX_MARKER);
		expect(bc.upsertItem.mock.calls[0]?.[1]).toBe(TX_MARKER);
		expect(result.data).toMatchObject({ update: 'ok' });
	});
});

describe('?/delete (edit page)', () => {
	it('soft-deletes the mirror before hard-deleting the task, both inside the same tx', async () => {
		const bc = makeBc({
			getTask: vi.fn().mockResolvedValue({ id: 'task_existing', title: 'Old task' }),
			findItemByRef: vi.fn().mockResolvedValue({ id: 'item_mirror' }),
		});
		const result = await runEditDelete(bc, 'task_existing');
		expect(result.status).toBe(303);
		expect(bc.softDeleteItem).toHaveBeenCalledWith('item_mirror', TX_MARKER);
		expect(bc.deleteTask).toHaveBeenCalledWith('task_existing', TX_MARKER);
		// Order: soft-delete first, then hard-delete.
		const softInvocation = bc.softDeleteItem.mock.invocationCallOrder[0];
		const hardInvocation = bc.deleteTask.mock.invocationCallOrder[0];
		expect(softInvocation).toBeLessThan(hardInvocation);
		expect(result.location).toMatch(/deletedTitle=Old%20task/);
	});

	it('returns 404 fail when the task is missing', async () => {
		const bc = makeBc({
			getTask: vi.fn().mockResolvedValue(null),
		});
		const result = await runEditDelete(bc, 'task_missing');
		expect(result.status).toBe(404);
		expect(bc.deleteTask).not.toHaveBeenCalled();
	});
});
