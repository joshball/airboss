/**
 * Per-evidence-kind mastery primitive (evidence-kind-gating + evidence-kind-data-layer WPs).
 *
 * Composes on top of the dual-gate model in `knowledge.ts` (cards + reps
 * pillars). Where the dual gate is kind-agnostic, this module decomposes the
 * per-node signal by `AssessmentMethod` so a syllabus leaf can demand
 * "scenario evidence" or "teaching evidence" specifically and the rollup
 * tells you which kind is missing rather than collapsing every kind into one
 * boolean.
 *
 * Per-kind partition shape (real, since evidence-kind-data-layer landed):
 *   - `recall`: cards filtered to `card.kind = 'recall'`, joined to
 *     `card_state` for the mastered-stability check. Zero recall cards on a
 *     node => `not_applicable` for that node's recall gate.
 *   - `calculation`: same as recall but `card.kind = 'calculation'`. Zero
 *     calc cards => `not_applicable`.
 *   - `scenario`: reps via `session_item_result` joined to `scenario`,
 *     where `scenario.assessment_methods @> '["scenario"]'::jsonb`. Hybrid
 *     scenarios tagged `['scenario','demonstration']` contribute to both
 *     gates. Zero matching reps => `not_applicable`.
 *   - `demonstration`: same as scenario but the array contains
 *     `'demonstration'`. Zero matching => `not_applicable`.
 *   - `teaching`: `session_item_result` rows with `item_kind =
 *     'teaching-exercise'` joined to `teaching_exercise.node_id`. Treated
 *     like reps -- count + accuracy via `computeRepGate`. Zero rows =>
 *     `not_applicable`.
 *
 * `aggregateLeafKindStates` is unchanged in shape; the data behind its
 * inputs is what got tighter. Existing leaf-mastery semantics (any-of x
 * all-of with the requires-teaching stack) keep working without edits.
 *
 * See:
 *   docs/work-packages/evidence-kind-gating/   -- gate logic + leaf rollup
 *   docs/work-packages/evidence-kind-data-layer/ -- partition columns + this wire-up
 */

import {
	ACS_TRIAD,
	type ACSTriad,
	ASSESSMENT_METHODS,
	type AssessmentMethod,
	CARD_KINDS,
	CARD_MASTERY_RATIO_THRESHOLD,
	CARD_MIN,
	CARD_STATUSES,
	CERT_APPLICABILITIES,
	CERT_APPLICABILITY_VALUES,
	type CertApplicability,
	DEFAULT_TRIAD_EVIDENCE_CERT,
	NODE_MASTERY_GATES,
	type NodeMasteryGate,
	REP_ACCURACY_THRESHOLD,
	REP_MIN,
	SESSION_ITEM_KINDS,
	STABILITY_MASTERED_DAYS,
	TEACHING_EVIDENCE_KINDS,
	TRIAD_EVIDENCE_REQUIREMENTS,
} from '@ab/constants';
import { db as defaultDb } from '@ab/db/connection';
import { and, count, eq, inArray, isNotNull, isNull, sql } from 'drizzle-orm';
import type { PgDatabase, PgQueryResultHKT } from 'drizzle-orm/pg-core';
import { computeCardGate, computeRepGate } from './knowledge';
import {
	card,
	cardState,
	scenario,
	sessionItemResult,
	syllabusNode,
	syllabusNodeLink,
	teachingExercise,
} from './schema';

type Db = PgDatabase<PgQueryResultHKT, Record<string, never>>;

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/** Re-export of the dual-gate per-pillar gate state so callers don't pull two modules. */
export type GateState = NodeMasteryGate;

/**
 * Per-evidence-kind gate state for a single knowledge node. Each entry is the
 * outcome of running the dual-gate threshold logic against the slice of
 * evidence tagged with that kind.
 */
export interface NodeEvidenceState {
	nodeId: string;
	recall: GateState;
	calculation: GateState;
	scenario: GateState;
	demonstration: GateState;
	teaching: GateState;
}

