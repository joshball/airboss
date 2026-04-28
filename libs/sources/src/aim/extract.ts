/**
 * Phase 7 (Lane B) -- AIM PDF source extraction.
 *
 * Source of truth: ADR 019 §1.2 ("AIM"), ADR 018 (derivative storage), and the
 * WP at `docs/work-packages/reference-aim-ingestion/`.
 *
 * Reads a cached AIM PDF (typically `~/Documents/airboss-handbook-cache/aim/<edition>/source.pdf`)
 * and produces a structured tree of chapters / sections / paragraphs /
 * glossary entries / appendices that the existing AIM derivative-reader can
 * consume.
 *
 * Strategy:
 *
 *   1. Run `extractPdf` in `simple` (default reading-order) mode. AIM uses
 *      two-column layout but Poppler's reading-order extractor produces clean
 *      column-flow text -- much easier to walk than `-layout` columns.
 *   2. Parse the Table of Contents pages (between the standalone "Table of
 *      Contents" anchor line and the first body Chapter 1 heading) to get the
 *      authoritative chapter / section / paragraph / appendix titles.
 *      The TOC is structurally clean: paragraphs appear as
 *        `<chapter>-<section>-<paragraph>. <Title> . . . . . . . <page>`
 *      Multi-line titles wrap to a continuation line with trailing dot leaders.
 *   3. Walk the body lines (from the first `Chapter 1.` heading onward),
 *      tracking the current paragraph, and capture body text between paragraph
 *      headings. Paragraph headings in the body use Unicode minus (U+2212)
 *      between the chapter/section/paragraph numbers.
 *   4. Detect the start of the Pilot/Controller Glossary (the section after
 *      Appendix 3 finishes) and parse glossary entries: an all-caps phrase
 *      followed by U+2212 introduces a new term, with body text running until
 *      the next term or the end of the glossary.
 *   5. Emit an `ExtractedAim` shape that the ingest writer turns into the
 *      manifest + per-entry markdown files.
 *
 * The extractor never writes to disk; it returns an in-memory tree. The ingest
 * orchestrator (this module's caller in `ingest.ts`) is responsible for
 * deciding where to write derivatives.
 */

import { extractPdf } from '../pdf/index.ts';

// ---------------------------------------------------------------------------
// Public types
// ---------------------------------------------------------------------------

export interface ExtractedChapter {
	readonly num: string;
	readonly title: string;
	/** Markdown body for the chapter overview (intro text before first section). */
	readonly body: string;
}

export interface ExtractedSection {
	readonly chapter: string;
	readonly section: string;
	readonly code: string; // 'N-M'
	readonly title: string;
	readonly body: string;
}

export interface ExtractedParagraph {
	readonly chapter: string;
	readonly section: string;
	readonly paragraph: string;
	readonly code: string; // 'N-M-K'
	readonly title: string;
	readonly body: string;
}

export interface ExtractedAppendix {
	readonly num: string;
	readonly title: string;
	readonly body: string;
}

export interface ExtractedGlossaryEntry {
	readonly slug: string;
	readonly title: string;
	readonly body: string;
}

export interface ExtractedAim {
	readonly chapters: readonly ExtractedChapter[];
	readonly sections: readonly ExtractedSection[];
	readonly paragraphs: readonly ExtractedParagraph[];
	readonly appendices: readonly ExtractedAppendix[];
	readonly glossary: readonly ExtractedGlossaryEntry[];
	readonly skipped: readonly string[];
	readonly pageCount: number;
}

export interface ExtractAimArgs {
	readonly pdfPath: string;
}

// ---------------------------------------------------------------------------
// Patterns
// ---------------------------------------------------------------------------

// Paragraph code: U+2212 (Unicode minus) in body, ASCII hyphen in TOC. Both accepted.
const PARA_RE = /^([1-9][0-9]?)[-−]([1-9][0-9]?)[-−]([1-9][0-9]{0,2})\.\s+(.+?)\s*$/;
const SECTION_RE = /^Section\s+([1-9][0-9]?)\.\s+(.+?)\s*$/;
const CHAPTER_RE = /^Chapter\s+([1-9][0-9]?)\.\s+(.+?)\s*$/;
const APPENDIX_RE = /^Appendix\s+([1-9][0-9]?)\.\s+(.+?)\s*$/;
const PCG_HEADER_RE = /^Pilot\/Controller Glossary\s*$/;

