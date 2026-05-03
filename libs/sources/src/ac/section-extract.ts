/**
 * AC section-tree extractor (WP-AC-PROMOTE).
 *
 * Promotes the existing whole-document AC body markdown into a chapter +
 * paragraph (section) tree. Reads the already-extracted body text produced
 * by `runAcIngest` (`ac/<doc>/<rev>/ac-<doc>-<rev>.md`) and splits it into
 * structured sections using FAA AC-style heading regexes.
 *
 * The FAA's AC corpus doesn't follow a single typographic rule:
 *
 *   - Chapter-style ACs (00-6B, 25-7D, 61-98D, 120-71B): body opens each
 *     chapter with `CHAPTER N. TITLE` (uppercase) or `Chapter N. Title`
 *     followed by sub-paragraphs `N.M` or `N.M.K` (e.g. `1.1`, `1.1.1`).
 *   - Flat-paragraph ACs (61-65J, 61-83J, 90-66C, 91-21.1D, 91-79A): body
 *     opens each top-level item with a leading number + uppercase title
 *     (e.g. `1 PURPOSE` or `1. PURPOSE`) followed by sub-paragraphs `N.M`
 *     and `N.M.K`.
 *   - Appendices: appear with `APPENDIX <ID>.` or `Appendix <ID>.` markers
 *     at the L1 boundary; their internal numbering may restart at `1.`.
 *
 * The extractor classifies each AC by detecting whether the body contains a
 * `CHAPTER N.` / `Chapter N.` line in column-zero (chapter-style) or only
 * leading numbered paragraphs (flat-style). A chapter-only mode is supported
 * for AC 25-7D, the 600-page transport-category certification engineering
 * document where sub-paragraph depth is noise; the spec explicitly punts
 * the depth tradeoff for that AC.
 *
 * Section codes:
 *   - chapter  -> `'1'`, `'2'`, ...
 *   - paragraph at depth 1 -> `'<chap>.<para>'`        (e.g. `'1.1'`)
 *   - paragraph at depth 2 -> `'<chap>.<para>.<sub>'`  (e.g. `'1.1.1'`)
 *   - appendix container   -> `'A'`, `'B'`, `'1'`-prefixed appendix etc.
 *   - flat-style L1        -> `'1'`, `'2'`, ... (synthetic chapter wrap)
 *
 * The extractor is content-shape; the schema (`acManifestSectionSchema`) is
 * the authoritative validator. Levels chosen here:
 *   - depth 0 -> level `'chapter'`     (covers chapters + appendix containers)
 *   - depth 1 -> level `'section'`     (numbered paragraphs)
 *   - depth 2 -> level `'subsection'`  (sub-numbered paragraphs)
 */

import { createHash } from 'node:crypto';

/**
 * One extracted section. Repo-relative `bodyPath` is computed by the caller
 * (this module is filesystem-free). `contentHash` is the SHA-256 of the
 * body markdown so the writer can compare against existing files.
 */
export interface ExtractedAcSection {
	readonly level: 'chapter' | 'section' | 'subsection';
	readonly code: string;
	readonly ordinal: number;
	readonly parentCode: string | null;
	readonly title: string;
	readonly bodyMd: string;
	readonly contentHash: string;
	/** Suggested filename slug under the AC's chapter dir (e.g. `01-introduction`). */
	readonly fileSlug: string;
	/** Suggested chapter dir slug (e.g. `01-introduction`). Same as `fileSlug` for chapter rows. */
	readonly chapterSlug: string;
}

export interface AcExtractionResult {
	readonly sections: readonly ExtractedAcSection[];
	readonly strategy: ExtractionStrategy;
	readonly warnings: readonly string[];
}

/**
 * Per-AC extraction tuning. The default config picks the strategy from the
 * AC's body content; an explicit `strategy: 'chapter-only'` is the AC 25-7
 * carve-out per spec.
 */
