/**
 * Server load for `/study` -- the post-login home (study-home WP).
 *
 * Composes the existing BC primitives into the page's three sections:
 * Progress (3 pills), Today (briefing), and Map (one of three tab
 * projections). Nothing here is novel data -- the load is a fan-out over
 * `getCredentialMastery`, `getWeakAreas`, `getRepBacklog`,
 * `buildTodayBriefing`, and the relevant tree builder for the active
 * tab.
 *
 * Tab resolution order: `?tab=` query param wins (browser back-button
 * stays honest), then the stored `study.home.map_tab` preference, then
 * the default ACS projection.
 *
 * Form action `?/setPref` -- one preference write per call. Validated
 * via the per-key Zod schemas in `USER_PREF_SCHEMAS`. Optimistic UI on
 * the client side; this action returns success / error tuples for the
 * panel to roll back on error.
 */

import { requireAuth } from '@ab/auth';
import {
	type CredentialMasteryRollup,
	type CredentialRow,
	getActivePlan,
	getCredentialById,
	getCredentialMastery,
	getCredentialPrimarySyllabus,
	getPageExplainerDismissals,
	getPrimaryGoal,
	getRepBacklog,
	getUserPrefs,
	isUserPrefKey,
	type PageExplainerDismissals,
	type RepBacklog,
	setUserPref,
	USER_PREF_SCHEMAS,
	type UserPrefValue,
} from '@ab/bc-study';
import {
	CITATION_ORDER_DEFAULT,
	type CitationOrder,
	STUDY_MAP_TAB_DEFAULT,
	STUDY_MAP_TAB_VALUES,
	STUDY_MAP_TABS,
	type StudyMapTab,
	USER_PREF_KEYS,
} from '@ab/constants';
import { db } from '@ab/db/connection';
import { fail, redirect } from '@sveltejs/kit';
import { sql } from 'drizzle-orm';
import { buildAcsTree } from './_lib/build-acs-tree';
import { buildCourseTree } from './_lib/build-course-tree';
import { buildHandbookTree, type FocusHandbookCitation } from './_lib/build-handbook-tree';
import { buildTodayBriefing } from './_lib/build-today-briefing';
import type { MapNode } from './_lib/map-types';
import type { TodayBriefing } from './_lib/today-types';
import type { Actions, PageServerLoad } from './$types';

function isMapTab(value: unknown): value is StudyMapTab {
	return typeof value === 'string' && (STUDY_MAP_TAB_VALUES as readonly string[]).includes(value);
}

function readPrefString(value: UserPrefValue | undefined): string | null {
	return typeof value === 'string' ? value : null;
}

function citationOrderFromPref(pref: string | null): CitationOrder {
	return pref === 'hb' || pref === 'reg' ? pref : CITATION_ORDER_DEFAULT;
}

export interface StudyHomePayload {
	kind: 'home';
	credential: { id: string; slug: string; title: string };
	goalTitle: string;
	mastery: CredentialMasteryRollup;
	briefing: TodayBriefing;
	repBacklog: RepBacklog;
	tab: StudyMapTab;
	tree: MapNode[];
	citationOrder: CitationOrder;
	focusNodeId: string | null;
	pageExplainerDismissals: PageExplainerDismissals;
}

export interface StudyHomeNoGoalPayload {
	kind: 'no-goal';
	citationOrder: CitationOrder;
	tab: StudyMapTab;
	pageExplainerDismissals: PageExplainerDismissals;
}

export interface StudyHomeNoPlanPayload {
	kind: 'no-plan';
	goalId: string;
	goalTitle: string;
	citationOrder: CitationOrder;
	tab: StudyMapTab;
	pageExplainerDismissals: PageExplainerDismissals;
}

export type StudyHomeData = StudyHomePayload | StudyHomeNoGoalPayload | StudyHomeNoPlanPayload;

