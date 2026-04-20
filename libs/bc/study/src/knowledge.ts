/**
 * Knowledge-graph BC functions.
 *
 * Reads/upserts knowledge_node, knowledge_edge, and bulk-manages the
 * `targetExists` flag on edges. The build script is the only writer in
 * practice today; route handlers read through `getNodeView` / `listNodes`.
 *
 * Graph validation (cycle detection in `requires` edges) lives here so tests
 * and the build script share a single implementation.
 */

import {
	CARD_MASTERY_RATIO_THRESHOLD,
	CARD_MIN,
	CARD_STATUSES,
	KNOWLEDGE_EDGE_TYPES,
	type KnowledgeEdgeType,
	REP_ACCURACY_THRESHOLD,
	REP_MIN,
	STABILITY_MASTERED_DAYS,
} from '@ab/constants';
import { db as defaultDb } from '@ab/db';
import { and, asc, count, eq, inArray, sql } from 'drizzle-orm';
import type { PgDatabase, PgQueryResultHKT } from 'drizzle-orm/pg-core';
import {
	type CardRow,
	type CardStateRow,
	card,
	cardState,
	type KnowledgeEdgeRow,
	type KnowledgeNodeRow,
	knowledgeEdge,
	knowledgeNode,
	type NewKnowledgeEdgeRow,
	type NewKnowledgeNodeRow,
	repAttempt,
	scenario,
} from './schema';

type Db = PgDatabase<PgQueryResultHKT, Record<string, never>>;

/** Raised when graph validation finds a cycle in the `requires` relation. */
export class KnowledgeGraphCycleError extends Error {
	constructor(public readonly cycle: readonly string[]) {
		super(`Cycle in requires edges: ${cycle.join(' -> ')}`);
		this.name = 'KnowledgeGraphCycleError';
	}
}

/** A full node view for the render route: node + edges + linked cards. */
export interface NodeView {
	node: KnowledgeNodeRow;
	/** Outbound edges from this node. Target may or may not exist. */
	edges: KnowledgeEdgeRow[];
	/** Incoming edges pointing at this node. Useful for "applied_by" / "taught_by" display. */
	inboundEdges: KnowledgeEdgeRow[];
	/** Cards seeded against this node for the current user. */
	cards: Array<{ card: CardRow; state: CardStateRow }>;
}

/** A compact node summary used in listings (dashboard, navigation). */
export interface NodeSummary {
	id: string;
	title: string;
	domain: string;
	estimatedTimeMinutes: number | null;
	cardCount: number;
}

/**
 * Validate the requires sub-graph for cycles. Returns the first cycle found
 * (in traversal order, including the repeated start node) or null when the
 * graph is acyclic.
 *
 * Edges whose target doesn't appear in `nodeIds` are ignored -- an edge to a
 * gap cannot close a cycle. That's per-ADR permissive behavior.
 */
export function findRequiresCycle(
	nodeIds: readonly string[],
	requiresEdges: ReadonlyArray<{ fromNodeId: string; toNodeId: string }>,
): string[] | null {
	const nodeSet = new Set(nodeIds);
	const outgoing = new Map<string, string[]>();
	for (const id of nodeIds) outgoing.set(id, []);
	for (const edge of requiresEdges) {
		if (!nodeSet.has(edge.fromNodeId) || !nodeSet.has(edge.toNodeId)) continue;
		const list = outgoing.get(edge.fromNodeId);
		if (list) list.push(edge.toNodeId);
	}

	const UNVISITED = 0 as const;
	const VISITING = 1 as const;
	const DONE = 2 as const;
	const color = new Map<string, 0 | 1 | 2>();
	for (const id of nodeIds) color.set(id, UNVISITED);
	const parent = new Map<string, string | null>();

	function walk(start: string): string[] | null {
		// Iterative DFS; avoids stack blowups on a 500-node graph and gives us
		// a clean way to reconstruct the cycle path from the parent map.
		const stack: Array<{ id: string; childIdx: number }> = [{ id: start, childIdx: 0 }];
		color.set(start, VISITING);
		parent.set(start, null);
		while (stack.length > 0) {
			const frame = stack[stack.length - 1];
			const children = outgoing.get(frame.id) ?? [];
			if (frame.childIdx >= children.length) {
				color.set(frame.id, DONE);
				stack.pop();
				continue;
			}
			const child = children[frame.childIdx];
			frame.childIdx++;
			const childColor = color.get(child);
			if (childColor === VISITING) {
				// Cycle: walk the parent chain from frame.id back to `child`.
				const cycle: string[] = [child];
				let cur: string | null = frame.id;
				while (cur !== null && cur !== child) {
					cycle.push(cur);
					cur = parent.get(cur) ?? null;
				}
				cycle.push(child);
				cycle.reverse();
				return cycle;
			}
			if (childColor === UNVISITED) {
				color.set(child, VISITING);
				parent.set(child, frame.id);
				stack.push({ id: child, childIdx: 0 });
			}
		}
		return null;
	}

	for (const id of nodeIds) {
		if (color.get(id) === UNVISITED) {
			const cycle = walk(id);
			if (cycle) return cycle;
		}
	}
	return null;
}