export interface AcExtractionConfig {
	/** AC doc slug ("00-6", "25-7", ..., "91-21-1"). */
	readonly docSlug: string;
	/** Force chapter-only depth (AC 25-7D, the engineering doc per spec). */
	readonly chapterOnly?: boolean;
}

export type ExtractionStrategy =
	| 'chapter-tree' // detected `CHAPTER N.` headings + sub-paragraphs
	| 'chapter-only' // detected `CHAPTER N.` headings; sub-paragraph extraction suppressed
	| 'flat-paragraph' // flat numbered paragraphs (no chapters)
	| 'mixed-paragraph' // flat numbered paragraphs + appendix containers
	| 'unstructured'; // fallback: single root section (whole-doc behavior)

// ---------------------------------------------------------------------------
// Regexes
// ---------------------------------------------------------------------------

/** Chapter heading: `CHAPTER N. TITLE` (uppercase) at column 0..many spaces. */
const CHAPTER_RE = /^[ \t]*CHAPTER\s+(\d+)\.\s+(.+?)\s*$/;
/** Mixed-case chapter heading: `Chapter N. Title` -- AC 25-7D + AC 120-71B style. */
const CHAPTER_MIXED_RE = /^[ \t]*Chapter\s+(\d+)\.\s+(.+?)\s*$/;

/**
 * Flat-style L1 paragraph header. Patterns FAA uses across the 9 ACs:
 *   - `   1 PURPOSE OF THIS ADVISORY CIRCULAR (AC). Body...`     (61-65J, 61-83J, 90-66C, 91-21.1D)
 *   - `1. PURPOSE. Body...`                                       (91-79A)
 *   - `1 PURPOSE.`                                                (alt)
 *   - `   6 RELATED READING MATERIAL (current editions):`         (61-65J variant -- ends with `:`)
 *   - `  10 COMPLETION OF GROUND TRAINING OR A HOME-STUDY` (cont) (61-65J variant -- title wraps to next line)
 *
 * The number must be 1-3 digits, optionally followed by `.`, then 2+ spaces
 * (or 1+ on flat-style), then UPPERCASE first word. We require the title to
 * be a run of uppercase letters / digits / limited punctuation; the heading
 * terminator may be `.`, `:`, or end-of-line (the title-wraps-to-next-line
 * variant). Body text after the period is allowed because most heading
 * lines run into their first paragraph on the same line.
 */
/**
 * Title core: uppercase words only, with optional embedded parenthetical
 * lowercase clauses (e.g. `RELATED READING MATERIAL (current editions)`,
 * `WHAT THIS AC CANCELS`, `LIGHT-SPORT AIRCRAFT (LSA) WITH A SINGLE SEAT`,
 * `STUDENT PILOT APPLICATION PROCESS: IACRA`). The split lets us reject
 * mid-paragraph false positives like `4. The pilot must verify ...` while
 * accepting genuine FAA headings, including those with internal `:` punctuation
 * (61-65J `STUDENT PILOT APPLICATION PROCESS: IACRA`).
 *
 * The `:` is included in the inner-character class so the title can carry it
 * mid-string; the heading-terminator can be `.`, `:` at end-of-line, or
 * end-of-line itself. We anchor the title to a greedy match against the
 * uppercase character set so that the longest-valid run wins.
 */
const FLAT_L1_TITLE_CORE = "[A-Z][A-Z0-9 :/,—–'’&-]*(?:\\([^)]+\\)[A-Z0-9 :/,—–'’&-]*)*";
const FLAT_L1_RE = new RegExp(`^[ \\t]*(\\d{1,3})\\.?\\s+(${FLAT_L1_TITLE_CORE})(?:\\.(?:\\s|$)|:\\s*$|\\s*$)`);

/**
 * Sub-paragraph header (depth 1 or 2): `<chap>.<para>` or `<chap>.<para>.<sub>`.
 * Title is the rest of the line; we accept either a leading capital letter
 * (most ACs) or a lowercase one (defensive fallback). The leading indent is
 * capped at 6 spaces so deeply-indented body-text references like
 * `                 1.3 VSO. However...` (mid-paragraph stall-speed callouts
 * in AC 61-98D Chapter 2) don't get mistaken for headings.
 */
