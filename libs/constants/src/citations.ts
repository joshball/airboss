/**
 * Content-citation vocabulary.
 *
 * `content_citations` is a polymorphic table: any content surface (card, rep,
 * scenario, knowledge node) can cite any reference (regulation node, AC,
 * external URL, knowledge node). The enums here are the allow-list that the
 * application layer validates before insert (see the `@ab/bc-citations`
 * guards). DB-level CHECK constraints mirror the same values so a direct SQL
 * path can't drift.
 */

export const CITATION_SOURCE_TYPES = {
	CARD: 'card',
	REP: 'rep',
	SCENARIO: 'scenario',
	NODE: 'node',
} as const;

export type CitationSourceType = (typeof CITATION_SOURCE_TYPES)[keyof typeof CITATION_SOURCE_TYPES];

export const CITATION_SOURCE_VALUES: readonly CitationSourceType[] = Object.values(CITATION_SOURCE_TYPES);

export const CITATION_SOURCE_LABELS: Record<CitationSourceType, string> = {
	[CITATION_SOURCE_TYPES.CARD]: 'Card',
	[CITATION_SOURCE_TYPES.REP]: 'Rep',
	[CITATION_SOURCE_TYPES.SCENARIO]: 'Scenario',
	[CITATION_SOURCE_TYPES.NODE]: 'Knowledge node',
};

export const CITATION_TARGET_TYPES = {
	REGULATION_NODE: 'regulation_node',
	AC_REFERENCE: 'ac_reference',
	EXTERNAL_REF: 'external_ref',
	KNOWLEDGE_NODE: 'knowledge_node',
} as const;

export type CitationTargetType = (typeof CITATION_TARGET_TYPES)[keyof typeof CITATION_TARGET_TYPES];

export const CITATION_TARGET_VALUES: readonly CitationTargetType[] = Object.values(CITATION_TARGET_TYPES);

export const CITATION_TARGET_LABELS: Record<CitationTargetType, string> = {
	[CITATION_TARGET_TYPES.REGULATION_NODE]: 'Regulation',
	[CITATION_TARGET_TYPES.AC_REFERENCE]: 'Advisory circular',
	[CITATION_TARGET_TYPES.EXTERNAL_REF]: 'External reference',
	[CITATION_TARGET_TYPES.KNOWLEDGE_NODE]: 'Knowledge node',
};

/** Maximum character count for the optional citation-context note, after trim. */
export const CITATION_CONTEXT_MAX_LENGTH = 500;

/**
 * Encoding delimiter for external_ref `target_id` rows. The picker writes
 * `<url>|<title>` so the read path can split out the display title without an
 * extra table or schema column. Any pipes in the title round-trip via the
 * splitter taking the first segment as the URL and rejoining the rest. Both
 * the picker (write) and `resolveCitationTargets` (read) reference this
 * constant so a future schema change has one source of truth.
 */
export const EXTERNAL_REF_TARGET_DELIMITER = '|';
