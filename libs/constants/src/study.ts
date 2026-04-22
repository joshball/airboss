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
 * Human-readable labels for confidence levels. Used by the shared
 * ConfidenceSlider component and the calibration page bucket chart.
 */
export const CONFIDENCE_LEVEL_LABELS: Record<ConfidenceLevel, string> = {
	[CONFIDENCE_LEVELS.WILD_GUESS]: 'Wild guess',
	[CONFIDENCE_LEVELS.UNCERTAIN]: 'Uncertain',
	[CONFIDENCE_LEVELS.MAYBE]: 'Maybe',
	[CONFIDENCE_LEVELS.PROBABLY]: 'Probably',
	[CONFIDENCE_LEVELS.CERTAIN]: 'Certain',
};

/**
 * Implicit probability each confidence level maps to. A well-calibrated
 * learner who rates confidence=4 ("Probably") should get ~75% of those items
 * correct. Expressed as 0..1; the calibration score is the complement of the
 * mean absolute deviation between this mapping and actual accuracy.
 *
 * Formula: (level - 1) / 4 -> 0%, 25%, 50%, 75%, 100%.
 */
export const CONFIDENCE_LEVEL_EXPECTED_ACCURACY: Record<ConfidenceLevel, number> = {
	[CONFIDENCE_LEVELS.WILD_GUESS]: 0,
	[CONFIDENCE_LEVELS.UNCERTAIN]: 0.25,
	[CONFIDENCE_LEVELS.MAYBE]: 0.5,
	[CONFIDENCE_LEVELS.PROBABLY]: 0.75,
	[CONFIDENCE_LEVELS.CERTAIN]: 1,
};

/**
 * Minimum number of data points a confidence bucket needs before it's
 * included in the calibration score. Buckets below this threshold are shown
 * as "need more data" on the calibration page. Low samples produce wild
 * percentages that falsely boost or punish the score.
 */
export const CALIBRATION_MIN_BUCKET_COUNT = 5;

/**
 * Window (days) for the calibration trend sparkline. One point per day.
 */
export const CALIBRATION_TREND_WINDOW_DAYS = 30;

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

/**
 * Certifications a knowledge node can be relevant at. Tagged per-node via
 * the relevance array. Not to be confused with specific ratings / endorsements;
 * this is the cert framework itself.
 */
export const CERTS = {
	PPL: 'PPL',
	IR: 'IR',
	CPL: 'CPL',
	CFI: 'CFI',
} as const;

export type Cert = (typeof CERTS)[keyof typeof CERTS];

export const CERT_VALUES = Object.values(CERTS);

/** Human-readable labels for certs. Short form matches the authored YAML. */
export const CERT_LABELS: Record<Cert, string> = {
	[CERTS.PPL]: 'PPL',
	[CERTS.IR]: 'IR',
	[CERTS.CPL]: 'CPL',
	[CERTS.CFI]: 'CFI',
};

/**
 * Bloom's taxonomy levels used per-relevance-entry. A node can be relevant at
 * Remember for PPL but at Evaluate for CFI -- the same knowledge, different
 * depth of understanding expected.
 */
export const BLOOM_LEVELS = {
	REMEMBER: 'remember',
	UNDERSTAND: 'understand',
	APPLY: 'apply',
	ANALYZE: 'analyze',
	EVALUATE: 'evaluate',
	CREATE: 'create',
} as const;

export type BloomLevel = (typeof BLOOM_LEVELS)[keyof typeof BLOOM_LEVELS];

export const BLOOM_LEVEL_VALUES = Object.values(BLOOM_LEVELS);

export const BLOOM_LEVEL_LABELS: Record<BloomLevel, string> = {
	[BLOOM_LEVELS.REMEMBER]: 'Remember',
	[BLOOM_LEVELS.UNDERSTAND]: 'Understand',
	[BLOOM_LEVELS.APPLY]: 'Apply',
	[BLOOM_LEVELS.ANALYZE]: 'Analyze',
	[BLOOM_LEVELS.EVALUATE]: 'Evaluate',
	[BLOOM_LEVELS.CREATE]: 'Create',
};

