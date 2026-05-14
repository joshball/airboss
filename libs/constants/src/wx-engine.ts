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
} as const;

export const WX_SCENARIO_SUBCOMMAND_VALUES = Object.values(WX_SCENARIO_SUBCOMMANDS);

export type WxScenarioSubcommand = (typeof WX_SCENARIO_SUBCOMMAND_VALUES)[number];
