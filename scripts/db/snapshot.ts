/**
 * Fleet-shared snapshot cache for `bun run db reset`.
 *
 * The slow path (drop + create + drizzle push + full seed) takes ~6 minutes on
 * a typical-day developer reset. Most of that time is spent re-deriving the
 * exact same DB state from the exact same source files. This module captures
 * a `pg_dump --format=custom` of the freshly-seeded DB plus a SHA-256 of
 * every input that influences the seed. On the next reset, if the inputs
 * still match (and the running postgres major version is unchanged), the
 * dispatcher can drop + create + restore in ~20 seconds instead of re-seeding.
 *
 * The cache is **machine-shared, not per-worktree**: all snapshots live under
 * `~/.cache/airboss/db-build/pg<N>/<hash>.dump`. A worktree's first reset
 * looks up by `(hash, pgVersion)`, so any other worktree (or main) on the
 * same machine that has already seeded the same content fulfils the hit.
 * That makes per-worktree DBs (PR #711) cheap: each worktree gets its own
 * postgres database, but they all reuse the same dump bytes.
 *
 * The hash walk is deterministic: we collect every file under the configured
 * roots that matches an extension allowlist, sort by absolute path, and feed
 * each file's byte length + bytes into the running SHA. Path strings are not
 * mixed in directly, which keeps the hash stable across one-for-one
 * relocations within a single sort position; in practice almost any rename
 * shifts a file's sort position relative to its neighbours and the hash
 * changes anyway. That's the safer behaviour: edits and renames both bust
 * the cache, never silently reuse a stale snapshot.
 *
 * Cache layout:
 *
 *   ~/.cache/airboss/db-build/
 *     pg16/
 *       7f5e80fa1234abcd....dump
 *       9bc5c0e35678ef01....dump
 *       index.json   { entries: [{ hash, createdAt, bytes, inputCount }, ...] }
 *     pg15/
 *       ...
 *
 * Eviction: keep the {@link MAX_KEPT_PER_PG_VERSION} most recent dumps per
 * pg version. Older entries are GC'd lazily on each successful save.
 */

import { createHash } from 'node:crypto';
import type { Dirent } from 'node:fs';
import { readdir, rm, stat } from 'node:fs/promises';
import { homedir } from 'node:os';
import { resolve } from 'node:path';
import { runQuiet } from '../lib/spawn';

export interface SnapshotMeta {
	hash: string;
	pgVersion: string;
	createdAt: string;
	inputCount: number;
	bytes: number;
}

const MAX_KEPT_PER_PG_VERSION = 3;

/**
 * Machine-shared cache root. `~/.cache/airboss/db-build/` is the canonical
 * place; every worktree on this machine reads and writes the same tree so
 * they share dump bytes when their input hash matches.
 *
 * Override via `AIRBOSS_DB_BUILD_CACHE_DIR` (e.g. for CI runners that want
 * a workspace-scoped cache).
 */
export function snapshotCacheRoot(): string {
	const override = process.env.AIRBOSS_DB_BUILD_CACHE_DIR;
	if (override && override.length > 0) return override;
	return resolve(homedir(), '.cache', 'airboss', 'db-build');
}

function pgVersionDir(pgVersion: string): string {
	return resolve(snapshotCacheRoot(), `pg${pgVersion}`);
}

function dumpPathFor(pgVersion: string, hash: string): string {
	return resolve(pgVersionDir(pgVersion), `${hash}.dump`);
}

function indexPathFor(pgVersion: string): string {
	return resolve(pgVersionDir(pgVersion), 'index.json');
}

interface IndexFile {
	entries: SnapshotMeta[];
}

async function readIndex(pgVersion: string): Promise<IndexFile> {
	const file = Bun.file(indexPathFor(pgVersion));
	if (!(await file.exists())) return { entries: [] };
	try {
		const parsed = JSON.parse(await file.text()) as unknown;
		if (typeof parsed !== 'object' || parsed === null) return { entries: [] };
		const candidate = (parsed as { entries?: unknown }).entries;
		if (!Array.isArray(candidate)) return { entries: [] };
		const entries = candidate.filter(isSnapshotMeta);
		return { entries };
	} catch {
		return { entries: [] };
	}
}

