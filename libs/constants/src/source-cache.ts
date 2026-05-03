/**
 * Source-document cache root resolution. Single source of truth for the
 * `AIRBOSS_HANDBOOK_CACHE` env var, the default cache directory layout, and
 * the helper every ingest pipeline + script + server hook calls to figure
 * out where source PDFs / XML live on disk.
 *
 * See ADR 018 (storage policy) and `docs/platform/STORAGE.md`. ADR 021 owns
 * the per-corpus subdirectory layout under the resolved root.
 *
 * Lives in `@ab/constants` (and not `@ab/sources`) so that pure-Node script
 * entry points can import the helper without dragging in the full sources
 * lib's transitive deps (fast-xml-parser, etc.).
 *
 * # Browser safety
 *
 * `@ab/constants` is imported from client code (route constants, help kinds,
 * etc.) and the barrel re-exports this module, so Vite traces it into the
 * browser bundle even though every function below is server-only. To keep
 * the browser bundle clean, this module MUST NOT statically import
 * `node:fs`, `node:os`, or `node:path` at module top level -- Vite would
 * externalize them and crash the client at first hit
 * (`Module "node:fs" has been externalized for browser compatibility`).
 *
 * Instead, we resolve the Node built-ins lazily via
 * `process.getBuiltinModule(spec)`. This is a runtime API (Node 22+, Bun)
 * that Vite's static analyzer cannot follow, so the bundler never sees the
 * `node:*` specifiers and never tries to externalize them. The browser
 * loads this module but never executes the function bodies, so the
 * lookups never fire on the client.
 */

import { ENV_VARS } from './env';

/** Names + literals defining the source-document cache. */
export const SOURCE_CACHE = {
	/** Env var consulted to override the cache root. */
	ENV_VAR: ENV_VARS.AIRBOSS_HANDBOOK_CACHE,
	/** Parent directory beneath the user home for the default cache root. */
	DEFAULT_PARENT_DIR: 'Documents',
	/** Directory name appended under the parent for the default cache root. */
	DEFAULT_DIR_NAME: 'airboss-handbook-cache',
	// -----------------------------------------------------------------------
	// Per-corpus subdirectory names under the resolved cache root.
	//
	// Source of truth: ADR 021 (cache flat naming). Each ingest pipeline that
	// builds a path of the form `join(cacheRoot, '<corpus>', ...)` routes the
	// `<corpus>` segment through one of these constants instead of hardcoding
	// the literal. Adding a new corpus: drop a new key here, add the matching
	// `.gitignore` line per ADR 018, and the ingest module imports the new
	// member.
	//
	// Note: the `REGS` cache subdir is `regulations` (not `regs` -- the corpus
	// id) by historical convention. The corpus discriminator string `'regs'`
	// in `corpus: 'regs'` fields is a separate concept (resolver registration,
	// per ADR 019 §2.1) and stays a string literal there.
	// -----------------------------------------------------------------------
	/** Advisory Circulars cache subdir: `<root>/ac/`. */
	AC: 'ac',
	/** Airman Certification Standards cache subdir: `<root>/acs/`. */
	ACS: 'acs',
	/** Aeronautical Information Manual cache subdir: `<root>/aim/`. */
	AIM: 'aim',
	/** FAA handbooks (PHAK, AFH, IFH, FIRC, ...) cache subdir: `<root>/handbooks/`. */
	HANDBOOKS: 'handbooks',
	/** eCFR regulations XML cache subdir: `<root>/regulations/`. */
	REGS: 'regulations',
	/** Safety Alerts for Operators (SAFO) cache subdir: `<root>/safo/`. */
	SAFO: 'safo',
	/** Information for Operators (InFO) cache subdir: `<root>/info/`. */
	INFO: 'info',
} as const;

/**
 * Per-corpus subdirectory name. Narrows `SOURCE_CACHE` to just the corpus
 * keys; callers that need to discriminate "is this a corpus subdir or one of
 * the metadata fields (`ENV_VAR`, etc.)?" can pin to this type.
 */
export type SourceCacheSubdir = (typeof SOURCE_CACHE)['AC' | 'ACS' | 'AIM' | 'HANDBOOKS' | 'REGS' | 'SAFO' | 'INFO'];

type NodeFs = { existsSync: (p: string) => boolean; mkdirSync: (p: string, opts: { recursive: boolean }) => void };
type NodeOs = { homedir: () => string };
type NodePath = { join: (...parts: string[]) => string };

let cachedFs: NodeFs | null = null;
let cachedOs: NodeOs | null = null;
let cachedPath: NodePath | null = null;

type GetBuiltinModule = (spec: string) => unknown;

/**
 * Resolve a Node built-in lazily, hidden from Vite's static analyzer.
 *
 * Uses `process.getBuiltinModule` (Node 22+, Bun) so the specifier is
 * passed at runtime and never appears in a static `import` form the
 * bundler can rewrite or externalize.
 */
function loadBuiltin<T>(spec: string): T {
	const proc = (typeof process !== 'undefined' ? process : undefined) as
		| (NodeJS.Process & { getBuiltinModule?: GetBuiltinModule })
		| undefined;
	const getBuiltin = proc?.getBuiltinModule;
	if (typeof getBuiltin !== 'function') {
		throw new Error(`source-cache: ${spec} unavailable in this runtime (no process.getBuiltinModule)`);
	}
	return getBuiltin(spec) as T;
}

function nodeFs(): NodeFs {
	if (!cachedFs) cachedFs = loadBuiltin<NodeFs>('node:fs');
	return cachedFs;
}

function nodeOs(): NodeOs {
	if (!cachedOs) cachedOs = loadBuiltin<NodeOs>('node:os');
	return cachedOs;
}

function nodePath(): NodePath {
	if (!cachedPath) cachedPath = loadBuiltin<NodePath>('node:path');
	return cachedPath;
}

/**
 * Expand a leading `~` or `~/` in a path against the current user home.
 * No-op when the path does not start with `~`.
 */
export function expandHome(p: string): string {
	if (p === '~') return nodeOs().homedir();
	if (p.startsWith('~/')) return nodePath().join(nodeOs().homedir(), p.slice(2));
	return p;
}

/** Default cache root: `~/Documents/airboss-handbook-cache/`. */
export function defaultCacheRoot(): string {
	return nodePath().join(nodeOs().homedir(), SOURCE_CACHE.DEFAULT_PARENT_DIR, SOURCE_CACHE.DEFAULT_DIR_NAME);
}

/**
 * Resolve the source-document cache root.
 *
 * Resolution order:
 *   1. `AIRBOSS_HANDBOOK_CACHE` env var (with `~/` expanded), if non-empty.
 *   2. `~/Documents/airboss-handbook-cache/` (default).
 *
 * When `ensureExists` is `true` (default), the directory is created on
 * demand. Pass `false` for read-only callsites (tests, smoke probes) where
 * mkdir-on-resolve would be a side effect.
 */
export function resolveCacheRoot(options: { ensureExists?: boolean } = {}): string {
	const { ensureExists = true } = options;
	const fromEnv = process.env[SOURCE_CACHE.ENV_VAR];
	const root = fromEnv !== undefined && fromEnv.length > 0 ? expandHome(fromEnv) : defaultCacheRoot();
	const fs = nodeFs();
	if (ensureExists && !fs.existsSync(root)) {
		fs.mkdirSync(root, { recursive: true });
	}
	return root;
}