// A glossary term: ALL-CAPS phrase, optionally with parens, slashes, ampersands,
// digits; ends with U+2212 or `-`. At least 4 characters, contains a space OR is
// a recognised acronym (handled by length filter). Excludes inline body labels
// like NOTE-, EXAMPLE-, REFERENCE-.
const GLOSSARY_TERM_RE = /^([A-Z][A-Z0-9][A-Z0-9 /'(),.\-&−]*?)[−-]\s*$/;

const GLOSSARY_TERM_NOISE = new Set([
	'NOTE',
	'EXAMPLE',
	'REFERENCE',
	'WARNING',
	'CAUTION',
	'PHRASEOLOGY',
	'INFORMATION',
	'FIG',
	'TBL',
]);

// Lines that appear as repeated page-headers and should be ignored in body walk.
const PAGE_HEADER_RE = /^[0-9]{1,2}\/[0-9]{1,2}\/[0-9]{1,2}$/;

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Strip TOC dot-leader sequences from a title. The TOC uses `. . . . . . .`
 * (dots separated by spaces) as visual leaders; we drop everything from the
 * first leader cluster onward.
 */
function scrubLeaders(s: string): string {
	let out = s.replace(/(?:\s*\.\s*){2,}.*$/, '').trim();
	out = out.replace(/\s+\.+$/, '').trim();
	return out.replace(/\s+/g, ' ').trim();
}

function isHeadingLine(t: string): boolean {
	return PARA_RE.test(t) || SECTION_RE.test(t) || CHAPTER_RE.test(t) || APPENDIX_RE.test(t);
}

function isNoisyTocLine(t: string): boolean {
	if (t.length === 0) return true;
	if (t === 'AIM' || t === 'Table of Contents' || t === 'Paragraph' || t === 'Page') return true;
	if (/^[ivx]+$/i.test(t)) return true; // roman numerals (TOC page numbers)
	if (PAGE_HEADER_RE.test(t)) return true;
	return false;
}

function slugifyGlossaryTerm(term: string): string {
	return term
		.toLowerCase()
		.replace(/[^a-z0-9]+/g, '-')
		.replace(/^-+|-+$/g, '');
}

/**
 * Extend a heading title with continuation lines from the TOC. Stops at
 * heading boundaries, noise lines, or after a continuation line that ends with
 * dot leaders (which is the AIM TOC convention for end-of-row).
 */
function extendTocTitle(base: string, lookahead: readonly string[]): string {
	const baseHadLeaders = /(?:\s*\.\s*){2,}/.test(base);
	let title = scrubLeaders(base);
	if (baseHadLeaders) return title;
	for (const next of lookahead) {
		const t = next.trim();
		if (t.length === 0) break;
		if (isHeadingLine(t)) break;
		if (isNoisyTocLine(t)) break;
		if (/^[0-9]{1,2}([-−][0-9]+){0,2}$/.test(t)) break;
		const cleaned = scrubLeaders(t);
		if (cleaned.length === 0) break;
		title = `${title} ${cleaned}`;
		if (/(?:\s*\.\s*){2,}/.test(t)) break; // dotted leader marks row end
		if (title.length > 200) break;
	}
	return scrubLeaders(title).replace(/\s+/g, ' ').trim();
}

// ---------------------------------------------------------------------------
// TOC walk
// ---------------------------------------------------------------------------

interface TocEntry {
	readonly chapters: { num: string; title: string }[];
	readonly sections: { code: string; chapter: string; section: string; title: string }[];
	readonly paragraphs: { code: string; chapter: string; section: string; paragraph: string; title: string }[];
	readonly appendices: { num: string; title: string }[];
}

interface TocLocation {
	tocStart: number;
	chapter1BodyStart: number;
}

/**
 * Locate the TOC region and the start of the body. Returns line indexes
 * relative to the input `lines` array.
 *
 * Algorithm:
 *
 *   1. Find the first prose paragraph `1−1−1.` (Unicode minus). Anything
 *      before this is preliminary matter (cover, change log, TOC).
 *   2. Walk back at most ~30 lines to find the matching `Chapter 1.` heading.
 *   3. Walk forward from the start of the document to find the FIRST
 *      `Table of Contents` line that is followed within 100 lines by both a
 *      `Chapter 1.` heading and a dotted-leader paragraph. This skips the
 *      "Checklist of Pages" pages that precede the real TOC.
 */
function locateTocAndBody(lines: readonly string[]): TocLocation | null {
	let bodyStart = -1;
	for (let i = 0; i < lines.length; i++) {
		const l = lines[i].trim();
		if (l.startsWith('1−1−1.')) {
			const next = lines.slice(i + 1, i + 4).join(' ');
			if (!next.includes('. . .')) {
				bodyStart = i;
				break;
			}
		}
	}
	if (bodyStart < 0) return null;

	let chapter1BodyStart = bodyStart;
	for (let i = bodyStart - 1; i >= Math.max(0, bodyStart - 30); i--) {
		if (lines[i].trim().startsWith('Chapter 1.')) {
			chapter1BodyStart = i;
			break;
		}
	}

	let tocStart = -1;
	for (let i = 0; i < chapter1BodyStart; i++) {
		if (lines[i].trim() !== 'Table of Contents') continue;
		const win = lines.slice(i, i + 100).join('\n');
		if (/^Chapter\s+1\./m.test(win) && /\.\s\.\s\./.test(win)) {
			tocStart = i;
			break;
		}
	}
	if (tocStart < 0) return null;
	return { tocStart, chapter1BodyStart };
}

function parseToc(lines: readonly string[], loc: TocLocation): TocEntry {
	const tocLines = lines.slice(loc.tocStart, loc.chapter1BodyStart);
	const out: TocEntry = { chapters: [], sections: [], paragraphs: [], appendices: [] };
	const seenCh = new Set<string>();
	const seenSec = new Set<string>();
	const seenPara = new Set<string>();
	const seenAp = new Set<string>();
	let curChapter = '';

	for (let i = 0; i < tocLines.length; i++) {
		const line = tocLines[i];
		const trimmed = line.trim();
		if (trimmed.length === 0) continue;

		const ap = APPENDIX_RE.exec(trimmed);
		if (ap !== null) {
			const num = ap[1];
			if (!seenAp.has(num)) {
				seenAp.add(num);
				const title = extendTocTitle(ap[2], tocLines.slice(i + 1, i + 4));
				out.appendices.push({ num, title });
			}
			continue;
		}

		const ch = CHAPTER_RE.exec(trimmed);
		if (ch !== null) {
			const num = ch[1];
			curChapter = num;
			if (!seenCh.has(num)) {
				seenCh.add(num);
				const title = extendTocTitle(ch[2], tocLines.slice(i + 1, i + 4));
				out.chapters.push({ num, title });
			}
			continue;
		}

		const sec = SECTION_RE.exec(trimmed);
		if (sec !== null && curChapter !== '') {
			const code = `${curChapter}-${sec[1]}`;
			if (!seenSec.has(code)) {
				seenSec.add(code);
				const title = extendTocTitle(sec[2], tocLines.slice(i + 1, i + 4));
				out.sections.push({ code, chapter: curChapter, section: sec[1], title });
			}
			continue;
		}

		const para = PARA_RE.exec(trimmed);
		if (para !== null) {
			const code = `${para[1]}-${para[2]}-${para[3]}`;
			if (!seenPara.has(code)) {
				seenPara.add(code);
				const title = extendTocTitle(scrubLeaders(para[4]), tocLines.slice(i + 1, i + 4));
				out.paragraphs.push({
					code,
					chapter: para[1],
					section: para[2],
					paragraph: para[3],
					title,
				});
			}
		}
	}
	return out;
}

// ---------------------------------------------------------------------------
// Body walk
// ---------------------------------------------------------------------------

interface BodyBuckets {
	readonly paragraphBodies: Map<string, string[]>;
	readonly appendixBodies: Map<string, string[]>;
	readonly glossary: Map<string, { title: string; body: string[] }>;
}

/**
 * Walk the body of the AIM, capturing text per paragraph / appendix /
 * glossary entry. The TOC entry list is the authoritative shape; we only
 * record body for entries that exist in the TOC (paragraphs) or that match
 * the appendix/glossary patterns.
 */
function walkBody(lines: readonly string[], chapter1BodyStart: number, tocParaCodes: ReadonlySet<string>): BodyBuckets {
	const paragraphBodies = new Map<string, string[]>();
	const appendixBodies = new Map<string, string[]>();
	const glossary = new Map<string, { title: string; body: string[] }>();

	let curParaCode: string | null = null;
	let curAppendix: string | null = null;
	let curGlossarySlug: string | null = null;

	let inGlossary = false;
	let seenAppendix3 = false;

	for (let i = chapter1BodyStart; i < lines.length; i++) {
		const line = lines[i];
		const trimmed = line.trim();

		// Skip page-header noise
		if (trimmed === 'AIM' || PAGE_HEADER_RE.test(trimmed)) continue;

		// Glossary mode trigger: PCG header AFTER Appendix 3 has begun
		if (PCG_HEADER_RE.test(trimmed)) {
			if (seenAppendix3 && !inGlossary) {
				inGlossary = true;
				curParaCode = null;
				curAppendix = null;
			}
			continue;
		}

		if (inGlossary) {
			const gm = GLOSSARY_TERM_RE.exec(trimmed);
			if (gm !== null) {
				const term = gm[1].trim();
				const firstWord = term.split(/[\s−-]/)[0] ?? '';
				if (GLOSSARY_TERM_NOISE.has(firstWord)) {
					if (curGlossarySlug !== null) {
						const existing = glossary.get(curGlossarySlug);
						if (existing !== undefined) existing.body.push(line);
					}
					continue;
				}
				if (term.length < 4 && !term.includes(' ')) {
					if (curGlossarySlug !== null) {
						const existing = glossary.get(curGlossarySlug);
						if (existing !== undefined) existing.body.push(line);
					}
					continue;
				}
				const slug = slugifyGlossaryTerm(term);
				if (slug.length === 0) continue;
				if (glossary.has(slug)) {
					curGlossarySlug = slug;
					continue;
				}
				glossary.set(slug, { title: term, body: [] });
				curGlossarySlug = slug;
				continue;
			}
			if (curGlossarySlug !== null) {
				const existing = glossary.get(curGlossarySlug);
				if (existing !== undefined) existing.body.push(line);
			}
			continue;
		}

		// Appendix heading (only first occurrence per number; later occurrences are
		// page-headers we skip).
		const ap = APPENDIX_RE.exec(trimmed);
		if (ap !== null) {
			const num = ap[1];
			if (!appendixBodies.has(num)) {
				appendixBodies.set(num, []);
				curAppendix = num;
				curParaCode = null;
				if (num === '3') seenAppendix3 = true;
				continue;
			}
			continue;
		}

		// Paragraph heading -- only register if it's a TOC-known paragraph and
		// hasn't been opened yet. Subsequent occurrences are column-wrap artifacts
		// (from figure/table layouts) and are treated as body text.
		const para = PARA_RE.exec(trimmed);
		if (para !== null) {
			const code = `${para[1]}-${para[2]}-${para[3]}`;
			if (tocParaCodes.has(code) && !paragraphBodies.has(code)) {
				paragraphBodies.set(code, []);
				curParaCode = code;
				curAppendix = null;
				continue;
			}
			if (curParaCode !== null) {
				const buf = paragraphBodies.get(curParaCode);
				if (buf !== undefined) buf.push(line);
			} else if (curAppendix !== null) {
				const buf = appendixBodies.get(curAppendix);
				if (buf !== undefined) buf.push(line);
			}
			continue;
		}

		// Chapter / Section headings consumed without buffering.
		if (CHAPTER_RE.test(trimmed) || SECTION_RE.test(trimmed)) continue;

		// Otherwise body content.
		if (curParaCode !== null) {
			const buf = paragraphBodies.get(curParaCode);
			if (buf !== undefined) buf.push(line);
		} else if (curAppendix !== null) {
			const buf = appendixBodies.get(curAppendix);
			if (buf !== undefined) buf.push(line);
		}
	}

	return { paragraphBodies, appendixBodies, glossary };
}

// ---------------------------------------------------------------------------
// Body-text post-processing
// ---------------------------------------------------------------------------

/**
 * Normalize a buffer of body lines to a clean markdown paragraph. Drops
 * leading and trailing blank lines, collapses 3+ blank-line runs to 2,
 * normalises Unicode minus (U+2212) inside the body to ASCII hyphen for
 * consistency in markdown derivatives.
 */
function bodyLinesToMarkdown(lines: readonly string[]): string {
	const trimmed = [...lines];
	while (trimmed.length > 0 && trimmed[0].trim() === '') trimmed.shift();
	while (trimmed.length > 0 && trimmed[trimmed.length - 1].trim() === '') trimmed.pop();
	const collapsed: string[] = [];
	let blankRun = 0;
	for (const line of trimmed) {
		if (line.trim() === '') {
			blankRun += 1;
			if (blankRun <= 2) collapsed.push('');
		} else {
			blankRun = 0;
			// Replace U+2212 with ASCII hyphen for downstream consistency.
			collapsed.push(line.replace(/−/g, '-'));
		}
	}
	return collapsed.join('\n').trim();
}

// ---------------------------------------------------------------------------
// Public entry point
// ---------------------------------------------------------------------------

/**
 * Extract a structured AIM tree from a cached PDF. Throws when the PDF can't
 * be opened or when TOC anchors aren't found (a sign of an unsupported AIM
 * layout, e.g. a future edition that changes structure).
 */
export function extractAim(args: ExtractAimArgs): ExtractedAim {
	const doc = extractPdf(args.pdfPath, { mode: 'simple' });
	const fullText = doc.pages.map((p) => p.text).join('\n');
	const lines = fullText.split('\n');

	const loc = locateTocAndBody(lines);
	if (loc === null) {
		throw new Error(
			`AIM extract: could not locate TOC anchor (Table of Contents -> Chapter 1) in ${args.pdfPath}. ` +
				`The document layout may have changed.`,
		);
	}

	const toc = parseToc(lines, loc);
	const tocParaCodes = new Set(toc.paragraphs.map((p) => p.code));
	const buckets = walkBody(lines, loc.chapter1BodyStart, tocParaCodes);

	const skipped: string[] = [];

	const chapters: ExtractedChapter[] = toc.chapters.map((c) => ({
		num: c.num,
		title: c.title,
		body: '',
	}));

	const sections: ExtractedSection[] = toc.sections.map((s) => ({
		chapter: s.chapter,
		section: s.section,
		code: s.code,
		title: s.title,
		body: '',
	}));

	const paragraphs: ExtractedParagraph[] = toc.paragraphs.map((p) => {
		const body = buckets.paragraphBodies.get(p.code);
		if (body === undefined || body.length === 0) {
			skipped.push(`paragraph ${p.code} "${p.title}": no body text found in PDF`);
		}
		return {
			chapter: p.chapter,
			section: p.section,
			paragraph: p.paragraph,
			code: p.code,
			title: p.title,
			body: body !== undefined ? bodyLinesToMarkdown(body) : '',
		};
	});

	const appendices: ExtractedAppendix[] = toc.appendices.map((a) => {
		const body = buckets.appendixBodies.get(a.num);
		if (body === undefined || body.length === 0) {
			skipped.push(`appendix-${a.num} "${a.title}": no body text found in PDF`);
		}
		return {
			num: a.num,
			title: a.title,
			body: body !== undefined ? bodyLinesToMarkdown(body) : '',
		};
	});

	const glossary: ExtractedGlossaryEntry[] = [];
	for (const [slug, { title, body }] of buckets.glossary.entries()) {
		const text = bodyLinesToMarkdown(body);
		if (text.length === 0) {
			skipped.push(`glossary/${slug} "${title}": no body text found`);
		}
		glossary.push({ slug, title, body: text });
	}
	glossary.sort((a, b) => a.slug.localeCompare(b.slug));

	return {
		chapters,
		sections,
		paragraphs,
		appendices,
		glossary,
		skipped,
		pageCount: doc.pageCount,
	};
}
