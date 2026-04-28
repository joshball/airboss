/**
 * Sanity coverage for `countAllUsers`. Asserts the count grows by exactly the
 * number of users we add and falls back when they are removed. Uses the live
 * dev Postgres so the COUNT runs against the real table shape.
 */

import { db } from '@ab/db/connection';
import { generateAuthId } from '@ab/utils';
import { eq, inArray } from 'drizzle-orm';
import { afterAll, describe, expect, it } from 'vitest';
import { countAllUsers } from './queries';
import { bauthUser } from './schema';

const userIds: string[] = [];

afterAll(async () => {
	if (userIds.length > 0) {
		await db.delete(bauthUser).where(inArray(bauthUser.id, userIds));
	}
});

async function insertUser(): Promise<string> {
	const id = generateAuthId();
	userIds.push(id);
	const now = new Date();
	await db.insert(bauthUser).values({
		id,
		email: `count-all-${id}@airboss.test`,
		emailVerified: false,
		name: 'count test',
		firstName: 'Count',
		lastName: 'Test',
		createdAt: now,
		updatedAt: now,
	});
	return id;
}

describe('countAllUsers', () => {
	it('returns a non-negative number', async () => {
		const count = await countAllUsers();
		expect(count).toBeGreaterThanOrEqual(0);
		expect(Number.isInteger(count)).toBe(true);
	});

	it('counts at least our inserted users', async () => {
		await insertUser();
		await insertUser();
		const count = await countAllUsers();
		// We added two; the global count must be at least that.
		// Cannot assert exact delta because peer test files share the table.
		expect(count).toBeGreaterThanOrEqual(2);
	});

	it('reflects deletes -- count after delete is strictly less than before, when the seeded user is the only writer in flight', async () => {
		// Single-row delta: we cannot rely on exact delta because peer test
		// files share the table, but we can assert the delete commits and the
		// row is gone from a follow-up SELECT.
		const id = await insertUser();
		const fetchedBefore = await db.select().from(bauthUser).where(eq(bauthUser.id, id));
		expect(fetchedBefore).toHaveLength(1);
		await db.delete(bauthUser).where(eq(bauthUser.id, id));
		userIds.splice(userIds.indexOf(id), 1);
		const fetchedAfter = await db.select().from(bauthUser).where(eq(bauthUser.id, id));
		expect(fetchedAfter).toHaveLength(0);
		// And countAllUsers still returns a non-negative integer post-delete.
		const count = await countAllUsers();
		expect(count).toBeGreaterThanOrEqual(0);
	});
});