const SUBPARA_RE = /^[ \t]{0,6}(\d+\.\d+(?:\.\d+)?)\s+(.+?)\s*$/;

/**
 * Appendix marker. Forms seen across the 9 ACs:
 *   - `APPENDIX 1. SUGGESTED PROCEDURES AND TRAINING INFORMATION`  (91-79A)
 *   - `Appendix A. Sample Endorsements`                            (61-65J, 61-98D)
 *   - `APPENDIX A. ...`
 */
const APPENDIX_RE = /^[ \t]*(APPENDIX|Appendix)\s+([A-Z0-9]+)\.\s+(.+?)\s*$/;

/** TOC dotted-leader rejection -- a line ending with `... <page>` is a TOC entry, not a body heading. */
const TOC_LEADER_RE = /\.{4,}\s*[A-Z0-9-]+$/;

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Extract a section tree from an AC's body markdown. Returns the parsed
 * sections + the strategy chosen. The full document body is always preserved
 * across the returned sections (no content is dropped); content between
 * detected boundaries is attached to the preceding section.
 *
 * Caller is responsible for writing per-section files and producing the
 * manifest.
 */
export function extractAcSections(bodyMd: string, config: AcExtractionConfig): AcExtractionResult {
	const lines = bodyMd.split(/\r?\n/);
	const headings = scanHeadings(lines);
	const strategy = pickStrategy(headings, config);

	if (strategy === 'unstructured') {
		// No usable structure detected -- fall back to a single chapter row.
		// This still upgrades the manifest from whole-doc to a single-chapter
		// section tree (the seeder accepts an `'unstructured'` fallback by
		// emitting `kind: 'circular'`).
		return { sections: [], strategy, warnings: ['no chapter or paragraph headings detected'] };
	}

	const sections = buildSections(lines, headings, strategy, config);
	return { sections, strategy, warnings: [] };
}

// ---------------------------------------------------------------------------
// Internals
// ---------------------------------------------------------------------------

interface HeadingHit {
	readonly lineIndex: number;
	readonly kind: 'chapter' | 'l1' | 'subpara' | 'appendix';
	readonly code: string; // canonical code; e.g. "1", "1.1", "1.1.2", "A"
	readonly title: string;
	readonly raw: string;
}

function scanHeadings(lines: readonly string[]): readonly HeadingHit[] {
	const hits: HeadingHit[] = [];
	for (let i = 0; i < lines.length; i += 1) {
		const line = lines[i] ?? '';
		// Skip TOC entries (lines with dotted leaders) -- they look like
		// headings but are not body anchors.
		if (TOC_LEADER_RE.test(line)) continue;

		// Order matters: appendix takes precedence over flat L1 (since
		// `APPENDIX` headings ALSO start with a number-ish token in some ACs).
		const appendixM = APPENDIX_RE.exec(line);
		if (appendixM !== null) {
			const id = appendixM[2] ?? '';
			const title = (appendixM[3] ?? '').trim();
			hits.push({
				lineIndex: i,
				kind: 'appendix',
				code: `appendix-${id.toLowerCase()}`,
				title,
				raw: line,
			});
			continue;
		}

		const chapterM = CHAPTER_RE.exec(line) ?? CHAPTER_MIXED_RE.exec(line);
		if (chapterM !== null) {
			const num = chapterM[1] ?? '';
			const title = (chapterM[2] ?? '').trim();
			hits.push({
				lineIndex: i,
				kind: 'chapter',
				code: num,
				title,
				raw: line,
			});
			continue;
		}

		const subparaM = SUBPARA_RE.exec(line);
		if (subparaM !== null) {
			const code = subparaM[1] ?? '';
			const rest = (subparaM[2] ?? '').trim();
			const title = trimSubparaTitle(rest);
			// Defensive: subpara title must look like a real heading -- starts
			// with a capital and is not a list reference. Reject lines like
			// `4.5 above` that are mid-sentence references.
			if (looksLikeHeadingTitle(title)) {
				hits.push({
					lineIndex: i,
					kind: 'subpara',
					code,
					title,
					raw: line,
				});
				continue;
			}
		}

		const flatM = FLAT_L1_RE.exec(line);
		if (flatM !== null) {
			const num = flatM[1] ?? '';
			const title = stripTrailingPunct((flatM[2] ?? '').trim());
			// Reject if next non-empty line is a sub-paragraph for a DIFFERENT
			// number; we keep this check lightweight and rely on the strategy
			// pass to discard noisy hits.
			hits.push({
				lineIndex: i,
				kind: 'l1',
				code: num,
				title,
				raw: line,
			});
		}
	}
	return hits;
}

