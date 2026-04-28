#!/usr/bin/env bun
/**
 * Dev launcher. Before starting vite, conditionally rebuilds the knowledge
 * graph so the DB and `course/knowledge/graph-index.md` stay in sync with
 * the markdown sources -- without forcing the user to remember a command.
 *
 * The pre-check never blocks vite. If Postgres is unreachable or the build
 * fails, we warn and fall through to the dev server. The user may be
 * mid-edit; locking them out of dev to babysit a knowledge build would be
 * worse than a stale graph.
 */

import { $ } from 'bun';
import { readdirSync, statSync } from 'node:fs';
import { basename, join, resolve } from 'node:path';
import { DEV_DB_URL, ENV_VARS, HOSTS } from '@ab/constants';

// Map app name -> dev URL. Keep in step with apps/* and the HOSTS/PORTS
// constants. Dev serves HTTPS via the SvelteKit/vite TLS setup; the
// /etc/hosts entry for study.airboss.test is added by `bun run setup`.
// The port is intentionally omitted -- reverse-proxied to the vite dev
// server on PORTS.STUDY so the URL printed here matches how the user
// actually visits the app.
const DEV_URLS: Record<string, string> = {
	study: `https://${HOSTS.STUDY}`,
	sim: `https://${HOSTS.SIM}`,
	hangar: `https://${HOSTS.HANGAR}`,
	avionics: `https://${HOSTS.AVIONICS}`,
};

const REPO_ROOT = resolve(import.meta.dir, '..');
const KNOWLEDGE_ROOT = join(REPO_ROOT, 'course', 'knowledge');
const GRAPH_INDEX = join(KNOWLEDGE_ROOT, 'graph-index.md');

function latestNodeMdMtime(root: string): number {
	let latest = 0;
	const stack: string[] = [root];
	while (stack.length > 0) {
		const dir = stack.pop();
		if (!dir) continue;
		let entries: string[];
		try {
			entries = readdirSync(dir);
		} catch {
			continue;
		}
		for (const entry of entries) {
			if (entry.startsWith('.')) continue;
			const full = join(dir, entry);
			let s: ReturnType<typeof statSync>;
			try {
				s = statSync(full);
			} catch {
				continue;
			}
			if (s.isDirectory()) {
				stack.push(full);
			} else if (basename(full) === 'node.md') {
				if (s.mtimeMs > latest) latest = s.mtimeMs;
			}
		}
	}
	return latest;
}

function graphIndexMtime(): number {
	try {
		return statSync(GRAPH_INDEX).mtimeMs;
	} catch {
		return 0;
	}
}

async function isDbReachable(): Promise<boolean> {
	const url = process.env[ENV_VARS.DATABASE_URL] ?? DEV_DB_URL;
	const parsed = (() => {
		try {
			return new URL(url);
		} catch {
			return null;
		}
	})();
	if (!parsed) return false;
	const host = parsed.hostname;
	const port = Number(parsed.port) || 5432;
	try {
		const socket = await Bun.connect({
			hostname: host,
			port,
			socket: { data() {}, open() {}, close() {}, error() {} },
		});
		socket.end();
		return true;
	} catch {
		return false;
	}
}

async function maybeBuildKnowledge(): Promise<void> {
	const sourcesMtime = latestNodeMdMtime(KNOWLEDGE_ROOT);
	const indexMtime = graphIndexMtime();

	if (sourcesMtime === 0) {
		console.log('knowledge: no node.md files found; skipping build.');
		return;
	}

	if (indexMtime >= sourcesMtime) {
		console.log('knowledge: graph-index.md is up to date; skipping build.');
		return;
	}

	if (!(await isDbReachable())) {
		console.warn('knowledge: DB is unreachable; skipping build. Run `bun run db up` to enable auto-build.');
		return;
	}

	console.log('knowledge: building (sources newer than graph-index.md)...');
	const build = await $`bun scripts/build-knowledge-index.ts`.nothrow();
	if (build.exitCode === 0) {
		console.log('knowledge: build succeeded.');
	} else {
		console.warn(`knowledge: build failed (exit ${build.exitCode}); continuing to vite anyway.`);
	}
}

const APPS = Object.keys(DEV_URLS);
const PREFIX_COLORS = ['\x1b[36m', '\x1b[35m', '\x1b[33m', '\x1b[32m', '\x1b[34m']; // cyan, magenta, yellow, green, blue
const RESET = '\x1b[0m';

async function runOne(app: string): Promise<void> {
	const url = DEV_URLS[app];
	console.log(`Starting ${app} dev server...`);
	if (url) console.log(`  ${url}`);
	await $`cd apps/${app} && bun run dev`;
}

