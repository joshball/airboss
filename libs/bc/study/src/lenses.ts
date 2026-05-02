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
 * Per the evidence-kind-gating WP each leaf carries a richer
 * `LensLeafMastery` shape (per-kind gates + missing-kinds) so consumers can
 * surface "you have recall down but need a scenario" without re-walking. The
 * existing `mastered: boolean` and `covered: boolean` fields keep their
 * names; the new fields are additive.
 *
 * See ADR 016 phase 6 + the cert-syllabus WP spec for the framework
 * rationale, and `docs/work-packages/evidence-kind-gating/` for the per-kind
 * extension.
 */

import {
	type ACSTriad,
	ASSESSMENT_METHOD_VALUES,
	type AssessmentMethod,
	type BloomLevel,
	type CertApplicability,
	DEFAULT_TRIAD_EVIDENCE_CERT,
	DOMAIN_LABELS,
	type Domain,
	NODE_MASTERY_GATES,
} from '@ab/constants';
import { eq, inArray } from 'drizzle-orm';
import type { PgDatabase, PgQueryResultHKT } from 'drizzle-orm/pg-core';
import {
	credentialSlugToCertApplicability,
	type GateState,
	getLeafMasteryStateMap,
	getNodeEvidenceStateMap,
	type LeafMasteryState,
	type NodeEvidenceState,
} from './mastery';
import type { GoalRow, KnowledgeNodeRow, SyllabusNodeRow } from './schema';
import {
	credential,
	credentialSyllabus,
	goalSyllabus,
	knowledgeNode,
	syllabus,
	syllabusNode,
	syllabusNodeLink,
} from './schema';

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
	/**
	 * Per-evidence-kind aggregate across the rollup's input leaves
	 * (evidence-kind-gating WP). For each kind that any leaf required:
	 *   - `required`: how many leaves listed this kind in `requiredKinds`.
	 *   - `passing`: how many of those leaves had this kind aggregate to
	 *     `pass` in `byEvidenceKind`.
	 * Lets follow-on UI surface "12 of 18 skill leaves have scenario
	 * evidence" without re-walking the leaf set. Empty when the input
	 * leaves do not carry a `requiredKinds` field (legacy callers).
	 */
	byEvidenceKind: Partial<Record<AssessmentMethod, { required: number; passing: number }>>;
}

/**
 * Per-leaf mastery payload exposed by the lens. `mastered` and `covered`
 * keep their existing names; the additional fields are additive (consumers
 * that ignore them keep working). When the lens cannot compute per-kind
 * gates (e.g. a leaf with no triad / required kinds), the new fields
 * collapse to empty arrays / records and the legacy `mastered` boolean
 * still drives the rollup.
 */
export interface LensLeafMastery {
	mastered: boolean;
	covered: boolean;
	requiredKinds: readonly AssessmentMethod[];
	byEvidenceKind: Partial<Record<AssessmentMethod, GateState>>;
	missingKinds: readonly AssessmentMethod[];
}

export interface LensLeaf {
	id: string;
	knowledgeNodeId: string;
	title: string;
	requiredBloom: BloomLevel | null;
	mastery: LensLeafMastery;
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
		// Lens kind is exposed as a structured `public readonly` field so
		// `instanceof LensError && err.lensKind === 'acs'` is the canonical
		// discriminator path; matches the pattern used by every other typed
		// error in this BC. The message itself is unprefixed.
		super(message);
		this.name = 'LensError';
	}
}

// ---------------------------------------------------------------------------
// Mastery utilities
// ---------------------------------------------------------------------------

/**
 * Loose mastery shape accepted by `computeMasteryRollup`. The rollup math
 * needs `mastered` + `covered`; the per-kind aggregate is computed only
 * when the input also carries `requiredKinds` + `byEvidenceKind` (the full
 * `LensLeafMastery` shape). Pure unit tests can pass the lighter shape;
 * the lens code paths pass the full shape.
 */
type RollupMasteryInput = {
	mastered: boolean;
	covered: boolean;
	requiredKinds?: readonly AssessmentMethod[];
	byEvidenceKind?: Partial<Record<AssessmentMethod, GateState>>;
};

/**
 * Compute the weighted rollup over a set of leaves. Pure given the leaf
 * mastery + weight inputs. Aggregates per-evidence-kind counts when the
 * inputs carry the richer `LensLeafMastery` shape so consumers can render
 * "scenario evidence on N of M required leaves" without re-walking.
 */
