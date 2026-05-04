/**
 * Stage-5 cross-link audit.
 *
 * Walks every row in `study.content_citations` and emits one finding per
 * row that fails any of these checks:
 *
 *   - DEAD_TARGET     -- target row no longer exists in its target table.
 *   - DEAD_SOURCE     -- source row no longer exists in its source table.
 *   - NO_RESOLVER     -- target is corpus-backed (cfr / handbook / ac /
 *                        acs / aim / ntsb) but no resolver is registered
 *                        for that corpus, so the citation chip cannot
 *                        deep-link.
 *   - INVALID_EXTERNAL -- external_ref target_id failed URL validation.
 *
 * The job also rolls up two summaries:
 *
 *   - per-corpus coverage (citations whose target corpus has a registered
 *     resolver vs. citations stuck on a dead/no-resolver corpus), so the
 *     library-completeness sequence can see at a glance whether the next
 *     corpus to seed is the one accumulating citations.
 *   - target-type tallies, so the spec doc can quote real numbers.
 *
 * All three pieces (findings, per-corpus, per-type) come from a single
 * pass over `content_citations`. The audit is read-only; it never writes
 * to the database.
 *
 * Output format choice: returns a typed `AuditReport` value rather than
 * printing. The CLI wrapper (`scripts/sources/audit-citations.ts`) owns
 * the human-readable rendering and the exit code; that keeps the BC
 * testable without capturing stdout.
 */

import { hangarReference } from '@ab/bc-hangar';
import {
	CITATION_SOURCE_TYPES,
	CITATION_TARGET_TYPES,
	type CitationSourceType,
	type CitationTargetType,
	EXTERNAL_REF_TARGET_DELIMITER,
} from '@ab/constants';
import { db as defaultDb } from '@ab/db/connection';
import { ENUMERATED_CORPORA, getCorpusResolver } from '@ab/sources';
import { inArray, sql } from 'drizzle-orm';
import type { PgDatabase, PgQueryResultHKT } from 'drizzle-orm/pg-core';
import { card, knowledgeNode, scenario } from '../schema';
import { corpusForCitationTarget } from './corpus';
import { type ContentCitationRow, contentCitation } from './schema';

type Db = PgDatabase<PgQueryResultHKT, Record<string, never>>;

export const AUDIT_FINDING_KINDS = {
	DEAD_TARGET: 'dead_target',
	DEAD_SOURCE: 'dead_source',
	NO_RESOLVER: 'no_resolver',
	INVALID_EXTERNAL: 'invalid_external',
} as const;

export type AuditFindingKind = (typeof AUDIT_FINDING_KINDS)[keyof typeof AUDIT_FINDING_KINDS];

export interface AuditFinding {
	kind: AuditFindingKind;
	citationId: string;
	sourceType: CitationSourceType;
	sourceId: string;
	targetType: CitationTargetType;
	targetId: string;
	/** Corpus the target maps to, if known. Null for knowledge / external. */
	corpus: string | null;
	/** One-line human description (used by the CLI report). */
	detail: string;
}

export interface CorpusCoverage {
	/** Corpus name (`regs`, `ac`, etc.) or `<knowledge>` / `<external>`. */
	corpus: string;
	/** Number of citations targeting this corpus. */
	total: number;
	/** Of those, how many had no registered resolver. */
	missingResolver: number;
	/** Of those, how many pointed at a dead target row. */
	deadTargets: number;
}

export interface TargetTypeTally {
	targetType: CitationTargetType;
	total: number;
}

export interface AuditReport {
	/** Total rows scanned. */
	totalCitations: number;
	/** Findings, one per failing row. Multiple kinds may fire per citation. */
	findings: readonly AuditFinding[];
	/** Per-corpus rollup; one row per distinct corpus seen in target rows. */
	corpusCoverage: readonly CorpusCoverage[];
	/** Per-target-type rollup. */
	targetTypeTallies: readonly TargetTypeTally[];
	/**
	 * Corpora that appear as a citation target but have no resolver registered
	 * in the registry. Distinct from per-corpus coverage in that the latter
	 * counts citations; this is a simple set of corpus names for the headline.
	 */
	corporaMissingResolvers: readonly string[];
	/** ISO timestamp when the audit ran. */
	generatedAt: string;
}

/**
 * Run the full stage-5 audit. Reads every citation row, joins against the
 * relevant target tables to detect dead targets, joins against the source
 * tables to detect dead sources, and consults the resolver registry to
 * detect coverage gaps.
 */
