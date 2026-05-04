/**
 * `/review/tasks/[taskId]/edit` -- edit / delete an ad-hoc task.
 *
 * Mirrors the create form's field shape. The delete action is confirm-gated
 * client-side and routes back to the board on success. Column changes here
 * affect the on-board position (the board's drag-drop is the more general
 * affordance; this form is the keyboard-driven path).
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
} from '@ab/bc-hangar';
import {
	PRODUCT_AREA_LABELS,
	PRODUCT_AREA_VALUES,
	type ProductArea,
	ROLES,
	ROUTES,
	TASK_TYPE_LABELS,
	TASK_TYPE_VALUES,
	type TaskType,
} from '@ab/constants';
import { createLogger } from '@ab/utils';
import { error, fail, redirect } from '@sveltejs/kit';
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
		const errors: Record<string, string> = {};
		if (title === '') errors.title = 'Title is required.';
		if (title.length > 200) errors.title = 'Title must be 200 characters or fewer.';
		if (!isTaskType(typeRaw)) errors.type = 'Pick a type.';
		if (!isProductArea(productAreaRaw)) errors.productArea = 'Pick a product area.';
		if (Object.keys(errors).length > 0) {
			return fail(400, { update: 'invalid' as const, errors });
		}
		if (!isTaskType(typeRaw) || !isProductArea(productAreaRaw)) {
			throw new Error('unreachable: validated above');
		}
		try {
			await updateTask(taskId, {
				title,
				description,
				type: typeRaw,
				productArea: productAreaRaw,
				columnId: columnIdRaw === '' ? null : columnIdRaw,
				assigneeId: assigneeIdRaw === '' ? null : assigneeIdRaw,
			});
			// Mirror the title + classifying fields onto the board's review_item
			// row so the kanban card label stays in sync. `upsertItem` matches by
			// (boardId, kindId, ref) and updates in place when found.
			const board = await getOrCreateBoard();
			await upsertItem({
				boardId: board.id,
				kindId: 'ad_hoc',
				ref: taskId,
				title,
				frontmatterStatus: null,
				reviewStatus: null,
				cachedFields: { otherFields: { type: typeRaw, productArea: productAreaRaw } },
			});
			return { update: 'ok' as const };
		} catch (err) {
			const message = err instanceof Error ? err.message : 'Update failed.';
			log.error('updateTask failed', undefined, err instanceof Error ? err : new Error(message));
			return fail(500, { update: message });
		}
	},

	delete: async (event) => {
		requireRole(event, ROLES.AUTHOR, ROLES.OPERATOR, ROLES.ADMIN);
		const { taskId } = event.params;
		try {
			// Soft-delete the mirrored review_item so it disappears from the
			// board immediately. We hard-delete the underlying board_task row
			// so the user-visible "task" is gone; the review_item soft-delete
			// preserves any session history (today there is none for ad_hoc,
			// but if a future kind grows session support the pattern stays).
			const board = await getOrCreateBoard();
			const mirror = await findItemByRef(board.id, 'ad_hoc', taskId);
			if (mirror) await softDeleteItem(mirror.id);
			await deleteTask(taskId);
		} catch (err) {
			const message = err instanceof Error ? err.message : 'Delete failed.';
			log.error('deleteTask failed', undefined, err instanceof Error ? err : new Error(message));
			return fail(500, { delete: message });
		}
		throw redirect(303, ROUTES.HANGAR_REVIEW);
	},
};
