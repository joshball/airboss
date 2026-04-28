/**
 * Content-citation BC functions.
 *
 * Owns the polymorphic citation fabric. Callers from any source editor
 * (card / rep / scenario / node) use the same five functions to create,
 * delete, and read citations in both directions.
 *
 * Invariants enforced here (not at the DB level, because the polymorphic
 * target has no per-type FK):
 *   - `sourceType` and `targetType` must be members of the constants.
 *   - The source row must exist and be owned by `userId` (authoring gate).
 *   - The target row must exist.
 *   - Context is trimmed and capped at CITATION_CONTEXT_MAX_LENGTH chars.
 *   - Uniqueness of (sourceType, sourceId, targetType, targetId) is enforced
 *     by the DB index; duplicate inserts surface as DuplicateCitationError.
 */

import { hangarReference } from '@ab/bc-hangar/schema';
import {
	CITATION_CONTEXT_MAX_LENGTH,
	CITATION_SOURCE_LABELS,
	CITATION_SOURCE_TYPES,
	CITATION_SOURCE_VALUES,
	CITATION_TARGET_LABELS,
	CITATION_TARGET_TYPES,
	CITATION_TARGET_VALUES,
	type CitationSourceType,
	type CitationTargetType,
	EXTERNAL_REF_TARGET_DELIMITER,
} from '@ab/constants';
import { db as defaultDb } from '@ab/db';
import { generateContentCitationId } from '@ab/utils';
import { and, eq, inArray } from 'drizzle-orm';
import type { PgDatabase, PgQueryResultHKT } from 'drizzle-orm/pg-core';
import { card, knowledgeNode, scenario } from '../schema';
import { type ContentCitationRow, contentCitation } from './schema';

type Db = PgDatabase<PgQueryResultHKT, Record<string, never>>;

export class CitationValidationError extends Error {
	constructor(message: string) {
		super(message);
		this.name = 'CitationValidationError';
	}
}

export class CitationSourceNotFoundError extends Error {
	constructor(
		public readonly sourceType: CitationSourceType,
		public readonly sourceId: string,
	) {
		super(`Citation source ${sourceType}:${sourceId} not found or not owned by caller`);
		this.name = 'CitationSourceNotFoundError';
	}
}

export class CitationTargetNotFoundError extends Error {
	constructor(
		public readonly targetType: CitationTargetType,
		public readonly targetId: string,
	) {
		super(`Citation target ${targetType}:${targetId} not found`);
		this.name = 'CitationTargetNotFoundError';
	}
}

export class DuplicateCitationError extends Error {
	constructor(
		public readonly sourceType: CitationSourceType,
		public readonly sourceId: string,
		public readonly targetType: CitationTargetType,
		public readonly targetId: string,
	) {
		super(`Citation already exists from ${sourceType}:${sourceId} to ${targetType}:${targetId}`);
		this.name = 'DuplicateCitationError';
	}
}

export class CitationNotFoundError extends Error {
	constructor(public readonly citationId: string) {
		super(`Citation ${citationId} not found`);
		this.name = 'CitationNotFoundError';
	}
}

/**
 * Enriched citation: pairs a raw row with display-ready target data
 * (label, canonical href/title) resolved from the target table. Used by the
 * inline citation chips on card/scenario detail pages.
 */
export interface CitationWithTarget {
	citation: ContentCitationRow;
	target: {
		type: CitationTargetType;
		id: string;
		/** Rendered label (e.g. "14 CFR 91.155"). */
		label: string;
		/** Optional longer description / title. */
		detail?: string;
		/** Optional external URL (external_ref only). */
		href?: string;
	};
}

/**
 * Source-side enrichment used by the "Cited by" panel: pairs a raw citation
 * with a display label for the source row (the card front, scenario title,
 * knowledge-node title) and a typed flag the caller maps to a route.
 */
