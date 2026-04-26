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
	type CardState,
	CERT_VALUES,
	type Cert,
	type ConfidenceLevel,
	certsCoveredBy,
	DEFAULT_SESSION_LENGTH,
	DEFAULT_USER_TIMEZONE,
	DOMAIN_VALUES,
	type Domain,
	MS_PER_DAY,
	MS_PER_WEEK,
	QUERY_PARAMS,
	RESUME_WINDOW_MS,
	ROUTES,
	SCENARIO_STATUSES,
	SESSION_ITEM_KINDS,
	SESSION_MODES,
	SESSION_SKIP_KIND_VALUES,
	SESSION_SKIP_KINDS,
	type SessionItemKind,
	type SessionMode,
	type SessionReasonCode,
	type SessionSkipKind,
	type SessionSlice,
	STUDY_PRIORITIES,
	type StudyPriority,
} from '@ab/constants';
import { db as defaultDb } from '@ab/db';
import { generateSessionId, generateSessionItemResultId } from '@ab/utils';
import { and, desc, eq, gte, inArray, isNotNull, isNull, lt, sql } from 'drizzle-orm';
import type { PgDatabase, PgQueryResultHKT } from 'drizzle-orm/pg-core';
import { setCardStatus } from './cards';
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
import { getNodeMasteryMap } from './knowledge';
import { addSkipDomain, addSkipNode, getActivePlan, NoActivePlanError } from './plans';
import { setScenarioStatus } from './scenarios';
import {
	card,
	cardState,
	knowledgeEdge,
	knowledgeNode,
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
	skipKind?: SessionSkipKind | null;
	reasonDetail?: string | null;
	/**
	 * Rep outcome fields. Populated when itemKind='rep' and the learner
	 * submits a real answer (skipKind stays null). Per ADR 012, rep outcomes
	 * live on session_item_result directly -- there is no separate attempt
	 * row.
	 */
	chosenOption?: string | null;
	isCorrect?: boolean | null;
	confidence?: ConfidenceLevel | null;
	answerMs?: number | null;
}

export interface SessionSummarySliceRow {
	slice: SessionSlice;
	attempted: number;
	correct: number;
	skipped: number;
}

/**
 * One "do this next" action rendered at the bottom of the summary page.
 *
 * `href` is the concrete URL the UI should link to (server-rendered so the
 * client doesn't need to duplicate route shaping). `variant` lets the UI pick
 * the button treatment -- `primary` for the single highest-priority follow-up,
 * `secondary` for the rest.
 */
export interface SessionSuggestedAction {
	label: string;
	href: string;
	variant: 'primary' | 'secondary';
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
	/**
	 * Clickable follow-up actions computed from just-finished state. Rendered
	 * as links/buttons by the summary page -- each one takes the learner to a
	 * specific filtered review / session / node instead of a hint they have to
	 * parse and navigate by hand.
	 */
	suggestedNext: SessionSuggestedAction[];
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
	// Pull cards + their materialized state + the single last-review rating
	// in one round-trip. `cardState.lastReviewId` is already the pointer to
	// the latest review for each (card, user); joining to it lifts `rating`
	// without scanning the whole review history for this user.
	const rows = await db
		.select({
			card,
			state: cardState,
			lastRating: review.rating,
		})
		.from(card)
		.innerJoin(cardState, and(eq(cardState.cardId, card.id), eq(cardState.userId, card.userId)))
		.leftJoin(review, eq(review.id, cardState.lastReviewId))
		.where(and(eq(card.userId, userId), eq(card.status, CARD_STATUSES.ACTIVE)));

	return rows.map((r) => {
		const lastReviewedAt = r.state.lastReviewedAt?.getTime() ?? null;
		const dueAtMs = r.state.dueAt.getTime();
		// overdueRatio = overdue / scheduled. Only clamp scheduledMs to 1 day
		// when we have no prior review (lastReviewedAt IS NULL) to avoid a
		// divide-by-zero for unreviewed cards. For learning-state cards with
		// short scheduled intervals (e.g. 15 minutes), use the real interval
		// so their overdue-ness registers properly in the Continue slice.
		const scheduledMs = lastReviewedAt === null ? MS_PER_DAY : Math.max(1, dueAtMs - lastReviewedAt);
		const overdueMs = Math.max(0, now.getTime() - dueAtMs);
		const overdueRatio = overdueMs / scheduledMs;
		return {
			cardId: r.card.id,
			domain: r.card.domain as Domain,
			nodeId: r.card.nodeId ?? null,
			state: r.state.state as CardState,
			dueAt: r.state.dueAt,
			lastRating: r.lastRating !== null ? Number(r.lastRating) : null,
			stability: r.state.stability,
			overdueRatio,
		};
	});
}

