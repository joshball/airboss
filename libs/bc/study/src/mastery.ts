/**
 * Per-evidence-kind mastery primitive (evidence-kind-gating WP).
 *
 * Composes on top of the dual-gate model in `knowledge.ts` (cards + reps
 * pillars). Where the dual gate is kind-agnostic, this module decomposes the
 * per-node signal by `AssessmentMethod` so a syllabus leaf can demand
 * "scenario evidence" or "teaching evidence" specifically and the rollup
 * tells you which kind is missing rather than collapsing every kind into one
 * boolean.
 *
 * Backing data status (matches the live schema, not the spec's aspirational
 * shape):
 *   - `recall`: aggregated from every card attached to the node. The card
 *     schema does not currently carry a recall vs calculation kind, so the
 *     `recall` gate folds in every card. When `card.kind` lands, the gate
 *     filters by `card.kind = 'recall'` instead.
 *   - `scenario`: aggregated from every rep attempt on a scenario attached to
 *     the node. The scenario schema does not currently carry an
 *     `assessment_methods` column either, so every rep contributes to the
 *     `scenario` gate. When `scenario.assessment_methods` lands, the gate
 *     filters by methods that include `'scenario'`.
 *   - `calculation`, `demonstration`: backing partition data does not exist
 *     yet. Both gates report `not_applicable` until a follow-on data WP adds
 *     `card.kind` and `scenario.assessment_methods`.
 *   - `teaching`: depends on a `'teaching-exercise'` `SESSION_ITEM_KINDS`
 *     value that does not exist yet. Reports `not_applicable` until that
 *     item kind ships and is wired through the session pipeline.
 *
 * The leaf-mastery gating is meaningful even with these limits: an `S` leaf
 * still demands `[demonstration, scenario]` alternatives, and with the
 * current data only the `scenario` alternative ever reaches `pass`. A learner
 * with recall-only evidence on an `S` leaf reads as not-mastered with
 * `missingKinds=['demonstration', 'scenario']`, which is the user-facing fix
 * this WP exists to deliver. Per-kind decomposition tightens further when
 * the data layer catches up.
 *
 * See `docs/work-packages/evidence-kind-gating/` for spec / design / tasks.
 */

import {
	ACS_TRIAD,
	type ACSTriad,
	ASSESSMENT_METHODS,
	type AssessmentMethod,
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
import { card, cardState, scenario, sessionItemResult, syllabusNode, syllabusNodeLink } from './schema';

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

interface PerKindCounts {
	cards: { total: number; mastered: number };
	reps: { total: number; correct: number };
	scenariosAttached: number;
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

	// Three independent fan-outs:
	//   1. Cards attached to each node (recall pillar; calculation cannot be
	//      partitioned until card.kind ships).
	//   2. Rep attempts via session_item_result joined to scenario by node id
	//      (scenario pillar; demonstration cannot be partitioned until
	//      scenario.assessment_methods ships).
	//   3. Whether any scenarios are attached at all (drives the
	//      `not_applicable` fallback for nodes with zero scenarios).
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

	const perNode = new Map<string, PerKindCounts>();
	for (const id of ids) {
		perNode.set(id, {
			cards: { total: 0, mastered: 0 },
			reps: { total: 0, correct: 0 },
			scenariosAttached: 0,
		});
	}
	for (const r of cardRows) {
		if (!r.nodeId) continue;
		const existing = perNode.get(r.nodeId);
		if (existing === undefined) continue;
		existing.cards = { total: Number(r.cardsTotal ?? 0), mastered: Number(r.cardsMastered ?? 0) };
	}
	for (const r of repRows) {
		if (!r.nodeId) continue;
		const existing = perNode.get(r.nodeId);
		if (existing === undefined) continue;
		existing.reps = { total: Number(r.repsTotal ?? 0), correct: Number(r.repsCorrect ?? 0) };
	}
	for (const r of scenarioRows) {
		if (!r.nodeId) continue;
		const existing = perNode.get(r.nodeId);
		if (existing === undefined) continue;
		existing.scenariosAttached = Number(r.c ?? 0);
	}

	for (const id of ids) {
		const counts = perNode.get(id);
		const cardsTotal = counts?.cards.total ?? 0;
		const cardsMastered = counts?.cards.mastered ?? 0;
		const cardsRatio = cardsTotal === 0 ? 0 : cardsMastered / cardsTotal;
		const repsTotal = counts?.reps.total ?? 0;
		const repsCorrect = counts?.reps.correct ?? 0;
		const repsAccuracy = repsTotal === 0 ? 0 : repsCorrect / repsTotal;
		const scenariosAttached = counts?.scenariosAttached ?? 0;

		const recall = computeCardGate(cardsTotal, cardsRatio);
		const scenarioGate = computeRepGate(repsTotal, repsAccuracy, scenariosAttached);

		out.set(id, {
			nodeId: id,
			recall,
			// Backing data does not exist yet (see file header). When card.kind
			// ships, partition the card query by kind and replace this with the
			// calculation-card-only gate.
			calculation: NODE_MASTERY_GATES.NOT_APPLICABLE,
			scenario: scenarioGate,
			// Backing data does not exist yet (see file header). When
			// scenario.assessment_methods ships, partition the rep query by
			// method and replace this with the demonstration-only gate.
			demonstration: NODE_MASTERY_GATES.NOT_APPLICABLE,
			// Backing data does not exist yet (no 'teaching-exercise' value in
			// SESSION_ITEM_KINDS). When that item kind ships, query
			// session_item_result for it and replace this with a real gate.
			teaching: NODE_MASTERY_GATES.NOT_APPLICABLE,
		});
	}

	return out;
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
