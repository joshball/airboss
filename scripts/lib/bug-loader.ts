/**
 * Read-only bug-tracker loader. Phase 6 of `tracking-system-overhaul`.
 *
 * Walks `docs/bugs/bug-*.md`, parses the YAML frontmatter block, validates
 * against the schema in `@ab/types`, and returns typed `Bug[]`. Lives under
 * `scripts/lib/` (not `libs/utils/`) because `libs/utils/` is browser-bundled
 * and this loader uses `node:fs` plus `node:path`. Mirrors `wp-loader.ts`.
 *
 * The future hangar `/bugs` view consumes this module from a `+page.server.ts`,
 * which is server-only and may import scripts/lib freely.
 *
 * Loader contract:
 *   - Missing or unreadable bug file           -> entry omitted (warned to stderr)
 *   - Missing frontmatter fence                -> Bug returned with validation_errors
 *   - YAML parse error                         -> Bug returned with validation_errors
 *   - Schema validation error                  -> Bug returned with validation_errors,
 *                                                 frontmatter set to null
 *   - id mismatch with filename                -> validation_errors entry on `id`
 *
 * Never throws on a per-bug failure; the caller decides how to render errors.
 */

import { readdirSync, readFileSync, statSync } from 'node:fs';
import { basename, join, resolve } from 'node:path';
import { BUG_DIR } from '@ab/constants';
import { type Bug, type BugFrontmatter, type BugValidationError, bugFrontmatterSchema } from '@ab/types';
import { parse as parseYaml } from 'yaml';

/** Resolve the absolute repo root by walking up from `process.cwd()` (so tests
 * can spin up a synthetic repo in a tmpdir) and falling back to this module's
 * location (so production callers from anywhere in the real worktree still
 * work). Mirrors the strategy in `wp-loader.ts` but with the cwd preference
 * added for test ergonomics. */
function walkUpForAirbossPackageJson(start: string): string | null {
	let dir = start;
	for (let i = 0; i < 16; i += 1) {
		const candidate = join(dir, 'package.json');
		try {
			const json = JSON.parse(readFileSync(candidate, 'utf8')) as { name?: string };
			if (json.name === 'airboss') return dir;
		} catch {
			// continue walking up
		}
		const parent = resolve(dir, '..');
		if (parent === dir) return null;
		dir = parent;
	}
	return null;
}

function resolveRepoRoot(): string {
	const fromCwd = walkUpForAirbossPackageJson(process.cwd());
	if (fromCwd !== null) return fromCwd;
	const fromSource = walkUpForAirbossPackageJson(import.meta.dir);
	if (fromSource !== null) return fromSource;
	throw new Error('bug-loader: unable to locate repo root (airboss package.json)');
}

const FRONTMATTER_FENCE = /^---\r?\n([\s\S]*?)\r?\n---\r?\n?/;

interface SplitResult {
	yaml: string | null;
	parseError: string | null;
}

function extractFrontmatter(source: string): SplitResult {
	const match = source.match(FRONTMATTER_FENCE);
	if (match === null) {
		return { yaml: null, parseError: 'bug file is missing the leading `---` frontmatter block' };
	}
	return { yaml: match[1] ?? '', parseError: null };
}

/** Parse one bug markdown file into a Bug entry. Public so the lint script
 * and the CLI mutation path can invoke it on a single file without re-reading
 * the entire dir. */
export function loadBugFromFile(bugPath: string, idFromFile: string): Bug {
	const errors: BugValidationError[] = [];
	let source: string;
	try {
		source = readFileSync(bugPath, 'utf8');
	} catch (err) {
		const message = err instanceof Error ? err.message : String(err);
		errors.push({ field: '<file>', message: `unable to read bug file: ${message}` });
		return { id: idFromFile, bugPath, frontmatter: null, rawFrontmatter: null, validation_errors: errors };
	}

	const { yaml, parseError } = extractFrontmatter(source);
	if (parseError !== null || yaml === null) {
		errors.push({ field: '<frontmatter>', message: parseError ?? 'no frontmatter block' });
		return { id: idFromFile, bugPath, frontmatter: null, rawFrontmatter: null, validation_errors: errors };
	}

	let raw: unknown;
	try {
		raw = parseYaml(yaml);
	} catch (err) {
		const message = err instanceof Error ? err.message : String(err);
		errors.push({ field: '<frontmatter>', message: `YAML parse error: ${message}` });
		return { id: idFromFile, bugPath, frontmatter: null, rawFrontmatter: null, validation_errors: errors };
	}

	if (raw === null || typeof raw !== 'object' || Array.isArray(raw)) {
		errors.push({ field: '<frontmatter>', message: 'frontmatter must be a YAML mapping (key: value pairs)' });
		return { id: idFromFile, bugPath, frontmatter: null, rawFrontmatter: null, validation_errors: errors };
	}

	const rawFrontmatter = raw as Record<string, unknown>;
	// Inject the file-derived id so authors do not have to repeat the slug.
	// The schema then validates that `id` is well-formed; we additionally check
	// here that any author-provided id matches the filename.
	const authorProvidedId = rawFrontmatter.id;
	if (authorProvidedId !== undefined && authorProvidedId !== idFromFile) {
		errors.push({
			field: 'id',
			message: `id "${String(authorProvidedId)}" does not match filename "${idFromFile}"`,
		});
	}
	const candidate = { ...rawFrontmatter, id: idFromFile };

	const result = bugFrontmatterSchema.safeParse(candidate);
	if (!result.success) {
		for (const issue of result.error.issues) {
			errors.push({
				field: issue.path.length === 0 ? '<root>' : issue.path.join('.'),
				message: issue.message,
			});
		}
		return { id: idFromFile, bugPath, frontmatter: null, rawFrontmatter, validation_errors: errors };
	}

	const frontmatter: BugFrontmatter = result.data;
	return { id: idFromFile, bugPath, frontmatter, rawFrontmatter, validation_errors: errors };
}

function isBugFile(name: string): boolean {
	return name.startsWith('bug-') && name.endsWith('.md');
}

/** Read all `docs/bugs/bug-*.md` files. The generated `INDEX.md` and any
 * non-conforming filenames are skipped. The optional `repoRoot` arg is for
 * tests; production callers omit it. */
export function loadAllBugs(repoRoot: string = resolveRepoRoot()): Bug[] {
	const dir = join(repoRoot, BUG_DIR);
	let entries: string[];
	try {
		entries = readdirSync(dir);
	} catch (err) {
		const message = err instanceof Error ? err.message : String(err);
		throw new Error(`bug-loader: cannot read ${dir}: ${message}`);
	}

	const bugs: Bug[] = [];
	for (const name of entries.sort()) {
		if (!isBugFile(name)) continue;
		const bugPath = join(dir, name);
		try {
			if (!statSync(bugPath).isFile()) continue;
		} catch {
			continue;
		}
		const id = basename(name, '.md');
		bugs.push(loadBugFromFile(bugPath, id));
	}
	return bugs;
}

/** Filter helper: a bug is "open" only when status=open AND the schema
 * validated. Frontmatter-less bugs are never open (they're broken). */
export function isOpen(bug: Bug): boolean {
	return bug.frontmatter !== null && bug.frontmatter.status === 'open';
}