export const load: PageServerLoad = async (event) => {
	const user = requireAuth(event);

	// Validate `?tab=` -- bogus values redirect (SH-23).
	const tabParam = event.url.searchParams.get('tab');
	if (tabParam !== null && !isMapTab(tabParam)) {
		throw redirect(302, '/study');
	}

	const [prefs, primaryGoal, activePlan, pageExplainerDismissals] = await Promise.all([
		getUserPrefs(user.id, [USER_PREF_KEYS.CITATION_ORDER, USER_PREF_KEYS.MAP_TAB]),
		getPrimaryGoal(user.id),
		getActivePlan(user.id),
		getPageExplainerDismissals(user.id),
	]);

	const citationOrderPref = readPrefString(prefs[USER_PREF_KEYS.CITATION_ORDER]);
	const mapTabPref = readPrefString(prefs[USER_PREF_KEYS.MAP_TAB]);

	const citationOrder = citationOrderFromPref(citationOrderPref);
	const tabFromPref = isMapTab(mapTabPref) ? mapTabPref : null;
	const tab: StudyMapTab = isMapTab(tabParam) ? tabParam : (tabFromPref ?? STUDY_MAP_TAB_DEFAULT);

	if (primaryGoal === null) {
		return {
			kind: 'no-goal' as const,
			citationOrder,
			tab,
			pageExplainerDismissals,
		} satisfies StudyHomeNoGoalPayload;
	}

	// Goal exists but no active plan -- the user lands in the "build a plan"
	// state. Spec ID IAC-1.7 + IAC-2.5: Home shows "Build a plan for {goal title}"
	// as the primary CTA; no Today panel + no map yet because the engine
	// reads session shape from the active plan.
	if (activePlan === null) {
		return {
			kind: 'no-plan' as const,
			goalId: primaryGoal.id,
			goalTitle: primaryGoal.title,
			citationOrder,
			tab,
			pageExplainerDismissals,
		} satisfies StudyHomeNoPlanPayload;
	}

	// Resolve the goal's primary credential. The goal links to syllabi via
	// `goal_syllabus`; each syllabus links to a credential via
	// `credential_syllabus`. We pick the credential whose primary syllabus
	// is on the goal, falling back to the first credential reachable from
	// any goal syllabus when none is marked primary.
	const credentialId = await resolveGoalPrimaryCredential(primaryGoal.id);
	if (credentialId === null) {
		return {
			kind: 'no-goal' as const,
			citationOrder,
			tab,
			pageExplainerDismissals,
		} satisfies StudyHomeNoGoalPayload;
	}
	const [credential, primarySyllabus] = await Promise.all([
		getCredentialById(credentialId, db),
		getCredentialPrimarySyllabus(credentialId, db),
	]);

	const [mastery, repBacklog, briefing] = await Promise.all([
		getCredentialMastery(user.id, credentialId, db),
		getRepBacklog(user.id, db),
		buildTodayBriefing(user.id, db),
	]);

	const focusAreaCode = resolveFocusAreaCode(briefing, mastery);
	const focusNodeId = briefing.kind === 'focus' ? briefing.focusNodeId : null;

	const tree = await buildTreeForTab(
		tab,
		user.id,
		credential,
		mastery,
		primarySyllabus?.id ?? null,
		focusAreaCode,
		null,
	);

	return {
		kind: 'home' as const,
		credential: { id: credential.id, slug: credential.slug, title: credential.title },
		goalTitle: primaryGoal.title,
		mastery,
		briefing,
		repBacklog,
		tab,
		tree,
		citationOrder,
		focusNodeId,
		pageExplainerDismissals,
	} satisfies StudyHomePayload;
};

/**
 * Pick the area code to auto-expand on the ACS projection. Today the
 * briefing carries a `focusAreaId` that's the weak-area domain string,
 * not a syllabus area code. Resolution: match the briefing's leaf
 * (focus node) to the credential's areas via `mastery.areas` if any
 * area's title contains a fragment of the leaf title; otherwise pick
 * the area with the lowest mastered/total ratio. Returns null when
 * the rollup is empty.
 */
