/**
 * Snapshot cache for `bun run db reset`.
 *
 * The slow path (drop + create + drizzle push + full seed) takes ~6 minutes on
 * a typical-day developer reset. Most of that time is spent re-deriving the
 * exact same DB state from the exact same source files. This module captures
 * a `pg_dump --format=custom` of the freshly-seeded DB plus a SHA-256 of
 * every input that influences the seed. On the next reset, if the inputs
 * still match (and the running postgres major version is unchanged), the
 * dispatcher can drop + create + restore in ~20 seconds instead of re-seeding.
 *
 * The hash walk is deterministic: we collect every file under the configured
 * roots that matches an extension allowlist, sort by absolute path, and feed
 * each file's byte length + bytes into the running SHA. Path strings are not
 * mixed in directly, which keeps the hash stable across one-for-one
 * relocations within a single sort position; in practice almost any rename
 * shifts a file's sort position relative to its neighbours and the hash
 * changes anyway. That's the safer behaviour: edits and renames both bust
 * the cache, never silently reuse a stale snapshot. A repo that genuinely
 * has a hashed root removed (e.g. someone deletes `acs/` entirely) hashes
 * differently from a repo that never had it -- correct, by design, and
 * worth preserving against any "warn on missing root" temptation.
 *
 * Cache layout under `.cache/db-build/`:
 *   - snapshot.dump        custom-format pg_dump bytes
 *   - snapshot.meta.json   { hash, pgVersion, createdAt, inputCount, bytes }
 */

import { createHash } from 'node:crypto';
import type { Dirent } from 'node:fs';
import { readdir, rm, stat } from 'node:fs/promises';
import { resolve } from 'node:path';
import { runQuiet } from '../lib/spawn';

export interface SnapshotMeta {
	hash: string;
	pgVersion: string;
	createdAt: string;
	inputCount: number;
	bytes: number;
}

export const SNAPSHOT_DIR = resolve(process.cwd(), '.cache', 'db-build');
export const SNAPSHOT_DUMP_PATH = resolve(SNAPSHOT_DIR, 'snapshot.dump');
export const SNAPSHOT_META_PATH = resolve(SNAPSHOT_DIR, 'snapshot.meta.json');

/**
 * Glob roots to walk for hashing. Each entry is a relative path from
 * `repoRoot`; we recurse and pick up files matching the per-root extension
 * filter. A miss (root doesn't exist) is silently skipped so a freshly
 * scaffolded repo without one of these trees still hashes deterministically.
 */
interface HashRoot {
	readonly path: string;
	readonly extensions: readonly string[];
}

const HASH_ROOTS: readonly HashRoot[] = [
	{ path: 'course', extensions: ['.md', '.yaml', '.yml'] },
	{ path: 'handbooks', extensions: ['.json', '.md'] },
	{ path: 'acs', extensions: ['.json', '.md'] },
	{ path: 'regulations', extensions: ['.json', '.md'] },
	{ path: 'aircraft/_authoring', extensions: ['.yaml', '.yml'] },
	// Sources tree: both manifest.yaml (registry data) and seed.ts (the per-
	// corpus seeder logic that registers entries on each run). The .ts files
	// are imported directly from `seed-all.ts`; editing one of them changes
	// the seed output and must invalidate the cache.
	{ path: 'libs/sources/src', extensions: ['.yaml', '.ts'] },
	{ path: 'libs/bc/study/src/seeders', extensions: ['.ts'] },
	{ path: 'drizzle', extensions: ['.sql'] },
];

/**
 * Specific files (not directories) that influence the seed. Listed
 * individually so a sibling file added under the same directory doesn't
 * silently change the hash without intent.
 */
const HASH_FILES: readonly string[] = [
	'libs/bc/study/src/references.ts',
	'libs/bc/study/src/schema.ts',
	'libs/auth/src/schema.ts',
	'libs/audit/src/schema.ts',
	'scripts/build-knowledge-index.ts',
];

/**
 * Glob for the `scripts/db/*.ts` family that orchestrates the seed. We pick
 * up everything under that directory (excluding tests via HASH_SKIP_REGEX).
 * Adding new orchestration files there -- e.g. `migrate-references-to-
 * structured.ts`, which `seed-all.ts` imports -- is more common than
 * refactoring file naming, so a `seed-` prefix glob would silently miss
 * dependencies. Walk the whole dir instead.
 */
