/**
 * Session engine (pure function).
 *
 * Given an `EngineInputs` bundle -- plan, effective filters, mode, seed,
 * session length, and a set of pool-query callbacks -- returns the ordered
 * `SessionItem[]` that becomes the session's committed batch. No DB access:
 * the callbacks abstract every read so this module stays unit-testable with
 * fakes and deterministic under the same (seed, inputs).
 *
 * Algorithm phases (see spec "Engine algorithm"):
 *
 *   1. Build per-slice scored pools from the callbacks.
 *   2. Resolve mode weights; run largest-remainder slot allocation.
 *   3. Redistribute slots when a pool is smaller than its quota.
 *   4. Within each slice, sort by score desc with a seeded-random
 *      tiebreaker; take the allocated count.
 *   5. Interleave across slices in SLICE_ORDER so play order varies.
 */

import {
	CARD_STATES,
	type CardState,
	type Cert,
	DEPTH_PREFERENCES,
	type DepthPreference,
	type Domain,
	ENGINE_SCORING,
	MODE_WEIGHTS,
	RELEVANCE_PRIORITIES,
	REVIEW_RATINGS,
	type RelevancePriority,
	SESSION_ITEM_KINDS,
	SESSION_REASON_CODES,
	SESSION_SLICES,
	type SessionItemKind,
	type SessionMode,
	type SessionReasonCode,
	type SessionSlice,
	SLICE_PRIORITY,
} from '@ab/constants';
import type { SessionItem } from './schema';

// ---------- Types ----------

/** Minimal plan shape the engine needs. Decoupled from `StudyPlanRow`. */
export interface EnginePlan {
	id: string;
	userId: string;
	certGoals: readonly Cert[];
	focusDomains: readonly Domain[];
	skipDomains: readonly Domain[];
	skipNodes: readonly string[];
	depthPreference: DepthPreference;
	sessionLength: number;
}

/** A candidate card the engine can place into a slot. */
export interface EngineCardCandidate {
	cardId: string;
	domain: Domain;
	nodeId: string | null;
	state: CardState;
	dueAt: Date;
	/** Rating of the last review; null for never-reviewed cards. */
	lastRating: number | null;
	stability: number;
	/**
	 * How many intervals overdue the card is (0 when due today or earlier
	 * within a single interval). Computed by the pool callback.
	 */
	overdueRatio: number;
}

export interface EngineRepCandidate {
	scenarioId: string;
	domain: Domain;
	nodeId: string | null;
	/** Accuracy over the user's last N attempts; 0 if unattempted. */
	accuracyLast5: number;
	attemptedInLast7Days: boolean;
	lastIncorrectAt: Date | null;
}

export interface EngineNodeCandidate {
	nodeId: string;
	domain: Domain;
	crossDomains: readonly string[];
	/** Priority from relevance[] entries matching the user's cert_filter. */
	priority: RelevancePriority;
	/**
	 * True when every `requires` prerequisite resolves to a node the user has
	 * mastered (per knowledge-graph dual-gate isNodeMastered). Engine refuses
	 * to pick unstarted nodes whose prerequisites haven't matured.
	 */
	prerequisitesMet: boolean;
	bloomDepth: DepthPreference | null;
	/**
	 * True when the user has never touched this node (no reviews, attempts,
	 * or node_start records against it).
	 */
	unstarted: boolean;
	certs: readonly Cert[];
}

/** Aggregate domain-level mastery trend produced by graph BC. */
export interface EngineDomainMasteryTrend {
	domain: Domain;
	score: number;
	/** 14-day delta of `score` -- negative == slipping, positive == improving. */
	delta: number;
}

export interface EnginePoolFilters {
	certFilter: readonly Cert[];
	focusFilter: readonly Domain[];
	skipDomains: readonly Domain[];
	skipNodes: readonly string[];
	/** Domains the user touched in the last 2 completed sessions. */
	recentDomains: readonly Domain[];
	/** Domains the user has touched in the last 30 days (diversify scoring). */
	domainFrequencyLast30Days: Readonly<Record<string, number>>;
	/** Domains touched in the last 7 days (diversify candidate gate). */
	activeDomainsLast7Days: readonly Domain[];
}

