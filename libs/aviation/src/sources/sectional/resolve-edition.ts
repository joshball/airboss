/**
 * Edition resolver for FAA VFR sectional charts (wp-hangar-non-textual).
 *
 * Reads the AeroNav visual-products index page, extracts the current edition
 * effective date, and substitutes it (plus the region) into the operator's
 * stored URL template. The fetch handler calls this before downloading so
 * every fetch captures:
 *
 *   - `effectiveDate` -- the 56-day cycle start date (e.g. 2026-03-21)
 *   - `editionNumber` -- FAA edition number when the page exposes it
 *   - `resolvedUrl`   -- concrete URL the fetch actually runs against
 *
 * The parser is intentionally forgiving: AeroNav re-styles the index page
 * every few cycles, so a tight CSS selector would fail loudly. We read any
 * YYYY-MM-DD token inside a block that mentions the region and pick the
 * latest by date. On no match, we throw with a clear message -- silent
 * fallback to a wrong URL would corrupt downstream sha comparisons.
 *
 * Tests inject a `fetchHtml` override and feed a committed fixture HTML
 * blob so CI does not depend on network access to AeroNav.
 */

import { SECTIONAL_URL_PLACEHOLDERS } from '@ab/constants';

export interface ResolvedEdition {
	/** ISO-8601 date the edition became effective. */
	effectiveDate: string;
	/** FAA edition number (e.g. 116). Null when the page does not expose it. */
	editionNumber: number | null;
	/** Concrete URL the fetch will run against. */
	resolvedUrl: string;
	/** ISO-8601 timestamp when this edition was resolved. */
	resolvedAt: string;
}

export interface ResolveEditionOptions {
	/** Region token substituted for `{region}` in the template (e.g. "Denver"). */
	region: string;
	/** FAA AeroNav index URL; the scraper fetches this. */
	indexUrl: string;
	/** URL template; must include `{edition-date}` and may include `{region}`. */
	urlTemplate: string;
	/** Injected HTML fetcher so tests can feed a committed fixture. */
	fetchHtml: (url: string) => Promise<string>;
	/** Injected now() so tests can pin `resolvedAt`. Defaults to new Date(). */
	now?: () => Date;
}

/** YYYY-MM-DD regex used to extract effective-date tokens from the HTML. */
const DATE_RE = /(\d{4}-\d{2}-\d{2})/g;

/** "Edition 116" / "Edition: 116" / "116th edition" -- best-effort grab. */
const EDITION_NUM_RE = /[Ee]dition[\s:]*(\d{1,4})/;

function pickLatestDate(dates: readonly string[]): string | null {
	if (dates.length === 0) return null;
	const sorted = [...dates].sort();
	return sorted[sorted.length - 1] ?? null;
}

function escapeRegex(s: string): string {
	return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/**
 * Find a block of HTML that mentions the region, then extract the latest
 * YYYY-MM-DD inside it. Falls back to the whole page if no region-scoped
 * block is found -- callers who want strict matching can inspect the
 * `resolvedUrl` after substitution.
 */
function extractDateForRegion(html: string, region: string): string | null {
	const regionRe = new RegExp(escapeRegex(region), 'i');
	if (!regionRe.test(html)) return null;
	// Split on blank lines / block tags; scan each chunk for a date when the
	// chunk also mentions the region.
	const chunks = html.split(/(?:<\/(?:li|tr|p|section|article|div)>|\n\s*\n)/i);
	const regionChunks = chunks.filter((chunk) => regionRe.test(chunk));
	const candidate = regionChunks.length > 0 ? regionChunks.join('\n') : html;
	const matches = candidate.match(DATE_RE) ?? [];
	return pickLatestDate(matches);
}

function extractEditionNumber(html: string, region: string): number | null {
	const regionRe = new RegExp(escapeRegex(region), 'i');
	const chunks = html.split(/(?:<\/(?:li|tr|p|section|article|div)>|\n\s*\n)/i);
	const regionChunks = chunks.filter((chunk) => regionRe.test(chunk));
	const scan = regionChunks.length > 0 ? regionChunks.join('\n') : html;
	const match = scan.match(EDITION_NUM_RE);
	if (!match?.[1]) return null;
	const n = Number.parseInt(match[1], 10);
	return Number.isFinite(n) ? n : null;
}

/**
 * Resolve the current sectional edition for the given region against the
 * provided AeroNav-style index URL. Throws with an actionable message when
 * the scrape cannot produce a concrete URL.
 */
export async function resolveCurrentSectionalEdition(opts: ResolveEditionOptions): Promise<ResolvedEdition> {
	if (!opts.urlTemplate.includes(SECTIONAL_URL_PLACEHOLDERS.EDITION_DATE)) {
		throw new Error(`urlTemplate must include ${SECTIONAL_URL_PLACEHOLDERS.EDITION_DATE}`);
	}
	const html = await opts.fetchHtml(opts.indexUrl);
	if (!html || html.trim().length === 0) {
		throw new Error(`resolve-edition: empty response from ${opts.indexUrl}`);
	}

	const effectiveDate = extractDateForRegion(html, opts.region);
	if (!effectiveDate) {
		throw new Error(
			`resolve-edition: no YYYY-MM-DD edition date found for region "${opts.region}" at ${opts.indexUrl}`,
		);
	}

	const editionNumber = extractEditionNumber(html, opts.region);

	const resolvedUrl = opts.urlTemplate
		.replace(new RegExp(escapeRegex(SECTIONAL_URL_PLACEHOLDERS.EDITION_DATE), 'g'), effectiveDate)
		.replace(new RegExp(escapeRegex(SECTIONAL_URL_PLACEHOLDERS.REGION), 'g'), opts.region);

	const resolvedAt = (opts.now ?? (() => new Date()))().toISOString();

	return { effectiveDate, editionNumber, resolvedUrl, resolvedAt };
}
