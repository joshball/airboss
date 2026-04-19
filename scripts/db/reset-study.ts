/**
 * Reset the study tables (cards, reviews, card_state) in the local dev DB.
 * Preserves the auth tables so you stay logged in as the dev user.
 *
 * Run: bun scripts/db/reset-study.ts
 */

import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import { DEV_DB_HOST_PATTERN, DEV_DB_URL, ENV_VARS, isProd } from '../../libs/constants/src/index';

const connectionString = process.env[ENV_VARS.DATABASE_URL] ?? DEV_DB_URL;

if (isProd() || !DEV_DB_HOST_PATTERN.test(connectionString)) {
	console.error('Refusing to reset study tables: DATABASE_URL does not point at a local dev database');
	process.exit(1);
}

const client = postgres(connectionString);
const db = drizzle(client);

async function main(): Promise<void> {
	try {
		console.log('Truncating study.review, study.card_state, study.card...');
		await db.execute('TRUNCATE study.review, study.card_state, study.card CASCADE');
		console.log('Study tables reset.');
	} catch (err) {
		console.error('Reset failed:', err);
		process.exitCode = 1;
	} finally {
		await client.end();
		process.exit(process.exitCode ?? 0);
	}
}

void main();