/**
 * Priority of a node within a cert's scope. Core = must-know. Supporting =
 * helpful context. Elective = nice-to-have / advanced.
 */
export const RELEVANCE_PRIORITIES = {
	CORE: 'core',
	SUPPORTING: 'supporting',
	ELECTIVE: 'elective',
} as const;

export type RelevancePriority = (typeof RELEVANCE_PRIORITIES)[keyof typeof RELEVANCE_PRIORITIES];

export const RELEVANCE_PRIORITY_VALUES = Object.values(RELEVANCE_PRIORITIES);

export const RELEVANCE_PRIORITY_LABELS: Record<RelevancePriority, string> = {
	[RELEVANCE_PRIORITIES.CORE]: 'Core',
	[RELEVANCE_PRIORITIES.SUPPORTING]: 'Supporting',
	[RELEVANCE_PRIORITIES.ELECTIVE]: 'Elective',
};

/**
 * Knowledge-type tags for a node. A single node can carry several -- the
 * VFR minimums table is factual (numbers), conceptual (why those numbers),
 * and judgment (legal vs safe) simultaneously.
 */
export const KNOWLEDGE_TYPES = {
	FACTUAL: 'factual',
	CONCEPTUAL: 'conceptual',
	PROCEDURAL: 'procedural',
	JUDGMENT: 'judgment',
	PERCEPTUAL: 'perceptual',
	PEDAGOGICAL: 'pedagogical',
} as const;

export type KnowledgeType = (typeof KNOWLEDGE_TYPES)[keyof typeof KNOWLEDGE_TYPES];

export const KNOWLEDGE_TYPE_VALUES = Object.values(KNOWLEDGE_TYPES);

/** How deeply the node is treated. Same content can appear at multiple depths. */
export const TECHNICAL_DEPTHS = {
	SURFACE: 'surface',
	WORKING: 'working',
	DEEP: 'deep',
} as const;

export type TechnicalDepth = (typeof TECHNICAL_DEPTHS)[keyof typeof TECHNICAL_DEPTHS];

export const TECHNICAL_DEPTH_VALUES = Object.values(TECHNICAL_DEPTHS);

/** Volatility of the underlying subject matter. */
export const NODE_STABILITIES = {
	STABLE: 'stable',
	EVOLVING: 'evolving',
	VOLATILE: 'volatile',
} as const;

export type NodeStability = (typeof NODE_STABILITIES)[keyof typeof NODE_STABILITIES];

export const NODE_STABILITY_VALUES = Object.values(NODE_STABILITIES);

/** Ways a node's content can be delivered. Orthogonal to knowledge type. */
export const NODE_MODALITIES = {
	READING: 'reading',
	CARDS: 'cards',
	REPS: 'reps',
	DRILL: 'drill',
	VISUALIZATION: 'visualization',
	AUDIO: 'audio',
	VIDEO: 'video',
	CALCULATION: 'calculation',
	TEACHING_EXERCISE: 'teaching-exercise',
} as const;

export type NodeModality = (typeof NODE_MODALITIES)[keyof typeof NODE_MODALITIES];

export const NODE_MODALITY_VALUES = Object.values(NODE_MODALITIES);

/** Assessment approaches a node is amenable to. */
export const ASSESSMENT_METHODS = {
	RECALL: 'recall',
	CALCULATION: 'calculation',
	SCENARIO: 'scenario',
	DEMONSTRATION: 'demonstration',
	TEACHING: 'teaching',
} as const;

export type AssessmentMethod = (typeof ASSESSMENT_METHODS)[keyof typeof ASSESSMENT_METHODS];

export const ASSESSMENT_METHOD_VALUES = Object.values(ASSESSMENT_METHODS);

