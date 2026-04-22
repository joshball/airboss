/**
 * Session-start presets -- the content catalogue that backs the preset gallery
 * on `/session/start` when the user has no active plan. See ADR 012 and
 * `docs/work/plans/20260422-option-b-presets.md` for the authoring rationale.
 *
 * A preset is a typed record that maps one-to-one onto the `studyPlan` table
 * shape. Picking a preset creates a plan with these values, archives any
 * existing active plan, and starts a session immediately. There is no separate
 * "preset plan" type -- it's a regular plan that happens to have been seeded
 * from authored content rather than the plans/new form.
 *
 * Presets are authored content, version-controlled here. Adding a preset is a
 * PR that appends to `PRESETS` / `PRESET_VALUES`. Users do not edit presets;
 * they pick one or pick "Custom" to author a plan from scratch.
 */

import {
	CERTS,
	type Cert,
	DEFAULT_SESSION_LENGTH,
	DEPTH_PREFERENCES,
	type DepthPreference,
	DOMAINS,
	type Domain,
	SESSION_MODES,
	type SessionMode,
} from './study';

/**
 * A session-start preset. All fields except `icon` map onto the matching
 * `studyPlan` column; the preset-start action feeds these values directly into
 * `createPlan`.
 */
export interface Preset {
	/** Stable slug, url-safe. Used as the form value that identifies the pick. */
	id: string;
	/** Short display name (sentence case). */
	label: string;
	/** One-line sell ("what you'll work on"). */
	description: string;
	/** Subset of CERTS; empty = no cert target. */
	certGoals: readonly Cert[];
	/** Subset of DOMAINS; empty = all domains. */
	focusDomains: readonly Domain[];
	/** Subset of DOMAINS; usually empty. */
	skipDomains: readonly Domain[];
	depthPreference: DepthPreference;
	/** Session-engine default mode applied to every session on this plan. */
	defaultMode: SessionMode;
	/** Items per session (matches `studyPlan.sessionLength`). */
	sessionLength: number;
	/** Optional emoji / glyph hint for the UI tile. */
	icon?: string;
}

export const PRESET_IDS = {
	REPS_ONLY: 'reps-only',
	PRIVATE_PILOT_OVERVIEW: 'private-pilot-overview',
	SAFETY_OVERVIEW: 'safety-overview',
	BFR_PREP: 'bfr-prep',
	FIRC: 'firc',
} as const;

export type PresetId = (typeof PRESET_IDS)[keyof typeof PRESET_IDS];

export const PRESET_ID_VALUES = Object.values(PRESET_IDS);

/**
 * Sentinel id for the "Custom" gallery tile. Not a full preset record -- the
 * UI renders this as a link to `/plans/new` rather than as a form submit.
 * Declared alongside the preset ids so the gallery can address it uniformly.
 */
export const CUSTOM_TILE_ID = 'custom' as const;
export type CustomTileId = typeof CUSTOM_TILE_ID;

/** The "Quick reps" preset -- direct replacement for the old one-click rep flow. */
const REPS_ONLY: Preset = {
	id: PRESET_IDS.REPS_ONLY,
	label: 'Quick reps',
	description: 'Fast decision scenarios across all domains. No cert focus, just practice.',
	certGoals: [],
	focusDomains: [],
	skipDomains: [],
	depthPreference: DEPTH_PREFERENCES.WORKING,
	defaultMode: SESSION_MODES.MIXED,
	sessionLength: DEFAULT_SESSION_LENGTH,
};

/** PPL-breadth review across the private pilot knowledge areas. */
const PRIVATE_PILOT_OVERVIEW: Preset = {
	id: PRESET_IDS.PRIVATE_PILOT_OVERVIEW,
	label: 'Private Pilot overview',
	description: 'PPL-breadth review across regs, weather, airspace, VFR ops, aerodynamics, and ADM.',
	certGoals: [CERTS.PPL],
	focusDomains: [
		DOMAINS.REGULATIONS,
		DOMAINS.WEATHER,
		DOMAINS.AIRSPACE,
		DOMAINS.VFR_OPERATIONS,
		DOMAINS.AERODYNAMICS,
		DOMAINS.ADM_HUMAN_FACTORS,
		DOMAINS.FLIGHT_PLANNING,
		DOMAINS.AIRCRAFT_SYSTEMS,
	],
	skipDomains: [],
	depthPreference: DEPTH_PREFERENCES.WORKING,
	defaultMode: SESSION_MODES.MIXED,
	// Overview presets use a longer default so the engine can cover more
	// domains in one session. Quick reps stays at the terse default.
	sessionLength: 15,
};

