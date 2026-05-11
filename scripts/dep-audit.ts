#!/usr/bin/env bun

/**
 * Monorepo dep hygiene auditor.
 *
 * Walks every workspace's source files, collects bare-package imports, and
 * compares against each workspace's package.json. Reports three classes of
 * issue:
 *
 *   1. DUPLICATED -- package declared in BOTH root devDeps AND a workspace's
 *      deps. The workspace declaration is the active one; the root entry is
 *      noise.
 *   2. UNDECLARED -- package imported by a workspace's src/ but absent from
 *      that workspace's package.json. Resolves today only because bun hoists
 *      it from root node_modules. A different installer or a stricter profile
 *      would fail.
 *   3. ROOT-ONLY -- package consumed only by root-level surface (scripts/,
 *      tools/, tests/, drizzle/). These legitimately stay at root.
 *
 * Usage:
 *   bun run dep-audit                    # human-readable report
 *   bun run dep-audit --json             # machine-readable
 *   bun run dep-audit --strict           # exit 1 if duplicates or undeclared > 0
 *
 * The TOOLCHAIN_ROOT_KEEPERS set lists packages we intentionally keep at root
 * even though they're also declared per-workspace (per
 * docs/work/plans/2026-05-10-monorepo-dep-hygiene.md Decision 1). They are
 * toolchain singletons -- vite, vitest, svelte, sveltejs/*. Declarations at
 * both levels are intentional, not redundant.
 */

