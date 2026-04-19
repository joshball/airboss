/**
 * Constants for the study BC -- spaced memory items, decision reps, calibration.
 *
 * Domains align (loosely for now) with the knowledge-graph taxonomy described
 * in ADR 011. Once the graph lands, this list becomes a projection of the
 * graph's domain taxonomy rather than an authoritative constant.
 */

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
