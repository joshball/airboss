/**
 * Per-worktree dev database name resolver.
 *
 * The shared OrbStack postgres container hosts every worktree's dev DB on
 * port 5435. Without isolation, two worktrees doing `bun run db reset`
 * trample each other's seeded state and any agent's verification step ends
 * up reading the other agent's DB. This helper derives a stable per-
 * worktree DB name so each worktree gets its own database on the same
 * postgres instance.
 *
 * Resolution order:
 *
 *   1. Worktree: ALWAYS derive from the current branch. Lowercase, replace
 *      non-alphanumeric runs with `_`, prefix with `airboss_wt_`, cap at
 *      63 chars (postgres identifier limit). Worktrees inherit the parent
 *      repo's `.env`, which Bun loads automatically. If we honored that
 *      env-set DATABASE_URL we would silently route every worktree at the
 *      shared `airboss` DB, defeating the whole point of per-worktree
 *      isolation. Override path: set `AIRBOSS_DB_NAME` explicitly.
 *   2. `AIRBOSS_DB_NAME` env var: explicit override for both main and
 *      worktree. Use this to point at a remote DB or pin a custom name.
 *   3. `DATABASE_URL` env var (main repo only): parse the dbname out of it.
 *   4. Main repo, no env: return the canonical `airboss` name.
 *
 * Returns the dbname only. The caller assembles the full URL.
 */

import { execSync } from 'node:child_process';
import { basename } from 'node:path';

const POSTGRES_IDENT_LIMIT = 63;
const PREFIX = 'airboss_wt_';
const MAIN_DB_NAME = 'airboss';

/**
 * Stable name for the dev DB this script run should target. Pure: same
 * worktree → same name → same DB across resets.
 */
const OVERRIDE_ENV_VAR = 'AIRBOSS_DB_NAME';

export function devDbName(): string {
	const explicitOverride = process.env[OVERRIDE_ENV_VAR];
	if (explicitOverride && explicitOverride.length > 0) return explicitOverride;

	// Worktree path comes BEFORE DATABASE_URL parsing: worktrees inherit the
	// parent repo's .env and Bun loads it automatically, so an env-set URL
	// would route every worktree at the shared `airboss` DB. Detect worktree
	// state and derive from branch instead.
	if (!isMainRepo()) {
		return slugifyForPostgres(detectBranchOrWorktreeId());
	}

	// Main repo: trust DATABASE_URL when present (lets a developer point at
	// a remote dev box or pin a custom dbname).
	const fromEnv = parseDbNameFromEnv();
	if (fromEnv !== null) return fromEnv;

	return MAIN_DB_NAME;
}

function parseDbNameFromEnv(): string | null {
	const url = process.env.DATABASE_URL;
	if (!url || url.length === 0) return null;
	// Postgres URLs end in `/<dbname>` optionally followed by `?query`.
	// `new URL()` handles both `postgresql://` and `postgres://` schemes.
	try {
		const parsed = new URL(url);
		const dbname = parsed.pathname.replace(/^\//, '');
		if (dbname.length === 0) return null;
		return dbname;
	} catch {
		return null;
	}
}

/**
 * True when running from the main repo (not a worktree). Detected via
 * `git rev-parse --git-dir` vs `--git-common-dir`: in a worktree these
 * differ (`.git/worktrees/<id>` vs `.git`); in the main repo they're equal.
 */
function isMainRepo(): boolean {
	try {
		const gitDir = run('git rev-parse --git-dir');
		const commonDir = run('git rev-parse --git-common-dir');
		return gitDir === commonDir;
	} catch {
		// Not a git repo at all (rare; e.g. running from a tarball). Treat
		// as main so we don't auto-pollute the postgres instance.
		return true;
	}
}

/**
 * Best-effort identifier for the current worktree. Prefers branch name;
 * falls back to the worktree's directory basename for detached HEADs or
 * branch names that resolve to `HEAD`.
 */
function detectBranchOrWorktreeId(): string {
	try {
		const branch = run('git rev-parse --abbrev-ref HEAD');
		if (branch.length > 0 && branch !== 'HEAD') return branch;
	} catch {
		// fall through
	}
	try {
		const top = run('git rev-parse --show-toplevel');
		return basename(top);
	} catch {
		return 'unknown';
	}
}

/**
 * Convert a branch name into a postgres-safe identifier. Postgres folds
 * unquoted identifiers to lowercase and limits them to NAMEDATALEN-1 = 63
 * chars; allowed characters are letters, digits, and underscore. Anything
 * else gets collapsed into a single underscore. Leading and trailing
 * underscores are trimmed so the prefix stays clean.
 */
export function slugifyForPostgres(raw: string): string {
	const cleaned = raw
		.toLowerCase()
		.replace(/[^a-z0-9]+/g, '_')
		.replace(/^_+|_+$/g, '');
	const max = POSTGRES_IDENT_LIMIT - PREFIX.length;
	const slug = cleaned.length > max ? cleaned.slice(0, max).replace(/_+$/g, '') : cleaned;
	return `${PREFIX}${slug.length === 0 ? 'unknown' : slug}`;
}

/**
 * Build a full DATABASE_URL for the resolved DB name, reusing the existing
 * dev credentials. Used by `.envrc` and any helper that needs a URL rather
 * than just the name.
 */
export function devDatabaseUrl(): string {
	// Lazy import so this file stays usable from a top-level shell script
	// without dragging in the full constants tree on a no-op call.
	const { DEV_DB, PORTS } = require('@ab/constants');
	return `postgresql://${DEV_DB.USER}:${DEV_DB.PASSWORD}@${DEV_DB.HOST}:${PORTS.DB}/${devDbName()}`;
}

function run(cmd: string): string {
	return execSync(cmd, { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }).trim();
}

// CLI: `bun scripts/lib/db-name.ts` prints the resolved DB name. Used by
// `.envrc` to populate DATABASE_URL. `--url` prints the full URL instead.
if (import.meta.main) {
	const wantsUrl = process.argv.includes('--url');
	process.stdout.write(`${wantsUrl ? devDatabaseUrl() : devDbName()}\n`);
}
