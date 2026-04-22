/**
 * Session BC functions.
 *
 * Orchestration layer between the pure `runEngine` function and the DB. A
 * session is the committed batch the engine produced for a single study run;
 * this file owns:
 *
 *   - building the `EnginePoolQueries` callbacks over Drizzle so the engine
 *     can stay DB-free and unit-testable,
 *   - preview regeneration (reruns the engine with a different seed or mode),
 *   - commit (writes the `session` row + `session_item_result` rows for each
 *     slot),
 *   - per-item result recording when the user finishes a card/rep/node,
 *   - summary aggregation from `session_item_result` once the session ends,
 *   - streak computation in the user's local timezone.
 */

import {
	CARD_STATES,
	CARD_STATUSES,
	type Cert,
	DEFAULT_SESSION_LENGTH,
	DEFAULT_USER_TIMEZONE,
	DOMAIN_VALUES,
	type Domain,
	RELEVANCE_PRIORITIES,
	RESUME_WINDOW_MS,
	SCENARIO_STATUSES,
	SESSION_ITEM_KINDS,
	SESSION_MODES,
	type SessionItemKind,
	type SessionMode,
	type SessionReasonCode,
	type SessionSkipKind,
	type SessionSlice,
} from '@ab/constants';
import { db as defaultDb } from '@ab/db';
import { generateSessionId, generateSessionItemResultId } from '@ab/utils';
import { and, desc, eq, gte, inArray, isNotNull, isNull, lt, sql } from 'drizzle-orm';
import type { PgDatabase, PgQueryResultHKT } from 'drizzle-orm/pg-core';
import {
	type EngineCardCandidate,
	type EngineDomainMasteryTrend,
	type EngineNodeCandidate,
	type EnginePlan,
	type EnginePoolFilters,
	type EnginePoolQueries,
	type EnginePreview,
	type EngineRepCandidate,
	runEngine,
} from './engine';
import { isNodeMastered } from './knowledge';
import { getActivePlan, NoActivePlanError } from './plans';
import {
	card,
	cardState,
	knowledgeEdge,
	knowledgeNode,
	repAttempt,
	review,
	type SessionItem,
	type SessionItemResultRow,
	type SessionRow,
	type StudyPlanRow,
	scenario,
	session,
	sessionItemResult,
} from './schema';

type Db = PgDatabase<PgQueryResultHKT, Record<string, never>>;

// ---------- Errors ----------

export class SessionNotFoundError extends Error {
	constructor(
		public readonly sessionId: string,
		public readonly userId: string,
	) {
		super(`Session ${sessionId} not found for user ${userId}`);
		this.name = 'SessionNotFoundError';
	}
}

// ---------- Public types ----------

export interface PreviewOptions {
	mode?: SessionMode;
	focus?: Domain;
	cert?: Cert;
	/** Deterministic tiebreaker. Omit for a fresh random seed. */
	seed?: string;
	/** Override plan session length for this run. */
	sessionLength?: number;
}

export interface SessionPreview {
	plan: StudyPlanRow;
	mode: SessionMode;
	focus: Domain | null;
	cert: Cert | null;
	seed: string;
	sessionLength: number;
	items: SessionItem[];
	/** True when fewer items were produced than the requested length. */
	short: boolean;
	allocation: Record<SessionSlice, number>;
}

export interface ItemResultInput {
	/** Position of the slot inside the session items array. */
	slotIndex: number;
	itemKind: SessionItemKind;
	slice: SessionSlice;
	reasonCode: SessionReasonCode;
	cardId?: string | null;
	scenarioId?: string | null;
	nodeId?: string | null;
	reviewId?: string | null;
	repAttemptId?: string | null;
	skipKind?: SessionSkipKind | null;
	reasonDetail?: string | null;
}

export interface SessionSummarySliceRow {
	slice: SessionSlice;
	attempted: number;
	correct: number;
	skipped: number;
}

export interface SessionSummary {
	session: SessionRow;
	totalItems: number;
	attempted: number;
	correct: number;
	skippedByKind: Record<SessionSkipKind, number>;
	avgConfidence: number | null;
	domainsTouched: Domain[];
	nodesStarted: number;
	bySlice: SessionSummarySliceRow[];
	streakDays: number;
	/** Human-readable hints computed from just-finished state. */
	suggestedNext: string[];
}

// ---------- Helpers ----------

function planRowToEnginePlan(row: StudyPlanRow): EnginePlan {
	return {
		id: row.id,
		userId: row.userId,
		certGoals: row.certGoals,
		focusDomains: row.focusDomains,
		skipDomains: row.skipDomains,
		skipNodes: row.skipNodes,
		depthPreference: row.depthPreference as EnginePlan['depthPreference'],
		sessionLength: row.sessionLength,
	};
}

