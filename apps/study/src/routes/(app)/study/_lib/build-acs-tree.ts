/**
 * ACS map projection -- the default `/study` map.
 *
 * Top level: areas from `mastery.areas`. The area whose code matches the
 * focus leaf's area is auto-expanded; every other area renders collapsed.
 * For the open area (only), the loader walks the syllabus tree to its
 * leaves, fetches per-leaf evidence state in one batch, resolves required
 * kinds via the credential's CertApplicability, and attaches inline
 * citations from `syllabus_node.citations`.
 *
 * Leaves live three levels deep (Area -> Task -> Element); the tree
 * mirrors that. Every closed area still surfaces its rollup so the dot bar
 * + percent reads regardless of expansion state.
 *
 * `MapNode[]` is the rendering contract -- see `map-types.ts`. The shape
 * lets the same `<MapTree>` component render every projection.
 */

import {
	type CredentialMasteryRollup,
	type CredentialRow,
	credentialSlugToCertApplicability,
	getCitationsForSyllabusNodes,
	getKnowledgeNodesForSyllabusLeaves,
	getLeafMasteryStateMap,
	getNodeEvidenceStateMap,
	getSyllabusTree,
	type LeafMasteryState,
	type NodeEvidenceState,
	type SyllabusNodeRow,
} from '@ab/bc-study/server';
import { type AssessmentMethod, NODE_MASTERY_GATES, SYLLABUS_NODE_LEVELS } from '@ab/constants';
import { db as defaultDb } from '@ab/db/connection';
import { type SourceId, urlForReference } from '@ab/sources';
import type { StructuredCitation } from '@ab/types';
import type { PgDatabase, PgQueryResultHKT } from 'drizzle-orm/pg-core';
import type { MapCitationChip, MapCitationStacks, MapNode } from './map-types';

type Db = PgDatabase<PgQueryResultHKT, Record<string, never>>;

/**
 * Public entry point.
 *
 * @param userId            user the rollup is computed for
 * @param credential        primary-goal credential row (for cert mapping)
 * @param mastery           pre-computed credential mastery rollup
 * @param primarySyllabusId primary syllabus id (mastery.primarySyllabusId)
 * @param focusAreaCode     code of the area to auto-expand (e.g. `'I'`)
 * @param db                drizzle handle
 */
export async function buildAcsTree(
	userId: string,
	credential: CredentialRow,
	mastery: CredentialMasteryRollup,
	primarySyllabusId: string | null,
	focusAreaCode: string | null,
	db: Db = defaultDb,
): Promise<MapNode[]> {
	if (primarySyllabusId === null || mastery.areas.length === 0) {
		return [];
	}
	// Pull every node row in the primary syllabus once. Same shape as
	// `getCredentialMastery`'s tree walk; we reuse the row set to materialise
	// task + element nodes for the open area without a second round trip.
	const allNodes = await getSyllabusTree(primarySyllabusId, db);

	const cert = credentialSlugToCertApplicability(credential.slug);

	// Materialise an in-memory tree keyed by parent. Cheap; the row count is
	// small (a few hundred leaves at most).
	const childrenByParent = new Map<string, SyllabusNodeRow[]>();
	const nodesByCode = new Map<string, SyllabusNodeRow>();
	for (const n of allNodes) {
		const parent = n.parentId ?? '__root__';
		const list = childrenByParent.get(parent) ?? [];
		list.push(n);
		childrenByParent.set(parent, list);
		nodesByCode.set(n.code, n);
	}
	for (const list of childrenByParent.values()) {
		list.sort((a, b) => a.ordinal - b.ordinal);
	}

	// Identify which areas should pre-fetch their leaf data (the open one).
	// Closed areas render with the rollup only; their tasks/elements stay
	// dormant until the user expands.
	const openAreaCode = focusAreaCode;
	const openArea = openAreaCode === null ? null : (nodesByCode.get(openAreaCode) ?? null);

	// Collect the leaf ids under the open area for batched evidence + link reads.
	const openLeafIds: string[] = [];
	if (openArea !== null) {
		walkLeaves(openArea, childrenByParent, (leaf) => openLeafIds.push(leaf.id));
	}

	const [leafStateMap, citationsByLeaf, linkedNodesByLeaf] = await Promise.all([
		openLeafIds.length === 0
			? Promise.resolve(new Map<string, LeafMasteryState>())
			: getLeafMasteryStateMap(userId, openLeafIds, cert, db),
		openLeafIds.length === 0
			? Promise.resolve(new Map<string, StructuredCitation[]>())
			: getCitationsForSyllabusNodes(openLeafIds, db),
		openLeafIds.length === 0
			? Promise.resolve(new Map<string, Array<{ node: { id: string }; weight: number }>>())
			: getKnowledgeNodesForSyllabusLeaves(openLeafIds, {}, db),
	]);

	// Per-leaf NodeEvidenceState: aggregate across linked knowledge nodes.
	// `aggregateLeafKindStates` already pre-aggregates required-kind gates;
	// the U/M/P pill row wants per-method GateState directly, so we fetch
	// per-node state and pick the first gate (any-passes mirrors the
	// rollup's leaf-mastery semantic without re-implementing it here).
	const allLinkedNodeIds = new Set<string>();
	for (const list of linkedNodesByLeaf.values()) {
		for (const link of list) allLinkedNodeIds.add(link.node.id);
	}
	const nodeStateMap =
		allLinkedNodeIds.size === 0
			? new Map<string, NodeEvidenceState>()
			: await getNodeEvidenceStateMap(userId, [...allLinkedNodeIds], db);

	// Build the projection tree.
	const tree: MapNode[] = mastery.areas.map((area) => {
		const areaRow = nodesByCode.get(area.areaCode);
		const isOpen = areaRow !== undefined && areaRow.id === openArea?.id;
		const children: MapNode[] =
			isOpen && areaRow !== undefined
				? buildAreaChildren(areaRow, childrenByParent, leafStateMap, citationsByLeaf, linkedNodesByLeaf, nodeStateMap)
				: [];
		return {
			id: areaRow?.id ?? `acs-area-${area.areaCode}`,
			label: area.areaTitle,
			level: 'group',
			code: area.areaCode,
			rollup: {
				masteredLeaves: area.masteredLeaves,
				coveredLeaves: area.coveredLeaves,
				totalLeaves: area.totalLeaves,
			},
			children,
			defaultOpen: isOpen,
		};
	});

	return tree;
}