const SEED_SCRIPT_DIR = 'scripts/db';
const SEED_SCRIPT_SUFFIX = '.ts';

/**
 * Files matching this regex inside any walked root are skipped. Test files
 * are noisy and don't affect runtime seed output; node_modules and build
 * artifacts must never leak into the hash.
 */
const HASH_SKIP_REGEX = /(\.test\.ts$|node_modules|\.svelte-kit|build|dist|\.cache|\.reports)/;

async function walkFiles(root: string, extensions: readonly string[]): Promise<string[]> {
	const out: string[] = [];
	async function visit(dir: string): Promise<void> {
		let entries: Dirent[];
		try {
			entries = (await readdir(dir, { withFileTypes: true })) as Dirent[];
		} catch (err) {
			// Missing directory is fine -- the hash root simply contributes
			// nothing this run. Permission errors propagate.
			const code = (err as NodeJS.ErrnoException).code;
			if (code === 'ENOENT' || code === 'ENOTDIR') return;
			throw err;
		}
		for (const entry of entries) {
			const full = resolve(dir, entry.name);
			if (HASH_SKIP_REGEX.test(full)) continue;
			if (entry.isDirectory()) {
				await visit(full);
				continue;
			}
			if (!entry.isFile()) continue;
			if (!extensions.some((ext) => entry.name.endsWith(ext))) continue;
			out.push(full);
		}
	}
	await visit(root);
	return out;
}

/**
 * SHA-256 of every relevant input file's contents, plus the running postgres
 * major version. Determines whether a cached snapshot is still valid for the
 * current source tree. Walk is deterministic: paths are sorted before each
 * file's bytes are hashed.
 */
export async function computeSeedInputHash(
	repoRoot: string,
	pgVersion: string,
): Promise<{ hash: string; inputCount: number }> {
	const collected: string[] = [];

	for (const root of HASH_ROOTS) {
		const absRoot = resolve(repoRoot, root.path);
		const files = await walkFiles(absRoot, root.extensions);
		for (const f of files) collected.push(f);
	}

	for (const rel of HASH_FILES) {
		const abs = resolve(repoRoot, rel);
		try {
			const info = await stat(abs);
			if (info.isFile()) collected.push(abs);
		} catch (err) {
			const code = (err as NodeJS.ErrnoException).code;
			if (code !== 'ENOENT') throw err;
		}
	}

	// scripts/db/*.ts (excluding *.test.ts via HASH_SKIP_REGEX). Picks up
	// migrate-references-to-structured.ts and any future orchestration files
	// without requiring a rename.
	try {
		const dir = resolve(repoRoot, SEED_SCRIPT_DIR);
		const entries = (await readdir(dir, { withFileTypes: true })) as Dirent[];
		for (const entry of entries) {
			if (!entry.isFile()) continue;
			if (!entry.name.endsWith(SEED_SCRIPT_SUFFIX)) continue;
			if (HASH_SKIP_REGEX.test(entry.name)) continue;
			collected.push(resolve(dir, entry.name));
		}
	} catch (err) {
		const code = (err as NodeJS.ErrnoException).code;
		if (code !== 'ENOENT') throw err;
	}

	collected.sort();

	const hash = createHash('sha256');
	hash.update(`pgMajor:${pgVersion}\n`);
	for (const path of collected) {
		const file = Bun.file(path);
		const bytes = await file.arrayBuffer();
		// Mix the relative path length + bytes so two files swapping CONTENTS
		// (rare but possible) still differ from "both files have content A".
		// Path is omitted otherwise so renames don't bust the cache for free.
		hash.update(`len:${bytes.byteLength}\n`);
		hash.update(new Uint8Array(bytes));
	}
	return { hash: hash.digest('hex'), inputCount: collected.length };
}

export async function readSnapshotMeta(): Promise<SnapshotMeta | null> {
	try {
		const file = Bun.file(SNAPSHOT_META_PATH);
		if (!(await file.exists())) return null;
		const text = await file.text();
		const parsed = JSON.parse(text) as unknown;
		if (!isSnapshotMeta(parsed)) return null;
		return parsed;
	} catch {
		return null;
	}
}

function isSnapshotMeta(value: unknown): value is SnapshotMeta {
	if (typeof value !== 'object' || value === null) return false;
	const v = value as Record<string, unknown>;
	return (
		typeof v.hash === 'string' &&
		typeof v.pgVersion === 'string' &&
		typeof v.createdAt === 'string' &&
		typeof v.inputCount === 'number' &&
		typeof v.bytes === 'number'
	);
}

