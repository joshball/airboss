#!/usr/bin/env bun

/**
 * Rolling archive for session-scoped doc directories. ADR 025 Phase 7b.
 *
 * Archives files under `docs/work/{handoffs,walkthroughs,reviews,build-reports}/`
 * older than N days (default 60) into `docs/.archive/<dir>/<year>/<filename>`.
 * Uses `git log -1` last-commit date for age determination so fresh clones
 * with reset mtimes do not nuke the archive window.
 *
 * Default mode is `--dry-run` (print plan). Only `--apply` actually moves.
 *
 *   bun scripts/tracking/archive.ts                    # dry run, 60-day default
 *   bun scripts/tracking/archive.ts --apply            # execute the moves
 *   bun scripts/tracking/archive.ts --apply --days 90  # custom threshold
 *
 * Uses `git mv` so blame survives. Skips dot-prefixed entries (sentinel
 * files, indexes), `_template.md`, and `INDEX.md` -- those are live navigation
 * scaffolding, not session-scoped.
 */

import { spawnSync } from 'node:child_process';
import { existsSync, mkdirSync, readdirSync, statSync } from 'node:fs';
import { dirname, join, relative, resolve } from 'node:path';

const ROLLING_DIRS = ['handoffs', 'walkthroughs', 'reviews', 'build-reports'] as const;
const DEFAULT_DAYS = 60;
const KEEP_FILENAMES = new Set(['_template.md', 'INDEX.md', 'README.md']);

interface ArchiveCandidate {
	src: string;
	dest: string;
	ageDays: number;
	lastCommitDate: string;
}

interface RunOptions {
	apply: boolean;
	days: number;
}

function repoRoot(): string {
	const result = spawnSync('git', ['rev-parse', '--show-toplevel'], { encoding: 'utf8' });
	const root = result.stdout.trim();
	if (root.length === 0) {
		console.error('archive: cannot resolve repo root via `git rev-parse --show-toplevel`');
		process.exit(1);
	}
	return root;
}

function lastCommitDate(root: string, absPath: string): string | null {
	const rel = relative(root, absPath);
	const result = spawnSync('git', ['log', '-1', '--format=%ad', '--date=short', '--', rel], {
		cwd: root,
		encoding: 'utf8',
	});
	const out = result.stdout.trim();
	if (out.length === 0) return null;
	return out;
}

function daysBetween(isoDate: string, now: Date): number {
	const then = new Date(`${isoDate}T00:00:00Z`).getTime();
	const ms = now.getTime() - then;
	return Math.floor(ms / (1000 * 60 * 60 * 24));
}

function yearOf(isoDate: string): string {
	return isoDate.slice(0, 4);
}

function listMarkdownFiles(dir: string): string[] {
	if (!existsSync(dir)) return [];
	const out: string[] = [];
	for (const name of readdirSync(dir).sort()) {
		if (name.startsWith('.')) continue;
		if (KEEP_FILENAMES.has(name)) continue;
		const full = join(dir, name);
		const stat = statSync(full);
		if (stat.isDirectory()) {
			// One level deep only -- nested dirs are intentional groupings.
			for (const inner of readdirSync(full).sort()) {
				if (inner.startsWith('.')) continue;
				if (KEEP_FILENAMES.has(inner)) continue;
				const innerPath = join(full, inner);
				const innerStat = statSync(innerPath);
				if (innerStat.isFile() && inner.endsWith('.md')) out.push(innerPath);
			}
			continue;
		}
		if (stat.isFile() && name.endsWith('.md')) out.push(full);
	}
	return out;
}

export function planArchive(root: string, days: number, now: Date = new Date()): ArchiveCandidate[] {
	const candidates: ArchiveCandidate[] = [];
	for (const subdir of ROLLING_DIRS) {
		const srcDir = join(root, 'docs/work', subdir);
		if (!existsSync(srcDir)) continue;
		const files = listMarkdownFiles(srcDir);
		for (const file of files) {
			const lcd = lastCommitDate(root, file);
			if (lcd === null) continue;
			const age = daysBetween(lcd, now);
			if (age <= days) continue;
			const archiveBase = join(root, 'docs/.archive', subdir, yearOf(lcd));
			const filename = relative(srcDir, file);
			const dest = join(archiveBase, filename);
			candidates.push({ src: file, dest, ageDays: age, lastCommitDate: lcd });
		}
	}
	return candidates;
}

function applyMove(src: string, dest: string): void {
	mkdirSync(dirname(dest), { recursive: true });
	const result = spawnSync('git', ['mv', src, dest], { cwd: repoRoot(), encoding: 'utf8' });
	if (result.status !== 0) {
		console.error(`archive: failed to move ${src} -> ${dest}`);
		console.error(result.stderr);
		process.exit(1);
	}
}

function parseArgs(argv: readonly string[]): RunOptions {
	let apply = false;
	let days = DEFAULT_DAYS;
	for (let i = 0; i < argv.length; i += 1) {
		const arg = argv[i];
		if (arg === '--apply') {
			apply = true;
			continue;
		}
		if (arg === '--dry-run') {
			apply = false;
			continue;
		}
		if (arg === '--days') {
			const next = argv[++i];
			if (next === undefined) {
				console.error('archive: --days requires a value');
				process.exit(1);
			}
			const parsed = Number.parseInt(next, 10);
			if (!Number.isFinite(parsed) || parsed < 1) {
				console.error(`archive: --days must be a positive integer; got "${next}"`);
				process.exit(1);
			}
			days = parsed;
			continue;
		}
		console.error(`archive: unknown flag "${arg}"`);
		console.error('Usage: bun scripts/tracking/archive.ts [--dry-run|--apply] [--days N]');
		process.exit(1);
	}
	return { apply, days };
}

function main(): number {
	const opts = parseArgs(process.argv.slice(2));
	const root = repoRoot();
	const candidates = planArchive(root, opts.days);

	if (candidates.length === 0) {
		console.log(`archive: nothing older than ${opts.days} days in docs/work/{${ROLLING_DIRS.join(',')}}/`);
		return 0;
	}

	const mode = opts.apply ? 'APPLY' : 'DRY RUN';
	console.log(`archive: ${mode} -- ${candidates.length} file(s) older than ${opts.days} days`);
	console.log('');
	for (const c of candidates) {
		const srcRel = relative(root, c.src);
		const destRel = relative(root, c.dest);
		console.log(`  [${c.ageDays}d ${c.lastCommitDate}] ${srcRel}`);
		console.log(`    -> ${destRel}`);
		if (opts.apply) applyMove(c.src, c.dest);
	}
	console.log('');
	if (!opts.apply) {
		console.log('archive: re-run with --apply to execute. (No files moved.)');
	} else {
		console.log(`archive: moved ${candidates.length} file(s). Stage with git status; commit + PR.`);
	}
	return 0;
}

if (import.meta.url === resolve(process.argv[1] ?? '').replace(/^/, 'file://')) {
	process.exit(main());
}

// Bun runs `import.meta.url === ...` test as false in some entrypoint shapes.
// Fall through and run if invoked directly.
if (process.argv[1]?.endsWith('archive.ts')) {
	process.exit(main());
}
