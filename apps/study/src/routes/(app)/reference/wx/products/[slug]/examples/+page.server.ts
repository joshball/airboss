import { requireAuth } from '@ab/auth';
import { QUERY_PARAMS } from '@ab/constants';
import { parseFbGrid, parseMetar, parsePirep, parseTaf } from '@ab/wx-charts';
import { explainFb, explainMetar, explainPirep, explainTaf, type TokenAnnotation } from '@ab/wx-explain';
import { error } from '@sveltejs/kit';
import {
	isWxCatalogProductSlug,
	loadWxCatalogProduct,
	type WxCatalogExample,
	type WxCatalogProduct,
	type WxCatalogProductSlug,
	type WxCatalogReference,
	type WxCatalogTokenFamily,
} from '../../../_lib/wx-catalog.server';
import type { PageServerLoad } from './$types';

/**
 * Split a comma-separated `?families=` value into a deduped, sorted slug
 * list. Empty entries collapse to an empty array.
 */
function parseFamilyList(value: string | null): string[] {
	if (value === null) return [];
	const parts = value
		.split(',')
		.map((s) => s.trim())
		.filter((s) => s.length > 0);
	return Array.from(new Set(parts)).sort();
}

/**
 * Filter examples to those exercising EVERY active family (AND-combine).
 * Empty filter list returns the input unchanged.
 */
function filterByFamilies(
	examples: ReadonlyArray<WxCatalogExample>,
	families: ReadonlyArray<string>,
): ReadonlyArray<WxCatalogExample> {
	if (families.length === 0) return examples;
	return examples.filter((ex) => families.every((fam) => ex.tokenFamilies.includes(fam)));
}

/**
 * Filter examples by free-text search. Matches case-insensitively against
 * the raw encoded text and the synoptic story; the raw text already
 * contains the station ICAO so a search like `KORD` reduces to the
 * station-substring case naturally.
 */
function filterBySearch(examples: ReadonlyArray<WxCatalogExample>, query: string): ReadonlyArray<WxCatalogExample> {
	if (query.length === 0) return examples;
	const needle = query.toLowerCase();
	return examples.filter((ex) => ex.raw.toLowerCase().includes(needle) || ex.synoptic.toLowerCase().includes(needle));
}

/**
 * Decode one example via the appropriate parser + explainer pair. Returns
 * `null` when the product has no parser available (AIRMET / SIGMET --
 * the catalog ships raw bulletin text but `@ab/wx-explain.explainAirmet`
 * works off the structured `AirmetAdvisory` shape from `@ab/wx-engine`,
 * not a raw bulletin string, so decode-on-demand is a no-op here).
 */
function decodeExample(slug: WxCatalogProductSlug, raw: string): TokenAnnotation[] | null {
	try {
		if (slug === 'metar') {
			return explainMetar(parseMetar(raw));
		}
		if (slug === 'taf') {
			return explainTaf(parseTaf(raw));
		}
		if (slug === 'pirep') {
			return explainPirep(parsePirep(raw));
		}
		if (slug === 'fb') {
			return explainFb(parseFbGrid(raw));
		}
		return null;
	} catch (_cause) {
		// Defensive -- the catalog round-trip is gated in `bun run check`,
		// so a parser failure here should not happen in committed catalog
		// data. Surface as `null` rather than 500 the page so a single bad
		// example doesn't blank the whole list.
		return null;
	}
}

/** Reference list deduped by `${source}::${detail}` for the bottom panel. */
function dedupedReferences(families: ReadonlyArray<WxCatalogTokenFamily>): ReadonlyArray<WxCatalogReference> {
	const seen = new Set<string>();
	const out: WxCatalogReference[] = [];
	for (const fam of families) {
		for (const ref of fam.references) {
			const key = `${ref.source}::${ref.detail}`;
			if (seen.has(key)) continue;
			seen.add(key);
			out.push(ref);
		}
	}
	return out;
}

export const load: PageServerLoad = async (event) => {
	requireAuth(event);

	const slug = event.params.slug;
	if (!isWxCatalogProductSlug(slug)) {
		error(404, `Weather product not found: ${slug}`);
	}

	const product: WxCatalogProduct | null = await loadWxCatalogProduct(slug);
	if (product === null) {
		error(404, `Weather product not found: ${slug}`);
	}

	const familyFilter = parseFamilyList(event.url.searchParams.get(QUERY_PARAMS.FAMILIES));
	const search = event.url.searchParams.get(QUERY_PARAMS.SEARCH)?.trim() ?? '';
	const expandSlug = event.url.searchParams.get(QUERY_PARAMS.EXPAND)?.trim() ?? '';

	// Reject filter slugs that aren't part of this product's family vocabulary.
	// Silently drop unknowns so a stale URL doesn't 404.
	const knownFamilySlugs = new Set(product.tokenFamilies.map((f) => f.slug));
	const activeFamilies = familyFilter.filter((f) => knownFamilySlugs.has(f));

	const afterFamily = filterByFamilies(product.examples, activeFamilies);
	const filteredExamples = filterBySearch(afterFamily, search);

	// Decode-on-demand: only the expanded card is decoded server-side so the
	// load function stays cheap when the page is just browsed.
	let expandedAnnotations: TokenAnnotation[] | null = null;
	if (expandSlug.length > 0 && filteredExamples.some((ex) => ex.slug === expandSlug)) {
		const ex = filteredExamples.find((e) => e.slug === expandSlug);
		if (ex) expandedAnnotations = decodeExample(slug, ex.raw);
	}

	const references = dedupedReferences(product.tokenFamilies);

	return {
		product: {
			slug: product.slug,
			label: product.label,
			tokenFamilies: product.tokenFamilies,
		},
		examples: filteredExamples,
		totalExampleCount: product.examples.length,
		activeFamilies,
		search,
		expandSlug: expandedAnnotations !== null ? expandSlug : '',
		expandedAnnotations,
		references,
	};
};
