/**
 * Closed enums for the help-content tag taxonomy.
 *
 * Two required axes + optional keyword freeform:
 *   - `appSurface` (required, multi 1-3): which surface this page documents
 *   - `helpKind` (required, single): what kind of help this page is
 *   - `keywords` (optional, 0-12, same shape rules as aviation)
 *
 * Aviation `aviationTopic` is intentionally available for re-use on help
 * pages that happen to cover aviation content; the enum lives in
 * `reference-tags.ts` and this module does not duplicate it.
 *
 * Rationale: matches the tag-axis pattern established for the reference
 * system (see `reference-tags.ts`) so the cross-library search facade in
 * `@ab/help` can dedupe axes across both libraries without special-casing.
 */

// -------- 1. appSurface (required, multi-valued, 1-3) --------

export const APP_SURFACES = {
	DASHBOARD: 'dashboard',
	MEMORY: 'memory',
	REPS: 'reps',
	CALIBRATION: 'calibration',
	KNOWLEDGE: 'knowledge',
	SESSION: 'session',
	PLANS: 'plans',
	CREDENTIALS: 'credentials',
	GLOBAL: 'global',
} as const;

export type AppSurface = (typeof APP_SURFACES)[keyof typeof APP_SURFACES];

export const APP_SURFACE_VALUES: readonly AppSurface[] = Object.values(APP_SURFACES);

export const APP_SURFACE_LABELS: Record<AppSurface, string> = {
	[APP_SURFACES.DASHBOARD]: 'Dashboard',
	[APP_SURFACES.MEMORY]: 'Memory',
	[APP_SURFACES.REPS]: 'Reps',
	[APP_SURFACES.CALIBRATION]: 'Calibration',
	[APP_SURFACES.KNOWLEDGE]: 'Knowledge',
	[APP_SURFACES.SESSION]: 'Session',
	[APP_SURFACES.PLANS]: 'Plans',
	[APP_SURFACES.CREDENTIALS]: 'Credentials',
	[APP_SURFACES.GLOBAL]: 'Global',
};

export const APP_SURFACE_MIN = 1;
export const APP_SURFACE_MAX = 3;

// -------- 2. helpKind (required, single-valued) --------

export const HELP_KINDS = {
	CONCEPT: 'concept',
	HOW_TO: 'how-to',
	TROUBLESHOOTING: 'troubleshooting',
	REFERENCE: 'reference',
} as const;

export type HelpKind = (typeof HELP_KINDS)[keyof typeof HELP_KINDS];

export const HELP_KIND_VALUES: readonly HelpKind[] = Object.values(HELP_KINDS);

export const HELP_KIND_LABELS: Record<HelpKind, string> = {
	[HELP_KINDS.CONCEPT]: 'Concept',
	[HELP_KINDS.HOW_TO]: 'How-to',
	[HELP_KINDS.TROUBLESHOOTING]: 'Troubleshooting',
	[HELP_KINDS.REFERENCE]: 'Reference',
};

// -------- 3. conceptGroup (optional; concept-page-only) --------

/**
 * Grouping axis for the `/help/concepts` index. Only meaningful on pages
 * where `concept === true`. The concepts route groups cards by this value;
 * pages without a group fall into `airboss-architecture` for display.
 */
export const CONCEPT_GROUPS = {
	LEARNING_SCIENCE: 'learning-science',
	AIRBOSS_ARCHITECTURE: 'airboss-architecture',
	AVIATION_DOCTRINE: 'aviation-doctrine',
} as const;

export type ConceptGroup = (typeof CONCEPT_GROUPS)[keyof typeof CONCEPT_GROUPS];

export const CONCEPT_GROUP_VALUES: readonly ConceptGroup[] = Object.values(CONCEPT_GROUPS);

export const CONCEPT_GROUP_LABELS: Record<ConceptGroup, string> = {
	[CONCEPT_GROUPS.LEARNING_SCIENCE]: 'Learning science',
	[CONCEPT_GROUPS.AIRBOSS_ARCHITECTURE]: 'Airboss architecture',
	[CONCEPT_GROUPS.AVIATION_DOCTRINE]: 'Aviation doctrine',
};

// -------- 4. keywords (optional) --------
// Reuses the same length + count caps as reference keywords. See
// REFERENCE_KEYWORD_MAX_COUNT / REFERENCE_KEYWORD_MAX_LENGTH in
// reference-tags.ts; those constants are the source of truth the help
// validator also consumes.
