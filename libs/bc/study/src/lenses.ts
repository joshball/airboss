/**
 * Lens framework. Two lenses ship today (ACS + Domain); follow-on WPs add
 * `handbook`, `weakness`, `bloom`, `phase-of-flight`, and `custom`.
 *
 * A lens projects a goal's reachable knowledge nodes onto a domain-specific
 * tree shape with mastery + coverage rolled up at each internal node:
 *
 *   - ACS lens   -> Area / Task / Element  (sourced from the goal's syllabi)
 *   - Domain lens -> Domain                 (sourced from `knowledge_node.domain`)
 *
 * The lens contract:
 *
 *   type Lens<TFilters> = (
 *     db: Db,
 *     userId: string,
 *     input: LensInput<TFilters>,
 *   ) => Promise<LensResult>;
 *
 * Both shipped lenses share the rollup math (coverage, weighted mastery)
 * via the helpers in this file. Filters are typed per-lens; the ACS lens
 * accepts area / task / element code filters and the Domain lens accepts
 * domain-slug filters.
 *
 * See ADR 016 phase 6 + the cert-syllabus WP spec for the framework
 * rationale.
 */

import { type BloomLevel, DOMAIN_LABELS, type Domain } from '@ab/constants';
import { eq, sql } from 'drizzle-orm';
import type { PgDatabase, PgQueryResultHKT } from 'drizzle-orm/pg-core';
import type { GoalRow, KnowledgeNodeRow, SyllabusNodeRow } from './schema';
import { goalSyllabus, knowledgeNode, syllabus, syllabusNode, syllabusNodeLink } from './schema';

type Db = PgDatabase<PgQueryResultHKT, Record<string, never>>;

// ---------------------------------------------------------------------------
// Public lens types
// ---------------------------------------------------------------------------

/**
 * Lens input. Goal can be null for an "anonymous browse" lens render where
 * no learner state is in play -- useful for marketing / public surfaces.
 * Filters narrow the projection without changing the lens shape.
 */
export interface LensInput<TFilters = Record<string, unknown>> {
	goal: GoalRow | null;
	filters?: TFilters;
}

export interface MasteryRollup {
	totalLeaves: number;
	coveredLeaves: number;
	masteredLeaves: number;
	/**
	 * Weighted mastery in [0, 1]. Sums per-leaf mastery weighted by the
	 * leaf's syllabus_node_link weight (or 1.0 for ad-hoc goal_nodes), then
	 * normalises by total weight. Useful for display bars.
	 */
	masteryFraction: number;
	coverageFraction: number;
}

export interface LensLeaf {
	id: string;
	knowledgeNodeId: string;
	title: string;
	requiredBloom: BloomLevel | null;
	mastery: { mastered: boolean; covered: boolean };
	/**
	 * True when the leaf has zero `syllabus_node_link` rows -- the lens emits
	 * a placeholder so the rollup counts the leaf as "uncovered." Consumers
	 * (cert dashboard) use this flag to render the leaf as a stub rather than
	 * a real knowledge-node card. The placeholder's `knowledgeNodeId` is the
	 * empty string.
	 */
	placeholder?: boolean;
}

export interface LensTreeNode {
	id: string;
	level:
		| 'syllabus'
		| 'cert'
		| 'area'
		| 'task'
		| 'element'
		| 'domain'
		| 'phase'
		| 'handbook'
		| 'chapter'
		| 'section'
		| 'node';
	title: string;
	rollup: MasteryRollup;
	children: LensTreeNode[];
	leaves?: LensLeaf[];
}

export interface LensResult {
	tree: LensTreeNode[];
	rollup: MasteryRollup;
	leaves: LensLeaf[];
}

export type Lens<TFilters = Record<string, unknown>> = (
	db: Db,
	userId: string,
	input: LensInput<TFilters>,
) => Promise<LensResult>;

// ---------------------------------------------------------------------------
// Errors
// ---------------------------------------------------------------------------

export class LensError extends Error {
	constructor(
		public readonly lensKind: string,
		message: string,
	) {
		super(`[${lensKind}] ${message}`);
		this.name = 'LensError';
	}
}

// ---------------------------------------------------------------------------
// Mastery utilities
// ---------------------------------------------------------------------------

interface NodeMastery {
	mastered: boolean;
	covered: boolean;
}

/**
 * Pull per-node mastery flags for an arbitrary set of node ids in one
 * round-trip. Wraps `getNodeMasteryMap` from knowledge.ts so lens callers
 * don't need to import the larger snapshot type.
 *
 * Imported lazily so this module doesn't bring in the full knowledge BC at
 * eager-import time (the lens framework is consumed by route handlers that
 * may already be hot-pathing a different BC slice).
 */
