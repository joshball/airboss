/**
 * Walk `apps/` + `libs/` for `.svelte` and `.svelte.ts` files that may
 * reference a help id. Skips `node_modules`, build output, and the
 * `.archive` tree. Pure: caller supplies the repo root.
 */

import { readdir } from 'node:fs/promises';
import { join, relative } from 'node:path';

const INCLUDE_DIRS: readonly string[] = ['apps', 'libs'];
const SKIP_DIR_NAMES: ReadonlySet<string> = new Set([
	'node_modules',
	'.svelte-kit',
	'.archive',
	'dist',
	'build',
	'.output',
	'coverage',
	'.vite',
]);
const SVELTE_EXT = '.svelte';
const SVELTE_TS_EXT = '.svelte.ts';

export async function discoverSvelteFiles(repoRoot: string): Promise<readonly string[]> {
	const out: string[] = [];
	for (const dir of INCLUDE_DIRS) {
		const absDir = join(repoRoot, dir);
		await walk(absDir, out);
	}
	// Deterministic order so diffs across runs are stable.
	return out.sort();
}

async function walk(absDir: string, out: string[]): Promise<void> {
	let entries: Awaited<ReturnType<typeof readdir>>;
	try {
		entries = await readdir(absDir, { withFileTypes: true });
	} catch {
		// Directory doesn't exist -- monorepo layout may omit one of the
		// include dirs. Silently skip; `discoverSvelteFiles` is not the
		// place to error on a missing tree.
		return;
	}
	for (const entry of entries) {
		if (entry.isDirectory()) {
			if (SKIP_DIR_NAMES.has(entry.name)) continue;
			await walk(join(absDir, entry.name), out);
			continue;
		}
		if (!entry.isFile()) continue;
		const name = entry.name;
		if (name.endsWith(SVELTE_EXT) || name.endsWith(SVELTE_TS_EXT)) {
			out.push(join(absDir, name));
		}
	}
}

/** Format an absolute path as a repo-relative path for report output. */
export function toRelative(absPath: string, repoRoot: string): string {
	return relative(repoRoot, absPath);
}
