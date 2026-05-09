#!/usr/bin/env bun
/**
 * md-format -- markdown formatter CLI.
 *
 * Applies the rules implemented in `format.ts` to a set of `.md` files.
 * Default scope is dirty files (modified/untracked vs HEAD); explicit args
 * override.
 *
 * Usage:
 *   bun tools/md-format/bin.ts                 # dirty files (default)
 *   bun tools/md-format/bin.ts --dir docs/     # all .md under a directory
 *   bun tools/md-format/bin.ts --all           # entire repo
 *   bun tools/md-format/bin.ts --check         # report only, exit 1 on dirty
 *   bun tools/md-format/bin.ts path/to/file.md # explicit files
 */

import { $ } from 'bun';
import { readFile, readdir, stat, writeFile } from 'node:fs/promises';
import { join, relative, resolve } from 'node:path';
import { formatMarkdown } from './format';

const REPO_ROOT = resolve(import.meta.dir, '..', '..');

const SKIP_PREFIXES = ['node_modules/', '.svelte-kit/', 'dist/', 'build/', '.claude/skills/', 'docs/.archive/'];

interface Args {
	check: boolean;
	all: boolean;
	dir: string | null;
	files: string[];
}

function parseArgs(argv: readonly string[]): Args {
	const out: Args = { check: false, all: false, dir: null, files: [] };
	for (let i = 0; i < argv.length; i += 1) {
		const a = argv[i] ?? '';
		if (a === '--check') out.check = true;
		else if (a === '--all') out.all = true;
		else if (a === '--dir') {
			i += 1;
			out.dir = argv[i] ?? null;
		} else if (a.startsWith('--')) {
			throw new Error(`Unknown flag: ${a}`);
		} else {
			out.files.push(a);
		}
	}
	return out;
}

async function* walkMd(dir: string): AsyncGenerator<string> {
	let entries;
	try {
		entries = await readdir(dir, { withFileTypes: true });
	} catch {
		return;
	}
	for (const entry of entries) {
		const full = join(dir, entry.name);
		const rel = relative(REPO_ROOT, full);
		if (SKIP_PREFIXES.some((p) => rel.startsWith(p))) continue;
		if (entry.isDirectory()) {
			yield* walkMd(full);
		} else if (entry.isFile() && entry.name.endsWith('.md')) {
			yield full;
		}
	}
}

async function dirtyMdFiles(): Promise<string[]> {
	// Tracked but modified vs HEAD.
	const tracked = await $`git diff --name-only HEAD`.cwd(REPO_ROOT).text();
	// Untracked (--others --exclude-standard).
	const untracked = await $`git ls-files --others --exclude-standard`.cwd(REPO_ROOT).text();
	const set = new Set<string>();
	for (const raw of [...tracked.split('\n'), ...untracked.split('\n')]) {
		const line = raw.trim();
		if (line === '' || !line.endsWith('.md')) continue;
		if (SKIP_PREFIXES.some((p) => line.startsWith(p))) continue;
		set.add(line);
	}
	const out: string[] = [];
	for (const rel of set) {
		const abs = join(REPO_ROOT, rel);
		try {
			const st = await stat(abs);
			if (st.isFile()) out.push(abs);
		} catch {
			// skipped (deleted file in diff)
		}
	}
	return out;
}

async function collectFiles(args: Args): Promise<string[]> {
	if (args.files.length > 0) {
		return args.files.map((f) => resolve(process.cwd(), f));
	}
	if (args.all) {
		const out: string[] = [];
		for await (const file of walkMd(REPO_ROOT)) out.push(file);
		return out;
	}
	if (args.dir !== null) {
		const out: string[] = [];
		const abs = resolve(process.cwd(), args.dir);
		for await (const file of walkMd(abs)) out.push(file);
		return out;
	}
	return await dirtyMdFiles();
}

async function main(): Promise<number> {
	let args: Args;
	try {
		args = parseArgs(process.argv.slice(2));
	} catch (err) {
		console.error((err as Error).message);
		return 2;
	}
	const files = await collectFiles(args);
	if (files.length === 0) {
		console.log('md-format: no markdown files in scope.');
		return 0;
	}

	let changed = 0;
	const wouldChange: string[] = [];
	for (const file of files) {
		let source: string;
		try {
			source = await readFile(file, 'utf8');
		} catch {
			continue;
		}
		const formatted = formatMarkdown(source);
		if (formatted === source) continue;
		const rel = relative(REPO_ROOT, file);
		if (args.check) {
			wouldChange.push(rel);
		} else {
			await writeFile(file, formatted, 'utf8');
			console.log(`formatted: ${rel}`);
			changed += 1;
		}
	}

	if (args.check) {
		if (wouldChange.length === 0) {
			console.log(`md-format: clean (${files.length} file(s) checked).`);
			return 0;
		}
		console.error(`md-format: ${wouldChange.length} file(s) would be reformatted:`);
		for (const rel of wouldChange) console.error(`  ${rel}`);
		console.error('');
		console.error('Run `bun run track format` to fix.');
		return 1;
	}

	console.log(`md-format: ${changed} file(s) reformatted, ${files.length - changed} clean.`);
	return 0;
}

const exitCode = await main();
process.exit(exitCode);