/**
 * Per-leaf mastery state aggregated from the leaf's linked knowledge nodes.
 *
 * `mastered` is true when every required kind aggregates to `pass` somewhere
 * across the linked nodes (any-one-passes per kind, per Open Q (c)). The
 * legacy `mastered: boolean` field name keeps its meaning but the threshold
 * for `true` is stricter than the kind-agnostic dual gate.
 */
export interface LeafMasteryState {
	leafId: string;
	mastered: boolean;
	covered: boolean;
	requiredKinds: readonly AssessmentMethod[];
	byEvidenceKind: Partial<Record<AssessmentMethod, GateState>>;
	missingKinds: readonly AssessmentMethod[];
}

/** Raised when a leaf row can't be found. */
export class SyllabusLeafNotFoundError extends Error {
	constructor(public readonly leafId: string) {
		super(`Syllabus leaf not found: ${leafId}`);
		this.name = 'SyllabusLeafNotFoundError';
	}
}

// ---------------------------------------------------------------------------
// Cert-applicability resolution
// ---------------------------------------------------------------------------

const CERT_APPLICABILITY_VALUE_SET: ReadonlySet<string> = new Set(CERT_APPLICABILITY_VALUES);

/**
 * Map a credential slug to its `CertApplicability` for triad-mapping lookup.
 *
 * Credential slugs follow the kebab-case convention (`private`, `commercial`,
 * `cfi`, `cfii`, `atp`); the slugs already align with `CERT_APPLICABILITIES`
 * values for the cert-level credentials we care about. Anything else (a
 * class rating like `single-engine-land`, an endorsement, the `student`
 * placeholder) falls back to {@link DEFAULT_TRIAD_EVIDENCE_CERT}, which uses
 * the recall-only K mapping. The fallback can never tighten the gate beyond
 * what the spec requires.
 */
export function credentialSlugToCertApplicability(slug: string | null | undefined): CertApplicability {
	if (slug !== null && slug !== undefined && CERT_APPLICABILITY_VALUE_SET.has(slug)) {
		return slug as CertApplicability;
	}
	return DEFAULT_TRIAD_EVIDENCE_CERT;
}

// ---------------------------------------------------------------------------
// Per-node evidence state
// ---------------------------------------------------------------------------

interface CardKindCounts {
	total: number;
	mastered: number;
}

interface RepMethodCounts {
	total: number;
	correct: number;
	scenariosAttached: number;
}

interface PerKindCounts {
	cardsByKind: Map<string, CardKindCounts>;
	repsByMethod: Map<string, RepMethodCounts>;
	teaching: { total: number; correct: number; exercisesAttached: number };
}

function emptyPerKindCounts(): PerKindCounts {
	return {
		cardsByKind: new Map(),
		repsByMethod: new Map(),
		teaching: { total: 0, correct: 0, exercisesAttached: 0 },
	};
}

/**
 * Compute per-evidence-kind gates for a single (user, node).
 *
 * Each kind reuses the dual-gate threshold helpers (`computeCardGate`,
 * `computeRepGate`) so a kind that has zero evidence reports
 * `not_applicable`, below-minimum reports `insufficient_data`, and at-minimum
 * reports `pass` / `fail` per the global thresholds.
 */
export async function getNodeEvidenceState(
	userId: string,
	nodeId: string,
	db: Db = defaultDb,
): Promise<NodeEvidenceState> {
	const map = await getNodeEvidenceStateMap(userId, [nodeId], db);
	const state = map.get(nodeId);
	if (state !== undefined) {
		return state;
	}
	return {
		nodeId,
		recall: NODE_MASTERY_GATES.NOT_APPLICABLE,
		calculation: NODE_MASTERY_GATES.NOT_APPLICABLE,
		scenario: NODE_MASTERY_GATES.NOT_APPLICABLE,
		demonstration: NODE_MASTERY_GATES.NOT_APPLICABLE,
		teaching: NODE_MASTERY_GATES.NOT_APPLICABLE,
	};
}