/**
 * Pool-query callbacks. The orchestrator (`sessions.ts`) builds these over
 * Drizzle; tests pass fakes.
 */
export interface EnginePoolQueries {
	cards: (filters: EnginePoolFilters) => Promise<EngineCardCandidate[]>;
	reps: (filters: EnginePoolFilters) => Promise<EngineRepCandidate[]>;
	nodes: (filters: EnginePoolFilters) => Promise<EngineNodeCandidate[]>;
	domainTrend: (domains: readonly Domain[]) => Promise<EngineDomainMasteryTrend[]>;
	/**
	 * Per-domain "is the user overconfident here?" score 0..1, used only as a
	 * Strengthen tiebreaker. Zero for unknowns.
	 */
	overconfidenceByDomain: (domains: readonly Domain[]) => Promise<Record<string, number>>;
}

export interface EngineInputs {
	plan: EnginePlan;
	mode: SessionMode;
	/** Override filters passed into the engine (session-level). */
	filters: EnginePoolFilters;
	sessionLength: number;
	/** Deterministic tiebreaker seed. Shuffle produces a new seed. */
	seed: string;
	pools: EnginePoolQueries;
}

export interface EnginePreview {
	items: SessionItem[];
	/** True when the engine produced fewer items than the requested session length. */
	short: boolean;
	/** Final integer allocations the engine applied, by slice. */
	allocation: Record<SessionSlice, number>;
}

// ---------- Public functions ----------

/** Return the weight tuple for a session mode. Pure. */
export function modeWeights(mode: SessionMode): Record<SessionSlice, number> {
	return MODE_WEIGHTS[mode];
}

/**
 * Largest-remainder allocation from a weight tuple to an integer count.
 *
 * Multiplies each weight by `length`, floors each, then hands out the
 * leftover slots one at a time to whichever slice has the largest fractional
 * remainder. Ties broken in SLICE_PRIORITY order (strengthen > continue >
 * expand > diversify per spec).
 *
 * The output is guaranteed to sum to exactly `length` and to have every slice
 * present as a key (possibly 0).
 */
export function allocateSlots(weights: Record<SessionSlice, number>, length: number): Record<SessionSlice, number> {
	const slices = Object.keys(SESSION_SLICES).map((k) => SESSION_SLICES[k as keyof typeof SESSION_SLICES]);
	const raw: Array<{ slice: SessionSlice; floor: number; remainder: number }> = slices.map((slice) => {
		const exact = (weights[slice] ?? 0) * length;
		const floor = Math.floor(exact);
		return { slice, floor, remainder: exact - floor };
	});
	let assigned = raw.reduce((s, r) => s + r.floor, 0);
	let remaining = length - assigned;

	// Sort by remainder desc, then by SLICE_PRIORITY asc (index-of).
	raw.sort((a, b) => {
		if (b.remainder !== a.remainder) return b.remainder - a.remainder;
		return SLICE_PRIORITY.indexOf(a.slice) - SLICE_PRIORITY.indexOf(b.slice);
	});

	const result: Record<SessionSlice, number> = {
		[SESSION_SLICES.CONTINUE]: 0,
		[SESSION_SLICES.STRENGTHEN]: 0,
		[SESSION_SLICES.EXPAND]: 0,
		[SESSION_SLICES.DIVERSIFY]: 0,
	};
	for (const r of raw) result[r.slice] = r.floor;
	let idx = 0;
	while (remaining > 0 && idx < raw.length) {
		result[raw[idx].slice] += 1;
		remaining -= 1;
		idx += 1;
	}
	// Fallback: when every slice had weight 0 (shouldn't happen; the mode
	// rows sum to 1) just stuff the remainder into strengthen so we never
	// return an undersum.
	if (remaining > 0) {
		result[SESSION_SLICES.STRENGTHEN] += remaining;
	}
	assigned = Object.values(result).reduce((s, n) => s + n, 0);
	// Trim any accidental overshoot from accumulated rounding; shouldn't
	// happen but keeps the invariant airtight.
	if (assigned > length) {
		const overflow = assigned - length;
		for (const slice of [...SLICE_PRIORITY].reverse()) {
			if (result[slice] > 0 && result[slice] >= overflow) {
				result[slice] -= overflow;
				break;
			}
		}
	}
	return result;
}

