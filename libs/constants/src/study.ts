/**
 * Constants for the study BC -- spaced memory items, decision reps, calibration.
 *
 * Domains align (loosely for now) with the knowledge-graph taxonomy described
 * in ADR 011. Once the graph lands, this list becomes a projection of the
 * graph's domain taxonomy rather than an authoritative constant.
 */

import { CERT_APPLICABILITIES } from './reference-tags';
import { MS_PER_DAY, MS_PER_HOUR } from './time';

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
 * Typed lookup for a domain's display label. Accepts an arbitrary slug
 * string (for server-provided values that aren't already narrowed) and
 * falls back to a title-cased version of the slug on a miss so the UI
 * never renders a raw kebab-case value.
 *
 * Reviewers flagged 20+ duplicates across the study routes, most of them
 * doing `(DOMAIN_LABELS as Record<string, string>)[slug] ?? humanize(slug)`.
 * This helper collapses all of those to one call site.
 */
export function domainLabel(domain: Domain | string): string {
	const known = (DOMAIN_LABELS as Record<string, string>)[domain];
	if (known) return known;
	return humanize(domain);
}

/**
 * Inline humanize so `@ab/constants` stays dependency-free (`@ab/utils`
 * already imports `@ab/constants`, so an import the other way would create
 * a cycle). Mirrors `libs/utils/src/strings.ts humanize()` behaviour:
 * splits camelCase/PascalCase boundaries, then kebab/snake separators,
 * title-cases each word, preserves all-caps acronyms.
 */
function humanize(slug: string): string {
	if (!slug) return '';
	const withBoundaries = slug.replace(/([a-z0-9])([A-Z])/g, '$1 $2').replace(/([A-Z]+)([A-Z][a-z])/g, '$1 $2');
	return withBoundaries
		.split(/[\s\-_]+/)
		.filter((w) => w.length > 0)
		.map((w) => (w === w.toUpperCase() ? w : w.charAt(0).toUpperCase() + w.slice(1).toLowerCase()))
		.join(' ');
}

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
export const OVERDUE_GRACE_MS = 2 * MS_PER_DAY;

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

/**
 * Human-readable labels for content sources. Lets the card detail + browse
 * surfaces render "Personal" / "Course" / "Product" / "Imported" without
 * relying on `humanize()` on the raw slug.
 */
export const CONTENT_SOURCE_LABELS: Record<ContentSource, string> = {
	[CONTENT_SOURCES.PERSONAL]: 'Personal',
	[CONTENT_SOURCES.COURSE]: 'Course',
	[CONTENT_SOURCES.PRODUCT]: 'Product',
	[CONTENT_SOURCES.IMPORTED]: 'Imported',
};

export const CARD_STATUSES = {
	ACTIVE: 'active',
	SUSPENDED: 'suspended',
	ARCHIVED: 'archived',
} as const;

export type CardStatus = (typeof CARD_STATUSES)[keyof typeof CARD_STATUSES];

export const CARD_STATUS_VALUES = Object.values(CARD_STATUSES);

/**
 * Human-readable labels for card statuses. Keeps display strings out of
 * inline markup so every Memory surface renders "Active" / "Suspended" /
 * "Archived" consistently.
 */
export const CARD_STATUS_LABELS: Record<CardStatus, string> = {
	[CARD_STATUSES.ACTIVE]: 'Active',
	[CARD_STATUSES.SUSPENDED]: 'Suspended',
	[CARD_STATUSES.ARCHIVED]: 'Archived',
};

/** FSRS rating values (matches ts-fsrs / Anki convention). */
export const REVIEW_RATINGS = {
	AGAIN: 1,
	HARD: 2,
	GOOD: 3,
	EASY: 4,
} as const;

export type ReviewRating = (typeof REVIEW_RATINGS)[keyof typeof REVIEW_RATINGS];

export const REVIEW_RATING_VALUES = Object.values(REVIEW_RATINGS);

/**
 * One-word labels for the rating buttons in the review surface. Product
 * decision: `Wrong / Hard / Right / Easy` (rather than FSRS's `Again /
 * Hard / Good / Easy`). Keep the map single-sourced so session-runner and
 * `/memory/review` stay consistent.
 */
export const REVIEW_RATING_LABELS: Record<ReviewRating, string> = {
	[REVIEW_RATINGS.AGAIN]: 'Wrong',
	[REVIEW_RATINGS.HARD]: 'Hard',
	[REVIEW_RATINGS.GOOD]: 'Right',
	[REVIEW_RATINGS.EASY]: 'Easy',
};

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
	[CONFIDENCE_LEVELS.WILD_GUESS]: 'No idea',
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
 * Hard cap on how many confidence-tagged points the calibration loader reads
 * per leg (review / rep). The calibration summary + trend are dominated by
 * the last few thousand items; scanning every historical row for a long-
 * running account turns a cheap dashboard panel into an unbounded full-user-
 * history read. Cap generously (10k per leg, 20k combined) so the score and
 * trend stay accurate on any realistic account while putting an upper bound
 * on the memory footprint.
 */
export const CALIBRATION_MAX_HISTORY = 10_000;

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

/** Allowed browse page-size values. Must include `BROWSE_PAGE_SIZE`. */
export const BROWSE_PAGE_SIZE_VALUES = [10, 25, 50, 100] as const;
export type BrowsePageSize = (typeof BROWSE_PAGE_SIZE_VALUES)[number];

/** Allowed group-by buckets for the Browse list. `'none'` = flat list. */
export const BROWSE_GROUP_BY_VALUES = ['none', 'domain', 'type', 'source', 'status', 'state'] as const;
export type BrowseGroupBy = (typeof BROWSE_GROUP_BY_VALUES)[number];

export const BROWSE_GROUP_BY_LABELS: Record<BrowseGroupBy, string> = {
	none: 'No grouping',
	domain: 'Domain',
	type: 'Type',
	source: 'Source',
	status: 'Status',
	state: 'Schedule state',
};

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
 * Certifications a knowledge node can be relevant at. Stored per-node as a
 * single `minimum_cert` (the lowest cert that requires the topic in its
 * ACS/PTS / operating privileges). Higher certs inherit it through
 * `CERT_PREREQUISITES`. Not to be confused with specific ratings or
 * endorsements; this is the cert framework itself.
 *
 * `CERTS` is a curated *subset* of {@link CERT_APPLICABILITIES} from
 * `reference-tags.ts` -- the four cert goals the study-plan dashboard targets
 * today (private / instrument / commercial / cfi). The canonical value strings
 * live in `CERT_APPLICABILITIES`; keeping the keys here as the short aviation
 * acronym (PPL/IR/CPL/CFI) preserves dashboard call-sites and authoring ergonomics
 * while routing all data through one source of truth.
 */
export const CERTS = {
	PPL: CERT_APPLICABILITIES.PRIVATE,
	IR: CERT_APPLICABILITIES.INSTRUMENT,
	CPL: CERT_APPLICABILITIES.COMMERCIAL,
	CFI: CERT_APPLICABILITIES.CFI,
} as const;

export type Cert = (typeof CERTS)[keyof typeof CERTS];

export const CERT_VALUES: readonly Cert[] = Object.values(CERTS);

/**
 * Human-readable labels for certs. Short-form aviation acronym matches the
 * authored YAML key style and dashboard column headers. Drives display only;
 * storage uses the canonical lowercase {@link CertApplicability} value.
 */
export const CERT_LABELS: Record<Cert, string> = {
	[CERTS.PPL]: 'PPL',
	[CERTS.IR]: 'IR',
	[CERTS.CPL]: 'CPL',
	[CERTS.CFI]: 'CFI',
};

/**
 * Cert hierarchy for mastery + browse filtering.
 *
 * Each cert maps to the set of certs whose knowledge it inherits (its
 * prerequisites *and* the cert itself). A holder of cert C needs every node
 * whose `minimum_cert` is in `CERT_PREREQUISITES[C]`.
 *
 * IFR and CPL are siblings (both require PPL, neither requires the other).
 * A pure-CPL pilot (CPL without IFR) doesn't need IFR-floor topics; a
 * pure-IFR pilot (PPL+IFR, no CPL) doesn't need CPL-floor topics. CFI
 * requires CPL plus IFR for the instrument-instructor add-on, so the CFI
 * inheritance set covers everything.
 *
 * @deprecated Once the `credential` DAG is seeded (cert-syllabus WP), use
 * `getCertsCoveredBy(db, credentialId)` from `@ab/bc-study`. Retained as a
 * fast-path for the four-cert dashboard subset until the engine cutover.
 */
export const CERT_PREREQUISITES: Record<Cert, readonly Cert[]> = {
	[CERTS.PPL]: [CERTS.PPL],
	[CERTS.IR]: [CERTS.PPL, CERTS.IR],
	[CERTS.CPL]: [CERTS.PPL, CERTS.CPL],
	[CERTS.CFI]: [CERTS.PPL, CERTS.IR, CERTS.CPL, CERTS.CFI],
};

/**
 * Returns the certs whose knowledge a holder of `cert` is responsible for.
 * Includes `cert` itself.
 */
export function certsCoveredBy(cert: Cert): readonly Cert[] {
	return CERT_PREREQUISITES[cert];
}

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
 * Study priority for a knowledge node. Every node on a learner's surface is
 * already on the ACS/PTS for their cert -- "must-know" is the regulatory
 * default. This field expresses *study-time allocation*, not testability.
 *
 * - `critical`  -- safety-of-flight or examiner-favorite. "If you only have 30 minutes."
 * - `standard`  -- everything else on the ACS/PTS for the minimum cert. Default.
 * - `stretch`   -- useful adjacent knowledge below or beyond the strict ACS scope.
 */
export const STUDY_PRIORITIES = {
	CRITICAL: 'critical',
	STANDARD: 'standard',
	STRETCH: 'stretch',
} as const;

export type StudyPriority = (typeof STUDY_PRIORITIES)[keyof typeof STUDY_PRIORITIES];

export const STUDY_PRIORITY_VALUES = Object.values(STUDY_PRIORITIES);

export const STUDY_PRIORITY_LABELS: Record<StudyPriority, string> = {
	[STUDY_PRIORITIES.CRITICAL]: 'Critical',
	[STUDY_PRIORITIES.STANDARD]: 'Standard',
	[STUDY_PRIORITIES.STRETCH]: 'Stretch',
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

/**
 * Default session mode when a plan / form hasn't specified one. Centralises
 * the "mixed is the default" product decision so flipping it (e.g. to
 * `continue`) only touches this constant.
 */
export const DEFAULT_SESSION_MODE: SessionMode = SESSION_MODES.MIXED;

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
	STRENGTHEN_SIM_WEAKNESS_CARD: 'strengthen_sim_weakness_card',
	STRENGTHEN_SIM_WEAKNESS_REP: 'strengthen_sim_weakness_rep',
	EXPAND_UNSTARTED_READY: 'expand_unstarted_ready',
	EXPAND_UNSTARTED_PRIORITY: 'expand_unstarted_priority',
	EXPAND_FOCUS_MATCH: 'expand_focus_match',
	DIVERSIFY_UNUSED_DOMAIN: 'diversify_unused_domain',
	DIVERSIFY_CROSS_DOMAIN_APPLY: 'diversify_cross_domain_apply',
} as const;

export type SessionReasonCode = (typeof SESSION_REASON_CODES)[keyof typeof SESSION_REASON_CODES];

export const SESSION_REASON_CODE_VALUES = Object.values(SESSION_REASON_CODES);

/**
 * Plain-English explanations of each reason code. Consumed by the
 * `/session/start` InfoTips and the `session-start` help page table so the
 * chip label ("Overdue") has a one-click "what does that mean?" path.
 * Update both LABELS and DEFINITIONS when adding a new reason code.
 */
export const SESSION_REASON_CODE_DEFINITIONS: Record<SessionReasonCode, string> = {
	[SESSION_REASON_CODES.CONTINUE_RECENT_DOMAIN]:
		'This item lives in a domain you studied in your last session or two. Continuing there builds momentum in that topic.',
	[SESSION_REASON_CODES.CONTINUE_DUE_IN_DOMAIN]:
		'This card is coming due and happens to be in a domain you just touched. Good overlap between the scheduler and your current focus.',
	[SESSION_REASON_CODES.CONTINUE_UNFINISHED_NODE]:
		'You started learning this knowledge node recently but did not finish all seven phases. Continuing closes the loop.',
	[SESSION_REASON_CODES.STRENGTHEN_RELEARNING]:
		'FSRS marked this card as relearning after a recent Again rating. It needs a few short-interval reviews before it stabilises again.',
	[SESSION_REASON_CODES.STRENGTHEN_RATED_AGAIN]:
		'You rated this Again within the last few sessions. Surfacing it now catches the memory before it collapses further.',
	[SESSION_REASON_CODES.STRENGTHEN_OVERDUE]:
		'This card passed its FSRS due date more than the grace period ago. Each day overdue erodes the stability estimate, so the sooner the better.',
	[SESSION_REASON_CODES.STRENGTHEN_LOW_REP_ACCURACY]:
		'Your accuracy on reps in this domain has dropped below the threshold. Targeted practice here restores judgment before deeper work.',
	[SESSION_REASON_CODES.STRENGTHEN_MASTERY_DROP]:
		'This node crossed back from mastered to not-mastered because the dual-gate (card stability and rep accuracy) slipped. It needs reinforcement.',
	[SESSION_REASON_CODES.STRENGTHEN_SIM_WEAKNESS_CARD]:
		'You have been grading low on a sim scenario that exercises this knowledge. Surfacing the card now ties the study queue back to your recent flight evidence.',
	[SESSION_REASON_CODES.STRENGTHEN_SIM_WEAKNESS_REP]:
		'A sim scenario tied to this rep has been grading low recently. The rep is here so the judgment behind the maneuver gets practised before the next flight.',
	[SESSION_REASON_CODES.EXPAND_UNSTARTED_READY]:
		'All the prerequisite knowledge nodes for this one are mastered. You are ready to learn it.',
	[SESSION_REASON_CODES.EXPAND_UNSTARTED_PRIORITY]:
		'This is a core topic for your cert goals and you have not started it yet. Core knowledge is non-negotiable; this makes the queue.',
	[SESSION_REASON_CODES.EXPAND_FOCUS_MATCH]:
		'This node matches the focus domain you set for this session. You asked for more of this; you are getting more of this.',
	[SESSION_REASON_CODES.DIVERSIFY_UNUSED_DOMAIN]:
		'You have not touched this domain in several sessions. Rotating through it prevents the schedule from collapsing into a single topic.',
	[SESSION_REASON_CODES.DIVERSIFY_CROSS_DOMAIN_APPLY]:
		'This node applies knowledge you already have from another domain. Cross-domain connections are how real pilot judgment forms.',
};

/**
 * Which slice each reason code belongs to. Used by the session-start help
 * page to auto-build the reason-codes table keyed by slice.
 */
export const SESSION_REASON_CODE_SLICE: Record<SessionReasonCode, SessionSlice> = {
	[SESSION_REASON_CODES.CONTINUE_RECENT_DOMAIN]: SESSION_SLICES.CONTINUE,
	[SESSION_REASON_CODES.CONTINUE_DUE_IN_DOMAIN]: SESSION_SLICES.CONTINUE,
	[SESSION_REASON_CODES.CONTINUE_UNFINISHED_NODE]: SESSION_SLICES.CONTINUE,
	[SESSION_REASON_CODES.STRENGTHEN_RELEARNING]: SESSION_SLICES.STRENGTHEN,
	[SESSION_REASON_CODES.STRENGTHEN_RATED_AGAIN]: SESSION_SLICES.STRENGTHEN,
	[SESSION_REASON_CODES.STRENGTHEN_OVERDUE]: SESSION_SLICES.STRENGTHEN,
	[SESSION_REASON_CODES.STRENGTHEN_LOW_REP_ACCURACY]: SESSION_SLICES.STRENGTHEN,
	[SESSION_REASON_CODES.STRENGTHEN_MASTERY_DROP]: SESSION_SLICES.STRENGTHEN,
	[SESSION_REASON_CODES.STRENGTHEN_SIM_WEAKNESS_CARD]: SESSION_SLICES.STRENGTHEN,
	[SESSION_REASON_CODES.STRENGTHEN_SIM_WEAKNESS_REP]: SESSION_SLICES.STRENGTHEN,
	[SESSION_REASON_CODES.EXPAND_UNSTARTED_READY]: SESSION_SLICES.EXPAND,
	[SESSION_REASON_CODES.EXPAND_UNSTARTED_PRIORITY]: SESSION_SLICES.EXPAND,
	[SESSION_REASON_CODES.EXPAND_FOCUS_MATCH]: SESSION_SLICES.EXPAND,
	[SESSION_REASON_CODES.DIVERSIFY_UNUSED_DOMAIN]: SESSION_SLICES.DIVERSIFY,
	[SESSION_REASON_CODES.DIVERSIFY_CROSS_DOMAIN_APPLY]: SESSION_SLICES.DIVERSIFY,
};

export const SESSION_REASON_CODE_LABELS: Record<SessionReasonCode, string> = {
	[SESSION_REASON_CODES.CONTINUE_RECENT_DOMAIN]: 'Recent domain',
	[SESSION_REASON_CODES.CONTINUE_DUE_IN_DOMAIN]: 'Due in recent domain',
	[SESSION_REASON_CODES.CONTINUE_UNFINISHED_NODE]: 'Unfinished node',
	[SESSION_REASON_CODES.STRENGTHEN_RELEARNING]: 'Relearning',
	[SESSION_REASON_CODES.STRENGTHEN_RATED_AGAIN]: 'Rated Again recently',
	[SESSION_REASON_CODES.STRENGTHEN_OVERDUE]: 'Overdue',
	[SESSION_REASON_CODES.STRENGTHEN_LOW_REP_ACCURACY]: 'Low rep accuracy',
	[SESSION_REASON_CODES.STRENGTHEN_MASTERY_DROP]: 'Mastery dropping',
	[SESSION_REASON_CODES.STRENGTHEN_SIM_WEAKNESS_CARD]: 'Recent sim weakness',
	[SESSION_REASON_CODES.STRENGTHEN_SIM_WEAKNESS_REP]: 'Recent sim weakness',
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
export const RESUME_WINDOW_MS = 2 * MS_PER_HOUR;

export const SESSION_SLICE_LABELS: Record<SessionSlice, string> = {
	[SESSION_SLICES.CONTINUE]: 'Continue where you left off',
	[SESSION_SLICES.STRENGTHEN]: 'Strengthen',
	[SESSION_SLICES.EXPAND]: 'Expand',
	[SESSION_SLICES.DIVERSIFY]: 'Diversify',
};

/**
 * Dual-gate mastery outcome per pillar (card pillar + rep pillar). See
 * `libs/bc/study/src/knowledge.ts` and the knowledge-graph spec
 * "Mastery computation" section.
 */
export const NODE_MASTERY_GATES = {
	PASS: 'pass',
	FAIL: 'fail',
	INSUFFICIENT_DATA: 'insufficient_data',
	NOT_APPLICABLE: 'not_applicable',
} as const;

export type NodeMasteryGate = (typeof NODE_MASTERY_GATES)[keyof typeof NODE_MASTERY_GATES];

export const NODE_MASTERY_GATE_VALUES: readonly NodeMasteryGate[] = Object.values(NODE_MASTERY_GATES);

/**
 * Human-readable labels for each mastery-gate outcome. Used by the
 * knowledge detail page's gate badges; single-sourced so renames don't
 * drift.
 */
export const NODE_MASTERY_GATE_LABELS: Record<NodeMasteryGate, string> = {
	[NODE_MASTERY_GATES.PASS]: 'Pass',
	[NODE_MASTERY_GATES.FAIL]: 'Fail',
	[NODE_MASTERY_GATES.INSUFFICIENT_DATA]: 'Not enough data',
	[NODE_MASTERY_GATES.NOT_APPLICABLE]: 'Not applicable',
};

/**
 * Phases for a single item's review interaction in `/memory/review` --
 * front shown, confidence captured, answer graded, network submit, batch
 * complete. Local to the review surface.
 */
export const REVIEW_PHASES = {
	FRONT: 'front',
	CONFIDENCE: 'confidence',
	ANSWER: 'answer',
	SUBMITTING: 'submitting',
	COMPLETE: 'complete',
} as const;

export type ReviewPhase = (typeof REVIEW_PHASES)[keyof typeof REVIEW_PHASES];

export const REVIEW_PHASE_VALUES: readonly ReviewPhase[] = Object.values(REVIEW_PHASES);

/**
 * Phases inside a session-runner slot (`/sessions/[id]`). A slot progresses
 * read -> confidence -> answer, then advances or skips.
 */
export const SESSION_ITEM_PHASES = {
	READ: 'read',
	CONFIDENCE: 'confidence',
	ANSWER: 'answer',
} as const;

export type SessionItemPhase = (typeof SESSION_ITEM_PHASES)[keyof typeof SESSION_ITEM_PHASES];

export const SESSION_ITEM_PHASE_VALUES: readonly SessionItemPhase[] = Object.values(SESSION_ITEM_PHASES);

// -------- Memory-review sessions (bundle-b, review-sessions-url layer a) --------

/**
 * Lifecycle states for a `memory_review_session` row.
 *
 * A session is `active` while the learner is progressing through its frozen
 * card list, `completed` once `current_index` reaches the end of the list,
 * and `abandoned` if `last_activity_at` is more than
 * {@link REVIEW_SESSION_ABANDON_MS} in the past. The abandoned status is
 * computed lazily on visit via `abandonStaleSessions` so the dashboard can
 * surface "resumable but stale" runs without a background job.
 */
export const REVIEW_SESSION_STATUSES = {
	ACTIVE: 'active',
	COMPLETED: 'completed',
	ABANDONED: 'abandoned',
} as const;

export type ReviewSessionStatus = (typeof REVIEW_SESSION_STATUSES)[keyof typeof REVIEW_SESSION_STATUSES];

export const REVIEW_SESSION_STATUS_VALUES: readonly ReviewSessionStatus[] = Object.values(REVIEW_SESSION_STATUSES);

/**
 * Window after which an inactive review session is flagged as `abandoned`.
 * Per `docs/work-packages/review-sessions-url/spec.md` decision 3 (no hard
 * expiry; mark abandoned at 14 days). The dashboard still offers a resume
 * link for abandoned sessions; this is a surface-level categorisation, not a
 * delete.
 */
export const REVIEW_SESSION_ABANDON_MS = 14 * MS_PER_DAY;

/**
 * Length of the canonical deck-spec hash stored on
 * `memory_review_session.deck_hash` and used to bucket "all runs of the same
 * deck" for the Saved Decks surface + future analytics. First N hex chars of
 * SHA-1(canonical JSON). 8 chars is plenty given we only need to distinguish
 * a per-user handful of saved decks.
 *
 * See `docs/work-packages/review-sessions-url/spec.md` product decision (2).
 */
export const DECK_HASH_LENGTH = 8;

/**
 * Maximum length of a user-supplied label for a saved deck. Stored on the
 * `study.saved_deck` row when present and overrides the auto-derived
 * `summarizeDeckSpec()` summary in the dashboard list. Bounded so the UI row
 * stays single-line and the column is cheap to index.
 */
export const SAVED_DECK_LABEL_MAX_LENGTH = 80;

/**
 * Copy strings for the Saved Decks rename + delete affordances. Live in
 * constants so the route action, the UI, and any future toast / confirmation
 * banner share one source of truth.
 */
export const SAVED_DECK_COPY = {
	RENAME_TRIGGER: 'Rename',
	RENAME_LABEL_INPUT: 'Deck name',
	RENAME_PLACEHOLDER: 'Custom name (leave blank to clear)',
	RENAME_SAVE: 'Save',
	RENAME_CANCEL: 'Cancel',
	RENAME_CLEAR: 'Reset to default',
	DELETE_TRIGGER: 'Delete',
	DELETE_CONFIRM: 'Delete deck',
	DELETE_HINT:
		'Removes this saved deck from the list. Past runs are kept; the deck reappears if you run the same filter again.',
	LABEL_TOO_LONG: `Deck name must be ${SAVED_DECK_LABEL_MAX_LENGTH} characters or fewer.`,
	NOT_FOUND: 'Saved deck not found.',
} as const;

// -------- Snooze + card feedback (Bundle A -- snooze-and-flag WP) --------

/**
 * Why a learner pushed a card out of their deck. Drives the `study.card_snooze`
 * row lifecycle and the replacement policy:
 *
 * - `bad-question`  -- comment required; snoozes until author edits the card.
 * - `wrong-domain`  -- comment required; long snooze (60d default).
 * - `know-it-bored` -- no comment; three duration levels (short/medium/long).
 * - `remove`        -- comment required; soft-removal with no `snooze_until`.
 *
 * See `docs/work-packages/snooze-and-flag/spec.md` product decision (1).
 */
export const SNOOZE_REASONS = {
	BAD_QUESTION: 'bad-question',
	WRONG_DOMAIN: 'wrong-domain',
	KNOW_IT_BORED: 'know-it-bored',
	REMOVE: 'remove',
} as const;

export type SnoozeReason = (typeof SNOOZE_REASONS)[keyof typeof SNOOZE_REASONS];

export const SNOOZE_REASON_VALUES = Object.values(SNOOZE_REASONS);

export const SNOOZE_REASON_LABELS: Record<SnoozeReason, string> = {
	[SNOOZE_REASONS.BAD_QUESTION]: 'Bad question',
	[SNOOZE_REASONS.WRONG_DOMAIN]: 'Wrong domain',
	[SNOOZE_REASONS.KNOW_IT_BORED]: 'Know it (bored)',
	[SNOOZE_REASONS.REMOVE]: 'Remove from deck',
};

/**
 * One-line descriptions for the snooze reason popover. Each reason drives a
 * different lifecycle; surface the consequence rather than the label.
 */
export const SNOOZE_REASON_DESCRIPTIONS: Record<SnoozeReason, string> = {
	[SNOOZE_REASONS.BAD_QUESTION]:
		'Flag this question for author review. The card returns with a banner once it has been edited.',
	[SNOOZE_REASONS.WRONG_DOMAIN]: 'This card belongs in a different topic. Long snooze while it is retagged.',
	[SNOOZE_REASONS.KNOW_IT_BORED]: 'You know it; push it out to free the queue for something useful.',
	[SNOOZE_REASONS.REMOVE]: 'Soft-remove from your deck. Reversible from Browse.',
};

/** Reasons that require a free-text comment from the learner. */
export const SNOOZE_REASONS_REQUIRING_COMMENT: readonly SnoozeReason[] = [
	SNOOZE_REASONS.BAD_QUESTION,
	SNOOZE_REASONS.WRONG_DOMAIN,
	SNOOZE_REASONS.REMOVE,
];

/**
 * Snooze duration levels (short / medium / long). Values are authoritative:
 * `know-it-bored` defaults to medium, `wrong-domain` to long, `bad-question`
 * to medium (with "until fixed" override by setting `snooze_until = NULL`).
 * `remove` has no duration. See spec product decision (4).
 */
export const SNOOZE_DURATION_LEVELS = {
	SHORT: 'short',
	MEDIUM: 'medium',
	LONG: 'long',
} as const;

export type SnoozeDurationLevel = (typeof SNOOZE_DURATION_LEVELS)[keyof typeof SNOOZE_DURATION_LEVELS];

export const SNOOZE_DURATION_LEVEL_VALUES = Object.values(SNOOZE_DURATION_LEVELS);

export const SNOOZE_DURATION_DAYS: Record<SnoozeDurationLevel, number> = {
	[SNOOZE_DURATION_LEVELS.SHORT]: 3,
	[SNOOZE_DURATION_LEVELS.MEDIUM]: 14,
	[SNOOZE_DURATION_LEVELS.LONG]: 60,
};

export const SNOOZE_DURATION_LEVEL_LABELS: Record<SnoozeDurationLevel, string> = {
	[SNOOZE_DURATION_LEVELS.SHORT]: 'Short (3 days)',
	[SNOOZE_DURATION_LEVELS.MEDIUM]: 'Medium (14 days)',
	[SNOOZE_DURATION_LEVELS.LONG]: 'Long (60 days)',
};

/**
 * Per-reason default duration level. The popover pre-selects this when the
 * user picks a reason; they can override for `know-it-bored`.
 */
export const SNOOZE_DEFAULT_DURATION: Record<SnoozeReason, SnoozeDurationLevel | null> = {
	[SNOOZE_REASONS.BAD_QUESTION]: SNOOZE_DURATION_LEVELS.MEDIUM,
	[SNOOZE_REASONS.WRONG_DOMAIN]: SNOOZE_DURATION_LEVELS.LONG,
	[SNOOZE_REASONS.KNOW_IT_BORED]: SNOOZE_DURATION_LEVELS.MEDIUM,
	[SNOOZE_REASONS.REMOVE]: null,
};

/**
 * Per-card content feedback. Separate from recall rating (see `REVIEW_RATINGS`)
 * and from the schedule-altering `SNOOZE_REASONS`. A `flag` feeds the same
 * author-review surface as a `bad-question` snooze.
 */
export const CARD_FEEDBACK_SIGNALS = {
	LIKE: 'like',
	DISLIKE: 'dislike',
	FLAG: 'flag',
} as const;

export type CardFeedbackSignal = (typeof CARD_FEEDBACK_SIGNALS)[keyof typeof CARD_FEEDBACK_SIGNALS];

export const CARD_FEEDBACK_SIGNAL_VALUES = Object.values(CARD_FEEDBACK_SIGNALS);

export const CARD_FEEDBACK_SIGNAL_LABELS: Record<CardFeedbackSignal, string> = {
	[CARD_FEEDBACK_SIGNALS.LIKE]: 'Like',
	[CARD_FEEDBACK_SIGNALS.DISLIKE]: 'Dislike',
	[CARD_FEEDBACK_SIGNALS.FLAG]: 'Flag',
};

/** Feedback signals that require a free-text comment. */
export const CARD_FEEDBACK_SIGNALS_REQUIRING_COMMENT: readonly CardFeedbackSignal[] = [
	CARD_FEEDBACK_SIGNALS.DISLIKE,
	CARD_FEEDBACK_SIGNALS.FLAG,
];

/**
 * How long the undo toast stays visible after a rating. Spec decision (4):
 * undo reverts the last card's rating + confidence together; a 10 second
 * window balances "noticed the fat-finger" against "clutters the next card".
 */
export const REVIEW_UNDO_WINDOW_MS = 10_000;

/**
 * Status filter for memory browse that surfaces soft-removed cards. Distinct
 * from `CARD_STATUSES` (the card lifecycle enum) because removal is tracked
 * via an open `card_snooze(reason='remove')` row, not as a card.status value.
 * The browse page treats `removed` as a virtual status that triggers a
 * different query path in `getCards`.
 */
export const BROWSE_STATUS_REMOVED = 'removed' as const;
export type BrowseStatusFilter = CardStatus | typeof BROWSE_STATUS_REMOVED;
export const BROWSE_STATUS_FILTER_VALUES: readonly BrowseStatusFilter[] = [
	...CARD_STATUS_VALUES,
	BROWSE_STATUS_REMOVED,
];
export const BROWSE_STATUS_FILTER_LABELS: Record<BrowseStatusFilter, string> = {
	...CARD_STATUS_LABELS,
	[BROWSE_STATUS_REMOVED]: 'Removed',
};

// -------- Handbook ingestion + reader (handbook-ingestion-and-reader WP) --------

/**
 * Storage discriminator for `study.reference` rows and the structured
 * `Citation` discriminated union on `knowledge_node.references`. Peer to
 * `REFERENCE_SOURCE_TYPES` in `reference-tags.ts` (the 5-axis tagging
 * vocabulary); they overlap deliberately. The cert-syllabus WP collapses
 * them into one once both lifecycles are stable. See ADR 016 + WP design.
 */
export const REFERENCE_KINDS = {
	HANDBOOK: 'handbook',
	CFR: 'cfr',
	AC: 'ac',
	ACS: 'acs',
	PTS: 'pts',
	AIM: 'aim',
	PCG: 'pcg',
	NTSB: 'ntsb',
	POH: 'poh',
	OTHER: 'other',
} as const;

export type ReferenceKind = (typeof REFERENCE_KINDS)[keyof typeof REFERENCE_KINDS];

export const REFERENCE_KIND_VALUES = Object.values(REFERENCE_KINDS);

export const REFERENCE_KIND_LABELS: Record<ReferenceKind, string> = {
	[REFERENCE_KINDS.HANDBOOK]: 'Handbook',
	[REFERENCE_KINDS.CFR]: 'CFR',
	[REFERENCE_KINDS.AC]: 'Advisory Circular',
	[REFERENCE_KINDS.ACS]: 'ACS',
	[REFERENCE_KINDS.PTS]: 'PTS',
	[REFERENCE_KINDS.AIM]: 'AIM',
	[REFERENCE_KINDS.PCG]: 'Pilot/Controller Glossary',
	[REFERENCE_KINDS.NTSB]: 'NTSB',
	[REFERENCE_KINDS.POH]: 'POH',
	[REFERENCE_KINDS.OTHER]: 'Other',
};

/**
 * External-citation URL templates. The `resolveCitationUrl` resolver in
 * `@ab/bc-study handbooks.ts` consumes these for non-handbook citation kinds.
 * Centralised here so a URL change (eCFR rebrand, FAA AIM reorganisation)
 * is a one-file fix.
 *
 * Each template is a function from the relevant locator fields to a URL.
 * Functions return `null` when the locator is too sparse to build a useful
 * URL (e.g. a CFR citation with no section, an AIM citation with no
 * paragraph). Callers must check for null and fall back to the kind's
 * landing page or render no link.
 */
export const CITATION_URL_TEMPLATES = {
	/** eCFR URL for a 14 CFR / 49 CFR section. Title 14 example: 14 CFR 91.103. */
	CFR: (title: number, part: number, section: string): string =>
		`https://www.ecfr.gov/current/title-${title}/chapter-I/part-${part}/section-${part}.${encodeURIComponent(section)}`,
	/** FAA Advisory Circular index. The site has no per-paragraph deep link. */
	AC_INDEX: 'https://www.faa.gov/regulations_policies/advisory_circulars/',
	/** FAA test-standards (ACS / PTS) landing page; per-cert URLs live in `@ab/sources` ACS_CERT_LIVE_URLS. */
	ACS_INDEX: 'https://www.faa.gov/training_testing/testing/acs',
	/** FAA AIM landing page. Per-paragraph deep links not provided by FAA. */
	AIM_INDEX: 'https://www.faa.gov/air_traffic/publications/atpubs/aim_html/',
	/** FAA Pilot/Controller Glossary landing. Per-term deep links not provided. */
	PCG_INDEX: 'https://www.faa.gov/air_traffic/publications/atpubs/pcg_html/',
	/** NTSB accident database search landing. */
	NTSB_INDEX: 'https://www.ntsb.gov/Pages/AviationQueryV2.aspx',
} as const;

/**
 * `handbook_section.level`. A section row is one of: a chapter (top-level,
 * `parent_id IS NULL`), a section (direct child of a chapter), or a
 * subsection (child of a section).
 */
export const HANDBOOK_SECTION_LEVELS = {
	CHAPTER: 'chapter',
	SECTION: 'section',
	SUBSECTION: 'subsection',
} as const;

export type HandbookSectionLevel = (typeof HANDBOOK_SECTION_LEVELS)[keyof typeof HANDBOOK_SECTION_LEVELS];

export const HANDBOOK_SECTION_LEVEL_VALUES = Object.values(HANDBOOK_SECTION_LEVELS);

export const HANDBOOK_SECTION_LEVEL_LABELS: Record<HandbookSectionLevel, string> = {
	[HANDBOOK_SECTION_LEVELS.CHAPTER]: 'Chapter',
	[HANDBOOK_SECTION_LEVELS.SECTION]: 'Section',
	[HANDBOOK_SECTION_LEVELS.SUBSECTION]: 'Subsection',
};

/**
 * `handbook_read_state.status`. Three-state per spec Open Question 4:
 * `unread` (default; no read-state row exists yet, or the user re-read),
 * `reading` (heartbeat or first open has fired), `read` (user marked it).
 *
 * Plus a separate `comprehended` boolean tracks "read but didn't get it";
 * see schema docs.
 */
export const HANDBOOK_READ_STATUSES = {
	UNREAD: 'unread',
	READING: 'reading',
	READ: 'read',
} as const;

export type HandbookReadStatus = (typeof HANDBOOK_READ_STATUSES)[keyof typeof HANDBOOK_READ_STATUSES];

export const HANDBOOK_READ_STATUS_VALUES = Object.values(HANDBOOK_READ_STATUSES);

export const HANDBOOK_READ_STATUS_LABELS: Record<HandbookReadStatus, string> = {
	[HANDBOOK_READ_STATUSES.UNREAD]: 'Unread',
	[HANDBOOK_READ_STATUSES.READING]: 'Reading',
	[HANDBOOK_READ_STATUSES.READ]: 'Read',
};

/** ID prefixes for the handbook tables (composed via `@ab/utils createId`). */
export const REFERENCE_ID_PREFIX = 'ref';
export const HANDBOOK_SECTION_ID_PREFIX = 'hbs';
export const HANDBOOK_FIGURE_ID_PREFIX = 'hbf';

/**
 * Heartbeat + suggestion-prompt thresholds (spec Open Question 5).
 *
 * Defaults are starting numbers; tuning lives in this single file because
 * no code branches on the number. The reader posts a heartbeat every
 * `HANDBOOK_HEARTBEAT_INTERVAL_SEC` seconds when the section page is
 * visible. The "Mark this section as read?" prompt shows once
 * `open_seconds_in_session >= HANDBOOK_SUGGEST_OPEN_SECONDS` AND
 * `total_seconds_visible >= HANDBOOK_SUGGEST_TOTAL_SECONDS` AND
 * (when {@link HANDBOOK_SUGGEST_REQUIRES_SCROLL_END} is true) the user
 * has reached the bottom of the section.
 */
export const HANDBOOK_HEARTBEAT_INTERVAL_SEC = 15;
export const HANDBOOK_SUGGEST_OPEN_SECONDS = 60;
export const HANDBOOK_SUGGEST_TOTAL_SECONDS = 90;
export const HANDBOOK_SUGGEST_REQUIRES_SCROLL_END = true;

/**
 * Maximum number of buffered heartbeats while the network is offline.
 * 12 * 15s = ~3 minutes of offline time before the oldest heartbeat is
 * dropped. Tuning lives here so a future "double the buffer" lands in
 * one place and the reader-spec test still keys off the constant.
 */
export const HANDBOOK_HEARTBEAT_BUFFER = 12;

/**
 * Minimum heartbeat delta accepted by the server. Anti-flood floor; a
 * client that posts more often than this is throttled to avoid pathological
 * counter inflation.
 */
export const HANDBOOK_HEARTBEAT_MIN_DELTA_SEC = 5;

/**
 * Hard cap on per-user notes per section. The BC validator + the DB
 * CHECK both reference this; the UI surfaces a friendly message when
 * the user tries to paste a wall of text.
 */
export const HANDBOOK_NOTES_MAX_LENGTH = 16384;
