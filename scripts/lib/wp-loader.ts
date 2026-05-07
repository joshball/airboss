/**
 * Read-only work-package loader. ADR 025.
 *
 * Walks `docs/work-packages/<slug>/spec.md`, parses the YAML frontmatter
 * block, validates against the schema in `@ab/types`, and returns typed
 * `WorkPackage[]`. Lives under `scripts/lib/` (not `libs/utils/`) because
 * `libs/utils/` is browser-bundled and this loader uses `node:fs` plus
 * `node:path`. The parent task explicitly anticipates this placement
 * (CLAUDE.md "browser-bundled libs must not statically import `node:*`").
 *
 * The hangar `/roadmap` view (Phase 8) consumes this same module from a
 * `+page.server.ts`, which is server-only and may import scripts/lib freely.
 *
 * Loader contract:
 *   - Missing or unreadable spec.md            -> entry omitted (warned to stderr)
 *   - Missing frontmatter fence                -> WP returned with validation_errors
 *   - YAML parse error                         -> WP returned with validation_errors
 *   - Schema validation error                  -> WP returned with validation_errors,
 *                                                 frontmatter set to null
 *   - id mismatch with parent dir name         -> validation_errors entry on `id`
 *
 * Never throws on a per-WP failure; the caller decides how to render errors.
 */

import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { WP_DIR, WP_SPEC_FILE } from '@ab/constants';
import {
	type WorkPackage,
	type WorkPackageFrontmatter,
	type WorkPackageValidationError,
	workPackageFrontmatterSchema,
} from '@ab/types';
import { parse as parseYaml } from 'yaml';

/** Resolve the absolute repo root. The loader is called from many entry
 * points (lint, CLI, hangar SSR); each may have a different cwd. We anchor
 * by walking up from the loader's own location until `package.json` carrying
 * `"name": "airboss"` is found.
 *
 * Cached after first resolution. */
let cachedRepoRoot: string | null = null;

function resolveRepoRoot(): string {
	if (cachedRepoRoot !== null) return cachedRepoRoot;
	// `import.meta.dirname` is the Node 20+ / Bun standard. Used over the
	// Bun-only `import.meta.dir` so the hangar `/roadmap` view (which
	// imports this loader through a SvelteKit alias) type-checks cleanly
	// under svelte-check, which doesn't see `bun-types`.
	// Walk up until we find the workspace package.json with name=airboss.
	let dir = import.meta.dirname;
	for (let i = 0; i < 16; i += 1) {
		const candidate = join(dir, 'package.json');
		try {
			const json = JSON.parse(readFileSync(candidate, 'utf8')) as { name?: string };
			if (json.name === 'airboss') {
				cachedRepoRoot = dir;
				return dir;
			}
		} catch {
			// continue walking up
		}
		const parent = resolve(dir, '..');
		if (parent === dir) break;
		dir = parent;
	}
	throw new Error('wp-loader: unable to locate repo root (airboss package.json)');
}

const FRONTMATTER_FENCE = /^---\r?\n([\s\S]*?)\r?\n---\r?\n?/;

interface SplitResult {
	yaml: string | null;
	parseError: string | null;
}

function extractFrontmatter(specSource: string): SplitResult {
	const match = specSource.match(FRONTMATTER_FENCE);
	if (match === null) {
		return { yaml: null, parseError: 'spec.md is missing the leading `---` frontmatter block' };
	}
	return { yaml: match[1] ?? '', parseError: null };
}

/** Parse one spec.md file into a WorkPackage entry. Public so the lint script
 * can invoke it on a single staged file without re-reading the entire dir. */
