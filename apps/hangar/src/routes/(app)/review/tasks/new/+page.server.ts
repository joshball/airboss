/**
 * `/review/tasks/new` -- create an ad-hoc task on the review board.
 *
 * Backed by `hangarBoardTask`. Required fields: `title`, `type`,
 * `productArea`. Optional: `description`, `assigneeId`, `columnId`. The
 * board id is derived from `getOrCreateBoard()` so the task lands on the
 * single review board the loader uses; multi-board support is out of scope
 * (per spec).
 *
 * `createdBy` is set to the current session user; the task lands at the
 * end of the column (max sortOrder + 1) so existing rows don't get
 * reshuffled. The board read + the create are wrapped in a transaction so
 * the underlying `board_task` and the mirrored `review_item` row land
 * atomically -- a half-applied write would leave the kanban board with a
 * task that's invisible (no mirror) or a phantom mirror with no task.
 */

import { requireRole } from '@ab/auth';
import { createTask, getOrCreateBoard, listColumns, listTasks, upsertItem } from '@ab/bc-hangar/server';
import {
	PRODUCT_AREA_LABELS,
	PRODUCT_AREA_VALUES,
	type ProductArea,
	REVIEW_BOARD_COLUMN_NAMES,
	REVIEW_KINDS,
	REVIEW_TASK_FLOW_PARAMS,
	ROLES,
	ROUTES,
	TASK_TYPE_LABELS,
	TASK_TYPE_VALUES,
	type TaskType,
} from '@ab/constants';
import { db } from '@ab/db/connection';
import { createLogger } from '@ab/utils';
import { fail, isRedirect, redirect } from '@sveltejs/kit';
import type { Actions, PageServerLoad } from './$types';

const log = createLogger('hangar:review:tasks:new');

export const load: PageServerLoad = async (event) => {
	requireRole(event, ROLES.AUTHOR, ROLES.OPERATOR, ROLES.ADMIN);
	const board = await getOrCreateBoard();
	const columns = await listColumns(board.id);
	return {
		boardId: board.id,
		columns: columns.map((c) => ({ id: c.id, name: c.name })),
		taskTypes: TASK_TYPE_VALUES.map((id) => ({ id, label: TASK_TYPE_LABELS[id] })),
		productAreas: PRODUCT_AREA_VALUES.map((id) => ({ id, label: PRODUCT_AREA_LABELS[id] })),
		defaultColumnName: REVIEW_BOARD_COLUMN_NAMES.BACKLOG,
	};
};

function isTaskType(value: unknown): value is TaskType {
	return typeof value === 'string' && (TASK_TYPE_VALUES as readonly string[]).includes(value);
}

function isProductArea(value: unknown): value is ProductArea {
	return typeof value === 'string' && (PRODUCT_AREA_VALUES as readonly string[]).includes(value);
}

