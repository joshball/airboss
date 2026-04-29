/**
 * Two-hop URL scraper for chapter PDFs.
 *
 * The FAA's PHAK index page (https://www.faa.gov/.../aviation/phak) does NOT
 * link chapter PDFs directly. It links per-chapter HTML pages
 * (`/.../phak/chapter-7-aircraft-systems`, etc.). Each chapter page contains
 * exactly one `.pdf` link to the chapter's PDF.
 *
 * `resolveChapterUrls` scrapes both hops:
 *
 *   1. GET the index page; collect anchor hrefs matching `chapter-{N}-` (where
 *      {N} is the chapter ordinal). Slug content after the ordinal is ignored
 *      -- PHAK uses inconsistent kebab slugs (chapter-1-introduction-flying
 *      with no "to", chapter-7-aircraft-systems) so prefix-match is more
 *      resilient than maintaining a YAML slug list.
 *   2. For each chapter page, GET it and extract the single `.pdf` link.
 *
 * Returns one entry per chapter ordinal in 1..chapterCount order. Hard-fails
 * on any 404 or missing chapter -- one missing chapter breaks downstream
 * extraction; do not silently skip.
 */

import { NETWORK_TIMEOUT_MS, USER_AGENT } from './constants';
import { followRedirectsHead } from './http';

export interface ResolvedChapterUrl {
	readonly ordinal: number;
	readonly pageUrl: string;
	readonly pdfUrl: string;
}

/**
 * Resolve every chapter PDF URL by walking the publisher's index page and
 * each per-chapter HTML page in order.
 *
 * @param indexUrl       The publisher's handbook index URL (e.g.
 *                       `https://www.faa.gov/.../aviation/phak`).
 * @param pagePattern    Anchor-href substring that identifies chapter pages.
 *                       Must contain the literal `{N}` placeholder for the
 *                       chapter ordinal. Example: `chapter-{N}-`.
 * @param chapterCount   Expected chapter count (1..chapterCount).
 * @param fetchImpl      Optional fetch override for tests.
 */
export async function resolveChapterUrls(
	indexUrl: string,
	pagePattern: string,
	chapterCount: number,
	fetchImpl: typeof fetch = globalThis.fetch,
): Promise<readonly ResolvedChapterUrl[]> {
	if (!pagePattern.includes('{N}')) {
		throw new Error(`scrape: chapter_page_pattern must contain {N} placeholder; got "${pagePattern}"`);
	}
	const indexHtml = await fetchText(indexUrl, fetchImpl);
	const indexHrefs = extractHrefs(indexHtml);

	const out: ResolvedChapterUrl[] = [];
	for (let n = 1; n <= chapterCount; n += 1) {
		const ordinalPattern = pagePattern.replace(/\{N\}/g, String(n));
		// Find the first href that contains the pattern AND does NOT extend the
		// ordinal (e.g. `chapter-1-` should not match `chapter-12-`). We do this
		// by requiring the next char after the ordinal to be NOT a digit.
		const match = indexHrefs.find((href) => containsOrdinalSafe(href, ordinalPattern, n));
		if (match === undefined) {
			throw new Error(`scrape: no chapter ${n} link found on index page ${indexUrl} (looking for "${ordinalPattern}")`);
		}
		const pageUrl = new URL(match, indexUrl).toString();
		const pageHtml = await fetchText(pageUrl, fetchImpl);
		const pdfUrl = extractFirstPdfHref(pageHtml, pageUrl);
		if (pdfUrl === null) {
			throw new Error(`scrape: no .pdf link found on chapter page ${pageUrl}`);
		}
		out.push({ ordinal: n, pageUrl, pdfUrl });
	}
	return out;
}

async function fetchText(url: string, fetchImpl: typeof fetch): Promise<string> {
	const finalUrl = await followRedirectsHead(url, fetchImpl, false);
	const controller = new AbortController();
	const timer = setTimeout(() => controller.abort(), NETWORK_TIMEOUT_MS);
	try {
		const response = await fetchImpl(finalUrl, {
			signal: controller.signal,
			redirect: 'follow',
			headers: { 'User-Agent': USER_AGENT, Accept: 'text/html' },
		});
		if (!response.ok) {
			throw new Error(`scrape: HTTP ${response.status} for ${finalUrl}`);
		}
		return await response.text();
	} finally {
		clearTimeout(timer);
	}
}

const HREF_RE = /<a\b[^>]*\bhref\s*=\s*(?:"([^"]+)"|'([^']+)')[^>]*>/gi;

function extractHrefs(html: string): string[] {
	const out: string[] = [];
	HREF_RE.lastIndex = 0;
	let match = HREF_RE.exec(html);
	while (match !== null) {
		const href = match[1] ?? match[2];
		if (typeof href === 'string' && href.length > 0) out.push(href);
		match = HREF_RE.exec(html);
	}
	return out;
}

function extractFirstPdfHref(html: string, baseUrl: string): string | null {
	for (const href of extractHrefs(html)) {
		const lowered = href.toLowerCase();
		if (lowered.endsWith('.pdf') || lowered.includes('.pdf?')) {
			return new URL(href, baseUrl).toString();
		}
	}
	return null;
}

/**
 * True when `href` contains `pattern` AND the pattern's ordinal is not
 * extended by another digit. Prevents `chapter-1-` from matching
 * `chapter-12-introduction-to-instrument-flight`.
 */
function containsOrdinalSafe(href: string, pattern: string, ordinal: number): boolean {
	const idx = href.indexOf(pattern);
	if (idx < 0) return false;
	// Look at the character immediately after the ordinal in the source.
	// pattern is something like `chapter-1-`; the ordinal is at the position
	// just before the final `-`. We re-locate the digit run after the literal
	// prefix to get the ordinal length right.
	const ordinalStr = String(ordinal);
	const afterOrdinalIdx = idx + pattern.indexOf(ordinalStr) + ordinalStr.length;
	const nextChar = href.charAt(afterOrdinalIdx);
	if (nextChar === '') return true;
	return !/[0-9]/.test(nextChar);
}