function buildAreaChildren(
	area: SyllabusNodeRow,
	childrenByParent: Map<string, SyllabusNodeRow[]>,
	leafStateMap: Map<string, LeafMasteryState>,
	citationsByLeaf: Map<string, StructuredCitation[]>,
	linkedNodesByLeaf: Map<string, Array<{ node: { id: string }; weight: number }>>,
	nodeStateMap: Map<string, NodeEvidenceState>,
): MapNode[] {
	const taskRows = childrenByParent.get(area.id) ?? [];
	return taskRows
		.filter((t) => t.level === SYLLABUS_NODE_LEVELS.TASK || t.isLeaf)
		.map((task) =>
			buildTaskNode(task, childrenByParent, leafStateMap, citationsByLeaf, linkedNodesByLeaf, nodeStateMap),
		);
}

function buildTaskNode(
	task: SyllabusNodeRow,
	childrenByParent: Map<string, SyllabusNodeRow[]>,
	leafStateMap: Map<string, LeafMasteryState>,
	citationsByLeaf: Map<string, StructuredCitation[]>,
	linkedNodesByLeaf: Map<string, Array<{ node: { id: string }; weight: number }>>,
	nodeStateMap: Map<string, NodeEvidenceState>,
): MapNode {
	// Tasks can be leaves themselves (small ACS sections without elements)
	// or carry a list of element children.
	if (task.isLeaf) {
		return buildLeafNode(task, leafStateMap, citationsByLeaf, linkedNodesByLeaf, nodeStateMap);
	}
	const elementRows = childrenByParent.get(task.id) ?? [];
	const childLeaves = elementRows.map((el) =>
		buildLeafNode(el, leafStateMap, citationsByLeaf, linkedNodesByLeaf, nodeStateMap),
	);

	// Roll up the task from its child leaves -- we already have per-leaf
	// state, so we don't re-walk the credential rollup here.
	let mastered = 0;
	let covered = 0;
	let total = 0;
	for (const el of elementRows) {
		const state = leafStateMap.get(el.id);
		if (state === undefined) continue;
		total += 1;
		if (state.covered) covered += 1;
		if (state.mastered) mastered += 1;
	}

	return {
		id: task.id,
		label: task.title,
		level: 'subgroup',
		code: task.code,
		rollup: { masteredLeaves: mastered, coveredLeaves: covered, totalLeaves: total },
		children: childLeaves,
	};
}

function buildLeafNode(
	leaf: SyllabusNodeRow,
	leafStateMap: Map<string, LeafMasteryState>,
	citationsByLeaf: Map<string, StructuredCitation[]>,
	linkedNodesByLeaf: Map<string, Array<{ node: { id: string }; weight: number }>>,
	nodeStateMap: Map<string, NodeEvidenceState>,
): MapNode {
	const state = leafStateMap.get(leaf.id);
	const linkedNodes = linkedNodesByLeaf.get(leaf.id) ?? [];
	const evidenceStates: NodeEvidenceState[] = linkedNodes
		.map((l) => nodeStateMap.get(l.node.id))
		.filter((s): s is NodeEvidenceState => s !== undefined);
	const pillState = mergeNodeEvidenceStates(leaf.id, evidenceStates);

	const citationStacks = buildCitationStacks(citationsByLeaf.get(leaf.id) ?? []);

	return {
		id: leaf.id,
		label: leaf.title,
		level: 'leaf',
		code: leaf.code,
		rollup:
			state === undefined
				? null
				: { masteredLeaves: state.mastered ? 1 : 0, coveredLeaves: state.covered ? 1 : 0, totalLeaves: 1 },
		pills: pillState,
		requiredKinds: state?.requiredKinds ?? [],
		citations: citationStacks,
		children: [],
	};
}

