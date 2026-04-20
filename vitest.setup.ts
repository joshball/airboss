/**
 * Vitest setup -- load the dev `.env` into `process.env` before any test
 * module is imported.
 *
 * vite only exposes `VITE_`-prefixed env vars to `import.meta.env`; our
 * libs read raw `process.env` (DATABASE_URL, BETTER_AUTH_SECRET, ...) and
 * drizzle-orm/postgres-js errors out at import time when DATABASE_URL is
 * missing. This mirrors how `bun` auto-loads `.env` when running scripts.
 */

import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

function loadEnvFile(path: string): void {
	let raw: string;
	try {
		raw = readFileSync(path, 'utf8');
	} catch {
		return;
	}
	for (const line of raw.split('\n')) {
		const trimmed = line.trim();
		if (trimmed.length === 0 || trimmed.startsWith('#')) continue;
		const eq = trimmed.indexOf('=');
		if (eq === -1) continue;
		const key = trimmed.slice(0, eq).trim();
		let value = trimmed.slice(eq + 1).trim();
		// Strip surrounding quotes if present.
		if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
			value = value.slice(1, -1);
		}
		// Do not overwrite anything that's already in the environment -- the
		// shell wins, the file fills in the rest.
		if (process.env[key] === undefined) {
			process.env[key] = value;
		}
	}
}

loadEnvFile(resolve(process.cwd(), '.env'));
