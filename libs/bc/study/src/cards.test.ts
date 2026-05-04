/**
 * Cards BC integration tests. Real Postgres -- exercises the
 * transactional invariants the per-call rollback path depends on.
 *
 * The headline assertion in this suite is `updateCard`'s atomicity:
 * the function patches `card` and sweeps `card_snooze` rows in two
 * statements. Both have to land or neither does, otherwise a partial
 * failure produces a card whose content has changed but whose stale
 * `bad-question` snooze rows still claim "the question is fine."
 *
 * The atomicity test wraps `db.transaction` to run the BC's writes,
 * then forces a rollback inside the same SQL transaction. If the
 * function lifted any write outside its declared transaction, that
 * write would survive the rollback and the post-condition assertion
 * would fail. The forced-rollback proxy proves the contract without
 * needing to inject a runtime fault into either UPDATE.
 */

import { bauthUser } from '@ab/auth/schema';
import { CARD_STATES, CARD_STATUSES, CARD_TYPES, CONTENT_SOURCES, DOMAINS, SNOOZE_REASONS } from '@ab/constants';
import { db } from '@ab/db/connection';
import { generateAuthId, generateCardId, generateCardSnoozeId } from '@ab/utils';
import { and, eq } from 'drizzle-orm';
import type { PgDatabase, PgQueryResultHKT } from 'drizzle-orm/pg-core';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { CardNotEditableError, CardNotFoundError, updateCard } from './cards';
import { card, cardSnooze, cardState } from './schema';

type Db = PgDatabase<PgQueryResultHKT, Record<string, never>>;

const TEST_USER_ID = generateAuthId();
const TEST_EMAIL = `cards-bc-${TEST_USER_ID}@airboss.test`;

beforeAll(async () => {
	const now = new Date();
	await db.insert(bauthUser).values({
		id: TEST_USER_ID,
		email: TEST_EMAIL,
		name: 'Cards BC Test',
		firstName: 'Cards',
		lastName: 'Test',
		emailVerified: true,
		role: 'learner',
		createdAt: now,
		updatedAt: now,
	});
});

afterAll(async () => {
	await db.delete(cardSnooze).where(eq(cardSnooze.userId, TEST_USER_ID));
	await db.delete(cardState).where(eq(cardState.userId, TEST_USER_ID));
	await db.delete(card).where(eq(card.userId, TEST_USER_ID));
	await db.delete(bauthUser).where(eq(bauthUser.id, TEST_USER_ID));
});

async function seedCard(
	opts: { id?: string; front?: string; back?: string; isEditable?: boolean } = {},
): Promise<string> {
	const id = opts.id ?? generateCardId();
	const now = new Date();
	await db.insert(card).values({
		id,
		userId: TEST_USER_ID,
		front: opts.front ?? 'before front',
		back: opts.back ?? 'before back',
		domain: DOMAINS.AERODYNAMICS,
		tags: [],
		cardType: CARD_TYPES.BASIC,
		sourceType: CONTENT_SOURCES.PERSONAL,
		sourceRef: null,
		nodeId: null,
		isEditable: opts.isEditable ?? true,
		status: CARD_STATUSES.ACTIVE,
		createdAt: now,
		updatedAt: now,
	});
	await db.insert(cardState).values({
		cardId: id,
		userId: TEST_USER_ID,
		stability: 1,
		difficulty: 5,
		state: CARD_STATES.NEW,
		dueAt: now,
		lastReviewId: null,
		lastReviewedAt: null,
		reviewCount: 0,
		lapseCount: 0,
	});
	return id;
}

async function seedActiveBadQuestionSnooze(cardId: string): Promise<string> {
	const id = generateCardSnoozeId();
	const now = new Date();
	await db.insert(cardSnooze).values({
		id,
		cardId,
		userId: TEST_USER_ID,
		reason: SNOOZE_REASONS.BAD_QUESTION,
		comment: 'wording is unclear',
		durationLevel: null,
		snoozeUntil: null,
		resolvedAt: null,
		cardEditedAt: null,
		createdAt: now,
		updatedAt: now,
	});
	return id;
}

/**
 * Wrap `db.transaction(cb)` so that after `cb` resolves, the SQL
 * transaction is forced to roll back. If the BC under test ran any
 * write outside its declared transaction, that write survives the
 * rollback -- letting the test assert atomicity by post-condition.
 *
 * The wrapper preserves the BC's return value -- the outer call
 * resolves with `cb`'s return type -- so call sites under test see
 * the success-path code path even though the SQL state was rolled
 * back. The test reads the DB directly to verify nothing landed.
 */
