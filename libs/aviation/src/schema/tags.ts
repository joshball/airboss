/**
 * Five-axis reference-tag taxonomy.
 *
 * Required axes gate `bun run check`; conditional and optional axes carry
 * looser rules the validator still enforces (bounds, no duplicates, enum
 * membership). The closed enums live in `@ab/constants/reference-tags`; this
 * module exports the TypeScript view the registry + validator + UI consume.
 *
 * Rationale for each axis is in the tagging research doc:
 * `docs/work/todos/20260422-tagging-architecture-research.md#axes`.
 */

import {
	AVIATION_TOPIC_VALUES,
	type AviationTopic,
	CERT_APPLICABILITY_VALUES,
	type CertApplicability,
	FLIGHT_RULES_VALUES,
	type FlightRules,
	KNOWLEDGE_KIND_VALUES,
	type KnowledgeKind,
	REFERENCE_PHASE_OF_FLIGHT_VALUES,
	type ReferencePhaseOfFlight,
	type ReferenceSourceType,
	SOURCE_TYPE_VALUES,
} from '@ab/constants';

/** The full tag bag on a reference. */
export interface ReferenceTags {
	/** Required. Single-valued. What kind of source this reference cites. */
	sourceType: ReferenceSourceType;

	/**
	 * Required. Multi-valued (1-4). Primary subject-matter axis. Ordered --
	 * `aviationTopic[0]` is the "primary" topic used for grouping views when
	 * the user hasn't explicitly filtered.
	 */
	aviationTopic: readonly AviationTopic[];

	/** Required. Single-valued. Which rule set the content governs. */
	flightRules: FlightRules;

	/** Required. Single-valued. What knowledge artifact this is. */
	knowledgeKind: KnowledgeKind;

	/**
	 * Conditionally required (0-3). Required with at least one entry when
	 * `sourceType` is in `PHASE_REQUIRING_SOURCE_TYPES` or `knowledgeKind ==
	 * 'procedure'`. Multi-valued otherwise.
	 */
	phaseOfFlight?: readonly ReferencePhaseOfFlight[];

	/** Optional. Multi-valued. Which certificate(s) the reference is aimed at. */
	certApplicability?: readonly CertApplicability[];

	/**
	 * Optional. Freeform synonyms, misspellings, alternate phrasings. Each
	 * entry non-empty and <= REFERENCE_KEYWORD_MAX_LENGTH chars; cap on count
	 * via REFERENCE_KEYWORD_MAX_COUNT.
	 */
	keywords?: readonly string[];
}

// -------- type guards --------

export function isSourceType(value: unknown): value is ReferenceSourceType {
	return typeof value === 'string' && (SOURCE_TYPE_VALUES as readonly string[]).includes(value);
}

export function isAviationTopic(value: unknown): value is AviationTopic {
	return typeof value === 'string' && (AVIATION_TOPIC_VALUES as readonly string[]).includes(value);
}

export function isFlightRules(value: unknown): value is FlightRules {
	return typeof value === 'string' && (FLIGHT_RULES_VALUES as readonly string[]).includes(value);
}

export function isKnowledgeKind(value: unknown): value is KnowledgeKind {
	return typeof value === 'string' && (KNOWLEDGE_KIND_VALUES as readonly string[]).includes(value);
}

export function isPhaseOfFlight(value: unknown): value is ReferencePhaseOfFlight {
	return typeof value === 'string' && (REFERENCE_PHASE_OF_FLIGHT_VALUES as readonly string[]).includes(value);
}

export function isCertApplicability(value: unknown): value is CertApplicability {
	return typeof value === 'string' && (CERT_APPLICABILITY_VALUES as readonly string[]).includes(value);
}