/** Upsert a single knowledge_node row. Callers should batch in a transaction. */
export async function upsertKnowledgeNode(row: NewKnowledgeNodeRow, db: Db = defaultDb): Promise<KnowledgeNodeRow> {
	const [inserted] = await db
		.insert(knowledgeNode)
		.values(row)
		.onConflictDoUpdate({
			target: knowledgeNode.id,
			// Update every author-controlled field; createdAt is preserved so
			// long-lived nodes keep their original timestamp.
			set: {
				title: row.title,
				domain: row.domain,
				crossDomains: row.crossDomains ?? [],
				knowledgeTypes: row.knowledgeTypes ?? [],
				technicalDepth: row.technicalDepth ?? null,
				stability: row.stability ?? null,
				relevance: row.relevance ?? [],
				modalities: row.modalities ?? [],
				estimatedTimeMinutes: row.estimatedTimeMinutes ?? null,
				reviewTimeMinutes: row.reviewTimeMinutes ?? null,
				references: row.references ?? [],
				assessable: row.assessable ?? false,
				assessmentMethods: row.assessmentMethods ?? [],
				masteryCriteria: row.masteryCriteria ?? null,
				contentMd: row.contentMd,
				updatedAt: new Date(),
			},
		})
		.returning();
	return inserted;
}

/**
 * Replace all outbound edges for a node in one pass.
 *
 * Rebuilds the set in a transaction so a partially-authored node never
 * appears with half of its edges present. The build script calls this for
 * every node it processes.
 */
export async function replaceNodeEdges(
	fromNodeId: string,
	edges: ReadonlyArray<{ toNodeId: string; edgeType: KnowledgeEdgeType }>,
	db: Db = defaultDb,
): Promise<void> {
	await db.transaction(async (tx) => {
		await tx.delete(knowledgeEdge).where(eq(knowledgeEdge.fromNodeId, fromNodeId));
		if (edges.length === 0) return;
		const values: NewKnowledgeEdgeRow[] = edges.map((e) => ({
			fromNodeId,
			toNodeId: e.toNodeId,
			edgeType: e.edgeType,
			targetExists: false,
		}));
		await tx.insert(knowledgeEdge).values(values).onConflictDoNothing();
	});
}

/**
 * Refresh the `target_exists` flag on every edge in one update pass.
 *
 * Run after all nodes are upserted so edges to freshly-authored nodes flip
 * to true in the same build cycle.
 */
export async function refreshEdgeTargetExists(db: Db = defaultDb): Promise<number> {
	const result = await db
		.update(knowledgeEdge)
		.set({
			targetExists: sql<boolean>`EXISTS (SELECT 1 FROM ${knowledgeNode} kn WHERE kn.id = ${knowledgeEdge.toNodeId})`,
		})
		.returning({ fromNodeId: knowledgeEdge.fromNodeId });
	return result.length;
}

