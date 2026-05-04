/**
 * `/review` board form actions:
 *
 * - `?/move` -- drag-drop / "Move to..." button. Pins the item to the
 *   target column, then writes back frontmatter per the spec rules:
 *
 *     Backlog       -> status: unread
 *     In Progress   -> status: reading
 *     Review        -> status: done (review_status stays as-is)
 *     Done          -> status: done, review_status: done
 *
 *   Frontmatter writes only fire for kinds whose `ref` is a repo-relative
 *   `.md` path (`wp_spec`, `wp_test_plan`, `knowledge_node`). Other kinds
 *   (e.g. `ad_hoc`, `reference_toc`) just pin the column.
 *
 *   On a frontmatter write failure (file deleted, permission denied) the
 *   pin is reverted and the action returns a typed error so the page can
 *   surface a toast.
 *
 * - `?/runLoader` -- manual loader refresh from the board (same shape as
 *   the `/docs` empty-state nudge).
 */

import { resolve } from 'node:path';
import { requireRole } from '@ab/auth';
import {
	getItem,
	getOrCreateBoard,
	listColumns,
	loadReviewItems,
	pinItemToColumn,
	REPO_ROOT,
	writeFrontmatterField,
} from '@ab/bc-hangar';
import { ROLES } from '@ab/constants';
import { createLogger } from '@ab/utils';
import { fail } from '@sveltejs/kit';
import type { Actions } from './$types';

const log = createLogger('hangar:review');

/** Map column NAME -> frontmatter `(status, reviewStatus)` writes. Returns
 * null when the column doesn't trigger a frontmatter write (e.g. an
 * unknown name). The spec rules: Backlog -> unread; In Progress ->
 * reading; Review -> status: done (review_status stays); Done -> both. */
function frontmatterTargetFor(columnName: string): {
	status: string | null;
	reviewStatus: string | null;
} | null {
	switch (columnName) {
		case 'Backlog':
			return { status: 'unread', reviewStatus: null };
		case 'In Progress':
			return { status: 'reading', reviewStatus: null };
		case 'Review':
			return { status: 'done', reviewStatus: null };
		case 'Done':
			return { status: 'done', reviewStatus: 'done' };
		default:
			return null;
	}
}

/** Kinds whose `ref` is a repo-relative path to a markdown file the
 * frontmatter writer can edit. */
const FRONTMATTER_BACKED_KINDS: ReadonlySet<string> = new Set(['wp_spec', 'wp_test_plan', 'knowledge_node']);

export const actions: Actions = {
	move: async (event) => {
		requireRole(event, ROLES.AUTHOR, ROLES.OPERATOR, ROLES.ADMIN);
		const data = await event.request.formData();
		const itemId = (data.get('itemId') ?? '').toString();
		const toColumnId = (data.get('toColumnId') ?? '').toString();
		if (itemId === '' || toColumnId === '') {
			return fail(400, { move: 'Missing itemId or toColumnId.' as const });
		}
		const item = await getItem(itemId);
		if (!item) return fail(404, { move: 'Item not found.' as const });
		const board = await getOrCreateBoard();
		if (item.boardId !== board.id) return fail(404, { move: 'Item not on this board.' as const });
		const columns = await listColumns(board.id);
		const target = columns.find((c) => c.id === toColumnId);
		if (!target) return fail(400, { move: 'Target column not found.' as const });
		const priorPin = item.pinnedColumnId;
		// Pin first; the in-memory derived column flips immediately on the
		// next request even before the frontmatter write completes.
		await pinItemToColumn(itemId, toColumnId);
		const fmTarget = frontmatterTargetFor(target.name);
		if (fmTarget && FRONTMATTER_BACKED_KINDS.has(item.kindId)) {
			const absPath = resolve(REPO_ROOT, item.ref);
			try {
				if (fmTarget.status !== null && fmTarget.status !== item.frontmatterStatus) {
					await writeFrontmatterField(absPath, 'status', fmTarget.status);
				}
				if (fmTarget.reviewStatus !== null && fmTarget.reviewStatus !== item.reviewStatus) {
					await writeFrontmatterField(absPath, 'review_status', fmTarget.reviewStatus);
				}
			} catch (err) {
				// Revert the pin so the board reflects the actual on-disk state.
				await pinItemToColumn(itemId, priorPin);
				const message = err instanceof Error ? err.message : 'Frontmatter write failed.';
				log.error(
					'frontmatter write failed -- reverting pin',
					undefined,
					err instanceof Error ? err : new Error(message),
				);
				return fail(409, { move: `Frontmatter write failed: ${message}` as const });
			}
		}
		return { move: 'ok' as const };
	},

	runLoader: async (event) => {
		requireRole(event, ROLES.AUTHOR, ROLES.OPERATOR, ROLES.ADMIN);
		try {
			const result = await loadReviewItems(REPO_ROOT);
			log.info('loader run from /review', {
				metadata: {
					added: result.added,
					updated: result.updated,
					removed: result.removed,
					ftsAdded: result.fts.added,
					ftsUpdated: result.fts.updated,
					ftsRemoved: result.fts.removed,
					durationMs: result.durationMs,
				},
			});
			return {
				ranLoader: true as const,
				ok: true as const,
				added: result.added,
				updated: result.updated,
				removed: result.removed,
				durationMs: result.durationMs,
			};
		} catch (err) {
			const message = err instanceof Error ? err.message : 'Loader failed.';
			log.error('loader run failed', undefined, err instanceof Error ? err : new Error(message));
			return { ranLoader: true as const, ok: false as const, error: message };
		}
	},
};