/** Deterministic PRNG seeded by a string (mulberry32 over an fnv-1a hash). */
function createSeededRandom(seed: string): () => number {
	let h = 2166136261 >>> 0;
	for (let i = 0; i < seed.length; i++) {
		h ^= seed.charCodeAt(i);
		h = Math.imul(h, 16777619);
	}
	let state = h >>> 0;
	return () => {
		state = (state + 0x6d2b79f5) >>> 0;
		let t = state;
		t = Math.imul(t ^ (t >>> 15), t | 1);
		t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
		return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
	};
}

// ---------- Scoring ----------

/** Continue-slice score. Prefers items in last-session domains that are due now. */
function scoreContinueCard(card: EngineCardCandidate, filters: EnginePoolFilters, now: Date): number {
	const lastIdx = filters.recentDomains.indexOf(card.domain);
	if (lastIdx === -1) return 0;
	// Last session == index 0, second-to-last == index 1. Earlier = lower weight.
	const domainRecencyWeight =
		lastIdx === 0 ? ENGINE_SCORING.CONTINUE.LAST_SESSION_DOMAIN : ENGINE_SCORING.CONTINUE.EARLIER_RECENT_DOMAIN;
	const dueMs = Math.max(0, now.getTime() - card.dueAt.getTime());
	const dueUrgency =
		Math.min(1, dueMs / ENGINE_SCORING.WINDOWS.DUE_URGENCY_SATURATION_MS) + Math.min(1, card.overdueRatio);
	return (
		domainRecencyWeight * ENGINE_SCORING.CONTINUE.DOMAIN_RECENCY_SHARE +
		Math.min(1, dueUrgency) * ENGINE_SCORING.CONTINUE.DUE_URGENCY_SHARE
	);
}

function scoreContinueRep(rep: EngineRepCandidate, filters: EnginePoolFilters): number {
	const lastIdx = filters.recentDomains.indexOf(rep.domain);
	if (lastIdx === -1) return 0;
	const domainRecencyWeight =
		lastIdx === 0 ? ENGINE_SCORING.CONTINUE.LAST_SESSION_DOMAIN : ENGINE_SCORING.CONTINUE.EARLIER_RECENT_DOMAIN;
	// Lower accuracy == more urgent. Clamp to [0, 1].
	const urgency = Math.min(1, Math.max(0, 1 - rep.accuracyLast5));
	const recentMiss = rep.lastIncorrectAt ? ENGINE_SCORING.CONTINUE.RECENT_MISS_BONUS : 0;
	return (
		domainRecencyWeight * ENGINE_SCORING.CONTINUE.DOMAIN_RECENCY_SHARE +
		urgency * ENGINE_SCORING.CONTINUE.DUE_URGENCY_SHARE +
		recentMiss
	);
}

/** Strengthen-slice card score. Rewards relearning > rated-Again > overdue. */
function scoreStrengthenCard(card: EngineCardCandidate, overconfidence: number): number {
	let base = 0;
	if (card.state === CARD_STATES.RELEARNING) base += ENGINE_SCORING.STRENGTHEN.RELEARNING;
	if (card.lastRating === REVIEW_RATINGS.AGAIN)
		base += ENGINE_SCORING.STRENGTHEN.RATED_AGAIN; // Again
	else if (card.lastRating === REVIEW_RATINGS.HARD) base += ENGINE_SCORING.STRENGTHEN.RATED_HARD; // Hard
	if (card.overdueRatio >= ENGINE_SCORING.THRESHOLDS.HEAVILY_OVERDUE_RATIO)
		base += ENGINE_SCORING.STRENGTHEN.HEAVILY_OVERDUE;
	return base + overconfidence * ENGINE_SCORING.STRENGTHEN.OVERCONFIDENCE_FACTOR;
}

function scoreStrengthenRep(rep: EngineRepCandidate, overconfidence: number): number {
	let base = 0;
	if (rep.accuracyLast5 < ENGINE_SCORING.THRESHOLDS.REP_LOW_ACCURACY)
		base += ENGINE_SCORING.STRENGTHEN.REP_LOW_ACCURACY;
	if (rep.lastIncorrectAt) base += ENGINE_SCORING.STRENGTHEN.REP_RECENT_MISS;
	return base + overconfidence * ENGINE_SCORING.STRENGTHEN.OVERCONFIDENCE_FACTOR;
}

