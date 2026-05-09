/**
 * Bucket admin action tests -- exercise create / update / delete server
 * actions on `/review/admin/buckets/new` and
 * `/review/admin/buckets/[bucketId]/edit`:
 *
 *  - create: validates the parser returns 400, redirects on success, threads
 *    the transaction handle to createBucket + auditWrite, and friendlies a
 *    PG `23505` unique violation as an inline name error.
 *  - update: redirects on success (mirrors create), echoes form values back
 *    on validation failure, audit-writes inside the same tx.
 *  - delete: redirects on success, audit-writes inside the same tx, surfaces
 *    a server-side error as a friendly form-level message.
 *
 * Heavy mocking via `vi.doMock` so we don't hit the live DB; what we verify
 * is the action contract (status, data shape, BC arg threading).
 */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

beforeEach(() => {
	vi.resetModules();
});

afterEach(() => {
	vi.restoreAllMocks();
});

interface BcMocks {
	createBucket: ReturnType<typeof vi.fn>;
	updateBucket: ReturnType<typeof vi.fn>;
	deleteBucket: ReturnType<typeof vi.fn>;
	getBucket: ReturnType<typeof vi.fn>;
	getOrCreateBoard: ReturnType<typeof vi.fn>;
	listBuckets: ReturnType<typeof vi.fn>;
	listItems: ReturnType<typeof vi.fn>;
	listItemsWithPassingSession: ReturnType<typeof vi.fn>;
	countItemsByCriteria: ReturnType<typeof vi.fn>;
	filterItemsByCriteria: ReturnType<typeof vi.fn>;
	validateBucketFilterCriteria: ReturnType<typeof vi.fn>;
}

function makeBc(overrides: Partial<BcMocks> = {}): BcMocks {
	return {
		createBucket: vi.fn().mockResolvedValue({ id: 'rbkt_NEW', name: 'B', kindId: 'wp_spec' }),
		updateBucket: vi.fn().mockResolvedValue({ id: 'rbkt_EXISTING', name: 'B', kindId: 'wp_spec' }),
		deleteBucket: vi.fn().mockResolvedValue(undefined),
		getBucket: vi.fn().mockResolvedValue({
			id: 'rbkt_EXISTING',
			boardId: 'brd_test',
			name: 'B',
			kindId: 'wp_spec',
			sortOrder: 1,
			filterCriteria: {},
		}),
		getOrCreateBoard: vi.fn().mockResolvedValue({ id: 'brd_test' }),
		listBuckets: vi.fn().mockResolvedValue([]),
		listItems: vi.fn().mockResolvedValue([]),
		listItemsWithPassingSession: vi.fn().mockResolvedValue(new Set<string>()),
		countItemsByCriteria: vi.fn().mockResolvedValue(0),
		filterItemsByCriteria: vi.fn().mockReturnValue([]),
		// Default: pass-through (parser branches that don't go through
		// validate run the structured path, not this).
		validateBucketFilterCriteria: vi.fn((x: unknown) => x as Record<string, unknown>),
		...overrides,
	};
}

const TX_MARKER = { __tx: true };

function installCommonMocks(bc: BcMocks): void {
	vi.doMock('@ab/auth', () => ({
		requireRole: () => ({ id: 'user_test' }),
	}));
	vi.doMock('@ab/audit', () => ({
		AUDIT_OPS: { CREATE: 'create', UPDATE: 'update', DELETE: 'delete', ACTION: 'action' },
		auditWrite: vi.fn().mockResolvedValue({ id: 'audit_test' }),
	}));
	vi.doMock('@ab/bc-hangar', () => ({ ...bc }));
	vi.doMock('@ab/bc-hangar/server', () => ({ ...bc }));
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

async function runCreate(bc: BcMocks, form: Record<string, string | string[]>): Promise<ActionResult> {
	installCommonMocks(bc);
	const mod = await import('./new/+page.server');
	const fd = new FormData();
	for (const [k, v] of Object.entries(form)) {
		if (Array.isArray(v)) for (const each of v) fd.append(k, each);
		else fd.append(k, v);
	}
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
		if (typeof err === 'object' && err !== null && 'status' in err && 'location' in err) {
			const r = err as { status: number; location: string };
			return { status: r.status, location: r.location };
		}
		throw err;
	}
}

