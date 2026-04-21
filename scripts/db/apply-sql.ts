#!/usr/bin/env bun
/**
 * Apply a .sql file to the dev database.
 *
 * Used for migrations the Drizzle DSL does not express cleanly (partial
 * UNIQUE indexes, function definitions, etc). Accepts a path relative to
 * the repo root and runs the file's contents through the shared `@ab/db`
 * connection. Idempotent SQL is the caller's responsibility -- these scripts
 * run on every setup so they must all be `CREATE ... IF NOT EXISTS` or
 * equivalent.
 */

import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { db } from '@ab/db';
import { sql } from 'drizzle-orm';

const argPath = process.argv[2];
if (!argPath) {
	console.error('Usage: bun scripts/db/apply-sql.ts <path-to-sql-file>');
	process.exit(1);
}

const filePath = resolve(process.cwd(), argPath);
const text = readFileSync(filePath, 'utf8');

await db.execute(sql.raw(text));

console.log(`Applied ${filePath}`);
process.exit(0);