function scoreExpandNode(
	node: EngineNodeCandidate,
	filters: EnginePoolFilters,
	depthPreference: DepthPreference,
): number {
	const priorityWeight =
		node.priority === RELEVANCE_PRIORITIES.CORE
			? ENGINE_SCORING.EXPAND.PRIORITY_CORE
			: node.priority === RELEVANCE_PRIORITIES.SUPPORTING
				? ENGINE_SCORING.EXPAND.PRIORITY_SUPPORTING
				: ENGINE_SCORING.EXPAND.PRIORITY_ELECTIVE;
	const focusMatch = filters.focusFilter.includes(node.domain) ? ENGINE_SCORING.EXPAND.FOCUS_DOMAIN_MATCH : 0;
	const bloomMatch =
		node.bloomDepth !== null && node.bloomDepth === depthPreference ? ENGINE_SCORING.EXPAND.BLOOM_DEPTH_MATCH : 0;
	return priorityWeight + focusMatch + bloomMatch;
}

function diversifyFrequencyScore(domain: string, filters: EnginePoolFilters): number {
	const total = Object.values(filters.domainFrequencyLast30Days).reduce((s, n) => s + n, 0);
	if (total === 0) return 1;
	const own = filters.domainFrequencyLast30Days[domain] ?? 0;
	return 1 - own / total;
}

// ---------- Engine orchestration ----------

/**
 * Classify which continue-slice reason code applies to a card, given the
 * filters' recent-domain signal. Kept local so the scoring and labeling move
 * together.
 */
function continueCardReason(card: EngineCardCandidate): SessionReasonCode {
	if (card.overdueRatio >= ENGINE_SCORING.THRESHOLDS.CONTINUE_DUE_RATIO)
		return SESSION_REASON_CODES.CONTINUE_DUE_IN_DOMAIN;
	return SESSION_REASON_CODES.CONTINUE_RECENT_DOMAIN;
}

function strengthenCardReason(card: EngineCardCandidate): SessionReasonCode {
	if (card.state === CARD_STATES.RELEARNING) return SESSION_REASON_CODES.STRENGTHEN_RELEARNING;
	if (card.lastRating === REVIEW_RATINGS.AGAIN || card.lastRating === REVIEW_RATINGS.HARD)
		return SESSION_REASON_CODES.STRENGTHEN_RATED_AGAIN;
	if (card.overdueRatio >= ENGINE_SCORING.THRESHOLDS.HEAVILY_OVERDUE_RATIO)
		return SESSION_REASON_CODES.STRENGTHEN_OVERDUE;
	return SESSION_REASON_CODES.STRENGTHEN_RATED_AGAIN;
}

function strengthenRepReason(rep: EngineRepCandidate): SessionReasonCode {
	if (rep.accuracyLast5 < ENGINE_SCORING.THRESHOLDS.REP_LOW_ACCURACY)
		return SESSION_REASON_CODES.STRENGTHEN_LOW_REP_ACCURACY;
	return SESSION_REASON_CODES.STRENGTHEN_MASTERY_DROP;
}

function expandNodeReason(node: EngineNodeCandidate, filters: EnginePoolFilters): SessionReasonCode {
	if (filters.focusFilter.includes(node.domain)) return SESSION_REASON_CODES.EXPAND_FOCUS_MATCH;
	if (node.priority === RELEVANCE_PRIORITIES.CORE) return SESSION_REASON_CODES.EXPAND_UNSTARTED_PRIORITY;
	return SESSION_REASON_CODES.EXPAND_UNSTARTED_READY;
}

interface Scored<T> {
	candidate: T;
	score: number;
	kind: SessionItemKind;
	slice: SessionSlice;
	reasonCode: SessionReasonCode;
	reasonDetail?: string;
}

function applyTiebreak<T>(pool: Scored<T>[], rand: () => number): Scored<T>[] {
	// Stable sort by (score desc, deterministic noise asc). The noise is
	// regenerated per-call from the seeded PRNG so Shuffle produces different
	// orderings across calls while staying reproducible for a given seed.
	return pool
		.map((p) => ({ p, noise: rand() }))
		.sort((a, b) => {
			if (b.p.score !== a.p.score) return b.p.score - a.p.score;
			return a.noise - b.noise;
		})
		.map((x) => x.p);
}