export async function auditCitations(db: Db = defaultDb): Promise<AuditReport> {
	const citations = await db.select().from(contentCitation);
	const totalCitations = citations.length;

	if (totalCitations === 0) {
		return {
			totalCitations: 0,
			findings: [],
			corpusCoverage: [],
			targetTypeTallies: [],
			corporaMissingResolvers: [],
			generatedAt: new Date().toISOString(),
		};
	}

	const liveSources = await loadLiveSourceIds(citations, db);
	const targetEnrichment = await loadTargetEnrichment(citations, db);

	const findings: AuditFinding[] = [];
	const corpusBuckets = new Map<string, CorpusCoverage>();
	const targetTypeBuckets = new Map<CitationTargetType, number>();
	const registeredCorpora = new Set<string>(ENUMERATED_CORPORA);
	const missingResolverCorpora = new Set<string>();

	for (const c of citations) {
		// Source-existence check.
		if (!sourceExists(c, liveSources)) {
			findings.push({
				kind: AUDIT_FINDING_KINDS.DEAD_SOURCE,
				citationId: c.id,
				sourceType: c.sourceType as CitationSourceType,
				sourceId: c.sourceId,
				targetType: c.targetType as CitationTargetType,
				targetId: c.targetId,
				corpus: null,
				detail: `${c.sourceType}:${c.sourceId} no longer exists`,
			});
		}

		const targetType = c.targetType as CitationTargetType;
		targetTypeBuckets.set(targetType, (targetTypeBuckets.get(targetType) ?? 0) + 1);

		const targetInfo = targetEnrichment.lookup(c);
		const corpus = targetInfo.corpus;
		const corpusKey = corpus ?? labelForOrphanTarget(targetType);

		const bucket = corpusBuckets.get(corpusKey) ?? {
			corpus: corpusKey,
			total: 0,
			missingResolver: 0,
			deadTargets: 0,
		};
		bucket.total += 1;

		// Target-existence check.
		if (!targetInfo.exists) {
			bucket.deadTargets += 1;
			findings.push({
				kind:
					targetType === CITATION_TARGET_TYPES.EXTERNAL_REF
						? AUDIT_FINDING_KINDS.INVALID_EXTERNAL
						: AUDIT_FINDING_KINDS.DEAD_TARGET,
				citationId: c.id,
				sourceType: c.sourceType as CitationSourceType,
				sourceId: c.sourceId,
				targetType,
				targetId: c.targetId,
				corpus,
				detail:
					targetType === CITATION_TARGET_TYPES.EXTERNAL_REF
						? `external target_id ${truncate(c.targetId, 60)} is not a valid http(s) URL`
						: `${targetType}:${c.targetId} no longer exists in its target table`,
			});
		}

		// Resolver-coverage check (regulation / AC only). External refs and
		// knowledge nodes have no resolver by construction; skip them.
		if (corpus !== null && !registeredCorpora.has(corpus)) {
			bucket.missingResolver += 1;
			missingResolverCorpora.add(corpus);
			findings.push({
				kind: AUDIT_FINDING_KINDS.NO_RESOLVER,
				citationId: c.id,
				sourceType: c.sourceType as CitationSourceType,
				sourceId: c.sourceId,
				targetType,
				targetId: c.targetId,
				corpus,
				detail: `corpus "${corpus}" has no registered resolver -- citation cannot deep-link`,
			});
		} else if (corpus !== null && getCorpusResolver(corpus) === null) {
			// Registered in ENUMERATED_CORPORA via bootstrap but no real resolver
			// instance returned -- defensive belt + braces; should be impossible
			// in practice, since bootstrap always installs at least a no-op.
			bucket.missingResolver += 1;
			missingResolverCorpora.add(corpus);
			findings.push({
				kind: AUDIT_FINDING_KINDS.NO_RESOLVER,
				citationId: c.id,
				sourceType: c.sourceType as CitationSourceType,
				sourceId: c.sourceId,
				targetType,
				targetId: c.targetId,
				corpus,
				detail: `corpus "${corpus}" is enumerated but getCorpusResolver returned null`,
			});
		}

		corpusBuckets.set(corpusKey, bucket);
	}

	const corpusCoverage = Array.from(corpusBuckets.values()).sort((a, b) => b.total - a.total);
	const targetTypeTallies = Array.from(targetTypeBuckets.entries())
		.map(([targetType, total]) => ({ targetType, total }))
		.sort((a, b) => b.total - a.total);

	return {
		totalCitations,
		findings,
		corpusCoverage,
		targetTypeTallies,
		corporaMissingResolvers: Array.from(missingResolverCorpora).sort(),
		generatedAt: new Date().toISOString(),
	};
}

interface LiveSourceIds {
	cards: Set<string>;
	scenarios: Set<string>;
	nodes: Set<string>;
}

/**
 * Batch-load the set of live source ids referenced by `citations`. One
 * round-trip per source-table; the BC's create path gates on ownership,
 * so a citation referring to a row that no longer exists is the audit
 * signal for "source got hard-deleted out from under us."
 */
