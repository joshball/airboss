/**
 * Constants for the study BC -- spaced memory items, decision reps, calibration.
 *
 * Domains align (loosely for now) with the knowledge-graph taxonomy described
 * in ADR 011. Once the graph lands, this list becomes a projection of the
 * graph's domain taxonomy rather than an authoritative constant.
 */

/**
 * Platform default for "what timezone is the user in?" Used for day-boundary
 * aggregations (streaks, attemptedToday). User-zero is in America/Denver;
 * until per-user tz is plumbed through auth this is the source of truth for
 * calendar-aware reads. Matches the value the study-plan + session-engine
 * spec committed to.
 */
export const DEFAULT_USER_TIMEZONE = 'America/Denver';

export const DOMAINS = {
	REGULATIONS: 'regulations',
	WEATHER: 'weather',
	AIRSPACE: 'airspace',
	GLASS_COCKPITS: 'glass-cockpits',
	IFR_PROCEDURES: 'ifr-procedures',
	VFR_OPERATIONS: 'vfr-operations',
	AERODYNAMICS: 'aerodynamics',
	TEACHING_METHODOLOGY: 'teaching-methodology',
	ADM_HUMAN_FACTORS: 'adm-human-factors',
	SAFETY_ACCIDENT_ANALYSIS: 'safety-accident-analysis',
	AIRCRAFT_SYSTEMS: 'aircraft-systems',
	FLIGHT_PLANNING: 'flight-planning',
	EMERGENCY_PROCEDURES: 'emergency-procedures',
	FAA_PRACTICAL_STANDARDS: 'faa-practical-standards',
} as const;

export type Domain = (typeof DOMAINS)[keyof typeof DOMAINS];

export const DOMAIN_VALUES = Object.values(DOMAINS);

/**
 * Human-readable labels for domains. Preferred over auto-humanized slug
 * values because it preserves aviation acronyms (FAA, ADM, IFR, VFR, CFR).
 */
export const DOMAIN_LABELS: Record<Domain, string> = {
	[DOMAINS.REGULATIONS]: 'Regulations',
	[DOMAINS.WEATHER]: 'Weather',
	[DOMAINS.AIRSPACE]: 'Airspace',
	[DOMAINS.GLASS_COCKPITS]: 'Glass Cockpits',
	[DOMAINS.IFR_PROCEDURES]: 'IFR Procedures',
	[DOMAINS.VFR_OPERATIONS]: 'VFR Operations',
	[DOMAINS.AERODYNAMICS]: 'Aerodynamics',
	[DOMAINS.TEACHING_METHODOLOGY]: 'Teaching Methodology',
	[DOMAINS.ADM_HUMAN_FACTORS]: 'ADM / Human Factors',
	[DOMAINS.SAFETY_ACCIDENT_ANALYSIS]: 'Safety / Accident Analysis',
	[DOMAINS.AIRCRAFT_SYSTEMS]: 'Aircraft Systems',
	[DOMAINS.FLIGHT_PLANNING]: 'Flight Planning',
	[DOMAINS.EMERGENCY_PROCEDURES]: 'Emergency Procedures',
	[DOMAINS.FAA_PRACTICAL_STANDARDS]: 'FAA Practical Standards',
};

/**
 * Difficulty levels for decision-rep scenarios. Authoring signal -- not
 * enforced by scheduling logic today, but used for filtering and surfaced in
 * the browse/new forms.
 */
export const DIFFICULTIES = {
	BEGINNER: 'beginner',
	INTERMEDIATE: 'intermediate',
	ADVANCED: 'advanced',
} as const;

export type Difficulty = (typeof DIFFICULTIES)[keyof typeof DIFFICULTIES];

export const DIFFICULTY_VALUES = Object.values(DIFFICULTIES);

export const DIFFICULTY_LABELS: Record<Difficulty, string> = {
	[DIFFICULTIES.BEGINNER]: 'Beginner',
	[DIFFICULTIES.INTERMEDIATE]: 'Intermediate',
	[DIFFICULTIES.ADVANCED]: 'Advanced',
};

/**
 * Phase-of-flight taxonomy for scenarios. Optional on a scenario; used for
 * filtering in the browse page and grouping for future review patterns.
 */
export const PHASES_OF_FLIGHT = {
	PREFLIGHT: 'preflight',
	TAKEOFF: 'takeoff',
	CLIMB: 'climb',
	CRUISE: 'cruise',
	DESCENT: 'descent',
	APPROACH: 'approach',
	LANDING: 'landing',
	GROUND: 'ground',
} as const;

export type PhaseOfFlight = (typeof PHASES_OF_FLIGHT)[keyof typeof PHASES_OF_FLIGHT];

export const PHASE_OF_FLIGHT_VALUES = Object.values(PHASES_OF_FLIGHT);

