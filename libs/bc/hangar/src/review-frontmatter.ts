/**
 * Frontmatter IO wrapper for the review queue. Pure-string transforms live in
 * `@ab/utils/markdown` (`parseFrontmatter`, `setFrontmatterField`); this file
 * binds them to the filesystem so the board's drag-drop write actions can flip
 * `status:` and `review_status:` on a `docs/**` markdown file.
 *
 * Server-only: imports `node:fs/promises`. Lives in the BC (not `@ab/utils`)
 * so the browser bundle stays free of `node:*` imports per CLAUDE.md.
 *
 * All paths passed in must be absolute or repo-relative. The caller resolves
 * to an absolute path before invoking; this module never canonicalises or
 * walks the filesystem on its own.
 */

import { readFile, writeFile } from 'node:fs/promises';
import { parseFrontmatter, setFrontmatterField, setFrontmatterFields } from '@ab/utils';

/**
 * Read a markdown file and return its parsed frontmatter entries plus body.
 * Throws with the file path attached when the file is unreadable or absent.
 */
export async function readFrontmatter(path: string): Promise<{
	readonly entries: ReadonlyArray<{ readonly key: string; readonly value: string }>;
	readonly body: string;
}> {
	const text = await readFile(path, 'utf8').catch((err: unknown) => {
		throw new Error(`readFrontmatter: failed to read ${path}: ${describeError(err)}`);
	});
	const parsed = parseFrontmatter(text);
	return { entries: parsed.entries, body: parsed.body };
}

/**
 * Read a markdown file, rewrite (or insert) one frontmatter field, and write
 * the result back. Atomic in the sense that either the new bytes are on disk
 * or the original is intact -- we go through `writeFile` which on POSIX
 * replaces the path in one syscall when the destination directory and file
 * are on the same filesystem. The board's drag-write surface invokes this
 * once per drag.
 */
export async function writeFrontmatterField(path: string, field: string, value: string): Promise<void> {
	const before = await readFile(path, 'utf8').catch((err: unknown) => {
		throw new Error(`writeFrontmatterField: failed to read ${path}: ${describeError(err)}`);
	});
	const after = setFrontmatterField(before, field, value);
	if (after === before) return;
	await writeFile(path, after, 'utf8').catch((err: unknown) => {
		throw new Error(`writeFrontmatterField: failed to write ${path}: ${describeError(err)}`);
	});
}

/** Batch variant: rewrite many fields in one read + one write. */
export async function writeFrontmatterFields(path: string, updates: Readonly<Record<string, string>>): Promise<void> {
	const before = await readFile(path, 'utf8').catch((err: unknown) => {
		throw new Error(`writeFrontmatterFields: failed to read ${path}: ${describeError(err)}`);
	});
	const after = setFrontmatterFields(before, updates);
	if (after === before) return;
	await writeFile(path, after, 'utf8').catch((err: unknown) => {
		throw new Error(`writeFrontmatterFields: failed to write ${path}: ${describeError(err)}`);
	});
}

function describeError(err: unknown): string {
	if (err instanceof Error) return err.message;
	return String(err);
}