function toSessionItem<T extends { cardId?: string; scenarioId?: string; nodeId?: string }>(
	scored: Scored<T>,
): SessionItem {
	const { slice, reasonCode, reasonDetail } = scored;
	if (scored.kind === SESSION_ITEM_KINDS.CARD) {
		const cardId = (scored.candidate as unknown as EngineCardCandidate).cardId;
		return { kind: SESSION_ITEM_KINDS.CARD, cardId, slice, reasonCode, reasonDetail };
	}
	if (scored.kind === SESSION_ITEM_KINDS.REP) {
		const scenarioId = (scored.candidate as unknown as EngineRepCandidate).scenarioId;
		return { kind: SESSION_ITEM_KINDS.REP, scenarioId, slice, reasonCode, reasonDetail };
	}
	const nodeId = (scored.candidate as unknown as EngineNodeCandidate).nodeId;
	return { kind: SESSION_ITEM_KINDS.NODE_START, nodeId, slice, reasonCode, reasonDetail };
}

interface IdentityKey {
	kind: SessionItemKind;
	id: string;
}

function identityOf(s: SessionItem): IdentityKey {
	if (s.kind === SESSION_ITEM_KINDS.CARD) return { kind: SESSION_ITEM_KINDS.CARD, id: s.cardId };
	if (s.kind === SESSION_ITEM_KINDS.REP) return { kind: SESSION_ITEM_KINDS.REP, id: s.scenarioId };
	return { kind: SESSION_ITEM_KINDS.NODE_START, id: s.nodeId };
}

function identityKeyOfScored<T>(s: Scored<T>): IdentityKey {
	if (s.kind === SESSION_ITEM_KINDS.CARD)
		return { kind: SESSION_ITEM_KINDS.CARD, id: (s.candidate as EngineCardCandidate).cardId };
	if (s.kind === SESSION_ITEM_KINDS.REP)
		return { kind: SESSION_ITEM_KINDS.REP, id: (s.candidate as EngineRepCandidate).scenarioId };
	return { kind: SESSION_ITEM_KINDS.NODE_START, id: (s.candidate as EngineNodeCandidate).nodeId };
}

function serializeKey(k: IdentityKey): string {
	return `${k.kind}:${k.id}`;
}

/**
 * Run the engine end-to-end. Callers (sessions.ts) wire the pool callbacks;
 * tests pass stubs. Returns an `EnginePreview` containing the ordered items,
 * a `short` flag, and the final slice allocation.
 */
