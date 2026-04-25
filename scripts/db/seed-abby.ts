/**
 * Seed Abby (canonical dev-seed test learner) and her chained content.
 *
 * Steps (all idempotent on `seed_origin = DEV_SEED_ORIGIN_TAG`):
 *
 *   1. Ensure the `bauth_user` row exists, mark it via `address.seed_origin`.
 *      Better-auth owns the row creation -- if Abby is missing, we ask it to
 *      create her with the canonical password.
 *   2. Insert ~18 personal cards from `seed-content.ts` (Abby-owned).
 *   3. Insert 16 scenarios.
 *   4. Insert one active study plan.
 *   5. Insert 3 historical sessions over the last 7 days, each with its own
 *      session_item_result rows, plus the review rows the slot rows reference.
 *      Confidence is deliberately mis-calibrated so /calibration shows real
 *      signal: regs overconfident, weather underconfident, airspace well-cal.
 *
 * Counts are returned so the orchestrator can compose the yellow CLI banner.
 */

import { bauthAccount, bauthUser } from '@ab/auth/schema';
import { card, cardState, review, scenario, session, sessionItemResult, studyPlan } from '@ab/bc-study/schema';
import { fsrsInitialState } from '@ab/bc-study/srs';
import {
	BETTER_AUTH_PROVIDERS,
	CARD_STATES,
	CARD_STATUSES,
	CERTS,
	CONTENT_SOURCES,
	DEFAULT_SESSION_LENGTH,
	DEPTH_PREFERENCES,
	DEV_PASSWORD,
	DEV_SEED_LEARNER_EMAIL,
	DEV_SEED_ORIGIN_TAG,
	DOMAINS,
	type Domain,
	PLAN_STATUSES,
	REVIEW_RATINGS,
	SCENARIO_STATUSES,
	SESSION_ITEM_KINDS,
	SESSION_MODES,
	SESSION_REASON_CODES,
	SESSION_SLICES,
} from '@ab/constants';
import {
	generateAuthId,
	generateCardId,
	generateReviewId,
	generateScenarioId,
	generateSessionId,
	generateSessionItemResultId,
	generateStudyPlanId,
} from '@ab/utils';
import { and, eq, sql } from 'drizzle-orm';
import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import { ABBY_CARDS, ABBY_SCENARIOS, type SeedScenarioOption } from './seed-content';

export interface AbbySeedCounts {
	user: number;
	cards: number;
	scenarios: number;
	plans: number;
	sessions: number;
	reviews: number;
	sessionItemResults: number;
}

interface InsertedCard {
	id: string;
	domain: Domain;
	nodeId: string | null;
}

interface InsertedScenario {
	id: string;
	domain: Domain;
	options: SeedScenarioOption[];
	nodeId: string | null;
}

const PLAN_TITLE = 'PPL VFR weather + airspace focus';

/** Resolve the connection string the seeder runs against. */
function resolveConnectionString(): string {
	const url = process.env.DATABASE_URL;
	if (!url) {
		throw new Error('DATABASE_URL is required for seed-abby');
	}
	return url;
}