/**
 * Batched per-node evidence state. Mirrors `getNodeMasteryMap`'s round-trip
 * shape so the rollup callers can fetch state for an entire credential or
 * goal in a single fan-out.
 */
export async function getNodeEvidenceStateMap(
	userId: string,
	nodeIds: readonly string[],
	db: Db = defaultDb,
): Promise<Map<string, NodeEvidenceState>> {
	const out = new Map<string, NodeEvidenceState>();
	if (nodeIds.length === 0) return out;
	const ids = [...nodeIds];

	// Five independent fan-outs:
	//   1. Cards grouped by (node_id, kind) -- drives recall + calculation gates.
	//   2. Reps grouped by (scenario.node_id, method) via LATERAL on the
	//      assessment_methods jsonb array -- drives scenario + demonstration gates.
	//   3. Per-(node, method) scenario count for the rep gate's "scenarios
	//      attached" fallback (computeRepGate uses it to distinguish "no
	//      scenarios authored" from "scenarios authored but no attempts").
	//   4. Teaching-exercise rep counts joined through teaching_exercise.node_id.
	//   5. Per-node teaching-exercise count for the same fallback (zero
	//      teaching exercises authored on a node => teaching=not_applicable).
	const [cardRows, repRows, scenarioCountRows, teachingRepRows, teachingExerciseCountRows] = await Promise.all([
		db
			.select({
				nodeId: card.nodeId,
				kind: card.kind,
				cardsTotal: count(),
				cardsMastered: sql<number>`sum(case when ${cardState.stability} > ${STABILITY_MASTERED_DAYS} then 1 else 0 end)`,
			})
			.from(card)
			.innerJoin(cardState, and(eq(cardState.cardId, card.id), eq(cardState.userId, card.userId)))
			.where(and(eq(card.userId, userId), eq(card.status, CARD_STATUSES.ACTIVE), inArray(card.nodeId, ids)))
			.groupBy(card.nodeId, card.kind),
		// LATERAL UNNEST over scenario.assessment_methods (jsonb array). Postgres
		// `jsonb_array_elements_text` cross joins each scenario row with one
		// element row per method; group by (scenario.node_id, method) folds
		// the per-method totals. A hybrid scenario tagged
		// `['scenario','demonstration']` contributes the same rep attempts to
		// both gates by design.
		db
			.select({
				nodeId: scenario.nodeId,
				method: sql<string>`m.value`,
				repsTotal: count(),
				repsCorrect: sql<number>`sum(case when ${sessionItemResult.isCorrect} then 1 else 0 end)`,
			})
			.from(sessionItemResult)
			.innerJoin(
				scenario,
				and(eq(scenario.id, sessionItemResult.scenarioId), eq(scenario.userId, sessionItemResult.userId)),
			)
			.innerJoin(sql`jsonb_array_elements_text(${scenario.assessmentMethods}) AS m(value)`, sql`true`)
			.where(
				and(
					eq(sessionItemResult.userId, userId),
					eq(sessionItemResult.itemKind, SESSION_ITEM_KINDS.REP),
					isNotNull(sessionItemResult.completedAt),
					isNull(sessionItemResult.skipKind),
					inArray(scenario.nodeId, ids),
				),
			)
			.groupBy(scenario.nodeId, sql`m.value`),
		// Per-(node, method) count of scenarios authored against the node.
		// Drives the rep-gate fallback: a node with zero scenarios tagged
		// `'demonstration'` reports `demonstration=not_applicable` even if
		// reps were attempted on a different (recall-tagged?) scenario row.
		db
			.select({
				nodeId: scenario.nodeId,
				method: sql<string>`m.value`,
				c: count(),
			})
			.from(scenario)
			.innerJoin(sql`jsonb_array_elements_text(${scenario.assessmentMethods}) AS m(value)`, sql`true`)
			.where(and(eq(scenario.userId, userId), inArray(scenario.nodeId, ids)))
			.groupBy(scenario.nodeId, sql`m.value`),
		// Teaching-exercise reps. session_item_result rows with
		// item_kind='teaching-exercise' joined to teaching_exercise so the
		// gate can group by node_id. The shape mirrors the rep query --
		// computeRepGate handles count + accuracy.
		db
			.select({
				nodeId: teachingExercise.nodeId,
				repsTotal: count(),
				repsCorrect: sql<number>`sum(case when ${sessionItemResult.isCorrect} then 1 else 0 end)`,
			})
			.from(sessionItemResult)
			.innerJoin(
				teachingExercise,
				and(
					eq(teachingExercise.id, sessionItemResult.teachingExerciseId),
					eq(teachingExercise.userId, sessionItemResult.userId),
				),
			)
			.where(
				and(
					eq(sessionItemResult.userId, userId),
					eq(sessionItemResult.itemKind, SESSION_ITEM_KINDS.TEACHING_EXERCISE),
					isNotNull(sessionItemResult.completedAt),
					isNull(sessionItemResult.skipKind),
					inArray(teachingExercise.nodeId, ids),
				),
			)
			.groupBy(teachingExercise.nodeId),
		// Per-node count of teaching-exercise rows authored against the node.
		// Zero exercises on a node => teaching=not_applicable, regardless of
		// whether other reps exist (mirrors the scenario-attached fallback).
		db
			.select({ nodeId: teachingExercise.nodeId, c: count() })
			.from(teachingExercise)
			.where(and(eq(teachingExercise.userId, userId), inArray(teachingExercise.nodeId, ids)))
			.groupBy(teachingExercise.nodeId),
	]);

	const perNode = new Map<string, PerKindCounts>();
	for (const id of ids) perNode.set(id, emptyPerKindCounts());

	for (const r of cardRows) {
		if (!r.nodeId) continue;
		const node = perNode.get(r.nodeId);
		if (!node) continue;
		node.cardsByKind.set(r.kind, {
			total: Number(r.cardsTotal ?? 0),
			mastered: Number(r.cardsMastered ?? 0),
		});
	}
	for (const r of repRows) {
		if (!r.nodeId) continue;
		const node = perNode.get(r.nodeId);
		if (!node) continue;
		const existing = node.repsByMethod.get(r.method) ?? { total: 0, correct: 0, scenariosAttached: 0 };
		existing.total = Number(r.repsTotal ?? 0);
		existing.correct = Number(r.repsCorrect ?? 0);
		node.repsByMethod.set(r.method, existing);
	}
	for (const r of scenarioCountRows) {
		if (!r.nodeId) continue;
		const node = perNode.get(r.nodeId);
		if (!node) continue;
		const existing = node.repsByMethod.get(r.method) ?? { total: 0, correct: 0, scenariosAttached: 0 };
		existing.scenariosAttached = Number(r.c ?? 0);
		node.repsByMethod.set(r.method, existing);
	}
	for (const r of teachingRepRows) {
		if (!r.nodeId) continue;
		const node = perNode.get(r.nodeId);
		if (!node) continue;
		node.teaching.total = Number(r.repsTotal ?? 0);
		node.teaching.correct = Number(r.repsCorrect ?? 0);
	}
	for (const r of teachingExerciseCountRows) {
		if (!r.nodeId) continue;
		const node = perNode.get(r.nodeId);
		if (!node) continue;
		node.teaching.exercisesAttached = Number(r.c ?? 0);
	}

	for (const id of ids) {
		const counts = perNode.get(id) ?? emptyPerKindCounts();

		const recall = cardGateForKind(counts.cardsByKind, CARD_KINDS.RECALL);
		const calculation = cardGateForKind(counts.cardsByKind, CARD_KINDS.CALCULATION);
		const scenarioGate = repGateForMethod(counts.repsByMethod, ASSESSMENT_METHODS.SCENARIO);
		const demonstration = repGateForMethod(counts.repsByMethod, ASSESSMENT_METHODS.DEMONSTRATION);
		const teaching = teachingGate(counts.teaching);

		out.set(id, {
			nodeId: id,
			recall,
			calculation,
			scenario: scenarioGate,
			demonstration,
			teaching,
		});
	}

	return out;
}