/**
 * Pure helper: merge per-knowledge-node evidence states into a single
 * leaf-row pill row. For each method, `pass` wins over `insufficient_data`
 * which wins over `not_applicable`. Mirrors the any-one-passes semantic
 * `aggregateLeafKindStates` uses.
 */
export function mergeNodeEvidenceStates(leafId: string, states: readonly NodeEvidenceState[]): NodeEvidenceState {
	const out: NodeEvidenceState = {
		nodeId: leafId,
		recall: NODE_MASTERY_GATES.NOT_APPLICABLE,
		calculation: NODE_MASTERY_GATES.NOT_APPLICABLE,
		scenario: NODE_MASTERY_GATES.NOT_APPLICABLE,
		demonstration: NODE_MASTERY_GATES.NOT_APPLICABLE,
		teaching: NODE_MASTERY_GATES.NOT_APPLICABLE,
	};
	const methods: readonly AssessmentMethod[] = ['recall', 'calculation', 'scenario', 'demonstration', 'teaching'];
	for (const m of methods) {
		for (const s of states) {
			out[m] = pickStrongerGate(out[m], s[m]);
		}
	}
	return out;
}

function pickStrongerGate(a: NodeEvidenceState['recall'], b: NodeEvidenceState['recall']): NodeEvidenceState['recall'] {
	if (a === NODE_MASTERY_GATES.PASS || b === NODE_MASTERY_GATES.PASS) return NODE_MASTERY_GATES.PASS;
	if (a === NODE_MASTERY_GATES.FAIL || b === NODE_MASTERY_GATES.FAIL) return NODE_MASTERY_GATES.FAIL;
	if (a === NODE_MASTERY_GATES.INSUFFICIENT_DATA || b === NODE_MASTERY_GATES.INSUFFICIENT_DATA) {
		return NODE_MASTERY_GATES.INSUFFICIENT_DATA;
	}
	return NODE_MASTERY_GATES.NOT_APPLICABLE;
}

/**
 * Pure helper: split a leaf's `StructuredCitation[]` into the two stacks
 * the citation panel renders (handbook on top, regulation underneath).
 * Other citation kinds (AC, ACS, AIM, ...) currently fold into the handbook
 * stack -- they're guidance-shaped, not rule-shaped, so the handbook-first
 * default applies. WP 3 may split them out further when render-mode lands.
 */
export function buildCitationStacks(citations: readonly StructuredCitation[]): MapCitationStacks {
	const handbook: MapCitationChip[] = [];
	const regulation: MapCitationChip[] = [];
	for (const c of citations) {
		const chip = citationToChip(c);
		if (chip === null) continue;
		if (c.kind === 'cfr') regulation.push(chip);
		else handbook.push(chip);
	}
	return { handbook, regulation };
}

function citationToChip(c: StructuredCitation): MapCitationChip | null {
	const ref = c.airboss_ref ?? null;
	const href = ref === null ? null : urlForReference(ref as SourceId);
	if (href === null) return null;
	const label = labelForCitation(c);
	const source: MapCitationChip['source'] = c.kind === 'cfr' ? 'regulation' : c.kind === 'ac' ? 'ac' : 'handbook';
	return {
		id: ref ?? `${c.kind}:${c.reference_id}:${label}`,
		label,
		href,
		source,
	};
}

function labelForCitation(c: StructuredCitation): string {
	switch (c.kind) {
		case 'handbook': {
			const chapter = c.locator.chapter;
			const section = c.locator.section;
			return section === undefined ? `Chapter ${chapter}` : `Chapter ${chapter}.${section}`;
		}
		case 'cfr':
			return `${c.locator.title} CFR ${c.locator.section}`;
		case 'ac':
			return c.locator.paragraph === undefined
				? `AC ${c.reference_id}`
				: `AC ${c.reference_id} ¶${c.locator.paragraph}`;
		case 'aim':
			return c.locator.paragraph === undefined ? 'AIM' : `AIM ${c.locator.paragraph}`;
		case 'acs':
		case 'pts':
			return (
				[c.locator.area, c.locator.task, c.locator.element].filter((v) => v !== undefined).join('.') ||
				c.kind.toUpperCase()
			);
		case 'pcg':
			return c.locator.term ?? 'PCG';
		case 'ntsb':
		case 'poh':
		case 'other':
			return c.locator.detail ?? c.kind.toUpperCase();
	}
}

function walkLeaves(
	root: SyllabusNodeRow,
	childrenByParent: Map<string, SyllabusNodeRow[]>,
	visit: (leaf: SyllabusNodeRow) => void,
): void {
	const stack: SyllabusNodeRow[] = [root];
	while (stack.length > 0) {
		const node = stack.pop();
		if (node === undefined) continue;
		if (node.isLeaf) {
			visit(node);
			continue;
		}
		const children = childrenByParent.get(node.id) ?? [];
		for (const c of children) stack.push(c);
	}
}

// Local re-export for the rollup type the loader feeds us.
export type { CredentialMasteryRollup };
