#!/usr/bin/env bun

/**
 * Database management for airboss.
 *
 * Usage: bun run db <command> [flags]
 *
 * Run `bun run db help` for the full list of commands.
 */

import { DEV_DB, DEV_DB_HOST_PATTERN, DEV_DB_URL, ENV_VARS, isProd, PORTS, SCHEMAS } from '../libs/constants/src/index';

const CONTAINER = 'airboss-db';
const DB_URL = process.env[ENV_VARS.DATABASE_URL] ?? DEV_DB_URL;
const DB_USER = DEV_DB.USER;
const DB_NAME = DEV_DB.NAME;

const args = process.argv.slice(2);
const command = args.find((a) => !a.startsWith('-'));
const flags = new Set(args.filter((a) => a.startsWith('-')));
const force = flags.has('--force') || flags.has('-f');
const help = flags.has('--help') || flags.has('-h');

async function run(cmd: string[]): Promise<void> {
	console.log(`> ${cmd.join(' ')}`);
	const proc = Bun.spawn(cmd, { stdio: ['inherit', 'inherit', 'inherit'] });
	const code = await proc.exited;
	if (code !== 0) process.exit(code);
}

async function query(sql: string): Promise<string> {
	const proc = Bun.spawn(['docker', 'exec', CONTAINER, 'psql', '-U', DB_USER, '-d', DB_NAME, '-t', '-A', '-c', sql], {
		stdout: 'pipe',
		stderr: 'pipe',
	});
	const text = await new Response(proc.stdout).text();
	await proc.exited;
	return text.trim();
}

async function prompt(message: string): Promise<string> {
	process.stdout.write(message);
	for await (const line of console) {
		return line;
	}
	return '';
}

function assertLocalDb(): void {
	if (isProd() || !DEV_DB_HOST_PATTERN.test(DB_URL)) {
		console.error('Refusing to mutate DB: DATABASE_URL does not point at a local dev database');
		process.exit(1);
	}
}

async function confirmOrAbort(message: string): Promise<void> {
	if (force) return;
	const answer = await prompt(`${message} [y/N] `);
	if (answer.trim().toLowerCase() !== 'y') {
		console.log('Aborted.');
		process.exit(0);
	}
}

async function doReset(): Promise<void> {
	assertLocalDb();
	await confirmOrAbort(`This will DROP and recreate "${DB_NAME}". Continue?`);
	await run([
		'docker',
		'exec',
		CONTAINER,
		'psql',
		'-U',
		DB_USER,
		'-d',
		'postgres',
		'-c',
		`DROP DATABASE IF EXISTS ${DB_NAME};`,
	]);
	await run([
		'docker',
		'exec',
		CONTAINER,
		'psql',
		'-U',
		DB_USER,
		'-d',
		'postgres',
		'-c',
		`CREATE DATABASE ${DB_NAME};`,
	]);
	await run(['bunx', 'drizzle-kit', 'push']);
	await run(['bun', 'scripts/db/seed-dev-users.ts']);
}

async function doResetStudy(): Promise<void> {
	assertLocalDb();
	await confirmOrAbort('This will TRUNCATE study.card, study.card_state, study.review. Continue?');
	await run(['bun', 'scripts/db/reset-study.ts']);
}

async function showStatus(): Promise<void> {
	console.log('\n--- DB STATUS ---');
	console.log(`Container : ${CONTAINER}`);
	console.log(`Port      : ${PORTS.DB}`);
	console.log(`URL       : ${DB_URL}`);
	console.log(`\npsql      : docker exec -it ${CONTAINER} psql -U ${DB_USER} -d ${DB_NAME}`);

	const containerProc = Bun.spawn(['docker', 'inspect', '--format', '{{.State.Status}}', CONTAINER], {
		stdout: 'pipe',
		stderr: 'pipe',
	});
	const containerStatus = (await new Response(containerProc.stdout).text()).trim();
	await containerProc.exited;
	console.log(`\nContainer : ${containerStatus || 'not found'}`);
	if (containerStatus !== 'running') {
		console.log('DB is not running. Start it with: bun run db up');
		return;
	}

	const schemas = await query(
		"SELECT string_agg(schema_name, ', ' ORDER BY schema_name) FROM information_schema.schemata WHERE schema_name NOT IN ('information_schema', 'pg_catalog', 'pg_toast') AND schema_name NOT LIKE 'pg_%'",
	);
	console.log(`Schemas   : ${schemas || '(none)'}`);

	console.log('\n--- TABLE COUNTS ---');
	const tables: Array<[string, string]> = [
		['public.bauth_user', 'users'],
		[`${SCHEMAS.STUDY}.card`, 'cards'],
		[`${SCHEMAS.STUDY}.card_state`, 'card_states'],
		[`${SCHEMAS.STUDY}.review`, 'reviews'],
		[`${SCHEMAS.STUDY}.knowledge_node`, 'knowledge_nodes'],
		[`${SCHEMAS.STUDY}.knowledge_edge`, 'knowledge_edges'],
	];
	for (const [table, label] of tables) {
		const count = await query(`SELECT COUNT(*) FROM ${table}`).catch(() => '');
		console.log(`  ${label.padEnd(18)}: ${count || 'N/A (table missing)'}`);
	}
	console.log('');
}

function showHelp(): void {
	console.log(`Usage: bun run db <command> [flags]

Commands:
  status            Show DB connection info and table counts (default)
  up                Start the postgres container (docker compose up -d db)
  down              Stop containers (docker compose down)
  push              Run drizzle-kit push (sync schema -> DB)
  generate          Run drizzle-kit generate
  migrate           Run drizzle-kit migrate
  studio            Run drizzle-kit studio
  seed              Seed dev users (idempotent)
  reset             DROP + recreate DB, push schema, seed dev users
  reset-study       TRUNCATE study.* tables (keeps auth users)
  psql              Open a psql shell in the DB container
  help              Show this help

Flags:
  --force, -f       Skip confirmation prompts
  --help, -h        Show this help`);
}

if (help) {
	showHelp();
	process.exit(0);
}

const handlers: Record<string, () => Promise<void> | void> = {
	status: showStatus,
	help: showHelp,
	up: () => run(['docker', 'compose', 'up', '-d', 'db']),
	down: () => run(['docker', 'compose', 'down']),
	push: () => run(['bunx', 'drizzle-kit', 'push']),
	generate: () => run(['bunx', 'drizzle-kit', 'generate']),
	migrate: () => run(['bunx', 'drizzle-kit', 'migrate']),
	studio: () => run(['bunx', 'drizzle-kit', 'studio']),
	seed: () => run(['bun', 'scripts/db/seed-dev-users.ts']),
	psql: () => run(['docker', 'exec', '-it', CONTAINER, 'psql', '-U', DB_USER, '-d', DB_NAME]),
	reset: doReset,
	'reset-study': doResetStudy,
};

const handler = command ? handlers[command] : handlers.status;
if (!handler) {
	console.error(`Unknown command: ${command}\n`);
	showHelp();
	process.exit(1);
}

await handler();
