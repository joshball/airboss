/**
 * Server-side helper to load the five reader-typography prefs for a user
 * (or fill in defaults for an anonymous request) and shape them as the
 * props expected by `<ReadableScope>`.
 *
 * Mirrors the helper at `apps/study/src/lib/server/reading-prefs.ts`.
 * Lives per-app because the layout-load contract differs slightly between
 * surfaces (study has a `(app)` group; flightbag's root layout is the
 * mount point).
 */

import { getUserPrefs } from '@ab/bc-study/server';
import {
	READING_DENSITY_DEFAULT,
	READING_DENSITY_VALUES,
	READING_FONT_FAMILY_DEFAULT,
	READING_FONT_FAMILY_VALUES,
	READING_FONT_SCALE_DEFAULT,
	READING_FONT_SCALE_VALUES,
	READING_HEADING_SCALE_DEFAULT,
	READING_HEADING_SCALE_VALUES,
	READING_MEASURE_DEFAULT,
	READING_MEASURE_VALUES,
	READING_PREF_KEYS,
	type ReadingDensity,
	type ReadingFontFamily,
	type ReadingFontScale,
	type ReadingHeadingScale,
	type ReadingMeasure,
	USER_PREF_KEYS,
} from '@ab/constants';

export interface ReadingPrefs {
	readonly fontFamily: ReadingFontFamily;
	readonly fontScale: ReadingFontScale;
	readonly density: ReadingDensity;
	readonly measure: ReadingMeasure;
	readonly headingScale: ReadingHeadingScale;
}

export const READING_PREFS_DEFAULT: ReadingPrefs = {
	fontFamily: READING_FONT_FAMILY_DEFAULT,
	fontScale: READING_FONT_SCALE_DEFAULT,
	density: READING_DENSITY_DEFAULT,
	measure: READING_MEASURE_DEFAULT,
	headingScale: READING_HEADING_SCALE_DEFAULT,
};

function isFontFamily(value: unknown): value is ReadingFontFamily {
	return typeof value === 'string' && (READING_FONT_FAMILY_VALUES as readonly string[]).includes(value);
}
function isFontScale(value: unknown): value is ReadingFontScale {
	return typeof value === 'number' && (READING_FONT_SCALE_VALUES as readonly number[]).includes(value);
}
function isDensity(value: unknown): value is ReadingDensity {
	return typeof value === 'string' && (READING_DENSITY_VALUES as readonly string[]).includes(value);
}
function isMeasure(value: unknown): value is ReadingMeasure {
	return typeof value === 'string' && (READING_MEASURE_VALUES as readonly string[]).includes(value);
}
function isHeadingScale(value: unknown): value is ReadingHeadingScale {
	return typeof value === 'number' && (READING_HEADING_SCALE_VALUES as readonly number[]).includes(value);
}

/**
 * Load the five reader-prefs for a user and fill defaults for absent keys.
 * Anonymous users (`userId === null`) skip the DB query and return the
 * defaults directly -- avoids one round-trip per public page load.
 */
export async function loadReadingPrefs(userId: string | null): Promise<ReadingPrefs> {
	if (!userId) return READING_PREFS_DEFAULT;
	const prefs = await getUserPrefs(userId, READING_PREF_KEYS);
	const fontFamilyRaw = prefs[USER_PREF_KEYS.READING_FONT_FAMILY];
	const fontScaleRaw = prefs[USER_PREF_KEYS.READING_FONT_SCALE];
	const densityRaw = prefs[USER_PREF_KEYS.READING_DENSITY];
	const measureRaw = prefs[USER_PREF_KEYS.READING_MEASURE];
	const headingScaleRaw = prefs[USER_PREF_KEYS.READING_HEADING_SCALE];
	return {
		fontFamily: isFontFamily(fontFamilyRaw) ? fontFamilyRaw : READING_FONT_FAMILY_DEFAULT,
		fontScale: isFontScale(fontScaleRaw) ? fontScaleRaw : READING_FONT_SCALE_DEFAULT,
		density: isDensity(densityRaw) ? densityRaw : READING_DENSITY_DEFAULT,
		measure: isMeasure(measureRaw) ? measureRaw : READING_MEASURE_DEFAULT,
		headingScale: isHeadingScale(headingScaleRaw) ? headingScaleRaw : READING_HEADING_SCALE_DEFAULT,
	};
}