async function fetchNodeMastery(userId: string, nodeIds: readonly string[], db: Db): Promise<Map<string, NodeMastery>> {
	const out = new Map<string, NodeMastery>();
	if (nodeIds.length === 0) return out;
	const { getNodeMasteryMap } = await import('./knowledge');
	const snapshots = await getNodeMasteryMap(userId, [...nodeIds], db);
	for (const [nodeId, snap] of snapshots) {
		out.set(nodeId, { mastered: snap.mastered, covered: snap.mastered || snap.inProgress });
	}
	return out;
}

/**
 * Compute the weighted rollup over a set of leaves. Pure given the leaf
 * mastery + weight inputs.
 */
export function computeMasteryRollup(leaves: ReadonlyArray<{ mastery: NodeMastery; weight: number }>): MasteryRollup {
	if (leaves.length === 0) {
		return {
			totalLeaves: 0,
			coveredLeaves: 0,
			masteredLeaves: 0,
			masteryFraction: 0,
			coverageFraction: 0,
		};
	}
	let covered = 0;
	let mastered = 0;
	let weightSum = 0;
	let masteryWeighted = 0;
	let coverageWeighted = 0;
	for (const leaf of leaves) {
		const w = leaf.weight;
		weightSum += w;
		if (leaf.mastery.covered) {
			covered += 1;
			coverageWeighted += w;
		}
		if (leaf.mastery.mastered) {
			mastered += 1;
			masteryWeighted += w;
		}
	}
	return {
		totalLeaves: leaves.length,
		coveredLeaves: covered,
		masteredLeaves: mastered,
		masteryFraction: weightSum === 0 ? 0 : masteryWeighted / weightSum,
		coverageFraction: weightSum === 0 ? 0 : coverageWeighted / weightSum,
	};
}

// ---------------------------------------------------------------------------
// ACS lens
// ---------------------------------------------------------------------------

export interface AcsLensFilters {
	areaCodes?: string[];
	taskCodes?: string[];
	elementCodes?: string[];
	/**
	 * Airplane class scope. When set to a non-empty array, internal nodes whose
	 * `classes` column is set are filtered to those that intersect with this
	 * array. Class-agnostic nodes (`classes IS NULL`) always pass. Useful when
	 * a goal targets a class-restricted credential (e.g. MEI = AMEL/AMES tasks
	 * within CFI Airplane ACS-25).
	 *
	 * Values are members of `AIRPLANE_CLASS_VALUES` (`asel`/`amel`/`ases`/`ames`).
	 * Empty / undefined = no filtering.
	 */
	classes?: string[];
}

/**
 * ACS lens. Walks the goal's syllabi (every `goal_syllabus` row), materialises
 * the area->task->element tree per syllabus, attaches per-leaf mastery, and
 * computes rollups at every internal node.
 *
 * Returns one root LensTreeNode per syllabus -- the cert dashboard renders
 * each root as a top-level cert section.
 *
 * Returns the empty result when the goal is null (anonymous browse) or when
 * the goal has no syllabi attached.
 */
