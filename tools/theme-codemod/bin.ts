#!/usr/bin/env bun
/**
 * theme-codemod -- CLI entry.
 *
 * Usage:
 *   bun tools/theme-codemod/bin.ts apps/study/src             # write
 *   bun tools/theme-codemod/bin.ts --dry-run apps/study/src   # preview
 *
 * Runs every transform in `transforms.ts` over each Svelte `<style>`
 * block and `.css` file under the given globs. Prints a per-file
 * summary of what changed. `--dry-run` writes nothing.
 */

import { readFile, readdir, stat, writeFile } from 'node:fs/promises';
import { join, relative, resolve } from 'node:path';
import { type CodemodChange, runAllTransforms } from './transforms';

const REPO_ROOT = resolve(import.meta.dir, '..', '..');

async function* walk(dir: string): AsyncGenerator<string> {
	let entries;
	try {
		entries = await readdir(dir, { withFileTypes: true });
	} catch {
		return;
	}
	for (const entry of entries) {
		const full = join(dir, entry.name);
		if (entry.isDirectory()) {
			if (entry.name === 'node_modules' || entry.name === '.svelte-kit' || entry.name === 'dist') continue;
			yield* walk(full);
		} else if (entry.name.endsWith('.svelte') || entry.name.endsWith('.css')) {
			yield full;
		}
	}
}

interface FileReport {
	file: string;
	changes: CodemodChange[];
	updatedSource: string;
	originalSource: string;
}

export async function processFile(path: string): Promise<FileReport> {
	const original = await readFile(path, 'utf8');
	let updated = original;
	const changes: CodemodChange[] = [];
	if (path.endsWith('.svelte')) {
		// Run transforms per-style block (preserve surrounding Svelte markup).
		const re = /(<style(?:\s[^>]*)?>)([\s\S]*?)(<\/style>)/g;
		updated = original.replace(re, (_match, open: string, body: string, close: string) => {
			const r = runAllTransforms(body);
			changes.push(...r.changes);
			return `${open}${r.source}${close}`;
		});
	} else {
		const r = runAllTransforms(original);
		updated = r.source;
		changes.push(...r.changes);
	}
	return { file: path, changes, updatedSource: updated, originalSource: original };
}

export async function processRoots(roots: string[], repoRoot: string): Promise<FileReport[]> {
	const reports: FileReport[] = [];
	for (const root of roots) {
		const abs = resolve(repoRoot, root);
		try {
			const st = await stat(abs);
			if (st.isFile()) {
				reports.push(await processFile(abs));
				continue;
			}
		} catch {
			continue;
		}
		for await (const file of walk(abs)) {
			reports.push(await processFile(file));
		}
	}
	return reports;
}

function summarize(reports: FileReport[]): void {
	const counts = new Map<string, number>();
	let touched = 0;
	for (const r of reports) {
		if (r.changes.length === 0) continue;
		touched++;
		for (const c of r.changes) {
			counts.set(c.rule, (counts.get(c.rule) ?? 0) + 1);
		}
	}
	console.log(`\ntheme-codemod: ${touched} file(s) changed, ${reports.length} scanned`);
	for (const [rule, n] of [...counts.entries()].sort()) {
		console.log(`  ${rule}: ${n}`);
	}
}

async function main(argv: string[]): Promise<number> {
	const dryRun = argv.includes('--dry-run');
	const skipIgnoreRefresh = argv.includes('--skip-ignore-refresh');
	const positional = argv.filter((a) => !a.startsWith('--'));
	if (positional.length === 0) {
		console.error('usage: bun tools/theme-codemod/bin.ts [--dry-run] [--skip-ignore-refresh] <path> [path...]');
		return 2;
	}
	const reports = await processRoots(positional, REPO_ROOT);
	let wrote = 0;
	for (const r of reports) {
		if (r.changes.length === 0) continue;
		const rel = relative(REPO_ROOT, r.file);
		if (dryRun) {
			console.log(`\n${rel} (${r.changes.length} change(s))`);
			for (const c of r.changes.slice(0, 10)) {
				console.log(`  ${c.line} [${c.rule}] ${c.before.trim().slice(0, 80)}`);
			}
			if (r.changes.length > 10) console.log(`  ... +${r.changes.length - 10} more`);
		} else {
			await writeFile(r.file, r.updatedSource, 'utf8');
			console.log(`${rel}: ${r.changes.length} change(s) written`);
			wrote++;
		}
	}
	summarize(reports);
	if (!dryRun && wrote > 0 && !skipIgnoreRefresh) {
		// Line numbers shifted, so the grandfather list must be regenerated.
		// Pass through via an imported entrypoint to avoid spawning a
		// second bun process.
		console.log('\ntheme-codemod: refreshing tools/theme-lint/ignore.txt (line numbers shifted)');
		const refresh = Bun.spawn({
			cmd: ['bun', 'tools/theme-lint/bin.ts', '--fix-ignore'],
			cwd: REPO_ROOT,
			stdio: ['inherit', 'inherit', 'inherit'],
		});
		const code = await refresh.exited;
		if (code !== 0) {
			console.error('theme-codemod: ignore refresh failed; run `bun tools/theme-lint/bin.ts --fix-ignore` manually');
			return code;
		}
	}
	return 0;
}

const exitCode = await main(process.argv.slice(2));
process.exit(exitCode);
