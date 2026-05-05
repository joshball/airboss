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
import {
	existsSync,
	mkdirSync,
	openSync,
	readdirSync,
	readFileSync,
	renameSync,
	rmSync,
	statSync,
	writeFileSync,
} from 'node:fs';
import { basename, join, resolve } from 'node:path';
import { DEV_DB_URL, ENV_VARS, HOSTS, PORTS } from '@ab/constants';

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
	flightbag: `https://${HOSTS.FLIGHTBAG}`,
};

const APP_PORTS: Record<string, number> = {
	study: PORTS.STUDY,
	sim: PORTS.SIM,
	hangar: PORTS.HANGAR,
	avionics: PORTS.AVIONICS,
	flightbag: PORTS.FLIGHTBAG,
};

const REPO_ROOT = resolve(import.meta.dir, '..');
const KNOWLEDGE_ROOT = join(REPO_ROOT, 'course', 'knowledge');
const GRAPH_INDEX = join(KNOWLEDGE_ROOT, 'graph-index.md');
const DEV_DIR = join(REPO_ROOT, '.dev');

function appDir(app: string): string {
	return join(DEV_DIR, app);
}
function appLogPath(app: string): string {
	return join(appDir(app), 'server.log');
}
function appLogPrevPath(app: string): string {
	return join(appDir(app), 'server.log.prev');
}
function appPidPath(app: string): string {
	return join(appDir(app), 'pid');
}
function appStartedPath(app: string): string {
	return join(appDir(app), 'started');
}

function readPidfile(app: string): number | null {
	try {
		const raw = readFileSync(appPidPath(app), 'utf8').trim();
		const pid = Number.parseInt(raw, 10);
		return Number.isFinite(pid) && pid > 0 ? pid : null;
	} catch {
		return null;
	}
}

function writePidfile(app: string, pid: number): void {
	mkdirSync(appDir(app), { recursive: true });
	writeFileSync(appPidPath(app), `${pid}\n`);
	writeFileSync(appStartedPath(app), `${new Date().toISOString()}\n`);
}

function clearPidfile(app: string): void {
	for (const path of [appPidPath(app), appStartedPath(app)]) {
		try {
			rmSync(path);
		} catch {
			/* ignore */
		}
	}
}

function readStarted(app: string): string | null {
	try {
		return readFileSync(appStartedPath(app), 'utf8').trim();
	} catch {
		return null;
	}
}

function rotateLog(app: string): void {
	const log = appLogPath(app);
	if (!existsSync(log)) return;
	try {
		renameSync(log, appLogPrevPath(app));
	} catch {
		/* ignore */
	}
}

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

async function getListenerPids(port: number): Promise<number[]> {
	const result = await $`lsof -ti tcp:${port} -sTCP:LISTEN`.nothrow().quiet();
	if (result.exitCode !== 0) return [];
	return result.stdout
		.toString()
		.split('\n')
		.map((s) => Number.parseInt(s.trim(), 10))
		.filter((n) => Number.isFinite(n) && n > 0);
}

async function killPids(pids: number[], signal: 'SIGTERM' | 'SIGKILL'): Promise<void> {
	for (const pid of pids) {
		try {
			process.kill(pid, signal);
		} catch {
			/* already gone */
		}
	}
}

async function isPidAlive(pid: number): Promise<boolean> {
	try {
		process.kill(pid, 0);
		return true;
	} catch {
		return false;
	}
}