export const acsLens: Lens<AcsLensFilters> = async (db, userId, input) => {
	if (input.goal === null) {
		return { tree: [], rollup: emptyRollup(), leaves: [] };
	}
	const goal = input.goal;
	const filters = input.filters ?? {};

	// Pull every syllabus referenced by the goal, plus their nodes.
	const goalSyllabi = await db
		.select({ syllabusId: goalSyllabus.syllabusId, weight: goalSyllabus.weight })
		.from(goalSyllabus)
		.where(eq(goalSyllabus.goalId, goal.id));
	if (goalSyllabi.length === 0) {
		return { tree: [], rollup: emptyRollup(), leaves: [] };
	}
	const syllabusIds = goalSyllabi.map((s) => s.syllabusId);
	const syllabusWeights = new Map(goalSyllabi.map((s) => [s.syllabusId, s.weight] as const));
	const syllabusRows = await db
		.select({ id: syllabus.id, slug: syllabus.slug, title: syllabus.title })
		.from(syllabus)
		.where(
			sql`${syllabus.id} IN (${sql.join(
				syllabusIds.map((id) => sql`${id}`),
				sql`, `,
			)})`,
		);
	const syllabusTitles = new Map(syllabusRows.map((s) => [s.id, { title: s.title, slug: s.slug }] as const));
	const allNodes: SyllabusNodeRow[] = await db
		.select()
		.from(syllabusNode)
		.where(
			sql`${syllabusNode.syllabusId} IN (${sql.join(
				syllabusIds.map((id) => sql`${id}`),
				sql`, `,
			)})`,
		);

	// Pull every leaf -> knowledge_node link in those syllabi.
	const leafIds = allNodes.filter((n) => n.isLeaf).map((n) => n.id);
	const linkRows =
		leafIds.length === 0
			? []
			: await db
					.select({
						leafId: syllabusNodeLink.syllabusNodeId,
						knowledgeNodeId: syllabusNodeLink.knowledgeNodeId,
						linkWeight: syllabusNodeLink.weight,
					})
					.from(syllabusNodeLink)
					.where(
						sql`${syllabusNodeLink.syllabusNodeId} IN (${sql.join(
							leafIds.map((id) => sql`${id}`),
							sql`, `,
						)})`,
					);

	const knowledgeNodeIds = [...new Set(linkRows.map((r) => r.knowledgeNodeId))];
	const masteryByNode = await fetchNodeMastery(userId, knowledgeNodeIds, db);
	const linksByLeaf = new Map<string, Array<{ nodeId: string; weight: number }>>();
	for (const r of linkRows) {
		const list = linksByLeaf.get(r.leafId) ?? [];
		list.push({ nodeId: r.knowledgeNodeId, weight: r.linkWeight });
		linksByLeaf.set(r.leafId, list);
	}

	// Project mastery per leaf.
	function leafMastery(nodeIds: ReadonlyArray<string>): NodeMastery {
		if (nodeIds.length === 0) return { mastered: false, covered: false };
		let allMastered = true;
		let anyCovered = false;
		for (const id of nodeIds) {
			const m = masteryByNode.get(id);
			if (m === undefined) {
				allMastered = false;
				continue;
			}
			if (m.covered) anyCovered = true;
			if (!m.mastered) allMastered = false;
		}
		return { mastered: allMastered, covered: anyCovered };
	}

	const allLensLeaves: LensLeaf[] = [];
	const allRollupLeaves: Array<{ mastery: NodeMastery; weight: number }> = [];

	// Group nodes by syllabus.
	const nodesBySyllabus = new Map<string, SyllabusNodeRow[]>();
	for (const n of allNodes) {
		const list = nodesBySyllabus.get(n.syllabusId) ?? [];
		list.push(n);
		nodesBySyllabus.set(n.syllabusId, list);
	}

	const tree: LensTreeNode[] = [];
	for (const [syllabusId, nodes] of nodesBySyllabus) {
		const goalWeight = syllabusWeights.get(syllabusId) ?? 1.0;
		const meta = syllabusTitles.get(syllabusId);
		const root = buildAcsSyllabusTree(
			syllabusId,
			meta?.title ?? syllabusId,
			meta?.slug ?? syllabusId,
			nodes,
			leafMastery,
			linksByLeaf,
			goalWeight,
			filters,
		);
		if (root !== null) {
			tree.push(root);
			collectLensLeaves(root, allLensLeaves, allRollupLeaves);
		}
	}

	return {
		tree,
		rollup: computeMasteryRollup(allRollupLeaves),
		leaves: allLensLeaves,
	};
};

function buildAcsSyllabusTree(
	_syllabusId: string,
	syllabusTitle: string,
	syllabusSlug: string,
	nodes: ReadonlyArray<SyllabusNodeRow>,
	leafMastery: (nodeIds: ReadonlyArray<string>) => NodeMastery,
	linksByLeaf: Map<string, Array<{ nodeId: string; weight: number }>>,
	goalWeight: number,
	filters: AcsLensFilters,
): LensTreeNode | null {
	const childrenByParent = new Map<string | null, SyllabusNodeRow[]>();
	for (const n of nodes) {
		const key = n.parentId ?? null;
		const list = childrenByParent.get(key) ?? [];
		list.push(n);
		childrenByParent.set(key, list);
	}
	const roots = (childrenByParent.get(null) ?? []).sort((a, b) => a.ordinal - b.ordinal);
	if (roots.length === 0) return null;
	// One synthetic syllabus-level root wrapping every area in this syllabus.
	// Carries the syllabus's display title (not its id) so consumers render
	// human-readable section headings. The id is the syllabus slug for stable
	// URL composition.
	const syllabusRootNode: LensTreeNode = {
		id: syllabusSlug,
		level: 'syllabus',
		title: syllabusTitle,
		rollup: emptyRollup(),
		children: [],
	};
	const rollupBuckets: Array<{ mastery: NodeMastery; weight: number }> = [];
	for (const area of roots) {
		if (filters.areaCodes !== undefined && filters.areaCodes.length > 0 && !filters.areaCodes.includes(area.code)) {
			continue;
		}
		if (!nodeMatchesClassFilter(area, filters)) continue;
		const areaNode = buildAcsSubtree(area, childrenByParent, leafMastery, linksByLeaf, goalWeight, filters);
		syllabusRootNode.children.push(areaNode);
		appendRollupSource(areaNode, rollupBuckets);
	}
	syllabusRootNode.rollup = computeMasteryRollup(rollupBuckets);
	return syllabusRootNode;
}