/** Ensure Abby exists in bauth_user via better-auth, then mark her row. */
async function ensureAbbyUser(databaseUrl: string): Promise<string> {
	const client = postgres(databaseUrl);
	const db = drizzle(client);

	try {
		const existing = await db
			.select({ id: bauthUser.id, address: bauthUser.address })
			.from(bauthUser)
			.where(eq(bauthUser.email, DEV_SEED_LEARNER_EMAIL))
			.limit(1);

		let userId: string;
		const now = new Date();

		if (existing[0]) {
			userId = existing[0].id;
		} else {
			const { hashPassword } = await import('better-auth/crypto');
			userId = generateAuthId();
			await db.insert(bauthUser).values({
				id: userId,
				email: DEV_SEED_LEARNER_EMAIL,
				name: 'Abby',
				firstName: 'Abby',
				lastName: 'Learner',
				emailVerified: true,
				role: 'learner',
				createdAt: now,
				updatedAt: now,
			});
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

		// Stamp the seed-origin marker into the address jsonb (better-auth owns
		// the table; we cannot add a column). Production rows have
		// `address->>'seed_origin' IS NULL`.
		await db.execute(
			sql`UPDATE bauth_user
			    SET address = COALESCE(address, '{}'::jsonb) || jsonb_build_object('seed_origin', ${DEV_SEED_ORIGIN_TAG}::text)
			    WHERE id = ${userId}`,
		);

		return userId;
	} finally {
		await client.end();
	}
}

/** Idempotency: clear any prior dev-seed rows for Abby so re-runs are clean. */
async function clearPriorAbbySeed(databaseUrl: string, userId: string): Promise<void> {
	const client = postgres(databaseUrl);
	const db = drizzle(client);
	try {
		await db.transaction(async (tx) => {
			// Delete in FK order. SIR -> session -> review -> scenario -> card -> plan.
			// Personal cards have FK from review (restrict on review->card delete);
			// reviews must go before cards.
			await tx
				.delete(sessionItemResult)
				.where(and(eq(sessionItemResult.userId, userId), eq(sessionItemResult.seedOrigin, DEV_SEED_ORIGIN_TAG)));
			await tx.delete(review).where(and(eq(review.userId, userId), eq(review.seedOrigin, DEV_SEED_ORIGIN_TAG)));
			await tx.delete(session).where(and(eq(session.userId, userId), eq(session.seedOrigin, DEV_SEED_ORIGIN_TAG)));
			await tx
				.delete(studyPlan)
				.where(and(eq(studyPlan.userId, userId), eq(studyPlan.seedOrigin, DEV_SEED_ORIGIN_TAG)));
			await tx.delete(scenario).where(and(eq(scenario.userId, userId), eq(scenario.seedOrigin, DEV_SEED_ORIGIN_TAG)));
			await tx.delete(card).where(and(eq(card.userId, userId), eq(card.seedOrigin, DEV_SEED_ORIGIN_TAG)));
		});
	} finally {
		await client.end();
	}
}

async function seedAbbyCards(databaseUrl: string, userId: string): Promise<InsertedCard[]> {
	const client = postgres(databaseUrl);
	const db = drizzle(client);
	const inserted: InsertedCard[] = [];
	try {
		for (const c of ABBY_CARDS) {
			const id = generateCardId();
			const now = new Date();
			const initial = fsrsInitialState(now);
			await db.transaction(async (tx) => {
				await tx.insert(card).values({
					id,
					userId,
					front: c.front,
					back: c.back,
					domain: c.domain,
					tags: c.tags,
					cardType: c.cardType,
					sourceType: c.sourceType,
					sourceRef: c.sourceRef,
					nodeId: c.nodeId,
					isEditable: true,
					status: CARD_STATUSES.ACTIVE,
					seedOrigin: DEV_SEED_ORIGIN_TAG,
					createdAt: now,
					updatedAt: now,
				});
				await tx.insert(cardState).values({
					cardId: id,
					userId,
					stability: initial.stability,
					difficulty: initial.difficulty,
					state: initial.state,
					dueAt: initial.dueAt,
					lastReviewId: null,
					lastReviewedAt: null,
					reviewCount: 0,
					lapseCount: 0,
				});
			});
			inserted.push({ id, domain: c.domain, nodeId: c.nodeId });
		}
		return inserted;
	} finally {
		await client.end();
	}
}

async function seedAbbyScenarios(databaseUrl: string, userId: string): Promise<InsertedScenario[]> {
	const client = postgres(databaseUrl);
	const db = drizzle(client);
	const inserted: InsertedScenario[] = [];
	try {
		for (const s of ABBY_SCENARIOS) {
			const id = generateScenarioId();
			const now = new Date();
			const options = s.options.map((o) => ({
				id: o.letter,
				text: o.text,
				isCorrect: o.isCorrect,
				outcome: o.outcome,
				whyNot: o.whyNot,
			}));
			await db.insert(scenario).values({
				id,
				userId,
				title: s.title,
				situation: s.situation,
				options,
				teachingPoint: s.teachingPoint,
				domain: s.domain,
				difficulty: s.difficulty,
				phaseOfFlight: s.phaseOfFlight,
				sourceType: CONTENT_SOURCES.PERSONAL,
				sourceRef: null,
				nodeId: s.nodeId,
				isEditable: true,
				regReferences: s.regReferences,
				status: SCENARIO_STATUSES.ACTIVE,
				seedOrigin: DEV_SEED_ORIGIN_TAG,
				createdAt: now,
			});
			inserted.push({ id, domain: s.domain, options: [...s.options], nodeId: s.nodeId });
		}
		return inserted;
	} finally {
		await client.end();
	}
}

async function seedAbbyPlan(databaseUrl: string, userId: string): Promise<string> {
	const client = postgres(databaseUrl);
	const db = drizzle(client);
	try {
		const id = generateStudyPlanId();
		const now = new Date();
		// Archive any previously active plan for the user so the partial unique
		// index does not fire when we insert this active plan.
		await db
			.update(studyPlan)
			.set({ status: PLAN_STATUSES.ARCHIVED, updatedAt: now })
			.where(and(eq(studyPlan.userId, userId), eq(studyPlan.status, PLAN_STATUSES.ACTIVE)));
		await db.insert(studyPlan).values({
			id,
			userId,
			title: PLAN_TITLE,
			status: PLAN_STATUSES.ACTIVE,
			certGoals: [CERTS.PPL],
			focusDomains: [DOMAINS.AIRSPACE, DOMAINS.WEATHER, DOMAINS.EMERGENCY_PROCEDURES],
			skipDomains: [],
			skipNodes: [],
			depthPreference: DEPTH_PREFERENCES.WORKING,
			sessionLength: DEFAULT_SESSION_LENGTH,
			defaultMode: SESSION_MODES.MIXED,
			seedOrigin: DEV_SEED_ORIGIN_TAG,
			createdAt: now,
			updatedAt: now,
		});
		return id;
	} finally {
		await client.end();
	}
}

interface SessionPlanItem {
	kind: 'card' | 'rep';
	cardId?: string;
	scenarioId?: string;
	domain: Domain;
	rating?: 1 | 2 | 3 | 4;
	chosenLetter?: 'a' | 'b' | 'c' | 'd';
	isCorrect?: boolean;
	confidence: 1 | 2 | 3 | 4 | 5;
}

/**
 * Build a 7-day historical session schedule for Abby.
 *
 * Calibration design:
 *   - Regulations / airspace-reg cards: confidence 4-5, accuracy ~55% -> overconfident
 *   - Weather cards / scenarios: confidence 1-2, accuracy ~75% -> underconfident
 *   - Airspace recognition: confidence 3, accuracy ~70% -> well-calibrated
 */
function planSessions(
	cards: InsertedCard[],
	scenarios: InsertedScenario[],
): {
	sessions: { startedAt: Date; items: SessionPlanItem[] }[];
} {
	// Bucket cards / scenarios by domain
	const airspaceCards = cards.filter((c) => c.domain === DOMAINS.AIRSPACE);
	const emergencyCards = cards.filter((c) => c.domain === DOMAINS.EMERGENCY_PROCEDURES);

	const airspaceScenarios = scenarios.filter((s) => s.domain === DOMAINS.AIRSPACE);
	const emergencyScenarios = scenarios.filter((s) => s.domain === DOMAINS.EMERGENCY_PROCEDURES);

	// Pick correct/incorrect option letters from a scenario
	const correctLetter = (s: InsertedScenario): 'a' | 'b' | 'c' | 'd' => {
		const opt = s.options.find((o) => o.isCorrect);
		if (!opt) throw new Error(`Scenario ${s.id} has no correct option`);
		return opt.letter;
	};
	const wrongLetter = (s: InsertedScenario): 'a' | 'b' | 'c' | 'd' => {
		const opt = s.options.find((o) => !o.isCorrect);
		if (!opt) throw new Error(`Scenario ${s.id} has no wrong option`);
		return opt.letter;
	};

	const now = Date.now();
	const day = 24 * 60 * 60 * 1000;

	// Session 1: 6 days ago. Heavy on airspace + emergency cards. Overconfident reg miscalls.
	const s1Items: SessionPlanItem[] = [];
	for (let i = 0; i < Math.min(4, airspaceCards.length); i++) {
		// Reg-flavored airspace cards: claim 5 confidence, half are AGAIN
		const c = airspaceCards[i];
		const rating = i % 2 === 0 ? 1 : 3; // half AGAIN, half GOOD
		s1Items.push({
			kind: 'card',
			cardId: c.id,
			domain: c.domain,
			rating: rating as 1 | 3,
			confidence: 5,
		});
	}
	for (let i = 0; i < Math.min(2, airspaceScenarios.length); i++) {
		const sc = airspaceScenarios[i];
		// Airspace recognition: 70% accuracy, conf 3
		const correct = i === 0;
		s1Items.push({
			kind: 'rep',
			scenarioId: sc.id,
			domain: sc.domain,
			chosenLetter: correct ? correctLetter(sc) : wrongLetter(sc),
			isCorrect: correct,
			confidence: 3,
		});
	}

	// Session 2: 3 days ago. Emergencies + weather. Underconfident on weather scenarios.
	const s2Items: SessionPlanItem[] = [];
	for (let i = 0; i < Math.min(3, emergencyCards.length); i++) {
		const c = emergencyCards[i];
		s2Items.push({
			kind: 'card',
			cardId: c.id,
			domain: c.domain,
			rating: 3,
			confidence: 3,
		});
	}
	for (let i = 0; i < Math.min(3, emergencyScenarios.length); i++) {
		const sc = emergencyScenarios[i];
		// Emergencies: 75% accuracy, low conf (1-2) -> underconfident
		const correct = i !== 1;
		s2Items.push({
			kind: 'rep',
			scenarioId: sc.id,
			domain: sc.domain,
			chosenLetter: correct ? correctLetter(sc) : wrongLetter(sc),
			isCorrect: correct,
			confidence: i === 0 ? 1 : 2,
		});
	}

	// Session 3: yesterday. Mixed sweep, well-calibrated airspace.
	const s3Items: SessionPlanItem[] = [];
	for (let i = 0; i < Math.min(3, airspaceCards.length); i++) {
		const c = airspaceCards[i];
		s3Items.push({
			kind: 'card',
			cardId: c.id,
			domain: c.domain,
			rating: 3,
			confidence: 3,
		});
	}
	for (let i = 2; i < Math.min(5, airspaceScenarios.length); i++) {
		const sc = airspaceScenarios[i];
		// 70-75% correct on airspace, conf 3 -> well-calibrated
		const correct = i % 4 !== 0;
		s3Items.push({
			kind: 'rep',
			scenarioId: sc.id,
			domain: sc.domain,
			chosenLetter: correct ? correctLetter(sc) : wrongLetter(sc),
			isCorrect: correct,
			confidence: 3,
		});
	}

	return {
		sessions: [
			{ startedAt: new Date(now - 6 * day), items: s1Items },
			{ startedAt: new Date(now - 3 * day), items: s2Items },
			{ startedAt: new Date(now - 1 * day), items: s3Items },
		],
	};
}

interface SessionSeedResult {
	sessionsInserted: number;
	reviewsInserted: number;
	sessionItemResultsInserted: number;
}

async function seedAbbySessions(
	databaseUrl: string,
	userId: string,
	planId: string,
	cards: InsertedCard[],
	scenarios: InsertedScenario[],
): Promise<SessionSeedResult> {
	const client = postgres(databaseUrl);
	const db = drizzle(client);
	let sessionsInserted = 0;
	let reviewsInserted = 0;
	let sessionItemResultsInserted = 0;

	try {
		const { sessions } = planSessions(cards, scenarios);

		for (const sessionPlan of sessions) {
			const sessionId = generateSessionId();
			const startedAt = sessionPlan.startedAt;
			// Engine output snapshot (items array on session row)
			const items = sessionPlan.items.map((it) => {
				if (it.kind === 'card' && it.cardId) {
					return {
						kind: SESSION_ITEM_KINDS.CARD,
						cardId: it.cardId,
						slice: SESSION_SLICES.STRENGTHEN,
						reasonCode: SESSION_REASON_CODES.STRENGTHEN_LOW_REP_ACCURACY,
					};
				}
				if (!it.scenarioId) throw new Error('Rep item missing scenarioId');
				return {
					kind: SESSION_ITEM_KINDS.REP,
					scenarioId: it.scenarioId,
					slice: SESSION_SLICES.STRENGTHEN,
					reasonCode: SESSION_REASON_CODES.STRENGTHEN_LOW_REP_ACCURACY,
				};
			});

			await db.transaction(async (tx) => {
				await tx.insert(session).values({
					id: sessionId,
					userId,
					planId,
					mode: SESSION_MODES.MIXED,
					focusOverride: null,
					certOverride: null,
					sessionLength: items.length,
					items,
					seed: `abby-seed-${startedAt.getTime()}`,
					startedAt,
					completedAt: new Date(startedAt.getTime() + 12 * 60 * 1000),
					seedOrigin: DEV_SEED_ORIGIN_TAG,
				});
				sessionsInserted++;

				for (let idx = 0; idx < sessionPlan.items.length; idx++) {
					const planItem = sessionPlan.items[idx];
					const sirId = generateSessionItemResultId();
					const presentedAt = new Date(startedAt.getTime() + idx * 60 * 1000);
					const completedAt = new Date(presentedAt.getTime() + 30 * 1000);

					if (planItem.kind === 'card' && planItem.cardId && planItem.rating) {
						// Insert a review row, update cardState, then SIR pointing at it.
						const reviewId = generateReviewId();
						const initial = fsrsInitialState(presentedAt);
						// Use minimal valid scheduling values; we are NOT exercising the
						// FSRS scheduler for seed history (that requires sequential time
						// progression). Persist the rating + a defensible scheduled future.
						const newDue = new Date(presentedAt.getTime() + 24 * 60 * 60 * 1000);
						await tx.insert(review).values({
							id: reviewId,
							cardId: planItem.cardId,
							userId,
							rating: planItem.rating,
							confidence: planItem.confidence,
							stability: initial.stability,
							difficulty: initial.difficulty,
							elapsedDays: 0,
							scheduledDays: 1,
							state: planItem.rating === REVIEW_RATINGS.AGAIN ? CARD_STATES.LEARNING : CARD_STATES.REVIEW,
							dueAt: newDue,
							reviewedAt: presentedAt,
							answerMs: 8000,
							reviewSessionId: null,
							seedOrigin: DEV_SEED_ORIGIN_TAG,
						});
						reviewsInserted++;
						await tx
							.update(cardState)
							.set({
								stability: initial.stability,
								difficulty: initial.difficulty,
								state: planItem.rating === REVIEW_RATINGS.AGAIN ? CARD_STATES.LEARNING : CARD_STATES.REVIEW,
								dueAt: newDue,
								lastReviewId: reviewId,
								lastReviewedAt: presentedAt,
								reviewCount: 1,
								lapseCount: planItem.rating === REVIEW_RATINGS.AGAIN ? 1 : 0,
							})
							.where(and(eq(cardState.cardId, planItem.cardId), eq(cardState.userId, userId)));

						await tx.insert(sessionItemResult).values({
							id: sirId,
							sessionId,
							userId,
							slotIndex: idx,
							itemKind: SESSION_ITEM_KINDS.CARD,
							slice: SESSION_SLICES.STRENGTHEN,
							reasonCode: SESSION_REASON_CODES.STRENGTHEN_LOW_REP_ACCURACY,
							cardId: planItem.cardId,
							scenarioId: null,
							nodeId: null,
							reviewId,
							skipKind: null,
							reasonDetail: null,
							chosenOption: null,
							isCorrect: null,
							confidence: planItem.confidence,
							answerMs: 8000,
							presentedAt,
							completedAt,
							seedOrigin: DEV_SEED_ORIGIN_TAG,
						});
						sessionItemResultsInserted++;
						continue;
					}

					// Rep slot
					if (planItem.kind === 'rep' && planItem.scenarioId && planItem.chosenLetter) {
						await tx.insert(sessionItemResult).values({
							id: sirId,
							sessionId,
							userId,
							slotIndex: idx,
							itemKind: SESSION_ITEM_KINDS.REP,
							slice: SESSION_SLICES.STRENGTHEN,
							reasonCode: SESSION_REASON_CODES.STRENGTHEN_LOW_REP_ACCURACY,
							cardId: null,
							scenarioId: planItem.scenarioId,
							nodeId: null,
							reviewId: null,
							skipKind: null,
							reasonDetail: null,
							chosenOption: planItem.chosenLetter,
							isCorrect: planItem.isCorrect ?? null,
							confidence: planItem.confidence,
							answerMs: 22000,
							presentedAt,
							completedAt,
							seedOrigin: DEV_SEED_ORIGIN_TAG,
						});
						sessionItemResultsInserted++;
					}
				}
			});
		}

		return { sessionsInserted, reviewsInserted, sessionItemResultsInserted };
	} finally {
		await client.end();
	}
}

export async function seedAbby(): Promise<AbbySeedCounts> {
	const databaseUrl = resolveConnectionString();

	const userId = await ensureAbbyUser(databaseUrl);
	await clearPriorAbbySeed(databaseUrl, userId);
	const cards = await seedAbbyCards(databaseUrl, userId);
	const scenarios = await seedAbbyScenarios(databaseUrl, userId);
	const planId = await seedAbbyPlan(databaseUrl, userId);
	const { sessionsInserted, reviewsInserted, sessionItemResultsInserted } = await seedAbbySessions(
		databaseUrl,
		userId,
		planId,
		cards,
		scenarios,
	);

	return {
		user: 1,
		cards: cards.length,
		scenarios: scenarios.length,
		plans: 1,
		sessions: sessionsInserted,
		reviews: reviewsInserted,
		sessionItemResults: sessionItemResultsInserted,
	};
}