function cardGateForKind(byKind: Map<string, CardKindCounts>, kind: AssessmentMethod): GateState {
	const c = byKind.get(kind);
	const total = c?.total ?? 0;
	const mastered = c?.mastered ?? 0;
	const ratio = total === 0 ? 0 : mastered / total;
	return computeCardGate(total, ratio);
}

function repGateForMethod(byMethod: Map<string, RepMethodCounts>, method: AssessmentMethod): GateState {
	const m = byMethod.get(method);
	const total = m?.total ?? 0;
	const correct = m?.correct ?? 0;
	const accuracy = total === 0 ? 0 : correct / total;
	const scenariosAttached = m?.scenariosAttached ?? 0;
	return computeRepGate(total, accuracy, scenariosAttached);
}

function teachingGate(t: { total: number; correct: number; exercisesAttached: number }): GateState {
	const accuracy = t.total === 0 ? 0 : t.correct / t.total;
	return computeRepGate(t.total, accuracy, t.exercisesAttached);
}

// ---------------------------------------------------------------------------
// Aggregation helpers
// ---------------------------------------------------------------------------

const GATE_PRECEDENCE: Record<NodeMasteryGate, number> = {
	[NODE_MASTERY_GATES.PASS]: 3,
	[NODE_MASTERY_GATES.FAIL]: 2,
	[NODE_MASTERY_GATES.INSUFFICIENT_DATA]: 1,
	[NODE_MASTERY_GATES.NOT_APPLICABLE]: 0,
};