/** List all node ids currently in the DB. Used by the build script to detect orphan edges. */
export async function listNodeIds(db: Db = defaultDb): Promise<string[]> {
	const rows = await db.select({ id: knowledgeNode.id }).from(knowledgeNode);
	return rows.map((r) => r.id);
}

/** Lightweight listing for navigation / dashboards. */
export async function listNodeSummaries(userId: string, db: Db = defaultDb): Promise<NodeSummary[]> {
	// One round-trip: node rows joined against a per-node card count for the user.
	const rows = await db
		.select({
			id: knowledgeNode.id,
			title: knowledgeNode.title,
			domain: knowledgeNode.domain,
			estimatedTimeMinutes: knowledgeNode.estimatedTimeMinutes,
			cardCount: sql<number>`coalesce((
				SELECT count(*)::int FROM ${card} c
				WHERE c.node_id = ${knowledgeNode.id} AND c.user_id = ${userId}
			), 0)`,
		})
		.from(knowledgeNode)
		.orderBy(asc(knowledgeNode.domain), asc(knowledgeNode.title));
	return rows.map((r) => ({
		id: r.id,
		title: r.title,
		domain: r.domain,
		estimatedTimeMinutes: r.estimatedTimeMinutes ?? null,
		cardCount: Number(r.cardCount ?? 0),
	}));
}

/**
 * Full node view for the render route. Returns null when the node id is unknown.
 * Cards are scoped to the caller's user so a URL guess cannot leak another
 * learner's card state.
 */
export async function getNodeView(nodeId: string, userId: string, db: Db = defaultDb): Promise<NodeView | null> {
	const [node] = await db.select().from(knowledgeNode).where(eq(knowledgeNode.id, nodeId)).limit(1);
	if (!node) return null;

	const [edges, inboundEdges, cardRows] = await Promise.all([
		db
			.select()
			.from(knowledgeEdge)
			.where(eq(knowledgeEdge.fromNodeId, nodeId))
			.orderBy(asc(knowledgeEdge.edgeType), asc(knowledgeEdge.toNodeId)),
		db
			.select()
			.from(knowledgeEdge)
			.where(eq(knowledgeEdge.toNodeId, nodeId))
			.orderBy(asc(knowledgeEdge.edgeType), asc(knowledgeEdge.fromNodeId)),
		db
			.select({ card, state: cardState })
			.from(card)
			.innerJoin(cardState, and(eq(cardState.cardId, card.id), eq(cardState.userId, card.userId)))
			.where(and(eq(card.nodeId, nodeId), eq(card.userId, userId)))
			.orderBy(asc(card.createdAt)),
	]);

	return {
		node,
		edges,
		inboundEdges,
		cards: cardRows.map((r) => ({ card: r.card, state: r.state })),
	};
}

/**
 * Load the cards attached to a node for a user. Shared by the review-queue
 * node filter and the node view.
 */
export async function getCardsForNode(
	nodeId: string,
	userId: string,
	db: Db = defaultDb,
): Promise<Array<{ card: CardRow; state: CardStateRow }>> {
	const rows = await db
		.select({ card, state: cardState })
		.from(card)
		.innerJoin(cardState, and(eq(cardState.cardId, card.id), eq(cardState.userId, card.userId)))
		.where(and(eq(card.nodeId, nodeId), eq(card.userId, userId)))
		.orderBy(asc(card.createdAt));
	return rows.map((r) => ({ card: r.card, state: r.state }));
}

/** Look up node rows for a set of ids. Used by link rendering. */
export async function getNodesByIds(ids: readonly string[], db: Db = defaultDb): Promise<KnowledgeNodeRow[]> {
	if (ids.length === 0) return [];
	return await db
		.select()
		.from(knowledgeNode)
		.where(inArray(knowledgeNode.id, ids as string[]));
}

/** Export the edge-type enum for callers that don't already depend on @ab/constants. */
export { KNOWLEDGE_EDGE_TYPES };

/** Raised when a knowledge node can't be found. */
export class KnowledgeNodeNotFoundError extends Error {
	constructor(public readonly nodeId: string) {
		super(`Knowledge node not found: ${nodeId}`);
		this.name = 'KnowledgeNodeNotFoundError';
	}
}