export const PHASE_OF_FLIGHT_LABELS: Record<PhaseOfFlight, string> = {
	[PHASES_OF_FLIGHT.PREFLIGHT]: 'Preflight',
	[PHASES_OF_FLIGHT.TAKEOFF]: 'Takeoff',
	[PHASES_OF_FLIGHT.CLIMB]: 'Climb',
	[PHASES_OF_FLIGHT.CRUISE]: 'Cruise',
	[PHASES_OF_FLIGHT.DESCENT]: 'Descent',
	[PHASES_OF_FLIGHT.APPROACH]: 'Approach',
	[PHASES_OF_FLIGHT.LANDING]: 'Landing',
	[PHASES_OF_FLIGHT.GROUND]: 'Ground',
};

/** Lifecycle status for decision-rep scenarios. Parallels card status. */
export const SCENARIO_STATUSES = {
	ACTIVE: 'active',
	SUSPENDED: 'suspended',
	ARCHIVED: 'archived',
} as const;

export type ScenarioStatus = (typeof SCENARIO_STATUSES)[keyof typeof SCENARIO_STATUSES];

export const SCENARIO_STATUS_VALUES = Object.values(SCENARIO_STATUSES);

/** Allowed number of options per scenario (spec: 2-5). */
export const SCENARIO_OPTIONS_MIN = 2;
export const SCENARIO_OPTIONS_MAX = 5;

/** Default rep-session batch size. */
export const REP_BATCH_SIZE = 10;

/** Number of days back for rep dashboard accuracy window. */
export const REP_DASHBOARD_WINDOW_DAYS = 30;

/**
 * Learning Dashboard tuning constants.
 *
 * See `docs/work-packages/learning-dashboard/design.md` for the ranking
 * rationale. All three live here so tuning a signal is a single-file change
 * and so the BC aggregates share the same thresholds as the panels that
 * render them.
 */

/** Accuracy floor (0-1) below which a domain contributes weakness signal. */
export const WEAK_AREA_ACCURACY_THRESHOLD = 0.7;

/** Minimum reviews + attempts in the analysis window before a domain can rank. */
export const WEAK_AREA_MIN_DATA_POINTS = 10;

/** Analysis window (days) for the weak-areas query. */
export const WEAK_AREA_WINDOW_DAYS = 30;

/** Default number of weak areas surfaced on the dashboard. */
export const WEAK_AREA_LIMIT = 5;

/** Sparkline window (days) for the activity panel. */
export const ACTIVITY_WINDOW_DAYS = 7;

/**
 * Overdue grace period (ms) -- a due card only counts as "overdue" once it has
 * been past its `dueAt` longer than this. 2 days matches the spec's "missed
 * review" threshold for weak-areas ranking.
 */
export const OVERDUE_GRACE_MS = 2 * 24 * 60 * 60 * 1000;

export const CARD_TYPES = {
	BASIC: 'basic',
	CLOZE: 'cloze',
	REGULATION: 'regulation',
	MEMORY_ITEM: 'memory_item',
} as const;

export type CardType = (typeof CARD_TYPES)[keyof typeof CARD_TYPES];

export const CARD_TYPE_VALUES = Object.values(CARD_TYPES);

export const CARD_TYPE_LABELS: Record<CardType, string> = {
	[CARD_TYPES.BASIC]: 'Basic',
	[CARD_TYPES.CLOZE]: 'Cloze',
	[CARD_TYPES.REGULATION]: 'Regulation',
	[CARD_TYPES.MEMORY_ITEM]: 'Memory item',
};

export const CONTENT_SOURCES = {
	PERSONAL: 'personal',
	COURSE: 'course',
	PRODUCT: 'product',
	IMPORTED: 'imported',
} as const;

export type ContentSource = (typeof CONTENT_SOURCES)[keyof typeof CONTENT_SOURCES];

export const CONTENT_SOURCE_VALUES = Object.values(CONTENT_SOURCES);

export const CARD_STATUSES = {
	ACTIVE: 'active',
	SUSPENDED: 'suspended',
	ARCHIVED: 'archived',
} as const;

export type CardStatus = (typeof CARD_STATUSES)[keyof typeof CARD_STATUSES];

export const CARD_STATUS_VALUES = Object.values(CARD_STATUSES);

/** FSRS rating values (matches ts-fsrs / Anki convention). */
export const REVIEW_RATINGS = {
	AGAIN: 1,
	HARD: 2,
	GOOD: 3,
	EASY: 4,
} as const;

export type ReviewRating = (typeof REVIEW_RATINGS)[keyof typeof REVIEW_RATINGS];

export const REVIEW_RATING_VALUES = Object.values(REVIEW_RATINGS);

/** FSRS scheduler states for a card. */
export const CARD_STATES = {
	NEW: 'new',
	LEARNING: 'learning',
	REVIEW: 'review',
	RELEARNING: 'relearning',
} as const;

export type CardState = (typeof CARD_STATES)[keyof typeof CARD_STATES];

export const CARD_STATE_VALUES = Object.values(CARD_STATES);

/** Pre-reveal confidence levels (feeds calibration tracker). */
export const CONFIDENCE_LEVELS = {
	WILD_GUESS: 1,
	UNCERTAIN: 2,
	MAYBE: 3,
	PROBABLY: 4,
	CERTAIN: 5,
} as const;

export type ConfidenceLevel = (typeof CONFIDENCE_LEVELS)[keyof typeof CONFIDENCE_LEVELS];