/**
 * True when a syllabus_node passes the lens's `classes` filter. Class-agnostic
 * rows (`classes IS NULL`) always pass; class-tagged rows pass when their
 * tags intersect the filter array. Empty / undefined filter = pass.
 */
function nodeMatchesClassFilter(node: SyllabusNodeRow, filters: AcsLensFilters): boolean {
	if (filters.classes === undefined || filters.classes.length === 0) return true;
	const nodeClasses = node.classes;
	if (nodeClasses === null || nodeClasses === undefined) return true;
	for (const cls of nodeClasses) {
		if (filters.classes.includes(cls)) return true;
	}
	return false;
}

function buildAcsSubtree(
	node: SyllabusNodeRow,
	childrenByParent: Map<string | null, SyllabusNodeRow[]>,
	leafMastery: (nodeIds: ReadonlyArray<string>) => NodeMastery,
	linksByLeaf: Map<string, Array<{ nodeId: string; weight: number }>>,
	goalWeight: number,
	filters: AcsLensFilters,
): LensTreeNode {
	const children = (childrenByParent.get(node.id) ?? []).sort((a, b) => a.ordinal - b.ordinal);
	if (node.isLeaf || children.length === 0) {
		// Leaf row.
		const links = linksByLeaf.get(node.id) ?? [];
		const mastery = leafMastery(links.map((l) => l.nodeId));
		const leafTitle = node.title;
		const lensLeaves: LensLeaf[] = links.map((l) => ({
			id: `${node.id}:${l.nodeId}`,
			knowledgeNodeId: l.nodeId,
			title: leafTitle,
			requiredBloom: (node.requiredBloom as BloomLevel | null) ?? null,
			mastery,
		}));
		// If no links, still surface the leaf as a placeholder so the rollup
		// counts it as "uncovered." The `placeholder: true` flag lets
		// consumers (cert dashboard) detect uncovered leaves without
		// string-matching the id suffix.
		if (lensLeaves.length === 0) {
			lensLeaves.push({
				id: `${node.id}:placeholder`,
				knowledgeNodeId: '',
				title: leafTitle,
				requiredBloom: (node.requiredBloom as BloomLevel | null) ?? null,
				mastery,
				placeholder: true,
			});
		}
		const weightedLeaves = lensLeaves.map((leaf) => ({
			mastery: leaf.mastery,
			weight: goalWeight * (links.find((l) => l.nodeId === leaf.knowledgeNodeId)?.weight ?? 1.0),
		}));
		return {
			id: node.id,
			level: levelToLensLevel(node.level),
			title: leafTitle,
			rollup: computeMasteryRollup(weightedLeaves),
			children: [],
			leaves: lensLeaves,
		};
	}
	// Internal node: filter children by task/element codes + class scoping,
	// then aggregate.
	const filteredChildren = children.filter((c) => {
		if (c.level === 'task' && filters.taskCodes !== undefined && filters.taskCodes.length > 0) {
			if (!filters.taskCodes.includes(c.code)) return false;
		}
		if (c.level === 'element' && filters.elementCodes !== undefined && filters.elementCodes.length > 0) {
			if (!filters.elementCodes.includes(c.code)) return false;
		}
		return nodeMatchesClassFilter(c, filters);
	});
	const childNodes = filteredChildren.map((c) =>
		buildAcsSubtree(c, childrenByParent, leafMastery, linksByLeaf, goalWeight, filters),
	);
	const rollupBuckets: Array<{ mastery: NodeMastery; weight: number }> = [];
	for (const child of childNodes) appendRollupSource(child, rollupBuckets);
	return {
		id: node.id,
		level: levelToLensLevel(node.level),
		title: node.title,
		rollup: computeMasteryRollup(rollupBuckets),
		children: childNodes,
	};
}

function levelToLensLevel(level: string): LensTreeNode['level'] {
	switch (level) {
		case 'area':
			return 'area';
		case 'task':
			return 'task';
		case 'element':
			return 'element';
		case 'chapter':
			return 'chapter';
		case 'section':
			return 'section';
		default:
			return 'node';
	}
}

