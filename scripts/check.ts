#!/usr/bin/env bun
/**
 * Project-wide check pipeline.
 *
 * Runs every linter / type-checker / validator in parallel where possible and
 * captures per-step output to `.cache/check/<step>.{stdout,stderr,exit}` so
 * failures can be surfaced compactly at the end.
 *
 * Scopes:
 *   --scope=all     (default) -- run every step at full breadth.
 *   --scope=dirty             -- restrict scopable steps to files changed vs HEAD.
 *   --scope=branch            -- restrict scopable steps to files changed vs origin/main.
 *
 * Type checks (svelte-check) and graph validators (references, browser-globals,
 * help-ids, knowledge dry-run, airboss-ref) always run full regardless of scope.
 *
 * Flags:
 *   --verbose -- stream output live (legacy behavior). Default is summarized.
 */

import { $ } from 'bun';
import { existsSync, mkdirSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';

const REPO_ROOT = resolve(import.meta.dir, '..');
const CACHE_DIR = resolve(REPO_ROOT, '.cache', 'check');

type Scope = 'all' | 'dirty' | 'branch';

interface CliArgs {
	scope: Scope;
	verbose: boolean;
}

function parseArgs(argv: readonly string[]): CliArgs {
	let scope: Scope = 'all';
	let verbose = false;
	for (let i = 0; i < argv.length; i += 1) {
		const a = argv[i] ?? '';
		if (a === '--scope') {
			i += 1;
			scope = (argv[i] as Scope) ?? 'all';
		} else if (a.startsWith('--scope=')) {
			scope = a.slice('--scope='.length) as Scope;
		} else if (a === '--verbose') {
			verbose = true;
		}
	}
	if (scope !== 'all' && scope !== 'dirty' && scope !== 'branch') {
		throw new Error(`Invalid --scope: ${scope}. Expected all|dirty|branch.`);
	}
	return { scope, verbose };
}

interface StepResult {
	name: string;
	exitCode: number;
	elapsedMs: number;
	stdout: string;
	stderr: string;
	stdoutPath: string;
	stderrPath: string;
	skipped?: boolean;
	skipReason?: string;
}

type StepFn = () => Promise<{ exitCode: number; stdout: string; stderr: string }>;

function ensureCacheDir(): void {
	mkdirSync(CACHE_DIR, { recursive: true });
}

async function runStep(name: string, fn: StepFn): Promise<StepResult> {
	const start = Date.now();
	const stdoutPath = resolve(CACHE_DIR, `${name}.stdout`);
	const stderrPath = resolve(CACHE_DIR, `${name}.stderr`);
	const exitPath = resolve(CACHE_DIR, `${name}.exit`);
	try {
		const r = await fn();
		writeFileSync(stdoutPath, r.stdout);
		writeFileSync(stderrPath, r.stderr);
		writeFileSync(exitPath, String(r.exitCode));
		return {
			name,
			exitCode: r.exitCode,
			elapsedMs: Date.now() - start,
			stdout: r.stdout,
			stderr: r.stderr,
			stdoutPath,
			stderrPath,
		};
	} catch (err) {
		const msg = (err as Error).message ?? String(err);
		writeFileSync(stderrPath, msg);
		writeFileSync(exitPath, '99');
		return {
			name,
			exitCode: 99,
			elapsedMs: Date.now() - start,
			stdout: '',
			stderr: msg,
			stdoutPath,
			stderrPath,
		};
	}
}

async function shellRun(
	cmd: string,
	args: readonly string[],
	cwd?: string,
): Promise<{
	exitCode: number;
	stdout: string;
	stderr: string;
}> {
	// Bun.spawn with explicit args -- no shell injection, robust to file lists.
	const proc = Bun.spawn([cmd, ...args], {
		cwd: cwd ?? REPO_ROOT,
		stdout: 'pipe',
		stderr: 'pipe',
	});
	const [stdout, stderr] = await Promise.all([new Response(proc.stdout).text(), new Response(proc.stderr).text()]);
	const exitCode = await proc.exited;
	return { exitCode, stdout, stderr };
}

async function dirtyFiles(scope: Scope): Promise<string[]> {
	if (scope === 'all') return [];
	let raw = '';
	if (scope === 'dirty') {
		const tracked = await $`git diff --name-only HEAD`.cwd(REPO_ROOT).text();
		const untracked = await $`git ls-files --others --exclude-standard`.cwd(REPO_ROOT).text();
		raw = `${tracked}\n${untracked}`;
	} else {
		// branch
		const base = (await $`git merge-base HEAD origin/main`.cwd(REPO_ROOT).nothrow().text()).trim();
		if (base === '') {
			raw = await $`git diff --name-only origin/main`.cwd(REPO_ROOT).nothrow().text();
		} else {
			raw = await $`git diff --name-only ${base}...HEAD`.cwd(REPO_ROOT).text();
			const untracked = await $`git ls-files --others --exclude-standard`.cwd(REPO_ROOT).text();
			raw = `${raw}\n${untracked}`;
		}
	}
	const set = new Set<string>();
	for (const line of raw.split('\n')) {
		const t = line.trim();
		if (t === '') continue;
		set.add(t);
	}
	return [...set];
}

function filterByExt(files: readonly string[], exts: readonly string[]): string[] {
	return files.filter((f) => exts.some((e) => f.endsWith(e)));
}

function fileExists(rel: string): boolean {
	return existsSync(resolve(REPO_ROOT, rel));
}

async function main(): Promise<number> {
	ensureCacheDir();
	const args = parseArgs(process.argv.slice(2));

	console.log(`check: scope=${args.scope}${args.verbose ? ' (verbose)' : ''}`);

	// SvelteKit sync prereq.
	const SVELTE_APPS = ['apps/study', 'apps/sim', 'apps/hangar', 'apps/avionics', 'apps/flightbag'] as const;
	for (const app of SVELTE_APPS) {
		const generated = `${app}/.svelte-kit/tsconfig.json`;
		if (!existsSync(resolve(REPO_ROOT, generated))) {
			console.log(`svelte-kit sync (${app})...`);
			await $`cd ${app} && bunx svelte-kit sync`.cwd(REPO_ROOT).quiet();
		}
	}

	const dirty = await dirtyFiles(args.scope);
	if (args.scope !== 'all') {
		console.log(`check: ${dirty.length} file(s) in scope`);
	}

	const tasks: Array<Promise<StepResult>> = [];

	// biome -- scopable.
	tasks.push(
		runStep('biome', async () => {
			if (args.scope === 'all') {
				return shellRun('bunx', ['biome', 'check', '.']);
			}
			const files = filterByExt(dirty, ['.ts', '.tsx', '.js', '.svelte', '.json', '.css']).filter(fileExists);
			if (files.length === 0) return { exitCode: 0, stdout: 'no files in scope', stderr: '' };
			return shellRun('bunx', ['biome', 'check', ...files]);
		}),
	);

	// references validate -- always full.
	tasks.push(runStep('references', () => shellRun('bun', ['scripts/references.ts', 'validate'])));

	// airboss-ref -- always full.
	tasks.push(runStep('airboss-ref', () => shellRun('bun', ['scripts/airboss-ref.ts'])));

	// knowledge dry-run -- always full.
	tasks.push(runStep('knowledge', () => shellRun('bun', ['scripts/build-knowledge-index.ts', '--dry-run'])));

	// theme-lint -- scopable (passes positional file args).
	tasks.push(
		runStep('theme-lint', async () => {
			if (args.scope === 'all') {
				return shellRun('bun', ['tools/theme-lint/bin.ts']);
			}
			const files = filterByExt(dirty, ['.svelte', '.css']).filter(fileExists);
			if (files.length === 0) return { exitCode: 0, stdout: 'no files in scope', stderr: '' };
			return shellRun('bun', ['tools/theme-lint/bin.ts', ...files]);
		}),
	);

	// test-lint -- scopable (passes positional file args; test-lint already accepts roots/files).
	tasks.push(
		runStep('test-lint', async () => {
			if (args.scope === 'all') {
				return shellRun('bun', ['tools/test-lint/bin.ts']);
			}
			const files = dirty.filter((f) => /\.(test|svelte\.test)\.ts$/.test(f)).filter(fileExists);
			if (files.length === 0) return { exitCode: 0, stdout: 'no files in scope', stderr: '' };
			return shellRun('bun', ['tools/test-lint/bin.ts', ...files]);
		}),
	);

	// help-ids -- always full (validates registry against full app).
	tasks.push(runStep('help-ids', () => shellRun('bun', ['scripts/validate-help-ids.ts'])));

	// browser-globals -- always full (transitive imports).
	tasks.push(runStep('browser-globals', () => shellRun('bun', ['scripts/check-browser-globals.ts'])));

	// course-frontmatter -- always full today (CLI doesn't yet take file args; cheap).
	tasks.push(runStep('course-frontmatter', () => shellRun('bun', ['tools/course-frontmatter/check.ts'])));

	// wp-frontmatter -- always full.
	tasks.push(runStep('wp-frontmatter', () => shellRun('bun', ['scripts/lint/wp-frontmatter.ts'])));

	// md-format -- always check mode (already dirty-default).
	tasks.push(runStep('md-format', () => shellRun('bun', ['tools/md-format/bin.ts', '--check'])));

	// svelte-check (5 apps) -- always full.
	for (const app of SVELTE_APPS) {
		const name = `svelte-check:${app.replace('apps/', '')}`;
		tasks.push(
			runStep(name, () => shellRun('bunx', ['svelte-check', '--tsconfig', './tsconfig.json'], resolve(REPO_ROOT, app))),
		);
	}

	// handbook-ingest pytest -- always full.
	tasks.push(
		runStep('handbook-ingest', async () => {
			const venv = 'tools/handbook-ingest/.venv/bin/python';
			const py = existsSync(resolve(REPO_ROOT, venv)) ? venv : 'python3';
			return shellRun(
				py,
				['-m', 'pytest', 'tests/test_orphan_thresholds.py'],
				resolve(REPO_ROOT, 'tools/handbook-ingest'),
			);
		}),
	);

	// glossary corpus size -- inline, fast, never failing the pipeline structurally.
	tasks.push(
		runStep('glossary-budget', async () => {
			const GLOSSARY_BUDGET_BYTES = 64 * 1024;
			const listing = await $`find libs/help/src/glossary/content -name '*.md'`.cwd(REPO_ROOT).text();
			let bytes = 0;
			for (const file of listing.split('\n')) {
				if (file.length === 0) continue;
				bytes += Bun.file(resolve(REPO_ROOT, file)).size;
			}
			if (bytes <= GLOSSARY_BUDGET_BYTES) {
				return { exitCode: 0, stdout: `glossary corpus: ${bytes} / ${GLOSSARY_BUDGET_BYTES} bytes (OK)\n`, stderr: '' };
			}
			return {
				exitCode: 1,
				stdout: '',
				stderr:
					`glossary corpus: ${bytes} bytes exceeds budget of ${GLOSSARY_BUDGET_BYTES} bytes.\n` +
					'Eager-globbed bundle cost is no longer trivial. Either trim entries or move to lazy import().\n',
			};
		}),
	);

	// In verbose mode, stream the steps as they finish.
	if (args.verbose) {
		const wrapped = tasks.map((p) =>
			p.then((r) => {
				const sym = r.exitCode === 0 ? 'OK' : 'FAIL';
				const dur = (r.elapsedMs / 1000).toFixed(1);
				console.log(`[${sym}] ${r.name} (${dur}s)`);
				if (r.exitCode !== 0) {
					if (r.stdout) process.stdout.write(r.stdout);
					if (r.stderr) process.stderr.write(r.stderr);
				}
				return r;
			}),
		);
		const results = await Promise.all(wrapped);
		return summarize(results);
	}

	const results = await Promise.all(tasks);
	return summarize(results);
}

function formatElapsed(ms: number): string {
	return `${(ms / 1000).toFixed(1)}s`;
}

function summarize(results: readonly StepResult[]): number {
	console.log('\nCheck summary:');
	const longest = results.reduce((acc, r) => Math.max(acc, r.name.length), 0);
	for (const r of results) {
		const sym = r.skipped === true ? '-' : r.exitCode === 0 ? 'OK' : 'FAIL';
		const note = r.skipped === true ? ` (skipped: ${r.skipReason ?? ''})` : '';
		console.log(`  [${sym}] ${r.name.padEnd(longest, ' ')}  (${formatElapsed(r.elapsedMs)})${note}`);
	}
	const failures = results.filter((r) => r.exitCode !== 0 && r.skipped !== true);
	if (failures.length === 0) {
		console.log('\nAll checks passed.');
		return 0;
	}
	console.error(`\n${failures.length} step(s) failed.`);
	for (const f of failures) {
		console.error(`\n=== ${f.name} (exit ${f.exitCode}) ===`);
		if (f.stdout) process.stdout.write(f.stdout);
		if (f.stderr) process.stderr.write(f.stderr);
	}
	console.error(`\nPer-step output cached under ${CACHE_DIR.replace(REPO_ROOT, '.')}/.`);
	return 1;
}

const exitCode = await main();
process.exit(exitCode);