/** Dual-gate mastery gate outcome per pillar. See spec "Mastery computation". */
export type NodeMasteryGate = 'pass' | 'fail' | 'insufficient_data' | 'not_applicable';

/**
 * Dual-gate node mastery stats.
 *
 * Mastery is the dual-gate result: both the card pillar and rep pillar must
 * independently clear their threshold. `displayScore` is a progress-bar number
 * only -- never conflate it with `mastered`. See spec "Mastery computation"
 * for why a weighted average is wrong here.
 */
export interface NodeMasteryStats {
	cardsTotal: number;
	/** Cards with FSRS stability > STABILITY_MASTERED_DAYS. */
	cardsMastered: number;
	cardsDue: number;
	/** cardsMastered / cardsTotal, or 0 if no cards. */
	cardsMasteredRatio: number;
	repsTotal: number;
	repsCorrect: number;
	/** repsCorrect / repsTotal, or 0 if no reps. */
	repAccuracy: number;
	/** Dual-gate output. True iff both applicable gates pass. */
	mastered: boolean;
	/** 0..1 progress-bar score. Never use for mastered decisions. */
	displayScore: number;
	cardGate: NodeMasteryGate;
	repGate: NodeMasteryGate;
}

/**
 * Compute dual-gate mastery for a single node for a single user.
 *
 * Card gate passes when >= CARD_MIN active cards are attached AND the ratio
 * of mastered cards (stability > STABILITY_MASTERED_DAYS) clears
 * CARD_MASTERY_RATIO_THRESHOLD. Rep gate passes when >= REP_MIN attempts on
 * scenarios attached to this node exist AND accuracy clears
 * REP_ACCURACY_THRESHOLD. Knowledge-only nodes (no scenarios attached at all)
 * see `repGate = not_applicable` and can be mastered on cards alone; judgment-
 * only nodes see `cardGate = not_applicable` symmetrically. Nodes with
 * nothing attached are never mastered.
 */
export async function getNodeMastery(
	userId: string,
	nodeId: string,
	db: Db = defaultDb,
	now: Date = new Date(),
): Promise<NodeMasteryStats> {
	// One round-trip per pillar plus one round-trip to detect whether any
	// scenarios exist at all (drives the `not_applicable` fallback for
	// knowledge-only nodes). All three are independent so we fan them out.
	const [cardTotals, repTotals, scenarioExistsRow] = await Promise.all([
		db
			.select({
				cardsTotal: count(),
				cardsMastered: sql<number>`sum(case when ${cardState.stability} > ${STABILITY_MASTERED_DAYS} then 1 else 0 end)`,
				cardsDue: sql<number>`sum(case when ${cardState.dueAt} <= ${now.toISOString()} then 1 else 0 end)`,
			})
			.from(card)
			.innerJoin(cardState, and(eq(cardState.cardId, card.id), eq(cardState.userId, card.userId)))
			.where(and(eq(card.userId, userId), eq(card.nodeId, nodeId), eq(card.status, CARD_STATUSES.ACTIVE)))
			.then((r) => r[0]),
		db
			.select({
				repsTotal: count(),
				repsCorrect: sql<number>`sum(case when ${repAttempt.isCorrect} then 1 else 0 end)`,
			})
			.from(repAttempt)
			.innerJoin(scenario, and(eq(scenario.id, repAttempt.scenarioId), eq(scenario.userId, repAttempt.userId)))
			.where(and(eq(repAttempt.userId, userId), eq(scenario.nodeId, nodeId)))
			.then((r) => r[0]),
		db
			.select({ c: count() })
			.from(scenario)
			.where(eq(scenario.nodeId, nodeId))
			.then((r) => r[0]),
	]);

	const cardsTotal = Number(cardTotals?.cardsTotal ?? 0);
	const cardsMastered = Number(cardTotals?.cardsMastered ?? 0);
	const cardsDue = Number(cardTotals?.cardsDue ?? 0);
	const cardsMasteredRatio = cardsTotal === 0 ? 0 : cardsMastered / cardsTotal;

	const repsTotal = Number(repTotals?.repsTotal ?? 0);
	const repsCorrect = Number(repTotals?.repsCorrect ?? 0);
	const repAccuracy = repsTotal === 0 ? 0 : repsCorrect / repsTotal;

	const scenariosAttached = Number(scenarioExistsRow?.c ?? 0);

	const cardGate = computeCardGate(cardsTotal, cardsMasteredRatio);
	const repGate = computeRepGate(repsTotal, repAccuracy, scenariosAttached);

	const mastered = isMastered(cardGate, repGate);
	const displayScore = computeDisplayScore(cardsTotal, cardsMasteredRatio, repsTotal, repAccuracy);

	return {
		cardsTotal,
		cardsMastered,
		cardsDue,
		cardsMasteredRatio,
		repsTotal,
		repsCorrect,
		repAccuracy,
		mastered,
		displayScore,
		cardGate,
		repGate,
	};
}