// ---------- Build EnginePoolQueries over Drizzle ----------

/**
 * Fetch the user's candidate cards + materialized state for the engine. The
 * engine's scoring functions treat undue cards as 0-score for the Continue
 * slice, so we pull all active cards with state here rather than restricting
 * to `dueAt <= now` -- the strengthen slice wants relearning and rated-Again
 * cards even when the next due is in the future.
 */
async function fetchCardCandidates(userId: string, now: Date, db: Db): Promise<EngineCardCandidate[]> {
	// Most recent rating per card (for this user) -- powers the Strengthen
	// slice's Again/Hard detection. Drizzle doesn't expose DISTINCT ON, but a
	// correlated max-reviewedAt inner join is equivalent and the per-user
	// review index bounds the scan.
	const lastReviews = await db
		.select({
			cardId: review.cardId,
			rating: review.rating,
			reviewedAt: review.reviewedAt,
		})
		.from(review)
		.where(eq(review.userId, userId))
		.orderBy(desc(review.reviewedAt));
	const ratingByCardId = new Map<string, number>();
	for (const row of lastReviews) {
		if (!ratingByCardId.has(row.cardId)) ratingByCardId.set(row.cardId, Number(row.rating));
	}

	const rows = await db
		.select({ card, state: cardState })
		.from(card)
		.innerJoin(cardState, and(eq(cardState.cardId, card.id), eq(cardState.userId, card.userId)))
		.where(and(eq(card.userId, userId), eq(card.status, CARD_STATUSES.ACTIVE)));

	return rows.map((r) => {
		const lastRef = r.state.lastReviewedAt?.getTime() ?? r.state.dueAt.getTime();
		const scheduledMs = Math.max(r.state.dueAt.getTime() - lastRef, 24 * 60 * 60 * 1000);
		const overdueMs = Math.max(0, now.getTime() - r.state.dueAt.getTime());
		const overdueRatio = overdueMs / scheduledMs;
		return {
			cardId: r.card.id,
			domain: r.card.domain as Domain,
			nodeId: r.card.nodeId ?? null,
			state: r.state.state,
			dueAt: r.state.dueAt,
			lastRating: ratingByCardId.get(r.card.id) ?? null,
			stability: r.state.stability,
			overdueRatio,
		};
	});
}

/** Rep candidates + last-5 accuracy for the engine. */
async function fetchRepCandidates(userId: string, now: Date, db: Db): Promise<EngineRepCandidate[]> {
	const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);

	const scenarios = await db
		.select()
		.from(scenario)
		.where(and(eq(scenario.userId, userId), eq(scenario.status, SCENARIO_STATUSES.ACTIVE)));

	if (scenarios.length === 0) return [];

	const scenarioIds = scenarios.map((s) => s.id);
	const attempts = await db
		.select({
			scenarioId: repAttempt.scenarioId,
			isCorrect: repAttempt.isCorrect,
			attemptedAt: repAttempt.attemptedAt,
		})
		.from(repAttempt)
		.where(and(eq(repAttempt.userId, userId), inArray(repAttempt.scenarioId, scenarioIds)))
		.orderBy(desc(repAttempt.attemptedAt));

	const byScenario = new Map<string, Array<{ isCorrect: boolean; attemptedAt: Date }>>();
	for (const att of attempts) {
		const list = byScenario.get(att.scenarioId);
		if (list) list.push({ isCorrect: att.isCorrect, attemptedAt: att.attemptedAt });
		else byScenario.set(att.scenarioId, [{ isCorrect: att.isCorrect, attemptedAt: att.attemptedAt }]);
	}

	return scenarios.map((s) => {
		const hist = byScenario.get(s.id) ?? [];
		const last5 = hist.slice(0, 5);
		const accuracyLast5 = last5.length === 0 ? 0 : last5.filter((h) => h.isCorrect).length / last5.length;
		const attemptedInLast7Days = hist.some((h) => h.attemptedAt >= sevenDaysAgo);
		const lastIncorrect = hist.find((h) => !h.isCorrect) ?? null;
		return {
			scenarioId: s.id,
			domain: s.domain as Domain,
			nodeId: s.nodeId ?? null,
			accuracyLast5,
			attemptedInLast7Days,
			lastIncorrectAt: lastIncorrect?.attemptedAt ?? null,
		};
	});
}