export interface CitationWithSource {
	citation: ContentCitationRow;
	source: {
		type: CitationSourceType;
		id: string;
		/** Rendered label (card front excerpt, scenario title, node title). */
		label: string;
		/** Optional secondary line (e.g. "Card", "Scenario"). */
		detail?: string;
		/** Whether the source row still exists. False rows render as missing. */
		exists: boolean;
	};
}

export interface CreateCitationInput {
	sourceType: CitationSourceType;
	sourceId: string;
	targetType: CitationTargetType;
	targetId: string;
	citationContext?: string | null;
	userId: string;
}

/**
 * Soft-FK source lookup. Returns true when the source row exists and is
 * owned (or authored, for nodes) by `userId`. Throws on unknown source type.
 */
async function verifySourceOwnership(
	sourceType: CitationSourceType,
	sourceId: string,
	userId: string,
	db: Db,
): Promise<boolean> {
	switch (sourceType) {
		case CITATION_SOURCE_TYPES.CARD: {
			const rows = await db
				.select({ id: card.id })
				.from(card)
				.where(and(eq(card.id, sourceId), eq(card.userId, userId)))
				.limit(1);
			return rows.length > 0;
		}
		case CITATION_SOURCE_TYPES.REP:
		case CITATION_SOURCE_TYPES.SCENARIO: {
			// `rep` and `scenario` point at the same `study.scenario` table: reps
			// are scenarios surfaced in the reps flow. Keeping two source-type
			// labels lets us differentiate call sites in read paths without a
			// schema change when reps grow their own table.
			const rows = await db
				.select({ id: scenario.id })
				.from(scenario)
				.where(and(eq(scenario.id, sourceId), eq(scenario.userId, userId)))
				.limit(1);
			return rows.length > 0;
		}
		case CITATION_SOURCE_TYPES.NODE: {
			// Knowledge nodes are shared content. Authorship is author_id, which
			// is nullable on seed-built rows. For v1 we allow any authenticated
			// user to cite from a node they are viewing (authoring is via the
			// hangar/editor, not here). A future permissions gate lands in the
			// node-editor PR when per-node ACLs arrive.
			const rows = await db
				.select({ id: knowledgeNode.id })
				.from(knowledgeNode)
				.where(eq(knowledgeNode.id, sourceId))
				.limit(1);
			return rows.length > 0;
		}
		default: {
			const exhaustive: never = sourceType;
			throw new CitationValidationError(`Unknown source type: ${String(exhaustive)}`);
		}
	}
}

/**
 * Soft-FK target lookup. Regulation nodes, advisory circulars, and external
 * refs have per-type existence rules; knowledge nodes point at study.knowledge_node.
 */
async function verifyTargetExists(targetType: CitationTargetType, targetId: string, db: Db): Promise<boolean> {
	switch (targetType) {
		case CITATION_TARGET_TYPES.REGULATION_NODE:
		case CITATION_TARGET_TYPES.AC_REFERENCE: {
			// Both regulation nodes and AC references live in hangar.reference.
			// The source_type tag inside `hangar_reference.tags` distinguishes
			// the two at read time; for the ownership check here, the row
			// existing is enough.
			const rows = await db
				.select({ id: hangarReference.id })
				.from(hangarReference)
				.where(eq(hangarReference.id, targetId))
				.limit(1);
			return rows.length > 0;
		}
		case CITATION_TARGET_TYPES.KNOWLEDGE_NODE: {
			const rows = await db
				.select({ id: knowledgeNode.id })
				.from(knowledgeNode)
				.where(eq(knowledgeNode.id, targetId))
				.limit(1);
			return rows.length > 0;
		}
		case CITATION_TARGET_TYPES.EXTERNAL_REF: {
			// External refs are user-supplied URLs. We accept whatever target id
			// the caller provides as long as it parses as a URL. The picker
			// stores `<url>|<title>` in target_id (delimiter from
			// EXTERNAL_REF_TARGET_DELIMITER) so the read path can split it
			// without an extra table. Validation below; empty string is invalid.
			if (targetId.length === 0) return false;
			const [raw] = targetId.split(EXTERNAL_REF_TARGET_DELIMITER);
			if (!raw) return false;
			try {
				const u = new URL(raw);
				return u.protocol === 'http:' || u.protocol === 'https:';
			} catch {
				return false;
			}
		}
		default: {
			const exhaustive: never = targetType;
			throw new CitationValidationError(`Unknown target type: ${String(exhaustive)}`);
		}
	}
}

