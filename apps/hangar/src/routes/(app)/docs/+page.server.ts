/**
 * `/docs` index landing -- renders `docs/work/NOW.md` as the "what's
 * active" overview, plus a counter for how many files are in the docs
 * search index. Empty index -> render an admin nudge with a `?/runLoader`
 * form action that fires the docs+items loader on demand.
 */

import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { requireRole } from '@ab/auth';
import { countDocsIndex, loadReviewItems, REPO_ROOT } from '@ab/bc-hangar';
import { ROLES } from '@ab/constants';
import { createLogger } from '@ab/utils';
import type { Actions, PageServerLoad } from './$types';

const NOW_PATH = 'docs/work/NOW.md';
const log = createLogger('hangar:docs');

export const load: PageServerLoad = async (event) => {
	requireRole(event, ROLES.AUTHOR, ROLES.OPERATOR, ROLES.ADMIN);
	const [now, indexCount] = await Promise.all([readNow(), countDocsIndex()]);
	return { now, indexCount, nowPath: NOW_PATH };
};

async function readNow(): Promise<string | null> {
	try {
		return await readFile(resolve(REPO_ROOT, NOW_PATH), 'utf8');
	} catch {
		return null;
	}
}

export const actions: Actions = {
	runLoader: async (event) => {
		requireRole(event, ROLES.AUTHOR, ROLES.OPERATOR, ROLES.ADMIN);
		const result = await loadReviewItems(REPO_ROOT);
		log.info('docs loader run from /docs', {
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
		return { ranLoader: true, fts: result.fts, durationMs: result.durationMs };
	},
};
