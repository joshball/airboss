/**
 * Shared types for the `/practice/wx/test-page` truth-model authoring
 * sandbox (Drill Phase 4).
 *
 * Browser-safe: pure type/value declarations, no Node imports. Consumed by
 * the page component, the two `+server.ts` endpoints, and the
 * slider-state -> TruthModel mapper.
 *
 * The `SandboxSliderState` shape is the contract between the slider panel
 * and the `derive` endpoint: the panel POSTs this literal, the endpoint
 * builds a `TruthModel` from it (via `truth-from-sliders.ts`) and re-derives
 * a METAR + TAF + chart.
 */

/**
 * The single station the sandbox derives products for. Fixed at a
 * CONUS-central location so every lever has a predictable effect and the
 * METAR-plot chart frames the station cleanly.
 */
export const SANDBOX_STATION = {
	icao: 'KTST',
	name: 'Sandbox Test Field',
	lon: -97.43,
	lat: 37.65,
	elevationFt: 1333,
} as const;

/** Analysis time the sandbox anchors every derivation to. */
export const SANDBOX_VALID_AT = '2026-03-19T19:00:00Z';

/** Slider bounds + step, one entry per lever. Drives the panel + clamps input. */
export const SANDBOX_SLIDER_BOUNDS = {
	windDirDeg: { min: 0, max: 350, step: 10, default: 200 },
	windKt: { min: 0, max: 45, step: 1, default: 12 },
	tempC: { min: -25, max: 42, step: 1, default: 17 },
	dewpointSpreadC: { min: 0, max: 25, step: 1, default: 4 },
	seaLevelPressureMb: { min: 980, max: 1040, step: 1, default: 1013 },
	frontDistanceKm: { min: 0, max: 600, step: 20, default: 600 },
	cellDistanceNm: { min: 0, max: 120, step: 5, default: 120 },
} as const;

/** Frontal intensity options -- maps directly to `Front.intensity`. */
export const SANDBOX_FRONT_INTENSITIES = ['weak', 'moderate', 'strong'] as const;
export type SandboxFrontIntensity = (typeof SANDBOX_FRONT_INTENSITIES)[number];

/** Hazard severity options -- maps directly to `HazardZone.severity`. */
export const SANDBOX_HAZARD_SEVERITIES = ['off', 'light', 'moderate', 'severe'] as const;
export type SandboxHazardSeverity = (typeof SANDBOX_HAZARD_SEVERITIES)[number];

/**
 * The full slider state. Every field is a truth-model lever; the mapper in
 * `truth-from-sliders.ts` turns this into a schema-valid single-station
 * `TruthModel`.
 *
 * Note: gust is NOT a free slider. The engine derives a gust group only
 * from a post-frontal cold front (`deriveMetar` step 4), so the
 * `frontDistanceKm` + `frontIntensity` levers are the sandbox's gust
 * controls -- moving the cold front close + strong produces gusts. This
 * keeps the wx-engine the single source of truth for gust derivation
 * rather than letting the sandbox inject a contradictory gust literal.
 */
export interface SandboxSliderState {
	/** Surface wind direction, degrees true (0-350, 10-deg steps). */
	windDirDeg: number;
	/** Surface wind speed, knots. */
	windKt: number;
	/** Surface temperature, degrees C. */
	tempC: number;
	/**
	 * Temperature/dewpoint spread, degrees C. Dewpoint is derived as
	 * `tempC - dewpointSpreadC`. A small spread feeds fog/low-stratus
	 * intuition; the lever is the spread (not the dewpoint) because that
	 * is the operationally meaningful quantity.
	 */
	dewpointSpreadC: number;
	/** Sea-level pressure at the station, millibars. Drives the altimeter. */
	seaLevelPressureMb: number;
	/**
	 * Distance from the station to a cold front, km. At the max bound the
	 * front is far enough that it has no derivation effect; closing it in
	 * (with a moderate/strong intensity) produces post-frontal gusts.
	 */
	frontDistanceKm: number;
	/** Cold-front intensity. `weak` never produces gusts (engine rule). */
	frontIntensity: SandboxFrontIntensity;
	/**
	 * Distance from the station to a convective cell, nautical miles. Inside
	 * the cell influence radius the engine emits `+TSRA` + CB layers.
	 */
	cellDistanceNm: number;
	/**
	 * IFR / fog hazard severity over the station. `off` places no hazard
	 * zone; `light`/`moderate`/`severe` map to the engine's MVFR / IFR /
	 * LIFR ceiling + visibility floors.
	 */
	hazardSeverity: SandboxHazardSeverity;
}

/** The default slider state -- a benign VFR day with no fronts or hazards. */
export const SANDBOX_DEFAULT_STATE: SandboxSliderState = {
	windDirDeg: SANDBOX_SLIDER_BOUNDS.windDirDeg.default,
	windKt: SANDBOX_SLIDER_BOUNDS.windKt.default,
	tempC: SANDBOX_SLIDER_BOUNDS.tempC.default,
	dewpointSpreadC: SANDBOX_SLIDER_BOUNDS.dewpointSpreadC.default,
	seaLevelPressureMb: SANDBOX_SLIDER_BOUNDS.seaLevelPressureMb.default,
	frontDistanceKm: SANDBOX_SLIDER_BOUNDS.frontDistanceKm.default,
	frontIntensity: 'moderate',
	cellDistanceNm: SANDBOX_SLIDER_BOUNDS.cellDistanceNm.default,
	hazardSeverity: 'off',
};

/**
 * The `derive` endpoint's response: the re-derived products + the rendered
 * METAR-plot chart SVG. `tafError` is populated instead of `taf` when the
 * TAF derivation throws (some extreme slider combinations the METAR can
 * tolerate are out of the TAF deriver's range); the page surfaces it
 * inline rather than blanking the whole panel.
 */
export interface SandboxDeriveResult {
	metarRaw: string;
	tafRaw: string | null;
	tafError: string | null;
	chartSvg: string;
}

/**
 * The catalog-example candidate written to
 * `course/knowledge/weather/encoded-text-catalog/examples-pending/<slug>.json`
 * by the `save-candidate` endpoint. Carries enough to later promote into a
 * catalog markdown example: raw text, product type, synoptic story, the
 * token families it exercises, and source references.
 */
export interface CatalogExampleCandidate {
	/** Stable slug -- also the sidecar filename. */
	slug: string;
	/** Product family the example belongs to. */
	product: 'metar' | 'taf';
	/** The raw encoded product string. */
	raw: string;
	/** 1-2 sentence synoptic story explaining why the product looks like this. */
	synoptic: string;
	/** Token-family slugs this example exercises (from the catalog vocabulary). */
	tokenFamilies: string[];
	/** Source references backing the example. */
	references: Array<{ source: string; detail: string }>;
	/** Provenance: the slider state that produced this candidate. */
	sliderState: SandboxSliderState;
	/** ISO timestamp the candidate was authored. */
	authoredAt: string;
	/** The signed-in author who created the candidate. */
	authoredBy: string;
}
