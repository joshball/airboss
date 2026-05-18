/**
 * Personal-minimums lens (personal-minimums-as-typed-contract WP).
 *
 * A single pure function -- `projectAgainstPersonalMinimums` -- that any
 * consumer calls with the pilot's active minimums plus an observation, and
 * gets back a structured `ConformanceResult`. The lens is the only public
 * touch-point for projecting against personal minimums; the BC functions
 * (`getActivePersonalMinimums` / `getPersonalMinimumsHistory`) are the only
 * touch-points for reading the persisted record.
 *
 * Browser-safe by construction: no DB, no fs, no `node:*` import, no Node
 * globals. It ships through the runtime barrel `@ab/bc-study` as a value
 * re-export so a `.svelte` consumer (the xc-viewer overlay, a forecast
 * page) can call it inline via `$derived` as the user pans / selects.
 *
 * See the WP CONSUMER-CONTRACT.md for the binding patterns future
 * consumers follow.
 */

import type { ConformanceField, ConformanceResult, PersonalMinimumsObservation } from '@ab/types';

/**
 * The subset of a personal-minimums record the lens reads. The BC's
 * `PersonalMinimums` row satisfies this shape; declaring the lens against
 * the minimal interface keeps it decoupled from the persistence type and
 * lets pure unit tests pass a lightweight literal.
 */
export interface PersonalMinimumsFloors {
	ceilingFt: number;
	visibilitySm: number;
	windTotalKt: number;
	crosswindTotalKt: number;
}

/**
 * Build a `ConformanceField`. `higherIsBetter` distinguishes the two
 * conformance directions: ceiling + visibility are floors the observation
 * must be at or ABOVE; wind + crosswind are ceilings the observation must
 * be at or BELOW.
 */
function field(observed: number, floor: number, higherIsBetter: boolean): ConformanceField {
	const withinFloor = higherIsBetter ? observed >= floor : observed <= floor;
	return { observed, floor, withinFloor };
}

/**
 * `true` when `value` is a finite number. Guards against `NaN` / `Infinity`
 * sneaking into the projection from a malformed observation.
 */
function isUsableNumber(value: unknown): value is number {
	return typeof value === 'number' && Number.isFinite(value);
}

/**
 * `true` when the floors object carries usable numeric values for every
 * field the lens compares.
 */
function hasUsableFloors(minimums: PersonalMinimumsFloors | null | undefined): minimums is PersonalMinimumsFloors {
	if (minimums === null || minimums === undefined) return false;
	return (
		isUsableNumber(minimums.ceilingFt) &&
		isUsableNumber(minimums.visibilitySm) &&
		isUsableNumber(minimums.windTotalKt) &&
		isUsableNumber(minimums.crosswindTotalKt)
	);
}

/**
 * The `ConformanceResult` returned when the lens cannot project -- the
 * caller passed a `null` minimums row (or one missing required fields).
 * Consumers treat `pass: 'unknown'` as "no opinion" and render neutrally.
 */
function unknownResult(observation: PersonalMinimumsObservation): ConformanceResult {
	return {
		pass: 'unknown',
		fields: {
			ceiling: { observed: observation.ceilingFtAgl, floor: 0, withinFloor: false },
			visibility: { observed: observation.visibilitySm, floor: 0, withinFloor: false },
			windTotal: { observed: observation.windTotalKt, floor: 0, withinFloor: false },
			crosswind: { observed: observation.crosswindKt, floor: 0, withinFloor: false },
		},
		notes: [],
	};
}

/**
 * Project an observation against a pilot's personal minimums.
 *
 * Pure function: same inputs -> same output, no input mutation, no DB / fs
 * / `node:*` dependency.
 *
 *   - `pass: 'within'` -- every field conforms.
 *   - `pass: 'below'` -- at least one field is below the floor; `notes`
 *     carries a human-readable message per below-floor field.
 *   - `pass: 'unknown'` -- `minimums` was `null` or missing required
 *     fields. The signature says `minimums` is non-null, but callers may
 *     pass `null`; the lens guards explicitly rather than throwing.
 *
 * v1 applies the same numeric floors regardless of `observation.isNight`;
 * the field is accepted so a future day/night split (see the WP
 * OUT-OF-SCOPE.md) can use it without a signature change.
 */
export function projectAgainstPersonalMinimums(
	minimums: PersonalMinimumsFloors | null | undefined,
	observation: PersonalMinimumsObservation,
): ConformanceResult {
	if (!hasUsableFloors(minimums)) return unknownResult(observation);

	const fields = {
		ceiling: field(observation.ceilingFtAgl, minimums.ceilingFt, true),
		visibility: field(observation.visibilitySm, minimums.visibilitySm, true),
		windTotal: field(observation.windTotalKt, minimums.windTotalKt, false),
		crosswind: field(observation.crosswindKt, minimums.crosswindTotalKt, false),
	};

	const notes: string[] = [];
	if (!fields.ceiling.withinFloor) {
		notes.push(`ceiling ${fields.ceiling.observed} ft AGL below your ${fields.ceiling.floor} ft floor`);
	}
	if (!fields.visibility.withinFloor) {
		notes.push(`visibility ${fields.visibility.observed} SM below your ${fields.visibility.floor} SM floor`);
	}
	if (!fields.windTotal.withinFloor) {
		notes.push(`wind ${fields.windTotal.observed} kt above your ${fields.windTotal.floor} kt floor`);
	}
	if (!fields.crosswind.withinFloor) {
		notes.push(`crosswind ${fields.crosswind.observed} kt above your ${fields.crosswind.floor} kt floor`);
	}

	const pass: ConformanceResult['pass'] = notes.length === 0 ? 'within' : 'below';
	return { pass, fields, notes };
}