/**
 * Knowledge-node candidates for Expand/Diversify. Pulls every node whose
 * relevance entry intersects the cert filter, marks `unstarted` by left-joining
 * card / rep / session_item_result presence, and computes `prerequisitesMet`
 * via dual-gate `isNodeMastered` on each `requires` prerequisite.
 */
async function fetchNodeCandidates(
	userId: string,
	certFilter: readonly Cert[],
	db: Db,
	now: Date,
): Promise<EngineNodeCandidate[]> {
	const nodes = await db
		.select({
			id: knowledgeNode.id,
			domain: knowledgeNode.domain,
			crossDomains: knowledgeNode.crossDomains,
			relevance: knowledgeNode.relevance,
		})
		.from(knowledgeNode);

	if (nodes.length === 0) return [];

	const nodeIds = nodes.map((n) => n.id);
	const [cardTouched, repTouched, sirTouched, requiresEdges] = await Promise.all([
		db
			.selectDistinct({ nodeId: card.nodeId })
			.from(card)
			.where(and(eq(card.userId, userId), isNotNull(card.nodeId), inArray(card.nodeId, nodeIds)))
			.then((rows) => new Set(rows.map((r) => r.nodeId).filter((id): id is string => id !== null))),
		db
			.selectDistinct({ nodeId: scenario.nodeId })
			.from(scenario)
			.innerJoin(repAttempt, eq(repAttempt.scenarioId, scenario.id))
			.where(and(eq(repAttempt.userId, userId), isNotNull(scenario.nodeId), inArray(scenario.nodeId, nodeIds)))
			.then((rows) => new Set(rows.map((r) => r.nodeId).filter((id): id is string => id !== null))),
		db
			.selectDistinct({ nodeId: sessionItemResult.nodeId })
			.from(sessionItemResult)
			.where(
				and(
					eq(sessionItemResult.userId, userId),
					isNotNull(sessionItemResult.nodeId),
					inArray(sessionItemResult.nodeId, nodeIds),
				),
			)
			.then((rows) => new Set(rows.map((r) => r.nodeId).filter((id): id is string => id !== null))),
		db
			.select({ fromNodeId: knowledgeEdge.fromNodeId, toNodeId: knowledgeEdge.toNodeId })
			.from(knowledgeEdge)
			.where(and(eq(knowledgeEdge.edgeType, 'requires'), eq(knowledgeEdge.targetExists, true))),
	]);

	const requiresByFrom = new Map<string, string[]>();
	for (const edge of requiresEdges) {
		const list = requiresByFrom.get(edge.fromNodeId);
		if (list) list.push(edge.toNodeId);
		else requiresByFrom.set(edge.fromNodeId, [edge.toNodeId]);
	}

	// Compute mastery once per distinct prerequisite target.
	const prereqTargets = new Set<string>();
	for (const list of requiresByFrom.values()) for (const id of list) prereqTargets.add(id);
	const masteryByNode = new Map<string, boolean>();
	await Promise.all(
		Array.from(prereqTargets).map(async (id) => {
			try {
				masteryByNode.set(id, await isNodeMastered(userId, id, db, now));
			} catch {
				masteryByNode.set(id, false);
			}
		}),
	);

	const certFilterSet = new Set<string>(certFilter);
	const knownCerts: readonly string[] = ['PPL', 'IR', 'CPL', 'CFI'];

	const candidates: EngineNodeCandidate[] = [];
	for (const n of nodes) {
		const rels = Array.isArray(n.relevance) ? n.relevance : [];
		if (certFilterSet.size > 0) {
			const matches = rels.some((r) => certFilterSet.has(r.cert));
			if (!matches) continue;
		}

		const relevantCerts = Array.from(new Set(rels.map((r) => r.cert))).filter((c): c is Cert => knownCerts.includes(c));

		const priorities = rels.map((r) => r.priority);
		const priority: 'core' | 'supporting' | 'elective' = priorities.includes(RELEVANCE_PRIORITIES.CORE)
			? 'core'
			: priorities.includes(RELEVANCE_PRIORITIES.SUPPORTING)
				? 'supporting'
				: 'elective';

		const bloom = rels[0]?.bloom ?? null;
		const bloomDepth: EngineNodeCandidate['bloomDepth'] =
			bloom === 'understand'
				? 'surface'
				: bloom === 'apply'
					? 'working'
					: bloom === 'analyze' || bloom === 'evaluate' || bloom === 'create'
						? 'deep'
						: null;

		const unstarted = !cardTouched.has(n.id) && !repTouched.has(n.id) && !sirTouched.has(n.id);
		const requires = requiresByFrom.get(n.id) ?? [];
		const prerequisitesMet = requires.every((target) => masteryByNode.get(target) === true);

		candidates.push({
			nodeId: n.id,
			domain: n.domain as Domain,
			crossDomains: (n.crossDomains ?? []) as readonly string[],
			priority,
			prerequisitesMet,
			bloomDepth,
			unstarted,
			certs: relevantCerts,
		});
	}
	return candidates;
}