function dbWithForcedRollback(realDb: Db): Db {
	return new Proxy(realDb, {
		get(target, prop, receiver) {
			if (prop === 'transaction') {
				return async <T>(cb: (tx: Db) => Promise<T>): Promise<T> => {
					let resolved: { value: T } | null = null;
					try {
						await target.transaction(async (tx) => {
							resolved = { value: await cb(tx as unknown as Db) };
							// Force a rollback by throwing an uncatchable-by-cb
							// sentinel after the BC's writes have completed.
							throw new ForcedRollback();
						});
					} catch (err) {
						if (!(err instanceof ForcedRollback)) throw err;
					}
					if (resolved === null) {
						throw new Error('forced-rollback wrapper never observed BC return');
					}
					return resolved.value;
				};
			}
			return Reflect.get(target, prop, receiver);
		},
	}) as Db;
}

class ForcedRollback extends Error {
	constructor() {
		super('forced-rollback');
		this.name = 'ForcedRollback';
	}
}

describe('updateCard', () => {
	it('patches editable fields on a personal card', async () => {
		const cardId = await seedCard({ front: 'before', back: 'back' });
		const updated = await updateCard(cardId, TEST_USER_ID, { front: 'after', tags: ['edited'] });
		expect(updated.front).toBe('after');
		expect(updated.tags).toEqual(['edited']);

		const [persisted] = await db.select().from(card).where(eq(card.id, cardId)).limit(1);
		expect(persisted?.front).toBe('after');
		expect(persisted?.tags).toEqual(['edited']);
	});

	it('throws CardNotFoundError when the id does not belong to the user', async () => {
		const ghostId = generateCardId();
		await expect(updateCard(ghostId, TEST_USER_ID, { front: 'noop' })).rejects.toBeInstanceOf(CardNotFoundError);
	});

	it('throws CardNotEditableError when the card is course-provided', async () => {
		const cardId = await seedCard({ isEditable: false });
		await expect(updateCard(cardId, TEST_USER_ID, { front: 'tried' })).rejects.toBeInstanceOf(CardNotEditableError);
	});

	it('marks active bad-question snoozes when content changes', async () => {
		const cardId = await seedCard({ front: 'old front' });
		const snoozeId = await seedActiveBadQuestionSnooze(cardId);

		await updateCard(cardId, TEST_USER_ID, { front: 'new front' });

		const [snooze] = await db.select().from(cardSnooze).where(eq(cardSnooze.id, snoozeId)).limit(1);
		expect(snooze?.cardEditedAt).toBeInstanceOf(Date);
		expect(snooze?.snoozeUntil).toBeInstanceOf(Date);
	});

	it('leaves snoozes alone when the patch carries no content fields', async () => {
		const cardId = await seedCard();
		const snoozeId = await seedActiveBadQuestionSnooze(cardId);

		await updateCard(cardId, TEST_USER_ID, {});

		const [snooze] = await db.select().from(cardSnooze).where(eq(cardSnooze.id, snoozeId)).limit(1);
		expect(snooze?.cardEditedAt).toBeNull();
		expect(snooze?.snoozeUntil).toBeNull();
	});

	// ---------------------------------------------------------------------
	// Atomicity: the card UPDATE and the snooze sweep have to share one
	// SQL transaction. If either lifts outside, a partial failure leaves
	// the card content patched while stale snooze rows still claim the
	// card is bad -- the re-entry banner never fires.
	// ---------------------------------------------------------------------
	it('rolls back the card UPDATE when the surrounding transaction fails', async () => {
		const cardId = await seedCard({ front: 'pristine front', back: 'pristine back' });
		const snoozeId = await seedActiveBadQuestionSnooze(cardId);

		const wrapped = dbWithForcedRollback(db);
		await updateCard(cardId, TEST_USER_ID, { front: 'should not persist', tags: ['atomicity'] }, wrapped);

		// The proxy forced a rollback after the BC's writes completed.
		// Both writes have to be inside the BC's transaction for either
		// post-condition to hold; if `card` or `card_snooze` had been
		// updated on the live `db` outside the tx, the rollback wouldn't
		// reach them.
		const [persisted] = await db.select().from(card).where(eq(card.id, cardId)).limit(1);
		expect(persisted?.front).toBe('pristine front');
		expect(persisted?.tags).toEqual([]);

		const [snooze] = await db.select().from(cardSnooze).where(eq(cardSnooze.id, snoozeId)).limit(1);
		expect(snooze?.cardEditedAt).toBeNull();
		expect(snooze?.snoozeUntil).toBeNull();
	});

	it('rolls back BOTH writes when only the card patch carries content', async () => {
		const cardId = await seedCard({ front: 'untouched' });
		const snoozeId = await seedActiveBadQuestionSnooze(cardId);

		const wrapped = dbWithForcedRollback(db);
		await updateCard(cardId, TEST_USER_ID, { back: 'rolled back back' }, wrapped);

		const [persisted] = await db.select().from(card).where(eq(card.id, cardId)).limit(1);
		expect(persisted?.back).toBe('before back');

		const [snooze] = await db
			.select()
			.from(cardSnooze)
			.where(and(eq(cardSnooze.id, snoozeId), eq(cardSnooze.cardId, cardId)))
			.limit(1);
		expect(snooze?.cardEditedAt).toBeNull();
	});
});