/** Rep candidates + last-5 accuracy for the engine. */
async function fetchRepCandidates(userId: string, now: Date, db: Db): Promise<EngineRepCandidate[]> {
	const sevenDaysAgo = new Date(now.getTime() - MS_PER_WEEK);

	const scenarios = await db
		.select()
		.from(scenario)
		.where(and(eq(scenario.userId, userId), eq(scenario.status, SCENARIO_STATUSES.ACTIVE)));

	if (scenarios.length === 0) return [];

	const scenarioIds = scenarios.map((s) => s.id);
	// Attempt history lives on session_item_result -- one row per completed
	// rep slot. Non-null scenarioId + itemKind='rep' + completedAt IS NOT NULL +
	// skipKind IS NULL is the "real attempt" predicate (ADR 012).
	const attempts = await db
		.select({
			scenarioId: sessionItemResult.scenarioId,
			isCorrect: sessionItemResult.isCorrect,
			completedAt: sessionItemResult.completedAt,
		})
		.from(sessionItemResult)
		.where(
			and(
				eq(sessionItemResult.userId, userId),
				eq(sessionItemResult.itemKind, SESSION_ITEM_KINDS.REP),
				isNotNull(sessionItemResult.completedAt),
				isNotNull(sessionItemResult.scenarioId),
				isNull(sessionItemResult.skipKind),
				inArray(sessionItemResult.scenarioId, scenarioIds),
			),
		)
		.orderBy(desc(sessionItemResult.completedAt));

	const byScenario = new Map<string, Array<{ isCorrect: boolean; attemptedAt: Date }>>();
	for (const att of attempts) {
		if (att.scenarioId === null || att.isCorrect === null || att.completedAt === null) continue;
		const list = byScenario.get(att.scenarioId);
		if (list) list.push({ isCorrect: att.isCorrect, attemptedAt: att.completedAt });
		else byScenario.set(att.scenarioId, [{ isCorrect: att.isCorrect, attemptedAt: att.completedAt }]);
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
 * `minimumCert` is covered by the user's cert filter (via `certsCoveredBy`),
 * marks `unstarted` by left-joining card / rep / session_item_result
 * presence, and computes `prerequisitesMet` via dual-gate `isNodeMastered`
 * on each `requires` prerequisite. Untagged nodes (`minimumCert IS NULL`)
 * are skipped until an author tags them.
 */
async function fetchNodeCandidates(
	userId: string,
	certFilter: readonly Cert[],
	db: Db,
	_now: Date,
): Promise<EngineNodeCandidate[]> {
	const nodes = await db
		.select({
			id: knowledgeNode.id,
			domain: knowledgeNode.domain,
			crossDomains: knowledgeNode.crossDomains,
			minimumCert: knowledgeNode.minimumCert,
			studyPriority: knowledgeNode.studyPriority,
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
			.innerJoin(sessionItemResult, eq(sessionItemResult.scenarioId, scenario.id))
			.where(
				and(
					eq(sessionItemResult.userId, userId),
					eq(sessionItemResult.itemKind, SESSION_ITEM_KINDS.REP),
					isNotNull(sessionItemResult.completedAt),
					isNull(sessionItemResult.skipKind),
					isNotNull(scenario.nodeId),
					inArray(scenario.nodeId, nodeIds),
				),
			)
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

	// Compute mastery for every distinct prerequisite target in ONE batched
	// query rather than 3-per-id round-trips (was `isNodeMastered` in a
	// Promise.all before -- see perf review 2026-04-22).
	const prereqTargets = new Set<string>();
	for (const list of requiresByFrom.values()) for (const id of list) prereqTargets.add(id);
	const masteryByNode = new Map<string, boolean>();
	if (prereqTargets.size > 0) {
		const masteryMap = await getNodeMasteryMap(userId, Array.from(prereqTargets), db);
		for (const id of prereqTargets) {
			masteryByNode.set(id, masteryMap.get(id)?.mastered ?? false);
		}
	}

	// Cert-filter inheritance: a goal-cert holder is responsible for everything
	// in `certsCoveredBy(goal)`. The user picks one or more cert goals on the
	// study plan; the union of their inheritance sets is the eligibility list.
	// An empty cert filter means "no cert goals set" -- include every tagged
	// node regardless of cert.
	const eligibleCerts = new Set<Cert>();
	for (const c of certFilter) for (const covered of certsCoveredBy(c)) eligibleCerts.add(covered);

	const candidates: EngineNodeCandidate[] = [];
	for (const n of nodes) {
		const minCert = (n.minimumCert as Cert | null) ?? null;
		// Untagged nodes (no minimum_cert yet) are skipped by the engine -- they
		// shouldn't surface in expand until the author tags them.
		if (minCert === null) continue;
		if (certFilter.length > 0 && !eligibleCerts.has(minCert)) continue;

		const priority = ((n.studyPriority as StudyPriority | null) ?? STUDY_PRIORITIES.STANDARD) satisfies StudyPriority;

		// Without the per-cert bloom array we no longer have a per-node depth
		// signal. Engine still scores depth-match at the user-preference level
		// via `DEPTH_PREFERENCES`; nodes contribute null until a richer
		// per-node depth signal exists.
		const bloomDepth: EngineNodeCandidate['bloomDepth'] = null;

		const unstarted = !cardTouched.has(n.id) && !repTouched.has(n.id) && !sirTouched.has(n.id);
		const requires = requiresByFrom.get(n.id) ?? [];
		const prerequisitesMet = requires.every((target) => masteryByNode.get(target) === true);

		candidates.push({
			nodeId: n.id,
			domain: n.domain as Domain,
			crossDomains: (n.crossDomains ?? []) as readonly string[],
			priority,
			minimumCert: minCert,
			prerequisitesMet,
			bloomDepth,
			unstarted,
		});
	}
	return candidates;
}

async function fetchDomainFrequency(userId: string, now: Date, db: Db): Promise<Record<string, number>> {
	const thirtyAgo = new Date(now.getTime() - 30 * MS_PER_DAY);
	const [reviewRows, attemptRows] = await Promise.all([
		db
			.select({ domain: card.domain, n: sql<number>`count(*)::int` })
			.from(review)
			.innerJoin(card, eq(card.id, review.cardId))
			.where(and(eq(review.userId, userId), gte(review.reviewedAt, thirtyAgo)))
			.groupBy(card.domain),
		db
			.select({ domain: scenario.domain, n: sql<number>`count(*)::int` })
			.from(sessionItemResult)
			.innerJoin(scenario, eq(scenario.id, sessionItemResult.scenarioId))
			.where(
				and(
					eq(sessionItemResult.userId, userId),
					eq(sessionItemResult.itemKind, SESSION_ITEM_KINDS.REP),
					isNotNull(sessionItemResult.completedAt),
					isNull(sessionItemResult.skipKind),
					gte(sessionItemResult.completedAt, thirtyAgo),
				),
			)
			.groupBy(scenario.domain),
	]);

	const freq: Record<string, number> = {};
	for (const r of reviewRows) freq[r.domain] = (freq[r.domain] ?? 0) + Number(r.n);
	for (const r of attemptRows) freq[r.domain] = (freq[r.domain] ?? 0) + Number(r.n);
	return freq;
}

async function fetchActiveDomainsLast7(userId: string, now: Date, db: Db): Promise<Domain[]> {
	const sevenAgo = new Date(now.getTime() - MS_PER_WEEK);
	const [reviewRows, attemptRows] = await Promise.all([
		db
			.selectDistinct({ domain: card.domain })
			.from(review)
			.innerJoin(card, eq(card.id, review.cardId))
			.where(and(eq(review.userId, userId), gte(review.reviewedAt, sevenAgo))),
		db
			.selectDistinct({ domain: scenario.domain })
			.from(sessionItemResult)
			.innerJoin(scenario, eq(scenario.id, sessionItemResult.scenarioId))
			.where(
				and(
					eq(sessionItemResult.userId, userId),
					eq(sessionItemResult.itemKind, SESSION_ITEM_KINDS.REP),
					isNotNull(sessionItemResult.completedAt),
					isNull(sessionItemResult.skipKind),
					gte(sessionItemResult.completedAt, sevenAgo),
				),
			),
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
			if (item.kind === SESSION_ITEM_KINDS.CARD) cardIds.add(item.cardId);
			else if (item.kind === SESSION_ITEM_KINDS.REP) scenarioIds.add(item.scenarioId);
			else if (item.kind === SESSION_ITEM_KINDS.NODE_START) nodeIds.add(item.nodeId);
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
 *
 * Note on `now`: `startSession` threads a single `now` through preview and
 * commit so slot `presentedAt` matches the engine's view of `dueAt`. `now` is
 * required so callers have to pick a timestamp explicitly -- otherwise a
 * standalone preview would use `new Date()` and a follow-up `commitSession`
 * with a different `now` could produce slot rows whose `presentedAt` predates
 * the engine's view of `dueAt`.
 */
export async function previewSession(
	userId: string,
	options: PreviewOptions,
	now: Date,
	db: Db = defaultDb,
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
	now: Date,
	db: Db = defaultDb,
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
				cardId: item.kind === SESSION_ITEM_KINDS.CARD ? item.cardId : null,
				scenarioId: item.kind === SESSION_ITEM_KINDS.REP ? item.scenarioId : null,
				nodeId: item.kind === SESSION_ITEM_KINDS.NODE_START ? item.nodeId : null,
				reviewId: null,
				skipKind: null,
				reasonDetail: item.reasonDetail ?? null,
				chosenOption: null,
				isCorrect: null,
				confidence: null,
				answerMs: null,
				presentedAt: now,
				completedAt: null,
			}));
			await tx.insert(sessionItemResult).values(sirRows);
		}
		return row;
	});
}

/** Preview + commit in one call. Threads a single `now` through both legs. */
export async function startSession(
	userId: string,
	options: PreviewOptions = {},
	db: Db = defaultDb,
	now: Date = new Date(),
): Promise<{ session: SessionRow; preview: SessionPreview }> {
	const preview = await previewSession(userId, options, now, db);
	const row = await commitSession(userId, preview, now, db);
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

/**
 * Single-row fetch for one slot of a session. Backed by the
 * `sir_session_slot_unique` UNIQUE index on (session_id, slot_index); the
 * `userId` predicate is an authorization guard that filters out rows owned
 * by a different user on the same session id (shouldn't happen in practice
 * since commitSession stamps userId from the session row, but the BC keeps
 * the guard so a caller can't sidestep it).
 *
 * Used by the session runner's per-action `loadSlot` path, which previously
 * fetched every slot row just to pick one out.
 */
export async function getSessionItemResult(
	sessionId: string,
	userId: string,
	slotIndex: number,
	db: Db = defaultDb,
): Promise<SessionItemResultRow | null> {
	const [row] = await db
		.select()
		.from(sessionItemResult)
		.where(
			and(
				eq(sessionItemResult.sessionId, sessionId),
				eq(sessionItemResult.userId, userId),
				eq(sessionItemResult.slotIndex, slotIndex),
			),
		)
		.limit(1);
	return row ?? null;
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
 * Raised when the caller tries to record a slot that does not exist on the
 * session. Every slot row is created at commit time (`commitSession`); a
 * missing row indicates either a stale slot index or out-of-band deletion.
 */
export class SessionSlotNotFoundError extends Error {
	constructor(
		public readonly sessionId: string,
		public readonly slotIndex: number,
	) {
		super(`Slot ${slotIndex} not found in session ${sessionId}`);
		this.name = 'SessionSlotNotFoundError';
	}
}

/**
 * Mark a single session slot as completed. Idempotent per `(session_id,
 * slot_index)`: a second call updates the existing row instead of inserting a
 * duplicate.
 *
 * The UNIQUE(session_id, slot_index) constraint on `session_item_result`
 * backs an atomic UPSERT (`.onConflictDoUpdate`), so two concurrent writers
 * for the same slot (double-submit, SvelteKit `enhance` retry, dup tab)
 * collapse to exactly one row.
 *
 * Field semantics: `undefined` means "leave existing value unchanged",
 * `null` means "clear the field". This lets a second-pass record legitimately
 * unset a field without that being indistinguishable from "I forgot to pass
 * it." `itemKind`, `slice`, `reasonCode`, and `slotIndex` are always set from
 * the engine-authored slot row at commit time and must be supplied here.
 *
 * INVARIANT: when `result.reviewId` is non-null, the caller must have just
 * produced that review row for `userId`. `submitReview` (reviews.ts) is the
 * only write path today: it inserts the review and returns the id, which is
 * then passed straight through here. We defensively re-check ownership so a
 * buggy caller can't smuggle someone else's review id onto a slot result.
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

	if (result.reviewId) {
		const [rev] = await db
			.select({ id: review.id })
			.from(review)
			.where(and(eq(review.id, result.reviewId), eq(review.userId, userId)))
			.limit(1);
		if (!rev) throw new SessionNotFoundError(sessionId, userId);
	}

	// Build the UPDATE set, omitting any field the caller didn't provide so
	// the existing row's value is preserved. `undefined` = skip, `null` = clear.
	const updateSet: Partial<typeof sessionItemResult.$inferInsert> = {
		itemKind: result.itemKind,
		slice: result.slice,
		reasonCode: result.reasonCode,
		completedAt: now,
	};
	if (result.cardId !== undefined) updateSet.cardId = result.cardId;
	if (result.scenarioId !== undefined) updateSet.scenarioId = result.scenarioId;
	if (result.nodeId !== undefined) updateSet.nodeId = result.nodeId;
	if (result.reviewId !== undefined) updateSet.reviewId = result.reviewId;
	if (result.skipKind !== undefined) updateSet.skipKind = result.skipKind;
	if (result.reasonDetail !== undefined) updateSet.reasonDetail = result.reasonDetail;
	if (result.chosenOption !== undefined) updateSet.chosenOption = result.chosenOption;
	if (result.isCorrect !== undefined) updateSet.isCorrect = result.isCorrect;
	if (result.confidence !== undefined) updateSet.confidence = result.confidence;
	if (result.answerMs !== undefined) updateSet.answerMs = result.answerMs;

	// The BC contract is that slots are inserted by `commitSession`; results
	// UPSERT an existing row. If no row exists for this slot, it's an error
	// condition worth surfacing -- inserting a fresh row here would accept
	// slotIndex / itemKind values the caller controls rather than the engine
	// snapshot, and the `presentedAt` would be wrong (now, not commit time).
	// The ON CONFLICT target is UNIQUE(session_id, slot_index) so this UPSERT
	// is atomic even under concurrent writers.
	const rows = await db
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
			skipKind: result.skipKind ?? null,
			reasonDetail: result.reasonDetail ?? null,
			chosenOption: result.chosenOption ?? null,
			isCorrect: result.isCorrect ?? null,
			confidence: result.confidence ?? null,
			answerMs: result.answerMs ?? null,
			presentedAt: now,
			completedAt: now,
		})
		.onConflictDoUpdate({
			target: [sessionItemResult.sessionId, sessionItemResult.slotIndex],
			set: updateSet,
		})
		.returning();

	const row = rows[0];
	if (!row) throw new SessionSlotNotFoundError(sessionId, result.slotIndex);
	return row;
}

/** Slot shape the `skipSessionSlot` orchestration needs. Narrow on purpose --
 * the caller resolves it from `getSessionItemResult` and passes in just the
 * fields that matter for the write path. */
export interface SkipSessionSlotInput {
	userId: string;
	sessionId: string;
	slot: {
		slotIndex: number;
		itemKind: SessionItemKind;
		slice: SessionSlice;
		reasonCode: SessionReasonCode;
		cardId: string | null;
		scenarioId: string | null;
		nodeId: string | null;
		reasonDetail: string | null;
	};
	skipKind: SessionSkipKind;
	/** Domain resolved by the caller when `slot.nodeId` is null and the skip
	 * kind mutates the plan. Null when skipKind is TODAY or when a nodeId is
	 * already set (node takes precedence). */
	fallbackDomain: Domain | null;
}

/**
 * Transactional skip: writes the session_item_result row, mutates the plan's
 * skip_nodes / skip_domains, and (for PERMANENT) suspends the underlying
 * card or scenario -- all on the same `db.transaction`. If any step throws
 * the whole thing rolls back; the caller sees one typed failure instead of a
 * half-applied skip.
 *
 * Previously the route handler did each write outside a transaction and
 * swallowed downstream errors so the slot stayed recorded while the plan
 * mutation quietly failed. That could leave a "permanent" skip without the
 * content suspension the user asked for -- a correctness bug.
 */
export async function skipSessionSlot(input: SkipSessionSlotInput, db: Db = defaultDb): Promise<void> {
	const { userId, sessionId, slot, skipKind, fallbackDomain } = input;

	await db.transaction(async (tx) => {
		await recordItemResult(
			sessionId,
			userId,
			{
				slotIndex: slot.slotIndex,
				itemKind: slot.itemKind,
				slice: slot.slice,
				reasonCode: slot.reasonCode,
				cardId: slot.cardId,
				scenarioId: slot.scenarioId,
				nodeId: slot.nodeId,
				skipKind,
				reasonDetail: slot.reasonDetail,
			},
			tx,
		);

		if (skipKind === SESSION_SKIP_KINDS.TODAY) return;

		// TOPIC + PERMANENT mutate the plan; PERMANENT additionally suspends
		// the content row. Use the same tx so a plan-write failure rolls the
		// slot write back instead of leaving a ghost skip.
		const plan = await getActivePlan(userId, tx);
		if (plan) {
			if (slot.nodeId) {
				await addSkipNode(plan.id, userId, slot.nodeId, tx);
			} else if (fallbackDomain) {
				await addSkipDomain(plan.id, userId, fallbackDomain, tx);
			}
		}

		if (skipKind === SESSION_SKIP_KINDS.PERMANENT) {
			if (slot.itemKind === SESSION_ITEM_KINDS.CARD && slot.cardId) {
				await setCardStatus(slot.cardId, userId, CARD_STATUSES.SUSPENDED, tx);
			} else if (slot.itemKind === SESSION_ITEM_KINDS.REP && slot.scenarioId) {
				await setScenarioStatus(slot.scenarioId, userId, SCENARIO_STATUSES.SUSPENDED, tx);
			}
			// Node-start slots have no content row to suspend; the skipNode
			// mutation above is the full persistence.
		}
	});
}

/**
 * Mark a session completed. Truly idempotent: the UPDATE predicate matches
 * only rows with `completed_at IS NULL`, so a second caller sees 0 rows
 * updated and falls back to re-selecting the already-completed row. Two
 * concurrent finish submits can't produce divergent completion timestamps.
 */
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
		.where(and(eq(session.id, sessionId), eq(session.userId, userId), isNull(session.completedAt)))
		.returning();
	if (row) return row;

	// A concurrent writer won the race. Re-fetch to return the committed row.
	const reread = await getSession(sessionId, userId, db);
	if (!reread) throw new SessionNotFoundError(sessionId, userId);
	return reread;
}

/**
 * Consecutive local-calendar days (ending today) with at least one attempted
 * (non-skipped) session_item_result. Skipped rows don't count.
 *
 * Grace rule: if the user has no activity today but has activity yesterday,
 * the streak continues -- "7 day streak" shouldn't silently flip to 0
 * overnight just because the user hasn't opened the app yet that morning.
 * This matches dashboard.ts / stats.ts behavior.
 */
export async function getStreakDays(
	userId: string,
	tz: string = DEFAULT_USER_TIMEZONE,
	db: Db = defaultDb,
	now: Date = new Date(),
): Promise<number> {
	// Streak can't exceed ~366 consecutive days; bounding the row scan keeps
	// this O(window) instead of O(history) regardless of user age. Chosen
	// window matches dashboard.ts extendedStreak's 366-day lookback.
	const lookbackStart = new Date(now.getTime() - 366 * MS_PER_DAY);

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
				gte(sessionItemResult.completedAt, lookbackStart),
			),
		)
		.orderBy(sql`1 desc`);

	if (dayRows.length === 0) return 0;

	// Local "today" / "yesterday" via Intl formatter -- matches Postgres's
	// `AT TIME ZONE` day bucketing and sidesteps the need for a second
	// round-trip just to learn what "today" is in the caller's zone.
	const fmt = new Intl.DateTimeFormat('en-CA', {
		timeZone: tz,
		year: 'numeric',
		month: '2-digit',
		day: '2-digit',
	});
	const todayKey = fmt.format(now); // 'YYYY-MM-DD' in en-CA.
	const yesterdayKey = fmt.format(new Date(now.getTime() - MS_PER_DAY));

	const days = dayRows.map((r) => r.day);

	// Grace: the learner hasn't studied today yet, but yesterday is in the
	// set -- start the walk at yesterday instead of today so the streak
	// doesn't flip to 0 between midnight and the first session of the day.
	let cursor = days[0] === todayKey ? todayKey : yesterdayKey;

	let streak = 0;
	for (const d of days) {
		if (d > cursor) continue; // Skip ahead past the grace-skipped day.
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
 * against the underlying review rows for card correctness; rep correctness
 * lives on the slot row itself (ADR 012).
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
		// Guard against unknown skip kinds (future migration lag, old rows)
		// so the dict lookup never produces NaN. Rows with unrecognized kinds
		// are silently excluded from the summary counts.
		if (r.skipKind && (SESSION_SKIP_KIND_VALUES as readonly string[]).includes(r.skipKind)) {
			skippedByKind[r.skipKind as SessionSkipKind] += 1;
		}
	}

	const reviewIds = sirRows.map((r) => r.reviewId).filter((id): id is string => id !== null);

	const reviews =
		reviewIds.length === 0
			? []
			: await db
					.select({ id: review.id, rating: review.rating, confidence: review.confidence })
					.from(review)
					.where(inArray(review.id, reviewIds));

	// Rep outcomes come straight from the slot row. A rep is "counted" when
	// it completed with a real answer (skipKind IS NULL) and carries a
	// definite is_correct value (ADR 012).
	const repSlots = sirRows.filter(
		(r) =>
			r.itemKind === SESSION_ITEM_KINDS.REP && r.completedAt !== null && r.skipKind === null && r.isCorrect !== null,
	);

	const reviewCorrect = reviews.filter((r) => Number(r.rating) >= 3).length;
	const repCorrect = repSlots.filter((s) => s.isCorrect === true).length;
	const correct = reviewCorrect + repCorrect;

	const confidences = [
		...reviews.map((r) => r.confidence).filter((c): c is number => c !== null),
		...repSlots.map((s) => s.confidence).filter((c): c is number => c !== null),
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
	for (const r of sirRows) {
		if (!r.completedAt || r.skipKind) continue;
		const slice = r.slice as SessionSlice;
		const entry = bySliceMap.get(slice);
		if (!entry) continue;
		if (r.reviewId) {
			const rev = reviewById.get(r.reviewId);
			if (rev && Number(rev.rating) >= 3) entry.correct += 1;
		} else if (r.itemKind === SESSION_ITEM_KINDS.REP) {
			// Rep correctness is on the slot row itself (ADR 012).
			if (r.isCorrect === true) entry.correct += 1;
		}
	}

	const cardIdsTouched = sirRows.filter((r) => r.cardId && r.completedAt && !r.skipKind).map((r) => r.cardId as string);
	const scenarioIdsTouched = sirRows
		.filter((r) => r.scenarioId && r.completedAt && !r.skipKind)
		.map((r) => r.scenarioId as string);
	const nodeIdsTouched = sirRows.filter((r) => r.nodeId && r.completedAt && !r.skipKind).map((r) => r.nodeId as string);

	// Domain lookups + streak are independent; fan them out rather than
	// serial-awaiting each. All three domain legs are IN-list lookups that
	// short-circuit to an empty array when nothing was touched.
	const [cardDomainRows, scenarioDomainRows, nodeDomainRows, streakDays] = await Promise.all([
		cardIdsTouched.length > 0
			? db.select({ domain: card.domain }).from(card).where(inArray(card.id, cardIdsTouched))
			: Promise.resolve([] as Array<{ domain: string }>),
		scenarioIdsTouched.length > 0
			? db.select({ domain: scenario.domain }).from(scenario).where(inArray(scenario.id, scenarioIdsTouched))
			: Promise.resolve([] as Array<{ domain: string }>),
		nodeIdsTouched.length > 0
			? db.select({ domain: knowledgeNode.domain }).from(knowledgeNode).where(inArray(knowledgeNode.id, nodeIdsTouched))
			: Promise.resolve([] as Array<{ domain: string }>),
		getStreakDays(userId, DEFAULT_USER_TIMEZONE, db, now),
	]);

	const domainSet = new Set<Domain>();
	for (const r of cardDomainRows) if (DOMAIN_VALUES.includes(r.domain as Domain)) domainSet.add(r.domain as Domain);
	for (const r of scenarioDomainRows) if (DOMAIN_VALUES.includes(r.domain as Domain)) domainSet.add(r.domain as Domain);
	for (const r of nodeDomainRows) if (DOMAIN_VALUES.includes(r.domain as Domain)) domainSet.add(r.domain as Domain);

	// Suggested next -- up to 3 structured, clickable actions. Each hint maps
	// to a concrete route so the UI can render a button/link rather than prose
	// the learner has to parse and navigate by hand. The three lookups
	// (due-tomorrow count, relearning count, node title) are independent of
	// each other, so batch them in a single Promise.all to cut the load-path
	// round-trips from three sequential hits to one parallel fan-out.
	const suggestedNext: SessionSuggestedAction[] = [];
	const tomorrow = new Date(now.getTime() + MS_PER_DAY);
	const nodeStarts = sirRows.filter((r) => r.itemKind === SESSION_ITEM_KINDS.NODE_START && r.nodeId && r.completedAt);
	const firstNodeId = nodeStarts[0]?.nodeId ?? null;
	const wantRelearning = sess.mode === SESSION_MODES.CONTINUE || sess.mode === SESSION_MODES.EXPAND;

	const [dueTomorrowRows, relearningRows, nodeTitleRow] = await Promise.all([
		db
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
			),
		wantRelearning
			? db
					.select({ c: sql<number>`count(*)::int` })
					.from(cardState)
					.innerJoin(card, and(eq(card.id, cardState.cardId), eq(card.userId, cardState.userId)))
					.where(
						and(
							eq(cardState.userId, userId),
							eq(cardState.state, CARD_STATES.RELEARNING),
							eq(card.status, CARD_STATUSES.ACTIVE),
						),
					)
			: Promise.resolve([] as Array<{ c: number }>),
		firstNodeId
			? db.select({ title: knowledgeNode.title }).from(knowledgeNode).where(eq(knowledgeNode.id, firstNodeId)).limit(1)
			: Promise.resolve([] as Array<{ title: string }>),
	]);

	const dueTomorrow = Number(dueTomorrowRows[0]?.c ?? 0);
	if (dueTomorrow > 0) {
		suggestedNext.push({
			label: `Review ${dueTomorrow} ${dueTomorrow === 1 ? 'card' : 'cards'} due in the next 24 hours`,
			href: ROUTES.MEMORY_REVIEW,
			variant: 'primary',
		});
	}

	if (wantRelearning && Number(relearningRows[0]?.c ?? 0) > 5) {
		suggestedNext.push({
			label: 'Start a Strengthen session to hit relearning cards',
			href: `${ROUTES.SESSION_START}?${QUERY_PARAMS.SESSION_MODE}=${SESSION_MODES.STRENGTHEN}`,
			variant: suggestedNext.length === 0 ? 'primary' : 'secondary',
		});
	}

	if (firstNodeId) {
		// Resolve the node title so the button label reads naturally instead
		// of showing a raw kebab-case slug.
		const title = nodeTitleRow[0]?.title ?? firstNodeId;
		suggestedNext.push({
			label: `Continue: ${title}`,
			href: ROUTES.KNOWLEDGE_LEARN(firstNodeId),
			variant: suggestedNext.length === 0 ? 'primary' : 'secondary',
		});
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