function normalizeContext(raw: string | null | undefined): string | null {
	if (raw === null || raw === undefined) return null;
	const trimmed = raw.trim();
	if (trimmed.length === 0) return null;
	if (trimmed.length > CITATION_CONTEXT_MAX_LENGTH) {
		throw new CitationValidationError(
			`Citation context exceeds ${CITATION_CONTEXT_MAX_LENGTH} characters (got ${trimmed.length}).`,
		);
	}
	return trimmed;
}

/**
 * Create a citation from `source` to `target`. Validates both endpoints,
 * normalises the context note, and returns the inserted row. Raises typed
 * errors the route layer can surface without a 500.
 */
export async function createCitation(input: CreateCitationInput, db: Db = defaultDb): Promise<ContentCitationRow> {
	if (!(CITATION_SOURCE_VALUES as readonly string[]).includes(input.sourceType)) {
		throw new CitationValidationError(`Invalid source type: ${input.sourceType}`);
	}
	if (!(CITATION_TARGET_VALUES as readonly string[]).includes(input.targetType)) {
		throw new CitationValidationError(`Invalid target type: ${input.targetType}`);
	}
	if (!input.sourceId || !input.targetId) {
		throw new CitationValidationError('sourceId and targetId are required');
	}

	const context = normalizeContext(input.citationContext ?? null);

	const [ownsSource, targetExists] = await Promise.all([
		verifySourceOwnership(input.sourceType, input.sourceId, input.userId, db),
		verifyTargetExists(input.targetType, input.targetId, db),
	]);
	if (!ownsSource) throw new CitationSourceNotFoundError(input.sourceType, input.sourceId);
	if (!targetExists) throw new CitationTargetNotFoundError(input.targetType, input.targetId);

	const id = generateContentCitationId();
	const now = new Date();

	try {
		const [inserted] = await db
			.insert(contentCitation)
			.values({
				id,
				sourceType: input.sourceType,
				sourceId: input.sourceId,
				targetType: input.targetType,
				targetId: input.targetId,
				citationContext: context,
				createdBy: input.userId,
				createdAt: now,
				updatedAt: now,
			})
			.returning();
		return inserted;
	} catch (err) {
		// Postgres 23505 = unique_violation. We surface it as a typed error so
		// the route layer can show "already cited" instead of a 500.
		if (err instanceof Error && 'code' in err && (err as { code?: string }).code === '23505') {
			throw new DuplicateCitationError(input.sourceType, input.sourceId, input.targetType, input.targetId);
		}
		throw err;
	}
}

/**
 * Delete a citation by id. Callers must verify the deleting user either owns
 * the citation (createdBy) or owns the source content. For v1 we require
 * `createdBy` match -- authors delete their own citations.
 */
export async function deleteCitation(id: string, userId: string, db: Db = defaultDb): Promise<void> {
	const [existing] = await db
		.select({ id: contentCitation.id, createdBy: contentCitation.createdBy })
		.from(contentCitation)
		.where(eq(contentCitation.id, id))
		.limit(1);
	if (!existing) throw new CitationNotFoundError(id);
	if (existing.createdBy !== userId) throw new CitationNotFoundError(id);
	await db.delete(contentCitation).where(eq(contentCitation.id, id));
}

/**
 * List citations authored on a source row. Stable order by createdAt so the
 * card/scenario render is deterministic.
 */
