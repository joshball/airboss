/**
 * `/docs/[...path]` -- read a markdown file by repo-relative path, parse
 * frontmatter, return body + entries to the page renderer.
 *
 * Path safety: `isDocsPathAllowed` rejects any path containing `..`, any
 * non-`.md` path, and any path outside `DOCS_SEARCH_ROOTS`. A request that
 * fails the gate gets a 404, NOT a 403 (we don't want to leak the
 * existence of files outside the allow-list).
 */

import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { requireRole } from '@ab/auth';
import { isDocsPathAllowed, REPO_ROOT } from '@ab/bc-hangar';
import { ROLES } from '@ab/constants';
import { parseFrontmatter } from '@ab/utils';
import { error } from '@sveltejs/kit';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async (event) => {
	requireRole(event, ROLES.AUTHOR, ROLES.OPERATOR, ROLES.ADMIN);
	const repoRelPath = event.params.path;
	if (!repoRelPath || !isDocsPathAllowed(repoRelPath)) {
		throw error(404, 'Doc not found');
	}
	const absPath = resolve(REPO_ROOT, repoRelPath);
	let raw: string;
	try {
		raw = await readFile(absPath, 'utf8');
	} catch {
		throw error(404, 'Doc not found');
	}
	const parsed = parseFrontmatter(raw);
	const entries = parsed.entries.map((e) => ({ key: e.key, value: e.value }));
	return {
		repoRelPath,
		body: parsed.body,
		entries,
	};
};
