/**
 * Closed enums for the five-axis reference-tag taxonomy (plus optional
 * cert-applicability and phase-of-flight axes).
 *
 * Source of truth for axis values + rationale: the tagging research at
 * `docs/work/todos/20260422-tagging-architecture-research.md`. These constants
 * are the machine-checkable version. Authoring errors fail the `bun run check`
 * gate; see `libs/aviation/src/validation.ts`.
 *
 * Why these live in `@ab/constants` rather than inside `@ab/aviation`:
 * - Literal values belong in the shared constants package per repo rule.
 * - Help library + future extraction-pipeline code will import the same
 *   enums; reaching into `@ab/aviation` for enum values would create a
 *   cross-lib dep for constants.
 */

// -------- 1. sourceType (required, single-valued) --------

export const REFERENCE_SOURCE_TYPES = {
	CFR: 'cfr',
	AIM: 'aim',
	PCG: 'pcg',
	AC: 'ac',
	ACS: 'acs',
	PHAK: 'phak',
	AFH: 'afh',
	IFH: 'ifh',
	POH: 'poh',
	NTSB: 'ntsb',
	GAJSC: 'gajsc',
	AOPA: 'aopa',
	FAA_SAFETY: 'faa-safety',
	SOP: 'sop',
	AUTHORED: 'authored',
	DERIVED: 'derived',
} as const;

export type ReferenceSourceType = (typeof REFERENCE_SOURCE_TYPES)[keyof typeof REFERENCE_SOURCE_TYPES];

export const SOURCE_TYPE_VALUES: readonly ReferenceSourceType[] = Object.values(REFERENCE_SOURCE_TYPES);

export const SOURCE_TYPE_LABELS: Record<ReferenceSourceType, string> = {
	[REFERENCE_SOURCE_TYPES.CFR]: '14 CFR',
	[REFERENCE_SOURCE_TYPES.AIM]: 'AIM',
	[REFERENCE_SOURCE_TYPES.PCG]: 'Pilot/Controller Glossary',
	[REFERENCE_SOURCE_TYPES.AC]: 'Advisory Circular',
	[REFERENCE_SOURCE_TYPES.ACS]: 'ACS',
	[REFERENCE_SOURCE_TYPES.PHAK]: 'PHAK',
	[REFERENCE_SOURCE_TYPES.AFH]: 'Airplane Flying Handbook',
	[REFERENCE_SOURCE_TYPES.IFH]: 'Instrument Flying Handbook',
	[REFERENCE_SOURCE_TYPES.POH]: 'POH / AFM',
	[REFERENCE_SOURCE_TYPES.NTSB]: 'NTSB',
	[REFERENCE_SOURCE_TYPES.GAJSC]: 'GAJSC',
	[REFERENCE_SOURCE_TYPES.AOPA]: 'AOPA',
	[REFERENCE_SOURCE_TYPES.FAA_SAFETY]: 'FAASTeam',
	[REFERENCE_SOURCE_TYPES.SOP]: 'SOP',
	[REFERENCE_SOURCE_TYPES.AUTHORED]: 'Authored',
	[REFERENCE_SOURCE_TYPES.DERIVED]: 'Derived',
};

/**
 * Source types that carry a natural phase-of-flight dimension. Used by the
 * conditional-required gate: references from these sources must populate
 * `phaseOfFlight` (or the validator fails the build).
 */
export const PHASE_REQUIRING_SOURCE_TYPES: readonly ReferenceSourceType[] = [
	REFERENCE_SOURCE_TYPES.POH,
	REFERENCE_SOURCE_TYPES.AIM,
	REFERENCE_SOURCE_TYPES.AC,
	REFERENCE_SOURCE_TYPES.SOP,
];

// -------- 2. aviationTopic (required, multi-valued, 1-4) --------

export const AVIATION_TOPICS = {
	REGULATIONS: 'regulations',
	WEATHER: 'weather',
	NAVIGATION: 'navigation',
	COMMUNICATIONS: 'communications',
	AIRSPACE: 'airspace',
	AERODYNAMICS: 'aerodynamics',
	PERFORMANCE: 'performance',
	WEIGHT_BALANCE: 'weight-balance',
	AIRCRAFT_SYSTEMS: 'aircraft-systems',
	FLIGHT_INSTRUMENTS: 'flight-instruments',
	PROCEDURES: 'procedures',
	HUMAN_FACTORS: 'human-factors',
	MEDICAL: 'medical',
	CERTIFICATION: 'certification',
	MAINTENANCE: 'maintenance',
	AIRPORTS: 'airports',
	EMERGENCIES: 'emergencies',
	TRAINING_OPS: 'training-ops',
} as const;