export async function runEngine(inputs: EngineInputs, now: Date = new Date()): Promise<EnginePreview> {
	const { plan, mode, filters, sessionLength, seed, pools } = inputs;

	// 1. Fetch raw candidate pools.
	const [cards, reps, nodes, overconfidence] = await Promise.all([
		pools.cards(filters),
		pools.reps(filters),
		pools.nodes(filters),
		pools.overconfidenceByDomain(
			Array.from(
				new Set<Domain>([
					...filters.focusFilter,
					...filters.recentDomains,
					...(filters.activeDomainsLast7Days as Domain[]),
				]),
			),
		),
	]);

	// 2. Build scored per-slice pools.
	const continuePool: Scored<EngineCardCandidate | EngineRepCandidate>[] = [];
	for (const c of cards) {
		const s = scoreContinueCard(c, filters, now);
		if (s > 0) {
			continuePool.push({
				candidate: c,
				score: s,
				kind: SESSION_ITEM_KINDS.CARD,
				slice: SESSION_SLICES.CONTINUE,
				reasonCode: continueCardReason(c),
			});
		}
	}
	for (const r of reps) {
		const s = scoreContinueRep(r, filters);
		if (s > 0) {
			continuePool.push({
				candidate: r,
				score: s,
				kind: SESSION_ITEM_KINDS.REP,
				slice: SESSION_SLICES.CONTINUE,
				reasonCode: SESSION_REASON_CODES.CONTINUE_RECENT_DOMAIN,
			});
		}
	}

	const strengthenPool: Scored<EngineCardCandidate | EngineRepCandidate>[] = [];
	for (const c of cards) {
		const over = overconfidence[c.domain] ?? 0;
		const s = scoreStrengthenCard(c, over);
		if (s > 0) {
			strengthenPool.push({
				candidate: c,
				score: s,
				kind: SESSION_ITEM_KINDS.CARD,
				slice: SESSION_SLICES.STRENGTHEN,
				reasonCode: strengthenCardReason(c),
				reasonDetail: strengthenCardDetail(c),
			});
		}
	}
	for (const r of reps) {
		const over = overconfidence[r.domain] ?? 0;
		const s = scoreStrengthenRep(r, over);
		if (s > 0) {
			strengthenPool.push({
				candidate: r,
				score: s,
				kind: SESSION_ITEM_KINDS.REP,
				slice: SESSION_SLICES.STRENGTHEN,
				reasonCode: strengthenRepReason(r),
				reasonDetail: strengthenRepDetail(r),
			});
		}
	}

	const expandPool: Scored<EngineNodeCandidate>[] = [];
	for (const n of nodes) {
		if (!n.unstarted || !n.prerequisitesMet) continue;
		if (filters.skipDomains.includes(n.domain)) continue;
		if (filters.skipNodes.includes(n.nodeId)) continue;
		if (filters.certFilter.length > 0 && !n.certs.some((c) => filters.certFilter.includes(c))) continue;
		const s = scoreExpandNode(n, filters, plan.depthPreference);
		expandPool.push({
			candidate: n,
			score: s,
			kind: SESSION_ITEM_KINDS.NODE_START,
			slice: SESSION_SLICES.EXPAND,
			reasonCode: expandNodeReason(n, filters),
		});
	}

	const diversifyPool: Scored<EngineCardCandidate | EngineRepCandidate | EngineNodeCandidate>[] = [];
	const activeSet = new Set(filters.activeDomainsLast7Days);
	for (const c of cards) {
		if (activeSet.has(c.domain)) continue;
		const freq = diversifyFrequencyScore(c.domain, filters);
		if (freq > 0) {
			diversifyPool.push({
				candidate: c,
				score: freq,
				kind: SESSION_ITEM_KINDS.CARD,
				slice: SESSION_SLICES.DIVERSIFY,
				reasonCode: SESSION_REASON_CODES.DIVERSIFY_UNUSED_DOMAIN,
			});
		}
	}
	for (const r of reps) {
		if (activeSet.has(r.domain)) continue;
		const freq = diversifyFrequencyScore(r.domain, filters);
		if (freq > 0) {
			diversifyPool.push({
				candidate: r,
				score: freq,
				kind: SESSION_ITEM_KINDS.REP,
				slice: SESSION_SLICES.DIVERSIFY,
				reasonCode: SESSION_REASON_CODES.DIVERSIFY_CROSS_DOMAIN_APPLY,
			});
		}
	}
	for (const n of nodes) {
		if (!n.unstarted || !n.prerequisitesMet) continue;
		if (activeSet.has(n.domain)) continue;
		if (filters.skipDomains.includes(n.domain)) continue;
		if (filters.skipNodes.includes(n.nodeId)) continue;
		if (filters.certFilter.length > 0 && !n.certs.some((c) => filters.certFilter.includes(c))) continue;
		const freq = diversifyFrequencyScore(n.domain, filters);
		if (freq > 0) {
			diversifyPool.push({
				candidate: n,
				score:
					freq +
					(plan.depthPreference === DEPTH_PREFERENCES.DEEP ? ENGINE_SCORING.DIVERSIFY.DEEP_DEPTH_PREFERENCE_BONUS : 0),
				kind: SESSION_ITEM_KINDS.NODE_START,
				slice: SESSION_SLICES.DIVERSIFY,
				reasonCode: SESSION_REASON_CODES.DIVERSIFY_UNUSED_DOMAIN,
			});
		}
	}

	// Apply focus filter as a *preference*, not a hard gate (spec: "prefer
	// items matching focus domains"). We do this by promoting focus-matching
	// items' scores. Skip/cert filters are hard.
	function promoteForFocus<T extends { candidate: { domain?: Domain } }>(pool: Array<Scored<unknown> & T>): void {
		if (filters.focusFilter.length === 0) return;
		for (const item of pool) {
			const domain = item.candidate.domain;
			if (domain && filters.focusFilter.includes(domain)) {
				item.score += ENGINE_SCORING.DIVERSIFY.CROSS_DOMAIN_APPLY_BONUS;
			}
		}
	}
	promoteForFocus(continuePool);
	promoteForFocus(strengthenPool);
	promoteForFocus(diversifyPool);

	// Hard-filter skip_domains/skip_nodes on cards/reps within continue/strengthen/diversify.
	function hardFilter<T>(pool: Scored<T>[]): Scored<T>[] {
		return pool.filter((p) => {
			const c = p.candidate as { domain?: Domain; nodeId?: string | null };
			if (c.domain && filters.skipDomains.includes(c.domain)) return false;
			if (c.nodeId && filters.skipNodes.includes(c.nodeId)) return false;
			return true;
		});
	}

	const filteredContinue = hardFilter(continuePool);
	const filteredStrengthen = hardFilter(strengthenPool);
	const filteredDiversify = hardFilter(diversifyPool);

	// 3. Allocate slots via largest-remainder rounding.
	const weights = modeWeights(mode);
	const requestedAllocation = allocateSlots(weights, sessionLength);

	const rand = createSeededRandom(seed);

	// Sort each pool deterministically up front so redistribution later is stable.
	const sortedContinue = applyTiebreak(filteredContinue, rand);
	const sortedStrengthen = applyTiebreak(filteredStrengthen, rand);
	const sortedExpand = applyTiebreak(expandPool, rand);
	const sortedDiversify = applyTiebreak(filteredDiversify, rand);

	const available: Record<SessionSlice, number> = {
		[SESSION_SLICES.CONTINUE]: sortedContinue.length,
		[SESSION_SLICES.STRENGTHEN]: sortedStrengthen.length,
		[SESSION_SLICES.EXPAND]: sortedExpand.length,
		[SESSION_SLICES.DIVERSIFY]: sortedDiversify.length,
	};

	// 4. Redistribute slots when a pool is shorter than its quota. Hand off
	// leftover slots to the other slices in SLICE_PRIORITY order (weights
	// break further ties).
	const allocation = redistribute(requestedAllocation, available);

	// 5. Take top-N per slice, de-duplicating across slices. An item may
	// appear in multiple pools; the loop below visits slices in descending
	// SLICE_PRIORITY order, so a duplicate lands in the highest-priority
	// slice that wants it. Within a slice, sorted-by-score decides. This is
	// priority-first, not score-first, on purpose -- the slice taxonomy is
	// the product-level shape (Continue before Strengthen before Expand
	// before Diversify) and a 0.95-scoring Diversify candidate should still
	// go to Continue if Continue wants it.
	const picked: Array<{ slice: SessionSlice; scored: Scored<unknown> }> = [];
	const seen = new Set<string>();

	function takeFromSlice(slice: SessionSlice, sorted: Array<Scored<unknown>>): void {
		const want = allocation[slice];
		let taken = 0;
		for (const s of sorted) {
			if (taken >= want) break;
			const key = serializeKey(identityKeyOfScored(s));
			if (seen.has(key)) continue;
			seen.add(key);
			picked.push({ slice, scored: s });
			taken += 1;
		}
	}

	// Visit slices in descending priority so the winner of a duplicate goes
	// to the higher-priority slice.
	for (const slice of SLICE_PRIORITY) {
		if (slice === SESSION_SLICES.CONTINUE) takeFromSlice(slice, sortedContinue);
		else if (slice === SESSION_SLICES.STRENGTHEN) takeFromSlice(slice, sortedStrengthen);
		else if (slice === SESSION_SLICES.EXPAND) takeFromSlice(slice, sortedExpand);
		else takeFromSlice(slice, sortedDiversify);
	}

	// 6. Interleave in SLICE_ORDER play order so the user sees a mix.
	const bySlice: Record<SessionSlice, SessionItem[]> = {
		[SESSION_SLICES.CONTINUE]: [],
		[SESSION_SLICES.STRENGTHEN]: [],
		[SESSION_SLICES.EXPAND]: [],
		[SESSION_SLICES.DIVERSIFY]: [],
	};
	for (const p of picked) {
		// Generic variance: picked.scored is Scored<unknown>, toSessionItem narrows
		// via scored.kind. Cast is type-safe at runtime.
		bySlice[p.slice].push(
			toSessionItem(p.scored as unknown as Scored<{ cardId?: string; scenarioId?: string; nodeId?: string }>),
		);
	}
	const items: SessionItem[] = [];
	const playOrder: readonly SessionSlice[] = [
		SESSION_SLICES.CONTINUE,
		SESSION_SLICES.STRENGTHEN,
		SESSION_SLICES.EXPAND,
		SESSION_SLICES.DIVERSIFY,
	];
	let anyRemaining = true;
	while (anyRemaining) {
		anyRemaining = false;
		for (const slice of playOrder) {
			const q = bySlice[slice];
			if (q.length > 0) {
				items.push(q.shift() as SessionItem);
				anyRemaining = true;
			}
		}
	}

	// Finalize actual allocation (may differ from request when a slice's
	// after-dedupe take is below its quota -- though that should not happen
	// because picked is constructed slice-by-slice).
	const actualAllocation: Record<SessionSlice, number> = {
		[SESSION_SLICES.CONTINUE]: 0,
		[SESSION_SLICES.STRENGTHEN]: 0,
		[SESSION_SLICES.EXPAND]: 0,
		[SESSION_SLICES.DIVERSIFY]: 0,
	};
	for (const it of items) actualAllocation[it.slice] += 1;
	// Silence unused-helper warnings on identityOf / plan fields used for
	// logging only.
	void identityOf;
	void plan;

	return {
		items,
		short: items.length < sessionLength,
		allocation: actualAllocation,
	};
}

