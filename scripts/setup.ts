/**
 * One-shot local setup:
 *   1. verify /etc/hosts maps the airboss.test subdomains to 127.0.0.1
 *   2. install deps
 *   3. ensure .env exists (copy from .env.example, generate a
 *      BETTER_AUTH_SECRET)
 *   4. start the DB container
 *   5. wait for DB ready
 *   6. push the schema
 *   7. seed the dev users
 *
 * Safe to re-run: each step is idempotent.
 *
 * Run: bun scripts/setup.ts
 */

import { $ } from 'bun';
import { randomBytes } from 'node:crypto';
import dns from 'node:dns/promises';
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { HOSTS } from '@ab/constants/hosts';

const ENV_PATH = '.env';
const ENV_EXAMPLE_PATH = '.env.example';
const HOSTS_PATH = '/etc/hosts';

/** Hosts the dev environment expects to resolve to 127.0.0.1. */
const DEV_HOSTS = Object.values(HOSTS) as readonly string[];

async function step(name: string, fn: () => Promise<void>): Promise<void> {
	const start = Date.now();
	process.stdout.write(`• ${name}... `);
	try {
		await fn();
		const ms = Date.now() - start;
		process.stdout.write(`\x1b[32mdone\x1b[0m (${ms}ms)\n`);
	} catch (err) {
		process.stdout.write('\x1b[31mfailed\x1b[0m\n');
		throw err;
	}
}

async function resolvesToLocalhost(host: string): Promise<boolean> {
	try {
		const addrs = await dns.lookup(host, { all: true });
		return addrs.some((a) => a.address === '127.0.0.1' || a.address === '::1');
	} catch {
		return false;
	}
}

async function checkHostsEntries(): Promise<void> {
	const missing: string[] = [];
	for (const host of DEV_HOSTS) {
		const ok = await resolvesToLocalhost(host);
		if (!ok) missing.push(host);
	}
	if (missing.length === 0) return;

	const lines = missing.map((h) => `127.0.0.1 ${h}`).join('\n');
	const cmd = `printf '%s\\n' ${missing.map((h) => `"127.0.0.1 ${h}"`).join(' ')} | sudo tee -a ${HOSTS_PATH}`;
	throw new Error(
		[
			'',
			`Missing /etc/hosts entries for: ${missing.join(', ')}`,
			'',
			`Add this line${missing.length > 1 ? 's' : ''} to ${HOSTS_PATH}:`,
			lines,
			'',
			'Copy-paste:',
			`  ${cmd}`,
			'',
			'Then re-run: bun run setup',
		].join('\n'),
	);
}

async function ensureEnv(): Promise<void> {
	if (existsSync(ENV_PATH)) return;
	if (!existsSync(ENV_EXAMPLE_PATH)) {
		throw new Error(`${ENV_EXAMPLE_PATH} is missing; cannot bootstrap ${ENV_PATH}`);
	}
	const template = readFileSync(ENV_EXAMPLE_PATH, 'utf8');
	const secret = randomBytes(32).toString('base64');
	const withSecret = template.replace(/^BETTER_AUTH_SECRET=.*$/m, `BETTER_AUTH_SECRET=${secret}`);
	writeFileSync(ENV_PATH, withSecret);
}

async function waitForDb(): Promise<void> {
	const deadline = Date.now() + 30_000;
	while (Date.now() < deadline) {
		const result = await $`docker exec airboss-db pg_isready -U airboss`.nothrow().quiet();
		if (result.exitCode === 0) return;
		await Bun.sleep(500);
	}
	throw new Error('Postgres did not become ready within 30s');
}

async function main(): Promise<void> {
	console.log('airboss setup\n-----');

	await step('verify /etc/hosts', checkHostsEntries);

	await step('install deps', async () => {
		await $`bun install`.quiet();
	});

	await step('ensure .env', ensureEnv);

	await step('start db container', async () => {
		await $`docker compose up -d db`.quiet();
	});

	await step('wait for db', waitForDb);

	await step('push schema', async () => {
		await $`bunx drizzle-kit push`.quiet();
	});

	await step('seed dev users', async () => {
		await $`bun scripts/db/seed-dev-users.ts`.quiet();
	});

	console.log('-----\nReady. Start the app with: \x1b[1mbun run dev\x1b[0m');
	console.log(`Then open \x1b[1mhttp://${HOSTS.STUDY}:9600\x1b[0m and sign in as joshua@ball.dev / Pa33word!`);
}

main().catch((err) => {
	console.error(err instanceof Error ? err.message : err);
	process.exit(1);
});