async function writeIndex(pgVersion: string, idx: IndexFile): Promise<void> {
	await Bun.write(indexPathFor(pgVersion), `${JSON.stringify(idx, null, 2)}\n`);
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

/**
 * Look up a snapshot by (hash, pgVersion). Returns the meta + dump path when
 * an entry exists in the index AND the dump file is on disk; null otherwise.
 *
 * Does NOT verify pg_dump payload contents. A corrupted dump is detected by
 * the restore caller (pg_restore exits non-zero), which then invalidates the
 * entry via {@link invalidateSnapshotEntry}.
 */
export async function findSnapshotForHash(
	hash: string,
	pgVersion: string,
): Promise<{ meta: SnapshotMeta; dumpPath: string } | null> {
	const idx = await readIndex(pgVersion);
	const meta = idx.entries.find((entry) => entry.hash === hash && entry.pgVersion === pgVersion);
	if (!meta) return null;
	const dumpPath = dumpPathFor(pgVersion, hash);
	const exists = await Bun.file(dumpPath).exists();
	if (!exists) {
		// Index entry without dump file: stale. Drop the entry; treat as miss.
		await removeIndexEntry(pgVersion, hash);
		return null;
	}
	return { meta, dumpPath };
}

interface SnapshotIO {
	readonly container: string;
	readonly dbName: string;
	readonly dbUser: string;
}

const CONTAINER_TMP_PATH = '/tmp/airboss-snap.dump';

/**
 * Capture a custom-format pg_dump of the seeded DB into the cache as
 * `<hash>.dump`. Updates the per-pg-version index and evicts old entries
 * down to {@link MAX_KEPT_PER_PG_VERSION}.
 */
export async function dumpSnapshot(
	opts: SnapshotIO,
	hash: string,
	pgVersion: string,
	inputCount: number,
): Promise<{ meta: SnapshotMeta; dumpPath: string }> {
	await ensureCacheDir(pgVersion);
	const dumpPath = dumpPathFor(pgVersion, hash);

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
		await runQuiet(['docker', 'cp', `${opts.container}:${CONTAINER_TMP_PATH}`, dumpPath]);
	} finally {
		// Best-effort cleanup; never fails the dump if the container is gone.
		await runQuiet(['docker', 'exec', opts.container, 'rm', '-f', CONTAINER_TMP_PATH]).catch(() => undefined);
	}
	const info = await stat(dumpPath);
	const meta: SnapshotMeta = {
		hash,
		pgVersion,
		createdAt: new Date().toISOString(),
		inputCount,
		bytes: info.size,
	};
	await upsertIndexEntry(pgVersion, meta);
	await evictOldSnapshots(pgVersion);
	return { meta, dumpPath };
}

/**
 * Restore from the cached dump for `(hash, pgVersion)` into the freshly-
 * created empty DB. Caller is expected to have called {@link findSnapshotForHash}
 * first; this just executes pg_restore against the resolved dumpPath.
 */
export async function restoreSnapshot(opts: SnapshotIO, dumpPath: string): Promise<void> {
	await runQuiet(['docker', 'cp', dumpPath, `${opts.container}:${CONTAINER_TMP_PATH}`]);
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

/**
 * Drop a single (hash, pgVersion) entry: removes the dump file and the index
 * entry. Used when a restore fails partway and the cached bytes are
 * suspect.
 */
export async function invalidateSnapshotEntry(hash: string, pgVersion: string): Promise<void> {
	await rm(dumpPathFor(pgVersion, hash), { force: true }).catch(() => undefined);
	await removeIndexEntry(pgVersion, hash);
}

async function ensureCacheDir(pgVersion: string): Promise<void> {
	// Bun.write creates parent dirs but only on the path it's writing to;
	// `docker cp` writing into the dump path needs the dir to exist already.
	// Use a sentinel write that we immediately overwrite so the directory
	// is guaranteed.
	await Bun.write(resolve(pgVersionDir(pgVersion), '.keep'), '');
}

async function upsertIndexEntry(pgVersion: string, meta: SnapshotMeta): Promise<void> {
	const idx = await readIndex(pgVersion);
	const filtered = idx.entries.filter((e) => e.hash !== meta.hash);
	filtered.push(meta);
	await writeIndex(pgVersion, { entries: filtered });
}

async function removeIndexEntry(pgVersion: string, hash: string): Promise<void> {
	const idx = await readIndex(pgVersion);
	const filtered = idx.entries.filter((e) => e.hash !== hash);
	if (filtered.length === idx.entries.length) return;
	await writeIndex(pgVersion, { entries: filtered });
}

/**
 * Keep the {@link MAX_KEPT_PER_PG_VERSION} most recent entries (by
 * createdAt). Older dump files and their index entries are removed.
 */
async function evictOldSnapshots(pgVersion: string): Promise<void> {
	const idx = await readIndex(pgVersion);
	if (idx.entries.length <= MAX_KEPT_PER_PG_VERSION) return;
	const sorted = [...idx.entries].sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1));
	const keep = sorted.slice(0, MAX_KEPT_PER_PG_VERSION);
	const evict = sorted.slice(MAX_KEPT_PER_PG_VERSION);
	await Promise.all(
		evict.map(async (entry) => {
			await rm(dumpPathFor(pgVersion, entry.hash), { force: true }).catch(() => undefined);
		}),
	);
	await writeIndex(pgVersion, { entries: keep });
}
