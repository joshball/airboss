/**
 * Repo-relative paths the sync service reads + writes.
 *
 * Sync writes the two TOML registries and re-emits the generated
 * `aviation.ts` artifact (per Option 3 decided 2026-04-24 -- keep the TS
 * file so client bundles stay fast; authoritative edits flow
 * TOML -> hangar sync -> regenerate TS).
 */

import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

/**
 * Absolute path to the repo root. Derived from this file's location so the
 * library works regardless of the caller's cwd (tests, worker, scripts).
 *
 * Layout: `<repo>/libs/hangar-sync/src/paths.ts` -> three levels up. Uses
 * `fileURLToPath(import.meta.url)` rather than `import.meta.dir` because
 * vitest under node doesn't populate the latter.
 */
const HERE = dirname(fileURLToPath(import.meta.url));
export const REPO_ROOT = resolve(HERE, '..', '..', '..');

/** Absolute path to the glossary TOML seed. */
export const GLOSSARY_TOML_PATH = resolve(REPO_ROOT, 'libs/db/seed/glossary.toml');

/** Absolute path to the sources TOML seed. */
export const SOURCES_TOML_PATH = resolve(REPO_ROOT, 'libs/db/seed/sources.toml');

/** Absolute path to the generated aviation.ts artifact. */
export const AVIATION_TS_PATH = resolve(REPO_ROOT, 'libs/aviation/src/references/aviation.ts');

/** Relative path forms for commit messages + file lists (repo-root relative). */
export const RELATIVE_PATHS = {
	GLOSSARY_TOML: 'libs/db/seed/glossary.toml',
	SOURCES_TOML: 'libs/db/seed/sources.toml',
	AVIATION_TS: 'libs/aviation/src/references/aviation.ts',
} as const;

/**
 * Files the sync action stages + commits. Relative to `REPO_ROOT`.
 */
export const SYNC_COMMIT_FILES: readonly string[] = [
	RELATIVE_PATHS.GLOSSARY_TOML,
	RELATIVE_PATHS.SOURCES_TOML,
	RELATIVE_PATHS.AVIATION_TS,
];

/**
 * Postgres advisory lock key for `sync-to-disk`. Arbitrary but stable --
 * shared across processes so only one sync can hold the lock at a time.
 * Belt-and-braces on top of the per-targetId job-queue serialisation.
 */
export const SYNC_ADVISORY_LOCK_KEY = 0x6861_6e67; // 'hang' -> hangar sync lock