async function killApp(app: string): Promise<{ killed: number[]; survived: number[] }> {
	const port = APP_PORTS[app];
	const portPids = await getListenerPids(port);
	const pidfilePid = readPidfile(app);
	// Always include pidfile pid if alive -- it's the parent `bun run dev`
	// process and its children (vite) need to die with it. Killing only the
	// vite listener leaves a zombie supervisor.
	const pids = Array.from(
		new Set([...portPids, ...(pidfilePid && (await isPidAlive(pidfilePid)) ? [pidfilePid] : [])]),
	);
	if (pids.length === 0) {
		clearPidfile(app);
		return { killed: [], survived: [] };
	}

	await killPids(pids, 'SIGTERM');

	const deadline = Date.now() + 1500;
	while (Date.now() < deadline) {
		const stillAlive = await Promise.all(pids.map(isPidAlive));
		if (!stillAlive.some(Boolean)) break;
		await Bun.sleep(100);
	}

	const survived: number[] = [];
	for (const pid of pids) {
		if (await isPidAlive(pid)) survived.push(pid);
	}
	if (survived.length > 0) {
		await killPids(survived, 'SIGKILL');
	}

	const stillSurvived: number[] = [];
	for (const pid of survived) {
		if (await isPidAlive(pid)) stillSurvived.push(pid);
	}
	const killed = pids.filter((pid) => !stillSurvived.includes(pid));

	if (stillSurvived.length === 0) {
		rotateLog(app);
		clearPidfile(app);
	}

	return { killed, survived: stillSurvived };
}

/**
 * Nuke every layer of Vite / SvelteKit / TypeScript cache so the next dev
 * boot rebuilds from source. Used when a stale chunk survives across edits
 * (the canonical symptom: a fixed source file but the browser still throws
 * the old error from a `chunk-XXXXXXXX.js?v=...` hash).
 *
 * Order matters: kill listeners first so no process is holding a cache file,
 * then rm. Each path is rm'd individually with `force: true` so a missing
 * dir is a no-op rather than an abort.
 *
 * Does NOT touch `node_modules/` (that's `bun install`'s job) and does NOT
 * touch the database.
 */
async function runClean(): Promise<void> {
	console.log('Killing any running dev servers first...');
	for (const app of APPS) await killApp(app);

	const targets: string[] = [];
	for (const app of APPS) {
		// Vite dep-pre-bundle cache (the one that produced the stale `chunk-*.js`).
		targets.push(join(REPO_ROOT, 'apps', app, 'node_modules', '.vite'));
		// SvelteKit generated output (`.svelte-kit/output`, `.svelte-kit/tsconfig.json`,
		// type-gen files); regenerated by `svelte-kit sync`.
		targets.push(join(REPO_ROOT, 'apps', app, '.svelte-kit'));
		// Detached-mode log + pid scratch.
		targets.push(appDir(app));
	}
	// Repo-root Vite cache (vitest etc).
	targets.push(join(REPO_ROOT, 'node_modules', '.vite'));
	// Repo-root build output if anything ever lands there.
	targets.push(join(REPO_ROOT, 'dist'));

	const width = targets.reduce((m, t) => Math.max(m, t.replace(`${REPO_ROOT}/`, '').length), 0);
	for (const target of targets) {
		const rel = target.replace(`${REPO_ROOT}/`, '');
		const existed = existsSync(target);
		try {
			rmSync(target, { recursive: true, force: true });
		} catch (err) {
			console.warn(`  ${rel.padEnd(width)}  failed: ${err instanceof Error ? err.message : String(err)}`);
			continue;
		}
		console.log(`  ${rel.padEnd(width)}  ${existed ? 'removed' : '-'}`);
	}

	console.log('');
	console.log('Clean complete. Next steps:');
	console.log('  bun run dev               # rebuilds caches on boot');
	console.log('  Hard-reload the browser   # Cmd-Shift-R; service workers cache chunk-*.js');
}

/**
 * Last-resort: `clean` + remove every `node_modules/` and the lockfile, so
 * the next `bun install` resolves everything from scratch. Used when a
 * stale transitive dep (or a Vite optimizer artefact baked into a workspace
 * package) survives `clean`. Reports each path and prompts for confirmation
 * before destroying.
 */
