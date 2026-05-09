/**
 * `/docs` index landing -- renders `docs/work/NOW.md` as the "what's
 * active" overview, plus a counter for how many files are in the docs
 * search index. Empty index -> render an admin nudge with a `?/runLoader`
 * form action that fires the docs+items loader on demand.
 *
 * Markdown is rendered server-side (renderMarkdown stays out of the client
 * bundle for `/docs`). NOW.md falls back to the README when missing so a
 * fresh repo doesn't land on a dead page.
 */

import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { requireRole } from '@ab/auth';
import { countDocsIndex, loadReviewItems, REPO_ROOT } from '@ab/bc-hangar/server';
import { ROLES } from '@ab/constants';
import { createLogger, renderMarkdown, stripFrontmatter } from '@ab/utils';
import type { Actions, PageServerLoad } from './$types';

const NOW_PATH = 'docs/work/NOW.md';
const log = createLogger('hangar:docs');

export const load: PageServerLoad = async (event) => {
	requireRole(event, ROLES.AUTHOR, ROLES.OPERATOR, ROLES.ADMIN);
	const [now, indexCount] = await Promise.all([readNow(), countDocsIndex()]);
	const nowHtml = now ? renderMarkdown(stripFrontmatter(now), { minHeadingLevel: 1, headingIds: true }) : null;
	return { nowHtml, indexCount, nowPath: NOW_PATH };
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
		try {
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
			return {
				ranLoader: true as const,
				ok: true as const,
				fts: result.fts,
				durationMs: result.durationMs,
			};
		} catch (err) {
			const message = err instanceof Error ? err.message : 'Loader failed.';
			log.error('docs loader run failed', undefined, err instanceof Error ? err : new Error(message));
			return {
				ranLoader: true as const,
				ok: false as const,
				error: message,
			};
		}
	},
};