// ---------- Redistribution ----------

/**
 * Take a requested allocation (sum == length) and the available-per-slice
 * map. Where a slice has fewer candidates than its quota, donate the
 * leftover to the other slices in SLICE_PRIORITY order. Always returns an
 * allocation whose sum is <= length and whose per-slice value is <=
 * available for that slice.
 */
export function redistribute(
	requested: Record<SessionSlice, number>,
	available: Record<SessionSlice, number>,
): Record<SessionSlice, number> {
	const result: Record<SessionSlice, number> = {
		[SESSION_SLICES.CONTINUE]: 0,
		[SESSION_SLICES.STRENGTHEN]: 0,
		[SESSION_SLICES.EXPAND]: 0,
		[SESSION_SLICES.DIVERSIFY]: 0,
	};
	let leftover = 0;
	for (const slice of Object.keys(requested) as SessionSlice[]) {
		const want = requested[slice];
		const have = available[slice];
		if (have >= want) {
			result[slice] = want;
		} else {
			result[slice] = have;
			leftover += want - have;
		}
	}
	// Distribute leftover by priority.
	while (leftover > 0) {
		let placed = false;
		for (const slice of SLICE_PRIORITY) {
			if (result[slice] < available[slice]) {
				result[slice] += 1;
				leftover -= 1;
				placed = true;
				if (leftover === 0) break;
			}
		}
		if (!placed) break; // Pools exhausted; return a short allocation.
	}
	return result;
}

// ---------- Reason detail helpers ----------

function strengthenCardDetail(card: EngineCardCandidate): string | undefined {
	if (card.state === CARD_STATES.RELEARNING) return 'Relearning state';
	if (card.lastRating === REVIEW_RATINGS.AGAIN) return 'You rated Again recently';
	if (card.lastRating === REVIEW_RATINGS.HARD) return 'You rated Hard recently';
	if (card.overdueRatio >= ENGINE_SCORING.THRESHOLDS.HEAVILY_OVERDUE_RATIO)
		return `Overdue by ${Math.round(card.overdueRatio)}x scheduled interval`;
	return undefined;
}

function strengthenRepDetail(rep: EngineRepCandidate): string | undefined {
	if (rep.accuracyLast5 < ENGINE_SCORING.THRESHOLDS.REP_LOW_ACCURACY) {
		const pct = Math.round(rep.accuracyLast5 * 100);
		return `Accuracy ${pct}% over last attempts`;
	}
	if (rep.lastIncorrectAt) return 'Recent incorrect attempt';
	return undefined;
}
