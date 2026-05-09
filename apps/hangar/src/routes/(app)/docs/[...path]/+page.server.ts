/**
 * `/docs/[...path]` -- read a markdown file by repo-relative path, parse
 * frontmatter, render to HTML server-side, return body HTML + frontmatter
 * entries to the page renderer.
 *
 * Read-source policy: the loader is authoritative for `(body, frontmatter)`,
 * so we read from `hangar.docs_search_index` first (one indexed lookup).
 * On a fresh checkout / pre-loader environment the index is empty -- we
 * fall back to the filesystem read so the surface still works before the
 * loader has run for the first time.
 *
 * Path safety: `isDocsPathAllowed` rejects any path containing `..`, any
 * non-`.md` path, and any path outside `DOCS_SEARCH_ROOTS`. A request that
 * fails the gate gets a 404, NOT a 403 (we don't want to leak the
 * existence of files outside the allow-list).
 *
 * Server-side rendering: `renderMarkdown` runs once on the server with
 * `minHeadingLevel: 1` and heading-id slugs. The result is `bodyHtml`,
 * which the page `{@html}`s. This drops the markdown engine from the
 * client bundle entirely and avoids the duplicate-parse cost on every
 * navigation.
 */

import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { requireRole } from '@ab/auth';
import { isDocsPathAllowed, REPO_ROOT, readIndexedDoc } from '@ab/bc-hangar/server';
import { ROLES, ROUTES } from '@ab/constants';
import { parseFrontmatter, renderMarkdown } from '@ab/utils';
import { error } from '@sveltejs/kit';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async (event) => {
	requireRole(event, ROLES.AUTHOR, ROLES.OPERATOR, ROLES.ADMIN);
	const repoRelPath = event.params.path;
	if (!repoRelPath || !isDocsPathAllowed(repoRelPath)) {
		throw error(404, 'Doc not found');
	}
	// Prefer the indexed body; fall back to filesystem so the page still
	// works on a freshly cloned repo before the loader has populated the
	// index for the first time.
	const indexed = await readIndexedDoc(repoRelPath);
	let body: string;
	let frontmatter: Record<string, string>;
	if (indexed) {
		body = indexed.body;
		frontmatter = indexed.frontmatter;
	} else {
		const absPath = resolve(REPO_ROOT, repoRelPath);
		let raw: string;
		try {
			raw = await readFile(absPath, 'utf8');
		} catch {
			throw error(404, 'Doc not found');
		}
		const parsed = parseFrontmatter(raw);
		body = parsed.body;
		frontmatter = {};
		for (const entry of parsed.entries) frontmatter[entry.key] = entry.value;
	}
	const entries: ReadonlyArray<{ key: string; value: string }> = Object.entries(frontmatter).map(([key, value]) => ({
		key,
		value,
	}));
	const rawHtml = renderMarkdown(body, { minHeadingLevel: 1, headingIds: true });
	const bodyHtml = rewriteDocsLinks(rawHtml, repoRelPath);
	const title = frontmatter.title ?? extractFirstHeading(body) ?? deriveBasenameTitle(repoRelPath);
	return {
		repoRelPath,
		bodyHtml,
		entries,
		frontmatter,
		title,
	};
};

/**
 * Rewrite intra-doc `(./other.md)` / `(../sibling/foo.md)` links so they
 * resolve under `/docs/<repo-relative path>`. Absolute `/`, external
 * `https?://`, `mailto:`, and `#` (in-doc anchor) links pass through
 * unchanged. Runs once at SSR; not in the client bundle.
 */
function rewriteDocsLinks(html: string, currentRepoRelPath: string): string {
	const dir = currentRepoRelPath.includes('/') ? currentRepoRelPath.replace(/\/[^/]+$/, '') : '';
	return html.replace(/href="([^"]+)"/g, (full, raw: string) => {
		if (raw.startsWith('http://') || raw.startsWith('https://')) return full;
		if (raw.startsWith('#') || raw.startsWith('mailto:')) return full;
		if (raw.startsWith(ROUTES.HANGAR_DOCS) || raw.startsWith('/handbook-asset/')) return full;
		if (raw.startsWith('/')) return full;
		if (!raw.endsWith('.md')) return full;
		const resolvedRel = resolveRelativeRepoPath(dir, raw);
		if (resolvedRel === null) return full;
		return `href="${ROUTES.HANGAR_DOCS_PATH(resolvedRel)}"`;
	});
}

/** Pure-string POSIX resolver -- joins `base` and `rel`, collapses `..` /
 * `.` segments. Returns null when the result climbs above the root. */
function resolveRelativeRepoPath(base: string, rel: string): string | null {
	const segs = base === '' ? [] : base.split('/');
	for (const part of rel.split('/')) {
		if (part === '' || part === '.') continue;
		if (part === '..') {
			if (segs.length === 0) return null;
			segs.pop();
		} else {
			segs.push(part);
		}
	}
	return segs.join('/');
}

/** First H1/H2/H3 heading text in the body markdown, or null when none. */
function extractFirstHeading(body: string): string | null {
	const m = body.match(/^#{1,3}\s+(.+)$/m);
	const captured = m?.[1];
	return captured ? captured.trim() : null;
}

/** Strip `.md` from the basename. */
function deriveBasenameTitle(repoRelPath: string): string {
	const base = repoRelPath.split('/').pop() ?? repoRelPath;
	return base.replace(/\.md$/, '');
}
