#!/usr/bin/env bun
/**
 * Walk a Vite-served runtime barrel to find `node:*` / `postgres` leaks.
 *
 * Why this exists: the browser-hydration crash class (PRs #656, #659, #661,
 * #663, #664, #857, #921, this PR) has a hard rule -- after two failed
 * candidate fixes from grep + reasoning, switch to MEASUREMENT. This script
 * is the measurement. It curls Vite's `/@id/<pkg>` entry point, parses the
 * served output, follows every `from "/@fs/..."` value-import edge, and
 * flags any module whose served body starts with
 * `import ... from "/@id/__vite-browser-external:node:*"` -- the canonical
 * shape of a server-only module reaching the client bundle.
 *
 * Type-only imports erase at compile time and don't appear in the served
 * output, so the walk graph is exactly what the browser evaluates.
 *
 * Usage:
 *
 *   # Start the dev server in the parent repo (NOT a worktree -- needs .env):
 *   bun scripts/dev.ts study
 *
 *   # Walk the runtime barrel(s) you suspect:
 *   bun scripts/walk-browser-barrel.ts @ab/sources
 *   bun scripts/walk-browser-barrel.ts @ab/sources @ab/bc-study @ab/help
 *
 *   # Trace the actual leak path from barrel -> leaking module:
 *   bun scripts/walk-browser-barrel.ts @ab/sources --paths
 *
 *   # Custom port (default 9600 = airboss study app):
 *   PORT=9601 bun scripts/walk-browser-barrel.ts @ab/sources
 *
 * Source of truth: docs/agents/debug-playbooks/browser-hydration.md.
 */

const port = Number(process.env.PORT ?? 9600);
const host = `http://127.0.0.1:${port}`;

const args = process.argv.slice(2);
const showPaths = args.includes('--paths');
const barrels = args.filter((a) => !a.startsWith('--'));

if (barrels.length === 0) {
	process.stderr.write('usage: bun scripts/walk-browser-barrel.ts <pkg> [<pkg> ...] [--paths]\n');
	process.stderr.write('  e.g. bun scripts/walk-browser-barrel.ts @ab/sources --paths\n');
	process.exit(2);
}

interface WalkResult {
	readonly barrel: string;
	readonly modules: ReadonlySet<string>;
	readonly leaks: readonly string[];
	readonly graph: ReadonlyMap<string, readonly string[]>;
}

async function fetchModule(url: string): Promise<string> {
	const res = await fetch(url, { signal: AbortSignal.timeout(10_000) });
	if (!res.ok) throw new Error(`HTTP ${res.status}`);
	return await res.text();
}

const IMPORT_RE = /from\s+"([^"]+)"|import\s+"([^"]+)"/g;

function shortPath(url: string): string {
	const m = url.match(/\/src\/(.+)$/);
	return m?.[1] ?? url.replace(host, '');
}

async function walk(barrel: string): Promise<WalkResult> {
	const start = `${host}/@id/${barrel}`;
	const seen = new Set<string>();
	const queue: string[] = [start];
	const leaks: string[] = [];
	const graph = new Map<string, string[]>();

	while (queue.length > 0) {
		const url = queue.shift();
		if (url === undefined || seen.has(url)) continue;
		seen.add(url);

		let body: string;
		try {
			body = await fetchModule(url);
		} catch (err) {
			process.stderr.write(`FAIL: ${url}: ${(err as Error).message}\n`);
			continue;
		}

		// First 1KB is enough to catch a `__vite-browser-external` import shim.
		if (body.slice(0, 1000).includes('__vite-browser-external:node:')) {
			leaks.push(url);
		}

		const edges: string[] = [];
		for (const match of body.matchAll(IMPORT_RE)) {
			const imp = match[1] ?? match[2];
			if (imp === undefined) continue;
			if (imp.startsWith('/@id/__vite-browser-external')) continue;
			if (!imp.startsWith('/@fs/') && !imp.startsWith('/@id/')) continue;
			const base = imp.split('?')[0];
			if (base === undefined) continue;
			const target = `${host}${base}`;
			edges.push(target);
			queue.push(target);
		}
		graph.set(url, edges);
	}

	return { barrel, modules: seen, leaks, graph };
}

function bfsPath(graph: ReadonlyMap<string, readonly string[]>, src: string, target: string): readonly string[] | null {
	const visited = new Set<string>([src]);
	const queue: Array<{ node: string; path: readonly string[] }> = [{ node: src, path: [src] }];
	while (queue.length > 0) {
		const entry = queue.shift();
		if (entry === undefined) continue;
		if (entry.node === target) return entry.path;
		for (const next of graph.get(entry.node) ?? []) {
			if (visited.has(next)) continue;
			visited.add(next);
			queue.push({ node: next, path: [...entry.path, next] });
		}
	}
	return null;
}

async function main() {
	// Probe the dev server is up before walking.
	try {
		await fetch(`${host}/`, { signal: AbortSignal.timeout(2_000) });
	} catch {
		process.stderr.write(`error: dev server not reachable at ${host}\n`);
		process.stderr.write('  start it with: bun scripts/dev.ts study\n');
		process.exit(2);
	}

	let totalLeaks = 0;
	for (const barrel of barrels) {
		const result = await walk(barrel);
		totalLeaks += result.leaks.length;
		process.stdout.write(`\n=== ${barrel} ===\n`);
		process.stdout.write(`walked ${result.modules.size} modules, ${result.leaks.length} leak(s)\n`);
		for (const leak of result.leaks) {
			process.stdout.write(`  LEAK: ${shortPath(leak)}\n`);
			if (showPaths) {
				const start = `${host}/@id/${barrel}`;
				const path = bfsPath(result.graph, start, leak);
				if (path === null) {
					process.stdout.write('    (no path found?)\n');
				} else {
					for (const step of path) process.stdout.write(`      -> ${shortPath(step)}\n`);
				}
			}
		}
	}

	process.exit(totalLeaks === 0 ? 0 : 1);
}

main().catch((err) => {
	process.stderr.write(`fatal: ${(err as Error).message}\n`);
	process.exit(2);
});