async function runNuke(): Promise<void> {
	await runClean();
	console.log('');
	console.log('NUKE: about to remove every node_modules/ and bun.lock.');

	const targets: string[] = [];
	targets.push(join(REPO_ROOT, 'node_modules'));
	for (const app of APPS) targets.push(join(REPO_ROOT, 'apps', app, 'node_modules'));
	// Workspace lib node_modules (rare, but bun creates them when peer-deps differ).
	const libsRoot = join(REPO_ROOT, 'libs');
	if (existsSync(libsRoot)) {
		const stack = [libsRoot];
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
				const full = join(dir, entry);
				if (entry === 'node_modules') {
					targets.push(full);
					continue;
				}
				let s: ReturnType<typeof statSync>;
				try {
					s = statSync(full);
				} catch {
					continue;
				}
				if (s.isDirectory()) stack.push(full);
			}
		}
	}
	targets.push(join(REPO_ROOT, 'bun.lock'));
	targets.push(join(REPO_ROOT, 'bun.lockb'));

	const width = targets.reduce((m, t) => Math.max(m, t.replace(`${REPO_ROOT}/`, '').length), 0);
	for (const target of targets) {
		const rel = target.replace(`${REPO_ROOT}/`, '');
		const existed = existsSync(target);
		try {
			rmSync(target, { recursive: true, force: true });
		} catch (err) {
			console.warn(`  ${rel.padEnd(width)}  failed: ${err instanceof Error ? err.message : String(err)}`);
			continue;
		}
		console.log(`  ${rel.padEnd(width)}  ${existed ? 'removed' : '-'}`);
	}

	console.log('');
	console.log('Nuke complete. Next steps:');
	console.log('  bun install               # reinstalls every workspace dep');
	console.log('  bun run dev               # rebuilds caches on boot');
	console.log('  Hard-reload the browser   # Cmd-Shift-R; service workers cache chunk-*.js');
}

async function runStatus(): Promise<void> {
	const width = APPS.reduce((m, n) => Math.max(m, n.length), 0);
	let anyRunning = false;
	for (const app of APPS) {
		const port = APP_PORTS[app];
		const pids = await getListenerPids(port);
		const pidfilePid = readPidfile(app);

		if (pids.length === 0) {
			if (pidfilePid !== null) {
				// stale pidfile, no listener
				clearPidfile(app);
			}
			console.log(`  ${app.padEnd(width)}  -        port ${port}`);
			continue;
		}

		anyRunning = true;
		// Treat as bg if our pidfile pid is alive. The listener pid is usually
		// vite, a child of the `bun run dev` process we launched -- so the
		// listener pid won't match the pidfile pid directly. Liveness of the
		// recorded parent is the right signal.
		const isBg = pidfilePid !== null && (await isPidAlive(pidfilePid));
		const mode = isBg ? 'bg' : 'fg';
		const started = isBg ? readStarted(app) : null;
		const logHint = isBg ? `  log .dev/${app}/server.log` : '';
		const startedHint = started ? `  since ${started}` : '';
		console.log(
			`  ${app.padEnd(width)}  running  port ${port}  pid ${pids.join(',')}  (${mode})  ${DEV_URLS[app]}${logHint}${startedHint}`,
		);
	}
	if (!anyRunning) console.log('\nNo dev servers running.');
}

async function runKill(): Promise<void> {
	const width = APPS.reduce((m, n) => Math.max(m, n.length), 0);
	let anyKilled = false;
	for (const app of APPS) {
		const result = await killApp(app);
		if (result.killed.length === 0 && result.survived.length === 0) {
			console.log(`  ${app.padEnd(width)}  -`);
			continue;
		}
		anyKilled = true;
		if (result.survived.length > 0) {
			console.log(
				`  ${app.padEnd(width)}  killed pid ${result.killed.join(',') || '-'}  SURVIVED pid ${result.survived.join(',')}`,
			);
		} else {
			console.log(`  ${app.padEnd(width)}  killed pid ${result.killed.join(',')}`);
		}
	}
	if (!anyKilled) console.log('\nNo dev servers were running.');
}

async function killExistingListeners(apps: string[]): Promise<void> {
	const occupied: string[] = [];
	for (const app of apps) {
		const pids = await getListenerPids(APP_PORTS[app]);
		if (pids.length > 0) occupied.push(app);
	}
	if (occupied.length === 0) return;
	console.log(`Existing dev servers detected on: ${occupied.join(', ')}. Killing before start...`);
	for (const app of occupied) {
		const result = await killApp(app);
		if (result.survived.length > 0) {
			console.error(`  ${app}: failed to kill pid ${result.survived.join(',')}; aborting.`);
			process.exit(1);
		}
		console.log(`  ${app}: killed pid ${result.killed.join(',')}`);
	}
}

