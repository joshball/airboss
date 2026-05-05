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
 * `'<surface>.<screen>.<field>'`. Each WP adds its own keys here without
 * changing the table; the registry of value schemas in
 * `libs/bc/study/src/user-prefs.ts` validates writes per key.
 */
export const USER_PREF_KEYS = {
	/** Citation panel order on the `/study` map: `'hb'` or `'reg'`. */
	CITATION_ORDER: 'study.home.citation_order',
	/** Active map projection on `/study`: `'acs'` / `'handbook'` / `'course'`. */
	MAP_TAB: 'study.home.map_tab',
	/**
	 * Active teacher whose teaching syllabus seeds the Course tab on
	 * `/study`. Value is a teacher `bauth_user.id`. Set when the student
	 * has 2+ active teacher links and picks one via the Course-tab
	 * dropdown. Owned by WP 2 (flight-evidence-and-cfi-feedback).
	 */
	HOME_COURSE_TEACHER_ID: 'study.home.course_teacher_id',
	/**
	 * Knowledge-node body render mode: `'learn'` / `'review'` / `'memorize'`.
	 * Three reading orders over the same `body_sections` content. Owned
	 * by WP 3 (node-render-modes).
	 */
	KNOWLEDGE_RENDER_MODE: 'study.knowledge.render_mode',
	/**
	 * Per-user, per-page-key dismissal map for the "Why am I here?"
	 * `<PageExplainer>` component. Value is a JSON object keyed by the
	 * component's `pageKey`; presence of a `true` value means the user
	 * collapsed that explainer. The `?` peek button does NOT clear the
	 * entry -- it temporarily renders the body for the current visit
	 * only. Owned by the `study-app-ia-cleanup` WP.
	 */
	PAGE_EXPLAINER_DISMISSED: 'study.page_explainer.dismissed',
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

/**
 * Knowledge-node render modes. `'learn'` is the default and matches the
 * discovery-first pedagogy of ADR 011. Value of the
 * `study.knowledge.render_mode` user_pref row. Owned by WP 3.
 */
export const RENDER_MODES = {
	LEARN: 'learn',
	REVIEW: 'review',
	MEMORIZE: 'memorize',
} as const;

export type RenderMode = (typeof RENDER_MODES)[keyof typeof RENDER_MODES];

export const RENDER_MODE_VALUES: readonly RenderMode[] = Object.values(RENDER_MODES);

/** Default render mode when no preference is stored. */
export const RENDER_MODE_DEFAULT: RenderMode = RENDER_MODES.LEARN;