/** Node lifecycle: how much of the seven-phase content model is authored. */
export const NODE_LIFECYCLES = {
	/** Metadata + edges only -- no content phases authored. */
	SKELETON: 'skeleton',
	/** 1-6 content phases authored. */
	STARTED: 'started',
	/** All seven content phases authored. */
	COMPLETE: 'complete',
} as const;

export type NodeLifecycle = (typeof NODE_LIFECYCLES)[keyof typeof NODE_LIFECYCLES];

export const NODE_LIFECYCLE_VALUES = Object.values(NODE_LIFECYCLES);

export const NODE_LIFECYCLE_LABELS: Record<NodeLifecycle, string> = {
	[NODE_LIFECYCLES.SKELETON]: 'Skeleton',
	[NODE_LIFECYCLES.STARTED]: 'Started',
	[NODE_LIFECYCLES.COMPLETE]: 'Complete',
};

/**
 * Dual-gate mastery thresholds (ADR 011, spec "Mastery computation").
 *
 * Mastery is a dual gate: card stability AND rep accuracy must each clear
 * their pillar threshold. A weighted average can hide a weak pillar -- aviation
 * culture rejects "good enough" composites. The card threshold is stricter
 * (0.80) because recall is easier than judgment; rep accuracy (0.70) tolerates
 * one miss in three because scenarios embed ambiguity.
 */
export const CARD_MASTERY_RATIO_THRESHOLD = 0.8;
export const REP_ACCURACY_THRESHOLD = 0.7;
export const CARD_MIN = 3;
export const REP_MIN = 3;

/**
 * FSRS stability (in days) at which a single card is considered mastered for
 * node-level mastery aggregation. Distinct from MASTERY_STABILITY_DAYS above
 * only by name; both resolve to 30 in v1 and are kept as separate constants
 * so the node-mastery story can evolve (e.g. higher-bloom-level nodes needing
 * 60 days) without disturbing the dashboard metric.
 */
export const STABILITY_MASTERED_DAYS = 30;

// -------- Study plan lifecycle --------

/** Study plan lifecycle states. One active plan per user at a time. */
export const PLAN_STATUSES = {
	DRAFT: 'draft',
	ACTIVE: 'active',
	ARCHIVED: 'archived',
} as const;

export type PlanStatus = (typeof PLAN_STATUSES)[keyof typeof PLAN_STATUSES];

export const PLAN_STATUS_VALUES = Object.values(PLAN_STATUSES);

export const PLAN_STATUS_LABELS: Record<PlanStatus, string> = {
	[PLAN_STATUSES.DRAFT]: 'Draft',
	[PLAN_STATUSES.ACTIVE]: 'Active',
	[PLAN_STATUSES.ARCHIVED]: 'Archived',
};

// -------- Session engine modes + slices --------

export const SESSION_MODES = {
	CONTINUE: 'continue',
	STRENGTHEN: 'strengthen',
	MIXED: 'mixed',
	EXPAND: 'expand',
} as const;

export type SessionMode = (typeof SESSION_MODES)[keyof typeof SESSION_MODES];

export const SESSION_MODE_VALUES = Object.values(SESSION_MODES);

export const SESSION_MODE_LABELS: Record<SessionMode, string> = {
	[SESSION_MODES.CONTINUE]: 'Continue where I left off',
	[SESSION_MODES.STRENGTHEN]: 'Hit my weak spots',
	[SESSION_MODES.MIXED]: 'Mixed (default)',
	[SESSION_MODES.EXPAND]: 'Try something new',
};

export const SESSION_SLICES = {
	CONTINUE: 'continue',
	STRENGTHEN: 'strengthen',
	EXPAND: 'expand',
	DIVERSIFY: 'diversify',
} as const;

export type SessionSlice = (typeof SESSION_SLICES)[keyof typeof SESSION_SLICES];

export const SESSION_SLICE_VALUES = Object.values(SESSION_SLICES);

export const SESSION_ITEM_KINDS = {
	CARD: 'card',
	REP: 'rep',
	NODE_START: 'node_start',
} as const;