import { readdirSync, readFileSync, statSync } from 'node:fs';
import { dirname, join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';

const REPO_ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');

const TOOLCHAIN_ROOT_KEEPERS = new Set([
	'@sveltejs/adapter-node',
	'@sveltejs/kit',
	'@sveltejs/vite-plugin-svelte',
	'svelte',
	'svelte-check',
	'vite',
	'vitest',
	'@vitest/coverage-v8',
	'happy-dom',
	'@biomejs/biome',
	'@playwright/test',
	'drizzle-kit',
	'typescript',
	'@testing-library/dom',
	'@testing-library/jest-dom',
	'@testing-library/svelte',
	'@testing-library/user-event',
	'@types/bun',
]);

const ROOT_SURFACE_DIRS = ['scripts', 'tools', 'tests', 'drizzle'];

const SKIP_DIRS = new Set(['node_modules', 'dist', '.svelte-kit', '.cache', '.archive', 'build']);
const SOURCE_EXT = /\.(?:ts|tsx|js|jsx|mts|cts|svelte)$/;

const TRANSPILER_TS = new Bun.Transpiler({ loader: 'ts' });
const TRANSPILER_TSX = new Bun.Transpiler({ loader: 'tsx' });
const SVELTE_SCRIPT_REGEX = /<script(?:\s[^>]*)?>([\s\S]*?)<\/script>/g;

interface PkgJson {
	name?: string;
	dependencies?: Record<string, string>;
	devDependencies?: Record<string, string>;
	peerDependencies?: Record<string, string>;
	workspaces?: string[];
}

interface Workspace {
	name: string;
	path: string;
	relPath: string;
	pkg: PkgJson;
}

interface Report {
	duplicated: Array<{ pkg: string; rootSection: 'dependencies' | 'devDependencies'; workspaces: string[] }>;
	undeclared: Array<{ pkg: string; workspaces: string[]; rootHas: boolean }>;
	rootOnly: Array<{ pkg: string; section: 'dependencies' | 'devDependencies' | 'missing' }>;
	missingFromRoot: Array<{ pkg: string; workspaces: string[] }>;
}

function readJson<T = unknown>(path: string): T {
	return JSON.parse(readFileSync(path, 'utf8')) as T;
}

function tryStat(path: string): ReturnType<typeof statSync> | null {
	try {
		return statSync(path);
	} catch {
		return null;
	}
}

function walkSource(dir: string, out: string[]): void {
	let entries: string[];
	try {
		entries = readdirSync(dir);
	} catch {
		return;
	}
	for (const name of entries) {
		if (SKIP_DIRS.has(name)) continue;
		if (name.startsWith('.cache')) continue;
		const full = join(dir, name);
		const s = tryStat(full);
		if (!s) continue;
		if (s.isDirectory()) {
			walkSource(full, out);
		} else if (SOURCE_EXT.test(name)) {
			out.push(full);
		}
	}
}

function bareName(spec: string): string | null {
	if (!spec) return null;
	if (spec.startsWith('.') || spec.startsWith('/')) return null;
	if (spec.startsWith('node:')) return null;
	if (spec.startsWith('@ab/')) return null;
	if (spec.startsWith('$')) return null;
	if (spec.startsWith('virtual:')) return null;
	if (spec.startsWith('@')) {
		const parts = spec.split('/');
		return parts.length >= 2 ? `${parts[0]}/${parts[1]}` : null;
	}
	return spec.split('/')[0] ?? null;
}

function scanWithTranspiler(src: string, transpiler: Bun.Transpiler): string[] {
	try {
		return transpiler.scanImports(src).map((entry) => entry.path);
	} catch {
		return [];
	}
}

function collectImports(file: string): Set<string> {
	const found = new Set<string>();
	let src: string;
	try {
		src = readFileSync(file, 'utf8');
	} catch {
		return found;
	}
	let paths: string[];
	if (file.endsWith('.svelte')) {
		paths = [];
		for (const m of src.matchAll(SVELTE_SCRIPT_REGEX)) {
			paths.push(...scanWithTranspiler(m[1] ?? '', TRANSPILER_TS));
		}
	} else if (file.endsWith('.tsx') || file.endsWith('.jsx')) {
		paths = scanWithTranspiler(src, TRANSPILER_TSX);
	} else {
		paths = scanWithTranspiler(src, TRANSPILER_TS);
	}
	for (const p of paths) {
		const n = bareName(p);
		if (n) found.add(n);
	}
	return found;
}

function discoverWorkspaces(rootPkg: PkgJson): Workspace[] {
	const patterns = rootPkg.workspaces ?? [];
	const workspaces: Workspace[] = [];
	for (const pattern of patterns) {
		const isGlob = pattern.endsWith('/*');
		const base = join(REPO_ROOT, pattern.replace(/\/\*$/, ''));
		const baseStat = tryStat(base);
		if (!baseStat?.isDirectory()) continue;
		if (isGlob) {
			for (const sub of readdirSync(base)) {
				const wsPath = join(base, sub);
				const wsStat = tryStat(wsPath);
				if (!wsStat?.isDirectory()) continue;
				const pkgPath = join(wsPath, 'package.json');
				const pkgStat = tryStat(pkgPath);
				if (!pkgStat) continue;
				const pkg = readJson<PkgJson>(pkgPath);
				if (!pkg.name) continue;
				workspaces.push({ name: pkg.name, path: wsPath, relPath: relative(REPO_ROOT, wsPath), pkg });
			}
		} else {
			const pkgPath = join(base, 'package.json');
			if (tryStat(pkgPath)) {
				const pkg = readJson<PkgJson>(pkgPath);
				if (pkg.name) {
					workspaces.push({ name: pkg.name, path: base, relPath: relative(REPO_ROOT, base), pkg });
				}
			}
		}
	}
	return workspaces.sort((a, b) => a.name.localeCompare(b.name));
}

function buildReport(): Report {
	const rootPkg = readJson<PkgJson>(join(REPO_ROOT, 'package.json'));
	const rootDeps = rootPkg.dependencies ?? {};
	const rootDevDeps = rootPkg.devDependencies ?? {};
	const rootAll = new Set([...Object.keys(rootDeps), ...Object.keys(rootDevDeps)]);
	const workspaces = discoverWorkspaces(rootPkg);

	const wsImports = new Map<string, Set<string>>();
	for (const ws of workspaces) {
		const files: string[] = [];
		walkSource(join(ws.path, 'src'), files);
		for (const extra of ['tests', 'scripts', 'lib']) {
			walkSource(join(ws.path, extra), files);
		}
		// Workspace-root config files (vite.config.ts, svelte.config.js, vitest.config.ts, etc.)
		for (const entry of readdirSync(ws.path)) {
			if (!SOURCE_EXT.test(entry)) continue;
			const full = join(ws.path, entry);
			const s = tryStat(full);
			if (s?.isFile()) files.push(full);
		}
		const imports = new Set<string>();
		for (const f of files) for (const n of collectImports(f)) imports.add(n);
		wsImports.set(ws.name, imports);
	}

	const rootSurfaceImports = new Set<string>();
	for (const dir of ROOT_SURFACE_DIRS) {
		const files: string[] = [];
		walkSource(join(REPO_ROOT, dir), files);
		for (const f of files) for (const n of collectImports(f)) rootSurfaceImports.add(n);
	}

	const duplicated: Report['duplicated'] = [];
	for (const pkg of rootAll) {
		if (TOOLCHAIN_ROOT_KEEPERS.has(pkg)) continue;
		if (pkg.startsWith('@types/')) continue;
		const inWs: string[] = [];
		for (const ws of workspaces) {
			const wsAll = new Set([...Object.keys(ws.pkg.dependencies ?? {}), ...Object.keys(ws.pkg.devDependencies ?? {})]);
			if (wsAll.has(pkg)) inWs.push(ws.name);
		}
		if (inWs.length > 0) {
			duplicated.push({
				pkg,
				rootSection: pkg in rootDeps ? 'dependencies' : 'devDependencies',
				workspaces: inWs,
			});
		}
	}

	const undeclaredMap = new Map<string, string[]>();
	for (const ws of workspaces) {
		const wsAll = new Set([...Object.keys(ws.pkg.dependencies ?? {}), ...Object.keys(ws.pkg.devDependencies ?? {})]);
		const imports = wsImports.get(ws.name) ?? new Set<string>();
		for (const pkg of imports) {
			if (wsAll.has(pkg)) continue;
			const list = undeclaredMap.get(pkg) ?? [];
			list.push(ws.name);
			undeclaredMap.set(pkg, list);
		}
	}
	const undeclared: Report['undeclared'] = [...undeclaredMap.entries()]
		.map(([pkg, ws]) => ({ pkg, workspaces: ws.sort(), rootHas: rootAll.has(pkg) }))
		.sort((a, b) => a.pkg.localeCompare(b.pkg));

	const rootOnly: Report['rootOnly'] = [];
	for (const pkg of rootSurfaceImports) {
		let usedByWs = false;
		for (const imports of wsImports.values()) {
			if (imports.has(pkg)) {
				usedByWs = true;
				break;
			}
		}
		if (usedByWs) continue;
		let section: 'dependencies' | 'devDependencies' | 'missing' = 'missing';
		if (pkg in rootDeps) section = 'dependencies';
		else if (pkg in rootDevDeps) section = 'devDependencies';
		rootOnly.push({ pkg, section });
	}
	rootOnly.sort((a, b) => a.pkg.localeCompare(b.pkg));

	const missingFromRoot: Report['missingFromRoot'] = undeclared
		.filter((entry) => !entry.rootHas)
		.map((entry) => ({ pkg: entry.pkg, workspaces: entry.workspaces }));

	return { duplicated, undeclared, rootOnly, missingFromRoot };
}

function printHuman(report: Report): void {
	const { duplicated, undeclared, rootOnly, missingFromRoot } = report;

	console.log(`\n=== DUPLICATED (${duplicated.length}) ===`);
	console.log('Package declared in BOTH root devDeps/deps AND a workspace.');
	console.log('The workspace declaration is the active one. Remove the root entry.\n');
	if (duplicated.length === 0) {
		console.log('  (none)');
	} else {
		for (const d of duplicated) {
			console.log(`  ${d.pkg.padEnd(36)} root=${d.rootSection.padEnd(15)} ws=[${d.workspaces.join(', ')}]`);
		}
	}

	console.log(`\n=== UNDECLARED (${undeclared.length}) ===`);
	console.log('Workspace imports a package not in its own package.json.');
	console.log('Resolves today only via root hoisting. Declare it in the consuming workspace.\n');
	if (undeclared.length === 0) {
		console.log('  (none)');
	} else {
		for (const u of undeclared) {
			const flag = u.rootHas ? '' : ' [NOT IN ROOT EITHER -- broken]';
			console.log(`  ${u.pkg.padEnd(36)} -> ${u.workspaces.length} workspace(s): ${u.workspaces.join(', ')}${flag}`);
		}
	}

	if (missingFromRoot.length > 0) {
		console.log(`\n=== HARD FAILURES (${missingFromRoot.length}) ===`);
		console.log('Imports that resolve only by accident -- not declared anywhere.\n');
		for (const m of missingFromRoot) {
			console.log(`  ${m.pkg.padEnd(36)} -> ${m.workspaces.join(', ')}`);
		}
	}

	console.log(`\n=== ROOT-ONLY (${rootOnly.length}) ===`);
	console.log('Imported only by scripts/, tools/, tests/, drizzle/. Legitimate root deps.\n');
	if (rootOnly.length === 0) {
		console.log('  (none)');
	} else {
		for (const r of rootOnly) {
			console.log(`  ${r.pkg.padEnd(36)} section=${r.section}`);
		}
	}

	console.log('');
}

const args = process.argv.slice(2);
const wantJson = args.includes('--json');
const wantStrict = args.includes('--strict');
const wantHelp = args.includes('--help') || args.includes('-h') || args.includes('help');

if (wantHelp) {
	console.log(`Usage: bun run dep-audit [--json] [--strict]

Audit monorepo dep hygiene. Reports:
  - duplicated: declared in root AND a workspace (workspace wins; remove root)
  - undeclared: workspace imports a pkg it doesn't declare (relies on hoisting)
  - root-only: legitimately consumed only by root-level surface
  - hard failures: imports declared nowhere (currently broken or about to be)

Flags:
  --json     Emit machine-readable JSON instead of human-readable text
  --strict   Exit non-zero if duplicates or undeclared > 0 (for CI / check)

See: docs/work/plans/2026-05-10-monorepo-dep-hygiene.md`);
	process.exit(0);
}

const report = buildReport();

if (wantJson) {
	console.log(JSON.stringify(report, null, 2));
} else {
	printHuman(report);
}

if (wantStrict) {
	const fail = report.duplicated.length > 0 || report.undeclared.length > 0;
	process.exit(fail ? 1 : 0);
}
