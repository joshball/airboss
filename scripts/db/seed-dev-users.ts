/**
 * Seed dev users into better-auth tables.
 *
 * Uses DEV_ACCOUNTS from @ab/constants with DEV_PASSWORD, hashed via
 * better-auth's scrypt implementation. Idempotent -- safe to re-run.
 *
 * Refuses to run unless DATABASE_URL points at a local dev database, to prevent
 * accidentally planting the hard-coded admin account into a production DB.
 *
 * Run: bun scripts/db/seed-dev-users.ts
 */

import { bauthAccount, bauthUser } from '@ab/auth/schema';
import {
	BETTER_AUTH_PROVIDERS,
	DEV_ACCOUNTS,
	DEV_DB_HOST_PATTERN,
	DEV_DB_URL,
	DEV_PASSWORD,
	ENV_VARS,
	isProd,
} from '@ab/constants';
import { generateAuthId } from '@ab/utils/ids';
import { and, eq } from 'drizzle-orm';
import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';

const connectionString = process.env[ENV_VARS.DATABASE_URL] ?? DEV_DB_URL;

// Guard: refuse to seed anything that isn't clearly a local dev database.
if (isProd() || !DEV_DB_HOST_PATTERN.test(connectionString)) {
	console.error('Refusing to seed dev users: DATABASE_URL does not point at a local dev database');
	console.error('  (expected localhost/127.0.0.1/airboss-db host, and NODE_ENV !== production)');
	process.exit(1);
}

const client = postgres(connectionString);
const db = drizzle(client);

async function seedDevUsers(): Promise<void> {
	console.log('Seeding dev users...');

	const { hashPassword } = await import('better-auth/crypto');
	const now = new Date();

	for (const account of DEV_ACCOUNTS) {
		const existingUser = await db
			.select({ id: bauthUser.id })
			.from(bauthUser)
			.where(eq(bauthUser.email, account.email))
			.limit(1);

		const userId = existingUser[0]?.id ?? generateAuthId();

		if (!existingUser[0]) {
			await db.insert(bauthUser).values({
				id: userId,
				email: account.email,
				name: account.name,
				firstName: account.firstName,
				lastName: account.lastName,
				emailVerified: true,
				role: account.role,
				createdAt: now,
				updatedAt: now,
			});
		}

		const existingAccount = await db
			.select({ id: bauthAccount.id })
			.from(bauthAccount)
			.where(and(eq(bauthAccount.userId, userId), eq(bauthAccount.providerId, BETTER_AUTH_PROVIDERS.CREDENTIAL)))
			.limit(1);

		if (!existingAccount[0]) {
			// better-auth's scrypt uses a per-call random salt, so hash per user
			// rather than sharing a single hash string across rows.
			const hashedPassword = await hashPassword(DEV_PASSWORD);
			await db.insert(bauthAccount).values({
				id: generateAuthId(),
				userId,
				accountId: userId,
				providerId: BETTER_AUTH_PROVIDERS.CREDENTIAL,
				password: hashedPassword,
				createdAt: now,
				updatedAt: now,
			});
		}

		const created = !existingUser[0];
		const repaired = existingUser[0] && !existingAccount[0];
		const status = created ? 'created' : repaired ? 'repaired' : 'exists';
		console.log(`  ${status.padEnd(8)} ${account.email} (${account.role})`);
	}
}

async function main(): Promise<void> {
	try {
		await seedDevUsers();
		console.log('\nSeed complete.');
	} catch (err) {
		console.error('Seed failed:', err);
		process.exitCode = 1;
	} finally {
		await client.end();
		process.exit(process.exitCode ?? 0);
	}
}

void main();
