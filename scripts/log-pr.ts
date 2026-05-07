#!/usr/bin/env bun

/**
 * Write a single `docs/log/YYYY-MM-DD-PR-NNN-<slug>.md` entry from a merged PR.
 * Phase 5 of `tracking-system-overhaul`.
 *
 * Usage:
 *   bun scripts/log-pr.ts 700                 # writes one entry by PR number
 *   bun scripts/log-pr.ts --backfill          # writes entries for every merged PR (skips existing files)
 *   bun scripts/log-pr.ts --backfill --since 2026-02-07
 *   bun scripts/log-pr.ts --backfill --force  # overwrite existing files
 *
 * Single-PR mode shells out to `gh pr view <n> --json ...`. Backfill mode runs
 * `gh pr list --state merged --search "merged:>YYYY-MM-DD" --limit N`.
 *
 * Each file gets the frontmatter shape called out in the spec:
 *
 *   ---
 *   pr: 639
 *   date: 2026-05-04
 *   title: "..."
 *   wp_id: <slug-or-null>
 *   bugs_fixed: []
 *   summary: |
 *     <one paragraph>
 *   ---
 *
 * `wp_id` is populated when the PR title or body references a known WP slug
 * (one of the directories under `docs/work-packages/`). `bugs_fixed` is
 * populated when a `bug-<slug>` id matches a file in `docs/bugs/`.
 */

