// @browser-globals: server-only -- never imported by client .svelte
/**
 * Repo-root resolution for census adapters.
 *
 * Adapters are called only from `+page.server.ts` (and unit tests), each of
 * which may run from a different cwd. We anchor by walking up from this
 * module's own location until the workspace `package.json` with
 * `"name": "airboss"` is found -- the same strategy `scripts/lib/wp-loader.ts`
 * uses for the `/roadmap` view.
 *
 * `import.meta.dirname` is the Node 20+ / Bun standard; used over the
 * Bun-only `import.meta.dir` so svelte-check (no `bun-types`) is clean.
 */

import { readFileSync } from 'node:fs';
import { join, resolve } from 'node:path';

let cached: string | null = null;

/** Resolve the absolute airboss repo root. Cached after first call. */
export function repoRoot(): string {
	if (cached !== null) return cached;
	let dir = import.meta.dirname;
	for (let depth = 0; depth < 16; depth += 1) {
		try {
			const json = JSON.parse(readFileSync(join(dir, 'package.json'), 'utf8')) as { name?: string };
			if (json.name === 'airboss') {
				cached = dir;
				return dir;
			}
		} catch {
			// Not the workspace root -- keep walking up.
		}
		const parent = resolve(dir, '..');
		if (parent === dir) break;
		dir = parent;
	}
	throw new Error('content-census: unable to locate the airboss repo root');
}