export const CONFIDENCE_LEVEL_VALUES = Object.values(CONFIDENCE_LEVELS);

/**
 * Mastery threshold (days of FSRS stability) at which a card is considered
 * mastered for dashboard metrics. Matches spec SMI success criteria.
 */
export const MASTERY_STABILITY_DAYS = 30;

/**
 * Fraction of reviews that receive a pre-reveal confidence prompt.
 * Deterministic hash (cardId + review date) -- never random -- so the same card
 * on the same day is always either always-prompted or never-prompted.
 */
export const CONFIDENCE_SAMPLE_RATE = 0.5;

/** Default review-session batch size. */
export const REVIEW_BATCH_SIZE = 20;

/** Default browse page size. */
export const BROWSE_PAGE_SIZE = 25;

/** Idempotency window for duplicate review submission protection. */
export const REVIEW_DEDUPE_WINDOW_MS = 5_000;

/**
 * Idempotency window for duplicate rep-attempt submission protection.
 * Shorter than the review window -- reps submit via a standard form and the
 * UX is "pick an option, see outcome", so a double-click should fold into a
 * single attempt but a deliberate re-attempt a few seconds later is a
 * legitimate separate judgment rep.
 */
export const REP_DEDUPE_WINDOW_MS = 2_000;

/**
 * Knowledge-graph edge types (see ADR 011). `requires` is the only edge type
 * that must form a DAG; the rest are structural or navigational. Author-facing
 * YAML uses the passive-voice collection keys (`applied_by`, `taught_by`); the
 * build script inverts those into the active-voice edges stored here.
 */
export const KNOWLEDGE_EDGE_TYPES = {
	/** Must understand X before Y. DAG; no cycles. */
	REQUIRES: 'requires',
	/** More advanced treatment of the same concept. Same domain, different depth. */
	DEEPENS: 'deepens',
	/** Uses this knowledge in practice. Cross-domain. */
	APPLIES: 'applies',
	/** CFI/pedagogical node teaching the target technical topic. */
	TEACHES: 'teaches',
	/** Loose connection, useful for cross-reference; not load-bearing. */
	RELATED: 'related',
} as const;

export type KnowledgeEdgeType = (typeof KNOWLEDGE_EDGE_TYPES)[keyof typeof KNOWLEDGE_EDGE_TYPES];

export const KNOWLEDGE_EDGE_TYPE_VALUES = Object.values(KNOWLEDGE_EDGE_TYPES);

/** Map YAML collection keys (author-facing) to how we store them. */
export const KNOWLEDGE_EDGE_YAML_KEYS = {
	REQUIRES: 'requires',
	DEEPENS: 'deepens',
	APPLIED_BY: 'applied_by',
	TAUGHT_BY: 'taught_by',
	RELATED: 'related',
} as const;

export type KnowledgeEdgeYamlKey = (typeof KNOWLEDGE_EDGE_YAML_KEYS)[keyof typeof KNOWLEDGE_EDGE_YAML_KEYS];

export const KNOWLEDGE_EDGE_YAML_KEY_VALUES = Object.values(KNOWLEDGE_EDGE_YAML_KEYS);

/**
 * Seven-phase content model headings (ADR 011). Lowercase kebab-case is the
 * canonical form used in the DB and UI.
 */
export const KNOWLEDGE_PHASES = {
	CONTEXT: 'context',
	PROBLEM: 'problem',
	DISCOVER: 'discover',
	REVEAL: 'reveal',
	PRACTICE: 'practice',
	CONNECT: 'connect',
	VERIFY: 'verify',
} as const;

export type KnowledgePhase = (typeof KNOWLEDGE_PHASES)[keyof typeof KNOWLEDGE_PHASES];

export const KNOWLEDGE_PHASE_VALUES = Object.values(KNOWLEDGE_PHASES);

/** Ordered list of phases as they appear in the content model. */
export const KNOWLEDGE_PHASE_ORDER: readonly KnowledgePhase[] = [
	KNOWLEDGE_PHASES.CONTEXT,
	KNOWLEDGE_PHASES.PROBLEM,
	KNOWLEDGE_PHASES.DISCOVER,
	KNOWLEDGE_PHASES.REVEAL,
	KNOWLEDGE_PHASES.PRACTICE,
	KNOWLEDGE_PHASES.CONNECT,
	KNOWLEDGE_PHASES.VERIFY,
];

/** Human-readable labels for knowledge phases. */
export const KNOWLEDGE_PHASE_LABELS: Record<KnowledgePhase, string> = {
	[KNOWLEDGE_PHASES.CONTEXT]: 'Context',
	[KNOWLEDGE_PHASES.PROBLEM]: 'Problem',
	[KNOWLEDGE_PHASES.DISCOVER]: 'Discover',
	[KNOWLEDGE_PHASES.REVEAL]: 'Reveal',
	[KNOWLEDGE_PHASES.PRACTICE]: 'Practice',
	[KNOWLEDGE_PHASES.CONNECT]: 'Connect',
	[KNOWLEDGE_PHASES.VERIFY]: 'Verify',
};
