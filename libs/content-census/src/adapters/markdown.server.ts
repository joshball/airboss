// @browser-globals: server-only -- never imported by client .svelte
/**
 * Shared markdown-reading helpers for the census adapters.
 *
 * Phase-2 corpora are markdown-based: knowledge nodes, regulations lessons,
 * vision PRDs, work packages, ADRs. Every adapter needs the same primitives
 * -- read a file, split off a YAML frontmatter block, count `:::phase`
 * directives, walk a directory. They live here so each adapter stays a thin
 * derived-state rule rather than re-implementing file IO.
 *
 * Server-only: reads `node:fs`. Imported by `*.server.ts` adapters only.
 */

import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { parse as parseYaml } from 'yaml';
import { repoRoot } from './repo-root.server';

/** A markdown file split into its YAML frontmatter and its body. */
export interface ParsedMarkdown {
	/** The parsed frontmatter mapping, or `null` if there was no fence. */
	frontmatter: Record<string, unknown> | null;
	/** Everything after the closing `---`, verbatim. */
	body: string;
}

const FRONTMATTER_FENCE = /^---\r?\n([\s\S]*?)\r?\n---\r?\n?/;

/** Read a repo-relative markdown file and split frontmatter from body. */
export function parseMarkdownFile(relativePath: string): ParsedMarkdown {
	const source = readFileSync(join(repoRoot(), relativePath), 'utf8');
	return parseMarkdownSource(source);
}

/** Split an in-memory markdown string into frontmatter + body. */
export function parseMarkdownSource(source: string): ParsedMarkdown {
	const match = source.match(FRONTMATTER_FENCE);
	if (match === null) {
		return { frontmatter: null, body: source };
	}
	let parsed: unknown;
	try {
		parsed = parseYaml(match[1] ?? '');
	} catch {
		parsed = null;
	}
	const frontmatter =
		parsed !== null && typeof parsed === 'object' && !Array.isArray(parsed)
			? (parsed as Record<string, unknown>)
			: null;
	return { frontmatter, body: source.slice(match[0].length) };
}

/** Read a frontmatter value as a trimmed string, or `null` when absent. */
export function frontmatterString(frontmatter: Record<string, unknown> | null, key: string): string | null {
	if (frontmatter === null) return null;
	const value = frontmatter[key];
	return typeof value === 'string' ? value.trim() : null;
}

/**
 * Read a frontmatter value as a list of trimmed strings. A missing key, a
 * non-array value, or non-string entries all collapse to an empty list --
 * the caller never has to guard the YAML shape. Used by adapters that walk
 * the knowledge-graph edge keys (`requires`, `deepens`, `related`, ...).
 */
export function frontmatterStringArray(frontmatter: Record<string, unknown> | null, key: string): string[] {
	if (frontmatter === null) return [];
	const value = frontmatter[key];
	if (!Array.isArray(value)) return [];
	return value.filter((entry): entry is string => typeof entry === 'string').map((entry) => entry.trim());
}

/** Count the non-blank lines in a body -- the "is this authored?" signal. */
export function nonBlankLineCount(body: string): number {
	return body.split('\n').filter((line) => line.trim().length > 0).length;
}

/**
 * The set of `:::phase name="..."` directives in a knowledge-node body that
 * carry real authored prose -- not an empty body and not only an HTML
 * `<!-- Skeleton -->` comment. Returns the phase names that are authored.
 */
export function authoredPhases(body: string): string[] {
	const authored: string[] = [];
	const phaseOpener = /:::phase\s+name="([^"]+)"/g;
	let match: RegExpExecArray | null = phaseOpener.exec(body);
	while (match !== null) {
		const name = match[1];
		const afterOpener = body.slice(phaseOpener.lastIndex);
		const closer = afterOpener.indexOf('\n:::');
		const phaseBody = closer === -1 ? afterOpener : afterOpener.slice(0, closer);
		// Strip HTML comments (the `<!-- Skeleton -->` markers) and whitespace.
		const prose = phaseBody.replace(/<!--[\s\S]*?-->/g, '').trim();
		if (prose.length > 0) authored.push(name);
		match = phaseOpener.exec(body);
	}
	return authored;
}

/**
 * Count the `- front:` card entries inside every `:::cards` block of a
 * markdown body. Cards are top-level YAML list items between a `:::cards`
 * opener and the next bare `:::` closer. Shared by the cards census (the
 * card count IS the corpus) and the knowledge-nodes census (a node's card
 * count drives the cardless-node gap).
 */
export function countCardBlocks(body: string): number {
	let count = 0;
	let inBlock = false;
	for (const line of body.split('\n')) {
		const trimmed = line.trim();
		if (!inBlock) {
			if (trimmed.startsWith(':::cards')) inBlock = true;
			continue;
		}
		if (trimmed === ':::') {
			inBlock = false;
			continue;
		}
		// A card starts at a list item whose first key is `front:`.
		if (/^-\s+front:/.test(trimmed)) count += 1;
	}
	return count;
}

/** List immediate subdirectory names of a repo-relative directory, sorted. */
export function listDirs(relativeDir: string): string[] {
	const abs = join(repoRoot(), relativeDir);
	let entries: string[];
	try {
		entries = readdirSync(abs);
	} catch {
		return [];
	}
	return entries
		.filter((name) => {
			if (name.startsWith('.')) return false;
			try {
				return statSync(join(abs, name)).isDirectory();
			} catch {
				return false;
			}
		})
		.sort();
}

/** List immediate subdirectories of a repo-relative dir whose name starts with `prefix`. */
export function dirsWithPrefix(relativeDir: string, prefix: string): string[] {
	return listDirs(relativeDir).filter((name) => name.startsWith(prefix));
}

/** List markdown file names directly inside a repo-relative directory. */
export function listMarkdownFiles(relativeDir: string): string[] {
	const abs = join(repoRoot(), relativeDir);
	let entries: string[];
	try {
		entries = readdirSync(abs);
	} catch {
		return [];
	}
	return entries
		.filter((name) => {
			if (!name.endsWith('.md')) return false;
			try {
				return statSync(join(abs, name)).isFile();
			} catch {
				return false;
			}
		})
		.sort();
}

/** True when a repo-relative path exists as a file. */
export function fileExists(relativePath: string): boolean {
	try {
		return statSync(join(repoRoot(), relativePath)).isFile();
	} catch {
		return false;
	}
}

/**
 * Recursively collect repo-relative paths of every `*.md` file under a
 * directory whose basename matches `match` (defaults to any markdown file).
 */
export function walkMarkdown(relativeDir: string, match?: (basename: string) => boolean): string[] {
	const root = repoRoot();
	const results: string[] = [];
	const walk = (dir: string): void => {
		let entries: string[];
		try {
			entries = readdirSync(join(root, dir));
		} catch {
			return;
		}
		for (const name of entries.sort()) {
			if (name.startsWith('.')) continue;
			const rel = join(dir, name);
			let stat: ReturnType<typeof statSync>;
			try {
				stat = statSync(join(root, rel));
			} catch {
				continue;
			}
			if (stat.isDirectory()) {
				walk(rel);
			} else if (name.endsWith('.md') && (match === undefined || match(name))) {
				results.push(rel);
			}
		}
	};
	walk(relativeDir);
	return results;
}