import { spawnSync } from 'node:child_process';
import { existsSync, mkdirSync, readdirSync, readFileSync, statSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';

interface RawPr {
	number: number;
	title: string;
	mergedAt: string | null;
	body: string | null;
}

interface LogEntry {
	pr: number;
	date: string;
	title: string;
	wp_id: string | null;
	bugs_fixed: string[];
	summary: string;
}

const LOG_DIR_REL = 'docs/log';
const WP_DIR_REL = 'docs/work-packages';
const BUG_DIR_REL = 'docs/bugs';

function walkUpForAirbossPackageJson(start: string): string | null {
	let dir = start;
	for (let i = 0; i < 16; i += 1) {
		const candidate = join(dir, 'package.json');
		try {
			const json = JSON.parse(readFileSync(candidate, 'utf8')) as { name?: string };
			if (json.name === 'airboss') return dir;
		} catch {
			// continue
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
	throw new Error('log-pr: unable to locate repo root (airboss package.json)');
}

function listKnownWpSlugs(repoRoot: string): Set<string> {
	const root = join(repoRoot, WP_DIR_REL);
	const out = new Set<string>();
	let entries: string[];
	try {
		entries = readdirSync(root);
	} catch {
		return out;
	}
	for (const name of entries) {
		if (name.startsWith('.')) continue;
		const dir = join(root, name);
		try {
			if (statSync(dir).isDirectory()) out.add(name);
		} catch {
			// skip
		}
	}
	return out;
}

function listKnownBugIds(repoRoot: string): Set<string> {
	const root = join(repoRoot, BUG_DIR_REL);
	const out = new Set<string>();
	let entries: string[];
	try {
		entries = readdirSync(root);
	} catch {
		return out;
	}
	for (const name of entries) {
		if (!name.startsWith('bug-')) continue;
		if (!name.endsWith('.md')) continue;
		out.add(name.slice(0, -'.md'.length));
	}
	return out;
}

const SLUG_TRUNCATE = 40;

function slugifyTitle(title: string): string {
	const base = title
		.toLowerCase()
		.replace(/[^a-z0-9]+/g, '-')
		.replace(/^-+|-+$/g, '');
	if (base.length <= SLUG_TRUNCATE) return base;
	return base.slice(0, SLUG_TRUNCATE).replace(/-+$/, '');
}

const KEBAB_RE = /\b([a-z][a-z0-9]+(?:-[a-z0-9]+)+)\b/g;

function detectWpId(text: string, knownWps: ReadonlySet<string>): string | null {
	const matches = text.match(KEBAB_RE);
	if (matches === null) return null;
	for (const m of matches) {
		if (knownWps.has(m)) return m;
	}
	return null;
}

function detectBugIds(text: string, knownBugs: ReadonlySet<string>): string[] {
	const matches = text.match(KEBAB_RE);
	if (matches === null) return [];
	const found = new Set<string>();
	for (const m of matches) {
		if (knownBugs.has(m)) found.add(m);
	}
	return Array.from(found).sort();
}

const SUMMARY_MAX_CHARS = 600;

function deriveSummary(title: string, body: string | null): string {
	if (body !== null && body.trim().length > 0) {
		// Prefer the first paragraph of a `## Summary` section if present, else the
		// first paragraph of the body. Strip markdown bullets and inline links.
		const summaryMatch = body.match(/##\s+Summary\s*\r?\n([\s\S]*?)(?:\r?\n##\s|$)/);
		const candidate = summaryMatch !== null ? (summaryMatch[1] ?? '') : body;
		const firstPara = candidate
			.split(/\r?\n\s*\r?\n/)
			.map((p) => p.trim())
			.find((p) => p.length > 0);
		if (firstPara !== undefined && firstPara.length > 0) {
			const cleaned = firstPara
				.replace(/^[-*]\s+/gm, '')
				.replace(/`([^`]+)`/g, '$1')
				.replace(/\[([^\]]+)\]\([^)]+\)/g, '$1')
				.replace(/\s+/g, ' ')
				.trim();
			if (cleaned.length > SUMMARY_MAX_CHARS) {
				return `${cleaned.slice(0, SUMMARY_MAX_CHARS).replace(/\s+\S*$/, '')}...`;
			}
			return cleaned;
		}
	}
	return title;
}

function entryFromPr(raw: RawPr, knownWps: ReadonlySet<string>, knownBugs: ReadonlySet<string>): LogEntry {
	if (raw.mergedAt === null) {
		throw new Error(`log-pr: PR #${raw.number} has no mergedAt; cannot log`);
	}
	const date = raw.mergedAt.slice(0, 10);
	const haystack = `${raw.title}\n${raw.body ?? ''}`;
	return {
		pr: raw.number,
		date,
		title: raw.title,
		wp_id: detectWpId(haystack, knownWps),
		bugs_fixed: detectBugIds(haystack, knownBugs),
		summary: deriveSummary(raw.title, raw.body),
	};
}

function renderEntry(entry: LogEntry): string {
	// We hand-render so the `summary` field uses block-scalar style (`|`) and
	// the rest are simple scalars / arrays. yaml.stringify defaults are not
	// quite right for this layout.
	const titleEsc = entry.title.replace(/"/g, '\\"');
	const wp = entry.wp_id === null ? 'null' : entry.wp_id;
	const bugsRendered =
		entry.bugs_fixed.length === 0 ? '[]' : `[${entry.bugs_fixed.map((b) => JSON.stringify(b)).join(', ')}]`;
	// Indent every summary line by two spaces under `summary: |`.
	const summaryIndented = entry.summary
		.split(/\r?\n/)
		.map((line) => `  ${line}`)
		.join('\n');
	return `---
pr: ${entry.pr}
date: ${entry.date}
title: "${titleEsc}"
wp_id: ${wp}
bugs_fixed: ${bugsRendered}
summary: |
${summaryIndented}
---
`;
}

function entryFilename(entry: LogEntry): string {
	const slug = slugifyTitle(entry.title);
	return `${entry.date}-PR-${entry.pr}-${slug}.md`;
}

function writeEntry(repoRoot: string, entry: LogEntry, force: boolean): { path: string; written: boolean } {
	const dir = join(repoRoot, LOG_DIR_REL);
	mkdirSync(dir, { recursive: true });
	const filename = entryFilename(entry);
	const target = join(dir, filename);
	if (existsSync(target) && !force) {
		return { path: target, written: false };
	}
	writeFileSync(target, renderEntry(entry));
	return { path: target, written: true };
}

function fetchPr(prNumber: number): RawPr {
	const result = spawnSync('gh', ['pr', 'view', String(prNumber), '--json', 'number,title,mergedAt,body'], {
		encoding: 'utf8',
	});
	if (result.status !== 0) {
		throw new Error(`gh pr view ${prNumber} failed: ${result.stderr.trim()}`);
	}
	const parsed = JSON.parse(result.stdout) as RawPr;
	return parsed;
}

function fetchPrList(since: string, limit: number): RawPr[] {
	const result = spawnSync(
		'gh',
		[
			'pr',
			'list',
			'--state',
			'merged',
			'--limit',
			String(limit),
			'--json',
			'number,title,mergedAt,body',
			'--search',
			`merged:>${since}`,
		],
		{ encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 },
	);
	if (result.status !== 0) {
		throw new Error(`gh pr list failed: ${result.stderr.trim()}`);
	}
	const parsed = JSON.parse(result.stdout) as RawPr[];
	return parsed;
}

interface CliFlags {
	mode: 'single' | 'backfill';
	prNumber: number | null;
	since: string;
	limit: number;
	force: boolean;
}

function defaultSince(): string {
	const today = new Date();
	const cutoff = new Date(today.getTime());
	cutoff.setUTCDate(cutoff.getUTCDate() - 90);
	return cutoff.toISOString().slice(0, 10);
}

function parseArgs(argv: readonly string[]): CliFlags {
	const flags: CliFlags = { mode: 'single', prNumber: null, since: defaultSince(), limit: 1000, force: false };
	let positional: string | null = null;
	for (let i = 0; i < argv.length; i += 1) {
		const arg = argv[i];
		if (arg === undefined) continue;
		if (arg === '--backfill') {
			flags.mode = 'backfill';
			continue;
		}
		if (arg === '--force') {
			flags.force = true;
			continue;
		}
		if (arg === '--since') {
			const value = argv[++i];
			if (value === undefined) {
				console.error('log-pr: --since requires a YYYY-MM-DD value');
				process.exit(1);
			}
			flags.since = value;
			continue;
		}
		if (arg === '--limit') {
			const value = argv[++i];
			if (value === undefined || !/^\d+$/.test(value)) {
				console.error('log-pr: --limit requires a positive integer');
				process.exit(1);
			}
			flags.limit = Number.parseInt(value, 10);
			continue;
		}
		if (arg === '--help' || arg === '-h') {
			printHelp();
			process.exit(0);
		}
		if (arg.startsWith('--')) {
			console.error(`log-pr: unknown flag "${arg}"`);
			process.exit(1);
		}
		if (positional !== null) {
			console.error(`log-pr: only one PR number allowed (got "${positional}" and "${arg}")`);
			process.exit(1);
		}
		positional = arg;
	}
	if (flags.mode === 'single') {
		if (positional === null) {
			console.error('log-pr: missing required <pr-number> (or pass --backfill)');
			printHelp();
			process.exit(1);
		}
		if (!/^\d+$/.test(positional)) {
			console.error(`log-pr: PR number must be a positive integer, got "${positional}"`);
			process.exit(1);
		}
		flags.prNumber = Number.parseInt(positional, 10);
	}
	return flags;
}

function printHelp(): void {
	console.log('Usage: bun scripts/log-pr.ts <pr-number>');
	console.log('       bun scripts/log-pr.ts --backfill [--since YYYY-MM-DD] [--limit N] [--force]');
	console.log('');
	console.log('Writes a frontmatter-only entry under docs/log/.');
}

function runSingle(repoRoot: string, prNumber: number, force: boolean): number {
	const knownWps = listKnownWpSlugs(repoRoot);
	const knownBugs = listKnownBugIds(repoRoot);
	const raw = fetchPr(prNumber);
	const entry = entryFromPr(raw, knownWps, knownBugs);
	const { path, written } = writeEntry(repoRoot, entry, force);
	if (written) {
		console.log(`log-pr: wrote ${path}`);
		return 0;
	}
	console.log(`log-pr: ${path} already exists (pass --force to overwrite)`);
	return 0;
}

function runBackfill(repoRoot: string, since: string, limit: number, force: boolean): number {
	const knownWps = listKnownWpSlugs(repoRoot);
	const knownBugs = listKnownBugIds(repoRoot);
	const raws = fetchPrList(since, limit);
	let written = 0;
	let skipped = 0;
	const errors: string[] = [];
	for (const raw of raws) {
		try {
			const entry = entryFromPr(raw, knownWps, knownBugs);
			const result = writeEntry(repoRoot, entry, force);
			if (result.written) written += 1;
			else skipped += 1;
		} catch (err) {
			const message = err instanceof Error ? err.message : String(err);
			errors.push(`#${raw.number}: ${message}`);
		}
	}
	console.log(`log-pr: backfill complete -- ${written} written, ${skipped} skipped, ${errors.length} errors`);
	for (const e of errors) console.error(`  ${e}`);
	return errors.length === 0 ? 0 : 1;
}

if (import.meta.main) {
	const flags = parseArgs(process.argv.slice(2));
	const repoRoot = resolveRepoRoot();
	if (flags.mode === 'single') {
		if (flags.prNumber === null) {
			console.error('log-pr: missing PR number');
			process.exit(1);
		}
		process.exit(runSingle(repoRoot, flags.prNumber, flags.force));
	}
	process.exit(runBackfill(repoRoot, flags.since, flags.limit, flags.force));
}

export type { LogEntry, RawPr };
// Exports for tests / future tooling.
export { deriveSummary, detectBugIds, detectWpId, entryFilename, entryFromPr, renderEntry, slugifyTitle };
