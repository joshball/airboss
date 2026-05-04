#!/usr/bin/env bun
/**
 * `course/regulations/` frontmatter backfill -- one-shot script.
 *
 * Walks `course/regulations/**\/*.md`, drops the legacy
 * `covers_regulations:` and `ties_to_knowledge_nodes:` lists, and writes
 * the WP-spec `cites:` block sourced from `lesson-cites.ts`. The script
 * is idempotent: re-running over a backfilled lesson re-writes the same
 * `cites:` block.
 *
 * Skipped: `overview.md`, `drills.md`, `oral.md`, `README.md`,
 * `SYLLABUS.md`, `DESIGN.md`, `CHANGELOG.md`. The Course projection
 * walks lesson files only -- index/discussion files don't roll up into
 * the cert mastery view.
 *
 * Usage:
 *
 *   bun tools/course-frontmatter/backfill.ts --dry-run   # report only
 *   bun tools/course-frontmatter/backfill.ts             # write changes
 */

import { readdir, readFile, stat, writeFile } from 'node:fs/promises';
import { join, relative, resolve } from 'node:path';
import { parse as parseYaml, stringify as stringifyYaml } from 'yaml';
import { LESSON_CITES, type LessonCites } from './lesson-cites';

const REPO_ROOT = resolve(import.meta.dir, '..', '..');
const COURSE_ROOT = join(REPO_ROOT, 'course', 'regulations');
const SKIP_BASENAMES = new Set([
	'overview.md',
	'drills.md',
	'oral.md',
	'README.md',
	'SYLLABUS.md',
	'DESIGN.md',
	'CHANGELOG.md',
]);

interface FrontmatterSplit {
	frontmatter: string;
	body: string;
}

interface RewriteResult {
	path: string;
	relativePath: string;
	changed: boolean;
	skipped: boolean;
	error?: string;
}

async function walk(dir: string, files: string[]): Promise<void> {
	const entries = await readdir(dir);
	for (const entry of entries) {
		const full = join(dir, entry);
		const stats = await stat(full);
		if (stats.isDirectory()) {
			await walk(full, files);
			continue;
		}
		if (!entry.endsWith('.md')) continue;
		if (SKIP_BASENAMES.has(entry)) continue;
		files.push(full);
	}
}

function splitFrontmatter(text: string): FrontmatterSplit | null {
	if (!text.startsWith('---\n')) return null;
	const end = text.indexOf('\n---\n', 4);
	if (end === -1) return null;
	return {
		frontmatter: text.slice(4, end),
		body: text.slice(end + 5),
	};
}

function applyCites(frontmatter: Record<string, unknown>, cites: LessonCites): void {
	frontmatter.cites = {
		knowledge_nodes: [...cites.knowledge_nodes],
		acs_leaves: [...cites.acs_leaves],
		handbook_sections: [...cites.handbook_sections],
	};
	// Drop legacy fields so the new `cites` block is the single source.
	delete frontmatter.covers_regulations;
	delete frontmatter.ties_to_knowledge_nodes;
	delete frontmatter.pulls_from_regulations;
}

function renderFrontmatter(frontmatter: Record<string, unknown>): string {
	const yaml = stringifyYaml(frontmatter, { lineWidth: 0, defaultStringType: 'PLAIN' });
	return `---\n${yaml}---\n`;
}

async function rewriteLesson(path: string, dryRun: boolean): Promise<RewriteResult> {
	const relativePath = relative(COURSE_ROOT, path);
	const cites = LESSON_CITES[relativePath];
	if (cites === undefined) {
		return { path, relativePath, changed: false, skipped: true, error: 'no authored cites' };
	}
	const text = await readFile(path, 'utf-8');
	const split = splitFrontmatter(text);
	if (split === null) {
		return { path, relativePath, changed: false, skipped: true, error: 'no frontmatter' };
	}
	let parsed: Record<string, unknown>;
	try {
		parsed = (parseYaml(split.frontmatter) ?? {}) as Record<string, unknown>;
	} catch (err) {
		return { path, relativePath, changed: false, skipped: true, error: `yaml parse: ${(err as Error).message}` };
	}

	applyCites(parsed, cites);
	const newFrontmatter = renderFrontmatter(parsed);
	const newText = `${newFrontmatter}${split.body}`;
	if (newText === text) {
		return { path, relativePath, changed: false, skipped: false };
	}
	if (!dryRun) {
		await writeFile(path, newText, 'utf-8');
	}
	return { path, relativePath, changed: true, skipped: false };
}

async function main(): Promise<void> {
	const args = process.argv.slice(2);
	const dryRun = args.includes('--dry-run') || args.includes('-n');

	const files: string[] = [];
	await walk(COURSE_ROOT, files);

	const results: RewriteResult[] = [];
	for (const path of files) {
		const result = await rewriteLesson(path, dryRun);
		results.push(result);
	}

	let changed = 0;
	let skipped = 0;
	let unchanged = 0;
	for (const r of results) {
		if (r.skipped) {
			skipped += 1;
			console.log(`SKIP   ${r.relativePath}  (${r.error ?? 'unknown'})`);
		} else if (r.changed) {
			changed += 1;
			console.log(`${dryRun ? 'WOULD' : 'WRITE'}  ${r.relativePath}`);
		} else {
			unchanged += 1;
		}
	}

	console.log('');
	console.log(`Summary: ${changed} changed, ${unchanged} unchanged, ${skipped} skipped of ${results.length} lessons.`);
	if (skipped > 0) {
		console.log('');
		console.log('Lessons without authored cites are listed in tools/course-frontmatter/lesson-cites.ts.');
		console.log('Add an entry there before re-running.');
	}
}

await main();
