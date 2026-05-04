/**
 * Filesystem-backed docs tree for the `/docs` browser.
 *
 * Walks `DOCS_SEARCH_ROOTS` (the same roots the loader indexes for FTS) and
 * returns a recursive `{ path, type, name, children? }` tree -- the docs
 * page renders the tree in a left-rail `<FileTree>` component. Dot-prefixed
 * directories (`.archive`, `.git`, ...) and non-markdown files are filtered
 * out so the tree shows only readable content.
 *
 * Server-only: imports `node:fs/promises`. Lives in the BC so `apps/hangar`
 * can call `listDocsTree(repoRoot)` from a `+layout.server.ts` and trust
 * the same root allow-list the loader uses.
 */

import { readdir, stat } from 'node:fs/promises';
import { join, posix, sep } from 'node:path';
import { DOCS_SEARCH_ROOTS } from '@ab/constants';

export interface DocsTreeFileNode {
	readonly type: 'file';
	/** Repo-relative POSIX path (e.g. `docs/work/NOW.md`). */
	readonly path: string;
	/** Display label = basename without `.md`. */
	readonly name: string;
}

export interface DocsTreeDirNode {
	readonly type: 'dir';
	readonly path: string;
	readonly name: string;
	readonly children: ReadonlyArray<DocsTreeNode>;
}

export type DocsTreeNode = DocsTreeFileNode | DocsTreeDirNode;

/**
 * Build a tree of `.md` files under each root in `DOCS_SEARCH_ROOTS`. The
 * top-level nodes are one `dir` per root. Empty directories (no markdown
 * files) are pruned so the tree doesn't show dead branches.
 */
export async function listDocsTree(repoRoot: string): Promise<ReadonlyArray<DocsTreeNode>> {
	const roots: DocsTreeNode[] = [];
	for (const root of DOCS_SEARCH_ROOTS) {
		const node = await buildDirNode(repoRoot, root);
		if (node && node.type === 'dir' && node.children.length > 0) {
			roots.push(node);
		}
	}
	return roots;
}

async function buildDirNode(repoRoot: string, repoRelDir: string): Promise<DocsTreeNode | null> {
	const absDir = join(repoRoot, repoRelDir);
	let entries: string[];
	try {
		entries = await readdir(absDir);
	} catch {
		return null;
	}
	entries.sort((a, b) => a.localeCompare(b));
	const children: DocsTreeNode[] = [];
	for (const entry of entries) {
		if (entry.startsWith('.')) continue;
		const absChild = join(absDir, entry);
		const repoRelChild = toRepoRelative(repoRoot, absChild);
		let st: Awaited<ReturnType<typeof stat>>;
		try {
			st = await stat(absChild);
		} catch {
			continue;
		}
		if (st.isDirectory()) {
			const child = await buildDirNode(repoRoot, repoRelChild);
			if (child && child.type === 'dir' && child.children.length > 0) {
				children.push(child);
			}
		} else if (st.isFile() && entry.endsWith('.md')) {
			children.push({
				type: 'file',
				path: repoRelChild,
				name: entry.replace(/\.md$/, ''),
			});
		}
	}
	if (children.length === 0) return null;
	return {
		type: 'dir',
		path: repoRelDir.split(sep).join(posix.sep),
		name: posix.basename(repoRelDir.split(sep).join(posix.sep)),
		children,
	};
}

function toRepoRelative(repoRoot: string, absPath: string): string {
	const root = repoRoot.endsWith(sep) ? repoRoot.slice(0, -1) : repoRoot;
	const rel = absPath.startsWith(root + sep) ? absPath.slice(root.length + 1) : absPath;
	return rel.split(sep).join(posix.sep);
}

/**
 * Validate a repo-relative path is inside one of `DOCS_SEARCH_ROOTS`. Used
 * by the dynamic `/docs/[...path]` route to reject `..` traversal and any
 * path outside the allow-list before reading the file.
 */
export function isDocsPathAllowed(repoRelPath: string): boolean {
	if (repoRelPath === '' || repoRelPath.includes('..')) return false;
	if (!repoRelPath.endsWith('.md')) return false;
	for (const root of DOCS_SEARCH_ROOTS) {
		if (repoRelPath === root) return false; // a root is a directory, not a file
		if (repoRelPath.startsWith(`${root}/`)) return true;
	}
	return false;
}
