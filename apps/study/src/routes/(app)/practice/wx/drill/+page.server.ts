/**
 * Server load for `/practice/wx/drill`.
 *
 * Pre-session, this is a setup screen: the loader returns the catalog of
 * available products + token families + the user's prior mastery snapshot
 * so the in-flight summary can show "you have N passive families on METAR"
 * etc. Once the student clicks "Start drill," the page's POST to
 * `/practice/wx/drill/start` returns the actual items + session id;
 * after that the page state lives in browser memory until
 * `/practice/wx/drill/end` closes the session.
 */

import { requireAuth } from '@ab/auth';
import { buildMasteryMap } from '@ab/bc-wx-practice/server';
import {
	WX_PRACTICE_ITEM_COUNTS,
	WX_PRACTICE_MASTERY_STATES,
	WX_PRACTICE_TIER_MAX,
	WX_PRACTICE_TIER_MIN,
	WX_PRODUCT_LABELS,
	WX_PRODUCT_VALUES,
	type WxProduct,
} from '@ab/constants';
import { loadCatalogFamilies } from '@ab/wx-drill/server';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async (event) => {
	const user = requireAuth(event);

	const catalog = loadCatalogFamilies();
	const products = WX_PRODUCT_VALUES.map((p) => ({
		slug: p,
		label: WX_PRODUCT_LABELS[p],
		families: catalog[p],
	}));

	// Per-product mastery counts: how many families are active vs passive vs
	// demoted vs never-seen, so the setup screen can show a "your current
	// fluency snapshot" panel without sending the full ledger to the
	// browser.
	const masterySummary: Record<WxProduct, { active: number; passive: number; demoted: number; neverSeen: number }> = {
		metar: { active: 0, passive: 0, demoted: 0, neverSeen: 0 },
		taf: { active: 0, passive: 0, demoted: 0, neverSeen: 0 },
		pirep: { active: 0, passive: 0, demoted: 0, neverSeen: 0 },
		fb: { active: 0, passive: 0, demoted: 0, neverSeen: 0 },
		airmet: { active: 0, passive: 0, demoted: 0, neverSeen: 0 },
	};

	const masteryMap = await buildMasteryMap(user.id, undefined);
	const seenFamilies = new Set<string>();
	for (const row of masteryMap.values()) {
		const product = row.product;
		seenFamilies.add(`${product}::${row.family}`);
		if (row.state === WX_PRACTICE_MASTERY_STATES.PASSIVE) masterySummary[product].passive += 1;
		else if (row.state === WX_PRACTICE_MASTERY_STATES.DEMOTED) masterySummary[product].demoted += 1;
		else masterySummary[product].active += 1;
	}
	for (const product of WX_PRODUCT_VALUES) {
		for (const fam of catalog[product]) {
			if (!seenFamilies.has(`${product}::${fam}`)) {
				masterySummary[product].neverSeen += 1;
			}
		}
	}

	return {
		products,
		masterySummary,
		tierRange: { min: WX_PRACTICE_TIER_MIN, max: WX_PRACTICE_TIER_MAX },
		itemCounts: [...WX_PRACTICE_ITEM_COUNTS],
	};
};
