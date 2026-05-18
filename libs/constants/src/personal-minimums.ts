/**
 * Personal-minimums constants (personal-minimums-as-typed-contract WP).
 *
 * A pilot's self-imposed go/no-go floors -- ceiling, visibility, winds,
 * currency, passengers, terrain buffer -- promoted from prose to a typed
 * primitive. The pedagogy of *why* personal minimums matter lives in the
 * `wx-personal-minimums` knowledge node (course/knowledge/weather/
 * personal-minimums/node.md); this module carries the numeric contract the
 * learner records against.
 *
 *   - `PERSONAL_MINIMUMS_DEFAULTS` -- the FAA P-8740-25 Solo / VFR baseline
 *     for a ~200-hour PPL. Used only as the empty-state starting shape; the
 *     pilot is invited to tune every number.
 *   - `PERSONAL_MINIMUMS_CONSTRAINTS` -- the frozen min/max bounds every
 *     field is validated against (Zod input schema + DB CHECK constraints).
 */

/**
 * Empty-state starting shape for a new personal-minimums record. Matches the
 * `wx-personal-minimums` knowledge node "Reveal" table Solo / VFR column,
 * itself drawn from FAA Pamphlet P-8740-25 (Personal Minimums Checklist).
 * A starting point, not a prescription -- the pilot tunes from here.
 */
export const PERSONAL_MINIMUMS_DEFAULTS = {
	CEILING_FT: 1500,
	VISIBILITY_SM: 5.0,
	WIND_TOTAL_KT: 20,
	CROSSWIND_TOTAL_KT: 12,
	NIGHT_REQUIRED_RECENCY_LANDINGS: 3,
	IMC_REQUIRED_RECENCY_APPROACHES: 6,
	PAX_MAX: 3,
	TERRAIN_BUFFER_AGL: 1000,
} as const;

/**
 * Frozen min/max bounds for every personal-minimums field. The Zod input
 * schema (`@ab/types` `personalMinimumsInputSchema`) and the DB CHECK
 * constraints on `study.personal_minimums` both derive from this table.
 * `VISIBILITY_SM` is the only non-integer field; it carries `decimalPlaces`
 * so the form + schema know to allow one fractional digit.
 */
export const PERSONAL_MINIMUMS_CONSTRAINTS = {
	CEILING_FT: { min: 0, max: 30000 },
	VISIBILITY_SM: { min: 0, max: 99.9, decimalPlaces: 1 },
	WIND_TOTAL_KT: { min: 0, max: 99 },
	CROSSWIND_TOTAL_KT: { min: 0, max: 99 },
	NIGHT_REQUIRED_RECENCY_LANDINGS: { min: 0, max: 50 },
	IMC_REQUIRED_RECENCY_APPROACHES: { min: 0, max: 50 },
	PAX_MAX: { min: 0, max: 19 },
	TERRAIN_BUFFER_AGL: { min: 0, max: 10000 },
} as const;

/**
 * Maximum length of the free-form `notes` markdown body on a personal-
 * minimums record. Matches the `card.body_md` discipline -- enough for
 * several paragraphs of rationale without becoming a journal.
 */
export const PERSONAL_MINIMUMS_NOTES_MAX_LENGTH = 4000;

/** Prefix for `study.personal_minimums` ids -- `pmin_<lowercase ulid>`. */
export const PERSONAL_MINIMUMS_ID_PREFIX = 'pmin';