/** Cert-agnostic high-stakes refresher. "Teach it to someone else" posture. */
const SAFETY_OVERVIEW: Preset = {
	id: PRESET_IDS.SAFETY_OVERVIEW,
	label: 'Safety procedures',
	description: 'Emergency procedures, ADM, human factors, and accident analysis. High-stakes focus.',
	certGoals: [],
	focusDomains: [DOMAINS.SAFETY_ACCIDENT_ANALYSIS, DOMAINS.EMERGENCY_PROCEDURES, DOMAINS.ADM_HUMAN_FACTORS],
	skipDomains: [],
	depthPreference: DEPTH_PREFERENCES.DEEP,
	defaultMode: SESSION_MODES.STRENGTHEN,
	sessionLength: DEFAULT_SESSION_LENGTH,
};

/** BFR prep -- operational + decision-making topics a flight review actually probes. */
const BFR_PREP: Preset = {
	id: PRESET_IDS.BFR_PREP,
	label: 'BFR prep',
	description: 'Flight review refresher -- regs, airspace, maneuvers, emergency ops, weather.',
	certGoals: [CERTS.PPL],
	focusDomains: [
		DOMAINS.REGULATIONS,
		DOMAINS.AIRSPACE,
		DOMAINS.WEATHER,
		DOMAINS.VFR_OPERATIONS,
		DOMAINS.EMERGENCY_PROCEDURES,
		DOMAINS.ADM_HUMAN_FACTORS,
	],
	skipDomains: [],
	depthPreference: DEPTH_PREFERENCES.WORKING,
	defaultMode: SESSION_MODES.MIXED,
	// Longer default to probe breadth across the six BFR-relevant domains.
	sessionLength: 15,
};

/** CFI renewal focus -- depth=deep because teach-it-to-someone-else is the cert standard. */
const FIRC: Preset = {
	id: PRESET_IDS.FIRC,
	label: 'FIRC',
	description: 'CFI refresher -- teaching methodology, regs, human factors, FAA standards.',
	certGoals: [CERTS.CFI],
	focusDomains: [
		DOMAINS.REGULATIONS,
		DOMAINS.TEACHING_METHODOLOGY,
		DOMAINS.ADM_HUMAN_FACTORS,
		DOMAINS.SAFETY_ACCIDENT_ANALYSIS,
		DOMAINS.FAA_PRACTICAL_STANDARDS,
	],
	skipDomains: [],
	depthPreference: DEPTH_PREFERENCES.DEEP,
	defaultMode: SESSION_MODES.STRENGTHEN,
	// Longer default -- FIRC benefits from breadth across the cert-relevant
	// domains, and depth=deep makes each slot substantive.
	sessionLength: 15,
};

/**
 * All real presets, keyed by id. "Quick reps" is intentionally first -- it is
 * the direct replacement for the old zero-friction rep entry point and the
 * gallery should present it as the default tap-and-go option.
 */
export const PRESETS: Readonly<Record<PresetId, Preset>> = {
	[PRESET_IDS.REPS_ONLY]: REPS_ONLY,
	[PRESET_IDS.PRIVATE_PILOT_OVERVIEW]: PRIVATE_PILOT_OVERVIEW,
	[PRESET_IDS.SAFETY_OVERVIEW]: SAFETY_OVERVIEW,
	[PRESET_IDS.BFR_PREP]: BFR_PREP,
	[PRESET_IDS.FIRC]: FIRC,
};

/**
 * Ordered list of presets as they should appear in the gallery. Order is
 * load-bearing: "Quick reps" first; "Custom" tile is rendered separately by
 * the UI because it is not a preset record.
 */
export const PRESET_VALUES: readonly Preset[] = [REPS_ONLY, PRIVATE_PILOT_OVERVIEW, SAFETY_OVERVIEW, BFR_PREP, FIRC];

/**
 * Metadata for the "Custom" gallery tile. Not a preset -- the UI renders this
 * as a link to `/plans/new` so the user can author a plan from scratch.
 */
export const CUSTOM_TILE = {
	id: CUSTOM_TILE_ID,
	label: 'Create your own study plan',
	description: 'Pick your own cert goals, focus domains, depth, and session length.',
} as const;

/** Type guard for preset-id form data. */
export function isPresetId(value: unknown): value is PresetId {
	return typeof value === 'string' && (PRESET_ID_VALUES as readonly string[]).includes(value);
}

/** Look up a preset by id, or null if the id does not match a known preset. */
export function getPreset(id: string): Preset | null {
	return isPresetId(id) ? PRESETS[id] : null;
}