/**
 * Aggregate a single evidence-kind gate across a set of per-node states via
 * the any-one-passes precedence: `pass > fail > insufficient_data >
 * not_applicable`. A single passing node wins; otherwise the strongest non-
 * pass state propagates.
 */
function aggregateKind(perNode: readonly NodeEvidenceState[], kind: AssessmentMethod): GateState {
	let best: GateState = NODE_MASTERY_GATES.NOT_APPLICABLE;
	let bestRank = GATE_PRECEDENCE[best];
	for (const state of perNode) {
		const value = state[kind];
		const rank = GATE_PRECEDENCE[value];
		if (rank > bestRank) {
			best = value;
			bestRank = rank;
		}
	}
	return best;
}

/**
 * Resolve the required-kind set for a leaf into the final all-of x any-of
 * shape from the spec. Inner array is "all of these required"; outer array
 * is "any of these alternatives." A leaf is mastered when at least one outer
 * group's inner kinds all aggregate to `pass`.
 *
 * The fallback for a leaf without a triad (`triad=null`) is an empty
 * required-kind set (trivially mastered when covered).
 */
function resolveRequiredKindGroups(
	triad: ACSTriad | null,
	requiresTeaching: boolean,
	cert: CertApplicability,
): readonly (readonly AssessmentMethod[])[] {
	if (triad === null) {
		// Defensive guard. The schema CHECK keeps requires_teaching false on
		// triad=null rows, so this branch should be unreachable in practice.
		return requiresTeaching ? [TEACHING_EVIDENCE_KINDS] : [];
	}
	const triadGroups = TRIAD_EVIDENCE_REQUIREMENTS[cert][triad];
	if (!requiresTeaching) {
		return triadGroups;
	}
	// Stack the teaching kinds onto every alternative -- if any group from
	// the triad mapping passes, the leaf still needs the teaching evidence.
	return triadGroups.map((group) => [...group, ...TEACHING_EVIDENCE_KINDS]);
}