async function resolveGoalPrimaryCredential(goalId: string): Promise<string | null> {
	// One query: find the goal's primary-syllabus credential. The
	// credential_syllabus join filters for `primacy = 'primary'`; if
	// that returns nothing, fall through to any credential reachable
	// from any of the goal's syllabi.
	const rows = await db.execute(sql`
		SELECT cs.credential_id, cs.primacy
		FROM study.goal_syllabus gs
		INNER JOIN study.credential_syllabus cs ON cs.syllabus_id = gs.syllabus_id
		WHERE gs.goal_id = ${goalId}
		ORDER BY (CASE WHEN cs.primacy = 'primary' THEN 0 ELSE 1 END), cs.credential_id
		LIMIT 1
	`);
	type Row = { credential_id: string; primacy: string };
	const list = rows as unknown as Row[];
	return list[0]?.credential_id ?? null;
}

function resolveFocusAreaCode(briefing: TodayBriefing, mastery: CredentialMasteryRollup): string | null {
	if (mastery.areas.length === 0) return null;
	if (briefing.kind !== 'focus') {
		// Auto-expand the area with the deepest gap (lowest mastered/total ratio).
		let worst: { code: string; ratio: number } | null = null;
		for (const area of mastery.areas) {
			if (area.totalLeaves === 0) continue;
			const ratio = area.masteredLeaves / area.totalLeaves;
			if (worst === null || ratio < worst.ratio) worst = { code: area.areaCode, ratio };
		}
		return worst?.code ?? null;
	}
	// Briefing has a focus leaf. Try to find an area whose title
	// matches the briefing's areaTitle; otherwise fall through to the
	// "deepest gap" pick.
	const target = briefing.areaTitle.toLowerCase();
	for (const area of mastery.areas) {
		if (area.areaTitle.toLowerCase().includes(target) || target.includes(area.areaTitle.toLowerCase())) {
			return area.areaCode;
		}
	}
	let worst: { code: string; ratio: number } | null = null;
	for (const area of mastery.areas) {
		if (area.totalLeaves === 0) continue;
		const ratio = area.masteredLeaves / area.totalLeaves;
		if (worst === null || ratio < worst.ratio) worst = { code: area.areaCode, ratio };
	}
	return worst?.code ?? null;
}

async function buildTreeForTab(
	tab: StudyMapTab,
	userId: string,
	credential: CredentialRow,
	mastery: CredentialMasteryRollup,
	primarySyllabusId: string | null,
	focusAreaCode: string | null,
	focusHandbook: FocusHandbookCitation | null,
): Promise<MapNode[]> {
	switch (tab) {
		case STUDY_MAP_TABS.ACS:
			return buildAcsTree(userId, credential, mastery, primarySyllabusId, focusAreaCode, db);
		case STUDY_MAP_TABS.HANDBOOK:
			return buildHandbookTree(userId, focusHandbook, db);
		case STUDY_MAP_TABS.COURSE:
			return buildCourseTree(userId, db);
	}
}

export const actions: Actions = {
	setPref: async (event) => {
		const user = requireAuth(event);
		const formData = await event.request.formData();
		const key = formData.get('key');
		const value = formData.get('value');
		if (typeof key !== 'string' || !isUserPrefKey(key)) {
			return fail(400, { ok: false, error: 'invalid pref key' });
		}
		if (typeof value !== 'string') {
			return fail(400, { ok: false, error: 'pref value must be a string' });
		}
		const schema = USER_PREF_SCHEMAS[key];
		const parsed = schema.safeParse(value);
		if (!parsed.success) {
			return fail(400, { ok: false, error: 'pref value rejected by schema' });
		}
		try {
			await setUserPref(user.id, key, parsed.data, db);
		} catch (err) {
			return fail(500, { ok: false, error: (err as Error).message });
		}
		return { ok: true };
	},
};