export function computeMasteryRollup(
	leaves: ReadonlyArray<{ mastery: RollupMasteryInput; weight: number }>,
): MasteryRollup {
	if (leaves.length === 0) {
		return {
			totalLeaves: 0,
			coveredLeaves: 0,
			masteredLeaves: 0,
			masteryFraction: 0,
			coverageFraction: 0,
			byEvidenceKind: {},
		};
	}
	let covered = 0;
	let mastered = 0;
	let weightSum = 0;
	let masteryWeighted = 0;
	let coverageWeighted = 0;
	const byEvidenceKind: Partial<Record<AssessmentMethod, { required: number; passing: number }>> = {};
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
		const required = leaf.mastery.requiredKinds;
		if (required !== undefined) {
			const perKind = leaf.mastery.byEvidenceKind ?? {};
			for (const kind of required) {
				const existing = byEvidenceKind[kind] ?? { required: 0, passing: 0 };
				existing.required += 1;
				if (perKind[kind] === NODE_MASTERY_GATES.PASS) {
					existing.passing += 1;
				}
				byEvidenceKind[kind] = existing;
			}
		}
	}
	return {
		totalLeaves: leaves.length,
		coveredLeaves: covered,
		masteredLeaves: mastered,
		masteryFraction: weightSum === 0 ? 0 : masteryWeighted / weightSum,
		coverageFraction: weightSum === 0 ? 0 : coverageWeighted / weightSum,
		byEvidenceKind,
	};
}

function emptyLeafMastery(): LensLeafMastery {
	return {
		mastered: false,
		covered: false,
		requiredKinds: [],
		byEvidenceKind: {},
		missingKinds: [],
	};
}

