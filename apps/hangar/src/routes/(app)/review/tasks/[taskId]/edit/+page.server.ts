/**
 * `/review/tasks/[taskId]/edit` -- edit / delete an ad-hoc task.
 *
 * Mirrors the create form's field shape. The delete action is confirm-gated
 * client-side and routes back to the board on success. Column changes here
 * affect the on-board position (the board's drag-drop is the more general
 * affordance; this form is the keyboard-driven path).
 *
 * Both `update` and `delete` wrap their two-step writes (board_task +
 * mirrored review_item) in a single transaction so a partial failure rolls
 * back. Without the transaction, an `updateTask` succeeding followed by a
 * mirror upsert failure would leave the kanban card pointing at stale
 * denormalized fields until a manual re-edit.
 */

import { requireRole } from '@ab/auth';
import {
	deleteTask,
	findItemByRef,
	getOrCreateBoard,
	getTask,
	listColumns,
	softDeleteItem,
	updateTask,
	upsertItem,
} from '@ab/bc-hangar/server';
import {
	PRODUCT_AREA_LABELS,
	PRODUCT_AREA_VALUES,
	type ProductArea,
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
import { error, fail, isRedirect, redirect } from '@sveltejs/kit';
import type { Actions, PageServerLoad } from './$types';

const log = createLogger('hangar:review:tasks:edit');

export const load: PageServerLoad = async (event) => {
	requireRole(event, ROLES.AUTHOR, ROLES.OPERATOR, ROLES.ADMIN);
	const { taskId } = event.params;
	const task = await getTask(taskId);
	if (!task) throw error(404, 'Task not found');
	const board = await getOrCreateBoard();
	const columns = await listColumns(board.id);
	return {
		task: {
			id: task.id,
			title: task.title,
			description: task.description,
			type: task.type,
			productArea: task.productArea,
			columnId: task.columnId,
			assigneeId: task.assigneeId,
			createdBy: task.createdBy,
			sortOrder: task.sortOrder,
		},
		columns: columns.map((c) => ({ id: c.id, name: c.name })),
		taskTypes: TASK_TYPE_VALUES.map((id) => ({ id, label: TASK_TYPE_LABELS[id] })),
		productAreas: PRODUCT_AREA_VALUES.map((id) => ({ id, label: PRODUCT_AREA_LABELS[id] })),
	};
};

function isTaskType(value: unknown): value is TaskType {
	return typeof value === 'string' && (TASK_TYPE_VALUES as readonly string[]).includes(value);
}

function isProductArea(value: unknown): value is ProductArea {
	return typeof value === 'string' && (PRODUCT_AREA_VALUES as readonly string[]).includes(value);
}

interface FormValues {
	title: string;
	description: string;
	type: string;
	productArea: string;
	columnId: string;
	assigneeId: string;
}

export const actions: Actions = {
	update: async (event) => {
		requireRole(event, ROLES.AUTHOR, ROLES.OPERATOR, ROLES.ADMIN);
		const { taskId } = event.params;
		const fd = await event.request.formData();
		const title = String(fd.get('title') ?? '').trim();
		const description = String(fd.get('description') ?? '').trim();
		const typeRaw = String(fd.get('type') ?? '');
		const productAreaRaw = String(fd.get('productArea') ?? '');
		const columnIdRaw = String(fd.get('columnId') ?? '');
		const assigneeIdRaw = String(fd.get('assigneeId') ?? '').trim();
		const values: FormValues = {
			title,
			description,
			type: typeRaw,
			productArea: productAreaRaw,
			columnId: columnIdRaw,
			assigneeId: assigneeIdRaw,
		};
		const errors: Record<string, string> = {};
		if (title === '') errors.title = 'Title is required.';
		if (title.length > 200) errors.title = 'Title must be 200 characters or fewer.';
		if (!isTaskType(typeRaw)) errors.type = 'Pick a type.';
		if (!isProductArea(productAreaRaw)) errors.productArea = 'Pick a product area.';
		if (Object.keys(errors).length > 0) {
			return fail(400, { update: 'invalid' as const, errors, values });
		}
		if (!isTaskType(typeRaw) || !isProductArea(productAreaRaw)) {
			throw new Error('unreachable: validated above');
		}
		try {
			// Atomic: updateTask + upsertItem run in one transaction so the
			// canonical task row and the kanban mirror never disagree on
			// title / type / productArea.
			await db.transaction(async (tx) => {
				await updateTask(
					taskId,
					{
						title,
						description,
						type: typeRaw,
						productArea: productAreaRaw,
						columnId: columnIdRaw === '' ? null : columnIdRaw,
						assigneeId: assigneeIdRaw === '' ? null : assigneeIdRaw,
					},
					tx,
				);
				const board = await getOrCreateBoard(tx);
				await upsertItem(
					{
						boardId: board.id,
						kindId: REVIEW_KINDS.AD_HOC,
						ref: taskId,
						title,
						frontmatterStatus: null,
						reviewStatus: null,
						cachedFields: { otherFields: { type: typeRaw, productArea: productAreaRaw } },
					},
					tx,
				);
			});
			return { update: 'ok' as const, values };
		} catch (err) {
			const message = friendlyDbError(err) ?? (err instanceof Error ? err.message : 'Update failed.');
			log.error('updateTask failed', undefined, err instanceof Error ? err : new Error(message));
			return fail(500, { update: message, values });
		}
	},

	delete: async (event) => {
		requireRole(event, ROLES.AUTHOR, ROLES.OPERATOR, ROLES.ADMIN);
		const { taskId } = event.params;
		const task = await getTask(taskId);
		if (!task) {
			return fail(404, { delete: 'Task not found.' });
		}
		try {
			// Atomic: soft-delete the mirrored review_item before hard-deleting
			// the underlying board_task so the order can never partially apply.
			// Hard-deleting the task while the mirror survives would leave the
			// editor still loadable and silently re-resurrect on next save.
			await db.transaction(async (tx) => {
				const board = await getOrCreateBoard(tx);
				const mirror = await findItemByRef(board.id, REVIEW_KINDS.AD_HOC, taskId, tx);
				if (mirror) await softDeleteItem(mirror.id, tx);
				await deleteTask(taskId, tx);
			});
		} catch (err) {
			if (isRedirect(err)) throw err;
			const message = err instanceof Error ? err.message : 'Delete failed.';
			log.error('deleteTask failed', undefined, err instanceof Error ? err : new Error(message));
			return fail(500, { delete: message });
		}
		// Redirect with a `deletedTitle` flag the board surfaces as a one-shot
		// toast on mount, then strips. Without this the user lands on a re-
		// rendered board with a missing card and no closing handshake -- the
		// destructive action's only feedback would be "the card is gone."
		const target = `${ROUTES.HANGAR_REVIEW}?${REVIEW_TASK_FLOW_PARAMS.DELETED_TITLE}=${encodeURIComponent(task.title)}`;
		throw redirect(303, target);
	},
};

function friendlyDbError(err: unknown): string | null {
	if (typeof err !== 'object' || err === null) return null;
	const candidate = err as { code?: string; constraint?: string };
	if (candidate.code !== '23503') return null;
	const c = candidate.constraint ?? '';
	if (c.includes('assignee')) return 'Assignee not found. Leave blank or use a valid user id.';
	if (c.includes('column')) return 'Selected column does not exist on the board.';
	return 'A referenced row was not found.';
}