export type AviationTopic = (typeof AVIATION_TOPICS)[keyof typeof AVIATION_TOPICS];

export const AVIATION_TOPIC_VALUES: readonly AviationTopic[] = Object.values(AVIATION_TOPICS);

export const AVIATION_TOPIC_LABELS: Record<AviationTopic, string> = {
	[AVIATION_TOPICS.REGULATIONS]: 'Regulations',
	[AVIATION_TOPICS.WEATHER]: 'Weather',
	[AVIATION_TOPICS.NAVIGATION]: 'Navigation',
	[AVIATION_TOPICS.COMMUNICATIONS]: 'Communications',
	[AVIATION_TOPICS.AIRSPACE]: 'Airspace',
	[AVIATION_TOPICS.AERODYNAMICS]: 'Aerodynamics',
	[AVIATION_TOPICS.PERFORMANCE]: 'Performance',
	[AVIATION_TOPICS.WEIGHT_BALANCE]: 'Weight & Balance',
	[AVIATION_TOPICS.AIRCRAFT_SYSTEMS]: 'Aircraft Systems',
	[AVIATION_TOPICS.FLIGHT_INSTRUMENTS]: 'Flight Instruments',
	[AVIATION_TOPICS.PROCEDURES]: 'Procedures',
	[AVIATION_TOPICS.HUMAN_FACTORS]: 'Human Factors',
	[AVIATION_TOPICS.MEDICAL]: 'Medical',
	[AVIATION_TOPICS.CERTIFICATION]: 'Certification',
	[AVIATION_TOPICS.MAINTENANCE]: 'Maintenance',
	[AVIATION_TOPICS.AIRPORTS]: 'Airports',
	[AVIATION_TOPICS.EMERGENCIES]: 'Emergencies',
	[AVIATION_TOPICS.TRAINING_OPS]: 'Training & Ops',
};

/** Max topics per reference (tagging research: 1-4). */
export const AVIATION_TOPIC_MIN = 1;
export const AVIATION_TOPIC_MAX = 4;

// -------- 3. flightRules (required, single-valued) --------

export const FLIGHT_RULES = {
	VFR: 'vfr',
	IFR: 'ifr',
	BOTH: 'both',
	NA: 'na',
} as const;

export type FlightRules = (typeof FLIGHT_RULES)[keyof typeof FLIGHT_RULES];

export const FLIGHT_RULES_VALUES: readonly FlightRules[] = Object.values(FLIGHT_RULES);

export const FLIGHT_RULES_LABELS: Record<FlightRules, string> = {
	[FLIGHT_RULES.VFR]: 'VFR',
	[FLIGHT_RULES.IFR]: 'IFR',
	[FLIGHT_RULES.BOTH]: 'Both',
	[FLIGHT_RULES.NA]: 'N/A',
};

// -------- 4. knowledgeKind (required, single-valued) --------

export const KNOWLEDGE_KINDS = {
	DEFINITION: 'definition',
	REGULATION: 'regulation',
	CONCEPT: 'concept',
	PROCEDURE: 'procedure',
	LIMIT: 'limit',
	SYSTEM: 'system',
	SAFETY_CONCEPT: 'safety-concept',
	REFERENCE: 'reference',
} as const;

export type KnowledgeKind = (typeof KNOWLEDGE_KINDS)[keyof typeof KNOWLEDGE_KINDS];

export const KNOWLEDGE_KIND_VALUES: readonly KnowledgeKind[] = Object.values(KNOWLEDGE_KINDS);

export const KNOWLEDGE_KIND_LABELS: Record<KnowledgeKind, string> = {
	[KNOWLEDGE_KINDS.DEFINITION]: 'Definition',
	[KNOWLEDGE_KINDS.REGULATION]: 'Regulation',
	[KNOWLEDGE_KINDS.CONCEPT]: 'Concept',
	[KNOWLEDGE_KINDS.PROCEDURE]: 'Procedure',
	[KNOWLEDGE_KINDS.LIMIT]: 'Limit',
	[KNOWLEDGE_KINDS.SYSTEM]: 'System',
	[KNOWLEDGE_KINDS.SAFETY_CONCEPT]: 'Safety concept',
	[KNOWLEDGE_KINDS.REFERENCE]: 'Reference',
};