function leafMasteryFromLeafState(state: LeafMasteryState | undefined): LensLeafMastery {
	if (state === undefined) return emptyLeafMastery();
	return {
		mastered: state.mastered,
		covered: state.covered,
		requiredKinds: state.requiredKinds,
		byEvidenceKind: state.byEvidenceKind,
		missingKinds: state.missingKinds,
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
 *
 * Per evidence-kind-gating: each leaf's mastery flows through
 * `getLeafMasteryStateMap`, decomposed by `AssessmentMethod`. The
 * `CertApplicability` mapping is resolved per syllabus by walking
 * `credential_syllabus -> credential.slug`; syllabi without an attached
 * credential fall back to {@link DEFAULT_TRIAD_EVIDENCE_CERT}.
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
		.where(inArray(syllabus.id, syllabusIds));
	const syllabusTitles = new Map(syllabusRows.map((s) => [s.id, { title: s.title, slug: s.slug }] as const));
	const allNodes: SyllabusNodeRow[] = await db
		.select()
		.from(syllabusNode)
		.where(inArray(syllabusNode.syllabusId, syllabusIds));

	// Resolve each syllabus's CertApplicability via its primary credential.
	// Syllabi without any credential fall back to the default mapping. We pick
	// the lexicographically lowest slug when a syllabus is reachable from
	// multiple credentials -- a stable tiebreaker; the cert-syllabus WP keeps
	// 1:1 in practice.
	const credentialJoinRows =
		syllabusIds.length === 0
			? []
			: await db
					.select({ syllabusId: credentialSyllabus.syllabusId, credentialSlug: credential.slug })
					.from(credentialSyllabus)
					.innerJoin(credential, eq(credential.id, credentialSyllabus.credentialId))
					.where(inArray(credentialSyllabus.syllabusId, syllabusIds));
	const certBySyllabus = new Map<string, CertApplicability>();
	for (const row of credentialJoinRows) {
		const existing = certBySyllabus.get(row.syllabusId);
		if (existing === undefined) {
			certBySyllabus.set(row.syllabusId, credentialSlugToCertApplicability(row.credentialSlug));
			continue;
		}
		// Tiebreak: prefer the slug whose CertApplicability maps to a stricter
		// (non-default) applicability. The default ALL is the loosest fallback;
		// a real cert slug should win over it.
		const candidate = credentialSlugToCertApplicability(row.credentialSlug);
		if (existing === DEFAULT_TRIAD_EVIDENCE_CERT && candidate !== DEFAULT_TRIAD_EVIDENCE_CERT) {
			certBySyllabus.set(row.syllabusId, candidate);
		}
	}

	// Pull every leaf -> knowledge_node link in those syllabi. Compute the
	// leaf-mastery state in batch per syllabus (the cert mapping varies by
	// syllabus so we run one batch per cert applicability).
	const leafIds = allNodes.filter((n) => n.isLeaf).map((n) => n.id);
	const leafBySyllabus = new Map<string, string[]>();
	const syllabusByLeaf = new Map<string, string>();
	for (const n of allNodes) {
		if (!n.isLeaf) continue;
		const list = leafBySyllabus.get(n.syllabusId) ?? [];
		list.push(n.id);
		leafBySyllabus.set(n.syllabusId, list);
		syllabusByLeaf.set(n.id, n.syllabusId);
	}

	const leafStateMap = new Map<string, LeafMasteryState>();
	if (leafIds.length > 0) {
		// Group leaf ids by their cert applicability for batched mastery calls.
		const leavesByCert = new Map<CertApplicability, string[]>();
		for (const [syllabusId, ids] of leafBySyllabus) {
			const cert = certBySyllabus.get(syllabusId) ?? DEFAULT_TRIAD_EVIDENCE_CERT;
			const list = leavesByCert.get(cert) ?? [];
			list.push(...ids);
			leavesByCert.set(cert, list);
		}
		for (const [cert, ids] of leavesByCert) {
			const stateMap = await getLeafMasteryStateMap(userId, ids, cert, db);
			for (const [leafId, state] of stateMap) {
				leafStateMap.set(leafId, state);
			}
		}
	}

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
					.where(inArray(syllabusNodeLink.syllabusNodeId, leafIds));

	const linksByLeaf = new Map<string, Array<{ nodeId: string; weight: number }>>();
	for (const r of linkRows) {
		const list = linksByLeaf.get(r.leafId) ?? [];
		list.push({ nodeId: r.knowledgeNodeId, weight: r.linkWeight });
		linksByLeaf.set(r.leafId, list);
	}

	const allLensLeaves: LensLeaf[] = [];
	const allRollupLeaves: Array<{ mastery: LensLeafMastery; weight: number }> = [];

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
			leafStateMap,
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
	leafStateMap: Map<string, LeafMasteryState>,
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
	const rollupBuckets: Array<{ mastery: LensLeafMastery; weight: number }> = [];
	for (const area of roots) {
		if (filters.areaCodes !== undefined && filters.areaCodes.length > 0 && !filters.areaCodes.includes(area.code)) {
			continue;
		}
		if (!nodeMatchesClassFilter(area, filters)) continue;
		const areaNode = buildAcsSubtree(area, childrenByParent, leafStateMap, linksByLeaf, goalWeight, filters);
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
	leafStateMap: Map<string, LeafMasteryState>,
	linksByLeaf: Map<string, Array<{ nodeId: string; weight: number }>>,
	goalWeight: number,
	filters: AcsLensFilters,
): LensTreeNode {
	const children = (childrenByParent.get(node.id) ?? []).sort((a, b) => a.ordinal - b.ordinal);
	if (node.isLeaf || children.length === 0) {
		// Leaf row.
		const links = linksByLeaf.get(node.id) ?? [];
		const mastery = leafMasteryFromLeafState(leafStateMap.get(node.id));
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
		buildAcsSubtree(c, childrenByParent, leafStateMap, linksByLeaf, goalWeight, filters),
	);
	const rollupBuckets: Array<{ mastery: LensLeafMastery; weight: number }> = [];
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

function appendRollupSource(node: LensTreeNode, into: Array<{ mastery: LensLeafMastery; weight: number }>): void {
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
	rollupSink: Array<{ mastery: LensLeafMastery; weight: number }>,
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
		byEvidenceKind: {},
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
 * Domain leaves are knowledge nodes (no syllabus_node, no `triad`). Per the
 * evidence-kind-gating WP, the required-kind set for a domain leaf is
 * derived from the node's `assessment_methods` array via
 * {@link nodeAssessmentMethodsToRequiredKinds}.
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
		knowledgeNodeRows = await db.select().from(knowledgeNode).where(inArray(knowledgeNode.id, union.knowledgeNodeIds));
	}

	const evidenceByNode = await getNodeEvidenceStateMap(userId, union.knowledgeNodeIds, db);

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
	const rollupBuckets: Array<{ mastery: LensLeafMastery; weight: number }> = [];

	for (const domain of [...buckets.keys()].sort()) {
		if (filters.domains !== undefined && filters.domains.length > 0 && !filters.domains.includes(domain as Domain)) {
			continue;
		}
		const nodes = buckets.get(domain) ?? [];
		const domainLeaves: LensLeaf[] = [];
		const domainBuckets: Array<{ mastery: LensLeafMastery; weight: number }> = [];
		for (const n of nodes) {
			const evidence = evidenceByNode.get(n.id);
			const requiredKinds = nodeAssessmentMethodsToRequiredKinds(n.assessmentMethods);
			const mastery = computeDomainLeafMastery(evidence, requiredKinds);
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

// ---------------------------------------------------------------------------
// Domain-leaf required-kind derivation
// ---------------------------------------------------------------------------

const ASSESSMENT_METHOD_VALUE_SET: ReadonlySet<string> = new Set(ASSESSMENT_METHOD_VALUES);

/**
 * Map a `knowledge_node.assessment_methods` array to the required-kind set
 * for the domain lens. The column is a free-form string array per schema
 * (`jsonb<string[]>`); we narrow to known `AssessmentMethod` values and
 * drop unknown entries. Empty / null arrays produce no required kinds (the
 * leaf is then masterable via "any evidence" semantic, matching the
 * domain-lens reading where the node hasn't declared a method).
 *
 * Per spec (Phase 7, Open Q follow-on): the mapping is 1:1 -- each declared
 * method becomes a required kind. Knowledge nodes that declare both
 * `recall` and `calculation` require both gates to pass; nodes that
 * declare only `scenario` require the scenario gate. Alternatives are not
 * inferred -- a content author who wants "scenario OR demonstration" must
 * use the syllabus side (triad mapping) to express it.
 */
export function nodeAssessmentMethodsToRequiredKinds(
	methods: readonly string[] | null | undefined,
): readonly AssessmentMethod[] {
	if (methods === null || methods === undefined) return [];
	const out: AssessmentMethod[] = [];
	for (const m of methods) {
		if (ASSESSMENT_METHOD_VALUE_SET.has(m)) {
			out.push(m as AssessmentMethod);
		}
	}
	return out;
}

/**
 * Compute a `LensLeafMastery` for a domain-lens leaf (a single knowledge
 * node, no syllabus_node). The leaf is mastered when every kind declared in
 * the node's `assessment_methods` aggregates to `pass`. With zero declared
 * kinds, the leaf falls back to the loosest "any evidence" semantic so
 * legacy nodes (no methods authored) still flow through.
 */
function computeDomainLeafMastery(
	evidence: NodeEvidenceState | undefined,
	requiredKinds: readonly AssessmentMethod[],
): LensLeafMastery {
	if (evidence === undefined) {
		return { ...emptyLeafMastery(), requiredKinds };
	}
	const byEvidenceKind: Partial<Record<AssessmentMethod, GateState>> = {};
	let anyEvidence = false;
	for (const kind of ASSESSMENT_METHOD_VALUES) {
		const gate = evidence[kind];
		byEvidenceKind[kind] = gate;
		if (gate !== NODE_MASTERY_GATES.NOT_APPLICABLE) anyEvidence = true;
	}

	if (requiredKinds.length === 0) {
		// Defensive fallback for nodes with no authored assessment methods:
		// the leaf is "covered" when any evidence exists, "mastered" when
		// the evidence reaches `pass` somewhere -- preserves the legacy
		// `/knowledge` browse semantic.
		const anyPass = ASSESSMENT_METHOD_VALUES.some((k) => evidence[k] === NODE_MASTERY_GATES.PASS);
		return {
			mastered: anyPass,
			covered: anyEvidence,
			requiredKinds: [],
			byEvidenceKind,
			missingKinds: [],
		};
	}

	const missingKinds: AssessmentMethod[] = [];
	let mastered = true;
	for (const kind of requiredKinds) {
		const gate = evidence[kind];
		if (gate !== NODE_MASTERY_GATES.PASS) {
			missingKinds.push(kind);
			mastered = false;
		}
	}
	return {
		mastered,
		covered: anyEvidence,
		requiredKinds,
		byEvidenceKind,
		missingKinds,
	};
}

// `ACSTriad` is exported here for follow-on UI surfaces that need the type
// without pulling `@ab/constants` directly when reading lens output.
export type { ACSTriad };
