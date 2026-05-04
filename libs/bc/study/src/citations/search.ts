/**
 * Citation picker search helpers.
 *
 * The picker UI calls these to populate its per-target-type result lists.
 * Each helper returns a small `{ id, label, detail }` shape -- the picker
 * does not need full row data, just enough to render a row and round-trip
 * the id on submit.
 *
 * Stage-5 (WP `stage5-citation-deeplink`): the per-corpus searches that
 * targeted `hangar.reference` were retired in favor of one polymorphic
 * `searchReferenceSections` against `study.reference_section` (the actual
 * structured-content table -- `hangar.reference` is the glossary mirror,
 * empty in dev). One search box for every corpus; the result row carries
 * a corpus badge built from `reference.kind`.
 */

import { MAX_SEARCH_LIMIT, REFERENCE_KIND_LABELS, type ReferenceKind } from '@ab/constants';
import { escapeLikePattern } from '@ab/db';
import { db as defaultDb } from '@ab/db/connection';
import { eq, ilike, or, sql } from 'drizzle-orm';
import type { PgDatabase, PgQueryResultHKT } from 'drizzle-orm/pg-core';
import { knowledgeNode, reference, referenceSection } from '../schema';

type Db = PgDatabase<PgQueryResultHKT, Record<string, never>>;

export interface SectionSearchResult {
	/** `study.reference_section.id`. The polymorphic citation `target_id`. */
	id: string;
	/** Display label, e.g. "14 CFR §91.103 -- Preflight action". */
	label: string;
	/** Corpus badge, e.g. "CFR" / "Handbook" / "AIM". */
	detail: string;
	/** Canonical `airboss-ref:` URI. The picker round-trips it so the chip
	 *  render layer doesn't need a second fetch to compute the deep link. */
	airbossRef: string;
}

export interface KnowledgeNodeSearchResult {
	id: string;
	label: string;
	detail: string;
}

const DEFAULT_LIMIT = 25;

function buildTermPattern(query: string): string {
	return `%${escapeLikePattern(query.trim())}%`;
}

/**
 * Clamp caller-supplied search limits into a sane range. Keeps a buggy or
 * malicious caller from requesting unbounded result sets, and ensures the
 * BC's resource use stays bounded regardless of route-side validation.
 */
function clampLimit(limit: number): number {
	if (!Number.isFinite(limit)) return DEFAULT_LIMIT;
	return Math.max(1, Math.min(MAX_SEARCH_LIMIT, Math.floor(limit)));
}

/**
 * Search every corpus's `study.reference_section` rows by code, section
 * title, the parent reference's title, or the parent reference's
 * `documentSlug`. Returns up to `limit` rows ordered by reference's
 * documentSlug then section code -- corpus / publication clusters first,
 * then in-document position.
 *
 * Empty query returns the first N rows (ordered the same way) so the picker
 * can show "browse mode" until the user types.
 */
export async function searchReferenceSections(
	query: string,
	limit: number = DEFAULT_LIMIT,
	db: Db = defaultDb,
): Promise<SectionSearchResult[]> {
	const pattern = buildTermPattern(query);
	const trimmed = query.trim();
	const rows = await db
		.select({
			id: referenceSection.id,
			code: referenceSection.code,
			sectionTitle: referenceSection.title,
			airbossRef: referenceSection.airbossRef,
			referenceTitle: reference.title,
			referenceKind: reference.kind,
			documentSlug: reference.documentSlug,
		})
		.from(referenceSection)
		.innerJoin(reference, eq(reference.id, referenceSection.referenceId))
		.where(
			trimmed.length === 0
				? sql`true`
				: or(
						ilike(referenceSection.code, pattern),
						ilike(referenceSection.title, pattern),
						ilike(reference.title, pattern),
						ilike(reference.documentSlug, pattern),
					),
		)
		.orderBy(reference.documentSlug, referenceSection.code)
		.limit(clampLimit(limit));

	return rows.map((r) => ({
		id: r.id,
		label: formatSectionLabel({
			referenceTitle: r.referenceTitle,
			referenceKind: r.referenceKind as ReferenceKind,
			code: r.code,
			sectionTitle: r.sectionTitle,
		}),
		detail: REFERENCE_KIND_LABELS[r.referenceKind as ReferenceKind] ?? r.referenceKind,
		airbossRef: r.airbossRef,
	}));
}

/**
 * Compose the display label for a section search result. Per-kind shape is
 * inlined here so the picker's row render is purely presentational; the
 * label is the citable form a CFI would speak ("14 CFR §91.103 --
 * Preflight action") followed by the section title in subdued text.
 *
 * Exported for unit-test reuse and for the chip-render layer (which
 * computes the same label off `CitationWithTarget.label`).
 */
export function formatSectionLabel(input: {
	referenceTitle: string;
	referenceKind: ReferenceKind;
	code: string;
	sectionTitle: string;
}): string {
	// `referenceTitle` is already verbose ("Pilot's Handbook of Aeronautical
	// Knowledge"); for chips we want the short form. Use the kind-label
	// instead and let the user reach the full title via the detail badge.
	const corpusLabel = REFERENCE_KIND_LABELS[input.referenceKind] ?? input.referenceKind;
	const codeBit = input.code === '1' || input.code === 'publication' ? '' : ` ${input.code}`;
	const head = `${corpusLabel}${codeBit}`.trim();
	return input.sectionTitle && input.sectionTitle !== input.referenceTitle ? `${head} -- ${input.sectionTitle}` : head;
}

/**
 * Search knowledge-graph nodes by id (slug) or title. The knowledge graph is
 * small enough (tens of nodes) that a simple ilike over title is adequate.
 */
export async function searchKnowledgeNodes(
	query: string,
	limit: number = DEFAULT_LIMIT,
	db: Db = defaultDb,
): Promise<KnowledgeNodeSearchResult[]> {
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
		.limit(clampLimit(limit));
	return rows.map((r) => ({
		id: r.id,
		label: r.title,
		detail: r.domain,
	}));
}