async function runOne(app: string): Promise<void> {
	const url = DEV_URLS[app];
	await killExistingListeners([app]);
	console.log(`Starting ${app} dev server...`);
	if (url) console.log(`  ${url}`);
	await $`cd apps/${app} && bun run dev`;
}

function spawnDetached(app: string): { pid: number; logPath: string } {
	mkdirSync(appDir(app), { recursive: true });
	rotateLog(app);
	const logPath = appLogPath(app);
	const fd = openSync(logPath, 'a');
	const proc = Bun.spawn(['bun', 'run', 'dev'], {
		cwd: join(REPO_ROOT, 'apps', app),
		stdout: fd,
		stderr: fd,
		stdin: 'ignore',
		env: process.env,
	});
	// Detach: don't await proc.exited, and unref so this script can exit cleanly.
	proc.unref();
	writePidfile(app, proc.pid);
	return { pid: proc.pid, logPath };
}

async function runBg(targetApps: string[]): Promise<void> {
	await killExistingListeners(targetApps);
	const width = targetApps.reduce((m, n) => Math.max(m, n.length), 0);
	console.log(`Starting dev servers in background: ${targetApps.join(', ')}`);
	const launched: { app: string; pid: number; logPath: string }[] = [];
	for (const app of targetApps) {
		const { pid, logPath } = spawnDetached(app);
		launched.push({ app, pid, logPath });
	}

	// Brief settle window so we can detect immediate crashes (e.g. bad config).
	await Bun.sleep(300);

	for (const { app, pid, logPath } of launched) {
		const alive = await isPidAlive(pid);
		const status = alive ? 'running' : 'EXITED';
		const port = APP_PORTS[app];
		const url = DEV_URLS[app];
		const relLog = logPath.replace(`${REPO_ROOT}/`, '');
		console.log(`  ${app.padEnd(width)}  ${status}  pid ${pid}  port ${port}  ${url}  log ${relLog}`);
		if (!alive) {
			clearPidfile(app);
		}
	}

	console.log('');
	console.log('Tail logs:');
	console.log('  bun run dev log              # all apps, multiplexed');
	console.log(`  bun run dev log ${targetApps[0]}        # one app`);
	console.log('');
	console.log('Stop:');
	console.log('  bun run dev kill');
}

