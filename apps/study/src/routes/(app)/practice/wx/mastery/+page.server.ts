import { requireAuth } from '@ab/auth';
import { QUERY_PARAMS } from '@ab/constants';
import { loadFamiliesForProduct, loadWxPracticeCatalog } from './_lib/catalog.server';
import { fetchMasteryRows } from './_lib/mastery.server';
import {
	composeDisplayRows,
	filterRowsByState,
	parseProductParam,
	parseSortParam,
	parseStateParam,
	pickWeakFamilies,
	productLabel,
	sortRows,
	WX_MASTERY_PRODUCTS,
	type WxMasteryPageData,
	type WxMasteryProductTab,
	type WxMasterySummary,
} from './_lib/types';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async (event): Promise<WxMasteryPageData> => {
	const user = requireAuth(event);

	const product = parseProductParam(event.url.searchParams.get(QUERY_PARAMS.PRODUCT));
	const stateFilters = parseStateParam(event.url.searchParams.get(QUERY_PARAMS.STATE));
	const sort = parseSortParam(event.url.searchParams.get(QUERY_PARAMS.SORT));

	const families = await loadFamiliesForProduct(product);
	const mastery = await fetchMasteryRows(user.id, product);

	// Compose every catalog family into a display row (catalog is the
	// "all families" set; mastery is the sparse overlay).
	const composed = composeDisplayRows(families, mastery, product);
	const filtered = filterRowsByState(composed, stateFilters);
	const sorted = sortRows(filtered, sort);

	// Weak-family pick comes from the FULL composed set (not the filtered
	// view) so "Drill my weak families" stays meaningful even when the user
	// has hidden the relevant states. Weakness is about active/demoted with
	// low ratios, not about the current filter state.
	const weakFamilies = pickWeakFamilies(composed);

	// Per-product nav tabs: family-count + how many the user has attempted.
	// Each tab does a tiny query; this is the only N+1 the page issues and
	// the count is bounded (one per WX_MASTERY_PRODUCTS entry, currently 5).
	const allCatalog = await loadWxPracticeCatalog();
	const tabs: WxMasteryProductTab[] = [];
	for (const p of WX_MASTERY_PRODUCTS) {
		const catalogEntry = allCatalog.find((c) => c.product === p);
		const familyCount = catalogEntry?.families.length ?? 0;
		const rows = p === product ? mastery : await fetchMasteryRows(user.id, p);
		const attemptedCount = rows.filter((r) => r.attempts > 0).length;
		tabs.push({ product: p, label: productLabel(p), familyCount, attemptedCount });
	}

	const summary: WxMasterySummary = {
		totalFamilies: composed.length,
		attemptedFamilies: composed.filter((r) => r.state !== 'never-seen').length,
		activeCount: composed.filter((r) => r.state === 'active').length,
		passiveCount: composed.filter((r) => r.state === 'passive').length,
		demotedCount: composed.filter((r) => r.state === 'demoted').length,
		neverSeenCount: composed.filter((r) => r.state === 'never-seen').length,
	};

	return {
		product,
		stateFilters,
		sort,
		rows: sorted,
		weakFamilies,
		summary,
		tabs,
	};
};