export async function getCitationsOf(
	sourceType: CitationSourceType,
	sourceId: string,
	db: Db = defaultDb,
): Promise<ContentCitationRow[]> {
	return await db
		.select()
		.from(contentCitation)
		.where(and(eq(contentCitation.sourceType, sourceType), eq(contentCitation.sourceId, sourceId)))
		.orderBy(contentCitation.createdAt);
}

/**
 * List sources that cite a reference. Used by reg-node / knowledge-node
 * detail pages for the "Cited by" panel.
 */
export async function getCitedBy(
	targetType: CitationTargetType,
	targetId: string,
	db: Db = defaultDb,
): Promise<ContentCitationRow[]> {
	return await db
		.select()
		.from(contentCitation)
		.where(and(eq(contentCitation.targetType, targetType), eq(contentCitation.targetId, targetId)))
		.orderBy(contentCitation.createdAt);
}

/**
 * Enrich raw citation rows with their target display data. Batches the
 * per-target-type reads (two queries: hangar.reference for regulation + AC,
 * study.knowledge_node for knowledge nodes) so rendering a card's citation
 * list is O(distinct-target-types), not O(citations).
 */
export async function resolveCitationTargets(
	citations: ContentCitationRow[],
	db: Db = defaultDb,
): Promise<CitationWithTarget[]> {
	if (citations.length === 0) return [];

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
					.select({ id: hangarReference.id, displayName: hangarReference.displayName })
					.from(hangarReference)
					.where(inArray(hangarReference.id, Array.from(refIds)))
			: Promise.resolve([] as { id: string; displayName: string }[]),
		nodeIds.size > 0
			? db
					.select({ id: knowledgeNode.id, title: knowledgeNode.title })
					.from(knowledgeNode)
					.where(inArray(knowledgeNode.id, Array.from(nodeIds)))
			: Promise.resolve([] as { id: string; title: string }[]),
	]);

	const refById = new Map(refs.map((r) => [r.id, r.displayName]));
	const nodeById = new Map(nodes.map((n) => [n.id, n.title]));

	return citations.map((c) => {
		const targetTypeLabel = CITATION_TARGET_LABELS[c.targetType as CitationTargetType];
		if (c.targetType === CITATION_TARGET_TYPES.REGULATION_NODE || c.targetType === CITATION_TARGET_TYPES.AC_REFERENCE) {
			const display = refById.get(c.targetId);
			return {
				citation: c,
				target: {
					type: c.targetType as CitationTargetType,
					id: c.targetId,
					label: display ?? c.targetId,
					detail: display ? targetTypeLabel : `${targetTypeLabel} (missing)`,
				},
			};
		}
		if (c.targetType === CITATION_TARGET_TYPES.KNOWLEDGE_NODE) {
			const title = nodeById.get(c.targetId);
			return {
				citation: c,
				target: {
					type: c.targetType as CitationTargetType,
					id: c.targetId,
					label: title ?? c.targetId,
					detail: title ? targetTypeLabel : `${targetTypeLabel} (missing)`,
				},
			};
		}
		// external_ref: target_id is `<url><delim><title>`. Split it back out.
		// Title may contain the delimiter; rejoin trailing segments.
		const [url, ...rest] = c.targetId.split(EXTERNAL_REF_TARGET_DELIMITER);
		const title = rest.join(EXTERNAL_REF_TARGET_DELIMITER).trim();
		return {
			citation: c,
			target: {
				type: CITATION_TARGET_TYPES.EXTERNAL_REF,
				id: c.targetId,
				label: title || url,
				detail: url,
				href: url,
			},
		};
	});
}

/** Card-front excerpt length used in source labels for the "Cited by" panel. */
const CITED_BY_CARD_LABEL_MAX = 120;

function truncateLabel(text: string, max: number): string {
	const trimmed = text.trim();
	if (trimmed.length <= max) return trimmed;
	return `${trimmed.slice(0, max - 1).trimEnd()}...`;
}