/**
 * Pure helper that aggregates a leaf's per-node evidence states into a
 * leaf-mastery shape.
 *
 * @param perNode  Per-node evidence states for every linked knowledge node.
 * @param requiredKindGroups  All-of x any-of resolved required kinds from
 *                            {@link resolveRequiredKindGroups}.
 */
export function aggregateLeafKindStates(
	perNode: readonly NodeEvidenceState[],
	requiredKindGroups: readonly (readonly AssessmentMethod[])[],
): {
	byEvidenceKind: Partial<Record<AssessmentMethod, GateState>>;
	mastered: boolean;
	missingKinds: readonly AssessmentMethod[];
	requiredKinds: readonly AssessmentMethod[];
} {
	const byEvidenceKind: Partial<Record<AssessmentMethod, GateState>> = {};
	const requiredKindSet = new Set<AssessmentMethod>();
	for (const group of requiredKindGroups) {
		for (const kind of group) {
			requiredKindSet.add(kind);
			if (byEvidenceKind[kind] === undefined) {
				byEvidenceKind[kind] = aggregateKind(perNode, kind);
			}
		}
	}

	if (perNode.length === 0) {
		return {
			byEvidenceKind,
			mastered: requiredKindGroups.length === 0,
			missingKinds: [...requiredKindSet],
			requiredKinds: [...requiredKindSet],
		};
	}

	if (requiredKindGroups.length === 0) {
		// Leaf with no required kinds (defensive triad=null + no
		// requires_teaching). Trivially mastered when at least one node has
		// any evidence at all -- this matches the credential rollup's
		// "covered" semantic.
		const anyEvidence = perNode.some((s) =>
			Object.values(ASSESSMENT_METHODS).some((kind) => s[kind] !== NODE_MASTERY_GATES.NOT_APPLICABLE),
		);
		return {
			byEvidenceKind,
			mastered: anyEvidence,
			missingKinds: [],
			requiredKinds: [],
		};
	}

	let mastered = false;
	let bestRemaining: AssessmentMethod[] | null = null;
	for (const group of requiredKindGroups) {
		const remaining: AssessmentMethod[] = [];
		for (const kind of group) {
			const state = byEvidenceKind[kind] ?? aggregateKind(perNode, kind);
			byEvidenceKind[kind] = state;
			if (state !== NODE_MASTERY_GATES.PASS) {
				remaining.push(kind);
			}
		}
		if (remaining.length === 0) {
			mastered = true;
			bestRemaining = [];
			break;
		}
		if (bestRemaining === null || remaining.length < bestRemaining.length) {
			bestRemaining = remaining;
		}
	}

	// `missingKinds` reports the kinds the learner still needs to clear in
	// order to unlock the closest-to-pass alternative. When mastered, the
	// list is empty (nothing's missing). When unmastered, the list points at
	// the cheapest path to mastery.
	const missing: AssessmentMethod[] = mastered ? [] : (bestRemaining ?? [...requiredKindSet]);

	return {
		byEvidenceKind,
		mastered,
		missingKinds: missing,
		requiredKinds: [...requiredKindSet],
	};
}

// ---------------------------------------------------------------------------
// Per-leaf mastery
// ---------------------------------------------------------------------------

/**
 * Per-leaf mastery against a specific cert level. The `cert` argument selects
 * which triad-mapping is used (`CERT_APPLICABILITIES.CFI` tightens the K
 * gate; everything else uses the recall-only K mapping). Callers that don't
 * have a credential context pass {@link DEFAULT_TRIAD_EVIDENCE_CERT}.
 */
export async function isLeafMastered(
	userId: string,
	syllabusNodeId: string,
	cert: CertApplicability = DEFAULT_TRIAD_EVIDENCE_CERT,
	db: Db = defaultDb,
): Promise<LeafMasteryState> {
	const map = await getLeafMasteryStateMap(userId, [syllabusNodeId], cert, db);
	const state = map.get(syllabusNodeId);
	if (state === undefined) {
		throw new SyllabusLeafNotFoundError(syllabusNodeId);
	}
	return state;
}