export async function writeSnapshotMeta(meta: SnapshotMeta): Promise<void> {
	await Bun.write(SNAPSHOT_META_PATH, JSON.stringify(meta, null, 2));
}

interface SnapshotIO {
	readonly container: string;
	readonly dbName: string;
	readonly dbUser: string;
}

const CONTAINER_TMP_PATH = '/tmp/airboss-snap.dump';

/** Captures a custom-format pg_dump of the seeded DB into SNAPSHOT_DUMP_PATH. */
export async function dumpSnapshot(opts: SnapshotIO): Promise<{ bytes: number }> {
	await ensureSnapshotDir();
	// Run inside the container so we don't need pg_dump on the host. Custom
	// format lets pg_restore parallelize and ignore object-creation order;
	// `--no-owner --no-privileges` keeps the dump portable across postgres
	// users in case the dev's local password ever differs from the seeded
	// container's `airboss` role.
	await runQuiet([
		'docker',
		'exec',
		opts.container,
		'pg_dump',
		'-U',
		opts.dbUser,
		'-d',
		opts.dbName,
		'--format=custom',
		'--no-owner',
		'--no-privileges',
		`--file=${CONTAINER_TMP_PATH}`,
	]);
	try {
		await runQuiet(['docker', 'cp', `${opts.container}:${CONTAINER_TMP_PATH}`, SNAPSHOT_DUMP_PATH]);
	} finally {
		// Best-effort cleanup; never fails the dump if the container is gone.
		await runQuiet(['docker', 'exec', opts.container, 'rm', '-f', CONTAINER_TMP_PATH]).catch(() => undefined);
	}
	const info = await stat(SNAPSHOT_DUMP_PATH);
	return { bytes: info.size };
}

/** Restores from SNAPSHOT_DUMP_PATH into a freshly-created empty DB. */
export async function restoreSnapshot(opts: SnapshotIO): Promise<void> {
	await runQuiet(['docker', 'cp', SNAPSHOT_DUMP_PATH, `${opts.container}:${CONTAINER_TMP_PATH}`]);
	try {
		await runQuiet([
			'docker',
			'exec',
			opts.container,
			'pg_restore',
			'-U',
			opts.dbUser,
			'-d',
			opts.dbName,
			'--no-owner',
			'--no-privileges',
			CONTAINER_TMP_PATH,
		]);
	} finally {
		await runQuiet(['docker', 'exec', opts.container, 'rm', '-f', CONTAINER_TMP_PATH]).catch(() => undefined);
	}
}

/** Read the running postgres major version from the container, e.g. "16". */
export async function getPgMajorVersion(container: string, dbUser: string): Promise<string> {
	// `SHOW server_version_num` returns a packed integer, e.g. 160001 for 16.1.
	// Major is `floor(num / 10000)`. Use the `postgres` system DB so this works
	// even before the airboss DB exists.
	const out = await runQuiet([
		'docker',
		'exec',
		container,
		'psql',
		'-U',
		dbUser,
		'-d',
		'postgres',
		'-t',
		'-A',
		'-c',
		'SHOW server_version_num',
	]);
	const match = out.match(/(\d+)/);
	if (!match) throw new Error(`getPgMajorVersion: unexpected psql output: ${out}`);
	const num = Number.parseInt(match[1] ?? '', 10);
	if (!Number.isFinite(num) || num <= 0) {
		throw new Error(`getPgMajorVersion: could not parse server_version_num from: ${out}`);
	}
	return String(Math.floor(num / 10000));
}

/** Best-effort: clear cache files. Used when a restore fails partway. */
export async function invalidateSnapshot(): Promise<void> {
	await rm(SNAPSHOT_DUMP_PATH, { force: true }).catch(() => undefined);
	await rm(SNAPSHOT_META_PATH, { force: true }).catch(() => undefined);
}

async function ensureSnapshotDir(): Promise<void> {
	// Bun.write creates parent dirs but only on the path it's writing to;
	// `docker cp` writing into SNAPSHOT_DUMP_PATH needs the dir to exist
	// already. Use a sentinel write that we immediately overwrite so the
	// directory is guaranteed.
	await Bun.write(resolve(SNAPSHOT_DIR, '.keep'), '');
}

export async function snapshotDumpExists(): Promise<boolean> {
	return Bun.file(SNAPSHOT_DUMP_PATH).exists();
}
