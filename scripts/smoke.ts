#!/usr/bin/env bun

/**
 * Smoke test dispatcher for airboss.
 *
 * Usage: bun run smoke [name] [args...]
 *
 * With no arguments, lists available smokes by scanning scripts/smoke/.
 * Otherwise runs `bun scripts/smoke/<name>.ts` with any trailing args.
 */

import { readdirSync } from 'node:fs';
import { join } from 'node:path';
import { run } from './lib/spawn';

const SMOKE_DIR = join(import.meta.dir, 'smoke');

const args = process.argv.slice(2);
const first = args[0];
const helpFlags = new Set(['help', '-h', '--help']);

function listSmokes(): string[] {
	return readdirSync(SMOKE_DIR)
		.filter((name) => name.endsWith('.ts'))
		.map((name) => name.slice(0, -3))
		.sort();
}

function printAvailable(): void {
	const smokes = listSmokes();
	if (smokes.length === 0) {
		console.log('No smokes found in scripts/smoke/.');
		return;
	}
	console.log('Available smokes:');
	for (const name of smokes) {
		console.log(`  ${name}  (scripts/smoke/${name}.ts)`);
	}
}

function showHelp(): void {
	console.log(`Usage: bun run smoke [name] [args...]

With no arguments, lists available smokes.
Otherwise runs scripts/smoke/<name>.ts with any trailing args.
`);
	printAvailable();
}

if (!first) {
	printAvailable();
	process.exit(0);
}

if (helpFlags.has(first)) {
	showHelp();
	process.exit(0);
}

const smokes = listSmokes();
if (!smokes.includes(first)) {
	console.error(`Unknown smoke: ${first}\n`);
	printAvailable();
	process.exit(1);
}

await run(['bun', `scripts/smoke/${first}.ts`, ...args.slice(1)]);