function appendRollupSource(node: LensTreeNode, into: Array<{ mastery: NodeMastery; weight: number }>): void {
	if (node.leaves !== undefined) {
		for (const leaf of node.leaves) {
			into.push({ mastery: leaf.mastery, weight: 1 });
		}
		return;
	}
	for (const child of node.children) appendRollupSource(child, into);
}

function collectLensLeaves(
	node: LensTreeNode,
	leafSink: LensLeaf[],
	rollupSink: Array<{ mastery: NodeMastery; weight: number }>,
): void {
	if (node.leaves !== undefined) {
		for (const leaf of node.leaves) {
			leafSink.push(leaf);
			rollupSink.push({ mastery: leaf.mastery, weight: 1 });
		}
		return;
	}
	for (const child of node.children) collectLensLeaves(child, leafSink, rollupSink);
}

function emptyRollup(): MasteryRollup {
	return {
		totalLeaves: 0,
		coveredLeaves: 0,
		masteredLeaves: 0,
		masteryFraction: 0,
		coverageFraction: 0,
	};
}

// ---------------------------------------------------------------------------
// Domain lens
// ---------------------------------------------------------------------------

export interface DomainLensFilters {
	domains?: Domain[];
}

/**
 * Domain lens. Groups every reachable knowledge node from the goal by its
 * primary domain, computes mastery + coverage at the domain level. Used by
 * the existing `/knowledge` browse surface as a dashboard rollup.
 *
 * Reachability: walks `goal_syllabus -> syllabus_node (leaf) -> syllabus_node_link`
 * AND `goal_node` ad-hoc entries; same node-union semantic as `getGoalNodeUnion`
 * in goals.ts.
 *
 * Returns the empty result when the goal is null.
 */
export const domainLens: Lens<DomainLensFilters> = async (db, userId, input) => {
	if (input.goal === null) {
		return { tree: [], rollup: emptyRollup(), leaves: [] };
	}
	const goal = input.goal;
	const filters = input.filters ?? {};

	// Reuse goals.ts:getGoalNodeUnion via lazy import.
	const { getGoalNodeUnion } = await import('./goals');
	const union = await getGoalNodeUnion(goal.id, db);

	let knowledgeNodeRows: KnowledgeNodeRow[] = [];
	if (union.knowledgeNodeIds.length > 0) {
		knowledgeNodeRows = await db
			.select()
			.from(knowledgeNode)
			.where(
				sql`${knowledgeNode.id} IN (${sql.join(
					union.knowledgeNodeIds.map((id) => sql`${id}`),
					sql`, `,
				)})`,
			);
	}

	const masteryByNode = await fetchNodeMastery(userId, union.knowledgeNodeIds, db);

	// Group by domain.
	const buckets = new Map<string, KnowledgeNodeRow[]>();
	for (const node of knowledgeNodeRows) {
		const key = node.domain ?? 'unknown';
		const list = buckets.get(key) ?? [];
		list.push(node);
		buckets.set(key, list);
	}

	const tree: LensTreeNode[] = [];
	const allLeaves: LensLeaf[] = [];
	const rollupBuckets: Array<{ mastery: NodeMastery; weight: number }> = [];

	for (const domain of [...buckets.keys()].sort()) {
		if (filters.domains !== undefined && filters.domains.length > 0 && !filters.domains.includes(domain as Domain)) {
			continue;
		}
		const nodes = buckets.get(domain) ?? [];
		const domainLeaves: LensLeaf[] = [];
		const domainBuckets: Array<{ mastery: NodeMastery; weight: number }> = [];
		for (const n of nodes) {
			const mastery = masteryByNode.get(n.id) ?? { mastered: false, covered: false };
			const weight = union.weights[n.id] ?? 1.0;
			const leaf: LensLeaf = {
				id: n.id,
				knowledgeNodeId: n.id,
				title: n.title,
				requiredBloom: null,
				mastery,
			};
			domainLeaves.push(leaf);
			domainBuckets.push({ mastery, weight });
			allLeaves.push(leaf);
			rollupBuckets.push({ mastery, weight });
		}
		const domainTitle = (DOMAIN_LABELS as Record<string, string>)[domain] ?? domain;
		tree.push({
			id: `domain:${domain}`,
			level: 'domain',
			title: domainTitle,
			rollup: computeMasteryRollup(domainBuckets),
			children: [],
			leaves: domainLeaves,
		});
	}

	return {
		tree,
		rollup: computeMasteryRollup(rollupBuckets),
		leaves: allLeaves,
	};
};
