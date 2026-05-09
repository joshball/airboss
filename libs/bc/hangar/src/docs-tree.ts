/**
 * Filesystem-backed docs tree for the `/docs` browser.
 *
 * Walks `DOCS_SEARCH_ROOTS` (the same roots the loader indexes for FTS) and
 * returns a recursive `{ path, type, name, children? }` tree -- the docs
 * page renders the tree in a left-rail `<FileTree>` component. Dot-prefixed
 * directories (`.archive`, `.git`, ...) and non-markdown files are filtered
 * out so the tree shows only readable content.
 *
 * Caching: SvelteKit re-runs `+layout.server.ts` on every navigation under
 * the layout, which means every tree click would otherwise re-walk hundreds
 * of directories on the filesystem. We memoise the tree per `repoRoot` for
 * `DOCS_TREE_CACHE_TTL_MS`. The loader explicitly busts the cache when it
 * runs so a fresh sync is reflected immediately on the next page render.
 *
 * Server-only: imports `node:fs/promises`. Lives in the BC so `apps/hangar`
 * can call `listDocsTree(repoRoot)` from a `+layout.server.ts` and trust
 * the same root allow-list the loader uses.
 */

import { readdir, stat } from 'node:fs/promises';
import { join, posix, sep } from 'node:path';
import { DOCS_SEARCH_ROOTS, DOCS_TOP_LEVEL_FILES, DOCS_TREE_CACHE_TTL_MS } from '@ab/constants';

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

interface CacheEntry {
	readonly tree: ReadonlyArray<DocsTreeNode>;
	readonly storedAt: number;
}

const cache = new Map<string, CacheEntry>();

/**
 * Build a tree of `.md` files under each root in `DOCS_SEARCH_ROOTS`. The
 * top-level nodes are one `dir` per root. Empty directories (no markdown
 * files) are pruned so the tree doesn't show dead branches.
 *
 * Cached per `repoRoot` for `DOCS_TREE_CACHE_TTL_MS`. Pass
 * `{ forceFresh: true }` to bypass the cache.
 */
export async function listDocsTree(
	repoRoot: string,
	options: { forceFresh?: boolean } = {},
): Promise<ReadonlyArray<DocsTreeNode>> {
	const now = Date.now();
	if (!options.forceFresh) {
		const cached = cache.get(repoRoot);
		if (cached && now - cached.storedAt < DOCS_TREE_CACHE_TTL_MS) {
			return cached.tree;
		}
	}
	// Walk all configured roots in parallel -- they share no state and the
	// per-root walk is the dominant cost.
	const built = await Promise.all(DOCS_SEARCH_ROOTS.map((root) => buildDirNode(repoRoot, root)));
	const roots: DocsTreeNode[] = [];
	for (const node of built) {
		if (node && node.type === 'dir' && node.children.length > 0) {
			roots.push(node);
		}
	}
	cache.set(repoRoot, { tree: roots, storedAt: now });
	return roots;
}

/**
 * Drop the cached tree (if any) for a given `repoRoot`. Call after a loader
 * run that may have added or removed files so the next request rebuilds the
 * tree without waiting for the TTL.
 */
export function bustDocsTreeCache(repoRoot?: string): void {
	if (repoRoot === undefined) {
		cache.clear();
		return;
	}
	cache.delete(repoRoot);
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
	// Stat each entry in parallel -- on a cold OS cache this is the difference
	// between "all 577 dirs walked serially" and "concurrent fan-out".
	const child: Array<DocsTreeNode | null> = await Promise.all(
		entries.map(async (entry): Promise<DocsTreeNode | null> => {
			if (entry.startsWith('.')) return null;
			const absChild = join(absDir, entry);
			const repoRelChild = toRepoRelative(repoRoot, absChild);
			let st: Awaited<ReturnType<typeof stat>>;
			try {
				st = await stat(absChild);
			} catch {
				return null;
			}
			if (st.isDirectory()) {
				return await buildDirNode(repoRoot, repoRelChild);
			}
			if (st.isFile() && entry.endsWith('.md')) {
				return {
					type: 'file',
					path: repoRelChild,
					name: entry.replace(/\.md$/, ''),
				};
			}
			return null;
		}),
	);
	const children: DocsTreeNode[] = [];
	for (const node of child) {
		if (!node) continue;
		if (node.type === 'dir' && node.children.length === 0) continue;
		children.push(node);
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
	if ((DOCS_TOP_LEVEL_FILES as readonly string[]).includes(repoRelPath)) return true;
	for (const root of DOCS_SEARCH_ROOTS) {
		if (repoRelPath === root) return false; // a root is a directory, not a file
		if (repoRelPath.startsWith(`${root}/`)) return true;
	}
	return false;
}