async function fetchDomainFrequency(userId: string, now: Date, db: Db): Promise<Record<string, number>> {
	const thirtyAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
	const [reviewRows, attemptRows] = await Promise.all([
		db
			.select({ domain: card.domain, n: sql<number>`count(*)::int` })
			.from(review)
			.innerJoin(card, eq(card.id, review.cardId))
			.where(and(eq(review.userId, userId), gte(review.reviewedAt, thirtyAgo)))
			.groupBy(card.domain),
		db
			.select({ domain: scenario.domain, n: sql<number>`count(*)::int` })
			.from(repAttempt)
			.innerJoin(scenario, eq(scenario.id, repAttempt.scenarioId))
			.where(and(eq(repAttempt.userId, userId), gte(repAttempt.attemptedAt, thirtyAgo)))
			.groupBy(scenario.domain),
	]);

	const freq: Record<string, number> = {};
	for (const r of reviewRows) freq[r.domain] = (freq[r.domain] ?? 0) + Number(r.n);
	for (const r of attemptRows) freq[r.domain] = (freq[r.domain] ?? 0) + Number(r.n);
	return freq;
}

async function fetchActiveDomainsLast7(userId: string, now: Date, db: Db): Promise<Domain[]> {
	const sevenAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
	const [reviewRows, attemptRows] = await Promise.all([
		db
			.selectDistinct({ domain: card.domain })
			.from(review)
			.innerJoin(card, eq(card.id, review.cardId))
			.where(and(eq(review.userId, userId), gte(review.reviewedAt, sevenAgo))),
		db
			.selectDistinct({ domain: scenario.domain })
			.from(repAttempt)
			.innerJoin(scenario, eq(scenario.id, repAttempt.scenarioId))
			.where(and(eq(repAttempt.userId, userId), gte(repAttempt.attemptedAt, sevenAgo))),
	]);
	const set = new Set<string>();
	for (const r of reviewRows) set.add(r.domain);
	for (const r of attemptRows) set.add(r.domain);
	return Array.from(set).filter((d): d is Domain => DOMAIN_VALUES.includes(d as Domain));
}

async function fetchRecentSessionDomains(userId: string, db: Db, lookback = 2): Promise<Domain[]> {
	const recent = await db
		.select({ items: session.items })
		.from(session)
		.where(and(eq(session.userId, userId), isNotNull(session.completedAt)))
		.orderBy(desc(session.startedAt))
		.limit(lookback);

	if (recent.length === 0) return [];

	const nodeIds = new Set<string>();
	const cardIds = new Set<string>();
	const scenarioIds = new Set<string>();
	for (const row of recent) {
		for (const item of row.items) {
			if (item.kind === 'card') cardIds.add(item.cardId);
			else if (item.kind === 'rep') scenarioIds.add(item.scenarioId);
			else if (item.kind === 'node_start') nodeIds.add(item.nodeId);
		}
	}

	const domains = new Set<Domain>();
	if (cardIds.size > 0) {
		const rows = await db
			.select({ domain: card.domain })
			.from(card)
			.where(inArray(card.id, Array.from(cardIds)));
		for (const r of rows) if (DOMAIN_VALUES.includes(r.domain as Domain)) domains.add(r.domain as Domain);
	}
	if (scenarioIds.size > 0) {
		const rows = await db
			.select({ domain: scenario.domain })
			.from(scenario)
			.where(inArray(scenario.id, Array.from(scenarioIds)));
		for (const r of rows) if (DOMAIN_VALUES.includes(r.domain as Domain)) domains.add(r.domain as Domain);
	}
	if (nodeIds.size > 0) {
		const rows = await db
			.select({ domain: knowledgeNode.domain })
			.from(knowledgeNode)
			.where(inArray(knowledgeNode.id, Array.from(nodeIds)));
		for (const r of rows) if (DOMAIN_VALUES.includes(r.domain as Domain)) domains.add(r.domain as Domain);
	}
	return Array.from(domains);
}

/**
 * Build the `EnginePoolQueries` bundle for a user at a point in time. Each
 * callback closes over `userId`, `now`, and `db` so the engine invokes them
 * with just `filters`. Results are memoized per-build so the engine's
 * internal parallel fan-out doesn't duplicate work.
 */