/**
 * Batched per-leaf mastery. One trip pulls the leaf metadata, one pulls
 * every leaf's link rows, one pulls per-node evidence state for the union of
 * linked node ids; aggregation is in-memory after.
 */
export async function getLeafMasteryStateMap(
	userId: string,
	leafIds: readonly string[],
	cert: CertApplicability = DEFAULT_TRIAD_EVIDENCE_CERT,
	db: Db = defaultDb,
): Promise<Map<string, LeafMasteryState>> {
	const out = new Map<string, LeafMasteryState>();
	if (leafIds.length === 0) return out;
	const ids = [...leafIds];

	const [leafRows, linkRows] = await Promise.all([
		db
			.select({
				id: syllabusNode.id,
				triad: syllabusNode.triad,
				requiresTeaching: syllabusNode.requiresTeaching,
			})
			.from(syllabusNode)
			.where(inArray(syllabusNode.id, ids)),
		db
			.select({
				leafId: syllabusNodeLink.syllabusNodeId,
				knowledgeNodeId: syllabusNodeLink.knowledgeNodeId,
			})
			.from(syllabusNodeLink)
			.where(inArray(syllabusNodeLink.syllabusNodeId, ids)),
	]);

	const leafById = new Map(leafRows.map((r) => [r.id, r] as const));
	const linksByLeaf = new Map<string, string[]>();
	const allKnowledgeNodeIds = new Set<string>();
	for (const row of linkRows) {
		const existing = linksByLeaf.get(row.leafId) ?? [];
		existing.push(row.knowledgeNodeId);
		linksByLeaf.set(row.leafId, existing);
		allKnowledgeNodeIds.add(row.knowledgeNodeId);
	}

	const evidenceByNode = await getNodeEvidenceStateMap(userId, [...allKnowledgeNodeIds], db);

	for (const id of ids) {
		const leaf = leafById.get(id);
		if (leaf === undefined) {
			// Caller passed a non-existent leaf id. Record the absence so the
			// rollup can decide whether to throw or skip.
			continue;
		}
		const triad = (leaf.triad ?? null) as ACSTriad | null;
		const requiresTeaching = leaf.requiresTeaching;
		const requiredKindGroups = resolveRequiredKindGroups(triad, requiresTeaching, cert);

		const linkedNodeIds = linksByLeaf.get(id) ?? [];
		const perNode = linkedNodeIds
			.map((nid) => evidenceByNode.get(nid))
			.filter((s): s is NodeEvidenceState => s !== undefined);

		const aggregate = aggregateLeafKindStates(perNode, requiredKindGroups);
		const covered = perNode.some((state) =>
			Object.values(ASSESSMENT_METHODS).some((kind) => state[kind] !== NODE_MASTERY_GATES.NOT_APPLICABLE),
		);

		out.set(id, {
			leafId: id,
			mastered: linkedNodeIds.length === 0 ? false : aggregate.mastered,
			covered,
			requiredKinds: aggregate.requiredKinds,
			byEvidenceKind: aggregate.byEvidenceKind,
			missingKinds: aggregate.missingKinds,
		});
	}

	return out;
}

// ---------------------------------------------------------------------------
// Re-exports used by callers that consume the leaf-mastery shape directly
// ---------------------------------------------------------------------------

export {
	ACS_TRIAD,
	ASSESSMENT_METHODS,
	CARD_MASTERY_RATIO_THRESHOLD,
	CARD_MIN,
	CERT_APPLICABILITIES,
	NODE_MASTERY_GATES,
	REP_ACCURACY_THRESHOLD,
	REP_MIN,
	TEACHING_EVIDENCE_KINDS,
	TRIAD_EVIDENCE_REQUIREMENTS,
};
