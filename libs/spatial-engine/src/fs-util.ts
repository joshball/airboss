// @browser-globals: server-only -- never imported by client .svelte
/**
 * Server-only filesystem + path helpers for the spatial engine.
 *
 * `libs/spatial-engine/` is a server-only library: the geography loader,
 * the weather view loader, the ingester, and the bundle writer all touch
 * the filesystem. None of these modules is reachable from a client bundle
 * (the runtime barrel `index.ts` re-exports types only), so a static
 * `node:*` import here is safe. The top-of-file tag documents that.
 *
 * Centralizing the Node-builtin access in one tagged module keeps every
 * other engine file free of `node:*` import noise.
 */

import { existsSync, mkdirSync, readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

/** Absolute repository root, resolved from this module's location. */
export const REPO_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..', '..', '..');

/** Read a UTF-8 text file. Throws a descriptive error when the path is missing. */
export function readText(path: string): string {
	if (!existsSync(path)) {
		throw new Error(`spatial-engine: file not found: ${path}`);
	}
	return readFileSync(path, 'utf-8');
}

/** Read + JSON.parse a file. */
export function readJson<T>(path: string): T {
	return JSON.parse(readText(path)) as T;
}

/** Write a UTF-8 text file, creating parent directories as needed. */
export function writeTextFile(path: string, contents: string): void {
	mkdirSync(dirname(path), { recursive: true });
	writeFileSync(path, contents, 'utf-8');
}

/** Write a value as pretty-printed JSON (2-space indent, trailing newline). */
export function writeJsonFile(path: string, value: unknown): void {
	writeTextFile(path, `${JSON.stringify(value, null, 2)}\n`);
}

/** Whether a path exists. */
export function pathExists(path: string): boolean {
	return existsSync(path);
}

/** Join path segments. */
export function joinPath(...segments: string[]): string {
	return join(...segments);
}

/** List directory entries (names only). Returns `[]` when the dir is absent. */
export function listDir(path: string): string[] {
	if (!existsSync(path)) return [];
	return readdirSync(path);
}

/** Ensure a directory exists. */
export function ensureDir(path: string): void {
	mkdirSync(path, { recursive: true });
}