// -------- 5. phaseOfFlight (conditional, multi-valued 0-3) --------
// Note: `@ab/constants` already exports a `PHASES_OF_FLIGHT` map for the
// study-BC scenario taxonomy. The reference system needs a distinct set
// (adds `ground-ops`, `missed`, `emergency`; drops `ground`). Exported with
// a `REFERENCE_` prefix so the two taxonomies coexist without collision.

export const REFERENCE_PHASES_OF_FLIGHT = {
	PREFLIGHT: 'preflight',
	GROUND_OPS: 'ground-ops',
	TAKEOFF: 'takeoff',
	CLIMB: 'climb',
	CRUISE: 'cruise',
	DESCENT: 'descent',
	APPROACH: 'approach',
	LANDING: 'landing',
	MISSED: 'missed',
	EMERGENCY: 'emergency',
} as const;

export type ReferencePhaseOfFlight = (typeof REFERENCE_PHASES_OF_FLIGHT)[keyof typeof REFERENCE_PHASES_OF_FLIGHT];

export const REFERENCE_PHASE_OF_FLIGHT_VALUES: readonly ReferencePhaseOfFlight[] =
	Object.values(REFERENCE_PHASES_OF_FLIGHT);

export const REFERENCE_PHASE_OF_FLIGHT_LABELS: Record<ReferencePhaseOfFlight, string> = {
	[REFERENCE_PHASES_OF_FLIGHT.PREFLIGHT]: 'Preflight',
	[REFERENCE_PHASES_OF_FLIGHT.GROUND_OPS]: 'Ground ops',
	[REFERENCE_PHASES_OF_FLIGHT.TAKEOFF]: 'Takeoff',
	[REFERENCE_PHASES_OF_FLIGHT.CLIMB]: 'Climb',
	[REFERENCE_PHASES_OF_FLIGHT.CRUISE]: 'Cruise',
	[REFERENCE_PHASES_OF_FLIGHT.DESCENT]: 'Descent',
	[REFERENCE_PHASES_OF_FLIGHT.APPROACH]: 'Approach',
	[REFERENCE_PHASES_OF_FLIGHT.LANDING]: 'Landing',
	[REFERENCE_PHASES_OF_FLIGHT.MISSED]: 'Missed approach',
	[REFERENCE_PHASES_OF_FLIGHT.EMERGENCY]: 'Emergency',
};

export const REFERENCE_PHASE_OF_FLIGHT_MAX = 3;

// -------- 6. certApplicability (optional, multi-valued) --------

export const CERT_APPLICABILITIES = {
	STUDENT: 'student',
	SPORT: 'sport',
	RECREATIONAL: 'recreational',
	PRIVATE: 'private',
	INSTRUMENT: 'instrument',
	COMMERCIAL: 'commercial',
	CFI: 'cfi',
	CFII: 'cfii',
	ATP: 'atp',
	ALL: 'all',
} as const;

export type CertApplicability = (typeof CERT_APPLICABILITIES)[keyof typeof CERT_APPLICABILITIES];

export const CERT_APPLICABILITY_VALUES: readonly CertApplicability[] = Object.values(CERT_APPLICABILITIES);

export const CERT_APPLICABILITY_LABELS: Record<CertApplicability, string> = {
	[CERT_APPLICABILITIES.STUDENT]: 'Student',
	[CERT_APPLICABILITIES.SPORT]: 'Sport',
	[CERT_APPLICABILITIES.RECREATIONAL]: 'Recreational',
	[CERT_APPLICABILITIES.PRIVATE]: 'Private',
	[CERT_APPLICABILITIES.INSTRUMENT]: 'Instrument',
	[CERT_APPLICABILITIES.COMMERCIAL]: 'Commercial',
	[CERT_APPLICABILITIES.CFI]: 'CFI',
	[CERT_APPLICABILITIES.CFII]: 'CFII',
	[CERT_APPLICABILITIES.ATP]: 'ATP',
	[CERT_APPLICABILITIES.ALL]: 'All',
};

// -------- 7. keywords (optional, freeform) --------

export const REFERENCE_KEYWORD_MAX_LENGTH = 40;
export const REFERENCE_KEYWORD_MAX_COUNT = 12;

// -------- zombie-tag blocklist --------

/**
 * Tag strings that must never appear in any reference's `keywords`. These are
 * the pre-retag noise words from the old firc glossary (`cfi-knowledge` on
 * 91% of entries, etc.); the 5-axis taxonomy replaces them by design. The
 * validator enforces this.
 */
export const REFERENCE_BANNED_KEYWORDS: readonly string[] = ['cfi-knowledge', 'faa-testing'];