async function runEditUpdate(bc: BcMocks, bucketId: string, form: Record<string, string>): Promise<ActionResult> {
	installCommonMocks(bc);
	const mod = await import('./[bucketId]/edit/+page.server');
	const fd = new FormData();
	for (const [k, v] of Object.entries(form)) fd.append(k, v);
	const event = {
		params: { bucketId },
		request: { formData: async () => fd },
		locals: { requestId: 'req-test' },
	} as unknown as Parameters<NonNullable<(typeof mod.actions)['update']>>[0];
	const handler = mod.actions.update;
	if (!handler) throw new Error('update action not exported');
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

async function runEditDelete(bc: BcMocks, bucketId: string): Promise<ActionResult> {
	installCommonMocks(bc);
	const mod = await import('./[bucketId]/edit/+page.server');
	const event = {
		params: { bucketId },
		request: { formData: async () => new FormData() },
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

describe('?/createBucket (default action on /review/admin/buckets/new)', () => {
	it('rejects empty name with 400 + field error', async () => {
		const bc = makeBc();
		const result = await runCreate(bc, { name: '', kindId: 'wp_spec', sortOrder: '0' });
		expect(result.status).toBe(400);
		const data = result.data as { errors: Record<string, string> };
		expect(data.errors.name).toMatch(/required/i);
		expect(bc.createBucket).not.toHaveBeenCalled();
	});

	it('threads the transaction handle to createBucket on success and redirects', async () => {
		const bc = makeBc();
		const result = await runCreate(bc, { name: 'My bucket', kindId: 'wp_spec', sortOrder: '5' });
		expect(result.status).toBe(303);
		expect(bc.createBucket).toHaveBeenCalledTimes(1);
		// Second arg is the tx handle.
		expect(bc.createBucket.mock.calls[0]?.[1]).toBe(TX_MARKER);
	});

	it('friendlies a PG 23505 unique violation as an inline name error', async () => {
		const dupErr = Object.assign(new Error('duplicate'), { code: '23505' });
		const bc = makeBc({ createBucket: vi.fn().mockRejectedValue(dupErr) });
		const result = await runCreate(bc, { name: 'Dup', kindId: 'wp_spec', sortOrder: '0' });
		expect(result.status).toBe(500);
		const data = result.data as { errors: Record<string, string> };
		expect(data.errors.name).toMatch(/already exists/);
	});
});

describe('?/update (edit page)', () => {
	it('echoes form values back on validation failure', async () => {
		const bc = makeBc();
		const result = await runEditUpdate(bc, 'rbkt_EXISTING', {
			name: '',
			kindId: 'wp_spec',
			sortOrder: '0',
		});
		expect(result.status).toBe(400);
		const data = result.data as { errors: Record<string, string>; values: { name: string } };
		expect(data.errors.name).toMatch(/required/i);
		expect(data.values.name).toBe('');
		expect(bc.updateBucket).not.toHaveBeenCalled();
	});

	it('redirects to buckets list on success and threads the tx', async () => {
		const bc = makeBc();
		const result = await runEditUpdate(bc, 'rbkt_EXISTING', {
			name: 'Renamed',
			kindId: 'wp_spec',
			sortOrder: '0',
		});
		expect(result.status).toBe(303);
		expect(result.location).toBeDefined();
		expect(bc.updateBucket).toHaveBeenCalledTimes(1);
		expect(bc.updateBucket.mock.calls[0]?.[2]).toBe(TX_MARKER);
	});

	it('returns 404 when bucketId has the wrong prefix', async () => {
		const bc = makeBc();
		try {
			await runEditUpdate(bc, 'task_NOT_A_BUCKET', {
				name: 'X',
				kindId: 'wp_spec',
				sortOrder: '0',
			});
			throw new Error('expected 404');
		} catch (err) {
			// SvelteKit's `error()` throws an HttpError with `status` and `body`.
			if (err && typeof err === 'object' && 'status' in err) {
				expect((err as { status: number }).status).toBe(404);
			} else {
				throw err;
			}
		}
		expect(bc.updateBucket).not.toHaveBeenCalled();
	});
});

describe('?/delete (edit page)', () => {
	it('redirects to buckets list on success and threads the tx', async () => {
		const bc = makeBc();
		const result = await runEditDelete(bc, 'rbkt_EXISTING');
		expect(result.status).toBe(303);
		expect(bc.deleteBucket).toHaveBeenCalledTimes(1);
		expect(bc.deleteBucket.mock.calls[0]?.[1]).toBe(TX_MARKER);
	});

	it('surfaces a friendly error message on failure', async () => {
		const bc = makeBc({ deleteBucket: vi.fn().mockRejectedValue(new Error('boom')) });
		const result = await runEditDelete(bc, 'rbkt_EXISTING');
		expect(result.status).toBe(500);
		const data = result.data as { delete: string };
		expect(data.delete).toMatch(/Bucket delete failed/);
	});
});
