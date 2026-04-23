#!/usr/bin/env bun
/**
 * theme-lint -- CLI entry.
 *
 * Scans `apps/**\/*.svelte`, `apps/**\/*.css`, `libs/ui/**\/*.svelte`,
 * and `libs/ui/**\/*.css` for hardcoded visual values and reports
 * violations. Excludes `libs/themes/**` (tokens defined there) and
 * generated output.
 *
 * Ignore file: `tools/theme-lint/ignore.txt`. Each non-blank, non-comment
 * line is `<relative-path>:<line>:<rule>` and suppresses a single known
 * violation. This is the grandfather list -- it shrinks as migrations
 * land (packages #5 / #7).
 *
 * Usage:
 *   bun tools/theme-lint/bin.ts              # lint current tree
 *   bun tools/theme-lint/bin.ts --fix-ignore # rewrite ignore.txt
 *   bun tools/theme-lint/bin.ts apps/study   # lint one tree
 *   bun tools/theme-lint/bin.ts --json       # machine-readable output
 */

import { readFile, readdir, stat, writeFile } from 'node:fs/promises';
import { join, relative, resolve } from 'node:path';
import { buildKnownTokens, extractStyleBlocks, type LintViolation, scanCssSource } from './rules';

const REPO_ROOT = resolve(import.meta.dir, '..', '..');
const IGNORE_PATH = join(REPO_ROOT, 'tools', 'theme-lint', 'ignore.txt');

const DEFAULT_ROOTS = ['apps', 'libs/ui'];
const EXCLUDE_PATHS = [
	'node_modules',
	'.svelte-kit',
	'dist',
	'build',
	'libs/themes',
	'tools/theme-lint/__tests__',
	'tools/theme-codemod/__tests__',
];

async function* walk(dir: string): AsyncGenerator<string> {
	let entries;
	try {
		entries = await readdir(dir, { withFileTypes: true });
	} catch {
		return;
	}
	for (const entry of entries) {
		const full = join(dir, entry.name);
		const rel = relative(REPO_ROOT, full);
		if (EXCLUDE_PATHS.some((ex) => rel.startsWith(ex))) continue;
		if (entry.isDirectory()) {
			yield* walk(full);
		} else if (entry.name.endsWith('.svelte') || entry.name.endsWith('.css')) {
			yield full;
		}
	}
}

interface IgnoreEntry {
	file: string;
	line: number;
	rule: string;
}

async function loadIgnoreFile(): Promise<IgnoreEntry[]> {
	try {
		const text = await readFile(IGNORE_PATH, 'utf8');
		const out: IgnoreEntry[] = [];
		for (const raw of text.split('\n')) {
			const line = raw.trim();
			if (!line || line.startsWith('#')) continue;
			const parts = line.split(':');
			if (parts.length < 3) continue;
			const [file, lineStr, rule] = [parts[0], parts[1], parts.slice(2).join(':')];
			if (!file || !lineStr || !rule) continue;
			const parsedLine = Number.parseInt(lineStr, 10);
			if (!Number.isFinite(parsedLine)) continue;
			out.push({ file, line: parsedLine, rule });
		}
		return out;
	} catch {
		return [];
	}
}

function violationKey(v: LintViolation): string {
	return `${v.file}:${v.line}:${v.rule}`;
}

function ignoreKey(e: IgnoreEntry): string {
	return `${e.file}:${e.line}:${e.rule}`;
}

export interface LintResult {
	violations: LintViolation[];
	filtered: LintViolation[];
	unusedIgnores: IgnoreEntry[];
}

export async function lintFile(path: string, repoRoot: string, knownTokens: Set<string>): Promise<LintViolation[]> {
	const rel = relative(repoRoot, path);
	const source = await readFile(path, 'utf8');
	const violations: LintViolation[] = [];
	if (path.endsWith('.svelte')) {
		const blocks = extractStyleBlocks(source);
		for (const block of blocks) {
			violations.push(
				...scanCssSource({ file: rel, source: block.body, startLine: block.startLine, knownTokens }),
			);
		}
	} else {
		violations.push(...scanCssSource({ file: rel, source, knownTokens }));
	}
	return violations;
}

