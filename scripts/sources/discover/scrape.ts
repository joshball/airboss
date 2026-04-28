/**
 * HTML scrape for handbook parent pages.
 *
 * The FAA does not publish RSS, an API, or a structured changelog for
 * handbook errata (research dossier section 1). The parent page is the only
 * surface where new errata reliably appear. The scraper is deliberately
 * forgiving: a layout reshuffle on the FAA side should leave anchor tags
 * intact, so we extract every anchor whose href looks like a relevant PDF.
 *
 * Classification is best-effort. The layout hint comes from filename token
 * heuristics (`Addendum`, `Errata`, `Summary_of_Changes`, `Change`); the
 * apply pipeline does not depend on it -- it is a sanity-check signal for
 * the human reviewer.
 */

import { DISCOVERY_LAYOUT_HINTS, type DiscoveryLayoutHint } from '@ab/constants';
import { USER_AGENT } from '../download/constants';
import { COMMON_ERRATA_TOKENS, type HandbookCatalogueEntry } from './catalogue';
import type { ScrapeFinding } from './state';

export interface ScrapeError extends Error {
	readonly slug: string;
}

export class HandbookScrapeError extends Error implements ScrapeError {
	readonly slug: string;
	constructor(slug: string, message: string) {
		super(message);
		this.slug = slug;
	}
}

export interface ScrapePageResult {
	readonly slug: string;
	readonly url: string;
	readonly findings: readonly ScrapeFinding[];
}

export interface ScrapeOptions {
	readonly fetchImpl?: typeof fetch;
	readonly userAgent?: string;
	readonly timeoutMs?: number;
}

const DEFAULT_TIMEOUT_MS = 30_000;

const PDF_HREF_REGEX = /href\s*=\s*"([^"]+\.pdf[^"]*)"/gi;

/**
 * Fetch the parent page HTML, extract every PDF anchor, classify each by
 * filename heuristics, and return findings whose href contains either the
 * handbook-specific tokens OR one of the common errata tokens
 * (`addendum`, `errata`, `change`, `summary_of_changes`).
 *
 * Anchors whose href contains the handbook slug-anchored token but no errata
 * token are dropped; we only care about errata-shape PDFs, not the bound
 * edition (which the existing `bun run sources download` already fetches).
 */
export async function scrapeHandbookPage(
	entry: HandbookCatalogueEntry,
	options: ScrapeOptions = {},
): Promise<ScrapePageResult> {
	const fetchImpl = options.fetchImpl ?? globalThis.fetch;
	const userAgent = options.userAgent ?? USER_AGENT;
	const timeoutMs = options.timeoutMs ?? DEFAULT_TIMEOUT_MS;

	if (typeof fetchImpl !== 'function') {
		throw new HandbookScrapeError(entry.slug, 'no fetch implementation available');
	}

	const controller = new AbortController();
	const timer = setTimeout(() => controller.abort(), timeoutMs);
	let response: Response;
	try {
		response = await fetchImpl(entry.parentPageUrl, {
			redirect: 'follow',
			signal: controller.signal,
			headers: { 'User-Agent': userAgent },
		});
	} catch (error) {
		throw new HandbookScrapeError(entry.slug, `fetch failed for ${entry.parentPageUrl}: ${describe(error)}`);
	} finally {
		clearTimeout(timer);
	}

	if (!response.ok) {
		throw new HandbookScrapeError(entry.slug, `HTTP ${response.status} for ${entry.parentPageUrl}`);
	}

	let html: string;
	try {
		html = await response.text();
	} catch (error) {
		throw new HandbookScrapeError(
			entry.slug,
			`failed to read response body for ${entry.parentPageUrl}: ${describe(error)}`,
		);
	}

	const findings = extractFindings(html, entry, entry.parentPageUrl);
	return { slug: entry.slug, url: entry.parentPageUrl, findings };
}

/**
 * Extract findings from a parent-page HTML body. Pure function so the test
 * suite can drive it with HTML fixtures.
 */
export function extractFindings(
	html: string,
	entry: HandbookCatalogueEntry,
	baseUrl: string,
): readonly ScrapeFinding[] {
	const seen = new Set<string>();
	const out: ScrapeFinding[] = [];
	for (const url of iteratePdfHrefs(html, baseUrl)) {
		if (seen.has(url)) continue;
		seen.add(url);
		const filename = filenameFromUrl(url).toLowerCase();
		const matchedHandbookToken = entry.filenameTokens.some((tok) => filename.includes(tok.toLowerCase()));
		const matchedCommonToken = COMMON_ERRATA_TOKENS.some((tok) => filename.includes(tok));
		if (!matchedCommonToken) {
			// Not an errata-shape filename; skip even when it matches the slug
			// (the bound-edition PDF is downloaded by `bun run sources download`).
			continue;
		}
		// Tighten the slug anchor when the filename mentions a sibling
		// handbook (e.g., AFH addendum on the PHAK page would otherwise
		// match `addendum` on the PHAK scan). Per-entry tokens are the
		// authoritative slug anchor.
		if (!matchedHandbookToken && !urlInHandbookPath(url, entry)) {
			continue;
		}
		out.push({ url, layoutHint: classifyLayout(filename) });
	}
	return out;
}

function* iteratePdfHrefs(html: string, baseUrl: string): IterableIterator<string> {
	PDF_HREF_REGEX.lastIndex = 0;
	let match: RegExpExecArray | null;
	while (true) {
		match = PDF_HREF_REGEX.exec(html);
		if (match === null) break;
		const raw = match[1];
		if (raw === undefined) continue;
		try {
			yield new URL(raw, baseUrl).toString();
		} catch {
			// Malformed href; skip silently.
		}
	}
}

function filenameFromUrl(url: string): string {
	try {
		const parsed = new URL(url);
		const path = parsed.pathname;
		const idx = path.lastIndexOf('/');
		return idx === -1 ? path : path.slice(idx + 1);
	} catch {
		return url;
	}
}

function urlInHandbookPath(url: string, entry: HandbookCatalogueEntry): boolean {
	try {
		const parsed = new URL(url);
		const path = parsed.pathname.toLowerCase();
		return entry.filenameTokens.some((tok) => path.includes(tok.toLowerCase()));
	} catch {
		return false;
	}
}

export function classifyLayout(filename: string): DiscoveryLayoutHint {
	if (filename.includes('summary_of_changes')) return DISCOVERY_LAYOUT_HINTS.SUMMARY_OF_CHANGES;
	if (filename.includes('errata')) return DISCOVERY_LAYOUT_HINTS.ERRATA;
	if (filename.includes('addendum')) return DISCOVERY_LAYOUT_HINTS.ADDENDUM;
	if (filename.includes('change')) return DISCOVERY_LAYOUT_HINTS.CHANGE;
	return DISCOVERY_LAYOUT_HINTS.UNKNOWN;
}

function describe(error: unknown): string {
	return error instanceof Error ? error.message : String(error);
}