export type SessionItemKind = (typeof SESSION_ITEM_KINDS)[keyof typeof SESSION_ITEM_KINDS];

export const SESSION_ITEM_KIND_VALUES = Object.values(SESSION_ITEM_KINDS);

/**
 * Three-way skip semantics (PRD-mandated).
 * - today: session-scoped; no plan mutation
 * - topic: mutates plan.skip_domains or plan.skip_nodes
 * - permanent: mutates plan.skip_nodes AND suspends card/scenario
 */
export const SESSION_SKIP_KINDS = {
	TODAY: 'today',
	TOPIC: 'topic',
	PERMANENT: 'permanent',
} as const;

export type SessionSkipKind = (typeof SESSION_SKIP_KINDS)[keyof typeof SESSION_SKIP_KINDS];

export const SESSION_SKIP_KIND_VALUES = Object.values(SESSION_SKIP_KINDS);

export const SESSION_SKIP_KIND_LABELS: Record<SessionSkipKind, string> = {
	[SESSION_SKIP_KINDS.TODAY]: 'Skip for today',
	[SESSION_SKIP_KINDS.TOPIC]: 'Skip topic',
	[SESSION_SKIP_KINDS.PERMANENT]: 'Skip permanently',
};

/** Depth preference for expand-slice scoring (matches bloom authoring). */
export const DEPTH_PREFERENCES = {
	SURFACE: 'surface',
	WORKING: 'working',
	DEEP: 'deep',
} as const;

export type DepthPreference = (typeof DEPTH_PREFERENCES)[keyof typeof DEPTH_PREFERENCES];

export const DEPTH_PREFERENCE_VALUES = Object.values(DEPTH_PREFERENCES);

export const DEPTH_PREFERENCE_LABELS: Record<DepthPreference, string> = {
	[DEPTH_PREFERENCES.SURFACE]: 'Surface -- overview, key facts',
	[DEPTH_PREFERENCES.WORKING]: 'Working -- operational fluency',
	[DEPTH_PREFERENCES.DEEP]: 'Deep -- teach it to someone else',
};

export const SESSION_REASON_CODES = {
	CONTINUE_RECENT_DOMAIN: 'continue_recent_domain',
	CONTINUE_DUE_IN_DOMAIN: 'continue_due_in_domain',
	CONTINUE_UNFINISHED_NODE: 'continue_unfinished_node',
	STRENGTHEN_RELEARNING: 'strengthen_relearning',
	STRENGTHEN_RATED_AGAIN: 'strengthen_rated_again',
	STRENGTHEN_OVERDUE: 'strengthen_overdue',
	STRENGTHEN_LOW_REP_ACCURACY: 'strengthen_low_rep_accuracy',
	STRENGTHEN_MASTERY_DROP: 'strengthen_mastery_drop',
	EXPAND_UNSTARTED_READY: 'expand_unstarted_ready',
	EXPAND_UNSTARTED_PRIORITY: 'expand_unstarted_priority',
	EXPAND_FOCUS_MATCH: 'expand_focus_match',
	DIVERSIFY_UNUSED_DOMAIN: 'diversify_unused_domain',
	DIVERSIFY_CROSS_DOMAIN_APPLY: 'diversify_cross_domain_apply',
} as const;

export type SessionReasonCode = (typeof SESSION_REASON_CODES)[keyof typeof SESSION_REASON_CODES];

export const SESSION_REASON_CODE_VALUES = Object.values(SESSION_REASON_CODES);

