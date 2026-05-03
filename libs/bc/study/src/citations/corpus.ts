/**
 * Citation -> corpus mapping for stage-5 cross-link resolution.
 *
 * Citations live in `study.content_citations` as polymorphic edges
 * (source_type/id, target_type/id). The `target_type` is one of four
 * categories ('regulation_node', 'ac_reference', 'knowledge_node',
 * 'external_ref'); none of those is the corpus a resolver is registered
 * under (`regs`, `aim`, `ac`, `acs`, `handbooks`, ...).
 *
 * For regulation/AC targets, the corpus comes from the joined
 * `hangar.reference.tags.sourceType` value. This module owns that
 * sourceType -> corpus mapping in one place, so the audit job, the
 * citation-render dispatch, and any future cross-link surface read the
 * same answer.
 *
 * Knowledge nodes and external refs have no resolver -- they are
 * self-contained content categories, not corpus-backed references. The
 * helpers below return `null` for those, and callers should treat that as
 * "no resolver expected, no audit warning."
 */

import {
	CITATION_TARGET_TYPES,
	type CitationTargetType,
	REFERENCE_SOURCE_TYPES,
	type ReferenceSourceType,
} from '@ab/constants';

/**
 * Map a `hangar.reference.tags.sourceType` value to the corpus string the
 * resolver registry uses. The bootstrap corpora list in
 * `libs/sources/src/registry/corpus-resolver.ts` is the source of truth for
 * what corpus names are valid; this map only translates between the two
 * naming surfaces.
 *
 * Handbook-family sourceTypes (`phak`, `afh`, `ifh`) all share the
 * `handbooks` resolver; `poh` lives under `pohs`. Authored / derived /
 * sectional rows have no source corpus and return null.
 */
const SOURCE_TYPE_TO_CORPUS: Record<ReferenceSourceType, string | null> = {
	[REFERENCE_SOURCE_TYPES.CFR]: 'regs',
	[REFERENCE_SOURCE_TYPES.AIM]: 'aim',
	[REFERENCE_SOURCE_TYPES.PCG]: 'aim',
	[REFERENCE_SOURCE_TYPES.AC]: 'ac',
	[REFERENCE_SOURCE_TYPES.ACS]: 'acs',
	[REFERENCE_SOURCE_TYPES.PHAK]: 'handbooks',
	[REFERENCE_SOURCE_TYPES.AFH]: 'handbooks',
	[REFERENCE_SOURCE_TYPES.IFH]: 'handbooks',
	[REFERENCE_SOURCE_TYPES.POH]: 'pohs',
	[REFERENCE_SOURCE_TYPES.NTSB]: 'ntsb',
	[REFERENCE_SOURCE_TYPES.GAJSC]: null,
	[REFERENCE_SOURCE_TYPES.AOPA]: null,
	[REFERENCE_SOURCE_TYPES.FAA_SAFETY]: null,
	[REFERENCE_SOURCE_TYPES.SOP]: null,
	[REFERENCE_SOURCE_TYPES.AUTHORED]: null,
	[REFERENCE_SOURCE_TYPES.DERIVED]: null,
	[REFERENCE_SOURCE_TYPES.SECTIONAL]: 'sectionals',
};

/**
 * Resolve a `tags.sourceType` value to its corpus. Returns null when the
 * sourceType is not corpus-backed (authored / derived / community feeds)
 * OR when the input is missing/unrecognised. Audit callers treat null as
 * "no resolver dispatch expected"; render callers fall back to a non-deep
 * link.
 */
export function corpusForSourceType(sourceType: string | null | undefined): string | null {
	if (sourceType === null || sourceType === undefined) return null;
	const known = SOURCE_TYPE_TO_CORPUS as Record<string, string | null | undefined>;
	return known[sourceType] ?? null;
}

/**
 * Resolve a citation `targetType` + `tags.sourceType` pair to the corpus
 * the resolver registry expects. Knowledge nodes and external refs have no
 * corpus by construction; for regulation / AC targets we delegate to
 * `corpusForSourceType`.
 */
export function corpusForCitationTarget(
	targetType: CitationTargetType,
	sourceType: string | null | undefined,
): string | null {
	switch (targetType) {
		case CITATION_TARGET_TYPES.REGULATION_NODE:
		case CITATION_TARGET_TYPES.AC_REFERENCE:
			return corpusForSourceType(sourceType);
		case CITATION_TARGET_TYPES.KNOWLEDGE_NODE:
		case CITATION_TARGET_TYPES.EXTERNAL_REF:
			return null;
		default: {
			const exhaustive: never = targetType;
			void exhaustive;
			return null;
		}
	}
}