/**
 * Boolean projection of `getNodeMastery(...).mastered`. Provided as the
 * canonical entry point for the Study Plan + Session Engine per spec
 * "Reconciliation notes".
 */
export async function isNodeMastered(
	userId: string,
	nodeId: string,
	db: Db = defaultDb,
	now: Date = new Date(),
): Promise<boolean> {
	const stats = await getNodeMastery(userId, nodeId, db, now);
	return stats.mastered;
}

/**
 * Gate computation for cards. Pure -- extracted so the unit tests can drive
 * it without a DB round-trip.
 */
export function computeCardGate(cardsTotal: number, cardsMasteredRatio: number): NodeMasteryGate {
	if (cardsTotal === 0) return 'not_applicable';
	if (cardsTotal < CARD_MIN) return 'insufficient_data';
	return cardsMasteredRatio >= CARD_MASTERY_RATIO_THRESHOLD ? 'pass' : 'fail';
}

/**
 * Gate computation for reps. Pure. `scenariosAttached` is the count of
 * scenarios carrying this nodeId -- zero means the rep pillar simply doesn't
 * apply to this node (knowledge-only).
 */
export function computeRepGate(repsTotal: number, repAccuracy: number, scenariosAttached: number): NodeMasteryGate {
	if (scenariosAttached === 0) return 'not_applicable';
	if (repsTotal === 0) return 'insufficient_data';
	if (repsTotal < REP_MIN) return 'insufficient_data';
	return repAccuracy >= REP_ACCURACY_THRESHOLD ? 'pass' : 'fail';
}

/**
 * Dual-gate mastery combination. Pure. A node is mastered iff every gate that
 * applies to it is `pass`. `not_applicable` is treated as "this pillar doesn't
 * constrain the decision"; `insufficient_data` and `fail` both block.
 *
 * Edge case: a node with nothing attached resolves to (not_applicable,
 * not_applicable) -- never mastered by design. The PRD's "Nodes with no
 * attached content are never mastered" rule surfaces here.
 */
export function isMastered(cardGate: NodeMasteryGate, repGate: NodeMasteryGate): boolean {
	if (cardGate === 'not_applicable' && repGate === 'not_applicable') return false;
	const cardOk = cardGate === 'pass' || cardGate === 'not_applicable';
	const repOk = repGate === 'pass' || repGate === 'not_applicable';
	return cardOk && repOk;
}

/**
 * Display score for progress bars. Averages the two pillars when both apply,
 * falls back to the single pillar otherwise. Returns 0 when nothing is
 * attached. This is UI eye-candy -- `mastered` is the decision-maker.
 */
export function computeDisplayScore(
	cardsTotal: number,
	cardsMasteredRatio: number,
	repsTotal: number,
	repAccuracy: number,
): number {
	if (cardsTotal > 0 && repsTotal > 0) {
		return (cardsMasteredRatio + repAccuracy) / 2;
	}
	if (cardsTotal > 0) return cardsMasteredRatio;
	if (repsTotal > 0) return repAccuracy;
	return 0;
}