async function loadLiveSourceIds(citations: readonly ContentCitationRow[], db: Db): Promise<LiveSourceIds> {
	const cardIds = new Set<string>();
	const scenarioIds = new Set<string>();
	const nodeIds = new Set<string>();
	for (const c of citations) {
		if (c.sourceType === CITATION_SOURCE_TYPES.CARD) cardIds.add(c.sourceId);
		else if (c.sourceType === CITATION_SOURCE_TYPES.REP || c.sourceType === CITATION_SOURCE_TYPES.SCENARIO)
			scenarioIds.add(c.sourceId);
		else if (c.sourceType === CITATION_SOURCE_TYPES.NODE) nodeIds.add(c.sourceId);
	}

	const [cards, scenarios, nodes] = await Promise.all([
		cardIds.size > 0
			? db
					.select({ id: card.id })
					.from(card)
					.where(inArray(card.id, Array.from(cardIds)))
			: Promise.resolve([] as { id: string }[]),
		scenarioIds.size > 0
			? db
					.select({ id: scenario.id })
					.from(scenario)
					.where(inArray(scenario.id, Array.from(scenarioIds)))
			: Promise.resolve([] as { id: string }[]),
		nodeIds.size > 0
			? db
					.select({ id: knowledgeNode.id })
					.from(knowledgeNode)
					.where(inArray(knowledgeNode.id, Array.from(nodeIds)))
			: Promise.resolve([] as { id: string }[]),
	]);

	return {
		cards: new Set(cards.map((r) => r.id)),
		scenarios: new Set(scenarios.map((r) => r.id)),
		nodes: new Set(nodes.map((r) => r.id)),
	};
}

function sourceExists(c: ContentCitationRow, live: LiveSourceIds): boolean {
	switch (c.sourceType) {
		case CITATION_SOURCE_TYPES.CARD:
			return live.cards.has(c.sourceId);
		case CITATION_SOURCE_TYPES.REP:
		case CITATION_SOURCE_TYPES.SCENARIO:
			return live.scenarios.has(c.sourceId);
		case CITATION_SOURCE_TYPES.NODE:
			return live.nodes.has(c.sourceId);
		default:
			return true;
	}
}

interface TargetInfoLookup {
	lookup(citation: ContentCitationRow): { exists: boolean; corpus: string | null };
}

/**
 * Batch-load existence + corpus for every distinct citation target.
 *
 * Regulation / AC targets resolve to `hangar.reference`; we read the row and
 * pull `tags ->> 'sourceType'` to compute the corpus. Knowledge targets read
 * `study.knowledge_node`. External refs resolve in-process (URL parse).
 */
async function loadTargetEnrichment(citations: readonly ContentCitationRow[], db: Db): Promise<TargetInfoLookup> {
	const refIds = new Set<string>();
	const nodeIds = new Set<string>();
	for (const c of citations) {
		if (c.targetType === CITATION_TARGET_TYPES.REGULATION_NODE || c.targetType === CITATION_TARGET_TYPES.AC_REFERENCE) {
			refIds.add(c.targetId);
		} else if (c.targetType === CITATION_TARGET_TYPES.KNOWLEDGE_NODE) {
			nodeIds.add(c.targetId);
		}
	}

	const [refs, nodes] = await Promise.all([
		refIds.size > 0
			? db
					.select({
						id: hangarReference.id,
						sourceType: sql<string | null>`${hangarReference.tags} ->> 'sourceType'`,
					})
					.from(hangarReference)
					.where(inArray(hangarReference.id, Array.from(refIds)))
			: Promise.resolve([] as { id: string; sourceType: string | null }[]),
		nodeIds.size > 0
			? db
					.select({ id: knowledgeNode.id })
					.from(knowledgeNode)
					.where(inArray(knowledgeNode.id, Array.from(nodeIds)))
			: Promise.resolve([] as { id: string }[]),
	]);

	const refSourceTypeById = new Map(refs.map((r) => [r.id, r.sourceType]));
	const liveNodeIds = new Set(nodes.map((r) => r.id));

	return {
		lookup(c: ContentCitationRow): { exists: boolean; corpus: string | null } {
			const targetType = c.targetType as CitationTargetType;
			if (targetType === CITATION_TARGET_TYPES.REGULATION_NODE || targetType === CITATION_TARGET_TYPES.AC_REFERENCE) {
				const sourceType = refSourceTypeById.get(c.targetId);
				const exists = refSourceTypeById.has(c.targetId);
				return { exists, corpus: corpusForCitationTarget(targetType, sourceType ?? null) };
			}
			if (targetType === CITATION_TARGET_TYPES.KNOWLEDGE_NODE) {
				return { exists: liveNodeIds.has(c.targetId), corpus: null };
			}
			// external_ref: no DB row to check; validate the URL inline. Mirrors
			// the BC's verifyTargetExists logic so audit + write-time agree.
			if (c.targetId.length === 0) return { exists: false, corpus: null };
			const [raw] = c.targetId.split(EXTERNAL_REF_TARGET_DELIMITER);
			if (!raw) return { exists: false, corpus: null };
			try {
				const u = new URL(raw);
				const ok = u.protocol === 'http:' || u.protocol === 'https:';
				return { exists: ok, corpus: null };
			} catch {
				return { exists: false, corpus: null };
			}
		},
	};
}

function labelForOrphanTarget(targetType: CitationTargetType): string {
	if (targetType === CITATION_TARGET_TYPES.KNOWLEDGE_NODE) return '<knowledge>';
	if (targetType === CITATION_TARGET_TYPES.EXTERNAL_REF) return '<external>';
	return '<unknown-corpus>';
}

function truncate(s: string, max: number): string {
	if (s.length <= max) return s;
	return `${s.slice(0, max - 1)}…`;
}
