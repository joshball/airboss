/**
 * Weather scenario engine constants.
 *
 * The closed set of production scenario slugs (six total) and the AIRMET-
 * family discriminator the engine emits. Slugs double as scenario id
 * throughout the engine, chart-spec slug prefix
 * (`wx-scenarios/<slug>/<chart>` per ADR 027 PR 3), and cache subdirectory
 * (`cache://scenarios/<slug>/`).
 *
 * See `docs/work-packages/wx-engine/spec.md` and the spike notes at
 * `spikes/wx-engine/01-frontal-xc/spike-notes.md`.
 */

/** Closed enum of registered wx-engine scenario slugs. */
export const WX_SCENARIOS = {
	FRONTAL_XC_MARCH: 'frontal-xc-march',
	SUMMER_THUNDERSTORMS_TX: 'summer-thunderstorms-tx',
	WINTER_ICING_GREAT_LAKES: 'winter-icing-great-lakes',
	MOUNTAIN_WAVE_ROCKIES: 'mountain-wave-rockies',
	MARINE_STRATUS_PACIFIC_NW: 'marine-stratus-pacific-nw',
	DENSE_FOG_RADIATION_CENTRAL_VALLEY: 'dense-fog-radiation-central-valley',
} as const;

export const WX_SCENARIO_VALUES = Object.values(WX_SCENARIOS);

export type WxScenario = (typeof WX_SCENARIO_VALUES)[number];

export const WX_SCENARIO_LABELS: Record<WxScenario, string> = {
	'frontal-xc-march': 'Cold Front Passage - Midwest XC (March)',
	'summer-thunderstorms-tx': 'Summer Pop-up Convection - Texas',
	'winter-icing-great-lakes': 'Winter Lake-Effect Icing - Great Lakes',
	'mountain-wave-rockies': 'Lee-side Mountain Wave - Rockies',
	'marine-stratus-pacific-nw': 'Marine Stratus - Pacific Northwest',
	'dense-fog-radiation-central-valley': 'Radiation Fog - Central Valley',
};

/** AIRMET family discriminator. Drives layer-2 AIRMET derivation labeling. */
export const AIRMET_FAMILIES = {
	SIERRA: 'airmet-sierra',
	TANGO: 'airmet-tango',
	ZULU: 'airmet-zulu',
} as const;

export const AIRMET_FAMILY_VALUES = Object.values(AIRMET_FAMILIES);

export type AirmetFamily = (typeof AIRMET_FAMILY_VALUES)[number];

/**
 * Subcommand names for the `scripts/wx-scenario.ts` dispatcher. Mirrors
 * `scripts/charts.ts`. Used by the dispatcher's switch + the help printer
 * so subcommand strings never appear inline.
 */
export const WX_SCENARIO_SUBCOMMANDS = {
	BUILD: 'build',
	LIST: 'list',
	VALIDATE: 'validate',
	CHECK_ROUND_TRIP: 'check-round-trip',
	DRILL: 'drill',
	CHECK_CATALOG: 'check-catalog',
	COVERAGE: 'coverage',
} as const;

export const WX_SCENARIO_SUBCOMMAND_VALUES = Object.values(WX_SCENARIO_SUBCOMMANDS);

export type WxScenarioSubcommand = (typeof WX_SCENARIO_SUBCOMMAND_VALUES)[number];

/**
 * Closed enum of encoded-text wx product slugs the drill / practice surface
 * understands. Used by `@ab/wx-drill`, `@ab/bc-wx-practice`, and the study
 * app's /practice/wx/drill route to constrain product selection.
 */
export const WX_PRODUCTS = {
	METAR: 'metar',
	TAF: 'taf',
	PIREP: 'pirep',
	FB: 'fb',
	AIRMET: 'airmet',
} as const;

export const WX_PRODUCT_VALUES = Object.values(WX_PRODUCTS);

export type WxProduct = (typeof WX_PRODUCT_VALUES)[number];

export const WX_PRODUCT_LABELS: Record<WxProduct, string> = {
	metar: 'METAR',
	taf: 'TAF',
	pirep: 'PIREP',
	fb: 'Winds and Temps Aloft (FB)',
	airmet: 'AIRMET / SIGMET',
};

/**
 * Per-token-family mastery state machine for `@ab/bc-wx-practice`.
 *
 * - `active`: quizzed normally; default state for new families.
 * - `passive`: shown with decode visible but NOT quizzed -- the student has
 *   demonstrated fluency across N sessions.
 * - `demoted`: recently missed; oversampled in subsequent sessions.
 */
export const WX_PRACTICE_MASTERY_STATES = {
	ACTIVE: 'active',
	PASSIVE: 'passive',
	DEMOTED: 'demoted',
} as const;

export const WX_PRACTICE_MASTERY_STATE_VALUES = Object.values(WX_PRACTICE_MASTERY_STATES);

export type WxPracticeMasteryState = (typeof WX_PRACTICE_MASTERY_STATE_VALUES)[number];

/** Difficulty tier for a drill session. 1-10 per the drill plan. */
export const WX_PRACTICE_TIER_MIN = 1;
export const WX_PRACTICE_TIER_MAX = 10;

/** Per-session item-count options surfaced in the setup screen. */
export const WX_PRACTICE_ITEM_COUNTS = [5, 10, 20, 50] as const;
export type WxPracticeItemCount = (typeof WX_PRACTICE_ITEM_COUNTS)[number];

/**
 * Ring length for `recentRing` in `wx_practice_mastery`. The state machine
 * promotes `active -> passive` when this ring is full of correct answers and
 * `streakAcrossSessions >= WX_PRACTICE_PROMOTION_STREAK`.
 */
export const WX_PRACTICE_RECENT_RING_LENGTH = 10;

/** Cross-session streak required for `active -> passive` promotion. */
export const WX_PRACTICE_PROMOTION_STREAK = 5;

/** Correct attempts in a row required for `demoted -> active` recovery. */
export const WX_PRACTICE_RECOVERY_STREAK = 3;

/**
 * Token families that NEVER auto-master to `passive`. Wide variant spaces
 * (weather phenomena, convective sky-condition, RMK, RVR-paired vis) keep
 * these permanently quizzable. Mirrors the plan's "never auto-master" list.
 */
export const WX_PRACTICE_NEVER_PROMOTE_FAMILIES: readonly string[] = [
	'wx-phenomenon',
	'wx-heavy',
	'wx-thunderstorm',
	'sky-condition-convective',
	'rmk',
	'rmk-slp',
	'rmk-tornadic',
	'vis-with-rvr',
];

/**
 * Question-form discriminator. Drives which renderer the drill UI shows for a
 * given attempt. Stored on `wx_practice_attempt.question_form`.
 */
export const WX_PRACTICE_QUESTION_FORMS = {
	DECODE_TOKEN: 'decode-token',
	DECODE_GROUP: 'decode-group',
	SINGLE_CHOICE: 'single-choice',
	MULTI_CHOICE: 'multi-choice',
	STRUCTURED: 'structured',
} as const;

export const WX_PRACTICE_QUESTION_FORM_VALUES = Object.values(WX_PRACTICE_QUESTION_FORMS);

export type WxPracticeQuestionForm = (typeof WX_PRACTICE_QUESTION_FORM_VALUES)[number];
