/**
 * Collect the set of registered help-page ids by scanning the authoritative
 * `HelpPage` content files in each app.
 *
 * Why static scan instead of runtime import:
 *
 *   - Running this validator under Bun imports code from `apps/*` deep
 *     paths, which transitively reaches `@ab/constants`. Bun's workspace
 *     resolution does not see the workspace aliases from files deep inside
 *     the app tree, so a runtime import fails. The apps resolve the same
 *     aliases at dev/build time through SvelteKit's Vite aliases.
 *   - The content files are a tiny, deliberately-regular shape. Each
 *     exports one `HelpPage` object literal with an `id: 'kebab-id'`
 *     field as the first property. A regex scan is reliable, O(n), and
 *     keeps the validator standalone (no dep on any runtime alias).
 *
 * Accepted shapes:
 *
 *     export const gettingStarted: HelpPage = {
 *         id: 'getting-started',
 *         ...
 *     };
 *
 *     export const conceptFsrs = {
 *         id: "concept-fsrs",
 *     } satisfies HelpPage;
 *
 * Template-literal ids (`id: \`getting-started\``) are also accepted so
 * future authors aren't locked to a single quoting style. Dynamic ids
 * (e.g. `id: SOME_CONSTANT`) are skipped with a warning.
 */

import { readdir, readFile } from 'node:fs/promises';
import { join } from 'node:path';

/** Directory globs (under repo root) that host `HelpPage` object literals. */
const HELP_CONTENT_ROOTS: readonly string[] = [
	'apps/study/src/lib/help/content',
	// Future apps register their pages here. Each entry is a directory of
	// `.ts` files, each file exporting one `HelpPage`.
];

/** Result of a scan: registered ids, plus files that had no parseable id. */
export interface HelpRegistryScan {
	readonly registeredIds: ReadonlySet<string>;
	readonly skippedFiles: readonly string[];
}

export async function collectRegisteredHelpIds(repoRoot: string): Promise<HelpRegistryScan> {
	const ids = new Set<string>();
	const skipped: string[] = [];
	for (const relRoot of HELP_CONTENT_ROOTS) {
		const absRoot = join(repoRoot, relRoot);
		await walk(absRoot, ids, skipped);
	}
	return { registeredIds: ids, skippedFiles: skipped };
}

async function walk(absDir: string, ids: Set<string>, skipped: string[]): Promise<void> {
	let entries: Awaited<ReturnType<typeof readdir>>;
	try {
		entries = await readdir(absDir, { withFileTypes: true });
	} catch {
		return;
	}
	for (const entry of entries) {
		const abs = join(absDir, entry.name);
		if (entry.isDirectory()) {
			await walk(abs, ids, skipped);
			continue;
		}
		if (!entry.isFile()) continue;
		if (!entry.name.endsWith('.ts')) continue;
		const content = await readFile(abs, 'utf8');
		const found = extractHelpPageIds(content);
		if (found.length === 0) {
			// A content file with no id is either a barrel / type-only file
			// or an author error. The validator only treats it as skipped;
			// the real help-page validator (`validateHelpPages`) catches
			// authoring errors with a richer check.
			skipped.push(abs);
			continue;
		}
		for (const id of found) ids.add(id);
	}
}

/**
 * Match an `export const <name>` declaration annotated as `HelpPage` (via
 * `: HelpPage =` or `satisfies HelpPage`), then capture the object
 * literal's `id:` property. This intentionally does not grab the `id:`
 * fields on nested `sections[i]` entries because the top-level object's
 * `id:` is always the first `id:` that appears after the declaration
 * header, and we anchor the capture to that header.
 *
 * Two shapes supported (both appear in the current codebase):
 *
 *   export const gettingStarted: HelpPage = {
 *       id: 'getting-started',   <- captured
 *       sections: [{ id: 'intro' }],  <- not captured
 *   };
 *
 *   export const gettingStarted = {
 *       id: 'getting-started',   <- captured
 *   } satisfies HelpPage;
 *
 * Accepts double quotes, single quotes, or a bare template literal (no
 * interpolation).
 */
const TYPED_PAGE_REGEX = /export\s+const\s+\w+\s*:\s*HelpPage\s*=\s*\{\s*id\s*:\s*(?:"([^"]+)"|'([^']+)'|`([^`$]+)`)/g;
/** Same shape, but with the type annotation trailing after the literal via `satisfies`. */
const SATISFIES_PAGE_REGEX =
	/export\s+const\s+\w+\s*=\s*\{\s*id\s*:\s*(?:"([^"]+)"|'([^']+)'|`([^`$]+)`)[^;]*satisfies\s+HelpPage/g;

export function extractHelpPageIds(content: string): readonly string[] {
	const out: string[] = [];
	for (const regex of [TYPED_PAGE_REGEX, SATISFIES_PAGE_REGEX]) {
		regex.lastIndex = 0;
		let match: RegExpExecArray | null = regex.exec(content);
		while (match !== null) {
			const value = match[1] ?? match[2] ?? match[3];
			if (value !== undefined && value.length > 0) out.push(value);
			match = regex.exec(content);
		}
	}
	// Dedupe: the two regexes may both match if the file happens to use
	// both shapes (rare but possible across refactors).
	return Array.from(new Set(out));
}
