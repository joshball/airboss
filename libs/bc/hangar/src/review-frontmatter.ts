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

import { randomBytes } from 'node:crypto';
import { readFile, rename, unlink, writeFile } from 'node:fs/promises';
import { dirname } from 'node:path';
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
 * the result back atomically. The new bytes land on disk via a sibling temp
 * file plus `rename`: POSIX same-filesystem rename is one atomic syscall, so
 * a process kill / ENOSPC mid-write either leaves the original file intact
 * or replaces it with the complete new contents -- no partial-write window.
 *
 * Plain `writeFile(path, ...)` is NOT atomic: it opens the destination with
 * `O_TRUNC` and streams bytes; an interruption truncates the file. We use
 * the temp + rename pattern so the board's drag-write surface can never
 * corrupt a tracked WP spec or test plan.
 */
export async function writeFrontmatterField(path: string, field: string, value: string): Promise<void> {
	const before = await readFile(path, 'utf8').catch((err: unknown) => {
		throw new Error(`writeFrontmatterField: failed to read ${path}: ${describeError(err)}`);
	});
	const after = setFrontmatterField(before, field, value);
	if (after === before) return;
	await atomicWriteFile(path, after).catch((err: unknown) => {
		throw new Error(`writeFrontmatterField: failed to write ${path}: ${describeError(err)}`);
	});
}

/** Batch variant: rewrite many fields in one read + one atomic write. */
export async function writeFrontmatterFields(path: string, updates: Readonly<Record<string, string>>): Promise<void> {
	const before = await readFile(path, 'utf8').catch((err: unknown) => {
		throw new Error(`writeFrontmatterFields: failed to read ${path}: ${describeError(err)}`);
	});
	const after = setFrontmatterFields(before, updates);
	if (after === before) return;
	await atomicWriteFile(path, after).catch((err: unknown) => {
		throw new Error(`writeFrontmatterFields: failed to write ${path}: ${describeError(err)}`);
	});
}

/**
 * Write `data` to `path` atomically by writing to a sibling temp file then
 * `rename`-ing into place. The temp filename uses `pid + random + ts` so
 * concurrent writers from the same process to the same path don't collide.
 *
 * If the rename fails (e.g. cross-filesystem on `/tmp`), we delete the temp
 * file and rethrow so the caller doesn't leave junk behind.
 */
async function atomicWriteFile(path: string, data: string): Promise<void> {
	const dir = dirname(path);
	const suffix = `${process.pid}-${randomBytes(4).toString('hex')}-${Date.now()}`;
	const tmp = `${dir}/.${suffix}.tmp`;
	try {
		await writeFile(tmp, data, 'utf8');
		await rename(tmp, path);
	} catch (err) {
		// Best-effort cleanup; ignore unlink failure (the rename may have
		// succeeded after a transient error, or the temp file may not exist).
		await unlink(tmp).catch(() => {});
		throw err;
	}
}

function describeError(err: unknown): string {
	if (err instanceof Error) return err.message;
	return String(err);
}