export function buildEnginePools(userId: string, now: Date, db: Db = defaultDb): EnginePoolQueries {
	let cardCache: Promise<EngineCardCandidate[]> | null = null;
	let repCache: Promise<EngineRepCandidate[]> | null = null;
	let nodeCache: Promise<EngineNodeCandidate[]> | null = null;

	return {
		cards: () => {
			if (!cardCache) cardCache = fetchCardCandidates(userId, now, db);
			return cardCache;
		},
		reps: () => {
			if (!repCache) repCache = fetchRepCandidates(userId, now, db);
			return repCache;
		},
		nodes: (filters) => {
			if (!nodeCache) nodeCache = fetchNodeCandidates(userId, filters.certFilter, db, now);
			return nodeCache;
		},
		domainTrend: async (): Promise<EngineDomainMasteryTrend[]> => [],
		overconfidenceByDomain: async (): Promise<Record<string, number>> => ({}),
	};
}

// ---------- Public API ----------

/**
 * Compute the effective filters + run the engine. Does not persist anything.
 * Callers show this on `/session/start`; Shuffle reruns with a new seed.
 */
export async function previewSession(
	userId: string,
	options: PreviewOptions = {},
	db: Db = defaultDb,
	now: Date = new Date(),
): Promise<SessionPreview> {
	const plan = await getActivePlan(userId, db);
	if (!plan) throw new NoActivePlanError(userId);

	const mode = options.mode ?? (plan.defaultMode as SessionMode);
	const focus = options.focus ?? null;
	const cert = options.cert ?? null;
	const sessionLength = options.sessionLength ?? plan.sessionLength ?? DEFAULT_SESSION_LENGTH;
	const seed = options.seed ?? `${userId}:${now.getTime()}`;

	const [recentDomains, activeDomainsLast7Days, domainFrequencyLast30Days] = await Promise.all([
		fetchRecentSessionDomains(userId, db),
		fetchActiveDomainsLast7(userId, now, db),
		fetchDomainFrequency(userId, now, db),
	]);

	const certFilter: readonly Cert[] = cert ? [cert] : plan.certGoals;
	const focusFilter: readonly Domain[] = focus ? [focus] : plan.focusDomains;

	const filters: EnginePoolFilters = {
		certFilter,
		focusFilter,
		skipDomains: plan.skipDomains,
		skipNodes: plan.skipNodes,
		recentDomains,
		domainFrequencyLast30Days,
		activeDomainsLast7Days,
	};

	const pools = buildEnginePools(userId, now, db);

	const preview: EnginePreview = await runEngine(
		{
			plan: planRowToEnginePlan(plan),
			mode,
			filters,
			sessionLength,
			seed,
			pools,
		},
		now,
	);

	return {
		plan,
		mode,
		focus,
		cert,
		seed,
		sessionLength,
		items: preview.items,
		short: preview.short,
		allocation: preview.allocation,
	};
}

/**
 * Commit a preview to the DB. Creates one `session` row plus one
 * `session_item_result` row per slot (`presented_at=now`, no completion yet).
 */
export async function commitSession(
	userId: string,
	preview: SessionPreview,
	db: Db = defaultDb,
	now: Date = new Date(),
): Promise<SessionRow> {
	const sessionId = generateSessionId();
	return await db.transaction(async (tx) => {
		const [row] = await tx
			.insert(session)
			.values({
				id: sessionId,
				userId,
				planId: preview.plan.id,
				mode: preview.mode,
				focusOverride: preview.focus,
				certOverride: preview.cert,
				sessionLength: preview.sessionLength,
				items: preview.items,
				seed: preview.seed,
				startedAt: now,
				completedAt: null,
			})
			.returning();

		if (preview.items.length > 0) {
			const sirRows = preview.items.map((item, idx) => ({
				id: generateSessionItemResultId(),
				sessionId: row.id,
				userId,
				slotIndex: idx,
				itemKind: item.kind as SessionItemKind,
				slice: item.slice,
				reasonCode: item.reasonCode,
				cardId: item.kind === 'card' ? item.cardId : null,
				scenarioId: item.kind === 'rep' ? item.scenarioId : null,
				nodeId: item.kind === 'node_start' ? item.nodeId : null,
				reviewId: null,
				repAttemptId: null,
				skipKind: null,
				reasonDetail: item.reasonDetail ?? null,
				presentedAt: now,
				completedAt: null,
			}));
			await tx.insert(sessionItemResult).values(sirRows);
		}
		return row;
	});
}

/** Preview + commit in one call. */
export async function startSession(
	userId: string,
	options: PreviewOptions = {},
	db: Db = defaultDb,
	now: Date = new Date(),
): Promise<{ session: SessionRow; preview: SessionPreview }> {
	const preview = await previewSession(userId, options, db, now);
	const row = await commitSession(userId, preview, db, now);
	return { session: row, preview };
}