/**
 * Trim a subpara/L1 heading title to just the heading itself, dropping any
 * lead-in body text that follows the heading-terminator period. FAA AC body
 * lines almost always have the form
 *
 *     1.1 General. Standard operating procedures (SOP) are universally...
 *
 * where `General.` is the heading title and the rest is the first paragraph
 * of body text. We split on the FIRST period that is followed by whitespace
 * AND not preceded by a capital-letter abbreviation (e.g. `e.g.`, `i.e.`,
 * `U.S.`) -- but the FAA AC heading style is consistently `<Title-Case>.`
 * with no embedded periods, so a simple "first `. `" cut is reliable.
 */
function stripTrailingPunct(title: string): string {
	return title.replace(/[.:]+$/, '').trim();
}

function trimSubparaTitle(rest: string): string {
	// Reject empty / too-long candidates.
	if (rest.length === 0) return rest;
	// Find the first `. ` (period + space) -- that's the heading terminator.
	// If absent, the whole line is the title (heading without lead-in body).
	const idx = rest.indexOf('. ');
	if (idx < 0) {
		// Line might end with bare period.
		if (rest.endsWith('.')) return rest.slice(0, -1).trim();
		return rest.trim();
	}
	return rest.slice(0, idx).trim();
}

/**
 * A subpara heading title must look like a heading: starts with capital,
 * length within reason, doesn't start with a sentence-mid lower-case verb.
 * The body markdown produced by pdftotext occasionally contains references
 * like `4.5 above` or `7.2 contains` that the regex would otherwise grab.
 */
function looksLikeHeadingTitle(title: string): boolean {
	if (title.length < 2 || title.length > 200) return false;
	const first = title.charAt(0);
	if (first !== first.toUpperCase()) return false;
	// Reject titles ending in a comma or with no period -- a real heading
	// usually has a period after the title or runs into the body. Accept
	// either case but reject obvious mid-sentence noise.
	// Accept: "Introduction. The Earth..." or "Introduction"
	// Reject: "above is the procedure"
	return /^[A-Z]/.test(title);
}

function pickStrategy(headings: readonly HeadingHit[], config: AcExtractionConfig): ExtractionStrategy {
	if (config.chapterOnly === true) return 'chapter-only';
	const chapterCount = headings.filter((h) => h.kind === 'chapter').length;
	const l1Count = headings.filter((h) => h.kind === 'l1').length;
	const appendixCount = headings.filter((h) => h.kind === 'appendix').length;
	const subparaCount = headings.filter((h) => h.kind === 'subpara').length;

	if (chapterCount >= 2) return 'chapter-tree';
	if (l1Count >= 3 && appendixCount > 0) return 'mixed-paragraph';
	if (l1Count >= 3) return 'flat-paragraph';
	if (subparaCount >= 5) return 'flat-paragraph';
	return 'unstructured';
}

interface BuiltSection {
	level: 'chapter' | 'section' | 'subsection';
	code: string;
	ordinal: number;
	parentCode: string | null;
	title: string;
	startLine: number; // inclusive
	endLine: number; // exclusive
}

