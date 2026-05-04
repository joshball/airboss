/**
 * Constants for the study-home WP.
 *
 * - `STUDY_MAP_TABS` enumerates the three projections of the cert map
 *   (`acs` / `handbook` / `course`) shown on `/study`.
 * - `USER_PREF_KEYS` namespaces the rows in the new `study.user_pref`
 *   table. Keys are scalar strings so the audit log target column stays
 *   grep-able. WP 3 adds a third key (`study.knowledge.render_mode`)
 *   on the same table; do not rename without coordinating both WPs.
 * - `CITATION_ORDER_VALUES` is the closed value set for the
 *   `study.home.citation_order` preference. Default is `'hb'`
 *   (handbook-first) per ADR 011 discovery-first pedagogy.
 */

export const STUDY_MAP_TABS = {
	ACS: 'acs',
	HANDBOOK: 'handbook',
	COURSE: 'course',
} as const;

export type StudyMapTab = (typeof STUDY_MAP_TABS)[keyof typeof STUDY_MAP_TABS];

export const STUDY_MAP_TAB_VALUES: readonly StudyMapTab[] = Object.values(STUDY_MAP_TABS);

/** Default tab when no preference is stored and no `?tab=` is supplied. */
export const STUDY_MAP_TAB_DEFAULT: StudyMapTab = STUDY_MAP_TABS.ACS;

/**
 * Closed key set for the `study.user_pref` table. Keys follow
 * `'<surface>.<screen>.<field>'`. v1 (study-home WP) ships two keys; WP 3
 * adds a third (`study.knowledge.render_mode`) without changing the table.
 */
export const USER_PREF_KEYS = {
	/** Citation panel order on the `/study` map: `'hb'` or `'reg'`. */
	CITATION_ORDER: 'study.home.citation_order',
	/** Active map projection on `/study`: `'acs'` / `'handbook'` / `'course'`. */
	MAP_TAB: 'study.home.map_tab',
} as const;

export type UserPrefKey = (typeof USER_PREF_KEYS)[keyof typeof USER_PREF_KEYS];

export const USER_PREF_KEY_VALUES: readonly UserPrefKey[] = Object.values(USER_PREF_KEYS);

/**
 * Citation panel order. `'hb'` puts the handbook stack open by default,
 * regulation collapsed; `'reg'` flips it. Value of the
 * `study.home.citation_order` user_pref row.
 */
export const CITATION_ORDER_VALUES = ['hb', 'reg'] as const;

export type CitationOrder = (typeof CITATION_ORDER_VALUES)[number];

/** Default citation order when no preference is stored. */
export const CITATION_ORDER_DEFAULT: CitationOrder = 'hb';