export function loadWorkPackageFromSpec(specPath: string, idFromDir: string): WorkPackage {
	const errors: WorkPackageValidationError[] = [];
	let source: string;
	try {
		source = readFileSync(specPath, 'utf8');
	} catch (err) {
		const message = err instanceof Error ? err.message : String(err);
		errors.push({ field: '<file>', message: `unable to read spec.md: ${message}` });
		return { id: idFromDir, specPath, frontmatter: null, rawFrontmatter: null, validation_errors: errors };
	}

	const { yaml, parseError } = extractFrontmatter(source);
	if (parseError !== null || yaml === null) {
		errors.push({ field: '<frontmatter>', message: parseError ?? 'no frontmatter block' });
		return { id: idFromDir, specPath, frontmatter: null, rawFrontmatter: null, validation_errors: errors };
	}

	let raw: unknown;
	try {
		raw = parseYaml(yaml);
	} catch (err) {
		const message = err instanceof Error ? err.message : String(err);
		errors.push({ field: '<frontmatter>', message: `YAML parse error: ${message}` });
		return { id: idFromDir, specPath, frontmatter: null, rawFrontmatter: null, validation_errors: errors };
	}

	if (raw === null || typeof raw !== 'object' || Array.isArray(raw)) {
		errors.push({ field: '<frontmatter>', message: 'frontmatter must be a YAML mapping (key: value pairs)' });
		return { id: idFromDir, specPath, frontmatter: null, rawFrontmatter: null, validation_errors: errors };
	}

	const rawFrontmatter = raw as Record<string, unknown>;
	// Inject the directory-derived id so authors do not have to repeat the slug.
	// The schema then validates that `id` is well-formed; we additionally check
	// here that any author-provided id matches the directory.
	const authorProvidedId = rawFrontmatter.id;
	if (authorProvidedId !== undefined && authorProvidedId !== idFromDir) {
		errors.push({
			field: 'id',
			message: `id "${String(authorProvidedId)}" does not match parent directory "${idFromDir}"`,
		});
	}
	const candidate = { ...rawFrontmatter, id: idFromDir };

	const result = workPackageFrontmatterSchema.safeParse(candidate);
	if (!result.success) {
		for (const issue of result.error.issues) {
			errors.push({
				field: issue.path.length === 0 ? '<root>' : issue.path.join('.'),
				message: issue.message,
			});
		}
		return { id: idFromDir, specPath, frontmatter: null, rawFrontmatter, validation_errors: errors };
	}

	const frontmatter: WorkPackageFrontmatter = result.data;
	return { id: idFromDir, specPath, frontmatter, rawFrontmatter, validation_errors: errors };
}

/** Read all `docs/work-packages/<slug>/spec.md` files. Directories without a
 * spec.md (e.g. legacy feature dirs that only carry tasks.md) are skipped
 * with a stderr warning so authors notice missing specs.
 *
 * The optional `repoRoot` arg is for tests; production callers omit it. */
export function loadAllWorkPackages(repoRoot: string = resolveRepoRoot()): WorkPackage[] {
	const wpRoot = join(repoRoot, WP_DIR);
	let entries: string[];
	try {
		entries = readdirSync(wpRoot);
	} catch (err) {
		const message = err instanceof Error ? err.message : String(err);
		throw new Error(`wp-loader: cannot read ${wpRoot}: ${message}`);
	}

	const packages: WorkPackage[] = [];
	for (const name of entries.sort()) {
		const dir = join(wpRoot, name);
		let isDir = false;
		try {
			isDir = statSync(dir).isDirectory();
		} catch {
			continue;
		}
		if (!isDir) continue;
		// Skip dot dirs (e.g. .archive) and the conventional template dir.
		if (name.startsWith('.')) continue;
		const specPath = join(dir, WP_SPEC_FILE);
		try {
			statSync(specPath);
		} catch {
			console.warn(`wp-loader: ${name} has no spec.md, skipping`);
			continue;
		}
		packages.push(loadWorkPackageFromSpec(specPath, name));
	}
	return packages;
}

/** Filter helper: a WP is "shipped" only when status=shipped AND the schema
 * validated. Frontmatter-less WPs are never shipped. */
export function isShipped(wp: WorkPackage): boolean {
	return wp.frontmatter !== null && wp.frontmatter.status === 'shipped';
}