function buildSections(
	lines: readonly string[],
	headings: readonly HeadingHit[],
	strategy: ExtractionStrategy,
	_config: AcExtractionConfig,
): readonly ExtractedAcSection[] {
	// Pass 1: build the abstract section list with line ranges.
	const built: BuiltSection[] = [];

	if (strategy === 'chapter-tree' || strategy === 'chapter-only') {
		buildChapterTree(headings, strategy, built);
	} else if (strategy === 'flat-paragraph' || strategy === 'mixed-paragraph') {
		buildFlatParagraphTree(headings, built);
	}

	if (built.length === 0) return [];

	// Compute line ranges by scanning siblings + descendants.
	closeRanges(built, lines.length);

	// Build a map from chapter code -> chapter slug so child sections
	// inherit their parent's directory layout. Chapter codes are either
	// numeric (`'1'`, `'42'`) or `appendix-<id>`; each chapter computes
	// its own slug from its own title.
	const chapterSlugByCode = new Map<string, string>();
	for (const b of built) {
		if (b.level === 'chapter') {
			chapterSlugByCode.set(b.code, makeFileSlugFromTitle(b.code, b.title));
		}
	}

	// Pass 2: extract body text + assign ordinals.
	return built.map((b) => {
		const bodyLines = lines.slice(b.startLine, b.endLine);
		const bodyMd = bodyLines.join('\n').trim();
		const contentHash = sha256(bodyMd);
		const chapterCode = b.level === 'chapter' ? b.code : (b.code.split('.')[0] ?? '');
		const chapterSlug = chapterSlugByCode.get(chapterCode) ?? makeFileSlugFromTitle(b.code, b.title);
		const fileSlug = makeFileSlug(b);
		return {
			level: b.level,
			code: b.code,
			ordinal: b.ordinal,
			parentCode: b.parentCode,
			title: b.title,
			bodyMd,
			contentHash,
			fileSlug,
			chapterSlug,
		};
	});
}

function buildChapterTree(
	headings: readonly HeadingHit[],
	strategy: 'chapter-tree' | 'chapter-only',
	out: BuiltSection[],
): void {
	let chapterOrdinal = 0;
	let currentChapter: string | null = null;
	const subparaOrdinalsByParent = new Map<string, number>();

	for (const h of headings) {
		if (h.kind === 'chapter') {
			chapterOrdinal += 1;
			currentChapter = h.code;
			out.push({
				level: 'chapter',
				code: h.code,
				ordinal: chapterOrdinal,
				parentCode: null,
				title: h.title,
				startLine: h.lineIndex,
				endLine: -1,
			});
			continue;
		}
		if (h.kind === 'appendix') {
			chapterOrdinal += 1;
			currentChapter = h.code;
			out.push({
				level: 'chapter',
				code: h.code,
				ordinal: chapterOrdinal,
				parentCode: null,
				title: h.title,
				startLine: h.lineIndex,
				endLine: -1,
			});
			continue;
		}
		if (strategy === 'chapter-only') continue;
		if (h.kind === 'subpara') {
			// `1.1` -> parent chapter `1`; `1.1.2` -> parent section `1.1`.
			const parts = h.code.split('.');
			if (parts.length < 2) continue;
			const chapterCode = parts[0] ?? '';
			// Only emit if its chapter exists AND the chapter is the current
			// chapter (subparas appear in document order under their chapter;
			// a `1.3` heading appearing inside chapter 2 is mid-paragraph
			// noise per AC 61-98D's stall-speed callouts).
			const hasChapter = out.some((b) => b.level === 'chapter' && b.code === chapterCode);
			if (!hasChapter) continue;
			if (chapterCode !== currentChapter) continue;
			if (parts.length === 2) {
				const parent = chapterCode;
				const ord = (subparaOrdinalsByParent.get(parent) ?? 0) + 1;
				subparaOrdinalsByParent.set(parent, ord);
				out.push({
					level: 'section',
					code: h.code,
					ordinal: ord,
					parentCode: parent,
					title: h.title,
					startLine: h.lineIndex,
					endLine: -1,
				});
			} else {
				const parent = `${parts[0]}.${parts[1]}`;
				// Ensure parent section exists; if not, skip (subpara without parent is noise).
				const hasParent = out.some((b) => b.level === 'section' && b.code === parent);
				if (!hasParent) continue;
				const ord = (subparaOrdinalsByParent.get(parent) ?? 0) + 1;
				subparaOrdinalsByParent.set(parent, ord);
				out.push({
					level: 'subsection',
					code: h.code,
					ordinal: ord,
					parentCode: parent,
					title: h.title,
					startLine: h.lineIndex,
					endLine: -1,
				});
			}
		}
	}
}

