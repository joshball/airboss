/**
 * Citation picker search helpers.
 *
 * The picker UI calls these to populate its per-target-type result lists.
 * Each helper returns a small `{ id, label, detail }` shape -- the picker
 * does not need full row data, just enough to render a row and round-trip
 * the id on submit.
 */

import { hangarReference } from '@ab/bc-hangar/schema';
import { knowledgeNode } from '@ab/bc-study';
import { REFERENCE_SOURCE_TYPES, SOURCE_TYPE_LABELS } from '@ab/constants';
import { db as defaultDb } from '@ab/db';
import { and, ilike, or, sql } from 'drizzle-orm';
import type { PgDatabase, PgQueryResultHKT } from 'drizzle-orm/pg-core';

type Db = PgDatabase<PgQueryResultHKT, Record<string, never>>;

export interface RegulationSearchResult {
	id: string;
	label: string;
	detail: string;
}

const DEFAULT_LIMIT = 25;

function escapeLike(input: string): string {
	return input.replace(/\\/g, '\\\\').replace(/%/g, '\\%').replace(/_/g, '\\_');
}

function buildTermPattern(query: string): string {
	return `%${escapeLike(query.trim())}%`;
}

/**
 * Search regulation references (hangar.reference with `tags.sourceType = 'cfr'`).
 * Matches on id, displayName, or aliases (jsonb `?` containment on the alias
 * array). Returns up to `limit` rows sorted by displayName.
 */
export async function searchRegulationNodes(
	query: string,
	limit: number = DEFAULT_LIMIT,
	db: Db = defaultDb,
): Promise<RegulationSearchResult[]> {
	const pattern = buildTermPattern(query);
	const sourceTypeFilter = sql`${hangarReference.tags} ->> 'sourceType' = ${REFERENCE_SOURCE_TYPES.CFR}`;
	const rows = await db
		.select({
			id: hangarReference.id,
			displayName: hangarReference.displayName,
		})
		.from(hangarReference)
		.where(
			and(
				sourceTypeFilter,
				query.trim().length === 0
					? sql`true`
					: or(ilike(hangarReference.id, pattern), ilike(hangarReference.displayName, pattern)),
			),
		)
		.orderBy(hangarReference.displayName)
		.limit(limit);
	return rows.map((r) => ({
		id: r.id,
		label: r.displayName,
		detail: SOURCE_TYPE_LABELS[REFERENCE_SOURCE_TYPES.CFR],
	}));
}

/**
 * Search advisory-circular references (hangar.reference with `tags.sourceType = 'ac'`).
 */
export async function searchAcReferences(
	query: string,
	limit: number = DEFAULT_LIMIT,
	db: Db = defaultDb,
): Promise<RegulationSearchResult[]> {
	const pattern = buildTermPattern(query);
	const sourceTypeFilter = sql`${hangarReference.tags} ->> 'sourceType' = ${REFERENCE_SOURCE_TYPES.AC}`;
	const rows = await db
		.select({
			id: hangarReference.id,
			displayName: hangarReference.displayName,
		})
		.from(hangarReference)
		.where(
			and(
				sourceTypeFilter,
				query.trim().length === 0
					? sql`true`
					: or(ilike(hangarReference.id, pattern), ilike(hangarReference.displayName, pattern)),
			),
		)
		.orderBy(hangarReference.displayName)
		.limit(limit);
	return rows.map((r) => ({
		id: r.id,
		label: r.displayName,
		detail: SOURCE_TYPE_LABELS[REFERENCE_SOURCE_TYPES.AC],
	}));
}

/**
 * Search knowledge-graph nodes by id (slug) or title. The knowledge graph is
 * small enough (tens of nodes) that a simple ilike over title is adequate.
 */
export async function searchKnowledgeNodes(
	query: string,
	limit: number = DEFAULT_LIMIT,
	db: Db = defaultDb,
): Promise<RegulationSearchResult[]> {
	const pattern = buildTermPattern(query);
	const rows = await db
		.select({
			id: knowledgeNode.id,
			title: knowledgeNode.title,
			domain: knowledgeNode.domain,
		})
		.from(knowledgeNode)
		.where(
			query.trim().length === 0 ? sql`true` : or(ilike(knowledgeNode.id, pattern), ilike(knowledgeNode.title, pattern)),
		)
		.orderBy(knowledgeNode.title)
		.limit(limit);
	return rows.map((r) => ({
		id: r.id,
		label: r.title,
		detail: r.domain,
	}));
}