/**
 * Enrich raw citation rows with their source display data. Used by the
 * "Cited by" panel on regulation-node and knowledge-node detail pages, where
 * each row is rendered as a link back to the citing source. Like
 * `resolveCitationTargets`, this batches by source type so the read cost is
 * O(distinct-source-types), not O(citations).
 */
export async function resolveCitationSources(
	citations: ContentCitationRow[],
	db: Db = defaultDb,
): Promise<CitationWithSource[]> {
	if (citations.length === 0) return [];

	const cardIds = new Set<string>();
	const scenarioIds = new Set<string>();
	const nodeIds = new Set<string>();
	for (const c of citations) {
		if (c.sourceType === CITATION_SOURCE_TYPES.CARD) {
			cardIds.add(c.sourceId);
		} else if (c.sourceType === CITATION_SOURCE_TYPES.REP || c.sourceType === CITATION_SOURCE_TYPES.SCENARIO) {
			scenarioIds.add(c.sourceId);
		} else if (c.sourceType === CITATION_SOURCE_TYPES.NODE) {
			nodeIds.add(c.sourceId);
		}
	}

	const [cards, scenarios, nodes] = await Promise.all([
		cardIds.size > 0
			? db
					.select({ id: card.id, front: card.front })
					.from(card)
					.where(inArray(card.id, Array.from(cardIds)))
			: Promise.resolve([] as { id: string; front: string }[]),
		scenarioIds.size > 0
			? db
					.select({ id: scenario.id, title: scenario.title })
					.from(scenario)
					.where(inArray(scenario.id, Array.from(scenarioIds)))
			: Promise.resolve([] as { id: string; title: string }[]),
		nodeIds.size > 0
			? db
					.select({ id: knowledgeNode.id, title: knowledgeNode.title })
					.from(knowledgeNode)
					.where(inArray(knowledgeNode.id, Array.from(nodeIds)))
			: Promise.resolve([] as { id: string; title: string }[]),
	]);

	const cardById = new Map(cards.map((r) => [r.id, r.front]));
	const scenarioById = new Map(scenarios.map((r) => [r.id, r.title]));
	const nodeById = new Map(nodes.map((r) => [r.id, r.title]));

	return citations.map((c) => {
		const sourceTypeLabel = CITATION_SOURCE_LABELS[c.sourceType as CitationSourceType];
		if (c.sourceType === CITATION_SOURCE_TYPES.CARD) {
			const front = cardById.get(c.sourceId);
			return {
				citation: c,
				source: {
					type: c.sourceType as CitationSourceType,
					id: c.sourceId,
					label: front ? truncateLabel(front, CITED_BY_CARD_LABEL_MAX) : c.sourceId,
					detail: sourceTypeLabel,
					exists: front !== undefined,
				},
			};
		}
		if (c.sourceType === CITATION_SOURCE_TYPES.REP || c.sourceType === CITATION_SOURCE_TYPES.SCENARIO) {
			const title = scenarioById.get(c.sourceId);
			return {
				citation: c,
				source: {
					type: c.sourceType as CitationSourceType,
					id: c.sourceId,
					label: title ?? c.sourceId,
					detail: sourceTypeLabel,
					exists: title !== undefined,
				},
			};
		}
		if (c.sourceType === CITATION_SOURCE_TYPES.NODE) {
			const title = nodeById.get(c.sourceId);
			return {
				citation: c,
				source: {
					type: c.sourceType as CitationSourceType,
					id: c.sourceId,
					label: title ?? c.sourceId,
					detail: sourceTypeLabel,
					exists: title !== undefined,
				},
			};
		}
		// Unknown source types are coerced through CITATION_SOURCE_VALUES at write
		// time, so this branch is unreachable today. Keep it total to satisfy the
		// type checker if a future source type lands without a render path.
		return {
			citation: c,
			source: {
				type: c.sourceType as CitationSourceType,
				id: c.sourceId,
				label: c.sourceId,
				detail: sourceTypeLabel,
				exists: false,
			},
		};
	});
}
