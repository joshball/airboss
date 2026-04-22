/**
 * Smoke test for the study BC against the local dev database.
 *
 * Creates a card for the dev admin, submits a review, reads stats, deletes
 * the card. Prints the result of each step. Intended as a quick sanity
 * check after Phase 2 / 3 / 4 changes before running the full e2e plan.
 *
 * Run: bun scripts/smoke/study-bc.ts
 */

import { bauthUser } from '@ab/auth/schema';
import {
	createCard,
	getCard,
	getCardMastery,
	getDashboardStats,
	getDueCards,
	setCardStatus,
	submitReview,
} from '@ab/bc-study';
import { cardState, card as cardTable, review as reviewTable } from '@ab/bc-study/schema';
import { CARD_TYPES, CONFIDENCE_LEVELS, DEV_ACCOUNTS, DOMAINS, REVIEW_RATINGS } from '@ab/constants';
import { CARD_STATUSES } from '@ab/constants/study';
import { eq } from 'drizzle-orm';
import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';

const url = process.env.DATABASE_URL ?? 'postgresql://airboss:airboss@localhost:5435/airboss';
const client = postgres(url);
const db = drizzle(client);

function log(step: string, detail?: unknown): void {
	console.log(`\n-- ${step} --`);
	if (detail !== undefined) console.log(detail);
}

async function main(): Promise<void> {
	const [user] = await db.select().from(bauthUser).where(eq(bauthUser.email, DEV_ACCOUNTS[0].email)).limit(1);
	if (!user) {
		console.error(`Dev user ${DEV_ACCOUNTS[0].email} not found. Run: bun run db seed`);
		process.exit(1);
	}
	const userId = user.id;
	log('User', { id: userId, email: user.email });

	const created = await createCard(
		{
			userId,
			front: '[smoke] VFR weather minimums in Class C below 10,000?',
			back: '3 SM, 500 below / 1,000 above / 2,000 horiz.',
			domain: DOMAINS.REGULATIONS,
			cardType: CARD_TYPES.BASIC,
			tags: ['smoke', 'far-91'],
		},
		db,
	);
	log('createCard', { id: created.id, domain: created.domain, status: created.status });

	const loaded = await getCard(created.id, userId, db);
	log('getCard state', loaded?.state);

	const due = await getDueCards(userId, 5, db);
	log('getDueCards length', due.length);

	const reviewed = await submitReview(
		{
			cardId: created.id,
			userId,
			rating: REVIEW_RATINGS.GOOD,
			confidence: CONFIDENCE_LEVELS.PROBABLY,
			answerMs: 3200,
		},
		db,
	);
	log('submitReview', {
		id: reviewed.id,
		state: reviewed.state,
		scheduledDays: reviewed.scheduledDays,
	});

	const afterReview = await getCard(created.id, userId, db);
	log('state after review', afterReview?.state);

	const stats = await getDashboardStats(userId, db);
	log('dashboard', {
		dueNow: stats.dueNow,
		reviewedToday: stats.reviewedToday,
		streak: stats.streakDays,
		domains: stats.domains.length,
	});

	const mastery = await getCardMastery(userId, DOMAINS.REGULATIONS, db);
	log('mastery (regulations)', mastery);

	await setCardStatus(created.id, userId, CARD_STATUSES.ARCHIVED, db);
	const afterArchive = await getCard(created.id, userId, db);
	log('status after archive', afterArchive?.card.status);

	// Clean up: clear review/state/card for this smoke card.
	await db.delete(reviewTable).where(eq(reviewTable.cardId, created.id));
	await db.delete(cardState).where(eq(cardState.cardId, created.id));
	await db.delete(cardTable).where(eq(cardTable.id, created.id));
	log('cleanup complete', { deletedCardId: created.id });
}

main()
	.catch((err) => {
		console.error('smoke failed:', err);
		process.exitCode = 1;
	})
	.finally(async () => {
		await client.end();
		process.exit(process.exitCode ?? 0);
	});
