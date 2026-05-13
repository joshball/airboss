import { requireAuth } from '@ab/auth';
import { listWxProductSummaries, type WxProductSummary } from '../_lib/wx-products.server';
import type { PageServerLoad } from './$types';

/**
 * Category render order. Drives both the heading order on the index page
 * and the bucketed grouping. Categories present in the corpus but missing
 * from this list fall into a synthetic "Other" bucket at the bottom so
 * adding a new category to the markdown corpus does not break the page.
 */
const CATEGORY_ORDER: ReadonlyArray<{ readonly key: string; readonly label: string }> = [
	{ key: 'surface-obs', label: 'Surface observations' },
	{ key: 'terminal-forecast', label: 'Terminal forecasts' },
	{ key: 'area-product', label: 'Area products' },
	{ key: 'hazard-advisory', label: 'Hazard advisories' },
	{ key: 'pirep', label: 'PIREPs' },
	{ key: 'winds-temps', label: 'Winds and temperatures' },
	{ key: 'icing-turb', label: 'Icing and turbulence' },
	{ key: 'chart', label: 'Charts' },
	{ key: 'radar-sat', label: 'Radar and satellite' },
	{ key: 'tfr-notam', label: 'TFRs and NOTAMs' },
];

const OTHER_CATEGORY_LABEL = 'Other';

interface CategoryGroup {
	readonly key: string;
	readonly label: string;
	readonly products: ReadonlyArray<WxProductSummary>;
}

export const load: PageServerLoad = async (event) => {
	requireAuth(event);

	const summaries = await listWxProductSummaries();

	// Bucket by category, preserving the curated order. Unknown categories
	// collapse into a single "Other" bucket so authoring a new category in
	// the corpus does not 500 the page.
	const buckets = new Map<string, WxProductSummary[]>();
	for (const c of CATEGORY_ORDER) buckets.set(c.key, []);
	const otherBucket: WxProductSummary[] = [];
	for (const product of summaries) {
		const target = buckets.get(product.category);
		if (target !== undefined) target.push(product);
		else otherBucket.push(product);
	}

	// Sort within each bucket: tier 1 before tier 2 (ascending), then by
	// title for stable ordering. The corpus is authored in tier 1 -> tier 2
	// so this matches author intent for the dominant case.
	const compare = (a: WxProductSummary, b: WxProductSummary): number => {
		const tierA = Number.parseInt(a.tier, 10);
		const tierB = Number.parseInt(b.tier, 10);
		const safeA = Number.isFinite(tierA) ? tierA : 99;
		const safeB = Number.isFinite(tierB) ? tierB : 99;
		if (safeA !== safeB) return safeA - safeB;
		return a.title.localeCompare(b.title);
	};

	const groups: CategoryGroup[] = [];
	for (const c of CATEGORY_ORDER) {
		const products = (buckets.get(c.key) ?? []).slice().sort(compare);
		if (products.length === 0) continue;
		groups.push({ key: c.key, label: c.label, products });
	}
	if (otherBucket.length > 0) {
		groups.push({
			key: 'other',
			label: OTHER_CATEGORY_LABEL,
			products: otherBucket.slice().sort(compare),
		});
	}

	return {
		groups,
		total: summaries.length,
	};
};
