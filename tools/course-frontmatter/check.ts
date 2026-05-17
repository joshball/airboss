#!/usr/bin/env bun

/**
 * `course/regulations/` frontmatter validator.
 *
 * Asserts every lesson in `course/regulations/**\/*.md` carries a
 * well-formed `cites:` block with at least one entry across the three
 * lists. Each `acs_leaves` code is shape-checked against `validateAcsLeafCode`
 * (PA ACS-6C codes); each `knowledge_nodes` slug is shape-checked against
 * the `course/knowledge/` tree on disk; each `handbook_sections` URI is
 * shape-checked as an `airboss-ref:` URI (defers full registry validation
 * to the existing lesson-parser pipeline; this validator's job is the
 * frontmatter contract, not the cross-corpus reference graph).
 *
 * Wired into `bun run check` via the project's check script.
 *
 * Usage:
 *
 *   bun tools/course-frontmatter/check.ts          # exit 0 on clean
 *   bun tools/course-frontmatter/check.ts --json   # machine-readable
 */

import { existsSync } from 'node:fs';
import { readdir, readFile, stat } from 'node:fs/promises';
import { join, relative, resolve } from 'node:path';
import { parse as parseYaml } from 'yaml';
import { validateAcsLeafCode } from './acs-pa-codes';

const REPO_ROOT = resolve(import.meta.dir, '..', '..');
const COURSE_ROOT = join(REPO_ROOT, 'course', 'regulations');
const KNOWLEDGE_ROOT = join(REPO_ROOT, 'course', 'knowledge');

const SKIP_BASENAMES = new Set([
	'overview.md',
	'drills.md',
	'oral.md',
	'README.md',
	'SYLLABUS.md',
	'DESIGN.md',
	'CHANGELOG.md',
]);

interface CheckError {
	path: string;
	message: string;
}

// Subtrees under course/regulations/ that hold artifacts other than lessons.
// `references/` holds the document-family reference pages (page.md per family):
// standalone, citable encyclopedic entries, not lessons, so they carry no
// `cites:` block. They are validated by their own _template.md shape, not here.
const SKIP_DIRS = new Set(['references']);

async function walk(dir: string, files: string[]): Promise<void> {
	const entries = await readdir(dir);
	for (const entry of entries) {
		const full = join(dir, entry);
		const stats = await stat(full);
		if (stats.isDirectory()) {
			if (SKIP_DIRS.has(entry)) continue;
			await walk(full, files);
			continue;
		}
		if (!entry.endsWith('.md')) continue;
		if (SKIP_BASENAMES.has(entry)) continue;
		files.push(full);
	}
}

interface ParsedLesson {
	relativePath: string;
	frontmatter: Record<string, unknown> | null;
	error: string | null;
}

async function parseLesson(path: string): Promise<ParsedLesson> {
	const relativePath = relative(COURSE_ROOT, path);
	const text = await readFile(path, 'utf-8');
	if (!text.startsWith('---\n')) {
		return { relativePath, frontmatter: null, error: 'no frontmatter delimiter' };
	}
	const end = text.indexOf('\n---\n', 4);
	if (end === -1) {
		return { relativePath, frontmatter: null, error: 'unclosed frontmatter delimiter' };
	}
	try {
		const fm = (parseYaml(text.slice(4, end)) ?? {}) as Record<string, unknown>;
		return { relativePath, frontmatter: fm, error: null };
	} catch (err) {
		return { relativePath, frontmatter: null, error: `yaml parse: ${(err as Error).message}` };
	}
}

function isStringArray(value: unknown): value is string[] {
	return Array.isArray(value) && value.every((v) => typeof v === 'string');
}

function checkAirbossRef(uri: string): string | null {
	if (!uri.startsWith('airboss-ref:')) return `not an airboss-ref URI: ${uri}`;
	const rest = uri.slice('airboss-ref:'.length);
	if (rest.length === 0) return 'empty airboss-ref locator';
	if (rest.startsWith('/') || rest.startsWith(':')) return `malformed airboss-ref locator: ${uri}`;
	return null;
}

function checkKnowledgeSlug(slug: string): string | null {
	const parts = slug.split('/');
	if (parts.length !== 2) return `expected '<group>/<slug>': ${slug}`;
	const candidate = join(KNOWLEDGE_ROOT, parts[0] ?? '', parts[1] ?? '', 'node.md');
	if (!existsSync(candidate)) {
		return `knowledge node not found: course/knowledge/${slug}/node.md`;
	}
	return null;
}

function validateLesson(lesson: ParsedLesson): CheckError[] {
	const errors: CheckError[] = [];
	if (lesson.frontmatter === null) {
		return [{ path: lesson.relativePath, message: lesson.error ?? 'unknown parse failure' }];
	}
	const fm = lesson.frontmatter;
	if ('pending_review' in fm) {
		errors.push({
			path: lesson.relativePath,
			message: 'pending_review is not allowed in this WP -- author cites: instead',
		});
	}
	const cites = fm.cites;
	if (typeof cites !== 'object' || cites === null) {
		errors.push({ path: lesson.relativePath, message: 'missing cites: block' });
		return errors;
	}
	const c = cites as Record<string, unknown>;
	const knowledgeNodes = c.knowledge_nodes;
	const acsLeaves = c.acs_leaves;
	const handbookSections = c.handbook_sections;
	if (!isStringArray(knowledgeNodes)) {
		errors.push({ path: lesson.relativePath, message: 'cites.knowledge_nodes must be a string[]' });
	}
	if (!isStringArray(acsLeaves)) {
		errors.push({ path: lesson.relativePath, message: 'cites.acs_leaves must be a string[]' });
	}
	if (!isStringArray(handbookSections)) {
		errors.push({ path: lesson.relativePath, message: 'cites.handbook_sections must be a string[]' });
	}
	const kn = isStringArray(knowledgeNodes) ? knowledgeNodes : [];
	const al = isStringArray(acsLeaves) ? acsLeaves : [];
	const hs = isStringArray(handbookSections) ? handbookSections : [];
	if (kn.length === 0 && al.length === 0 && hs.length === 0) {
		errors.push({ path: lesson.relativePath, message: 'cites: block has no entries across the three lists' });
	}
	for (const slug of kn) {
		const err = checkKnowledgeSlug(slug);
		if (err !== null) errors.push({ path: lesson.relativePath, message: err });
	}
	for (const code of al) {
		const err = validateAcsLeafCode(code);
		if (err !== null) errors.push({ path: lesson.relativePath, message: err });
	}
	for (const uri of hs) {
		const err = checkAirbossRef(uri);
		if (err !== null) errors.push({ path: lesson.relativePath, message: err });
	}
	return errors;
}

async function main(): Promise<void> {
	const args = process.argv.slice(2);
	const json = args.includes('--json');

	const files: string[] = [];
	await walk(COURSE_ROOT, files);

	const errors: CheckError[] = [];
	let lessons = 0;
	for (const path of files) {
		lessons += 1;
		const parsed = await parseLesson(path);
		errors.push(...validateLesson(parsed));
	}

	if (json) {
		console.log(JSON.stringify({ lessons, errors }));
	} else {
		for (const err of errors) {
			console.log(`ERROR  ${err.path}  ${err.message}`);
		}
		console.log('');
		console.log(`course/regulations frontmatter: ${lessons} lessons checked, ${errors.length} error(s).`);
	}
	if (errors.length > 0) process.exit(1);
}

await main();
