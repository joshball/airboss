/**
 * `/roadmap` -- read-only WP browser. Phase 8 of the
 * `tracking-system-overhaul` WP. Reads `docs/work-packages/<slug>/spec.md`
 * frontmatter via `scripts/lib/wp-loader.ts`, applies URL-shareable filters,
 * and renders a status-grouped board.
 *
 * The loader uses `node:fs`; this `+page.server.ts` is server-only by
 * SvelteKit convention and `scripts/check-browser-globals.ts` excludes it
 * from the client-eligible scan, so the static import is safe. See the
 * top-of-file comment in `scripts/lib/wp-loader.ts` -- the author
 * anticipates this exact callsite.
 *
 * Mutations (status flips, review-status flips) are explicitly out of scope
 * for Phase 8. Use `bun run wp set` from the CLI.
 */

import { requireRole } from '@ab/auth';
import {
	ROADMAP_QUERY_PARAMS,
	ROLES,
	type RoadmapQueryParam,
	WP_AGENT_REVIEW_STATUSES,
	WP_CATEGORIES,
	WP_HUMAN_REVIEW_STATUSES,
	WP_PRODUCTS,
	WP_STATUSES,
	type WPCategory,
	type WPHumanReviewStatus,
	type WPProduct,
	type WPStatus,
} from '@ab/constants';
import type { WorkPackage, WorkPackageFrontmatter } from '@ab/types';
import { loadAllWorkPackages } from '@ab/wp-loader';
import type { PageServerLoad } from './$types';

/** Narrow row shape exposed to the client. We deliberately do NOT ship the
 * full `WorkPackage` (which carries an absolute filesystem path) or the
 * raw frontmatter object (which can carry author-side keys we don't want
 * in the bundle). */
export interface RoadmapRow {
	id: string;
	title: string;
	product: WPProduct | null;
	category: WPCategory | null;
	status: WPStatus | null;
	humanReview: WPHumanReviewStatus | null;
	agentReview: 'pending' | 'done' | null;
	tags: readonly string[];
	dependsOn: readonly string[];
	unblocks: readonly string[];
	created: string | null;
	shippedDate: string | null;
	shippedPrs: readonly number[];
	owner: 'agent' | 'user' | null;
	validationErrorCount: number;
}

export interface RoadmapFacetCount<T extends string> {
	value: T;
	count: number;
}

export interface RoadmapFilters {
	product: WPProduct | null;
	category: WPCategory | null;
	status: WPStatus | null;
	humanReview: WPHumanReviewStatus | null;
	tag: string | null;
	search: string;
}

/** Group key used by the `/roadmap` index page. We hoist `unparseable` (a WP
 * with a frontmatter parse / schema failure) above the lifecycle statuses so
 * these problems are visible. */
export type RoadmapGroupKey = WPStatus | 'unparseable';

export const load: PageServerLoad = (event) => {
	requireRole(event, ROLES.AUTHOR, ROLES.OPERATOR, ROLES.ADMIN);
	const all = loadAllWorkPackages();
	const filters = parseFilters(event.url.searchParams);
	const filtered = applyFilters(all, filters);
	const rows = filtered.map(toRoadmapRow);
	// Facet counts run against the UN-filtered set so the chips show the
	// total, not the post-filter remainder. This matches the UX expectation
	// for a faceted browse (chips are always actionable).
	const facets = buildFacets(all);
	const allTags = collectTags(all);
	return {
		rows,
		filters,
		facets,
		allTags,
		totalCount: all.length,
		filteredCount: rows.length,
	};
};

function parseFilters(searchParams: URLSearchParams): RoadmapFilters {
	const product = parseEnum<WPProduct>(searchParams.get(qp('PRODUCT')), WP_PRODUCTS);
	const category = parseEnum<WPCategory>(searchParams.get(qp('CATEGORY')), WP_CATEGORIES);
	const status = parseEnum<WPStatus>(searchParams.get(qp('STATUS')), WP_STATUSES);
	const humanReview = parseEnum<WPHumanReviewStatus>(searchParams.get(qp('HUMAN_REVIEW')), WP_HUMAN_REVIEW_STATUSES);
	const tagRaw = searchParams.get(qp('TAG'));
	const tag = tagRaw && tagRaw.trim() !== '' ? tagRaw.trim() : null;
	const searchRaw = searchParams.get(qp('SEARCH')) ?? '';
	return {
		product,
		category,
		status,
		humanReview,
		tag,
		search: searchRaw,
	};
}

function qp(key: keyof typeof ROADMAP_QUERY_PARAMS): RoadmapQueryParam {
	return ROADMAP_QUERY_PARAMS[key];
}

