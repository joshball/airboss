/**
 * Cached production build for the flightbag integration sweep.
 *
 * The `flightbag-coverage` Playwright project serves the adapter-node
 * production build (`apps/flightbag/build/index.js`, run via
 * `bun ./build/index.js`) instead of `vite dev`. The dev server OOM-crashes
 * (SIGKILL) under the sweep's high worker count; the prebuilt server is a
 * single steady-state process and survives the load.
 *
 * Building flightbag is slow, so we content-hash the build inputs and skip
 * the rebuild when nothing changed since the last sweep. The hash is stored
 * alongside the build output at `apps/flightbag/build/.sweep-buildhash`.
 *
 * Inputs hashed (see INPUT_GLOBS below for the exact glob patterns):
 *   - the flightbag app source tree
 *   - the flightbag app config files (svelte/vite/package json/js/ts)
 *   - every shared lib source tree
 *   - every bounded-context lib source tree
 *
 * The hash covers a sorted (path, content-hash) list, so adding, removing,
 * renaming, or editing any input file flips the stored hash and forces a
 * rebuild.
 */

import { existsSync } from 'node:fs';

const FLIGHTBAG_DIR = 'apps/flightbag';
const BUILD_DIR = `${FLIGHTBAG_DIR}/build`;
const BUILD_ENTRY = `${BUILD_DIR}/index.js`;
const HASH_FILE = `${BUILD_DIR}/.sweep-buildhash`;

/** Glob patterns whose matched files feed the build-input content hash. */
const INPUT_GLOBS: readonly string[] = [
	`${FLIGHTBAG_DIR}/src/**`,
	`${FLIGHTBAG_DIR}/*.json`,
	`${FLIGHTBAG_DIR}/*.js`,
	`${FLIGHTBAG_DIR}/*.ts`,
	'libs/*/src/**',
	'libs/bc/*/src/**',
];

/** Result of the cache decision, returned so the dispatcher can report it. */
export interface BuildResult {
	/** `cached` when the build was skipped, `rebuilt` when vite ran. */
	readonly status: 'cached' | 'rebuilt' | 'skipped';
	/** Wall-clock seconds spent in `vite build` (0 for cached/skipped). */
	readonly seconds: number;
}

/**
 * Collect every build-input file path, sorted, deduplicated. Bun's `Glob`
 * with `**` already recurses; the `apps/flightbag/build` output tree is
 * never matched because no input glob points inside it.
 */
async function collectInputFiles(): Promise<string[]> {
	const seen = new Set<string>();
	for (const pattern of INPUT_GLOBS) {
		const glob = new Bun.Glob(pattern);
		for await (const file of glob.scan({ cwd: '.', onlyFiles: true })) {
			seen.add(file);
		}
	}
	return [...seen].sort();
}

/**
 * Content hash of the sorted build-input file list. Each entry is the file
 * path plus a SHA-256 of its bytes; the per-file hash means a path that
 * keeps its name but changes content still flips the digest.
 */
async function hashInputs(): Promise<string> {
	const files = await collectInputFiles();
	const hasher = new Bun.CryptoHasher('sha256');
	for (const path of files) {
		hasher.update(path);
		hasher.update('\0');
		const bytes = await Bun.file(path).arrayBuffer();
		const fileHash = new Bun.CryptoHasher('sha256').update(new Uint8Array(bytes)).digest('hex');
		hasher.update(fileHash);
		hasher.update('\n');
	}
	return hasher.digest('hex');
}

/** Read the stored build hash, or `null` when no prior build exists. */
async function readStoredHash(): Promise<string | null> {
	if (!existsSync(HASH_FILE)) return null;
	try {
		return (await Bun.file(HASH_FILE).text()).trim();
	} catch {
		return null;
	}
}

/**
 * Ensure `apps/flightbag/build/` is fresh before the integration sweep.
 *
 * - `skipBuild` -> never builds, returns `skipped` (caller asked for it).
 * - `forceRebuild` -> always builds, ignores the stored hash.
 * - otherwise -> builds only when the input hash changed or the build
 *   entry point is missing.
 *
 * The `runBuild` parameter is the subprocess runner injected by the caller
 * so this module stays free of a direct `spawn` dependency and is trivially
 * testable. It must run `bunx vite build` SILENTLY (vite dumps a ~350-line
 * asset table that nobody reads live) and resolve to the exit code; the
 * caller streams that output to a log file. A non-zero code throws.
 */
export async function ensureFlightbagBuild(opts: {
	readonly forceRebuild: boolean;
	readonly skipBuild: boolean;
	readonly runBuild: (cmd: readonly string[], runOpts: { readonly cwd: string }) => Promise<number>;
}): Promise<BuildResult> {
	if (opts.skipBuild) {
		console.log('build: skipped (SWEEP_SKIP_BUILD)');
		return { status: 'skipped', seconds: 0 };
	}

	const inputHash = await hashInputs();

	if (!opts.forceRebuild) {
		const stored = await readStoredHash();
		if (stored !== null && stored === inputHash && existsSync(BUILD_ENTRY)) {
			console.log('build: flightbag up to date (cached)');
			return { status: 'cached', seconds: 0 };
		}
	}

	const startedAt = Date.now();
	const code = await opts.runBuild(['bunx', 'vite', 'build'], { cwd: FLIGHTBAG_DIR });
	if (code !== 0) {
		throw new Error(`flightbag build failed (vite exited ${code})`);
	}
	const seconds = Math.round((Date.now() - startedAt) / 1000);

	// Persist the hash only after a successful build.
	await Bun.write(HASH_FILE, `${inputHash}\n`);
	console.log(`build: flightbag rebuilt in ${seconds}s`);
	return { status: 'rebuilt', seconds };
}