export const actions: Actions = {
	default: async (event) => {
		const user = requireRole(event, ROLES.AUTHOR, ROLES.OPERATOR, ROLES.ADMIN);
		const fd = await event.request.formData();
		const title = String(fd.get('title') ?? '').trim();
		const description = String(fd.get('description') ?? '').trim();
		const typeRaw = String(fd.get('type') ?? '');
		const productAreaRaw = String(fd.get('productArea') ?? '');
		const columnIdRaw = String(fd.get('columnId') ?? '');
		const assigneeIdRaw = String(fd.get('assigneeId') ?? '').trim();
		const errors: Record<string, string> = {};
		if (title === '') errors.title = 'Title is required.';
		if (title.length > 200) errors.title = 'Title must be 200 characters or fewer.';
		if (!isTaskType(typeRaw)) errors.type = 'Pick a type.';
		if (!isProductArea(productAreaRaw)) errors.productArea = 'Pick a product area.';
		if (Object.keys(errors).length > 0) {
			return fail(400, {
				errors,
				values: {
					title,
					description,
					type: typeRaw,
					productArea: productAreaRaw,
					columnId: columnIdRaw,
					assigneeId: assigneeIdRaw,
				},
			});
		}
		// At this point we've narrowed: TS still needs the assertion.
		if (!isTaskType(typeRaw) || !isProductArea(productAreaRaw)) {
			throw new Error('unreachable: validated above');
		}
		// Wrap board / column / sortOrder peek + the two mutating writes in a
		// single transaction so a partial-state failure (FK / network blip)
		// rolls back. Without the wrapper, a `createTask` success followed by
		// an `upsertItem` failure leaves the user with an invisible task --
		// the board can't see it because the mirror is missing, and the
		// loader skips ad_hoc kinds in its prune walk.
		let taskId: string;
		try {
			taskId = await db.transaction(async (tx) => {
				const board = await getOrCreateBoard(tx);
				const existing = await listTasks(board.id, tx);
				const nextSortOrder = existing.length === 0 ? 0 : Math.max(...existing.map((t) => t.sortOrder)) + 1;
				const task = await createTask(
					{
						boardId: board.id,
						title,
						description: description === '' ? undefined : description,
						type: typeRaw,
						productArea: productAreaRaw,
						columnId: columnIdRaw === '' ? null : columnIdRaw,
						assigneeId: assigneeIdRaw === '' ? null : assigneeIdRaw,
						createdBy: user.id,
						sortOrder: nextSortOrder,
					},
					tx,
				);
				// Mirror the task on the board as a `review_item` row so it shows
				// up in the kanban view alongside spec/TOC/knowledge-node items.
				// Ad-hoc items survive loader passes (the loader skips them in
				// the soft-prune walk) so this is a one-time write per task.
				await upsertItem(
					{
						boardId: board.id,
						kindId: REVIEW_KINDS.AD_HOC,
						ref: task.id,
						title,
						frontmatterStatus: null,
						reviewStatus: null,
						cachedFields: { otherFields: { type: typeRaw, productArea: productAreaRaw } },
					},
					tx,
				);
				return task.id;
			});
		} catch (err) {
			if (isRedirect(err)) throw err;
			const message = friendlyDbError(err) ?? (err instanceof Error ? err.message : 'Task create failed.');
			log.error('createTask failed', undefined, err instanceof Error ? err : new Error(message));
			const formErrors: Record<string, string> = { _form: message };
			return fail(500, {
				errors: formErrors,
				values: {
					title,
					description,
					type: typeRaw,
					productArea: productAreaRaw,
					columnId: columnIdRaw,
					assigneeId: assigneeIdRaw,
				},
			});
		}
		// Redirect to the board with a `created` flag the board reads on mount
		// to surface a "Task created" toast (then strips the param). Pattern
		// mirrors `REVIEW_WP_SPEC_FINISH_PARAMS` for the walker -- the board's
		// rerender after redirect needs the closing handshake or the user has
		// no confirmation that the create landed.
		const target = `${ROUTES.HANGAR_REVIEW}?${REVIEW_TASK_FLOW_PARAMS.CREATED}=${encodeURIComponent(taskId)}&${REVIEW_TASK_FLOW_PARAMS.CREATED_TITLE}=${encodeURIComponent(title)}`;
		throw redirect(303, target);
	},
};

/**
 * Map a Postgres FK violation to a user-facing error message. Returns null
 * when the error isn't a known shape; the caller falls back to the raw
 * message in that case.
 */
function friendlyDbError(err: unknown): string | null {
	if (typeof err !== 'object' || err === null) return null;
	const candidate = err as { code?: string; constraint?: string };
	if (candidate.code !== '23503') return null;
	const c = candidate.constraint ?? '';
	if (c.includes('assignee')) return 'Assignee not found. Leave blank or use a valid user id.';
	if (c.includes('column')) return 'Selected column does not exist on the board.';
	return 'A referenced row was not found.';
}
