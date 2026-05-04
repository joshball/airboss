/**
 * Lesson-tree parser and module-load cache for the Course map projection.
 *
 * Walks `course/regulations/` once at the first request, parses every
 * lesson's frontmatter (title / week / section_order / cites:), and caches
 * the result in process memory. Lesson markdown is part of the deploy, so
 * the cache lives for the lifetime of the server process; restarting picks
 * up new content.
 *
 * Server-only -- this file lives under `apps/study/src/routes/(app)/study/_lib/`
 * which is bundled by SvelteKit only when imported from a `.server.ts`
 * file. Top-level `node:fs` is safe here because the loader is the only
 * caller.
 */

import { readdir, readFile, stat } from 'node:fs/promises';
import { join, relative, resolve } from 'node:path';
import { parse as parseYaml } from 'yaml';

const REPO_ROOT = resolve(import.meta.dirname, '..', '..', '..', '..', '..', '..', '..');
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

export interface LessonCites {
	knowledge_nodes: readonly string[];
	acs_leaves: readonly string[];
	handbook_sections: readonly string[];
}

export interface LessonRecord {
	id: string;
	relativePath: string;
	title: string;
	week: number;
	sectionOrder: string;
	cites: LessonCites;
}

let cache: LessonRecord[] | null = null;
let cachePromise: Promise<LessonRecord[]> | null = null;

/**
 * Returns the parsed lesson list. Idempotent: subsequent calls return
 * the cached array. Empty when the course directory is missing (e.g.
 * during a partial checkout).
 */
export async function listLessonsCached(): Promise<LessonRecord[]> {
	if (cache !== null) return cache;
	if (cachePromise !== null) return cachePromise;
	cachePromise = (async (): Promise<LessonRecord[]> => {
		const lessons = await loadLessons();
		cache = lessons;
		cachePromise = null;
		return lessons;
	})();
	return cachePromise;
}

/** Test-only hook: drop the cache so a fresh walk runs on the next call. */
export function _resetLessonCache(): void {
	cache = null;
	cachePromise = null;
}

async function loadLessons(): Promise<LessonRecord[]> {
	let exists = false;
	try {
		const stats = await stat(COURSE_ROOT);
		exists = stats.isDirectory();
	} catch {
		exists = false;
	}
	if (!exists) return [];
	const files: string[] = [];
	await walk(COURSE_ROOT, files);
	const records: LessonRecord[] = [];
	for (const path of files) {
		const record = await parseLessonFile(path);
		if (record !== null) records.push(record);
	}
	return records;
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

async function parseLessonFile(path: string): Promise<LessonRecord | null> {
	const text = await readFile(path, 'utf-8');
	if (!text.startsWith('---\n')) return null;
	const end = text.indexOf('\n---\n', 4);
	if (end === -1) return null;
	const fm = parseFrontmatterSafe(text.slice(4, end));
	if (fm === null) return null;
	const title = typeof fm.title === 'string' ? fm.title : '';
	const week = typeof fm.week === 'number' ? fm.week : null;
	const sectionOrder =
		typeof fm.section_order === 'string'
			? fm.section_order
			: typeof fm.section_order === 'number'
				? String(fm.section_order).padStart(2, '0')
				: '';
	const cites = readCites(fm.cites);
	const relativePath = relative(COURSE_ROOT, path);
	if (week === null) return null;
	const resolvedWeek = week;
	return {
		id: `course-lesson-${relativePath.replace(/[^A-Za-z0-9]+/g, '-')}`,
		relativePath,
		title,
		week: resolvedWeek,
		sectionOrder,
		cites,
	};
}

function parseFrontmatterSafe(text: string): Record<string, unknown> | null {
	try {
		return (parseYaml(text) ?? {}) as Record<string, unknown>;
	} catch {
		return null;
	}
}

function readCites(value: unknown): LessonCites {
	if (typeof value !== 'object' || value === null) {
		return { knowledge_nodes: [], acs_leaves: [], handbook_sections: [] };
	}
	const c = value as Record<string, unknown>;
	return {
		knowledge_nodes: Array.isArray(c.knowledge_nodes) ? (c.knowledge_nodes as string[]) : [],
		acs_leaves: Array.isArray(c.acs_leaves) ? (c.acs_leaves as string[]) : [],
		handbook_sections: Array.isArray(c.handbook_sections) ? (c.handbook_sections as string[]) : [],
	};
}