export async function getSession(sessionId: string, userId: string, db: Db = defaultDb): Promise<SessionRow | null> {
	const [row] = await db
		.select()
		.from(session)
		.where(and(eq(session.id, sessionId), eq(session.userId, userId)))
		.limit(1);
	return row ?? null;
}

export async function getSessionItemResults(
	sessionId: string,
	userId: string,
	db: Db = defaultDb,
): Promise<SessionItemResultRow[]> {
	return await db
		.select()
		.from(sessionItemResult)
		.where(and(eq(sessionItemResult.sessionId, sessionId), eq(sessionItemResult.userId, userId)))
		.orderBy(sessionItemResult.slotIndex);
}

export async function getSessions(userId: string, limit = 20, db: Db = defaultDb): Promise<SessionRow[]> {
	return await db
		.select()
		.from(session)
		.where(eq(session.userId, userId))
		.orderBy(desc(session.startedAt))
		.limit(limit);
}

/**
 * In-progress session the user can resume, if any. Resume window is
 * `RESUME_WINDOW_MS` after `startedAt`.
 */
export async function getResumableSession(
	userId: string,
	db: Db = defaultDb,
	now: Date = new Date(),
): Promise<SessionRow | null> {
	const cutoff = new Date(now.getTime() - RESUME_WINDOW_MS);
	const [row] = await db
		.select()
		.from(session)
		.where(and(eq(session.userId, userId), isNull(session.completedAt), gte(session.startedAt, cutoff)))
		.orderBy(desc(session.startedAt))
		.limit(1);
	return row ?? null;
}

/**
 * Mark a single session slot as completed. Idempotent per slotIndex: a second
 * call updates the existing row.
 */
export async function recordItemResult(
	sessionId: string,
	userId: string,
	result: ItemResultInput,
	db: Db = defaultDb,
	now: Date = new Date(),
): Promise<SessionItemResultRow> {
	const sess = await getSession(sessionId, userId, db);
	if (!sess) throw new SessionNotFoundError(sessionId, userId);

	const [existing] = await db
		.select()
		.from(sessionItemResult)
		.where(
			and(
				eq(sessionItemResult.sessionId, sessionId),
				eq(sessionItemResult.userId, userId),
				eq(sessionItemResult.slotIndex, result.slotIndex),
			),
		)
		.limit(1);

	if (existing) {
		const [updated] = await db
			.update(sessionItemResult)
			.set({
				itemKind: result.itemKind,
				slice: result.slice,
				reasonCode: result.reasonCode,
				cardId: result.cardId ?? existing.cardId,
				scenarioId: result.scenarioId ?? existing.scenarioId,
				nodeId: result.nodeId ?? existing.nodeId,
				reviewId: result.reviewId ?? existing.reviewId,
				repAttemptId: result.repAttemptId ?? existing.repAttemptId,
				skipKind: result.skipKind ?? existing.skipKind,
				reasonDetail: result.reasonDetail ?? existing.reasonDetail,
				completedAt: now,
			})
			.where(eq(sessionItemResult.id, existing.id))
			.returning();
		return updated;
	}

	const [inserted] = await db
		.insert(sessionItemResult)
		.values({
			id: generateSessionItemResultId(),
			sessionId,
			userId,
			slotIndex: result.slotIndex,
			itemKind: result.itemKind,
			slice: result.slice,
			reasonCode: result.reasonCode,
			cardId: result.cardId ?? null,
			scenarioId: result.scenarioId ?? null,
			nodeId: result.nodeId ?? null,
			reviewId: result.reviewId ?? null,
			repAttemptId: result.repAttemptId ?? null,
			skipKind: result.skipKind ?? null,
			reasonDetail: result.reasonDetail ?? null,
			presentedAt: now,
			completedAt: now,
		})
		.returning();
	return inserted;
}

/** Mark a session completed. Idempotent. */
export async function completeSession(
	sessionId: string,
	userId: string,
	db: Db = defaultDb,
	now: Date = new Date(),
): Promise<SessionRow> {
	const sess = await getSession(sessionId, userId, db);
	if (!sess) throw new SessionNotFoundError(sessionId, userId);
	if (sess.completedAt !== null) return sess;
	const [row] = await db
		.update(session)
		.set({ completedAt: now })
		.where(and(eq(session.id, sessionId), eq(session.userId, userId)))
		.returning();
	return row;
}

