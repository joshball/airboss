/**
 * Server load for `/study` -- the post-login home (study-home WP).
 *
 * v1 (this commit): minimal cert-agnostic shape so the redirect from `/`
 * lands cleanly. The full data composition (mastery, weak areas, today
 * briefing, three map projections) is fleshed out in tasks 5-9 of the WP.
 * Today we deliver:
 *
 *   - Auth gate
 *   - User-pref read for `citation_order` + `map_tab` (steps 1-1.5 already
 *     shipped; this proves the BC end-to-end)
 *   - Tab resolution: URL param > stored pref > default
 *   - No-goal short-circuit
 *
 * The page renders the tiles and a "set a primary goal" banner when no
 * primary goal exists, plus the no-goal cert-agnostic mode otherwise --
 * which is the SH-5 happy path. SH-1 / SH-3 / SH-13 et al. gain real data
 * once the tree builders land.
 */

import { requireAuth } from '@ab/auth';
import { getPrimaryGoal, getUserPrefs, type UserPrefValue } from '@ab/bc-study';
import {
	CITATION_ORDER_DEFAULT,
	STUDY_MAP_TAB_DEFAULT,
	STUDY_MAP_TAB_VALUES,
	type StudyMapTab,
	USER_PREF_KEYS,
} from '@ab/constants';
import { redirect } from '@sveltejs/kit';
import type { PageServerLoad } from './$types';

function isMapTab(value: unknown): value is StudyMapTab {
	return typeof value === 'string' && (STUDY_MAP_TAB_VALUES as readonly string[]).includes(value);
}

function readPrefString(value: UserPrefValue | undefined): string | null {
	return typeof value === 'string' ? value : null;
}

export const load: PageServerLoad = async (event) => {
	const user = requireAuth(event);

	// Validate `?tab=` -- bogus values redirect (SH-23).
	const tabParam = event.url.searchParams.get('tab');
	if (tabParam !== null && !isMapTab(tabParam)) {
		throw redirect(302, '/study');
	}

	const [prefs, primaryGoal] = await Promise.all([
		getUserPrefs(user.id, [USER_PREF_KEYS.CITATION_ORDER, USER_PREF_KEYS.MAP_TAB]),
		getPrimaryGoal(user.id),
	]);

	const citationOrderPref = readPrefString(prefs[USER_PREF_KEYS.CITATION_ORDER]);
	const mapTabPref = readPrefString(prefs[USER_PREF_KEYS.MAP_TAB]);

	const citationOrder =
		citationOrderPref === 'hb' || citationOrderPref === 'reg' ? citationOrderPref : CITATION_ORDER_DEFAULT;
	const tabFromPref = isMapTab(mapTabPref) ? mapTabPref : null;
	// URL param wins, then stored pref, then default. Matches WP spec
	// "Behavior -> Loading -> URL wins for a navigation; pref is the default."
	const tab: StudyMapTab = isMapTab(tabParam) ? tabParam : (tabFromPref ?? STUDY_MAP_TAB_DEFAULT);

	if (primaryGoal === null) {
		return {
			kind: 'no-goal' as const,
			userPrefs: { citationOrder, tab },
		};
	}

	// Steps 5-9 of `docs/work-packages/study-home/tasks.md` extend this load
	// with mastery (`getCredentialMastery`), weak areas (`getWeakAreas`), the
	// today briefing (`buildTodayBriefing`), rep backlog (`getRepBacklog`),
	// and the three map-tree builders dispatched on `tab`. They run in
	// parallel via `Promise.all` per the design.md "Data flow" diagram.
	return {
		kind: 'home' as const,
		userPrefs: { citationOrder, tab },
		primaryGoalId: primaryGoal.id,
	};
};