function parseEnum<T extends string>(value: string | null, allowed: readonly T[]): T | null {
	if (value === null || value === '') return null;
	return (allowed as readonly string[]).includes(value) ? (value as T) : null;
}

function applyFilters(packages: readonly WorkPackage[], flags: RoadmapFilters): WorkPackage[] {
	const term = flags.search.trim().toLowerCase();
	return packages.filter((wp) => {
		const fm = wp.frontmatter;
		// Unparseable WPs surface only when no concrete filter is active OR
		// when the search term matches the id. They are never hidden behind
		// product / status filters since their frontmatter doesn't exist.
		if (fm === null) {
			const anyConcreteFilter =
				flags.product !== null ||
				flags.category !== null ||
				flags.status !== null ||
				flags.humanReview !== null ||
				flags.tag !== null;
			if (anyConcreteFilter) return false;
			if (term === '') return true;
			return wp.id.toLowerCase().includes(term);
		}
		if (flags.product !== null && fm.product !== flags.product) return false;
		if (flags.category !== null && fm.category !== flags.category) return false;
		if (flags.status !== null && fm.status !== flags.status) return false;
		if (flags.humanReview !== null && fm.human_review_status !== flags.humanReview) return false;
		if (flags.tag !== null && !fm.tags.includes(flags.tag)) return false;
		if (term !== '') {
			const haystack = `${wp.id} ${fm.title}`.toLowerCase();
			if (!haystack.includes(term)) return false;
		}
		return true;
	});
}

function toRoadmapRow(wp: WorkPackage): RoadmapRow {
	const fm: WorkPackageFrontmatter | null = wp.frontmatter;
	return {
		id: wp.id,
		title: fm?.title ?? wp.id,
		product: fm?.product ?? null,
		category: fm?.category ?? null,
		status: fm?.status ?? null,
		humanReview: fm?.human_review_status ?? null,
		agentReview: fm?.agent_review_status ?? null,
		tags: fm?.tags ?? [],
		dependsOn: fm?.depends_on ?? [],
		unblocks: fm?.unblocks ?? [],
		created: fm?.created ?? null,
		shippedDate: fm?.shipped_date ?? null,
		shippedPrs: fm?.shipped_prs ?? [],
		owner: fm?.owner ?? null,
		validationErrorCount: wp.validation_errors.length,
	};
}

function buildFacets(packages: readonly WorkPackage[]): {
	products: ReadonlyArray<RoadmapFacetCount<WPProduct>>;
	categories: ReadonlyArray<RoadmapFacetCount<WPCategory>>;
	statuses: ReadonlyArray<RoadmapFacetCount<WPStatus>>;
	humanReviews: ReadonlyArray<RoadmapFacetCount<WPHumanReviewStatus>>;
	agentReviews: ReadonlyArray<RoadmapFacetCount<'pending' | 'done'>>;
} {
	const productCounts = new Map<WPProduct, number>();
	const categoryCounts = new Map<WPCategory, number>();
	const statusCounts = new Map<WPStatus, number>();
	const humanCounts = new Map<WPHumanReviewStatus, number>();
	const agentCounts = new Map<'pending' | 'done', number>();
	for (const wp of packages) {
		const fm = wp.frontmatter;
		if (fm === null) continue;
		productCounts.set(fm.product, (productCounts.get(fm.product) ?? 0) + 1);
		categoryCounts.set(fm.category, (categoryCounts.get(fm.category) ?? 0) + 1);
		statusCounts.set(fm.status, (statusCounts.get(fm.status) ?? 0) + 1);
		humanCounts.set(fm.human_review_status, (humanCounts.get(fm.human_review_status) ?? 0) + 1);
		agentCounts.set(fm.agent_review_status, (agentCounts.get(fm.agent_review_status) ?? 0) + 1);
	}
	return {
		products: WP_PRODUCTS.map((value) => ({ value, count: productCounts.get(value) ?? 0 })),
		categories: WP_CATEGORIES.map((value) => ({ value, count: categoryCounts.get(value) ?? 0 })),
		statuses: WP_STATUSES.map((value) => ({ value, count: statusCounts.get(value) ?? 0 })),
		humanReviews: WP_HUMAN_REVIEW_STATUSES.map((value) => ({ value, count: humanCounts.get(value) ?? 0 })),
		agentReviews: WP_AGENT_REVIEW_STATUSES.map((value) => ({ value, count: agentCounts.get(value) ?? 0 })),
	};
}

function collectTags(packages: readonly WorkPackage[]): readonly string[] {
	const seen = new Set<string>();
	for (const wp of packages) {
		const fm = wp.frontmatter;
		if (fm === null) continue;
		for (const tag of fm.tags) seen.add(tag);
	}
	return [...seen].sort();
}