/**
 * Consecutive local-calendar days (ending today) with at least one attempted
 * (non-skipped) session_item_result. Skipped rows don't count.
 */
export async function getStreakDays(
	userId: string,
	tz: string = DEFAULT_USER_TIMEZONE,
	db: Db = defaultDb,
	now: Date = new Date(),
): Promise<number> {
	// SQL-side day bucketing in the user's timezone. Drizzle's sql``
	// fragment keeps the tz and the completed_at column inside a single
	// expression so DST boundaries resolve correctly.
	const dayRows = await db
		.selectDistinct({
			day: sql<string>`to_char((${sessionItemResult.completedAt} AT TIME ZONE ${tz}), 'YYYY-MM-DD')`,
		})
		.from(sessionItemResult)
		.where(
			and(
				eq(sessionItemResult.userId, userId),
				isNotNull(sessionItemResult.completedAt),
				isNull(sessionItemResult.skipKind),
			),
		)
		.orderBy(sql`1 desc`);

	if (dayRows.length === 0) return 0;

	// Local "today" via Intl formatter -- matches Postgres's `AT TIME ZONE`
	// day bucketing and sidesteps the need for a second round-trip just to
	// learn what "today" is in the caller's zone.
	const fmt = new Intl.DateTimeFormat('en-CA', {
		timeZone: tz,
		year: 'numeric',
		month: '2-digit',
		day: '2-digit',
	});
	const todayKey = fmt.format(now); // 'YYYY-MM-DD' in en-CA.

	const days = dayRows.map((r) => r.day);
	let streak = 0;
	let cursor = todayKey;
	for (const d of days) {
		if (d === cursor) {
			streak += 1;
			const dt = new Date(`${cursor}T00:00:00Z`);
			dt.setUTCDate(dt.getUTCDate() - 1);
			cursor = dt.toISOString().slice(0, 10);
		} else if (d < cursor) {
			break;
		}
	}
	return streak;
}

/**
 * Aggregate session summary. Reads the committed item-result rows and joins
 * against the underlying review / rep_attempt rows to compute correctness and
 * confidence.
 */
