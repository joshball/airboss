/**
 * XC Viewer constants.
 *
 * The closed enum sets for the spatial / cross-country viewer surface:
 * sectional regions, hand-authored aircraft, hand-authored routes, and
 * the scenario compositions that tie a region + route + aircraft + a
 * wx-engine scenario slug together.
 *
 * Slugs double as directory names: `course/sectionals/<region>/`,
 * `libs/spatial-engine/src/flight/routes/<route>.ts`,
 * `libs/spatial-engine/src/flight/aircraft/<aircraft>.ts`,
 * `data/xc-scenarios/<scenario>/`.
 *
 * See `docs/work-packages/xc-viewer-v1/spec.md` "Constants".
 */

/** Closed enum of registered sectional regions. v1 ships Memphis only. */
export const XC_REGIONS = {
	MEMPHIS: 'memphis',
} as const;

export const XC_REGION_VALUES = Object.values(XC_REGIONS);

export type XcRegion = (typeof XC_REGION_VALUES)[number];

export const XC_REGION_LABELS: Record<XcRegion, string> = {
	memphis: 'Memphis Sectional',
};

/** Closed enum of registered hand-authored aircraft. v1 ships the C172N. */
export const XC_AIRCRAFT = {
	C172N_SKYHAWK: 'c172n-skyhawk',
} as const;

export const XC_AIRCRAFT_VALUES = Object.values(XC_AIRCRAFT);

export type XcAircraft = (typeof XC_AIRCRAFT_VALUES)[number];

export const XC_AIRCRAFT_LABELS: Record<XcAircraft, string> = {
	'c172n-skyhawk': 'Cessna 172N Skyhawk',
};

/** Closed enum of registered hand-authored routes. */
export const XC_ROUTES = {
	KMEM_KMKL_KOLV: 'kmem-kmkl-kolv',
} as const;

export const XC_ROUTE_VALUES = Object.values(XC_ROUTES);

export type XcRoute = (typeof XC_ROUTE_VALUES)[number];

export const XC_ROUTE_LABELS: Record<XcRoute, string> = {
	'kmem-kmkl-kolv': 'KMEM -> KMKL -> KOLV',
};

/** Closed enum of registered scenario compositions. v1 ships one. */
export const XC_SCENARIOS = {
	KMEM_KMKL_KOLV_FRONTAL_MARCH: 'kmem-kmkl-kolv-frontal-march',
} as const;

export const XC_SCENARIO_VALUES = Object.values(XC_SCENARIOS);

export type XcScenario = (typeof XC_SCENARIO_VALUES)[number];

export const XC_SCENARIO_LABELS: Record<XcScenario, string> = {
	'kmem-kmkl-kolv-frontal-march': 'KMEM -> KMKL -> KOLV -- Cold Front Passage (March)',
};

/**
 * Subcommand names for the `scripts/xc-scenario.ts` dispatcher. Mirrors
 * `WX_SCENARIO_SUBCOMMANDS`. Used by the dispatcher's switch + the help
 * printer so subcommand strings never appear inline.
 */
export const XC_SCENARIO_SUBCOMMANDS = {
	BUILD: 'build',
	LIST: 'list',
	VALIDATE: 'validate',
} as const;

export const XC_SCENARIO_SUBCOMMAND_VALUES = Object.values(XC_SCENARIO_SUBCOMMANDS);

export type XcScenarioSubcommand = (typeof XC_SCENARIO_SUBCOMMAND_VALUES)[number];

/**
 * Subcommand names for the `scripts/sectionals.ts` dispatcher.
 */
export const SECTIONALS_SUBCOMMANDS = {
	LIST: 'list',
	INGEST: 'ingest',
} as const;

export const SECTIONALS_SUBCOMMAND_VALUES = Object.values(SECTIONALS_SUBCOMMANDS);

export type SectionalsSubcommand = (typeof SECTIONALS_SUBCOMMAND_VALUES)[number];

/**
 * Per-scenario output layout under `data/xc-scenarios/<slug>/`. Names the
 * files the CLI build step writes + the consumer `:::xc-viewer` directive
 * reads, so no path string is inlined in the bundle writer or the page
 * server load.
 */
export const XC_SCENARIO_BUNDLE = {
	/** Serialized `ScenarioBundle` -- the composed scenario. */
	BUNDLE: 'bundle.json',
	/** Layer-2 route geometry as a GeoJSON FeatureCollection. */
	ROUTE_GEOJSON: 'route.geojson',
	/** Derived per-leg performance table. */
	PERFORMANCE: 'performance.json',
} as const;

/**
 * Per-region geography layout under `course/sectionals/<region>/`. Names
 * the committed vector-geometry files the ingester writes + the geography
 * loader reads.
 */
export const XC_SECTIONAL_LAYOUT = {
	MANIFEST: 'manifest.yaml',
	BASEMAP: 'basemap.geojson',
	AIRSPACE: 'airspace.geojson',
	NAVAIDS: 'navaids.geojson',
	AIRPORTS: 'airports.json',
	AIRPORTS_DIR: 'airports',
	AIRPORT_RECORD: 'airport.json',
	CITATION: 'CITATION.md',
} as const;

/**
 * Per-region Lambert projection parameters. Keyed by `XcRegion`. The
 * spatial-engine projection helper reads this table; v2+ regions append
 * one entry each. Memphis covers TN / MS / AR / KY.
 */
export const XC_REGION_PROJECTIONS: Record<
	XcRegion,
	{ parallels: readonly [number, number]; rotate: readonly [number, number]; center: readonly [number, number] }
> = {
	memphis: { parallels: [33, 38], rotate: [89, 0], center: [0, 35.5] },
};

/**
 * Per-region magnetic variation in degrees. Positive = east. v1 uses a
 * single per-region constant; v2+ may use the NOAA WMM grid for precision.
 * The Memphis sectional sits near the agonic line; the epoch-2026 value is
 * roughly 1 degree West, so v1 uses `-1`.
 */
export const XC_REGION_MAGNETIC_VARIATION_DEG: Record<XcRegion, number> = {
	memphis: -1,
};