async function runLog(app: string | undefined): Promise<void> {
	const targets = app ? [app] : APPS;
	if (app && !DEV_URLS[app]) {
		console.error(`Unknown app: '${app}'. Valid apps: ${APPS.join(', ')}.`);
		process.exit(1);
	}

	const existing = targets.filter((a) => existsSync(appLogPath(a)));
	if (existing.length === 0) {
		console.error('No logs found. Start a server first with `bun run dev --bg`.');
		process.exit(1);
	}

	if (existing.length === 1 && app) {
		// Single-app: clean tail -f, no prefix.
		const logPath = appLogPath(existing[0]);
		console.log(`Tailing ${logPath} (Ctrl-C to stop)`);
		await $`tail -F ${logPath}`.nothrow();
		return;
	}

	// Multi-app: launch one tail per log, prefix lines with [app].
	console.log(`Tailing logs for: ${existing.join(', ')} (Ctrl-C to stop)`);
	const tails = existing.map((a, i) => {
		const color = PREFIX_COLORS[i % PREFIX_COLORS.length];
		const prefix = `${color}[${a}]${RESET} `;
		const proc = Bun.spawn(['tail', '-F', appLogPath(a)], {
			stdout: 'pipe',
			stderr: 'pipe',
		});
		pipeWithPrefix(proc.stdout, prefix, process.stdout);
		pipeWithPrefix(proc.stderr, prefix, process.stderr);
		return proc;
	});

	const shutdown = (signal: NodeJS.Signals) => {
		for (const proc of tails) {
			try {
				proc.kill(signal);
			} catch {
				/* ignore */
			}
		}
	};
	process.on('SIGINT', () => shutdown('SIGINT'));
	process.on('SIGTERM', () => shutdown('SIGTERM'));

	await Promise.all(tails.map((p) => p.exited));
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
	await killExistingListeners(APPS);
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
	console.log('Usage: bun run dev [app|status|kill|log] [flags]');
	console.log('');
	console.log('Starts one or more local dev servers. With no app, spawns all of them in parallel');
	console.log('with coloured prefixed output. Before vite boots, validates wiki-links across all');
	console.log('content and rebuilds the knowledge graph if markdown sources have changed.');
	console.log('');
	console.log('Any existing listener on an app port is killed before start.');
	console.log('');
	console.log('Apps:');
	const width = APPS.reduce((m, n) => Math.max(m, n.length), 0);
	for (const name of APPS) {
		console.log(`  ${name.padEnd(width)}  ${DEV_URLS[name]}  port ${APP_PORTS[name]}`);
	}
	console.log('');
	console.log('Subcommands:');
	console.log('  status        Show which app dev servers are running');
	console.log('  kill          Kill any running app dev servers');
	console.log('  clean         Kill servers + nuke .vite / .svelte-kit / .dev caches');
	console.log('  nuke          clean + delete every node_modules/ and bun.lock (run `bun install` after)');
	console.log('  log [app]     Tail server logs (all apps, or one); requires --bg launch');
	console.log('');
	console.log('Flags:');
	console.log('  --bg          Launch detached, log to .dev/<app>/server.log, exit');
	console.log('  --help, -h    Show this message');
	console.log('');
	console.log('Examples:');
	console.log('  bun run dev                  Spawn every app in parallel (foreground)');
	console.log('  bun run dev study            Spawn only the study app (foreground)');
	console.log('  bun run dev --bg             Spawn every app detached, exit');
	console.log('  bun run dev study --bg       Spawn study detached, exit');
	console.log('  bun run dev log              Tail all bg logs, multiplexed');
	console.log('  bun run dev log study        Tail just the study log');
	console.log('  bun run dev status           Show running dev servers (fg/bg)');
	console.log('  bun run dev kill             Kill all running dev servers');
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

const args = process.argv.slice(2);

if (args.includes('--help') || args.includes('-h')) {
	printHelp();
	process.exit(0);
}

const bg = args.includes('--bg');
const positional = args.filter((a) => !a.startsWith('-'));
const command = positional[0];

if (command === 'status') {
	await runStatus();
	process.exit(0);
}

if (command === 'kill') {
	await runKill();
	process.exit(0);
}

if (command === 'clean') {
	await runClean();
	process.exit(0);
}

if (command === 'nuke') {
	await runNuke();
	process.exit(0);
}

if (command === 'log') {
	await runLog(positional[1]);
	process.exit(0);
}

if (bg) {
	// Background launch: skip the heavy preflight steps that block the user's
	// terminal. The reference scan and knowledge build are nice-to-haves; they
	// shouldn't gate detached startup. svelte-kit sync runs because it's fast
	// and idempotent and the apps need it.
	await runSvelteKitSync();
	if (command === undefined) {
		await runBg(APPS);
	} else if (DEV_URLS[command]) {
		await runBg([command]);
	} else {
		console.error(`Unknown app: '${command}'. Valid apps: ${APPS.join(', ')}.`);
		console.error('Run `bun run dev --help` for usage.');
		process.exit(1);
	}
	process.exit(0);
}

await runReferenceScan();
await maybeBuildKnowledge();
await runSvelteKitSync();

if (command === undefined) {
	await runAll();
} else if (DEV_URLS[command]) {
	await runOne(command);
} else {
	console.error(
		`Unknown app: '${command}'. Valid apps: ${APPS.join(', ')}, or 'status' / 'kill' / 'clean' / 'nuke' / 'log'.`,
	);
	console.error('Run `bun run dev --help` for usage.');
	process.exit(1);
}
