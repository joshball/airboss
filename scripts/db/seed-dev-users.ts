/**
 * Seed dev users into better-auth tables.
 *
 * Uses DEV_ACCOUNTS from @ab/constants with DEV_PASSWORD, hashed via
 * better-auth's scrypt implementation. Idempotent -- safe to re-run.
 *
 * Run: bun scripts/db/seed-dev-users.ts
 */

import { eq } from 'drizzle-orm';
import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import { bauthAccount, bauthUser } from '../../libs/auth/src/schema';
import { DEV_ACCOUNTS, DEV_PASSWORD, PORTS } from '../../libs/constants/src/index';
import { generateAuthId } from '../../libs/utils/src/ids';

const connectionString = process.env.DATABASE_URL ?? `postgresql://airboss:airboss@localhost:${PORTS.DB}/airboss`;
const client = postgres(connectionString);
const db = drizzle(client);

async function seedDevUsers(): Promise<void> {
	console.log('Seeding dev users...');

	const { hashPassword } = await import('better-auth/crypto');
	const hashedPassword = await hashPassword(DEV_PASSWORD);
	const now = new Date();

	for (const account of DEV_ACCOUNTS) {
		const existing = await db
			.select({ id: bauthUser.id })
			.from(bauthUser)
			.where(eq(bauthUser.email, account.email))
			.limit(1);

		const userId = existing[0]?.id ?? generateAuthId();

		if (!existing[0]) {
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

			await db.insert(bauthAccount).values({
				id: generateAuthId(),
				userId,
				accountId: userId,
				providerId: 'credential',
				password: hashedPassword,
				createdAt: now,
				updatedAt: now,
			});

			console.log(`  created: ${account.email} (${account.role})`);
		} else {
			console.log(`  exists:  ${account.email} (${account.role})`);
		}
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
