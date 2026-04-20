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

import { KNOWLEDGE_EDGE_TYPES, type KnowledgeEdgeType } from '@ab/constants';
import { db as defaultDb } from '@ab/db';
import { and, asc, eq, inArray, sql } from 'drizzle-orm';
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