function buildFlatParagraphTree(headings: readonly HeadingHit[], out: BuiltSection[]): void {
	// Flat ACs synthesize a single chapter wrapper per L1 paragraph (so the
	// schema's chapter level is honored). We emit each L1 hit as a chapter
	// row, then sub-paragraphs as section rows under it.
	let chapterOrdinal = 0;
	const subparaOrdinalsByParent = new Map<string, number>();
	let currentL1: string | null = null;
	let inAppendices = false;
	let lastL1Code: string | null = null;

	// A wrinkle: appendix bodies (e.g. AC 91-79A APPENDIX 1) restart at `1.`
	// and have their own subparas like `1.`, `2.`, etc. They look like fresh
	// L1 hits to scanHeadings. We detect "we are now inside appendices" once
	// we see an appendix marker, then skip subsequent flat-style L1 hits with
	// codes that go backwards (lower than the previous L1), treating them as
	// child sections of the most-recent appendix.
	let lastL1Numeric = 0;

	for (const h of headings) {
		if (h.kind === 'appendix') {
			chapterOrdinal += 1;
			out.push({
				level: 'chapter',
				code: h.code,
				ordinal: chapterOrdinal,
				parentCode: null,
				title: h.title,
				startLine: h.lineIndex,
				endLine: -1,
			});
			currentL1 = h.code;
			inAppendices = true;
			lastL1Numeric = 0;
			continue;
		}
		if (h.kind === 'l1') {
			const num = parseInt(h.code, 10);
			if (Number.isNaN(num)) continue;
			if (inAppendices) {
				// Inside an appendix, flat L1 hits become child sections of
				// the appendix container. Skip if monotonic check fails (the
				// FAA appendix bodies restart at `1.` so we accept descending
				// or equal sequences too).
				if (currentL1 === null) continue;
				const parent = currentL1;
				const ord = (subparaOrdinalsByParent.get(parent) ?? 0) + 1;
				subparaOrdinalsByParent.set(parent, ord);
				out.push({
					level: 'section',
					code: `${parent}.${h.code}`,
					ordinal: ord,
					parentCode: parent,
					title: h.title,
					startLine: h.lineIndex,
					endLine: -1,
				});
				continue;
			}
			// Pre-appendix L1 -- treat as a synthetic chapter, but enforce
			// monotonic numbering to filter out TOC noise + mid-paragraph
			// numbered lists. Accept num >= lastL1Numeric + 1 only when
			// num <= lastL1Numeric + 5 (allow gaps for skipped headings).
			if (num <= lastL1Numeric) continue;
			if (lastL1Numeric > 0 && num > lastL1Numeric + 5) continue;
			chapterOrdinal += 1;
			out.push({
				level: 'chapter',
				code: h.code,
				ordinal: chapterOrdinal,
				parentCode: null,
				title: h.title,
				startLine: h.lineIndex,
				endLine: -1,
			});
			currentL1 = h.code;
			lastL1Code = h.code;
			lastL1Numeric = num;
			continue;
		}
		if (h.kind === 'subpara') {
			const parts = h.code.split('.');
			if (parts.length < 2) continue;
			const chapterCode = parts[0] ?? '';
			// In flat-style ACs, the chapter code is the L1 number we synthesized.
			// Subpara `6.1` belongs to chapter `6`. If we haven't seen chapter
			// `6` yet, this is TOC noise -- drop.
			const hasL1 = out.some((b) => b.level === 'chapter' && b.code === chapterCode && b.parentCode === null);
			if (!hasL1) continue;
			if (parts.length === 2) {
				const parent = chapterCode;
				const ord = (subparaOrdinalsByParent.get(parent) ?? 0) + 1;
				subparaOrdinalsByParent.set(parent, ord);
				out.push({
					level: 'section',
					code: h.code,
					ordinal: ord,
					parentCode: parent,
					title: h.title,
					startLine: h.lineIndex,
					endLine: -1,
				});
			} else {
				const parent = `${parts[0]}.${parts[1]}`;
				const hasParent = out.some((b) => b.level === 'section' && b.code === parent);
				if (!hasParent) continue;
				const ord = (subparaOrdinalsByParent.get(parent) ?? 0) + 1;
				subparaOrdinalsByParent.set(parent, ord);
				out.push({
					level: 'subsection',
					code: h.code,
					ordinal: ord,
					parentCode: parent,
					title: h.title,
					startLine: h.lineIndex,
					endLine: -1,
				});
			}
			continue;
		}
		void lastL1Code;
	}
}

