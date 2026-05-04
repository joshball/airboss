/**
 * `/review/admin/loader` -- admin status + manual refresh for the singleton
 * loader. v1 keeps the loader as one process-local job; the page surfaces
 * the most-recent run summary (counts, errors, duration) and a Refresh
 * button that re-runs `loadReviewItems` against the live DB.
 *
 * Auth: admin-only via `requireRole(ROLES.ADMIN)`. `getLastLoaderRun()` is
 * a process-local cache (no `review_loader` table per the spec design);
 * a process restart clears it, which is fine -- the admin can press
 * Refresh to populate it again.
 */

import { requireRole } from '@ab/auth';
import { countDocsIndex, getLastLoaderRun, loadReviewItems, REPO_ROOT } from '@ab/bc-hangar';
import { ROLES } from '@ab/constants';
import { db } from '@ab/db/connection';
import { createLogger } from '@ab/utils';
import type { Actions, PageServerLoad } from './$types';

const log = createLogger('hangar:review:admin:loader');

export const load: PageServerLoad = async (event) => {
	requireRole(event, ROLES.ADMIN);
	// Run reads in parallel: the FTS index size is independent of the cached
	// loader-run summary so there's no reason to serialize them.
	const [lastRun, ftsRowCount] = await Promise.all([Promise.resolve(getLastLoaderRun()), countDocsIndex(db)]);
	return {
		lastRun,
		ftsRowCount,
	};
};

export const actions: Actions = {
	runLoader: async (event) => {
		requireRole(event, ROLES.ADMIN);
		try {
			const result = await loadReviewItems(REPO_ROOT, db);
			log.info('admin loader refresh', {
				metadata: {
					added: result.added,
					updated: result.updated,
					removed: result.removed,
					ftsAdded: result.fts.added,
					ftsUpdated: result.fts.updated,
					ftsRemoved: result.fts.removed,
					durationMs: result.durationMs,
					errorCount: result.errors.length,
				},
			});
			return {
				ranLoader: 'ok' as const,
				added: result.added,
				updated: result.updated,
				removed: result.removed,
				durationMs: result.durationMs,
			};
		} catch (err) {
			const message = err instanceof Error ? err.message : 'Loader failed.';
			log.error('admin loader refresh failed', undefined, err instanceof Error ? err : new Error(message));
			return { ranLoader: 'error' as const, error: message };
		}
	},
};
