/**
 * Shared bulletin (SAFO / InFO) section extractor (WP-SAFO-INFO).
 *
 * SAFOs and InFOs are short FAA bulletins (1-3 pages) with a stereotyped
 * internal structure: a header band (logo, doc id, date, distributor),
 * then prose under a series of bold-headed sections like:
 *
 *   Subject: ...
 *   Purpose: ...
 *   Background: ...
 *   Discussion: ...
 *   Recommended Action: ...
 *   Contact: ...
 *
 * Heading format is consistent across the corpus: `^<Heading Words>:\s` at the
 * start of a line, where the heading is one of a closed set. Detection is
 * regex-based; the closed set keeps false positives (lines inside body prose
 * that happen to end in a colon) out of the result.
 *
 * Output: a list of section entries, in document order, each carrying the
 * heading slug (`code`), the human title, and the body markdown for that
 * section. Empty result = no recognised structure; the caller falls back to
 * single-section whole-bulletin behavior.
 */

import { createHash } from 'node:crypto';

/**
 * Closed list of known SAFO/InFO section headings. Order matches the typical
 * appearance order in published bulletins. The detector matches any of these
 * at the start of a line (case-insensitive on first letter, exact otherwise);
 * `Subject` is canonicalised to lowercase-kebab in the slug.
 */
const KNOWN_HEADINGS: readonly { readonly title: string; readonly code: string }[] = [
	{ title: 'Subject', code: 'subject' },
	{ title: 'Purpose', code: 'purpose' },
	{ title: 'Background', code: 'background' },
	{ title: 'Discussion', code: 'discussion' },
	{ title: 'Recommended Action', code: 'recommended-action' },
	{ title: 'Recommended Actions', code: 'recommended-actions' },
	{ title: 'Action', code: 'action' },
	{ title: 'Conclusion', code: 'conclusion' },
	{ title: 'Recommendation', code: 'recommendation' },
	{ title: 'Contact', code: 'contact' },
];

/**
 * Build a regex that matches `^<Heading>:` at the start of a logical line
 * (after optional leading whitespace). The capture group is the heading
 * text (case-preserved). The pattern uses a non-capturing alternation
 * over the closed list.
 */
function buildHeadingRegex(): RegExp {
	const escaped = KNOWN_HEADINGS.map((h) => h.title.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'));
	return new RegExp(`^[ \\t]*(${escaped.join('|')})\\s*:`, 'm');
}

const HEADING_RE = buildHeadingRegex();

export interface ExtractedBulletinSection {
	/** Heading slug (kebab-case). Used as the section `code`. */
	readonly code: string;
	/** Human-readable heading (matches the closed list). */
	readonly title: string;
	/** 0-indexed position in document order. */
	readonly ordinal: number;
	/** Markdown body for this section (heading line stripped, trailing whitespace trimmed). */
	readonly bodyMd: string;
	/** SHA-256 of the body markdown. */
	readonly contentHash: string;
}

export interface ExtractBulletinResult {
	readonly sections: readonly ExtractedBulletinSection[];
	/** Optional FAA-published audience line (e.g. `Air carriers and commercial operators`). */
	readonly audience: string | null;
}

/**
 * Extract recognised sections from a SAFO/InFO body. Returns an empty
 * `sections` array when no recognised heading is found; callers should
 * fall back to whole-bulletin seeding in that case.
 *
 * The audience is extracted from the leading `Subject:` line when present;
 * the SAFO/InFO subject prose typically calls out the target audience as the
 * first sentence, but extracting that with confidence requires NLP -- for now
 * audience is left null and authors override via the `audience` field on
 * the YAML row.
 */
export function extractBulletinSections(bodyMd: string): ExtractBulletinResult {
	if (bodyMd.length === 0) return { sections: [], audience: null };

	// Split into lines and find heading positions. We scan line-by-line because
	// pdftotext output has reflowed newlines that make multiline regex
	// quantifier-greedy patterns expensive and fragile.
	const lines = bodyMd.split('\n');
	type HeadingHit = { lineIndex: number; title: string; code: string };
	const hits: HeadingHit[] = [];
	for (let i = 0; i < lines.length; i++) {
		const raw = lines[i] ?? '';
		const m = HEADING_RE.exec(raw);
		if (m === null) continue;
		const matchedTitle = m[1] ?? '';
		const known = KNOWN_HEADINGS.find((h) => h.title === matchedTitle);
		if (known === undefined) continue;
		hits.push({ lineIndex: i, title: known.title, code: known.code });
	}

	if (hits.length === 0) return { sections: [], audience: null };

	const sections: ExtractedBulletinSection[] = [];
	for (let h = 0; h < hits.length; h++) {
		const hit = hits[h];
		const next = hits[h + 1];
		if (hit === undefined) continue;
		const startLine = hit.lineIndex;
		const endLine = next === undefined ? lines.length : next.lineIndex;
		const body = lines
			.slice(startLine, endLine)
			.join('\n')
			// Strip the heading off the first line.
			.replace(new RegExp(`^[ \\t]*${hit.title.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\s*:[ \\t]*`), '')
			.replace(/[ \t]+\n/g, '\n')
			.replace(/\n{3,}/g, '\n\n')
			.trim();
		const contentHash = createHash('sha256').update(body, 'utf-8').digest('hex');
		sections.push({
			code: hit.code,
			title: hit.title,
			ordinal: h,
			bodyMd: body,
			contentHash,
		});
	}

	return { sections, audience: null };
}

/**
 * Detect the publication date from the bulletin's header band. Looks for the
 * `DATE: MM/DD/YY` or `DATE: MM/DD/YYYY` pattern in the first 30 lines
 * (where the FAA-issued header sits). Returns ISO `YYYY-MM-DD` when matched,
 * else null.
 */
export function findBulletinDate(bodyMd: string): string | null {
	const lines = bodyMd.split('\n', 30);
	const re = /DATE:\s*(\d{1,2})\/(\d{1,2})\/(\d{2,4})/i;
	for (const line of lines) {
		const m = re.exec(line);
		if (m === null) continue;
		const month = (m[1] ?? '').padStart(2, '0');
		const day = (m[2] ?? '').padStart(2, '0');
		const yearRaw = m[3] ?? '';
		const year = yearRaw.length === 2 ? `20${yearRaw}` : yearRaw;
		if (year.length !== 4 || month.length !== 2 || day.length !== 2) continue;
		return `${year}-${month}-${day}`;
	}
	return null;
}
