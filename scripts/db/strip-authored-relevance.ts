#!/usr/bin/env bun
/**
 * Strip authored `relevance:` fields from knowledge node frontmatter
 * (cert-syllabus WP Gate B).
 *
 * After Gate A, `knowledge_node.relevance` is rebuilt from active syllabi
 * via `scripts/db/build-relevance-cache.ts`. The cache is the source of
 * truth; any author-side `relevance:` block in
 * `course/knowledge/**\/node.md` is now redundant and would only
 * mislead future authors. This script removes the field cleanly.
 *
 * Behaviour:
 *
 *   - Walks every `course/knowledge/**\/node.md`.
 *   - Splits frontmatter / body using the same convention as
 *     `scripts/build-knowledge-index.ts` (the `---\n...\n---` fence).
 *   - If frontmatter contains a top-level `relevance:` key (with or
 *     without a list/scalar value continuing across following lines),
 *     remove the key and its value lines, leaving every other field
 *     intact.
 *   - Writes the file back only when the frontmatter actually changed.
 *   - Reports counts: files scanned, files modified.
 *
 * The script is idempotent: re-running on already-stripped files
 * reports 0 modifications.
 *
 * As of WP cert-syllabus PR 4 the codebase has no `relevance:` keys
 * authored anywhere -- the script is shipped for future-proofing
 * (any new authoring that includes relevance gets stripped on the
 * next run).
 *
 * Usage:
 *   bun scripts/db/strip-authored-relevance.ts
 *   bun scripts/db/strip-authored-relevance.ts --dry-run
 */

import { readdirSync, readFileSync, statSync, writeFileSync } from 'node:fs';
import { basename, dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = resolve(HERE, '..', '..');
const KNOWLEDGE_ROOT = resolve(REPO_ROOT, 'course/knowledge');

export interface StripReport {
	scanned: number;
	modified: number;
	modifiedPaths: string[];
}

export interface StripOptions {
	dryRun?: boolean;
	root?: string;
}

/**
 * Strip top-level `relevance:` from a frontmatter block. Returns null
 * when the block does not contain a `relevance:` key, otherwise returns
 * the rewritten frontmatter.
 *
 * Matches the YAML "block" form: a `relevance:` line at column zero,
 * followed by zero or more continuation lines that are either indented
 * (list items, mapping children) or blank. Stops at the first line
 * that starts at column zero with a non-whitespace, non-`#` character
 * (the next top-level key) or the end of frontmatter.
 */
export function stripRelevanceFromFrontmatter(yaml: string): string | null {
	const lines = yaml.split('\n');
	const out: string[] = [];
	let i = 0;
	let stripped = false;
	while (i < lines.length) {
		const line = lines[i] ?? '';
		const isRelevanceKey = /^relevance\s*:/.test(line);
		if (!isRelevanceKey) {
			out.push(line);
			i += 1;
			continue;
		}
		stripped = true;
		// Skip the relevance: line itself, then skip every following
		// continuation line (indented or blank). Stop at the next
		// top-level key (column-zero non-space, non-`#`) or end.
		i += 1;
		while (i < lines.length) {
			const next = lines[i] ?? '';
			if (next === '') {
				i += 1;
				continue;
			}
			const firstChar = next.charAt(0);
			const isContinuation = firstChar === ' ' || firstChar === '\t' || firstChar === '-';
			if (!isContinuation) break;
			i += 1;
		}
	}
	if (!stripped) return null;
	// Collapse runs of more than one consecutive blank line that resulted
	// from removing the field.
	const collapsed: string[] = [];
	let blankRun = 0;
	for (const l of out) {
		if (l === '') {
			blankRun += 1;
			if (blankRun > 1) continue;
		} else {
			blankRun = 0;
		}
		collapsed.push(l);
	}
	// Trim trailing blank line if we accidentally introduced one.
	while (collapsed.length > 0 && collapsed[collapsed.length - 1] === '') collapsed.pop();
	return collapsed.join('\n');
}

function splitFrontmatter(text: string): { yaml: string; body: string; trailingNewline: boolean } | null {
	if (!text.startsWith('---\n')) return null;
	const end = text.indexOf('\n---', 4);
	if (end === -1) return null;
	const yaml = text.slice(4, end);
	const bodyStart = end + '\n---'.length;
	const after = text.slice(bodyStart);
	const trailingNewline = after.startsWith('\n') || after.startsWith('\r\n');
	const body = trailingNewline ? after.replace(/^\r?\n/, '') : after;
	return { yaml, body, trailingNewline };
}

function walkForNodeMd(root: string): string[] {
	const out: string[] = [];
	let rootStat: ReturnType<typeof statSync> | null = null;
	try {
		rootStat = statSync(root);
	} catch {
		return out;
	}
	if (!rootStat.isDirectory()) return out;
	const stack: string[] = [root];
	while (stack.length > 0) {
		const dir = stack.pop();
		if (!dir) continue;
		let entries: string[];
		try {
			entries = readdirSync(dir);
		} catch {
			continue;
		}
		for (const entry of entries) {
			if (entry.startsWith('.')) continue;
			const full = join(dir, entry);
			let s: ReturnType<typeof statSync> | null;
			try {
				s = statSync(full);
			} catch {
				continue;
			}
			if (!s) continue;
			if (s.isDirectory()) stack.push(full);
			else if (basename(full) === 'node.md') out.push(full);
		}
	}
	return out.sort();
}

export function stripAuthoredRelevance(options: StripOptions = {}): StripReport {
	const root = options.root ?? KNOWLEDGE_ROOT;
	const dryRun = options.dryRun ?? false;
	const files = walkForNodeMd(root);
	const modifiedPaths: string[] = [];
	for (const path of files) {
		const text = readFileSync(path, 'utf8');
		const split = splitFrontmatter(text);
		if (!split) continue;
		const next = stripRelevanceFromFrontmatter(split.yaml);
		if (next === null) continue;
		const rebuilt = `---\n${next}\n---${split.trailingNewline ? '\n' : ''}${split.body}`;
		if (!dryRun) writeFileSync(path, rebuilt);
		modifiedPaths.push(path);
	}
	return { scanned: files.length, modified: modifiedPaths.length, modifiedPaths };
}

async function main(): Promise<void> {
	const args = new Set(process.argv.slice(2));
	const dryRun = args.has('--dry-run');
	const report = stripAuthoredRelevance({ dryRun });
	process.stdout.write(`strip-authored-relevance: scanned ${report.scanned}, modified ${report.modified}\n`);
	for (const path of report.modifiedPaths) {
		const rel = path.startsWith(REPO_ROOT) ? path.slice(REPO_ROOT.length + 1) : path;
		process.stdout.write(`  ${dryRun ? '(dry-run) would rewrite' : 'rewrote'} ${rel}\n`);
	}
	if (report.modified === 0) {
		process.stdout.write('  No files contained authored `relevance:` -- nothing to do.\n');
	}
}

if (import.meta.main) {
	main().catch((err) => {
		process.stderr.write(`strip-authored-relevance: ${(err as Error).stack ?? err}\n`);
		process.exit(1);
	});
}
