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
	CERT_VALUES,
	type Cert,
	certsCoveredBy,
	DOMAIN_VALUES,
	type Domain,
	KNOWLEDGE_EDGE_TYPES,
	type KnowledgeEdgeType,
	NODE_MASTERY_GATES,
	type NodeLifecycle,
	type NodeMasteryGate,
	REP_ACCURACY_THRESHOLD,
	REP_MIN,
	SESSION_ITEM_KINDS,
	STABILITY_MASTERED_DAYS,
	STUDY_PRIORITIES,
	type StudyPriority,
} from '@ab/constants';
import { db as defaultDb } from '@ab/db/connection';
import { isStructuredCitation, type StructuredCitation } from '@ab/types';
import { generateKnowledgeNodeProgressId } from '@ab/utils';
import { and, asc, count, eq, inArray, isNotNull, isNull, sql } from 'drizzle-orm';
import type { PgDatabase, PgQueryResultHKT } from 'drizzle-orm/pg-core';
import {
	type CardRow,
	type CardStateRow,
	card,
	cardState,
	type KnowledgeEdgeRow,
	type KnowledgeNodeProgressRow,
	type KnowledgeNodeRow,
	knowledgeEdge,
	knowledgeNode,
	knowledgeNodeProgress,
	type NewKnowledgeEdgeRow,
	type NewKnowledgeNodeRow,
	scenario,
	sessionItemResult,
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

/**
 * Upsert a single knowledge_node row. Callers should batch in a transaction.
 *
 * When `contentHash` is supplied and differs from the stored value, `version`
 * is bumped by one; callers can then ask "did this user's last completion
 * happen against the current version?" without a full diff of `contentMd`.
 * Idempotent: re-running the seed on unchanged content leaves `version`
 * alone. Callers who don't track content hash (migrations, back-compat) can
 * leave `contentHash` undefined; nothing about the row changes besides
 * `updatedAt`.
 */
export async function upsertKnowledgeNode(row: NewKnowledgeNodeRow, db: Db = defaultDb): Promise<KnowledgeNodeRow> {
	const nextHash = row.contentHash ?? null;
	// Only bump `version` when the caller supplied a hash AND it differs from
	// whatever's stored. `coalesce` handles the case where the old row has no
	// hash recorded yet (first seed after the column landed).
	const nextVersion = sql<number>`CASE
			WHEN ${nextHash}::text IS NULL THEN ${knowledgeNode.version}
			WHEN coalesce(${knowledgeNode.contentHash}, '') = ${nextHash} THEN ${knowledgeNode.version}
			ELSE ${knowledgeNode.version} + 1
		END`;

	// Persist `lifecycle` on every write so the indexed column tracks the
	// authored content. Reads hit the column directly (see listNodesWithFacets);
	// the JS `lifecycleFromContent` is the single source of truth and is
	// mirrored here so the column never drifts.
	const lifecycle = lifecycleFromContent(row.contentMd ?? '');

	const [inserted] = await db
		.insert(knowledgeNode)
		.values({ ...row, lifecycle })
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
				minimumCert: row.minimumCert ?? null,
				studyPriority: row.studyPriority ?? null,
				modalities: row.modalities ?? [],
				estimatedTimeMinutes: row.estimatedTimeMinutes ?? null,
				reviewTimeMinutes: row.reviewTimeMinutes ?? null,
				references: row.references ?? [],
				assessable: row.assessable ?? false,
				assessmentMethods: row.assessmentMethods ?? [],
				masteryCriteria: row.masteryCriteria ?? null,
				contentMd: row.contentMd,
				contentHash: nextHash,
				version: nextVersion,
				lifecycle,
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
		// Resolve `target_exists` at insert time using an EXISTS subselect so
		// new edges don't have to wait for `refreshEdgeTargetExists` to flip
		// -- a node authored between replaceNodeEdges and refresh otherwise
		// shows a false "gap" banner until the next full build.
		const targetIds = Array.from(new Set(edges.map((e) => e.toNodeId)));
		const existingRows = await tx
			.select({ id: knowledgeNode.id })
			.from(knowledgeNode)
			.where(inArray(knowledgeNode.id, targetIds));
		const existing = new Set(existingRows.map((r) => r.id));
		const values: NewKnowledgeEdgeRow[] = edges.map((e) => ({
			fromNodeId,
			toNodeId: e.toNodeId,
			edgeType: e.edgeType,
			targetExists: existing.has(e.toNodeId),
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

/**
 * Inline `StructuredCitation` array on a knowledge_node row's `references`
 * JSONB column. Returns the empty array when the node has no references or
 * doesn't exist.
 *
 * Read-side narrowing: rows whose `references_v2_migrated = false` may still
 * carry mixed `LegacyCitation` + `StructuredCitation` entries on the same
 * column (the migration script in `scripts/db/migrate-references-to-structured.ts`
 * is what flips the flag to true). To keep downstream consumers (cert
 * dashboard, lens views, citation chips) on a uniform contract, this helper
 * filters out any legacy entries via the `isStructuredCitation` type guard.
 * Once the migration runs against every row the filter becomes a no-op.
 *
 * Mirrors `getCitationsForSyllabusNode` in `syllabi.ts`.
 */
export async function getCitationsForKnowledgeNode(
	knowledgeNodeId: string,
	db: Db = defaultDb,
): Promise<StructuredCitation[]> {
	const rows = await db
		.select({ references: knowledgeNode.references })
		.from(knowledgeNode)
		.where(eq(knowledgeNode.id, knowledgeNodeId))
		.limit(1);
	const row = rows[0];
	if (!row) return [];
	// Drizzle's `$type<LegacyCitation[]>` on the column is a compile-time hint
	// for the pre-migration shape. Post-migration the same JSONB column holds
	// `StructuredCitation` entries; the runtime guard `isStructuredCitation`
	// is the source of truth on read paths. Cast through `unknown` so the
	// guard's `Citation` parameter shape is satisfied across both eras.
	const entries = (row.references ?? []) as unknown as readonly Parameters<typeof isStructuredCitation>[0][];
	return entries.filter(isStructuredCitation);
}

/** Look up node rows for a set of ids. Used by link rendering. */
export async function getNodesByIds(ids: readonly string[], db: Db = defaultDb): Promise<KnowledgeNodeRow[]> {
	if (ids.length === 0) return [];
	return await db
		.select()
		.from(knowledgeNode)
		.where(inArray(knowledgeNode.id, ids as string[]));
}

/** Lifecycle derivation from a node's markdown body. Counts unique H2 phase
 * headings ("## Context", "## Problem", ...) and maps to the skeleton /
 * started / complete lifecycle. Kept in the BC so UI, build script, and tests
 * all resolve lifecycle the same way.
 */
export function lifecycleFromContent(contentMd: string): 'skeleton' | 'started' | 'complete' {
	const phaseLabels = new Set(['context', 'problem', 'discover', 'reveal', 'practice', 'connect', 'verify']);
	const found = new Set<string>();
	for (const line of contentMd.split(/\r?\n/)) {
		const m = line.match(/^##\s+(.+?)\s*$/);
		if (!m) continue;
		const label = m[1].trim().toLowerCase();
		if (phaseLabels.has(label)) found.add(label);
	}
	if (found.size === 0) return 'skeleton';
	if (found.size >= phaseLabels.size) return 'complete';
	return 'started';
}

/**
 * Parse the content_md body into seven phase buckets keyed by canonical
 * phase slug. Missing phases are represented as `null` so the UI can render
 * "Not yet authored" placeholders without a secondary lookup.
 */
export function splitContentPhases(contentMd: string): Record<string, string | null> {
	const canonical: Record<string, string> = {
		context: 'context',
		problem: 'problem',
		discover: 'discover',
		reveal: 'reveal',
		practice: 'practice',
		connect: 'connect',
		verify: 'verify',
	};
	const buckets: Record<string, string | null> = {
		context: null,
		problem: null,
		discover: null,
		reveal: null,
		practice: null,
		connect: null,
		verify: null,
	};
	const lines = contentMd.split(/\r?\n/);
	let currentPhase: string | null = null;
	let accum: string[] = [];
	const flush = () => {
		if (currentPhase !== null) {
			const text = accum.join('\n').trim();
			if (text.length > 0) buckets[currentPhase] = text;
			accum = [];
		}
	};
	for (const line of lines) {
		const m = line.match(/^##\s+(.+?)\s*$/);
		if (m) {
			flush();
			const label = m[1].trim().toLowerCase();
			const phase = canonical[label] ?? null;
			currentPhase = phase;
			continue;
		}
		if (currentPhase !== null) accum.push(line);
	}
	flush();
	return buckets;
}

/**
 * Filterable list for the browse page.
 *
 * `cert` matches by cert *inheritance*: picking 'commercial' returns nodes
 * with `minimumCert IN ('private','commercial')` because every commercial
 * pilot also needs PPL-floor knowledge. See `CERT_PREREQUISITES` in
 * libs/constants/src/study.ts.
 *
 * `priority` is an exact match against `studyPriority` (critical / standard /
 * stretch). Lifecycle is read from the persisted `knowledge_node.lifecycle`
 * column; writers mirror it via `lifecycleFromContent` on every upsert so the
 * indexed column tracks the authored markdown.
 */
export interface ListNodesFilters {
	cert?: Cert;
	priority?: StudyPriority;
	lifecycle?: NodeLifecycle;
	domain?: string;
}

export interface KnowledgeNodeListRow {
	id: string;
	title: string;
	domain: string;
	estimatedTimeMinutes: number | null;
	lifecycle: NodeLifecycle;
	/** Lowest cert that requires this node. May be null on freshly-authored nodes. */
	minimumCert: Cert | null;
	/** Study-time bucket. May be null on freshly-authored nodes. */
	studyPriority: StudyPriority | null;
}

export async function listNodesForBrowse(
	filters: ListNodesFilters = {},
	db: Db = defaultDb,
): Promise<KnowledgeNodeListRow[]> {
	const { rows } = await listNodesWithFacets(filters, db);
	return rows;
}

/**
 * Per-facet bucket counts for the knowledge-graph browse filters. Knowledge
 * is a small enough table that we materialize all rows once, derive every
 * facet with the corresponding filter excluded, and count in JS.
 *
 * `cert` counts use inheritance: the count for 'cpl' is "how many nodes
 * would a commercial pilot see," i.e. anything with `minimumCert IN
 * ('private','commercial')`. `priority` counts are exact matches.
 */
export interface KnowledgeFacetCounts {
	domain: Record<string, number>;
	cert: Record<string, number>;
	priority: Record<string, number>;
	lifecycle: Record<string, number>;
}

export async function listNodesWithFacets(
	filters: ListNodesFilters = {},
	db: Db = defaultDb,
): Promise<{ rows: KnowledgeNodeListRow[]; facets: KnowledgeFacetCounts }> {
	// Read the persisted `lifecycle` column rather than re-parsing `content_md`
	// for every node. Writers (upsertKnowledgeNode) keep the column in sync via
	// `lifecycleFromContent`, so the indexed column is the source of truth on
	// the read path.
	const dbRows = await db
		.select({
			id: knowledgeNode.id,
			title: knowledgeNode.title,
			domain: knowledgeNode.domain,
			estimatedTimeMinutes: knowledgeNode.estimatedTimeMinutes,
			lifecycle: knowledgeNode.lifecycle,
			minimumCert: knowledgeNode.minimumCert,
			studyPriority: knowledgeNode.studyPriority,
		})
		.from(knowledgeNode)
		.orderBy(asc(knowledgeNode.domain), asc(knowledgeNode.title));

	const enriched = dbRows.map((row): KnowledgeNodeListRow => {
		return {
			id: row.id,
			title: row.title,
			domain: row.domain,
			estimatedTimeMinutes: row.estimatedTimeMinutes ?? null,
			lifecycle: (row.lifecycle ?? 'skeleton') as 'skeleton' | 'started' | 'complete',
			minimumCert: (row.minimumCert as Cert | null) ?? null,
			studyPriority: (row.studyPriority as StudyPriority | null) ?? null,
		};
	});

	// Cert inheritance set for the active filter (`cert: 'cpl'` matches
	// PPL-floor + CPL-floor topics). Untagged nodes (`minimumCert IS NULL`)
	// don't match any cert filter.
	const certCovers = (n: KnowledgeNodeListRow, c: Cert): boolean =>
		n.minimumCert !== null && certsCoveredBy(c).includes(n.minimumCert);

	const passes = (n: KnowledgeNodeListRow, exclude?: keyof ListNodesFilters): boolean => {
		if (filters.domain && exclude !== 'domain' && n.domain !== filters.domain) return false;
		if (filters.cert && exclude !== 'cert' && !certCovers(n, filters.cert)) return false;
		if (filters.priority && exclude !== 'priority' && n.studyPriority !== filters.priority) return false;
		if (filters.lifecycle && exclude !== 'lifecycle' && n.lifecycle !== filters.lifecycle) return false;
		return true;
	};

	const rows = enriched.filter((n) => passes(n));

	const facets: KnowledgeFacetCounts = { domain: {}, cert: {}, priority: {}, lifecycle: {} };
	for (const n of enriched) {
		if (passes(n, 'domain')) facets.domain[n.domain] = (facets.domain[n.domain] ?? 0) + 1;
		if (passes(n, 'cert')) {
			// Tally the node under every cert whose inheritance set includes
			// `minimumCert`. A PPL-floor node bumps PPL/IFR/CPL/CFI counts;
			// a CFI-floor node only bumps CFI.
			if (n.minimumCert !== null) {
				for (const c of CERT_VALUES) {
					if (certsCoveredBy(c).includes(n.minimumCert)) {
						facets.cert[c] = (facets.cert[c] ?? 0) + 1;
					}
				}
			}
		}
		if (passes(n, 'priority') && n.studyPriority !== null) {
			facets.priority[n.studyPriority] = (facets.priority[n.studyPriority] ?? 0) + 1;
		}
		if (passes(n, 'lifecycle')) facets.lifecycle[n.lifecycle] = (facets.lifecycle[n.lifecycle] ?? 0) + 1;
	}

	return { rows, facets };
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
export type { NodeMasteryGate };

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
				repsCorrect: sql<number>`sum(case when ${sessionItemResult.isCorrect} then 1 else 0 end)`,
			})
			.from(sessionItemResult)
			.innerJoin(
				scenario,
				and(eq(scenario.id, sessionItemResult.scenarioId), eq(scenario.userId, sessionItemResult.userId)),
			)
			.where(
				and(
					eq(sessionItemResult.userId, userId),
					eq(sessionItemResult.itemKind, SESSION_ITEM_KINDS.REP),
					isNotNull(sessionItemResult.completedAt),
					isNull(sessionItemResult.skipKind),
					eq(scenario.nodeId, nodeId),
				),
			)
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
	if (cardsTotal === 0) return NODE_MASTERY_GATES.NOT_APPLICABLE;
	if (cardsTotal < CARD_MIN) return NODE_MASTERY_GATES.INSUFFICIENT_DATA;
	return cardsMasteredRatio >= CARD_MASTERY_RATIO_THRESHOLD ? NODE_MASTERY_GATES.PASS : NODE_MASTERY_GATES.FAIL;
}

/**
 * Gate computation for reps. Pure. `scenariosAttached` is the count of
 * scenarios carrying this nodeId -- zero means the rep pillar simply doesn't
 * apply to this node (knowledge-only).
 */
export function computeRepGate(repsTotal: number, repAccuracy: number, scenariosAttached: number): NodeMasteryGate {
	if (scenariosAttached === 0) return NODE_MASTERY_GATES.NOT_APPLICABLE;
	if (repsTotal === 0) return NODE_MASTERY_GATES.INSUFFICIENT_DATA;
	if (repsTotal < REP_MIN) return NODE_MASTERY_GATES.INSUFFICIENT_DATA;
	return repAccuracy >= REP_ACCURACY_THRESHOLD ? NODE_MASTERY_GATES.PASS : NODE_MASTERY_GATES.FAIL;
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
	if (cardGate === NODE_MASTERY_GATES.NOT_APPLICABLE && repGate === NODE_MASTERY_GATES.NOT_APPLICABLE) return false;
	const cardOk = cardGate === NODE_MASTERY_GATES.PASS || cardGate === NODE_MASTERY_GATES.NOT_APPLICABLE;
	const repOk = repGate === NODE_MASTERY_GATES.PASS || repGate === NODE_MASTERY_GATES.NOT_APPLICABLE;
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

/**
 * Per-node mastery snapshot used by the aggregators below. A node is either
 * `mastered`, `inProgress` (has cards or rep attempts attached but gates fail),
 * or `untouched` (no attached signal at all). The label is already reduced for
 * the aggregators -- callers don't need to re-run the dual-gate rules.
 *
 * `displayScore` matches `computeDisplayScore(cards, reps)` exactly, included
 * so callers who need the progress-bar number (e.g. `/knowledge` browse) don't
 * have to call `getNodeMastery` per-row to get it.
 */
export interface NodeMasterySnapshot {
	nodeId: string;
	mastered: boolean;
	inProgress: boolean;
	displayScore: number;
}

/**
 * Batched per-node mastery for a user across an arbitrary set of node ids.
 *
 * One round-trip per pillar (cards + reps) plus one to detect which nodes have
 * scenarios attached at all (drives the `not_applicable` rep-gate fallback for
 * knowledge-only nodes). Returns a Map keyed on nodeId so the aggregators can
 * look up mastery without touching the DB again. The graph currently sits at
 * ~30 authored nodes, but this keeps the cost flat as it grows.
 *
 * Rules match `getNodeMastery` exactly:
 *   - Card gate: active cards attached, count >= CARD_MIN,
 *     mastered-ratio >= CARD_MASTERY_RATIO_THRESHOLD.
 *   - Rep gate: scenarios attached at all, attempts >= REP_MIN,
 *     accuracy >= REP_ACCURACY_THRESHOLD.
 *   - `mastered` iff both applicable gates pass AND at least one gate applied.
 *   - `inProgress` iff the node is not mastered AND (cardsTotal > 0 OR repsTotal > 0).
 */
export async function getNodeMasteryMap(
	userId: string,
	nodeIds: readonly string[],
	db: Db = defaultDb,
): Promise<Map<string, NodeMasterySnapshot>> {
	const out = new Map<string, NodeMasterySnapshot>();
	if (nodeIds.length === 0) return out;

	const ids = nodeIds as string[];

	const [cardRows, repRows, scenarioRows] = await Promise.all([
		db
			.select({
				nodeId: card.nodeId,
				cardsTotal: count(),
				cardsMastered: sql<number>`sum(case when ${cardState.stability} > ${STABILITY_MASTERED_DAYS} then 1 else 0 end)`,
			})
			.from(card)
			.innerJoin(cardState, and(eq(cardState.cardId, card.id), eq(cardState.userId, card.userId)))
			.where(and(eq(card.userId, userId), eq(card.status, CARD_STATUSES.ACTIVE), inArray(card.nodeId, ids)))
			.groupBy(card.nodeId),
		db
			.select({
				nodeId: scenario.nodeId,
				repsTotal: count(),
				repsCorrect: sql<number>`sum(case when ${sessionItemResult.isCorrect} then 1 else 0 end)`,
			})
			.from(sessionItemResult)
			.innerJoin(
				scenario,
				and(eq(scenario.id, sessionItemResult.scenarioId), eq(scenario.userId, sessionItemResult.userId)),
			)
			.where(
				and(
					eq(sessionItemResult.userId, userId),
					eq(sessionItemResult.itemKind, SESSION_ITEM_KINDS.REP),
					isNotNull(sessionItemResult.completedAt),
					isNull(sessionItemResult.skipKind),
					inArray(scenario.nodeId, ids),
				),
			)
			.groupBy(scenario.nodeId),
		db
			.select({ nodeId: scenario.nodeId, c: count() })
			.from(scenario)
			.where(inArray(scenario.nodeId, ids))
			.groupBy(scenario.nodeId),
	]);

	const cardByNode = new Map<string, { total: number; mastered: number }>();
	for (const r of cardRows) {
		if (!r.nodeId) continue;
		cardByNode.set(r.nodeId, { total: Number(r.cardsTotal ?? 0), mastered: Number(r.cardsMastered ?? 0) });
	}
	const repByNode = new Map<string, { total: number; correct: number }>();
	for (const r of repRows) {
		if (!r.nodeId) continue;
		repByNode.set(r.nodeId, { total: Number(r.repsTotal ?? 0), correct: Number(r.repsCorrect ?? 0) });
	}
	const scenarioByNode = new Map<string, number>();
	for (const r of scenarioRows) {
		if (!r.nodeId) continue;
		scenarioByNode.set(r.nodeId, Number(r.c ?? 0));
	}

	for (const nodeId of ids) {
		const cardStats = cardByNode.get(nodeId) ?? { total: 0, mastered: 0 };
		const repStats = repByNode.get(nodeId) ?? { total: 0, correct: 0 };
		const scenariosAttached = scenarioByNode.get(nodeId) ?? 0;
		const cardsMasteredRatio = cardStats.total === 0 ? 0 : cardStats.mastered / cardStats.total;
		const repAccuracy = repStats.total === 0 ? 0 : repStats.correct / repStats.total;
		const cardGate = computeCardGate(cardStats.total, cardsMasteredRatio);
		const repGate = computeRepGate(repStats.total, repAccuracy, scenariosAttached);
		const mastered = isMastered(cardGate, repGate);
		const inProgress = !mastered && (cardStats.total > 0 || repStats.total > 0);
		const displayScore = computeDisplayScore(cardStats.total, cardsMasteredRatio, repStats.total, repAccuracy);
		out.set(nodeId, { nodeId, mastered, inProgress, displayScore });
	}

	return out;
}

/** Per-cert progress row for the cert-progress dashboard panel. */
export interface CertProgress {
	cert: Cert;
	total: number;
	mastered: number;
	/** Touched but not mastered: has cards or rep attempts attached, gates not all passed. */
	inProgress: number;
	/** `mastered / total`, 0..1; 0 when total === 0. */
	percent: number;
}

/**
 * Per-cert mastery rollup. For each cert, counts distinct nodes whose
 * `minimumCert` is inherited by that cert (PPL-floor topics roll up into
 * IFR/CPL/CFI; CFI-floor topics only into CFI). `stretch` priority nodes
 * are excluded from progress totals -- they're below-floor adjacencies that
 * the learner can study but isn't responsible for. Untagged nodes
 * (`minimumCert IS NULL`) count nowhere.
 *
 * `mastered` applies the dual-gate `isNodeMastered` rule. `inProgress`
 * counts nodes the learner has touched but not yet cleared. Empty cert
 * (total = 0) returns zeros with `percent = 0` so the UI can still render
 * the row.
 */
export async function getCertProgress(userId: string, db: Db = defaultDb): Promise<CertProgress[]> {
	const rows = await db
		.select({
			id: knowledgeNode.id,
			minimumCert: knowledgeNode.minimumCert,
			studyPriority: knowledgeNode.studyPriority,
		})
		.from(knowledgeNode);

	const certToNodes = new Map<Cert, Set<string>>();
	for (const cert of CERT_VALUES) certToNodes.set(cert, new Set<string>());

	const allNodeIds = new Set<string>();
	for (const row of rows) {
		if (row.minimumCert === null) continue;
		if (row.studyPriority === STUDY_PRIORITIES.STRETCH) continue;
		const minCert = CERT_VALUES.find((c) => c === row.minimumCert);
		if (!minCert) continue;
		// A node with `minimumCert = X` rolls into every cert that inherits X.
		for (const cert of CERT_VALUES) {
			if (certsCoveredBy(cert).includes(minCert)) {
				certToNodes.get(cert)?.add(row.id);
			}
		}
		allNodeIds.add(row.id);
	}

	const masteryMap = await getNodeMasteryMap(userId, Array.from(allNodeIds), db);

	const result: CertProgress[] = [];
	for (const cert of CERT_VALUES) {
		const ids = certToNodes.get(cert) ?? new Set<string>();
		const total = ids.size;
		let mastered = 0;
		let inProgress = 0;
		for (const id of ids) {
			const snap = masteryMap.get(id);
			if (!snap) continue;
			if (snap.mastered) mastered += 1;
			else if (snap.inProgress) inProgress += 1;
		}
		const percent = total === 0 ? 0 : mastered / total;
		result.push({ cert, total, mastered, inProgress, percent });
	}
	return result;
}

/** One cell in the domain x cert mastery matrix. */
export interface DomainCertCell {
	cert: Cert;
	total: number;
	mastered: number;
	/** `mastered / total`, 0..1; `null` when total === 0 (no nodes in that cell). */
	percent: number | null;
}

/** One row in the domain x cert matrix: a domain and its four cert cells. */
export interface DomainCertRow {
	domain: Domain;
	/** Exactly four entries, one per cert in CERT_VALUES order. */
	cells: DomainCertCell[];
}

/**
 * 14 x 4 matrix of (domain, cert) -> percent mastered. A node contributes to
 * every (domain, cert) cell where the cert inherits the node's `minimumCert`
 * (PPL-floor topics show in PPL/IFR/CPL/CFI columns; CFI-floor topics only in
 * CFI). `stretch` priority is included on the map -- it shows where the
 * learner could go beyond strict cert requirements -- but the per-cell
 * mastery uses the same dual-gate rule as the rest of the system.
 *
 * Cells with `total === 0` return `percent: null` so the UI renders a
 * neutral placeholder instead of a bogus 0%.
 */
export async function getDomainCertMatrix(userId: string, db: Db = defaultDb): Promise<DomainCertRow[]> {
	const rows = await db
		.select({
			id: knowledgeNode.id,
			domain: knowledgeNode.domain,
			minimumCert: knowledgeNode.minimumCert,
		})
		.from(knowledgeNode);

	const buckets = new Map<Domain, Map<Cert, Set<string>>>();
	for (const domain of DOMAIN_VALUES) {
		const certMap = new Map<Cert, Set<string>>();
		for (const cert of CERT_VALUES) certMap.set(cert, new Set<string>());
		buckets.set(domain, certMap);
	}

	const allNodeIds = new Set<string>();
	for (const row of rows) {
		if (row.minimumCert === null) continue;
		const domain = DOMAIN_VALUES.find((d) => d === row.domain);
		if (!domain) continue;
		const minCert = CERT_VALUES.find((c) => c === row.minimumCert);
		if (!minCert) continue;
		const certMap = buckets.get(domain);
		if (!certMap) continue;
		for (const cert of CERT_VALUES) {
			if (certsCoveredBy(cert).includes(minCert)) {
				certMap.get(cert)?.add(row.id);
			}
		}
		allNodeIds.add(row.id);
	}

	const masteryMap = await getNodeMasteryMap(userId, Array.from(allNodeIds), db);

	const result: DomainCertRow[] = [];
	for (const domain of DOMAIN_VALUES) {
		const certMap = buckets.get(domain) ?? new Map<Cert, Set<string>>();
		const cells: DomainCertCell[] = [];
		for (const cert of CERT_VALUES) {
			const ids = certMap.get(cert) ?? new Set<string>();
			const total = ids.size;
			let mastered = 0;
			for (const id of ids) {
				const snap = masteryMap.get(id);
				if (snap?.mastered) mastered += 1;
			}
			const percent = total === 0 ? null : mastered / total;
			cells.push({ cert, total, mastered, percent });
		}
		result.push({ domain, cells });
	}
	return result;
}

/**
 * Combined cert-progress + domain-cert-matrix read in one pass.
 *
 * The dashboard fans out both panels in parallel; prior to this helper each
 * call re-scanned `knowledge_node` and re-ran `getNodeMasteryMap` over the
 * same per-user card + rep aggregates. This helper does the node scan once,
 * unions the node id set across both panels' bucketing rules, runs
 * `getNodeMasteryMap` once, and folds both outputs from the shared snapshot.
 *
 * The individual exports (`getCertProgress` and `getDomainCertMatrix`) still
 * exist for any caller that only needs one panel; they're thin wrappers that
 * delegate here and pluck the relevant half.
 */
export interface CertAndDomainMatrix {
	certProgress: CertProgress[];
	domainCertMatrix: DomainCertRow[];
}

export async function getCertAndDomainMatrix(userId: string, db: Db = defaultDb): Promise<CertAndDomainMatrix> {
	const rows = await db
		.select({
			id: knowledgeNode.id,
			domain: knowledgeNode.domain,
			minimumCert: knowledgeNode.minimumCert,
			studyPriority: knowledgeNode.studyPriority,
		})
		.from(knowledgeNode);

	// Cert-progress buckets: cert -> set of node ids, excluding `stretch`.
	const certToNodes = new Map<Cert, Set<string>>();
	for (const cert of CERT_VALUES) certToNodes.set(cert, new Set<string>());

	// Domain x cert buckets: domain -> cert -> set of node ids (all priorities,
	// including stretch -- the matrix shows everywhere the learner could go).
	const domainBuckets = new Map<Domain, Map<Cert, Set<string>>>();
	for (const domain of DOMAIN_VALUES) {
		const certMap = new Map<Cert, Set<string>>();
		for (const cert of CERT_VALUES) certMap.set(cert, new Set<string>());
		domainBuckets.set(domain, certMap);
	}

	const allNodeIds = new Set<string>();

	for (const row of rows) {
		if (row.minimumCert === null) continue;
		const minCert = CERT_VALUES.find((c) => c === row.minimumCert);
		if (!minCert) continue;
		const isStretch = row.studyPriority === STUDY_PRIORITIES.STRETCH;
		const inheritingCerts = CERT_VALUES.filter((c) => certsCoveredBy(c).includes(minCert));

		// Cert-progress bucketing: stretch nodes don't count.
		if (!isStretch) {
			for (const cert of inheritingCerts) {
				certToNodes.get(cert)?.add(row.id);
				allNodeIds.add(row.id);
			}
		}

		// Domain x cert matrix: includes stretch.
		const domain = DOMAIN_VALUES.find((d) => d === row.domain);
		if (!domain) continue;
		const certMap = domainBuckets.get(domain);
		if (!certMap) continue;
		for (const cert of inheritingCerts) {
			certMap.get(cert)?.add(row.id);
			allNodeIds.add(row.id);
		}
	}

	const masteryMap = await getNodeMasteryMap(userId, Array.from(allNodeIds), db);

	const certProgress: CertProgress[] = [];
	for (const cert of CERT_VALUES) {
		const ids = certToNodes.get(cert) ?? new Set<string>();
		const total = ids.size;
		let mastered = 0;
		let inProgress = 0;
		for (const id of ids) {
			const snap = masteryMap.get(id);
			if (!snap) continue;
			if (snap.mastered) mastered += 1;
			else if (snap.inProgress) inProgress += 1;
		}
		const percent = total === 0 ? 0 : mastered / total;
		certProgress.push({ cert, total, mastered, inProgress, percent });
	}

	const domainCertMatrix: DomainCertRow[] = [];
	for (const domain of DOMAIN_VALUES) {
		const certMap = domainBuckets.get(domain) ?? new Map<Cert, Set<string>>();
		const cells: DomainCertCell[] = [];
		for (const cert of CERT_VALUES) {
			const ids = certMap.get(cert) ?? new Set<string>();
			const total = ids.size;
			let mastered = 0;
			for (const id of ids) {
				const snap = masteryMap.get(id);
				if (snap?.mastered) mastered += 1;
			}
			const percent = total === 0 ? null : mastered / total;
			cells.push({ cert, total, mastered, percent });
		}
		domainCertMatrix.push({ domain, cells });
	}

	return { certProgress, domainCertMatrix };
}

// ---------------------------------------------------------------------------
// Per-node phase progress (knowledge /learn stepper)
// ---------------------------------------------------------------------------

/** Per-user per-node phase progress snapshot. */
export interface NodePhaseProgress {
	visitedPhases: string[];
	completedPhases: string[];
	lastPhase: string | null;
}

const EMPTY_PROGRESS: NodePhaseProgress = {
	visitedPhases: [],
	completedPhases: [],
	lastPhase: null,
};

/**
 * Read a user's phase progress for a single node. Returns an empty snapshot
 * (no rows) when the learner has never visited the node -- never null so the
 * stepper can render uniformly.
 */
export async function getNodeProgress(userId: string, nodeId: string, db: Db = defaultDb): Promise<NodePhaseProgress> {
	const [row] = await db
		.select()
		.from(knowledgeNodeProgress)
		.where(and(eq(knowledgeNodeProgress.userId, userId), eq(knowledgeNodeProgress.nodeId, nodeId)))
		.limit(1);
	if (!row) return { ...EMPTY_PROGRESS };
	return {
		visitedPhases: [...row.visitedPhases],
		completedPhases: [...row.completedPhases],
		lastPhase: row.lastPhase,
	};
}

/** Idempotent upsert: ensure `phaseId` is in `visitedPhases`; set as `lastPhase`. */
export async function recordPhaseVisited(
	userId: string,
	nodeId: string,
	phaseId: string,
	db: Db = defaultDb,
): Promise<KnowledgeNodeProgressRow> {
	return await db.transaction(async (tx) => {
		const [existing] = await tx
			.select()
			.from(knowledgeNodeProgress)
			.where(and(eq(knowledgeNodeProgress.userId, userId), eq(knowledgeNodeProgress.nodeId, nodeId)))
			.for('update')
			.limit(1);

		if (!existing) {
			const [inserted] = await tx
				.insert(knowledgeNodeProgress)
				.values({
					id: generateKnowledgeNodeProgressId(),
					userId,
					nodeId,
					visitedPhases: [phaseId],
					completedPhases: [],
					lastPhase: phaseId,
				})
				.returning();
			return inserted;
		}

		const visited = existing.visitedPhases.includes(phaseId)
			? existing.visitedPhases
			: [...existing.visitedPhases, phaseId];
		const [updated] = await tx
			.update(knowledgeNodeProgress)
			.set({
				visitedPhases: visited,
				lastPhase: phaseId,
				updatedAt: new Date(),
			})
			.where(eq(knowledgeNodeProgress.id, existing.id))
			.returning();
		return updated;
	});
}

/** Idempotent upsert: ensure `phaseId` is in both `visitedPhases` + `completedPhases`. */
export async function recordPhaseCompleted(
	userId: string,
	nodeId: string,
	phaseId: string,
	db: Db = defaultDb,
): Promise<KnowledgeNodeProgressRow> {
	return await db.transaction(async (tx) => {
		const [existing] = await tx
			.select()
			.from(knowledgeNodeProgress)
			.where(and(eq(knowledgeNodeProgress.userId, userId), eq(knowledgeNodeProgress.nodeId, nodeId)))
			.for('update')
			.limit(1);

		if (!existing) {
			const [inserted] = await tx
				.insert(knowledgeNodeProgress)
				.values({
					id: generateKnowledgeNodeProgressId(),
					userId,
					nodeId,
					visitedPhases: [phaseId],
					completedPhases: [phaseId],
					lastPhase: phaseId,
				})
				.returning();
			return inserted;
		}

		const visited = existing.visitedPhases.includes(phaseId)
			? existing.visitedPhases
			: [...existing.visitedPhases, phaseId];
		const completed = existing.completedPhases.includes(phaseId)
			? existing.completedPhases
			: [...existing.completedPhases, phaseId];
		const [updated] = await tx
			.update(knowledgeNodeProgress)
			.set({
				visitedPhases: visited,
				completedPhases: completed,
				lastPhase: phaseId,
				updatedAt: new Date(),
			})
			.where(eq(knowledgeNodeProgress.id, existing.id))
			.returning();
		return updated;
	});
}
