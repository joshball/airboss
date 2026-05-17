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
	/** v2 temporal pilot scenario -- cold front under pilot time pressure. */
	FRONTAL_PRESSURE_MARCH: 'frontal-pressure-march',
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
	'frontal-pressure-march': 'Accelerating Cold Front - Pilot Time Pressure (March)',
};

// ----------------------------------------------------------------
// v2 temporal-engine tuning. `sampleTruthAt` (libs/wx-engine/src/truth/time.ts)
// reads these to translate fronts, cells, and air-mass polygons over time and
// to derive the deterministic noise seed. Centralized here so the temporal
// engine carries no inline numeric literals.
// ----------------------------------------------------------------

/** Kilometers per degree of latitude (great-circle approximation). */
export const WX_TEMPORAL_KM_PER_DEG_LAT = 111;
/** Kilometers per nautical mile. */
export const WX_TEMPORAL_KM_PER_NM = 1.852;
/** Milliseconds per hour -- elapsed-time -> distance conversion. */
export const WX_TEMPORAL_MS_PER_HOUR = 3_600_000;
/** Default native step size for temporal derivation (minutes). */
export const WX_TEMPORAL_DEFAULT_STEP_MINUTES = 60;
/** Minimum legal native step size for temporal derivation (minutes). */
export const WX_TEMPORAL_MIN_STEP_MINUTES = 5;

/**
 * Default TAF valid-period length (hours) used when a truth model omits
 * `tafValidHours`. Twelve hours is the FAA standard short-form TAF window;
 * the engine and the consistency validator both fall back to this.
 */
export const WX_DEFAULT_TAF_VALID_HOURS = 12;

/**
 * Named-curve presets for `TemporalCell.intensityCurve`. Each maps the
 * normalized cell-life fraction (0 = genesis, 1 = dissipation) to a
 * reflectivity multiplier applied to the cell's template `peakDbz`.
 *
 * - `building`: ramps from a low value to peak across the life.
 * - `mature`: holds near peak through the middle, tapering at the ends.
 * - `decaying`: starts at peak and falls off.
 */
export const WX_TEMPORAL_CELL_INTENSITY_CURVES = {
	building: { startMul: 0.35, peakMul: 1, endMul: 1, peakFrac: 1 },
	mature: { startMul: 0.6, peakMul: 1, endMul: 0.6, peakFrac: 0.5 },
	decaying: { startMul: 1, peakMul: 1, endMul: 0.25, peakFrac: 0 },
} as const;

export type WxTemporalCellIntensityCurve = keyof typeof WX_TEMPORAL_CELL_INTENSITY_CURVES;

/**
 * `linear-grow-shrink` radius curve endpoints. The cell radius ramps from
 * `startMul * templateRadius` at genesis to `peakMul * templateRadius` at
 * life fraction `peakFrac` and back down to `endMul * templateRadius` at
 * dissipation.
 */
export const WX_TEMPORAL_RADIUS_GROW_SHRINK = {
	startMul: 0.4,
	peakMul: 1,
	endMul: 0.4,
	peakFrac: 0.5,
} as const;

/**
 * Reference cell radius (km) -- the genesis / template scale a named
 * intensity-curve `TemporalCell` is sized against. Matches the gust-front
 * cell scale the v2 pilot scenario uses.
 */
export const WX_TEMPORAL_REFERENCE_CELL_RADIUS_KM = 12;

/**
 * Reference cell peak reflectivity (dBZ) -- the value a named intensity-curve
 * multiplier is applied against. Inline (time, dBZ) curves override this with
 * authored absolute values.
 */
export const WX_TEMPORAL_REFERENCE_CELL_PEAK_DBZ = 45;

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
 * v2 timeline-bundle layout. `bun run wx-scenario build <slug> --timeline`
 * writes the full evolution bundle under `data/wx-scenarios/<slug>/`; these
 * constants name the files + subdirectories so no path string is inlined in
 * the bundle writer. See `docs/work/plans/2026-05-14-truth-model-v2-temporal.md`
 * "Scenario packages".
 */
export const WX_TIMELINE_BUNDLE = {
	/** Every hourly v1 snapshot + per-hour chart-spec references. */
	TIMELINE: 'timeline.json',
	/** Sequence-product subdirectory. */
	PRODUCTS_DIR: 'products',
	/** All stations x all hours. */
	METAR_SEQUENCE: 'metar-sequence.json',
	/** All stations x all issue times. */
	TAF_SEQUENCE: 'taf-sequence.json',
	/** Time-stamped PIREP reports. */
	PIREP_EVENTS: 'pirep-events.json',
	/** Advisory issue/extend/cancel events. */
	AIRMET_TIMELINE: 'airmet-timeline.json',
	/** Per-hour chart-spec subdirectory. */
	CHARTS_DIR: 'charts',
	/**
	 * Per-hour chart-spec filename suffix. Charts are stored as small specs
	 * (`<kind>.spec.yaml`), NOT as rendered SVG -- rendered SVGs are generated
	 * artifacts and stay out of the repo per ADR 018. The replay surface
	 * renders the spec to SVG on demand server-side.
	 */
	CHART_SPEC_SUFFIX: '.spec.yaml',
	/**
	 * Per-hour chart-source subdirectory suffix. A chart `<kind>` keeps its
	 * source-byte JSON files under `<kind>.sources/<name>.json` -- the
	 * `cache://` URIs the spec references resolve to these bytes when the
	 * spec is rendered on demand.
	 */
	CHART_SOURCES_SUFFIX: '.sources',
} as const;

/**
 * Per-hour chart kinds the timeline bundle stores as specs. `surface-analysis`
 * carries the evolving front + pressure positions; `metar-plot` carries the
 * per-station observation overlay. Both re-derive from each hourly v1
 * snapshot; the replay surface renders the spec to SVG on demand.
 */
export const WX_TIMELINE_CHART_KINDS = ['surface-analysis', 'metar-plot'] as const;

export type WxTimelineChartKind = (typeof WX_TIMELINE_CHART_KINDS)[number];

/**
 * Build-subcommand flag that triggers the full v2 timeline-bundle emit.
 * `bun run wx-scenario build <slug> --timeline`.
 */
export const WX_SCENARIO_BUILD_TIMELINE_FLAG = '--timeline';

/**
 * Maximum number of wrong-answer distractors in a temporal "front-position"
 * exercise. The exercise picks one correct (post-frontal) station and up to
 * this many pre-frontal stations as distractors, keeping the option set to
 * a four-choice question.
 */
export const WX_TEMPORAL_FRONT_POSITION_DISTRACTOR_CAP = 3;

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