async function pipeWithPrefix(
	stream: ReadableStream<Uint8Array>,
	prefix: string,
	out: NodeJS.WriteStream,
): Promise<void> {
	const reader = stream.getReader();
	const decoder = new TextDecoder();
	let buf = '';
	for (;;) {
		const { value, done } = await reader.read();
		if (done) break;
		buf += decoder.decode(value, { stream: true });
		const lines = buf.split('\n');
		buf = lines.pop() ?? '';
		for (const line of lines) out.write(`${prefix}${line}\n`);
	}
	if (buf.length > 0) out.write(`${prefix}${buf}\n`);
}

async function runAll(): Promise<void> {
	console.log(`Starting dev servers: ${APPS.join(', ')}`);
	for (const app of APPS) {
		const url = DEV_URLS[app];
		if (url) console.log(`  [${app}] ${url}`);
	}

	const children = APPS.map((app, i) => {
		const color = PREFIX_COLORS[i % PREFIX_COLORS.length];
		const prefix = `${color}[${app}]${RESET} `;
		const proc = Bun.spawn(['bun', 'run', 'dev'], {
			cwd: join(REPO_ROOT, 'apps', app),
			stdout: 'pipe',
			stderr: 'pipe',
			env: process.env,
		});
		pipeWithPrefix(proc.stdout, prefix, process.stdout);
		pipeWithPrefix(proc.stderr, prefix, process.stderr);
		return { app, proc };
	});

	const shutdown = (signal: NodeJS.Signals) => {
		for (const { proc } of children) {
			try {
				proc.kill(signal);
			} catch {
				/* ignore */
			}
		}
	};
	process.on('SIGINT', () => shutdown('SIGINT'));
	process.on('SIGTERM', () => shutdown('SIGTERM'));

	const exits = await Promise.all(children.map(({ proc }) => proc.exited));
	const failed = exits.some((code) => code !== 0 && code !== 143 && code !== 130);
	process.exit(failed ? 1 : 0);
}

/**
 * Fast-fail wiki-link scan before vite boots. Per architecture decision #3
 * the scanner runs synchronously; sub-second on today's content. Broken or
 * malformed wiki-links exit non-zero so authors catch them before the dev
 * server starts.
 */
async function runReferenceScan(): Promise<void> {
	const result = await $`bun scripts/references.ts validate`.nothrow();
	if (result.exitCode !== 0) {
		console.error('references: broken wiki-links detected. Fix and retry.');
		process.exit(result.exitCode);
	}
}

function printHelp(): void {
	console.log('Usage: bun run dev [app] [flags]');
	console.log('');
	console.log('Starts one or more local dev servers. With no app, spawns all of them in parallel');
	console.log('with coloured prefixed output. Before vite boots, validates wiki-links across all');
	console.log('content and rebuilds the knowledge graph if markdown sources have changed.');
	console.log('');
	console.log('Apps:');
	const width = APPS.reduce((m, n) => Math.max(m, n.length), 0);
	for (const name of APPS) {
		console.log(`  ${name.padEnd(width)}  ${DEV_URLS[name]}`);
	}
	console.log('');
	console.log('Flags:');
	console.log('  --help, -h    Show this message');
	console.log('');
	console.log('Examples:');
	console.log('  bun run dev              Spawn every app in parallel');
	console.log('  bun run dev study        Spawn only the study app');
	console.log('  bun run dev hangar       Spawn only the hangar app');
}

/**
 * Run `svelte-kit sync` in every app workspace. Generates `.svelte-kit/tsconfig.json`
 * which the app's tsconfig extends. Without this, first-boot spits a tsconfig warning;
 * harmless but noisy. Sync is fast (<200ms per app) and idempotent.
 */
async function runSvelteKitSync(): Promise<void> {
	await Promise.all(
		APPS.map(async (app) => {
			const proc = Bun.spawn(['bunx', 'svelte-kit', 'sync'], {
				cwd: join(REPO_ROOT, 'apps', app),
				stdout: 'ignore',
				stderr: 'pipe',
			});
			const code = await proc.exited;
			if (code !== 0) {
				const err = await new Response(proc.stderr).text();
				console.warn(`svelte-kit sync failed for ${app} (exit ${code}); continuing. ${err.trim()}`);
			}
		}),
	);
}

const firstArg = process.argv[2];

if (firstArg === '--help' || firstArg === '-h') {
	printHelp();
	process.exit(0);
}

await runReferenceScan();
await maybeBuildKnowledge();
await runSvelteKitSync();

const app = firstArg;

if (app === undefined) {
	await runAll();
} else if (DEV_URLS[app]) {
	await runOne(app);
} else {
	console.error(`Unknown app: '${app}'. Valid apps: ${APPS.join(', ')}`);
	console.error('Run `bun run dev --help` for usage.');
	process.exit(1);
}
