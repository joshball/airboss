/**
 * Personal-minimums input + lens types (personal-minimums-as-typed-contract WP).
 *
 * Three shapes ship here:
 *
 *   - `personalMinimumsInputSchema` -- the Zod schema every write to
 *     `study.personal_minimums` validates against. Bounds derive from
 *     `PERSONAL_MINIMUMS_CONSTRAINTS` in `@ab/constants`; the
 *     `crosswindTotalKt <= windTotalKt` refinement mirrors the DB CHECK.
 *   - `PersonalMinimumsObservation` -- the lens input shape. A consumer's
 *     projection of "the conditions in question" (a wx-engine truth sample,
 *     a parsed METAR, a logbook entry).
 *   - `ConformanceResult` -- the lens output shape. Per-field conformance
 *     plus an overall `pass` verdict.
 *
 * The pedagogy of *why* a pilot sets personal minimums lives in the
 * `wx-personal-minimums` knowledge node (course/knowledge/weather/
 * personal-minimums/node.md); this file carries only the typed contract.
 */

import { PERSONAL_MINIMUMS_CONSTRAINTS as C, PERSONAL_MINIMUMS_NOTES_MAX_LENGTH } from '@ab/constants';
import { z } from 'zod';

/**
 * Validates a personal-minimums write. Every numeric field is bounded by the
 * frozen `PERSONAL_MINIMUMS_CONSTRAINTS` table; `notes` is an optional
 * markdown body capped at `PERSONAL_MINIMUMS_NOTES_MAX_LENGTH`. The
 * `crosswindTotalKt <= windTotalKt` refinement is enforced here and again at
 * the DB CHECK level (`personal_minimums_crosswind_le_wind_check`).
 *
 * See the `personal-minimums-as-typed-contract` WP spec; the discipline this
 * persists is taught by the `wx-personal-minimums` knowledge node.
 */
export const personalMinimumsInputSchema = z
	.object({
		ceilingFt: z.number().int().min(C.CEILING_FT.min).max(C.CEILING_FT.max),
		visibilitySm: z.number().min(C.VISIBILITY_SM.min).max(C.VISIBILITY_SM.max),
		windTotalKt: z.number().int().min(C.WIND_TOTAL_KT.min).max(C.WIND_TOTAL_KT.max),
		crosswindTotalKt: z.number().int().min(C.CROSSWIND_TOTAL_KT.min).max(C.CROSSWIND_TOTAL_KT.max),
		nightRequiredRecencyLandings: z
			.number()
			.int()
			.min(C.NIGHT_REQUIRED_RECENCY_LANDINGS.min)
			.max(C.NIGHT_REQUIRED_RECENCY_LANDINGS.max),
		imcRequiredRecencyApproaches: z
			.number()
			.int()
			.min(C.IMC_REQUIRED_RECENCY_APPROACHES.min)
			.max(C.IMC_REQUIRED_RECENCY_APPROACHES.max),
		paxMax: z.number().int().min(C.PAX_MAX.min).max(C.PAX_MAX.max),
		terrainBufferAgl: z.number().int().min(C.TERRAIN_BUFFER_AGL.min).max(C.TERRAIN_BUFFER_AGL.max),
		notes: z.string().max(PERSONAL_MINIMUMS_NOTES_MAX_LENGTH).nullable().optional(),
	})
	.refine((v) => v.crosswindTotalKt <= v.windTotalKt, {
		message: 'crosswindTotalKt must be <= windTotalKt',
		path: ['crosswindTotalKt'],
	});

/**
 * The validated personal-minimums write payload. Inferred from
 * `personalMinimumsInputSchema` so the type and the runtime check never
 * drift. Consumed by `createPersonalMinimumsRevision` in the study BC
 * (`personal-minimums-as-typed-contract` WP).
 */
export type PersonalMinimumsInput = z.infer<typeof personalMinimumsInputSchema>;

/**
 * The observation shape the personal-minimums lens projects against. A
 * consumer (xc-viewer overlay, decision-debrief replay, logbook ingestion)
 * builds one of these from whatever weather source it owns and feeds it to
 * `projectAgainstPersonalMinimums`.
 *
 * Field meanings:
 *   - `ceilingFtAgl` -- lowest BKN/OVC layer in feet AGL. Pass a large
 *     number (e.g. 99999) for clear skies; the lens treats higher as more
 *     permissive.
 *   - `visibilitySm` -- horizontal visibility in statute miles.
 *   - `windTotalKt` -- wind speed (steady or gust peak; consumer chooses).
 *   - `crosswindKt` -- crosswind component for the runway / leg in question.
 *     Pass 0 if no runway is specified.
 *   - `isNight` -- whether the observation is at night. v1 lens reads the
 *     field but applies the same numeric floors day and night; a future
 *     day/night split (see the WP OUT-OF-SCOPE.md) uses it meaningfully.
 *
 * See the `wx-personal-minimums` knowledge node for the discipline behind
 * the floors this observation is compared against.
 */
export interface PersonalMinimumsObservation {
	ceilingFtAgl: number;
	visibilitySm: number;
	windTotalKt: number;
	crosswindKt: number;
	isNight: boolean;
}

/**
 * Per-field conformance of an observation against a pilot's personal
 * minimums. `observed` is the observation value, `floor` is the pilot's
 * stated minimum, `withinFloor` is true when the observation is at or
 * better than the floor (higher ceiling / visibility, lower wind /
 * crosswind).
 */
export interface ConformanceField {
	observed: number;
	floor: number;
	withinFloor: boolean;
}

/**
 * The personal-minimums lens output (personal-minimums-as-typed-contract WP).
 *
 *   - `pass` -- `'within'` when every field conforms; `'below'` when any
 *     field is below the floor; `'unknown'` when the lens was called without
 *     a usable minimums row.
 *   - `fields` -- per-field `{ observed, floor, withinFloor }` triples.
 *   - `notes` -- deterministic human-readable strings, one per below-floor
 *     field (e.g. "ceiling 800 ft AGL below your 1500 ft floor").
 *
 * Consumed by future surfaces via `projectAgainstPersonalMinimums`; see the
 * WP CONSUMER-CONTRACT.md.
 */
export interface ConformanceResult {
	pass: 'within' | 'below' | 'unknown';
	fields: {
		ceiling: ConformanceField;
		visibility: ConformanceField;
		windTotal: ConformanceField;
		crosswind: ConformanceField;
	};
	notes: string[];
}