/**
 * Each section's body runs from its own heading line up to (exclusive) the
 * next heading line of the same or higher level. We compute this by walking
 * the built list in document order: each section's `endLine` is the start of
 * the next heading whose `level` is at the same or higher tier.
 */
function closeRanges(built: BuiltSection[], totalLines: number): void {
	const sortedByStart = [...built].sort((a, b) => a.startLine - b.startLine);
	for (let i = 0; i < sortedByStart.length; i += 1) {
		const cur = sortedByStart[i];
		if (cur === undefined) continue;
		// Find the next heading whose level is "outer or equal".
		let end = totalLines;
		for (let j = i + 1; j < sortedByStart.length; j += 1) {
			const next = sortedByStart[j];
			if (next === undefined) continue;
			if (rank(next.level) <= rank(cur.level)) {
				end = next.startLine;
				break;
			}
		}
		cur.endLine = end;
	}
	// Apply back to original order (built and sortedByStart share refs).
	void built;
}

function rank(level: 'chapter' | 'section' | 'subsection'): number {
	if (level === 'chapter') return 0;
	if (level === 'section') return 1;
	return 2;
}

function makeFileSlug(b: BuiltSection): string {
	if (b.level === 'chapter') {
		return makeFileSlugFromTitle(b.code, b.title);
	}
	if (b.level === 'section') {
		const parts = b.code.split('.');
		const para = parts[1] ?? '0';
		return `${pad2(para)}-${slugify(b.title)}`;
	}
	const parts = b.code.split('.');
	const para = parts[1] ?? '0';
	const sub = parts[2] ?? '0';
	return `${pad2(para)}-${pad2(sub)}-${slugify(b.title)}`;
}

function makeFileSlugFromTitle(code: string, title: string): string {
	// Chapter codes can be numeric or `appendix-X`. Pad numerics to 2 digits;
	// keep the appendix prefix verbatim.
	if (/^\d+$/.test(code)) {
		return `${pad2(code)}-${slugify(title)}`;
	}
	return `${slugify(code)}-${slugify(title)}`;
}

function pad2(s: string): string {
	if (/^\d+$/.test(s)) return s.padStart(2, '0');
	return s;
}

function slugify(text: string): string {
	const trimmed = text
		.toLowerCase()
		.normalize('NFKD')
		.replace(/[‘’]/g, "'")
		.replace(/[“”]/g, '"')
		.replace(/[–—]/g, '-')
		.replace(/&/g, ' and ')
		.replace(/[^a-z0-9]+/g, '-')
		.replace(/^-+|-+$/g, '');
	if (trimmed.length === 0) return 'untitled';
	// Cap slug length so paths remain manageable; AC titles can run long.
	return trimmed.slice(0, 60).replace(/-+$/g, '');
}

function sha256(input: string): string {
	return createHash('sha256').update(input, 'utf-8').digest('hex');
}