export async function getSessionSummary(
	sessionId: string,
	userId: string,
	db: Db = defaultDb,
	now: Date = new Date(),
): Promise<SessionSummary> {
	const sess = await getSession(sessionId, userId, db);
	if (!sess) throw new SessionNotFoundError(sessionId, userId);

	const sirRows = await getSessionItemResults(sessionId, userId, db);

	const attempted = sirRows.filter((r) => r.completedAt !== null && r.skipKind === null).length;
	const skippedByKind: Record<SessionSkipKind, number> = { today: 0, topic: 0, permanent: 0 };
	for (const r of sirRows) {
		if (r.skipKind) skippedByKind[r.skipKind as SessionSkipKind] += 1;
	}

	const reviewIds = sirRows.map((r) => r.reviewId).filter((id): id is string => id !== null);
	const repAttemptIds = sirRows.map((r) => r.repAttemptId).filter((id): id is string => id !== null);

	const reviews =
		reviewIds.length === 0
			? []
			: await db
					.select({ id: review.id, rating: review.rating, confidence: review.confidence })
					.from(review)
					.where(inArray(review.id, reviewIds));

	const attempts =
		repAttemptIds.length === 0
			? []
			: await db
					.select({ id: repAttempt.id, isCorrect: repAttempt.isCorrect, confidence: repAttempt.confidence })
					.from(repAttempt)
					.where(inArray(repAttempt.id, repAttemptIds));

	const reviewCorrect = reviews.filter((r) => Number(r.rating) >= 3).length;
	const repCorrect = attempts.filter((a) => a.isCorrect).length;
	const correct = reviewCorrect + repCorrect;

	const confidences = [
		...reviews.map((r) => r.confidence).filter((c): c is number => c !== null),
		...attempts.map((a) => a.confidence).filter((c): c is number => c !== null),
	];
	const avgConfidence = confidences.length === 0 ? null : confidences.reduce((s, n) => s + n, 0) / confidences.length;

	const nodesStarted = sirRows.filter(
		(r) => r.itemKind === SESSION_ITEM_KINDS.NODE_START && r.completedAt !== null,
	).length;

	const bySliceMap = new Map<SessionSlice, SessionSummarySliceRow>();
	for (const r of sirRows) {
		const slice = r.slice as SessionSlice;
		const entry = bySliceMap.get(slice) ?? { slice, attempted: 0, correct: 0, skipped: 0 };
		if (r.completedAt !== null && r.skipKind === null) entry.attempted += 1;
		if (r.skipKind) entry.skipped += 1;
		bySliceMap.set(slice, entry);
	}
	const reviewById = new Map(reviews.map((r) => [r.id, r]));
	const attemptById = new Map(attempts.map((a) => [a.id, a]));
	for (const r of sirRows) {
		if (!r.completedAt || r.skipKind) continue;
		const slice = r.slice as SessionSlice;
		const entry = bySliceMap.get(slice);
		if (!entry) continue;
		if (r.reviewId) {
			const rev = reviewById.get(r.reviewId);
			if (rev && Number(rev.rating) >= 3) entry.correct += 1;
		} else if (r.repAttemptId) {
			const att = attemptById.get(r.repAttemptId);
			if (att?.isCorrect) entry.correct += 1;
		}
	}

	const cardIdsTouched = sirRows.filter((r) => r.cardId && r.completedAt && !r.skipKind).map((r) => r.cardId as string);
	const scenarioIdsTouched = sirRows
		.filter((r) => r.scenarioId && r.completedAt && !r.skipKind)
		.map((r) => r.scenarioId as string);
	const nodeIdsTouched = sirRows.filter((r) => r.nodeId && r.completedAt && !r.skipKind).map((r) => r.nodeId as string);

	const domainSet = new Set<Domain>();
	if (cardIdsTouched.length > 0) {
		const rows = await db.select({ domain: card.domain }).from(card).where(inArray(card.id, cardIdsTouched));
		for (const r of rows) if (DOMAIN_VALUES.includes(r.domain as Domain)) domainSet.add(r.domain as Domain);
	}
	if (scenarioIdsTouched.length > 0) {
		const rows = await db
			.select({ domain: scenario.domain })
			.from(scenario)
			.where(inArray(scenario.id, scenarioIdsTouched));
		for (const r of rows) if (DOMAIN_VALUES.includes(r.domain as Domain)) domainSet.add(r.domain as Domain);
	}
	if (nodeIdsTouched.length > 0) {
		const rows = await db
			.select({ domain: knowledgeNode.domain })
			.from(knowledgeNode)
			.where(inArray(knowledgeNode.id, nodeIdsTouched));
		for (const r of rows) if (DOMAIN_VALUES.includes(r.domain as Domain)) domainSet.add(r.domain as Domain);
	}

	const streakDays = await getStreakDays(userId, DEFAULT_USER_TIMEZONE, db, now);

	// Suggested next -- up to 3 non-binding hints.
	const suggestedNext: string[] = [];
	const tomorrow = new Date(now.getTime() + 24 * 60 * 60 * 1000);
	const [dueTomorrowRow] = await db
		.select({ c: sql<number>`count(*)::int` })
		.from(cardState)
		.innerJoin(card, and(eq(card.id, cardState.cardId), eq(card.userId, cardState.userId)))
		.where(
			and(
				eq(cardState.userId, userId),
				eq(card.status, CARD_STATUSES.ACTIVE),
				gte(cardState.dueAt, now),
				lt(cardState.dueAt, tomorrow),
			),
		);
	const dueTomorrow = Number(dueTomorrowRow?.c ?? 0);
	if (dueTomorrow > 0) {
		suggestedNext.push(`${dueTomorrow} ${dueTomorrow === 1 ? 'card' : 'cards'} due in the next 24 hours`);
	}

	if (sess.mode === SESSION_MODES.CONTINUE || sess.mode === SESSION_MODES.EXPAND) {
		const [relearningRow] = await db
			.select({ c: sql<number>`count(*)::int` })
			.from(cardState)
			.innerJoin(card, and(eq(card.id, cardState.cardId), eq(card.userId, cardState.userId)))
			.where(
				and(
					eq(cardState.userId, userId),
					eq(cardState.state, CARD_STATES.RELEARNING),
					eq(card.status, CARD_STATUSES.ACTIVE),
				),
			);
		if (Number(relearningRow?.c ?? 0) > 5) {
			suggestedNext.push('Try a Strengthen session to hit relearning cards');
		}
	}

	const nodeStarts = sirRows.filter((r) => r.itemKind === SESSION_ITEM_KINDS.NODE_START && r.nodeId && r.completedAt);
	if (nodeStarts.length > 0 && nodeStarts[0].nodeId) {
		suggestedNext.push(`Continue working through ${nodeStarts[0].nodeId}`);
	}

	return {
		session: sess,
		totalItems: sirRows.length,
		attempted,
		correct,
		skippedByKind,
		avgConfidence,
		domainsTouched: Array.from(domainSet),
		nodesStarted,
		bySlice: Array.from(bySliceMap.values()),
		streakDays,
		suggestedNext: suggestedNext.slice(0, 3),
	};
}
