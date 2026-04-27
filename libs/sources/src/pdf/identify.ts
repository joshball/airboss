/**
 * Cover-page scrapers: extract the FAA edition slug + effective date from an
 * extracted PDF.
 *
 * Used by AC + ACS ingest to confirm or detect the doc edition without
 * hard-coding it. Cheap heuristics; the regexes intentionally err on the side
 * of "no match" rather than "wrong match" -- caller decides what to do when
 * we can't find a value.
 */

import type { ExtractedPage } from './types.ts';

// ---------------------------------------------------------------------------
// Edition slug detection
// ---------------------------------------------------------------------------

/**
 * Find the first FAA-S-ACS-* slug in any of the supplied pages. Matches like
 * `FAA-S-ACS-6`, `FAA-S-ACS-6B`, `FAA-S-ACS-25`. Case-insensitive in the
 * input; canonical-cased in the output.
 *
 * Returns `null` when no slug is found.
 */
export function findAcsEditionSlug(pages: readonly ExtractedPage[]): string | null {
	const re = /\bFAA-S-ACS-(\d{1,3})([A-Z])?\b/i;
	for (const p of pages) {
		const m = p.text.match(re);
		if (m === null) continue;
		const num = m[1];
		const rev = m[2]?.toUpperCase() ?? '';
		return `FAA-S-ACS-${num}${rev}`;
	}
	return null;
}

/**
 * Find the FAA-H-* slug used by handbooks (e.g. `FAA-H-8083-25C`).
 */
export function findHandbookEditionSlug(pages: readonly ExtractedPage[]): string | null {
	const re = /\bFAA-H-(\d{4}-\d{1,3})([A-Z])?\b/i;
	for (const p of pages) {
		const m = p.text.match(re);
		if (m === null) continue;
		const num = m[1];
		const rev = m[2]?.toUpperCase() ?? '';
		return `FAA-H-${num}${rev}`;
	}
	return null;
}

/**
 * Find an Advisory Circular slug (e.g. `AC 61-65J`, `AC 91-21.1D`). Tolerates
 * variations: dot vs dash between number segments, optional space after `AC`.
 */
export function findAcSlug(pages: readonly ExtractedPage[]): string | null {
	const re = /\bAC\s+(\d{1,3}[-.]\d{1,3}(?:[-.]\d{1,3})?)([A-Z])?\b/;
	for (const p of pages) {
		const m = p.text.match(re);
		if (m === null) continue;
		const number = m[1];
		const rev = m[2] ?? '';
		return `AC ${number}${rev}`;
	}
	return null;
}

/**
 * Match any FAA edition slug (ACS, handbook, or AC). Returns the first slug
 * found anywhere on the supplied pages, with a label indicating which family.
 */
export function findAnyEditionSlug(
	pages: readonly ExtractedPage[],
): { kind: 'acs' | 'handbook' | 'ac'; slug: string } | null {
	const acs = findAcsEditionSlug(pages);
	if (acs !== null) return { kind: 'acs', slug: acs };
	const hbk = findHandbookEditionSlug(pages);
	if (hbk !== null) return { kind: 'handbook', slug: hbk };
	const ac = findAcSlug(pages);
	if (ac !== null) return { kind: 'ac', slug: ac };
	return null;
}

// ---------------------------------------------------------------------------
// Effective date detection
// ---------------------------------------------------------------------------

const MONTHS: Record<string, number> = {
	january: 1,
	february: 2,
	march: 3,
	april: 4,
	may: 5,
	june: 6,
	july: 7,
	august: 8,
	september: 9,
	october: 10,
	november: 11,
	december: 12,
};

/**
 * Find the "Effective: <date>" line that the FAA puts on every ACS / AC
 * cover page. Returns ISO `YYYY-MM-DD` or `null`.
 *
 * Patterns observed in real FAA docs:
 *   "Effective May 31, 2024"
 *   "Effective Date: 5/31/2024"
 *   "Effective: November 1, 2023"
 */
export function findEffectiveDate(pages: readonly ExtractedPage[]): string | null {
	for (const p of pages) {
		const iso = scanForEffectiveDate(p.text);
		if (iso !== null) return iso;
	}
	return null;
}

function scanForEffectiveDate(text: string): string | null {
	const monthFirst = /Effective(?:\s+Date)?:?\s+([A-Za-z]+)\s+(\d{1,2}),\s+(\d{4})/i;
	const m1 = text.match(monthFirst);
	if (m1 !== null) {
		const month = MONTHS[m1[1].toLowerCase()];
		const day = parseInt(m1[2], 10);
		const year = parseInt(m1[3], 10);
		if (month !== undefined && Number.isFinite(day) && Number.isFinite(year)) {
			return formatIso(year, month, day);
		}
	}
	const numericFirst = /Effective(?:\s+Date)?:?\s+(\d{1,2})[\/-](\d{1,2})[\/-](\d{2,4})/i;
	const m2 = text.match(numericFirst);
	if (m2 !== null) {
		const month = parseInt(m2[1], 10);
		const day = parseInt(m2[2], 10);
		let year = parseInt(m2[3], 10);
		if (year < 100) year += year >= 50 ? 1900 : 2000;
		if (month >= 1 && month <= 12 && Number.isFinite(day) && Number.isFinite(year)) {
			return formatIso(year, month, day);
		}
	}
	return null;
}

function formatIso(year: number, month: number, day: number): string {
	const mm = String(month).padStart(2, '0');
	const dd = String(day).padStart(2, '0');
	return `${year}-${mm}-${dd}`;
}