export async function lintRoots(roots: string[], repoRoot: string): Promise<LintViolation[]> {
	const knownTokens = buildKnownTokens();
	const all: LintViolation[] = [];
	for (const root of roots) {
		const abs = resolve(repoRoot, root);
		try {
			const st = await stat(abs);
			if (!st.isDirectory()) continue;
		} catch {
			continue;
		}
		for await (const file of walk(abs)) {
			all.push(...(await lintFile(file, repoRoot, knownTokens)));
		}
	}
	return all;
}

function filterByIgnore(violations: LintViolation[], ignore: IgnoreEntry[]): LintResult {
	const ignoreSet = new Set(ignore.map(ignoreKey));
	const usedIgnores = new Set<string>();
	const filtered: LintViolation[] = [];
	for (const v of violations) {
		const key = violationKey(v);
		if (ignoreSet.has(key)) {
			usedIgnores.add(key);
			continue;
		}
		filtered.push(v);
	}
	const unusedIgnores = ignore.filter((e) => !usedIgnores.has(ignoreKey(e)));
	return { violations, filtered, unusedIgnores };
}

function printHuman(result: LintResult): void {
	if (result.filtered.length === 0) {
		console.log(`theme-lint: clean (${result.violations.length} total matches, all suppressed by ignore file)`);
		if (result.unusedIgnores.length > 0) {
			console.warn(`theme-lint: ${result.unusedIgnores.length} ignore entries are no longer needed:`);
			for (const e of result.unusedIgnores) console.warn(`  ${ignoreKey(e)}`);
		}
		return;
	}
	const byFile = new Map<string, LintViolation[]>();
	for (const v of result.filtered) {
		const list = byFile.get(v.file) ?? [];
		list.push(v);
		byFile.set(v.file, list);
	}
	for (const [file, list] of byFile) {
		console.log(`\n${file}`);
		for (const v of list.sort((a, b) => a.line - b.line)) {
			console.log(`  ${v.line}:${v.column}  [${v.rule}]  ${v.message}`);
		}
	}
	console.log(`\ntheme-lint: ${result.filtered.length} violation(s)`);
	if (result.unusedIgnores.length > 0) {
		console.warn(`theme-lint: ${result.unusedIgnores.length} stale ignore entries (delete them):`);
		for (const e of result.unusedIgnores) console.warn(`  ${ignoreKey(e)}`);
	}
}

async function writeIgnoreFile(violations: LintViolation[]): Promise<void> {
	const keys = [...new Set(violations.map(violationKey))].sort();
	const header = [
		'# Theme-lint grandfather list.',
		'# Each line: <file>:<line>:<rule>. Populated by `bun tools/theme-lint/bin.ts --fix-ignore`.',
		'# Entries drop out as packages #5 and #7 migrate call sites.',
		'',
	].join('\n');
	await writeFile(IGNORE_PATH, `${header}${keys.join('\n')}\n`, 'utf8');
	console.log(`theme-lint: wrote ${keys.length} entries to ${relative(REPO_ROOT, IGNORE_PATH)}`);
}

async function main(argv: string[]): Promise<number> {
	const fixIgnore = argv.includes('--fix-ignore');
	const jsonOut = argv.includes('--json');
	const positional = argv.filter((a) => !a.startsWith('--'));
	const roots = positional.length > 0 ? positional : DEFAULT_ROOTS;
	const violations = await lintRoots(roots, REPO_ROOT);
	if (fixIgnore) {
		await writeIgnoreFile(violations);
		return 0;
	}
	const ignore = await loadIgnoreFile();
	const result = filterByIgnore(violations, ignore);
	if (jsonOut) {
		console.log(JSON.stringify(result, null, 2));
	} else {
		printHuman(result);
	}
	return result.filtered.length === 0 ? 0 : 1;
}

const exitCode = await main(process.argv.slice(2));
process.exit(exitCode);
