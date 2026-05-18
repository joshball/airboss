/**
 * Personal-minimums field descriptors (personal-minimums-as-typed-contract WP).
 *
 * One ordered list of the eight numeric fields the editor renders. Each
 * descriptor carries the form `name`, the display label + unit, the
 * `min` / `max` (from `PERSONAL_MINIMUMS_CONSTRAINTS`), and the integer
 * `step`. The read view, the edit form, and the history page all walk
 * this list so the field set never drifts across the three surfaces.
 *
 * Pure, browser-safe: no DB, no `node:*`.
 */

import type { PersonalMinimums } from '@ab/bc-study';
import { PERSONAL_MINIMUMS_CONSTRAINTS } from '@ab/constants';

/** The eight numeric keys of a personal-minimums record. */
export type PersonalMinimumsFieldKey =
	| 'ceilingFt'
	| 'visibilitySm'
	| 'windTotalKt'
	| 'crosswindTotalKt'
	| 'nightRequiredRecencyLandings'
	| 'imcRequiredRecencyApproaches'
	| 'paxMax'
	| 'terrainBufferAgl';

export interface PersonalMinimumsFieldDescriptor {
	key: PersonalMinimumsFieldKey;
	/** Form input `name`. */
	name: string;
	/** Display label. */
	label: string;
	/** Unit suffix shown beside the value (empty for count fields). */
	unit: string;
	/** Short helper text shown under the input in edit mode. */
	hint: string;
	min: number;
	max: number;
	/** Input `step`; `0.1` for visibility, `1` for every integer field. */
	step: number;
}

const C = PERSONAL_MINIMUMS_CONSTRAINTS;

/** The ordered field set the editor, reader, and history page all render. */
export const PERSONAL_MINIMUMS_FIELDS: readonly PersonalMinimumsFieldDescriptor[] = [
	{
		key: 'ceilingFt',
		name: 'ceilingFt',
		label: 'Ceiling',
		unit: 'ft AGL',
		hint: 'Lowest broken/overcast layer you will launch under.',
		min: C.CEILING_FT.min,
		max: C.CEILING_FT.max,
		step: 1,
	},
	{
		key: 'visibilitySm',
		name: 'visibilitySm',
		label: 'Visibility',
		unit: 'SM',
		hint: 'Lowest horizontal visibility you will launch under.',
		min: C.VISIBILITY_SM.min,
		max: C.VISIBILITY_SM.max,
		step: 0.1,
	},
	{
		key: 'windTotalKt',
		name: 'windTotalKt',
		label: 'Wind (total)',
		unit: 'kt',
		hint: 'Maximum total wind speed you will accept.',
		min: C.WIND_TOTAL_KT.min,
		max: C.WIND_TOTAL_KT.max,
		step: 1,
	},
	{
		key: 'crosswindTotalKt',
		name: 'crosswindTotalKt',
		label: 'Crosswind',
		unit: 'kt',
		hint: 'Maximum crosswind component. Must be at or below the total wind.',
		min: C.CROSSWIND_TOTAL_KT.min,
		max: C.CROSSWIND_TOTAL_KT.max,
		step: 1,
	},
	{
		key: 'nightRequiredRecencyLandings',
		name: 'nightRequiredRecencyLandings',
		label: 'Night currency',
		unit: 'landings / 90 days',
		hint: 'Night landings within 90 days you require of yourself (legal floor is 3).',
		min: C.NIGHT_REQUIRED_RECENCY_LANDINGS.min,
		max: C.NIGHT_REQUIRED_RECENCY_LANDINGS.max,
		step: 1,
	},
	{
		key: 'imcRequiredRecencyApproaches',
		name: 'imcRequiredRecencyApproaches',
		label: 'IMC currency',
		unit: 'approaches / 6 months',
		hint: 'Instrument approaches within 6 months you require of yourself (legal floor is 6).',
		min: C.IMC_REQUIRED_RECENCY_APPROACHES.min,
		max: C.IMC_REQUIRED_RECENCY_APPROACHES.max,
		step: 1,
	},
	{
		key: 'paxMax',
		name: 'paxMax',
		label: 'Passenger max',
		unit: '',
		hint: 'Most passengers you will carry under these minimums. 0 means solo only.',
		min: C.PAX_MAX.min,
		max: C.PAX_MAX.max,
		step: 1,
	},
	{
		key: 'terrainBufferAgl',
		name: 'terrainBufferAgl',
		label: 'Terrain buffer',
		unit: 'ft AGL',
		hint: 'Vertical clearance you keep above terrain and obstacles.',
		min: C.TERRAIN_BUFFER_AGL.min,
		max: C.TERRAIN_BUFFER_AGL.max,
		step: 1,
	},
];

/** Format a personal-minimums field value with its unit for the read view. */
export function formatFieldValue(field: PersonalMinimumsFieldDescriptor, value: number): string {
	const num = field.step < 1 ? value.toFixed(1) : String(value);
	return field.unit === '' ? num : `${num} ${field.unit}`;
}

/** Read a numeric field off a record by its descriptor key. */
export function fieldValue(record: PersonalMinimums, key: PersonalMinimumsFieldKey): number {
	return record[key];
}