export const SESSION_REASON_CODE_LABELS: Record<SessionReasonCode, string> = {
	[SESSION_REASON_CODES.CONTINUE_RECENT_DOMAIN]: 'Recent domain',
	[SESSION_REASON_CODES.CONTINUE_DUE_IN_DOMAIN]: 'Due in recent domain',
	[SESSION_REASON_CODES.CONTINUE_UNFINISHED_NODE]: 'Unfinished node',
	[SESSION_REASON_CODES.STRENGTHEN_RELEARNING]: 'Relearning',
	[SESSION_REASON_CODES.STRENGTHEN_RATED_AGAIN]: 'Rated Again recently',
	[SESSION_REASON_CODES.STRENGTHEN_OVERDUE]: 'Overdue',
	[SESSION_REASON_CODES.STRENGTHEN_LOW_REP_ACCURACY]: 'Low rep accuracy',
	[SESSION_REASON_CODES.STRENGTHEN_MASTERY_DROP]: 'Mastery dropping',
	[SESSION_REASON_CODES.EXPAND_UNSTARTED_READY]: 'Prerequisites met',
	[SESSION_REASON_CODES.EXPAND_UNSTARTED_PRIORITY]: 'Core topic, unstarted',
	[SESSION_REASON_CODES.EXPAND_FOCUS_MATCH]: 'Matches focus',
	[SESSION_REASON_CODES.DIVERSIFY_UNUSED_DOMAIN]: 'Unused domain',
	[SESSION_REASON_CODES.DIVERSIFY_CROSS_DOMAIN_APPLY]: 'Cross-domain application',
};

/**
 * Mode weight tuples. Each row sums to exactly 1.0. The engine multiplies
 * these by session_length and uses largest-remainder rounding.
 */
export const MODE_WEIGHTS: Record<SessionMode, Record<SessionSlice, number>> = {
	[SESSION_MODES.MIXED]: {
		[SESSION_SLICES.CONTINUE]: 0.3,
		[SESSION_SLICES.STRENGTHEN]: 0.3,
		[SESSION_SLICES.EXPAND]: 0.2,
		[SESSION_SLICES.DIVERSIFY]: 0.2,
	},
	[SESSION_MODES.CONTINUE]: {
		[SESSION_SLICES.CONTINUE]: 0.7,
		[SESSION_SLICES.STRENGTHEN]: 0.2,
		[SESSION_SLICES.EXPAND]: 0.0,
		[SESSION_SLICES.DIVERSIFY]: 0.1,
	},
	[SESSION_MODES.STRENGTHEN]: {
		[SESSION_SLICES.CONTINUE]: 0.1,
		[SESSION_SLICES.STRENGTHEN]: 0.7,
		[SESSION_SLICES.EXPAND]: 0.0,
		[SESSION_SLICES.DIVERSIFY]: 0.2,
	},
	[SESSION_MODES.EXPAND]: {
		[SESSION_SLICES.CONTINUE]: 0.1,
		[SESSION_SLICES.STRENGTHEN]: 0.1,
		[SESSION_SLICES.EXPAND]: 0.7,
		[SESSION_SLICES.DIVERSIFY]: 0.1,
	},
};

/**
 * Tiebreaker priority for slot-allocator ties and pool-redistribution fills.
 * Earlier in the array == higher priority. Spec: strengthen > continue > expand > diversify.
 */
export const SLICE_PRIORITY: readonly SessionSlice[] = [
	SESSION_SLICES.STRENGTHEN,
	SESSION_SLICES.CONTINUE,
	SESSION_SLICES.EXPAND,
	SESSION_SLICES.DIVERSIFY,
];

/** Default items per session from the PRD ("10 minutes, 10 items"). */
export const DEFAULT_SESSION_LENGTH = 10;

/** Session length CHECK bounds. */
export const MIN_SESSION_LENGTH = 3;
export const MAX_SESSION_LENGTH = 50;

/**
 * How long an abandoned in-progress session remains resumable before the
 * `/session/start` flow offers a fresh preview instead. 2h from the spec.
 */
export const RESUME_WINDOW_MS = 2 * 60 * 60 * 1000;

export const SESSION_SLICE_LABELS: Record<SessionSlice, string> = {
	[SESSION_SLICES.CONTINUE]: 'Continue where you left off',
	[SESSION_SLICES.STRENGTHEN]: 'Strengthen',
	[SESSION_SLICES.EXPAND]: 'Expand',
	[SESSION_SLICES.DIVERSIFY]: 'Diversify',
};
