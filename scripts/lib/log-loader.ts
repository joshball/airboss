/**
 * Read-only loader for the per-PR log entries under `docs/log/`. Phase 5 of
 * `tracking-system-overhaul`. Each entry carries frontmatter only:
 *
 *   ---
 *   pr: 700
 *   date: 2026-05-07
 *   title: "..."
 *   wp_id: <slug-or-null>
 *   bugs_fixed: []
 *   summary: |
 *     ...
 *   ---
 *
 * Lives next to `wp-loader.ts` because both consume `docs/` from `node:fs`
 * and are NOT browser-bundled.
 */

import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { parse as parseYaml } from 'yaml';

const LOG_DIR_REL = 'docs/log';

export interface LogEntry {
	/** PR number from `pr:`. */
	pr: number;
	/** ISO date `YYYY-MM-DD` from `date:`. */
	date: string;
	/** PR title from `title:`. */
	title: string;
	/** WP slug if cross-referenced, else null. */
	wp_id: string | null;
	/** Bug ids referenced by this PR, possibly empty. */
	bugs_fixed: string[];
	/** Free-form summary paragraph. */
	summary: string;
	/** Absolute file path on disk. */
	logPath: string;
}

interface RawLogFrontmatter {
	pr?: unknown;
	date?: unknown;
	title?: unknown;
	wp_id?: unknown;
	bugs_fixed?: unknown;
	summary?: unknown;
}

const FRONTMATTER_FENCE = /^---\r?\n([\s\S]*?)\r?\n---\r?\n?/;

function parseLogFile(absPath: string): LogEntry | null {
	let source: string;
	try {
		source = readFileSync(absPath, 'utf8');
	} catch {
		return null;
	}
	const match = source.match(FRONTMATTER_FENCE);
	if (match === null) return null;
	const yaml = match[1] ?? '';
	let raw: unknown;
	try {
		raw = parseYaml(yaml);
	} catch {
		return null;
	}
	if (raw === null || typeof raw !== 'object' || Array.isArray(raw)) return null;
	const fm = raw as RawLogFrontmatter;
	const pr = typeof fm.pr === 'number' ? fm.pr : null;
	const date = typeof fm.date === 'string' ? fm.date : null;
	const title = typeof fm.title === 'string' ? fm.title : null;
	if (pr === null || date === null || title === null) return null;
	const wp_id = typeof fm.wp_id === 'string' && fm.wp_id.length > 0 ? fm.wp_id : null;
	const bugs_fixed: string[] = Array.isArray(fm.bugs_fixed)
		? fm.bugs_fixed.filter((b): b is string => typeof b === 'string')
		: [];
	const summary = typeof fm.summary === 'string' ? fm.summary.trim() : '';
	return { pr, date, title, wp_id, bugs_fixed, summary, logPath: absPath };
}

/** Read every `docs/log/*.md` and parse the frontmatter. Files that fail to
 * parse are silently skipped (log entries are append-only and best-effort).
 *
 * Sorted reverse-chrono by date, ties broken by descending PR number. */
export function loadAllLogEntries(repoRoot: string): LogEntry[] {
	const dir = join(repoRoot, LOG_DIR_REL);
	let entries: string[];
	try {
		entries = readdirSync(dir);
	} catch {
		return [];
	}
	const out: LogEntry[] = [];
	for (const name of entries) {
		if (!name.endsWith('.md')) continue;
		const abs = join(dir, name);
		try {
			if (!statSync(abs).isFile()) continue;
		} catch {
			continue;
		}
		const parsed = parseLogFile(abs);
		if (parsed !== null) out.push(parsed);
	}
	out.sort((a, b) => {
		if (a.date > b.date) return -1;
		if (a.date < b.date) return 1;
		if (a.pr > b.pr) return -1;
		if (a.pr < b.pr) return 1;
		return 0;
	});
	return out;
}
